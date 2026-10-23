import assert from "node:assert/strict";
import test from "node:test";
import { buildSitemapXml } from "../src/sitemap.js";

test("sitemap includes active-content route shapes and escapes XML values", () => {
  const xml = buildSitemapXml("https://example.test", {
    pages: [{ slug: "gear&books" }],
    tripTypes: [{ slug: "walking" }],
    trips: [{ slug: "alps" }],
  });

  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /https:\/\/example\.test\/staticpage\/gear%26books\//);
  assert.match(xml, /https:\/\/example\.test\/triptype\/walking\//);
  assert.match(xml, /https:\/\/example\.test\/trip\/alps\/overview\//);
  assert.match(xml, /https:\/\/example\.test\/blog\//);
  assert.match(
    xml,
    /xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/,
  );
});
