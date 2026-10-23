import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("homepage trip style images use PHP-sized cropped thumbnails", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const homepage = await readFile(
    new URL("../../frontend/src/pages/PublicSite.jsx", import.meta.url),
    "utf8",
  );

  assert.match(
    app,
    /app\.get\(\s*"\/api\/trip-type-images\/listing\/:filename"[\s\S]*?\.resize\(370, 183, \{ fit: "cover", position: "centre" \}\)/,
  );
  assert.match(
    app,
    /listing_thumbnail_url:\s*row\.listing_image[\s\S]*?`\/api\/trip-type-images\/listing\/\$\{encodeURIComponent\(row\.listing_image\)\}`/,
  );
  assert.match(homepage, /item\.listing_thumbnail_url/);
});
