import fs from "node:fs/promises";
import path from "node:path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import multer from "multer";
import jwt from "jsonwebtoken";
import sharp from "sharp";
import crypto from "node:crypto";
import nodemailer from "nodemailer";
import { z } from "zod";
import { config } from "./config.js";
import { slugifyCategoryName } from "./categorySlug.js";
import { createCategoryDataHelpers } from "./categoryData.js";
import { pool, query } from "./db.js";
import { createTripLeaderAuthorsService } from "./tripLeaderAuthors.js";
import { createTripLeaderPostsService } from "./tripLeaderPosts.js";
import { tripBookingAmount } from "./tripBookingAmount.js";
import {
  createBookingConfirmationHtml,
  createTripBookingAdminNotificationHtml,
  createPaymentConfirmationHtml,
  createRefundConfirmationHtml,
  createTripBookingInvoicePdf,
} from "./tripBookingEmail.js";
import { paymentLinkSignature as createPaymentLinkSignature } from "./paymentLinkSignature.js";
import { createApiAccessMiddleware } from "./apiAccess.js";
import {
  createFrontendFallbackRouter,
  createHealthRouter,
} from "./routes/system.js";
import { buildSitemapXml } from "./sitemap.js";
import { buildPublicNavigation } from "./publicNavigation.js";
import { createPublicRouter } from "./routes/public.js";
import { createTripLeadersRouter } from "./routes/tripLeaders.js";
import { createProductsRouter } from "./routes/products.js";
import { createPublicCategoriesRouter } from "./routes/categories.js";
import { createPublicStaticPagesRouter } from "./routes/staticPages.js";
import { createFooterMenusRouter } from "./routes/admin/footerMenus.js";
import { createLookupDataRouter } from "./routes/lookupData.js";
import { createAttributesRouter } from "./routes/admin/attributes.js";
import { createProductAttributesRouter } from "./routes/admin/productAttributes.js";
import { createAdminTripBookingListsRouter } from "./routes/admin/tripBookingLists.js";
import { createAdminTripBookingExportRouter } from "./routes/admin/tripBookingExport.js";
import { createAdminTripBookingLookupsRouter } from "./routes/admin/tripBookingLookups.js";
import { createAdminTripBookingManagementRouter } from "./routes/admin/tripBookingManagement.js";
import { createAdminMakePaymentsRouter } from "./routes/admin/makePayments.js";
import { createAdminDashboardRouter } from "./routes/admin/dashboard.js";
import { createAdminStaticPagesRouter } from "./routes/admin/staticPages.js";
import { createAdminCategoriesRouter } from "./routes/admin/categories.js";
import { createAdminSettingsRouter } from "./routes/admin/settings.js";
import { createAdminTripBookingPaymentLinksRouter } from "./routes/admin/tripBookingPaymentLinks.js";
import { createAdminTripPaymentRefundsRouter } from "./routes/admin/tripPaymentRefunds.js";
import { createAdminTripBookingUpdatesRouter } from "./routes/admin/tripBookingUpdates.js";
import { createPublicTripPaymentLinksRouter } from "./routes/publicTripPaymentLinks.js";
import { createTripPaymentsRouter } from "./routes/tripPayments.js";
import { createTripBookingsRouter } from "./routes/tripBookings.js";
import { authCookieName, createAuthRouter } from "./routes/auth.js";
import { createCallbackRouter } from "./routes/callback.js";
import { createPublicContestsRouter } from "./routes/publicContests.js";
import { createPublicContestSubmissionsRouter } from "./routes/publicContestSubmissions.js";
import { createShopCustomersRouter } from "./routes/shopCustomers.js";
import { createShopCheckoutRouter } from "./routes/shopCheckout.js";
import { createAdminTripsRouter } from "./routes/admin/trips.js";
import { createDiscountsRouter } from "./routes/discounts.js";
import { createInvoicesRouter } from "./routes/admin/invoices.js";
import { createContestAdminRouter } from "./routes/admin/contestSubmissions.js";
import { createOrdersRouter } from "./routes/admin/orders.js";
import { createContestsRouter } from "./routes/contests.js";
import { createMailingListRouter } from "./routes/mailingList.js";
import { createTestimonialsRouter } from "./routes/testimonials.js";
import {
  createRedirectionsRouter,
  redirectionSelect,
} from "./routes/admin/redirections.js";
import { createUsersRouter } from "./routes/admin/users.js";
import { createBannersRouter } from "./routes/banners.js";
import { createPromotionsRouter } from "./routes/promotions.js";
import { createSpecialFeaturesRouter } from "./routes/specialFeatures.js";
import { createTripGalleriesRouter } from "./routes/tripGalleries.js";
import { createTripFaqsRouter } from "./routes/tripFaqs.js";
import { createTripItineraryRouter } from "./routes/tripItinerary.js";
import { createTripPostsRouter } from "./routes/tripPosts.js";
import { createTripTypesRouter } from "./routes/tripTypes.js";
import { createTripListingImagesRouter } from "./routes/tripListingImages.js";
import { createAdminProductsRouter } from "./routes/admin/products.js";
import { createAdminTripLeadersRouter } from "./routes/admin/tripLeaders.js";

const app = express();
if (!pool) {
  throw new Error(
    "DATABASE_URL is not configured. Copy .env.example to .env first.",
  );
}
const tripLeaderAuthors = createTripLeaderAuthorsService(
  config.tripLeaderAuthorsMysql,
);
const tripLeaderPosts = createTripLeaderPostsService(
  config.tripLeaderAuthorsMysql,
);
const mailer =
  config.smtpHost && config.smtpUser && config.smtpPassword
    ? nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpPort === 465,
        auth: { user: config.smtpUser, pass: config.smtpPassword },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 30000,
      })
    : null;

async function verifyRecaptcha(token) {
  if (!config.recaptchaSecret) return false;
  if (!token) return false;
  const response = await fetch(
    "https://www.google.com/recaptcha/api/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: config.recaptchaSecret,
        response: token,
      }),
    },
  );
  if (!response.ok)
    throw new Error(`reCAPTCHA returned HTTP ${response.status}.`);
  const result = await response.json();
  return result.success === true;
}

function paymentLinkSignature(bookingId, type, amount = "") {
  return createPaymentLinkSignature(bookingId, type, amount, config.jwtSecret);
}

function isValidPaymentLinkSignature(bookingId, type, amount, signature) {
  if (
    !config.jwtSecret ||
    typeof signature !== "string" ||
    !/^[a-f0-9]{64}$/i.test(signature)
  )
    return false;
  const expected = Buffer.from(
    paymentLinkSignature(bookingId, type, amount),
    "hex",
  );
  const supplied = Buffer.from(signature, "hex");
  return (
    expected.length === supplied.length &&
    crypto.timingSafeEqual(expected, supplied)
  );
}

function validDateOrNull(value) {
  if (!value) return null;
  const text = String(value).slice(0, 10);
  return isValidIsoDate(text) ? text : null;
}

function calculateBookingPaymentDueDate(tripStartDate) {
  const today = new Date();
  const todayDate = today.toISOString().slice(0, 10);
  const start = validDateOrNull(tripStartDate);
  if (!start) return "";
  const daysUntilStart = Math.abs(
    (Date.parse(`${start}T00:00:00Z`) - Date.parse(`${todayDate}T00:00:00Z`)) /
      86400000,
  );
  const dueDate = new Date(
    `${daysUntilStart <= 120 ? todayDate : start}T00:00:00Z`,
  );
  dueDate.setUTCDate(dueDate.getUTCDate() + (daysUntilStart <= 120 ? 3 : -120));
  return dueDate.toISOString().slice(0, 10);
}

function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

async function authorizeNetCharge({
  cardNumber,
  expiration,
  amount,
  cvv,
  invoice,
  email,
  firstName,
  address,
  city,
  state,
  zip,
  lastName = "",
  customerId = "",
  phone = "",
  customerIp = "",
  shippingFirstName = "",
  shippingLastName = "",
  shippingAddress = "",
  shippingCity = "",
  shippingState = "",
  shippingZip = "",
  description = "",
}) {
  if (!config.authorizeNetLogin || !config.authorizeNetTransactionKey) {
    return { configured: false };
  }
  const fields = new URLSearchParams({
    x_delim_data: "TRUE",
    x_delim_char: ",",
    x_relay_response: "FALSE",
    x_url: "FALSE",
    x_version: "3.1",
    x_method: "CC",
    x_type: "AUTH_CAPTURE",
    x_duplicate_window: "1",
    x_test_request: config.authorizeNetSandbox ? "true" : "false",
    x_login: config.authorizeNetLogin,
    x_tran_key: config.authorizeNetTransactionKey,
    x_card_num: cardNumber,
    x_exp_date: expiration,
    x_amount: Number(amount).toFixed(2),
    x_invoice_num: String(invoice),
    x_tax: "0.00",
    x_card_code: cvv,
    x_customer_ip: customerIp,
    x_cust_id: String(customerId),
    x_email: email,
    x_email_customer: "FALSE",
    x_first_name: firstName,
    x_last_name: lastName,
    x_address: address,
    x_city: city,
    x_state: state,
    x_zip: zip,
    x_phone: phone,
    x_ship_to_first_name: shippingFirstName,
    x_ship_to_last_name: shippingLastName,
    x_ship_to_address: shippingAddress,
    x_ship_to_city: shippingCity,
    x_ship_to_state: shippingState,
    x_ship_to_zip: shippingZip,
    x_description: description,
  });
  const response = await fetch(
    "https://secure.authorize.net/gateway/transact.dll",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: fields,
    },
  );
  if (!response.ok)
    throw new Error(`Authorize.Net returned HTTP ${response.status}.`);
  const result = (await response.text())
    .split(",")
    .map((value) => value.replace(/^\"|\"$/g, ""));
  return {
    configured: true,
    approved: result[0] === "1",
    responseCode: result[0] || "",
    reason: result[3] || "Payment was declined.",
    authCode: result[4] || "",
    transactionId: result[6] || "",
  };
}

async function authorizeNetRefund({ cardNumber, amount, transactionId }) {
  if (!config.authorizeNetLogin || !config.authorizeNetTransactionKey)
    return { configured: false };
  const fields = new URLSearchParams({
    x_delim_data: "TRUE",
    x_delim_char: ",",
    x_relay_response: "FALSE",
    x_url: "FALSE",
    x_version: "3.1",
    x_method: "CC",
    x_type: "CREDIT",
    x_test_request: config.authorizeNetSandbox ? "true" : "false",
    x_login: config.authorizeNetLogin,
    x_tran_key: config.authorizeNetTransactionKey,
    x_card_num: cardNumber,
    x_trans_id: String(transactionId),
    x_amount: Number(amount).toFixed(2),
  });
  const response = await fetch(
    "https://secure.authorize.net/gateway/transact.dll",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: fields,
    },
  );
  if (!response.ok)
    throw new Error(`Authorize.Net returned HTTP ${response.status}.`);
  const result = (await response.text())
    .split(",")
    .map((value) => value.replace(/^\"|\"$/g, ""));
  return {
    configured: true,
    approved: result[0] === "1",
    reason: result[3] || "Refund was declined.",
    transactionId: result[6] || "",
  };
}
const upload = multer({
  dest: config.bannerUploadDir,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, callback) =>
    callback(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)),
});
const promotionUpload = multer({
  dest: config.promotionsUploadDir,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, callback) =>
    callback(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)),
});
const specialFeatureUpload = multer({
  dest: config.specialFeatureUploadDir,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, callback) =>
    callback(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)),
});
const tripTypeUpload = multer({
  dest: config.tripTypeUploadDir,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, callback) =>
    callback(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)),
});
const tripUpload = multer({
  dest: config.tripUploadDir,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, callback) =>
    callback(null, /^image\/(p?jpeg|png|webp|gif)$/.test(file.mimetype)),
});
const tripGalleryUpload = multer({
  dest: config.tripGalleryUploadDir,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, callback) =>
    callback(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)),
});
const tripLeaderUpload = multer({
  dest: config.tripLeaderUploadDir,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, callback) =>
    callback(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)),
});
const categoryUpload = multer({
  dest: config.categoryUploadDir,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, callback) =>
    callback(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)),
});
const staticPageUpload = multer({
  dest: config.staticPageUploadDir,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, callback) =>
    callback(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)),
});
const productUpload = multer({
  dest: config.productUploadDir,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, callback) =>
    callback(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)),
});
const settingsUpload = multer({
  dest: config.uploadDir,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, callback) =>
    callback(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)),
});

await fs.mkdir(config.bannerUploadDir, { recursive: true });
await fs.mkdir(config.promotionsUploadDir, { recursive: true });
await fs.mkdir(config.specialFeatureUploadDir, { recursive: true });
await fs.mkdir(config.tripTypeUploadDir, { recursive: true });
await fs.mkdir(config.tripTypeBannerUploadDir, { recursive: true });
await fs.mkdir(config.tripTypeListingUploadDir, { recursive: true });
await fs.mkdir(config.tripTypeBoxImageUploadDir, { recursive: true });
await fs.mkdir(config.tripUploadDir, { recursive: true });
await fs.mkdir(config.tripBannerUploadDir, { recursive: true });
await fs.mkdir(config.tripListingUploadDir, { recursive: true });
await fs.mkdir(config.tripMapUploadDir, { recursive: true });
await fs.mkdir(config.tripGalleryUploadDir, { recursive: true });
await fs.mkdir(config.tripBoxImageUploadDir, { recursive: true });
await fs.mkdir(config.tripLeaderUploadDir, { recursive: true });
await fs.mkdir(config.tripLeaderDescriptionUploadDir, { recursive: true });
await fs.mkdir(config.categoryBannerUploadDir, { recursive: true });
await fs.mkdir(config.categoryListingUploadDir, { recursive: true });
await fs.mkdir(config.categoryBoxImageUploadDir, { recursive: true });
await fs.mkdir(config.productBannerUploadDir, { recursive: true });
await fs.mkdir(config.productListingUploadDir, { recursive: true });
await fs.mkdir(config.productAdditionalUploadDir, { recursive: true });
await fs.mkdir(config.productBoxImageUploadDir, { recursive: true });
await fs.mkdir(config.staticPageUploadDir, { recursive: true });
await fs.mkdir(config.staticPageBoxImageUploadDir, { recursive: true });
await fs.mkdir(config.staticPageDescriptionUploadDir, { recursive: true });
await fs.mkdir(config.uploadDir, { recursive: true });
await fs.mkdir(config.contestUploadDir, { recursive: true });
const { categorySelect, serializeCategory, categoryBoxImagesFor } =
  createCategoryDataHelpers({ query, config });
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: config.clientOrigin, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use("/uploads", express.static(config.uploadDir));
app.use(express.static(path.resolve(process.cwd(), "dist")));
app.use(createPublicRouter({ config, query, buildSitemapXml }));
app.use(createTripLeadersRouter({ config, query, tripLeaderPosts }));
app.use(createProductsRouter({ config, query }));
app.use(
  createPublicCategoriesRouter({
    config,
    query,
    fs,
    path,
    crypto,
    sharp,
    categorySelect,
    serializeCategory,
    categoryBoxImagesFor,
    productSelect,
  }),
);
app.use(
  createPublicStaticPagesRouter({
    query,
    useLegacyStaticPages,
    useLegacyTripTypes,
    useLegacyTrips,
    staticPageSelect,
    serializeStaticPage,
    staticPageBoxImages,
    staticPageDescriptionBlocks,
    redirectionSelect: () => redirectionSelect(useLegacyRedirections),
    buildPublicNavigation,
  }),
);

