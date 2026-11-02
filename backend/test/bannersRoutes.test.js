import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("banner CRUD routes use the upload middleware and run behind API authorization", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const routes = await readFile(
    new URL("../src/routes/banners.js", import.meta.url),
    "utf8",
  );
  const middlewareIndex = app.indexOf("createApiAccessMiddleware({");
  const mountIndex = app.indexOf("app.use(createBannersRouter(");

  assert.ok(middlewareIndex >= 0);
  assert.ok(mountIndex > middlewareIndex);
  assert.match(routes, /router\.get\("\/api\/banners"/);
  assert.match(
    routes,
    /router\.post\(\s*"\/api\/banners",\s*upload\.single\("image"\)/,
  );
  assert.match(
    routes,
    /router\.patch\(\s*"\/api\/banners\/:id",\s*upload\.single\("image"\)/,
  );
  assert.match(routes, /router\.patch\("\/api\/banners\/:id\/status"/);
  assert.match(routes, /router\.delete\("\/api\/banners\/:id"/);
  assert.match(routes, /Banner image is required/);
  assert.match(routes, /alpenwild_banner_tbl/);
  assert.match(routes, /FROM banners/);
  assert.match(routes, /bannerUploadSubdir/);
});
