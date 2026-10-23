import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("trip leader IDs receive a sequence default synchronized to existing rows", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const identitySetup = app.match(
    /async function ensureLegacyTripLeaderIdentity\(\) \{[\s\S]*?\n\}/,
  )?.[0];

  assert.ok(identitySetup, "trip-leader identity setup exists");
  assert.match(identitySetup, /if \(!useLegacyTripLeaders\(\)\) return;/);
  assert.match(
    identitySetup,
    /CREATE SEQUENCE IF NOT EXISTS alpenwild_trip_leader_id_seq/,
  );
  assert.match(
    identitySetup,
    /ALTER SEQUENCE alpenwild_trip_leader_id_seq OWNED BY alpenwild_trip_leader_tbl\.trip_leader_id/,
  );
  assert.match(
    identitySetup,
    /setval\(\$\$alpenwild_trip_leader_id_seq\$\$, COALESCE\(\(SELECT MAX\(trip_leader_id\) FROM alpenwild_trip_leader_tbl\), 0\) \+ 1, false\)/,
  );
  assert.match(
    identitySetup,
    /ALTER TABLE alpenwild_trip_leader_tbl ALTER COLUMN trip_leader_id SET DEFAULT nextval\(\$\$alpenwild_trip_leader_id_seq\$\$\)/,
  );
  assert.match(
    app,
    /await ensureLegacyTripIdentity\(\);\s*await ensureLegacyTripLeaderIdentity\(\);/,
  );
});

test("trip leader description IDs receive a synchronized sequence default", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const identitySetup = app.match(
    /async function ensureLegacyTripLeaderDescriptionIdentity\(\) \{[\s\S]*?\n\}/,
  )?.[0];

  assert.ok(identitySetup, "trip-leader description identity setup exists");
  assert.match(identitySetup, /if \(!useLegacyTripLeaders\(\)\) return;/);
  assert.match(
    identitySetup,
    /CREATE SEQUENCE IF NOT EXISTS alpenwild_trip_leader_description_id_seq/,
  );
  assert.match(
    identitySetup,
    /ALTER SEQUENCE alpenwild_trip_leader_description_id_seq OWNED BY alpenwild_trip_leader_description_tbl\.description_id/,
  );
  assert.match(
    identitySetup,
    /setval\(\$\$alpenwild_trip_leader_description_id_seq\$\$, COALESCE\(\(SELECT MAX\(description_id\) FROM alpenwild_trip_leader_description_tbl\), 0\) \+ 1, false\)/,
  );
  assert.match(
    identitySetup,
    /ALTER TABLE alpenwild_trip_leader_description_tbl ALTER COLUMN description_id SET DEFAULT nextval\(\$\$alpenwild_trip_leader_description_id_seq\$\$\)/,
  );
  assert.match(
    app,
    /await ensureLegacyTripLeaderIdentity\(\);\s*await ensureLegacyTripLeaderDescriptionIdentity\(\);/,
  );
});
