import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("public category page follows PHP structure and classes", async () => {
  const reactPage = await readFile(
    new URL(
      "../../frontend/src/pages/PublicCategoryPage.jsx",
      import.meta.url,
    ),
    "utf8",
  );
  const phpPage = await readFile(
    new URL("../../../category_details.php", import.meta.url),
    "utf8",
  );

  for (const className of [
    "section",
    "container",
    "col-xs-12 title",
    "col-md-12 col-sm-12 col-xs-12",
    "row clearfix",
    "col-md-3 col-sm-4 col-xs-12",
    "prdctBox mHeight",
    "prdctImg",
    "prdctDetails",
    "prdctTitle",
    "prdctPrice",
    "btn btn-default",
    "You May Also Enjoy",
    "col-md-3 col-sm-4 col-xs-12 gridCol",
    "trip_type clearfix",
    "trip_img",
    "trip_info",
  ]) {
    assert.ok(reactPage.includes(className), `React page uses ${className}`);
    assert.ok(phpPage.includes(className), `PHP page uses ${className}`);
  }
  assert.match(reactPage, /category\?\.box_images\?\.length > 0/);
  assert.match(reactPage, /localAppLink\(box\.link\) \|\| box\.link \|\| "#"/);
  assert.match(
    reactPage,
    /Price \$\{Number\(product\.price \|\| 0\)\.toFixed\(2\)\}/,
  );
  assert.match(reactPage, /Sorry, no products found under this category\./);
});
