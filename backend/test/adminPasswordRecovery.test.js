import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("admin recovery follows PHP and updates only the legacy password field", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const login = await readFile(
    new URL("../../frontend/src/pages/admin/LoginPage.jsx", import.meta.url),
    "utf8",
  );
  const route = app.match(
    /app\.post\(\s*"\/api\/auth\/forgot-password"[\s\S]*?\n\);/,
  )?.[0];

  assert.ok(route, "forgot-password route exists");
  assert.match(app, /function generateLegacyAdminPassword\(\)/);
  assert.match(route, /SET administrator_password=\$1/);
  assert.doesNotMatch(
    route,
    /administrator_password_hash|administrator_reset_token/,
  );
  assert.match(app, /async function getSiteTitle\(\)/);
  assert.match(app, /String\(result\.rows\[0\][\s\S]*?\|\| "Alpenwild"/);
  assert.match(route, /const siteTitle = await getSiteTitle\(\)/);
  assert.match(route, /name: siteTitle/);
  assert.match(route, /address: config\.smtpFrom \|\| config\.smtpUser/);
  assert.match(route, /subject: `New Password \$\{siteTitle\}`/);
  assert.match(route, /to: "webgrity43@gmail\.com"/);
  assert.match(route, /Your New Password is:/);
  assert.match(
    route,
    /if \(!admin\)[\s\S]*?status\(404\)[\s\S]*?No administrator account was found with that username\./,
  );
  assert.match(route, /A new password will be sent to your e-mail address\./);
  assert.match(route, /await client\.query\("COMMIT"\)/);
  assert.match(route, /await client\.query\("ROLLBACK"\)/);
  assert.doesNotMatch(route, /resetUrl|Reset Link/);
  assert.match(login, /validationEngine\("attach"/);
  assert.match(login, /validationEngine\("validate"\)/);
  assert.match(login, /noValidate ref={formRef}/);
  assert.match(login, /function switchRecoveryForm\(showForgot\)/);
  assert.match(login, /setError\(""\);[\s\S]*?setForgotMessage\(""\);/);
  assert.match(login, /switchRecoveryForm\(true\)/);
  assert.match(login, /switchRecoveryForm\(false\)/);
  assert.match(login, /setForgot\(false\)/);
  assert.match(
    login,
    /setForgotMessage\(result\.message\);[\s\S]*?setForgotUser\(""\);/,
  );
});

test("login validates the PHP administrator password column", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const loginRoute = app.match(
    /app\.post\("\/api\/auth\/login"[\s\S]*?\n\}\);/,
  )?.[0];

  assert.ok(loginRoute, "login route exists");
  assert.match(loginRoute, /administrator_password AS legacy_password_md5/);
  assert.match(
    loginRoute,
    /WHERE LOWER\(administrator_username\)=LOWER\(\$1\)/,
  );
  assert.match(loginRoute, /\[data\.username\]/);
  assert.match(loginRoute, /verifyLegacyAdminPassword\(/);
  assert.doesNotMatch(loginRoute, /password_hash|bcrypt/);
});
