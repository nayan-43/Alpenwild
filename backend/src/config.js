import "dotenv/config";
import path from "node:path";

const root = path.resolve(process.cwd());
const configuredClientOrigin = process.env.CLIENT_ORIGIN;
const uploadDir = path.resolve(root, process.env.UPLOAD_DIR || "uploads");
const bannerUploadSubdir = process.env.BANNER_UPLOAD_SUBDIR || "banner";
const promotionsUploadSubdir =
  process.env.PROMOTIONS_UPLOAD_SUBDIR || "offers_promotions";
const specialFeatureUploadSubdir =
  process.env.SPECIAL_FEATURE_UPLOAD_SUBDIR || "special_feature";
const tripTypeUploadSubdir = process.env.TRIP_TYPE_UPLOAD_SUBDIR || "triptype";
const tripUploadSubdir = process.env.TRIP_UPLOAD_SUBDIR || "trip";
const tripLeaderUploadSubdir =
  process.env.TRIP_LEADER_UPLOAD_SUBDIR || "tripleader";
const categoryUploadSubdir = process.env.CATEGORY_UPLOAD_SUBDIR || "category";
const staticPageUploadSubdir =
  process.env.STATIC_PAGE_UPLOAD_SUBDIR || "static_page";
const contestUploadSubdir = process.env.CONTEST_UPLOAD_SUBDIR || "contest";

