import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("promotion CRUD is mounted behind API authorization and preserves legacy ordering", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const routes = await readFile(
    new URL("../src/routes/promotions.js", import.meta.url),
    "utf8",
  );
  const middlewareIndex = app.indexOf("createApiAccessMiddleware({");
  const mountIndex = app.indexOf("app.use(\n  createPromotionsRouter(");

  assert.ok(middlewareIndex >= 0);
  assert.ok(mountIndex > middlewareIndex);
  assert.match(routes, /router\.get\("\/api\/promotions"/);
  assert.match(
    routes,
    /router\.post\(\s*"\/api\/promotions",\s*upload\.single\("image"\)/,
  );
  assert.match(
    routes,
    /router\.patch\(\s*"\/api\/promotions\/:id",\s*upload\.single\("image"\)/,
  );
  assert.match(routes, /router\.patch\("\/api\/promotions\/:id\/status"/);
  assert.match(routes, /router\.delete\("\/api\/promotions\/:id"/);
  assert.match(routes, /offers_promotions_order/);
  assert.match(routes, /FROM promotions/);
  assert.match(routes, /Promotion image is required/);
  assert.match(routes, /promotionsUploadSubdir/);
});
