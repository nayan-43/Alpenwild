import fs from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import { z } from "zod";

const tripGallerySelect = `SELECT g.trips_gallery_id AS id,
  g.trips_id AS trip_id, t.trips_name AS trip_name,
  g.trips_gallery_image AS image, g.youtube_video_url AS video_url,
  g.trips_gallery_image_alt AS image_alt, g.trips_gallery_order AS display_order,
  g.display_in_static_page, g.display_in_trip_page, g.trips_gallery_status AS status
  FROM alpenwild_trips_gallery_tbl g
  LEFT JOIN alpenwild_trips_tbl t ON t.trips_id = g.trips_id`;

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

export function createTripGalleriesRouter({ query, upload, config, safeFilename }) {
  const router = Router();

  function tripGalleryImageUrl(filename) {
    return filename
      ? `/uploads/${config.tripUploadSubdir}/gallery/${encodeURIComponent(filename)}`
      : null;
  }

  function serializeTripGallery(row) {
    return { ...row, image_url: tripGalleryImageUrl(row.image) };
  }

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

  router.get("/api/trip-galleries", async (_req, res, next) => {
    try {
      const result = await query(
        `${tripGallerySelect} ORDER BY g.trips_gallery_order, g.trips_gallery_id`,
      );
      res.json(result.rows.map(serializeTripGallery));
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/api/trip-galleries",
    upload.single("image"),
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

  router.patch(
    "/api/trip-galleries/:id",
    upload.single("image"),
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

  router.patch("/api/trip-galleries/:id/status", async (req, res, next) => {
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

  router.delete("/api/trip-galleries/:id", async (req, res, next) => {
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

  return router;
}
