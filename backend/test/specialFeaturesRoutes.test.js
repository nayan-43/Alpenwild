import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("special feature CRUD routes use upload middleware behind API authorization", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const routes = await readFile(
    new URL("../src/routes/specialFeatures.js", import.meta.url),
    "utf8",
  );
  const middlewareIndex = app.indexOf("createApiAccessMiddleware({");
  const mountIndex = app.indexOf("app.use(\n  createSpecialFeaturesRouter(");

  assert.ok(middlewareIndex >= 0);
  assert.ok(mountIndex > middlewareIndex);
  assert.match(routes, /router\.get\("\/api\/special-features"/);
  assert.match(
    routes,
    /router\.post\(\s*"\/api\/special-features",\s*upload\.single\("image"\)/,
  );
  assert.match(
    routes,
    /router\.patch\(\s*"\/api\/special-features\/:id",\s*upload\.single\("image"\)/,
  );
  assert.match(routes, /router\.patch\("\/api\/special-features\/:id\/status"/);
  assert.match(routes, /router\.delete\("\/api\/special-features\/:id"/);
  assert.match(routes, /alpenwild_special_feature_tbl/);
  assert.match(routes, /FROM special_features/);
  assert.match(routes, /specialFeatureUploadSubdir/);
  assert.match(routes, /display_order >= \$1 AND display_order < \$2/);
});
