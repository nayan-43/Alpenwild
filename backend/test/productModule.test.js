import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { slugifyCategoryName } from "../src/categorySlug.js";

test("product create and edit regenerate PHP-compatible slugs from the name", async () => {
  const php = await readFile(
    new URL("../../../administrator/add_product.php", import.meta.url),
    "utf8",
  );
  const backend = await readFile(
    new URL("../src/app.js", import.meta.url),
    "utf8",
  );
  const productRoutes = backend.match(
    /app\.post\("\/api\/products"[\s\S]*?app\.delete\(\s*"\/api\/products\/:productId\/additional-images/,
  )?.[0];

  assert.ok(productRoutes, "product create and edit routes exist");
  assert.match(
    php,
    /\$product_slug\s*=\s*sanitize_title_with_dashes\(\$product_name\)/,
  );
  assert.equal(slugifyCategoryName("Crème Brûlée"), "creme-brulee");
  assert.equal(slugifyCategoryName("日本"), "%e6%97%a5%e6%9c%ac");
  assert.equal(
    [
      ...productRoutes.matchAll(
        /slug:\s*slugifyCategoryName\(req\.body\.name\)/g,
      ),
    ].length,
    2,
    "create and edit do not reuse a stale submitted slug",
  );
});

test("React product form and manage table retain the PHP product fields", async () => {
  const phpForm = await readFile(
    new URL("../../../administrator/add_product.php", import.meta.url),
    "utf8",
  );
  const reactForm = await readFile(
    new URL(
      "../../frontend/src/pages/admin/product/AddProductPage.jsx",
      import.meta.url,
    ),
    "utf8",
  );
  const phpManage = await readFile(
    new URL("../../../administrator/manage_product.php", import.meta.url),
    "utf8",
  );
  const reactManage = await readFile(
    new URL(
      "../../frontend/src/pages/admin/product/ManageProductPage.jsx",
      import.meta.url,
    ),
    "utf8",
  );
  const adminApp = await readFile(
    new URL("../../frontend/src/pages/AdminApp.jsx", import.meta.url),
    "utf8",
  );

  for (const field of [
    "product_name",
    "category_id",
    "product_menu_name",
    "product_meta_title",
    "product_meta_descriptions",
    "product_meta_keywords",
    "product_short_descriptions",
    "product_description",
    "product_price",
    "product_banner_alt",
    "product_listing_image_alt",
    "files[]",
    "product_order",
    "product_box_image_image_alt",
  ]) {
    assert.ok(phpForm.includes(field), `PHP form contains ${field}`);
  }
  for (const field of [
    '"name"',
    '"category_id"',
    '"menu_name"',
    '"meta_title"',
    '"meta_descriptions"',
    '"meta_keywords"',
    '"short_descriptions"',
    '"description"',
    '"price"',
    '"banner_alt"',
    '"listing_image_alt"',
    '"additional_images"',
    '"display_order"',
    '"image_alt"',
  ]) {
    assert.ok(reactForm.includes(field), `React form contains ${field}`);
  }
  assert.match(phpManage, /<th>Price Details<\/th>/);
  assert.match(reactManage, /label:\s*"Price Details"/);
  assert.match(
    adminApp,
    /editSnapshots\.current\.set\(\s*`products:\$\{item\.id\}`,\s*serializeComparableForm\(values\)/,
  );
  assert.match(
    adminApp,
    /route\.module === "products" && editingProductId !== id/,
  );
  assert.match(
    adminApp,
    /page === "products" && \(\s*<ManageProductPage[\s\S]*?notice=\{notice\}[\s\S]*?onDismissNotice=\{\(\) => setNotice\(""\)\}/,
  );
});

test("product duplicate and delete feedback follows PHP", async () => {
  const phpClass = await readFile(
    new URL("../../../includes/classes/product_class.php", import.meta.url),
    "utf8",
  );
  const phpForm = await readFile(
    new URL("../../../administrator/add_product.php", import.meta.url),
    "utf8",
  );
  const backend = await readFile(
    new URL("../src/app.js", import.meta.url),
    "utf8",
  );
  const admin = await readFile(
    new URL("../../frontend/src/pages/AdminApp.jsx", import.meta.url),
    "utf8",
  );

  assert.match(
    phpForm,
    /Sorry, name is already added\. Please use another name\./,
  );
  assert.match(
    backend,
    /Sorry, name is already added\. Please use another name\./,
  );
  for (const message of [
    "Order existing under this product. First delete order and then delete this product.",
    "Product details deleted successfully",
    "Nothing is deleted successfully",
  ]) {
    assert.ok(phpClass.includes(message), `PHP has ${message}`);
  }
  assert.ok(
    backend.includes(
      "Order existing under this product. First delete order and then delete this product.",
    ),
    "API blocks deleting products referenced by orders",
  );
  assert.match(admin, /setNotice\("Product details deleted successfully"\)/);
  assert.match(admin, /Product's Status is updated successfully/);
});

test("product inserts initialize parent and image IDs and unchanged edits show warning", async () => {
  const backend = await readFile(
    new URL("../src/app.js", import.meta.url),
    "utf8",
  );
  const admin = await readFile(
    new URL("../../frontend/src/pages/AdminApp.jsx", import.meta.url),
    "utf8",
  );
  const phpForm = await readFile(
    new URL("../../../administrator/add_product.php", import.meta.url),
    "utf8",
  );
  const identitySetups = [
    [
      "ensureLegacyProductIdentity",
      "alpenwild_product_tbl",
      "product_id",
      "alpenwild_product_id_seq",
    ],
    [
      "ensureLegacyProductAdditionalImageIdentity",
      "alpenwild_product_additional_image_tbl",
      "product_additional_image_id",
      "alpenwild_product_additional_image_id_seq",
    ],
    [
      "ensureLegacyProductBoxImageIdentity",
      "alpenwild_product_box_image_tbl",
      "product_box_image_id",
      "alpenwild_product_box_image_id_seq",
    ],
  ];

  for (const [functionName, table, column, sequence] of identitySetups) {
    const setup = backend.match(
      new RegExp(`async function ${functionName}\\(\\) \\{[\\s\\S]*?\\n\\}`),
    )?.[0];
    assert.ok(setup, `${functionName} exists`);
    assert.match(
      setup,
      new RegExp(
        `resetIdentitySequenceIfNeeded\\(\\s*"${table}",\\s*"${column}"`,
      ),
    );
    assert.match(
      setup,
      new RegExp(`CREATE SEQUENCE IF NOT EXISTS ${sequence}`),
    );
    assert.match(setup, new RegExp(`MAX\\(${column}\\) FROM ${table}`));
    assert.match(
      setup,
      new RegExp(
        `ALTER TABLE ${table} ALTER COLUMN ${column} SET DEFAULT nextval`,
      ),
    );
    assert.match(backend, new RegExp(`await ${functionName}\\(\\)`));
  }

  const save = admin.match(
    /async function saveProduct\(event\) \{[\s\S]*?\n  \}/,
  )?.[0];
  assert.match(phpForm, /"Sorry, nothing is updated\."/);
  assert.ok(save, "product save handler exists");
  assert.match(
    save,
    /showUnchangedEdit\("products", editingProductId, productForm\)/,
  );
  assert.match(
    admin,
    /function showUnchangedEdit\(module, id, values\)[\s\S]*?navigate\(module\);\s*setNotice\("Sorry, nothing is updated\."\)/,
  );
  assert.match(
    admin,
    /page === "products" && \(\s*<ManageProductPage[\s\S]*?notice=\{notice\}[\s\S]*?onDismissNotice=\{\(\) => setNotice\(""\)\}/,
  );
});
