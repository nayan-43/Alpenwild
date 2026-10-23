import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { bookingCountries } from "../../frontend/src/lib/bookingCountries.js";

test("public trip selectors follow the PHP active-trip ordering", async () => {
  const phpStaticPage = await readFile(
    new URL("../../../page.php", import.meta.url),
    "utf8",
  );
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const publicStaticPage = await readFile(
    new URL("../../frontend/src/pages/PublicStaticPage.jsx", import.meta.url),
    "utf8",
  );
  const tripTypeQuery = phpStaticPage.match(
    /\$trips_type_array\s*=\s*\$trip_type->trip_type_display\([\s\S]*?WHERE trip_type_status='Active'[\s\S]*?\);/,
  )?.[0];
  const tripQuery = phpStaticPage.match(
    /\$trips_array\s*=\s*\$trip->trips_display\([\s\S]*?trips_type_id[\s\S]*?trips_status='Active'[\s\S]*?trips_order asc'[\s\S]*?\);/,
  )?.[0];

  assert.ok(tripTypeQuery, "PHP queries active trip types");
  assert.ok(tripQuery, "PHP queries active trips ordered by trips_order");
  assert.match(
    publicStaticPage,
    /tripTypeData\s*\.filter\(\(item\) => item\.status === "Active"\)/,
  );
  assert.match(publicStaticPage, /Number\(first\.id\) - Number\(second\.id\)/);
  assert.match(
    publicStaticPage,
    /tripData\s*\.filter\(\(item\) => item\.status === "Active"\)/,
  );
  assert.match(
    publicStaticPage,
    /Number\(first\.display_order\)\s*-\s*Number\(second\.display_order\)/,
  );
  assert.match(app, /ORDER BY t\.trips_order, t\.trips_id/);
});

test("public booking country options match the PHP booking form", async () => {
  const php = await readFile(
    new URL("../../../trip_booking.php", import.meta.url),
    "utf8",
  );
  const match = php.match(/\$countriesArr\s*=\s*\[([\s\S]*?)\];/);
  assert.ok(match, "PHP country list exists");

  const phpCountries = [...match[1].matchAll(/"((?:\\.|[^"\\])*)"/g)].map(
    ([, country]) =>
      country
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\")
        .replace(/&amp;/g, "&")
        .replace(/&#047;/g, "/"),
  );

  assert.deepEqual(bookingCountries, phpCountries);
});

test("public booking page structure follows the PHP template", async () => {
  const php = await readFile(
    new URL("../../../trip_booking.php", import.meta.url),
    "utf8",
  );
  const phpBanner = await readFile(
    new URL("../../../trip_banner.php", import.meta.url),
    "utf8",
  );
  const frontend = await readFile(
    new URL(
      "../../frontend/src/pages/PublicTripBookingPage.jsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(
    php,
    /<div class="section">\s*<div class="container">\s*<div class="row">/,
  );
  assert.match(
    frontend,
    /<div className="section client-trip-booking-page">\s*<div className="container">\s*<div className="row">/,
  );
  assert.match(
    php,
    /<li class="active"><a href="[^"]*\/details\/#overview">Details<\/a><\/li>/,
  );
  assert.match(
    frontend,
    /<li className="active">\s*<Link to=\{`\/trip\/\$\{slug\}\/details\/#overview`\}>Details<\/Link>/,
  );
  assert.match(
    php,
    /<p>\s*<\?php if \(isset\(\$_SESSION\['trips_booking_msg'\]\)\)/,
  );
  assert.match(
    frontend,
    /<p\s+ref=\{bookingStatusRef\}[\s\S]*?\{submitState\.error \|\| submitState\.message\}\s*<\/p>/,
  );
  assert.match(
    phpBanner,
    /<div class="banner">\s*<div class="container">\s*<div class="inner_banner"/,
  );
  assert.match(
    frontend,
    /<div className="banner">\s*<div className="container">\s*<section\s+className="inner_banner client-detail-banner"/,
  );
  assert.match(
    phpBanner,
    /<h1><\?php echo repc\(\$trips_array\[0\]\['trips_name'\]\); \?><\/h1>/,
  );
  assert.match(frontend, /<h1>\{trip\.name\}<\/h1>/);
  assert.match(
    phpBanner,
    /<div class="banner_activity_content">\s*<p><\?php echo repc\(\$trips_array\[0\]\['trips_activity'\]\); \?><\/p>/,
  );
  assert.match(
    frontend,
    /className="banner_activity_content client-detail-banner-popover client-detail-banner-activity-popover"[\s\S]*?localizeRichContent\(trip\.activity \|\| ""\)/,
  );
  assert.match(
    php,
    /<div class="box">\s*<\?php echo repc\(\$trips_array\[0\]\['trips_activity'\]\); \?>/,
  );
  assert.match(
    frontend,
    /className="box"[\s\S]*?localizeRichContent\(trip\?\.activity \|\| ""\)/,
  );
});

