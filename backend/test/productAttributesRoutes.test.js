import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("product attribute CRUD routes preserve aliases, legacy storage, and API authorization", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const routes = await readFile(
    new URL("../src/routes/admin/productAttributes.js", import.meta.url),
    "utf8",
  );
  const middlewareIndex = app.indexOf("createApiAccessMiddleware({");
  const mountIndex = app.indexOf("app.use(\n  createProductAttributesRouter(");

  assert.ok(middlewareIndex >= 0);
  assert.ok(mountIndex > middlewareIndex);
  assert.match(
    app,
    /createProductAttributesRouter\(\{[\s\S]*?useLegacyProductAttributes,[\s\S]*?useLegacyProducts,[\s\S]*?useLegacyAttributeTypes,[\s\S]*?useLegacyAttributeValues,/,
  );
  assert.doesNotMatch(
    app,
    /app\.(?:get|post|patch|delete)\([\s\S]{0,100}product-attributes/,
  );
  for (const path of [
    "/api/product-attributes",
    "/api/product-attribute-values",
  ]) {
    assert.ok(routes.includes(`"${path}"`));
  }
  assert.match(routes, /router\.get\(\s*\[[\s\S]*?product-attribute-values/);
  assert.match(routes, /router\.post\(\s*\[[\s\S]*?product-attribute-values/);
  assert.match(routes, /router\.patch\(\s*\[[\s\S]*?product-attribute-values/);
  assert.match(routes, /router\.delete\(\s*\[[\s\S]*?product-attribute-values/);
  assert.match(routes, /alpenwild_product_attribute_value_tbl/);
  assert.match(routes, /FROM product_attributes/);
  assert.match(
    routes,
    /Sorry, attribute details is already added under this product/,
  );
  assert.match(routes, /Product attribute not found\./);
  assert.match(
    routes,
    /SELECT product_attribute_value_id AS id,[\s\S]*?'Active' AS status/,
  );
});
