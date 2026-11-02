import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("admin trip routes preserve CRUD, upload middleware, and API authorization", async () => {
  const [app, routes] = await Promise.all([
    readFile(new URL("../src/app.js", import.meta.url), "utf8"),
    readFile(new URL("../src/routes/admin/trips.js", import.meta.url), "utf8"),
  ]);
  const authIndex = app.indexOf("createApiAccessMiddleware({");
  const mountIndex = app.indexOf("createAdminTripsRouter({");

  assert.ok(authIndex >= 0);
  assert.ok(mountIndex > authIndex);
  assert.match(routes, /router\.get\("\/api\/trips"/);
  assert.match(routes, /router\.post\("\/api\/trips",\s*upload\.any\(\)/);
  assert.match(routes, /router\.patch\("\/api\/trips\/:id",\s*upload\.any\(\)/);
  assert.match(routes, /router\.patch\("\/api\/trips\/:id\/status"/);
  assert.match(routes, /router\.delete\("\/api\/trips\/:id\/dates\/:dateId"/);
  assert.match(
    routes,
    /router\.patch\(\s*"\/api\/trips\/:id\/dates\/:dateId\/status"/,
  );
  assert.match(routes, /router\.delete\("\/api\/trips\/:id"/);
  assert.match(routes, /Banner, map, and listing images are required/);
  assert.match(routes, /saveTripRelations/);
  assert.match(routes, /tripRelations\(query, config/);
  assert.match(routes, /activity_ids: z\.string\(\)\.default\("\[\]"\)/);
  for (const dir of [
    "tripBannerUploadDir",
    "tripMapUploadDir",
    "tripListingUploadDir",
    "tripBoxImageUploadDir",
  ]) {
    assert.ok(
      routes.includes(dir),
      `${dir} is passed into existing upload paths`,
    );
  }
  assert.doesNotMatch(app, /app\.(?:get|post|patch|delete)\("\/api\/trips/);
});
