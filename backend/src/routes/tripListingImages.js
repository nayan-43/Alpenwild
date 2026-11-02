import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { Router } from "express";
import sharp from "sharp";

export function createTripListingImagesRouter({ config }) {
  const router = Router();
  const tripTypeThumbnailJobs = new Map();
  const tripThumbnailJobs = new Map();

  router.get(
    "/api/trip-type-images/listing/:filename",
    async (req, res, next) => {
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
            return res
              .status(404)
              .json({ message: "Trip style image not found." });
          throw error;
        }
        if (!sourceStats.isFile())
          return res
            .status(404)
            .json({ message: "Trip style image not found." });

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
        let thumbnailJob = tripTypeThumbnailJobs.get(cacheKey);
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
          tripTypeThumbnailJobs.set(cacheKey, thumbnailJob);
        }

        try {
          const thumbnail = await thumbnailJob;
          return res.type("image/jpeg").send(thumbnail);
        } finally {
          if (tripTypeThumbnailJobs.get(cacheKey) === thumbnailJob)
            tripTypeThumbnailJobs.delete(cacheKey);
        }
      } catch (error) {
        next(error);
      }
    },
  );

  router.get("/api/trip-images/listing/:filename", async (req, res, next) => {
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
      let thumbnailJob = tripThumbnailJobs.get(cacheKey);
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
        tripThumbnailJobs.set(cacheKey, thumbnailJob);
      }

      try {
        const thumbnail = await thumbnailJob;
        res.type("image/jpeg").send(thumbnail);
      } finally {
        if (tripThumbnailJobs.get(cacheKey) === thumbnailJob) {
          tripThumbnailJobs.delete(cacheKey);
        }
      }
    } catch (error) {
      next(error);
    }
  });

  return router;
}
