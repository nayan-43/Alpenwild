import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("admin layout keeps its header sticky and renders configured PHP footer text", async () => {
  const [phpFooter, adminLayout, styles] = await Promise.all([
    readFile(
      new URL("../../../administrator/includes/footer.php", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../../frontend/src/components/admin/AdminLayout.jsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../../frontend/src/styles.css", import.meta.url), "utf8"),
  ]);

  assert.match(phpFooter, /<footer class="main-footer">[\s\S]*?Copyright_Text/);
  assert.match(adminLayout, /api\("\/api\/settings"\)/);
  assert.match(adminLayout, /settings\.copyright_text/);
  assert.match(adminLayout, /<footer className="admin-footer">/);
  assert.match(
    styles,
    /\.app-shell a:focus,[\s\S]*?\.app-shell button:focus-visible\s*\{[^}]*outline: none !important;[^}]*box-shadow: none !important;/,
  );
  assert.doesNotMatch(styles, /\.admin-content a:focus/);
  assert.match(styles, /\.topbar\s*\{[^}]*position: sticky;[^}]*top: 0;/s);
  assert.match(
    styles,
    /\.admin-footer\s*\{[^}]*border-top: 1px solid #d2d6de;/s,
  );
});
