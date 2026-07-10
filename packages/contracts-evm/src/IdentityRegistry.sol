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

    // -- Issuer management -------------------------------------------------

    function registerIssuer(address issuer, string calldata uri) external onlyRole(REGISTRAR_ROLE) {
        issuers[issuer] = Issuer(issuer, uri, true);
        emit IssuerRegistered(issuer, uri);
    }

    function revokeIssuer(address issuer) external onlyRole(REGISTRAR_ROLE) {
        issuers[issuer].active = false;
        emit IssuerRevoked(issuer);
    }

    // -- Schema catalogue --------------------------------------------------

    function registerSchema(bytes32 hash, string calldata uri) external onlyRole(REGISTRAR_ROLE) {
        schemas[hash] = Schema(hash, uri, true);
        emit SchemaRegistered(hash, uri);
    }

    // -- Holder views -------------------------------------------------------

    function attest(address holder, bytes32 schemaHash) external onlyRole(REGISTRAR_ROLE) {
        holderSchemas[holder].push(schemaHash);
        emit CredentialIssued(msg.sender, holder, schemaHash, "", 0);
    }

    function isIssuer(address who) external view returns (bool) {
        return issuers[who].active;
    }

    function isSchema(bytes32 hash) external view returns (bool) {
        return schemas[hash].active;
    }
}
