import fs from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import { z } from "zod";

const tripTypeBoxImageSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  image: z.string().max(255).default(""),
  image_alt: z.string().trim().max(255).default(""),
  title: z.string().trim().max(255).default(""),
  link: z.string().trim().max(1000).default(""),
});

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

export function createTripTypesRouter({
  query,
  upload,
  config,
  useLegacyTripTypes,
  tripTypeBoxImagesFor,
  addTripTypeBoxImages,
  saveTripTypeBoxImages,
  uploadedFile,
  safeFilename,
  slugify,
}) {
  const router = Router();

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

  router.get("/api/trip-types", async (_req, res, next) => {
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

  router.post("/api/trip-types", upload.any(), async (req, res, next) => {
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

  router.patch(
    "/api/trip-types/:id",
    upload.any(),
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

  router.patch("/api/trip-types/:id/status", async (req, res, next) => {
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

  router.delete("/api/trip-types/:id", async (req, res, next) => {
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

  return router;
}
