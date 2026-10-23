import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("invoice delete shows the PHP success message after deleting", async () => {
  const phpClass = await readFile(
    new URL("../../../includes/classes/invoice_class.php", import.meta.url),
    "utf8",
  );
  const adminApp = await readFile(
    new URL("../../frontend/src/pages/AdminApp.jsx", import.meta.url),
    "utf8",
  );
  const remove = adminApp.match(
    /async function removeInvoice\(item\) \{[\s\S]*?\n  \}/,
  )?.[0];

  assert.match(
    phpClass,
    /messagedisplay\('invoice details deleted successfully', 1\)/,
  );
  assert.ok(remove, "invoice delete handler exists");
  assert.match(
    remove,
    /await api\(`\/api\/invoices\/\$\{item\.id\}`,\s*\{ method: "DELETE" \}\);\s*await load\(\);\s*setNotice\("invoice details deleted successfully"\);\s*scrollAdminListToTop\(\)/,
  );
});
