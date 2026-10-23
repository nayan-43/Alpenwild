import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Manage Contest dates use the same raw timestamp format as PHP", async () => {
  const phpAjax = await readFile(
    new URL("../../../administrator/ajax/contest.php", import.meta.url),
    "utf8",
  );
  const react = await readFile(
    new URL(
      "../../frontend/src/pages/admin/contest/ContestModulePage.jsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(phpAjax, /\$row\[\]\s*=\s*\$aRow\[\$j\]\[\$i\]/);
  assert.match(
    react,
    /function displayContestDate\(value\) \{\s*if \(!value\) return "—";\s*const timestamp = value instanceof Date \? value\.toISOString\(\) : String\(value\);\s*return timestamp\.slice\(0, 19\)\.replace\("T", " "\);/,
  );
  assert.match(
    react,
    /label: "Start Date",\s*key: "contest_start_date",\s*render: \(item\) => displayContestDate\(item\.contest_start_date\)/,
  );
  assert.match(
    react,
    /label: "End Date",\s*key: "contest_end_date",\s*render: \(item\) => displayContestDate\(item\.contest_end_date\)/,
  );
});
