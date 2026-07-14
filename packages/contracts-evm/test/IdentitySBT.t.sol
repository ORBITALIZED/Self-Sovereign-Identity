// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { IdentitySBT } from "../src/IdentitySBT.sol";
import { IdentityRegistry } from "../src/IdentityRegistry.sol";
import { IIdentity } from "../src/interfaces/IIdentity.sol";

contract IdentitySBTTest is Test {
    event CredentialIssued(
        address indexed issuer,
        address indexed holder,
        bytes32 indexed schemaHash,
        string cid,
        uint256 tokenId
    );

    IdentitySBT sbt;
    IdentityRegistry registry;

    address admin = makeAddr("admin");
    address issuer = makeAddr("issuer");
    address holder = makeAddr("holder");
    address stranger = makeAddr("stranger");

    bytes32 SCHEMA_DEGREE = keccak256("degree");
    bytes32 SCHEMA_PASSPORT = keccak256("passport");

    function setUp() public {
        address[] memory issuers = new address[](1);
        issuers[0] = issuer;
        sbt = new IdentitySBT(admin, issuers);
        registry = new IdentityRegistry(admin);

        vm.prank(admin);
        sbt.registerSchema(SCHEMA_DEGREE);
    }

    function test_issue_and_query() public {
        vm.prank(issuer);
        uint256 tid = sbt.issueCredential(
            holder,
            SCHEMA_DEGREE,
            "QmCID",
            uint64(block.timestamp + 30 days)
        );
        assertEq(sbt.ownerOf(tid), holder);
        assertEq(sbt.tokenCid(tid), "QmCID");
    }

    function test_transfer_blocked() public {
        vm.prank(issuer);
        uint256 tid = sbt.issueCredential(
            holder,
            SCHEMA_DEGREE,
            "QmCID",
            uint64(block.timestamp + 30 days)
        );

        vm.prank(holder);
        vm.expectRevert();
        sbt.transferFrom(holder, stranger, tid);
    }

    function test_revoke() public {
        vm.prank(issuer);
        uint256 tid = sbt.issueCredential(
            holder,
            SCHEMA_DEGREE,
            "QmCID",
            uint64(block.timestamp + 30 days)
        );
        vm.prank(issuer);
        sbt.revokeCredential(tid);
        vm.expectRevert();
        sbt.ownerOf(tid);
    }

    /// Only an issuer (ISSUER_ROLE) can mint credentials.
    /// A stranger must be rejected with the AccessControl error.
    function test_issue_reverts_for_non_issuer() public {
        vm.prank(stranger);
        vm.expectRevert();
        sbt.issueCredential(holder, SCHEMA_DEGREE, "QmCID", uint64(block.timestamp + 30 days));
    }

    /// Registering a schema requires DEFAULT_ADMIN_ROLE.
    function test_register_schema_reverts_for_non_admin() public {
        vm.prank(stranger);
        vm.expectRevert();
        sbt.registerSchema(SCHEMA_PASSPORT);
    }

    /// Issue must revert when the schema has not been registered.
    function test_issue_reverts_for_unknown_schema() public {
        vm.prank(issuer);
        vm.expectRevert(abi.encodeWithSelector(IIdentity.UnknownSchema.selector, SCHEMA_PASSPORT));
        sbt.issueCredential(holder, SCHEMA_PASSPORT, "QmCID", uint64(block.timestamp + 30 days));
    }

    /// Bridge burn must revert for non-issuer callers.
    function test_bridge_burn_reverts_for_stranger() public {
        vm.prank(issuer);
        uint256 tid = sbt.issueCredential(
            holder,
            SCHEMA_DEGREE,
            "QmCID",
            uint64(block.timestamp + 30 days)
        );

        vm.prank(stranger);
        vm.expectRevert();
        sbt.bridgeBurn(tid);
    }

    /// The CredentialIssued event must be emitted with correct args.
    function test_issue_emits_event() public {
        vm.expectEmit(true, true, true, false, address(sbt));
        emit CredentialIssued(
            issuer,
            holder,
            SCHEMA_DEGREE,
            "QmEventCid",
            1 // first token ID since _tokenIdCounter starts at 1
        );

        vm.prank(issuer);
        sbt.issueCredential(holder, SCHEMA_DEGREE, "QmEventCid", uint64(block.timestamp + 30 days));
    }
}
