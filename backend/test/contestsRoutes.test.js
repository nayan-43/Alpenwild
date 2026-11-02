import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("contest CRUD routes are registered after API authorization", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const routes = await readFile(
    new URL("../src/routes/contests.js", import.meta.url),
    "utf8",
  );
  const middlewareIndex = app.indexOf("createApiAccessMiddleware({");
  const mountIndex = app.indexOf("app.use(createContestsRouter(");

  assert.ok(middlewareIndex >= 0);
  assert.ok(mountIndex > middlewareIndex);
  assert.match(routes, /router\.get\("\/api\/contests"/);
  assert.match(routes, /router\.post\("\/api\/contests"/);
  assert.match(routes, /router\.patch\("\/api\/contests\/:id"/);
  assert.match(routes, /router\.patch\("\/api\/contests\/:id\/status"/);
  assert.match(routes, /router\.delete\("\/api\/contests\/:id"/);
  assert.match(routes, /contest_status, created_at, updated_at/);
});

test("public contest listing retains approved submissions and rules output", async () => {
  const routes = await readFile(
    new URL("../src/routes/publicContests.js", import.meta.url),
    "utf8",
  );
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");

  assert.match(routes, /router\.get\("\/api\/public\/contests"/);
  assert.match(routes, /WHERE contest_status='Active'/);
  assert.match(routes, /s\.submission_status='Approved'/);
  assert.match(routes, /static_page_id=3904/);
  assert.match(
    routes,
    /image_url:\s*`\/uploads\/\$\{config\.contestUploadSubdir\}/,
  );
  assert.match(app, /createPublicContestsRouter\(\{ query, config \}\)/);
});

test("public contest submissions retain image validation and transactional persistence", async () => {
  const routes = await readFile(
    new URL("../src/routes/publicContestSubmissions.js", import.meta.url),
    "utf8",
  );
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");

  assert.match(
    routes,
    /router\.post\([\s\S]*?"\/api\/public\/contest-submissions"/,
  );
  assert.match(
    routes,
    /limits:\s*\{\s*fileSize:\s*15 \* 1024 \* 1024,\s*files:\s*10\s*\}/,
  );
  assert.match(routes, /contestSubmissionUpload\.array\("images", 10\)/);
  assert.match(routes, /sharp\(file\.buffer\)\.metadata\(\)/);
  assert.match(
    routes,
    /CURRENT_DATE BETWEEN contest_start_date AND contest_end_date/,
  );
  assert.match(routes, /await client\.query\("BEGIN"\)/);
  assert.match(routes, /await client\.query\("COMMIT"\)/);
  assert.match(routes, /Unable to remove an uncommitted contest image/);
  assert.match(routes, /contest_submissions_user/);
  assert.match(routes, /contest_submissions_admin/);
  assert.match(app, /createPublicContestSubmissionsRouter\(\{/);
});
