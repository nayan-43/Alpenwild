import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("trip gallery routes preserve public listing and protected CRUD behavior", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const apiAccess = await readFile(
    new URL("../src/apiAccess.js", import.meta.url),
    "utf8",
  );
  const routes = await readFile(
    new URL("../src/routes/tripGalleries.js", import.meta.url),
    "utf8",
  );
  const middlewareIndex = app.indexOf("createApiAccessMiddleware({");
  const mountIndex = app.indexOf("app.use(\n  createTripGalleriesRouter(");

  assert.ok(middlewareIndex >= 0);
  assert.ok(mountIndex > middlewareIndex);
  assert.match(
    apiAccess,
    /const publicApiPaths = new Set\(\[[\s\S]*?"\/trip-galleries"/,
  );
  assert.match(routes, /router\.get\("\/api\/trip-galleries"/);
  assert.match(
    routes,
    /router\.post\(\s*"\/api\/trip-galleries",\s*upload\.single\("image"\)/,
  );
  assert.match(
    routes,
    /router\.patch\(\s*"\/api\/trip-galleries\/:id",\s*upload\.single\("image"\)/,
  );
  assert.match(routes, /router\.patch\("\/api\/trip-galleries\/:id\/status"/);
  assert.match(routes, /router\.delete\("\/api\/trip-galleries\/:id"/);
  assert.match(routes, /An image or YouTube URL is required/);
  assert.match(routes, /alpenwild_trips_gallery_tbl/);
  assert.match(routes, /tripGalleryUploadDir/);
});
