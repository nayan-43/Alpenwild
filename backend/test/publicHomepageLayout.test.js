import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("homepage trip boxes are re-equalized after images and fonts load", async () => {
  const page = await readFile(
    new URL("../../frontend/src/pages/PublicSite.jsx", import.meta.url),
    "utf8",
  );

  assert.match(page, /"\.legacy-home \.trip_type img"/);
  assert.match(page, /image\.addEventListener\("load", scheduleEqualize\)/);
  assert.match(page, /image\.addEventListener\("error", scheduleEqualize\)/);
  assert.match(page, /document\.fonts\?\.ready\.then\(scheduleEqualize\)/);
  assert.match(page, /window\.addEventListener\("resize", scheduleEqualize\)/);
});
