import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("trip-posts lookup remains public and preserves its ordered response", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const apiAccess = await readFile(
    new URL("../src/apiAccess.js", import.meta.url),
    "utf8",
  );
  const routes = await readFile(
    new URL("../src/routes/tripPosts.js", import.meta.url),
    "utf8",
  );
  const middlewareIndex = app.indexOf("createApiAccessMiddleware({");
  const mountIndex = app.indexOf("app.use(createTripPostsRouter(");

  assert.ok(middlewareIndex >= 0);
  assert.ok(mountIndex > middlewareIndex);
  assert.match(
    apiAccess,
    /const publicApiPrefixes = \[[\s\S]*?"\/trip-posts\/"/,
  );
  assert.match(routes, /router\.get\("\/api\/trip-posts\/:tripId"/);
  assert.match(
    routes,
    /SELECT post_url AS url, post_name AS name, post_image AS image[\s\S]*?WHERE trips_id=\$1 ORDER BY post_name/,
  );
});
