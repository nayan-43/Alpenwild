import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("trip leader columns map to sortable data and DataTables indicators do not block clicks", async () => {
  const page = await readFile(
    new URL(
      "../../frontend/src/pages/admin/trip-leader/ManageTripLeaderPage.jsx",
      import.meta.url,
    ),
    "utf8",
  );
  const table = await readFile(
    new URL("../../frontend/src/components/admin/ModuleTable.jsx", import.meta.url),
    "utf8",
  );
  const styles = await readFile(
    new URL("../../frontend/src/styles.css", import.meta.url),
    "utf8",
  );

  for (const key of [
    "id",
    "guide_name",
    "listing_image_url",
    "name",
    "meta_title",
    "meta_description",
    "display_order",
    "status",
  ]) {
    assert.ok(page.includes(`key: "${key}"`), `trip leader column sorts by ${key}`);
  }
  assert.match(table, /<th\s+key=\{column\.key\}\s+onClick=\{\(\) => updateSort\(column\.key\)\}/);
  assert.match(table, /<button\s+className="sort-button"\s+type="button"\s*>/);
  assert.match(table, /const sorted = useMemo/);
  assert.match(styles, /\.banner-panel \.module-admin-table\.dataTable thead th::after\s*\{\s*pointer-events:\s*none;/);
  assert.match(styles, /\.banner-panel \.module-admin-table thead th\.sorting,\s*\.banner-panel \.module-admin-table thead th\.sorting_asc,\s*\.banner-panel \.module-admin-table thead th\.sorting_desc\s*\{\s*cursor:\s*pointer;/);
});
