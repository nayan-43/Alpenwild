import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createPaymentRequestId } from "../../frontend/src/lib/paymentRequestId.js";

test("public make-payment form follows PHP structure and classes", async () => {
  const frontend = await readFile(
    new URL("../../frontend/src/pages/PublicStaticPage.jsx", import.meta.url),
    "utf8",
  );
  const php = await readFile(
    new URL("../../../page.php", import.meta.url),
    "utf8",
  );
  const linkedPhp = await readFile(
    new URL("../../../paymetsnow.php", import.meta.url),
    "utf8",
  );

  assert.match(
    php,
    /class="col-md-6 col-md-offset-3 col-sm-6 col-sm-offset-3 col-xs-12"[\s\S]*?class="tabContainer"[\s\S]*?class="tabContent mTabContent mTabActive"[\s\S]*?class="trips-booking-form"[\s\S]*?class="col-left"[\s\S]*?class="tpbox"[\s\S]*?class="tpbox-con"[\s\S]*?class="form-horizontal"[\s\S]*?class="form-table"/,
  );
  const reactClasses = new Set(
    [...frontend.matchAll(/className="([^"]+)"/g)].flatMap(([, value]) =>
      value.split(/\s+/),
    ),
  );
  for (const className of [
    "col-md-6 col-md-offset-3 col-sm-6 col-sm-offset-3 col-xs-12",
    "tabContainer",
    "tabContent mTabContent mTabActive",
    "trips-booking-form",
    "col-left",
    "tpbox",
    "tpbox-con",
    "form-horizontal",
    "form-table",
    "trip-lists",
    "ls",
    "rs",
    "input_text",
    "select",
    "select_text",
    "g-recaptcha",
    "buttan btn btn-primary",
    "clear",
    "booking_tips",
    "numberLst",
  ]) {
    for (const classToken of className.split(/\s+/))
      assert.ok(
        reactClasses.has(classToken),
        `React payment form includes PHP class ${classToken}`,
      );
  }
  assert.match(linkedPhp, /Total Due Amount\*:/);
  assert.match(frontend, /Total Due Amount\*:/);
  assert.match(frontend, /name="amount"[\s\S]*?paymentLinkState\.booking\.due/);
});

test("payment request IDs support browsers without crypto.randomUUID", () => {
  const cryptoProvider = {
    getRandomValues(bytes) {
      bytes.fill(0);
      return bytes;
    },
  };

  const requestId = createPaymentRequestId(cryptoProvider);

  assert.match(
    requestId,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
});

test("approved trip payments follow the PHP receipt flow without internal recipients", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const frontend = await readFile(
    new URL("../../frontend/src/pages/PublicStaticPage.jsx", import.meta.url),
    "utf8",
  );
  const php = await readFile(
    new URL("../../../make_payment_process.php", import.meta.url),
    "utf8",
  );
  const route = app.match(
    /app\.post\("\/api\/trip-payments"[\s\S]*?\n\}\);/,
  )?.[0];

  assert.ok(route, "public trip payment route exists");
  assert.match(app, /x_duplicate_window:\s*"1"/);
  assert.match(route, /data\.amount < 50/);
  assert.match(route, /You have to pay minimun \$50\./);
  assert.match(route, /DELETE FROM alpenwild_trips_payment_tbl/);
  assert.match(route, /SET payment_status='Paid'/);
  assert.match(
    route,
    /UPDATE alpenwild_trips_booking_tbl[\s\S]*?trip_payment_due/,
  );
  assert.match(route, /\[remainingBalance === 0 \? 5 : 2\]/);
  assert.match(route, /to:\s*user\.user_email_address/);
  assert.match(route, /attachments:/);
  assert.doesNotMatch(route, /\b(?:cc|bcc)\s*:/i);
  assert.doesNotMatch(route, /@alpenwild\.com/i);

  assert.match(php, /email_template_id='5'/);
  assert.match(php, /email_template_id='2'/);
  assert.match(php, /You have to pay minimun \$50\./);
  assert.match(php, /setParameter\("x_duplicate_window",\s*1\)/);
  assert.match(frontend, /navigate\("\/staticpage\/thank-you\/"\)/);
  assert.match(route, /client_request_id:\s*z\.string\(\)\.uuid\(\)/);
  assert.match(route, /ON CONFLICT \(request_id\) DO NOTHING/);
  assert.match(route, /existing\.status === "paid"/);
  assert.match(route, /FOR UPDATE/);
  assert.match(route, /status='paid',transaction_id=\$1/);
  assert.match(frontend, /sessionStorage\.getItem\(requestStorageKey\)/);
  assert.match(frontend, /function rotatePaymentRequestId\(\)/);
  assert.match(frontend, /const requestId = createPaymentRequestId\(\)/);
  assert.doesNotMatch(frontend, /window\.crypto\.randomUUID\(\)/);
  assert.match(frontend, /client_request_id:\s*clientRequestId/);
  assert.match(frontend, /sessionStorage\.removeItem\(requestStorageKey\)/);
});

