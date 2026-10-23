import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("trip booking tables use compact fixed columns and two-row actions", async () => {
  const [page, styles] = await Promise.all([
    readFile(
      new URL(
        "../../frontend/src/pages/admin/trip/TripSectionPage.jsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../../frontend/src/styles.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /" trip-booking-table" : ""/);
  assert.match(
    styles,
    /\.trip-booking-table\s*\{[^}]*min-width: 1380px;[^}]*table-layout: fixed;/,
  );
  assert.match(
    styles,
    /\.trip-booking-table \.table-action-icons\s*\{[^}]*grid-template-columns: repeat\(4, max-content\);/,
  );
});

test("booking payment amounts match PHP currency and single-supplement details", async () => {
  const [page, app] = await Promise.all([
    readFile(
      new URL(
        "../../frontend/src/pages/admin/trip/TripSectionPage.jsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../src/app.js", import.meta.url), "utf8"),
  ]);
  const route = app.match(
    /app\.get\("\/api\/trip-bookings",[\s\S]*?\n\}\);/,
  )?.[0];

  assert.ok(route, "admin booking list route exists");
  assert.match(
    page,
    /if \(key === "total_payment"\)[\s\S]*?Excluding Single Supplement of \$\{row\.additional_payment\}/,
  );
  assert.match(
    page,
    /function displayDate\(value\)[\s\S]*?toLocaleDateString\("en-US", \{\s*month: "long",\s*day: "numeric",\s*year: "numeric",?\s*\}\)[\s\S]*?\.replace\(", ", ","\)/,
  );
  assert.match(
    route,
    /'\$' \|\| COALESCE\(p\.payment_price::text, '0'\)[\s\S]*?AS deposits/,
  );
});

test("payment details include the customer's full PHP-style address", async () => {
  const [page, app, php] = await Promise.all([
    readFile(
      new URL(
        "../../frontend/src/pages/admin/trip/TripSectionPage.jsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../src/app.js", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../../../administrator/trips_booking_payment.php",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  const paymentRoute = app.match(
    /app\.get\("\/api\/trip-bookings\/payments",[\s\S]*?\n\}\);/,
  )?.[0];

  assert.ok(paymentRoute, "trip payment listing route exists");
  assert.match(
    php,
    /user_street_address1[\s\S]*?user_city[\s\S]*?user_country/,
  );
  assert.match(
    paymentRoute,
    /LEFT JOIN alpenwild_user_tbl u ON u\.user_id=b\.user_id/,
  );
  assert.match(
    page,
    /paymentSummary\.customer_street_address[\s\S]*?paymentSummary\.customer_city[\s\S]*?paymentSummary\.customer_country/,
  );
});

test("payment details use a compact loader while the payment request is pending", async () => {
  const [page, styles] = await Promise.all([
    readFile(
      new URL(
        "../../frontend/src/pages/admin/trip/TripSectionPage.jsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../../frontend/src/styles.css", import.meta.url), "utf8"),
  ]);

  assert.match(
    page,
    /paymentBookingId && loading \? " payment-detail-loading" : ""/,
  );
  assert.match(styles, /\.payment-detail-loading\s*\{[^}]*min-height: 96px;/);
  assert.match(
    styles,
    /\.payment-detail-loading > :not\(\.admin-full-page-loader\)\s*\{\s*display: none;/,
  );
});
