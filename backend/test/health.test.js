import test from "node:test";
import assert from "node:assert/strict";

test("migration does not create a duplicate banner table", async () => {
  const migration = await (
    await import("node:fs/promises")
  ).readFile(
    new URL("../../database/001_initial.sql", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(migration, /CREATE TABLE IF NOT EXISTS banners/);
});

test("admin auth does not require extra administrator columns", async () => {
  const migration = await (
    await import("node:fs/promises")
  ).readFile(
    new URL("../../database/001_initial.sql", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(migration, /CREATE TABLE IF NOT EXISTS admin_users/);
  assert.doesNotMatch(
    migration,
    /administrator_password_hash|administrator_recovery_email|administrator_reset_token/,
  );
});

test("migration removes duplicate non-prefixed application tables", async () => {
  const migration = await (
    await import("node:fs/promises")
  ).readFile(
    new URL("../../database/001_initial.sql", import.meta.url),
    "utf8",
  );
  for (const table of [
    "activities",
    "admin_users",
    "attribute_types",
    "attribute_values",
    "discounts",
    "email_templates",
    "locations",
    "product_attributes",
    "products",
    "redirections",
    "site_settings",
    "static_pages",
    "testimonials",
    "trip_type_box_images",
    "trip_types",
    "users",
  ]) {
    assert.doesNotMatch(
      migration,
      new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`),
    );
    assert.match(migration, new RegExp(`DROP TABLE IF EXISTS ${table}\\b`));
  }
});

test("category migration matches the legacy PHP shop category form", async () => {
  const migration = await (
    await import("node:fs/promises")
  ).readFile(
    new URL("../../database/001_initial.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /CREATE TABLE IF NOT EXISTS alpenwild_category_tbl/);
  assert.match(migration, /category_parent_id/);
  assert.match(migration, /category_banner_title/);
  assert.match(migration, /category_banner_sub_title/);
  assert.match(migration, /category_tooltip_text/);
  assert.match(migration, /category_order/);
  assert.match(
    migration,
    /CREATE TABLE IF NOT EXISTS alpenwild_category_box_image_tbl/,
  );
  assert.match(migration, /category_box_image_title/);
  assert.match(migration, /category_box_image_link/);
});

test("attribute type migration matches the legacy PHP admin form", async () => {
  const migration = await (
    await import("node:fs/promises")
  ).readFile(
    new URL("../../database/001_initial.sql", import.meta.url),
    "utf8",
  );
  assert.match(
    migration,
    /CREATE TABLE IF NOT EXISTS alpenwild_attribute_type_tbl/,
  );
  assert.match(migration, /attribute_type_name/);
  assert.match(migration, /attribute_type_status/);
});

test("database operations are configured to use PHP-prefixed tables", async () => {
  const { config } = await import("../src/config.js");
  for (const key of [
    "bannerTable",
    "promotionsTable",
    "specialFeatureTable",
    "footerMenuTable",
    "tripTypeTable",
    "tripTypeBoxImageTable",
    "tripTable",
    "tripBoxImageTable",
    "tripDateTable",
    "tripActivityTable",
    "tripLeaderTable",
    "testimonialTable",
    "locationTable",
    "activityTable",
    "discountTable",
    "attributeTypeTable",
    "attributeValueTable",
    "productAttributeTable",
    "categoryTable",
    "staticPageTable",
    "redirectionTable",
    "productTable",
    "userTable",
    "userOrderTable",
  ]) {
    assert.match(config[key], /^alpenwild_/);
  }
});

test("attribute value migration matches the legacy PHP admin form", async () => {
  const migration = await (
    await import("node:fs/promises")
  ).readFile(
    new URL("../../database/001_initial.sql", import.meta.url),
    "utf8",
  );
  assert.match(
    migration,
    /CREATE TABLE IF NOT EXISTS alpenwild_attribute_value_tbl/,
  );
  assert.match(
    migration,
    /attribute_type_id BIGINT NOT NULL REFERENCES alpenwild_attribute_type_tbl/,
  );
  assert.match(migration, /attribute_value_order/);
  assert.match(migration, /attribute_value_status/);
});

test("product migration matches the legacy PHP product form", async () => {
  const migration = await (
    await import("node:fs/promises")
  ).readFile(
    new URL("../../database/001_initial.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /CREATE TABLE IF NOT EXISTS alpenwild_product_tbl/);
  assert.match(migration, /category_id BIGINT NOT NULL/);
  assert.match(migration, /product_short_descriptions/);
  assert.match(migration, /product_listing_image/);
  assert.match(
    migration,
    /CREATE TABLE IF NOT EXISTS alpenwild_product_additional_image_tbl/,
  );
  assert.match(
    migration,
    /CREATE TABLE IF NOT EXISTS alpenwild_product_box_image_tbl/,
  );
});

test("redirection migration matches the legacy PHP redirection form", async () => {
  const migration = await (
    await import("node:fs/promises")
  ).readFile(
    new URL("../../database/001_initial.sql", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(migration, /CREATE TABLE IF NOT EXISTS redirections/);
  assert.match(migration, /DROP TABLE IF EXISTS redirections/);
  assert.match(
    migration,
    /CREATE TABLE IF NOT EXISTS alpenwild_redirection_tbl/,
  );
  assert.match(migration, /old_redirection_url/);
  assert.match(migration, /new_redirection_url/);
});
