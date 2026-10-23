import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("admin pages use the Alpenwild Admin document title", async () => {
  const adminApp = await readFile(
    new URL("../../frontend/src/pages/AdminApp.jsx", import.meta.url),
    "utf8",
  );

  assert.match(
    adminApp,
    /document\.title = authUser\s*\?\s*"Alpenwild \| Admin"\s*:\s*"Alpenwild \| Log in";/,
  );
});
