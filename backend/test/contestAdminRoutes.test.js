import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("contest administration endpoints are registered after API authorization", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const routes = await readFile(
    new URL("../src/routes/admin/contestSubmissions.js", import.meta.url),
    "utf8",
  );
  const middlewareIndex = app.indexOf("createApiAccessMiddleware({");
  const mountIndex = app.indexOf("app.use(createContestAdminRouter(");

  assert.ok(middlewareIndex >= 0);
  assert.ok(mountIndex > middlewareIndex);
  assert.match(routes, /router\.get\("\/api\/contest-users"/);
  assert.match(routes, /router\.get\("\/api\/contest-submissions"/);
  assert.match(
    routes,
    /router\.patch\(\s*"\/api\/contest-submissions\/:id\/status"/,
  );
  assert.match(
    routes,
    /router\.patch\(\s*"\/api\/contest-submissions\/:id\/winner"/,
  );
  assert.match(routes, /router\.get\("\/api\/contest-settings"/);
  assert.match(routes, /router\.put\("\/api\/contest-settings"/);
  assert.match(
    routes,
    /router\.get\(\s*"\/api\/contest-submissions\/download",\s*requireAuth/,
  );
  assert.match(
    routes,
    /router\.get\(\s*"\/api\/contest-submissions\/:id\/download",\s*requireAuth/,
  );
});
