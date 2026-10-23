import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { slugifyCategoryName } from "../src/categorySlug.js";

test("category slugs follow the PHP title sanitizer for accents and punctuation", async () => {
  const phpFormatting = await readFile(
    new URL("../../../includes/formatting.php", import.meta.url),
    "utf8",
  );
  const backend = await readFile(
    new URL("../src/app.js", import.meta.url),
    "utf8",
  );

  assert.match(phpFormatting, /function sanitize_title_with_dashes/);
  assert.match(phpFormatting, /strip_tags\(remove_accents\(\$title\)\)/);
  assert.match(phpFormatting, /str_replace\('\.', '-', \$title\)/);
  assert.match(backend, /slugifyCategoryName\(parsedData\.name\)/);
  assert.equal(slugifyCategoryName("Crème Brûlée"), "creme-brulee");
  assert.equal(slugifyCategoryName("R&D"), "rd");
  assert.equal(slugifyCategoryName("日本"), "%e6%97%a5%e6%9c%ac");
  assert.equal(slugifyCategoryName("100%20"), "100%20");
});

test("category duplicate and delete feedback matches the PHP module", async () => {
  const phpForm = await readFile(
    new URL("../../../administrator/add_category.php", import.meta.url),
    "utf8",
  );
  const phpClass = await readFile(
    new URL("../../../includes/classes/category_class.php", import.meta.url),
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
  assert.match(
    phpClass,
    /Product existing under this category\. First delete product and then delete this category\./,
  );
  assert.match(
    backend,
    /Product existing under this category\. First delete product and then delete this category\./,
  );
  assert.match(phpClass, /Category details deleted successfully/);
  assert.match(admin, /setNotice\("Category details deleted successfully"\)/);
  assert.match(phpClass, /Static page\\'s Status is updated successfully/);
  assert.match(
    admin,
    /setNotice\("Static page's Status is updated successfully"\)/,
  );
});

test("category IDs are initialized and meta fields omit remaining-character text", async () => {
  const backend = await readFile(
    new URL("../src/app.js", import.meta.url),
    "utf8",
  );
  const form = await readFile(
    new URL(
      "../../frontend/src/pages/admin/category/AddCategoryPage.jsx",
      import.meta.url,
    ),
    "utf8",
  );
  const identitySetup = backend.match(
    /async function ensureLegacyCategoryIdentity\(\) \{[\s\S]*?\n\}/,
  )?.[0];
  const boxImageIdentitySetup = backend.match(
    /async function ensureLegacyCategoryBoxImageIdentity\(\) \{[\s\S]*?\n\}/,
  )?.[0];

  assert.ok(identitySetup, "category identity setup exists");
  assert.match(
    identitySetup,
    /resetIdentitySequenceIfNeeded\(\s*"alpenwild_category_tbl",\s*"category_id",?\s*\)/,
  );
  assert.match(
    identitySetup,
    /CREATE SEQUENCE IF NOT EXISTS alpenwild_category_id_seq/,
  );
  assert.match(
    identitySetup,
    /setval\(\$\$alpenwild_category_id_seq\$\$, COALESCE\(\(SELECT MAX\(category_id\) FROM alpenwild_category_tbl\), 0\) \+ 1, false\)/,
  );
  assert.match(
    identitySetup,
    /ALTER TABLE alpenwild_category_tbl ALTER COLUMN category_id SET DEFAULT nextval\(\$\$alpenwild_category_id_seq\$\$\)/,
  );
  assert.match(backend, /await ensureLegacyCategoryIdentity\(\)/);

  assert.ok(boxImageIdentitySetup, "category box-image identity setup exists");
  assert.match(
    boxImageIdentitySetup,
    /resetIdentitySequenceIfNeeded\(\s*"alpenwild_category_box_image_tbl",\s*"category_box_image_id",?\s*\)/,
  );
  assert.match(
    boxImageIdentitySetup,
    /CREATE SEQUENCE IF NOT EXISTS alpenwild_category_box_image_id_seq/,
  );
  assert.match(
    boxImageIdentitySetup,
    /setval\(\$\$alpenwild_category_box_image_id_seq\$\$, COALESCE\(\(SELECT MAX\(category_box_image_id\) FROM alpenwild_category_box_image_tbl\), 0\) \+ 1, false\)/,
  );
  assert.match(
    boxImageIdentitySetup,
    /ALTER TABLE alpenwild_category_box_image_tbl ALTER COLUMN category_box_image_id SET DEFAULT nextval\(\$\$alpenwild_category_box_image_id_seq\$\$\)/,
  );
  assert.match(
    backend,
    /await ensureLegacyCategoryIdentity\(\);\s*await ensureLegacyCategoryBoxImageIdentity\(\)/,
  );

  assert.doesNotMatch(form, /Remaining characters/i);
  assert.doesNotMatch(form, /characterCounts|setCharacterCounts/);
  assert.match(form, /key === "meta_title" \? 60 : undefined/);
  assert.match(form, /key === "meta_descriptions" \? 160 : undefined/);
});
