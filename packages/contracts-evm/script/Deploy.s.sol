// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {IdentitySBT}      from "../src/IdentitySBT.sol";
import {WrappedBadge}     from "../src/WrappedBadge.sol";

/// @title Deploy — one-shot deployment of the full EVM surface.
contract Deploy is Script {
    function run() external {
        uint256 pk      = vm.envUint("EVM_DEPLOYER_PRIVATE_KEY");
        address admin   = vm.addr(pk);
        uint32  chainId = uint32(block.chainid);

        address[] memory issuers = new address[](1);
        issuers[0] = admin;    // scaffold: deployer is initially the only issuer

        vm.startBroadcast(pk);

        IdentityRegistry registry = new IdentityRegistry(admin);
        IdentitySBT      badge    = new IdentitySBT(admin, issuers);
        WrappedBadge     bridge   = new WrappedBadge(badge, chainId, admin);

        // Grant the bridge the ISSUER_ROLE on the SBT so it can call
        // `bridgeBurn`. We do this AFTER both contracts are deployed
        // because WrappedBadge's constructor can't self-grant.
        badge.grantRole(badge.ISSUER_ROLE(), address(bridge));

        vm.stopBroadcast();

        // Log addresses — the deploy-all.sh script greps these.
        console2.log("IdentityRegistry:", address(registry));
        console2.log("IdentitySBT     :", address(badge));
        console2.log("WrappedBadge    :", address(bridge));
    }
}
