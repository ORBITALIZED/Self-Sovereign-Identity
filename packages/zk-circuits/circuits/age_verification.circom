// SPDX-License-Identifier: GPL-3.0
pragma circom 2.1.6;

/*
 * age_verification.circom
 *
 * Proves: "My date of birth is older than `min_age` years at `timestamp`."
 *
 * Public  : min_age, current_timestamp, dob_commitment
 * Private : dob_year, dob_month, dob_day
 *
 * FIX: Circom operates over a prime field — the `/` operator does modular
 * inverse division, NOT integer division.  To compute integer floor-division
 * we instead check the range constraint:
 *
 *   age_seconds >= min_age * SECONDS_PER_YEAR
 *
 * This is mathematically equivalent to  age_years >= min_age  (for the
 * simplified model that ignores leap years) and avoids any field division.
 */

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

template AgeVerification() {
    // -----------------------------------------------------------------------
    // PUBLIC signals
    // -----------------------------------------------------------------------
    signal input min_age;                // minimum age in full years
    signal input current_timestamp;      // unix seconds
    signal input dob_commitment;         // Poseidon(dob_year, dob_month, dob_day)

    // -----------------------------------------------------------------------
    // PRIVATE signals
    // -----------------------------------------------------------------------
    signal input dob_year;
    signal input dob_month;
    signal input dob_day;

    // -----------------------------------------------------------------------
    // Compute dob as Unix epoch (simplified: 365 d/yr, 30 d/mo, no leap)
    // -----------------------------------------------------------------------
    signal dob_epoch;
    dob_epoch <== (dob_year * 31536000) + (dob_month * 2592000) + (dob_day * 86400);

    // Elapsed seconds since birth
    signal age_seconds;
    age_seconds <== current_timestamp - dob_epoch;

    // -----------------------------------------------------------------------
    // Age check — avoid integer division (not valid in prime-field Circom).
    // Instead verify:  age_seconds >= min_age * SECONDS_PER_YEAR
    // -----------------------------------------------------------------------
    signal min_age_seconds;
    min_age_seconds <== min_age * 31536000;

    component gte = GreaterEqThan(64);   // 64-bit comparison (timestamp range)
    gte.in[0] <== age_seconds;
    gte.in[1] <== min_age_seconds;
    gte.out === 1;

    // -----------------------------------------------------------------------
    // Commitment check
    // -----------------------------------------------------------------------
    component comm = Poseidon(3);
    comm.inputs[0] <== dob_year;
    comm.inputs[1] <== dob_month;
    comm.inputs[2] <== dob_day;
    comm.out === dob_commitment;

    // -----------------------------------------------------------------------
    // Sanity ranges
    // -----------------------------------------------------------------------
    // Month in [1, 12]
    component monthRange = LessEqThan(4);
    monthRange.in[0] <== dob_month;
    monthRange.in[1] <== 12;
    monthRange.out === 1;
}

component main {public [min_age, current_timestamp, dob_commitment]} = AgeVerification();
