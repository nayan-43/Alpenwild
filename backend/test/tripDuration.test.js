import assert from "node:assert/strict";
import test from "node:test";
import { tripDuration } from "../../frontend/src/lib/tripDuration.js";

test("trip duration honors explicit trip days and nights", () => {
  assert.equal(tripDuration({ days: 8, nights: 7 }), "8 Days/7 Nights");
});

test("trip duration derives inclusive days from a specific start and end date", () => {
  assert.equal(
    tripDuration({
      dates: [
        { date_range: 0, start_date: "2026-06-10", end_date: "2026-06-17" },
      ],
    }),
    "8 Days/7 Nights",
  );
});

test("trip duration derives days and nights from a configured date range", () => {
  assert.equal(tripDuration({ dates: [{ date_range: 6 }] }), "6 Days/5 Nights");
});

test("trip duration derives one day for a same-day specific date", () => {
  assert.equal(
    tripDuration({
      dates: [
        { date_range: 0, start_date: "2026-06-10", end_date: "2026-06-10" },
      ],
    }),
    "1 Days/0 Nights",
  );
});
