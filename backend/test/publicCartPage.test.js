import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("public cart page follows PHP structure and legacy classes", async () => {
  const reactPage = await readFile(
    new URL("../../frontend/src/pages/PublicCartPage.jsx", import.meta.url),
    "utf8",
  );
  const phpPage = await readFile(
    new URL("../../../shopping_cart.php", import.meta.url),
    "utf8",
  );

  for (const className of [
    "section",
    "container",
    "title clearfix",
    "cart-table-cover clearfix",
    "table checkout-table",
    "imgWrap",
    "img-wrap",
    "p-d",
    "p-name",
    "cartQuan",
    "nowrap",
    "table coupon-table",
    "total-table",
    "button-type",
    "text-right",
    "place-order text-right",
  ]) {
    assert.ok(reactPage.includes(className), `React page uses ${className}`);
    assert.ok(phpPage.includes(className), `PHP page uses ${className}`);
  }
  assert.match(reactPage, /name="cart_delete\[\]"/);
  assert.match(reactPage, /name=\{`cart_quantity\[/);
  assert.match(reactPage, /name="discount_code"/);
  assert.match(reactPage, /name="user_email_address"/);
  assert.match(reactPage, /method="get"[\s\S]*action="\/checkout"/);
  assert.match(reactPage, /<button type="submit" className="button-type">/);
  assert.match(reactPage, /className="button-type"[\s\S]*?>\s*Order/);
});
