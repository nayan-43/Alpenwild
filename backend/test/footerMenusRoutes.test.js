import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("footer menu routes are mounted behind API authorization middleware", async () => {
  const [app, apiAccess] = await Promise.all([
    readFile(new URL("../src/app.js", import.meta.url), "utf8"),
    readFile(new URL("../src/apiAccess.js", import.meta.url), "utf8"),
  ]);
  const routes = await readFile(
    new URL("../src/routes/admin/footerMenus.js", import.meta.url),
    "utf8",
  );
  const middlewareIndex = app.indexOf("createApiAccessMiddleware({");
  const mountIndex = app.indexOf("app.use(createFooterMenusRouter(");

  assert.ok(middlewareIndex >= 0);
  assert.ok(mountIndex > middlewareIndex);
  assert.match(apiAccess, /"\/footer-menus"/);
  assert.match(routes, /router\.get\("\/api\/footer-menus"/);
  assert.match(routes, /router\.post\("\/api\/footer-menus"/);
  assert.match(routes, /router\.patch\("\/api\/footer-menus\/:id"/);
  assert.match(routes, /router\.patch\("\/api\/footer-menus\/:id\/status"/);
  assert.match(routes, /router\.delete\("\/api\/footer-menus\/:id"/);
});

test("footer menu deletion shows the PHP success feedback", async () => {
  const [php, admin] = await Promise.all([
    readFile(
      new URL(
        "../../../includes/classes/footer_menu_class.php",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../../frontend/src/pages/admin/AdminApp.jsx", import.meta.url),
      "utf8",
    ),
  ]);
  const phpDelete = php.match(
    /function footer_menu_delete\([\s\S]*?\n\t\}/,
  )?.[0];
  const reactDelete = admin.match(
    /async function removeFooter\(item\) \{[\s\S]*?\n  \}/,
  )?.[0];

  assert.ok(phpDelete, "PHP footer delete handler exists");
  assert.ok(reactDelete, "React footer delete handler exists");
  assert.match(phpDelete, /Footer Menu details deleted successfully/);
  assert.match(
    reactDelete,
    /await load\(\);\s*setNotice\("Footer Menu details deleted successfully"\)/,
  );
});
