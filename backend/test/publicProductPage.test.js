import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("public product page uses PHP structure and exposes product enjoy boxes", async () => {
  const reactPage = await readFile(
    new URL(
      "../../frontend/src/pages/PublicProductPage.jsx",
      import.meta.url,
    ),
    "utf8",
  );
  const phpPage = await readFile(
    new URL("../../../product_details.php", import.meta.url),
    "utf8",
  );
  const phpScripts = await readFile(
    new URL("../../../js/sitejs12.js", import.meta.url),
    "utf8",
  );
  const phpCart = await readFile(
    new URL("../../../shopping_cart.php", import.meta.url),
    "utf8",
  );
  const backend = await readFile(
    new URL("../src/app.js", import.meta.url),
    "utf8",
  );
  const productRoute = backend.match(
    /app\.get\("\/api\/public-products\/:slug"[\s\S]*?\n\}\);/,
  )?.[0];

  for (const className of [
    "section",
    "container",
    "row clearfix prdctDetailBox",
    "col-md-5 col-sm-6 col-xs-12",
    "col-md-7 col-sm-6 col-xs-12 p-details",
    "visible-xs",
    "product-title-style hidden-xs",
    "prdctPic",
    "prdctThumb",
    "prdctDesc",
    "prdctId",
    "prdctPrice",
    "quan-block clearfix",
    "quan",
    "addto",
    "button-style",
    "col-md-12 col-sm-12 col-xs-12 prdctDesc description-style",
    "text-uppercase",
    "You May Also Enjoy",
    "col-md-3 col-sm-4 col-xs-12 gridCol",
    "trip_type clearfix",
    "trip_img",
    "trip_info",
  ]) {
    assert.ok(reactPage.includes(className), `React page uses ${className}`);
    assert.ok(phpPage.includes(className), `PHP page uses ${className}`);
  }
  assert.ok(productRoute, "public product route exists");
  assert.match(productRoute, /alpenwild_product_box_image_tbl/);
  assert.match(productRoute, /box_images:\s*boxes\.rows\.map/);
  assert.match(reactPage, /product\?\.box_images\?\.length > 0/);
  assert.match(phpPage, /action="shopping_cart\.php"/);
  assert.match(phpPage, /value="Add To cart" class="button-style"/);
  assert.doesNotMatch(phpPage, /View Cart/i);
  assert.doesNotMatch(reactPage, /View Cart/i);
  assert.match(phpCart, /if \(\$productshopping\['action'\] == 'add'\)/);
  assert.match(reactPage, /writeShopCart\(cart\);\s*setError\(""\);\s*navigate\("\/cart"\);/);
  assert.match(reactPage, /className="bx-wrapper"/);
  assert.match(reactPage, /className="bx-viewport"/);
  assert.match(reactPage, /border: "1px solid rgba\(50, 50, 50, \.07\)"/);
  assert.match(reactPage, /padding: "15px"/);
  assert.match(reactPage, /margin: "0 auto 15px"/);
  assert.match(reactPage, /textAlign: "center"/);
  assert.match(reactPage, /id="gal1"/);
  assert.match(reactPage, /flex: "0 0 94px"/);
  assert.match(reactPage, /<div\s+className="prdctThumb"\s+id="gal1"/);
  assert.match(reactPage, /<a\s+href="#"\s+key=\{image\.image_url\}/);
  assert.match(
    reactPage,
    /width:\s*`\$\{Math\.min\(gallery\.length, thumbnailCount\) \* 94\}px`/,
  );
  assert.match(reactPage, /\{gallery\.length > 1 && \(/);
  assert.match(reactPage, /className="bx-prev"/);
  assert.match(reactPage, /className="bx-next"/);
  assert.equal((reactPage.match(/transform: "translateY\(-50%\)"/g) || []).length, 2);
  assert.match(reactPage, /fa-angle-left/);
  assert.match(reactPage, /fa-angle-right/);
  assert.match(
    phpScripts,
    /bxSlider\(\{ moveSlides: 1, minSlides: 1, maxSlides: 10, slideWidth: 94, pager: !1/,
  );
  assert.match(reactPage, /const next = start \+ direction/);
});
