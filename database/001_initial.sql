DROP TABLE IF EXISTS product_attributes;
DROP TABLE IF EXISTS trip_type_box_images;
DROP TABLE IF EXISTS attribute_values;
DROP TABLE IF EXISTS email_templates;
DROP TABLE IF EXISTS site_settings;
DROP TABLE IF EXISTS static_pages;
DROP TABLE IF EXISTS redirections;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS attribute_types;
DROP TABLE IF EXISTS trip_types;
DROP TABLE IF EXISTS locations;
DROP TABLE IF EXISTS activities;
DROP TABLE IF EXISTS discounts;
DROP TABLE IF EXISTS testimonials;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS admin_users;

CREATE TABLE IF NOT EXISTS alpenwild_static_page_tbl (
  static_page_id BIGSERIAL PRIMARY KEY,
  static_page_display_as_page VARCHAR(3) NOT NULL DEFAULT 'No',
  static_page_parent_id BIGINT NOT NULL DEFAULT 0,
  static_page_name VARCHAR(255) NOT NULL,
  static_page_slug VARCHAR(255) NOT NULL DEFAULT '',
  static_page_menu_name VARCHAR(255) NOT NULL DEFAULT '',
  static_page_menu_assign VARCHAR(30) NOT NULL DEFAULT 'Self In Header',
  static_page_social_sharing_display VARCHAR(3) NOT NULL DEFAULT 'No',
  static_page_meta_title VARCHAR(255) NOT NULL DEFAULT '',
  static_page_meta_descriptions TEXT NOT NULL DEFAULT '',
  static_page_meta_keywords TEXT NOT NULL DEFAULT '',
  static_page_description TEXT NOT NULL DEFAULT '',
  static_page_banner_title VARCHAR(255) NOT NULL DEFAULT '',
  static_page_banner_sub_title VARCHAR(255) NOT NULL DEFAULT '',
  static_page_tooltip_text VARCHAR(255) NOT NULL DEFAULT '',
  static_page_description_type VARCHAR(20) NOT NULL DEFAULT 'old_description',
  static_page_banner VARCHAR(255) NOT NULL DEFAULT '',
  static_page_order INTEGER NOT NULL DEFAULT 1,
  static_page_status VARCHAR(20) NOT NULL DEFAULT 'Active'
);
CREATE INDEX IF NOT EXISTS legacy_static_pages_parent_order_idx ON alpenwild_static_page_tbl (static_page_parent_id, static_page_order, static_page_id);

