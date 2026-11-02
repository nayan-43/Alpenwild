import fs from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import { z } from "zod";
import {
  createTripLeaderSerializer,
  parseTripLeaderDescriptionBlocks,
  saveTripLeaderDescriptions,
  tripLeaderSelect,
} from "../../tripLeaderData.js";

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

export function createAdminTripLeadersRouter({
  query,
  config,
  upload,
  tripLeaderAuthors,
  requireAuth,
  uploadedFile,
  safeFilename,
  slugify,
}) {
  const router = Router();
  const serializeTripLeader = createTripLeaderSerializer({ config, query });
  const saveDescriptions = (id, blocks, files = []) =>
    saveTripLeaderDescriptions(
      { query, config, uploadedFile, safeFilename },
      id,
      blocks,
      files,
    );

  router.get("/api/trip-leader-authors", requireAuth, async (_req, res) => {
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

  router.get("/api/trip-leaders", async (_req, res, next) => {
    try {
      const result = await query(
        `${tripLeaderSelect} ORDER BY trip_leader_order, trip_leader_id`,
      );
      res.json(await Promise.all(result.rows.map(serializeTripLeader)));
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/trip-leaders/:id/order", async (req, res, next) => {
    try {
      const displayOrder = z.coerce
        .number()
        .int()
        .parse(req.body.display_order);
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

  router.post("/api/trip-leaders", upload.any(), async (req, res, next) => {
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
      const blocks = parseTripLeaderDescriptionBlocks(data.description_blocks);
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
      await saveDescriptions(result.rows[0].id, blocks, req.files);
      const row = await query(`${tripLeaderSelect} WHERE trip_leader_id=$1`, [
        result.rows[0].id,
      ]);
      res.status(201).json(await serializeTripLeader(row.rows[0]));
    } catch (error) {
      next(error);
    }
  });

  router.patch(
    "/api/trip-leaders/:id",
    upload.any(),
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
        await saveDescriptions(
          req.params.id,
          parseTripLeaderDescriptionBlocks(data.description_blocks),
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

  router.patch("/api/trip-leaders/:id/status", async (req, res, next) => {
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

  router.delete("/api/trip-leaders/:id", async (req, res, next) => {
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

  return router;
}
