import fs from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import { z } from "zod";

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

export function createBannersRouter({
  query,
  upload,
  config,
  useLegacyBanners,
}) {
  const router = Router();

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

  router.get("/api/banners", async (_req, res, next) => {
    try {
      const result = await query(
        `${bannerSelect()} ORDER BY display_order ASC, id ASC`,
      );
      res.json(result.rows.map(serializeBanner));
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/api/banners",
    upload.single("image"),
    async (req, res, next) => {
      try {
        const data = bannerSchema.parse(req.body);
        if (!req.file)
          return res.status(400).json({ message: "Banner image is required." });
        const filename = `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        await fs.rename(
          req.file.path,
          path.join(config.bannerUploadDir, filename),
        );

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
    },
  );

  router.patch(
    "/api/banners/:id",
    upload.single("image"),
    async (req, res, next) => {
      try {
        const data = bannerSchema.parse(req.body);
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
        const currentImage = current.rows[0].image;

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

  router.patch("/api/banners/:id/status", async (req, res, next) => {
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

  router.delete("/api/banners/:id", async (req, res, next) => {
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

  return router;
}
