import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("public routes and admin screens are loaded on demand", async () => {
  const main = await readFile(
    new URL("../../frontend/src/main.jsx", import.meta.url),
    "utf8",
  );
  const admin = await readFile(
    new URL("../../frontend/src/pages/admin/AdminApp.jsx", import.meta.url),
    "utf8",
  );

  assert.match(main, /<Suspense fallback=\{null\}>/);
  assert.match(
    main,
    /React\.lazy\(\(\) => import\("\.\/pages\/admin\/AdminApp"\)\)/,
  );
  assert.match(
    main,
    /React\.lazy\(\(\) => import\("\.\/pages\/Product"\)\)/,
  );
  assert.doesNotMatch(main, /import AdminApp from/);
  assert.doesNotMatch(main, /import Product from/);
  assert.match(
    admin,
    /React\.lazy\([\s\S]*?import\("\.\/product\/AddProduct"\)/,
  );
  assert.doesNotMatch(admin, /import AddProduct from/);
});
