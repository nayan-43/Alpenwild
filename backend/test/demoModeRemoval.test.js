import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the API requires PostgreSQL and has no in-memory demo data", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const config = await readFile(
    new URL("../src/config.js", import.meta.url),
    "utf8",
  );
  assert.match(
    app,
    /if \(!pool\) \{\s*throw new Error\(\s*"DATABASE_URL is not configured/,
  );
  assert.doesNotMatch(app, /useDemoData|demoBanners|demoTestimonials|demoMode/);
  assert.doesNotMatch(config, /demoMode|DEMO_MODE/);
});
