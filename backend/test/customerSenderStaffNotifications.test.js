import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("contest staff notifications use the SMTP sender and contestant reply address", async () => {
  const contestRoutes = await readFile(
    new URL("../src/routes/publicContestSubmissions.js", import.meta.url),
    "utf8",
  );

  assert.match(
    contestRoutes,
    /to: data\.email,[\s\S]*?subject: `\$\{siteTitle\} Contest Submission`/,
  );
  assert.match(
    contestRoutes,
    /if \(emailTemplate\.rows\[0\]\?\.contest_submissions_admin\)\s*await mailer\.sendMail\(\{\s*from,\s*replyTo: data\.email,\s*to: await getAdminReceivingEmail\(\),[\s\S]*?contest_submissions_admin/,
  );
  assert.match(
    contestRoutes,
    /from,\s*to: data\.email,[\s\S]*?contest_submissions_user/,
  );
});

test("shop-order staff notifications use the SMTP sender and customer reply address", async () => {
  const checkoutRoutes = await readFile(
    new URL("../src/routes/shopCheckout.js", import.meta.url),
    "utf8",
  );

  assert.match(checkoutRoutes, /from,\s*to: data\.customer\.email/);
  assert.match(
    checkoutRoutes,
    /from,\s*replyTo: data\.customer\.email,\s*to: await getAdminOrderReceivingEmail\(\),[\s\S]*?adminHtml/,
  );
});
