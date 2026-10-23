import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("admin order details display products after the detail request loads", async () => {
  const [backend, orderDetailPage, adminApp, styles] = await Promise.all([
    readFile(new URL("../src/app.js", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../../frontend/src/pages/admin/order/OrderDetailPage.jsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../../frontend/src/pages/AdminApp.jsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../../frontend/src/styles.css", import.meta.url), "utf8"),
  ]);
  const orderView = backend.match(
    /app\.get\("\/api\/orders\/:id"[\s\S]*?\n\}\);/,
  )?.[0];

  assert.match(orderView, /p\.product_name/);
  assert.match(
    orderDetailPage,
    /order\.items[\s\S]*?<div>\{item\.product_name\}<\/div>/,
  );
  assert.match(
    adminApp,
    /setOrderDetailLoading\(true\);[\s\S]*?api\(`\/api\/orders\/\$\{orderId\}`\)[\s\S]*?setOrderDetailLoading\(false\)/,
  );
  assert.match(
    orderDetailPage,
    /if \(isLoading\)[\s\S]*?module-table-panel[\s\S]*?admin-loading-box-body[\s\S]*?admin-full-page-loader[\s\S]*?role="status"[\s\S]*?Loading order details/,
  );
  assert.match(styles, /\.module-table-panel \.admin-full-page-loader\s*\{/);
  assert.doesNotMatch(styles, /\.order-detail-loading/);
});
