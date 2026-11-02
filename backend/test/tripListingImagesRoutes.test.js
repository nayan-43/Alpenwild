import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("trip listing thumbnail routes preserve public access and output variants", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const apiAccess = await readFile(
    new URL("../src/apiAccess.js", import.meta.url),
    "utf8",
  );
  const routes = await readFile(
    new URL("../src/routes/tripListingImages.js", import.meta.url),
    "utf8",
  );
  const middlewareIndex = app.indexOf("createApiAccessMiddleware({");
  const mountIndex = app.indexOf(
    "app.use(createTripListingImagesRouter({ config }));",
  );

  assert.ok(middlewareIndex >= 0);
  assert.ok(mountIndex > middlewareIndex);
  assert.match(
    apiAccess,
    /const publicApiPrefixes = \[[\s\S]*?"\/trip-images\/listing\/"[\s\S]*?"\/trip-type-images\/listing\/"/,
  );
  assert.match(
    routes,
    /router\.get\(\s*"\/api\/trip-type-images\/listing\/:filename"/,
  );
  assert.match(routes, /router\.get\("\/api\/trip-images\/listing\/:filename"/);
  assert.match(routes, /resize\(370, 183/);
  assert.match(routes, /resize\(270, 183/);
  assert.match(routes, /trip-type-listing/);
  assert.match(routes, /trip-listing/);
  assert.match(routes, /If-None-Match/);
  assert.match(routes, /Invalid trip style image/);
  assert.match(routes, /Invalid trip listing image/);
});
