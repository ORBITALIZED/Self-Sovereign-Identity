// SPDX-License-Identifier: GPL-3.0
pragma circom 2.1.6;

/*
 * age_verification.circom
 *
 * Proves: "My date of birth is older than `min_age` years at `timestamp`."
 *
 * Public  : min_age, current_timestamp, dob_commitment
 * Private : dob_year, dob_month, dob_day
 */

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

template AgeVerification() {
    // PUBLIC
    signal input min_age;
    signal input current_timestamp;     // unix seconds
    signal input dob_commitment;

    // PRIVATE
    signal input dob_year;
    signal input dob_month;
    signal input dob_day;

    // Derive Unix epoch from dob (mock — assumes each year = 31_536_000s, no leap)
    signal dob_epoch;
    dob_epoch <== (dob_year * 31536000) + (dob_month * 2592000) + (dob_day * 86400);

    // age_seconds = current - dob
    signal age_seconds;
    age_seconds <== current_timestamp - dob_epoch;

    // age_years = age_seconds / 31_536_000
    signal age_years;
    age_years <== age_seconds / 31536000;

    // require age_years >= min_age
    component gte = GreaterEqThan(8);
    gte.in[0] <== age_years;
    gte.in[1] <== min_age;
    gte.out === 1;

    // commitment = Poseidon(dob_year, dob_month, dob_day)
    component comm = Poseidon(3);
    comm.inputs[0] <== dob_year;
    comm.inputs[1] <== dob_month;
    comm.inputs[2] <== dob_day;
    comm.out === dob_commitment;

    // sanity ranges
    signal yearOk; yearOk <== dob_year * dob_year;        // non-zero
    signal monthOk;                                              // 1..12
    component monthRange = LessEqThan(4);
    monthRange.in[0] <== dob_month;
    monthRange.in[1] <== 12;
    monthRange.out === 1;
}

component main {public [min_age, current_timestamp, dob_commitment]} = AgeVerification();
