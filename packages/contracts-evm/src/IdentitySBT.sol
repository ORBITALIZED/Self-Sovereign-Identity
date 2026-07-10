// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IIdentity } from "./interfaces/IIdentity.sol";

/// @title IdentitySBT — Soulbound Identity Badge
/// @notice ERC-721 whose transfers are blocked (only mint/burn by issuer).
/// @dev    The token URI is an IPFS CID pointing to an encrypted credential.
contract IdentitySBT is ERC721, AccessControl, IIdentity {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    /// @dev Monotonically incrementing token-id counter. OZ v5 ERC721 no
    ///      longer exposes `_nextTokenId`, so we maintain our own counter.
    uint256 private _tokenIdCounter;

    /// @notice Schema hash → boolean "is this a recognised schema?"
    mapping(bytes32 => bool) public schemas;

    /// @notice (holder, schema) → tokenId (so a holder has at most one badge per schema).
    mapping(address => mapping(bytes32 => uint256)) public holderSchemaToken;

    /// @notice Token → IPFS CID of the encrypted credential.
    mapping(uint256 => string) public tokenCid;

    struct Credential {
        bytes32 schemaHash;
        string cid;
        uint64 issuedAt;
        uint64 validUntil;
        bool revoked;
    }

    mapping(uint256 => Credential) public credentials;

    constructor(address admin, address[] memory issuers) ERC721("SSI Identity Badge", "SSIB") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        for (uint256 i; i < issuers.length; ++i) {
            _grantRole(ISSUER_ROLE, issuers[i]);
        }
        // Token IDs start at 1 so that 0 remains a sentinel "no token" value.
        _tokenIdCounter = 1;
    }

    // -- Issuer API ---------------------------------------------------------

    /// @notice Register a new credential schema (admin only).
    function registerSchema(bytes32 schemaHash) external onlyRole(DEFAULT_ADMIN_ROLE) {
        schemas[schemaHash] = true;
    }

    /// @notice Mint a soulbound badge for `(holder, schema)`.
    function issueCredential(
        address holder,
        bytes32 schemaHash,
        string calldata cid,
        uint64 validUntil
    ) external onlyRole(ISSUER_ROLE) returns (uint256 tokenId) {
        if (!schemas[schemaHash]) revert UnknownSchema(schemaHash);
        if (holderSchemaToken[holder][schemaHash] != 0) {
            revert AlreadyIssued(holder, schemaHash);
        }
        tokenId = _nextId();
        _safeMint(holder, tokenId);
        holderSchemaToken[holder][schemaHash] = tokenId;
        tokenCid[tokenId] = cid;
        credentials[tokenId] = Credential({
            schemaHash: schemaHash,
            cid: cid,
            issuedAt: uint64(block.timestamp),
            validUntil: validUntil,
            revoked: false
        });

        emit CredentialIssued(msg.sender, holder, schemaHash, cid, tokenId);
    }

    /// @notice Revoke an issued badge.
    function revokeCredential(uint256 tokenId) external onlyRole(ISSUER_ROLE) {
        _burn(tokenId);
        credentials[tokenId].revoked = true;
    }

    // -- Soulbound enforcement ----------------------------------------------

    /// @dev Overrides ERC721 `_update` to reject transfers between EOAs.
    /// @return The previous owner address (delegated to super).
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal virtual override returns (address) {
        // allow mint (from == 0) AND burn (to == 0) — block all other transfers
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert TransferForbidden();
        return super._update(to, tokenId, auth);
    }

    /// @notice Optional allow-list endpoint (e.g. for the bridge to burn).
    /// @dev Restricted to ISSUER_ROLE so only authorised bridges can burn.
    function bridgeBurn(uint256 tokenId) external onlyRole(ISSUER_ROLE) {
        _burn(tokenId);
    }

    // -- Helpers ------------------------------------------------------------

    /// @dev Returns the next token ID and advances the counter.
    function _nextId() internal returns (uint256 tokenId) {
        tokenId = _tokenIdCounter;
        _tokenIdCounter += 1;
    }

    /// @inheritdoc ERC721
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        string memory cid = tokenCid[tokenId];
        // ipfs://<cid>
        return string.concat("ipfs://", cid);
    }

    /// @dev ERC721 and AccessControl both declare supportsInterface; we must
    ///      provide an explicit override that delegates to both.
    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