function requireAuth(req, res, next) {
  const token = req.cookies[authCookieName];
  if (!token || !config.jwtSecret)
    return res.status(401).json({ message: "Authentication required." });
  try {
    req.admin = jwt.verify(token, config.jwtSecret, {
      issuer: "alpenwild-admin",
    });
    next();
  } catch {
    res.clearCookie(authCookieName, {
      httpOnly: true,
      sameSite: "strict",
      path: "/",
    });
    res.status(401).json({
      message: "Please login first to access this page!",
      code: "ADMIN_SESSION_EXPIRED",
    });
  }
}

function verifyRequestOrigin(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.get("origin");
  if (origin && config.clientOrigin !== true && origin !== config.clientOrigin)
    return res.status(403).json({ message: "Invalid request origin." });
  next();
}

async function getSiteTitle() {
  const result = await query(
    `SELECT site_configuration_value
     FROM alpenwild_site_configuration_tbl
     WHERE site_configuration_id=$1`,
    [settingKeyIds.site_title],
  );
  return (
    String(result.rows[0]?.site_configuration_value || "").trim() || "Alpenwild"
  );
}

async function getConfiguredEmail(settingId) {
  const result = await query(
    `SELECT site_configuration_value
     FROM alpenwild_site_configuration_tbl
     WHERE site_configuration_id=$1`,
    [settingId],
  );
  return (
    String(result.rows[0]?.site_configuration_value || "").trim() ||
    config.smtpUser
  );
}

const getAdminReceivingEmail = () => getConfiguredEmail(7);
const getAdminOrderReceivingEmail = () => getConfiguredEmail(9);

const settingsSchema = z.record(z.string().max(500));
const settingsValidationSchema = settingsSchema.superRefine(
  (settings, context) => {
    const requiredFields = [
      "site_title",
      "site_tagline",
      "site_url",
      "date_format",
      "time_format",
      "time_zone",
      "admin_receiving_email_id",
      "admin_sending_email_id",
      "admin_order_receiving_email_id",
      "backend_pagination",
      "frontend_pagination",
      "authorize_api_login_id",
      "authorize_api_transaction_key",
      "site_logo",
      "copyright_text",
      "private_departure_text",
      "private_departure_link",
    ];
    for (const field of requiredFields) {
      if (!settings[field]?.trim()) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: "This field is required.",
        });
      }
    }

    for (const field of [
      "admin_receiving_email_id",
      "admin_sending_email_id",
      "admin_order_receiving_email_id",
    ]) {
      if (
        settings[field] &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings[field].trim())
      ) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: "Enter a valid email address.",
        });
      }
    }

    for (const field of ["backend_pagination", "frontend_pagination"]) {
      if (settings[field] && !/^-?\d+$/.test(settings[field].trim())) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: "Enter a valid integer.",
        });
      }
    }

    if (
      settings.date_format &&
      !/^(?:[1-9]|1[01])$/.test(settings.date_format)
    ) {
      context.addIssue({
        code: "custom",
        path: ["date_format"],
        message: "Select a valid date format.",
      });
    }
    if (settings.time_format && !/^[1-3]$/.test(settings.time_format)) {
      context.addIssue({
        code: "custom",
        path: ["time_format"],
        message: "Select a valid time format.",
      });
    }
  },
);
const settingKeyIds = {
  site_title: 1,
  site_tagline: 2,
  site_url: 3,
  date_format: 4,
  time_format: 5,
  time_zone: 6,
  admin_receiving_email_id: 7,
  admin_sending_email_id: 8,
  admin_order_receiving_email_id: 9,
  backend_pagination: 10,
  frontend_pagination: 11,
  authorize_api_login_id: 12,
  authorize_api_transaction_key: 13,
  site_logo: 14,
  copyright_text: 15,
  private_departure_text: 16,
  private_departure_link: 17,
  user_email_option: 18,
  reminder_email_option: 19,
  footer_image_one: 20,
  footer_image_one_url: 21,
  footer_image_two: 22,
  footer_image_two_url: 23,
  footer_image_three: 24,
  footer_image_three_url: 25,
  footer_image_four: 26,
  footer_image_four_url: 27,
};

app.use(
  "/api",
  createApiAccessMiddleware({ requireAuth, verifyRequestOrigin }),
);
app.use(
  createAuthRouter({
    config,
    query,
    pool,
    mailer,
    getSiteTitle,
    getAdminReceivingEmail,
    requireAuth,
    verifyRequestOrigin,
  }),
);
app.use(
  createAdminSettingsRouter({
    query,
    config,
    settingsUpload,
    settingsSchema,
    settingsValidationSchema,
    settingKeyIds,
    safeFilename,
  }),
);
app.use(
  createPublicTripPaymentLinksRouter({
    query,
    isValidPaymentLinkSignature,
  }),
);
app.use(
  createTripPaymentsRouter({
    query,
    pool,
    config,
    mailer,
    verifyRecaptcha,
    authorizeNetCharge,
    isValidPaymentLinkSignature,
    createTripBookingInvoicePdf,
    calculateBookingPaymentDueDate,
    createPaymentConfirmationHtml,
    getSiteTitle,
  }),
);
app.use(
  createTripBookingsRouter({
    query,
    config,
    verifyRecaptcha,
    getTripBookingDiscount,
    authorizeNetCharge,
    getSiteTitle,
    calculateBookingPaymentDueDate,
    handleTripBooking,
    validDateOrNull,
  }),
);
app.use(
  createCallbackRouter({ config, mailer, verifyRecaptcha, getSiteTitle }),
);
app.use(createPublicContestsRouter({ query, config }));
app.use(
  createPublicContestSubmissionsRouter({
    query,
    pool,
    config,
    verifyRecaptcha,
    mailer,
    getSiteTitle,
    getAdminReceivingEmail,
    escapeHtml,
  }),
);
const userSchema = createUserSchema();
app.use(
  createShopCustomersRouter({
    query,
    userSchema,
    useLegacyUsers,
    userInsert,
    userSelectById,
  }),
);
app.use(
  createShopCheckoutRouter({
    query,
    pool,
    config,
    mailer,
    authorizeNetCharge,
    getSiteTitle,
    getAdminOrderReceivingEmail,
  }),
);
app.use(
  createAdminTripBookingPaymentLinksRouter({
    query,
    config,
    mailer,
    paymentLinkSignature,
    getSiteTitle,
  }),
);
app.use(
  createAdminTripPaymentRefundsRouter({
    pool,
    query,
    config,
    mailer,
    authorizeNetRefund,
    createTripBookingInvoicePdf,
    calculateBookingPaymentDueDate,
    createRefundConfirmationHtml,
    getSiteTitle,
  }),
);
app.use(
  createAdminTripBookingUpdatesRouter({
    pool,
    query,
    mailer,
    config,
    getTripBookingDiscount,
    createTripBookingInvoicePdf,
    calculateBookingPaymentDueDate,
    createBookingConfirmationHtml,
    getSiteTitle,
  }),
);
app.use(createAdminTripBookingListsRouter({ query }));
app.use(createAdminTripBookingExportRouter({ query }));
app.use(createAdminTripBookingLookupsRouter({ query }));
app.use(createAdminTripBookingManagementRouter({ query }));
app.use(createAdminMakePaymentsRouter({ query }));
app.use(createAdminDashboardRouter({ query, config }));
app.use(
  createAdminCategoriesRouter({
    query,
    config,
    upload: categoryUpload,
    uploadedFile,
    safeFilename,
    slugifyCategoryName,
    slugify,
    useLegacyProducts,
    categorySelect,
    serializeCategory,
    categoryBoxImagesFor,
  }),
);
app.use(
  createAdminTripsRouter({
    query,
    pool,
    upload: tripUpload,
    config,
    uploadedFile,
    safeFilename,
  }),
);
app.use(
  createAdminProductsRouter({
    query,
    config,
    upload: productUpload,
    useLegacyProducts,
    productSelect,
    uploadedFile,
    safeFilename,
    slugifyCategoryName,
  }),
);
app.use(
  createAdminTripLeadersRouter({
    query,
    config,
    upload: tripLeaderUpload,
    tripLeaderAuthors,
    requireAuth,
    uploadedFile,
    safeFilename,
    slugify,
  }),
);
app.use(
  createTripTypesRouter({
    query,
    upload: tripTypeUpload,
    config,
    useLegacyTripTypes,
    tripTypeBoxImagesFor,
    addTripTypeBoxImages,
    saveTripTypeBoxImages,
    uploadedFile,
    safeFilename,
    slugify,
  }),
);
app.use(createTripListingImagesRouter({ config }));
app.use(createFooterMenusRouter({ query, useLegacyFooterMenus }));
app.use(createMailingListRouter({ query, config, verifyRecaptcha }));
app.use(createTestimonialsRouter({ query, useLegacyTestimonials }));
app.use(createRedirectionsRouter({ query, useLegacyRedirections }));
app.use(createBannersRouter({ query, upload, config, useLegacyBanners }));
app.use(
  createPromotionsRouter({
    query,
    upload: promotionUpload,
    config,
    useLegacyPromotions,
  }),
);
app.use(
  createSpecialFeaturesRouter({
    query,
    upload: specialFeatureUpload,
    config,
    useLegacySpecialFeatures,
  }),
);
app.use(createTripFaqsRouter({ query }));
app.use(createTripItineraryRouter({ query }));
app.use(createTripPostsRouter({ query }));

const simpleNameSchema = z.object({
  name: z.string().trim().min(1).max(255),
  status: z.enum(["Active", "Inactive"]).default("Active"),
});
app.use(
  createLookupDataRouter({
    query,
    simpleNameSchema,
    useLegacyLocations,
    useLegacyActivities,
    useLegacyTrips,
  }),
);
const staticPageBoxImageSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  image: z.preprocess(
    (value) => (value === undefined || value === null ? "" : String(value)),
    z.string().max(255),
  ),
  image_alt: z.string().max(255).default(""),
  title: z.string().max(255).default(""),
  link: z.string().max(1000).default(""),
  display_order: z.coerce.number().int().default(1),
});
function normalizeStaticPageImageAlignment(value) {
  if (typeof value !== "string" || !value.trim()) return "none";
  return value.trim();
}

const staticPageDescriptionBlockSchema = z.object({
  image: z.preprocess(
    (value) => (value === undefined || value === null ? "" : String(value)),
    z.string().max(255),
  ),
  image_ratio: z.preprocess(
    (value) => (value === undefined || value === null ? "" : String(value)),
    z.string().max(50),
  ),
  image_proportion: z.enum(["lock", "unlock"]).default("unlock"),
  image_width: z.coerce.number().int().default(0),
  image_height: z.coerce.number().int().default(0),
  image_align: z.preprocess(
    normalizeStaticPageImageAlignment,
    z.enum(["none", "left", "right", "center"]),
  ),
  image_caption: z.string().max(255).default(""),
  image_alt: z.string().max(255).default(""),
  text_wrap: z.enum(["yes", "no"]).default("yes"),
  text: z.string().trim().min(1).max(30000),
  display_order: z.coerce.number().int().default(1),
});
const staticPageSchema = z
  .object({
    display_as_page: z.enum(["Yes", "No"]).default("No"),
    parent_id: z.coerce.number().int().min(0).default(0),
    name: z.string().trim().min(1).max(255),
    slug: z.string().trim().max(255).default(""),
    menu_name: z.string().trim().min(1).max(255),
    menu_assign: z.enum(["Self In Header", "Self In Footer"]),
    social_sharing_display: z.enum(["Yes", "No"]),
    meta_title: z.string().trim().max(255).default(""),
    meta_descriptions: z.string().trim().max(10000).default(""),
    meta_keywords: z.string().trim().max(10000).default(""),
    description: z.string().trim().max(30000).default(""),
    banner_title: z.string().trim().max(255).default(""),
    banner_sub_title: z.string().trim().max(255).default(""),
    tooltip_text: z.string().trim().max(255).default(""),
    description_type: z
      .enum(["old_description", "new_description"])
      .default("old_description"),
    display_order: z.preprocess(
      (value) =>
        typeof value === "string" && /^[+-]?\d+$/.test(value)
          ? Number(value)
          : value,
      z.number().int().min(-2147483648).max(2147483647),
    ),
    status: z.enum(["Active", "Inactive"]).default("Active"),
  })
  .superRefine((data, context) => {
    if (data.display_as_page !== "Yes") return;
    for (const field of ["meta_title", "meta_descriptions", "meta_keywords"]) {
      if (!data[field].trim()) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: "This field is required when Display As Page is enabled.",
        });
      }
    }
    if (
      data.description_type === "old_description" &&
      !data.description.trim()
    ) {
      context.addIssue({
        code: "custom",
        path: ["description"],
        message: "Description is required when Display As Page is enabled.",
      });
    }
  });
app.use(
  createAdminStaticPagesRouter({
    query,
    config,
    upload: staticPageUpload,
    staticPageSchema,
    parseStaticPageBoxes,
    parseStaticPageDescriptionBlocks,
    staticPageColumns,
    staticPageSelect,
    serializeStaticPage,
    staticPageBoxImages,
    staticPageDescriptionBlocks,
    shiftStaticPageOrders,
    saveStaticPageBoxes,
    saveStaticPageDescriptionBlocks,
    useLegacyStaticPages,
    uploadedFile,
    safeFilename,
    slugify,
  }),
);

