import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("settings and email-template routes are mounted behind API authorization", async () => {
  const [app, routes] = await Promise.all([
    readFile(new URL("../src/app.js", import.meta.url), "utf8"),
    readFile(
      new URL("../src/routes/admin/settings.js", import.meta.url),
      "utf8",
    ),
  ]);
  const authIndex = app.indexOf("createApiAccessMiddleware({");
  const mountIndex = app.indexOf("createAdminSettingsRouter({");

  assert.ok(authIndex >= 0);
  assert.ok(mountIndex > authIndex);
  assert.match(routes, /router\.get\("\/api\/settings"/);
  assert.match(routes, /router\.put\(\s*"\/api\/settings"/);
  assert.match(routes, /router\.get\("\/api\/email-templates"/);
  assert.match(routes, /router\.put\("\/api\/email-templates\/:id"/);
  assert.match(routes, /settingsUpload\.fields/);
  assert.match(routes, /settingsValidationSchema\.parse\(settings\)/);
  assert.match(routes, /email_template_id <> 1/);
  assert.doesNotMatch(
    app,
    /app\.(?:get|put)\("\/api\/(?:settings|email-templates)/,
  );
});
