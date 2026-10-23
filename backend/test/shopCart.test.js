import assert from "node:assert/strict";
import test from "node:test";
import { calculateShopTotals } from "../src/shopCart.js";

test("shop totals apply percentage coupons and free shipping above $50", () => {
  assert.deepEqual(
    calculateShopTotals(
      [
        { price: 30, quantity: 2 },
        { price: 10, quantity: 1 },
      ],
      { type: "Percentage", value: 10 },
    ),
    { subtotal: 70, discount: 7, shipping: 0, total: 63 },
  );
});

test("shop totals cap fixed discounts and charge $5 shipping at $50 or less", () => {
  assert.deepEqual(
    calculateShopTotals([{ price: 40, quantity: 1 }], {
      type: "Fixed",
      value: 99,
    }),
    { subtotal: 40, discount: 40, shipping: 5, total: 5 },
  );
});
