import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("unknown public routes render the dedicated not-found page", async () => {
  const routes = await readFile(
    new URL("../../frontend/src/main.jsx", import.meta.url),
    "utf8",
  );
  const page = await readFile(
    new URL(
      "../../frontend/src/pages/NotFound.jsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(routes, /<Route path="\/" element={<Site \/>} \/>/);
  assert.match(routes, /<Route path="\*" element={<NotFound \/>} \/>/);
  assert.match(page, /Page Not Found/);
  assert.match(page, /document\.title = "Page Not Found \| Alpenwild"/);
  assert.match(page, /Go to Home/);
  assert.match(page, /to="\/"/);
});
