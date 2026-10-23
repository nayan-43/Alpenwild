import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("public footer newsletter follows PHP ValidationEngine rules", async () => {
  const phpFooter = await readFile(
    new URL("../../../footer.php", import.meta.url),
    "utf8",
  );
  const reactFooter = await readFile(
    new URL(
      "../../frontend/src/components/public/PublicFooterExtras.jsx",
      import.meta.url,
    ),
    "utf8",
  );
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const publicNewsletterRoute = app.match(
    /app\.post\("\/api\/public\/mailing-list"[\s\S]*?\n\}\);/,
  )?.[0];

  assert.match(
    phpFooter,
    /name="first_name" data-validation-engine="validate\[required\]"/,
  );
  assert.match(
    phpFooter,
    /name="last_name" data-validation-engine="validate\[required\]"/,
  );
  assert.match(
    phpFooter,
    /name="email_address" data-validation-engine="validate\[required,custom\[email\]\]"/,
  );

  assert.match(
    reactFooter,
    /name="first_name"[\s\S]*?data-validation-engine="validate\[required\]"/,
  );
  assert.match(
    reactFooter,
    /name="last_name"[\s\S]*?data-validation-engine="validate\[required\]"/,
  );
  assert.match(
    reactFooter,
    /name="email_address"[\s\S]*?data-validation-engine="validate\[required,custom\[email\]\]"/,
  );
  assert.match(
    reactFooter,
    /\$form\.validationEngine\("attach", \{ promptPosition: "topLeft" \}\)/,
  );
  assert.match(reactFooter, /\$form\.validationEngine\("hideAll"\)/);
  assert.match(reactFooter, /\$form\.validationEngine\("detach"\)/);
  assert.match(reactFooter, /!?\$\(form\)\.validationEngine\("validate"\)/);
  assert.match(
    app,
    /const publicPostPaths = new Set\([\s\S]*?"\/public\/mailing-list"/,
  );
  assert.match(app, /"\/public\/callback"/);
  assert.ok(publicNewsletterRoute, "public newsletter endpoint exists");
  assert.match(
    publicNewsletterRoute,
    /verifyRecaptcha\(data\.recaptcha_token\)/,
  );
});

test("header and footer newsletter success follow PHP confirmation-page flow", async () => {
  const phpHandler = await readFile(
    new URL("../../../mailing_list.php", import.meta.url),
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
  const footer = await readFile(
    new URL(
      "../../frontend/src/components/public/PublicFooterExtras.jsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(
    phpHandler,
    /WHERE static_page_id=95[\s\S]*?\$_SESSION\['member_message'\]\s*=\s*wpautop\(repc\(\$static_page_array\[0\]\['static_page_description'\]\)\)/,
  );
  assert.match(
    sql,
    /'Thank you for subscribing',\s*'Active',\s*'thank-you-for-subscribing'/,
  );
  assert.match(
    header,
    /submitForm\(event,\s*submitNewsletterForm,\s*\(\)\s*=>\s*\{\s*setModal\(""\);\s*navigate\("\/staticpage\/thank-you-for-subscribing\/"\);/,
  );
  assert.match(
    footer,
    /await submitNewsletterForm\(form\);\s*form\.reset\(\);\s*window\.grecaptcha\?\.reset\?\.\(\);\s*setFormState\(\{ busy: false, message: "", error: "" \}\);\s*navigate\("\/staticpage\/thank-you-for-subscribing\/"\);\s*window\.scrollTo\(\{ top: 0, left: 0, behavior: "auto" \}\)/,
  );
});
