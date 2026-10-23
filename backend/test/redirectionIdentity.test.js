import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("legacy redirections receive generated IDs before inserts", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");

  assert.match(
    app,
    /async function ensureLegacyRedirectionIdentity\(\) \{\s*if \(!useLegacyRedirections\(\)\) return;/,
  );
  assert.match(
    app,
    /resetIdentitySequenceIfNeeded\(\s*"alpenwild_redirection_tbl",\s*"redirection_id"/,
  );
  assert.match(
    app,
    /CREATE SEQUENCE IF NOT EXISTS alpenwild_redirection_id_seq/,
  );
  assert.match(
    app,
    /MAX\(redirection_id\) FROM alpenwild_redirection_tbl\), 0\) \+ 1, false/,
  );
  assert.match(
    app,
    /ALTER TABLE alpenwild_redirection_tbl ALTER COLUMN redirection_id SET DEFAULT nextval/,
  );
  assert.match(app, /await ensureLegacyRedirectionIdentity\(\);/);
});
