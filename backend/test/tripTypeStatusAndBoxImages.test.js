import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("trip type status changes show the PHP success alert", async () => {
  const phpClass = await readFile(
    new URL("../../../includes/classes/trip_type_class.php", import.meta.url),
    "utf8",
  );
  const adminApp = await readFile(
    new URL("../../frontend/src/pages/AdminApp.jsx", import.meta.url),
    "utf8",
  );
  const toggle = adminApp.match(
    /async function toggleTripType\(item\) \{[\s\S]*?\n  \}/,
  )?.[0];

  assert.match(
    phpClass,
    /messagedisplay\('Trip Type\\'s Status is updated successfully', 1\)/,
  );
  assert.ok(toggle, "trip type status handler exists");
  assert.match(
    toggle,
    /await load\(\);\s*setNotice\("Trip Type's Status is updated successfully"\)/,
  );
});

test("legacy trip type box image inserts use a repaired generated ID sequence", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const identitySetup = app.match(
    /async function ensureLegacyTripTypeBoxImageIdentity\(\) \{[\s\S]*?\n\}/,
  )?.[0];
  const identityReset = app.match(
    /async function resetIdentitySequenceIfNeeded\(table, column\) \{[\s\S]*?\n\}/,
  )?.[0];
  const createBoxImages = app.match(
    /async function addTripTypeBoxImages\([\s\S]*?\n\}/,
  )?.[0];
  const updateBoxImages = app.match(
    /async function saveTripTypeBoxImages\([\s\S]*?\n\}/,
  )?.[0];

  assert.ok(identitySetup, "legacy box-image identity setup exists");
  assert.ok(identityReset, "identity-column sequence reset helper exists");
  assert.match(identityReset, /information_schema\.columns/);
  assert.match(identityReset, /is_identity !== "YES"/);
  assert.match(identityReset, /pg_get_serial_sequence/);
  assert.match(
    identitySetup,
    /await resetIdentitySequenceIfNeeded\(\s*"alpenwild_trip_type_box_image_tbl",\s*"trip_type_box_image_id",?\s*\)/,
  );
  assert.match(identitySetup, /CREATE SEQUENCE IF NOT EXISTS/);
  assert.match(
    identitySetup,
    /ALTER SEQUENCE alpenwild_trip_type_box_image_id_seq OWNED BY alpenwild_trip_type_box_image_tbl\.trip_type_box_image_id/,
  );
  assert.match(
    identitySetup,
    /setval\(\$\$alpenwild_trip_type_box_image_id_seq\$\$, COALESCE\(\(SELECT MAX\(trip_type_box_image_id\) FROM alpenwild_trip_type_box_image_tbl\), 0\) \+ 1, false\)/,
  );
  assert.match(
    identitySetup,
    /ALTER TABLE alpenwild_trip_type_box_image_tbl ALTER COLUMN trip_type_box_image_id SET DEFAULT nextval\(\$\$alpenwild_trip_type_box_image_id_seq\$\$\)/,
  );
  assert.match(
    app,
    /await ensureLegacyTripTypeIdentity\(\);\s*await ensureLegacyTripTypeBoxImageIdentity\(\)/,
  );

  assert.ok(createBoxImages, "trip type create box-image handler exists");
  assert.match(
    createBoxImages,
    /INSERT INTO alpenwild_trip_type_box_image_tbl\s*\(trip_type_id, trip_type_box_image, trip_type_box_image_alt,\s*trip_type_box_image_title, trip_type_box_image_link\)/,
  );
  assert.doesNotMatch(
    createBoxImages,
    /INSERT INTO alpenwild_trip_type_box_image_tbl\s*\([^)]*trip_type_box_image_id/,
  );

  assert.ok(updateBoxImages, "trip type edit box-image handler exists");
  assert.match(
    updateBoxImages,
    /INSERT INTO alpenwild_trip_type_box_image_tbl\s*\(trip_type_id, trip_type_box_image, trip_type_box_image_alt,\s*trip_type_box_image_title, trip_type_box_image_link\)/,
  );
  assert.doesNotMatch(
    updateBoxImages,
    /INSERT INTO alpenwild_trip_type_box_image_tbl\s*\([^)]*trip_type_box_image_id/,
  );
});
