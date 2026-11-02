import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("admin trip-booking export preserves legacy CSV schema and authorization", async () => {
  const [app, routes] = await Promise.all([
    readFile(new URL("../src/app.js", import.meta.url), "utf8"),
    readFile(
      new URL("../src/routes/admin/tripBookingExport.js", import.meta.url),
      "utf8",
    ),
  ]);
  const authIndex = app.indexOf("createApiAccessMiddleware({");
  const mountIndex = app.indexOf(
    "createAdminTripBookingExportRouter({ query })",
  );

  assert.ok(authIndex >= 0);
  assert.ok(mountIndex > authIndex);
  assert.match(routes, /router\.get\("\/api\/trip-bookings\/download"/);
  assert.match(routes, /FROM alpenwild_trips_additional_booking_user_tbl/);
  assert.match(routes, /AS all_payments/);
  assert.match(routes, /AS paid_payments/);
  assert.match(routes, /"Rooming Preferrence"/);
  assert.match(routes, /"Single Suppliment"/);
  assert.match(routes, /for \(let i = 1; i <= 9; i\+\+\)/);
  assert.match(routes, /Guest\$\{i\} First Name/);
  assert.match(routes, /Deposit Amount \$\{i\}/);
  assert.match(routes, /\.replaceAll\(",", "-"\)/);
  assert.match(routes, /ORDER BY b\.trips_booking_date DESC NULLS LAST/);
  assert.match(routes, /attachment; filename="booking_list_/);
  assert.doesNotMatch(app, /app\.get\("\/api\/trip-bookings\/download"/);
});
