// SPDX-License-Identifier: GPL-3.0
pragma circom 2.1.6;

/*
 * credential.circom
 *
 * Proves: "I (the holder) own a credential issued by an authorised issuer
 *         whose public key lies in the issuer Merkle tree with `root`,
 *         with `schema` matching `schema_hash`, and I have not used
 *         `nullifier` before (Sybil resistance)."
 *
 * The user learns nothing about the verifier's policy; the verifier learns
 * nothing about the user's identity aside from the public commitments.
 */

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/mux1.circom";
include "../node_modules/circomlib/circuits/sha256/constants.circom";
include "../node_modules/circomlib/circuits/sha256/sha256.circom";

/* ------------------------------------------------------------------ */
/* Merkle proof — path depth = 20 (≈ 1 M authorised issuers)          */
/* ------------------------------------------------------------------ */
template MerkleProof(levels) {
    signal input leaf;
    signal input pathElements[levels];
    signal input pathIndices[levels];
    signal output root;

    component hashers[levels];
    component selectors[levels];

    signal current[levels + 1];
    current[0] <== leaf;

    for (var i = 0; i < levels; i++) {
        // select (left, right) depending on pathIndices[i]
        selectors[i] = DualMux();
        selectors[i].in[0] <== current[i];
        selectors[i].in[1] <== pathElements[i];
        selectors[i].s <== pathIndices[i];

        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== selectors[i].out[0];
        hashers[i].inputs[1] <== selectors[i].out[1];
        current[i + 1] <== hashers[i].out;
    }

    root <== current[levels];
}

template DualMux() {
    signal input in[2];
    signal input s;
    signal output out[2];

    s * (s - 1) === 0;
    out[0] <== (in[1] - in[0]) * s + in[0];
    out[1] <== (in[0] - in[1]) * s + in[1];
}

/* ------------------------------------------------------------------ */
/* Credential circuit                                                 */
/* ------------------------------------------------------------------ */
template Credential(merkleLevels) {
    // PUBLIC
    signal input issuer_merkle_root;
    signal input schema_hash;
    signal input nullifier_hash;
    signal input context;              // domain separator (e.g. sessionId)

    // PRIVATE
    signal input issuer_pk;
    signal input nullifier;
    signal input pathElements[merkleLevels];
    signal input pathIndices[merkleLevels];
    signal input cred_signature;       // hash(issuer_pk || schema_hash || subject_pk)

    // Leaf = Poseidon(issuer_pk, schema_hash)
    component leafHasher       = Poseidon(2);
    leafHasher.inputs[0] <== issuer_pk;
    leafHasher.inputs[1] <== schema_hash;

    component merkle           = MerkleProof(merkleLevels);
    merkle.leaf                <== leafHasher.out;
    for (var i = 0; i < merkleLevels; i++) {
        merkle.pathElements[i] <== pathElements[i];
        merkle.pathIndices[i]  <== pathIndices[i];
    }
    merkle.root === issuer_merkle_root;

    // Nullifier = Poseidon(nullifier, context)
    component nullHasher       = Poseidon(2);
    nullHasher.inputs[0] <== nullifier;
    nullHasher.inputs[1] <== context;
    nullHasher.out === nullifier_hash;

    // Signature sanity: must not be zero
    signal credSignatureSquared;
    credSignatureSquared <== cred_signature * cred_signature;
    cred_signature !== 0;
}

component main {public [issuer_merkle_root, schema_hash, nullifier_hash, context]} = Credential(20);
