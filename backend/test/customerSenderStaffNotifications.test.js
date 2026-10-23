import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("contest staff notifications use the SMTP sender and contestant reply address", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");

  assert.match(
    app,
    /to: data\.email,[\s\S]*?subject: `\$\{siteTitle\} Contest Submission`/,
  );
  assert.match(
    app,
    /if \(emailTemplate\.rows\[0\]\?\.contest_submissions_admin\)\s*await mailer\.sendMail\(\{\s*from,\s*replyTo: data\.email,\s*to: config\.smtpUser,[\s\S]*?contest_submissions_admin/,
  );
  assert.match(app, /from,\s*to: data\.email,[\s\S]*?contest_submissions_user/);
});

test("shop-order staff notifications use the SMTP sender and customer reply address", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");

  assert.match(app, /from,\s*to: data\.customer\.email/);
  assert.match(
    app,
    /from,\s*replyTo: data\.customer\.email,\s*to: "webgrity43@gmail\.com",[\s\S]*?adminHtml/,
  );
});
