import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("admin trip-booking list routes preserve options, filtering, and payment details", async () => {
  const [app, routes] = await Promise.all([
    readFile(new URL("../src/app.js", import.meta.url), "utf8"),
    readFile(
      new URL("../src/routes/admin/tripBookingLists.js", import.meta.url),
      "utf8",
    ),
  ]);
  const authIndex = app.indexOf("createApiAccessMiddleware({");
  const mountIndex = app.indexOf(
    "createAdminTripBookingListsRouter({ query })",
  );

  assert.ok(authIndex >= 0);
  assert.ok(mountIndex > authIndex);
  assert.match(routes, /router\.get\("\/api\/trip-bookings\/options"/);
  assert.match(routes, /router\.get\("\/api\/trip-bookings"/);
  assert.match(routes, /router\.get\("\/api\/trip-bookings\/payments"/);
  assert.match(routes, /discount_start_date <= CURRENT_DATE/);
  assert.match(routes, /discount_end_date >= CURRENT_DATE/);
  assert.match(routes, /const recent = req\.query\.recent === "true"/);
  assert.match(routes, /LIMIT 500/);
  assert.match(routes, /const tripId = req\.query\.trips_id/);
  assert.match(routes, /trips_payment_refund_tbl/);
  assert.match(routes, /customer_street_address1/);
  assert.match(routes, /alpenwild_trips_additional_price_tbl/);
  assert.doesNotMatch(
    app,
    /app\.get\("\/api\/trip-bookings(?:\/options|\/payments)?"|app\.get\("\/api\/trip-bookings",/,
  );
});
