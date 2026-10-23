import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("successful callback submission navigates to the PHP confirmation page", async () => {
  const php = await readFile(
    new URL("../../../call_me_back.php", import.meta.url),
    "utf8",
  );
  const sql = await readFile(
    new URL("../../../alpenwi1_new_2016_postgresql.sql", import.meta.url),
    "utf8",
  );
  const header = await readFile(
    new URL(
      "../../frontend/src/components/public/PublicHeader.jsx",
      import.meta.url,
    ),
    "utf8",
  );
  const staticPage = await readFile(
    new URL("../../frontend/src/pages/PublicStaticPage.jsx", import.meta.url),
    "utf8",
  );

  assert.match(php, /static_page_display\([^;]*WHERE static_page_id=122/);
  assert.match(php, /static_page_description'\]\)\);[\s\S]*?if \(\$hasError\)/);
  assert.match(
    sql,
    /'Thank You for call me back request',\s*'Active',\s*'thank-you-for-call-me-back-request'/,
  );
  assert.match(
    header,
    /submitForm\(event,\s*submitCallbackForm,\s*\(\)\s*=>\s*\{\s*setModal\(""\);\s*navigate\(\s*"\/staticpage\/thank-you-for-call-me-back-request\/"\s*\);/,
  );
  assert.match(
    staticPage,
    /fetch\(`\/api\/public-static-pages\/\$\{encodeURIComponent\(slug\)\}`\)/,
  );
  assert.match(
    staticPage,
    /dangerouslySetInnerHTML=\{\{\s*__html:\s*localizeRichContent\(page\.description\)/,
  );
});
