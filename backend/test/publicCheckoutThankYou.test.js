import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("successful shop checkout follows the PHP thank-you page redirect", async () => {
  const phpConfirmation = await readFile(
    new URL("../../../checkout_confirm.php", import.meta.url),
    "utf8",
  );
  const checkoutConfirmation = await readFile(
    new URL(
      "../../frontend/src/pages/PublicCheckoutConfirmPage.jsx",
      import.meta.url,
    ),
    "utf8",
  );
  const routes = await readFile(
    new URL("../../frontend/src/main.jsx", import.meta.url),
    "utf8",
  );
  const staticPage = await readFile(
    new URL("../../frontend/src/pages/PublicStaticPage.jsx", import.meta.url),
    "utf8",
  );
  const phpPage = await readFile(
    new URL("../../../page.php", import.meta.url),
    "utf8",
  );

  assert.match(phpConfirmation, /WHERE static_page_id=1675/);
  assert.match(
    phpConfirmation,
    /header\('Location: https:\/\/www\.alpenwild\.com\/staticpage\/' \. \$static_page_array_thankyou\[0\]\['static_page_slug'\] \. '\/'\)/,
  );
  assert.match(
    checkoutConfirmation,
    /navigate\("\/staticpage\/thank-you-for-order-for-maps-books\/"\)/,
  );
  assert.match(checkoutConfirmation, /clearShopCart\(\)/);
  assert.match(routes, /<Route path="\/staticpage\/:slug" element={<PublicStaticPage \/>} \/>/);
  assert.doesNotMatch(routes, /PublicShopThankYouPage|\/shop\/thank-you/);
  assert.match(phpPage, /<div class="section static_page">/);
  assert.match(staticPage, /<div className="section static_page">/);
  assert.match(staticPage, /className="col-md-12 col-sm-12 col-xs-12"/);
  assert.match(staticPage, /style=\{\{ margin: "0 0 20px 0" \}\}/);
  assert.match(staticPage, /style=\{\{ margin: "20px 0 0" \}\}/);
});
