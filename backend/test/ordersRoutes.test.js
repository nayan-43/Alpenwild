import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("admin order routes are registered after API authorization", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const routes = await readFile(
    new URL("../src/routes/admin/orders.js", import.meta.url),
    "utf8",
  );
  const middlewareIndex = app.indexOf("createApiAccessMiddleware({");
  const mountIndex = app.indexOf("app.use(createOrdersRouter(");

  assert.ok(middlewareIndex >= 0);
  assert.ok(mountIndex > middlewareIndex);
  assert.match(routes, /router\.get\("\/api\/orders"/);
  assert.match(routes, /router\.get\("\/api\/orders\/:id"/);
  assert.match(routes, /router\.delete\("\/api\/orders\/:id"/);
  assert.match(routes, /Unable to resolve the order detail ID column/);
  assert.match(
    routes,
    /Unable to resolve the order attribute detail ID column/,
  );
  assert.match(routes, /attributes: attributesByProduct\.get/);
});
