import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("public footer links preserve all PHP link-target choices", async () => {
  const [php, adminForm, route, footer] = await Promise.all([
    readFile(
      new URL(
        "../../../includes/classes/footer_menu_class.php",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../../frontend/src/pages/admin/footer-menu/AddFooterMenu.jsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../src/routes/admin/footerMenus.js", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../../frontend/src/components/public/PublicFooter.jsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  const targets = ["_self", "_blank", "_parent", "_top"];

  assert.match(php, /target="' \. \$row\[\$td\]\['footer_menu_link_target'\]/);
  for (const target of targets) {
    assert.ok(adminForm.includes(`value="${target}"`));
    assert.ok(route.includes(`"${target}"`));
  }
  assert.match(footer, /const target = item\.link_target \|\| "_self"/);
  const secureNewTabTarget =
    /target=\{target\}[\s\S]{0,100}rel=\{target === "_blank" \? "noopener noreferrer" : undefined\}/g;
  assert.equal([...footer.matchAll(secureNewTabTarget)].length, 2);
});
