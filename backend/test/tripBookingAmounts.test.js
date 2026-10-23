import assert from "node:assert/strict";
import test from "node:test";
import { calculatePublicBookingAmounts } from "../src/tripBookingAmounts.js";

test("calculates per-person price, single supplement, and party deposit", () => {
  assert.deepEqual(
    calculatePublicBookingAmounts({
      tripPrice: 1200,
      singleSupplement: 250,
      depositPerPerson: 500,
      partyNumber: 2,
      discountAmount: 100,
    }),
    {
      initial_booking_amount: 2400,
      single_supplement_booking_amount: 250,
      deposit_amount: 1000,
      payment_amount: 1000,
    },
  );
});

test("caps payment to the discounted total when it is below the deposit", () => {
  assert.deepEqual(
    calculatePublicBookingAmounts({
      tripPrice: 400,
      singleSupplement: 0,
      depositPerPerson: 500,
      partyNumber: 1,
      discountAmount: 100,
    }),
    {
      initial_booking_amount: 400,
      single_supplement_booking_amount: 0,
      deposit_amount: 300,
      payment_amount: 300,
    },
  );
});

test("charges the discounted total when a trip has no configured deposit", () => {
  assert.deepEqual(
    calculatePublicBookingAmounts({
      tripPrice: 400,
      singleSupplement: 0,
      depositPerPerson: 0,
      partyNumber: 1,
      discountAmount: 50,
    }),
    {
      initial_booking_amount: 400,
      single_supplement_booking_amount: 0,
      deposit_amount: 350,
      payment_amount: 350,
    },
  );
});
