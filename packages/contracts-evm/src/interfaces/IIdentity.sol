// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IIdentity — common interface for the SSI EVM contracts.
/// @notice Implemented by `IdentitySBT`, `IdentityRegistry` and `WrappedBadge`.
interface IIdentity {
    /// @notice Emitted whenever a credential is minted to a holder.
    event CredentialIssued(
        address indexed issuer,
        address indexed holder,
        bytes32 indexed schemaHash,
        string cid,
        uint256 tokenId
    );

    error NotIssuer(address caller);
    error TransferForbidden();
    error AlreadyIssued(address holder, bytes32 schemaHash);
    error UnknownSchema(bytes32 schemaHash);
}
