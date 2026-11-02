import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("trip FAQ routes preserve public reads and authorized admin writes", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const apiAccess = await readFile(
    new URL("../src/apiAccess.js", import.meta.url),
    "utf8",
  );
  const routes = await readFile(
    new URL("../src/routes/tripFaqs.js", import.meta.url),
    "utf8",
  );
  const middlewareIndex = app.indexOf("createApiAccessMiddleware({");
  const mountIndex = app.indexOf("app.use(createTripFaqsRouter(");

  assert.ok(middlewareIndex >= 0);
  assert.ok(mountIndex > middlewareIndex);
  assert.match(
    apiAccess,
    /const publicApiPrefixes = \[[\s\S]*?"\/trip-faqs\/"/,
  );
  assert.match(routes, /router\.get\("\/api\/trip-faqs\/:tripId"/);
  assert.match(routes, /router\.post\("\/api\/trip-faqs\/:tripId"/);
  assert.match(routes, /router\.put\("\/api\/trip-faqs\/:tripId\/:id"/);
  assert.match(routes, /router\.delete\("\/api\/trip-faqs\/:tripId\/:id"/);
  assert.match(routes, /ORDER BY faq_order ASC, id DESC/);
  assert.match(routes, /WHERE id=\$3 AND static_page_id=\$4/);
  assert.match(routes, /FAQ not found/);
});
