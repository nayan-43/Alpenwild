import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { copyTextToClipboard } from "../../frontend/src/lib/clipboard.js";

test("copy utility uses the modern clipboard API when available", async () => {
  const previousNavigator = globalThis.navigator;
  let copiedText = "";
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { clipboard: { writeText: async (text) => (copiedText = text) } },
  });

  try {
    await copyTextToClipboard("https://example.com/staticpage/test/");
    assert.equal(copiedText, "https://example.com/staticpage/test/");
  } finally {
    if (previousNavigator === undefined) delete globalThis.navigator;
    else
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: previousNavigator,
      });
  }
});

test("copy utility falls back when clipboard API is unavailable", async () => {
  const previousNavigator = globalThis.navigator;
  const previousDocument = globalThis.document;
  let copiedText = "";
  let removed = false;
  const input = {
    value: "",
    style: {},
    setAttribute() {},
    select() {},
    setSelectionRange() {},
    remove() {
      removed = true;
    },
  };
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {},
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement: () => input,
      body: { appendChild() {} },
      execCommand: (command) => {
        copiedText = command === "copy" ? input.value : "";
        return command === "copy";
      },
    },
  });

  try {
    await copyTextToClipboard("https://example.com/staticpage/test/");
    assert.equal(copiedText, "https://example.com/staticpage/test/");
    assert.equal(removed, true);
  } finally {
    if (previousNavigator === undefined) delete globalThis.navigator;
    else
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: previousNavigator,
      });
    if (previousDocument === undefined) delete globalThis.document;
    else
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: previousDocument,
      });
  }
});

test("static page copy action validates the slug and uses fallback clipboard", async () => {
  const adminApp = await readFile(
    new URL("../../frontend/src/pages/AdminApp.jsx", import.meta.url),
    "utf8",
  );
  assert.match(adminApp, /if \(!item\.slug\)/);
  assert.match(adminApp, /encodeURIComponent\(item\.slug\)/);
  assert.match(adminApp, /await copyTextToClipboard\(url\)/);
});
