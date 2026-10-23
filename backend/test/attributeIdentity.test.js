import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("attribute type and value IDs are initialized and synchronized at startup", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const typeIdentity = app.match(
    /async function ensureLegacyAttributeTypeIdentity\(\) \{[\s\S]*?\n\}/,
  )?.[0];
  const valueIdentity = app.match(
    /async function ensureLegacyAttributeValueIdentity\(\) \{[\s\S]*?\n\}/,
  )?.[0];
  const typeCreate = app.match(
    /app\.post\("\/api\/attribute-types"[\s\S]*?\n\}\);/,
  )?.[0];
  const valueCreate = app.match(
    /app\.post\("\/api\/attribute-values"[\s\S]*?\n\}\);/,
  )?.[0];

  assert.ok(typeIdentity, "attribute type identity setup exists");
  assert.match(
    typeIdentity,
    /resetIdentitySequenceIfNeeded\(\s*"alpenwild_attribute_type_tbl",\s*"attribute_type_id",?\s*\)/,
  );
  assert.match(
    typeIdentity,
    /CREATE SEQUENCE IF NOT EXISTS alpenwild_attribute_type_id_seq/,
  );
  assert.match(
    typeIdentity,
    /setval\(\$\$alpenwild_attribute_type_id_seq\$\$, COALESCE\(\(SELECT MAX\(attribute_type_id\) FROM alpenwild_attribute_type_tbl\), 0\) \+ 1, false\)/,
  );
  assert.match(
    typeIdentity,
    /ALTER TABLE alpenwild_attribute_type_tbl ALTER COLUMN attribute_type_id SET DEFAULT nextval\(\$\$alpenwild_attribute_type_id_seq\$\$\)/,
  );

  assert.ok(valueIdentity, "attribute value identity setup exists");
  assert.match(
    valueIdentity,
    /resetIdentitySequenceIfNeeded\(\s*"alpenwild_attribute_value_tbl",\s*"attribute_value_id",?\s*\)/,
  );
  assert.match(
    valueIdentity,
    /CREATE SEQUENCE IF NOT EXISTS alpenwild_attribute_value_id_seq/,
  );
  assert.match(
    valueIdentity,
    /setval\(\$\$alpenwild_attribute_value_id_seq\$\$, COALESCE\(\(SELECT MAX\(attribute_value_id\) FROM alpenwild_attribute_value_tbl\), 0\) \+ 1, false\)/,
  );
  assert.match(
    valueIdentity,
    /ALTER TABLE alpenwild_attribute_value_tbl ALTER COLUMN attribute_value_id SET DEFAULT nextval\(\$\$alpenwild_attribute_value_id_seq\$\$\)/,
  );
  assert.match(
    app,
    /await ensureLegacyAttributeTypeIdentity\(\);\s*await ensureLegacyAttributeValueIdentity\(\)/,
  );

  assert.ok(typeCreate, "attribute type create route exists");
  assert.match(
    typeCreate,
    /INSERT INTO alpenwild_attribute_type_tbl \(attribute_type_name, attribute_type_status\)/,
  );
  assert.doesNotMatch(
    typeCreate,
    /INSERT INTO alpenwild_attribute_type_tbl\s*\([^)]*attribute_type_id/,
  );
  assert.ok(valueCreate, "attribute value create route exists");
  assert.match(
    valueCreate,
    /INSERT INTO \$\{storage\.table\}\s*\(\$\{storage\.type\}, \$\{storage\.name\}, \$\{storage\.order\}, \$\{storage\.status\}\)/,
  );
  assert.doesNotMatch(
    valueCreate,
    /INSERT INTO \$\{storage\.table\}\s*\([^)]*attribute_value_id/,
  );
});
