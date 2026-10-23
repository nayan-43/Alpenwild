import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("promotion status changes show the PHP success alert", async () => {
  const phpClass = await readFile(
    new URL(
      "../../../includes/classes/offers_promotions_class.php",
      import.meta.url,
    ),
    "utf8",
  );
  const adminApp = await readFile(
    new URL("../../frontend/src/pages/AdminApp.jsx", import.meta.url),
    "utf8",
  );
  const toggle = adminApp.match(
    /async function togglePromotion\(promotion\) \{[\s\S]*?\n  \}/,
  )?.[0];

  assert.match(
    phpClass,
    /messagedisplay\('Offers Promotions Status is updated successfully', 1\)/,
  );
  assert.ok(toggle, "promotion status handler exists");
  assert.match(
    toggle,
    /await load\(\);\s*setNotice\("Offers Promotions Status is updated successfully"\)/,
  );
  assert.match(adminApp, /notice && page !== "trips" && page !== "products"/);
});

test("special feature status changes show the PHP success alert", async () => {
  const phpClass = await readFile(
    new URL(
      "../../../includes/classes/special_feature_class.php",
      import.meta.url,
    ),
    "utf8",
  );
  const adminApp = await readFile(
    new URL("../../frontend/src/pages/AdminApp.jsx", import.meta.url),
    "utf8",
  );
  const toggle = adminApp.match(
    /async function toggleSpecialFeature\(feature\) \{[\s\S]*?\n  \}/,
  )?.[0];

  assert.match(
    phpClass,
    /messagedisplay\('Special Feature Status is updated successfully', 1\)/,
  );
  assert.ok(toggle, "special feature status handler exists");
  assert.match(
    toggle,
    /await load\(\);\s*setNotice\("Special Feature Status is updated successfully"\)/,
  );
});

test("footer menu status changes show the PHP success alert", async () => {
  const phpClass = await readFile(
    new URL("../../../includes/classes/footer_menu_class.php", import.meta.url),
    "utf8",
  );
  const adminApp = await readFile(
    new URL("../../frontend/src/pages/AdminApp.jsx", import.meta.url),
    "utf8",
  );
  const toggle = adminApp.match(
    /async function toggleFooter\(item\) \{[\s\S]*?\n  \}/,
  )?.[0];

  assert.match(
    phpClass,
    /messagedisplay\('Footer Menu\\'s Status is updated successfully', 1\)/,
  );
  assert.ok(toggle, "footer menu status handler exists");
  assert.match(
    toggle,
    /await load\(\);\s*setNotice\("Footer Menu's Status is updated successfully"\)/,
  );
});

test("promotion delete confirmation and success notice match PHP", async () => {
  const phpClass = await readFile(
    new URL(
      "../../../includes/classes/offers_promotions_class.php",
      import.meta.url,
    ),
    "utf8",
  );
  const phpFooter = await readFile(
    new URL("../../../administrator/includes/footer.php", import.meta.url),
    "utf8",
  );
  const adminApp = await readFile(
    new URL("../../frontend/src/pages/AdminApp.jsx", import.meta.url),
    "utf8",
  );
  const remove = adminApp.match(
    /async function removePromotion\(promotion\) \{[\s\S]*?\n  \}/,
  )?.[0];

  assert.ok(remove, "promotion delete handler exists");
  assert.match(
    phpFooter,
    /confirm\("Are you sure, you want to delete this " \+ cc \+ "\?"\)/,
  );
  assert.match(
    remove,
    /window\.confirm\(\s*"Are you sure, you want to delete this Offers Promotions\?"\s*,?\s*\)/,
  );
  assert.match(
    phpClass,
    /messagedisplay\('Inventory details deleted successfully', 1\)/,
  );
  assert.match(remove, /setNotice\("Inventory details deleted successfully"\)/);
});
