// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { IdentitySBT } from "../src/IdentitySBT.sol";
import { IdentityRegistry } from "../src/IdentityRegistry.sol";

contract IdentitySBTTest is Test {
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
}
