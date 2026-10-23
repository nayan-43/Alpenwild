import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("static page updates treat blank legacy image alignment as no alignment", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");

  assert.match(
    app,
    /function normalizeStaticPageImageAlignment\(value\) \{\s*if \(typeof value !== "string" \|\| !value\.trim\(\)\) return "none";\s*return value\.trim\(\);/,
  );
  assert.match(
    app,
    /image_align: z\.preprocess\(\s*normalizeStaticPageImageAlignment,\s*z\.enum\(\["none", "left", "right", "center"\]\)/,
  );
  assert.match(
    app,
    /return result\.rows\.map\(\(row\) => \(\{\s*\.\.\.row,\s*image_align: normalizeStaticPageImageAlignment\(row\.image_align\)/,
  );
});

test("legacy static page description rows receive generated IDs before updates", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");

  assert.match(
    app,
    /async function ensureLegacyStaticPageDescriptionIdentity\(\) \{\s*if \(!useLegacyStaticPages\(\)\) return;/,
  );
  assert.match(
    app,
    /ALTER TABLE alpenwild_static_page_description_tbl ALTER COLUMN description_id SET DEFAULT nextval/,
  );
  assert.match(app, /await ensureLegacyStaticPageDescriptionIdentity\(\);/);
});

test("legacy static page inserts receive generated IDs", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");

  assert.match(
    app,
    /async function ensureLegacyStaticPageIdentity\(\) \{\s*if \(!useLegacyStaticPages\(\)\) return;/,
  );
  assert.match(
    app,
    /resetIdentitySequenceIfNeeded\(\s*"alpenwild_static_page_tbl",\s*"static_page_id"/,
  );
  assert.match(
    app,
    /CREATE SEQUENCE IF NOT EXISTS alpenwild_static_page_id_seq/,
  );
  assert.match(app, /MAX\(static_page_id\) FROM alpenwild_static_page_tbl/);
  assert.match(
    app,
    /ALTER TABLE alpenwild_static_page_tbl ALTER COLUMN static_page_id SET DEFAULT nextval/,
  );
  assert.match(app, /await ensureLegacyStaticPageIdentity\(\);/);
});

test("legacy static page box images receive generated IDs", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");

  assert.match(
    app,
    /async function ensureLegacyStaticPageBoxImageIdentity\(\) \{\s*if \(!useLegacyStaticPages\(\)\) return;/,
  );
  assert.match(
    app,
    /resetIdentitySequenceIfNeeded\(\s*"alpenwild_static_page_box_image_tbl",\s*"static_page_box_image_id"/,
  );
  assert.match(
    app,
    /CREATE SEQUENCE IF NOT EXISTS alpenwild_static_page_box_image_id_seq/,
  );
  assert.match(
    app,
    /MAX\(static_page_box_image_id\) FROM alpenwild_static_page_box_image_tbl/,
  );
  assert.match(
    app,
    /ALTER TABLE alpenwild_static_page_box_image_tbl ALTER COLUMN static_page_box_image_id SET DEFAULT nextval/,
  );
  assert.match(app, /await ensureLegacyStaticPageBoxImageIdentity\(\);/);
});

test("static page validation identifies invalid numeric fields", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const form = await readFile(
    new URL(
      "../../frontend/src/pages/admin/static-page/AddStaticPagePage.jsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.ok(app.includes('if (req.path.startsWith("/api/static-pages"))'));
  assert.ok(app.includes('field: issue.path.join(".")'));
  assert.ok(
    app.includes(
      'message: `${issue.path.join(".") || "static page"}: ${message}`',
    ),
  );
  assert.match(
    form,
    /key === "display_order"[\s\S]*?type=[\s\S]*?"number"[\s\S]*?step="1"/,
  );
  assert.match(form, /type="number"\s*step="1"\s*value=\{box\[key\] \?\? ""\}/);
  assert.match(
    form,
    /type="number"\s*step="1"\s*value=\{form\.display_order\}/,
  );
});
