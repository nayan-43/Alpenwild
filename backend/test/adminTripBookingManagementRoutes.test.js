import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("admin trip-booking management routes remain behind authorization", async () => {
  const [app, routes] = await Promise.all([
    readFile(new URL("../src/app.js", import.meta.url), "utf8"),
    readFile(
      new URL("../src/routes/admin/tripBookingManagement.js", import.meta.url),
      "utf8",
    ),
  ]);
  const authIndex = app.indexOf("createApiAccessMiddleware({");
  const mountIndex = app.indexOf(
    "createAdminTripBookingManagementRouter({ query })",
  );

  assert.ok(authIndex >= 0);
  assert.ok(mountIndex > authIndex);
  assert.match(
    routes,
    /router\.patch\(\s*"\/api\/trip-bookings\/:bookingId\/status"/,
  );
  assert.match(routes, /router\.delete\("\/api\/trip-bookings\/:bookingId"/);
  assert.match(
    routes,
    /router\.patch\(\s*"\/api\/trip-bookings\/:bookingId\/payments"/,
  );
  assert.match(routes, /router\.delete\("\/api\/trip-payments\/:paymentId"/);
  assert.match(
    routes,
    /router\.get\(\s*"\/api\/trip-bookings\/:bookingId\/refunds"/,
  );
  assert.match(routes, /Booking status updated successfully\./);
  assert.match(routes, /Payment details updated successfully\./);
  assert.match(routes, /trip_payment_due=\$1/);
  assert.match(
    routes,
    /trip_payment_due=COALESCE\(trip_payment_due, 0\) \+ \$1/,
  );
  for (const route of [
    'app.patch("/api/trip-bookings/:bookingId/status"',
    'app.delete("/api/trip-bookings/:bookingId"',
    'app.patch("/api/trip-bookings/:bookingId/payments"',
    'app.delete("/api/trip-payments/:paymentId"',
    'app.get("/api/trip-bookings/:bookingId/refunds"',
  ]) {
    assert.ok(!app.includes(route), `${route} was moved to the router`);
  }
});
