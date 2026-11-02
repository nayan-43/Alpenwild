import fs from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import { z } from "zod";

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

function parseJsonArray(value) {
  if (!value) return [];
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  return z.array(z.unknown()).parse(parsed);
}

function imageUrl(config, filename, folder) {
  return filename
    ? `/uploads/${config.tripUploadSubdir}/${folder}/${encodeURIComponent(filename)}`
    : "";
}

async function tripRelations(query, config, tripId) {
  const [dates, boxes, activities, itinerary] = await Promise.all([
    query(
      `SELECT trips_date_id AS id,
        to_char(trips_start_date, 'YYYY-MM-DD') AS start_date,
        to_char(trips_end_date, 'YYYY-MM-DD') AS end_date,
        trips_date_range AS date_range, trips_price AS price,
        trips_single_price AS single_price, trips_date_status AS status
       FROM alpenwild_trips_date_tbl
       WHERE trips_id=$1 ORDER BY trips_start_date, trips_date_id`,
      [tripId],
    ),
    query(
      `SELECT trips_box_image_id AS id, trips_box_image AS image,
        trips_box_image_alt AS image_alt, trips_box_image_title AS title,
        trips_box_image_link AS link, trips_box_image_order AS display_order
       FROM alpenwild_trips_box_image_tbl
       WHERE trips_id=$1 ORDER BY trips_box_image_order, trips_box_image_id`,
      [tripId],
    ),
    query(
      `SELECT activity_id FROM alpenwild_trips_activity_tbl
       WHERE trips_id=$1 ORDER BY trips_acitivity_id`,
      [tripId],
    ),
    query(
      `SELECT trips_itinerary_id AS id,
        trips_itinerary_day AS day, trips_itinerary_title AS title,
        trips_itinerary_description AS description
       FROM alpenwild_trips_itinerary_tbl
       WHERE trips_id=$1 ORDER BY trips_itinerary_day, trips_itinerary_id`,
      [tripId],
    ),
  ]);
  return {
    dates: dates.rows,
    box_images: boxes.rows.map((box) => ({
      ...box,
      image_url: imageUrl(config, box.image, "boximage"),
    })),
    activity_ids: activities.rows.map((activity) => activity.activity_id),
    itinerary: itinerary.rows,
  };
}

function serializeTrip(row, relations, config) {
  return {
    ...row,
    ...relations,
    banner_image_url: imageUrl(config, row.banner_image, "banner"),
    map_image_url: imageUrl(config, row.map_image, "map"),
    listing_image_url: imageUrl(config, row.listing_image, "listing"),
    listing_thumbnail_url: row.listing_image
      ? `/api/trip-images/listing/${encodeURIComponent(row.listing_image)}`
      : null,
  };
}

async function saveTripRelations({
  id,
  dates,
  boxes,
  activityIds,
  files = [],
  pool,
  query,
  fs,
  path,
  config,
  uploadedFile,
  safeFilename,
}) {
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

export function createAdminTripsRouter({
  query,
  pool,
  upload,
  config,
  uploadedFile,
  safeFilename,
}) {
  const router = Router();

  router.get("/api/trips", async (_req, res, next) => {
    try {
      const result = await query(
        `${tripSelect} ORDER BY t.trips_order, t.trips_id`,
      );
      const rows = await Promise.all(
        result.rows.map(async (row) =>
          serializeTrip(
            row,
            await tripRelations(query, config, row.id),
            config,
          ),
        ),
      );
      res.json(rows);
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/trips", upload.any(), async (req, res, next) => {
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
      await saveTripRelations({
        id,
        dates,
        boxes,
        activityIds,
        files: req.files,
        pool,
        query,
        fs,
        path,
        config,
        uploadedFile,
        safeFilename,
      });
      const row = await query(`${tripSelect} WHERE t.trips_id=$1`, [id]);
      res
        .status(201)
        .json(
          serializeTrip(
            row.rows[0],
            await tripRelations(query, config, id),
            config,
          ),
        );
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/trips/:id", upload.any(), async (req, res, next) => {
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
      await query(
        "DELETE FROM alpenwild_trips_box_image_tbl WHERE trips_id=$1",
        [req.params.id],
      );
      await saveTripRelations({
        id: req.params.id,
        dates,
        boxes,
        activityIds,
        files: req.files,
        pool,
        query,
        fs,
        path,
        config,
        uploadedFile,
        safeFilename,
      });
      const row = await query(`${tripSelect} WHERE t.trips_id=$1`, [
        req.params.id,
      ]);
      res.json(
        serializeTrip(
          row.rows[0],
          await tripRelations(query, config, req.params.id),
          config,
        ),
      );
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/trips/:id/status", async (req, res, next) => {
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

  router.delete("/api/trips/:id/dates/:dateId", async (req, res, next) => {
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

  router.patch(
    "/api/trips/:id/dates/:dateId/status",
    async (req, res, next) => {
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
    },
  );

  router.delete("/api/trips/:id", async (req, res, next) => {
    try {
      const result = await query(
        "DELETE FROM alpenwild_trips_tbl WHERE trips_id=$1 RETURNING trips_id",
        [req.params.id],
      );
      if (!result.rowCount)
        return res.status(404).json({ message: "Trip not found." });
      await query(
        "DELETE FROM alpenwild_trips_activity_tbl WHERE trips_id=$1",
        [req.params.id],
      );
      await query("DELETE FROM alpenwild_trips_date_tbl WHERE trips_id=$1", [
        req.params.id,
      ]);
      await query(
        "DELETE FROM alpenwild_trips_box_image_tbl WHERE trips_id=$1",
        [req.params.id],
      );
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