function createUserSchema() {
  return z
  .object({
    user_first_name: z.string().trim().min(1).max(255),
    user_last_name: z.string().trim().min(1).max(255),
    user_preferred_name: z.string().trim().min(1).max(255),
    user_street_address: z.string().trim().min(1).max(255),
    user_street_address1: z.string().max(255).default(""),
    user_city: z.string().trim().min(1).max(255),
    user_state: z.string().trim().min(1).max(255),
    user_postal_code: z.string().trim().min(1).max(255),
    user_country: z.string().trim().min(1).max(255),
    user_day_phone: z.string().trim().min(1).max(255),
    user_mobile_phone: z.string().trim().min(1).max(255),
    user_email_address: z.string().trim().min(1).max(255),
    user_date_of_birth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be a valid date.")
      .or(z.literal(""))
      .default(""),
    user_gender: z.enum(["", "Male", "Female"]).default(""),
    user_shipping_email_address: z.string().trim().min(1).max(255),
    user_shipping_first_name: z.string().trim().min(1).max(255),
    user_shipping_last_name: z.string().trim().min(1).max(255),
    user_shipping_street_address: z.string().trim().min(1).max(255),
    user_shipping_street_address1: z.string().max(255).default(""),
    user_shipping_city: z.string().trim().min(1).max(255),
    user_shipping_state: z.string().trim().min(1).max(255),
    user_shipping_country: z.string().trim().min(1).max(255),
    user_shipping_postal_code: z.string().trim().min(1).max(255),
    user_status: z.enum(["Active", "Inactive"]).default("Active"),
  })
  .transform((data) => ({
    ...data,
    user_date_of_birth: data.user_date_of_birth || null,
  }));
}
app.use(
  createUsersRouter({
    query,
    userSchema,
    useLegacyUsers,
    userSelect,
    userSelectById,
    userInsert,
    userUpdate,
    userUpdateBookings,
    userHasOrders,
  }),
);

function useLegacyBanners() {
  return config.bannerTable === "alpenwild_banner_tbl";
}

function useLegacyPromotions() {
  return config.promotionsTable === "alpenwild_offers_promotions_tbl";
}

function useLegacySpecialFeatures() {
  return config.specialFeatureTable === "alpenwild_special_feature_tbl";
}

function useLegacyFooterMenus() {
  return config.footerMenuTable === "alpenwild_footer_menu_tbl";
}

function useLegacyLocations() {
  return config.locationTable === "alpenwild_location_tbl";
}

function useLegacyActivities() {
  return config.activityTable === "alpenwild_activity_tbl";
}

function useLegacyDiscounts() {
  return config.discountTable === "alpenwild_discount_tbl";
}

function useLegacyAttributeTypes() {
  return config.attributeTypeTable === "alpenwild_attribute_type_tbl";
}

function useLegacyAttributeValues() {
  return config.attributeValueTable === "alpenwild_attribute_value_tbl";
}

function useLegacyProductAttributes() {
  return (
    config.productAttributeTable === "alpenwild_product_attribute_value_tbl"
  );
}

function useLegacyCategories() {
  return config.categoryTable === "alpenwild_category_tbl";
}

function useLegacyStaticPages() {
  return config.staticPageTable === "alpenwild_static_page_tbl";
}

function useLegacyRedirections() {
  return config.redirectionTable === "alpenwild_redirection_tbl";
}

function useLegacyProducts() {
  return config.productTable === "alpenwild_product_tbl";
}

function useLegacyTripTypes() {
  return config.tripTypeTable === "alpenwild_trip_type_tbl";
}

function useLegacyTrips() {
  return config.tripTable === "alpenwild_trips_tbl";
}

function useLegacyTripLeaders() {
  return config.tripLeaderTable === "alpenwild_trip_leader_tbl";
}

function useLegacyTestimonials() {
  return config.testimonialTable === "alpenwild_testimonial_tbl";
}

function useLegacyUsers() {
  return config.userTable === "alpenwild_user_tbl";
}

function userSelect() {
  if (useLegacyUsers()) {
    return `SELECT user_id AS id, user_first_name, user_last_name,
      user_preferred_name, user_street_address, user_street_address1,
      user_city, user_state, user_postal_code, user_country,
      user_day_phone, user_mobile_phone, user_email_address,
      user_date_of_birth, user_gender, user_shipping_email_address,
      user_shipping_first_name, user_shipping_last_name,
      user_shipping_street_address, user_shipping_street_address1,
      user_shipping_city, user_shipping_state, user_shipping_country,
      user_shipping_postal_code, user_creation_date, user_status AS status
      FROM alpenwild_user_tbl`;
  }
  return `SELECT id, first_name AS user_first_name, last_name AS user_last_name,
    preferred_name AS user_preferred_name, street_address AS user_street_address,
    street_address1 AS user_street_address1, city AS user_city,
    state AS user_state, postal_code AS user_postal_code, country AS user_country,
    day_phone AS user_day_phone, mobile_phone AS user_mobile_phone,
    email_address AS user_email_address, date_of_birth AS user_date_of_birth,
    gender AS user_gender, shipping_email_address AS user_shipping_email_address,
    shipping_first_name AS user_shipping_first_name,
    shipping_last_name AS user_shipping_last_name,
    shipping_street_address AS user_shipping_street_address,
    shipping_street_address1 AS user_shipping_street_address1,
    shipping_city AS user_shipping_city, shipping_state AS user_shipping_state,
    shipping_country AS user_shipping_country,
    shipping_postal_code AS user_shipping_postal_code,
    creation_date AS user_creation_date, status FROM users`;
}

function userSelectById() {
  return `${userSelect()} WHERE ${useLegacyUsers() ? "user_id" : "id"}=$1`;
}

function userValues(data) {
  return [
    data.user_first_name,
    data.user_last_name,
    data.user_preferred_name,
    data.user_street_address,
    data.user_street_address1,
    data.user_city,
    data.user_state,
    data.user_postal_code,
    data.user_country,
    data.user_day_phone,
    data.user_mobile_phone,
    data.user_email_address,
    data.user_date_of_birth,
    data.user_gender,
    data.user_shipping_email_address,
    data.user_shipping_first_name,
    data.user_shipping_last_name,
    data.user_shipping_street_address,
    data.user_shipping_street_address1,
    data.user_shipping_city,
    data.user_shipping_state,
    data.user_shipping_country,
    data.user_shipping_postal_code,
    data.user_status,
  ];
}

function userInsert(data) {
  const values = userValues(data);
  if (useLegacyUsers()) {
    return query(
      `INSERT INTO alpenwild_user_tbl
       (user_first_name, user_last_name, user_preferred_name,
        user_street_address, user_street_address1, user_city, user_state,
        user_postal_code, user_country, user_day_phone, user_mobile_phone,
        user_email_address, user_date_of_birth, user_gender,
        user_shipping_email_address, user_shipping_first_name,
        user_shipping_last_name, user_shipping_street_address,
        user_shipping_street_address1, user_shipping_city, user_shipping_state,
        user_shipping_country, user_shipping_postal_code, user_status,
        user_creation_date)
        VALUES (${values.map((_, index) => `$${index + 1}`).join(",")}, CURRENT_DATE)
        RETURNING user_id AS id`,
      values,
    );
  }

  const columns = [
    "first_name",
    "last_name",
    "preferred_name",
    "street_address",
    "street_address1",
    "city",
    "state",
    "postal_code",
    "country",
    "day_phone",
    "mobile_phone",
    "email_address",
    "date_of_birth",
    "gender",
    "shipping_email_address",
    "shipping_first_name",
    "shipping_last_name",
    "shipping_street_address",
    "shipping_street_address1",
    "shipping_city",
    "shipping_state",
    "shipping_country",
    "shipping_postal_code",
    "status",
    "creation_date",
  ];
  return query(
    `INSERT INTO users (${columns.join(",")})
     VALUES (${values.map((_, index) => `$${index + 1}`).join(",")}, CURRENT_DATE)
     RETURNING id`,
    values,
  );
}

function userUpdate(data, id) {
  const values = userValues(data);
  if (useLegacyUsers()) {
    return query(
      `UPDATE alpenwild_user_tbl SET
       user_first_name=$1, user_last_name=$2, user_preferred_name=$3,
       user_street_address=$4, user_street_address1=$5, user_city=$6,
       user_state=$7, user_postal_code=$8, user_country=$9,
       user_day_phone=$10, user_mobile_phone=$11, user_email_address=$12,
       user_date_of_birth=$13, user_gender=$14,
       user_shipping_email_address=$15, user_shipping_first_name=$16,
       user_shipping_last_name=$17, user_shipping_street_address=$18,
       user_shipping_street_address1=$19, user_shipping_city=$20,
       user_shipping_state=$21, user_shipping_country=$22,
       user_shipping_postal_code=$23, user_status=$24
       WHERE user_id=$25 RETURNING user_id AS id`,
      [...values, id],
    );
  }
  const columns = [
    "first_name",
    "last_name",
    "preferred_name",
    "street_address",
    "street_address1",
    "city",
    "state",
    "postal_code",
    "country",
    "day_phone",
    "mobile_phone",
    "email_address",
    "date_of_birth",
    "gender",
    "shipping_email_address",
    "shipping_first_name",
    "shipping_last_name",
    "shipping_street_address",
    "shipping_street_address1",
    "shipping_city",
    "shipping_state",
    "shipping_country",
    "shipping_postal_code",
    "status",
  ];
  return query(
    `UPDATE users SET ${columns.map((column, index) => `${column}=$${index + 1}`).join(", ")},
     updated_at=NOW() WHERE id=$25 RETURNING id`,
    [...values, id],
  );
}

function userUpdateBookings(data, id) {
  if (!useLegacyUsers()) return Promise.resolve();
  const values = [
    data.user_first_name,
    data.user_last_name,
    data.user_preferred_name,
    data.user_street_address,
    data.user_street_address1,
    data.user_city,
    data.user_state,
    data.user_postal_code,
    data.user_country,
    data.user_day_phone,
    data.user_mobile_phone,
    data.user_date_of_birth,
    data.user_gender,
    data.user_shipping_email_address,
    data.user_shipping_first_name,
    data.user_shipping_last_name,
    data.user_shipping_street_address,
    data.user_shipping_street_address1,
    data.user_shipping_city,
    data.user_shipping_state,
    data.user_shipping_country,
    data.user_shipping_postal_code,
    id,
  ];
  return query(
    `UPDATE alpenwild_trips_booking_tbl SET
     user_first_name=$1, user_last_name=$2, user_preferred_name=$3,
     user_street_address=$4, user_street_address1=$5, user_city=$6,
     user_state=$7, user_postal_code=$8, user_country=$9,
     user_day_phone=$10, user_mobile_phone=$11, user_date_of_birth=$12,
     user_gender=$13, user_shipping_email_address=$14,
     user_shipping_first_name=$15, user_shipping_last_name=$16,
     user_shipping_street_address=$17, user_shipping_street_address1=$18,
     user_shipping_city=$19, user_shipping_state=$20,
     user_shipping_country=$21, user_shipping_postal_code=$22
     WHERE user_id=$23`,
    values,
  );
}

async function userHasOrders(id) {
  const table = await query("SELECT to_regclass($1) AS table_name", [
    config.userOrderTable,
  ]);
  if (!table.rows[0]?.table_name) return false;
  const result = await query(
    `SELECT 1 FROM ${config.userOrderTable} WHERE user_id=$1 LIMIT 1`,
    [id],
  );
  return Boolean(result.rowCount);
}

function serializeStaticPage(row) {
  return {
    ...row,
    id: Number(row.id),
    parent_id: Number(row.parent_id || 0),
    display_order: Number(row.display_order || 1),
    banner_image_url: row.banner_image
      ? `/uploads/${config.staticPageUploadSubdir}/${encodeURIComponent(row.banner_image)}`
      : null,
  };
}

async function staticPageBoxImages(staticPageId) {
  if (!useLegacyStaticPages()) return [];
  const result = await query(
    `SELECT static_page_box_image_id AS id,
      static_page_box_image AS image, static_page_box_image_alt AS image_alt,
      static_page_box_image_title AS title, static_page_box_image_link AS link,
      static_page_box_image_order AS display_order
     FROM alpenwild_static_page_box_image_tbl
     WHERE static_page_id=$1 ORDER BY static_page_box_image_order,
      static_page_box_image_id`,
    [staticPageId],
  );
  return result.rows.map((row) => ({
    ...row,
    image_url: row.image
      ? `/uploads/${config.staticPageUploadSubdir}/boximage/${encodeURIComponent(row.image)}`
      : null,
  }));
}

async function staticPageDescriptionBlocks(staticPageId) {
  if (!useLegacyStaticPages()) return [];
  const result = await query(
    `SELECT description_id AS id, description_image AS image, image_ratio,
      image_proportion, image_width, image_height,
      description_image_align AS image_align,
      description_image_caption AS image_caption,
      description_image_alt AS image_alt, text_wrap,
      new_description_text AS text, new_description_order AS display_order
     FROM alpenwild_static_page_description_tbl
     WHERE static_page_id=$1 ORDER BY new_description_order, description_id`,
    [staticPageId],
  );
  return result.rows.map((row) => ({
    ...row,
    image_align: normalizeStaticPageImageAlignment(row.image_align),
    image_url: row.image
      ? `/uploads/${config.staticPageUploadSubdir}/description/${encodeURIComponent(row.image)}`
      : null,
  }));
}

function parseStaticPageBoxes(value) {
  const parsed = value ? JSON.parse(value) : [];
  return z.array(staticPageBoxImageSchema).parse(parsed);
}

function parseStaticPageDescriptionBlocks(value) {
  const parsed = value ? JSON.parse(value) : [];
  return z.array(staticPageDescriptionBlockSchema).parse(parsed);
}

async function saveStaticPageBoxes(
  staticPageId,
  boxes,
  files,
  deleteMissing = true,
) {
  if (!useLegacyStaticPages()) return;
  const existingResult = await query(
    "SELECT static_page_box_image_id AS id FROM alpenwild_static_page_box_image_tbl WHERE static_page_id=$1",
    [staticPageId],
  );
  const submittedIds = new Set(
    boxes.filter((box) => box.id).map((box) => String(box.id)),
  );
  const existingIds = new Set(existingResult.rows.map((row) => String(row.id)));
  if ([...submittedIds].some((id) => !existingIds.has(id)))
    throw new Error("Invalid static page box image.");
  if (deleteMissing) {
    for (const row of existingResult.rows) {
      if (!submittedIds.has(String(row.id)))
        await query(
          "DELETE FROM alpenwild_static_page_box_image_tbl WHERE static_page_box_image_id=$1 AND static_page_id=$2",
          [row.id, staticPageId],
        );
    }
  }
  for (const [index, box] of boxes.entries()) {
    if (!box.title.trim() || !box.link.trim()) continue;
    const file = uploadedFile(files, `box_image_${index}`);
    let boxId = box.id;
    if (boxId) {
      const result = await query(
        `UPDATE alpenwild_static_page_box_image_tbl
         SET static_page_box_image_alt=$1, static_page_box_image_title=$2,
             static_page_box_image_link=$3, static_page_box_image_order=$4
         WHERE static_page_box_image_id=$5 AND static_page_id=$6
         RETURNING static_page_box_image_id AS id`,
        [
          box.image_alt,
          box.title,
          box.link,
          box.display_order,
          boxId,
          staticPageId,
        ],
      );
      if (!result.rowCount)
        throw new Error("Static page box image could not be updated.");
    } else {
      const result = await query(
        `INSERT INTO alpenwild_static_page_box_image_tbl
         (static_page_id, static_page_box_image, static_page_box_image_alt,
          static_page_box_image_title, static_page_box_image_link,
          static_page_box_image_order)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING static_page_box_image_id AS id`,
        [
          staticPageId,
          box.image,
          box.image_alt,
          box.title,
          box.link,
          box.display_order,
        ],
      );
      boxId = result.rows[0].id;
    }
    if (file) {
      const filename = safeFilename(file, `static-page-box-${boxId}`);
      await fs.rename(
        file.path,
        path.join(config.staticPageBoxImageUploadDir, filename),
      );
      await query(
        "UPDATE alpenwild_static_page_box_image_tbl SET static_page_box_image=$1 WHERE static_page_box_image_id=$2",
        [filename, boxId],
      );
    }
  }
}

