import { Router } from "express";

export function createPublicCategoriesRouter({
  config,
  query,
  fs,
  path,
  crypto,
  sharp,
  categorySelect,
  serializeCategory,
  categoryBoxImagesFor,
  productSelect,
}) {
  const router = Router();
  const thumbnailJobs = new Map();

  router.get("/api/public-categories", async (_req, res, next) => {
    try {
      const result = await query(
        `${categorySelect()} WHERE category_status='Active' ORDER BY category_order ASC, category_id ASC`,
      );
      const boxes = await categoryBoxImagesFor(
        result.rows.map((row) => row.id),
      );
      res.json(
        result.rows.map((row) => ({
          ...serializeCategory({
            ...row,
            box_images: boxes.get(row.id) || [],
          }),
          listing_thumbnail_url: row.listing_image
            ? `/api/public-category-images/listing/${encodeURIComponent(row.listing_image)}`
            : null,
        })),
      );
    } catch (error) {
      next(error);
    }
  });

  router.get(
    "/api/public-category-images/listing/:filename",
    async (req, res, next) => {
      const { filename } = req.params;
      if (
        !filename ||
        /[\\/]/.test(filename) ||
        !/\.(?:jpe?g|png|webp|gif)$/i.test(filename)
      ) {
        return res.status(400).json({ message: "Invalid category image." });
      }

      try {
        const sourcePath = path.join(config.categoryListingUploadDir, filename);
        let sourceStats;
        try {
          sourceStats = await fs.stat(sourcePath);
        } catch (error) {
          if (error.code === "ENOENT")
            return res
              .status(404)
              .json({ message: "Category image not found." });
          throw error;
        }
        if (!sourceStats.isFile())
          return res.status(404).json({ message: "Category image not found." });

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
          "category-listing",
        );
        const thumbnailPath = path.join(cacheDirectory, `${cacheKey}.jpg`);
        let thumbnailJob = thumbnailJobs.get(cacheKey);
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
          thumbnailJobs.set(cacheKey, thumbnailJob);
        }

        try {
          const thumbnail = await thumbnailJob;
          return res.type("image/jpeg").send(thumbnail);
        } finally {
          if (thumbnailJobs.get(cacheKey) === thumbnailJob)
            thumbnailJobs.delete(cacheKey);
        }
      } catch (error) {
        next(error);
      }
    },
  );

  router.get("/api/public-categories/:slug", async (req, res, next) => {
    try {
      const categoryResult = await query(
        `${categorySelect()} WHERE category_slug=$1 AND category_status='Active' LIMIT 1`,
        [req.params.slug],
      );
      if (!categoryResult.rowCount)
        return res.status(404).json({ message: "Category not found." });

      const category = categoryResult.rows[0];
      const productResult = await query(
        `${productSelect()} WHERE p.category_id=$1 AND p.product_status='Active'
         ORDER BY p.product_order ASC, p.product_id ASC`,
        [category.id],
      );
      const products = productResult.rows.map((product) => ({
        ...product,
        listing_image_url: product.listing_image
          ? `/uploads/${config.productUploadSubdir}/listing/${encodeURIComponent(product.listing_image)}`
          : "",
      }));
      const boxes = await categoryBoxImagesFor([category.id]);
      res.json({
        ...serializeCategory({
          ...category,
          box_images: boxes.get(category.id) || [],
        }),
        products,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
