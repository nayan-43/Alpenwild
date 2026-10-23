import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("invoice creation has a generated primary-key sequence initialized at startup", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const identitySetup = app.match(
    /async function ensureInvoiceIdentity\(\) \{[\s\S]*?\n\}/,
  )?.[0];
  const insertRoute = app.match(
    /app\.post\("\/api\/invoices"[\s\S]*?\n\}\);/,
  )?.[0];

  assert.ok(identitySetup, "invoice identity setup exists");
  assert.match(
    identitySetup,
    /resetIdentitySequenceIfNeeded\(\s*"alpenwild_invoice_tbl",\s*"invoice_id",?\s*\)/,
  );
  assert.match(
    identitySetup,
    /CREATE SEQUENCE IF NOT EXISTS alpenwild_invoice_id_seq/,
  );
  assert.match(
    identitySetup,
    /ALTER SEQUENCE alpenwild_invoice_id_seq OWNED BY alpenwild_invoice_tbl\.invoice_id/,
  );
  assert.match(
    identitySetup,
    /setval\(\$\$alpenwild_invoice_id_seq\$\$, COALESCE\(\(SELECT MAX\(invoice_id\) FROM alpenwild_invoice_tbl\), 0\) \+ 1, false\)/,
  );
  assert.match(
    identitySetup,
    /ALTER TABLE alpenwild_invoice_tbl ALTER COLUMN invoice_id SET DEFAULT nextval\(\$\$alpenwild_invoice_id_seq\$\$\)/,
  );
  assert.match(app, /await ensureInvoiceIdentity\(\)/);

  assert.ok(insertRoute, "invoice create route exists");
  assert.match(
    insertRoute,
    /SELECT nextval\(COALESCE\(pg_get_serial_sequence\(\$\$alpenwild_invoice_tbl\$\$, \$\$invoice_id\$\$\), \$\$alpenwild_invoice_id_seq\$\$\)::regclass\) AS invoice_id/,
  );
  assert.match(
    insertRoute,
    /INSERT INTO alpenwild_invoice_tbl\s*\(\s*invoice_id,first_name,last_name,user_email_address/,
  );
  assert.match(insertRoute, /OVERRIDING SYSTEM VALUE/);
  assert.match(
    insertRoute,
    /\[invoiceId\.rows\[0\]\.invoice_id,\s*\.\.\.invoiceValues\(data\)\]/,
  );
});