async function saveStaticPageDescriptionBlocks(staticPageId, blocks, files) {
  if (!useLegacyStaticPages()) return;
  await query(
    "DELETE FROM alpenwild_static_page_description_tbl WHERE static_page_id=$1",
    [staticPageId],
  );
  for (const [index, block] of blocks.entries()) {
    const file = uploadedFile(files, `description_image_${index}`);
    if (!block.text.trim() && !block.image && !file) continue;
    let image = block.image;
    if (file) {
      image = safeFilename(file, `static-page-description-${staticPageId}`);
      await fs.rename(
        file.path,
        path.join(config.staticPageDescriptionUploadDir, image),
      );
    }
    await query(
      `INSERT INTO alpenwild_static_page_description_tbl
       (image_ratio, image_proportion, image_width, image_height,
        description_image_align, new_description_text, new_description_order,
        static_page_id, description_image_caption, text_wrap,
        description_image_alt, description_image)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        block.image_ratio,
        block.image_proportion,
        block.image_width,
        block.image_height,
        block.image_align,
        block.text,
        block.display_order,
        staticPageId,
        block.image_caption,
        block.text_wrap,
        block.image_alt,
        image,
      ],
    );
  }
}

function uploadedFile(files, fieldname) {
  return files?.find((file) => file.fieldname === fieldname);
}

function safeFilename(file, prefix) {
  return `${Date.now()}-${prefix}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function tripTypeBoxImagesFor(tripTypeIds) {
  if (!tripTypeIds.length) return new Map();
  const result = useLegacyTripTypes()
    ? await query(
        `SELECT trip_type_box_image_id AS id, trip_type_id, trip_type_box_image AS image,
          trip_type_box_image_alt AS image_alt, trip_type_box_image_title AS title,
          trip_type_box_image_link AS link
         FROM alpenwild_trip_type_box_image_tbl
         WHERE trip_type_id = ANY($1::int[]) ORDER BY trip_type_box_image_id ASC`,
        [tripTypeIds],
      )
    : await query(
        `SELECT id, trip_type_id, image, image_alt, title, link
         FROM trip_type_box_images
         WHERE trip_type_id = ANY($1::bigint[]) ORDER BY id ASC`,
        [tripTypeIds],
      );
  const grouped = new Map();
  for (const row of result.rows) {
    if (!grouped.has(row.trip_type_id)) grouped.set(row.trip_type_id, []);
    grouped.get(row.trip_type_id).push(row);
  }
  return grouped;
}

async function addTripTypeBoxImages(tripTypeId, boxes, files) {
  for (let index = 0; index < boxes.length; index += 1) {
    const box = boxes[index];
    const file = uploadedFile(files, `box_image_${index}`);
    const result = useLegacyTripTypes()
      ? await query(
          `INSERT INTO alpenwild_trip_type_box_image_tbl
            (trip_type_id, trip_type_box_image, trip_type_box_image_alt,
             trip_type_box_image_title, trip_type_box_image_link)
           VALUES ($1, $2, $3, $4, $5) RETURNING trip_type_box_image_id AS id`,
          [tripTypeId, box.image || "", box.image_alt, box.title, box.link],
        )
      : await query(
          `INSERT INTO trip_type_box_images
            (trip_type_id, image, image_alt, title, link)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [tripTypeId, box.image || "", box.image_alt, box.title, box.link],
        );
    const boxId = result.rows[0].id;
    if (!file) continue;
    const filename = safeFilename(file, `box-${boxId}`);
    await fs.rename(
      file.path,
      path.join(config.tripTypeBoxImageUploadDir, filename),
    );
    if (useLegacyTripTypes()) {
      await query(
        "UPDATE alpenwild_trip_type_box_image_tbl SET trip_type_box_image=$1 WHERE trip_type_box_image_id=$2",
        [filename, boxId],
      );
    } else {
      await query("UPDATE trip_type_box_images SET image=$1 WHERE id=$2", [
        filename,
        boxId,
      ]);
    }
  }
}

async function saveTripTypeBoxImages(tripTypeId, boxes, files) {
  for (let index = 0; index < boxes.length; index += 1) {
    const box = boxes[index];
    if (!box.title.trim() || !box.link.trim()) continue;
    const file = uploadedFile(files, `box_image_${index}`);
    const filename = file ? safeFilename(file, `box-${box.id || "new"}`) : null;
    if (file) {
      await fs.rename(
        file.path,
        path.join(config.tripTypeBoxImageUploadDir, filename),
      );
    }

    if (box.id) {
      const result = useLegacyTripTypes()
        ? await query(
            `UPDATE alpenwild_trip_type_box_image_tbl
             SET trip_type_box_image=COALESCE($1, trip_type_box_image),
                 trip_type_box_image_alt=$2, trip_type_box_image_title=$3,
                 trip_type_box_image_link=$4
             WHERE trip_type_box_image_id=$5 AND trip_type_id=$6
             RETURNING trip_type_box_image_id`,
            [filename, box.image_alt, box.title, box.link, box.id, tripTypeId],
          )
        : await query(
            `UPDATE trip_type_box_images
             SET image=COALESCE($1, image), image_alt=$2, title=$3, link=$4
             WHERE id=$5 AND trip_type_id=$6 RETURNING id`,
            [filename, box.image_alt, box.title, box.link, box.id, tripTypeId],
          );
      if (!result.rowCount)
        throw new Error("Trip type box image could not be updated.");
      continue;
    }

    if (useLegacyTripTypes()) {
      await query(
        `INSERT INTO alpenwild_trip_type_box_image_tbl
            (trip_type_id, trip_type_box_image, trip_type_box_image_alt,
             trip_type_box_image_title, trip_type_box_image_link)
           VALUES ($1, $2, $3, $4, $5)`,
        [
          tripTypeId,
          filename || box.image || "",
          box.image_alt,
          box.title,
          box.link,
        ],
      );
    } else {
      await query(
        `INSERT INTO trip_type_box_images
            (trip_type_id, image, image_alt, title, link)
           VALUES ($1, $2, $3, $4, $5)`,
        [
          tripTypeId,
          filename || box.image || "",
          box.image_alt,
          box.title,
          box.link,
        ],
      );
    }
  }
}

async function ensureLegacyBannerIdentity() {
  if (!useLegacyBanners()) return;

  await query(
    "CREATE SEQUENCE IF NOT EXISTS alpenwild_banner_tbl_banner_id_seq",
  );
  await query(
    "ALTER SEQUENCE alpenwild_banner_tbl_banner_id_seq OWNED BY alpenwild_banner_tbl.banner_id",
  );
  await query(
    "SELECT setval($$alpenwild_banner_tbl_banner_id_seq$$, COALESCE((SELECT MAX(banner_id) FROM alpenwild_banner_tbl), 0) + 1, false)",
  );
  await query(
    "ALTER TABLE alpenwild_banner_tbl ALTER COLUMN banner_id SET DEFAULT nextval($$alpenwild_banner_tbl_banner_id_seq$$)",
  );
}

async function ensureLegacyShopOrderIdentity() {
  const idColumns = [
    {
      table: "alpenwild_order_tbl",
      candidates: ["order_id"],
      sequence: "alpenwild_order_tbl_order_id_seq",
    },
    {
      table: "alpenwild_order_details_tbl",
      candidates: ["order_detail_id", "order_details_id"],
      sequence: "alpenwild_order_details_tbl_order_details_id_seq",
    },
    {
      table: "alpenwild_order_attribute_details_tbl",
      candidates: ["order_attribute_detail_id", "order_attribute_details_id"],
      sequence:
        "alpenwild_order_attribute_details_tbl_order_attribute_details_id_seq",
    },
  ];

  for (const { table, candidates, sequence } of idColumns) {
    const result = await query(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_schema=current_schema()
          AND table_name=$1
          AND column_name=ANY($2::text[])
        ORDER BY array_position($2::text[], column_name)
        LIMIT 1`,
      [table, candidates],
    );
    const column = result.rows[0]?.column_name;
    if (!column) continue;

    await query(`CREATE SEQUENCE IF NOT EXISTS "${sequence}"`);
    await query(`ALTER SEQUENCE "${sequence}" OWNED BY "${table}"."${column}"`);
    await query(
      `SELECT setval('"${sequence}"'::regclass, COALESCE((SELECT MAX("${column}") FROM "${table}"), 0) + 1, false)`,
    );
    await query(
      `ALTER TABLE "${table}" ALTER COLUMN "${column}" SET DEFAULT nextval('"${sequence}"'::regclass)`,
    );
  }
}

async function ensureLegacyCategoryIdentity() {
  if (!useLegacyCategories()) return;
  if (
    await resetIdentitySequenceIfNeeded("alpenwild_category_tbl", "category_id")
  )
    return;
  await query("CREATE SEQUENCE IF NOT EXISTS alpenwild_category_id_seq");
  await query(
    "ALTER SEQUENCE alpenwild_category_id_seq OWNED BY alpenwild_category_tbl.category_id",
  );
  await query(
    "SELECT setval($$alpenwild_category_id_seq$$, COALESCE((SELECT MAX(category_id) FROM alpenwild_category_tbl), 0) + 1, false)",
  );
  await query(
    "ALTER TABLE alpenwild_category_tbl ALTER COLUMN category_id SET DEFAULT nextval($$alpenwild_category_id_seq$$)",
  );
}

async function ensureLegacyCategoryBoxImageIdentity() {
  if (!useLegacyCategories()) return;
  if (
    await resetIdentitySequenceIfNeeded(
      "alpenwild_category_box_image_tbl",
      "category_box_image_id",
    )
  )
    return;
  await query(
    "CREATE SEQUENCE IF NOT EXISTS alpenwild_category_box_image_id_seq",
  );
  await query(
    "ALTER SEQUENCE alpenwild_category_box_image_id_seq OWNED BY alpenwild_category_box_image_tbl.category_box_image_id",
  );
  await query(
    "SELECT setval($$alpenwild_category_box_image_id_seq$$, COALESCE((SELECT MAX(category_box_image_id) FROM alpenwild_category_box_image_tbl), 0) + 1, false)",
  );
  await query(
    "ALTER TABLE alpenwild_category_box_image_tbl ALTER COLUMN category_box_image_id SET DEFAULT nextval($$alpenwild_category_box_image_id_seq$$)",
  );
}

async function ensureLegacyAttributeTypeIdentity() {
  if (!useLegacyAttributeTypes()) return;
  if (
    await resetIdentitySequenceIfNeeded(
      "alpenwild_attribute_type_tbl",
      "attribute_type_id",
    )
  )
    return;
  await query("CREATE SEQUENCE IF NOT EXISTS alpenwild_attribute_type_id_seq");
  await query(
    "ALTER SEQUENCE alpenwild_attribute_type_id_seq OWNED BY alpenwild_attribute_type_tbl.attribute_type_id",
  );
  await query(
    "SELECT setval($$alpenwild_attribute_type_id_seq$$, COALESCE((SELECT MAX(attribute_type_id) FROM alpenwild_attribute_type_tbl), 0) + 1, false)",
  );
  await query(
    "ALTER TABLE alpenwild_attribute_type_tbl ALTER COLUMN attribute_type_id SET DEFAULT nextval($$alpenwild_attribute_type_id_seq$$)",
  );
}

async function ensureLegacyAttributeValueIdentity() {
  if (!useLegacyAttributeValues()) return;
  if (
    await resetIdentitySequenceIfNeeded(
      "alpenwild_attribute_value_tbl",
      "attribute_value_id",
    )
  )
    return;
  await query("CREATE SEQUENCE IF NOT EXISTS alpenwild_attribute_value_id_seq");
  await query(
    "ALTER SEQUENCE alpenwild_attribute_value_id_seq OWNED BY alpenwild_attribute_value_tbl.attribute_value_id",
  );
  await query(
    "SELECT setval($$alpenwild_attribute_value_id_seq$$, COALESCE((SELECT MAX(attribute_value_id) FROM alpenwild_attribute_value_tbl), 0) + 1, false)",
  );
  await query(
    "ALTER TABLE alpenwild_attribute_value_tbl ALTER COLUMN attribute_value_id SET DEFAULT nextval($$alpenwild_attribute_value_id_seq$$)",
  );
}

async function ensureLegacyPromotionIdentity() {
  if (!useLegacyPromotions()) return;

  await query(
    "CREATE SEQUENCE IF NOT EXISTS alpenwild_offers_promotions_id_seq",
  );
  await query(
    "ALTER SEQUENCE alpenwild_offers_promotions_id_seq OWNED BY alpenwild_offers_promotions_tbl.offers_promotions_id",
  );
  await query(
    "SELECT setval($$alpenwild_offers_promotions_id_seq$$, COALESCE((SELECT MAX(offers_promotions_id) FROM alpenwild_offers_promotions_tbl), 0) + 1, false)",
  );
  await query(
    "ALTER TABLE alpenwild_offers_promotions_tbl ALTER COLUMN offers_promotions_id SET DEFAULT nextval($$alpenwild_offers_promotions_id_seq$$)",
  );
}

async function ensureLegacySpecialFeatureIdentity() {
  if (!useLegacySpecialFeatures()) return;

  await query("CREATE SEQUENCE IF NOT EXISTS alpenwild_special_feature_id_seq");
  await query(
    "ALTER SEQUENCE alpenwild_special_feature_id_seq OWNED BY alpenwild_special_feature_tbl.special_feature_id",
  );
  await query(
    "SELECT setval($$alpenwild_special_feature_id_seq$$, COALESCE((SELECT MAX(special_feature_id) FROM alpenwild_special_feature_tbl), 0) + 1, false)",
  );
  await query(
    "ALTER TABLE alpenwild_special_feature_tbl ALTER COLUMN special_feature_id SET DEFAULT nextval($$alpenwild_special_feature_id_seq$$)",
  );
}

async function ensureLegacyFooterMenuIdentity() {
  if (!useLegacyFooterMenus()) return;
  await query("CREATE SEQUENCE IF NOT EXISTS alpenwild_footer_menu_id_seq");
  await query(
    "ALTER SEQUENCE alpenwild_footer_menu_id_seq OWNED BY alpenwild_footer_menu_tbl.footer_menu_id",
  );
  await query(
    "SELECT setval($$alpenwild_footer_menu_id_seq$$, COALESCE((SELECT MAX(footer_menu_id) FROM alpenwild_footer_menu_tbl), 0) + 1, false)",
  );
  await query(
    "ALTER TABLE alpenwild_footer_menu_tbl ALTER COLUMN footer_menu_id SET DEFAULT nextval($$alpenwild_footer_menu_id_seq$$)",
  );
}

async function ensureLegacyTripTypeIdentity() {
  if (!useLegacyTripTypes()) return;
  await query("CREATE SEQUENCE IF NOT EXISTS alpenwild_trip_type_id_seq");
  await query(
    "ALTER SEQUENCE alpenwild_trip_type_id_seq OWNED BY alpenwild_trip_type_tbl.trip_type_id",
  );
  await query(
    "SELECT setval($$alpenwild_trip_type_id_seq$$, COALESCE((SELECT MAX(trip_type_id) FROM alpenwild_trip_type_tbl), 0) + 1, false)",
  );
  await query(
    "ALTER TABLE alpenwild_trip_type_tbl ALTER COLUMN trip_type_id SET DEFAULT nextval($$alpenwild_trip_type_id_seq$$)",
  );
}

async function resetIdentitySequenceIfNeeded(table, column) {
  const identity = await query(
    "SELECT is_identity FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=$1 AND column_name=$2",
    [table, column],
  );
  if (identity.rows[0]?.is_identity !== "YES") return false;

  await query(
    `SELECT setval(pg_get_serial_sequence($$${table}$$, $$${column}$$), COALESCE((SELECT MAX("${column}") FROM "${table}"), 0) + 1, false)`,
  );
  return true;
}

async function ensureLegacyTripTypeBoxImageIdentity() {
  if (!useLegacyTripTypes()) return;
  if (
    await resetIdentitySequenceIfNeeded(
      "alpenwild_trip_type_box_image_tbl",
      "trip_type_box_image_id",
    )
  )
    return;
  await query(
    "CREATE SEQUENCE IF NOT EXISTS alpenwild_trip_type_box_image_id_seq",
  );
  await query(
    "ALTER SEQUENCE alpenwild_trip_type_box_image_id_seq OWNED BY alpenwild_trip_type_box_image_tbl.trip_type_box_image_id",
  );
  await query(
    "SELECT setval($$alpenwild_trip_type_box_image_id_seq$$, COALESCE((SELECT MAX(trip_type_box_image_id) FROM alpenwild_trip_type_box_image_tbl), 0) + 1, false)",
  );
  await query(
    "ALTER TABLE alpenwild_trip_type_box_image_tbl ALTER COLUMN trip_type_box_image_id SET DEFAULT nextval($$alpenwild_trip_type_box_image_id_seq$$)",
  );
}

async function ensureLegacyLocationIdentity() {
  if (!useLegacyLocations()) return;
  await query("CREATE SEQUENCE IF NOT EXISTS alpenwild_location_id_seq");
  await query(
    "ALTER SEQUENCE alpenwild_location_id_seq OWNED BY alpenwild_location_tbl.location_id",
  );
  await query(
    "SELECT setval($$alpenwild_location_id_seq$$, COALESCE((SELECT MAX(location_id) FROM alpenwild_location_tbl), 0) + 1, false)",
  );
  await query(
    "ALTER TABLE alpenwild_location_tbl ALTER COLUMN location_id SET DEFAULT nextval($$alpenwild_location_id_seq$$)",
  );
}

async function ensureLegacyActivityIdentity() {
  if (!useLegacyActivities()) return;
  await query("CREATE SEQUENCE IF NOT EXISTS alpenwild_activity_id_seq");
  await query(
    "ALTER SEQUENCE alpenwild_activity_id_seq OWNED BY alpenwild_activity_tbl.activity_id",
  );
  await query(
    "SELECT setval($$alpenwild_activity_id_seq$$, COALESCE((SELECT MAX(activity_id) FROM alpenwild_activity_tbl), 0) + 1, false)",
  );
  await query(
    "ALTER TABLE alpenwild_activity_tbl ALTER COLUMN activity_id SET DEFAULT nextval($$alpenwild_activity_id_seq$$)",
  );
}

async function ensureLegacyDiscountIdentity() {
  if (!useLegacyDiscounts()) return;
  await query("CREATE SEQUENCE IF NOT EXISTS alpenwild_discount_id_seq");
  await query(
    "ALTER SEQUENCE alpenwild_discount_id_seq OWNED BY alpenwild_discount_tbl.discount_id",
  );
  await query(
    "SELECT setval($$alpenwild_discount_id_seq$$, COALESCE((SELECT MAX(discount_id) FROM alpenwild_discount_tbl), 0) + 1, false)",
  );
  await query(
    "ALTER TABLE alpenwild_discount_tbl ALTER COLUMN discount_id SET DEFAULT nextval($$alpenwild_discount_id_seq$$)",
  );
}

async function ensureLegacyUserIdentity() {
  if (!useLegacyUsers()) return;
  await query("CREATE SEQUENCE IF NOT EXISTS alpenwild_user_id_seq");
  await query(
    "ALTER SEQUENCE alpenwild_user_id_seq OWNED BY alpenwild_user_tbl.user_id",
  );
  await query(
    "SELECT setval($$alpenwild_user_id_seq$$, COALESCE((SELECT MAX(user_id) FROM alpenwild_user_tbl), 0) + 1, false)",
  );
  await query(
    "ALTER TABLE alpenwild_user_tbl ALTER COLUMN user_id SET DEFAULT nextval($$alpenwild_user_id_seq$$)",
  );
}

async function ensureLegacyTripBookingIdentity() {
  if (!useLegacyTrips()) return;
  await query("CREATE SEQUENCE IF NOT EXISTS alpenwild_trips_booking_id_seq");
  await query(
    "ALTER SEQUENCE alpenwild_trips_booking_id_seq OWNED BY alpenwild_trips_booking_tbl.trips_booking_id",
  );
  await query(
    "SELECT setval($$alpenwild_trips_booking_id_seq$$, COALESCE((SELECT MAX(trips_booking_id) FROM alpenwild_trips_booking_tbl), 0) + 1, false)",
  );
  await query(
    "ALTER TABLE alpenwild_trips_booking_tbl ALTER COLUMN trips_booking_id SET DEFAULT nextval($$alpenwild_trips_booking_id_seq$$)",
  );
}

async function ensureLegacyTripPaymentIdentity() {
  if (!useLegacyTrips()) return;
  await query("CREATE SEQUENCE IF NOT EXISTS alpenwild_trips_payment_id_seq");
  await query(
    "ALTER SEQUENCE alpenwild_trips_payment_id_seq OWNED BY alpenwild_trips_payment_tbl.trips_payment_id",
  );
  await query(
    "SELECT setval($$alpenwild_trips_payment_id_seq$$, COALESCE((SELECT MAX(trips_payment_id) FROM alpenwild_trips_payment_tbl), 0) + 1, false)",
  );
  await query(
    "ALTER TABLE alpenwild_trips_payment_tbl ALTER COLUMN trips_payment_id SET DEFAULT nextval($$alpenwild_trips_payment_id_seq$$)",
  );
}

async function ensureInvoiceIdentity() {
  if (
    await resetIdentitySequenceIfNeeded("alpenwild_invoice_tbl", "invoice_id")
  )
    return;
  await query("CREATE SEQUENCE IF NOT EXISTS alpenwild_invoice_id_seq");
  await query(
    "ALTER SEQUENCE alpenwild_invoice_id_seq OWNED BY alpenwild_invoice_tbl.invoice_id",
  );
  await query(
    "SELECT setval($$alpenwild_invoice_id_seq$$, COALESCE((SELECT MAX(invoice_id) FROM alpenwild_invoice_tbl), 0) + 1, false)",
  );
  await query(
    "ALTER TABLE alpenwild_invoice_tbl ALTER COLUMN invoice_id SET DEFAULT nextval($$alpenwild_invoice_id_seq$$)",
  );
}

async function ensureLegacyTripAdditionalPriceIdentity() {
  if (!useLegacyTrips()) return;
  await query(
    "CREATE SEQUENCE IF NOT EXISTS alpenwild_trips_additional_price_id_seq",
  );
  await query(
    "ALTER SEQUENCE alpenwild_trips_additional_price_id_seq OWNED BY alpenwild_trips_additional_price_tbl.trips_additional_price_id",
  );
  await query(
    "SELECT setval($$alpenwild_trips_additional_price_id_seq$$, COALESCE((SELECT MAX(trips_additional_price_id) FROM alpenwild_trips_additional_price_tbl), 0) + 1, false)",
  );
  await query(
    "ALTER TABLE alpenwild_trips_additional_price_tbl ALTER COLUMN trips_additional_price_id SET DEFAULT nextval($$alpenwild_trips_additional_price_id_seq$$)",
  );
}

async function ensureLegacyProductIdentity() {
  if (!useLegacyProducts()) return;
  if (
    await resetIdentitySequenceIfNeeded("alpenwild_product_tbl", "product_id")
  )
    return;
  await query("CREATE SEQUENCE IF NOT EXISTS alpenwild_product_id_seq");
  await query(
    "ALTER SEQUENCE alpenwild_product_id_seq OWNED BY alpenwild_product_tbl.product_id",
  );
  await query(
    "SELECT setval($$alpenwild_product_id_seq$$, COALESCE((SELECT MAX(product_id) FROM alpenwild_product_tbl), 0) + 1, false)",
  );
  await query(
    "ALTER TABLE alpenwild_product_tbl ALTER COLUMN product_id SET DEFAULT nextval($$alpenwild_product_id_seq$$)",
  );
}

async function ensureLegacyProductAdditionalImageIdentity() {
  if (!useLegacyProducts()) return;
  if (
    await resetIdentitySequenceIfNeeded(
      "alpenwild_product_additional_image_tbl",
      "product_additional_image_id",
    )
  )
    return;
  await query(
    "CREATE SEQUENCE IF NOT EXISTS alpenwild_product_additional_image_id_seq",
  );
  await query(
    "ALTER SEQUENCE alpenwild_product_additional_image_id_seq OWNED BY alpenwild_product_additional_image_tbl.product_additional_image_id",
  );
  await query(
    "SELECT setval($$alpenwild_product_additional_image_id_seq$$, COALESCE((SELECT MAX(product_additional_image_id) FROM alpenwild_product_additional_image_tbl), 0) + 1, false)",
  );
  await query(
    "ALTER TABLE alpenwild_product_additional_image_tbl ALTER COLUMN product_additional_image_id SET DEFAULT nextval($$alpenwild_product_additional_image_id_seq$$)",
  );
}

async function ensureLegacyProductBoxImageIdentity() {
  if (!useLegacyProducts()) return;
  if (
    await resetIdentitySequenceIfNeeded(
      "alpenwild_product_box_image_tbl",
      "product_box_image_id",
    )
  )
    return;
  await query(
    "CREATE SEQUENCE IF NOT EXISTS alpenwild_product_box_image_id_seq",
  );
  await query(
    "ALTER SEQUENCE alpenwild_product_box_image_id_seq OWNED BY alpenwild_product_box_image_tbl.product_box_image_id",
  );
  await query(
    "SELECT setval($$alpenwild_product_box_image_id_seq$$, COALESCE((SELECT MAX(product_box_image_id) FROM alpenwild_product_box_image_tbl), 0) + 1, false)",
  );
  await query(
    "ALTER TABLE alpenwild_product_box_image_tbl ALTER COLUMN product_box_image_id SET DEFAULT nextval($$alpenwild_product_box_image_id_seq$$)",
  );
}

async function ensurePublicTripPaymentRequestTable() {
  if (!config.databaseUrl) return;
  await query(
    `CREATE TABLE IF NOT EXISTS alpenwild_public_trip_payment_request_tbl (
      request_id UUID PRIMARY KEY,
      booking_id BIGINT NOT NULL,
      request_fingerprint TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('processing', 'paid', 'declined')),
      payment_id BIGINT,
      transaction_id TEXT,
      response_message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  );
}

async function ensureLegacyMailingListIdentity() {
  await query("CREATE SEQUENCE IF NOT EXISTS alpenwild_mailing_list_id_seq");
  await query(
    "ALTER SEQUENCE alpenwild_mailing_list_id_seq OWNED BY alpenwild_mailing_list_tbl.mailing_list_id",
  );
  await query(
    "SELECT setval($$alpenwild_mailing_list_id_seq$$, COALESCE((SELECT MAX(mailing_list_id) FROM alpenwild_mailing_list_tbl), 0) + 1, false)",
  );
  await query(
    "ALTER TABLE alpenwild_mailing_list_tbl ALTER COLUMN mailing_list_id SET DEFAULT nextval($$alpenwild_mailing_list_id_seq$$)",
  );
}

async function ensureLegacyStaticPageDescriptionIdentity() {
  if (!useLegacyStaticPages()) return;
  await query(
    "CREATE SEQUENCE IF NOT EXISTS alpenwild_static_page_description_id_seq",
  );
  await query(
    "ALTER SEQUENCE alpenwild_static_page_description_id_seq OWNED BY alpenwild_static_page_description_tbl.description_id",
  );
  await query(
    "SELECT setval($$alpenwild_static_page_description_id_seq$$, COALESCE((SELECT MAX(description_id) FROM alpenwild_static_page_description_tbl), 0) + 1, false)",
  );
  await query(
    "ALTER TABLE alpenwild_static_page_description_tbl ALTER COLUMN description_id SET DEFAULT nextval($$alpenwild_static_page_description_id_seq$$)",
  );
}

async function ensureLegacyStaticPageIdentity() {
  if (!useLegacyStaticPages()) return;
  if (
    await resetIdentitySequenceIfNeeded(
      "alpenwild_static_page_tbl",
      "static_page_id",
    )
  )
    return;
  await query("CREATE SEQUENCE IF NOT EXISTS alpenwild_static_page_id_seq");
  await query(
    "ALTER SEQUENCE alpenwild_static_page_id_seq OWNED BY alpenwild_static_page_tbl.static_page_id",
  );
  await query(
    "SELECT setval($$alpenwild_static_page_id_seq$$, COALESCE((SELECT MAX(static_page_id) FROM alpenwild_static_page_tbl), 0) + 1, false)",
  );
  await query(
    "ALTER TABLE alpenwild_static_page_tbl ALTER COLUMN static_page_id SET DEFAULT nextval($$alpenwild_static_page_id_seq$$)",
  );
}

async function ensureLegacyStaticPageBoxImageIdentity() {
  if (!useLegacyStaticPages()) return;
  if (
    await resetIdentitySequenceIfNeeded(
      "alpenwild_static_page_box_image_tbl",
      "static_page_box_image_id",
    )
  )
    return;
  await query(
    "CREATE SEQUENCE IF NOT EXISTS alpenwild_static_page_box_image_id_seq",
  );
  await query(
    "ALTER SEQUENCE alpenwild_static_page_box_image_id_seq OWNED BY alpenwild_static_page_box_image_tbl.static_page_box_image_id",
  );
  await query(
    "SELECT setval($$alpenwild_static_page_box_image_id_seq$$, COALESCE((SELECT MAX(static_page_box_image_id) FROM alpenwild_static_page_box_image_tbl), 0) + 1, false)",
  );
  await query(
    "ALTER TABLE alpenwild_static_page_box_image_tbl ALTER COLUMN static_page_box_image_id SET DEFAULT nextval($$alpenwild_static_page_box_image_id_seq$$)",
  );
}

async function ensureLegacyContestIdentity() {
  if (await resetIdentitySequenceIfNeeded("alpenwild_contest_tbl", "id"))
    return;
  await query("CREATE SEQUENCE IF NOT EXISTS alpenwild_contest_id_seq");
  await query(
    "ALTER SEQUENCE alpenwild_contest_id_seq OWNED BY alpenwild_contest_tbl.id",
  );
  await query(
    "SELECT setval($$alpenwild_contest_id_seq$$, COALESCE((SELECT MAX(id) FROM alpenwild_contest_tbl), 0) + 1, false)",
  );
  await query(
    "ALTER TABLE alpenwild_contest_tbl ALTER COLUMN id SET DEFAULT nextval($$alpenwild_contest_id_seq$$)",
  );
}

async function ensureLegacyRedirectionIdentity() {
  if (!useLegacyRedirections()) return;
  if (
    await resetIdentitySequenceIfNeeded(
      "alpenwild_redirection_tbl",
      "redirection_id",
    )
  )
    return;
  await query("CREATE SEQUENCE IF NOT EXISTS alpenwild_redirection_id_seq");
  await query(
    "ALTER SEQUENCE alpenwild_redirection_id_seq OWNED BY alpenwild_redirection_tbl.redirection_id",
  );
  await query(
    "SELECT setval($$alpenwild_redirection_id_seq$$, COALESCE((SELECT MAX(redirection_id) FROM alpenwild_redirection_tbl), 0) + 1, false)",
  );
  await query(
    "ALTER TABLE alpenwild_redirection_tbl ALTER COLUMN redirection_id SET DEFAULT nextval($$alpenwild_redirection_id_seq$$)",
  );
}

async function ensureLegacyTripIdentity() {
  if (!useLegacyTrips()) return;
  await query("CREATE SEQUENCE IF NOT EXISTS alpenwild_trips_id_seq");
  await query(
    "ALTER SEQUENCE alpenwild_trips_id_seq OWNED BY alpenwild_trips_tbl.trips_id",
  );
  await query(
    "SELECT setval($$alpenwild_trips_id_seq$$, COALESCE((SELECT MAX(trips_id) FROM alpenwild_trips_tbl), 0) + 1, false)",
  );
  await query(
    "ALTER TABLE alpenwild_trips_tbl ALTER COLUMN trips_id SET DEFAULT nextval($$alpenwild_trips_id_seq$$)",
  );
}

async function ensureLegacyTripLeaderIdentity() {
  if (!useLegacyTripLeaders()) return;
  await query("CREATE SEQUENCE IF NOT EXISTS alpenwild_trip_leader_id_seq");
  await query(
    "ALTER SEQUENCE alpenwild_trip_leader_id_seq OWNED BY alpenwild_trip_leader_tbl.trip_leader_id",
  );
  await query(
    "SELECT setval($$alpenwild_trip_leader_id_seq$$, COALESCE((SELECT MAX(trip_leader_id) FROM alpenwild_trip_leader_tbl), 0) + 1, false)",
  );
  await query(
    "ALTER TABLE alpenwild_trip_leader_tbl ALTER COLUMN trip_leader_id SET DEFAULT nextval($$alpenwild_trip_leader_id_seq$$)",
  );
}

async function ensureLegacyTripLeaderDescriptionIdentity() {
  if (!useLegacyTripLeaders()) return;
  await query(
    "CREATE SEQUENCE IF NOT EXISTS alpenwild_trip_leader_description_id_seq",
  );
  await query(
    "ALTER SEQUENCE alpenwild_trip_leader_description_id_seq OWNED BY alpenwild_trip_leader_description_tbl.description_id",
  );
  await query(
    "SELECT setval($$alpenwild_trip_leader_description_id_seq$$, COALESCE((SELECT MAX(description_id) FROM alpenwild_trip_leader_description_tbl), 0) + 1, false)",
  );
  await query(
    "ALTER TABLE alpenwild_trip_leader_description_tbl ALTER COLUMN description_id SET DEFAULT nextval($$alpenwild_trip_leader_description_id_seq$$)",
  );
}

async function ensureLegacyTripGalleryIdentity() {
  if (!useLegacyTrips()) return;
  if (
    await resetIdentitySequenceIfNeeded(
      "alpenwild_trips_gallery_tbl",
      "trips_gallery_id",
    )
  )
    return;
  await query("CREATE SEQUENCE IF NOT EXISTS alpenwild_trips_gallery_id_seq");
  await query(
    "ALTER SEQUENCE alpenwild_trips_gallery_id_seq OWNED BY alpenwild_trips_gallery_tbl.trips_gallery_id",
  );
  await query(
    "SELECT setval($$alpenwild_trips_gallery_id_seq$$, COALESCE((SELECT MAX(trips_gallery_id) FROM alpenwild_trips_gallery_tbl), 0) + 1, false)",
  );
  await query(
    "ALTER TABLE alpenwild_trips_gallery_tbl ALTER COLUMN trips_gallery_id SET DEFAULT nextval($$alpenwild_trips_gallery_id_seq$$)",
  );
}

async function ensureLegacyTripFaqIdentity() {
  if (!useLegacyTrips()) return;
  if (await resetIdentitySequenceIfNeeded("alpenwild_faq_page_tbl", "id"))
    return;
  await query("CREATE SEQUENCE IF NOT EXISTS alpenwild_faq_page_tbl_id_seq");
  await query(
    "ALTER SEQUENCE alpenwild_faq_page_tbl_id_seq OWNED BY alpenwild_faq_page_tbl.id",
  );
  await query(
    "SELECT setval($$alpenwild_faq_page_tbl_id_seq$$, COALESCE((SELECT MAX(id) FROM alpenwild_faq_page_tbl), 0) + 1, false)",
  );
  await query(
    "ALTER TABLE alpenwild_faq_page_tbl ALTER COLUMN id SET DEFAULT nextval($$alpenwild_faq_page_tbl_id_seq$$)",
  );
}

async function ensureLegacyTestimonialIdentity() {
  if (!useLegacyTestimonials()) return;
  await query("CREATE SEQUENCE IF NOT EXISTS alpenwild_testimonial_id_seq");
  await query(
    "ALTER SEQUENCE alpenwild_testimonial_id_seq OWNED BY alpenwild_testimonial_tbl.testimonial_id",
  );
  await query(
    "SELECT setval($$alpenwild_testimonial_id_seq$$, COALESCE((SELECT MAX(testimonial_id) FROM alpenwild_testimonial_tbl), 0) + 1, false)",
  );
  await query(
    "ALTER TABLE alpenwild_testimonial_tbl ALTER COLUMN testimonial_id SET DEFAULT nextval($$alpenwild_testimonial_id_seq$$)",
  );
}

async function ensureLegacyTripItineraryIdentity() {
  if (!useLegacyTrips()) return;
  await query("CREATE SEQUENCE IF NOT EXISTS alpenwild_trips_itinerary_id_seq");
  await query(
    "ALTER SEQUENCE alpenwild_trips_itinerary_id_seq OWNED BY alpenwild_trips_itinerary_tbl.trips_itinerary_id",
  );
  await query(
    "SELECT setval($$alpenwild_trips_itinerary_id_seq$$, COALESCE((SELECT MAX(trips_itinerary_id) FROM alpenwild_trips_itinerary_tbl), 0) + 1, false)",
  );
  await query(
    "ALTER TABLE alpenwild_trips_itinerary_tbl ALTER COLUMN trips_itinerary_id SET DEFAULT nextval($$alpenwild_trips_itinerary_id_seq$$)",
  );
}

async function ensureLegacyProductAttributeIdentity() {
  if (!useLegacyProductAttributes()) return;
  await query(
    "CREATE SEQUENCE IF NOT EXISTS alpenwild_product_attribute_value_id_seq",
  );
  await query(
    "ALTER SEQUENCE alpenwild_product_attribute_value_id_seq OWNED BY alpenwild_product_attribute_value_tbl.product_attribute_value_id",
  );
  await query(
    "SELECT setval($$alpenwild_product_attribute_value_id_seq$$, COALESCE((SELECT MAX(product_attribute_value_id) FROM alpenwild_product_attribute_value_tbl), 0) + 1, false)",
  );
  await query(
    "ALTER TABLE alpenwild_product_attribute_value_tbl ALTER COLUMN product_attribute_value_id SET DEFAULT nextval($$alpenwild_product_attribute_value_id_seq$$)",
  );
  await query(
    "ALTER TABLE alpenwild_product_attribute_value_tbl ADD COLUMN IF NOT EXISTS product_attribute_value_status VARCHAR(20) NOT NULL DEFAULT 'Active'",
  );
}

app.use(createHealthRouter());

app.use(
  createAttributesRouter({
    query,
    simpleNameSchema,
    useLegacyAttributeTypes,
    useLegacyAttributeValues,
    useLegacyProductAttributes,
  }),
);
app.use(createDiscountsRouter({ query, useLegacyDiscounts }));
app.use(
  createProductAttributesRouter({
    query,
    useLegacyProductAttributes,
    useLegacyProducts,
    useLegacyAttributeTypes,
    useLegacyAttributeValues,
  }),
);

function productSelect() {
  return `SELECT p.product_id AS id, p.product_name AS name, p.product_slug AS slug,
    p.category_id, c.category_name AS category_name, p.product_menu_name AS menu_name,
    p.product_meta_title AS meta_title, p.product_meta_descriptions AS meta_descriptions,
    p.product_meta_keywords AS meta_keywords, p.product_short_descriptions AS short_descriptions,
    p.product_description AS description, p.product_price AS price,
    p.product_banner_title AS banner_title, p.product_banner_sub_title AS banner_sub_title,
    p.product_tooltip_text AS tooltip_text, p.product_banner AS banner_image,
    p.product_banner_alt AS banner_alt, p.product_listing_image AS listing_image,
    p.product_listing_image_alt AS listing_image_alt, p.product_order AS display_order,
    p.product_status AS status
    FROM alpenwild_product_tbl p
    LEFT JOIN alpenwild_category_tbl c ON c.category_id = p.category_id`;
}

async function getTripBookingDiscount(code, baseAmount) {
  if (!code) return { amount: 0, description: "" };
  const discountResult = useLegacyDiscounts()
    ? await query(
        `SELECT discount_name AS name, discount_code AS code,
                discount_type AS type, discount_value AS value
           FROM alpenwild_discount_tbl
           WHERE discount_code=$1 AND discount_status='Active'
             AND discount_start_date <= CURRENT_DATE AND discount_end_date >= CURRENT_DATE
           LIMIT 1`,
        [code],
      )
    : await query(
        `SELECT name, code, type, value FROM discounts
           WHERE code=$1 AND status='Active'
             AND start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE
           LIMIT 1`,
        [code],
      );
  const discount = discountResult.rows[0];
  if (!discount) return null;
  const value = Number(discount.value);
  if (!Number.isFinite(value) || value < 0)
    throw new Error("Discount value is invalid.");
  return {
    amount: discount.type === "Percentage" ? (baseAmount * value) / 100 : value,
    description: `${discount.name} - ${discount.code}`,
  };
}

async function handleTripBooking(req, res, next) {
  let createdBookingId;
  let paymentRequested = false;
  let paymentAuthorizationStarted = false;
  let paymentStatusSaved = false;
  let paymentApproved = false;
  let paymentTransactionId = "";
  let paymentDate = "";
  try {
    const data = z
      .object({
        user_email_address: z.string().email(),
        trips_id: z.coerce.number().int().positive(),
        trips_date_id: z.preprocess(
          (value) => (value === "" || value === null ? undefined : value),
          z.coerce.number().int().positive().optional(),
        ),
        party_number: z.coerce.number().int().min(1).max(10),
        first_name: z.string().trim().min(1).max(255),
        last_name: z.string().trim().min(1).max(255),
        preferred_name: z.string().trim().max(255).default(""),
        street_address: z.string().trim().max(255).default(""),
        street_address1: z.string().trim().max(255).default(""),
        city: z.string().trim().max(255).default(""),
        state: z.string().trim().max(255).default(""),
        postal_code: z.string().trim().max(255).default(""),
        country: z.string().trim().max(255).default(""),
        day_phone: z.string().trim().max(255).default(""),
        mobile_phone: z.string().trim().max(255).default(""),
        date_of_birth: z.string().optional().default(""),
        gender: z.string().trim().max(255).default(""),
        shipping_first_name: z.string().trim().max(255).default(""),
        shipping_last_name: z.string().trim().max(255).default(""),
        shipping_street_address: z.string().trim().max(255).default(""),
        shipping_street_address1: z.string().trim().max(255).default(""),
        shipping_city: z.string().trim().max(255).default(""),
        shipping_state: z.string().trim().max(255).default(""),
        shipping_postal_code: z.string().trim().max(255).default(""),
        shipping_country: z.string().trim().max(255).default(""),
        physical_medical_conditions: z.string().max(10000).default(""),
        dietary_restrictions: z.string().max(10000).default(""),
        special_dietary_requirements: z.string().max(10000).default(""),
        hear_about_us: z.string().max(250).default(""),
        special_comments: z.string().max(30000).default(""),
        flight_arrival_details: z.string().max(10000).default(""),
        flight_departure_details: z.string().max(10000).default(""),
        booking_start_date: z.string().optional().default(""),
        booking_end_date: z.string().optional().default(""),
        payment_due_date: z.string().optional().default(""),
        invoice_trip_start_date: z.string().optional().default(""),
        invoice_trip_end_date: z.string().optional().default(""),
        rooming_preference: z.string().max(250).default(""),
        bed_preference: z.string().max(250).default(""),
        initial_booking_amount: tripBookingAmount.default(0),
        single_supplement_booking_amount: tripBookingAmount.default(0),
        deposit_amount: tripBookingAmount.default(0),
        credit_card_last_four: z
          .string()
          .regex(/^\d{0,4}$/)
          .default(""),
        credit_card_number: z
          .string()
          .default("")
          .refine(
            (value) => !value || /^\d{14,25}$/.test(value),
            "Credit card number is invalid.",
          ),
        credit_card_expire_month: z
          .string()
          .default("")
          .refine(
            (value) => !value || /^\d{2}$/.test(value),
            "Card expiration month is invalid.",
          ),
        credit_card_expire_year: z.preprocess(
          (value) => (value === "" || value === null ? undefined : value),
          z.coerce.number().int().optional(),
        ),
        credit_card_cvv_number: z
          .string()
          .default("")
          .refine(
            (value) => !value || /^\d{3,4}$/.test(value),
            "Card security code is invalid.",
          ),
        payment_amount: tripBookingAmount.default(0),
        trip_name: z.string().max(255).default(""),
        discount_code: z.string().trim().max(255).default(""),
        email_subject: z.string().trim().max(255).default(""),
        email_message: z.string().max(30000).default(""),
        send_email: z.boolean().default(false),
        admin_notes: z.string().max(10000).default(""),
        additional_prices: z
          .array(
            z.object({
              description: z.string().trim().min(1).max(255),
              price: tripBookingAmount,
              quantity: z.coerce.number().int().min(1).default(1),
              sign: z.enum(["+", "-"]).default("+"),
            }),
          )
          .default([]),
        additional_travelers: z
          .array(
            z.object({
              first_name: z.string().trim().min(1).max(255),
              last_name: z.string().trim().min(1).max(255),
              preferred_name: z.string().trim().max(255).default(""),
              email_address: z.string().email().or(z.literal("")).default(""),
              day_phone: z.string().max(255).default(""),
              mobile_phone: z.string().max(255).default(""),
              date_of_birth: z.string().optional().default(""),
              gender: z.string().max(255).default(""),
            }),
          )
          .max(9)
          .default([]),
      })
      .parse(req.body);
    paymentRequested = data.payment_amount > 0;
    if (data.additional_travelers.length > data.party_number - 1)
      return res
        .status(400)
        .json({ message: "Too many additional travelers." });

    const baseAmount = data.initial_booking_amount;
    const discount = await getTripBookingDiscount(
      data.discount_code,
      baseAmount,
    );
    if (discount === null)
      return res
        .status(400)
        .json({ message: "Discount code is invalid or expired." });
    const discountAmount = discount.amount;

    const userResult = await query(
      `SELECT user_id FROM alpenwild_user_tbl
         WHERE LOWER(user_email_address)=LOWER($1) LIMIT 1`,
      [data.user_email_address],
    );
    let userId = userResult.rows[0]?.user_id;
    const userValues = [
      data.first_name,
      data.last_name,
      data.preferred_name,
      data.street_address,
      data.street_address1,
      data.city,
      data.state,
      data.postal_code,
      data.country,
      data.day_phone,
      data.mobile_phone,
      data.user_email_address,
      data.date_of_birth || null,
      data.gender,
      data.user_email_address,
      data.shipping_first_name,
      data.shipping_last_name,
      data.shipping_street_address,
      data.shipping_street_address1,
      data.shipping_city,
      data.shipping_state,
      data.shipping_country,
      data.shipping_postal_code,
    ];
    if (!userId) {
      const inserted = await query(
        `INSERT INTO alpenwild_user_tbl
            (user_first_name,user_last_name,user_preferred_name,user_street_address,
             user_street_address1,user_city,user_state,user_postal_code,user_country,
             user_day_phone,user_mobile_phone,user_email_address,user_date_of_birth,
             user_gender,user_shipping_email_address,user_shipping_first_name,
             user_shipping_last_name,user_shipping_street_address,user_shipping_street_address1,
             user_shipping_city,user_shipping_state,user_shipping_country,user_shipping_postal_code)
           VALUES (${userValues.map((_, index) => `$${index + 1}`).join(",")}) RETURNING user_id`,
        userValues,
      );
      userId = inserted.rows[0].user_id;
    }
    const additionalPriceTotal = data.additional_prices.reduce(
      (total, item) =>
        total + (item.sign === "-" ? -1 : 1) * item.price * item.quantity,
      0,
    );
    const booking = await query(
      `INSERT INTO alpenwild_trips_booking_tbl
          (trips_id,user_id,trips_date_id,trips_booking_date,additional_user_id,billing_address_id,
           party_number,rooming_preference,bed_preference,
           physical_medical_conditions,dietary_restrictions,special_dietary_requirements,
           hear_about_us,special_comments,admin_notes,flight_arrival_details,
           flight_departure_details,booking_start_date,booking_end_date,
           trip_total_payment,trip_additional_payment,trip_payment_due,
           user_first_name,user_last_name,user_preferred_name,user_street_address,
           user_street_address1,user_city,user_state,user_postal_code,user_country,
           user_day_phone,user_mobile_phone,user_date_of_birth,user_gender,
           user_shipping_first_name,user_shipping_last_name,user_shipping_street_address,
           user_shipping_street_address1,user_shipping_city,user_shipping_state,
           user_shipping_postal_code,user_shipping_country,trips_booking_status)
         VALUES ($1,$2,$3,CURRENT_DATE,0,0,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,'Active')
         RETURNING trips_booking_id AS id`,
      [
        data.trips_id,
        userId,
        data.trips_date_id || null,
        data.party_number,
        data.rooming_preference,
        data.bed_preference,
        data.physical_medical_conditions,
        data.dietary_restrictions,
        data.special_dietary_requirements,
        data.hear_about_us,
        data.special_comments,
        data.admin_notes,
        data.flight_arrival_details,
        data.flight_departure_details,
        data.booking_start_date || null,
        data.booking_end_date || null,
        data.initial_booking_amount,
        data.single_supplement_booking_amount,
        Math.max(
          0,
          data.initial_booking_amount +
            data.single_supplement_booking_amount +
            additionalPriceTotal -
            data.deposit_amount -
            discountAmount,
        ),
        data.first_name,
        data.last_name,
        data.preferred_name,
        data.street_address,
        data.street_address1,
        data.city,
        data.state,
        data.postal_code,
        data.country,
        data.day_phone,
        data.mobile_phone,
        data.date_of_birth || null,
        data.gender,
        data.shipping_first_name,
        data.shipping_last_name,
        data.shipping_street_address,
        data.shipping_street_address1,
        data.shipping_city,
        data.shipping_state,
        data.shipping_postal_code,
        data.shipping_country,
      ],
    );
    createdBookingId = booking.rows[0].id;
    for (const traveler of data.additional_travelers)
      await query(
        `INSERT INTO alpenwild_trips_additional_booking_user_tbl
            (trips_booking_id,first_name,last_name,preferred_name,email_address,day_phone,mobile_phone,date_of_birth,gender)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          booking.rows[0].id,
          traveler.first_name,
          traveler.last_name,
          traveler.preferred_name,
          traveler.email_address,
          traveler.day_phone,
          traveler.mobile_phone,
          traveler.date_of_birth || null,
          traveler.gender,
        ],
      );
    if (data.payment_amount > 0) {
      const payment = await query(
        `INSERT INTO alpenwild_trips_payment_tbl
           (trips_booking_id,name_on_credit_card,credit_card_number,payment_price,
            payment_date,payment_status,transaction_id,gateway)
         VALUES ($1,$2,$3,$4,CURRENT_DATE,'Pending',NULL,'authorize_net')
         RETURNING trips_payment_id AS id,payment_date`,
        [
          booking.rows[0].id,
          `${data.first_name} ${data.last_name}`.trim(),
          data.credit_card_last_four || null,
          data.payment_amount,
        ],
      );
      paymentDate = payment.rows[0].payment_date;
      paymentAuthorizationStarted = true;
      const charge = await authorizeNetCharge({
        cardNumber: data.credit_card_number,
        expiration: `${data.credit_card_expire_month}${data.credit_card_expire_year || ""}`,
        amount: data.payment_amount,
        cvv: data.credit_card_cvv_number,
        invoice: `booking-${booking.rows[0].id}`,
        email: data.user_email_address,
        firstName: data.first_name,
        address: data.street_address,
        city: data.city,
        state: data.state,
        zip: data.postal_code,
        lastName: data.last_name,
        customerId: userId,
        phone: data.day_phone || data.mobile_phone,
        customerIp: req.ip || "",
        shippingFirstName: data.shipping_first_name,
        shippingLastName: data.shipping_last_name,
        shippingAddress: [
          data.shipping_street_address,
          data.shipping_street_address1,
        ]
          .filter(Boolean)
          .join(" "),
        shippingCity: data.shipping_city,
        shippingState: data.shipping_state,
        shippingZip: data.shipping_postal_code,
        description: data.trip_name || "",
      });
      const paymentStatus = charge.configured
        ? charge.approved
          ? "Paid"
          : "Declined"
        : "Pending";
      await query(
        `UPDATE alpenwild_trips_payment_tbl
            SET payment_status=$1,transaction_id=$2
          WHERE trips_payment_id=$3`,
        [paymentStatus, charge.transactionId || null, payment.rows[0].id],
      );
      paymentStatusSaved = true;
      paymentApproved = charge.approved;
      paymentTransactionId = charge.transactionId || "";
      if (charge.approved && data.payment_due_date)
        await query(
          `UPDATE alpenwild_trips_booking_tbl SET payment_due_date=$1
            WHERE trips_booking_id=$2`,
          [data.payment_due_date, booking.rows[0].id],
        );
      if (charge.configured && !charge.approved) {
        if (req.path === "/api/public/trip-bookings") {
          await query(
            "DELETE FROM alpenwild_trips_additional_booking_user_tbl WHERE trips_booking_id=$1",
            [booking.rows[0].id],
          );
          await query(
            "DELETE FROM alpenwild_trips_payment_tbl WHERE trips_payment_id=$1 AND trips_booking_id=$2",
            [payment.rows[0].id, booking.rows[0].id],
          );
          await query(
            "DELETE FROM alpenwild_trips_booking_tbl WHERE trips_booking_id=$1",
            [booking.rows[0].id],
          );
          createdBookingId = null;
          return res.status(402).json({ message: charge.reason });
        }
        return res
          .status(402)
          .json({ message: charge.reason, booking_id: booking.rows[0].id });
      }
    }
    for (const price of data.additional_prices)
      await query(
        `INSERT INTO alpenwild_trips_additional_price_tbl
            (trips_booking_id,description,price,quantity,sign)
           VALUES ($1,$2,$3,$4,$5)`,
        [
          booking.rows[0].id,
          price.description,
          price.price,
          price.quantity,
          price.sign,
        ],
      );
    if (discountAmount > 0)
      await query(
        `INSERT INTO alpenwild_trips_additional_price_tbl
            (trips_booking_id,description,price,sign)
           VALUES ($1,$2,$3,'-')`,
        [booking.rows[0].id, discount.description, discountAmount],
      );
    if (paymentApproved && req.path === "/api/public/trip-bookings" && mailer) {
      try {
        const totalAdditionalPrices = data.additional_prices.reduce(
          (total, item) =>
            total + (item.sign === "-" ? -1 : 1) * item.price * item.quantity,
          0,
        );
        const siteTitle = await getSiteTitle();
        await mailer.sendMail({
          from: {
            name: siteTitle,
            address: config.smtpFrom || config.smtpUser,
          },
          replyTo: data.user_email_address,
          to: "payments@yopmail.com,webgrity43@gmail.com",
          subject: "Alpenwild Payment Details (Trip Reservation)",
          html: createTripBookingAdminNotificationHtml({
            tripName: data.trip_name,
            tripStartDate: data.invoice_trip_start_date,
            tripEndDate: data.invoice_trip_end_date,
            firstName: data.first_name,
            lastName: data.last_name,
            email: data.user_email_address,
            preferredName: data.preferred_name,
            gender: data.gender,
            dateOfBirth: data.date_of_birth,
            mobilePhone: data.mobile_phone,
            streetAddress: data.street_address,
            streetAddress1: data.street_address1,
            city: data.city,
            state: data.state,
            postalCode: data.postal_code,
            country: data.country,
            shippingStreetAddress: data.shipping_street_address,
            shippingStreetAddress1: data.shipping_street_address1,
            shippingCity: data.shipping_city,
            shippingState: data.shipping_state,
            shippingPostalCode: data.shipping_postal_code,
            shippingCountry: data.shipping_country,
            partyNumber: data.party_number,
            additionalTravelers: data.additional_travelers,
            paymentDate,
            roomingPreference: data.rooming_preference,
            bedPreference: data.bed_preference,
            physicalMedicalConditions: data.physical_medical_conditions,
            dietaryRestrictions: data.dietary_restrictions,
            specialDietaryRequirements: data.special_dietary_requirements,
            specialComments: data.special_comments,
            flightArrivalDetails: data.flight_arrival_details,
            flightDepartureDetails: data.flight_departure_details,
            tripTotal: data.initial_booking_amount,
            singleSupplement: data.single_supplement_booking_amount,
            paymentAmount: data.payment_amount,
            paymentDue: Math.max(
              0,
              data.initial_booking_amount +
                data.single_supplement_booking_amount +
                totalAdditionalPrices -
                data.payment_amount -
                discountAmount,
            ),
            paymentStatus: "Paid",
            transactionId: paymentTransactionId,
          }),
        });
      } catch (error) {
        console.error(
          `Booking ${booking.rows[0].id} was saved, but the staff payment notification email failed.`,
          error,
        );
      }
    }
    if (data.send_email && req.path === "/api/public/trip-bookings") {
      if (paymentApproved && mailer) {
        try {
          const templateResult = await query(
            `SELECT email_template_subject,email_template_message
               FROM alpenwild_email_template_tbl
              WHERE email_template_id=$1 LIMIT 1`,
            [6],
          );
          const template = templateResult.rows[0];
          if (!template)
            throw new Error(
              "Booking confirmation email template 6 is missing.",
            );
          const invoice = await createTripBookingInvoicePdf({
            bookingId: booking.rows[0].id,
            bookingDate: new Date().toISOString().slice(0, 10),
            tripName: data.trip_name,
            tripStartDate:
              data.invoice_trip_start_date || data.booking_start_date,
            tripEndDate: data.invoice_trip_end_date || data.booking_end_date,
            dueDate: data.payment_due_date,
            firstName: data.first_name,
            lastName: data.last_name,
            streetAddress: data.street_address,
            streetAddress1: data.street_address1,
            city: data.city,
            state: data.state,
            postalCode: data.postal_code,
            country: data.country,
            phone: data.mobile_phone,
            email: data.user_email_address,
            partyNumber: data.party_number,
            tripTotal: data.initial_booking_amount,
            singleSupplement: data.single_supplement_booking_amount,
            additionalItems: [
              ...data.additional_prices,
              ...(discountAmount > 0
                ? [
                    {
                      description: discount.description,
                      price: discountAmount,
                      quantity: 1,
                      sign: "-",
                    },
                  ]
                : []),
            ],
            paymentAmount: data.payment_amount,
            totalDue: Math.max(
              0,
              data.initial_booking_amount +
                data.single_supplement_booking_amount +
                additionalPriceTotal -
                data.deposit_amount -
                discountAmount,
            ),
          });
          const siteTitle = await getSiteTitle();
          await mailer.sendMail({
            from: {
              name: siteTitle,
              address: config.smtpFrom || config.smtpUser,
            },
            to: data.user_email_address,
            subject: template.email_template_subject,
            html: createBookingConfirmationHtml(
              data.first_name,
              template.email_template_message,
            ),
            attachments: [
              {
                filename: `invoice${booking.rows[0].id}_${new Date().toISOString().slice(0, 10)}.pdf`,
                content: invoice,
                contentType: "application/pdf",
              },
            ],
          });
        } catch (error) {
          console.error(
            "Public trip booking confirmation email failed.",
            error,
          );
        }
      } else if (paymentApproved) {
        console.error(
          "Public trip booking confirmation email was not sent because SMTP is not configured.",
        );
      }
    } else if (data.send_email && mailer) {
      const siteTitle = await getSiteTitle();
      const message = {
        from: {
          name: siteTitle,
          address: config.smtpFrom || config.smtpUser,
        },
        to: data.user_email_address,
        subject: data.email_subject || `${siteTitle} Trip Booking Confirmation`,
        text:
          data.email_message ||
          `Your ${siteTitle} trip booking has been created. Booking ID: ${booking.rows[0].id}`,
      };
      await mailer.sendMail(message);
    }
    res.status(201).json({
      id: booking.rows[0].id,
    });
  } catch (error) {
    if (createdBookingId && req.path === "/api/public/trip-bookings") {
      console.error(
        "Public booking failed after its booking record was created.",
        error,
      );
      return res.status(502).json({
        message: paymentRequested
          ? paymentAuthorizationStarted && !paymentStatusSaved
            ? "Your booking was recorded, but we could not confirm the payment status. Please contact Alpenwild before submitting again."
            : paymentStatusSaved
              ? "Your booking and payment status were recorded, but we could not finish processing the booking. Please contact Alpenwild before submitting again."
              : "Your booking was recorded, but payment could not be started. Please contact Alpenwild before submitting again."
          : "Your booking was recorded, but we could not finish processing it. Please contact Alpenwild before submitting again.",
        booking_id: createdBookingId,
      });
    }
    next(error);
  }
}

app.use(
  createTripGalleriesRouter({
    query,
    upload: tripGalleryUpload,
    config,
    safeFilename,
  }),
);

function staticPageSelect() {
  return useLegacyStaticPages()
    ? `SELECT static_page_id AS id, static_page_display_as_page AS display_as_page,
        static_page_parent_id AS parent_id, static_page_name AS name,
        static_page_slug AS slug, static_page_menu_name AS menu_name,
        static_page_menu_assign AS menu_assign,
        static_page_social_sharing_display AS social_sharing_display,
        static_page_meta_title AS meta_title,
        static_page_meta_descriptions AS meta_descriptions,
        static_page_meta_keywords AS meta_keywords,
        static_page_description AS description,
        static_page_banner_title AS banner_title,
        static_page_banner_sub_title AS banner_sub_title,
        static_page_tooltip_text AS tooltip_text,
        static_page_description_type AS description_type,
        static_page_banner AS banner_image,
        static_page_order AS display_order, static_page_status AS status
       FROM alpenwild_static_page_tbl`
    : `SELECT id, display_as_page, parent_id, name, slug, menu_name, menu_assign,
        social_sharing_display, meta_title, meta_descriptions, meta_keywords,
        description, banner_title, banner_sub_title, tooltip_text,
        description_type, banner_image, display_order, status
       FROM static_pages`;
}

function staticPageColumns() {
  return useLegacyStaticPages()
    ? {
        table: "alpenwild_static_page_tbl",
        id: "static_page_id",
        parent: "static_page_parent_id",
        name: "static_page_name",
        order: "static_page_order",
      }
    : {
        table: "static_pages",
        id: "id",
        parent: "parent_id",
        name: "name",
        order: "display_order",
      };
}

async function shiftStaticPageOrders(
  parentId,
  order,
  direction,
  excludeId = null,
) {
  const columns = staticPageColumns();
  const values = [parentId, order];
  const exclusion = excludeId === null ? "" : ` AND ${columns.id} <> $3`;
  if (excludeId !== null) values.push(excludeId);
  const operator = direction === "up" ? ">=" : ">";
  await query(
    `UPDATE ${columns.table} SET ${columns.order} = ${columns.order} + 1
     WHERE ${columns.parent} = $1 AND ${columns.order} ${operator} $2${exclusion}`,
    values,
  );
}

app.use(createContestAdminRouter({ query, requireAuth, config }));
app.use(createInvoicesRouter({ query }));
app.use(createContestsRouter({ query }));

app.use(createOrdersRouter({ query }));

function tripValidationMessage(issue) {
  const fieldLabels = {
    name: "Trip name",
    slug: "Slug",
    type_id: "Trip type",
    location_id: "Location",
    blog_post_display: "Blog posts",
    activity_ids: "Activities",
    activity_level: "Activity level",
    menu_name: "Menu name",
    meta_title: "Meta title",
    meta_descriptions: "Meta description",
    meta_keywords: "Meta keywords",
    short_description: "Short description",
    description: "Description",
    days: "Days",
    nights: "Nights",
    deposit_amount: "Deposit amount",
    deposit_amount_text: "Deposit amount text",
    price: "Price",
    price_text: "Price text",
    single_price: "Single price",
    available_for: "Availability",
    included: "What's included",
    excluded: "What's excluded",
    highlight: "Highlights",
    youtube_content: "Video content",
    activity: "Activity details",
    arrival: "Arrival information",
    departure: "Departure information",
    pre_post_tour_travel: "Pre/post-tour travel information",
    accommodations: "Accommodations",
    meals: "Meals",
    banner_title: "Banner title",
    banner_sub_title: "Banner subtitle",
    tooltip_text: "Tooltip text",
    banner_alt: "Banner image description",
    listing_image_alt: "Listing image description",
    order: "Display order",
    status: "Status",
    start_date: "Start date",
    end_date: "End date",
    date_range: "Entry day",
    image_alt: "Image description",
    title: "Title",
    link: "Link",
    display_order: "Image order",
  };
  const path = issue.path;
  const collectionIndex = typeof path[1] === "number" ? path[1] + 1 : null;
  const field = fieldLabels[path.at(-1)] || "Trip details";
  const context =
    path[0] === "dates" && collectionIndex
      ? `Date ${collectionIndex}, ${field.toLowerCase()}`
      : path[0] === "box_images" && collectionIndex
        ? `Box image ${collectionIndex}, ${field.toLowerCase()}`
        : field;
  let detail = "Please review this value and try again.";

  if (issue.code === "invalid_type") {
    detail =
      issue.expected === "number"
        ? "Please enter a valid number."
        : issue.expected === "string"
          ? "Please enter a value."
          : "Please select a valid option.";
  } else if (issue.code === "too_small") {
    detail =
      issue.origin === "number"
        ? "This number is below the allowed minimum."
        : "This field is required.";
  } else if (issue.code === "too_big") {
    detail = "This value exceeds the allowed limit.";
  } else if (issue.code === "invalid_format") {
    detail = "Please enter a valid value.";
  } else if (issue.code === "custom" && issue.message) {
    detail = issue.message;
  }

  return `${context}: ${detail}`;
}

function tripBookingValidationMessage(issue) {
  const labels = {
    user_email_address: "Email address",
    trips_id: "Trip",
    trips_date_id: "Trip date range",
    party_number: "Number in party",
    first_name: "First name",
    last_name: "Last name",
    preferred_name: "Preferred name",
    street_address: "Street address",
    street_address1: "Street address 2",
    city: "City",
    state: "State",
    postal_code: "Zip code",
    country: "Country",
    day_phone: "Day phone number",
    mobile_phone: "Mobile phone number",
    date_of_birth: "Date of birth",
    recaptcha_token: "Security verification",
    agree: "Terms and Conditions",
    gender: "Gender",
    shipping_first_name: "Shipping first name",
    shipping_last_name: "Shipping last name",
    shipping_street_address: "Shipping street address",
    shipping_street_address1: "Shipping street address 2",
    shipping_city: "Shipping city",
    shipping_state: "Shipping state",
    shipping_postal_code: "Shipping zip code",
    shipping_country: "Shipping country",
    booking_start_date: "Trip start date",
    booking_end_date: "Trip end date",
    initial_booking_amount: "Initial booking amount",
    single_supplement_booking_amount: "Single supplement amount",
    deposit_amount: "Deposit amount",
    credit_card_last_four: "Last four digits of card",
    credit_card_number: "Credit card number",
    credit_card_expire_month: "Card expiration month",
    credit_card_expire_year: "Card expiration year",
    credit_card_cvv_number: "Card security code",
    payment_amount: "Payment amount",
    discount_code: "Discount code",
    email_subject: "Email subject",
    email_message: "Email message",
    admin_notes: "Admin notes",
    description: "Description",
    price: "Price",
    quantity: "Quantity",
    sign: "Price operator",
    email_address: "Email address",
  };
  const path = issue.path;
  const field = labels[path.at(-1)] || "Booking details";
  const index = typeof path[1] === "number" ? path[1] + 1 : null;
  const context =
    path[0] === "additional_prices" && index
      ? `Additional price ${index}, ${field.toLowerCase()}`
      : path[0] === "additional_travelers" && index
        ? `Additional traveler ${index}, ${field.toLowerCase()}`
        : field;
  let detail = "Please review this value and try again.";

  if (issue.code === "invalid_type") {
    detail =
      issue.expected === "number"
        ? "Please enter a valid number."
        : issue.expected === "string"
          ? "Please enter a value."
          : "Please select a valid option.";
  } else if (issue.code === "too_small") {
    if (issue.origin === "number") {
      detail =
        issue.minimum === 1 && issue.inclusive
          ? "Please enter at least 1."
          : `Please enter a value of at least ${issue.minimum}.`;
    } else {
      detail = "This field is required.";
    }
  } else if (issue.code === "too_big") {
    detail = `Please enter a value no greater than ${issue.maximum}.`;
  } else if (issue.code === "invalid_format") {
    detail =
      path.at(-1) === "user_email_address" || path.at(-1) === "email_address"
        ? "Please enter a valid email address."
        : "Please enter a valid value.";
  } else if (issue.code === "invalid_value") {
    detail = "Please select a valid option.";
  } else if (issue.code === "custom" && issue.message) {
    detail = issue.message;
  }

  return `${context}: ${detail}`;
}

function tripPaymentValidationMessage(issue) {
  const labels = {
    trip_id: "Trip",
    email: "Email address",
    name_on_card: "Name on card",
    billing_address: "Billing address",
    city: "City",
    state: "State",
    zipcode: "Zip code",
    amount: "Payment amount",
    credit_card_number: "Credit card number",
    credit_card_expire_month: "Card expiration month",
    credit_card_expire_year: "Card expiration year",
    credit_card_cvv_number: "Card security code",
    credit_card_last_four: "Credit card number",
    recaptcha_token: "Security verification",
  };
  const field = labels[issue.path.at(-1)] || "Payment details";
  let detail = "Please review this value and try again.";
  if (issue.code === "invalid_type") {
    detail =
      issue.expected === "number"
        ? "Please enter a valid number."
        : "Please enter a value.";
  } else if (issue.code === "too_small") {
    detail =
      issue.origin === "number"
        ? `Please enter an amount of at least $${issue.minimum}.`
        : "This field is required.";
  } else if (issue.code === "too_big") {
    detail = `Please enter a value no greater than ${issue.maximum}.`;
  } else if (issue.code === "invalid_format") {
    detail =
      issue.path.at(-1) === "email"
        ? "Please enter a valid email address."
        : "Please enter a valid value.";
  } else if (issue.code === "invalid_value") {
    detail = "Please select a valid option.";
  } else if (issue.code === "custom" && issue.message) {
    detail = issue.message;
  }
  return `${field}: ${detail}`;
}

app.use((error, req, res, _next) => {
  if (error instanceof z.ZodError) {
    const issue = error.issues[0];
    if (
      req.path.startsWith("/api/trip-bookings") ||
      req.path.startsWith("/api/public/trip-bookings")
    ) {
      const field = issue.path.join(".");
      return res.status(400).json({
        field,
        message: tripBookingValidationMessage(issue),
      });
    }
    if (req.path === "/api/trip-payments")
      return res.status(400).json({
        field: issue.path.join("."),
        message: tripPaymentValidationMessage(issue),
      });
    const message = req.path.startsWith("/api/trips")
      ? tripValidationMessage(issue)
      : issue.message;
    if (req.path.startsWith("/api/static-pages"))
      return res.status(400).json({
        field: issue.path.join("."),
        message: `${issue.path.join(".") || "static page"}: ${message}`,
      });
    return res.status(400).json({ message });
  }
  console.error(error);
  if (
    req.path === "/api/public/trip-bookings" ||
    req.path === "/api/trip-bookings"
  )
    return res.status(500).json({
      message:
        "We could not complete your booking. Please try again, or contact Alpenwild for assistance.",
    });
  res
    .status(500)
    .json({ message: "The admin request could not be completed." });
});

app.use(createFrontendFallbackRouter());

await ensureLegacyBannerIdentity();
await ensureLegacyShopOrderIdentity();
await ensureLegacyCategoryIdentity();
await ensureLegacyCategoryBoxImageIdentity();
await ensureLegacyAttributeTypeIdentity();
await ensureLegacyAttributeValueIdentity();
await ensureLegacyPromotionIdentity();
await ensureLegacySpecialFeatureIdentity();
await ensureLegacyFooterMenuIdentity();
await ensureLegacyTripTypeIdentity();
await ensureLegacyTripTypeBoxImageIdentity();
await ensureLegacyLocationIdentity();
await ensureLegacyActivityIdentity();
await ensureLegacyDiscountIdentity();
await ensureLegacyUserIdentity();
await ensureLegacyTripBookingIdentity();
await ensureLegacyTripPaymentIdentity();
await ensureLegacyTripAdditionalPriceIdentity();
await ensureInvoiceIdentity();
await ensurePublicTripPaymentRequestTable();
await ensureLegacyMailingListIdentity();
await ensureLegacyStaticPageIdentity();
await ensureLegacyStaticPageBoxImageIdentity();
await ensureLegacyStaticPageDescriptionIdentity();
await ensureLegacyContestIdentity();
await ensureLegacyRedirectionIdentity();
await ensureLegacyTripIdentity();
await ensureLegacyTripLeaderIdentity();
await ensureLegacyTripLeaderDescriptionIdentity();
await ensureLegacyTripGalleryIdentity();
await ensureLegacyTripFaqIdentity();
await ensureLegacyTestimonialIdentity();
await ensureLegacyTripItineraryIdentity();
await ensureLegacyProductAttributeIdentity();
await ensureLegacyProductIdentity();
await ensureLegacyProductAdditionalImageIdentity();
await ensureLegacyProductBoxImageIdentity();

app.listen(config.port, "0.0.0.0", () =>
  console.log(
    `Alpenwild admin API listening on http://localhost:${config.port}`,
  ),
);
