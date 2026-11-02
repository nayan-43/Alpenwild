import fs from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import { z } from "zod";

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

export function createPromotionsRouter({
  query,
  upload,
  config,
  useLegacyPromotions,
}) {
  const router = Router();

  function serializePromotion(row) {
    const imageUrl = row.image_filename
      ? `/uploads/${config.promotionsUploadSubdir}/${encodeURIComponent(row.image_filename)}`
      : null;
    return { ...row, image_url: imageUrl };
  }

  router.get("/api/promotions", async (_req, res, next) => {
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
      const result = await query(
        `${select} ORDER BY display_order ASC, id ASC`,
      );
      res.json(result.rows.map(serializePromotion));
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/api/promotions",
    upload.single("image"),
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

  router.patch(
    "/api/promotions/:id",
    upload.single("image"),
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

  router.patch("/api/promotions/:id/status", async (req, res, next) => {
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

  router.delete("/api/promotions/:id", async (req, res, next) => {
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

  return router;
}
