import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("public checkout page follows PHP checkout structure and legacy classes", async () => {
  const reactPage = await readFile(
    new URL("../../frontend/src/pages/PublicCheckoutPage.jsx", import.meta.url),
    "utf8",
  );
  const phpPage = await readFile(
    new URL("../../../checkout.php", import.meta.url),
    "utf8",
  );
  const backend = await readFile(
    new URL("../src/app.js", import.meta.url),
    "utf8",
  );
  const appRoutes = await readFile(
    new URL("../../frontend/src/main.jsx", import.meta.url),
    "utf8",
  );

  for (const className of [
    "section",
    "container",
    "title clearfix",
    "checkoutRow clearfix",
    "col-md-12 title",
    "col-md-6 col-sm-6 col-xs-12",
    "mHeight",
    "form_holder clearfix",
    "col-md-2 col-sm-4 col-xs-12",
    "col-md-6 col-sm-8 col-xs-12",
    "select",
    "btn btn-success",
  ]) {
    assert.ok(reactPage.includes(className), `React page uses ${className}`);
    assert.ok(phpPage.includes(className), `PHP page uses ${className}`);
  }

  for (const section of [
    "Shipping Address",
    "Shipping Rate",
    "Payment Details",
    "Continue Checkout",
  ]) {
    assert.ok(reactPage.includes(section), `React page includes ${section}`);
    assert.ok(phpPage.includes(section), `PHP page includes ${section}`);
  }

  for (const field of [
    "credit_card_number",
    "credit_card_expire_month",
    "credit_card_expire_year",
    "credit_card_cvv_number",
  ]) {
    assert.ok(reactPage.includes(`name="${field}"`));
    assert.ok(phpPage.includes(`name="${field}"`));
  }

  assert.match(reactPage, /searchParams\.get\("user_email_address"\)/);
  assert.match(reactPage, /saveShopCheckoutEmail\(emailFromUrl\)/);
  assert.match(reactPage, /navigate\("\/checkout", \{ replace: true \}\)/);
  assert.match(reactPage, /fetch\("\/api\/public\/shop-customer"/);
  assert.match(reactPage, /result\.code === "ACCOUNT_NOT_FOUND"/);
  assert.match(
    reactPage,
    /saveShopCheckoutEmail\(email\);\s*navigate\("\/user-registration", \{ replace: true \}\)/,
  );
  assert.match(backend, /app\.post\("\/api\/public\/shop-customer"/);
  assert.match(backend, /LOWER\(user_email_address\)=LOWER\(\$1\)/);
  assert.match(backend, /code: "ACCOUNT_NOT_FOUND"/);
  assert.match(appRoutes, /path="\/user-registration"/);

  const addressDisplay = reactPage.match(
    /function AddressDisplay[\s\S]*?(?=export default function PublicCheckoutPage)/,
  )?.[0];
  assert.ok(addressDisplay, "Checkout includes a saved address display");
  assert.match(addressDisplay, /<p>\{name\}<\/p>/);
  assert.doesNotMatch(addressDisplay, /<input/);
});

test("public checkout registration uses PHP account fields and returns to checkout", async () => {
  const reactPage = await readFile(
    new URL(
      "../../frontend/src/pages/PublicUserRegistrationPage.jsx",
      import.meta.url,
    ),
    "utf8",
  );
  const phpPage = await readFile(
    new URL("../../../user_registration.php", import.meta.url),
    "utf8",
  );
  const backend = await readFile(
    new URL("../src/app.js", import.meta.url),
    "utf8",
  );
  const cartPage = await readFile(
    new URL("../../frontend/src/pages/PublicCartPage.jsx", import.meta.url),
    "utf8",
  );

  for (const field of [
    "user_email_address",
    "user_first_name",
    "user_last_name",
    "user_day_phone",
    "user_mobile_phone",
    "user_street_address",
    "user_shipping_email_address",
    "user_shipping_first_name",
    "user_shipping_last_name",
    "user_shipping_street_address",
    "user_shipping_postal_code",
  ]) {
    assert.ok(reactPage.includes(field), `Registration page includes ${field}`);
    assert.ok(phpPage.includes(field), `PHP registration includes ${field}`);
  }
  assert.match(reactPage, /\/api\/public\/shop-customer\/register/);
  assert.match(
    reactPage,
    /saveShopCheckoutEmail\(form\.user_email_address\.trim\(\)\)/,
  );
  assert.match(reactPage, /navigate\("\/checkout", \{ replace: true \}\)/);
  assert.doesNotMatch(reactPage, /\/checkout\?user_email_address=/);
  assert.match(reactPage, /searchParams\.get\("user_email_address"\)/);
  assert.match(reactPage, /document\.title = "User Registration \| Alpenwild"/);
  assert.match(reactPage, /fetch\("\/api\/public-static-pages"\)/);
  assert.match(reactPage, /Number\(page\.id\) === 1673/);
  assert.match(reactPage, /document\.title = title/);
  assert.match(reactPage, /\$form\.validationEngine\("attach"/);
  assert.match(
    reactPage,
    /\$\(event\.currentTarget\)\.validationEngine\("validate"\)/,
  );
  assert.match(
    reactPage,
    /data-validation-engine=\{required \? "validate\[required\]"/,
  );
  assert.equal(
    (
      reactPage.match(
        /<option value="UNITED STATES">UNITED STATES<\/option>/g,
      ) || []
    ).length,
    1,
  );
  assert.doesNotMatch(reactPage, /bookingCountries/);
  assert.match(reactPage, /function updateSameAsBilling\(checked\)/);
  assert.match(
    reactPage,
    /user_shipping_email_address: current\.user_email_address/,
  );
  assert.match(
    reactPage,
    /user_shipping_postal_code: current\.user_postal_code/,
  );
  assert.match(reactPage, /shippingFields\.map\(\(field\)/);
  assert.doesNotMatch(reactPage, /!sameAsBilling\s*&&\s*shippingFields/);
  assert.equal(
    (
      phpPage.match(/<option value="UNITED STATES">UNITED STATES<\/option>/g) ||
      []
    ).length,
    2,
  );
  assert.match(reactPage, /\["user_email_address", "Email Address", "email"\]/);
  assert.match(cartPage, /method="get"[\s\S]*action="\/checkout"/);
  assert.match(cartPage, /name="user_email_address"/);
  assert.doesNotMatch(reactPage, /Return to Cart|<Link/);
  assert.match(backend, /app\.post\("\/api\/public\/shop-customer\/register"/);
  assert.match(backend, /userSchema\.parse\(req\.body\)/);
});

test("shop checkout displays PHP order confirmation before payment", async () => {
  const checkoutPage = await readFile(
    new URL("../../frontend/src/pages/PublicCheckoutPage.jsx", import.meta.url),
    "utf8",
  );
  const confirmationPage = await readFile(
    new URL(
      "../../frontend/src/pages/PublicCheckoutConfirmPage.jsx",
      import.meta.url,
    ),
    "utf8",
  );
  const phpConfirmation = await readFile(
    new URL("../../../checkout_confirm.php", import.meta.url),
    "utf8",
  );
  const backend = await readFile(
    new URL("../src/app.js", import.meta.url),
    "utf8",
  );
  const appRoutes = await readFile(
    new URL("../../frontend/src/main.jsx", import.meta.url),
    "utf8",
  );

  for (const label of [
    "Confirm Checkout",
    "Products",
    "Quantity",
    "Unite Price",
    "Total",
    "Sub Total:",
    "Discount:",
    "Shipping:",
    "Pay Now",
    "Edit Order",
  ]) {
    assert.ok(
      confirmationPage.includes(label),
      `React confirmation has ${label}`,
    );
    assert.ok(phpConfirmation.includes(label), `PHP confirmation has ${label}`);
  }
  for (const className of [
    "headRow",
    "cartCell",
    "mHeight",
    "imgWrap",
    "cartQuan",
    "text-right",
    "btn btn-success",
  ]) {
    assert.ok(confirmationPage.includes(className));
    assert.ok(phpConfirmation.includes(className));
  }
  assert.match(checkoutPage, /setShopCheckoutDraft\(/);
  assert.match(checkoutPage, /navigate\("\/checkoutconfirm"\)/);
  assert.doesNotMatch(checkoutPage, /fetch\("\/api\/public\/shop-checkout"/);
  assert.match(confirmationPage, /fetch\("\/api\/public\/shop-checkout"/);
  assert.match(appRoutes, /path="\/checkoutconfirm"/);
  assert.match(
    confirmationPage,
    /document\.title = "Confirm Checkout \| Alpenwild"/,
  );
  assert.match(backend, /RETURNING \*/);
  assert.match(
    backend,
    /detail\.rows\[0\]\.order_detail_id \?\? detail\.rows\[0\]\.order_details_id/,
  );
});
