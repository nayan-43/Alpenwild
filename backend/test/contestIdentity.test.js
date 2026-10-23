import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("legacy contests receive generated IDs before inserts", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");

  assert.match(app, /async function ensureLegacyContestIdentity\(\) \{/);
  assert.match(
    app,
    /resetIdentitySequenceIfNeeded\("alpenwild_contest_tbl", "id"\)/,
  );
  assert.match(app, /CREATE SEQUENCE IF NOT EXISTS alpenwild_contest_id_seq/);
  assert.match(app, /MAX\(id\) FROM alpenwild_contest_tbl\), 0\) \+ 1, false/);
  assert.match(
    app,
    /ALTER TABLE alpenwild_contest_tbl ALTER COLUMN id SET DEFAULT nextval/,
  );
  assert.match(app, /await ensureLegacyContestIdentity\(\);/);
});
