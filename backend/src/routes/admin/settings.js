import fs from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import { z } from "zod";

export function createAdminSettingsRouter({
  query,
  config,
  settingsUpload,
  settingsSchema,
  settingsValidationSchema,
  settingKeyIds,
  safeFilename,
}) {
  const router = Router();
  router.get("/api/settings", async (_req, res, next) => {
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

  router.put(
    "/api/settings",
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

  router.get("/api/email-templates", async (_req, res, next) => {
    try {
      const [result, total] = await Promise.all([
        query(
          `SELECT email_template_id AS id, email_template_for AS name,
          email_template_subject AS subject, email_template_message AS body
         FROM alpenwild_email_template_tbl
         WHERE email_template_id <> 1
         ORDER BY email_template_id DESC`,
        ),
        query(
          "SELECT COUNT(*)::int AS total FROM alpenwild_email_template_tbl",
        ),
      ]);
      res.json({ rows: result.rows, totalEntries: total.rows[0].total });
    } catch (error) {
      next(error);
    }
  });

  router.put("/api/email-templates/:id", async (req, res, next) => {
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
  });

  return router;
}
