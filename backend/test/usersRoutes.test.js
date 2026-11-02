import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("admin user routes use the shared schema and legacy-aware persistence helpers", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const routes = await readFile(
    new URL("../src/routes/admin/users.js", import.meta.url),
    "utf8",
  );
  const middlewareIndex = app.indexOf("createApiAccessMiddleware({");
  const mountIndex = app.indexOf("app.use(\n  createUsersRouter(");

  assert.ok(middlewareIndex >= 0);
  assert.ok(mountIndex > middlewareIndex);
  assert.match(routes, /router\.get\("\/api\/users"/);
  assert.match(routes, /router\.post\("\/api\/users"/);
  assert.match(routes, /router\.patch\("\/api\/users\/:id"/);
  assert.match(routes, /router\.patch\("\/api\/users\/:id\/status"/);
  assert.match(routes, /router\.delete\("\/api\/users\/:id"/);
  assert.match(routes, /await userUpdateBookings\(data, req\.params\.id\)/);
  assert.match(routes, /if \(await userHasOrders\(req\.params\.id\)\)/);
  assert.match(
    app,
    /createUsersRouter\(\{[\s\S]*?userSchema,[\s\S]*?userInsert/,
  );
});
