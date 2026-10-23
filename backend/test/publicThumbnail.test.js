import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("public thumbnail endpoint validates uploads and mirrors timthumb crop modes", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const route = app.match(
    /app\.get\("\/api\/public-thumbnail"[\s\S]*?\n\}\);/,
  )?.[0];

  assert.ok(route, "public thumbnail route exists");
  assert.match(route, /sourceUrl\.startsWith\("\/uploads\/"\)/);
  assert.match(
    route,
    /decodeURIComponent\(sourceUrl\.slice\("\/uploads\/"\.length\)\)/,
  );
  assert.match(route, /fs\.realpath\(config\.uploadDir\)/);
  assert.match(route, /fs\.realpath\(sourcePath\)/);
  assert.match(
    route,
    /realSourcePath\.startsWith\(`\$\{uploadRoot\}\$\{path\.sep\}`\)/,
  );
  assert.match(route, /!\[0, 1, 2, 3\]\.includes\(zoomCrop\)/);
  assert.match(
    route,
    /fit: \["fill", "cover", "contain", "inside"\]\[zoomCrop\]/,
  );
  assert.match(route, /quality < 1 \|\|/);
  assert.match(route, /quality > 100/);
  assert.match(route, /sourceMetadata\.hasAlpha/);
  assert.match(route, /\.png\(\{ compressionLevel: 9 \}\)/);
  assert.match(route, /\.flatten\(\{ background: "#ffffff" \}\)/);
  assert.match(
    route,
    /res\s*\.type\(outputFormat === "png" \? "image\/png" : "image\/jpeg"\)/,
  );
  assert.match(route, /thumbnailPath/);
  assert.match(route, /ETag/);
});

test("public thumbnail endpoint remains accessible without admin authentication", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const publicPaths = app.match(
    /const publicApiPaths = new Set\(\[([\s\S]*?)\]\);/,
  )?.[1];

  assert.ok(publicPaths, "public API allowlist exists");
  assert.match(publicPaths, /"\/public-thumbnail"/);
});
