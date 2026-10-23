import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildShopOrderEmails } from "../src/shopOrderEmail.js";

test("shop order emails preserve the PHP customer and admin table layouts", async () => {
  const php = await readFile(
    new URL("../../../checkout_confirm.php", import.meta.url),
    "utf8",
  );
  const { customerHtml, adminHtml } = buildShopOrderEmails({
    customer: {
      first_name: "Ava",
      last_name: "Hiker",
      email: "ava@example.com",
      phone: "801-555-0100",
      street_address: "10 Alpine Way",
      street_address1: "Unit 2",
      city: "Sandy",
      state: "UT",
      postal_code: "84070",
    },
    shipping: {
      first_name: "Ava",
      last_name: "Hiker",
      street_address: "20 Summit Rd",
      street_address1: "",
      city: "Sandy",
      state: "UT",
      postal_code: "84070",
    },
    items: [
      {
        name: "Trail Pack <Pro>",
        price: 50,
        quantity: 2,
        attributes: [{ type_name: "Color", value_name: "Blue & Gold" }],
      },
    ],
    totals: { subtotal: 100, discount: 10, shipping: 5, total: 95 },
    orderId: 543,
    transactionId: "TX-789",
  });

  for (const html of [customerHtml, adminHtml]) {
    assert.match(php, /<table width="100%" border="0" cellspacing="2" cellpadding="0">/);
    assert.match(html, /<table width="100%" border="0" cellspacing="2" cellpadding="0">/);
    for (const header of ["Product Name", "Quantity", "Price", "Total Price"]) {
      assert.ok(php.includes(`<strong>${header}</strong>`));
      assert.ok(html.includes(`<strong>${header}</strong>`));
    }
    for (const label of ["Sub Total:", "Discount:", "Shipping:", "Total:", "Transaction ID:"]) {
      assert.ok(html.includes(label));
    }
    assert.ok(html.includes("Blue &amp; Gold"));
    assert.ok(html.includes("Trail Pack &lt;Pro&gt;"));
    assert.ok(html.includes("TX-789"));
  }

  assert.match(customerHtml, /<table width="800" cellpadding="6" border="0" align="center">/);
  assert.match(customerHtml, /Just to confirm, we have received your order and we will mail it out shortly!/);
  assert.match(adminHtml, /Dear Admin/);
  assert.match(adminHtml, /<h1>User Details<\/h1>/);
  assert.match(adminHtml, /<h1>Shipping Details<\/h1>/);
  assert.match(adminHtml, /<h1>Order Details<\/h1>/);
  assert.match(adminHtml, /Manage Order/);
});
