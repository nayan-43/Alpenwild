import fs from "node:fs/promises";
import path from "node:path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import multer from "multer";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import nodemailer from "nodemailer";
import sharp from "sharp";
import { ZipArchive } from "archiver";
import { z } from "zod";
import { config } from "./config.js";
import { slugifyCategoryName } from "./categorySlug.js";
import { pool, query } from "./db.js";
import { createTripLeaderAuthorsService } from "./tripLeaderAuthors.js";
import { calculatePublicBookingAmounts } from "./tripBookingAmounts.js";
import {
  createBookingConfirmationHtml,
  createTripBookingAdminNotificationHtml,
  createPaymentConfirmationHtml,
  createRefundConfirmationHtml,
  createTripBookingInvoicePdf,
} from "./tripBookingEmail.js";
import { paymentLinkSignature as createPaymentLinkSignature } from "./paymentLinkSignature.js";
import { calculateShopTotals } from "./shopCart.js";
import { buildShopOrderEmails } from "./shopOrderEmail.js";
import { buildCallMeBackEmailHtml } from "./callMeBackEmail.js";
import { buildSitemapXml } from "./sitemap.js";
import { buildPublicNavigation } from "./publicNavigation.js";

const app = express();
if (!pool) {
  throw new Error(
    "DATABASE_URL is not configured. Copy .env.example to .env first.",
  );
}
const authCookieName = "alpenwild_admin_session";
const tripLeaderAuthors = createTripLeaderAuthorsService(
  config.tripLeaderAuthorsMysql,
);
const loginAttempts = new Map();
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
const contestSubmissionUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, callback) =>
    callback(null, /^image\/(jpeg|png|gif)$/.test(file.mimetype)),
});

app.get("/api/public-settings", async (_req, res, next) => {
  try {
    const result = await query(
      `SELECT site_configuration_id, site_configuration_value
       FROM alpenwild_site_configuration_tbl
       WHERE site_configuration_id = 1 OR site_configuration_id BETWEEN 20 AND 27
       ORDER BY site_configuration_id`,
    );
    const settings = Object.fromEntries(
      [
        ["site_title", 1],
        ["footer_image_one", 20],
        ["footer_image_one_url", 21],
        ["footer_image_two", 22],
        ["footer_image_two_url", 23],
        ["footer_image_three", 24],
        ["footer_image_three_url", 25],
        ["footer_image_four", 26],
        ["footer_image_four_url", 27],
      ].map(([key, id]) => [
        key,
        result.rows.find((row) => row.site_configuration_id === id)
          ?.site_configuration_value || "",
      ]),
    );
    res.json(settings);
  } catch (error) {
    next(error);
  }
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
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: config.clientOrigin, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use("/uploads", express.static(config.uploadDir));
app.use(express.static(path.resolve(process.cwd(), "dist")));
const publicThumbnailJobs = new Map();

app.get("/api/public-thumbnail", async (req, res, next) => {
  const sourceUrl = String(req.query.src || "");
  const width = Number(req.query.w);
  const height = Number(req.query.h);
  const zoomCrop = Number(req.query.zc ?? 1);
  const quality = Number(req.query.q ?? 90);
  let decodedSource;
  try {
    decodedSource = decodeURIComponent(sourceUrl.slice("/uploads/".length));
  } catch {
    return res.status(400).json({ message: "Invalid thumbnail source." });
  }
  if (
    !sourceUrl.startsWith("/uploads/") ||
    sourceUrl.length > 2048 ||
    sourceUrl.includes("\\") ||
    sourceUrl.includes("\0") ||
    decodedSource.includes("\\") ||
    decodedSource.includes("\0") ||
    decodedSource.split(/[\\/]/).includes(".thumbnail-cache") ||
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 2000 ||
    height > 2000 ||
    ![0, 1, 2, 3].includes(zoomCrop) ||
    !Number.isInteger(quality) ||
    quality < 1 ||
    quality > 100
  ) {
    return res.status(400).json({ message: "Invalid thumbnail request." });
  }

  try {
    const uploadRoot = await fs.realpath(config.uploadDir);
    const sourcePath = path.resolve(uploadRoot, decodedSource);
    if (!sourcePath.startsWith(`${uploadRoot}${path.sep}`))
      return res.status(400).json({ message: "Invalid thumbnail source." });
    const realSourcePath = await fs.realpath(sourcePath);
    if (
      !realSourcePath.startsWith(`${uploadRoot}${path.sep}`) ||
      realSourcePath
        .slice(uploadRoot.length + 1)
        .split(path.sep)
        .includes(".thumbnail-cache")
    )
      return res.status(400).json({ message: "Invalid thumbnail source." });
    const sourceStats = await fs.stat(realSourcePath);
    if (
      !sourceStats.isFile() ||
      !/\.(?:jpe?g|png|webp|gif)$/i.test(realSourcePath)
    ) {
      return res.status(404).json({ message: "Thumbnail source not found." });
    }
    const sourceMetadata = await sharp(realSourcePath).metadata();
    const outputFormat = sourceMetadata.hasAlpha ? "png" : "jpeg";

    const cacheKey = crypto
      .createHash("sha256")
      .update(
        `${realSourcePath}:${sourceStats.size}:${sourceStats.mtimeMs}:${sourceStats.ctimeMs}:${width}:${height}:${zoomCrop}:${quality}:${outputFormat}`,
      )
      .digest("hex");
    const etag = `"${cacheKey}"`;
    res.set("Cache-Control", "no-cache");
    res.set("ETag", etag);
    if (req.get("If-None-Match") === etag) return res.status(304).end();

    const cacheDirectory = path.join(
      config.uploadDir,
      ".thumbnail-cache",
      "public",
    );
    const thumbnailPath = path.join(
      cacheDirectory,
      `${cacheKey}.${outputFormat === "png" ? "png" : "jpg"}`,
    );
    let thumbnailJob = publicThumbnailJobs.get(cacheKey);
    if (!thumbnailJob) {
      thumbnailJob = (async () => {
        await fs.mkdir(cacheDirectory, { recursive: true });
        try {
          return await fs.readFile(thumbnailPath);
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }

        const resized = sharp(realSourcePath).resize(width, height, {
          fit: ["fill", "cover", "contain", "inside"][zoomCrop],
          position: "centre",
          withoutEnlargement: false,
        });
        const thumbnail =
          outputFormat === "png"
            ? await resized.png({ compressionLevel: 9 }).toBuffer()
            : await resized
                .flatten({ background: "#ffffff" })
                .jpeg({ quality })
                .toBuffer();
        await fs.writeFile(thumbnailPath, thumbnail);
        return thumbnail;
      })();
      publicThumbnailJobs.set(cacheKey, thumbnailJob);
    }

    try {
      const thumbnail = await thumbnailJob;
      return res
        .type(outputFormat === "png" ? "image/png" : "image/jpeg")
        .send(thumbnail);
    } finally {
      if (publicThumbnailJobs.get(cacheKey) === thumbnailJob)
        publicThumbnailJobs.delete(cacheKey);
    }
  } catch (error) {
    if (error.code === "ENOENT")
      return res.status(404).json({ message: "Thumbnail source not found." });
    next(error);
  }
});

app.get("/sitemap.xml", async (_req, res, next) => {
  try {
    const [pages, tripTypes, trips] = await Promise.all([
      query(
        `SELECT static_page_slug AS slug FROM alpenwild_static_page_tbl
          WHERE static_page_status='Active'
          ORDER BY static_page_order, static_page_id`,
      ),
      query(
        `SELECT trip_type_slug AS slug FROM alpenwild_trip_type_tbl
          WHERE trip_type_status='Active'
          ORDER BY trip_type_order, trip_type_id`,
      ),
      query(
        `SELECT trips_slug AS slug FROM alpenwild_trips_tbl
          WHERE trips_status='Active'
          ORDER BY trips_order, trips_id`,
      ),
      "/public-products/",
      "/public/contests",
    ]);
    const origin =
      typeof config.clientOrigin === "string" && config.clientOrigin !== "true"
        ? new URL(config.clientOrigin).origin
        : `${_req.protocol}://${_req.get("host")}`;
    res.type("application/xml").send(
      buildSitemapXml(origin, {
        pages: pages.rows,
        tripTypes: tripTypes.rows,
        trips: trips.rows,
      }),
    );
  } catch (error) {
    next(error);
  }
});

function issueAuthCookie(res, user, remember) {
  if (!config.jwtSecret)
    throw new Error("JWT_SECRET must be configured before enabling login.");
  const token = jwt.sign(
    { sub: String(user.id), username: user.username },
    config.jwtSecret,
    { expiresIn: remember ? "30d" : "8h", issuer: "alpenwild-admin" },
  );
  res.cookie(authCookieName, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: (remember ? 30 * 24 : 8) * 60 * 60 * 1000,
    path: "/",
  });
}

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

const loginSchema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(200),
  remember: z.boolean().optional().default(false),
});
const forgotSchema = z.object({ username: z.string().trim().min(1).max(100) });
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

function generateLegacyAdminPassword() {
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "123456789";
  const symbols = "!@#$%^&*?";
  const characters = Array.from(
    { length: 12 },
    () => lowercase[crypto.randomInt(lowercase.length)],
  );
  const positions = Array.from(
    { length: characters.length },
    (_, index) => index,
  );
  for (let index = positions.length - 1; index > 0; index -= 1) {
    const otherIndex = crypto.randomInt(index + 1);
    [positions[index], positions[otherIndex]] = [
      positions[otherIndex],
      positions[index],
    ];
  }
  for (const [offset, alphabet, count] of [
    [0, uppercase, 3],
    [3, numbers, 2],
    [5, symbols, 3],
  ]) {
    for (let index = 0; index < count; index += 1) {
      characters[positions[offset + index]] =
        alphabet[crypto.randomInt(alphabet.length)];
    }
  }
  return characters.join("");
}
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
const credentialsSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(12).max(200),
});
const usernameSchema = z.object({
  oldUsername: z.string().trim().min(1).max(100),
  newUsername: z.string().trim().min(1).max(100),
  confirmation: z.string().trim().min(1).max(100),
});

function verifyLegacyAdminPassword(password, storedPassword) {
  if (!storedPassword || !/^[a-f0-9]{32}$/i.test(storedPassword)) return false;
  const digest = crypto.createHash("md5").update(password).digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(digest, "utf8"),
    Buffer.from(storedPassword.toLowerCase(), "utf8"),
  );
}

app.post("/api/auth/login", verifyRequestOrigin, async (req, res, next) => {
  const key = req.ip || "unknown";
  const now = Date.now();
  const attempts = loginAttempts.get(key);
  if (
    attempts &&
    now - attempts.startedAt < 10 * 60 * 1000 &&
    attempts.count >= 5
  )
    return res
      .status(429)
      .json({ message: "Too many login attempts. Try again later." });
  if (attempts && now - attempts.startedAt >= 10 * 60 * 1000)
    loginAttempts.delete(key);

  try {
    if (!config.databaseUrl || !config.jwtSecret)
      return res
        .status(503)
        .json({ message: "Authentication is not configured." });
    const data = loginSchema.parse(req.body);
    const result = await query(
      `SELECT administrator_id AS id,
              administrator_username AS username,
              administrator_name AS display_name,
              administrator_password AS legacy_password_md5
       FROM alpenwild_administrator_tbl
       WHERE LOWER(administrator_username)=LOWER($1) LIMIT 1`,
      [data.username],
    );
    const admin = result.rows[0];
    const valid = verifyLegacyAdminPassword(
      data.password,
      admin?.legacy_password_md5,
    );
    if (!valid) {
      const current = loginAttempts.get(key);
      loginAttempts.set(key, {
        startedAt: current?.startedAt || now,
        count: (current?.count || 0) + 1,
      });
      return res.status(401).json({ message: "Invalid username or password." });
    }
    loginAttempts.delete(key);
    issueAuthCookie(res, admin, data.remember);
    res.json({
      id: admin.id,
      username: admin.username,
      display_name: admin.display_name,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/logout", verifyRequestOrigin, (_req, res) => {
  res.clearCookie(authCookieName, {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
  });
  res.status(204).end();
});

app.post(
  "/api/auth/forgot-password",
  verifyRequestOrigin,
  async (req, res, next) => {
    try {
      const { username } = forgotSchema.parse(req.body);
      if (!mailer)
        return res
          .status(503)
          .json({ message: "Password email is not configured." });
      const result = await query(
        `SELECT administrator_id AS id
         FROM alpenwild_administrator_tbl
         WHERE LOWER(administrator_username)=LOWER($1) LIMIT 1`,
        [username],
      );
      const admin = result.rows[0];
      if (!admin)
        return res.status(404).json({
          message: "No administrator account was found with that username.",
        });
      const siteTitle = await getSiteTitle();
      const temporaryPassword = generateLegacyAdminPassword();
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const update = await client.query(
          `UPDATE alpenwild_administrator_tbl
           SET administrator_password=$1
           WHERE administrator_id=$2`,
          [
            crypto.createHash("md5").update(temporaryPassword).digest("hex"),
            admin.id,
          ],
        );
        if (update.rowCount !== 1)
          throw new Error(
            "Administrator password update did not affect one account.",
          );
        await mailer.sendMail({
          from: {
            name: siteTitle,
            address: config.smtpFrom || config.smtpUser,
          },
          to: "webgrity43@gmail.com",
          subject: `New Password ${siteTitle}`,
          html: `<p style="font:normal 14px calibri;">Dear Admin,<br><br>Your New Password is: ${temporaryPassword}</p>`,
        });
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
      res.json({
        message: "A new password will be sent to your e-mail address.",
      });
    } catch (error) {
      next(error);
    }
  },
);

app.get("/api/auth/me", requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT administrator_id AS id,
              administrator_username AS username,
              administrator_name AS display_name
       FROM alpenwild_administrator_tbl
       WHERE administrator_id=$1`,
      [req.admin.sub],
    );
    if (!result.rowCount) {
      res.clearCookie(authCookieName, {
        httpOnly: true,
        sameSite: "strict",
        path: "/",
      });

      return res.status(401).json({
        message: "Please login first to access this page!",
        code: "ADMIN_SESSION_EXPIRED",
      });
    }
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/auth/change-username",
  requireAuth,
  verifyRequestOrigin,
  async (req, res, next) => {
    try {
      const data = usernameSchema.parse(req.body);
      const result = await query(
        `SELECT administrator_username AS username
         FROM alpenwild_administrator_tbl WHERE administrator_id=$1`,
        [req.admin.sub],
      );
      if (
        !result.rowCount ||
        result.rows[0].username.toLowerCase() !== data.oldUsername.toLowerCase()
      )
        return res.status(400).json({ message: "Old username is incorrect." });
      if (data.newUsername !== data.confirmation)
        return res
          .status(400)
          .json({ message: "Username confirmation does not match." });
      await query(
        `UPDATE alpenwild_administrator_tbl
         SET administrator_username=$1 WHERE administrator_id=$2`,
        [data.newUsername, req.admin.sub],
      );
      res.json({ message: "Username updated successfully." });
    } catch (error) {
      next(error);
    }
  },
);

app.post(
  "/api/auth/change-password",
  requireAuth,
  verifyRequestOrigin,
  async (req, res, next) => {
    try {
      const data = credentialsSchema.parse(req.body);
      const result = await query(
        `SELECT administrator_password AS legacy_password_md5
         FROM alpenwild_administrator_tbl WHERE administrator_id=$1`,
        [req.admin.sub],
      );
      const admin = result.rows[0];
      const valid = verifyLegacyAdminPassword(
        data.currentPassword,
        admin?.legacy_password_md5,
      );
      if (!valid)
        return res
          .status(400)
          .json({ message: "Current password is incorrect." });
      await query(
        `UPDATE alpenwild_administrator_tbl
         SET administrator_password=$1
         WHERE administrator_id=$2`,
        [
          crypto.createHash("md5").update(data.newPassword).digest("hex"),
          req.admin.sub,
        ],
      );
      res.json({ message: "Password updated successfully." });
    } catch (error) {
      next(error);
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

app.get("/api/settings", requireAuth, async (_req, res, next) => {
  try {
    const result = await query(
      `SELECT site_configuration_id, site_configuration_value
       FROM alpenwild_site_configuration_tbl
       WHERE site_configuration_id BETWEEN 1 AND 27
       ORDER BY site_configuration_id`,
    );
    const settings = Object.fromEntries(
      Object.entries(settingKeyIds).map(([key, id]) => [
        key,
        result.rows.find((row) => row.site_configuration_id === id)
          ?.site_configuration_value || "",
      ]),
    );
    res.json(settings);
  } catch (error) {
    next(error);
  }
});

const settingsImageFields = [
  "site_logo",
  "footer_image_one",
  "footer_image_two",
  "footer_image_three",
  "footer_image_four",
];

app.put(
  "/api/settings",
  requireAuth,
  verifyRequestOrigin,
  settingsUpload.fields(
    settingsImageFields.map((name) => ({ name, maxCount: 1 })),
  ),
  async (req, res, next) => {
    try {
      const settings = settingsSchema.parse(req.body);
      if (req.files?.site_logo?.[0] && !settings.site_logo?.trim())
        settings.site_logo = "logo-upload-pending";
      settingsValidationSchema.parse(settings);
      for (const key of settingsImageFields) {
        const file = req.files?.[key]?.[0];
        if (!file) continue;
        const filename = safeFilename(file, key);
        await fs.rename(file.path, path.join(config.uploadDir, filename));
        settings[key] = `uploads/${filename}`;
      }
      for (const [key, value] of Object.entries(settings)) {
        const settingId = settingKeyIds[key];
        if (!settingId) continue;
        await query(
          `UPDATE alpenwild_site_configuration_tbl
           SET site_configuration_value=$1
           WHERE site_configuration_id=$2`,
          [value, settingId],
        );
      }
      res.json({ message: "Settings updated successfully.", settings });
    } catch (error) {
      next(error);
    }
  },
);

app.get("/api/email-templates", requireAuth, async (_req, res, next) => {
  try {
    const [result, total] = await Promise.all([
      query(
        `SELECT email_template_id AS id, email_template_for AS name,
        email_template_subject AS subject, email_template_message AS body
       FROM alpenwild_email_template_tbl
       WHERE email_template_id <> 1
       ORDER BY email_template_id DESC`,
      ),
      query("SELECT COUNT(*)::int AS total FROM alpenwild_email_template_tbl"),
    ]);
    res.json({ rows: result.rows, totalEntries: total.rows[0].total });
  } catch (error) {
    next(error);
  }
});

app.put(
  "/api/email-templates/:id",
  requireAuth,
  verifyRequestOrigin,
  async (req, res, next) => {
    try {
      const data = z
        .object({
          subject: z.string().trim().min(1).max(255),
          body: z.string().max(100000),
        })
        .parse(req.body);
      const result = await query(
        `UPDATE alpenwild_email_template_tbl
         SET email_template_subject=$1, email_template_message=$2
         WHERE email_template_id=$3 AND email_template_id <> 1
         RETURNING email_template_id AS id, email_template_for AS name,
           email_template_subject AS subject, email_template_message AS body`,
        [data.subject, data.body, req.params.id],
      );
      if (!result.rowCount)
        return res.status(404).json({ message: "Template not found." });
      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  },
);

const publicApiPaths = new Set([
  "/public-thumbnail",
  "/banners",
  "/promotions",
  "/special-features",
  "/trip-types",
  "/trips",
  "/public-static-pages",
  "/public-navigation",
  "/footer-menus",
  "/public-settings",
  "/public-categories",
  "/public-trip-leaders",
  "/public-trip-filters",
  "/testimonials",
  "/trip-galleries",
  "/trip-faqs",
]);

const publicApiPrefixes = [
  "/trip-posts/",
  "/trip-faqs/",
  "/public-static-pages/",
  "/public-categories/",
  "/public-products/",
  "/public-category-images/",
  "/trip-images/listing/",
  "/trip-type-images/listing/",
  "/public-trip-leaders/",
  "/public-trip-payment-links/",
];

const publicPostPaths = new Set([
  "/public/mailing-list",
  "/public/callback",
  "/public/trip-bookings",
  "/public/contest-submissions",
  "/public/shop-customer",
  "/public/shop-customer/register",
  "/public/shop-checkout",
  "/trip-payments",
  "/discount-check",
]);

const publicPostPathsWithOriginCheck = new Set([
  "/public/trip-bookings",
  "/public/contest-submissions",
  "/public/shop-customer",
  "/public/shop-customer/register",
  "/public/shop-checkout",
  "/trip-payments",
  "/discount-check",
]);

app.use("/api", (req, res, next) => {
  if (req.path.startsWith("/auth/") || req.path === "/health") return next();
  if (
    req.method === "GET" &&
    (publicApiPaths.has(req.path) ||
      publicApiPrefixes.some((prefix) => req.path.startsWith(prefix)) ||
      /^\/trips\/\d+\/itinerary$/.test(req.path))
  )
    return next();
  if (req.method === "POST" && publicPostPaths.has(req.path))
    return publicPostPathsWithOriginCheck.has(req.path)
      ? verifyRequestOrigin(req, res, next)
      : next();
  requireAuth(req, res, () => verifyRequestOrigin(req, res, next));
});

const bannerSchema = z.object({
  title: z.string().trim().min(1).max(255),
  sub_heading: z.string().trim().min(1).max(255),
  tooltip_text: z.string().trim().min(1).max(255),
  link: z.string().trim().min(1).max(1000),
  image_alt: z.string().trim().min(1).max(255),
  button_label: z.string().trim().max(100).default(""),
  button_link: z.string().trim().max(1000).default(""),
  display_order: z.preprocess(
    (value) =>
      typeof value === "string" && /^[+-]?\d+$/.test(value)
        ? Number(value)
        : value,
    z.number().int().min(1),
  ),
  status: z.enum(["Active", "Inactive"]).default("Active"),
});
const tripTypeBoxImageSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  image: z.string().max(255).default(""),
  image_alt: z.string().trim().max(255).default(""),
  title: z.string().trim().max(255).default(""),
  link: z.string().trim().max(1000).default(""),
});
const promotionSchema = z.object({
  title: z.string().trim().min(1).max(255),
  text: z.string().trim().min(1).max(10000),
  link: z.string().trim().min(1).max(1000),
  image_alt: z.string().trim().min(1).max(255),
  display_order: z.preprocess(
    (value) =>
      typeof value === "string" && /^[+-]?\d+$/.test(value)
        ? Number(value)
        : value,
    z.number().int(),
  ),
  status: z.enum(["Active", "Inactive"]).default("Active"),
});
const specialFeatureSchema = z.object({
  title: z.string().trim().min(1).max(255),
  text: z.string().trim().min(1).max(10000),
  link: z.string().trim().min(1).max(1000),
  image_alt: z.string().trim().min(1).max(255),
  display_order: z.preprocess(
    (value) =>
      typeof value === "string" && /^[+-]?\d+$/.test(value)
        ? Number(value)
        : value,
    z.number().int(),
  ),
  status: z.enum(["Active", "Inactive"]).default("Active"),
});
const footerMenuSchema = z.object({
  title: z.string().trim().min(1).max(255),
  under: z.enum([
    "Blogs",
    "HappyGuests",
    "WhatNew",
    "AlpenwildRecommended",
    "NecessaryInfo",
  ]),
  link: z.string().trim().min(1).max(1000),
  link_target: z.enum(["_self", "_blank", "_parent", "_top"]),
  display_order: z.preprocess(
    (value) =>
      typeof value === "string" && /^[+-]?\d+$/.test(value)
        ? Number(value)
        : value,
    z.number().int(),
  ),
  status: z.enum(["Active", "Inactive"]).default("Active"),
});
const simpleNameSchema = z.object({
  name: z.string().trim().min(1).max(255),
  status: z.enum(["Active", "Inactive"]).default("Active"),
});
const testimonialSchema = z.object({
  trip_id: z.preprocess(
    (value) => (value === "" || value === undefined ? null : value),
    z.coerce.number().int().positive().nullable().default(null),
  ),
  client_details: z.string().trim().min(1).max(255),
  content: z.string().trim().min(1).max(30000),
  display_order: z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    z.coerce.number().int(),
  ),
  status: z.enum(["Active", "Inactive"]).default("Active"),
});
const discountSchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    code: z.string().trim().min(1).max(255),
    type: z.enum(["Fixed", "Percentage"]),
    value: z.preprocess(
      (value) =>
        typeof value === "string" && /^[+-]?\d+$/.test(value)
          ? Number(value)
          : value,
      z.number().int(),
    ),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    status: z.enum(["Active", "Inactive"]).default("Active"),
  })
  .superRefine((data, context) => {
    if (data.end_date < data.start_date) {
      context.addIssue({
        code: "custom",
        path: ["end_date"],
        message: "End date must be on or after the start date.",
      });
    }
  });
const discountColumns = () =>
  useLegacyDiscounts()
    ? {
        table: "alpenwild_discount_tbl",
        id: "discount_id",
        code: "discount_code",
      }
    : { table: "discounts", id: "id", code: "code" };
const tripTypeSchema = z.object({
  name: z.string().trim().min(1).max(255),
  slug: z.string().trim().max(255).default(""),
  menu_name: z.string().trim().min(1).max(255),
  display_under: z.enum(["Yes", "No"]).default("No"),
  meta_title: z.string().trim().min(1).max(255),
  meta_descriptions: z.string().trim().min(1).max(10000),
  meta_keywords: z.string().trim().min(1).max(10000),
  short_description: z.string().trim().min(1).max(10000),
  description: z.string().trim().min(1).max(30000),
  tooltip_text: z.string().trim().min(1).max(255),
  banner_alt: z.string().trim().max(255).default(""),
  listing_image_alt: z.string().trim().max(255).default(""),
  display_order: z.preprocess(
    (value) =>
      typeof value === "string" && /^[+-]?\d+$/.test(value)
        ? Number(value)
        : value,
    z.number().int().min(-2147483648).max(2147483647),
  ),
  status: z.enum(["Active", "Inactive"]).default("Active"),
});
const categoryBoxImageSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  image: z.string().max(255).default(""),
  title: z.string().trim().max(255).default(""),
  link: z.string().trim().max(1000).default(""),
});
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
const categorySchema = z.object({
  parent_id: z.coerce.number().int().min(0).default(0),
  name: z.string().trim().min(1).max(255),
  slug: z.string().trim().max(255).default(""),
  menu_name: z.string().trim().min(1).max(255),
  meta_title: z.string().trim().min(1).max(255),
  meta_keywords: z.string().trim().min(1).max(10000),
  meta_descriptions: z.string().trim().min(1).max(10000),
  description: z.string().trim().min(1).max(30000),
  banner_title: z.string().trim().max(255).default(""),
  banner_sub_title: z.string().trim().max(255).default(""),
  tooltip_text: z.string().trim().max(255).default(""),
  display_order: z.preprocess(
    (value) =>
      typeof value === "string" && /^[+-]?\d+$/.test(value)
        ? Number(value)
        : value,
    z.number().int().min(-2147483648).max(2147483647),
  ),
  status: z.enum(["Active", "Inactive"]).default("Active"),
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
const redirectionSchema = z.object({
  old_redirection_url: z.string().trim().min(1).max(255),
  new_redirection_url: z.string().trim().min(1).max(255),
});
const productSchema = z.object({
  name: z.string().trim().min(1).max(255),
  slug: z.string().trim().max(255).default(""),
  category_id: z.coerce.number().int().positive(),
  menu_name: z.string().trim().min(1).max(255),
  meta_title: z.string().trim().min(1).max(255),
  meta_descriptions: z.string().trim().min(1).max(10000),
  meta_keywords: z.string().trim().min(1).max(10000),
  short_descriptions: z.string().trim().min(1).max(10000),
  description: z.string().trim().min(1).max(30000),
  price: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === ""
        ? Number.NaN
        : Number(value),
    z.number().finite(),
  ),
  banner_title: z.string().trim().max(255).default(""),
  banner_sub_title: z.string().trim().max(255).default(""),
  tooltip_text: z.string().trim().max(255).default(""),
  banner_alt: z.string().trim().max(255).default(""),
  listing_image_alt: z.string().trim().max(255).default(""),
  display_order: z.preprocess(
    (value) =>
      typeof value === "string" && /^[+-]?\d+$/.test(value)
        ? Number(value)
        : value,
    z.number().int().min(-2147483648).max(2147483647),
  ),
  status: z.enum(["Active", "Inactive"]).default("Active"),
});
const attributeValueSchema = z.object({
  type_id: z.coerce.number().int().positive(),
  name: z.string().trim().min(1).max(255),
  display_order: z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    z.coerce.number().int(),
  ),
  status: z.enum(["Active", "Inactive"]).default("Active"),
});
const productAttributeSchema = z.object({
  product_id: z.coerce.number().int().positive(),
  type_id: z.coerce.number().int().positive(),
  value_id: z.coerce.number().int().positive(),
  status: z.enum(["Active", "Inactive"]).default("Active"),
});
const tripDateSchema = z
  .object({
    id: z.coerce.number().int().positive().optional(),
    start_date: z.string().refine(isValidIsoDate, "Start date is invalid."),
    end_date: z.string().refine(isValidIsoDate, "End date is invalid."),
    date_range: z.coerce.number().int().min(0).default(0),
    price: z.coerce.number().min(0).default(0),
    single_price: z.coerce.number().min(0).default(0),
    status: z.enum(["Active", "Inactive", "Sold Out"]).default("Active"),
  })
  .refine((date) => date.end_date >= date.start_date, {
    message: "End date must be on or after start date.",
    path: ["end_date"],
  });
const tripBoxSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  image: z.string().max(255).default(""),
  image_alt: z.string().max(255).default(""),
  title: z.string().max(255).default(""),
  link: z.string().max(1000).default(""),
  display_order: z.coerce.number().int().default(1),
});
const itinerarySchema = z.object({
  day: z.coerce.number().int().positive(),
  title: z.string().trim().min(1).max(255),
  description: z.string().max(30000).default(""),
});
const tripNumberPattern = /^[+-]?((\d{1,3}(,\d{3})*)|\d+)?(\.\d+)?$/;
const requiredTripNumberText = z
  .string()
  .trim()
  .min(1)
  .regex(tripNumberPattern);
const normalizedTripNumberText = requiredTripNumberText.transform((value) =>
  value.replaceAll(",", ""),
);
const requiredTripAmount = normalizedTripNumberText
  .transform(Number)
  .pipe(z.number().finite().min(0));
const requiredTripInteger = z
  .string()
  .trim()
  .min(1)
  .regex(/^[+-]?\d+$/)
  .transform(Number)
  .pipe(z.number().int().min(1));
const tripSchema = z.object({
  name: z.string().trim().min(1).max(255),
  slug: z.string().trim().max(255).default(""),
  type_id: z.coerce.number().int().positive(),
  location_id: z.coerce.number().int().positive(),
  blog_post_display: z.string().max(255).default(""),
  activity_ids: z.string().default("[]"),
  activity_level: z.string().max(255).default(""),
  menu_name: z.string().trim().min(1).max(255),
  meta_title: z.string().trim().min(1).max(255),
  meta_descriptions: z.string().trim().min(1).max(10000),
  meta_keywords: z.string().trim().min(1).max(10000),
  short_description: z.string().trim().min(1).max(10000),
  description: z.string().trim().min(1).max(30000),
  days: requiredTripNumberText
    .max(10)
    .transform((value) => value.replaceAll(",", "")),
  nights: requiredTripNumberText
    .max(10)
    .transform((value) => value.replaceAll(",", "")),
  deposit_amount: requiredTripAmount,
  deposit_amount_text: z.string().trim().min(1).max(255),
  price: requiredTripAmount,
  price_text: z.string().max(255).default(""),
  single_price: requiredTripAmount,
  available_for: z.enum(["Specefic Date", "Specefic Month", "Year Round"]),
  included: z.string().trim().min(1).max(30000),
  excluded: z.string().trim().min(1).max(30000),
  highlight: z.string().max(30000).default(""),
  youtube_content: z.string().max(30000).default(""),
  activity: z.string().trim().min(1).max(30000),
  arrival: z.string().trim().min(1).max(30000),
  departure: z.string().trim().min(1).max(30000),
  pre_post_tour_travel: z.string().trim().min(1).max(30000),
  accommodations: z.string().trim().min(1).max(30000),
  meals: z.string().trim().min(1).max(30000),
  banner_title: z.string().max(255).default(""),
  banner_sub_title: z.string().max(255).default(""),
  tooltip_text: z.string().max(255).default(""),
  banner_alt: z.string().max(255).default(""),
  listing_image_alt: z.string().max(255).default(""),
  order: requiredTripInteger,
  status: z.enum(["Active", "Inactive"]).default("Active"),
});
const tripLeaderSchema = z.object({
  name: z.string().trim().min(1).max(255),
  guide_name: z.string().trim().min(1).max(255),
  meta_title: z.string().trim().min(1).max(255),
  meta_description: z.string().trim().min(1).max(10000),
  meta_keywords: z.string().trim().min(1).max(10000),
  short_descriptions: z.string().trim().min(1).max(10000),
  type: z.enum(["Guides", "Office Staff"]),
  display_order: z
    .string()
    .trim()
    .min(1)
    .regex(/^[+-]?\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(-2147483648).max(2147483647)),
  alps_hiking_author: z.string().max(50).default(""),
  switzerlandtravel_author: z.string().max(50).default(""),
  myswisskitchennew_author: z.string().max(50).default(""),
  description_blocks: z.string().default("[]"),
  status: z.enum(["Active", "Inactive"]).default("Active"),
});
const invoiceItemSchema = z.object({
  name: z.string().trim().min(1).max(255),
  price: z.coerce.number(),
  quantity: z.coerce.number().int().min(1).max(10),
});
const invoiceSchema = z.object({
  first_name: z.string().trim().min(1).max(255),
  last_name: z.string().trim().min(1).max(255),
  user_email_address: z.string().trim().min(1).max(255),
  day_phone: z.string().trim().min(1).max(50),
  street_address: z.string().trim().min(1).max(255),
  street_address1: z.string().max(255).default(""),
  postal_code: z.string().trim().min(1).max(20),
  city: z.string().trim().min(1).max(255),
  country: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(255),
  items: z.array(invoiceItemSchema).min(1),
  deposit_amount: z.coerce.number(),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  email_subject: z.string().trim().min(1).max(255),
  email_message: z.string().trim().min(1).max(30000),
});
const userSchema = z
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

function bannerSelect() {
  if (useLegacyBanners()) {
    return `SELECT banner_id AS id, banner_title AS title, banner_sub_heading AS sub_heading,
      banner_tooltip_text AS tooltip_text, banner_link AS link, banner_image AS image_filename,
      banner_alt AS image_alt, button_label, button_link, banner_order AS display_order,
      banner_status AS status FROM alpenwild_banner_tbl`;
  }
  return "SELECT * FROM banners";
}

function serializeBanner(row) {
  const imageUrl = row.image_filename
    ? `/uploads/${config.bannerUploadSubdir}/${encodeURIComponent(row.image_filename)}`
    : null;
  return { ...row, image_url: imageUrl };
}

function serializePromotion(row) {
  const imageUrl = row.image_filename
    ? `/uploads/${config.promotionsUploadSubdir}/${encodeURIComponent(row.image_filename)}`
    : null;
  return { ...row, image_url: imageUrl };
}

function serializeSpecialFeature(row) {
  const imageUrl = row.image_filename
    ? `/uploads/${config.specialFeatureUploadSubdir}/${encodeURIComponent(row.image_filename)}`
    : null;
  return { ...row, image_url: imageUrl };
}

function serializeCategory(row) {
  const imageUrl = (filename, folder) =>
    filename
      ? `/uploads/${config.categoryUploadSubdir}/${folder}/${encodeURIComponent(filename)}`
      : null;
  return {
    ...row,
    banner_image_url: imageUrl(row.banner_image, "banner"),
    listing_image_url: imageUrl(row.listing_image, "listing"),
    box_images: (row.box_images || []).map((box) => ({
      ...box,
      image_url: imageUrl(box.image, "boximage"),
    })),
  };
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

function parseCategoryBoxImages(value) {
  if (!value) return [];
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  return z.array(categoryBoxImageSchema).parse(parsed);
}

function serializeTripType(row) {
  const imageUrl = (filename, folder) =>
    filename
      ? `/uploads/${config.tripTypeUploadSubdir}/${folder}/${encodeURIComponent(filename)}`
      : null;
  return {
    ...row,
    banner_image_url: imageUrl(row.banner_image, "banner"),
    listing_image_url: imageUrl(row.listing_image, "listing"),
    listing_thumbnail_url: row.listing_image
      ? `/api/trip-type-images/listing/${encodeURIComponent(row.listing_image)}`
      : null,
    box_images: (row.box_images || []).map((box) => ({
      ...box,
      image_url: imageUrl(box.image, "boximage"),
    })),
  };
}

function parseTripTypeBoxImages(value) {
  if (!value) return [];
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  return z
    .array(tripTypeBoxImageSchema)
    .parse(parsed)
    .filter((box) => box.title.trim() && box.link.trim());
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

async function categoryBoxImagesFor(categoryIds) {
  if (!categoryIds.length) return new Map();
  const result = await query(
    `SELECT category_box_image_id AS id, category_id, category_box_image AS image,
      category_box_image_title AS title, category_box_image_link AS link
     FROM alpenwild_category_box_image_tbl
     WHERE category_id = ANY($1::int[]) ORDER BY category_box_image_id ASC`,
    [categoryIds],
  );
  const grouped = new Map();
  for (const row of result.rows) {
    if (!grouped.has(row.category_id)) grouped.set(row.category_id, []);
    grouped.get(row.category_id).push(row);
  }
  return grouped;
}

async function addCategoryBoxImages(categoryId, boxes, files) {
  for (let index = 0; index < boxes.length; index += 1) {
    const box = boxes[index];
    if (!box.title || !box.link) continue;
    const file = uploadedFile(files, `box_image_${index}`);
    let boxId = box.id;
    if (boxId) {
      const result = await query(
        `UPDATE alpenwild_category_box_image_tbl
         SET category_box_image_title=$1, category_box_image_link=$2
         WHERE category_box_image_id=$3 AND category_id=$4
         RETURNING category_box_image_id AS id`,
        [box.title, box.link, boxId, categoryId],
      );
      if (!result.rowCount) continue;
    } else {
      const result = await query(
        `INSERT INTO alpenwild_category_box_image_tbl
          (category_id, category_box_image, category_box_image_title, category_box_image_link)
         VALUES ($1, $2, $3, $4) RETURNING category_box_image_id AS id`,
        [categoryId, box.image || "", box.title, box.link],
      );
      boxId = result.rows[0].id;
    }
    if (file) {
      const filename = safeFilename(file, `category-box-${boxId}`);
      await fs.rename(
        file.path,
        path.join(config.categoryBoxImageUploadDir, filename),
      );
      await query(
        "UPDATE alpenwild_category_box_image_tbl SET category_box_image=$1 WHERE category_box_image_id=$2",
        [filename, boxId],
      );
    }
  }
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

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.get("/api/dashboard", async (_req, res, next) => {
  try {
    const result = await query(
      `SELECT COUNT(*)::int AS banners, COUNT(*) FILTER (WHERE status = 'Active')::int AS "activeBanners" FROM ${config.bannerTable}`,
    );
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.get("/api/banners", async (_req, res, next) => {
  try {
    const result = await query(
      `${bannerSelect()} ORDER BY display_order ASC, id ASC`,
    );
    res.json(result.rows.map(serializeBanner));
  } catch (error) {
    next(error);
  }
});

app.get("/api/promotions", async (_req, res, next) => {
  try {
    const select = useLegacyPromotions()
      ? `SELECT offers_promotions_id AS id, offers_promotions_title AS title,
          offers_promotions_text AS text, offers_promotions_link AS link,
          offers_promotions_image AS image_filename,
          offers_promotions_image_alt AS image_alt,
          offers_promotions_order AS display_order,
          offers_promotions_status AS status
         FROM alpenwild_offers_promotions_tbl`
      : `SELECT id, title, text, link, image_filename, image_alt,
          display_order, status FROM promotions`;
    const result = await query(`${select} ORDER BY display_order ASC, id ASC`);
    res.json(result.rows.map(serializePromotion));
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/promotions",
  promotionUpload.single("image"),
  async (req, res, next) => {
    try {
      const data = promotionSchema.parse(req.body);
      if (!req.file)
        return res
          .status(400)
          .json({ message: "Promotion image is required." });
      const duplicate = useLegacyPromotions()
        ? await query(
            "SELECT offers_promotions_id FROM alpenwild_offers_promotions_tbl WHERE LOWER(offers_promotions_title) = LOWER($1) LIMIT 1",
            [data.title],
          )
        : await query(
            "SELECT id FROM promotions WHERE LOWER(title) = LOWER($1) LIMIT 1",
            [data.title],
          );
      if (duplicate.rowCount)
        return res.status(409).json({
          message: "Sorry, name is already added. Please use another name.",
        });
      if (useLegacyPromotions()) {
        await query(
          "UPDATE alpenwild_offers_promotions_tbl SET offers_promotions_order = offers_promotions_order + 1 WHERE offers_promotions_order >= $1",
          [data.display_order],
        );
      } else {
        await query(
          "UPDATE promotions SET display_order = display_order + 1 WHERE display_order >= $1",
          [data.display_order],
        );
      }
      const filename = `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      await fs.rename(
        req.file.path,
        path.join(config.promotionsUploadDir, filename),
      );
      const result = useLegacyPromotions()
        ? await query(
            `INSERT INTO alpenwild_offers_promotions_tbl
             (offers_promotions_title, offers_promotions_text, offers_promotions_link,
              offers_promotions_image, offers_promotions_image_alt,
              offers_promotions_order, offers_promotions_status)
             VALUES ($1,$2,$3,$4,$5,$6,$7)
             RETURNING offers_promotions_id AS id, offers_promotions_title AS title,
              offers_promotions_text AS text, offers_promotions_link AS link,
              offers_promotions_image AS image_filename,
              offers_promotions_image_alt AS image_alt,
              offers_promotions_order AS display_order,
              offers_promotions_status AS status`,
            [
              data.title,
              data.text,
              data.link,
              filename,
              data.image_alt,
              data.display_order,
              data.status,
            ],
          )
        : await query(
            `INSERT INTO promotions
             (title, text, link, image_filename, image_alt, display_order, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [
              data.title,
              data.text,
              data.link,
              filename,
              data.image_alt,
              data.display_order,
              data.status,
            ],
          );
      res.status(201).json(serializePromotion(result.rows[0]));
    } catch (error) {
      next(error);
    }
  },
);

app.patch(
  "/api/promotions/:id",
  promotionUpload.single("image"),
  async (req, res, next) => {
    try {
      const data = promotionSchema.parse(req.body);
      const current = useLegacyPromotions()
        ? await query(
            "SELECT offers_promotions_image AS image, offers_promotions_order AS display_order FROM alpenwild_offers_promotions_tbl WHERE offers_promotions_id = $1",
            [req.params.id],
          )
        : await query(
            "SELECT image_filename AS image, display_order FROM promotions WHERE id = $1",
            [req.params.id],
          );
      if (!current.rowCount)
        return res.status(404).json({ message: "Promotion not found." });
      const duplicate = useLegacyPromotions()
        ? await query(
            "SELECT offers_promotions_id FROM alpenwild_offers_promotions_tbl WHERE LOWER(offers_promotions_title) = LOWER($1) AND offers_promotions_id <> $2 LIMIT 1",
            [data.title, req.params.id],
          )
        : await query(
            "SELECT id FROM promotions WHERE LOWER(title) = LOWER($1) AND id <> $2 LIMIT 1",
            [data.title, req.params.id],
          );
      if (duplicate.rowCount)
        return res.status(409).json({
          message: "Sorry, name is already added. Please use another name.",
        });
      if (!req.file && !current.rows[0].image)
        return res
          .status(400)
          .json({ message: "Promotion image is required." });

      let filename = null;
      if (req.file) {
        filename = `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        await fs.rename(
          req.file.path,
          path.join(config.promotionsUploadDir, filename),
        );
      }
      const oldOrder = Number(current.rows[0].display_order);
      if (data.display_order < oldOrder) {
        if (useLegacyPromotions()) {
          await query(
            "UPDATE alpenwild_offers_promotions_tbl SET offers_promotions_order = offers_promotions_order + 1 WHERE offers_promotions_order >= $1 AND offers_promotions_order < $2",
            [data.display_order, oldOrder],
          );
        } else {
          await query(
            "UPDATE promotions SET display_order = display_order + 1 WHERE display_order >= $1 AND display_order < $2",
            [data.display_order, oldOrder],
          );
        }
      } else if (data.display_order > oldOrder) {
        if (useLegacyPromotions()) {
          await query(
            "UPDATE alpenwild_offers_promotions_tbl SET offers_promotions_order = offers_promotions_order - 1 WHERE offers_promotions_order > $1 AND offers_promotions_order <= $2",
            [oldOrder, data.display_order],
          );
        } else {
          await query(
            "UPDATE promotions SET display_order = display_order - 1 WHERE display_order > $1 AND display_order <= $2",
            [oldOrder, data.display_order],
          );
        }
      }
      const result = useLegacyPromotions()
        ? await query(
            `UPDATE alpenwild_offers_promotions_tbl
             SET offers_promotions_title = $1, offers_promotions_text = $2,
                 offers_promotions_link = $3,
                 offers_promotions_image = COALESCE($4, offers_promotions_image),
                 offers_promotions_image_alt = $5, offers_promotions_order = $6,
                 offers_promotions_status = $7
             WHERE offers_promotions_id = $8
             RETURNING offers_promotions_id AS id, offers_promotions_title AS title,
              offers_promotions_text AS text, offers_promotions_link AS link,
              offers_promotions_image AS image_filename,
              offers_promotions_image_alt AS image_alt,
              offers_promotions_order AS display_order,
              offers_promotions_status AS status`,
            [
              data.title,
              data.text,
              data.link,
              filename,
              data.image_alt,
              data.display_order,
              data.status,
              req.params.id,
            ],
          )
        : await query(
            `UPDATE promotions SET title = $1, text = $2, link = $3,
             image_filename = COALESCE($4, image_filename), image_alt = $5,
             display_order = $6, status = $7, updated_at = NOW()
             WHERE id = $8 RETURNING *`,
            [
              data.title,
              data.text,
              data.link,
              filename,
              data.image_alt,
              data.display_order,
              data.status,
              req.params.id,
            ],
          );
      if (!result.rowCount)
        return res.status(404).json({ message: "Promotion not found." });
      res.json(serializePromotion(result.rows[0]));
    } catch (error) {
      next(error);
    }
  },
);

app.patch("/api/promotions/:id/status", async (req, res, next) => {
  try {
    const status = z.enum(["Active", "Inactive"]).parse(req.body.status);
    const result = useLegacyPromotions()
      ? await query(
          `UPDATE alpenwild_offers_promotions_tbl
           SET offers_promotions_status = $1 WHERE offers_promotions_id = $2
           RETURNING offers_promotions_id AS id, offers_promotions_title AS title,
            offers_promotions_text AS text, offers_promotions_link AS link,
            offers_promotions_image AS image_filename,
            offers_promotions_image_alt AS image_alt,
            offers_promotions_order AS display_order,
            offers_promotions_status AS status`,
          [status, req.params.id],
        )
      : await query(
          "UPDATE promotions SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
          [status, req.params.id],
        );
    if (!result.rowCount)
      return res.status(404).json({ message: "Promotion not found." });
    res.json(serializePromotion(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/promotions/:id", async (req, res, next) => {
  try {
    const result = useLegacyPromotions()
      ? await query(
          "DELETE FROM alpenwild_offers_promotions_tbl WHERE offers_promotions_id = $1 RETURNING offers_promotions_image AS image_filename",
          [req.params.id],
        )
      : await query(
          "DELETE FROM promotions WHERE id = $1 RETURNING image_filename",
          [req.params.id],
        );
    if (!result.rowCount)
      return res.status(404).json({ message: "Promotion not found." });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get("/api/special-features", async (_req, res, next) => {
  try {
    const select = useLegacySpecialFeatures()
      ? `SELECT special_feature_id AS id, special_feature_title AS title,
          special_feature_text AS text, special_feature_link AS link,
          special_feature_image AS image_filename,
          special_feature_image_alt AS image_alt,
          special_feature_order AS display_order,
          special_feature_status AS status
         FROM alpenwild_special_feature_tbl`
      : `SELECT id, title, text, link, image_filename, image_alt,
          display_order, status FROM special_features`;
    const result = await query(`${select} ORDER BY display_order ASC, id ASC`);
    res.json(result.rows.map(serializeSpecialFeature));
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/special-features",
  specialFeatureUpload.single("image"),
  async (req, res, next) => {
    try {
      const data = specialFeatureSchema.parse(req.body);
      if (!req.file)
        return res
          .status(400)
          .json({ message: "Special feature image is required." });
      const duplicate = useLegacySpecialFeatures()
        ? await query(
            "SELECT special_feature_id FROM alpenwild_special_feature_tbl WHERE LOWER(special_feature_title) = LOWER($1) LIMIT 1",
            [data.title],
          )
        : await query(
            "SELECT id FROM special_features WHERE LOWER(title) = LOWER($1) LIMIT 1",
            [data.title],
          );
      if (duplicate.rowCount)
        return res.status(409).json({
          message: "Sorry, name is already added. Please use another name.",
        });
      if (useLegacySpecialFeatures()) {
        await query(
          "UPDATE alpenwild_special_feature_tbl SET special_feature_order = special_feature_order + 1 WHERE special_feature_order >= $1",
          [data.display_order],
        );
      } else {
        await query(
          "UPDATE special_features SET display_order = display_order + 1 WHERE display_order >= $1",
          [data.display_order],
        );
      }
      const filename = `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      await fs.rename(
        req.file.path,
        path.join(config.specialFeatureUploadDir, filename),
      );
      const result = useLegacySpecialFeatures()
        ? await query(
            `INSERT INTO alpenwild_special_feature_tbl
             (special_feature_title, special_feature_text, special_feature_link,
              special_feature_image, special_feature_image_alt,
              special_feature_order, special_feature_status)
             VALUES ($1,$2,$3,$4,$5,$6,$7)
             RETURNING special_feature_id AS id, special_feature_title AS title,
              special_feature_text AS text, special_feature_link AS link,
              special_feature_image AS image_filename,
              special_feature_image_alt AS image_alt,
              special_feature_order AS display_order,
              special_feature_status AS status`,
            [
              data.title,
              data.text,
              data.link,
              filename,
              data.image_alt,
              data.display_order,
              data.status,
            ],
          )
        : await query(
            `INSERT INTO special_features
             (title, text, link, image_filename, image_alt, display_order, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [
              data.title,
              data.text,
              data.link,
              filename,
              data.image_alt,
              data.display_order,
              data.status,
            ],
          );
      res.status(201).json(serializeSpecialFeature(result.rows[0]));
    } catch (error) {
      next(error);
    }
  },
);

app.patch(
  "/api/special-features/:id",
  specialFeatureUpload.single("image"),
  async (req, res, next) => {
    try {
      const data = specialFeatureSchema.parse(req.body);
      const current = useLegacySpecialFeatures()
        ? await query(
            "SELECT special_feature_image AS image, special_feature_order AS display_order FROM alpenwild_special_feature_tbl WHERE special_feature_id = $1",
            [req.params.id],
          )
        : await query(
            "SELECT image_filename AS image, display_order FROM special_features WHERE id = $1",
            [req.params.id],
          );
      if (!current.rowCount)
        return res.status(404).json({ message: "Special feature not found." });
      const duplicate = useLegacySpecialFeatures()
        ? await query(
            "SELECT special_feature_id FROM alpenwild_special_feature_tbl WHERE LOWER(special_feature_title) = LOWER($1) AND special_feature_id <> $2 LIMIT 1",
            [data.title, req.params.id],
          )
        : await query(
            "SELECT id FROM special_features WHERE LOWER(title) = LOWER($1) AND id <> $2 LIMIT 1",
            [data.title, req.params.id],
          );
      if (duplicate.rowCount)
        return res.status(409).json({
          message: "Sorry, name is already added. Please use another name.",
        });
      if (!req.file && !current.rows[0].image)
        return res
          .status(400)
          .json({ message: "Special feature image is required." });

      let filename = null;
      if (req.file) {
        filename = `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        await fs.rename(
          req.file.path,
          path.join(config.specialFeatureUploadDir, filename),
        );
      }
      const oldOrder = Number(current.rows[0].display_order);
      if (data.display_order < oldOrder) {
        if (useLegacySpecialFeatures()) {
          await query(
            "UPDATE alpenwild_special_feature_tbl SET special_feature_order = special_feature_order + 1 WHERE special_feature_order >= $1 AND special_feature_order < $2",
            [data.display_order, oldOrder],
          );
        } else {
          await query(
            "UPDATE special_features SET display_order = display_order + 1 WHERE display_order >= $1 AND display_order < $2",
            [data.display_order, oldOrder],
          );
        }
      } else if (data.display_order > oldOrder) {
        if (useLegacySpecialFeatures()) {
          await query(
            "UPDATE alpenwild_special_feature_tbl SET special_feature_order = special_feature_order - 1 WHERE special_feature_order > $1 AND special_feature_order <= $2",
            [oldOrder, data.display_order],
          );
        } else {
          await query(
            "UPDATE special_features SET display_order = display_order - 1 WHERE display_order > $1 AND display_order <= $2",
            [oldOrder, data.display_order],
          );
        }
      }
      const result = useLegacySpecialFeatures()
        ? await query(
            `UPDATE alpenwild_special_feature_tbl
             SET special_feature_title = $1, special_feature_text = $2,
                 special_feature_link = $3,
                 special_feature_image = COALESCE($4, special_feature_image),
                 special_feature_image_alt = $5, special_feature_order = $6,
                 special_feature_status = $7
             WHERE special_feature_id = $8
             RETURNING special_feature_id AS id, special_feature_title AS title,
              special_feature_text AS text, special_feature_link AS link,
              special_feature_image AS image_filename,
              special_feature_image_alt AS image_alt,
              special_feature_order AS display_order,
              special_feature_status AS status`,
            [
              data.title,
              data.text,
              data.link,
              filename,
              data.image_alt,
              data.display_order,
              data.status,
              req.params.id,
            ],
          )
        : await query(
            `UPDATE special_features SET title = $1, text = $2, link = $3,
             image_filename = COALESCE($4, image_filename), image_alt = $5,
             display_order = $6, status = $7, updated_at = NOW()
             WHERE id = $8 RETURNING *`,
            [
              data.title,
              data.text,
              data.link,
              filename,
              data.image_alt,
              data.display_order,
              data.status,
              req.params.id,
            ],
          );
      if (!result.rowCount)
        return res.status(404).json({ message: "Special feature not found." });
      res.json(serializeSpecialFeature(result.rows[0]));
    } catch (error) {
      next(error);
    }
  },
);

app.patch("/api/special-features/:id/status", async (req, res, next) => {
  try {
    const status = z.enum(["Active", "Inactive"]).parse(req.body.status);
    const result = useLegacySpecialFeatures()
      ? await query(
          `UPDATE alpenwild_special_feature_tbl
           SET special_feature_status = $1 WHERE special_feature_id = $2
           RETURNING special_feature_id AS id, special_feature_title AS title,
            special_feature_text AS text, special_feature_link AS link,
            special_feature_image AS image_filename,
            special_feature_image_alt AS image_alt,
            special_feature_order AS display_order,
            special_feature_status AS status`,
          [status, req.params.id],
        )
      : await query(
          "UPDATE special_features SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
          [status, req.params.id],
        );
    if (!result.rowCount)
      return res.status(404).json({ message: "Special feature not found." });
    res.json(serializeSpecialFeature(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/special-features/:id", async (req, res, next) => {
  try {
    const result = useLegacySpecialFeatures()
      ? await query(
          "DELETE FROM alpenwild_special_feature_tbl WHERE special_feature_id = $1 RETURNING special_feature_image AS image_filename",
          [req.params.id],
        )
      : await query(
          "DELETE FROM special_features WHERE id = $1 RETURNING image_filename",
          [req.params.id],
        );
    if (!result.rowCount)
      return res.status(404).json({ message: "Special feature not found." });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get("/api/footer-menus", async (_req, res, next) => {
  try {
    const select = useLegacyFooterMenus()
      ? `SELECT footer_menu_id AS id, footer_menu_title AS title,
          footer_menu_under AS under, footer_menu_link AS link,
          footer_menu_link_target AS link_target,
          footer_menu_order AS display_order, footer_menu_status AS status
         FROM alpenwild_footer_menu_tbl`
      : `SELECT id, title, under, link, link_target, display_order, status
         FROM footer_menus`;
    const result = await query(`${select} ORDER BY display_order ASC, id ASC`);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.post("/api/footer-menus", async (req, res, next) => {
  try {
    const data = footerMenuSchema.parse(req.body);
    const duplicate = useLegacyFooterMenus()
      ? await query(
          "SELECT footer_menu_id FROM alpenwild_footer_menu_tbl WHERE LOWER(footer_menu_title) = LOWER($1) AND footer_menu_under = $2 LIMIT 1",
          [data.title, data.under],
        )
      : await query(
          "SELECT id FROM footer_menus WHERE LOWER(title) = LOWER($1) AND under = $2 LIMIT 1",
          [data.title, data.under],
        );
    if (duplicate.rowCount)
      return res.status(409).json({
        message: "Sorry, name is already added. Please use another name.",
      });
    const result = useLegacyFooterMenus()
      ? await query(
          `INSERT INTO alpenwild_footer_menu_tbl
           (footer_menu_title, footer_menu_under, footer_menu_link,
            footer_menu_link_target, footer_menu_order, footer_menu_status)
           VALUES ($1,$2,$3,$4,$5,$6)
           RETURNING footer_menu_id AS id, footer_menu_title AS title,
            footer_menu_under AS under, footer_menu_link AS link,
            footer_menu_link_target AS link_target,
            footer_menu_order AS display_order, footer_menu_status AS status`,
          [
            data.title,
            data.under,
            data.link,
            data.link_target,
            data.display_order,
            data.status,
          ],
        )
      : await query(
          `INSERT INTO footer_menus
           (title, under, link, link_target, display_order, status)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
          [
            data.title,
            data.under,
            data.link,
            data.link_target,
            data.display_order,
            data.status,
          ],
        );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/footer-menus/:id", async (req, res, next) => {
  try {
    const data = footerMenuSchema.parse(req.body);
    const duplicate = useLegacyFooterMenus()
      ? await query(
          "SELECT footer_menu_id FROM alpenwild_footer_menu_tbl WHERE LOWER(footer_menu_title) = LOWER($1) AND footer_menu_under = $2 AND footer_menu_id <> $3 LIMIT 1",
          [data.title, data.under, req.params.id],
        )
      : await query(
          "SELECT id FROM footer_menus WHERE LOWER(title) = LOWER($1) AND under = $2 AND id <> $3 LIMIT 1",
          [data.title, data.under, req.params.id],
        );
    if (duplicate.rowCount)
      return res.status(409).json({
        message: "Sorry, name is already added. Please use another name.",
      });
    const result = useLegacyFooterMenus()
      ? await query(
          `UPDATE alpenwild_footer_menu_tbl SET footer_menu_title = $1,
           footer_menu_under = $2, footer_menu_link = $3,
           footer_menu_link_target = $4, footer_menu_order = $5,
           footer_menu_status = $6 WHERE footer_menu_id = $7
           RETURNING footer_menu_id AS id, footer_menu_title AS title,
            footer_menu_under AS under, footer_menu_link AS link,
            footer_menu_link_target AS link_target,
            footer_menu_order AS display_order, footer_menu_status AS status`,
          [
            data.title,
            data.under,
            data.link,
            data.link_target,
            data.display_order,
            data.status,
            req.params.id,
          ],
        )
      : await query(
          `UPDATE footer_menus SET title = $1, under = $2, link = $3,
           link_target = $4, display_order = $5, status = $6,
           updated_at = NOW() WHERE id = $7 RETURNING *`,
          [
            data.title,
            data.under,
            data.link,
            data.link_target,
            data.display_order,
            data.status,
            req.params.id,
          ],
        );
    if (!result.rowCount)
      return res.status(404).json({ message: "Footer menu not found." });
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/footer-menus/:id/status", async (req, res, next) => {
  try {
    const status = z.enum(["Active", "Inactive"]).parse(req.body.status);
    const result = useLegacyFooterMenus()
      ? await query(
          `UPDATE alpenwild_footer_menu_tbl SET footer_menu_status = $1
           WHERE footer_menu_id = $2 RETURNING footer_menu_id AS id,
            footer_menu_title AS title, footer_menu_under AS under,
            footer_menu_link AS link, footer_menu_link_target AS link_target,
            footer_menu_order AS display_order, footer_menu_status AS status`,
          [status, req.params.id],
        )
      : await query(
          "UPDATE footer_menus SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
          [status, req.params.id],
        );
    if (!result.rowCount)
      return res.status(404).json({ message: "Footer menu not found." });
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/footer-menus/:id", async (req, res, next) => {
  try {
    const result = useLegacyFooterMenus()
      ? await query(
          "DELETE FROM alpenwild_footer_menu_tbl WHERE footer_menu_id = $1 RETURNING footer_menu_id",
          [req.params.id],
        )
      : await query("DELETE FROM footer_menus WHERE id = $1 RETURNING id", [
          req.params.id,
        ]);
    if (!result.rowCount)
      return res.status(404).json({ message: "Footer menu not found." });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get("/api/locations", async (_req, res, next) => {
  try {
    const result = useLegacyLocations()
      ? await query(
          "SELECT location_id AS id, location_name AS name, location_status AS status FROM alpenwild_location_tbl ORDER BY location_id ASC",
        )
      : await query("SELECT id, name, status FROM locations ORDER BY id ASC");
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.get("/api/public-trip-filters", async (_req, res, next) => {
  try {
    const [locations, activities] = await Promise.all([
      useLegacyLocations()
        ? query(
            "SELECT location_id AS id, location_name AS name, location_status AS status FROM alpenwild_location_tbl WHERE location_status = 'Active' ORDER BY location_id ASC",
          )
        : query(
            "SELECT id, name, status FROM locations WHERE status = 'Active' ORDER BY id ASC",
          ),
      useLegacyActivities()
        ? query(
            "SELECT activity_id AS id, activity_name AS name, activity_status AS status FROM alpenwild_activity_tbl WHERE activity_status = 'Active' ORDER BY activity_id ASC",
          )
        : query(
            "SELECT id, name, status FROM activities WHERE status = 'Active' ORDER BY id ASC",
          ),
    ]);
    res.json({ locations: locations.rows, activities: activities.rows });
  } catch (error) {
    next(error);
  }
});

async function locationNameConflict(name, excludedId) {
  const result = useLegacyLocations()
    ? await query(
        `SELECT location_id FROM alpenwild_location_tbl
         WHERE location_name=$1
         ${excludedId ? "AND location_id<>$2" : ""}
         LIMIT 1`,
        excludedId ? [name, excludedId] : [name],
      )
    : await query(
        `SELECT id FROM locations
         WHERE name=$1
         ${excludedId ? "AND id<>$2" : ""}
         LIMIT 1`,
        excludedId ? [name, excludedId] : [name],
      );
  return result.rowCount > 0;
}

app.post("/api/locations", async (req, res, next) => {
  try {
    const data = simpleNameSchema.parse(req.body);
    if (await locationNameConflict(data.name))
      return res.status(409).json({
        message:
          "Sorry, location name is already added. Please use another name.",
      });
    const result = useLegacyLocations()
      ? await query(
          "INSERT INTO alpenwild_location_tbl (location_name, location_status) VALUES ($1, $2) RETURNING location_id AS id, location_name AS name, location_status AS status",
          [data.name, data.status],
        )
      : await query(
          "INSERT INTO locations (name, status) VALUES ($1, $2) RETURNING id, name, status",
          [data.name, data.status],
        );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error?.code === "23505")
      return res.status(409).json({
        message:
          "Sorry, location name is already added. Please use another name.",
      });
    next(error);
  }
});

app.patch("/api/locations/:id", async (req, res, next) => {
  try {
    const data = simpleNameSchema.parse(req.body);
    if (await locationNameConflict(data.name, req.params.id))
      return res.status(409).json({
        message:
          "Sorry, location name is already added. Please use another name.",
      });
    const result = useLegacyLocations()
      ? await query(
          "UPDATE alpenwild_location_tbl SET location_name=$1, location_status=$2 WHERE location_id=$3 RETURNING location_id AS id, location_name AS name, location_status AS status",
          [data.name, data.status, req.params.id],
        )
      : await query(
          "UPDATE locations SET name=$1, status=$2, updated_at=NOW() WHERE id=$3 RETURNING id, name, status",
          [data.name, data.status, req.params.id],
        );
    if (!result.rowCount)
      return res.status(404).json({ message: "Location not found." });
    res.json(result.rows[0]);
  } catch (error) {
    if (error?.code === "23505")
      return res.status(409).json({
        message:
          "Sorry, location name is already added. Please use another name.",
      });
    next(error);
  }
});

app.patch("/api/locations/:id/status", async (req, res, next) => {
  try {
    const status = z.enum(["Active", "Inactive"]).parse(req.body.status);
    const result = useLegacyLocations()
      ? await query(
          "UPDATE alpenwild_location_tbl SET location_status=$1 WHERE location_id=$2 RETURNING location_id AS id, location_name AS name, location_status AS status",
          [status, req.params.id],
        )
      : await query(
          "UPDATE locations SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING id, name, status",
          [status, req.params.id],
        );
    if (!result.rowCount)
      return res.status(404).json({ message: "Location not found." });
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/locations/:id", async (req, res, next) => {
  try {
    if (useLegacyTrips()) {
      const trips = await query(
        "SELECT trips_id FROM alpenwild_trips_tbl WHERE location_id=$1 LIMIT 1",
        [req.params.id],
      );
      if (trips.rowCount)
        return res.status(409).json({
          message:
            "Trip existing under this location. First delete trip and then delete this location.",
        });
    }
    const result = useLegacyLocations()
      ? await query(
          "DELETE FROM alpenwild_location_tbl WHERE location_id=$1 RETURNING location_id",
          [req.params.id],
        )
      : await query("DELETE FROM locations WHERE id=$1 RETURNING id", [
          req.params.id,
        ]);
    if (!result.rowCount)
      return res.status(404).json({ message: "Location not found." });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get("/api/activities", async (_req, res, next) => {
  try {
    const result = useLegacyActivities()
      ? await query(
          "SELECT activity_id AS id, activity_name AS name, activity_status AS status FROM alpenwild_activity_tbl ORDER BY activity_id ASC",
        )
      : await query("SELECT id, name, status FROM activities ORDER BY id ASC");
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

async function activityNameConflict(name, excludedId) {
  const result = useLegacyActivities()
    ? await query(
        `SELECT activity_id FROM alpenwild_activity_tbl
       WHERE LOWER(activity_name)=LOWER($1)
         ${excludedId ? "AND activity_id<>$2" : ""}
         LIMIT 1`,
        excludedId ? [name, excludedId] : [name],
      )
    : await query(
        `SELECT id FROM activities
       WHERE LOWER(name)=LOWER($1)
         ${excludedId ? "AND id<>$2" : ""}
         LIMIT 1`,
        excludedId ? [name, excludedId] : [name],
      );
  return result.rowCount > 0;
}

app.get("/api/attribute-types", async (_req, res, next) => {
  try {
    const result = useLegacyAttributeTypes()
      ? await query(
          "SELECT attribute_type_id AS id, attribute_type_name AS name, attribute_type_status AS status FROM alpenwild_attribute_type_tbl ORDER BY attribute_type_id ASC",
        )
      : await query(
          "SELECT id, name, status FROM attribute_types ORDER BY id ASC",
        );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.post("/api/attribute-types", async (req, res, next) => {
  try {
    const data = simpleNameSchema.parse(req.body);
    const duplicate = useLegacyAttributeTypes()
      ? await query(
          "SELECT 1 FROM alpenwild_attribute_type_tbl WHERE LOWER(attribute_type_name)=LOWER($1) LIMIT 1",
          [data.name],
        )
      : await query(
          "SELECT 1 FROM attribute_types WHERE LOWER(name)=LOWER($1) LIMIT 1",
          [data.name],
        );
    if (duplicate.rowCount)
      return res.status(409).json({
        message:
          "Sorry, attribute_type name is already added. Please use another name.",
      });
    const result = useLegacyAttributeTypes()
      ? await query(
          "INSERT INTO alpenwild_attribute_type_tbl (attribute_type_name, attribute_type_status) VALUES ($1, $2) RETURNING attribute_type_id AS id, attribute_type_name AS name, attribute_type_status AS status",
          [data.name, data.status],
        )
      : await query(
          "INSERT INTO attribute_types (name, status) VALUES ($1, $2) RETURNING id, name, status",
          [data.name, data.status],
        );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/attribute-types/:id", async (req, res, next) => {
  try {
    const data = simpleNameSchema.parse(req.body);
    const duplicate = useLegacyAttributeTypes()
      ? await query(
          "SELECT 1 FROM alpenwild_attribute_type_tbl WHERE LOWER(attribute_type_name)=LOWER($1) AND attribute_type_id<>$2 LIMIT 1",
          [data.name, req.params.id],
        )
      : await query(
          "SELECT 1 FROM attribute_types WHERE LOWER(name)=LOWER($1) AND id<>$2 LIMIT 1",
          [data.name, req.params.id],
        );
    if (duplicate.rowCount)
      return res.status(409).json({
        message:
          "Sorry, attribute_type name is already added. Please use another name.",
      });
    const result = useLegacyAttributeTypes()
      ? await query(
          "UPDATE alpenwild_attribute_type_tbl SET attribute_type_name=$1, attribute_type_status=$2 WHERE attribute_type_id=$3 RETURNING attribute_type_id AS id, attribute_type_name AS name, attribute_type_status AS status",
          [data.name, data.status, req.params.id],
        )
      : await query(
          "UPDATE attribute_types SET name=$1, status=$2, updated_at=NOW() WHERE id=$3 RETURNING id, name, status",
          [data.name, data.status, req.params.id],
        );
    if (!result.rowCount)
      return res.status(404).json({ message: "Attribute type not found." });
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/attribute-types/:id/status", async (req, res, next) => {
  try {
    const status = z.enum(["Active", "Inactive"]).parse(req.body.status);
    const result = useLegacyAttributeTypes()
      ? await query(
          "UPDATE alpenwild_attribute_type_tbl SET attribute_type_status=$1 WHERE attribute_type_id=$2 RETURNING attribute_type_id AS id, attribute_type_name AS name, attribute_type_status AS status",
          [status, req.params.id],
        )
      : await query(
          "UPDATE attribute_types SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING id, name, status",
          [status, req.params.id],
        );
    if (!result.rowCount)
      return res.status(404).json({ message: "Attribute type not found." });
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/attribute-types/:id", async (req, res, next) => {
  try {
    if (useLegacyAttributeTypes()) {
      const linked = await query(
        "SELECT 1 FROM alpenwild_attribute_value_tbl WHERE attribute_type_id=$1 LIMIT 1",
        [req.params.id],
      );
      if (linked.rowCount)
        return res.status(409).json({
          message:
            "Value existing under this attribute type. First delete value and then delete this attribute type.",
        });
      const result = await query(
        "DELETE FROM alpenwild_attribute_type_tbl WHERE attribute_type_id=$1 RETURNING attribute_type_id",
        [req.params.id],
      );
      if (!result.rowCount)
        return res.status(404).json({ message: "Attribute type not found." });
      return res.status(204).end();
    }
    const result = await query(
      "DELETE FROM attribute_types WHERE id=$1 RETURNING id",
      [req.params.id],
    );
    if (!result.rowCount)
      return res.status(404).json({ message: "Attribute type not found." });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get("/api/attribute-values", async (_req, res, next) => {
  try {
    const result = useLegacyAttributeValues()
      ? await query(`SELECT v.attribute_value_id AS id, v.attribute_type_id AS type_id,
          t.attribute_type_name AS type_name, v.attribute_value AS name,
          v.attribute_value_order AS display_order, v.attribute_value_status AS status
         FROM alpenwild_attribute_value_tbl v
         LEFT JOIN alpenwild_attribute_type_tbl t ON t.attribute_type_id = v.attribute_type_id
         ORDER BY v.attribute_value_order ASC, v.attribute_value_id ASC`)
      : await query(`SELECT v.id, v.type_id, t.name AS type_name, v.name,
          v.display_order, v.status
         FROM attribute_values v
         LEFT JOIN attribute_types t ON t.id = v.type_id
         ORDER BY v.display_order ASC, v.id ASC`);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.post("/api/attribute-values", async (req, res, next) => {
  try {
    const data = attributeValueSchema.parse(req.body);
    const storage = attributeValueStorage();
    const duplicate = useLegacyAttributeValues()
      ? await query(
          "SELECT 1 FROM alpenwild_attribute_value_tbl WHERE LOWER(attribute_value)=LOWER($1) LIMIT 1",
          [data.name],
        )
      : await query(
          "SELECT 1 FROM attribute_values WHERE LOWER(name)=LOWER($1) LIMIT 1",
          [data.name],
        );
    if (duplicate.rowCount)
      return res.status(409).json({
        message: "Sorry, name is already added. Please use another name.",
      });
    await query(
      `UPDATE ${storage.table}
       SET ${storage.order}=${storage.order}+1
       WHERE ${storage.type}=$1 AND ${storage.order}>=$2`,
      [data.type_id, data.display_order],
    );
    const result = await query(
      `INSERT INTO ${storage.table}
       (${storage.type}, ${storage.name}, ${storage.order}, ${storage.status})
       VALUES ($1, $2, $3, $4)
       RETURNING ${storage.id} AS id, ${storage.type} AS type_id,
         ${storage.name} AS name, ${storage.order} AS display_order,
         ${storage.status} AS status`,
      [data.type_id, data.name, data.display_order, data.status],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

function attributeValueStorage() {
  return useLegacyAttributeValues()
    ? {
        table: "alpenwild_attribute_value_tbl",
        id: "attribute_value_id",
        type: "attribute_type_id",
        name: "attribute_value",
        order: "attribute_value_order",
        status: "attribute_value_status",
      }
    : {
        table: "attribute_values",
        id: "id",
        type: "type_id",
        name: "name",
        order: "display_order",
        status: "status",
      };
}

app.patch("/api/attribute-values/:id", async (req, res, next) => {
  try {
    const data = attributeValueSchema.parse(req.body);
    const storage = attributeValueStorage();
    const duplicate = useLegacyAttributeValues()
      ? await query(
          `SELECT 1 FROM alpenwild_attribute_value_tbl
           WHERE LOWER(attribute_value)=LOWER($1) AND attribute_value_id<>$2 LIMIT 1`,
          [data.name, req.params.id],
        )
      : await query(
          `SELECT 1 FROM attribute_values
           WHERE LOWER(name)=LOWER($1) AND id<>$2 LIMIT 1`,
          [data.name, req.params.id],
        );
    if (duplicate.rowCount)
      return res.status(409).json({
        message: "Sorry, name is already added. Please use another name.",
      });
    const current = await query(
      `SELECT ${storage.order} AS display_order
       FROM ${storage.table} WHERE ${storage.id}=$1`,
      [req.params.id],
    );
    if (!current.rowCount)
      return res.status(404).json({ message: "Attribute value not found." });
    const oldOrder = Number(current.rows[0].display_order);
    if (data.display_order < oldOrder) {
      await query(
        `UPDATE ${storage.table}
         SET ${storage.order}=${storage.order}+1
         WHERE ${storage.type}=$1 AND ${storage.order}>=$2 AND ${storage.order}<$3`,
        [data.type_id, data.display_order, oldOrder],
      );
    } else if (data.display_order > oldOrder) {
      await query(
        `UPDATE ${storage.table}
         SET ${storage.order}=${storage.order}-1
         WHERE ${storage.type}=$1 AND ${storage.order}>$2 AND ${storage.order}<=$3`,
        [data.type_id, oldOrder, data.display_order],
      );
    }
    const result = await query(
      `UPDATE ${storage.table}
       SET ${storage.type}=$1, ${storage.name}=$2, ${storage.order}=$3,
         ${storage.status}=$4
       ${useLegacyAttributeValues() ? "" : ", updated_at=NOW()"}
       WHERE ${storage.id}=$5
       RETURNING ${storage.id} AS id, ${storage.type} AS type_id,
         ${storage.name} AS name, ${storage.order} AS display_order,
         ${storage.status} AS status`,
      [data.type_id, data.name, data.display_order, data.status, req.params.id],
    );
    if (!result.rowCount)
      return res.status(404).json({ message: "Attribute value not found." });
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/attribute-values/:id/status", async (req, res, next) => {
  try {
    const status = z.enum(["Active", "Inactive"]).parse(req.body.status);
    const result = useLegacyAttributeValues()
      ? await query(
          `UPDATE alpenwild_attribute_value_tbl SET attribute_value_status=$1
          WHERE attribute_value_id=$2
          RETURNING attribute_value_id AS id, attribute_type_id AS type_id,
            attribute_value AS name, attribute_value_order AS display_order,
            attribute_value_status AS status`,
          [status, req.params.id],
        )
      : await query(
          `UPDATE attribute_values SET status=$1, updated_at=NOW()
          WHERE id=$2 RETURNING id, type_id, name, display_order, status`,
          [status, req.params.id],
        );
    if (!result.rowCount)
      return res.status(404).json({ message: "Attribute value not found." });
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/attribute-values/:id", async (req, res, next) => {
  try {
    const associationTable = useLegacyProductAttributes()
      ? "alpenwild_product_attribute_value_tbl"
      : "product_attributes";
    const valueColumn = useLegacyProductAttributes()
      ? "attribute_value_id"
      : "value_id";
    const inUse = await query(
      `SELECT 1 FROM ${associationTable} WHERE ${valueColumn}=$1 LIMIT 1`,
      [req.params.id],
    );
    if (inUse.rowCount)
      return res.status(409).json({
        message:
          "Some of the product(s) use this attribute value. First remove this attribute value from the product(s) and then delete this attribute value.",
      });
    const result = useLegacyAttributeValues()
      ? await query(
          "DELETE FROM alpenwild_attribute_value_tbl WHERE attribute_value_id=$1 RETURNING attribute_value_id",
          [req.params.id],
        )
      : await query("DELETE FROM attribute_values WHERE id=$1 RETURNING id", [
          req.params.id,
        ]);
    if (!result.rowCount)
      return res
        .status(404)
        .json({ message: "Nothing is deleted successfully" });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

function productAttributeSelect() {
  const association = useLegacyProductAttributes()
    ? "alpenwild_product_attribute_value_tbl"
    : "product_attributes";
  const productTable = useLegacyProducts()
    ? "alpenwild_product_tbl"
    : "products";
  const productId = useLegacyProducts() ? "product_id" : "id";
  const productName = useLegacyProducts() ? "product_name" : "name";
  const typeTable = useLegacyAttributeTypes()
    ? "alpenwild_attribute_type_tbl"
    : "attribute_types";
  const typeId = useLegacyAttributeTypes() ? "attribute_type_id" : "id";
  const typeName = useLegacyAttributeTypes() ? "attribute_type_name" : "name";
  const valueTable = useLegacyAttributeValues()
    ? "alpenwild_attribute_value_tbl"
    : "attribute_values";
  const valueId = useLegacyAttributeValues() ? "attribute_value_id" : "id";
  const valueName = useLegacyAttributeValues() ? "attribute_value" : "name";
  return useLegacyProductAttributes()
    ? `SELECT a.product_attribute_value_id AS id, a.product_id,
        a.attribute_type_id AS type_id, a.attribute_value_id AS value_id,
        p.${productName} AS product_name, t.${typeName} AS type_name,
        v.${valueName} AS value_name, 'Active' AS status
       FROM ${association} a
       LEFT JOIN ${productTable} p ON p.${productId}=a.product_id
       LEFT JOIN ${typeTable} t ON t.${typeId}=a.attribute_type_id
       LEFT JOIN ${valueTable} v ON v.${valueId}=a.attribute_value_id`
    : `SELECT a.id, a.product_id, a.type_id, a.value_id,
        p.${productName} AS product_name, t.${typeName} AS type_name,
        v.${valueName} AS value_name, a.status
       FROM ${association} a
       LEFT JOIN ${productTable} p ON p.${productId}=a.product_id
       LEFT JOIN ${typeTable} t ON t.${typeId}=a.type_id
       LEFT JOIN ${valueTable} v ON v.${valueId}=a.value_id`;
}

app.get(
  ["/api/product-attributes", "/api/product-attribute-values"],
  async (_req, res, next) => {
    try {
      const result = await query(`${productAttributeSelect()} ORDER BY 1 ASC`);
      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  },
);

app.post(
  ["/api/product-attributes", "/api/product-attribute-values"],
  async (req, res, next) => {
    try {
      const data = productAttributeSchema.parse(req.body);
      const duplicate = useLegacyProductAttributes()
        ? await query(
            "SELECT 1 FROM alpenwild_product_attribute_value_tbl WHERE product_id=$1 AND attribute_value_id=$2 LIMIT 1",
            [data.product_id, data.value_id],
          )
        : await query(
            "SELECT 1 FROM product_attributes WHERE product_id=$1 AND value_id=$2 LIMIT 1",
            [data.product_id, data.value_id],
          );
      if (duplicate.rowCount) {
        return res.status(409).json({
          message:
            "Sorry, attribute details is already added under this product. Please use another attribute.",
        });
      }
      const result = useLegacyProductAttributes()
        ? await query(
            `INSERT INTO alpenwild_product_attribute_value_tbl
          (product_id, attribute_type_id, attribute_value_id)
         VALUES ($1, $2, $3)
         RETURNING product_attribute_value_id AS id, product_id,
           attribute_type_id AS type_id, attribute_value_id AS value_id,
           'Active' AS status`,
            [data.product_id, data.type_id, data.value_id],
          )
        : await query(
            `INSERT INTO product_attributes (product_id, type_id, value_id, status)
         VALUES ($1, $2, $3, $4)
         RETURNING id, product_id, type_id, value_id, status`,
            [data.product_id, data.type_id, data.value_id, data.status],
          );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  },
);

app.patch(
  ["/api/product-attributes/:id", "/api/product-attribute-values/:id"],
  async (req, res, next) => {
    try {
      const data = productAttributeSchema.parse(req.body);
      const duplicate = useLegacyProductAttributes()
        ? await query(
            `SELECT 1 FROM alpenwild_product_attribute_value_tbl
         WHERE product_id=$1 AND attribute_value_id=$2 AND product_attribute_value_id<>$3 LIMIT 1`,
            [data.product_id, data.value_id, req.params.id],
          )
        : await query(
            "SELECT 1 FROM product_attributes WHERE product_id=$1 AND value_id=$2 AND id<>$3 LIMIT 1",
            [data.product_id, data.value_id, req.params.id],
          );
      if (duplicate.rowCount) {
        return res.status(409).json({
          message:
            "Sorry, attribute details is already added under this product. Please use another attribute.",
        });
      }
      const result = useLegacyProductAttributes()
        ? await query(
            `UPDATE alpenwild_product_attribute_value_tbl SET product_id=$1,
           attribute_type_id=$2, attribute_value_id=$3
         WHERE product_attribute_value_id=$4
         RETURNING product_attribute_value_id AS id, product_id,
           attribute_type_id AS type_id, attribute_value_id AS value_id,
           'Active' AS status`,
            [data.product_id, data.type_id, data.value_id, req.params.id],
          )
        : await query(
            `UPDATE product_attributes SET product_id=$1, type_id=$2, value_id=$3,
           status=$4, updated_at=NOW() WHERE id=$5
         RETURNING id, product_id, type_id, value_id, status`,
            [
              data.product_id,
              data.type_id,
              data.value_id,
              data.status,
              req.params.id,
            ],
          );
      if (!result.rowCount)
        return res
          .status(404)
          .json({ message: "Product attribute not found." });
      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  },
);

app.patch(
  [
    "/api/product-attributes/:id/status",
    "/api/product-attribute-values/:id/status",
  ],
  async (req, res, next) => {
    try {
      const status = z.enum(["Active", "Inactive"]).parse(req.body.status);
      const result = useLegacyProductAttributes()
        ? await query(
            `SELECT product_attribute_value_id AS id, product_id,
              attribute_type_id AS type_id, attribute_value_id AS value_id,
              'Active' AS status
             FROM alpenwild_product_attribute_value_tbl
             WHERE product_attribute_value_id=$1`,
            [req.params.id],
          )
        : await query(
            `UPDATE product_attributes SET status=$1, updated_at=NOW()
         WHERE id=$2 RETURNING id, product_id, type_id, value_id, status`,
            [status, req.params.id],
          );
      if (!result.rowCount)
        return res
          .status(404)
          .json({ message: "Product attribute not found." });
      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  },
);

app.delete(
  ["/api/product-attributes/:id", "/api/product-attribute-values/:id"],
  async (req, res, next) => {
    try {
      const result = useLegacyProductAttributes()
        ? await query(
            "DELETE FROM alpenwild_product_attribute_value_tbl WHERE product_attribute_value_id=$1 RETURNING product_attribute_value_id",
            [req.params.id],
          )
        : await query(
            "DELETE FROM product_attributes WHERE id=$1 RETURNING id",
            [req.params.id],
          );
      if (!result.rowCount)
        return res
          .status(404)
          .json({ message: "Product attribute not found." });
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  },
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

app.get("/api/products", async (_req, res, next) => {
  try {
    const result = useLegacyProducts()
      ? await query(
          `${productSelect()} ORDER BY p.product_order ASC, p.product_id ASC`,
        )
      : await query(`SELECT p.id, p.name, p.slug, p.category_id, c.name AS category_name,
          p.menu_name, p.meta_title, p.meta_descriptions, p.meta_keywords,
          p.short_descriptions, p.description, p.price, p.banner_title,
          p.banner_sub_title, p.tooltip_text, p.banner_image, p.banner_alt,
          p.listing_image, p.listing_image_alt, p.display_order, p.status
          FROM products p LEFT JOIN categories c ON c.id=p.category_id
          ORDER BY p.display_order ASC, p.id ASC`);
    const rows = await Promise.all(
      result.rows.map(async (row) => {
        const [boxes, additional] = await Promise.all([
          useLegacyProducts()
            ? query(
                `SELECT product_box_image_id AS id, product_box_image AS image,
              product_box_image_image_alt AS image_alt, product_box_image_title AS title,
              product_box_image_link AS link
              FROM alpenwild_product_box_image_tbl WHERE product_id=$1 ORDER BY product_box_image_id ASC`,
                [row.id],
              )
            : { rows: [] },
          useLegacyProducts()
            ? query(
                `SELECT product_additional_image_id AS id, additional_image AS image
              FROM alpenwild_product_additional_image_tbl
              WHERE product_id=$1 ORDER BY product_additional_image_id ASC`,
                [row.id],
              )
            : { rows: [] },
        ]);
        return {
          ...row,
          slug: row.slug || slugifyCategoryName(row.name),
          listing_image_url: row.listing_image
            ? `/uploads/${config.productUploadSubdir}/listing/${encodeURIComponent(row.listing_image)}`
            : "",
          banner_image_url: row.banner_image
            ? `/uploads/${config.productUploadSubdir}/banner/${encodeURIComponent(row.banner_image)}`
            : "",
          box_images: boxes.rows.map((box) => ({
            ...box,
            image_url: box.image
              ? `/uploads/${config.productUploadSubdir}/boximage/${encodeURIComponent(box.image)}`
              : "",
          })),
          additional_images: additional.rows.map((image) => ({
            ...image,
            image_url: `/uploads/${config.productUploadSubdir}/additional/${encodeURIComponent(image.image)}`,
          })),
        };
      }),
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.post("/api/products", productUpload.any(), async (req, res, next) => {
  try {
    const data = productSchema.parse({
      ...req.body,
      slug: slugifyCategoryName(req.body.name),
    });
    const listing = uploadedFile(req.files, "listing_image");
    if (!listing)
      return res
        .status(400)
        .json({ message: "Listing image is required for a new product." });
    const duplicate = useLegacyProducts()
      ? await query(
          "SELECT 1 FROM alpenwild_product_tbl WHERE LOWER(product_name)=LOWER($1) LIMIT 1",
          [data.name],
        )
      : await query(
          "SELECT 1 FROM products WHERE LOWER(name)=LOWER($1) LIMIT 1",
          [data.name],
        );
    if (duplicate.rowCount)
      return res.status(409).json({
        message: "Sorry, name is already added. Please use another name.",
      });
    const banner = uploadedFile(req.files, "banner_image");
    const bannerName = banner ? safeFilename(banner, "product-banner") : "";
    const listingName = listing ? safeFilename(listing, "product-listing") : "";
    if (banner)
      await fs.rename(
        banner.path,
        path.join(config.productBannerUploadDir, bannerName),
      );
    if (listing)
      await fs.rename(
        listing.path,
        path.join(config.productListingUploadDir, listingName),
      );
    if (useLegacyProducts()) {
      await query(
        "UPDATE alpenwild_product_tbl SET product_order=product_order+1 WHERE product_order >= $1",
        [data.display_order],
      );
    } else {
      await query(
        "UPDATE products SET display_order=display_order+1 WHERE display_order >= $1",
        [data.display_order],
      );
    }
    const result = useLegacyProducts()
      ? await query(
          `INSERT INTO alpenwild_product_tbl
        (product_name,product_slug,category_id,product_menu_name,product_meta_title,
         product_meta_descriptions,product_meta_keywords,product_short_descriptions,
         product_description,product_price,product_banner_title,product_banner_sub_title,
         product_tooltip_text,product_banner,product_banner_alt,product_listing_image,
         product_listing_image_alt,product_order,product_status,product_creation_date)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,CURRENT_DATE)
        RETURNING product_id AS id`,
          [
            data.name,
            data.slug,
            data.category_id,
            data.menu_name,
            data.meta_title,
            data.meta_descriptions,
            data.meta_keywords,
            data.short_descriptions,
            data.description,
            data.price,
            data.banner_title,
            data.banner_sub_title,
            data.tooltip_text,
            bannerName,
            data.banner_alt,
            listingName,
            data.listing_image_alt,
            data.display_order,
            data.status,
          ],
        )
      : await query(
          `INSERT INTO products
        (name,slug,category_id,menu_name,meta_title,meta_descriptions,meta_keywords,
         short_descriptions,description,price,banner_title,banner_sub_title,tooltip_text,
         banner_image,banner_alt,listing_image,listing_image_alt,display_order,status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
        RETURNING id`,
          [
            data.name,
            data.slug,
            data.category_id,
            data.menu_name,
            data.meta_title,
            data.meta_descriptions,
            data.meta_keywords,
            data.short_descriptions,
            data.description,
            data.price,
            data.banner_title,
            data.banner_sub_title,
            data.tooltip_text,
            bannerName,
            data.banner_alt,
            listingName,
            data.listing_image_alt,
            data.display_order,
            data.status,
          ],
        );
    const productId = result.rows[0].id;
    const boxes = JSON.parse(req.body.box_images || "[]");
    const files = req.files || [];
    for (const [index, box] of boxes.entries()) {
      if (box.title && box.link) {
        const file = files.find(
          (item) => item.fieldname === `box_image_${index}`,
        );
        const imageName = file
          ? safeFilename(file, `product-box-${productId}-${index}`)
          : "";
        if (file)
          await fs.rename(
            file.path,
            path.join(config.productBoxImageUploadDir, imageName),
          );
        await query(
          `INSERT INTO alpenwild_product_box_image_tbl
          (product_id, product_box_image, product_box_image_image_alt,
           product_box_image_title, product_box_image_link)
          VALUES ($1,$2,$3,$4,$5)`,
          [productId, imageName, box.image_alt || "", box.title, box.link],
        );
      }
    }
    for (const file of files.filter(
      (item) => item.fieldname === "additional_images",
    )) {
      const imageName = safeFilename(file, `product-additional-${productId}`);
      await fs.rename(
        file.path,
        path.join(config.productAdditionalUploadDir, imageName),
      );
      await query(
        "INSERT INTO alpenwild_product_additional_image_tbl (product_id, additional_image) VALUES ($1,$2)",
        [productId, imageName],
      );
    }
    res.status(201).json({ id: productId });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/products/:id", productUpload.any(), async (req, res, next) => {
  try {
    const data = productSchema.parse({
      ...req.body,
      slug: slugifyCategoryName(req.body.name),
    });
    const duplicate = useLegacyProducts()
      ? await query(
          "SELECT 1 FROM alpenwild_product_tbl WHERE LOWER(product_name)=LOWER($1) AND product_id<>$2 LIMIT 1",
          [data.name, req.params.id],
        )
      : await query(
          "SELECT 1 FROM products WHERE LOWER(name)=LOWER($1) AND id<>$2 LIMIT 1",
          [data.name, req.params.id],
        );
    if (duplicate.rowCount)
      return res.status(409).json({
        message: "Sorry, name is already added. Please use another name.",
      });
    const orderTable = useLegacyProducts()
      ? "alpenwild_product_tbl"
      : "products";
    const orderColumn = useLegacyProducts() ? "product_order" : "display_order";
    const productIdColumn = useLegacyProducts() ? "product_id" : "id";
    const listingColumn = useLegacyProducts()
      ? "product_listing_image"
      : "listing_image";
    const currentProduct = await query(
      `SELECT ${orderColumn} AS display_order, ${listingColumn} AS listing_image
       FROM ${orderTable} WHERE ${productIdColumn}=$1`,
      [req.params.id],
    );
    if (!currentProduct.rowCount)
      return res.status(404).json({ message: "Product not found." });
    const previousOrder = Number(currentProduct.rows[0].display_order);
    const banner = uploadedFile(req.files, "banner_image");
    const listing = uploadedFile(req.files, "listing_image");
    if (!listing && !currentProduct.rows[0].listing_image)
      return res.status(400).json({ message: "Listing image is required." });
    const bannerName = banner ? safeFilename(banner, "product-banner") : null;
    const listingName = listing
      ? safeFilename(listing, "product-listing")
      : null;
    if (banner)
      await fs.rename(
        banner.path,
        path.join(config.productBannerUploadDir, bannerName),
      );
    if (listing)
      await fs.rename(
        listing.path,
        path.join(config.productListingUploadDir, listingName),
      );
    const result = useLegacyProducts()
      ? await query(
          `UPDATE alpenwild_product_tbl SET product_name=$1, product_slug=$2,
          category_id=$3, product_menu_name=$4, product_meta_title=$5,
          product_meta_descriptions=$6, product_meta_keywords=$7,
          product_short_descriptions=$8, product_description=$9, product_price=$10,
          product_banner_title=$11, product_banner_sub_title=$12, product_tooltip_text=$13,
          product_banner=COALESCE($14,product_banner), product_banner_alt=$15,
          product_listing_image=COALESCE($16,product_listing_image),
          product_listing_image_alt=$17, product_order=$18, product_status=$19
          WHERE product_id=$20 RETURNING product_id AS id`,
          [
            data.name,
            data.slug,
            data.category_id,
            data.menu_name,
            data.meta_title,
            data.meta_descriptions,
            data.meta_keywords,
            data.short_descriptions,
            data.description,
            data.price,
            data.banner_title,
            data.banner_sub_title,
            data.tooltip_text,
            bannerName,
            data.banner_alt,
            listingName,
            data.listing_image_alt,
            data.display_order,
            data.status,
            req.params.id,
          ],
        )
      : await query(
          `UPDATE products SET name=$1, slug=$2, category_id=$3, menu_name=$4,
          meta_title=$5, meta_descriptions=$6, meta_keywords=$7, short_descriptions=$8,
          description=$9, price=$10, banner_title=$11, banner_sub_title=$12, tooltip_text=$13,
          banner_image=COALESCE($14,banner_image), banner_alt=$15,
          listing_image=COALESCE($16,listing_image), listing_image_alt=$17,
          display_order=$18, status=$19, updated_at=NOW() WHERE id=$20 RETURNING id`,
          [
            data.name,
            data.slug,
            data.category_id,
            data.menu_name,
            data.meta_title,
            data.meta_descriptions,
            data.meta_keywords,
            data.short_descriptions,
            data.description,
            data.price,
            data.banner_title,
            data.banner_sub_title,
            data.tooltip_text,
            bannerName,
            data.banner_alt,
            listingName,
            data.listing_image_alt,
            data.display_order,
            data.status,
            req.params.id,
          ],
        );
    if (!result.rowCount)
      return res.status(404).json({ message: "Product not found." });
    if (data.display_order < previousOrder) {
      await query(
        `UPDATE ${orderTable} SET ${orderColumn}=${orderColumn}+1
         WHERE ${orderColumn}>=$1 AND ${orderColumn}<$2 AND ${productIdColumn}<>$3`,
        [data.display_order, previousOrder, req.params.id],
      );
    } else if (data.display_order > previousOrder) {
      await query(
        `UPDATE ${orderTable} SET ${orderColumn}=${orderColumn}-1
         WHERE ${orderColumn}>$1 AND ${orderColumn}<=$2 AND ${productIdColumn}<>$3`,
        [previousOrder, data.display_order, req.params.id],
      );
    }
    const files = req.files || [];
    const boxes = JSON.parse(req.body.box_images || "[]");
    const existingBoxes = await query(
      "SELECT product_box_image_id AS id FROM alpenwild_product_box_image_tbl WHERE product_id=$1",
      [req.params.id],
    );
    const existingBoxIds = new Set(
      existingBoxes.rows.map((box) => String(box.id)),
    );
    for (const [index, box] of boxes.entries()) {
      if (box.id && !existingBoxIds.has(String(box.id)))
        return res.status(400).json({ message: "Invalid product box image." });
      if (!box.title || !box.link) continue;
      const file = files.find(
        (item) => item.fieldname === `box_image_${index}`,
      );
      const imageName = file
        ? safeFilename(file, `product-box-${req.params.id}-${index}`)
        : null;
      if (file)
        await fs.rename(
          file.path,
          path.join(config.productBoxImageUploadDir, imageName),
        );
      if (box.id) {
        await query(
          `UPDATE alpenwild_product_box_image_tbl
           SET product_box_image=COALESCE($1,product_box_image),
             product_box_image_image_alt=$2, product_box_image_title=$3,
             product_box_image_link=$4
           WHERE product_box_image_id=$5 AND product_id=$6`,
          [
            imageName,
            box.image_alt || "",
            box.title,
            box.link,
            box.id,
            req.params.id,
          ],
        );
      } else {
        await query(
          `INSERT INTO alpenwild_product_box_image_tbl
          (product_id, product_box_image, product_box_image_image_alt,
           product_box_image_title, product_box_image_link)
          VALUES ($1,$2,$3,$4,$5)`,
          [
            req.params.id,
            imageName || "",
            box.image_alt || "",
            box.title,
            box.link,
          ],
        );
      }
    }
    for (const file of files.filter(
      (item) => item.fieldname === "additional_images",
    )) {
      const imageName = safeFilename(
        file,
        `product-additional-${req.params.id}`,
      );
      await fs.rename(
        file.path,
        path.join(config.productAdditionalUploadDir, imageName),
      );
      await query(
        "INSERT INTO alpenwild_product_additional_image_tbl (product_id, additional_image) VALUES ($1,$2)",
        [req.params.id, imageName],
      );
    }
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.delete(
  "/api/products/:productId/additional-images/:imageId",
  async (req, res, next) => {
    try {
      const result = await query(
        `DELETE FROM alpenwild_product_additional_image_tbl
      WHERE product_additional_image_id=$1 AND product_id=$2 RETURNING additional_image`,
        [req.params.imageId, req.params.productId],
      );
      if (!result.rowCount)
        return res.status(404).json({ message: "Additional image not found." });
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  },
);

app.patch("/api/products/:id/status", async (req, res, next) => {
  try {
    const status = z.enum(["Active", "Inactive"]).parse(req.body.status);
    const result = useLegacyProducts()
      ? await query(
          "UPDATE alpenwild_product_tbl SET product_status=$1 WHERE product_id=$2 RETURNING product_id AS id",
          [status, req.params.id],
        )
      : await query(
          "UPDATE products SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING id",
          [status, req.params.id],
        );
    if (!result.rowCount)
      return res.status(404).json({ message: "Product not found." });
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/products/:id", async (req, res, next) => {
  try {
    if (useLegacyProducts()) {
      const existingOrders = await query(
        "SELECT 1 FROM alpenwild_order_details_tbl WHERE product_id=$1 LIMIT 1",
        [req.params.id],
      );
      if (existingOrders.rowCount)
        return res.status(409).json({
          message:
            "Order existing under this product. First delete order and then delete this product.",
        });
    }
    const result = useLegacyProducts()
      ? await query(
          "DELETE FROM alpenwild_product_tbl WHERE product_id=$1 RETURNING product_id",
          [req.params.id],
        )
      : await query("DELETE FROM products WHERE id=$1 RETURNING id", [
          req.params.id,
        ]);
    if (!result.rowCount)
      return res
        .status(404)
        .json({ message: "Nothing is deleted successfully" });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.post("/api/activities", async (req, res, next) => {
  try {
    const data = simpleNameSchema.parse(req.body);
    if (await activityNameConflict(data.name))
      return res.status(409).json({
        message:
          "Sorry, activity name is already added. Please use another name.",
      });
    const result = useLegacyActivities()
      ? await query(
          "INSERT INTO alpenwild_activity_tbl (activity_name, activity_status) VALUES ($1, $2) RETURNING activity_id AS id, activity_name AS name, activity_status AS status",
          [data.name, data.status],
        )
      : await query(
          "INSERT INTO activities (name, status) VALUES ($1, $2) RETURNING id, name, status",
          [data.name, data.status],
        );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error?.code === "23505")
      return res.status(409).json({
        message:
          "Sorry, activity name is already added. Please use another name.",
      });
    next(error);
  }
});

app.patch("/api/activities/:id", async (req, res, next) => {
  try {
    const data = simpleNameSchema.parse(req.body);
    if (await activityNameConflict(data.name, req.params.id))
      return res.status(409).json({
        message:
          "Sorry, activity name is already added. Please use another name.",
      });
    const result = useLegacyActivities()
      ? await query(
          "UPDATE alpenwild_activity_tbl SET activity_name=$1, activity_status=$2 WHERE activity_id=$3 RETURNING activity_id AS id, activity_name AS name, activity_status AS status",
          [data.name, data.status, req.params.id],
        )
      : await query(
          "UPDATE activities SET name=$1, status=$2, updated_at=NOW() WHERE id=$3 RETURNING id, name, status",
          [data.name, data.status, req.params.id],
        );
    if (!result.rowCount)
      return res.status(404).json({ message: "Activity not found." });
    res.json(result.rows[0]);
  } catch (error) {
    if (error?.code === "23505")
      return res.status(409).json({
        message:
          "Sorry, activity name is already added. Please use another name.",
      });
    next(error);
  }
});

app.patch("/api/activities/:id/status", async (req, res, next) => {
  try {
    const status = z.enum(["Active", "Inactive"]).parse(req.body.status);
    const result = useLegacyActivities()
      ? await query(
          "UPDATE alpenwild_activity_tbl SET activity_status=$1 WHERE activity_id=$2 RETURNING activity_id AS id, activity_name AS name, activity_status AS status",
          [status, req.params.id],
        )
      : await query(
          "UPDATE activities SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING id, name, status",
          [status, req.params.id],
        );
    if (!result.rowCount)
      return res.status(404).json({ message: "Activity not found." });
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/activities/:id", async (req, res, next) => {
  try {
    const result = useLegacyActivities()
      ? await query(
          "DELETE FROM alpenwild_activity_tbl WHERE activity_id=$1 RETURNING activity_id",
          [req.params.id],
        )
      : await query("DELETE FROM activities WHERE id=$1 RETURNING id", [
          req.params.id,
        ]);
    if (!result.rowCount)
      return res.status(404).json({ message: "Activity not found." });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get("/api/discounts", async (_req, res, next) => {
  try {
    const result = useLegacyDiscounts()
      ? await query(`SELECT discount_id AS id, discount_name AS name, discount_code AS code,
          discount_type AS type, discount_value AS value, discount_start_date AS start_date,
          discount_end_date AS end_date, discount_status AS status
         FROM alpenwild_discount_tbl ORDER BY discount_id ASC`)
      : await query(
          "SELECT id, name, code, type, value, start_date, end_date, status FROM discounts ORDER BY id ASC",
        );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.post("/api/discount-check", async (req, res, next) => {
  try {
    const code = z
      .string()
      .trim()
      .max(255)
      .parse(req.body?.discount_code || "");
    if (!code)
      return res.json({ success: false, message: "Please enter voucher code" });
    const result = useLegacyDiscounts()
      ? await query(
          `SELECT discount_status AS status, discount_type AS type,
                  discount_value AS value,
                  discount_start_date AS start_date,
                  discount_end_date AS end_date
             FROM alpenwild_discount_tbl
            WHERE discount_code=$1
            LIMIT 1`,
          [code],
        )
      : await query(
          `SELECT status, type, value, start_date, end_date
             FROM discounts
            WHERE code=$1
            LIMIT 1`,
          [code],
        );
    const discount = result.rows[0];
    if (!discount || discount.status !== "Active")
      return res.json({
        success: false,
        message: "You have entered an wrong voucher code.",
      });
    const today = new Date().toISOString().slice(0, 10);
    if (String(discount.start_date).slice(0, 10) > today)
      return res.json({
        success: false,
        message: "You have entered an invalid voucher code.",
      });
    if (String(discount.end_date).slice(0, 10) < today)
      return res.json({
        success: false,
        message: "You have entered an expired voucher code..",
      });
    res.json({
      success: true,
      type: discount.type,
      value: Number(discount.value || 0),
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/discounts", async (req, res, next) => {
  try {
    const data = discountSchema.parse(req.body);
    const columns = discountColumns();
    const duplicate = await query(
      `SELECT 1 FROM ${columns.table}
       WHERE LOWER(${columns.code})=LOWER($1) LIMIT 1`,
      [data.code],
    );
    if (duplicate.rowCount)
      return res.status(409).json({
        message: "Discount code is already added. Please use another code.",
      });
    const result = useLegacyDiscounts()
      ? await query(
          `INSERT INTO alpenwild_discount_tbl
          (discount_name, discount_code, discount_start_date, discount_end_date,
           discount_type, discount_value, discount_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING discount_id AS id, discount_name AS name, discount_code AS code,
          discount_type AS type, discount_value AS value, discount_start_date AS start_date,
          discount_end_date AS end_date, discount_status AS status`,
          [
            data.name,
            data.code,
            data.start_date,
            data.end_date,
            data.type,
            data.value,
            data.status,
          ],
        )
      : await query(
          `INSERT INTO discounts
          (name, code, type, value, start_date, end_date, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
          [
            data.name,
            data.code,
            data.type,
            data.value,
            data.start_date,
            data.end_date,
            data.status,
          ],
        );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/discounts/:id", async (req, res, next) => {
  try {
    const data = discountSchema.parse(req.body);
    const columns = discountColumns();
    const duplicate = await query(
      `SELECT 1 FROM ${columns.table}
       WHERE LOWER(${columns.code})=LOWER($1) AND ${columns.id}<>$2 LIMIT 1`,
      [data.code, req.params.id],
    );
    if (duplicate.rowCount)
      return res.status(409).json({
        message: "Discount code is already added. Please use another code.",
      });
    const existing = useLegacyDiscounts()
      ? await query(
          `SELECT discount_name AS name, discount_code AS code,
              discount_type AS type, discount_value AS value,
              discount_start_date AS start_date, discount_end_date AS end_date,
              discount_status AS status
           FROM alpenwild_discount_tbl WHERE discount_id=$1`,
          [req.params.id],
        )
      : await query(
          `SELECT name, code, type, value, start_date, end_date, status
           FROM discounts WHERE id=$1`,
          [req.params.id],
        );
    if (!existing.rowCount)
      return res.status(404).json({ message: "Discount not found." });
    const current = existing.rows[0];
    const unchanged =
      current.name === data.name &&
      current.code === data.code &&
      current.type === data.type &&
      Number(current.value) === data.value &&
      String(current.start_date).slice(0, 10) === data.start_date &&
      String(current.end_date).slice(0, 10) === data.end_date &&
      current.status === data.status;
    if (unchanged)
      return res.json({
        unchanged: true,
        message: "Sorry, nothing is updated.",
      });
    const result = useLegacyDiscounts()
      ? await query(
          `UPDATE alpenwild_discount_tbl SET discount_name=$1, discount_code=$2,
          discount_start_date=$3, discount_end_date=$4, discount_type=$5,
          discount_value=$6, discount_status=$7 WHERE discount_id=$8
         RETURNING discount_id AS id, discount_name AS name, discount_code AS code,
          discount_type AS type, discount_value AS value, discount_start_date AS start_date,
          discount_end_date AS end_date, discount_status AS status`,
          [
            data.name,
            data.code,
            data.start_date,
            data.end_date,
            data.type,
            data.value,
            data.status,
            req.params.id,
          ],
        )
      : await query(
          `UPDATE discounts SET name=$1, code=$2, type=$3, value=$4,
          start_date=$5, end_date=$6, status=$7, updated_at=NOW() WHERE id=$8 RETURNING *`,
          [
            data.name,
            data.code,
            data.type,
            data.value,
            data.start_date,
            data.end_date,
            data.status,
            req.params.id,
          ],
        );
    if (!result.rowCount)
      return res.status(404).json({ message: "Discount not found." });
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/discounts/:id/status", async (req, res, next) => {
  try {
    const status = z.enum(["Active", "Inactive"]).parse(req.body.status);
    const result = useLegacyDiscounts()
      ? await query(
          `UPDATE alpenwild_discount_tbl SET discount_status=$1 WHERE discount_id=$2
         RETURNING discount_id AS id, discount_name AS name, discount_code AS code,
          discount_type AS type, discount_value AS value, discount_start_date AS start_date,
          discount_end_date AS end_date, discount_status AS status`,
          [status, req.params.id],
        )
      : await query(
          "UPDATE discounts SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *",
          [status, req.params.id],
        );
    if (!result.rowCount)
      return res.status(404).json({ message: "Discount not found." });
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/discounts/:id", async (req, res, next) => {
  try {
    const result = useLegacyDiscounts()
      ? await query(
          "DELETE FROM alpenwild_discount_tbl WHERE discount_id=$1 RETURNING discount_id",
          [req.params.id],
        )
      : await query("DELETE FROM discounts WHERE id=$1 RETURNING id", [
          req.params.id,
        ]);
    if (!result.rowCount)
      return res.status(404).json({ message: "Discount not found." });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get("/api/trip-types", async (_req, res, next) => {
  try {
    const select = useLegacyTripTypes()
      ? `SELECT trip_type_id AS id, trip_type_name AS name,
          trip_type_slug AS slug, trip_type_menu_name AS menu_name,
          trip_type_display_under AS display_under,
          trip_type_meta_title AS meta_title,
          trip_type_meta_descriptions AS meta_descriptions,
          trip_type_meta_keywords AS meta_keywords,
          trip_type_short_description AS short_description,
          trip_type_description AS description,
          trip_type_banner AS banner_image,
          trip_type_tooltip_text AS tooltip_text,
          trip_type_listing_image AS listing_image,
          trip_type_banner_alt AS banner_alt,
          trip_type_listing_image_alt AS listing_image_alt,
          trip_type_order AS display_order, trip_type_status AS status
         FROM alpenwild_trip_type_tbl`
      : "SELECT * FROM trip_types";
    const result = await query(`${select} ORDER BY display_order ASC, id ASC`);
    const boxes = await tripTypeBoxImagesFor(result.rows.map((row) => row.id));
    res.json(
      result.rows.map((row) =>
        serializeTripType({ ...row, box_images: boxes.get(row.id) || [] }),
      ),
    );
  } catch (error) {
    next(error);
  }
});

app.post("/api/trip-types", tripTypeUpload.any(), async (req, res, next) => {
  try {
    const data = tripTypeSchema.parse(req.body);
    const bannerFile = uploadedFile(req.files, "banner_image");
    const listingFile = uploadedFile(req.files, "listing_image");
    const boxImages = parseTripTypeBoxImages(req.body.box_images);
    if (!bannerFile || !listingFile)
      return res
        .status(400)
        .json({ message: "Both trip type images are required." });
    const duplicate = useLegacyTripTypes()
      ? await query(
          "SELECT trip_type_id FROM alpenwild_trip_type_tbl WHERE LOWER(trip_type_name) = LOWER($1) LIMIT 1",
          [data.name],
        )
      : await query(
          "SELECT id FROM trip_types WHERE LOWER(name) = LOWER($1) LIMIT 1",
          [data.name],
        );
    if (duplicate.rowCount)
      return res.status(409).json({
        message: "Sorry, name is already added. Please use another name.",
      });
    if (useLegacyTripTypes()) {
      await query(
        "UPDATE alpenwild_trip_type_tbl SET trip_type_order = trip_type_order + 1 WHERE trip_type_order >= $1",
        [data.display_order],
      );
    } else {
      await query(
        "UPDATE trip_types SET display_order = display_order + 1 WHERE display_order >= $1",
        [data.display_order],
      );
    }
    const bannerFilename = safeFilename(bannerFile, "banner");
    const listingFilename = safeFilename(listingFile, "listing");
    await fs.rename(
      bannerFile.path,
      path.join(config.tripTypeBannerUploadDir, bannerFilename),
    );
    await fs.rename(
      listingFile.path,
      path.join(config.tripTypeListingUploadDir, listingFilename),
    );
    const result = await query(
      `INSERT INTO alpenwild_trip_type_tbl
         (trip_type_name, trip_type_slug, trip_type_menu_name, trip_type_display_under,
          trip_type_meta_title, trip_type_meta_descriptions, trip_type_meta_keywords,
          trip_type_short_description, trip_type_description, trip_type_banner,
          trip_type_tooltip_text, trip_type_listing_image, trip_type_banner_alt,
          trip_type_listing_image_alt, trip_type_order, trip_type_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         RETURNING trip_type_id AS id, trip_type_name AS name, trip_type_slug AS slug,
          trip_type_menu_name AS menu_name, trip_type_display_under AS display_under,
          trip_type_meta_title AS meta_title, trip_type_meta_descriptions AS meta_descriptions,
          trip_type_meta_keywords AS meta_keywords, trip_type_short_description AS short_description,
          trip_type_description AS description, trip_type_banner AS banner_image,
          trip_type_tooltip_text AS tooltip_text, trip_type_listing_image AS listing_image,
          trip_type_banner_alt AS banner_alt, trip_type_listing_image_alt AS listing_image_alt,
          trip_type_order AS display_order, trip_type_status AS status`,
      [
        data.name,
        data.slug || slugify(data.name),
        data.menu_name,
        data.display_under,
        data.meta_title,
        data.meta_descriptions,
        data.meta_keywords,
        data.short_description,
        data.description,
        bannerFilename,
        data.tooltip_text,
        listingFilename,
        data.banner_alt,
        data.listing_image_alt,
        data.display_order,
        data.status,
      ],
    );
    await addTripTypeBoxImages(result.rows[0].id, boxImages, req.files);
    res
      .status(201)
      .json(serializeTripType({ ...result.rows[0], box_images: boxImages }));
  } catch (error) {
    next(error);
  }
});

app.patch(
  "/api/trip-types/:id",
  tripTypeUpload.any(),
  async (req, res, next) => {
    try {
      const data = tripTypeSchema.parse(req.body);
      const bannerFile = uploadedFile(req.files, "banner_image");
      const listingFile = uploadedFile(req.files, "listing_image");
      const boxImages = parseTripTypeBoxImages(req.body.box_images);
      const current = useLegacyTripTypes()
        ? await query(
            `SELECT trip_type_banner AS banner_image,
              trip_type_listing_image AS listing_image,
              trip_type_order AS display_order
             FROM alpenwild_trip_type_tbl WHERE trip_type_id=$1`,
            [req.params.id],
          )
        : await query(
            "SELECT banner_image, listing_image, display_order FROM trip_types WHERE id=$1",
            [req.params.id],
          );
      if (!current.rowCount)
        return res.status(404).json({ message: "Trip type not found." });
      if (
        (!bannerFile && !current.rows[0].banner_image) ||
        (!listingFile && !current.rows[0].listing_image)
      )
        return res
          .status(400)
          .json({ message: "Both trip type images are required." });
      const duplicate = useLegacyTripTypes()
        ? await query(
            "SELECT trip_type_id FROM alpenwild_trip_type_tbl WHERE LOWER(trip_type_name) = LOWER($1) AND trip_type_id <> $2 LIMIT 1",
            [data.name, req.params.id],
          )
        : await query(
            "SELECT id FROM trip_types WHERE LOWER(name) = LOWER($1) AND id <> $2 LIMIT 1",
            [data.name, req.params.id],
          );
      if (duplicate.rowCount)
        return res.status(409).json({
          message: "Sorry, name is already added. Please use another name.",
        });
      const oldOrder = Number(current.rows[0].display_order);
      if (data.display_order < oldOrder) {
        if (useLegacyTripTypes()) {
          await query(
            "UPDATE alpenwild_trip_type_tbl SET trip_type_order = trip_type_order + 1 WHERE trip_type_order >= $1 AND trip_type_order < $2",
            [data.display_order, oldOrder],
          );
        } else {
          await query(
            "UPDATE trip_types SET display_order = display_order + 1 WHERE display_order >= $1 AND display_order < $2",
            [data.display_order, oldOrder],
          );
        }
      } else if (data.display_order > oldOrder) {
        if (useLegacyTripTypes()) {
          await query(
            "UPDATE alpenwild_trip_type_tbl SET trip_type_order = trip_type_order - 1 WHERE trip_type_order > $1 AND trip_type_order <= $2",
            [oldOrder, data.display_order],
          );
        } else {
          await query(
            "UPDATE trip_types SET display_order = display_order - 1 WHERE display_order > $1 AND display_order <= $2",
            [oldOrder, data.display_order],
          );
        }
      }
      const bannerFilename = bannerFile
        ? safeFilename(bannerFile, "banner")
        : null;
      const listingFilename = listingFile
        ? safeFilename(listingFile, "listing")
        : null;
      if (bannerFile)
        await fs.rename(
          bannerFile.path,
          path.join(config.tripTypeBannerUploadDir, bannerFilename),
        );
      if (listingFile)
        await fs.rename(
          listingFile.path,
          path.join(config.tripTypeListingUploadDir, listingFilename),
        );
      const result = useLegacyTripTypes()
        ? await query(
            `UPDATE alpenwild_trip_type_tbl SET trip_type_name=$1, trip_type_slug=$2,
             trip_type_menu_name=$3, trip_type_display_under=$4, trip_type_meta_title=$5,
             trip_type_meta_descriptions=$6, trip_type_meta_keywords=$7,
             trip_type_short_description=$8, trip_type_description=$9,
             trip_type_banner=COALESCE($10,trip_type_banner), trip_type_tooltip_text=$11,
             trip_type_listing_image=COALESCE($12,trip_type_listing_image),
             trip_type_banner_alt=$13, trip_type_listing_image_alt=$14,
             trip_type_order=$15, trip_type_status=$16 WHERE trip_type_id=$17
             RETURNING trip_type_id AS id, trip_type_name AS name, trip_type_slug AS slug,
              trip_type_menu_name AS menu_name, trip_type_display_under AS display_under,
              trip_type_meta_title AS meta_title, trip_type_meta_descriptions AS meta_descriptions,
              trip_type_meta_keywords AS meta_keywords, trip_type_short_description AS short_description,
              trip_type_description AS description, trip_type_banner AS banner_image,
              trip_type_tooltip_text AS tooltip_text, trip_type_listing_image AS listing_image,
              trip_type_banner_alt AS banner_alt, trip_type_listing_image_alt AS listing_image_alt,
              trip_type_order AS display_order, trip_type_status AS status`,
            [
              data.name,
              data.slug ||
                data.name
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/^-|-$/g, ""),
              data.menu_name,
              data.display_under,
              data.meta_title,
              data.meta_descriptions,
              data.meta_keywords,
              data.short_description,
              data.description,
              bannerFilename,
              data.tooltip_text,
              listingFilename,
              data.banner_alt,
              data.listing_image_alt,
              data.display_order,
              data.status,
              req.params.id,
            ],
          )
        : await query(
            `UPDATE trip_types SET name=$1, slug=$2, menu_name=$3, display_under=$4,
             meta_title=$5, meta_descriptions=$6, meta_keywords=$7, short_description=$8,
             description=$9, banner_image=COALESCE($10,banner_image), tooltip_text=$11,
             listing_image=COALESCE($12,listing_image), banner_alt=$13,
             listing_image_alt=$14, display_order=$15, status=$16, updated_at=NOW()
             WHERE id=$17 RETURNING *`,
            [
              data.name,
              data.slug || slugify(data.name),
              data.menu_name,
              data.display_under,
              data.meta_title,
              data.meta_descriptions,
              data.meta_keywords,
              data.short_description,
              data.description,
              bannerFilename,
              data.tooltip_text,
              listingFilename,
              data.banner_alt,
              data.listing_image_alt,
              data.display_order,
              data.status,
              req.params.id,
            ],
          );
      if (!result.rowCount)
        return res.status(404).json({ message: "Trip type not found." });
      await saveTripTypeBoxImages(req.params.id, boxImages, req.files);
      res.json(serializeTripType({ ...result.rows[0], box_images: boxImages }));
    } catch (error) {
      next(error);
    }
  },
);

app.patch("/api/trip-types/:id/status", async (req, res, next) => {
  try {
    const status = z.enum(["Active", "Inactive"]).parse(req.body.status);
    const result = useLegacyTripTypes()
      ? await query(
          `UPDATE alpenwild_trip_type_tbl SET trip_type_status=$1 WHERE trip_type_id=$2 RETURNING trip_type_id AS id, trip_type_name AS name, trip_type_slug AS slug, trip_type_menu_name AS menu_name, trip_type_display_under AS display_under, trip_type_meta_title AS meta_title, trip_type_meta_descriptions AS meta_descriptions, trip_type_meta_keywords AS meta_keywords, trip_type_short_description AS short_description, trip_type_description AS description, trip_type_banner AS banner_image, trip_type_tooltip_text AS tooltip_text, trip_type_listing_image AS listing_image, trip_type_banner_alt AS banner_alt, trip_type_listing_image_alt AS listing_image_alt, trip_type_order AS display_order, trip_type_status AS status`,
          [status, req.params.id],
        )
      : await query(
          "UPDATE trip_types SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *",
          [status, req.params.id],
        );
    if (!result.rowCount)
      return res.status(404).json({ message: "Trip type not found." });
    res.json(serializeTripType(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/trip-types/:id", async (req, res, next) => {
  try {
    const result = useLegacyTripTypes()
      ? await query(
          "DELETE FROM alpenwild_trip_type_tbl WHERE trip_type_id=$1 RETURNING trip_type_id",
          [req.params.id],
        )
      : await query("DELETE FROM trip_types WHERE id=$1 RETURNING id", [
          req.params.id,
        ]);
    if (!result.rowCount)
      return res.status(404).json({ message: "Trip type not found." });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

function parseJsonArray(value, fallback = []) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function tripImageUrl(filename, folder) {
  return filename
    ? `/uploads/${config.tripUploadSubdir}/${folder}/${encodeURIComponent(filename)}`
    : null;
}

const tripTypeListingThumbnailJobs = new Map();

app.get("/api/trip-type-images/listing/:filename", async (req, res, next) => {
  const { filename } = req.params;
  if (
    !filename ||
    /[\\/]/.test(filename) ||
    !/\.(?:jpe?g|png|webp|gif)$/i.test(filename)
  ) {
    return res.status(400).json({ message: "Invalid trip style image." });
  }

  try {
    const sourcePath = path.join(config.tripTypeListingUploadDir, filename);
    let sourceStats;
    try {
      sourceStats = await fs.stat(sourcePath);
    } catch (error) {
      if (error.code === "ENOENT")
        return res.status(404).json({ message: "Trip style image not found." });
      throw error;
    }
    if (!sourceStats.isFile())
      return res.status(404).json({ message: "Trip style image not found." });

    const cacheKey = crypto
      .createHash("sha256")
      .update(
        `${filename}:${sourceStats.size}:${sourceStats.mtimeMs}:${sourceStats.ctimeMs}`,
      )
      .digest("hex");
    const etag = `"${cacheKey}"`;
    res.set("Cache-Control", "no-cache");
    res.set("ETag", etag);
    if (req.get("If-None-Match") === etag) return res.status(304).end();

    const cacheDirectory = path.join(
      config.uploadDir,
      ".thumbnail-cache",
      "trip-type-listing",
    );
    const thumbnailPath = path.join(cacheDirectory, `${cacheKey}.jpg`);
    let thumbnailJob = tripTypeListingThumbnailJobs.get(cacheKey);
    if (!thumbnailJob) {
      thumbnailJob = (async () => {
        await fs.mkdir(cacheDirectory, { recursive: true });
        try {
          return await fs.readFile(thumbnailPath);
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }

        const thumbnail = await sharp(sourcePath)
          .resize(370, 183, { fit: "cover", position: "centre" })
          .jpeg({ quality: 90 })
          .toBuffer();
        await fs.writeFile(thumbnailPath, thumbnail);
        return thumbnail;
      })();
      tripTypeListingThumbnailJobs.set(cacheKey, thumbnailJob);
    }

    try {
      const thumbnail = await thumbnailJob;
      return res.type("image/jpeg").send(thumbnail);
    } finally {
      if (tripTypeListingThumbnailJobs.get(cacheKey) === thumbnailJob)
        tripTypeListingThumbnailJobs.delete(cacheKey);
    }
  } catch (error) {
    next(error);
  }
});

const tripListingThumbnailJobs = new Map();

app.get("/api/trip-images/listing/:filename", async (req, res, next) => {
  const { filename } = req.params;
  if (
    !filename ||
    /[\\/]/.test(filename) ||
    !/\.(?:jpe?g|png|webp|gif)$/i.test(filename)
  ) {
    res.status(400).json({ error: "Invalid trip listing image." });
    return;
  }

  try {
    const sourcePath = path.join(config.tripListingUploadDir, filename);
    let sourceStats;
    try {
      sourceStats = await fs.stat(sourcePath);
    } catch (error) {
      if (error.code === "ENOENT") {
        res.status(404).json({ error: "Trip listing image not found." });
        return;
      }
      throw error;
    }
    if (!sourceStats.isFile()) {
      res.status(404).json({ error: "Trip listing image not found." });
      return;
    }

    const cacheKey = crypto
      .createHash("sha256")
      .update(
        `${filename}:${sourceStats.size}:${sourceStats.mtimeMs}:${sourceStats.ctimeMs}`,
      )
      .digest("hex");
    const etag = `"${cacheKey}"`;
    res.set("Cache-Control", "no-cache");
    res.set("ETag", etag);
    if (req.get("If-None-Match") === etag) {
      res.status(304).end();
      return;
    }

    const cacheDirectory = path.join(
      config.uploadDir,
      ".thumbnail-cache",
      "trip-listing",
    );
    const thumbnailPath = path.join(cacheDirectory, `${cacheKey}.jpg`);
    let thumbnailJob = tripListingThumbnailJobs.get(cacheKey);
    if (!thumbnailJob) {
      thumbnailJob = (async () => {
        await fs.mkdir(cacheDirectory, { recursive: true });
        try {
          return await fs.readFile(thumbnailPath);
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }

        const thumbnail = await sharp(sourcePath)
          .resize(270, 183, { fit: "cover", position: "centre" })
          .jpeg({ quality: 90 })
          .toBuffer();
        await fs.writeFile(thumbnailPath, thumbnail);
        return thumbnail;
      })();
      tripListingThumbnailJobs.set(cacheKey, thumbnailJob);
    }

    try {
      const thumbnail = await thumbnailJob;
      res.type("image/jpeg").send(thumbnail);
    } finally {
      if (tripListingThumbnailJobs.get(cacheKey) === thumbnailJob) {
        tripListingThumbnailJobs.delete(cacheKey);
      }
    }
  } catch (error) {
    next(error);
  }
});

async function tripRelations(id) {
  const [dates, activities, boxes, itinerary] = await Promise.all([
    query(
      `SELECT trips_date_id AS id,
      to_char(trips_start_date, 'YYYY-MM-DD') AS start_date,
      to_char(trips_end_date, 'YYYY-MM-DD') AS end_date,
      trips_date_range AS date_range,
      trips_price AS price, trips_single_price AS single_price,
      trips_date_status AS status FROM alpenwild_trips_date_tbl
      WHERE trips_id=$1 AND trips_date_status <> 'Temp Delete' ORDER BY trips_start_date`,
      [id],
    ),
    query(
      `SELECT activity_id FROM alpenwild_trips_activity_tbl WHERE trips_id=$1`,
      [id],
    ),
    query(
      `SELECT trips_box_image_id AS id, trips_box_image AS image,
      trips_box_image_alt AS image_alt, trips_box_image_title AS title,
      trips_box_image_link AS link, trips_box_image_order AS display_order
      FROM alpenwild_trips_box_image_tbl WHERE trips_id=$1 ORDER BY trips_box_image_order, trips_box_image_id`,
      [id],
    ),
    query(
      `SELECT trips_itinerary_id AS id,
      trips_itinerary_day AS day, trips_itinerary_title AS title,
      trips_itinerary_description AS description
      FROM alpenwild_trips_itinerary_tbl WHERE trips_id=$1
      ORDER BY trips_itinerary_day`,
      [id],
    ),
  ]);
  return {
    dates: dates.rows,
    activity_ids: activities.rows.map((row) => row.activity_id),
    box_images: boxes.rows.map((row) => ({
      ...row,
      image_url: tripImageUrl(row.image, "boximage"),
    })),
    itinerary: itinerary.rows,
  };
}

function serializeTrip(row, relations = {}) {
  return {
    ...row,
    banner_image_url: tripImageUrl(row.banner_image, "banner"),
    map_image_url: tripImageUrl(row.map_image, "map"),
    listing_image_url: tripImageUrl(row.listing_image, "listing"),
    listing_thumbnail_url: row.listing_image
      ? `/api/trip-images/listing/${encodeURIComponent(row.listing_image)}`
      : null,
    ...relations,
  };
}

app.get("/api/trip-bookings/options", async (_req, res, next) => {
  try {
    const [result, discounts] = await Promise.all([
      query(
        `SELECT t.trips_id AS id, t.trips_name AS name,
          t.trips_available_for AS available_for,
          t.trips_price AS price, t.trips_single_price AS single_price,
          tt.trip_type_name AS type_name,
          COALESCE(json_agg(json_build_object(
            'id', d.trips_date_id,
            'start_date', to_char(d.trips_start_date, 'YYYY-MM-DD'),
            'end_date', to_char(d.trips_end_date, 'YYYY-MM-DD'),
            'price', d.trips_price,
            'single_price', d.trips_single_price
          ) ORDER BY d.trips_start_date) FILTER (WHERE d.trips_date_id IS NOT NULL), '[]') AS dates
         FROM alpenwild_trips_tbl t
         LEFT JOIN alpenwild_trip_type_tbl tt ON tt.trip_type_id=t.trips_type_id
         LEFT JOIN alpenwild_trips_date_tbl d
           ON d.trips_id=t.trips_id AND d.trips_date_status='Active'
         WHERE t.trips_status='Active'
         GROUP BY t.trips_id, t.trips_name, t.trips_available_for,
           t.trips_price, t.trips_single_price, tt.trip_type_name, t.trips_order
         ORDER BY tt.trip_type_name, t.trips_order, t.trips_name`,
      ),
      query(`SELECT discount_id AS id, discount_name AS name, discount_code AS code,
          discount_type AS type, discount_value AS value,
          discount_start_date AS start_date, discount_end_date AS end_date
        FROM alpenwild_discount_tbl
        WHERE discount_status='Active'
          AND discount_start_date <= CURRENT_DATE
          AND discount_end_date >= CURRENT_DATE
        ORDER BY discount_name`),
    ]);
    res.json({ trips: result.rows, discounts: discounts.rows });
  } catch (error) {
    next(error);
  }
});

app.get("/api/trip-bookings", async (req, res, next) => {
  try {
    const recent = req.query.recent === "true";
    const tripId = req.query.trips_id ? Number(req.query.trips_id) : null;
    const result = await query(
      `SELECT b.trips_booking_id AS id, b.trips_id AS trip_id,
          t.trips_name AS trip_name, t.trips_available_for AS available_for,
          b.user_first_name AS first_name, b.user_last_name AS last_name,
          b.user_street_address AS street_address, b.user_street_address1 AS street_address1,
          b.user_city AS city, b.user_state AS state, b.user_postal_code AS postal_code,
          b.user_country AS country, b.user_shipping_email_address AS email,
          b.user_id AS user_id, b.trips_date_id AS trip_date_id,
          b.party_number,
          COALESCE(
            b.trips_booking_date,
            (SELECT MIN(p.payment_date)
               FROM alpenwild_trips_payment_tbl p
              WHERE p.trips_booking_id=b.trips_booking_id)
          ) AS booking_date,
          b.booking_start_date, b.booking_end_date,
          b.trip_total_payment AS total_payment,
          b.trip_additional_payment AS additional_payment,
          b.trip_payment_due AS payment_due, b.trips_booking_status AS status,
          COALESCE((SELECT string_agg(
            '$' || COALESCE(p.payment_price::text, '0') || ' on ' || COALESCE(to_char(p.payment_date, 'FMMonth FMDD,YYYY'), '-'),
            E'\\n' ORDER BY p.trips_payment_id)
            FROM alpenwild_trips_payment_tbl p
            WHERE p.trips_booking_id=b.trips_booking_id), '') AS deposits,
          COALESCE((SELECT string_agg(
            '$' || COALESCE(r.amount::text, '0') || ' on ' || COALESCE(to_char(r.created_at, 'FMMonth FMDD,YYYY'), '-'),
            E'\\n' ORDER BY r.created_at)
            FROM alpenwild_trips_payment_refund_tbl r
            JOIN alpenwild_trips_payment_tbl p ON p.trips_payment_id=r.trips_payment_id
            WHERE p.trips_booking_id=b.trips_booking_id), '') AS refunds,
          COALESCE((SELECT string_agg(
            COALESCE(a.first_name, '') || ' ' || COALESCE(a.last_name, '') || E'\\n' ||
            COALESCE(a.preferred_name, '') || E'\\n' || COALESCE(a.mobile_phone, '') || E'\\n' ||
            COALESCE(a.email_address, '') || E'\\n' || COALESCE(a.date_of_birth::text, ''),
            E'\\n\\n' ORDER BY a.trips_additional_booking_user_id)
            FROM alpenwild_trips_additional_booking_user_tbl a
            WHERE a.trips_booking_id=b.trips_booking_id), '') AS additional_users,
          COALESCE((SELECT string_agg(
            CASE WHEN t.trips_available_for = 'Specefic Date'
              THEN to_char(d.trips_start_date, 'FMMonth FMDD,YYYY') || ' - ' || to_char(d.trips_end_date, 'FMMonth FMDD,YYYY')
              ELSE CASE WHEN t.trips_available_for = 'Year Round' THEN 'Year Round. Available for: ' ELSE 'Specific Months. Available for: ' END ||
                COALESCE(d.trips_date_range::text, 'Custom') || ' Days (' || to_char(d.trips_start_date, 'FMMonth, YYYY') || ' to ' || to_char(d.trips_end_date, 'FMMonth, YYYY') || ').' END,
            E'\\n' ORDER BY d.trips_start_date)
            FROM alpenwild_trips_date_tbl d
            WHERE d.trips_id=b.trips_id AND (b.trips_date_id IS NULL OR d.trips_date_id=b.trips_date_id)), '') AS trip_dates
          FROM alpenwild_trips_booking_tbl b
          LEFT JOIN alpenwild_trips_tbl t ON t.trips_id=b.trips_id
         WHERE ($1::int IS NULL OR b.trips_id=$1)
         ORDER BY booking_date DESC NULLS LAST, b.trips_booking_id DESC
         ${recent ? "LIMIT 500" : ""}`,
      [tripId],
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.get("/api/trip-bookings/payments", async (_req, res, next) => {
  try {
    const result = await query(
      `SELECT p.trips_payment_id AS id, p.trips_booking_id AS booking_id,
          b.user_first_name AS first_name, b.user_last_name AS last_name,
          t.trips_name AS trip_name, p.payment_price AS amount,
          b.trips_booking_date AS booking_date, b.booking_start_date,
          b.booking_end_date, b.trip_total_payment AS total_payment,
          b.trip_additional_payment AS additional_payment,
          b.trip_payment_due AS payment_due,
          u.user_first_name AS customer_first_name, u.user_last_name AS customer_last_name,
          u.user_street_address AS customer_street_address,
          u.user_street_address1 AS customer_street_address1,
          u.user_city AS customer_city, u.user_state AS customer_state,
          u.user_postal_code AS customer_postal_code,
          u.user_country AS customer_country,
          COALESCE((SELECT string_agg(to_char(d.trips_start_date, 'FMMonth FMDD,YYYY') || ' - ' || to_char(d.trips_end_date, 'FMMonth FMDD,YYYY'), E'\\n')
            FROM alpenwild_trips_date_tbl d
            WHERE d.trips_id=b.trips_id AND (b.trips_date_id IS NULL OR d.trips_date_id=b.trips_date_id)), '') AS trip_dates,
          COALESCE((SELECT string_agg(ap.description || ': ' || ap.sign || ' $' ||
            to_char(ap.price * ap.quantity, 'FM999999990.00'), E'\\n')
            FROM alpenwild_trips_additional_price_tbl ap
            WHERE ap.trips_booking_id=b.trips_booking_id), '') AS additional_prices,
          p.payment_date, p.payment_status AS status, p.transaction_id,
          p.gateway
         FROM alpenwild_trips_payment_tbl p
         LEFT JOIN alpenwild_trips_booking_tbl b ON b.trips_booking_id=p.trips_booking_id
         LEFT JOIN alpenwild_user_tbl u ON u.user_id=b.user_id
         LEFT JOIN alpenwild_trips_tbl t ON t.trips_id=b.trips_id
         ORDER BY p.payment_date DESC NULLS LAST, p.trips_payment_id DESC`,
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.get("/api/make-payments", async (_req, res, next) => {
  try {
    const result =
      await query(`SELECT pid AS id, name_on_card, bill_address, city, state,
        zip_code, email_address, amount
      FROM alpenwild_makepayment_tbl ORDER BY pid DESC`);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/make-payments/:paymentId", async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.paymentId);
    const result = await query(
      "DELETE FROM alpenwild_makepayment_tbl WHERE pid=$1 RETURNING pid",
      [id],
    );
    if (!result.rows[0])
      return res.status(404).json({ message: "Payment not found." });
    res.json({ message: "Payment details deleted successfully." });
  } catch (error) {
    next(error);
  }
});

app.get("/api/trip-bookings/download", async (_req, res, next) => {
  try {
    const result = await query(`SELECT b.*, t.trips_name, t.trips_available_for,
        d.trips_start_date AS selected_start_date, d.trips_end_date AS selected_end_date,
        d.trips_date_range AS selected_date_range,
        u.user_email_address,
        COALESCE((SELECT json_agg(to_jsonb(a) ORDER BY a.trips_additional_booking_user_id)
          FROM alpenwild_trips_additional_booking_user_tbl a
          WHERE a.trips_booking_id=b.trips_booking_id), '[]'::json) AS guests,
        COALESCE((SELECT json_agg(json_build_object('amount', p.payment_price, 'date', p.payment_date)
          ORDER BY p.payment_date ASC, p.trips_payment_id ASC)
          FROM alpenwild_trips_payment_tbl p
          WHERE p.trips_booking_id=b.trips_booking_id), '[]'::json) AS all_payments,
        COALESCE((SELECT json_agg(json_build_object('amount', p.payment_price, 'date', p.payment_date)
          ORDER BY p.payment_date ASC, p.trips_payment_id ASC)
          FROM alpenwild_trips_payment_tbl p
          WHERE p.trips_booking_id=b.trips_booking_id AND p.payment_status='paid'), '[]'::json) AS paid_payments
      FROM alpenwild_trips_booking_tbl b
      LEFT JOIN alpenwild_trips_tbl t ON t.trips_id=b.trips_id
      LEFT JOIN alpenwild_user_tbl u ON u.user_id=b.user_id
      LEFT JOIN alpenwild_trips_date_tbl d ON d.trips_date_id=b.trips_date_id
      ORDER BY b.trips_booking_date DESC NULLS LAST, b.trips_booking_id DESC`);

    const baseHeaders = [
      "Email",
      "Trip",
      "Trip Dates",
      "Trip Start Date",
      "Trip End Date",
      "Gender",
      "Last Name (as it appears on passport)",
      "First Name (as it appears on passport)",
      "Preferred Name",
      "Rooming Preferrence",
      "Number of Beds",
      "DOB",
      "Street Address",
      "Street Address 2",
      "City",
      "State",
      "Zip Code",
      "Country",
      "Mobile Phone Number",
      "Shipping First name",
      "Shipping Last Name",
      "Shipping Street Address",
      " Shipping StreetAddress2",
      "Shipping City",
      "Shipping State",
      "Shipping Zip Code",
      "Shipping Country",
      "Physical or medical conditions (please specify who in your party this affects)",
      "Dietary Restrictions and Allergies (please specify who in your party this affects):",
      "Dietary Requests (please specify who in your party this affects):",
      "How did you hear about us?:",
      "Special Comments & Questions:",
      "Flight Arrival Details:",
      "Flight Departure Details:",
      "Pre-Post?",
      "Registration Date:",
      "Initial Amount",
      "Single Suppliment",
      "Deposit",
      "Balance",
      "Admin Note",
      "Booking Status",
    ];
    const guestHeaders = [];
    for (let i = 1; i <= 9; i++)
      guestHeaders.push(
        `Guest${i} First Name`,
        `Guest${i} Last Name`,
        `Guest${i} Preferred Name`,
        `Guest${i} Email`,
        `Guest${i} Gender`,
        `Guest${i} Mobile Number`,
        `Guest${i} DOB`,
      );
    const maxPayments = result.rows.reduce(
      (max, row) => Math.max(max, row.all_payments?.length || 0),
      0,
    );
    const depositHeaders = [];
    for (let i = 1; i <= maxPayments; i++)
      depositHeaders.push(`Deposit Amount ${i}`, `Deposit Date ${i}`);
    const headers = [...baseHeaders, ...guestHeaders, ...depositHeaders];
    const legacyValue = (item) =>
      String(item ?? "")
        .trim()
        .replaceAll("''", "'")
        .replaceAll("\\'", "'")
        .replaceAll(",", "-")
        .replace(/\r\n|\n|\r/g, "-");
    const cell = (item, fallback = "N/A") => {
      const normalized = legacyValue(item);
      return normalized === "" ? fallback : normalized;
    };
    const formatDate = (date, format = "iso") => {
      if (date == null || date === "") return "";
      const parsed = new Date(date);
      if (Number.isNaN(parsed.getTime())) return "";
      const parts = new Intl.DateTimeFormat("en-US", {
        month: format === "year-month" ? "long" : "long",
        day: format === "year-month" ? undefined : "numeric",
        year: "numeric",
        timeZone: "UTC",
      }).formatToParts(parsed);
      const part = (type) =>
        parts.find((item) => item.type === type)?.value || "";
      if (format === "iso")
        return `${part("year")}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}-${String(parsed.getUTCDate()).padStart(2, "0")}`;
      if (format === "month-year") return `${part("month")}, ${part("year")}`;
      return `${part("month")} ${part("day")},${part("year")}`;
    };
    const rows = result.rows.map((row) => {
      const bookingStart = row.booking_start_date ?? null;
      const bookingEnd = row.booking_end_date ?? null;
      const tripStart = bookingStart || row.selected_start_date;
      const tripEnd = bookingEnd || row.selected_end_date;
      let tripDates = "";
      if (bookingStart) {
        tripDates = formatDate(bookingStart, "long");
      } else if (
        row.trips_available_for === "Specefic Date" &&
        row.selected_start_date &&
        row.selected_end_date
      ) {
        tripDates = `${formatDate(row.selected_start_date, "long")} - ${formatDate(row.selected_end_date, "long")}`;
      } else if (
        row.trips_available_for !== "Specefic Date" &&
        row.selected_start_date &&
        row.selected_end_date
      ) {
        const duration =
          row.selected_date_range && row.selected_date_range !== "0"
            ? row.selected_date_range
            : "";
        tripDates = `Year Round. Available for:\t${formatDate(row.selected_start_date, "month-year")} to ${formatDate(row.selected_end_date, "month-year")}${duration ? ` for ${duration} Days` : ""}`;
      }
      const guests = Array.isArray(row.guests) ? row.guests : [];
      const allPayments = Array.isArray(row.all_payments)
        ? row.all_payments
        : [];
      const payments = Array.isArray(row.paid_payments)
        ? row.paid_payments
        : [];
      const deposit = allPayments.reduce(
        (sum, payment) => sum + Number(payment.amount || 0),
        0,
      );
      const cells = [
        cell(row.user_email_address),
        cell(row.trips_name),
        cell(tripDates, ""),
        cell(formatDate(tripStart), ""),
        cell(formatDate(tripEnd), ""),
        cell(row.user_gender),
        cell(row.user_last_name),
        cell(row.user_first_name),
        cell(row.user_preferred_name),
        cell(row.rooming_preference),
        cell(row.bed_preference),
        cell(row.user_date_of_birth),
        cell(row.user_street_address),
        cell(row.user_street_address1),
        cell(row.user_city),
        cell(row.user_state),
        cell(row.user_postal_code),
        cell(row.user_country),
        cell(row.user_mobile_phone),
        cell(row.user_shipping_first_name),
        cell(row.user_shipping_last_name),
        cell(row.user_shipping_street_address),
        cell(row.user_shipping_street_address1),
        cell(row.user_shipping_city),
        cell(row.user_shipping_state),
        cell(row.user_shipping_postal_code),
        cell(row.user_shipping_country),
        cell(row.physical_medical_conditions),
        cell(row.dietary_restrictions),
        cell(row.special_dietary_requirements),
        cell(row.hear_about_us),
        cell(row.special_comments),
        cell(row.flight_arrival_details),
        cell(row.flight_departure_details),
        "",
        cell(row.trips_booking_date),
        cell(row.trip_total_payment),
        cell(row.trip_additional_payment, "0"),
        cell(deposit, "0"),
        cell(row.trip_payment_due),
        cell(row.admin_notes),
        cell(row.trips_booking_status),
      ];
      for (let i = 0; i < 9; i++) {
        const guest = guests[i] || {};
        cells.push(
          guest.first_name ? cell(guest.first_name) : "",
          guest.last_name ? cell(guest.last_name) : "",
          guest.preferred_name ? cell(guest.preferred_name) : "",
          guest.email_address ? cell(guest.email_address) : "",
          guest.gender ? cell(guest.gender) : "",
          guest.mobile_phone ? cell(guest.mobile_phone) : "",
          guest.date_of_birth ? cell(guest.date_of_birth) : "",
        );
      }
      for (let i = 0; i < maxPayments; i++) {
        cells.push(
          payments[i] ? cell(payments[i].amount) : "",
          payments[i] ? cell(formatDate(payments[i].date)) : "",
        );
      }
      return cells;
    });
    const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join(
      "\n",
    );
    res.setHeader("Content-Type", "text/octect-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="booking_list_${Math.floor(Date.now() / 1000)}.csv"`,
    );
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

app.get("/api/trip-bookings/user", async (req, res, next) => {
  try {
    const email = z.string().email().parse(req.query.email);
    const result = await query(
      `SELECT user_first_name AS first_name, user_last_name AS last_name,
          user_preferred_name AS preferred_name, user_street_address AS street_address,
          user_street_address1 AS street_address1, user_city AS city,
          user_state AS state, user_postal_code AS postal_code,
          user_country AS country, user_day_phone AS day_phone,
          user_mobile_phone AS mobile_phone, user_date_of_birth AS date_of_birth,
          user_gender AS gender, user_shipping_first_name AS shipping_first_name,
          user_shipping_last_name AS shipping_last_name,
          user_shipping_street_address AS shipping_street_address,
          user_shipping_street_address1 AS shipping_street_address1,
          user_shipping_city AS shipping_city, user_shipping_state AS shipping_state,
          user_shipping_postal_code AS shipping_postal_code,
          user_shipping_country AS shipping_country
         FROM alpenwild_user_tbl WHERE LOWER(user_email_address)=LOWER($1)
         LIMIT 1`,
      [email],
    );
    res.json(result.rows[0] || null);
  } catch (error) {
    next(error);
  }
});

app.get("/api/trip-bookings/:bookingId", async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.bookingId);
    const result = await query(
      `SELECT b.*, u.user_email_address,
          COALESCE((SELECT json_agg(json_build_object(
            'id', a.trips_additional_booking_user_id,
            'first_name', COALESCE(a.first_name, ''),
            'last_name', COALESCE(a.last_name, ''),
            'preferred_name', COALESCE(a.preferred_name, ''),
            'email_address', COALESCE(a.email_address, ''),
            'day_phone', COALESCE(a.day_phone, ''),
            'mobile_phone', COALESCE(a.mobile_phone, ''),
            'date_of_birth', CASE
              WHEN a.date_of_birth ~ '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$'
                THEN to_char(to_date(a.date_of_birth, 'MM/DD/YYYY'), 'YYYY-MM-DD')
              ELSE ''
            END,
            'gender', COALESCE(a.gender, '')
          ) ORDER BY a.trips_additional_booking_user_id)
          FROM alpenwild_trips_additional_booking_user_tbl a
          WHERE a.trips_booking_id=b.trips_booking_id), '[]'::json) AS additional_travelers,
          COALESCE((SELECT json_agg(json_build_object(
            'id', ap.trips_additional_price_id,
            'description', ap.description,
            'price', ap.price,
            'quantity', ap.quantity,
            'sign', ap.sign
          ) ORDER BY ap.trips_additional_price_id)
          FROM alpenwild_trips_additional_price_tbl ap
          WHERE ap.trips_booking_id=b.trips_booking_id), '[]'::json) AS additional_prices
       FROM alpenwild_trips_booking_tbl b
       LEFT JOIN alpenwild_user_tbl u ON u.user_id=b.user_id
       WHERE b.trips_booking_id=$1`,
      [id],
    );
    if (!result.rows[0])
      return res.status(404).json({ message: "Booking not found." });
    const row = result.rows[0];
    res.json({
      ...row,
      user_email_address: row.user_email_address || "",
      first_name: row.user_first_name || "",
      last_name: row.user_last_name || "",
      preferred_name: row.user_preferred_name || "",
      street_address: row.user_street_address || "",
      street_address1: row.user_street_address1 || "",
      city: row.user_city || "",
      state: row.user_state || "",
      postal_code: row.user_postal_code || "",
      country: row.user_country || "UNITED STATES",
      day_phone: row.user_day_phone || "",
      mobile_phone: row.user_mobile_phone || "",
      date_of_birth: row.user_date_of_birth || "",
      gender: row.user_gender || "",
      shipping_first_name: row.user_shipping_first_name || "",
      shipping_last_name: row.user_shipping_last_name || "",
      shipping_street_address: row.user_shipping_street_address || "",
      shipping_street_address1: row.user_shipping_street_address1 || "",
      shipping_city: row.user_shipping_city || "",
      shipping_state: row.user_shipping_state || "",
      shipping_postal_code: row.user_shipping_postal_code || "",
      shipping_country: row.user_shipping_country || "UNITED STATES",
      initial_booking_amount: row.trip_total_payment || "",
      single_supplement_booking_amount: row.trip_additional_payment || "",
      additional_travelers: row.additional_travelers || [],
      additional_prices: row.additional_prices || [],
    });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/trip-bookings/:bookingId", async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.bookingId);
    const b = req.body || {};
    const depositAmount = tripBookingAmount.parse(b.deposit_amount || 0);
    const tripTotal = tripBookingAmount.parse(b.initial_booking_amount || 0);
    const singleSupplement = tripBookingAmount.parse(
      b.single_supplement_booking_amount || 0,
    );
    const discount = await getTripBookingDiscount(
      String(b.discount_code || "").trim(),
      tripTotal,
    );
    const applicableDiscount = discount || { amount: 0, description: "" };
    const additionalTravelers = Object.hasOwn(b, "additional_travelers")
      ? z
          .array(
            z.object({
              id: z.coerce.number().int().positive().optional(),
              first_name: z.string().trim().max(255).default(""),
              last_name: z.string().trim().max(255).default(""),
              preferred_name: z.string().trim().max(255).default(""),
              email_address: z.string().max(255).default(""),
              day_phone: z.string().max(255).default(""),
              mobile_phone: z.string().max(255).default(""),
              date_of_birth: z.string().optional().default(""),
              gender: z.string().max(255).default(""),
            }),
          )
          .max(9)
          .parse(b.additional_travelers)
      : null;
    const additionalPrices = Object.hasOwn(b, "additional_prices")
      ? z
          .array(
            z.object({
              id: z.coerce.number().int().positive().optional(),
              description: z.string().trim().min(1).max(255),
              price: tripBookingAmount,
              quantity: z.coerce.number().int().min(1),
              sign: z.enum(["+", "-"]),
            }),
          )
          .parse(b.additional_prices)
      : null;
    if (
      additionalTravelers &&
      additionalTravelers.length > Number(b.party_number || 1) - 1
    )
      return res
        .status(400)
        .json({ message: "Too many additional travelers." });

    if (!pool) throw new Error("DATABASE_URL is not configured");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const lockedBooking = await client.query(
        `SELECT trips_booking_id
         FROM alpenwild_trips_booking_tbl
         WHERE trips_booking_id=$1
         FOR UPDATE`,
        [id],
      );
      if (!lockedBooking.rowCount) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Booking not found." });
      }
      if (additionalPrices) {
        const existing = await client.query(
          `SELECT trips_additional_price_id AS id
             FROM alpenwild_trips_additional_price_tbl
            WHERE trips_booking_id=$1
            FOR UPDATE`,
          [id],
        );
        const existingIds = new Set(existing.rows.map((row) => String(row.id)));
        const submittedIds = additionalPrices
          .filter((price) => price.id !== undefined)
          .map((price) => String(price.id));
        if (submittedIds.some((priceId) => !existingIds.has(priceId)))
          throw new Error(
            "Additional price record does not belong to this booking.",
          );

        await client.query(
          `DELETE FROM alpenwild_trips_additional_price_tbl
            WHERE trips_booking_id=$1
              AND NOT (trips_additional_price_id = ANY($2::bigint[]))`,
          [id, submittedIds],
        );
        for (const price of additionalPrices) {
          if (price.id !== undefined) {
            await client.query(
              `UPDATE alpenwild_trips_additional_price_tbl
                  SET description=$1, price=$2, quantity=$3, sign=$4
                WHERE trips_booking_id=$5 AND trips_additional_price_id=$6`,
              [
                price.description,
                price.price,
                price.quantity,
                price.sign,
                id,
                price.id,
              ],
            );
          } else {
            await client.query(
              `INSERT INTO alpenwild_trips_additional_price_tbl
                (trips_booking_id,description,price,quantity,sign)
               VALUES ($1,$2,$3,$4,$5)`,
              [id, price.description, price.price, price.quantity, price.sign],
            );
          }
        }
      }
      if (applicableDiscount.amount > 0)
        await client.query(
          `INSERT INTO alpenwild_trips_additional_price_tbl
             (trips_booking_id,description,price,sign)
           VALUES ($1,$2,$3,'-')`,
          [id, applicableDiscount.description, applicableDiscount.amount],
        );
      if (depositAmount > 0) {
        await client.query(
          `INSERT INTO alpenwild_trips_payment_tbl
             (trips_booking_id,name_on_credit_card,payment_price,
              payment_date,payment_status)
           VALUES ($1,'',$2,CURRENT_DATE,'Paid')`,
          [id, depositAmount],
        );
      }
      const [additionalPricesResult, payments] = await Promise.all([
        client.query(
          `SELECT COALESCE(SUM(
             CASE WHEN sign='-' THEN -1 ELSE 1 END * price * quantity
           ), 0) AS total
           FROM alpenwild_trips_additional_price_tbl
           WHERE trips_booking_id=$1`,
          [id],
        ),
        client.query(
          `SELECT COALESCE(SUM(payment_price), 0) AS total
           FROM alpenwild_trips_payment_tbl
           WHERE trips_booking_id=$1`,
          [id],
        ),
      ]);
      const paymentDue =
        tripTotal +
        singleSupplement +
        Number(additionalPricesResult.rows[0].total) -
        Number(payments.rows[0].total);
      await client.query(
        `UPDATE alpenwild_trips_booking_tbl SET
        trips_id=$1, trips_date_id=$2, party_number=$3, booking_start_date=NULLIF($4::text, '')::date, booking_end_date=NULLIF($5::text, '')::date,
        user_first_name=$6, user_last_name=$7, user_preferred_name=$8, user_day_phone=$9, user_mobile_phone=$10,
        user_street_address=$11, user_street_address1=$12, user_city=$13, user_state=$14, user_postal_code=$15,
        user_country=$16, user_gender=$17, user_shipping_first_name=$18, user_shipping_last_name=$19,
        user_shipping_street_address=$20, user_shipping_street_address1=$21, user_shipping_city=$22,
        user_shipping_state=$23, user_shipping_postal_code=$24, user_shipping_country=$25,
        physical_medical_conditions=$26, dietary_restrictions=$27, special_dietary_requirements=$28,
        hear_about_us=$29, special_comments=$30, flight_arrival_details=$31, flight_departure_details=$32,
        rooming_preference=$33, bed_preference=$34, admin_notes=$35, trip_total_payment=$36,
        trip_additional_payment=$37, trip_payment_due=$38
        WHERE trips_booking_id=$39`,
        [
          b.trips_id,
          b.trips_date_id || null,
          b.party_number,
          b.booking_start_date || "",
          b.booking_end_date || "",
          b.first_name || "",
          b.last_name || "",
          b.preferred_name || "",
          b.day_phone || "",
          b.mobile_phone || "",
          b.street_address || "",
          b.street_address1 || "",
          b.city || "",
          b.state || "",
          b.postal_code || "",
          b.country || "",
          b.gender || "",
          b.shipping_first_name || "",
          b.shipping_last_name || "",
          b.shipping_street_address || "",
          b.shipping_street_address1 || "",
          b.shipping_city || "",
          b.shipping_state || "",
          b.shipping_postal_code || "",
          b.shipping_country || "",
          b.physical_medical_conditions || "",
          b.dietary_restrictions || "",
          b.special_dietary_requirements || "",
          b.hear_about_us || "",
          b.special_comments || "",
          b.flight_arrival_details || "",
          b.flight_departure_details || "",
          b.rooming_preference || "",
          b.bed_preference || "",
          b.admin_notes || "",
          tripTotal,
          singleSupplement,
          paymentDue,
          id,
        ],
      );

      if (additionalTravelers) {
        const existing = await client.query(
          `SELECT trips_additional_booking_user_id AS id
           FROM alpenwild_trips_additional_booking_user_tbl
           WHERE trips_booking_id=$1
           FOR UPDATE`,
          [id],
        );
        const existingIds = new Set(existing.rows.map((row) => String(row.id)));
        const submittedIds = additionalTravelers
          .filter((traveler) => traveler.id !== undefined)
          .map((traveler) => String(traveler.id));
        if (submittedIds.some((guestId) => !existingIds.has(guestId)))
          throw new Error("Guest record does not belong to this booking.");

        await client.query(
          `DELETE FROM alpenwild_trips_additional_booking_user_tbl
           WHERE trips_booking_id=$1
             AND NOT (trips_additional_booking_user_id = ANY($2::bigint[]))`,
          [id, submittedIds],
        );
        for (const traveler of additionalTravelers) {
          const values = [
            traveler.first_name,
            traveler.last_name,
            traveler.preferred_name,
            traveler.email_address,
            traveler.day_phone,
            traveler.mobile_phone,
            traveler.date_of_birth || null,
            traveler.gender,
          ];
          if (traveler.id !== undefined) {
            await client.query(
              `UPDATE alpenwild_trips_additional_booking_user_tbl SET
                first_name=$1, last_name=$2, preferred_name=$3,
                email_address=$4, day_phone=$5, mobile_phone=$6,
                date_of_birth=$7, gender=$8
               WHERE trips_booking_id=$9 AND trips_additional_booking_user_id=$10`,
              [...values, id, traveler.id],
            );
          } else {
            await client.query(
              `INSERT INTO alpenwild_trips_additional_booking_user_tbl
                (trips_booking_id, first_name, last_name, preferred_name,
                 email_address, day_phone, mobile_phone, date_of_birth, gender)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
              [id, ...values],
            );
          }
        }
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    let emailWarning;
    try {
      if (!mailer) throw new Error("SMTP email is not configured.");
      const [
        bookingResult,
        paymentResult,
        additionalPricesResult,
        refundsResult,
        emailOptionResult,
      ] = await Promise.all([
        query(
          `SELECT b.*, u.user_email_address,
                t.trips_name AS trip_name,
                t.trips_available_for AS available_for,
                to_char(d.trips_start_date, 'YYYY-MM-DD') AS date_start,
                to_char(d.trips_end_date, 'YYYY-MM-DD') AS date_end
             FROM alpenwild_trips_booking_tbl b
             LEFT JOIN alpenwild_user_tbl u ON u.user_id=b.user_id
             LEFT JOIN alpenwild_trips_tbl t ON t.trips_id=b.trips_id
             LEFT JOIN alpenwild_trips_date_tbl d
               ON d.trips_date_id=b.trips_date_id AND d.trips_id=b.trips_id
             WHERE b.trips_booking_id=$1`,
          [id],
        ),
        query(
          `SELECT to_char(payment_date, 'YYYY-MM-DD') AS payment_date,
                payment_price
             FROM alpenwild_trips_payment_tbl
             WHERE trips_booking_id=$1 AND payment_status='Paid'
             ORDER BY trips_payment_id DESC`,
          [id],
        ),
        query(
          `SELECT description, price, quantity, sign
             FROM alpenwild_trips_additional_price_tbl
             WHERE trips_booking_id=$1
             ORDER BY trips_additional_price_id`,
          [id],
        ),
        query(
          `SELECT COUNT(*) AS count, COALESCE(SUM(r.amount), 0) AS total
             FROM alpenwild_trips_payment_refund_tbl r
             JOIN alpenwild_trips_payment_tbl p
               ON p.trips_payment_id=r.trips_payment_id
             WHERE p.trips_booking_id=$1`,
          [id],
        ),
        query(
          `SELECT site_configuration_value
             FROM alpenwild_site_configuration_tbl
             WHERE site_configuration_id=18`,
        ),
      ]);
      const booking = bookingResult.rows[0];
      if (!booking) throw new Error("The updated booking could not be loaded.");
      const customerEmailEnabled =
        emailOptionResult.rows[0]?.site_configuration_value === "On" ||
        b.send_email === true;
      const customerEmail = String(booking.user_email_address || "").trim();

      const invoiceTripStartDate =
        booking.available_for === "Specefic Date"
          ? booking.date_start
          : booking.booking_start_date;
      const refundTotal = Number(refundsResult.rows[0]?.total || 0);
      const refundItems =
        refundTotal > 0
          ? [
              {
                description:
                  Number(refundsResult.rows[0]?.count || 0) > 1
                    ? "Refunds (Total)"
                    : "Refund",
                sign: "-",
                price: refundTotal,
              },
            ]
          : [];
      const invoiceDate = new Date().toISOString().slice(0, 10);
      const invoice = await createTripBookingInvoicePdf({
        bookingId: id,
        bookingDate: invoiceDate,
        tripName: booking.trip_name,
        tripStartDate: invoiceTripStartDate,
        tripEndDate:
          booking.available_for === "Specefic Date"
            ? booking.date_end
            : booking.booking_end_date,
        dueDate:
          booking.payment_due_date ||
          calculateBookingPaymentDueDate(invoiceTripStartDate) ||
          invoiceDate,
        firstName: booking.user_first_name,
        lastName: booking.user_last_name,
        streetAddress: booking.user_street_address,
        streetAddress1: booking.user_street_address1,
        city: booking.user_city,
        state: booking.user_state,
        postalCode: booking.user_postal_code,
        country: booking.user_country,
        phone: booking.user_day_phone || booking.user_mobile_phone,
        email: customerEmail,
        partyNumber: booking.party_number,
        tripTotal: booking.trip_total_payment,
        singleSupplement: booking.trip_additional_payment,
        additionalItems: additionalPricesResult.rows,
        refundItems,
        totalDue: booking.trip_payment_due,
        paymentHistory: paymentResult.rows.map((payment) => ({
          date: payment.payment_date,
          amount: payment.payment_price,
        })),
      });
      const siteTitle = await getSiteTitle();
      const emailMessage = {
        from: {
          name: siteTitle,
          address: config.smtpFrom || config.smtpUser,
        },
        subject: String(
          b.email_subject || `${siteTitle} Trip Booking Confirmation`,
        ),
        html: createBookingConfirmationHtml(
          booking.user_first_name || "",
          String(b.email_message || ""),
        ),
        attachments: [
          {
            filename: `invoice${id}_${invoiceDate}.pdf`,
            content: invoice,
            contentType: "application/pdf",
          },
        ],
      };
      const deliveryErrors = [];
      if (customerEmailEnabled && !customerEmail)
        deliveryErrors.push("customer: email address is missing");
      for (const [to, label] of [
        ...(customerEmailEnabled && customerEmail
          ? [[customerEmail, "customer"]]
          : []),
        ["payments@yopmail.com,webgrity43@gmail.com", "internal recipients"],
      ]) {
        try {
          await mailer.sendMail({ ...emailMessage, to });
        } catch (error) {
          deliveryErrors.push(`${label}: ${error.message}`);
        }
      }
      if (deliveryErrors.length) throw new Error(deliveryErrors.join("; "));
    } catch (error) {
      emailWarning = `Booking was updated, but invoice email delivery failed: ${error.message}`;
    }
    res.json({
      message: "Booking updated successfully.",
      id,
      ...(emailWarning ? { emailWarning } : {}),
    });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/trip-bookings/:bookingId/status", async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.bookingId);
    const status = z.string().trim().min(1).max(100).parse(req.body?.status);
    const result = await query(
      `UPDATE alpenwild_trips_booking_tbl
       SET trips_booking_status=$1
       WHERE trips_booking_id=$2
       RETURNING trips_booking_status AS status`,
      [status, id],
    );
    if (!result.rows[0])
      return res.status(404).json({ message: "Booking not found." });
    res.json({
      message: "Booking status updated successfully.",
      status: result.rows[0].status,
    });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/trip-bookings/:bookingId", async (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.bookingId);
    const result = await query(
      `DELETE FROM alpenwild_trips_booking_tbl
       WHERE trips_booking_id=$1
       RETURNING trips_booking_id`,
      [id],
    );
    if (!result.rows[0])
      return res.status(404).json({ message: "Booking not found." });
    res.json({ message: "Booking deleted successfully." });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/trip-bookings/:bookingId/payments", async (req, res, next) => {
  try {
    const bookingId = z.coerce
      .number()
      .int()
      .positive()
      .parse(req.params.bookingId);
    const payments = z
      .array(
        z.object({
          id: z.coerce.number().int().positive(),
          amount: z.coerce.number().min(0),
          payment_date: z.string().min(1),
        }),
      )
      .parse(req.body.payments);
    const bookingResult = await query(
      `SELECT trip_payment_due FROM alpenwild_trips_booking_tbl WHERE trips_booking_id=$1`,
      [bookingId],
    );
    if (!bookingResult.rows[0])
      return res.status(404).json({ message: "Booking not found." });
    let oldTotal = 0;
    let newTotal = 0;
    for (const payment of payments) {
      const current = await query(
        `SELECT payment_price FROM alpenwild_trips_payment_tbl WHERE trips_payment_id=$1 AND trips_booking_id=$2`,
        [payment.id, bookingId],
      );
      if (!current.rows[0]) continue;
      oldTotal += Number(current.rows[0].payment_price || 0);
      newTotal += payment.amount;
      await query(
        `UPDATE alpenwild_trips_payment_tbl SET payment_price=$1, payment_date=$2 WHERE trips_payment_id=$3 AND trips_booking_id=$4`,
        [payment.amount, payment.payment_date, payment.id, bookingId],
      );
    }
    const due =
      Number(bookingResult.rows[0].trip_payment_due || 0) + oldTotal - newTotal;
    await query(
      `UPDATE alpenwild_trips_booking_tbl SET trip_payment_due=$1 WHERE trips_booking_id=$2`,
      [Math.max(0, due), bookingId],
    );
    res.json({ message: "Payment details updated successfully." });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/trip-payments/:paymentId", async (req, res, next) => {
  try {
    const paymentId = z.coerce
      .number()
      .int()
      .positive()
      .parse(req.params.paymentId);
    const payment = await query(
      `DELETE FROM alpenwild_trips_payment_tbl
       WHERE trips_payment_id=$1
       RETURNING trips_booking_id AS booking_id, payment_price AS amount`,
      [paymentId],
    );
    if (!payment.rows[0])
      return res.status(404).json({ message: "Payment not found." });
    await query(
      `UPDATE alpenwild_trips_booking_tbl
       SET trip_payment_due=COALESCE(trip_payment_due, 0) + $1
       WHERE trips_booking_id=$2`,
      [payment.rows[0].amount || 0, payment.rows[0].booking_id],
    );
    res.json({ message: "Payment details deleted successfully." });
  } catch (error) {
    next(error);
  }
});

app.get("/api/trip-bookings/:bookingId/refunds", async (req, res, next) => {
  try {
    const bookingId = z.coerce
      .number()
      .int()
      .positive()
      .parse(req.params.bookingId);
    const result = await query(
      `SELECT p.trips_payment_id AS payment_id, p.payment_price, p.payment_date,
          p.payment_status, p.transaction_id, COALESCE(p.refunded_amount, 0) AS refunded_amount,
          COALESCE(p.refund_status, '') AS refund_status,
          GREATEST(p.payment_price - COALESCE(p.refunded_amount, 0), 0) AS refundable_balance
       FROM alpenwild_trips_payment_tbl p WHERE p.trips_booking_id=$1 ORDER BY p.payment_date ASC`,
      [bookingId],
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.post("/api/trip-payments/:paymentId/refund", async (req, res, next) => {
  let client;
  let transactionOpen = false;
  try {
    const paymentId = z.coerce
      .number()
      .int()
      .positive()
      .parse(req.params.paymentId);
    const amount = z.coerce.number().positive().parse(req.body?.amount);
    client = await pool.connect();
    await client.query("BEGIN");
    transactionOpen = true;
    const paymentResult = await client.query(
      `SELECT p.trips_payment_id, p.trips_booking_id, p.payment_price,
          p.payment_date, p.payment_status, p.transaction_id,
          p.credit_card_number, p.refunded_amount,
          b.user_id, b.user_first_name, b.user_last_name,
          b.user_street_address, b.user_street_address1, b.user_city,
          b.user_state, b.user_postal_code, b.user_country,
          b.user_day_phone, b.user_mobile_phone, b.party_number,
          b.trips_id, b.trips_date_id, b.booking_start_date, b.booking_end_date,
          b.trip_total_payment, b.trip_additional_payment,
          b.trip_payment_due, b.payment_due_date,
          u.user_email_address, t.trips_name AS trip_name,
          t.trips_available_for AS available_for,
          to_char(d.trips_start_date, 'YYYY-MM-DD') AS date_start,
          to_char(d.trips_end_date, 'YYYY-MM-DD') AS date_end
       FROM alpenwild_trips_payment_tbl p
       JOIN alpenwild_trips_booking_tbl b ON b.trips_booking_id=p.trips_booking_id
       LEFT JOIN alpenwild_user_tbl u ON u.user_id=b.user_id
       LEFT JOIN alpenwild_trips_tbl t ON t.trips_id=b.trips_id
       LEFT JOIN alpenwild_trips_date_tbl d
         ON d.trips_date_id=b.trips_date_id AND d.trips_id=b.trips_id
       WHERE p.trips_payment_id=$1
       FOR UPDATE OF p, b`,
      [paymentId],
    );
    const payment = paymentResult.rows[0];
    if (!payment) {
      await client.query("ROLLBACK");
      transactionOpen = false;
      return res.status(404).json({ message: "Payment record not found." });
    }
    const remaining =
      Number(payment.payment_price || 0) - Number(payment.refunded_amount || 0);
    if (amount > remaining) {
      await client.query("ROLLBACK");
      transactionOpen = false;
      return res
        .status(400)
        .json({ message: "Refund amount exceeds remaining balance." });
    }
    if (!payment.transaction_id) {
      await client.query("ROLLBACK");
      transactionOpen = false;
      return res
        .status(400)
        .json({ message: "No transaction id available for refund." });
    }
    if (!payment.credit_card_number) {
      await client.query("ROLLBACK");
      transactionOpen = false;
      return res
        .status(400)
        .json({ message: "No card information available for refund." });
    }
    const refund = await authorizeNetRefund({
      cardNumber: payment.credit_card_number,
      amount,
      transactionId: payment.transaction_id,
    });
    if (!refund.configured) {
      await client.query("ROLLBACK");
      transactionOpen = false;
      return res
        .status(503)
        .json({ message: "Authorize.Net credentials are not configured." });
    }
    if (!refund.approved) {
      await client.query("ROLLBACK");
      transactionOpen = false;
      return res.status(400).json({ message: refund.reason });
    }
    const refundedAmount = Number(payment.refunded_amount || 0) + amount;
    await client.query(
      `UPDATE alpenwild_trips_payment_tbl
       SET refunded_amount=$1, refund_status=$2
       WHERE trips_payment_id=$3`,
      [
        refundedAmount,
        refundedAmount >= Number(payment.payment_price) ? "full" : "partial",
        paymentId,
      ],
    );
    await client.query(
      `INSERT INTO alpenwild_trips_payment_refund_tbl
       (trips_payment_id, refund_transaction_id, amount, status, created_at)
       VALUES ($1,$2,$3,'approved',CURRENT_TIMESTAMP)`,
      [paymentId, refund.transactionId, amount],
    );
    await client.query(
      `UPDATE alpenwild_trips_booking_tbl
       SET trip_payment_due=COALESCE(trip_payment_due,0)+$1
       WHERE trips_booking_id=$2`,
      [amount, payment.trips_booking_id],
    );
    await client.query("COMMIT");
    transactionOpen = false;

    let emailWarning;
    const customerEmail = String(payment.user_email_address || "").trim();
    if (!customerEmail) {
      emailWarning =
        "Refund processed, but confirmation email was not sent: customer email address is missing.";
    } else if (!mailer) {
      emailWarning =
        "Refund processed, but confirmation email was not sent: SMTP email is not configured.";
    } else {
      try {
        const [paymentHistoryResult, additionalItemsResult, refundsResult] =
          await Promise.all([
            query(
              `SELECT to_char(payment_date, 'YYYY-MM-DD') AS payment_date,
                  payment_price
               FROM alpenwild_trips_payment_tbl
               WHERE trips_booking_id=$1 AND payment_status='Paid'
               ORDER BY trips_payment_id DESC`,
              [payment.trips_booking_id],
            ),
            query(
              `SELECT description, price, quantity, sign
               FROM alpenwild_trips_additional_price_tbl
               WHERE trips_booking_id=$1
               ORDER BY trips_additional_price_id`,
              [payment.trips_booking_id],
            ),
            query(
              `SELECT COUNT(*) AS count, COALESCE(SUM(r.amount), 0) AS total
               FROM alpenwild_trips_payment_refund_tbl r
               JOIN alpenwild_trips_payment_tbl p
                 ON p.trips_payment_id=r.trips_payment_id
               WHERE p.trips_booking_id=$1`,
              [payment.trips_booking_id],
            ),
          ]);
        const bookingDate = new Date().toISOString().slice(0, 10);
        const invoiceTripStartDate =
          payment.available_for === "Specefic Date"
            ? payment.date_start
            : payment.booking_start_date;
        const refundTotal = Number(refundsResult.rows[0]?.total || 0);
        const refundItems =
          refundTotal > 0
            ? [
                {
                  description:
                    Number(refundsResult.rows[0]?.count || 0) > 1
                      ? "Refunds (Total)"
                      : "Refund",
                  sign: "-",
                  price: refundTotal,
                },
              ]
            : [];
        const invoice = await createTripBookingInvoicePdf({
          bookingId: payment.trips_booking_id,
          bookingDate,
          tripName: payment.trip_name,
          tripStartDate: invoiceTripStartDate,
          tripEndDate:
            payment.available_for === "Specefic Date"
              ? payment.date_end
              : payment.booking_end_date,
          dueDate:
            payment.payment_due_date ||
            calculateBookingPaymentDueDate(invoiceTripStartDate) ||
            bookingDate,
          firstName: payment.user_first_name,
          lastName: payment.user_last_name,
          streetAddress: payment.user_street_address,
          streetAddress1: payment.user_street_address1,
          city: payment.user_city,
          state: payment.user_state,
          postalCode: payment.user_postal_code,
          country: payment.user_country,
          phone: payment.user_day_phone || payment.user_mobile_phone,
          email: customerEmail,
          partyNumber: payment.party_number,
          tripTotal: payment.trip_total_payment,
          singleSupplement: payment.trip_additional_payment,
          additionalItems: additionalItemsResult.rows,
          refundItems,
          totalDue: Number(payment.trip_payment_due || 0) + amount,
          paymentHistory: paymentHistoryResult.rows.map((item) => ({
            date: item.payment_date,
            amount: item.payment_price,
          })),
        });
        const siteTitle = await getSiteTitle();
        const emailMessage = {
          from: {
            name: siteTitle,
            address: config.smtpFrom || config.smtpUser,
          },
          subject: `${siteTitle} Refund Confirmation (Booking #${payment.trips_booking_id})`,
          html: createRefundConfirmationHtml({
            firstName: payment.user_first_name,
            bookingId: payment.trips_booking_id,
            amount,
            transactionId: refund.transactionId,
          }),
          attachments: [
            {
              filename: `invoice${payment.trips_booking_id}_${bookingDate}.pdf`,
              content: invoice,
              contentType: "application/pdf",
            },
          ],
        };
        const deliveryErrors = [];
        for (const [to, label] of [
          [customerEmail, "customer"],
          ["payments@yopmail.com, webgrity43@gmail.com", "internal recipients"],
        ]) {
          try {
            await mailer.sendMail({ ...emailMessage, to });
          } catch (error) {
            deliveryErrors.push(`${label}: ${error.message}`);
          }
        }
        if (deliveryErrors.length)
          emailWarning = `Refund processed, but confirmation email delivery failed: ${deliveryErrors.join("; ")}`;
      } catch (error) {
        emailWarning = `Refund processed, but confirmation email delivery failed: ${error.message}`;
      }
    }
    res.json({
      message: "Refund processed successfully.",
      refund_transaction_id: refund.transactionId,
      ...(emailWarning ? { emailWarning } : {}),
    });
  } catch (error) {
    if (transactionOpen && client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "Trip refund transaction rollback failed.",
          rollbackError,
        );
      }
    }
    next(error);
  } finally {
    client?.release();
  }
});

app.post(
  "/api/trip-bookings/:bookingId/payment-link",
  async (req, res, next) => {
    try {
      if (!mailer)
        return res
          .status(503)
          .json({ message: "SMTP email is not configured." });
      const bookingId = z.coerce
        .number()
        .int()
        .positive()
        .parse(req.params.bookingId);
      const type = z
        .enum(["due", "custom", "define_admin"])
        .parse(req.body?.type || "due");
      const requestedAmount =
        req.body?.amount == null || req.body.amount === ""
          ? null
          : z.coerce.number().positive().parse(req.body.amount);
      const result = await query(
        `SELECT b.user_first_name, u.user_email_address, b.user_shipping_email_address, b.trip_payment_due, t.trips_name FROM alpenwild_trips_booking_tbl b LEFT JOIN alpenwild_user_tbl u ON u.user_id=b.user_id LEFT JOIN alpenwild_trips_tbl t ON t.trips_id=b.trips_id WHERE b.trips_booking_id=$1`,
        [bookingId],
      );
      const booking = result.rows[0];
      if (!booking)
        return res.status(404).json({ message: "Booking not found." });
      const recipient =
        booking.user_email_address || booking.user_shipping_email_address;
      if (!recipient)
        return res
          .status(400)
          .json({ message: "Booking has no email address." });
      const amount =
        type === "due"
          ? Number(booking.trip_payment_due || 0)
          : requestedAmount;
      if (!amount || amount <= 0)
        return res
          .status(400)
          .json({ message: "Payment amount must be greater than zero." });
      const clientOrigin =
        config.clientOrigin === true
          ? `${req.protocol}://${req.get("host")}`
          : String(config.clientOrigin);
      const paymentUrl = `${clientOrigin.replace(/\/$/, "")}/staticpage/make-a-payment/?type=${encodeURIComponent(type)}&bookingid=${bookingId}${type === "define_admin" ? `&adminamount=${encodeURIComponent(amount)}` : ""}`;
      const signature = paymentLinkSignature(bookingId, type, amount);
      const signedPaymentUrl = `${paymentUrl}&signature=${encodeURIComponent(signature)}`;
      const siteTitle = await getSiteTitle();
      await mailer.sendMail({
        from: {
          name: siteTitle,
          address: config.smtpFrom || config.smtpUser,
        },
        to: recipient,
        subject: `${siteTitle} Invoice`,
        html: `<html><body><p>Hi ${booking.user_first_name || ""},</p><p>I hope you're doing well and getting excited for your upcoming adventure with ${siteTitle}!</p><p>You can make your trip payment securely using the link below:</p><p><a href="${signedPaymentUrl}">Pay Now</a></p><p>Once your payment is received, we'll send a confirmation and update your booking details.</p><p>Thank you again for traveling with us!</p></body></html>`,
      });
      res.json({ message: "Payment link sent successfully." });
    } catch (error) {
      next(error);
    }
  },
);

app.get("/api/public-trip-payment-links/:bookingId", async (req, res, next) => {
  try {
    const bookingId = z.coerce
      .number()
      .int()
      .positive()
      .parse(req.params.bookingId);
    const type = z
      .enum(["due", "custom", "define_admin"])
      .parse(req.query.type);
    const amount =
      type === "define_admin"
        ? z.coerce.number().finite().positive().parse(req.query.adminamount)
        : "";
    if (
      !isValidPaymentLinkSignature(bookingId, type, amount, req.query.signature)
    )
      return res.status(400).json({ message: "This payment link is invalid." });

    const result = await query(
      `SELECT b.trips_booking_id AS booking_id, b.trips_id AS trip_id,
          b.trip_payment_due AS due, t.trips_name AS trip_name,
          u.user_email_address AS email
         FROM alpenwild_trips_booking_tbl b
         JOIN alpenwild_trips_tbl t ON t.trips_id=b.trips_id
         JOIN alpenwild_user_tbl u ON u.user_id=b.user_id
        WHERE b.trips_booking_id=$1
          AND b.trips_booking_status='Active'
          AND COALESCE(b.trip_payment_due, 0) > 0`,
      [bookingId],
    );
    const booking = result.rows[0];
    if (!booking)
      return res.status(404).json({
        message: "This payment link has no active booking balance.",
      });
    const due = Number(booking.due);
    if (type === "define_admin" && amount > due)
      return res.status(400).json({
        message: "Payment amount cannot exceed the outstanding balance.",
      });
    res.json({
      booking_id: Number(booking.booking_id),
      trip_id: Number(booking.trip_id),
      trip_name: booking.trip_name,
      email: booking.email,
      due,
      type,
      amount: type === "due" ? due : type === "define_admin" ? amount : null,
      signature: req.query.signature,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/trip-payments", async (req, res, next) => {
  let paymentId;
  let paymentRequestClaimed = false;
  try {
    const data = z
      .object({
        payment_type: z.literal("trip").default("trip"),
        client_request_id: z.string().uuid(),
        trip_id: z.coerce.number().int().positive(),
        booking_id: z.coerce.number().int().positive().optional(),
        payment_link_type: z.enum(["due", "custom", "define_admin"]).optional(),
        payment_link_amount: z.coerce.number().positive().optional(),
        payment_link_signature: z
          .string()
          .regex(/^[a-f0-9]{64}$/i)
          .optional(),
        email: z.string().email(),
        name_on_card: z.string().trim().min(1).max(255),
        billing_address: z.string().trim().min(1).max(255),
        city: z.string().trim().min(1).max(255),
        state: z.string().trim().min(1).max(255),
        zipcode: z.string().trim().min(1).max(30),
        amount: z.coerce
          .number()
          .finite()
          .positive()
          .refine(
            (amount) =>
              Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-7,
            "Enter an amount with no more than two decimal places.",
          ),
        credit_card_number: z.string().regex(/^\d{14,25}$/),
        credit_card_expire_month: z.string().regex(/^(0[1-9]|1[0-2])$/),
        credit_card_expire_year: z.coerce
          .number()
          .int()
          .min(new Date().getFullYear())
          .max(new Date().getFullYear() + 11),
        credit_card_cvv_number: z.string().regex(/^\d{3,4}$/),
        credit_card_last_four: z.string().regex(/^\d{4}$/),
        recaptcha_token: z.string().max(5000).default(""),
      })
      .parse(req.body);
    if (
      data.booking_id &&
      (!data.payment_link_type ||
        !data.payment_link_signature ||
        !isValidPaymentLinkSignature(
          data.booking_id,
          data.payment_link_type,
          data.payment_link_amount,
          data.payment_link_signature,
        ))
    )
      return res.status(400).json({ message: "This payment link is invalid." });
    if (
      !data.booking_id &&
      (data.payment_link_type || data.payment_link_signature)
    )
      return res.status(400).json({ message: "This payment link is invalid." });
    if (data.amount < 50)
      return res.status(400).json({
        message: "You have to pay minimun $50.",
      });
    if (config.recaptchaEnabled && !config.recaptchaSecret)
      return res
        .status(503)
        .json({ message: "Online payments are not configured." });
    if (config.recaptchaEnabled && !data.recaptcha_token)
      return res
        .status(400)
        .json({ message: "Please click on the reCAPTCHA box." });
    if (
      config.recaptchaEnabled &&
      !(await verifyRecaptcha(data.recaptcha_token))
    )
      return res
        .status(400)
        .json({ message: "Robot verification failed, please try again." });
    if (!config.authorizeNetLogin || !config.authorizeNetTransactionKey)
      return res
        .status(503)
        .json({ message: "Online card payments are not configured." });

    const now = new Date();
    if (
      data.credit_card_expire_year === now.getFullYear() &&
      Number(data.credit_card_expire_month) < now.getMonth() + 1
    )
      return res.status(400).json({
        message: "The credit card has expired. Please use a valid card.",
      });

    const userResult = await query(
      `SELECT user_id, user_first_name, user_last_name,
          user_day_phone, user_mobile_phone, user_street_address,
          user_street_address1, user_city, user_state, user_postal_code,
          user_country, user_email_address
         FROM alpenwild_user_tbl
        WHERE LOWER(user_email_address)=LOWER($1)
        ORDER BY user_first_name LIMIT 1`,
      [data.email],
    );
    const user = userResult.rows[0];
    if (!user)
      return res.status(404).json({
        message:
          "You seem to have entered an incorrect email id or a different email id. Please check and correct to proceed further. In case you are a new visitor and are looking to make a new booking for the selected trip, then please click here.",
      });
    const bookingResult = await query(
      `SELECT b.trips_booking_id AS id, b.trip_payment_due AS due,
          b.trip_total_payment AS trip_total,
          b.trip_additional_payment AS single_supplement,
          b.party_number, b.rooming_preference,
          b.booking_start_date, b.booking_end_date, b.payment_due_date,
          t.trips_name AS trip_name, t.trips_available_for AS available_for,
          to_char(d.trips_start_date, 'YYYY-MM-DD') AS date_start,
          to_char(d.trips_end_date, 'YYYY-MM-DD') AS date_end
         FROM alpenwild_trips_booking_tbl b
         JOIN alpenwild_trips_tbl t ON t.trips_id=b.trips_id
         LEFT JOIN alpenwild_trips_date_tbl d
           ON d.trips_date_id=b.trips_date_id AND d.trips_id=b.trips_id
        WHERE b.trips_id=$1 AND b.user_id=$2
          AND b.trips_booking_status='Active'
          AND ($3::bigint IS NULL OR b.trips_booking_id=$3)
        ORDER BY b.trips_booking_id DESC LIMIT 1`,
      [data.trip_id, user.user_id, data.booking_id || null],
    );
    const booking = bookingResult.rows[0];
    if (!booking)
      return res.status(404).json({
        message:
          "There's no open Trip Booking by you for the selected trip. Please check if you've mistakenly chosen an incorrect trip. In case you are looking at making a new Booking for the selected trip, then click here.",
      });
    const requestFingerprint = crypto
      .createHash("sha256")
      .update(
        JSON.stringify({
          booking_id: booking.id,
          trip_id: data.trip_id,
          email: user.user_email_address.toLowerCase(),
          amount: data.amount,
          name_on_card: data.name_on_card,
          card_last_four: data.credit_card_last_four,
        }),
      )
      .digest("hex");
    const claimedRequest = await query(
      `INSERT INTO alpenwild_public_trip_payment_request_tbl
        (request_id,booking_id,request_fingerprint,status)
       VALUES ($1,$2,$3,'processing')
       ON CONFLICT (request_id) DO NOTHING
       RETURNING request_id`,
      [data.client_request_id, booking.id, requestFingerprint],
    );
    paymentRequestClaimed = Boolean(claimedRequest.rowCount);
    if (!claimedRequest.rowCount) {
      const existingResult = await query(
        `SELECT booking_id,request_fingerprint,status,payment_id,
            transaction_id,response_message
           FROM alpenwild_public_trip_payment_request_tbl
          WHERE request_id=$1`,
        [data.client_request_id],
      );
      const existing = existingResult.rows[0];
      if (
        !existing ||
        Number(existing.booking_id) !== Number(booking.id) ||
        existing.request_fingerprint !== requestFingerprint
      )
        return res.status(409).json({
          message:
            "This payment submission has already been used with different details. Reload the page before trying again.",
        });
      if (existing.status === "paid") {
        const balanceResult = await query(
          `SELECT trip_payment_due AS remaining_balance
             FROM alpenwild_trips_booking_tbl
            WHERE trips_booking_id=$1`,
          [booking.id],
        );
        return res.status(200).json({
          id: existing.payment_id,
          status: "Paid",
          transaction_id: existing.transaction_id,
          remaining_balance: Number(
            balanceResult.rows[0]?.remaining_balance || 0,
          ),
          message: "Payment approved.",
        });
      }
      if (existing.status === "declined")
        return res.status(402).json({
          message: existing.response_message || "Payment was declined.",
          retryable: true,
        });
      return res.status(409).json({
        message:
          "This payment is already being processed or its result is not yet confirmed. Do not submit another payment. Please wait or contact Alpenwild.",
        payment_id: existing.payment_id,
      });
    }
    const currentDue = Number(booking.due || 0);
    const rejectRequest = async (
      statusCode,
      message,
      pendingPaymentId = null,
    ) => {
      if (pendingPaymentId)
        await query(
          "DELETE FROM alpenwild_trips_payment_tbl WHERE trips_payment_id=$1 AND payment_status='Pending'",
          [pendingPaymentId],
        );
      await query(
        `UPDATE alpenwild_public_trip_payment_request_tbl
            SET status='declined',payment_id=NULL,response_message=$1,
                updated_at=CURRENT_TIMESTAMP
          WHERE request_id=$2`,
        [message, data.client_request_id],
      );
      return res.status(statusCode).json({ message, retryable: true });
    };
    if (currentDue <= 0)
      return rejectRequest(404, "This booking has no remaining balance.");
    if (data.amount > currentDue)
      return rejectRequest(
        400,
        "Payment amount cannot exceed the outstanding balance.",
      );
    if (
      (data.payment_link_type === "due" && data.amount !== currentDue) ||
      (data.payment_link_type === "define_admin" &&
        data.amount !== data.payment_link_amount)
    )
      return rejectRequest(
        400,
        "The payment amount or booking balance has changed. Reload the payment link.",
      );

    const pendingPayment = await query(
      `INSERT INTO alpenwild_trips_payment_tbl
        (trips_booking_id,name_on_credit_card,credit_card_number,payment_price,
         payment_date,payment_status,transaction_id,gateway)
       VALUES ($1,$2,$3,$4,CURRENT_DATE,'Pending',NULL,'authorize_net')
       RETURNING trips_payment_id AS id`,
      [booking.id, data.name_on_card, data.credit_card_last_four, data.amount],
    );
    paymentId = pendingPayment.rows[0].id;
    await query(
      `UPDATE alpenwild_public_trip_payment_request_tbl
          SET payment_id=$1,updated_at=CURRENT_TIMESTAMP
        WHERE request_id=$2`,
      [paymentId, data.client_request_id],
    );
    const paymentTransaction = await pool.connect();
    let remainingBalance;
    let charge;
    try {
      await paymentTransaction.query("BEGIN");
      const lockedBooking = await paymentTransaction.query(
        `SELECT trip_payment_due AS due
           FROM alpenwild_trips_booking_tbl
          WHERE trips_booking_id=$1 AND trips_booking_status='Active'
          FOR UPDATE`,
        [booking.id],
      );
      const lockedDue = Number(lockedBooking.rows[0]?.due || 0);
      if (!lockedBooking.rowCount || data.amount > lockedDue) {
        await paymentTransaction.query("ROLLBACK");
        return rejectRequest(
          400,
          "Payment amount cannot exceed the outstanding balance. Reload the payment link.",
          paymentId,
        );
      }
      if (
        (data.payment_link_type === "due" && data.amount !== lockedDue) ||
        (data.payment_link_type === "define_admin" &&
          data.amount !== data.payment_link_amount)
      ) {
        await paymentTransaction.query("ROLLBACK");
        return rejectRequest(
          400,
          "The payment amount or booking balance has changed. Reload the payment link.",
          paymentId,
        );
      }
      const gatewayInvoice = `p${crypto
        .createHash("sha256")
        .update(data.client_request_id)
        .digest("hex")
        .slice(0, 19)}`;
      charge = await authorizeNetCharge({
        cardNumber: data.credit_card_number,
        expiration: `${data.credit_card_expire_month}${data.credit_card_expire_year}`,
        amount: data.amount,
        cvv: data.credit_card_cvv_number,
        invoice: gatewayInvoice,
        email: user.user_email_address,
        firstName: data.name_on_card,
        address: data.billing_address,
        city: data.city,
        state: data.state || "N/A",
        zip: data.zipcode,
        customerIp: req.ip || "",
      });
      if (!charge.approved) {
        await paymentTransaction.query(
          "DELETE FROM alpenwild_trips_payment_tbl WHERE trips_payment_id=$1 AND payment_status='Pending'",
          [paymentId],
        );
        await paymentTransaction.query(
          `UPDATE alpenwild_public_trip_payment_request_tbl
              SET status='declined',payment_id=NULL,response_message=$1,
                  updated_at=CURRENT_TIMESTAMP
            WHERE request_id=$2`,
          [charge.reason, data.client_request_id],
        );
        await paymentTransaction.query("COMMIT");
        paymentId = null;
        return res.status(402).json({
          message: charge.reason,
          retryable: true,
        });
      }
      const paymentStatusResult = await paymentTransaction.query(
        `UPDATE alpenwild_trips_payment_tbl
            SET payment_status='Paid',transaction_id=$1
          WHERE trips_payment_id=$2
          RETURNING trips_payment_id`,
        [charge.transactionId || null, paymentId],
      );
      if (!paymentStatusResult.rowCount)
        throw new Error("Approved payment could not be marked as paid.");
      const balance = await paymentTransaction.query(
        `UPDATE alpenwild_trips_booking_tbl
            SET trip_payment_due=GREATEST(0, COALESCE(trip_payment_due, 0) - $1)
          WHERE trips_booking_id=$2 AND COALESCE(trip_payment_due, 0) >= $1
          RETURNING trip_payment_due AS due`,
        [data.amount, booking.id],
      );
      if (!balance.rowCount)
        throw new Error(
          "Approved payment could not update the booking balance.",
        );
      remainingBalance = Number(balance.rows[0].due);
      await paymentTransaction.query(
        `UPDATE alpenwild_public_trip_payment_request_tbl
            SET status='paid',transaction_id=$1,response_message='Payment approved.',
                updated_at=CURRENT_TIMESTAMP
          WHERE request_id=$2`,
        [charge.transactionId || null, data.client_request_id],
      );
      await paymentTransaction.query("COMMIT");
    } catch (error) {
      try {
        await paymentTransaction.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "Trip payment transaction rollback failed.",
          rollbackError,
        );
      }
      throw error;
    } finally {
      paymentTransaction.release();
    }
    if (mailer) {
      try {
        const templateResult = await query(
          `SELECT email_template_subject,email_template_message
             FROM alpenwild_email_template_tbl
            WHERE email_template_id=$1 LIMIT 1`,
          [remainingBalance === 0 ? 5 : 2],
        );
        const template = templateResult.rows[0];
        if (!template)
          throw new Error(
            `Payment confirmation email template ${remainingBalance === 0 ? 5 : 2} is missing.`,
          );
        const paymentsResult = await query(
          `SELECT to_char(payment_date, 'YYYY-MM-DD') AS payment_date,
                  payment_price
             FROM alpenwild_trips_payment_tbl
            WHERE trips_booking_id=$1 AND payment_status='Paid'
            ORDER BY trips_payment_id DESC`,
          [booking.id],
        );
        const additionalItemsResult = await query(
          `SELECT description, sign, price, quantity
             FROM alpenwild_trips_additional_price_tbl
            WHERE trips_booking_id=$1
            ORDER BY trips_additional_price_id ASC`,
          [booking.id],
        );
        const refundResult = await query(
          `SELECT COALESCE(SUM(r.amount), 0) AS total,
                  COUNT(*) AS count
             FROM alpenwild_trips_payment_refund_tbl r
             JOIN alpenwild_trips_payment_tbl p
               ON p.trips_payment_id=r.trips_payment_id
            WHERE p.trips_booking_id=$1`,
          [booking.id],
        );
        const totalRefund = Number(refundResult.rows[0]?.total || 0);
        const refundItems =
          totalRefund > 0
            ? [
                {
                  description:
                    Number(refundResult.rows[0].count) > 1
                      ? "Refunds (Total)"
                      : "Refund",
                  sign: "-",
                  price: totalRefund,
                },
              ]
            : [];
        const invoiceTripStartDate =
          booking.available_for === "Specefic Date"
            ? booking.date_start
            : booking.booking_start_date;
        const invoice = await createTripBookingInvoicePdf({
          bookingId: booking.id,
          bookingDate: new Date().toISOString().slice(0, 10),
          tripName: booking.trip_name,
          tripStartDate: invoiceTripStartDate,
          tripEndDate:
            booking.available_for === "Specefic Date"
              ? booking.date_end
              : booking.booking_end_date,
          dueDate:
            booking.payment_due_date ||
            calculateBookingPaymentDueDate(invoiceTripStartDate) ||
            new Date().toISOString().slice(0, 10),
          firstName: user.user_first_name,
          lastName: user.user_last_name,
          streetAddress: data.billing_address,
          streetAddress1: user.user_street_address1,
          city: data.city || user.user_city,
          state: data.state || user.user_state,
          postalCode: data.zipcode || user.user_postal_code,
          country: user.user_country,
          phone: user.user_day_phone || user.user_mobile_phone,
          email: user.user_email_address,
          partyNumber: booking.party_number,
          tripTotal: booking.trip_total,
          singleSupplement: booking.single_supplement,
          additionalItems: additionalItemsResult.rows,
          refundItems,
          paymentAmount: data.amount,
          totalDue: remainingBalance,
          paymentHistory: paymentsResult.rows.map((payment) => ({
            date: payment.payment_date,
            amount: payment.payment_price,
          })),
        });
        const siteTitle = await getSiteTitle();
        await mailer.sendMail({
          from: {
            name: siteTitle,
            address: config.smtpFrom || config.smtpUser,
          },
          to: user.user_email_address,
          subject: template.email_template_subject,
          html: createPaymentConfirmationHtml(
            user.user_first_name,
            template.email_template_message,
          ),
          attachments: [
            {
              filename: `invoice${booking.id}_${new Date().toISOString().slice(0, 10)}.pdf`,
              content: invoice,
              contentType: "application/pdf",
            },
          ],
        });
      } catch (error) {
        console.error("Trip payment confirmation email failed.", error);
      }
    } else {
      console.error(
        "Trip payment confirmation email was not sent because SMTP is not configured.",
      );
    }
    res.status(201).json({
      id: paymentId,
      status: "Paid",
      transaction_id: charge.transactionId || null,
      remaining_balance: remainingBalance,
      message: "Payment approved.",
    });
  } catch (error) {
    if (paymentRequestClaimed) {
      console.error(
        "Trip payment request outcome could not be confirmed.",
        error,
      );
      return res.status(502).json({
        message:
          "We could not confirm the payment result. Do not submit another payment. Contact Alpenwild before trying again.",
        ...(paymentId ? { payment_id: paymentId } : {}),
      });
    }
    next(error);
  }
});

const tripBookingAmount = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const text = value.trim();
  const numberTextPattern = /^[+-]?((\d{1,3}(,\d{3})*)|\d+)?(\.\d+)?$/;
  return numberTextPattern.test(text) ? text.replaceAll(",", "") : text;
}, z.coerce.number().finite().min(0));

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

app.post("/api/trip-bookings", handleTripBooking);

const bookingDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => validDateOrNull(value) === value, "Enter a valid date.");

app.post("/api/public/trip-bookings", async (req, res, next) => {
  try {
    const data = z
      .object({
        user_email_address: z.string().trim().email().max(255),
        trips_id: z.coerce.number().int().positive(),
        trips_date_id: z.coerce.number().int().positive(),
        party_number: z.coerce.number().int().min(1).max(10),
        first_name: z.string().trim().min(1).max(255),
        last_name: z.string().trim().min(1).max(255),
        mobile_phone: z.string().trim().min(10).max(20),
        date_of_birth: bookingDateSchema,
        gender: z.string().max(20).default(""),
        street_address: z.string().trim().min(1).max(255),
        street_address1: z.string().trim().max(255).default(""),
        city: z.string().trim().min(1).max(255),
        state: z.string().trim().min(1).max(255),
        postal_code: z.string().trim().min(1).max(255),
        country: z.string().trim().min(1).max(255),
        shipping_first_name: z.string().trim().min(1).max(255),
        shipping_last_name: z.string().trim().min(1).max(255),
        shipping_street_address: z.string().trim().min(1).max(255),
        shipping_street_address1: z.string().trim().max(255).default(""),
        shipping_city: z.string().trim().min(1).max(255),
        shipping_state: z.string().trim().min(1).max(255),
        shipping_postal_code: z.string().trim().min(1).max(255),
        shipping_country: z.string().trim().min(1).max(255),
        booking_start_date: z.string().optional().default(""),
        booking_end_date: z.string().optional().default(""),
        rooming_preference: z.string().max(250).default(""),
        bed_preference: z.string().max(250).default(""),
        preferred_name: z.string().max(255).default(""),
        physical_medical_conditions: z.string().max(10000).default(""),
        dietary_restrictions: z.string().max(10000).default(""),
        special_dietary_requirements: z.string().max(10000).default(""),
        hear_about_us: z.string().max(250).default(""),
        special_comments: z.string().max(30000).default(""),
        flight_arrival_details: z.string().max(10000).default(""),
        flight_departure_details: z.string().max(10000).default(""),
        discount_code: z.string().trim().max(255).default(""),
        credit_card_number: z.string().regex(/^\d{14,25}$/),
        credit_card_last_four: z.string().regex(/^\d{4}$/),
        credit_card_expire_month: z.string().regex(/^(0[1-9]|1[0-2])$/),
        credit_card_expire_year: z.coerce
          .number()
          .int()
          .min(new Date().getFullYear())
          .max(new Date().getFullYear() + 20),
        credit_card_cvv_number: z.string().regex(/^\d{3,4}$/),
        additional_travelers: z
          .array(
            z.object({
              first_name: z.string().trim().min(1).max(255),
              last_name: z.string().trim().min(1).max(255),
              preferred_name: z.string().trim().max(255).default(""),
              email_address: z.string().email().or(z.literal("")).default(""),
              mobile_phone: z.string().max(255).default(""),
              gender: z.string().max(255).default(""),
              date_of_birth: bookingDateSchema,
            }),
          )
          .max(9)
          .default([]),
        recaptcha_token: z.string().max(5000).default(""),
        agree: z.literal("1"),
      })
      .parse(req.body);

    if (config.recaptchaEnabled && !config.recaptchaSecret)
      return res
        .status(503)
        .json({ message: "Trip booking is not configured." });
    if (
      config.recaptchaEnabled &&
      !(await verifyRecaptcha(data.recaptcha_token))
    )
      return res
        .status(400)
        .json({ message: "Robot verification failed, please try again." });

    if (data.additional_travelers.length > data.party_number - 1)
      return res
        .status(400)
        .json({ message: "Too many additional travelers." });

    const tripResult = await query(
      `SELECT t.trips_id, t.trips_name, t.trips_status, t.trips_available_for,
        t.trips_price, t.trips_single_price,
          t.trips_deposit_amount,
        d.trips_date_status,
        to_char(d.trips_start_date, 'YYYY-MM-DD') AS trips_start_date,
        to_char(d.trips_end_date, 'YYYY-MM-DD') AS trips_end_date
         FROM alpenwild_trips_tbl t
         JOIN alpenwild_trips_date_tbl d ON d.trips_id=t.trips_id
        WHERE t.trips_id=$1 AND d.trips_date_id=$2 LIMIT 1`,
      [data.trips_id, data.trips_date_id],
    );
    const trip = tripResult.rows[0];
    const today = new Date().toISOString().slice(0, 10);
    if (
      !trip ||
      trip.trips_status !== "Active" ||
      trip.trips_date_status !== "Active" ||
      String(trip.trips_end_date).slice(0, 10) < today
    )
      return res
        .status(400)
        .json({ message: "The selected trip date is no longer available." });

    const bookingStartDate = validDateOrNull(data.booking_start_date);
    const bookingEndDate = validDateOrNull(data.booking_end_date);
    if (
      trip.trips_available_for !== "Specefic Date" &&
      (!bookingStartDate ||
        !bookingEndDate ||
        bookingStartDate > bookingEndDate)
    )
      return res
        .status(400)
        .json({ message: "Please enter a valid trip start and end date." });

    const tripBaseAmount = Number(trip.trips_price || 0) * data.party_number;
    const singleSupplement =
      data.rooming_preference === "Single occupancy"
        ? Number(trip.trips_single_price || 0)
        : 0;
    const tripTotal = tripBaseAmount + singleSupplement;
    if (!Number.isFinite(tripTotal) || tripTotal < 0)
      throw new Error("Trip pricing is invalid.");
    const discount = await getTripBookingDiscount(
      data.discount_code,
      tripBaseAmount,
    );
    if (discount === null)
      return res
        .status(400)
        .json({ message: "Discount code is invalid or expired." });
    const discountAmount = discount.amount;

    const amounts = calculatePublicBookingAmounts({
      tripPrice: Number(trip.trips_price || 0),
      singleSupplement:
        data.rooming_preference === "Single occupancy"
          ? Number(trip.trips_single_price || 0)
          : 0,
      depositPerPerson: Number(trip.trips_deposit_amount || 0),
      partyNumber: data.party_number,
      discountAmount,
    });
    if (
      amounts.payment_amount > 0 &&
      (!config.authorizeNetLogin || !config.authorizeNetTransactionKey)
    )
      return res
        .status(503)
        .json({ message: "Online payment is not configured." });

    const now = new Date();
    if (
      data.credit_card_expire_year === now.getFullYear() &&
      Number(data.credit_card_expire_month) < now.getMonth() + 1
    )
      return res.status(400).json({
        message: "The credit card has expired. Please use a valid card.",
      });

    req.body = {
      ...data,
      day_phone: data.mobile_phone,
      send_email: true,
      email_subject: `${await getSiteTitle()} Trip Booking Confirmation`,
      email_message: "",
      booking_start_date: bookingStartDate || "",
      booking_end_date: bookingEndDate || "",
      payment_due_date: calculateBookingPaymentDueDate(
        trip.trips_available_for === "Specefic Date"
          ? trip.trips_start_date
          : bookingStartDate,
      ),
      invoice_trip_start_date:
        trip.trips_available_for === "Specefic Date"
          ? trip.trips_start_date
          : bookingStartDate,
      invoice_trip_end_date:
        trip.trips_available_for === "Specefic Date"
          ? trip.trips_end_date
          : bookingEndDate,
      trip_name: trip.trips_name,
      ...amounts,
    };
    return handleTripBooking(req, res, next);
  } catch (error) {
    next(error);
  }
});

const tripSelect = `SELECT t.trips_id AS id, t.trips_name AS name, t.trips_slug AS slug,
  t.trips_type_id AS type_id, tt.trip_type_name AS type_name, t.location_id,
  t.blog_post_display AS blog_post_display,
  l.location_name AS location_name, t.trips_activity_level AS activity_level,
  t.trips_menu_name AS menu_name, t.trips_meta_title AS meta_title,
  t.trips_meta_descriptions AS meta_descriptions, t.trips_meta_keywords AS meta_keywords,
  t.trips_short_descriptions AS short_description, t.trips_description AS description,
  t.trip_days AS days, t.trip_nights AS nights, t.trips_deposit_amount AS deposit_amount,
  t.trips_deposit_amount_text AS deposit_amount_text, t.trips_price AS price,
  t.trips_price_text AS price_text, t.trips_single_price AS single_price,
  t.trips_available_for AS available_for, t.trips_included AS included,
  t.trips_excluded AS excluded, t.trips_highlight AS highlight,
  t.trips_youtube_content AS youtube_content, t.trips_activity AS activity,
  t.trips_arrival AS arrival, t.trips_departure AS departure,
  t.trips_pre_post_tour_travel AS pre_post_tour_travel, t.trips_accomodations AS accommodations,
  t.trips_meals AS meals, t.trips_banner_title AS banner_title,
  t.trips_banner_sub_title AS banner_sub_title, t.trips_tooltip_text AS tooltip_text,
  t.trips_banner AS banner_image, t.trips_map AS map_image, t.trips_listing_image AS listing_image,
  t.trips_banner_alt AS banner_alt, t.trips_listing_image_alt AS listing_image_alt,
  t.trips_order AS display_order, t.trips_status AS status FROM alpenwild_trips_tbl t
  LEFT JOIN alpenwild_trip_type_tbl tt ON tt.trip_type_id=t.trips_type_id
  LEFT JOIN alpenwild_location_tbl l ON l.location_id=t.location_id`;

app.get("/api/trips", async (_req, res, next) => {
  try {
    const result = await query(
      `${tripSelect} ORDER BY t.trips_order, t.trips_id`,
    );
    const rows = await Promise.all(
      result.rows.map(async (row) =>
        serializeTrip(row, await tripRelations(row.id)),
      ),
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.get("/api/trip-posts/:tripId", async (req, res, next) => {
  try {
    const result = await query(
      `SELECT post_url AS url, post_name AS name, post_image AS image
       FROM alpenwild_trip_posts_tbl WHERE trips_id=$1 ORDER BY post_name`,
      [req.params.tripId],
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.get("/api/trip-faqs/:tripId", async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, question, answer, faq_order
       FROM alpenwild_faq_page_tbl
       WHERE static_page_id=$1
       ORDER BY faq_order ASC, id DESC`,
      [req.params.tripId],
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.post("/api/trip-faqs/:tripId", async (req, res, next) => {
  try {
    const data = z
      .object({
        question: z.string().trim().min(1).max(10000),
        answer: z.string().trim().min(1).max(30000),
      })
      .parse(req.body);
    const result = await query(
      `INSERT INTO alpenwild_faq_page_tbl (question,answer,static_page_id,faq_order)
       VALUES ($1,$2,$3,COALESCE((SELECT MAX(faq_order) + 1 FROM alpenwild_faq_page_tbl WHERE static_page_id=$4),1))
       RETURNING id, question, answer, faq_order`,
      [data.question, data.answer, req.params.tripId, req.params.tripId],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.put("/api/trip-faqs/:tripId/:id", async (req, res, next) => {
  try {
    const data = z
      .object({
        question: z.string().trim().min(1).max(10000),
        answer: z.string().trim().min(1).max(30000),
      })
      .parse(req.body);
    const result = await query(
      `UPDATE alpenwild_faq_page_tbl SET question=$1, answer=$2
       WHERE id=$3 AND static_page_id=$4
       RETURNING id, question, answer, faq_order`,
      [data.question, data.answer, req.params.id, req.params.tripId],
    );
    if (!result.rowCount)
      return res.status(404).json({ message: "FAQ not found." });
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/trip-faqs/:tripId/:id", async (req, res, next) => {
  try {
    await query(
      "DELETE FROM alpenwild_faq_page_tbl WHERE id=$1 AND static_page_id=$2",
      [req.params.id, req.params.tripId],
    );
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.post("/api/trips", tripUpload.any(), async (req, res, next) => {
  try {
    const data = tripSchema.parse(req.body);
    const dates = parseJsonArray(req.body.dates)
      .filter((item) => item.start_date || item.end_date)
      .map((item) => tripDateSchema.parse(item));
    const boxes = parseJsonArray(req.body.box_images).map((item) =>
      tripBoxSchema.parse(item),
    );
    const activityIds = parseJsonArray(data.activity_ids)
      .map(Number)
      .filter(Boolean);
    const file = (name) => uploadedFile(req.files, name);
    const banner = file("banner_image");
    const map = file("map_image");
    const listing = file("listing_image");
    if (!banner || !map || !listing)
      return res
        .status(400)
        .json({ message: "Banner, map, and listing images are required." });
    const names = {
      banner: safeFilename(banner, "banner"),
      map: safeFilename(map, "map"),
      listing: safeFilename(listing, "listing"),
    };
    await fs.rename(
      banner.path,
      path.join(config.tripBannerUploadDir, names.banner),
    );
    await fs.rename(map.path, path.join(config.tripMapUploadDir, names.map));
    await fs.rename(
      listing.path,
      path.join(config.tripListingUploadDir, names.listing),
    );
    const result = await query(
      `INSERT INTO alpenwild_trips_tbl
       (trips_name,trips_slug,trips_type_id,location_id,trips_activity_level,blog_post_display,trips_menu_name,
       trips_meta_title,trips_meta_descriptions,trips_meta_keywords,trips_short_descriptions,trips_description,
       trip_days,trip_nights,trips_deposit_amount,trips_deposit_amount_text,trips_price,trips_price_text,
       trips_single_price,trips_available_for,trips_included,trips_excluded,trips_highlight,trips_youtube_content,
       trips_activity,trips_arrival,trips_departure,trips_pre_post_tour_travel,trips_accomodations,trips_meals,
       trips_banner_title,trips_banner_sub_title,trips_tooltip_text,trips_banner,trips_map,trips_listing_image,
       trips_banner_alt,trips_listing_image_alt,trips_order,trips_creation_date,trips_status)
      VALUES (${Array.from({ length: 41 }, (_, i) => `$${i + 1}`).join(",")}) RETURNING trips_id`,
      [
        data.name,
        data.slug ||
          data.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, ""),
        data.type_id,
        data.location_id,
        data.activity_level,
        data.blog_post_display,
        data.menu_name,
        data.meta_title,
        data.meta_descriptions,
        data.meta_keywords,
        data.short_description,
        data.description,
        data.days,
        data.nights,
        data.deposit_amount,
        data.deposit_amount_text,
        data.price,
        data.price_text,
        data.single_price,
        data.available_for,
        data.included,
        data.excluded,
        data.highlight,
        data.youtube_content,
        data.activity,
        data.arrival,
        data.departure,
        data.pre_post_tour_travel,
        data.accommodations,
        data.meals,
        data.banner_title,
        data.banner_sub_title,
        data.tooltip_text,
        names.banner,
        names.map,
        names.listing,
        data.banner_alt,
        data.listing_image_alt,
        data.order,
        new Date(),
        data.status,
      ],
    );
    const id = result.rows[0].trips_id;
    await saveTripRelations(id, dates, boxes, activityIds, req.files);
    const row = await query(`${tripSelect} WHERE t.trips_id=$1`, [id]);
    res.status(201).json(serializeTrip(row.rows[0], await tripRelations(id)));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/trips/:id", tripUpload.any(), async (req, res, next) => {
  try {
    const data = tripSchema.parse(req.body);
    const dates = parseJsonArray(req.body.dates)
      .filter((item) => item.start_date || item.end_date)
      .map((item) => tripDateSchema.parse(item));
    const boxes = parseJsonArray(req.body.box_images).map((item) =>
      tripBoxSchema.parse(item),
    );
    const activityIds = parseJsonArray(data.activity_ids)
      .map(Number)
      .filter(Boolean);
    const file = (name) => uploadedFile(req.files, name);
    const files = {
      banner: file("banner_image"),
      map: file("map_image"),
      listing: file("listing_image"),
    };
    const current = await query(
      "SELECT trips_banner, trips_map, trips_listing_image FROM alpenwild_trips_tbl WHERE trips_id=$1",
      [req.params.id],
    );
    if (!current.rowCount)
      return res.status(404).json({ message: "Trip not found." });
    const names = {
      banner: current.rows[0].trips_banner,
      map: current.rows[0].trips_map,
      listing: current.rows[0].trips_listing_image,
    };
    for (const [key, uploaded] of Object.entries(files)) {
      if (uploaded) names[key] = safeFilename(uploaded, key);
    }
    if (!names.banner || !names.map || !names.listing)
      return res
        .status(400)
        .json({ message: "Banner, map, and listing images are required." });
    for (const [key, uploaded] of Object.entries(files)) {
      if (uploaded) {
        const directory =
          key === "banner"
            ? config.tripBannerUploadDir
            : key === "map"
              ? config.tripMapUploadDir
              : config.tripListingUploadDir;
        await fs.rename(uploaded.path, path.join(directory, names[key]));
      }
    }
    await query(
      `UPDATE alpenwild_trips_tbl SET trips_name=$1,trips_slug=$2,trips_type_id=$3,location_id=$4,trips_activity_level=$5,blog_post_display=$6,trips_menu_name=$7,trips_meta_title=$8,trips_meta_descriptions=$9,trips_meta_keywords=$10,trips_short_descriptions=$11,trips_description=$12,trip_days=$13,trip_nights=$14,trips_deposit_amount=$15,trips_deposit_amount_text=$16,trips_price=$17,trips_price_text=$18,trips_single_price=$19,trips_available_for=$20,trips_included=$21,trips_excluded=$22,trips_highlight=$23,trips_youtube_content=$24,trips_activity=$25,trips_arrival=$26,trips_departure=$27,trips_pre_post_tour_travel=$28,trips_accomodations=$29,trips_meals=$30,trips_banner_title=$31,trips_banner_sub_title=$32,trips_tooltip_text=$33,trips_banner=$34,trips_map=$35,trips_listing_image=$36,trips_banner_alt=$37,trips_listing_image_alt=$38,trips_order=$39,trips_status=$40 WHERE trips_id=$41`,
      [
        data.name,
        data.slug,
        data.type_id,
        data.location_id,
        data.activity_level,
        data.blog_post_display,
        data.menu_name,
        data.meta_title,
        data.meta_descriptions,
        data.meta_keywords,
        data.short_description,
        data.description,
        data.days,
        data.nights,
        data.deposit_amount,
        data.deposit_amount_text,
        data.price,
        data.price_text,
        data.single_price,
        data.available_for,
        data.included,
        data.excluded,
        data.highlight,
        data.youtube_content,
        data.activity,
        data.arrival,
        data.departure,
        data.pre_post_tour_travel,
        data.accommodations,
        data.meals,
        data.banner_title,
        data.banner_sub_title,
        data.tooltip_text,
        names.banner,
        names.map,
        names.listing,
        data.banner_alt,
        data.listing_image_alt,
        data.order,
        data.status,
        req.params.id,
      ],
    );
    await query("DELETE FROM alpenwild_trips_date_tbl WHERE trips_id=$1", [
      req.params.id,
    ]);
    await query("DELETE FROM alpenwild_trips_box_image_tbl WHERE trips_id=$1", [
      req.params.id,
    ]);
    await saveTripRelations(
      req.params.id,
      dates,
      boxes,
      activityIds,
      req.files,
    );
    const row = await query(`${tripSelect} WHERE t.trips_id=$1`, [
      req.params.id,
    ]);
    res.json(serializeTrip(row.rows[0], await tripRelations(req.params.id)));
  } catch (error) {
    next(error);
  }
});

async function saveTripRelations(id, dates, boxes, activityIds, files = []) {
  if (!pool) throw new Error("DATABASE_URL is not configured.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `LOCK TABLE alpenwild_trips_activity_tbl,
        alpenwild_trips_date_tbl,
        alpenwild_trips_box_image_tbl IN SHARE ROW EXCLUSIVE MODE`,
    );
    const activityIdsResult = await client.query(
      "SELECT COALESCE(MAX(trips_acitivity_id), 0) + 1 AS next_id FROM alpenwild_trips_activity_tbl",
    );
    const dateIdsResult = await client.query(
      "SELECT COALESCE(MAX(trips_date_id), 0) + 1 AS next_id FROM alpenwild_trips_date_tbl",
    );
    const boxImageIdsResult = await client.query(
      "SELECT COALESCE(MAX(trips_box_image_id), 0) + 1 AS next_id FROM alpenwild_trips_box_image_tbl",
    );
    let nextActivityId = Number(activityIdsResult.rows[0].next_id);
    let nextDateId = Number(dateIdsResult.rows[0].next_id);
    let nextBoxImageId = Number(boxImageIdsResult.rows[0].next_id);

    await client.query(
      "DELETE FROM alpenwild_trips_activity_tbl WHERE trips_id=$1",
      [id],
    );
    for (const activityId of activityIds)
      await client.query(
        "INSERT INTO alpenwild_trips_activity_tbl (trips_acitivity_id,trips_id,activity_id) VALUES ($1,$2,$3)",
        [nextActivityId++, id, activityId],
      );
    for (const date of dates)
      await client.query(
        `INSERT INTO alpenwild_trips_date_tbl (trips_date_id,trips_id,trips_start_date,trips_end_date,trips_date_range,trips_price,trips_single_price,trips_date_status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          nextDateId++,
          id,
          date.start_date,
          date.end_date,
          date.date_range,
          date.price,
          date.single_price,
          date.status,
        ],
      );
    for (let index = 0; index < boxes.length; index += 1) {
      const box = boxes[index];
      const uploaded = uploadedFile(files, `box_image_${index}`);
      let image = box.image || "";
      if (uploaded) {
        image = safeFilename(uploaded, "box");
        await fs.rename(
          uploaded.path,
          path.join(config.tripBoxImageUploadDir, image),
        );
      }
      await client.query(
        `INSERT INTO alpenwild_trips_box_image_tbl (trips_box_image_id,trips_id,trips_box_image,trips_box_image_alt,trips_box_image_title,trips_box_image_link,trips_box_image_order) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          nextBoxImageId++,
          id,
          image,
          box.image_alt,
          box.title,
          box.link,
          box.display_order,
        ],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

app.patch("/api/trips/:id/status", async (req, res, next) => {
  try {
    const status = z.enum(["Active", "Inactive"]).parse(req.body.status);
    const result = await query(
      "UPDATE alpenwild_trips_tbl SET trips_status=$1 WHERE trips_id=$2 RETURNING trips_id AS id, trips_status AS status",
      [status, req.params.id],
    );
    if (!result.rowCount)
      return res.status(404).json({ message: "Trip not found." });
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/trips/:id/dates/:dateId", async (req, res, next) => {
  try {
    const result = await query(
      `DELETE FROM alpenwild_trips_date_tbl
       WHERE trips_date_id=$1 AND trips_id=$2
       RETURNING trips_date_id AS id`,
      [req.params.dateId, req.params.id],
    );
    if (!result.rowCount)
      return res.status(404).json({ message: "Trip date not found." });
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/trips/:id/dates/:dateId/status", async (req, res, next) => {
  try {
    const status = z
      .enum(["Active", "Inactive", "Sold Out"])
      .parse(req.body.status);
    const result = await query(
      `UPDATE alpenwild_trips_date_tbl
       SET trips_date_status=$1
       WHERE trips_date_id=$2 AND trips_id=$3
       RETURNING trips_date_id AS id, trips_date_status AS status`,
      [status, req.params.dateId, req.params.id],
    );
    if (!result.rowCount)
      return res.status(404).json({ message: "Trip date not found." });
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/trips/:id", async (req, res, next) => {
  try {
    const result = await query(
      "DELETE FROM alpenwild_trips_tbl WHERE trips_id=$1 RETURNING trips_id",
      [req.params.id],
    );
    if (!result.rowCount)
      return res.status(404).json({ message: "Trip not found." });
    await query("DELETE FROM alpenwild_trips_activity_tbl WHERE trips_id=$1", [
      req.params.id,
    ]);
    await query("DELETE FROM alpenwild_trips_date_tbl WHERE trips_id=$1", [
      req.params.id,
    ]);
    await query("DELETE FROM alpenwild_trips_box_image_tbl WHERE trips_id=$1", [
      req.params.id,
    ]);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

const tripGallerySelect = `SELECT g.trips_gallery_id AS id,
  g.trips_id AS trip_id, t.trips_name AS trip_name,
  g.trips_gallery_image AS image, g.youtube_video_url AS video_url,
  g.trips_gallery_image_alt AS image_alt, g.trips_gallery_order AS display_order,
  g.display_in_static_page, g.display_in_trip_page, g.trips_gallery_status AS status
  FROM alpenwild_trips_gallery_tbl g
  LEFT JOIN alpenwild_trips_tbl t ON t.trips_id = g.trips_id`;

function tripGalleryImageUrl(filename) {
  return filename
    ? `/uploads/${config.tripUploadSubdir}/gallery/${encodeURIComponent(filename)}`
    : null;
}

function serializeTripGallery(row) {
  return { ...row, image_url: tripGalleryImageUrl(row.image) };
}

const tripGallerySchema = z.object({
  trip_id: z.coerce.number().int().positive(),
  video_url: z.string().trim().max(1000).default(""),
  image_alt: z.string().trim().max(255).default(""),
  display_order: z.coerce.number().int().min(1),
  display_in_static_page: z
    .preprocess(
      (value) =>
        value === true || value === "true" || value === "1" || value === 1,
      z.boolean(),
    )
    .default(false),
  display_in_trip_page: z
    .preprocess(
      (value) =>
        value === true || value === "true" || value === "1" || value === 1,
      z.boolean(),
    )
    .default(false),
  status: z.enum(["Active", "Inactive"]).default("Active"),
});

async function insertTripGallery(values) {
  const insertQuery = `INSERT INTO alpenwild_trips_gallery_tbl
    (trips_id, trips_gallery_image, youtube_video_url, trips_gallery_image_alt,
     trips_gallery_order, display_in_static_page, display_in_trip_page, trips_gallery_status)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING trips_gallery_id`;
  try {
    return await query(insertQuery, values);
  } catch (error) {
    if (
      error.code !== "23505" ||
      error.constraint !== "alpenwild_trips_gallery_tbl_pkey"
    )
      throw error;

    await query(
      "SELECT setval($$alpenwild_trips_gallery_id_seq$$, GREATEST(COALESCE((SELECT MAX(trips_gallery_id) FROM alpenwild_trips_gallery_tbl), 0) + 1, (SELECT last_value FROM alpenwild_trips_gallery_id_seq) + 1), false)",
    );
    return query(insertQuery, values);
  }
}

app.get("/api/trip-galleries", async (_req, res, next) => {
  try {
    const result = await query(
      `${tripGallerySelect} ORDER BY g.trips_gallery_order, g.trips_gallery_id`,
    );
    res.json(result.rows.map(serializeTripGallery));
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/trip-galleries",
  tripGalleryUpload.single("image"),
  async (req, res, next) => {
    try {
      const data = tripGallerySchema.parse(req.body);
      if (!req.file && !data.video_url)
        return res
          .status(400)
          .json({ message: "An image or YouTube URL is required." });
      const image = req.file ? safeFilename(req.file, "gallery") : "";
      if (req.file)
        await fs.rename(
          req.file.path,
          path.join(config.tripGalleryUploadDir, image),
        );
      const result = await insertTripGallery([
        data.trip_id,
        image,
        data.video_url,
        data.image_alt,
        data.display_order,
        data.display_in_static_page ? 1 : 0,
        data.display_in_trip_page ? 1 : 0,
        data.status,
      ]);
      const row = await query(
        `${tripGallerySelect} WHERE g.trips_gallery_id=$1`,
        [result.rows[0].trips_gallery_id],
      );
      res.status(201).json(serializeTripGallery(row.rows[0]));
    } catch (error) {
      next(error);
    }
  },
);

app.patch(
  "/api/trip-galleries/:id",
  tripGalleryUpload.single("image"),
  async (req, res, next) => {
    try {
      const data = tripGallerySchema.parse(req.body);
      const current = await query(
        "SELECT trips_gallery_image FROM alpenwild_trips_gallery_tbl WHERE trips_gallery_id=$1",
        [req.params.id],
      );
      if (!current.rowCount)
        return res.status(404).json({ message: "Gallery item not found." });
      const image = req.file
        ? safeFilename(req.file, "gallery")
        : current.rows[0].trips_gallery_image;
      if (!image && !data.video_url)
        return res
          .status(400)
          .json({ message: "An image or YouTube URL is required." });
      if (req.file)
        await fs.rename(
          req.file.path,
          path.join(config.tripGalleryUploadDir, image),
        );
      await query(
        `UPDATE alpenwild_trips_gallery_tbl SET trips_id=$1, trips_gallery_image=$2,
      youtube_video_url=$3, trips_gallery_image_alt=$4, trips_gallery_order=$5,
      display_in_static_page=$6, display_in_trip_page=$7, trips_gallery_status=$8
      WHERE trips_gallery_id=$9`,
        [
          data.trip_id,
          image,
          data.video_url,
          data.image_alt,
          data.display_order,
          data.display_in_static_page ? 1 : 0,
          data.display_in_trip_page ? 1 : 0,
          data.status,
          req.params.id,
        ],
      );
      const row = await query(
        `${tripGallerySelect} WHERE g.trips_gallery_id=$1`,
        [req.params.id],
      );
      res.json(serializeTripGallery(row.rows[0]));
    } catch (error) {
      next(error);
    }
  },
);

app.patch("/api/trip-galleries/:id/status", async (req, res, next) => {
  try {
    const status = z.enum(["Active", "Inactive"]).parse(req.body.status);
    const result = await query(
      "UPDATE alpenwild_trips_gallery_tbl SET trips_gallery_status=$1 WHERE trips_gallery_id=$2 RETURNING trips_gallery_id AS id, trips_gallery_status AS status",
      [status, req.params.id],
    );
    if (!result.rowCount)
      return res.status(404).json({ message: "Gallery item not found." });
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/trip-galleries/:id", async (req, res, next) => {
  try {
    const result = await query(
      "DELETE FROM alpenwild_trips_gallery_tbl WHERE trips_gallery_id=$1 RETURNING trips_gallery_id",
      [req.params.id],
    );
    if (!result.rowCount)
      return res.status(404).json({ message: "Gallery item not found." });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

const tripLeaderSelect = `SELECT trip_leader_id AS id,
  trip_leader_name AS name, trip_leader_guide_name AS guide_name,
  trip_leader_slug AS slug, trip_leader_meta_title AS meta_title,
  trip_leader_meta_description AS meta_description,
  trip_leader_meta_keywords AS meta_keywords,
  trip_leader_short_descriptions AS short_descriptions,
  trip_leader_type AS type, trip_leader_listing_image AS listing_image,
  trip_leader_order AS display_order, trip_leader_status AS status,
  trip_leader_alps_hiking_author AS alps_hiking_author,
  trip_leader_switzerlandtravel_author AS switzerlandtravel_author,
  trip_leader_myswisskitchennew_author AS myswisskitchennew_author
  FROM alpenwild_trip_leader_tbl`;

function tripLeaderImageUrl(filename) {
  return filename
    ? `/uploads/${config.tripLeaderUploadSubdir}/${encodeURIComponent(filename)}`
    : null;
}

async function tripLeaderDescriptions(id) {
  const result = await query(
    `SELECT description_id AS id,
    description_image, image_ratio, image_proportion, image_width, image_height,
    description_image_align AS image_align,
    description_image_caption AS caption,
    description_image_alt AS image_alt,
    text_wrap, new_description_text AS text, new_description_order AS display_order
    FROM alpenwild_trip_leader_description_tbl WHERE trip_leader_id=$1
    ORDER BY new_description_order, description_id`,
    [id],
  );
  return result.rows.map((row) => ({
    ...row,
    image_url: row.description_image
      ? `/uploads/${config.tripLeaderUploadSubdir}/description/${encodeURIComponent(row.description_image)}`
      : null,
  }));
}

async function serializeTripLeader(row) {
  return {
    ...row,
    listing_image_url: tripLeaderImageUrl(row.listing_image),
    description_blocks: await tripLeaderDescriptions(row.id),
  };
}

app.get("/api/trip-leader-authors", requireAuth, async (_req, res) => {
  if (tripLeaderAuthors.isPartiallyConfigured())
    return res.status(503).json({
      message:
        "Trip-leader author database settings are incomplete. Configure the MySQL host, username, and password.",
    });

  if (!tripLeaderAuthors.isConfigured())
    return res.json({
      configured: false,
      authors: {
        alpsHiking: [],
        switzerlandTravel: [],
        mySwissKitchen: [],
      },
    });

  try {
    res.json({
      configured: true,
      authors: await tripLeaderAuthors.load(),
    });
  } catch (error) {
    console.error("Unable to load trip-leader authors from MySQL.", error);
    res.status(502).json({
      message:
        "Unable to load trip-leader authors. Check the MySQL host, credentials, database names for access data.",
    });
  }
});

function parseDescriptionBlocks(value) {
  if (!value) return [];
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  return z
    .array(
      z.object({
        image: z.string().max(255).default(""),
        text: z.string().max(30000).default(""),
        display_order: z.coerce.number().int().min(0).default(0),
        image_alt: z.string().max(255).default(""),
        caption: z.string().max(255).default(""),
        image_ratio: z.string().max(50).default(""),
        image_proportion: z.enum(["lock", "unlock"]).default("unlock"),
        image_width: z.coerce.number().int().min(0).default(0),
        image_height: z.coerce.number().int().min(0).default(0),
        image_align: z
          .enum(["", "none", "left", "right", "center"])
          .default(""),
        text_wrap: z.enum(["yes", "no"]).default("yes"),
      }),
    )
    .parse(parsed);
}

async function saveTripLeaderDescriptions(id, blocks, files = []) {
  await query(
    "DELETE FROM alpenwild_trip_leader_description_tbl WHERE trip_leader_id=$1",
    [id],
  );
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    const uploaded = uploadedFile(files, `description_image_${index}`);
    let image = block.image || "";
    if (uploaded) {
      image = safeFilename(uploaded, "leader-description");
      await fs.rename(
        uploaded.path,
        path.join(config.tripLeaderDescriptionUploadDir, image),
      );
    }
    await query(
      `INSERT INTO alpenwild_trip_leader_description_tbl
      (trip_leader_id, description_image, image_ratio, image_proportion,
       image_width, image_height, description_image_align, description_image_caption,
       description_image_alt, text_wrap, new_description_text, new_description_order)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        id,
        image,
        block.image_ratio,
        block.image_proportion,
        block.image_width,
        block.image_height,
        block.image_align,
        block.caption,
        block.image_alt,
        block.text_wrap,
        block.text,
        block.display_order,
      ],
    );
  }
}

app.get("/api/trip-leaders", async (_req, res, next) => {
  try {
    const result = await query(
      `${tripLeaderSelect} ORDER BY trip_leader_order, trip_leader_id`,
    );
    res.json(await Promise.all(result.rows.map(serializeTripLeader)));
  } catch (error) {
    next(error);
  }
});

app.get("/api/public-trip-leaders", async (_req, res, next) => {
  try {
    const result = await query(
      `${tripLeaderSelect} WHERE trip_leader_status='Active'
       ORDER BY trip_leader_order ASC, trip_leader_id ASC`,
    );
    res.json(await Promise.all(result.rows.map(serializeTripLeader)));
  } catch (error) {
    next(error);
  }
});

app.get("/api/public-trip-leaders/:slug", async (req, res, next) => {
  try {
    const result = await query(
      `${tripLeaderSelect} WHERE trip_leader_slug=$1 AND trip_leader_status='Active' LIMIT 1`,
      [req.params.slug],
    );
    if (!result.rowCount)
      return res.status(404).json({ message: "Trip leader not found." });
    res.json(await serializeTripLeader(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/trip-leaders/:id/order", async (req, res, next) => {
  try {
    const displayOrder = z.coerce.number().int().parse(req.body.display_order);
    const result = await query(
      "UPDATE alpenwild_trip_leader_tbl SET trip_leader_order=$1 WHERE trip_leader_id=$2 RETURNING trip_leader_id AS id, trip_leader_order AS display_order",
      [displayOrder, req.params.id],
    );
    if (!result.rowCount)
      return res.status(404).json({ message: "Trip leader not found." });
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/trip-leaders",
  tripLeaderUpload.any(),
  async (req, res, next) => {
    try {
      const data = tripLeaderSchema.parse(req.body);
      const duplicate = await query(
        `SELECT 1 FROM alpenwild_trip_leader_tbl
         WHERE LOWER(trip_leader_name)=LOWER($1) LIMIT 1`,
        [data.name],
      );
      if (duplicate.rowCount)
        return res.status(409).json({
          message: "Sorry, name is already added. Please use another name.",
        });
      const listingFile = uploadedFile(req.files, "listing_image");
      if (!listingFile)
        return res
          .status(400)
          .json({ message: "Leader listing image is required." });
      const listingImage = safeFilename(listingFile, "leader");
      await fs.rename(
        listingFile.path,
        path.join(config.tripLeaderUploadDir, listingImage),
      );
      const blocks = parseDescriptionBlocks(data.description_blocks);
      await query(
        `UPDATE alpenwild_trip_leader_tbl
         SET trip_leader_order=trip_leader_order+1
         WHERE trip_leader_order >= $1`,
        [data.display_order],
      );
      const result = await query(
        `INSERT INTO alpenwild_trip_leader_tbl
      (trip_leader_name, trip_leader_guide_name, trip_leader_slug,
       trip_leader_meta_title, trip_leader_meta_description, trip_leader_meta_keywords,
       trip_leader_short_descriptions, trip_leader_type, trip_leader_listing_image,
       trip_leader_order, trip_leader_alps_hiking_author,
       trip_leader_switzerlandtravel_author, trip_leader_myswisskitchennew_author,
       trip_leader_status, trip_leader_created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,CURRENT_DATE)
      RETURNING trip_leader_id AS id`,
        [
          data.name,
          data.guide_name,
          slugify(data.name),
          data.meta_title,
          data.meta_description,
          data.meta_keywords,
          data.short_descriptions,
          data.type,
          listingImage,
          data.display_order,
          data.alps_hiking_author,
          data.switzerlandtravel_author,
          data.myswisskitchennew_author,
          data.status,
        ],
      );
      await saveTripLeaderDescriptions(result.rows[0].id, blocks, req.files);
      const row = await query(`${tripLeaderSelect} WHERE trip_leader_id=$1`, [
        result.rows[0].id,
      ]);
      res.status(201).json(await serializeTripLeader(row.rows[0]));
    } catch (error) {
      next(error);
    }
  },
);

app.patch(
  "/api/trip-leaders/:id",
  tripLeaderUpload.any(),
  async (req, res, next) => {
    try {
      const data = tripLeaderSchema.parse(req.body);
      const current = await query(
        `SELECT trip_leader_listing_image, trip_leader_order
         FROM alpenwild_trip_leader_tbl WHERE trip_leader_id=$1`,
        [req.params.id],
      );
      if (!current.rowCount)
        return res.status(404).json({ message: "Trip leader not found." });
      const duplicate = await query(
        `SELECT 1 FROM alpenwild_trip_leader_tbl
         WHERE LOWER(trip_leader_name)=LOWER($1) AND trip_leader_id<>$2
         LIMIT 1`,
        [data.name, req.params.id],
      );
      if (duplicate.rowCount)
        return res.status(409).json({
          message: "Sorry, name is already added. Please use another name.",
        });
      const listingFile = uploadedFile(req.files, "listing_image");
      const listingImage = listingFile
        ? safeFilename(listingFile, "leader")
        : current.rows[0].trip_leader_listing_image;
      if (listingFile)
        await fs.rename(
          listingFile.path,
          path.join(config.tripLeaderUploadDir, listingImage),
        );
      const oldOrder = Number(current.rows[0].trip_leader_order);
      if (data.display_order < oldOrder) {
        await query(
          `UPDATE alpenwild_trip_leader_tbl
           SET trip_leader_order=trip_leader_order+1
           WHERE trip_leader_order >= $1 AND trip_leader_order < $2
             AND trip_leader_id<>$3`,
          [data.display_order, oldOrder, req.params.id],
        );
      } else if (data.display_order > oldOrder) {
        await query(
          `UPDATE alpenwild_trip_leader_tbl
           SET trip_leader_order=trip_leader_order-1
           WHERE trip_leader_order > $1 AND trip_leader_order <= $2
             AND trip_leader_id<>$3`,
          [oldOrder, data.display_order, req.params.id],
        );
      }
      await query(
        `UPDATE alpenwild_trip_leader_tbl SET trip_leader_name=$1,
      trip_leader_guide_name=$2, trip_leader_slug=$3, trip_leader_meta_title=$4,
      trip_leader_meta_description=$5, trip_leader_meta_keywords=$6,
      trip_leader_short_descriptions=$7, trip_leader_type=$8,
      trip_leader_listing_image=$9, trip_leader_order=$10,
      trip_leader_alps_hiking_author=$11, trip_leader_switzerlandtravel_author=$12,
      trip_leader_myswisskitchennew_author=$13, trip_leader_status=$14
      WHERE trip_leader_id=$15`,
        [
          data.name,
          data.guide_name,
          slugify(data.name),
          data.meta_title,
          data.meta_description,
          data.meta_keywords,
          data.short_descriptions,
          data.type,
          listingImage,
          data.display_order,
          data.alps_hiking_author,
          data.switzerlandtravel_author,
          data.myswisskitchennew_author,
          data.status,
          req.params.id,
        ],
      );
      await saveTripLeaderDescriptions(
        req.params.id,
        parseDescriptionBlocks(data.description_blocks),
        req.files,
      );
      const row = await query(`${tripLeaderSelect} WHERE trip_leader_id=$1`, [
        req.params.id,
      ]);
      res.json(await serializeTripLeader(row.rows[0]));
    } catch (error) {
      next(error);
    }
  },
);

app.patch("/api/trip-leaders/:id/status", async (req, res, next) => {
  try {
    const status = z.enum(["Active", "Inactive"]).parse(req.body.status);
    const result = await query(
      "UPDATE alpenwild_trip_leader_tbl SET trip_leader_status=$1 WHERE trip_leader_id=$2 RETURNING trip_leader_id AS id, trip_leader_status AS status",
      [status, req.params.id],
    );
    if (!result.rowCount)
      return res.status(404).json({ message: "Trip leader not found." });
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/trip-leaders/:id", async (req, res, next) => {
  try {
    const result = await query(
      "DELETE FROM alpenwild_trip_leader_tbl WHERE trip_leader_id=$1 RETURNING trip_leader_id",
      [req.params.id],
    );
    if (!result.rowCount)
      return res.status(404).json({ message: "Trip leader not found." });
    await query(
      "DELETE FROM alpenwild_trip_leader_description_tbl WHERE trip_leader_id=$1",
      [req.params.id],
    );
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get("/api/trips/:id/itinerary", async (req, res, next) => {
  try {
    const result = await query(
      `SELECT trips_itinerary_id AS id,
      trips_itinerary_day AS day, trips_itinerary_title AS title,
      trips_itinerary_description AS description
      FROM alpenwild_trips_itinerary_tbl WHERE trips_id=$1
      ORDER BY trips_itinerary_day`,
      [req.params.id],
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.put("/api/trips/:id/itinerary", async (req, res, next) => {
  try {
    const entries = z.array(itinerarySchema).parse(req.body.entries || []);
    const trip = await query(
      "SELECT trips_id FROM alpenwild_trips_tbl WHERE trips_id=$1",
      [req.params.id],
    );
    if (!trip.rowCount)
      return res.status(404).json({ message: "Trip not found." });
    await query("DELETE FROM alpenwild_trips_itinerary_tbl WHERE trips_id=$1", [
      req.params.id,
    ]);
    for (const entry of entries) {
      await query(
        `INSERT INTO alpenwild_trips_itinerary_tbl
        (trips_id,trips_itinerary_day,trips_itinerary_title,trips_itinerary_description)
        VALUES ($1,$2,$3,$4)`,
        [req.params.id, entry.day, entry.title, entry.description],
      );
    }
    res.json(entries);
  } catch (error) {
    next(error);
  }
});

function testimonialSelect() {
  return useLegacyTestimonials()
    ? `SELECT testimonial_id AS id, trips_id AS trip_id,
        testimonial_client_details AS client_details,
        testimonial_content AS content, testimonial_order AS display_order,
        testimonial_status AS status
       FROM alpenwild_testimonial_tbl`
    : `SELECT id, trip_id, client_details, content, display_order, status
       FROM testimonials`;
}

function testimonialTableName() {
  return useLegacyTestimonials() ? "alpenwild_testimonial_tbl" : "testimonials";
}

function testimonialIdColumn() {
  return useLegacyTestimonials() ? "testimonial_id" : "id";
}

function testimonialOrderColumn() {
  return useLegacyTestimonials() ? "testimonial_order" : "display_order";
}

async function shiftTestimonialOrders(order, direction, bounds = {}) {
  const table = testimonialTableName();
  const orderColumn = testimonialOrderColumn();
  const conditions =
    direction === "up"
      ? `${orderColumn} >= $1${bounds.before ? ` AND ${orderColumn} < $2` : ""}`
      : `${orderColumn} > $1${bounds.through ? ` AND ${orderColumn} <= $2` : ""}`;
  const values =
    bounds.before || bounds.through ? [order, bounds.bound] : [order];
  await query(
    `UPDATE ${table} SET ${orderColumn} = ${orderColumn} ${direction === "up" ? "+" : "-"} 1 WHERE ${conditions}`,
    values,
  );
}

app.get("/api/testimonials", async (_req, res, next) => {
  try {
    const result = await query(
      `${testimonialSelect()} ORDER BY display_order ASC, id ASC`,
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.post("/api/testimonials", async (req, res, next) => {
  try {
    const data = testimonialSchema.parse(req.body);

    await shiftTestimonialOrders(data.display_order, "up");
    const result = useLegacyTestimonials()
      ? await query(
          `INSERT INTO alpenwild_testimonial_tbl
             (trips_id, testimonial_client_details, testimonial_content,
              testimonial_order, testimonial_status)
           VALUES ($1,$2,$3,$4,$5)
           RETURNING testimonial_id AS id, trips_id AS trip_id,
             testimonial_client_details AS client_details,
             testimonial_content AS content, testimonial_order AS display_order,
             testimonial_status AS status`,
          [
            data.trip_id || 0,
            data.client_details,
            data.content,
            data.display_order,
            data.status,
          ],
        )
      : await query(
          `INSERT INTO testimonials
             (trip_id, client_details, content, display_order, status)
           VALUES ($1,$2,$3,$4,$5) RETURNING id, trip_id, client_details,
             content, display_order, status`,
          [
            data.trip_id,
            data.client_details,
            data.content,
            data.display_order,
            data.status,
          ],
        );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/testimonials/:id", async (req, res, next) => {
  try {
    const data = testimonialSchema.parse(req.body);

    const idColumn = testimonialIdColumn();
    const current = await query(
      `SELECT ${testimonialOrderColumn()} AS display_order FROM ${testimonialTableName()} WHERE ${idColumn}=$1`,
      [req.params.id],
    );
    if (!current.rowCount)
      return res.status(404).json({ message: "Testimonial not found." });
    const oldOrder = Number(current.rows[0].display_order);
    if (data.display_order < oldOrder) {
      await shiftTestimonialOrders(data.display_order, "up", {
        before: true,
        bound: oldOrder,
      });
    } else if (data.display_order > oldOrder) {
      await shiftTestimonialOrders(oldOrder, "down", {
        through: true,
        bound: data.display_order,
      });
    }
    const result = useLegacyTestimonials()
      ? await query(
          `UPDATE alpenwild_testimonial_tbl
           SET trips_id=$1, testimonial_client_details=$2,
             testimonial_content=$3, testimonial_order=$4,
             testimonial_status=$5
           WHERE testimonial_id=$6
           RETURNING testimonial_id AS id, trips_id AS trip_id,
             testimonial_client_details AS client_details,
             testimonial_content AS content, testimonial_order AS display_order,
             testimonial_status AS status`,
          [
            data.trip_id || 0,
            data.client_details,
            data.content,
            data.display_order,
            data.status,
            req.params.id,
          ],
        )
      : await query(
          `UPDATE testimonials SET trip_id=$1, client_details=$2, content=$3,
             display_order=$4, status=$5, updated_at=NOW()
           WHERE id=$6 RETURNING id, trip_id, client_details, content,
             display_order, status`,
          [
            data.trip_id,
            data.client_details,
            data.content,
            data.display_order,
            data.status,
            req.params.id,
          ],
        );
    if (!result.rowCount)
      return res.status(404).json({ message: "Testimonial not found." });
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/testimonials/:id/status", async (req, res, next) => {
  try {
    const status = z.enum(["Active", "Inactive"]).parse(req.body.status);

    const result = useLegacyTestimonials()
      ? await query(
          `UPDATE alpenwild_testimonial_tbl SET testimonial_status=$1
           WHERE testimonial_id=$2
           RETURNING testimonial_id AS id, trips_id AS trip_id,
             testimonial_client_details AS client_details,
             testimonial_content AS content, testimonial_order AS display_order,
             testimonial_status AS status`,
          [status, req.params.id],
        )
      : await query(
          `UPDATE testimonials SET status=$1, updated_at=NOW() WHERE id=$2
           RETURNING id, trip_id, client_details, content, display_order, status`,
          [status, req.params.id],
        );
    if (!result.rowCount)
      return res.status(404).json({ message: "Testimonial not found." });
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/testimonials/:id", async (req, res, next) => {
  try {
    const idColumn = testimonialIdColumn();
    const orderColumn = testimonialOrderColumn();
    const result = await query(
      `DELETE FROM ${testimonialTableName()} WHERE ${idColumn}=$1 RETURNING ${orderColumn} AS display_order`,
      [req.params.id],
    );
    if (!result.rowCount)
      return res
        .status(404)
        .json({ message: "Nothing is deleted successfully" });
    await query(
      `UPDATE ${testimonialTableName()} SET ${orderColumn}=${orderColumn}-1 WHERE ${orderColumn} > $1`,
      [result.rows[0].display_order],
    );
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.post("/api/banners", upload.single("image"), async (req, res, next) => {
  try {
    const data = bannerSchema.parse(req.body);
    if (!req.file)
      return res.status(400).json({ message: "Banner image is required." });
    const filename = `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    await fs.rename(req.file.path, path.join(config.bannerUploadDir, filename));

    const result = useLegacyBanners()
      ? await query(
          `INSERT INTO alpenwild_banner_tbl (banner_title, banner_sub_heading, banner_tooltip_text, banner_link, banner_image, banner_alt, button_label, button_link, banner_order, banner_status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING banner_id AS id, banner_title AS title, banner_sub_heading AS sub_heading, banner_tooltip_text AS tooltip_text, banner_link AS link, banner_image AS image_filename, banner_alt AS image_alt, button_label, button_link, banner_order AS display_order, banner_status AS status`,
          [
            data.title,
            data.sub_heading,
            data.tooltip_text,
            data.link,
            filename,
            data.image_alt,
            data.button_label,
            data.button_link,
            data.display_order,
            data.status,
          ],
        )
      : await query(
          `INSERT INTO banners (title, sub_heading, tooltip_text, link, image_filename, image_alt, button_label, button_link, display_order, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
          [
            data.title,
            data.sub_heading,
            data.tooltip_text,
            data.link,
            filename,
            data.image_alt,
            data.button_label,
            data.button_link,
            data.display_order,
            data.status,
          ],
        );
    res.status(201).json(serializeBanner(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

app.patch(
  "/api/banners/:id",
  upload.single("image"),
  async (req, res, next) => {
    try {
      const data = bannerSchema.parse(req.body);
      let currentImage = null;

      const current = useLegacyBanners()
        ? await query(
            "SELECT banner_image AS image FROM alpenwild_banner_tbl WHERE banner_id=$1",
            [req.params.id],
          )
        : await query(
            "SELECT image_filename AS image FROM banners WHERE id=$1",
            [req.params.id],
          );
      if (!current.rowCount)
        return res.status(404).json({ message: "Banner not found." });
      currentImage = current.rows[0].image;

      if (!req.file && !currentImage)
        return res.status(400).json({ message: "Banner image is required." });

      let filename = null;
      if (req.file) {
        filename = `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        await fs.rename(
          req.file.path,
          path.join(config.bannerUploadDir, filename),
        );
      }

      const result = useLegacyBanners()
        ? await query(
            `UPDATE alpenwild_banner_tbl
           SET banner_title = $1, banner_sub_heading = $2, banner_tooltip_text = $3,
               banner_link = $4, banner_image = COALESCE($5, banner_image),
               banner_alt = $6, button_label = $7, button_link = $8,
               banner_order = $9, banner_status = $10
           WHERE banner_id = $11
           RETURNING banner_id AS id, banner_title AS title, banner_sub_heading AS sub_heading,
               banner_tooltip_text AS tooltip_text, banner_link AS link, banner_image AS image_filename,
               banner_alt AS image_alt, button_label, button_link, banner_order AS display_order,
               banner_status AS status`,
            [
              data.title,
              data.sub_heading,
              data.tooltip_text,
              data.link,
              filename,
              data.image_alt,
              data.button_label,
              data.button_link,
              data.display_order,
              data.status,
              req.params.id,
            ],
          )
        : await query(
            `UPDATE banners
           SET title = $1, sub_heading = $2, tooltip_text = $3, link = $4,
               image_filename = COALESCE($5, image_filename), image_alt = $6,
               button_label = $7, button_link = $8, display_order = $9,
               status = $10, updated_at = NOW()
           WHERE id = $11
           RETURNING *`,
            [
              data.title,
              data.sub_heading,
              data.tooltip_text,
              data.link,
              filename,
              data.image_alt,
              data.button_label,
              data.button_link,
              data.display_order,
              data.status,
              req.params.id,
            ],
          );

      if (!result.rowCount)
        return res.status(404).json({ message: "Banner not found." });
      res.json(serializeBanner(result.rows[0]));
    } catch (error) {
      next(error);
    }
  },
);

app.patch("/api/banners/:id/status", async (req, res, next) => {
  try {
    const status = z.enum(["Active", "Inactive"]).parse(req.body.status);

    const result = useLegacyBanners()
      ? await query(
          `UPDATE alpenwild_banner_tbl SET banner_status = $1 WHERE banner_id = $2 RETURNING banner_id AS id, banner_title AS title, banner_sub_heading AS sub_heading, banner_tooltip_text AS tooltip_text, banner_link AS link, banner_image AS image_filename, banner_alt AS image_alt, button_label, button_link, banner_order AS display_order, banner_status AS status`,
          [status, req.params.id],
        )
      : await query(
          "UPDATE banners SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
          [status, req.params.id],
        );
    if (!result.rowCount)
      return res.status(404).json({ message: "Banner not found." });
    res.json(serializeBanner(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/banners/:id", async (req, res, next) => {
  try {
    const result = useLegacyBanners()
      ? await query(
          "DELETE FROM alpenwild_banner_tbl WHERE banner_id = $1 RETURNING banner_image AS image_filename",
          [req.params.id],
        )
      : await query(
          "DELETE FROM banners WHERE id = $1 RETURNING image_filename",
          [req.params.id],
        );
    if (!result.rowCount)
      return res.status(404).json({ message: "Banner not found." });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

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

function redirectionSelect() {
  return useLegacyRedirections()
    ? `SELECT redirection_id AS id, old_redirection_url, new_redirection_url
       FROM alpenwild_redirection_tbl`
    : `SELECT id, old_redirection_url, new_redirection_url
       FROM redirections`;
}

function redirectionColumns() {
  return useLegacyRedirections()
    ? {
        table: "alpenwild_redirection_tbl",
        id: "redirection_id",
      }
    : { table: "redirections", id: "id" };
}

app.get("/api/redirections", async (_req, res, next) => {
  try {
    const result = await query(`${redirectionSelect()} ORDER BY id ASC`);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.post("/api/redirections", async (req, res, next) => {
  try {
    const data = redirectionSchema.parse(req.body);
    const columns = redirectionColumns();
    const duplicate = await query(
      `SELECT 1 FROM ${columns.table}
       WHERE LOWER(old_redirection_url) = LOWER($1) LIMIT 1`,
      [data.old_redirection_url],
    );
    if (duplicate.rowCount)
      return res
        .status(409)
        .json({ message: "Old URL is already added. Please use another URL." });
    const result = useLegacyRedirections()
      ? await query(
          `INSERT INTO alpenwild_redirection_tbl
           (old_redirection_url, new_redirection_url)
           VALUES ($1, $2)
           RETURNING redirection_id AS id, old_redirection_url,
             new_redirection_url`,
          [data.old_redirection_url, data.new_redirection_url],
        )
      : await query(
          `INSERT INTO redirections
           (old_redirection_url, new_redirection_url)
           VALUES ($1, $2) RETURNING id, old_redirection_url,
             new_redirection_url`,
          [data.old_redirection_url, data.new_redirection_url],
        );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/redirections/:id", async (req, res, next) => {
  try {
    const data = redirectionSchema.parse(req.body);
    const columns = redirectionColumns();
    const duplicate = await query(
      `SELECT 1 FROM ${columns.table}
       WHERE LOWER(old_redirection_url) = LOWER($1)
         AND ${columns.id} <> $2 LIMIT 1`,
      [data.old_redirection_url, req.params.id],
    );
    if (duplicate.rowCount)
      return res
        .status(409)
        .json({ message: "Old URL is already added. Please use another URL." });
    const result = useLegacyRedirections()
      ? await query(
          `UPDATE alpenwild_redirection_tbl
           SET old_redirection_url=$1, new_redirection_url=$2
           WHERE redirection_id=$3
           RETURNING redirection_id AS id, old_redirection_url,
             new_redirection_url`,
          [data.old_redirection_url, data.new_redirection_url, req.params.id],
        )
      : await query(
          `UPDATE redirections
           SET old_redirection_url=$1, new_redirection_url=$2, updated_at=NOW()
           WHERE id=$3
           RETURNING id, old_redirection_url, new_redirection_url`,
          [data.old_redirection_url, data.new_redirection_url, req.params.id],
        );
    if (!result.rowCount)
      return res.status(404).json({ message: "Redirection not found." });
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/redirections/:id", async (req, res, next) => {
  try {
    const columns = redirectionColumns();
    const result = await query(
      `DELETE FROM ${columns.table} WHERE ${columns.id}=$1 RETURNING ${columns.id}`,
      [req.params.id],
    );
    if (!result.rowCount)
      return res.status(404).json({ message: "Redirection not found." });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get("/api/static-pages", async (_req, res, next) => {
  try {
    const result = await query(
      `${staticPageSelect()} ORDER BY parent_id ASC, display_order ASC, id ASC`,
    );
    const pages = await Promise.all(
      result.rows.map(async (row) => ({
        ...serializeStaticPage(row),
        box_images: await staticPageBoxImages(row.id),
        description_blocks: await staticPageDescriptionBlocks(row.id),
      })),
    );
    res.json(pages);
  } catch (error) {
    next(error);
  }
});

app.get("/api/public-static-pages", async (_req, res, next) => {
  try {
    const statusColumn = useLegacyStaticPages()
      ? "static_page_status"
      : "status";
    const result = await query(
      `${staticPageSelect()} WHERE ${statusColumn}='Active' ORDER BY parent_id ASC, display_order ASC, id ASC`,
    );
    res.json(result.rows.map(serializeStaticPage));
  } catch (error) {
    next(error);
  }
});

app.get("/api/public-navigation", async (_req, res, next) => {
  try {
    const statusColumn = useLegacyStaticPages()
      ? "static_page_status"
      : "status";
    const menuColumn = useLegacyStaticPages()
      ? "static_page_menu_assign"
      : "menu_assign";
    const pageResult = await query(
      `${staticPageSelect()} WHERE ${statusColumn}='Active' AND ${menuColumn}='Self In Header' ORDER BY display_order ASC, id ASC`,
    );
    const hasTripPlaceholder = pageResult.rows.some(
      (page) => String(page.parent_id) === "7",
    );
    let tripTypes = [];
    let trips = [];

    if (hasTripPlaceholder) {
      const tripTypeResult = useLegacyTripTypes()
        ? await query(
            `SELECT trip_type_id AS id, trip_type_slug AS slug,
              trip_type_menu_name AS menu_name, trip_type_order AS display_order,
              trip_type_status AS status
             FROM alpenwild_trip_type_tbl
             WHERE trip_type_status='Active'
             ORDER BY trip_type_order ASC, trip_type_id ASC`,
          )
        : await query(
            `SELECT id, slug, menu_name, display_order, status
             FROM trip_types WHERE status='Active'
             ORDER BY display_order ASC, id ASC`,
          );
      const tripResult = useLegacyTrips()
        ? await query(
            `SELECT trips_id AS id, trips_type_id AS type_id,
              trips_slug AS slug, trips_menu_name AS menu_name,
              trips_order AS display_order, trips_status AS status
             FROM alpenwild_trips_tbl
             WHERE trips_status='Active'
             ORDER BY trips_order ASC, trips_id ASC`,
          )
        : await query(
            `SELECT id, type_id, slug, menu_name, display_order, status
             FROM trips WHERE status='Active'
             ORDER BY display_order ASC, id ASC`,
          );
      tripTypes = tripTypeResult.rows;
      trips = tripResult.rows;
    }

    res.json(buildPublicNavigation(pageResult.rows, tripTypes, trips));
  } catch (error) {
    next(error);
  }
});

app.get("/api/public-static-pages/:slug", async (req, res, next) => {
  try {
    const slugColumn = useLegacyStaticPages() ? "static_page_slug" : "slug";
    const statusColumn = useLegacyStaticPages()
      ? "static_page_status"
      : "status";
    const result = await query(
      `${staticPageSelect()} WHERE ${slugColumn}=$1 AND ${statusColumn}='Active' LIMIT 1`,
      [req.params.slug],
    );
    if (!result.rowCount)
      return res.status(404).json({ message: "Page not found." });
    res.json({
      ...serializeStaticPage(result.rows[0]),
      box_images: await staticPageBoxImages(result.rows[0].id),
      description_blocks: await staticPageDescriptionBlocks(result.rows[0].id),
    });
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/static-pages",
  staticPageUpload.any(),
  async (req, res, next) => {
    try {
      const data = staticPageSchema.parse(req.body);
      const boxes = parseStaticPageBoxes(req.body.box_images);
      const descriptionBlocks =
        data.description_type === "new_description"
          ? parseStaticPageDescriptionBlocks(req.body.description_blocks)
          : [];
      const columns = staticPageColumns();
      const duplicate = await query(
        `SELECT 1 FROM ${columns.table} WHERE LOWER(${columns.name}) = LOWER($1) LIMIT 1`,
        [data.name],
      );
      if (duplicate.rowCount)
        return res.status(409).json({
          message: "Sorry, name is already added. Please use another name.",
        });
      const banner = uploadedFile(req.files, "banner_image");
      const filename = banner ? safeFilename(banner, "static-page") : "";
      if (banner)
        await fs.rename(
          banner.path,
          path.join(config.staticPageUploadDir, filename),
        );
      const slug = slugify(data.slug || data.name);
      await shiftStaticPageOrders(data.parent_id, data.display_order, "up");
      const result = useLegacyStaticPages()
        ? await query(
            `INSERT INTO alpenwild_static_page_tbl
             (static_page_display_as_page, static_page_parent_id, static_page_name,
              static_page_slug, static_page_menu_name, static_page_menu_assign,
              static_page_social_sharing_display, static_page_meta_title,
              static_page_meta_descriptions, static_page_meta_keywords,
              static_page_description, static_page_banner_title,
              static_page_banner_sub_title, static_page_tooltip_text,
              static_page_description_type, static_page_banner, static_page_order,
              static_page_status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
             RETURNING ${staticPageSelect()
               .replace(/^SELECT /, "")
               .replace(/ FROM alpenwild_static_page_tbl$/, "")}`,
            [
              data.display_as_page,
              data.parent_id,
              data.name,
              slug,
              data.menu_name,
              data.menu_assign,
              data.social_sharing_display,
              data.meta_title,
              data.meta_descriptions,
              data.meta_keywords,
              data.description,
              data.banner_title,
              data.banner_sub_title,
              data.tooltip_text,
              data.description_type,
              filename,
              data.display_order,
              data.status,
            ],
          )
        : await query(
            `INSERT INTO static_pages
             (display_as_page,parent_id,name,slug,menu_name,menu_assign,social_sharing_display,
              meta_title,meta_descriptions,meta_keywords,description,banner_title,banner_sub_title,
              tooltip_text,description_type,banner_image,display_order,status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
             RETURNING *`,
            [
              data.display_as_page,
              data.parent_id,
              data.name,
              slug,
              data.menu_name,
              data.menu_assign,
              data.social_sharing_display,
              data.meta_title,
              data.meta_descriptions,
              data.meta_keywords,
              data.description,
              data.banner_title,
              data.banner_sub_title,
              data.tooltip_text,
              data.description_type,
              filename,
              data.display_order,
              data.status,
            ],
          );
      const pageId = result.rows[0].id;
      await saveStaticPageBoxes(
        pageId,
        boxes,
        req.files,
        req.body.box_images !== undefined,
      );
      if (data.description_type === "new_description")
        await saveStaticPageDescriptionBlocks(
          pageId,
          descriptionBlocks,
          req.files,
        );
      res.status(201).json({
        ...serializeStaticPage(result.rows[0]),
        box_images: await staticPageBoxImages(pageId),
        description_blocks: await staticPageDescriptionBlocks(pageId),
      });
    } catch (error) {
      next(error);
    }
  },
);

app.patch(
  "/api/static-pages/:id",
  staticPageUpload.any(),
  async (req, res, next) => {
    try {
      const data = staticPageSchema.parse(req.body);
      const boxes = parseStaticPageBoxes(req.body.box_images);
      const descriptionBlocks =
        data.description_type === "new_description"
          ? parseStaticPageDescriptionBlocks(req.body.description_blocks)
          : [];
      const columns = staticPageColumns();
      const duplicate = await query(
        `SELECT 1 FROM ${columns.table} WHERE LOWER(${columns.name}) = LOWER($1) AND ${columns.id} <> $2 LIMIT 1`,
        [data.name, req.params.id],
      );
      if (duplicate.rowCount)
        return res.status(409).json({
          message: "Sorry, name is already added. Please use another name.",
        });
      const currentResult = await query(
        `${staticPageSelect()} WHERE ${columns.id} = $1`,
        [req.params.id],
      );
      if (!currentResult.rowCount)
        return res.status(404).json({ message: "Static page not found." });
      const current = currentResult.rows[0];
      const banner = uploadedFile(req.files, "banner_image");
      const filename = banner ? safeFilename(banner, "static-page") : null;
      if (banner)
        await fs.rename(
          banner.path,
          path.join(config.staticPageUploadDir, filename),
        );
      if (current.parent_id === data.parent_id) {
        if (data.display_order < current.display_order)
          await query(
            `UPDATE ${columns.table} SET ${columns.order}=${columns.order}+1
             WHERE ${columns.parent}=$1 AND ${columns.order}>=$2 AND ${columns.order}<$3 AND ${columns.id}<>$4`,
            [
              data.parent_id,
              data.display_order,
              current.display_order,
              req.params.id,
            ],
          );
        else if (data.display_order > current.display_order)
          await query(
            `UPDATE ${columns.table} SET ${columns.order}=${columns.order}-1
             WHERE ${columns.parent}=$1 AND ${columns.order}>$2 AND ${columns.order}<=$3 AND ${columns.id}<>$4`,
            [
              data.parent_id,
              current.display_order,
              data.display_order,
              req.params.id,
            ],
          );
      } else {
        await query(
          `UPDATE ${columns.table} SET ${columns.order}=${columns.order}-1
           WHERE ${columns.parent}=$1 AND ${columns.order}>$2 AND ${columns.id}<>$3`,
          [current.parent_id, current.display_order, req.params.id],
        );
        await shiftStaticPageOrders(
          data.parent_id,
          data.display_order,
          "up",
          req.params.id,
        );
      }
      const values = [
        data.display_as_page,
        data.parent_id,
        data.name,
        slugify(data.slug || data.name),
        data.menu_name,
        data.menu_assign,
        data.social_sharing_display,
        data.meta_title,
        data.meta_descriptions,
        data.meta_keywords,
        data.description,
        data.banner_title,
        data.banner_sub_title,
        data.tooltip_text,
        data.description_type,
        filename,
        data.display_order,
        data.status,
        req.params.id,
      ];
      const result = useLegacyStaticPages()
        ? await query(
            `UPDATE alpenwild_static_page_tbl SET static_page_display_as_page=$1,
             static_page_parent_id=$2,static_page_name=$3,static_page_slug=$4,
             static_page_menu_name=$5,static_page_menu_assign=$6,
             static_page_social_sharing_display=$7,static_page_meta_title=$8,
             static_page_meta_descriptions=$9,static_page_meta_keywords=$10,
             static_page_description=$11,static_page_banner_title=$12,
             static_page_banner_sub_title=$13,static_page_tooltip_text=$14,
             static_page_description_type=$15,static_page_banner=COALESCE($16,static_page_banner),
             static_page_order=$17,static_page_status=$18 WHERE static_page_id=$19
             RETURNING ${staticPageSelect()
               .replace(/^SELECT /, "")
               .replace(/ FROM alpenwild_static_page_tbl$/, "")}`,
            values,
          )
        : await query(
            `UPDATE static_pages SET display_as_page=$1,parent_id=$2,name=$3,slug=$4,
             menu_name=$5,menu_assign=$6,social_sharing_display=$7,meta_title=$8,
             meta_descriptions=$9,meta_keywords=$10,description=$11,banner_title=$12,
             banner_sub_title=$13,tooltip_text=$14,description_type=$15,
             banner_image=COALESCE($16,banner_image),display_order=$17,status=$18,
             updated_at=NOW() WHERE id=$19 RETURNING *`,
            values,
          );
      await saveStaticPageBoxes(
        req.params.id,
        boxes,
        req.files,
        req.body.box_images !== undefined,
      );
      if (data.description_type === "new_description")
        await saveStaticPageDescriptionBlocks(
          req.params.id,
          descriptionBlocks,
          req.files,
        );
      res.json({
        ...serializeStaticPage(result.rows[0]),
        box_images: await staticPageBoxImages(req.params.id),
        description_blocks: await staticPageDescriptionBlocks(req.params.id),
      });
    } catch (error) {
      next(error);
    }
  },
);

app.patch("/api/static-pages/:id/status", async (req, res, next) => {
  try {
    const status = z.enum(["Active", "Inactive"]).parse(req.body.status);
    const columns = staticPageColumns();
    const result = await query(
      `UPDATE ${columns.table} SET ${useLegacyStaticPages() ? "static_page_status" : "status"}=$1
       WHERE ${columns.id}=$2 RETURNING ${staticPageSelect()
         .replace(/^SELECT /, "")
         .replace(/ FROM (alpenwild_static_page_tbl|static_pages)$/, "")}`,
      [status, req.params.id],
    );
    if (!result.rowCount)
      return res.status(404).json({ message: "Static page not found." });
    res.json(serializeStaticPage(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/static-pages/:id", async (req, res, next) => {
  try {
    const columns = staticPageColumns();
    const existing = await query(
      `${staticPageSelect()} WHERE ${columns.id}=$1`,
      [req.params.id],
    );
    if (!existing.rowCount)
      return res.status(404).json({ message: "Static page not found." });
    const children = await query(
      `SELECT 1 FROM ${columns.table} WHERE ${columns.parent}=$1 LIMIT 1`,
      [req.params.id],
    );
    if (children.rowCount)
      return res.status(409).json({
        message:
          "Child page existing under this static page. First delete child page and then delete this static page.",
      });
    const result = await query(
      `DELETE FROM ${columns.table} WHERE ${columns.id}=$1 RETURNING ${columns.id}`,
      [req.params.id],
    );
    await query(
      `UPDATE ${columns.table} SET ${columns.order}=${columns.order}-1
       WHERE ${columns.parent}=$1 AND ${columns.order}>$2`,
      [existing.rows[0].parent_id, existing.rows[0].display_order],
    );
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

function categorySelect() {
  return `SELECT category_id AS id, category_parent_id AS parent_id,
    category_name AS name, category_slug AS slug,
    category_menu_name AS menu_name, category_meta_title AS meta_title,
    category_meta_keywords AS meta_keywords,
    category_meta_descriptions AS meta_descriptions,
    category_description AS description, category_banner AS banner_image,
    category_banner_title AS banner_title,
    category_banner_sub_title AS banner_sub_title,
    category_tooltip_text AS tooltip_text,
    category_listing_image AS listing_image,
    category_order AS display_order, category_status AS status
    FROM alpenwild_category_tbl`;
}

app.get("/api/categories", async (_req, res, next) => {
  try {
    const result = await query(
      `${categorySelect()} ORDER BY display_order ASC, id ASC`,
    );
    const boxes = await categoryBoxImagesFor(result.rows.map((row) => row.id));
    res.json(
      result.rows.map((row) =>
        serializeCategory({ ...row, box_images: boxes.get(row.id) || [] }),
      ),
    );
  } catch (error) {
    next(error);
  }
});

app.get("/api/public-categories", async (_req, res, next) => {
  try {
    const result = await query(
      `${categorySelect()} WHERE category_status='Active' ORDER BY category_order ASC, category_id ASC`,
    );
    const boxes = await categoryBoxImagesFor(result.rows.map((row) => row.id));
    res.json(
      result.rows.map((row) => ({
        ...serializeCategory({
          ...row,
          box_images: boxes.get(row.id) || [],
        }),
        listing_thumbnail_url: row.listing_image
          ? `/api/public-category-images/listing/${encodeURIComponent(row.listing_image)}`
          : null,
      })),
    );
  } catch (error) {
    next(error);
  }
});

const categoryListingThumbnailJobs = new Map();

app.get(
  "/api/public-category-images/listing/:filename",
  async (req, res, next) => {
    const { filename } = req.params;
    if (
      !filename ||
      /[\\/]/.test(filename) ||
      !/\.(?:jpe?g|png|webp|gif)$/i.test(filename)
    ) {
      return res.status(400).json({ message: "Invalid category image." });
    }

    try {
      const sourcePath = path.join(config.categoryListingUploadDir, filename);
      let sourceStats;
      try {
        sourceStats = await fs.stat(sourcePath);
      } catch (error) {
        if (error.code === "ENOENT")
          return res.status(404).json({ message: "Category image not found." });
        throw error;
      }
      if (!sourceStats.isFile())
        return res.status(404).json({ message: "Category image not found." });

      const cacheKey = crypto
        .createHash("sha256")
        .update(
          `${filename}:${sourceStats.size}:${sourceStats.mtimeMs}:${sourceStats.ctimeMs}`,
        )
        .digest("hex");
      const etag = `"${cacheKey}"`;
      res.set("Cache-Control", "no-cache");
      res.set("ETag", etag);
      if (req.get("If-None-Match") === etag) return res.status(304).end();

      const cacheDirectory = path.join(
        config.uploadDir,
        ".thumbnail-cache",
        "category-listing",
      );
      const thumbnailPath = path.join(cacheDirectory, `${cacheKey}.jpg`);
      let thumbnailJob = categoryListingThumbnailJobs.get(cacheKey);
      if (!thumbnailJob) {
        thumbnailJob = (async () => {
          await fs.mkdir(cacheDirectory, { recursive: true });
          try {
            return await fs.readFile(thumbnailPath);
          } catch (error) {
            if (error.code !== "ENOENT") throw error;
          }

          const thumbnail = await sharp(sourcePath)
            .resize(270, 183, { fit: "cover", position: "centre" })
            .jpeg({ quality: 90 })
            .toBuffer();
          await fs.writeFile(thumbnailPath, thumbnail);
          return thumbnail;
        })();
        categoryListingThumbnailJobs.set(cacheKey, thumbnailJob);
      }

      try {
        const thumbnail = await thumbnailJob;
        return res.type("image/jpeg").send(thumbnail);
      } finally {
        if (categoryListingThumbnailJobs.get(cacheKey) === thumbnailJob)
          categoryListingThumbnailJobs.delete(cacheKey);
      }
    } catch (error) {
      next(error);
    }
  },
);

app.get("/api/public-categories/:slug", async (req, res, next) => {
  try {
    const categoryResult = await query(
      `${categorySelect()} WHERE category_slug=$1 AND category_status='Active' LIMIT 1`,
      [req.params.slug],
    );
    if (!categoryResult.rowCount)
      return res.status(404).json({ message: "Category not found." });

    const category = categoryResult.rows[0];
    const productResult = await query(
      `${productSelect()} WHERE p.category_id=$1 AND p.product_status='Active'
       ORDER BY p.product_order ASC, p.product_id ASC`,
      [category.id],
    );
    const products = productResult.rows.map((product) => ({
      ...product,
      listing_image_url: product.listing_image
        ? `/uploads/${config.productUploadSubdir}/listing/${encodeURIComponent(product.listing_image)}`
        : "",
    }));
    const boxes = await categoryBoxImagesFor([category.id]);
    res.json({
      ...serializeCategory({
        ...category,
        box_images: boxes.get(category.id) || [],
      }),
      products,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/public-products/:slug", async (req, res, next) => {
  try {
    const result = await query(
      `${productSelect()}
        WHERE p.product_slug=$1 AND p.product_status='Active'
        LIMIT 1`,
      [req.params.slug],
    );
    const product = result.rows[0];
    if (!product)
      return res.status(404).json({ message: "Product not found." });
    const [images, attributes, boxes] = await Promise.all([
      query(
        `SELECT additional_image AS image
           FROM alpenwild_product_additional_image_tbl
          WHERE product_id=$1 AND additional_image<>''
          ORDER BY product_additional_image_id`,
        [product.id],
      ),
      query(
        `SELECT t.attribute_type_id AS type_id,
                t.attribute_type_name AS type_name,
                v.attribute_value_id AS value_id,
                v.attribute_value AS value,
                v.attribute_value_order AS display_order
           FROM alpenwild_product_attribute_value_tbl pv
           JOIN alpenwild_attribute_type_tbl t
             ON t.attribute_type_id=pv.attribute_type_id
           JOIN alpenwild_attribute_value_tbl v
             ON v.attribute_value_id=pv.attribute_value_id
          WHERE pv.product_id=$1
            AND COALESCE(pv.product_attribute_value_status,'Active')='Active'
            AND t.attribute_type_status='Active'
            AND v.attribute_value_status='Active'
          ORDER BY t.attribute_type_id, v.attribute_value_order, v.attribute_value_id`,
        [product.id],
      ),
      query(
        `SELECT product_box_image AS image,
                product_box_image_image_alt AS image_alt,
                product_box_image_title AS title,
                product_box_image_link AS link
           FROM alpenwild_product_box_image_tbl
          WHERE product_id=$1
          ORDER BY product_box_image_id`,
        [product.id],
      ),
    ]);
    const attributeTypes = new Map();
    for (const row of attributes.rows) {
      const type = attributeTypes.get(row.type_id) || {
        id: row.type_id,
        name: row.type_name,
        values: [],
      };
      type.values.push({ id: row.value_id, value: row.value });
      attributeTypes.set(row.type_id, type);
    }
    res.json({
      ...product,
      listing_image_url: product.listing_image
        ? `/uploads/${config.productUploadSubdir}/listing/${encodeURIComponent(product.listing_image)}`
        : "",
      banner_image_url: product.banner_image
        ? `/uploads/${config.productUploadSubdir}/banner/${encodeURIComponent(product.banner_image)}`
        : "",
      additional_images: images.rows.map(({ image }) => ({
        image,
        image_url: `/uploads/${config.productUploadSubdir}/additional/${encodeURIComponent(image)}`,
      })),
      box_images: boxes.rows.map((box) => ({
        ...box,
        image_url: box.image
          ? `/uploads/${config.productUploadSubdir}/boximage/${encodeURIComponent(box.image)}`
          : "",
      })),
      attribute_types: [...attributeTypes.values()],
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/categories", categoryUpload.any(), async (req, res, next) => {
  try {
    const parsedData = categorySchema.parse(req.body);
    const data = { ...parsedData, slug: slugifyCategoryName(parsedData.name) };
    const boxImages = parseCategoryBoxImages(req.body.box_images);
    const duplicate = await query(
      `SELECT 1 FROM alpenwild_category_tbl
         WHERE LOWER(category_name)=LOWER($1) LIMIT 1`,
      [data.name],
    );
    if (duplicate.rowCount)
      return res.status(409).json({
        message: "Sorry, name is already added. Please use another name.",
      });
    const bannerFile = uploadedFile(req.files, "banner_image");
    const listingFile = uploadedFile(req.files, "listing_image");
    if (!listingFile)
      return res.status(400).json({ message: "Listing image is required." });
    const bannerFilename = bannerFile
      ? safeFilename(bannerFile, "category-banner")
      : null;
    const listingFilename = safeFilename(listingFile, "category-listing");
    if (bannerFile)
      await fs.rename(
        bannerFile.path,
        path.join(config.categoryBannerUploadDir, bannerFilename),
      );
    await fs.rename(
      listingFile.path,
      path.join(config.categoryListingUploadDir, listingFilename),
    );
    await query(
      `UPDATE alpenwild_category_tbl
         SET category_order=category_order+1 WHERE category_order >= $1`,
      [data.display_order],
    );
    const result = await query(
      `INSERT INTO alpenwild_category_tbl
       (category_parent_id,category_name,category_slug,category_menu_name,
        category_meta_title,category_meta_keywords,category_meta_descriptions,
        category_description,category_banner,category_banner_title,
        category_banner_sub_title,category_tooltip_text,category_listing_image,
        category_order,category_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING ${categorySelect()
         .replace(/^SELECT /, "")
         .replace(/ FROM alpenwild_category_tbl$/, "")}`,
      [
        data.parent_id,
        data.name,
        data.slug || slugify(data.name),
        data.menu_name,
        data.meta_title,
        data.meta_keywords,
        data.meta_descriptions,
        data.description,
        bannerFilename,
        data.banner_title,
        data.banner_sub_title,
        data.tooltip_text,
        listingFilename,
        data.display_order,
        data.status,
      ],
    );
    await addCategoryBoxImages(result.rows[0].id, boxImages, req.files);
    res
      .status(201)
      .json(serializeCategory({ ...result.rows[0], box_images: boxImages }));
  } catch (error) {
    next(error);
  }
});

app.patch(
  "/api/categories/:id",
  categoryUpload.any(),
  async (req, res, next) => {
    try {
      const parsedData = categorySchema.parse(req.body);
      const data = {
        ...parsedData,
        slug: slugifyCategoryName(parsedData.name),
      };
      const boxImages = parseCategoryBoxImages(req.body.box_images);
      const duplicate = await query(
        `SELECT 1 FROM alpenwild_category_tbl
         WHERE LOWER(category_name)=LOWER($1) AND category_id<>$2 LIMIT 1`,
        [data.name, req.params.id],
      );
      if (duplicate.rowCount)
        return res.status(409).json({
          message: "Sorry, name is already added. Please use another name.",
        });
      const current = await query(
        "SELECT category_order FROM alpenwild_category_tbl WHERE category_id=$1",
        [req.params.id],
      );
      if (!current.rowCount)
        return res.status(404).json({ message: "Category not found." });
      const oldOrder = Number(current.rows[0].category_order);
      if (data.display_order < oldOrder) {
        await query(
          `UPDATE alpenwild_category_tbl SET category_order=category_order+1
           WHERE category_order >= $1 AND category_order < $2 AND category_id<>$3`,
          [data.display_order, oldOrder, req.params.id],
        );
      } else if (data.display_order > oldOrder) {
        await query(
          `UPDATE alpenwild_category_tbl SET category_order=category_order-1
           WHERE category_order > $1 AND category_order <= $2 AND category_id<>$3`,
          [oldOrder, data.display_order, req.params.id],
        );
      }
      const bannerFile = uploadedFile(req.files, "banner_image");
      const listingFile = uploadedFile(req.files, "listing_image");
      const bannerFilename = bannerFile
        ? safeFilename(bannerFile, "category-banner")
        : null;
      const listingFilename = listingFile
        ? safeFilename(listingFile, "category-listing")
        : null;
      if (bannerFile)
        await fs.rename(
          bannerFile.path,
          path.join(config.categoryBannerUploadDir, bannerFilename),
        );
      if (listingFile)
        await fs.rename(
          listingFile.path,
          path.join(config.categoryListingUploadDir, listingFilename),
        );
      const result = await query(
        `UPDATE alpenwild_category_tbl SET category_parent_id=$1, category_name=$2,
       category_slug=$3, category_menu_name=$4, category_meta_title=$5,
       category_meta_keywords=$6, category_meta_descriptions=$7,
       category_description=$8, category_banner=COALESCE($9,category_banner),
       category_banner_title=$10, category_banner_sub_title=$11,
       category_tooltip_text=$12, category_listing_image=COALESCE($13,category_listing_image),
       category_order=$14, category_status=$15 WHERE category_id=$16
       RETURNING category_id AS id, category_parent_id AS parent_id,
       category_name AS name, category_slug AS slug, category_menu_name AS menu_name,
       category_meta_title AS meta_title, category_meta_keywords AS meta_keywords,
       category_meta_descriptions AS meta_descriptions, category_description AS description,
       category_banner AS banner_image, category_banner_title AS banner_title,
       category_banner_sub_title AS banner_sub_title, category_tooltip_text AS tooltip_text,
       category_listing_image AS listing_image, category_order AS display_order,
       category_status AS status`,
        [
          data.parent_id,
          data.name,
          data.slug || slugify(data.name),
          data.menu_name,
          data.meta_title,
          data.meta_keywords,
          data.meta_descriptions,
          data.description,
          bannerFilename,
          data.banner_title,
          data.banner_sub_title,
          data.tooltip_text,
          listingFilename,
          data.display_order,
          data.status,
          req.params.id,
        ],
      );
      if (!result.rowCount)
        return res.status(404).json({ message: "Category not found." });
      await addCategoryBoxImages(req.params.id, boxImages, req.files);
      res.json(serializeCategory({ ...result.rows[0], box_images: boxImages }));
    } catch (error) {
      next(error);
    }
  },
);

app.patch("/api/categories/:id/status", async (req, res, next) => {
  try {
    const status = z.enum(["Active", "Inactive"]).parse(req.body.status);
    const result = await query(
      `UPDATE alpenwild_category_tbl SET category_status=$1 WHERE category_id=$2 RETURNING ${categorySelect()
        .replace(/^SELECT /, "")
        .replace(/ FROM alpenwild_category_tbl$/, "")}`,
      [status, req.params.id],
    );
    if (!result.rowCount)
      return res.status(404).json({ message: "Category not found." });
    res.json(serializeCategory(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/categories/:id", async (req, res, next) => {
  try {
    const productTable = useLegacyProducts()
      ? "alpenwild_product_tbl"
      : "products";
    const inUse = await query(
      `SELECT 1 FROM ${productTable} WHERE category_id=$1 LIMIT 1`,
      [req.params.id],
    );
    if (inUse.rowCount)
      return res.status(409).json({
        message:
          "Product existing under this category. First delete product and then delete this category.",
      });
    const result = await query(
      "DELETE FROM alpenwild_category_tbl WHERE category_id=$1 RETURNING category_id",
      [req.params.id],
    );
    if (!result.rowCount)
      return res.status(404).json({ message: "Category not found." });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

function serializeInvoice(row) {
  const names = String(row.product_name || "").split(",");
  const prices = String(row.product_price || "").split(",");
  const quantities = String(row.party_number || "").split(",");
  return {
    id: row.invoice_id,
    first_name: row.first_name || "",
    last_name: row.last_name || "",
    user_email_address: row.user_email_address || "",
    day_phone: row.day_phone || "",
    street_address: row.street_address || "",
    street_address1: row.street_address1 || "",
    postal_code: row.postal_code || "",
    city: row.city || "",
    country: row.country || "",
    state: row.state || "",
    product_name: names.join(", "),
    product_price: prices.join(", "),
    party_number: quantities.join(", "),
    items: names.map((name, index) => ({
      name,
      price: Number(prices[index] || 0),
      quantity: Number(quantities[index] || 1),
    })),
    deposit_amount: Number(row.deposit_amount || 0),
    due_amount: Number(row.due_amount || 0),
    invoice_date: row.invoice_date,
    due_date: row.due_date,
    email_subject: "Alpenwild Deposit Confirmation",
    email_message:
      "Just to confirm, we have sent you an invoice for #product_name#.",
  };
}

function invoiceValues(data) {
  const total = data.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  return [
    data.first_name,
    data.last_name,
    data.user_email_address,
    data.day_phone,
    data.street_address,
    data.street_address1,
    data.postal_code,
    data.city,
    data.country,
    data.state,
    data.items.map((item) => item.name).join(","),
    data.items.map((item) => item.price).join(","),
    data.deposit_amount,
    data.items.map((item) => item.quantity).join(","),
    data.due_date,
    data.invoice_date,
    total - data.deposit_amount,
    new Date(),
  ];
}

app.get("/api/users", async (_req, res, next) => {
  try {
    const result = await query(
      `${userSelect()} ORDER BY ${useLegacyUsers() ? "user_id" : "id"} ASC`,
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.post("/api/users", async (req, res, next) => {
  try {
    const data = userSchema.parse(req.body);
    const duplicate = useLegacyUsers()
      ? await query(
          "SELECT user_id FROM alpenwild_user_tbl WHERE LOWER(user_email_address)=LOWER($1) LIMIT 1",
          [data.user_email_address],
        )
      : await query(
          "SELECT id FROM users WHERE LOWER(email_address)=LOWER($1) LIMIT 1",
          [data.user_email_address],
        );
    if (duplicate.rowCount)
      return res.status(409).json({
        message: "Sorry, email is already added. Please use another email.",
      });
    const inserted = await userInsert(data);
    const result = await query(userSelectById(), [inserted.rows[0].id]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/users/:id", async (req, res, next) => {
  try {
    const data = userSchema.parse(req.body);
    const duplicate = useLegacyUsers()
      ? await query(
          "SELECT user_id FROM alpenwild_user_tbl WHERE LOWER(user_email_address)=LOWER($1) AND user_id<>$2 LIMIT 1",
          [data.user_email_address, req.params.id],
        )
      : await query(
          "SELECT id FROM users WHERE LOWER(email_address)=LOWER($1) AND id<>$2 LIMIT 1",
          [data.user_email_address, req.params.id],
        );
    if (duplicate.rowCount)
      return res.status(409).json({
        message: "Sorry, email is already added. Please use another email.",
      });
    const updated = await userUpdate(data, req.params.id);
    if (!updated.rowCount)
      return res.status(404).json({ message: "User not found." });
    await userUpdateBookings(data, req.params.id);
    const result = await query(userSelectById(), [req.params.id]);
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/users/:id/status", async (req, res, next) => {
  try {
    const status = z.enum(["Active", "Inactive"]).parse(req.body.status);
    const result = useLegacyUsers()
      ? await query(
          `UPDATE alpenwild_user_tbl SET user_status=$1
           WHERE user_id=$2 RETURNING user_id AS id`,
          [status, req.params.id],
        )
      : await query(
          "UPDATE users SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING id",
          [status, req.params.id],
        );
    if (!result.rowCount)
      return res
        .status(404)
        .json({ message: "Nothing is deleted successfully" });
    const user = await query(userSelectById(), [req.params.id]);
    res.json(user.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/users/:id", async (req, res, next) => {
  try {
    if (await userHasOrders(req.params.id))
      return res.status(409).json({
        message:
          "Order existing under this user. First delete order and then delete this user.",
      });
    const result = useLegacyUsers()
      ? await query(
          "DELETE FROM alpenwild_user_tbl WHERE user_id=$1 RETURNING user_id",
          [req.params.id],
        )
      : await query("DELETE FROM users WHERE id=$1 RETURNING id", [
          req.params.id,
        ]);
    if (!result.rowCount)
      return res.status(404).json({ message: "User not found." });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

const mailingListSchema = z.object({
  first_name: z.string().trim().min(1).max(255),
  last_name: z.string().trim().min(1).max(255),
  email_address: z.string().trim().min(1).max(255),
  user_type: z.enum([
    "",
    "Prospect",
    "Friend",
    "Client",
    "Referral",
    "Trade",
    "Agent",
    "Media",
    "Employee",
  ]),
  newsletter_signup_option: z.string().max(1000).default(""),
});

const mailingListSelect = `SELECT mailing_list_id AS id, first_name, last_name,
  email_address, user_type, newsletter_signup_option, source_of_inquiry,
  TO_CHAR(date_of_inquiry, 'YYYY-MM-DD') AS date_of_inquiry
  FROM alpenwild_mailing_list_tbl`;

async function createMailingListEntry(data, sourceOfInquiry) {
  const duplicate = await query(
    "SELECT mailing_list_id FROM alpenwild_mailing_list_tbl WHERE LOWER(email_address)=LOWER($1) LIMIT 1",
    [data.email_address],
  );
  if (duplicate.rowCount) return null;
  const result = await query(
    `INSERT INTO alpenwild_mailing_list_tbl
    (first_name, last_name, email_address, newsletter_signup_option, user_type, source_of_inquiry, date_of_inquiry)
    VALUES ($1,$2,$3,$4,$5,$6,CURRENT_DATE)
    RETURNING mailing_list_id AS id`,
    [
      data.first_name,
      data.last_name,
      data.email_address,
      data.newsletter_signup_option,
      data.user_type,
      sourceOfInquiry,
    ],
  );
  const row = await query(`${mailingListSelect} WHERE mailing_list_id=$1`, [
    result.rows[0].id,
  ]);
  return row.rows[0];
}

app.get("/api/mailing-list", async (_req, res, next) => {
  try {
    const result = await query(
      `${mailingListSelect} WHERE mailing_list_id <> 0 ORDER BY date_of_inquiry DESC, mailing_list_id DESC`,
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.post("/api/mailing-list", async (req, res, next) => {
  try {
    const data = mailingListSchema.parse(req.body);
    const row = await createMailingListEntry(data, "Alpenwild Submitted ");
    if (!row)
      return res.status(409).json({
        message: "Sorry, email is already added. Please use another email.",
      });
    res.status(201).json(row);
  } catch (error) {
    next(error);
  }
});

const publicNewsletterSchema = z.object({
  first_name: z.string().trim().min(1).max(255),
  last_name: z.string().trim().min(1).max(255),
  email_address: z.string().trim().email().max(255),
  newsletter_signup_option: z.string().max(1000).default(""),
  recaptcha_token: z.string().max(5000).default(""),
  form_id: z.string().max(255).default(""),
});

app.post("/api/public/mailing-list", async (req, res, next) => {
  try {
    const data = publicNewsletterSchema.parse(req.body);
    if (data.form_id)
      return res
        .status(400)
        .json({ message: "Unable to process this request." });
    if (config.recaptchaEnabled && !config.recaptchaSecret)
      return res
        .status(503)
        .json({ message: "Newsletter signup is not configured." });
    if (
      config.recaptchaEnabled &&
      !(await verifyRecaptcha(data.recaptcha_token))
    )
      return res
        .status(400)
        .json({ message: "Robot verification failed, please try again." });
    const row = await createMailingListEntry(
      { ...data, user_type: "Prospect" },
      "Newsletter Signup",
    );
    if (!row)
      return res.status(409).json({
        message: "You have already subscribed to our database.",
      });
    res.status(201).json({
      message: "Thank you for subscribing to our email newsletter.",
    });
  } catch (error) {
    next(error);
  }
});

const callbackSchema = z.object({
  name: z.string().trim().min(1).max(255),
  email: z.string().trim().email().max(255),
  phone_number: z.string().trim().min(1).max(100),
  best_time: z.string().trim().min(1).max(255),
  question_comments: z.string().trim().min(1).max(5000),
  customer_name: z.string().max(255).default(""),
  recaptcha_token: z.string().max(5000).default(""),
});

app.post("/api/public/callback", async (req, res, next) => {
  try {
    const data = callbackSchema.parse(req.body);
    if (data.customer_name)
      return res
        .status(400)
        .json({ message: "Unable to process this request." });
    if (config.recaptchaEnabled && !config.recaptchaSecret)
      return res
        .status(503)
        .json({ message: "Callback requests are not configured." });
    if (
      config.recaptchaEnabled &&
      !(await verifyRecaptcha(data.recaptcha_token))
    )
      return res
        .status(400)
        .json({ message: "Robot verification failed, please try again." });
    if (!mailer)
      return res
        .status(503)
        .json({ message: "Callback requests are not configured." });
    const siteTitle = await getSiteTitle();
    await mailer.sendMail({
      from: {
        name: siteTitle,
        address: config.smtpFrom || config.smtpUser,
      },
      to: config.callbackRecipientEmail,
      replyTo: data.email,
      subject: `${siteTitle} Call Me Back`,
      html: buildCallMeBackEmailHtml(data),
      // text: [
      //   "Call Me Back",
      //   `First Name: ${data.name}`,
      //   `Email: ${data.email}`,
      //   `Phone Number: ${data.phone_number}`,
      //   `Best Time to Call: ${data.best_time}`,
      //   `Questions or Comments: ${data.question_comments}`,
      // ].join("\n"),
    });
    res.status(200).json({ message: "Thank you. We will call you back soon." });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/mailing-list/:id", async (req, res, next) => {
  try {
    const data = mailingListSchema.parse(req.body);
    const duplicate = await query(
      "SELECT mailing_list_id FROM alpenwild_mailing_list_tbl WHERE LOWER(email_address)=LOWER($1) AND mailing_list_id<>$2 LIMIT 1",
      [data.email_address, req.params.id],
    );
    if (duplicate.rowCount)
      return res.status(409).json({
        message: "Sorry, email is already added. Please use another email.",
      });
    const result = await query(
      `UPDATE alpenwild_mailing_list_tbl SET first_name=$1,last_name=$2,email_address=$3,newsletter_signup_option=$4,user_type=$5 WHERE mailing_list_id=$6 RETURNING mailing_list_id AS id`,
      [
        data.first_name,
        data.last_name,
        data.email_address,
        data.newsletter_signup_option,
        data.user_type,
        req.params.id,
      ],
    );
    if (!result.rowCount)
      return res.status(404).json({ message: "Mailing list user not found." });
    const row = await query(`${mailingListSelect} WHERE mailing_list_id=$1`, [
      req.params.id,
    ]);
    res.json(row.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/mailing-list/:id", async (req, res, next) => {
  try {
    const result = await query(
      "DELETE FROM alpenwild_mailing_list_tbl WHERE mailing_list_id=$1 RETURNING mailing_list_id",
      [req.params.id],
    );
    if (!result.rowCount)
      return res.status(404).json({ message: "Mailing list user not found." });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get("/api/mailing-list/download", async (_req, res, next) => {
  try {
    const result = await query(
      `${mailingListSelect} ORDER BY date_of_inquiry DESC, mailing_list_id DESC`,
    );
    const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const lines = [
      "First Name,Last Name,Email Address,User Type,Interests,Date Of Inquiry",
      ...result.rows.map((row) =>
        [
          row.first_name || "N/A",
          row.last_name || "N/A",
          row.email_address || "N/A",
          row.user_type || "N/A",
          row.newsletter_signup_option
            .replaceAll("<br>", "")
            .replaceAll("Interests – ", " - "),
          row.date_of_inquiry,
        ]
          .map(escape)
          .join(","),
      ),
    ];
    res
      .type("text/csv")
      .set("Content-Disposition", "attachment; filename=mailing_list.csv")
      .send(lines.join("\n"));
  } catch (error) {
    next(error);
  }
});

const contestSchema = z.object({
  display_in_home: z.enum(["Yes", "No"]).default("No"),
  contest_title: z.string().trim().min(1).max(255),
  contest_start_date: z.string().min(1),
  contest_end_date: z.string().min(1),
  contest_image_min_width: z.coerce.number().int(),
  contest_image_max_width: z.coerce.number().int(),
  contest_image_min_height: z.coerce.number().int(),
  contest_image_max_height: z.coerce.number().int(),
  contest_image_min_size: z.coerce.number().int(),
  contest_image_max_size: z.coerce.number().int(),
});

const contestSelect = `SELECT id, display_in_home, contest_title, contest_start_date,
  contest_end_date, contest_image_min_width, contest_image_max_width,
  contest_image_min_height, contest_image_max_height, contest_image_min_size,
  contest_image_max_size, contest_status AS status FROM alpenwild_contest_tbl`;

app.get("/api/public/contests", async (_req, res, next) => {
  try {
    const [contests, submissions, rules] = await Promise.all([
      query(
        `SELECT id, contest_title, contest_start_date, contest_end_date,
                contest_image_min_width, contest_image_max_width,
                contest_image_min_height, contest_image_max_height,
                contest_image_min_size, contest_image_max_size,
                (CURRENT_DATE BETWEEN contest_start_date AND contest_end_date) AS is_open
           FROM alpenwild_contest_tbl
          WHERE contest_status='Active'
          ORDER BY id DESC`,
      ),
      query(
        `SELECT s.submission_id AS id, s.contest_id, s.submission_image AS image,
                s.submission_image_title AS title,
                s.submission_image_description AS description,
                u.user_name
           FROM alpenwild_contest_submission s
           JOIN alpenwild_contest_users u ON u.user_id=s.user_id
           JOIN alpenwild_contest_tbl c ON c.id=s.contest_id
          WHERE s.submission_status='Approved' AND c.contest_status='Active'
          ORDER BY s.submission_id DESC`,
      ),
      query(
        `SELECT static_page_description AS rules
           FROM alpenwild_static_page_tbl WHERE static_page_id=3904`,
      ),
    ]);
    res.json({
      contests: contests.rows,
      submissions: submissions.rows.map((row) => ({
        ...row,
        image_url: `/uploads/${config.contestUploadSubdir}/${encodeURIComponent(row.image)}`,
      })),
      rules: rules.rows[0]?.rules || "",
    });
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/public/contest-submissions",
  contestSubmissionUpload.array("images", 10),
  async (req, res, next) => {
    const savedFiles = [];
    let client;
    try {
      const data = z
        .object({
          contest_id: z.coerce.number().int().positive(),
          first_name: z.string().trim().min(1).max(255),
          last_name: z.string().trim().min(1).max(255),
          email: z.string().trim().email().max(255),
          phone: z
            .string()
            .trim()
            .regex(/^\d{10}$/),
          address: z.string().trim().min(1).max(1000),
          city: z.string().trim().min(1).max(255),
          state: z.string().trim().min(1).max(255),
          zip: z.string().trim().min(1).max(40),
          entries: z
            .string()
            .transform((value, context) => {
              try {
                return JSON.parse(value);
              } catch {
                context.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: "Submission image details are invalid.",
                });
                return z.NEVER;
              }
            })
            .pipe(
              z
                .array(
                  z.object({
                    title: z.string().max(255).default(""),
                    description: z.string().max(10000).default(""),
                  }),
                )
                .min(1)
                .max(10),
            ),
          recaptcha_token: z.string().max(5000).default(""),
          agree: z.literal("true"),
        })
        .parse(req.body);
      const files = req.files || [];
      if (files.length !== data.entries.length)
        return res.status(400).json({
          message: "Please attach one image for each submission entry.",
        });
      if (config.recaptchaEnabled && !config.recaptchaSecret)
        return res
          .status(503)
          .json({ message: "Contest submissions are not configured." });
      if (
        config.recaptchaEnabled &&
        !(await verifyRecaptcha(data.recaptcha_token))
      )
        return res
          .status(400)
          .json({ message: "Robot verification failed, please try again." });

      const contestResult = await query(
        `SELECT id, contest_title, contest_image_min_width,
                contest_image_max_width, contest_image_min_height,
                contest_image_max_height, contest_image_max_size
           FROM alpenwild_contest_tbl
          WHERE id=$1 AND contest_status='Active'
            AND CURRENT_DATE BETWEEN contest_start_date AND contest_end_date`,
        [data.contest_id],
      );
      const contest = contestResult.rows[0];
      if (!contest)
        return res
          .status(400)
          .json({ message: "The selected contest is not currently open." });

      const preparedFiles = [];
      for (const [index, file] of files.entries()) {
        const metadata = await sharp(file.buffer).metadata();
        const allowedFormat = ["jpeg", "png", "gif"].includes(metadata.format);
        const withinDimensions =
          metadata.width >= contest.contest_image_min_width &&
          metadata.width <= contest.contest_image_max_width &&
          metadata.height >= contest.contest_image_min_height &&
          metadata.height <= contest.contest_image_max_height;
        const withinSize =
          file.size < Number(contest.contest_image_max_size) * 1_000_000;
        if (!allowedFormat || !withinDimensions || !withinSize)
          return res.status(400).json({
            message: `Image ${index + 1} must be a JPG, PNG, or GIF within the contest's image dimensions and file-size limits.`,
          });
        const extension = { jpeg: ".jpg", png: ".png", gif: ".gif" }[
          metadata.format
        ];
        preparedFiles.push({
          buffer: file.buffer,
          filename: `${crypto.randomUUID()}${extension}`,
        });
      }

      client = await pool.connect();
      await client.query("BEGIN");
      const contestant = await client.query(
        `INSERT INTO alpenwild_contest_users
          (contest_id,user_name,user_email,user_phone,user_address,user_city,
           user_state,user_zip,user_status,created_at,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Active',NOW(),NOW())
         RETURNING user_id`,
        [
          data.contest_id,
          `${data.first_name} ${data.last_name}`.trim(),
          data.email,
          data.phone,
          data.address,
          data.city,
          data.state,
          data.zip,
        ],
      );
      const userId = contestant.rows[0].user_id;
      for (const [index, file] of preparedFiles.entries()) {
        const insert = await client.query(
          `INSERT INTO alpenwild_contest_submission
            (user_id,contest_id,submission_image,submission_image_title,
             submission_image_description,submission_winner,
             submission_image_likes,submission_status,created_at,updated_at)
           VALUES ($1,$2,$3,$4,$5,'No',0,'Disapproved',NOW(),NOW())
           RETURNING submission_id`,
          [
            userId,
            data.contest_id,
            file.filename,
            data.entries[index].title,
            data.entries[index].description,
          ],
        );
        const filename = `${insert.rows[0].submission_id}_${file.filename}`;
        await fs.writeFile(
          path.join(config.contestUploadDir, filename),
          file.buffer,
          { flag: "wx" },
        );
        savedFiles.push(path.join(config.contestUploadDir, filename));
        await client.query(
          "UPDATE alpenwild_contest_submission SET submission_image=$1 WHERE submission_id=$2",
          [filename, insert.rows[0].submission_id],
        );
      }
      await client.query("COMMIT");
      client.release();
      client = null;

      if (mailer) {
        try {
          const emailTemplate = await query(
            `SELECT contest_submissions_user, contest_submissions_admin
               FROM alpenwild_contest_emails WHERE id=1`,
          );
          const siteTitle = await getSiteTitle();
          const contestantName = `${data.first_name} ${data.last_name}`.trim();
          const emailDetails = `<p>Contest: ${escapeHtml(contest.contest_title)}</p><p>Name: ${escapeHtml(contestantName)}<br>Email: ${escapeHtml(data.email)}<br>Phone: ${escapeHtml(data.phone)}</p>`;
          const from = {
            name: siteTitle,
            address: config.smtpFrom || config.smtpUser,
          };
          if (emailTemplate.rows[0]?.contest_submissions_user)
            await mailer.sendMail({
              from,
              to: data.email,
              subject: `${siteTitle} Contest Submission`,
              html: `Dear ${escapeHtml(contestantName)},<br>${emailTemplate.rows[0].contest_submissions_user}${emailDetails}`,
            });
          if (emailTemplate.rows[0]?.contest_submissions_admin)
            await mailer.sendMail({
              from,
              replyTo: data.email,
              to: config.smtpUser,
              subject: `${siteTitle} Contest Submission`,
              html: `Dear Admin,<br>${emailTemplate.rows[0].contest_submissions_admin}${emailDetails}`,
            });
        } catch (emailError) {
          console.error(
            "Contest submission saved, but notification email failed.",
            emailError,
          );
        }
      }
      res.status(201).json({
        message:
          "Thank you for joining the contest. Your entry will be visible as soon as it is approved.",
      });
    } catch (error) {
      if (client) {
        await client.query("ROLLBACK");
        client.release();
      }
      await Promise.all(
        savedFiles.map((filename) =>
          fs
            .rm(filename)
            .catch((cleanupError) =>
              console.error(
                "Unable to remove an uncommitted contest image.",
                cleanupError,
              ),
            ),
        ),
      );
      next(error);
    }
  },
);

app.get("/api/contests", async (_req, res, next) => {
  try {
    res.json((await query(`${contestSelect} ORDER BY id DESC`)).rows);
  } catch (error) {
    next(error);
  }
});
app.post("/api/contests", async (req, res, next) => {
  try {
    const data = contestSchema.parse(req.body);
    const result = await query(
      `INSERT INTO alpenwild_contest_tbl
      (display_in_home, contest_title, contest_start_date, contest_end_date,
       contest_image_min_width, contest_image_max_width, contest_image_min_height,
       contest_image_max_height, contest_image_min_size, contest_image_max_size,
       contest_status, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'Active',NOW(),NOW()) RETURNING id`,
      [
        data.display_in_home,
        data.contest_title,
        data.contest_start_date,
        data.contest_end_date,
        data.contest_image_min_width,
        data.contest_image_max_width,
        data.contest_image_min_height,
        data.contest_image_max_height,
        data.contest_image_min_size,
        data.contest_image_max_size,
      ],
    );
    res
      .status(201)
      .json(
        (await query(`${contestSelect} WHERE id=$1`, [result.rows[0].id]))
          .rows[0],
      );
  } catch (error) {
    next(error);
  }
});
app.patch("/api/contests/:id", async (req, res, next) => {
  try {
    const data = contestSchema.parse(req.body);
    const result = await query(
      `UPDATE alpenwild_contest_tbl SET display_in_home=$1,contest_title=$2,contest_start_date=$3,contest_end_date=$4,contest_image_min_width=$5,contest_image_max_width=$6,contest_image_min_height=$7,contest_image_max_height=$8,contest_image_min_size=$9,contest_image_max_size=$10,updated_at=NOW() WHERE id=$11 RETURNING id`,
      [
        data.display_in_home,
        data.contest_title,
        data.contest_start_date,
        data.contest_end_date,
        data.contest_image_min_width,
        data.contest_image_max_width,
        data.contest_image_min_height,
        data.contest_image_max_height,
        data.contest_image_min_size,
        data.contest_image_max_size,
        req.params.id,
      ],
    );
    if (!result.rowCount)
      return res.status(404).json({ message: "Contest not found." });
    res.json(
      (await query(`${contestSelect} WHERE id=$1`, [req.params.id])).rows[0],
    );
  } catch (error) {
    next(error);
  }
});
app.patch("/api/contests/:id/status", async (req, res, next) => {
  try {
    const status = z.enum(["Active", "Inactive"]).parse(req.body.status);
    const result = await query(
      "UPDATE alpenwild_contest_tbl SET contest_status=$1,updated_at=NOW() WHERE id=$2 RETURNING id",
      [status, req.params.id],
    );
    if (!result.rowCount)
      return res.status(404).json({ message: "Contest not found." });
    res.json({ id: result.rows[0].id, status });
  } catch (error) {
    next(error);
  }
});
app.delete("/api/contests/:id", async (req, res, next) => {
  try {
    const result = await query(
      "DELETE FROM alpenwild_contest_tbl WHERE id=$1 RETURNING id",
      [req.params.id],
    );
    if (!result.rowCount)
      return res.status(404).json({ message: "Contest not found." });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get("/api/contest-users", async (req, res, next) => {
  try {
    const filters = [];
    const values = [];
    let contestId;
    if (req.query.contest_id !== undefined) {
      contestId = z.coerce
        .number()
        .int()
        .positive()
        .parse(req.query.contest_id);
      values.push(contestId);
      filters.push(`contest_id=$${values.length}`);
    }
    const [users, count, contest] = await Promise.all([
      query(
        `SELECT user_id AS id,contest_id,user_name,user_email,user_phone,user_address,user_city,user_state,user_zip,user_status AS status FROM alpenwild_contest_users ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""} ORDER BY user_id DESC`,
        values,
      ),
      query("SELECT COUNT(*)::int AS total FROM alpenwild_contest_users"),
      contestId
        ? query("SELECT contest_title FROM alpenwild_contest_tbl WHERE id=$1", [
            contestId,
          ])
        : Promise.resolve({ rows: [] }),
    ]);
    res.json({
      rows: users.rows,
      totalEntries: count.rows[0].total,
      contestTitle: contest.rows[0]?.contest_title || "",
    });
  } catch (error) {
    next(error);
  }
});
app.get("/api/contest-users/:id", async (req, res, next) => {
  try {
    const result = await query(
      `SELECT user_id AS id,contest_id,user_name,user_email,user_phone,user_address,user_city,user_state,user_zip FROM alpenwild_contest_users WHERE user_id=$1`,
      [req.params.id],
    );
    if (!result.rowCount)
      return res.status(404).json({ message: "Contest user not found." });
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});
app.patch("/api/contest-users/:id/status", async (req, res, next) => {
  try {
    const status = z.enum(["Active", "Inactive"]).parse(req.body.status);
    const result = await query(
      "UPDATE alpenwild_contest_users SET user_status=$1,updated_at=NOW() WHERE user_id=$2 RETURNING user_id AS id",
      [status, req.params.id],
    );
    if (!result.rowCount)
      return res.status(404).json({ message: "Contest user not found." });
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});
app.delete("/api/contest-users/:id", async (req, res, next) => {
  try {
    await query("DELETE FROM alpenwild_contest_users WHERE user_id=$1", [
      req.params.id,
    ]);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get("/api/contest-submissions", async (req, res, next) => {
  try {
    const filters = [];
    const values = [];
    let userId;
    let contestId;
    for (const key of ["user_id", "contest_id"]) {
      if (req.query[key] !== undefined) {
        const id = z.coerce.number().int().positive().parse(req.query[key]);
        if (key === "user_id") userId = id;
        else contestId = id;
        values.push(id);
        filters.push(`s.${key}=$${values.length}`);
      }
    }
    const [submissions, context] = await Promise.all([
      query(
        `SELECT s.submission_id AS id,s.user_id,s.contest_id,s.submission_image,s.submission_image_title AS title,s.submission_image_description AS description,s.submission_winner AS winner_status,s.submission_status AS status,u.user_name,c.contest_title FROM alpenwild_contest_submission s LEFT JOIN alpenwild_contest_users u ON u.user_id=s.user_id LEFT JOIN alpenwild_contest_tbl c ON c.id=s.contest_id ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""} ORDER BY s.submission_id DESC`,
        values,
      ),
      userId && contestId
        ? query(
            `SELECT u.user_name,c.contest_title FROM alpenwild_contest_users u JOIN alpenwild_contest_tbl c ON c.id=$2 WHERE u.user_id=$1`,
            [userId, contestId],
          )
        : Promise.resolve({ rows: [] }),
    ]);
    const row = context.rows[0];
    res.json({
      rows: submissions.rows,
      context: row
        ? { userName: row.user_name, contestTitle: row.contest_title }
        : null,
    });
  } catch (error) {
    next(error);
  }
});

async function sendContestSubmissionArchive(res, rows) {
  const csvValue = (value) => {
    const text = String(value ?? "");
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const csvRows = [
    [
      "ID",
      "Contestant Name",
      "Contest Name",
      "Image",
      "Title",
      "Description",
      "Winner Status",
      "Status",
    ],
    ...rows.map((row) => [
      row.id,
      row.user_name,
      row.contest_title,
      row.submission_image,
      row.title,
      row.description,
      row.winner_status,
      row.status,
    ]),
  ];
  const images = await Promise.all(
    rows
      .filter((row) => row.submission_image)
      .map(async (row) => {
        const name = path.basename(row.submission_image);
        const image = await fs.readFile(
          path.join(config.contestUploadDir, name),
        );
        return { name, image };
      }),
  );

  res.set({
    "Content-Type": "application/zip",
    "Content-Disposition": "attachment; filename=file.zip",
    "Cache-Control": "no-store",
    Pragma: "no-cache",
  });
  const archive = new ZipArchive();
  archive.on("error", (error) => {
    console.error("Contest submission archive generation failed:", error);
    if (!res.headersSent) {
      res
        .status(500)
        .json({ message: "Unable to generate the submission download." });
    } else if (!res.writableEnded) {
      res.destroy(error);
    }
  });
  archive.pipe(res);
  archive.append(csvRows.map((row) => row.map(csvValue).join(",")).join("\n"), {
    name: "file.csv",
  });
  for (const { name, image } of images) archive.append(image, { name });
  await archive.finalize();
}

app.get(
  "/api/contest-submissions/download",
  requireAuth,
  async (_req, res, next) => {
    try {
      const result = await query(
        `SELECT s.submission_id AS id,s.user_id,s.contest_id,u.user_name,c.contest_title,s.submission_image,s.submission_image_title AS title,s.submission_image_description AS description,s.submission_winner AS winner_status,s.submission_status AS status FROM alpenwild_contest_submission s LEFT JOIN alpenwild_contest_users u ON u.user_id=s.user_id LEFT JOIN alpenwild_contest_tbl c ON c.id=s.contest_id ORDER BY s.submission_id DESC`,
      );
      await sendContestSubmissionArchive(res, result.rows);
    } catch (error) {
      next(error);
    }
  },
);
app.get(
  "/api/contest-submissions/:id/download",
  requireAuth,
  async (req, res, next) => {
    try {
      const result = await query(
        `SELECT s.submission_id AS id,u.user_name,c.contest_title,s.submission_image,s.submission_image_title AS title,s.submission_image_description AS description,s.submission_winner AS winner_status,s.submission_status AS status FROM alpenwild_contest_submission s LEFT JOIN alpenwild_contest_users u ON u.user_id=s.user_id LEFT JOIN alpenwild_contest_tbl c ON c.id=s.contest_id WHERE s.submission_id=$1`,
        [req.params.id],
      );
      if (!result.rowCount)
        return res.status(404).json({ message: "Submission not found." });
      await sendContestSubmissionArchive(res, result.rows);
    } catch (error) {
      next(error);
    }
  },
);
app.patch("/api/contest-submissions/:id/status", async (req, res, next) => {
  try {
    const status = z.enum(["Approved", "Disapproved"]).parse(req.body.status);
    await query(
      "UPDATE alpenwild_contest_submission SET submission_status=$1,updated_at=NOW() WHERE submission_id=$2",
      [status, req.params.id],
    );
    res.json({ id: Number(req.params.id), status });
  } catch (error) {
    next(error);
  }
});
app.patch("/api/contest-submissions/:id/winner", async (req, res, next) => {
  try {
    const winner = z.enum(["Yes", "No"]).parse(req.body.winner_status);
    await query(
      "UPDATE alpenwild_contest_submission SET submission_winner=$1,updated_at=NOW() WHERE submission_id=$2",
      [winner, req.params.id],
    );
    res.json({ id: Number(req.params.id), winner_status: winner });
  } catch (error) {
    next(error);
  }
});
app.delete("/api/contest-submissions/:id", async (req, res, next) => {
  try {
    await query(
      "DELETE FROM alpenwild_contest_submission WHERE submission_id=$1",
      [req.params.id],
    );
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get("/api/contest-settings", async (_req, res, next) => {
  try {
    const rules = await query(
      "SELECT static_page_description AS rules FROM alpenwild_static_page_tbl WHERE static_page_id=3904",
    );
    if (!rules.rowCount)
      return res
        .status(404)
        .json({ message: "Contest rules record was not found." });
    const email = await query(
      "SELECT * FROM alpenwild_contest_emails WHERE id=1",
    );
    res.json({ rules: rules.rows[0].rules, ...(email.rows[0] || {}) });
  } catch (error) {
    next(error);
  }
});
app.put("/api/contest-settings", async (req, res, next) => {
  try {
    const data = z
      .object({
        rules: z.string().max(100000),
        contest_submissions_user: z.string().max(1500),
        contest_submissions_admin: z.string().max(1500),
        contest_approval_user: z.string().max(1500),
        contest_approval_admin: z.string().max(1500),
        contest_disapproval_user: z.string().max(1500),
        contest_disapproval_admin: z.string().max(1500),
        contest_winner_user: z.string().max(1500),
        contest_winner_admin: z.string().max(1500),
      })
      .parse(req.body);
    const rules = await query(
      "UPDATE alpenwild_static_page_tbl SET static_page_description=$1 WHERE static_page_id=3904",
      [data.rules],
    );
    if (!rules.rowCount)
      return res
        .status(404)
        .json({ message: "Contest rules record was not found." });
    await query(
      "UPDATE alpenwild_contest_emails SET contest_submissions_user=$1,contest_submissions_admin=$2,contest_approval_user=$3,contest_approval_admin=$4,contest_disapproval_user=$5,contest_disapproval_admin=$6,contest_winner_user=$7,contest_winner_admin=$8 WHERE id=1",
      [
        data.contest_submissions_user,
        data.contest_submissions_admin,
        data.contest_approval_user,
        data.contest_approval_admin,
        data.contest_disapproval_user,
        data.contest_disapproval_admin,
        data.contest_winner_user,
        data.contest_winner_admin,
      ],
    );
    res.json({ message: "Contest settings updated successfully." });
  } catch (error) {
    next(error);
  }
});

app.get("/api/invoices", async (_req, res, next) => {
  try {
    const result = await query(
      "SELECT * FROM alpenwild_invoice_tbl ORDER BY invoice_id DESC",
    );
    res.json(result.rows.map(serializeInvoice));
  } catch (error) {
    next(error);
  }
});

app.post("/api/invoices", async (req, res, next) => {
  try {
    const data = invoiceSchema.parse(req.body);
    const invoiceId = await query(
      "SELECT nextval(COALESCE(pg_get_serial_sequence($$alpenwild_invoice_tbl$$, $$invoice_id$$), $$alpenwild_invoice_id_seq$$)::regclass) AS invoice_id",
    );
    const result = await query(
      `INSERT INTO alpenwild_invoice_tbl
      (invoice_id,first_name,last_name,user_email_address,day_phone,street_address,street_address1,postal_code,city,country,state,product_name,product_price,deposit_amount,party_number,due_date,invoice_date,due_amount,created_at)
      OVERRIDING SYSTEM VALUE
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
      [invoiceId.rows[0].invoice_id, ...invoiceValues(data)],
    );
    res.status(201).json(serializeInvoice(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/invoices/:id", async (req, res, next) => {
  try {
    const data = invoiceSchema.parse(req.body);
    const values = invoiceValues(data);
    const result = await query(
      `UPDATE alpenwild_invoice_tbl SET
      first_name=$1,last_name=$2,user_email_address=$3,day_phone=$4,street_address=$5,street_address1=$6,
      postal_code=$7,city=$8,country=$9,state=$10,product_name=$11,product_price=$12,deposit_amount=$13,
      party_number=$14,due_date=$15,invoice_date=$16,due_amount=$17 WHERE invoice_id=$18 RETURNING *`,
      [...values.slice(0, 17), req.params.id],
    );
    if (!result.rowCount)
      return res.status(404).json({ message: "Invoice not found." });
    res.json(serializeInvoice(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/invoices/:id", async (req, res, next) => {
  try {
    const result = await query(
      "DELETE FROM alpenwild_invoice_tbl WHERE invoice_id=$1 RETURNING invoice_id",
      [req.params.id],
    );
    if (!result.rowCount)
      return res.status(404).json({ message: "Invoice not found." });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

function serializeOrder(row) {
  return {
    id: row.order_id,
    order_date: row.order_date,
    name: [row.user_first_name, row.user_last_name].filter(Boolean).join(" "),
    email: row.user_email_address || "",
    total_price: Number(row.order_total_price || 0),
    discount_price: Number(row.order_discount_price || 0),
    shipping_price: Number(row.order_shipping_price || 0),
  };
}

app.post("/api/public/shop-customer/register", async (req, res, next) => {
  try {
    const data = userSchema.parse(req.body);
    const duplicate = useLegacyUsers()
      ? await query(
          "SELECT user_id FROM alpenwild_user_tbl WHERE LOWER(user_email_address)=LOWER($1) LIMIT 1",
          [data.user_email_address],
        )
      : await query(
          "SELECT id FROM users WHERE LOWER(email_address)=LOWER($1) LIMIT 1",
          [data.user_email_address],
        );
    if (duplicate.rowCount)
      return res.status(409).json({
        message:
          "Sorry, email is already added. Please use another email address.",
      });
    const inserted = await userInsert(data);
    const result = await query(userSelectById(), [inserted.rows[0].id]);
    res.status(201).json({ user: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

app.post("/api/public/shop-customer", async (req, res, next) => {
  try {
    const { user_email_address: email } = z
      .object({
        user_email_address: z.string().trim().email().max(255),
      })
      .parse(req.body);
    const result = await query(
      `SELECT user_first_name, user_last_name, user_street_address,
              user_street_address1, user_city, user_state, user_postal_code,
              user_country, user_day_phone, user_mobile_phone,
              user_email_address, user_shipping_email_address,
              user_shipping_first_name, user_shipping_last_name,
              user_shipping_street_address, user_shipping_street_address1,
              user_shipping_city, user_shipping_state,
              user_shipping_postal_code, user_shipping_country
         FROM alpenwild_user_tbl
        WHERE LOWER(user_email_address)=LOWER($1)
        ORDER BY user_id
        LIMIT 1`,
      [email],
    );
    const user = result.rows[0];
    if (!user)
      return res.status(404).json({
        code: "ACCOUNT_NOT_FOUND",
        message:
          "No account was found for this email address. Please register first.",
      });
    res.json({
      customer: {
        first_name: user.user_first_name || "",
        last_name: user.user_last_name || "",
        street_address: user.user_street_address || "",
        street_address1: user.user_street_address1 || "",
        city: user.user_city || "",
        state: user.user_state || "",
        postal_code: user.user_postal_code || "",
        country: user.user_country || "",
        email: user.user_email_address || "",
        phone: user.user_mobile_phone || user.user_day_phone || "",
      },
      shipping: {
        first_name: user.user_shipping_first_name || "",
        last_name: user.user_shipping_last_name || "",
        street_address: user.user_shipping_street_address || "",
        street_address1: user.user_shipping_street_address1 || "",
        city: user.user_shipping_city || "",
        state: user.user_shipping_state || "",
        postal_code: user.user_shipping_postal_code || "",
        country: user.user_shipping_country || "",
        email:
          user.user_shipping_email_address || user.user_email_address || "",
        phone: user.user_mobile_phone || user.user_day_phone || "",
      },
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/public/shop-checkout", async (req, res, next) => {
  try {
    const addressSchema = z.object({
      first_name: z.string().trim().min(1).max(255),
      last_name: z.string().trim().min(1).max(255),
      street_address: z.string().trim().min(1).max(255),
      street_address1: z.string().trim().max(255).default(""),
      city: z.string().trim().min(1).max(255),
      state: z.string().trim().min(1).max(255),
      postal_code: z.string().trim().min(1).max(255),
      country: z.string().trim().min(1).max(255),
      email: z.string().trim().email().max(255),
      phone: z.string().trim().min(1).max(255),
    });
    const data = z
      .object({
        customer: addressSchema,
        shipping: addressSchema,
        items: z
          .array(
            z.object({
              product_id: z.coerce.number().int().positive(),
              quantity: z.coerce.number().int().min(1).max(100),
              attributes: z
                .array(
                  z.object({
                    type_id: z.coerce.number().int().positive(),
                    value_id: z.coerce.number().int().positive(),
                  }),
                )
                .max(20)
                .default([]),
            }),
          )
          .min(1)
          .max(50),
        discount_code: z.string().trim().max(255).default(""),
        credit_card_number: z.string().regex(/^\d{14,25}$/),
        credit_card_expire_month: z.string().regex(/^(0[1-9]|1[0-2])$/),
        credit_card_expire_year: z.coerce
          .number()
          .int()
          .min(new Date().getFullYear())
          .max(new Date().getFullYear() + 20),
        credit_card_cvv_number: z.string().regex(/^\d{3,4}$/),
        agree: z.literal(true),
      })
      .parse(req.body);
    if (!config.authorizeNetLogin || !config.authorizeNetTransactionKey)
      return res
        .status(503)
        .json({ message: "Online shop payment is not configured." });

    const now = new Date();
    if (
      data.credit_card_expire_year === now.getFullYear() &&
      Number(data.credit_card_expire_month) < now.getMonth() + 1
    )
      return res.status(400).json({ message: "The credit card has expired." });

    const lines = [];
    for (const item of data.items) {
      const productResult = await query(
        `SELECT product_id AS id, product_name AS name, product_price AS price,
                product_status AS status
           FROM alpenwild_product_tbl WHERE product_id=$1 LIMIT 1`,
        [item.product_id],
      );
      const product = productResult.rows[0];
      if (!product || product.status !== "Active")
        return res
          .status(400)
          .json({ message: "A product in your cart is no longer available." });
      const available = await query(
        `SELECT pv.attribute_type_id AS type_id,
                pv.attribute_value_id AS value_id,
                t.attribute_type_name AS type_name,
                v.attribute_value AS value_name
           FROM alpenwild_product_attribute_value_tbl pv
           JOIN alpenwild_attribute_type_tbl t
             ON t.attribute_type_id=pv.attribute_type_id
           JOIN alpenwild_attribute_value_tbl v
             ON v.attribute_value_id=pv.attribute_value_id
          WHERE pv.product_id=$1
            AND COALESCE(pv.product_attribute_value_status,'Active')='Active'
            AND t.attribute_type_status='Active'
            AND v.attribute_value_status='Active'`,
        [item.product_id],
      );
      const expectedTypes = new Set(
        available.rows.map((attribute) => String(attribute.type_id)),
      );
      const suppliedByType = new Map(
        item.attributes.map((attribute) => [
          String(attribute.type_id),
          String(attribute.value_id),
        ]),
      );
      const allowedPairs = new Set(
        available.rows.map(
          (attribute) => `${attribute.type_id}:${attribute.value_id}`,
        ),
      );
      if (
        expectedTypes.size !== suppliedByType.size ||
        [...expectedTypes].some((typeId) => !suppliedByType.has(typeId)) ||
        item.attributes.some(
          (attribute) =>
            !allowedPairs.has(`${attribute.type_id}:${attribute.value_id}`),
        )
      )
        return res.status(400).json({
          message: `Please choose valid options for ${product.name}.`,
        });
      lines.push({
        product,
        quantity: item.quantity,
        attributes: item.attributes.map((attribute) => {
          const details = available.rows.find(
            (row) =>
              String(row.type_id) === String(attribute.type_id) &&
              String(row.value_id) === String(attribute.value_id),
          );
          return {
            ...attribute,
            type_name: details.type_name,
            value_name: details.value_name,
          };
        }),
      });
    }

    let discount = null;
    if (data.discount_code) {
      const discountResult = await query(
        `SELECT discount_type AS type, discount_value AS value
           FROM alpenwild_discount_tbl
          WHERE discount_code=$1 AND discount_status='Active'
            AND discount_start_date<=CURRENT_DATE
            AND discount_end_date>=CURRENT_DATE
          LIMIT 1`,
        [data.discount_code],
      );
      discount = discountResult.rows[0] || null;
      if (!discount)
        return res
          .status(400)
          .json({ message: "The discount code is invalid or expired." });
    }
    const totals = calculateShopTotals(
      lines.map(({ product, quantity }) => ({
        price: product.price,
        quantity,
      })),
      discount,
    );
    const existingCustomer = await query(
      `SELECT user_id FROM alpenwild_user_tbl
        WHERE LOWER(user_email_address)=LOWER($1)
        ORDER BY user_id LIMIT 1`,
      [data.customer.email],
    );
    const charge = await authorizeNetCharge({
      cardNumber: data.credit_card_number,
      expiration: `${data.credit_card_expire_month}${data.credit_card_expire_year}`,
      amount: totals.total,
      cvv: data.credit_card_cvv_number,
      invoice: `AW-${Date.now()}`,
      email: data.customer.email,
      firstName: data.customer.first_name,
      lastName: data.customer.last_name,
      address: data.customer.street_address,
      city: data.customer.city,
      state: data.customer.state,
      zip: data.customer.postal_code,
      customerId: existingCustomer.rows[0]?.user_id || "",
      phone: data.customer.phone,
      customerIp: req.ip,
      shippingFirstName: data.shipping.first_name,
      shippingLastName: data.shipping.last_name,
      shippingAddress: data.shipping.street_address,
      shippingCity: data.shipping.city,
      shippingState: data.shipping.state,
      shippingZip: data.shipping.postal_code,
      description: "Alpenwild Gear Store",
    });
    if (!charge.approved) {
      return res.status(402).json({
        message: charge.reason || "Payment was declined.",
      });
    }

    let client;
    let orderId;
    try {
      client = await pool.connect();
      await client.query("BEGIN");
      let userId = existingCustomer.rows[0]?.user_id;
      if (userId) {
        await client.query(
          `UPDATE alpenwild_user_tbl SET
             user_first_name=$1,user_last_name=$2,user_street_address=$3,
             user_street_address1=$4,user_city=$5,user_state=$6,
             user_postal_code=$7,user_country=$8,user_day_phone=$9,
             user_mobile_phone=$10,user_shipping_email_address=$11,
             user_shipping_first_name=$12,user_shipping_last_name=$13,
             user_shipping_street_address=$14,user_shipping_street_address1=$15,
             user_shipping_city=$16,user_shipping_state=$17,
             user_shipping_postal_code=$18,user_shipping_country=$19
           WHERE user_id=$20`,
          [
            data.customer.first_name,
            data.customer.last_name,
            data.customer.street_address,
            data.customer.street_address1,
            data.customer.city,
            data.customer.state,
            data.customer.postal_code,
            data.customer.country,
            data.customer.phone,
            data.customer.phone,
            data.shipping.email,
            data.shipping.first_name,
            data.shipping.last_name,
            data.shipping.street_address,
            data.shipping.street_address1,
            data.shipping.city,
            data.shipping.state,
            data.shipping.postal_code,
            data.shipping.country,
            userId,
          ],
        );
      } else {
        const customer = await client.query(
          `INSERT INTO alpenwild_user_tbl
            (user_first_name,user_last_name,user_street_address,
             user_street_address1,user_city,user_state,user_postal_code,
             user_country,user_day_phone,user_mobile_phone,user_email_address,
             user_shipping_email_address,user_shipping_first_name,
             user_shipping_last_name,user_shipping_street_address,
             user_shipping_street_address1,user_shipping_city,user_shipping_state,
             user_shipping_postal_code,user_shipping_country,user_status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,'Active')
           RETURNING user_id`,
          [
            data.customer.first_name,
            data.customer.last_name,
            data.customer.street_address,
            data.customer.street_address1,
            data.customer.city,
            data.customer.state,
            data.customer.postal_code,
            data.customer.country,
            data.customer.phone,
            data.customer.email,
            data.shipping.email,
            data.shipping.first_name,
            data.shipping.last_name,
            data.shipping.street_address,
            data.shipping.street_address1,
            data.shipping.city,
            data.shipping.state,
            data.shipping.postal_code,
            data.shipping.country,
          ],
        );
        userId = customer.rows[0].user_id;
      }
      const order = await client.query(
        `INSERT INTO alpenwild_order_tbl
          (user_id,order_total_price,order_discount_price,order_shipping_price,order_date)
         VALUES ($1,$2,$3,$4,CURRENT_DATE) RETURNING order_id`,
        [userId, totals.total, totals.discount, totals.shipping],
      );
      orderId = order.rows[0].order_id;
      for (const line of lines) {
        const detail = await client.query(
          `INSERT INTO alpenwild_order_details_tbl
            (order_id,product_id,product_attribute_id,product_quantity,
             product_price,product_total_price)
           VALUES ($1,$2,0,$3,$4,$5) RETURNING *`,
          [
            orderId,
            line.product.id,
            line.quantity,
            line.product.price,
            Number(line.product.price) * line.quantity,
          ],
        );
        const orderDetailId =
          detail.rows[0].order_detail_id ?? detail.rows[0].order_details_id;
        if (line.attributes.length && orderDetailId == null)
          throw new Error(
            "The inserted order detail did not return its identifier.",
          );
        for (const attribute of line.attributes)
          await client.query(
            `INSERT INTO alpenwild_order_attribute_details_tbl
              (order_id,product_id,product_attribute_id,
               product_attribute_type_id,product_attribute_value_id)
             VALUES ($1,$2,$3,$4,$5)`,
            [
              orderId,
              line.product.id,
              orderDetailId,
              attribute.type_id,
              attribute.value_id,
            ],
          );
      }
      await client.query("COMMIT");
    } catch (error) {
      if (client) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          console.error(
            "Unable to roll back failed shop order persistence.",
            rollbackError,
          );
        }
      }
      console.error(
        `Authorize.Net approved shop order but saving order ${orderId || "(unassigned)"} failed; transaction ${charge.transactionId}.`,
        error,
      );
      return res.status(502).json({
        message: `Payment was approved, but we could not save the order. Contact Alpenwild and reference transaction ${charge.transactionId}.`,
      });
    } finally {
      client?.release();
    }

    let emailSent = false;
    if (mailer) {
      const { customerHtml, adminHtml } = buildShopOrderEmails({
        customer: data.customer,
        shipping: data.shipping,
        items: lines.map(({ product, quantity, attributes }) => ({
          name: product.name,
          price: product.price,
          quantity,
          attributes,
        })),
        totals,
        transactionId: charge.transactionId,
      });
      const from = {
        name: "Alpenwild",
        address: config.smtpFrom || config.smtpUser,
      };
      try {
        await mailer.sendMail({
          from,
          to: data.customer.email,
          subject: `Alpenwild - Order Notification : ${orderId}`,
          html: customerHtml,
        });
        emailSent = true;
      } catch (emailError) {
        console.error(
          `Shop order ${orderId} was saved, but the confirmation email failed.`,
          emailError,
        );
      }
      try {
        await mailer.sendMail({
          from,
          replyTo: data.customer.email,
          to: "webgrity43@gmail.com",
          subject: `Alpenwild - New Order Notification : ${orderId}`,
          html: adminHtml,
        });
      } catch (emailError) {
        console.error(
          `Shop order ${orderId} was saved, but the admin notification email failed.`,
          emailError,
        );
      }
    }
    res.status(201).json({
      order_id: orderId,
      total: totals.total,
      email_sent: emailSent,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/orders", async (_req, res, next) => {
  try {
    const result = await query(
      `SELECT o.*, u.user_first_name, u.user_last_name, u.user_email_address
       FROM alpenwild_order_tbl o
       LEFT JOIN alpenwild_user_tbl u ON u.user_id=o.user_id
       ORDER BY o.order_id DESC`,
    );
    res.json(result.rows.map(serializeOrder));
  } catch (error) {
    next(error);
  }
});

app.get("/api/orders/:id", async (req, res, next) => {
  try {
    const result = await query(
      `SELECT o.*, u.*
       FROM alpenwild_order_tbl o
       LEFT JOIN alpenwild_user_tbl u ON u.user_id=o.user_id
       WHERE o.order_id=$1`,
      [req.params.id],
    );
    if (!result.rowCount)
      return res.status(404).json({ message: "Order not found." });
    const order = serializeOrder(result.rows[0]);
    const detailIdColumn = await query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema=current_schema()
         AND table_name='alpenwild_order_details_tbl'
         AND column_name=ANY($1::text[])
       ORDER BY array_position($1::text[], column_name)
       LIMIT 1`,
      [["order_detail_id", "order_details_id"]],
    );
    const orderDetailIdColumn = detailIdColumn.rows[0]?.column_name;
    if (!orderDetailIdColumn) {
      throw new Error(
        "Unable to resolve the order detail ID column for product view.",
      );
    }
    const details = await query(
      `SELECT d.product_id, d.product_attribute_id, d.product_quantity,
              d.product_price, d.product_total_price,
              p.product_name
       FROM alpenwild_order_details_tbl d
       LEFT JOIN alpenwild_product_tbl p ON p.product_id=d.product_id
       WHERE d.order_id=$1
       ORDER BY d.${orderDetailIdColumn}`,
      [req.params.id],
    );
    const attributeDetailIdColumn = await query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema=current_schema()
         AND table_name='alpenwild_order_attribute_details_tbl'
         AND column_name=ANY($1::text[])
       ORDER BY array_position($1::text[], column_name)
       LIMIT 1`,
      [["order_attribute_detail_id", "order_attribute_details_id"]],
    );
    const orderAttributeDetailIdColumn =
      attributeDetailIdColumn.rows[0]?.column_name;
    if (!orderAttributeDetailIdColumn) {
      throw new Error(
        "Unable to resolve the order attribute detail ID column for product view.",
      );
    }
    const attributes = await query(
      `SELECT a.product_attribute_id, t.attribute_type_name,
              v.attribute_value
       FROM alpenwild_order_attribute_details_tbl a
       LEFT JOIN alpenwild_attribute_type_tbl t
         ON t.attribute_type_id=a.product_attribute_type_id
       LEFT JOIN alpenwild_attribute_value_tbl v
         ON v.attribute_value_id=a.product_attribute_value_id
       WHERE a.order_id=$1
       ORDER BY a.${orderAttributeDetailIdColumn}`,
      [req.params.id],
    );
    const attributesByProduct = new Map();
    for (const attribute of attributes.rows) {
      const current =
        attributesByProduct.get(attribute.product_attribute_id) || [];
      current.push({
        type: attribute.attribute_type_name || "",
        value: attribute.attribute_value || "",
      });
      attributesByProduct.set(attribute.product_attribute_id, current);
    }
    res.json({
      ...order,
      customer: {
        first_name: result.rows[0].user_first_name || "",
        last_name: result.rows[0].user_last_name || "",
        email: result.rows[0].user_email_address || "",
        street_address: result.rows[0].user_street_address || "",
        street_address1: result.rows[0].user_street_address1 || "",
        city: result.rows[0].user_city || "",
        state: result.rows[0].user_state || "",
        postal_code: result.rows[0].user_postal_code || "",
        country: result.rows[0].user_country || "",
      },
      shipping: {
        first_name: result.rows[0].user_shipping_first_name || "",
        last_name: result.rows[0].user_shipping_last_name || "",
        street_address: result.rows[0].user_shipping_street_address || "",
        street_address1: result.rows[0].user_shipping_street_address1 || "",
        city: result.rows[0].user_shipping_city || "",
        state: result.rows[0].user_shipping_state || "",
        postal_code: result.rows[0].user_shipping_postal_code || "",
        country: result.rows[0].user_shipping_country || "",
      },
      items: details.rows.map((item) => ({
        ...item,
        quantity: Number(item.product_quantity || 0),
        price: Number(item.product_price || 0),
        total_price: Number(item.product_total_price || 0),
        attributes: attributesByProduct.get(item.product_attribute_id) || [],
      })),
    });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/orders/:id", async (req, res, next) => {
  try {
    const result = await query(
      "DELETE FROM alpenwild_order_tbl WHERE order_id=$1 RETURNING order_id",
      [req.params.id],
    );
    if (!result.rowCount)
      return res.status(404).json({ message: "Order not found." });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

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

app.get("/{*splat}", (_req, res, next) => {
  const client = path.resolve(process.cwd(), "dist", "index.html");
  fs.access(client)
    .then(() => res.sendFile(client))
    .catch(() => next());
});

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
