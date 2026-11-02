import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("admin category CRUD is mounted behind API authorization", async () => {
  const [app, routes, shared] = await Promise.all([
    readFile(new URL("../src/app.js", import.meta.url), "utf8"),
    readFile(
      new URL("../src/routes/admin/categories.js", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../src/categoryData.js", import.meta.url), "utf8"),
  ]);
  const authIndex = app.indexOf("createApiAccessMiddleware({");
  const mountIndex = app.indexOf("createAdminCategoriesRouter({");

  assert.ok(authIndex >= 0);
  assert.ok(mountIndex > authIndex);
  assert.match(routes, /router\.get\("\/api\/categories"/);
  assert.match(routes, /router\.post\("\/api\/categories", upload\.any\(\)/);
  assert.match(
    routes,
    /router\.patch\(\s*"\/api\/categories\/:id",\s*upload\.any\(\)/,
  );
  assert.match(routes, /router\.patch\("\/api\/categories\/:id\/status"/);
  assert.match(routes, /router\.delete\("\/api\/categories\/:id"/);
  assert.match(routes, /Listing image is required\./);
  assert.match(routes, /Product existing under this category/);
  assert.match(routes, /addCategoryBoxImages/);
  assert.match(shared, /function categorySelect\(\)/);
  assert.match(shared, /async function categoryBoxImagesFor/);
  assert.doesNotMatch(
    app,
    /app\.(?:get|post|patch|delete)\("\/api\/categories/,
  );
});