test("payment thank-you redirect resolves the same active static page content", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const frontend = await readFile(
    new URL("../../frontend/src/pages/PublicStaticPage.jsx", import.meta.url),
    "utf8",
  );
  const phpPayment = await readFile(
    new URL("../../../make_payment_process.php", import.meta.url),
    "utf8",
  );
  const phpStaticPage = await readFile(
    new URL("../../../page.php", import.meta.url),
    "utf8",
  );

  assert.match(phpPayment, /static_page_id=1620/);
  assert.match(phpPayment, /static_page_slug/);
  assert.match(phpStaticPage, /static_page_slug=:sps1/);
  assert.match(app, /app\.get\("\/api\/public-static-pages\/:slug"/);
  assert.match(app, /\$\{statusColumn\}='Active'/);
  assert.match(
    frontend,
    /fetch\(`\/api\/public-static-pages\/\$\{encodeURIComponent\(slug\)\}`\)/,
  );
  assert.match(frontend, /dangerouslySetInnerHTML[\s\S]*?page\.description/);
});

test("admin payment links preload and target the signed booking", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const frontend = await readFile(
    new URL("../../frontend/src/pages/PublicStaticPage.jsx", import.meta.url),
    "utf8",
  );
  const linkEmailRoute = app.match(
    /app\.post\(\s*"\/api\/trip-bookings\/:bookingId\/payment-link"[\s\S]*?\n\}\);/,
  )?.[0];
  const linkLookupRoute = app.match(
    /app\.get\("\/api\/public-trip-payment-links\/:bookingId"[\s\S]*?\n\}\);/,
  )?.[0];
  const paymentRoute = app.match(
    /app\.post\("\/api\/trip-payments"[\s\S]*?\n\}\);/,
  )?.[0];

  assert.ok(linkEmailRoute, "admin payment-link email route exists");
  assert.ok(linkLookupRoute, "public signed payment-link lookup exists");
  assert.ok(paymentRoute, "public payment route exists");
  assert.match(
    linkEmailRoute,
    /paymentLinkSignature\(bookingId, type, amount\)/,
  );
  assert.match(linkEmailRoute, /signedPaymentUrl/);
  assert.match(linkLookupRoute, /trips_booking_status='Active'/);
  assert.match(linkLookupRoute, /COALESCE\(b\.trip_payment_due, 0\) > 0/);
  assert.match(paymentRoute, /payment_link_signature/);
  assert.match(
    paymentRoute,
    /AND \(\$3::bigint IS NULL OR b\.trips_booking_id=\$3\)/,
  );
  assert.match(paymentRoute, /data\.payment_link_type === "due"/);
  assert.match(paymentRoute, /data\.payment_link_type === "define_admin"/);
  assert.match(frontend, /\/api\/public-trip-payment-links\//);
  assert.match(frontend, /booking_id: linkedBooking\.booking_id/);
  assert.match(frontend, /payment_link_signature: linkedBooking\.signature/);
  assert.match(frontend, /paymentLinkState\.booking\.trip_id/);
  assert.match(frontend, /paymentLinkState\.booking\.email/);
});
