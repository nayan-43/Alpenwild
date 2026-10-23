import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("discount actions show PHP-matching alerts and scroll to the top", async () => {
  const phpForm = await readFile(
    new URL("../../../administrator/add_discount.php", import.meta.url),
    "utf8",
  );
  const phpClass = await readFile(
    new URL("../../../includes/classes/discount_class.php", import.meta.url),
    "utf8",
  );
  const adminApp = await readFile(
    new URL("../../frontend/src/pages/AdminApp.jsx", import.meta.url),
    "utf8",
  );
  const save = adminApp.match(
    /async function saveDiscount\(event\) \{[\s\S]*?\n  \}/,
  )?.[0];
  const toggle = adminApp.match(
    /async function toggleDiscount\(item\) \{[\s\S]*?\n  \}/,
  )?.[0];
  const remove = adminApp.match(
    /async function removeDiscount\(item\) \{[\s\S]*?\n  \}/,
  )?.[0];
  const navigate = adminApp.match(
    /function navigate\(pageName, path = pathForAdminPage\(pageName\)\) \{[\s\S]*?\n  \}/,
  )?.[0];

  assert.ok(save, "discount save handler exists");
  assert.match(
    phpForm,
    /"Discount added successfully\. Please enter another\.",\s*"Sorry, nothing is added\."/,
  );
  assert.match(
    phpForm,
    /"Discount updated successfully\.",\s*"Sorry, nothing is updated\."/,
  );
  assert.match(
    save,
    /unchanged\s*\?\s*result\.message\s*:\s*wasEditing\s*\?\s*"Discount updated successfully\."\s*:\s*"Discount added successfully\. Please enter another\."/,
  );

  assert.ok(toggle, "discount status handler exists");
  assert.match(
    phpClass,
    /messagedisplay\('Discount Status is updated successfully', 1\)/,
  );
  assert.match(
    toggle,
    /setNotice\("Discount Status is updated successfully"\)/,
  );
  assert.ok(remove, "discount delete handler exists");
  assert.match(
    phpClass,
    /messagedisplay\('Discount details deleted successfully', 1\)/,
  );
  assert.match(remove, /setNotice\("Discount details deleted successfully"\)/);

  assert.match(navigate, /pageName === "discounts" \|\|/);
  assert.match(navigate, /pageName === "addDiscount"/);
  assert.match(
    toggle,
    /await load\(\);[\s\S]*?setNotice\("Discount Status is updated successfully"\);[\s\S]*?scrollAdminListToTop\(\)/,
  );
  assert.match(
    remove,
    /await load\(\);[\s\S]*?setNotice\("Discount details deleted successfully"\);[\s\S]*?scrollAdminListToTop\(\)/,
  );
});
