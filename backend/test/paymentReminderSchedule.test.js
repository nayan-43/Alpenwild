import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateReminderInvoiceDueDate,
  createSignedPaymentUrl,
  getPaymentReminderType,
} from "../src/paymentReminderSchedule.js";

test("payment reminders follow the PHP 135-day and 3-day rules", () => {
  assert.equal(
    getPaymentReminderType({
      today: "2026-10-08",
      tripStartDate: "2027-02-20",
      bookingDate: "2026-01-01",
      pendingAmount: 100,
    }),
    "135_days_before_trip",
  );
  assert.equal(
    getPaymentReminderType({
      today: "2026-10-08",
      tripStartDate: "2026-12-01",
      bookingDate: "2026-10-05",
      pendingAmount: 100,
    }),
    "3_days_after_booking",
  );
  assert.equal(
    getPaymentReminderType({
      today: "2026-10-08",
      tripStartDate: "2026-12-01",
      bookingDate: "2026-10-05",
      pendingAmount: 0,
    }),
    null,
  );
});

test("reminder invoice due date follows the PHP fallback calculation", () => {
  assert.equal(
    calculateReminderInvoiceDueDate("2026-10-08", "2026-12-01"),
    "2026-10-11",
  );
  assert.equal(
    calculateReminderInvoiceDueDate("2026-10-08", "2027-06-01"),
    "2027-02-01",
  );
});

test("payment reminder links use the application's signed payment route", () => {
  const link = new URL(
    createSignedPaymentUrl({
      origin: "https://booking.example",
      bookingId: 42,
      type: "due",
      jwtSecret: "test-secret",
    }),
  );
  assert.equal(link.pathname, "/staticpage/make-a-payment/");
  assert.equal(link.searchParams.get("bookingid"), "42");
  assert.equal(link.searchParams.get("type"), "due");
  assert.match(link.searchParams.get("signature"), /^[a-f0-9]{64}$/);
});
