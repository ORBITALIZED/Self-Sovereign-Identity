// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IdentitySBT} from "./IdentitySBT.sol";
import {IIdentity} from "./interfaces/IIdentity.sol";

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

    /// @notice Emitted when an SBT is locked-and-moved to a Stellar-native wrapped asset.
    /// @param  holder The EVM address that owned the SBT pre-burn.
    /// @param  schemaHash Schema hash of the burned credential.
    /// @param  tokenId  The burned token's id (== 0 after the `_burn`).
    /// @param  destinationChainId Chain id of the destination network.
    /// @param  stellarPubKeyXdrHash Hash of the recipient Stellar pubkey.
    event BadgeLocked(
        address indexed holder,
        bytes32 indexed schemaHash,
        uint256 tokenId,
        uint32 destinationChainId,
        bytes32 stellarPubKeyXdrHash
    );

    /// @notice The caller is not the current owner of the SBT being locked.
    error NotHolder();
    /// @notice The same lock tuple has already been processed (replay).
    error ReplayLock();

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
    /// @dev    Caller must be the current holder of `tokenId`. The same
    ///         `(holder, tokenId, destinationChainId, stellarPubKeyXdrHash)`
    ///         tuple cannot be submitted twice (replay protection).
    ///
    ///         Reentrancy-safe: performs external call (bridgeBurn) AFTER
    ///         updating `processedLocks`, following checks-effects-interactions.
    /// @param  tokenId The SBT that will be burned.
    /// @param  destinationChainId Chain ID of the Soroban network to wrap into.
    /// @param  stellarPubKeyXdrHash Hash of the Stellar pubkey the wrapped badge will be issued to.
    function lockAndNotify(uint256 tokenId, uint32 destinationChainId, bytes32 stellarPubKeyXdrHash)
        external
    {
        address holder = badge.ownerOf(tokenId);
        if (holder != msg.sender) revert NotHolder();

        (bytes32 schemaHash,,,,) = badge.credentials(tokenId);
        bytes32 lockHash =
            keccak256(abi.encode(holder, tokenId, destinationChainId, stellarPubKeyXdrHash));
        if (processedLocks[lockHash]) revert ReplayLock();
        processedLocks[lockHash] = true;

        badge.bridgeBurn(tokenId);
        emit BadgeLocked(holder, schemaHash, tokenId, destinationChainId, stellarPubKeyXdrHash);
    }
}
