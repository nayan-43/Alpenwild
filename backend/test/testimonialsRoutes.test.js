import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("testimonial CRUD is mounted behind API authorization and preserves ordering", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const routes = await readFile(
    new URL("../src/routes/testimonials.js", import.meta.url),
    "utf8",
  );
  const middlewareIndex = app.indexOf("createApiAccessMiddleware({");
  const mountIndex = app.indexOf("app.use(createTestimonialsRouter(");

  assert.ok(middlewareIndex >= 0);
  assert.ok(mountIndex > middlewareIndex);
  assert.match(routes, /router\.get\("\/api\/testimonials"/);
  assert.match(routes, /router\.post\("\/api\/testimonials"/);
  assert.match(routes, /router\.patch\("\/api\/testimonials\/:id"/);
  assert.match(routes, /router\.patch\("\/api\/testimonials\/:id\/status"/);
  assert.match(routes, /router\.delete\("\/api\/testimonials\/:id"/);
  assert.match(routes, /testimonial_order AS display_order/);
  assert.match(routes, /UPDATE \$\{table\} SET \$\{orderColumn\}/);
  assert.match(routes, /FROM testimonials/);
});
