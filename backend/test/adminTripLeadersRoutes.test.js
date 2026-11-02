import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("admin trip-leader routes stay behind API auth and retain their CRUD surface", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const routes = await readFile(
    new URL("../src/routes/admin/tripLeaders.js", import.meta.url),
    "utf8",
  );
  const middlewareIndex = app.indexOf("createApiAccessMiddleware({");
  const mountIndex = app.indexOf("createAdminTripLeadersRouter({");

  assert.ok(middlewareIndex >= 0);
  assert.ok(mountIndex > middlewareIndex);
  assert.match(routes, /router\.get\("\/api\/trip-leaders"/);
  assert.match(routes, /router\.patch\("\/api\/trip-leaders\/:id\/order"/);
  assert.match(
    routes,
    /router\.post\(\s*"\/api\/trip-leaders",\s*upload\.any\(\)/,
  );
  assert.match(
    routes,
    /router\.patch\(\s*"\/api\/trip-leaders\/:id",\s*upload\.any\(\)/,
  );
  assert.match(routes, /router\.patch\("\/api\/trip-leaders\/:id\/status"/);
  assert.match(routes, /router\.delete\("\/api\/trip-leaders\/:id"/);
  assert.match(
    routes,
    /router\.get\("\/api\/trip-leader-authors",\s*requireAuth/,
  );
  assert.match(routes, /trip_leader_created_at\)[\s\S]*?CURRENT_DATE/);
  assert.match(routes, /tripLeaderDescriptions|createTripLeaderSerializer/);
});
