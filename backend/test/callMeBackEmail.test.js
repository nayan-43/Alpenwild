import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildCallMeBackEmailHtml } from "../src/callMeBackEmail.js";

test("call-me-back email matches the PHP nested table structure and field order", async () => {
  const php = await readFile(
    new URL("../../../call_me_back.php", import.meta.url),
    "utf8",
  );
  const html = buildCallMeBackEmailHtml({
    name: "Casey",
    email: "casey@example.com",
    phone_number: "555-0100",
    best_time: "Afternoons",
    question_comments: "Please call about the trip.",
  });

  assert.match(
    php,
    /<table border='0' cellpadding='6' width='600' align='center'>/,
  );
  assert.match(
    html,
    /<table border='0' cellpadding='6' width='600' align='center'>/,
  );
  assert.match(
    php,
    /<table width='100%' border='0' cellspacing='0' cellpadding='0'>/,
  );
  assert.match(
    html,
    /<table width='100%' border='0' cellspacing='0' cellpadding='0'>/,
  );
  assert.match(
    php,
    /<table width='100%' border='0' cellspacing='2' cellpadding='1'>/,
  );
  assert.match(
    html,
    /<table width='100%' border='0' cellspacing='2' cellpadding='1'>/,
  );
  assert.match(html, /<h3>Call Me Back<\/h3>/);

  const labels = [
    "First Name",
    "Email",
    "Phone Number",
    "Best Time to Call",
    "Questions or Comments",
  ];
  let previousPhpIndex = -1;
  let previousHtmlIndex = -1;
  for (const label of labels) {
    const phpIndex = php.indexOf(`>${label}</td>`);
    const htmlIndex = html.indexOf(`>${label}</td>`);
    assert.ok(phpIndex > previousPhpIndex, `${label} is ordered in PHP`);
    assert.ok(
      htmlIndex > previousHtmlIndex,
      `${label} is ordered in React email`,
    );
    previousPhpIndex = phpIndex;
    previousHtmlIndex = htmlIndex;
  }

  assert.match(
    html,
    /<td width='61%' align='left' valign='top'>casey@example\.com<\/td>/,
  );
});

test("call-me-back email escapes submitted values before inserting them into HTML", () => {
  const html = buildCallMeBackEmailHtml({
    name: "<script>alert(1)</script>",
    email: "casey@example.com",
    phone_number: "555-0100",
    best_time: "Afternoons",
    question_comments: "A & B",
  });

  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /A &amp; B/);
  assert.doesNotMatch(html, /<script>/);
});
