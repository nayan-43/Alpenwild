import assert from "node:assert/strict";
import test from "node:test";
import { matchesAdminTableSearch } from "../../frontend/src/lib/adminTableSearch.js";

const columns = [
  { key: "id" },
  { key: "name" },
  { key: "image", searchable: false },
  { key: "dates", searchValue: (row) => row.dates.join(" ") },
];

const row = {
  id: 12,
  name: "Alpine Trek",
  image: "hidden-secret-image.jpg",
  dates: ["October 16, 2026"],
  internal_notes: "hidden customer information",
};

test("admin table search matches visible columns and ignores API-only fields", () => {
  assert.equal(matchesAdminTableSearch(row, columns, "alpine"), true);
  assert.equal(matchesAdminTableSearch(row, columns, "hidden customer"), false);
  assert.equal(
    matchesAdminTableSearch(row, columns, "hidden-secret-image"),
    false,
  );
});

test("admin table search uses rendered values for configured columns", () => {
  assert.equal(matchesAdminTableSearch(row, columns, "October 16"), true);
  assert.equal(matchesAdminTableSearch(row, columns, "   "), true);
});

test("explicit search keys further restrict a table's searchable columns", () => {
  assert.equal(
    matchesAdminTableSearch(row, columns, "12", ["name", "dates"]),
    false,
  );
  assert.equal(
    matchesAdminTableSearch(row, columns, "October", ["name", "dates"]),
    true,
  );
});
