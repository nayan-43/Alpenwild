import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("date handling uses null values instead of zero-date sentinels", async () => {
  const [app, adminApp, tripSection] = await Promise.all([
    readFile(new URL("../src/app.js", import.meta.url), "utf8"),
    readFile(
      new URL("../../frontend/src/pages/AdminApp.jsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../../frontend/src/pages/admin/trip/TripSectionPage.jsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(
    app,
    /function validDateOrNull\(value\) \{\s*if \(!value\) return null;\s*const text = String\(value\)\.slice\(0, 10\);\s*return isValidIsoDate\(text\) \? text : null;/,
  );
  assert.match(app, /const bookingStart = row\.booking_start_date \?\? null;/);
  assert.match(app, /const bookingEnd = row\.booking_end_date \?\? null;/);
  assert.match(
    adminApp,
    /function dateInputValue\(value\) \{\s*if \(value == null \|\| value === ""\) return "";/,
  );
  assert.doesNotMatch(
    `${app}\n${adminApp}\n${tripSection}`,
    /0000-00-00|startsWith\(["']0000/,
  );
});

test("new users and trip leaders are created with today's date", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const userInsert = app.match(
    /function userInsert\(data\) \{[\s\S]*?\n\}/,
  )?.[0];
  const tripLeaderCreate = app.match(
    /app\.post\(\s*"\/api\/trip-leaders"[\s\S]*?\n\}\);/,
  )?.[0];

  assert.ok(userInsert, "user insert helper exists");
  assert.match(userInsert, /user_creation_date\)[\s\S]*?CURRENT_DATE/);
  assert.match(userInsert, /"creation_date"[\s\S]*?CURRENT_DATE/);
  assert.ok(tripLeaderCreate, "trip leader creation route exists");
  assert.match(
    tripLeaderCreate,
    /trip_leader_created_at\)[\s\S]*?CURRENT_DATE/,
  );
});
