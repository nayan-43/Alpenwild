import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("legacy trip gallery inserts use an initialized generated ID sequence", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const identitySetup = app.match(
    /async function ensureLegacyTripGalleryIdentity\(\) \{[\s\S]*?\n\}/,
  )?.[0];
  const insertHelper = app.match(
    /async function insertTripGallery\(values\) \{[\s\S]*?\n\}/,
  )?.[0];
  const createRoute = app.match(
    /app\.post\(\s*"\/api\/trip-galleries"[\s\S]*?const result = await insertTripGallery\(\[([\s\S]*?)\]\);/,
  )?.[1];

  assert.ok(identitySetup, "trip gallery identity setup exists");
  assert.match(
    identitySetup,
    /await resetIdentitySequenceIfNeeded\(\s*"alpenwild_trips_gallery_tbl",\s*"trips_gallery_id",?\s*\)/,
  );
  assert.match(identitySetup, /if \(!useLegacyTrips\(\)\) return/);
  assert.match(
    identitySetup,
    /CREATE SEQUENCE IF NOT EXISTS alpenwild_trips_gallery_id_seq/,
  );
  assert.match(
    identitySetup,
    /ALTER SEQUENCE alpenwild_trips_gallery_id_seq OWNED BY alpenwild_trips_gallery_tbl\.trips_gallery_id/,
  );
  assert.match(
    identitySetup,
    /setval\(\$\$alpenwild_trips_gallery_id_seq\$\$, COALESCE\(\(SELECT MAX\(trips_gallery_id\) FROM alpenwild_trips_gallery_tbl\), 0\) \+ 1, false\)/,
  );
  assert.match(
    identitySetup,
    /ALTER TABLE alpenwild_trips_gallery_tbl ALTER COLUMN trips_gallery_id SET DEFAULT nextval\(\$\$alpenwild_trips_gallery_id_seq\$\$\)/,
  );
  assert.match(
    app,
    /await ensureLegacyTripIdentity\(\);\s*await ensureLegacyTripLeaderIdentity\(\);\s*await ensureLegacyTripLeaderDescriptionIdentity\(\);\s*await ensureLegacyTripGalleryIdentity\(\)/,
  );

  assert.ok(insertHelper, "trip gallery insert helper exists");
  assert.match(
    insertHelper,
    /INSERT INTO alpenwild_trips_gallery_tbl\s*\(trips_id, trips_gallery_image, youtube_video_url, trips_gallery_image_alt,\s*trips_gallery_order, display_in_static_page, display_in_trip_page, trips_gallery_status\)[\s\S]*?RETURNING trips_gallery_id/,
  );
  assert.match(
    insertHelper,
    /error\.code !== "23505" \|\|\s*error\.constraint !== "alpenwild_trips_gallery_tbl_pkey"/,
  );
  assert.match(
    insertHelper,
    /SELECT setval\(\$\$alpenwild_trips_gallery_id_seq\$\$/,
  );
  assert.match(
    insertHelper,
    /GREATEST\(COALESCE\(\(SELECT MAX\(trips_gallery_id\) FROM alpenwild_trips_gallery_tbl\), 0\) \+ 1, \(SELECT last_value FROM alpenwild_trips_gallery_id_seq\) \+ 1\), false\)/,
  );
  assert.match(insertHelper, /return query\(insertQuery, values\)/);
  assert.ok(createRoute, "trip gallery create route uses the insert helper");
});

test("trip gallery status changes show the PHP success alert", async () => {
  const phpClass = await readFile(
    new URL(
      "../../../includes/classes/trips_gallery_class.php",
      import.meta.url,
    ),
    "utf8",
  );
  const adminApp = await readFile(
    new URL("../../frontend/src/pages/AdminApp.jsx", import.meta.url),
    "utf8",
  );
  const toggle = adminApp.match(
    /async function toggleTripGallery\(item\) \{[\s\S]*?\n  \}/,
  )?.[0];

  assert.match(
    phpClass,
    /messagedisplay\('Gallery\\'s Status is updated successfully', 1\)/,
  );
  assert.ok(toggle, "trip gallery status handler exists");
  assert.match(
    toggle,
    /await load\(\);\s*setNotice\("Gallery's Status is updated successfully"\)/,
  );
});
