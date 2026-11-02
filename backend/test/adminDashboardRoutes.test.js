import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("admin dashboard route preserves its query and API authorization", async () => {
  const [app, routes] = await Promise.all([
    readFile(new URL("../src/app.js", import.meta.url), "utf8"),
    readFile(
      new URL("../src/routes/admin/dashboard.js", import.meta.url),
      "utf8",
    ),
  ]);
  const authIndex = app.indexOf("createApiAccessMiddleware({");
  const mountIndex = app.indexOf("createAdminDashboardRouter({");

  assert.ok(authIndex >= 0);
  assert.ok(mountIndex > authIndex);
  assert.match(routes, /router\.get\("\/api\/dashboard"/);
  assert.match(routes, /COUNT\(\*\)::int AS banners/);
  assert.match(
    routes,
    /COUNT\(\*\) FILTER \(WHERE status = 'Active'\)::int AS "activeBanners"/,
  );
  assert.match(routes, /FROM \$\{config\.bannerTable\}/);
  assert.doesNotMatch(app, /app\.get\("\/api\/dashboard"/);
});
