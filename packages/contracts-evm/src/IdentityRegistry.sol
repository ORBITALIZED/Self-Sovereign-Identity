// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IIdentity } from "./interfaces/IIdentity.sol";

/// @title IdentityRegistry — authoritative list of issuers and schemas.
/// @notice Issuer onboarding & schema catalogue. Independent of the SBT so
///         many SBT collections (one per university, one per country…) can
///         share the same registry.
contract IdentityRegistry is AccessControl, IIdentity {
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    struct Issuer {
        address wallet;
        string uri; // IPFS CID of issuer profile / public key
        bool active;
    }

    struct Schema {
        bytes32 hash;
        string uri; // IPFS CID of schema definition (JSON-LD)
        bool active;
    }

    mapping(address => Issuer) public issuers;
    mapping(bytes32 => Schema) public schemas;
    mapping(address => bytes32[]) public holderSchemas;

    event IssuerRegistered(address indexed wallet, string uri);
    event SchemaRegistered(bytes32 indexed hash, string uri);
    event IssuerRevoked(address indexed wallet);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @notice The address attempting to call a registrar-gated function is not authorised.
    error NotRegistrar(address caller);
    /// @notice The issuer being registered has already been recorded.
    error AlreadyRegistered(address issuer);
    /// @notice The schema being registered has already been recorded.
    error SchemaAlreadyRegistered(bytes32 hash);

    // -- Issuer management -------------------------------------------------

    /// @notice Register a new credential issuer and mark them active.
    /// @param  issuer The on-chain address allowed to issue credentials.
    /// @param  uri    IPFS CID pointing to the issuer's public profile / key.
    function registerIssuer(address issuer, string calldata uri) external onlyRole(REGISTRAR_ROLE) {
        if (issuers[issuer].active) revert AlreadyRegistered(issuer);
        issuers[issuer] = Issuer(issuer, uri, true);
        emit IssuerRegistered(issuer, uri);
    }

    /// @notice Mark an issuer as inactive. Existing credentials remain on-chain
    ///         but no new credentials can be issued from this address.
    /// @param  issuer The issuer address to deactivate.
    function revokeIssuer(address issuer) external onlyRole(REGISTRAR_ROLE) {
        issuers[issuer].active = false;
        emit IssuerRevoked(issuer);
    }

    // -- Schema catalogue --------------------------------------------------

    /// @notice Register a new credential schema and mark it active.
    /// @param  hash Stable hash of the schema document.
    /// @param  uri   IPFS CID pointing to the JSON-LD schema definition.
    function registerSchema(bytes32 hash, string calldata uri) external onlyRole(REGISTRAR_ROLE) {
        if (schemas[hash].active) revert SchemaAlreadyRegistered(hash);
        schemas[hash] = Schema(hash, uri, true);
        emit SchemaRegistered(hash, uri);
    }

    // -- Holder views -------------------------------------------------------

    /// @notice Append a (holder, schema) link without minting an SBT — used
    ///         for off-chain verifications where no on-chain credential is
    ///         needed but the registry should still know about the link.
    /// @param  holder     The subject whose schema list is being updated.
    /// @param  schemaHash The schema being attested for the holder.
    function attest(address holder, bytes32 schemaHash) external onlyRole(REGISTRAR_ROLE) {
        holderSchemas[holder].push(schemaHash);
        emit CredentialIssued(msg.sender, holder, schemaHash, "", 0);
    }

    /// @notice True if `who` is currently an active registered issuer.
    function isIssuer(address who) external view returns (bool) {
        return issuers[who].active;
    }

    /// @notice True if `hash` is currently an active registered schema.
    function isSchema(bytes32 hash) external view returns (bool) {
        return schemas[hash].active;
    }
}
