import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("health and frontend fallback routes retain their app registration order", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const routes = await readFile(
    new URL("../src/routes/system.js", import.meta.url),
    "utf8",
  );
  const accessIndex = app.indexOf("createApiAccessMiddleware({");
  const healthIndex = app.indexOf("app.use(createHealthRouter())");
  const errorHandlerIndex = app.indexOf("app.use((error, req, res");
  const fallbackIndex = app.indexOf("app.use(createFrontendFallbackRouter())");

  assert.ok(accessIndex >= 0);
  assert.ok(healthIndex > accessIndex);
  assert.ok(errorHandlerIndex >= 0);
  assert.ok(fallbackIndex > errorHandlerIndex);
  assert.match(routes, /router\.get\("\/api\/health"/);
  assert.match(routes, /res\.json\(\{ ok: true \}\)/);
  assert.match(routes, /router\.get\("\/\{\*splat\}"/);
  assert.match(
    routes,
    /path\.resolve\(process\.cwd\(\), "dist", "index\.html"\)/,
  );
  assert.match(routes, /fs\.access\(client\)[\s\S]*?res\.sendFile\(client\)/);
  assert.match(routes, /\.catch\(\(\) => next\(\)\)/);
});
