import assert from "node:assert/strict";
import test from "node:test";
import {
  adminThumbnailUrl,
  localAssetUrl,
  thumbnailAssetUrl,
} from "../../frontend/src/lib/assets.js";

test("local asset URL helper preserves backend-generated thumbnail endpoints", () => {
  assert.equal(
    localAssetUrl("/api/trip-type-images/listing/trip-style.jpg"),
    "/api/trip-type-images/listing/trip-style.jpg",
  );
  assert.equal(
    localAssetUrl("/uploads/triptype/listing/trip-style.jpg"),
    "/uploads/triptype/listing/trip-style.jpg",
  );
});

test("thumbnail helper preserves PHP timthumb resize parameters for local uploads", () => {
  const thumbnail = localAssetUrl(
    "/timthumb.php?src=https://www.alpenwild.com/images/product/listing/shirt.jpg&w=301&h=274&zc=1&q=100",
  );
  const url = new URL(thumbnail, "http://localhost");

  assert.equal(url.pathname, "/api/public-thumbnail");
  assert.equal(
    url.searchParams.get("src"),
    "/uploads/product/listing/shirt.jpg",
  );
  assert.equal(url.searchParams.get("w"), "301");
  assert.equal(url.searchParams.get("h"), "274");
  assert.equal(url.searchParams.get("zc"), "1");
  assert.equal(url.searchParams.get("q"), "100");
});

test("thumbnail helper keeps external images and existing API thumbnails unchanged", () => {
  const external = "https://images.example.test/photo.jpg";
  assert.equal(
    localAssetUrl(
      "/timthumb.php?src=https://images.example.test/photo.jpg&w=400&h=400&zc=1",
    ),
    external,
  );
  assert.equal(
    thumbnailAssetUrl("/api/trip-images/listing/photo.jpg", 270, 183),
    "/api/trip-images/listing/photo.jpg",
  );
});

test("thumbnail helper uses zc=0 without cropping and ignores invalid dimensions", () => {
  const noCrop = thumbnailAssetUrl(
    "/uploads/static_page/photo.jpg",
    420,
    240,
    0,
    100,
  );
  const url = new URL(noCrop, "http://localhost");

  assert.equal(url.searchParams.get("zc"), "0");
  assert.equal(url.searchParams.get("q"), "100");
  assert.equal(
    thumbnailAssetUrl("/uploads/static_page/photo.jpg", 0, 240),
    "/uploads/static_page/photo.jpg",
  );
});

test("admin thumbnail helper uses the PHP admin preview size", () => {
  const url = new URL(
    adminThumbnailUrl("/uploads/product/listing/coat.jpg"),
    "http://localhost",
  );

  assert.equal(url.pathname, "/api/public-thumbnail");
  assert.equal(
    url.searchParams.get("src"),
    "/uploads/product/listing/coat.jpg",
  );
  assert.equal(url.searchParams.get("w"), "150");
  assert.equal(url.searchParams.get("h"), "90");
  assert.equal(url.searchParams.get("zc"), "1");
});