test("legacy users receive an ID sequence default for public booking inserts", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  assert.match(app, /async function ensureLegacyUserIdentity\(\)/);
  assert.match(
    app,
    /ALTER TABLE alpenwild_user_tbl ALTER COLUMN user_id SET DEFAULT nextval/,
  );
  assert.match(app, /await ensureLegacyUserIdentity\(\);/);
});

test("legacy bookings receive an ID sequence default before public submissions", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  assert.match(app, /async function ensureLegacyTripBookingIdentity\(\)/);
  assert.match(
    app,
    /ALTER TABLE alpenwild_trips_booking_tbl ALTER COLUMN trips_booking_id SET DEFAULT nextval/,
  );
  assert.match(app, /await ensureLegacyTripBookingIdentity\(\);/);
});

test("legacy trip payments receive an ID sequence default before payment inserts", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  assert.match(app, /async function ensureLegacyTripPaymentIdentity\(\)/);
  assert.match(
    app,
    /ALTER TABLE alpenwild_trips_payment_tbl ALTER COLUMN trips_payment_id SET DEFAULT nextval/,
  );
  assert.match(app, /await ensureLegacyTripPaymentIdentity\(\);/);
});

test("legacy trip additional prices receive an ID sequence default before booking inserts", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  assert.match(
    app,
    /async function ensureLegacyTripAdditionalPriceIdentity\(\)/,
  );
  assert.match(
    app,
    /ALTER TABLE alpenwild_trips_additional_price_tbl ALTER COLUMN trips_additional_price_id SET DEFAULT nextval/,
  );
  assert.match(app, /await ensureLegacyTripAdditionalPriceIdentity\(\);/);
});

test("legacy newsletter entries receive an ID sequence default before inserts", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  assert.match(app, /async function ensureLegacyMailingListIdentity\(\)/);
  assert.match(
    app,
    /ALTER TABLE alpenwild_mailing_list_tbl ALTER COLUMN mailing_list_id SET DEFAULT nextval/,
  );
  assert.match(app, /await ensureLegacyMailingListIdentity\(\);/);
});

test("public bookings set legacy optional user and billing IDs to their zero sentinel", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  assert.match(
    app,
    /INSERT INTO alpenwild_trips_booking_tbl[\s\S]*?trips_date_id,trips_booking_date,additional_user_id,billing_address_id,[\s\S]*?user_shipping_postal_code,user_shipping_country,trips_booking_status\)[\s\S]*?VALUES \(\$1,\$2,\$3,CURRENT_DATE,0,0,\$4[\s\S]*?'Active'\)/,
  );
});

test("booking lists use the first payment date when legacy booking date is missing", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const route = app.match(
    /app\.get\("\/api\/trip-bookings",[\s\S]*?\n\}\);/,
  )?.[0];

  assert.ok(route, "admin booking list route exists");
  assert.match(
    route,
    /COALESCE\(\s*b\.trips_booking_date,\s*\(SELECT MIN\(p\.payment_date\)[\s\S]*?p\.trips_booking_id=b\.trips_booking_id\)\s*\) AS booking_date/,
  );
  assert.match(
    route,
    /ORDER BY booking_date DESC NULLS LAST, b\.trips_booking_id DESC/,
  );
});

