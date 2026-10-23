import { paymentLinkSignature } from "./paymentLinkSignature.js";

function parseIsoDate(value) {
  const text = String(value ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== text
    ? null
    : date;
}

function daysBetween(startValue, endValue) {
  const start = parseIsoDate(startValue);
  const end = parseIsoDate(endValue);
  if (!start || !end) return null;
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

export function getPaymentReminderType({
  today,
  tripStartDate,
  bookingDate,
  pendingAmount,
}) {
  if (!(Number(pendingAmount) > 0)) return null;
  if (daysBetween(today, tripStartDate) === 135) return "135_days_before_trip";

  const daysFromBookingToTrip = daysBetween(bookingDate, tripStartDate);
  if (
    daysFromBookingToTrip !== null &&
    Math.abs(daysFromBookingToTrip) < 120 &&
    daysBetween(bookingDate, today) === 3
  )
    return "3_days_after_booking";

  return null;
}

export function calculateReminderInvoiceDueDate(today, tripStartDate) {
  const daysUntilTrip = daysBetween(today, tripStartDate);
  const baseDate = parseIsoDate(today);
  const tripDate = parseIsoDate(tripStartDate);
  if (daysUntilTrip === null || !baseDate || !tripDate) return null;

  const dueDate = new Date(
    (Math.abs(daysUntilTrip) <= 120 ? baseDate : tripDate).getTime(),
  );
  dueDate.setUTCDate(
    dueDate.getUTCDate() + (Math.abs(daysUntilTrip) <= 120 ? 3 : -120),
  );
  return dueDate.toISOString().slice(0, 10);
}

export function createSignedPaymentUrl({
  origin,
  bookingId,
  type,
  amount,
  jwtSecret,
}) {
  const base = new URL(origin);
  if (!["http:", "https:"].includes(base.protocol))
    throw new Error("Payment-link origin must use HTTP or HTTPS.");

  const url = new URL("/staticpage/make-a-payment/", base);
  url.searchParams.set("type", type);
  url.searchParams.set("bookingid", String(bookingId));
  if (type === "define_admin")
    url.searchParams.set("adminamount", String(amount));
  url.searchParams.set(
    "signature",
    paymentLinkSignature(bookingId, type, amount, jwtSecret),
  );
  return url.toString();
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}
