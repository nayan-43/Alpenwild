import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("refunds update the gateway, records, booking balance, and customer invoice email", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const frontend = await readFile(
    new URL(
      "../../frontend/src/pages/admin/trip/TripSectionPage.jsx",
      import.meta.url,
    ),
    "utf8",
  );
  const php = await readFile(
    new URL("../../../administrator/ajax/trip_refund.php", import.meta.url),
    "utf8",
  );
  const route = app.match(
    /app\.post\("\/api\/trip-payments\/:paymentId\/refund"[\s\S]*?\n\}\);/,
  )?.[0];

  assert.ok(route, "trip refund route exists");
  assert.match(php, /Your refund of[\s\S]*?We've attached an updated invoice/);
  assert.match(route, /FOR UPDATE OF p, b/);
  assert.match(route, /authorizeNetRefund\(\{/);
  assert.match(route, /SET refunded_amount=\$1, refund_status=\$2/);
  assert.match(route, /INSERT INTO alpenwild_trips_payment_refund_tbl/);
  assert.match(route, /trip_payment_due=COALESCE\(trip_payment_due,0\)\+\$1/);
  assert.match(route, /createTripBookingInvoicePdf\(\{/);
  assert.match(route, /createRefundConfirmationHtml\(\{/);
  assert.match(route, /payments@alpenwild\.com, coder\.web@yahoo\.com/);
  assert.match(route, /emailWarning/);
  assert.match(frontend, /result\.emailWarning/);
});