export const config = {
  port: Number(process.env.PORT || 4100),
  clientOrigin:
    configuredClientOrigin === "true"
      ? true
      : configuredClientOrigin || "http://localhost:5173",
  databaseUrl: process.env.DATABASE_URL,
  tripLeaderAuthorsMysql: {
    host: process.env.TRIP_LEADER_AUTHORS_MYSQL_HOST || "",
    port: Number(process.env.TRIP_LEADER_AUTHORS_MYSQL_PORT || 3306),
    user: process.env.TRIP_LEADER_AUTHORS_MYSQL_USER || "",
    password: process.env.TRIP_LEADER_AUTHORS_MYSQL_PASSWORD || "",
    ssl: process.env.TRIP_LEADER_AUTHORS_MYSQL_SSL === "true",
    databases: {
      alpsHiking:
        process.env.TRIP_LEADER_AUTHORS_ALPS_HIKING_DB || "alpenwi1_alpshiking",
      switzerlandTravel:
        process.env.TRIP_LEADER_AUTHORS_SWITZERLAND_TRAVEL_DB ||
        "alpenwi1_switzerlandtravel",
      mySwissKitchen:
        process.env.TRIP_LEADER_AUTHORS_MY_SWISSKITCHEN_DB ||
        "alpenwi1_myswisskitchennew",
    },
  },
  jwtSecret: process.env.JWT_SECRET || "",
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpUser: process.env.SMTP_USER || "",
  smtpPassword: process.env.SMTP_PASSWORD || "",
  smtpFrom: process.env.SMTP_FROM || "",
  recaptchaEnabled: process.env.VITE_ENABLE_RECAPTCHA !== "false",
  recaptchaSecret: process.env.RECAPTCHA_SECRET || "",
  callbackRecipientEmail:
    process.env.CALLBACK_RECIPIENT_EMAIL || "webgrity43@gmail.com",
  authorizeNetLogin: process.env.AUTHORIZE_NET_LOGIN || "",
  authorizeNetTransactionKey: process.env.AUTHORIZE_NET_TRANSACTION_KEY || "",
  authorizeNetSandbox: process.env.AUTHORIZE_NET_SANDBOX !== "false",
  bannerTable: "alpenwild_banner_tbl",
  promotionsTable: "alpenwild_offers_promotions_tbl",
  specialFeatureTable: "alpenwild_special_feature_tbl",
  footerMenuTable: "alpenwild_footer_menu_tbl",
  tripTypeTable: "alpenwild_trip_type_tbl",
  tripTypeBoxImageTable: "alpenwild_trip_type_box_image_tbl",
  tripTable: "alpenwild_trips_tbl",
  tripBoxImageTable: "alpenwild_trips_box_image_tbl",
  tripDateTable: "alpenwild_trips_date_tbl",
  tripActivityTable: "alpenwild_trips_activity_tbl",
  tripLeaderTable: "alpenwild_trip_leader_tbl",
  testimonialTable: "alpenwild_testimonial_tbl",
  locationTable: "alpenwild_location_tbl",
  activityTable: "alpenwild_activity_tbl",
  discountTable: "alpenwild_discount_tbl",
  attributeTypeTable: "alpenwild_attribute_type_tbl",
  attributeValueTable: "alpenwild_attribute_value_tbl",
  productAttributeTable: "alpenwild_product_attribute_value_tbl",
  categoryTable: "alpenwild_category_tbl",
  staticPageTable: "alpenwild_static_page_tbl",
  redirectionTable: "alpenwild_redirection_tbl",
  productTable: "alpenwild_product_tbl",
  userTable: "alpenwild_user_tbl",
  userOrderTable: "alpenwild_order_tbl",
  uploadDir,
  bannerUploadSubdir,
  bannerUploadDir: path.join(uploadDir, bannerUploadSubdir),
  promotionsUploadSubdir,
  promotionsUploadDir: path.join(uploadDir, promotionsUploadSubdir),
  specialFeatureUploadSubdir,
  specialFeatureUploadDir: path.join(uploadDir, specialFeatureUploadSubdir),
  tripTypeUploadSubdir,
  tripTypeUploadDir: path.join(uploadDir, tripTypeUploadSubdir),
  tripTypeBannerUploadDir: path.join(uploadDir, tripTypeUploadSubdir, "banner"),
  tripTypeListingUploadDir: path.join(
    uploadDir,
    tripTypeUploadSubdir,
    "listing",
  ),
  tripTypeBoxImageUploadDir: path.join(
    uploadDir,
    tripTypeUploadSubdir,
    "boximage",
  ),
  tripUploadSubdir,
  tripUploadDir: path.join(uploadDir, tripUploadSubdir),
  tripBannerUploadDir: path.join(uploadDir, tripUploadSubdir, "banner"),
  tripListingUploadDir: path.join(uploadDir, tripUploadSubdir, "listing"),
  tripMapUploadDir: path.join(uploadDir, tripUploadSubdir, "map"),
  tripGalleryUploadDir: path.join(uploadDir, tripUploadSubdir, "gallery"),
  tripBoxImageUploadDir: path.join(uploadDir, tripUploadSubdir, "boximage"),
  tripLeaderUploadSubdir,
  tripLeaderUploadDir: path.join(uploadDir, tripLeaderUploadSubdir),
  tripLeaderDescriptionUploadDir: path.join(
    uploadDir,
    tripLeaderUploadSubdir,
    "description",
  ),
  categoryUploadSubdir,
  categoryUploadDir: path.join(uploadDir, categoryUploadSubdir),
  categoryBannerUploadDir: path.join(uploadDir, categoryUploadSubdir, "banner"),
  categoryListingUploadDir: path.join(
    uploadDir,
    categoryUploadSubdir,
    "listing",
  ),
  categoryBoxImageUploadDir: path.join(
    uploadDir,
    categoryUploadSubdir,
    "boximage",
  ),
  staticPageUploadSubdir,
  staticPageUploadDir: path.join(uploadDir, staticPageUploadSubdir),
  staticPageBoxImageUploadDir: path.join(
    uploadDir,
    staticPageUploadSubdir,
    "boximage",
  ),
  staticPageDescriptionUploadDir: path.join(
    uploadDir,
    staticPageUploadSubdir,
    "description",
  ),
  contestUploadSubdir,
  contestUploadDir: path.join(uploadDir, contestUploadSubdir),
  productUploadSubdir: process.env.PRODUCT_UPLOAD_SUBDIR || "product",
  productUploadDir: path.join(
    uploadDir,
    process.env.PRODUCT_UPLOAD_SUBDIR || "product",
  ),
  productBannerUploadDir: path.join(
    uploadDir,
    process.env.PRODUCT_UPLOAD_SUBDIR || "product",
    "banner",
  ),
  productListingUploadDir: path.join(
    uploadDir,
    process.env.PRODUCT_UPLOAD_SUBDIR || "product",
    "listing",
  ),
  productAdditionalUploadDir: path.join(
    uploadDir,
    process.env.PRODUCT_UPLOAD_SUBDIR || "product",
    "additional",
  ),
  productBoxImageUploadDir: path.join(
    uploadDir,
    process.env.PRODUCT_UPLOAD_SUBDIR || "product",
    "boximage",
  ),
};