CREATE TABLE IF NOT EXISTS alpenwild_redirection_tbl (
  redirection_id BIGSERIAL PRIMARY KEY,
  old_redirection_url VARCHAR(255) NOT NULL,
  new_redirection_url VARCHAR(255) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS legacy_redirections_old_url_idx
  ON alpenwild_redirection_tbl (old_redirection_url);

CREATE TABLE IF NOT EXISTS alpenwild_attribute_type_tbl (
  attribute_type_id BIGSERIAL PRIMARY KEY,
  attribute_type_name VARCHAR(255) NOT NULL,
  attribute_type_status VARCHAR(20) NOT NULL DEFAULT 'Active' CHECK (attribute_type_status IN ('Active', 'Inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS attribute_type_status_idx ON alpenwild_attribute_type_tbl (attribute_type_status);

CREATE TABLE IF NOT EXISTS alpenwild_product_tbl (
  product_id BIGSERIAL PRIMARY KEY,
  product_name VARCHAR(255) NOT NULL UNIQUE,
  product_slug VARCHAR(255) NOT NULL DEFAULT '',
  category_id BIGINT NOT NULL,
  product_menu_name VARCHAR(255) NOT NULL,
  product_meta_title VARCHAR(255) NOT NULL DEFAULT '',
  product_meta_descriptions TEXT NOT NULL DEFAULT '',
  product_meta_keywords TEXT NOT NULL DEFAULT '',
  product_short_descriptions TEXT NOT NULL DEFAULT '',
  product_description TEXT NOT NULL DEFAULT '',
  product_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  product_banner_title VARCHAR(255) NOT NULL DEFAULT '',
  product_banner_sub_title VARCHAR(255) NOT NULL DEFAULT '',
  product_tooltip_text VARCHAR(255) NOT NULL DEFAULT '',
  product_banner VARCHAR(255) NOT NULL DEFAULT '',
  product_banner_alt VARCHAR(255) NOT NULL DEFAULT '',
  product_listing_image VARCHAR(255) NOT NULL DEFAULT '',
  product_listing_image_alt VARCHAR(255) NOT NULL DEFAULT '',
  product_order INTEGER NOT NULL DEFAULT 1,
  product_status VARCHAR(20) NOT NULL DEFAULT 'Active' CHECK (product_status IN ('Active', 'Inactive')),
  product_creation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alpenwild_product_additional_image_tbl (
  product_additional_image_id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES alpenwild_product_tbl(product_id) ON DELETE CASCADE,
  additional_image VARCHAR(255) NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS alpenwild_product_box_image_tbl (
  product_box_image_id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES alpenwild_product_tbl(product_id) ON DELETE CASCADE,
  product_box_image VARCHAR(255) NOT NULL DEFAULT '',
  product_box_image_image_alt VARCHAR(255) NOT NULL DEFAULT '',
  product_box_image_title VARCHAR(255) NOT NULL DEFAULT '',
  product_box_image_link TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS alpenwild_attribute_value_tbl (
  attribute_value_id BIGSERIAL PRIMARY KEY,
  attribute_type_id BIGINT NOT NULL REFERENCES alpenwild_attribute_type_tbl(attribute_type_id),
  attribute_value VARCHAR(255) NOT NULL,
  attribute_value_order INTEGER NOT NULL DEFAULT 1,
  attribute_value_status VARCHAR(20) NOT NULL DEFAULT 'Active' CHECK (attribute_value_status IN ('Active', 'Inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (attribute_type_id, attribute_value)
);

CREATE TABLE IF NOT EXISTS alpenwild_product_attribute_value_tbl (
  product_attribute_value_id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES alpenwild_product_tbl(product_id) ON DELETE CASCADE,
  attribute_type_id BIGINT NOT NULL REFERENCES alpenwild_attribute_type_tbl(attribute_type_id),
  attribute_value_id BIGINT NOT NULL REFERENCES alpenwild_attribute_value_tbl(attribute_value_id),
  product_attribute_value_status VARCHAR(20) NOT NULL DEFAULT 'Active' CHECK (product_attribute_value_status IN ('Active', 'Inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, attribute_value_id)
);

CREATE INDEX IF NOT EXISTS product_attribute_value_product_idx
  ON alpenwild_product_attribute_value_tbl (product_id, product_attribute_value_id);

CREATE TABLE IF NOT EXISTS alpenwild_category_tbl (
  category_id BIGSERIAL PRIMARY KEY,
  category_parent_id INTEGER NOT NULL DEFAULT 0,
  category_name VARCHAR(255) NOT NULL,
  category_slug VARCHAR(255) NOT NULL DEFAULT '',
  category_menu_name VARCHAR(255) NOT NULL DEFAULT '',
  category_meta_title VARCHAR(255) NOT NULL DEFAULT '',
  category_meta_keywords TEXT NOT NULL DEFAULT '',
  category_meta_descriptions TEXT NOT NULL DEFAULT '',
  category_description TEXT NOT NULL DEFAULT '',
  category_banner VARCHAR(255) NOT NULL DEFAULT '',
  category_banner_title VARCHAR(255) NOT NULL DEFAULT '',
  category_banner_sub_title VARCHAR(255) NOT NULL DEFAULT '',
  category_tooltip_text VARCHAR(255) NOT NULL DEFAULT '',
  category_listing_image VARCHAR(255) NOT NULL DEFAULT '',
  category_order INTEGER NOT NULL DEFAULT 1,
  category_status VARCHAR(20) NOT NULL DEFAULT 'Active' CHECK (category_status IN ('Active', 'Inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alpenwild_category_box_image_tbl (
  category_box_image_id BIGSERIAL PRIMARY KEY,
  category_id BIGINT NOT NULL REFERENCES alpenwild_category_tbl(category_id) ON DELETE CASCADE,
  category_box_image VARCHAR(255) NOT NULL DEFAULT '',
  category_box_image_title VARCHAR(255) NOT NULL DEFAULT '',
  category_box_image_link TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS category_order_idx ON alpenwild_category_tbl (category_order, category_id);
CREATE INDEX IF NOT EXISTS category_status_idx ON alpenwild_category_tbl (category_status);
CREATE INDEX IF NOT EXISTS category_box_image_category_idx ON alpenwild_category_box_image_tbl (category_id, category_box_image_id);

CREATE TABLE IF NOT EXISTS alpenwild_user_tbl (
  user_id BIGSERIAL PRIMARY KEY,
  user_first_name VARCHAR(255) NOT NULL,
  user_last_name VARCHAR(255) NOT NULL,
  user_preferred_name VARCHAR(255) NOT NULL DEFAULT '',
  user_street_address VARCHAR(255) NOT NULL,
  user_street_address1 VARCHAR(255) NOT NULL DEFAULT '',
  user_city VARCHAR(255) NOT NULL,
  user_state VARCHAR(255) NOT NULL,
  user_postal_code VARCHAR(255) NOT NULL,
  user_country VARCHAR(255) NOT NULL,
  user_day_phone VARCHAR(255) NOT NULL,
  user_mobile_phone VARCHAR(255) NOT NULL,
  user_email_address VARCHAR(255) NOT NULL,
  user_date_of_birth DATE,
  user_gender VARCHAR(255) NOT NULL DEFAULT '',
  user_shipping_email_address VARCHAR(255) NOT NULL,
  user_shipping_first_name VARCHAR(255) NOT NULL,
  user_shipping_last_name VARCHAR(255) NOT NULL,
  user_shipping_street_address VARCHAR(255) NOT NULL,
  user_shipping_street_address1 VARCHAR(255) NOT NULL DEFAULT '',
  user_shipping_city VARCHAR(255) NOT NULL,
  user_shipping_state VARCHAR(255) NOT NULL,
  user_shipping_country VARCHAR(255) NOT NULL,
  user_shipping_postal_code VARCHAR(255) NOT NULL,
  user_creation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  user_status VARCHAR(20) NOT NULL DEFAULT 'Active' CHECK (user_status IN ('Active', 'Inactive'))
);

CREATE INDEX IF NOT EXISTS alpenwild_user_email_idx
  ON alpenwild_user_tbl (user_email_address);
CREATE INDEX IF NOT EXISTS alpenwild_user_status_idx
  ON alpenwild_user_tbl (user_status);

CREATE TABLE IF NOT EXISTS alpenwild_trips_booking_tbl (
  trips_booking_id BIGSERIAL PRIMARY KEY,
  trips_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  trips_date_id BIGINT NOT NULL DEFAULT 0,
  party_number INTEGER NOT NULL DEFAULT 1,
  rooming_preference VARCHAR(250) NOT NULL DEFAULT '',
  bed_preference VARCHAR(250) NOT NULL DEFAULT '',
  physical_medical_conditions TEXT NOT NULL DEFAULT '',
  dietary_restrictions TEXT NOT NULL DEFAULT '',
  special_dietary_requirements TEXT NOT NULL DEFAULT '',
  hear_about_us VARCHAR(250) NOT NULL DEFAULT '',
  special_comments TEXT NOT NULL DEFAULT '',
  admin_notes TEXT NOT NULL DEFAULT '',
  flight_arrival_details TEXT NOT NULL DEFAULT '',
  flight_departure_details TEXT NOT NULL DEFAULT '',
  shipping_first_name VARCHAR(255) NOT NULL DEFAULT '',
  shipping_last_name VARCHAR(255) NOT NULL DEFAULT '',
  shipping_street_address VARCHAR(255) NOT NULL DEFAULT '',
  shipping_street_address1 VARCHAR(255) NOT NULL DEFAULT '',
  shipping_city VARCHAR(255) NOT NULL DEFAULT '',
  shipping_state VARCHAR(255) NOT NULL DEFAULT '',
  shipping_postal_code VARCHAR(255) NOT NULL DEFAULT '',
  shipping_country VARCHAR(255) NOT NULL DEFAULT '',
  booking_start_date DATE,
  booking_end_date DATE,
  trip_total_payment NUMERIC(12,2) NOT NULL DEFAULT 0,
  trip_additional_payment NUMERIC(12,2) NOT NULL DEFAULT 0,
  trip_payment_due NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_code VARCHAR(255) NOT NULL DEFAULT '',
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  trips_booking_status VARCHAR(20) NOT NULL DEFAULT 'Active'
    CHECK (trips_booking_status IN ('Active', 'Inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS trips_booking_trip_idx
  ON alpenwild_trips_booking_tbl (trips_id, trips_booking_id DESC);
ALTER TABLE alpenwild_trips_booking_tbl
  ADD COLUMN IF NOT EXISTS shipping_first_name VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS shipping_last_name VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS shipping_street_address VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS shipping_street_address1 VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS shipping_city VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS shipping_state VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS shipping_postal_code VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS shipping_country VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS discount_code VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS alpenwild_trips_additional_booking_user_tbl (
  trips_additional_booking_user_id BIGSERIAL PRIMARY KEY,
  trips_booking_id BIGINT NOT NULL REFERENCES alpenwild_trips_booking_tbl(trips_booking_id) ON DELETE CASCADE,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  preferred_name VARCHAR(255) NOT NULL DEFAULT '',
  email_address VARCHAR(255) NOT NULL DEFAULT '',
  day_phone VARCHAR(255) NOT NULL DEFAULT '',
  mobile_phone VARCHAR(255) NOT NULL DEFAULT '',
  date_of_birth DATE,
  gender VARCHAR(255) NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS alpenwild_trips_additional_price_tbl (
  trips_additional_price_id BIGSERIAL PRIMARY KEY,
  trips_booking_id BIGINT NOT NULL REFERENCES alpenwild_trips_booking_tbl(trips_booking_id) ON DELETE CASCADE,
  description VARCHAR(255) NOT NULL,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1,
  sign CHAR(1) NOT NULL DEFAULT '+' CHECK (sign IN ('+', '-'))
);

CREATE TABLE IF NOT EXISTS alpenwild_order_tbl (
  order_id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES alpenwild_user_tbl(user_id),
  order_total_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  order_discount_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  order_shipping_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE
);
CREATE TABLE IF NOT EXISTS alpenwild_order_details_tbl (
  order_detail_id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES alpenwild_order_tbl(order_id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL,
  product_attribute_id BIGINT NOT NULL DEFAULT 0,
  product_quantity INTEGER NOT NULL DEFAULT 1,
  product_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  product_total_price NUMERIC(12,2) NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS alpenwild_order_attribute_details_tbl (
  order_attribute_detail_id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES alpenwild_order_tbl(order_id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL,
  product_attribute_id BIGINT NOT NULL DEFAULT 0,
  product_attribute_type_id BIGINT NOT NULL,
  product_attribute_value_id BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS alpenwild_order_user_idx ON alpenwild_order_tbl (user_id, order_id);

CREATE TABLE IF NOT EXISTS alpenwild_testimonial_tbl (
  testimonial_id BIGSERIAL PRIMARY KEY,
  trips_id BIGINT NOT NULL DEFAULT 0,
  testimonial_client_details VARCHAR(255) NOT NULL,
  testimonial_content TEXT NOT NULL,
  testimonial_order INTEGER NOT NULL DEFAULT 1,
  testimonial_status VARCHAR(20) NOT NULL DEFAULT 'Active'
    CHECK (testimonial_status IN ('Active', 'Inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS alpenwild_testimonial_order_idx
  ON alpenwild_testimonial_tbl (testimonial_order, testimonial_id);
CREATE INDEX IF NOT EXISTS alpenwild_testimonial_status_idx
  ON alpenwild_testimonial_tbl (testimonial_status);
