import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("public API actions bypass admin authentication without exposing admin page data", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const apiAccess = await readFile(
    new URL("../src/apiAccess.js", import.meta.url),
    "utf8",
  );
  const products = await readFile(
    new URL("../src/routes/products.js", import.meta.url),
    "utf8",
  );
  const publicPages = await readFile(
    new URL("../src/routes/staticPages.js", import.meta.url),
    "utf8",
  );
  const adminPages = await readFile(
    new URL("../src/routes/admin/staticPages.js", import.meta.url),
    "utf8",
  );
  const publicPaymentLinks = await readFile(
    new URL("../src/routes/publicTripPaymentLinks.js", import.meta.url),
    "utf8",
  );
  const middleware = apiAccess;
  const publicStaticPages = publicPages.match(
    /router\.get\("\/api\/public-static-pages",[\s\S]*?(?=\n\n  router\.get)/,
  )?.[0];
  const staticPages = adminPages.match(
    /router\.get\("\/api\/static-pages",[\s\S]*?\n  \}\);/,
  )?.[0];
  const paymentLinkLookup = publicPaymentLinks.match(
    /router\.get\(\s*"\/api\/public-trip-payment-links\/:bookingId"[\s\S]*?\n  \);/,
  )?.[0];
  const publicProduct = products.match(
    /router\.get\("\/api\/public-products\/:slug"/,
  )?.[0];

  assert.ok(middleware, "central API authentication middleware exists");
  assert.match(app, /app\.use\(\s*"\/api",\s*createApiAccessMiddleware/);
  assert.match(middleware, /\/public\/mailing-list/);
  assert.match(middleware, /\/public\/callback/);
  assert.match(middleware, /\/public\/trip-bookings/);
  assert.match(middleware, /\/trip-payments/);
  assert.match(middleware, /\/discount-check/);
  assert.match(middleware, /\/public-trip-payment-links\//);
  assert.match(middleware, /\/public-products\//);
  assert.match(middleware, /"\/public-navigation"/);
  assert.match(middleware, /"\/trip-images\/listing\/"/);
  assert.match(middleware, /"\/trip-type-images\/listing\/"/);
  assert.match(middleware, /\\\/trips\\\/\\d\+\\\/itinerary/);
  assert.match(
    middleware,
    /publicPostPathsWithOriginCheck\.has\(req\.path\)[\s\S]*?verifyRequestOrigin/,
  );
  assert.doesNotMatch(
    middleware,
    /publicApiPaths\.has\(req\.path\)[\s\S]*?\/static-pages"/,
  );

  assert.ok(publicStaticPages, "public search page endpoint exists");
  assert.match(publicPages, /static_page_status/);
  assert.match(publicPages, /statusColumn.*?='Active'/s);
  assert.doesNotMatch(
    publicStaticPages,
    /staticPageBoxImages|staticPageDescriptionBlocks/,
  );
  assert.ok(staticPages, "admin static page endpoint remains separate");
  assert.match(staticPages, /staticPageBoxImages/);
  assert.match(adminPages, /router\.post\("\/api\/static-pages"/);
  assert.match(adminPages, /router\.patch\(\s*"\/api\/static-pages\/:id"/);
  assert.match(adminPages, /router\.patch\("\/api\/static-pages\/:id\/status"/);
  assert.match(adminPages, /router\.delete\("\/api\/static-pages\/:id"/);
  assert.doesNotMatch(
    app,
    /app\.(?:get|post|patch|delete)\("\/api\/static-pages/,
  );
  assert.ok(paymentLinkLookup, "signed public payment lookup exists");
  assert.match(paymentLinkLookup, /isValidPaymentLinkSignature/);
  assert.ok(publicProduct, "public product detail endpoint exists");
  assert.match(products, /product_status='Active'/);

  const publicNavigation = publicPages.match(
    /router\.get\("\/api\/public-navigation",/,
  )?.[0];
  assert.ok(publicNavigation, "PHP-style public navigation endpoint exists");
  assert.match(publicPages, /menu_assign|static_page_menu_assign/);
  assert.match(publicPages, /Self In Header/);
  assert.match(publicPages, /buildPublicNavigation/);
});

test("expired admin sessions log out and show the PHP login message", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const auth = await readFile(
    new URL("../src/routes/auth.js", import.meta.url),
    "utf8",
  );
  const api = await readFile(
    new URL("../../frontend/src/lib/api.js", import.meta.url),
    "utf8",
  );
  const adminApp = await readFile(
    new URL("../../frontend/src/pages/admin/AdminApp.jsx", import.meta.url),
    "utf8",
  );
  const login = await readFile(
    new URL("../../frontend/src/pages/admin/Login.jsx", import.meta.url),
    "utf8",
  );
  const phpSession = await readFile(
    new URL("../../../administrator/includes/session.php", import.meta.url),
    "utf8",
  );
  const phpLogout = await readFile(
    new URL("../../../administrator/logout.php", import.meta.url),
    "utf8",
  );

  assert.match(phpSession, /Please login first to access this page!/);
  assert.match(phpLogout, /You have successfully logout\./);
  assert.match(auth, /code:\s*"ADMIN_SESSION_EXPIRED"/);
  assert.match(auth, /Please login first to access this page!/);
  assert.match(api, /admin-session-expired/);
  assert.match(adminApp, /setAuthUser\(null\)/);
  assert.match(
    adminApp,
    /setLoginMessage\("Please login first to access this page!"\)/,
  );
  assert.match(adminApp, /setLoginMessage\("You have successfully logout\."\)/);
  assert.match(adminApp, /setLoginMessageType\("success"\)/);
  assert.match(login, /sessionMessage/);
  assert.match(login, /sessionMessageType/);
  assert.match(login, /className="login-box"/);
  assert.match(login, /className="login-box-body"/);
});

test("public settings expose the configured site title for PHP-style page titles", async () => {
  const app = await readFile(
    new URL("../src/routes/public.js", import.meta.url),
    "utf8",
  );
  assert.match(app, /router\.get\("\/api\/public-settings"/);
  assert.match(
    app,
    /site_configuration_id = 1 OR site_configuration_id BETWEEN 20 AND 27/,
  );
  assert.match(app, /\["site_title", 1\]/);
});

test("mail senders use the configured site title with an Alpenwild fallback", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const reminders = await readFile(
    new URL("../scripts/payment-reminders.js", import.meta.url),
    "utf8",
  );

  assert.match(app, /async function getSiteTitle\(\)/);
  assert.match(app, /String\(result\.rows\[0\][\s\S]*?\|\| "Alpenwild"/);
  assert.doesNotMatch(app, /name:\s*"Alpenwild"/);
  assert.doesNotMatch(app, /from:\s*config\.smtpFrom/);
  assert.match(app, /subject: template\.email_template_subject/);

  assert.match(reminders, /async function getSiteTitle\(\)/);
  assert.match(reminders, /String\(result\.rows\[0\][\s\S]*?\|\| "Alpenwild"/);
  assert.match(reminders, /name: siteTitle/);
  assert.match(reminders, /address: config\.smtpFrom \|\| config\.smtpUser/);
});
