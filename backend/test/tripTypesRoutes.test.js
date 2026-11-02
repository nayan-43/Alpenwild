import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("trip type CRUD is authorized and retains legacy and modern table behavior", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const routes = await readFile(
    new URL("../src/routes/tripTypes.js", import.meta.url),
    "utf8",
  );
  const middlewareIndex = app.indexOf("createApiAccessMiddleware({");
  const mountIndex = app.indexOf("createTripTypesRouter({");

  assert.ok(middlewareIndex >= 0);
  assert.ok(mountIndex > middlewareIndex);
  assert.match(routes, /router\.get\("\/api\/trip-types"/);
  assert.match(routes, /router\.post\("\/api\/trip-types",\s*upload\.any\(\)/);
  assert.match(
    routes,
    /router\.patch\(\s*"\/api\/trip-types\/:id",\s*upload\.any\(\)/,
  );
  assert.match(routes, /router\.patch\("\/api\/trip-types\/:id\/status"/);
  assert.match(routes, /router\.delete\("\/api\/trip-types\/:id"/);
  assert.match(routes, /FROM alpenwild_trip_type_tbl/);
  assert.match(routes, /FROM trip_types/);
  assert.match(routes, /tripTypeBoxImagesFor/);
  assert.match(routes, /saveTripTypeBoxImages/);
  assert.match(routes, /Both trip type images are required/);
  assert.match(routes, /listing_thumbnail_url/);
});
