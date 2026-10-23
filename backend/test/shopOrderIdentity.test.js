import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("shop order IDs are initialized using the admin startup identity pattern", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const runner = await readFile(
    new URL("../src/migrate.js", import.meta.url),
    "utf8",
  );
  const identity = app.match(
    /async function ensureLegacyShopOrderIdentity\(\) \{[\s\S]*?\n\}/,
  )?.[0];

  for (const [table, idCandidates] of [
    ["alpenwild_order_tbl", ["order_id"]],
    ["alpenwild_order_details_tbl", ["order_detail_id", "order_details_id"]],
    [
      "alpenwild_order_attribute_details_tbl",
      ["order_attribute_detail_id", "order_attribute_details_id"],
    ],
  ]) {
    assert.ok(identity?.includes(table), `startup setup handles ${table}`);
    for (const id of idCandidates) {
      assert.ok(identity?.includes(id), `startup setup supports ${id}`);
    }
  }

  assert.match(identity, /CREATE SEQUENCE IF NOT EXISTS/);
  assert.match(identity, /SELECT setval/);
  assert.match(identity, /SELECT MAX/);
  assert.match(identity, /ALTER TABLE .* SET DEFAULT nextval/);
  assert.match(app, /await ensureLegacyShopOrderIdentity\(\)/);
  assert.match(runner, /if \(!existingOrderTables\.rows\[0\]\.exists\)/);
  assert.doesNotMatch(runner, /002_order_id_sequences/);
});

test("order view sorts details by the ID column present in the legacy schema", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const orderView = app.match(
    /app\.get\("\/api\/orders\/:id"[\s\S]*?\n\}\);/,
  )?.[0];

  assert.match(orderView, /information_schema\.columns/);
  assert.match(orderView, /"order_detail_id", "order_details_id"/);
  assert.match(orderView, /ORDER BY d\.\$\{orderDetailIdColumn\}/);
  assert.doesNotMatch(orderView, /ORDER BY d\.order_detail_id/);
  assert.match(
    orderView,
    /"order_attribute_detail_id", "order_attribute_details_id"/,
  );
  assert.match(orderView, /ORDER BY a\.\$\{orderAttributeDetailIdColumn\}/);
  assert.doesNotMatch(orderView, /ORDER BY a\.order_attribute_detail_id/);
});
