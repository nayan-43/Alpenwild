import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("make-payment admin routes preserve their API and authorization", async () => {
  const [app, routes] = await Promise.all([
    readFile(new URL("../src/app.js", import.meta.url), "utf8"),
    readFile(
      new URL("../src/routes/admin/makePayments.js", import.meta.url),
      "utf8",
    ),
  ]);
  const authIndex = app.indexOf("createApiAccessMiddleware({");
  const mountIndex = app.indexOf("createAdminMakePaymentsRouter({");

  assert.ok(authIndex >= 0);
  assert.ok(mountIndex > authIndex);
  assert.match(routes, /router\.get\("\/api\/make-payments"/);
  assert.match(routes, /router\.delete\("\/api\/make-payments\/:paymentId"/);
  assert.match(routes, /FROM alpenwild_makepayment_tbl ORDER BY pid DESC/);
  assert.match(routes, /DELETE FROM alpenwild_makepayment_tbl WHERE pid=\$1/);
  assert.match(routes, /Payment details deleted successfully\./);
  assert.doesNotMatch(app, /app\.(?:get|delete)\("\/api\/make-payments/);
});
