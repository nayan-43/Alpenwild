import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { Router } from "express";
import sharp from "sharp";

export function createPublicRouter({ config, query, buildSitemapXml }) {
  const router = Router();
  const publicThumbnailJobs = new Map();

  router.get("/api/public-settings", async (_req, res, next) => {
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

  router.get("/api/public-thumbnail", async (req, res, next) => {
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
        !/\.(?:jpe?g|jfif|png|webp|gif)$/i.test(realSourcePath)
      ) {
        return res.status(404).json({ message: "Thumbnail source not found." });
      }
      const sourceMetadata = await sharp(realSourcePath).metadata();
      const outputFormat =
        zoomCrop === 2 || !sourceMetadata.hasAlpha ? "jpeg" : "png";

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
            ...(zoomCrop === 2 ? { background: "#ffffff" } : {}),
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

  router.get("/sitemap.xml", async (_req, res, next) => {
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
      ]);
      const origin =
        typeof config.clientOrigin === "string" &&
        config.clientOrigin !== "true"
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

  return router;
}
