import fs from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import { z } from "zod";

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

export function createSpecialFeaturesRouter({
  query,
  upload,
  config,
  useLegacySpecialFeatures,
}) {
  const router = Router();

  const serializeSpecialFeature = (row) => {
    const imageUrl = row.image_filename
      ? `/uploads/${config.specialFeatureUploadSubdir}/${encodeURIComponent(row.image_filename)}`
      : null;
    return { ...row, image_url: imageUrl };
  };

  router.get("/api/special-features", async (_req, res, next) => {
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

  router.post(
    "/api/special-features",
    upload.single("image"),
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

  router.patch(
    "/api/special-features/:id",
    upload.single("image"),
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
          return res
            .status(404)
            .json({ message: "Special feature not found." });
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
          return res
            .status(404)
            .json({ message: "Special feature not found." });
        res.json(serializeSpecialFeature(result.rows[0]));
      } catch (error) {
        next(error);
      }
    },
  );

  router.patch("/api/special-features/:id/status", async (req, res, next) => {
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

  router.delete("/api/special-features/:id", async (req, res, next) => {
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

  return router;
}
