import fs from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import { z } from "zod";

export function createAdminCategoriesRouter({
  query,
  config,
  upload,
  uploadedFile,
  safeFilename,
  slugifyCategoryName,
  slugify,
  useLegacyProducts,
  categorySelect,
  serializeCategory,
  categoryBoxImagesFor,
}) {
  const router = Router();
  const categoryBoxImageSchema = z.object({
    id: z.coerce.number().int().positive().optional(),
    image: z.string().max(255).default(""),
    title: z.string().trim().max(255).default(""),
    link: z.string().trim().max(1000).default(""),
  });
  const categorySchema = z.object({
    parent_id: z.coerce.number().int().min(0).default(0),
    name: z.string().trim().min(1).max(255),
    slug: z.string().trim().max(255).default(""),
    menu_name: z.string().trim().min(1).max(255),
    meta_title: z.string().trim().min(1).max(255),
    meta_keywords: z.string().trim().min(1).max(10000),
    meta_descriptions: z.string().trim().min(1).max(10000),
    description: z.string().trim().min(1).max(30000),
    banner_title: z.string().trim().max(255).default(""),
    banner_sub_title: z.string().trim().max(255).default(""),
    tooltip_text: z.string().trim().max(255).default(""),
    display_order: z.preprocess(
      (value) =>
        typeof value === "string" && /^[+-]?\d+$/.test(value)
          ? Number(value)
          : value,
      z.number().int().min(-2147483648).max(2147483647),
    ),
    status: z.enum(["Active", "Inactive"]).default("Active"),
  });

  function parseCategoryBoxImages(value) {
    if (!value) return [];
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return z.array(categoryBoxImageSchema).parse(parsed);
  }

  async function addCategoryBoxImages(categoryId, boxes, files) {
    for (let index = 0; index < boxes.length; index += 1) {
      const box = boxes[index];
      if (!box.title || !box.link) continue;
      const file = uploadedFile(files, `box_image_${index}`);
      let boxId = box.id;
      if (boxId) {
        const result = await query(
          `UPDATE alpenwild_category_box_image_tbl
           SET category_box_image_title=$1, category_box_image_link=$2
           WHERE category_box_image_id=$3 AND category_id=$4
           RETURNING category_box_image_id AS id`,
          [box.title, box.link, boxId, categoryId],
        );
        if (!result.rowCount) continue;
      } else {
        const result = await query(
          `INSERT INTO alpenwild_category_box_image_tbl
            (category_id, category_box_image, category_box_image_title, category_box_image_link)
           VALUES ($1, $2, $3, $4) RETURNING category_box_image_id AS id`,
          [categoryId, box.image || "", box.title, box.link],
        );
        boxId = result.rows[0].id;
      }
      if (file) {
        const filename = safeFilename(file, `category-box-${boxId}`);
        await fs.rename(
          file.path,
          path.join(config.categoryBoxImageUploadDir, filename),
        );
        await query(
          "UPDATE alpenwild_category_box_image_tbl SET category_box_image=$1 WHERE category_box_image_id=$2",
          [filename, boxId],
        );
      }
    }
  }

  router.get("/api/categories", async (_req, res, next) => {
    try {
      const result = await query(
        `${categorySelect()} ORDER BY display_order ASC, id ASC`,
      );
      const boxes = await categoryBoxImagesFor(
        result.rows.map((row) => row.id),
      );
      res.json(
        result.rows.map((row) =>
          serializeCategory({ ...row, box_images: boxes.get(row.id) || [] }),
        ),
      );
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/categories", upload.any(), async (req, res, next) => {
    try {
      const parsedData = categorySchema.parse(req.body);
      const data = {
        ...parsedData,
        slug: slugifyCategoryName(parsedData.name),
      };
      const boxImages = parseCategoryBoxImages(req.body.box_images);
      const duplicate = await query(
        `SELECT 1 FROM alpenwild_category_tbl
           WHERE LOWER(category_name)=LOWER($1) LIMIT 1`,
        [data.name],
      );
      if (duplicate.rowCount)
        return res.status(409).json({
          message: "Sorry, name is already added. Please use another name.",
        });
      const bannerFile = uploadedFile(req.files, "banner_image");
      const listingFile = uploadedFile(req.files, "listing_image");
      if (!listingFile)
        return res.status(400).json({ message: "Listing image is required." });
      const bannerFilename = bannerFile
        ? safeFilename(bannerFile, "category-banner")
        : null;
      const listingFilename = safeFilename(listingFile, "category-listing");
      if (bannerFile)
        await fs.rename(
          bannerFile.path,
          path.join(config.categoryBannerUploadDir, bannerFilename),
        );
      await fs.rename(
        listingFile.path,
        path.join(config.categoryListingUploadDir, listingFilename),
      );
      await query(
        `UPDATE alpenwild_category_tbl
           SET category_order=category_order+1 WHERE category_order >= $1`,
        [data.display_order],
      );
      const result = await query(
        `INSERT INTO alpenwild_category_tbl
         (category_parent_id,category_name,category_slug,category_menu_name,
          category_meta_title,category_meta_keywords,category_meta_descriptions,
          category_description,category_banner,category_banner_title,
          category_banner_sub_title,category_tooltip_text,category_listing_image,
          category_order,category_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         RETURNING ${categorySelect()
           .replace(/^SELECT /, "")
           .replace(/ FROM alpenwild_category_tbl$/, "")}`,
        [
          data.parent_id,
          data.name,
          data.slug || slugify(data.name),
          data.menu_name,
          data.meta_title,
          data.meta_keywords,
          data.meta_descriptions,
          data.description,
          bannerFilename,
          data.banner_title,
          data.banner_sub_title,
          data.tooltip_text,
          listingFilename,
          data.display_order,
          data.status,
        ],
      );
      await addCategoryBoxImages(result.rows[0].id, boxImages, req.files);
      res
        .status(201)
        .json(serializeCategory({ ...result.rows[0], box_images: boxImages }));
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/categories/:id", upload.any(), async (req, res, next) => {
    try {
      const parsedData = categorySchema.parse(req.body);
      const data = {
        ...parsedData,
        slug: slugifyCategoryName(parsedData.name),
      };
      const boxImages = parseCategoryBoxImages(req.body.box_images);
      const duplicate = await query(
        `SELECT 1 FROM alpenwild_category_tbl
           WHERE LOWER(category_name)=LOWER($1) AND category_id<>$2 LIMIT 1`,
        [data.name, req.params.id],
      );
      if (duplicate.rowCount)
        return res.status(409).json({
          message: "Sorry, name is already added. Please use another name.",
        });
      const current = await query(
        "SELECT category_order FROM alpenwild_category_tbl WHERE category_id=$1",
        [req.params.id],
      );
      if (!current.rowCount)
        return res.status(404).json({ message: "Category not found." });
      const oldOrder = Number(current.rows[0].category_order);
      if (data.display_order < oldOrder) {
        await query(
          `UPDATE alpenwild_category_tbl SET category_order=category_order+1
             WHERE category_order >= $1 AND category_order < $2 AND category_id<>$3`,
          [data.display_order, oldOrder, req.params.id],
        );
      } else if (data.display_order > oldOrder) {
        await query(
          `UPDATE alpenwild_category_tbl SET category_order=category_order-1
             WHERE category_order > $1 AND category_order <= $2 AND category_id<>$3`,
          [oldOrder, data.display_order, req.params.id],
        );
      }
      const bannerFile = uploadedFile(req.files, "banner_image");
      const listingFile = uploadedFile(req.files, "listing_image");
      const bannerFilename = bannerFile
        ? safeFilename(bannerFile, "category-banner")
        : null;
      const listingFilename = listingFile
        ? safeFilename(listingFile, "category-listing")
        : null;
      if (bannerFile)
        await fs.rename(
          bannerFile.path,
          path.join(config.categoryBannerUploadDir, bannerFilename),
        );
      if (listingFile)
        await fs.rename(
          listingFile.path,
          path.join(config.categoryListingUploadDir, listingFilename),
        );
      const result = await query(
        `UPDATE alpenwild_category_tbl SET category_parent_id=$1, category_name=$2,
         category_slug=$3, category_menu_name=$4, category_meta_title=$5,
         category_meta_keywords=$6, category_meta_descriptions=$7,
         category_description=$8, category_banner=COALESCE($9,category_banner),
         category_banner_title=$10, category_banner_sub_title=$11,
         category_tooltip_text=$12, category_listing_image=COALESCE($13,category_listing_image),
         category_order=$14, category_status=$15 WHERE category_id=$16
         RETURNING category_id AS id, category_parent_id AS parent_id,
         category_name AS name, category_slug AS slug, category_menu_name AS menu_name,
         category_meta_title AS meta_title, category_meta_keywords AS meta_keywords,
         category_meta_descriptions AS meta_descriptions, category_description AS description,
         category_banner AS banner_image, category_banner_title AS banner_title,
         category_banner_sub_title AS banner_sub_title, category_tooltip_text AS tooltip_text,
         category_listing_image AS listing_image, category_order AS display_order,
         category_status AS status`,
        [
          data.parent_id,
          data.name,
          data.slug || slugify(data.name),
          data.menu_name,
          data.meta_title,
          data.meta_keywords,
          data.meta_descriptions,
          data.description,
          bannerFilename,
          data.banner_title,
          data.banner_sub_title,
          data.tooltip_text,
          listingFilename,
          data.display_order,
          data.status,
          req.params.id,
        ],
      );
      if (!result.rowCount)
        return res.status(404).json({ message: "Category not found." });
      await addCategoryBoxImages(req.params.id, boxImages, req.files);
      res.json(serializeCategory({ ...result.rows[0], box_images: boxImages }));
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/categories/:id/status", async (req, res, next) => {
    try {
      const status = z.enum(["Active", "Inactive"]).parse(req.body.status);
      const result = await query(
        `UPDATE alpenwild_category_tbl SET category_status=$1 WHERE category_id=$2 RETURNING ${categorySelect()
          .replace(/^SELECT /, "")
          .replace(/ FROM alpenwild_category_tbl$/, "")}`,
        [status, req.params.id],
      );
      if (!result.rowCount)
        return res.status(404).json({ message: "Category not found." });
      res.json(serializeCategory(result.rows[0]));
    } catch (error) {
      next(error);
    }
  });

  router.delete("/api/categories/:id", async (req, res, next) => {
    try {
      const productTable = useLegacyProducts()
        ? "alpenwild_product_tbl"
        : "products";
      const inUse = await query(
        `SELECT 1 FROM ${productTable} WHERE category_id=$1 LIMIT 1`,
        [req.params.id],
      );
      if (inUse.rowCount)
        return res.status(409).json({
          message:
            "Product existing under this category. First delete product and then delete this category.",
        });
      const result = await query(
        "DELETE FROM alpenwild_category_tbl WHERE category_id=$1 RETURNING category_id",
        [req.params.id],
      );
      if (!result.rowCount)
        return res.status(404).json({ message: "Category not found." });
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