test("admin booking updates cast optional start and end dates to PostgreSQL date", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const updateRoute = app.match(
    /app\.patch\("\/api\/trip-bookings\/:bookingId"[\s\S]*?\n\}\);/,
  )?.[0];

  assert.ok(updateRoute, "admin booking update route exists");
  assert.match(updateRoute, /booking_start_date=NULLIF\(\$4::text, ''\)::date/);
  assert.match(updateRoute, /booking_end_date=NULLIF\(\$5::text, ''\)::date/);
});

test("admin booking edits record entered deposits and recalculate the remaining balance", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const frontend = await readFile(
    new URL(
      "../../frontend/src/pages/admin/trip/AddTripBookingPage.jsx",
      import.meta.url,
    ),
    "utf8",
  );
  const php = await readFile(
    new URL(
      "../../../administrator/add_trip_booking_step2.php",
      import.meta.url,
    ),
    "utf8",
  );
  const updateRoute = app.match(
    /app\.patch\("\/api\/trip-bookings\/:bookingId"[\s\S]*?\n\}\);/,
  )?.[0];

  assert.ok(updateRoute, "admin booking update route exists");
  assert.match(
    php,
    /if\s*\(\$_REQUEST\['trips_deposit_amount_new'\]\s*>\s*0\)/,
  );
  assert.match(frontend, /body:\s*\{\s*\.\.\.form,/);
  assert.match(frontend, /payment_amount:\s*0/);
  assert.match(
    updateRoute,
    /tripBookingAmount\.parse\(b\.deposit_amount \|\| 0\)/,
  );
  assert.match(
    updateRoute,
    /INSERT INTO alpenwild_trips_payment_tbl[\s\S]*?trips_booking_id,name_on_credit_card,payment_price,[\s\S]*?payment_date,payment_status\)[\s\S]*?VALUES\s*\(\$1,'',\$2,CURRENT_DATE,'Paid'\)/,
  );
  assert.match(
    updateRoute,
    /SELECT COALESCE\(SUM\(payment_price\), 0\) AS total[\s\S]*?WHERE trips_booking_id=\$1/,
  );
  assert.match(
    updateRoute,
    /tripTotal\s*\+\s*singleSupplement\s*\+\s*Number\(additionalPricesResult\.rows\[0\]\.total\)\s*-\s*Number\(payments\.rows\[0\]\.total\)/,
  );
  assert.match(updateRoute, /trip_payment_due=\$38/);
});

test("admin booking edits send PHP-parity invoice emails without masking saved updates", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const frontend = await readFile(
    new URL(
      "../../frontend/src/pages/admin/trip/AddTripBookingPage.jsx",
      import.meta.url,
    ),
    "utf8",
  );
  const php = await readFile(
    new URL(
      "../../../administrator/add_trip_booking_step2.php",
      import.meta.url,
    ),
    "utf8",
  );
  const updateRoute = app.match(
    /app\.patch\("\/api\/trip-bookings\/:bookingId"[\s\S]*?\n\}\);/,
  )?.[0];

  assert.ok(updateRoute, "admin booking update route exists");
  assert.match(app, /user_email_option:\s*18/);
  assert.match(php, /User_Email\s*==\s*'On'/);
  assert.match(updateRoute, /site_configuration_id=18/);
  assert.match(updateRoute, /b\.send_email\s*===\s*true/);
  assert.match(updateRoute, /payments@alpenwild\.com,coder\.web@yahoo\.com/);
  assert.match(updateRoute, /createTripBookingInvoicePdf\(\{/);
  assert.match(updateRoute, /contentType:\s*"application\/pdf"/);
  assert.match(
    updateRoute,
    /Booking was updated, but invoice email delivery failed/,
  );
  assert.match(frontend, /saved\?\.emailWarning/);
});

