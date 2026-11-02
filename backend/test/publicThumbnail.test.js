import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("public thumbnail endpoint validates uploads and mirrors timthumb crop modes", async () => {
  const app = await readFile(
    new URL("../src/routes/public.js", import.meta.url),
    "utf8",
  );
  assert.match(app, /router\.get\("\/api\/public-thumbnail"/);
  assert.match(app, /sourceUrl\.startsWith\("\/uploads\/"\)/);
  assert.match(
    app,
    /decodeURIComponent\(sourceUrl\.slice\("\/uploads\/"\.length\)\)/,
  );
  assert.match(app, /fs\.realpath\(config\.uploadDir\)/);
  assert.match(app, /fs\.realpath\(sourcePath\)/);
  assert.match(
    app,
    /realSourcePath\.startsWith\(`\$\{uploadRoot\}\$\{path\.sep\}`\)/,
  );
  assert.match(app, /!\[0, 1, 2, 3\]\.includes\(zoomCrop\)/);
  assert.match(
    app,
    /fit: \["fill", "cover", "contain", "inside"\]\[zoomCrop\]/,
  );
  assert.match(app, /quality < 1 \|\|/);
  assert.match(app, /quality > 100/);
  assert.match(app, /sourceMetadata\.hasAlpha/);
  assert.match(app, /\.png\(\{ compressionLevel: 9 \}\)/);
  assert.match(app, /\.flatten\(\{ background: "#ffffff" \}\)/);
  assert.match(
    app,
    /res\s*\.type\(outputFormat === "png" \? "image\/png" : "image\/jpeg"\)/,
  );
  assert.match(app, /thumbnailPath/);
  assert.match(app, /ETag/);
});

test("public thumbnail endpoint remains accessible without admin authentication", async () => {
  const apiAccess = await readFile(
    new URL("../src/apiAccess.js", import.meta.url),
    "utf8",
  );
  const publicPaths = apiAccess.match(
    /const publicApiPaths = new Set\(\[([\s\S]*?)\]\);/,
  )?.[1];

  assert.ok(publicPaths, "public API allowlist exists");
  assert.match(publicPaths, /"\/public-thumbnail"/);
});
