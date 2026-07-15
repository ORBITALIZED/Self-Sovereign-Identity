// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";

contract IdentityRegistryTest is Test {
    IdentityRegistry registry;

    address admin = makeAddr("admin");
    address registrar = makeAddr("registrar");
    address stranger = makeAddr("stranger");
    address issuer = makeAddr("issuer");
    address holder = makeAddr("holder");

    bytes32 SCHEMA = keccak256("passport");
    bytes32 REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    event IssuerRegistered(address indexed wallet, string uri);
    event SchemaRegistered(bytes32 indexed hash, string uri);
    event IssuerRevoked(address indexed wallet);

    function setUp() public {
        registry = new IdentityRegistry(admin);
        vm.prank(admin);
        registry.grantRole(REGISTRAR_ROLE, registrar);
    }

    function test_register_issuer() public {
        vm.expectEmit(true, false, false, true, address(registry));
        emit IssuerRegistered(issuer, "QmIssuerProfile");
        vm.prank(registrar);
        registry.registerIssuer(issuer, "QmIssuerProfile");

        assertTrue(registry.isIssuer(issuer));
        assertFalse(registry.isIssuer(stranger));
    }

    function test_register_issuer_double_reverts() public {
        vm.prank(registrar);
        registry.registerIssuer(issuer, "QmA");

        vm.prank(registrar);
        vm.expectRevert(abi.encodeWithSelector(IdentityRegistry.AlreadyRegistered.selector, issuer));
        registry.registerIssuer(issuer, "QmA");
    }

    function test_revoke_issuer() public {
        vm.prank(registrar);
        registry.registerIssuer(issuer, "QmA");

        vm.expectEmit(true, false, false, true, address(registry));
        emit IssuerRevoked(issuer);

        vm.prank(registrar);
        registry.revokeIssuer(issuer);

        assertFalse(registry.isIssuer(issuer));
    }

    function test_register_schema() public {
        vm.expectEmit(true, false, false, true, address(registry));
        emit SchemaRegistered(SCHEMA, "QmSchema");
        vm.prank(registrar);
        registry.registerSchema(SCHEMA, "QmSchema");
        assertTrue(registry.isSchema(SCHEMA));
    }

    function test_register_schema_double_reverts() public {
        vm.prank(registrar);
        registry.registerSchema(SCHEMA, "QmA");
        vm.prank(registrar);
        vm.expectRevert(
            abi.encodeWithSelector(IdentityRegistry.SchemaAlreadyRegistered.selector, SCHEMA)
        );
        registry.registerSchema(SCHEMA, "QmA");
    }

    function test_attest_appends_schema() public {
        vm.prank(registrar);
        registry.attest(holder, SCHEMA);

        bytes32[] memory saw = registry.getHolderSchemas(holder);
        assertEq(saw.length, 1);
        assertEq(saw[0], SCHEMA);
    }

    function test_attest_reverts_for_stranger() public {
        // AccessControl's onlyRole modifier reverts with OZ's
        // `UnauthorizedAccount(account)` selector — don't match on our own
        // custom error (which is unused, see comments in IdentityRegistry.sol).
        vm.prank(stranger);
        vm.expectRevert();
        registry.attest(holder, SCHEMA);
    }

    // ── Additional tests ---------------------------------------------------

    /// Non-registrar cannot revoke an issuer.
    function test_revoke_issuer_by_stranger_reverts() public {
        vm.prank(registrar);
        registry.registerIssuer(issuer, "QmA");

        vm.prank(stranger);
        vm.expectRevert();
        registry.revokeIssuer(issuer);
    }

    /// Revoking an unregistered issuer does not revert (it's a no-op).
    function test_revoke_unregistered_issuer() public {
        vm.prank(registrar);
        registry.revokeIssuer(stranger);
        assertFalse(registry.isIssuer(stranger));
    }

    /// A holder may have multiple schemas attested.
    function test_multiple_schema_attestations() public {
        bytes32 schemaB = keccak256("birth_cert");
        bytes32 schemaC = keccak256("drivers_license");

        vm.startPrank(registrar);
        registry.attest(holder, SCHEMA);
        registry.attest(holder, schemaB);
        registry.attest(holder, schemaC);
        vm.stopPrank();

        bytes32[] memory saw = registry.getHolderSchemas(holder);
        assertEq(saw.length, 3);
        assertEq(saw[0], SCHEMA);
        assertEq(saw[1], schemaB);
        assertEq(saw[2], schemaC);
    }

    /// getHolderSchemas returns empty array for a holder with no attestations.
    function test_get_holder_schemas_empty() public view {
        bytes32[] memory saw = registry.getHolderSchemas(stranger);
        assertEq(saw.length, 0);
    }
}