test("discount validation and admin edit adjustments follow the PHP booking flow", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const publicPage = await readFile(
    new URL(
      "../../frontend/src/pages/PublicTripBookingPage.jsx",
      import.meta.url,
    ),
    "utf8",
  );
  const adminPage = await readFile(
    new URL(
      "../../frontend/src/pages/admin/trip/AddTripBookingPage.jsx",
      import.meta.url,
    ),
    "utf8",
  );
  const phpPublic = await readFile(
    new URL("../../../trip_booking.php", import.meta.url),
    "utf8",
  );
  const phpDiscountCheck = await readFile(
    new URL("../../../discountcheck.php", import.meta.url),
    "utf8",
  );
  const phpAdmin = await readFile(
    new URL(
      "../../../administrator/add_trip_booking_step2.php",
      import.meta.url,
    ),
    "utf8",
  );
  const editRoute = app.match(
    /app\.patch\("\/api\/trip-bookings\/:bookingId"[\s\S]*?\n\}\);/,
  )?.[0];

  assert.ok(editRoute, "admin booking update route exists");
  assert.match(phpPublic, /\$\('#discount'\)\.on\('click'/);
  assert.match(phpDiscountCheck, /discount_status='Active'/);
  assert.match(publicPage, /fetch\("\/api\/discount-check"/);
  assert.match(publicPage, /onClick=\{checkDiscount\}/);
  assert.match(publicPage, /readOnly=\{discountState\.applied\}/);
  assert.match(app, /app\.post\("\/api\/discount-check"/);
  assert.match(app, /"\/discount-check"/);

  assert.match(phpAdmin, /discount_type'\] == 'Percentage'/);
  assert.match(phpAdmin, /'sign' => rep\(\$sign_discount\)/);
  assert.match(adminPage, /value=\{form\.discount_code\}/);
  assert.match(editRoute, /getTripBookingDiscount\(/);
  assert.match(
    editRoute,
    /INSERT INTO alpenwild_trips_additional_price_tbl[\s\S]*?VALUES \(\$1,\$2,\$3,'-'\)/,
  );
  assert.match(editRoute, /UPDATE alpenwild_trips_additional_price_tbl/);
  assert.match(app, /AS additional_prices/);
});

test("admin email lookup route is registered before the booking ID route", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const emailLookupIndex = app.indexOf('app.get("/api/trip-bookings/user"');
  const bookingIdIndex = app.indexOf('app.get("/api/trip-bookings/:bookingId"');

  assert.notEqual(emailLookupIndex, -1, "email lookup route exists");
  assert.notEqual(bookingIdIndex, -1, "booking ID route exists");
  assert.ok(
    emailLookupIndex < bookingIdIndex,
    "the static user path must not be captured as a booking ID",
  );
});

test("public bookings store billing and shipping snapshots on the booking", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const php = await readFile(
    new URL("../../../trip_booking.php", import.meta.url),
    "utf8",
  );
  const bookingInsert = app.match(
    /INSERT INTO alpenwild_trips_booking_tbl[\s\S]*?RETURNING trips_booking_id AS id/,
  )?.[0];

  assert.ok(bookingInsert, "public booking insert exists");
  for (const field of [
    "user_first_name",
    "user_last_name",
    "user_street_address",
    "user_city",
    "user_state",
    "user_postal_code",
    "user_country",
    "user_shipping_first_name",
    "user_shipping_street_address",
    "user_shipping_city",
    "user_shipping_state",
    "user_shipping_postal_code",
    "user_shipping_country",
  ]) {
    assert.match(bookingInsert, new RegExp(`\\b${field}\\b`));
    assert.match(php, new RegExp(`'${field}'\\s*=>`));
  }
});

test("booking inserts use PHP booking columns and store discounts as additional prices", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const phpAdmin = await readFile(
    new URL(
      "../../../administrator/add_trip_booking_step2.php",
      import.meta.url,
    ),
    "utf8",
  );
  const insert = app.match(
    /INSERT INTO alpenwild_trips_booking_tbl[\s\S]*?RETURNING trips_booking_id AS id/,
  )?.[0];
  const discountInsert = app.match(
    /if \(discountAmount > 0\)[\s\S]*?INSERT INTO alpenwild_trips_additional_price_tbl[\s\S]*?`/,
  )?.[0];

  assert.ok(insert, "trip booking insert exists");
  for (const field of [
    "shipping_first_name",
    "shipping_last_name",
    "shipping_street_address",
    "shipping_city",
    "shipping_state",
    "shipping_postal_code",
    "shipping_country",
    "discount_code",
    "discount_amount",
  ]) {
    assert.doesNotMatch(insert, new RegExp(`\\b${field}\\b`));
  }
  assert.match(insert, /user_shipping_first_name/);
  assert.match(insert, /user_shipping_country/);
  assert.match(insert, /admin_notes/);
  assert.match(insert, /\$40,'Active'\)/);
  assert.doesNotMatch(insert, /\$41/);
  assert.match(phpAdmin, /'admin_notes'\s*=>\s*rep\(\$admin_notes\)/);

  assert.ok(discountInsert, "discount relation insert exists");
  assert.match(discountInsert, /\(trips_booking_id,description,price,sign\)/);
  assert.match(
    app,
    /\[booking\.rows\[0\]\.id, discount\.description, discountAmount\]/,
  );
  assert.match(phpAdmin, /'description'\s*=>\s*rep\(\$name_discount\)/);
  assert.match(phpAdmin, /'sign'\s*=>\s*rep\(\$sign_discount\)/);
});

test("existing public booking users are not updated, matching the PHP booking flow", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const php = await readFile(
    new URL("../../../trip_booking.php", import.meta.url),
    "utf8",
  );
  const handler = app.match(
    /async function handleTripBooking\(req, res, next\) \{[\s\S]*?\n\}\n\napp\.post\("\/api\/trip-bookings"/,
  )?.[0];

  assert.ok(handler, "trip booking handler exists");
  assert.doesNotMatch(handler, /UPDATE alpenwild_user_tbl/);
  assert.match(
    php,
    /\/\/\$trips_user_update_success_sql = \$db->update\('user_tbl'/,
  );
});

test("public booking sends customer confirmation and PHP-style staff payment notification", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const email = await readFile(
    new URL("../src/tripBookingEmail.js", import.meta.url),
    "utf8",
  );
  const publicRoute = app.match(
    /app\.post\("\/api\/public\/trip-bookings"[\s\S]*?\n\}\);/,
  )?.[0];
  const staffNotification = app.match(
    /if \(\s*paymentApproved &&\s*req\.path === "\/api\/public\/trip-bookings" &&\s*mailer\s*\) \{[\s\S]*?\n    \}\n    if \(data\.send_email/,
  )?.[0];

  assert.ok(publicRoute, "public booking route exists");
  assert.ok(
    staffNotification,
    "approved public booking staff notification exists",
  );
  assert.match(publicRoute, /send_email:\s*true/);
  assert.match(
    app,
    /FROM alpenwild_email_template_tbl[\s\S]*?email_template_id=\$1[\s\S]*?\[6\]/,
  );
  assert.match(app, /to:\s*data\.user_email_address,[\s\S]*?attachments:/);
  assert.match(app, /paymentApproved && mailer/);
  assert.match(email, /createBookingConfirmationHtml/);
  assert.match(
    staffNotification,
    /from:\s*\{\s*name: siteTitle,\s*address: config\.smtpFrom \|\| config\.smtpUser,\s*\},\s*replyTo: data\.user_email_address,[\s\S]*?to: "payments@yopmail\.com,webgrity43@gmail\.com",[\s\S]*?subject: "Alpenwild Payment Details \(Trip Reservation\)"/,
  );
  assert.match(email, /createTripBookingAdminNotificationHtml/);
  assert.doesNotMatch(app, /\b(?:cc|bcc)\s*:/i);
  assert.doesNotMatch(publicRoute, /@alpenwild\.com/i);
});

test("public booking redirects to the PHP thank-you page without a success alert", async () => {
  const bookingPage = await readFile(
    new URL(
      "../../frontend/src/pages/PublicTripBookingPage.jsx",
      import.meta.url,
    ),
    "utf8",
  );
  const staticPage = await readFile(
    new URL("../../frontend/src/pages/PublicStaticPage.jsx", import.meta.url),
    "utf8",
  );
  const php = await readFile(
    new URL("../../../trip_booking.php", import.meta.url),
    "utf8",
  );

  assert.match(php, /Booking added successfully\. Please enter another\./);
  assert.match(bookingPage, /navigate\("\/staticpage\/thank-you\/"\)/);
  assert.doesNotMatch(bookingPage, /bookingMessage/);
  assert.doesNotMatch(
    staticPage,
    /bookingMessage|client-booking-alert-success/,
  );
});

test("admin trip booking edits keep their form values and show one correct notice", async () => {
  const bookingForm = await readFile(
    new URL(
      "../../frontend/src/pages/admin/trip/AddTripBookingPage.jsx",
      import.meta.url,
    ),
    "utf8",
  );
  const adminApp = await readFile(
    new URL("../../frontend/src/pages/AdminApp.jsx", import.meta.url),
    "utf8",
  );

  assert.match(
    bookingForm,
    /onSaved\?\.\([\s\S]*?bookingId[\s\S]*?Trip booking updated successfully\.[\s\S]*?Trip booking created successfully\./,
  );
  assert.match(
    bookingForm,
    /if \(!bookingId\) \{\s*setForm\(emptyForm\);\s*setStep\(1\);\s*\}/,
  );
  assert.match(bookingForm, /if \(savingRef\.current\) return;/);
  assert.match(
    bookingForm,
    /savingRef\.current = true;[\s\S]*?finally \{\s*savingRef\.current = false;/,
  );
  assert.match(bookingForm, /disabled=\{saving\}/);
  assert.doesNotMatch(bookingForm, /\{message && <p className="notice">/);
  assert.match(adminApp, /onSaved=\{completeTripBookingSave\}/);
  assert.doesNotMatch(
    adminApp,
    /onSaved=\{\(\) => setNotice\("Trip booking created successfully\."\)\}/,
  );
});

test("admin booking saves return to the matching PHP booking list with a notice", async () => {
  const php = await readFile(
    new URL(
      "../../../administrator/add_trip_booking_step2.php",
      import.meta.url,
    ),
    "utf8",
  );
  const adminPhp = await readFile(
    new URL("../../../administrator/manage_trip_payment.php", import.meta.url),
    "utf8",
  );
  const adminApp = await readFile(
    new URL("../../frontend/src/pages/AdminApp.jsx", import.meta.url),
    "utf8",
  );

  assert.match(
    php,
    /header\('Location: manage_trip_payment\.php\?type=recent'\)/,
  );
  assert.match(php, /\$_SESSION\['trip_booking_manage_url2'\]/);
  assert.match(
    php,
    /\$_SESSION\['trips_msg'\]\s*=\s*messagedisplay\('Trips\\'s Booking is updated successfully'/,
  );
  assert.match(
    adminPhp,
    /if \(isset\(\$_SESSION\['order_msg'\]\)\)[\s\S]*?\$_SESSION\['trips_msg'\]/,
  );

  assert.match(
    adminApp,
    /function completeTripBookingSave\(message\)[\s\S]*?returnTo[\s\S]*?navigate\(returnTo === "all" \? "tripBookings" : "recentTripBookings"\);[\s\S]*?setNotice\(message\)/,
  );
  assert.ok(adminApp.includes("?returnTo=recent"));
  assert.ok(adminApp.includes("?returnTo=all"));
});

test("public booking distinguishes a missing CAPTCHA from a failed CAPTCHA", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  assert.match(
    app,
    /!data\.recaptcha_token[\s\S]*?Please click on the reCAPTCHA box/,
  );
  assert.match(
    app,
    /verifyRecaptcha\(data\.recaptcha_token\)[\s\S]*?Robot verification failed, please try again/,
  );
});

test("public booking failure messages distinguish payment startup from uncertain payment status", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  assert.match(
    app,
    /paymentAuthorizationStarted && !paymentStatusSaved[\s\S]*?could not confirm the payment status[\s\S]*?payment could not be started/,
  );
});

test("declined public payments return the gateway message and remove failed records", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  assert.match(
    app,
    /if \(charge\.configured && !charge\.approved\) \{[\s\S]*DELETE FROM alpenwild_trips_additional_booking_user_tbl[\s\S]*DELETE FROM alpenwild_trips_payment_tbl[\s\S]*DELETE FROM alpenwild_trips_booking_tbl[\s\S]*return res\.status\(402\)\.json\(\{ message: charge\.reason \}\)/,
  );
});

test("public booking errors do not return admin-specific text", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  assert.match(
    app,
    /req\.path === "\/api\/public\/trip-bookings"[\s\S]*?We could not complete your booking/,
  );
});
