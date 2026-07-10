// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IdentitySBT } from "./IdentitySBT.sol";
import { IIdentity } from "./interfaces/IIdentity.sol";

/// @title WrappedBadge — cross-chain lock & burn hook for the relayer.
/// @notice When the relayer wants to wrap a badge onto Stellar, the holder
///         or an issuer calls `lockAndNotify`. The SBT is burned and a
///         `BadgeLocked` event is emitted for the relayer to observe.
contract WrappedBadge is AccessControl, IIdentity {
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");

    IdentitySBT public immutable badge;
    uint32 public immutable selfChainId;

    /// @notice Hash that prevents replay across chains.
    mapping(bytes32 => bool) public processedLocks;

    event BadgeLocked(
        address indexed holder,
        bytes32 indexed schemaHash,
        uint256 tokenId,
        uint32 destinationChainId,
        bytes32 stellarPubKeyXdrHash
    );

    // NOTE: `badge` and `selfChainId` immutables are declared at the top of
    //       this contract. Do NOT re-declare them here.
    //
    // The bridge needs the ISSUER_ROLE on the SBT in order to call
    // `bridgeBurn`. OZ v5 restricts `grantRole` to the DEFAULT_ADMIN_ROLE
    // holder, so WrappedBadge can't grant itself the role from inside its
    // own constructor (msg.sender would itself not hold the role).
    // Run `sbt.grantRole(sbt.ISSUER_ROLE(), address(bridge))` from
    // `script/Deploy.s.sol` AFTER both contracts are deployed.

    constructor(IdentitySBT badge_, uint32 chainId_, address relayer) {
        _grantRole(DEFAULT_ADMIN_ROLE, relayer);
        _grantRole(RELAYER_ROLE, relayer);
        badge = badge_;
        selfChainId = chainId_;
    }

    /// @notice Lock & notify. Burns the SBT and emits an event consumed by
    ///         the bridge relayer which will mint a wrapped asset on Stellar.
    function lockAndNotify(
        uint256 tokenId,
        uint32 destinationChainId,
        bytes32 stellarPubKeyXdrHash
    ) external {
        address holder = badge.ownerOf(tokenId);
        require(holder == msg.sender, "SSI: only holder can lock");

        bytes32 schemaHash = badge.credentials(tokenId).schemaHash;
        bytes32 lockHash = keccak256(
            abi.encode(holder, tokenId, destinationChainId, stellarPubKeyXdrHash)
        );
        require(!processedLocks[lockHash], "SSI: replay");
        processedLocks[lockHash] = true;

        badge.bridgeBurn(tokenId);
        emit BadgeLocked(holder, schemaHash, tokenId, destinationChainId, stellarPubKeyXdrHash);
    }
}
