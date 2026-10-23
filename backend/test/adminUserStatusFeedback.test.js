import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("user status changes show the PHP success alert", async () => {
  const phpClass = await readFile(
    new URL("../../../includes/classes/user_class.php", import.meta.url),
    "utf8",
  );
  const adminApp = await readFile(
    new URL("../../frontend/src/pages/AdminApp.jsx", import.meta.url),
    "utf8",
  );
  const toggle = adminApp.match(
    /async function toggleUser\(item\) \{[\s\S]*?\n  \}/,
  )?.[0];

  assert.match(
    phpClass,
    /messagedisplay\('User\\'s Status is updated successfully', 1\)/,
  );
  assert.ok(toggle, "user status handler exists");
  assert.match(
    toggle,
    /await load\(\);\s*setNotice\("User's Status is updated successfully"\)/,
  );
  assert.match(adminApp, /notice && page !== "trips" && page !== "products"/);
});
