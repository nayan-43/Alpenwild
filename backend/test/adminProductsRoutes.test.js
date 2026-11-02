import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("admin product routes remain behind API authorization", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const routes = await readFile(
    new URL("../src/routes/admin/products.js", import.meta.url),
    "utf8",
  );
  const middlewareIndex = app.indexOf("createApiAccessMiddleware({");
  const mountIndex = app.indexOf("createAdminProductsRouter({");

  assert.ok(middlewareIndex >= 0);
  assert.ok(mountIndex > middlewareIndex);
  assert.match(routes, /router\.get\("\/api\/products"/);
  assert.match(routes, /router\.post\("\/api\/products",\s*upload\.any\(\)/);
  assert.match(
    routes,
    /router\.patch\("\/api\/products\/:id",\s*upload\.any\(\)/,
  );
  assert.match(routes, /router\.patch\("\/api\/products\/:id\/status"/);
  assert.match(routes, /router\.delete\("\/api\/products\/:id"/);
  assert.match(
    routes,
    /router\.delete\(\s*"\/api\/products\/:productId\/additional-images\/:imageId"/,
  );
  assert.match(routes, /useLegacyProducts/);
  assert.match(routes, /product_box_image_tbl/);
  assert.match(routes, /product_additional_image_tbl/);
  assert.match(routes, /productListingUploadDir/);
});
