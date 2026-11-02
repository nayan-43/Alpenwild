import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("location and activity APIs are registered in the lookup-data router", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const routes = await readFile(
    new URL("../src/routes/lookupData.js", import.meta.url),
    "utf8",
  );
  const middlewareIndex = app.indexOf("createApiAccessMiddleware({");
  const mountIndex = app.indexOf("createLookupDataRouter(");

  assert.ok(middlewareIndex >= 0);
  assert.ok(mountIndex > middlewareIndex);
  assert.match(routes, /router\.get\("\/api\/locations"/);
  assert.match(routes, /router\.get\("\/api\/public-trip-filters"/);
  assert.match(routes, /router\.get\("\/api\/activities"/);
  assert.match(routes, /router\.post\("\/api\/locations"/);
  assert.match(routes, /router\.patch\("\/api\/locations\/:id\/status"/);
  assert.match(routes, /router\.delete\("\/api\/locations\/:id"/);
  assert.match(routes, /router\.post\("\/api\/activities"/);
  assert.match(routes, /router\.patch\("\/api\/activities\/:id\/status"/);
  assert.match(routes, /router\.delete\("\/api\/activities\/:id"/);
  assert.match(routes, /location_status = 'Active'/);
  assert.match(routes, /activity_status = 'Active'/);
  assert.match(routes, /Trip existing under this location/);
});
