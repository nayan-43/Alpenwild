import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("redirection CRUD uses the selected schema and is mounted behind API authorization", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const routes = await readFile(
    new URL("../src/routes/admin/redirections.js", import.meta.url),
    "utf8",
  );
  const staticPages = await readFile(
    new URL("../src/routes/staticPages.js", import.meta.url),
    "utf8",
  );
  const middlewareIndex = app.indexOf("createApiAccessMiddleware({");
  const mountIndex = app.indexOf("app.use(createRedirectionsRouter(");

  assert.ok(middlewareIndex >= 0);
  assert.ok(mountIndex > middlewareIndex);
  assert.match(routes, /router\.get\("\/api\/redirections"/);
  assert.match(routes, /router\.post\("\/api\/redirections"/);
  assert.match(routes, /router\.patch\("\/api\/redirections\/:id"/);
  assert.match(routes, /router\.delete\("\/api\/redirections\/:id"/);
  assert.match(routes, /alpenwild_redirection_tbl/);
  assert.match(routes, /FROM redirections/);
  assert.match(staticPages, /redirectionSelect,/);
  assert.match(
    app,
    /redirectionSelect: \(\) => redirectionSelect\(useLegacyRedirections\)/,
  );
});
