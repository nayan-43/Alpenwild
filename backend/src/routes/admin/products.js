import fs from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import { z } from "zod";

const productSchema = z.object({
  name: z.string().trim().min(1).max(255),
  slug: z.string().trim().max(255).default(""),
  category_id: z.coerce.number().int().positive(),
  menu_name: z.string().trim().min(1).max(255),
  meta_title: z.string().trim().min(1).max(255),
  meta_descriptions: z.string().trim().min(1).max(10000),
  meta_keywords: z.string().trim().min(1).max(10000),
  short_descriptions: z.string().trim().min(1).max(10000),
  description: z.string().trim().min(1).max(30000),
  price: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === ""
        ? Number.NaN
        : Number(value),
    z.number().finite(),
  ),
  banner_title: z.string().trim().max(255).default(""),
  banner_sub_title: z.string().trim().max(255).default(""),
  tooltip_text: z.string().trim().max(255).default(""),
  banner_alt: z.string().trim().max(255).default(""),
  listing_image_alt: z.string().trim().max(255).default(""),
  display_order: z.preprocess(
    (value) =>
      typeof value === "string" && /^[+-]?\d+$/.test(value)
        ? Number(value)
        : value,
    z.number().int().min(-2147483648).max(2147483647),
  ),
  status: z.enum(["Active", "Inactive"]).default("Active"),
});

export function createAdminProductsRouter({
  query,
  config,
  upload,
  useLegacyProducts,
  productSelect,
  uploadedFile,
  safeFilename,
  slugifyCategoryName,
}) {
  const router = Router();

  router.get("/api/products", async (_req, res, next) => {
    try {
      const result = useLegacyProducts()
        ? await query(
            `${productSelect()} ORDER BY p.product_order ASC, p.product_id ASC`,
          )
        : await query(`SELECT p.id, p.name, p.slug, p.category_id, c.name AS category_name,
            p.menu_name, p.meta_title, p.meta_descriptions, p.meta_keywords,
            p.short_descriptions, p.description, p.price, p.banner_title,
            p.banner_sub_title, p.tooltip_text, p.banner_image, p.banner_alt,
            p.listing_image, p.listing_image_alt, p.display_order, p.status
            FROM products p LEFT JOIN categories c ON c.id=p.category_id
            ORDER BY p.display_order ASC, p.id ASC`);
      const rows = await Promise.all(
        result.rows.map(async (row) => {
          const [boxes, additional] = await Promise.all([
            useLegacyProducts()
              ? query(
                  `SELECT product_box_image_id AS id, product_box_image AS image,
                product_box_image_image_alt AS image_alt, product_box_image_title AS title,
                product_box_image_link AS link
                FROM alpenwild_product_box_image_tbl WHERE product_id=$1 ORDER BY product_box_image_id ASC`,
                  [row.id],
                )
              : { rows: [] },
            useLegacyProducts()
              ? query(
                  `SELECT product_additional_image_id AS id, additional_image AS image
                FROM alpenwild_product_additional_image_tbl
                WHERE product_id=$1 ORDER BY product_additional_image_id ASC`,
                  [row.id],
                )
              : { rows: [] },
          ]);
          return {
            ...row,
            slug: row.slug || slugifyCategoryName(row.name),
            listing_image_url: row.listing_image
              ? `/uploads/${config.productUploadSubdir}/listing/${encodeURIComponent(row.listing_image)}`
              : "",
            banner_image_url: row.banner_image
              ? `/uploads/${config.productUploadSubdir}/banner/${encodeURIComponent(row.banner_image)}`
              : "",
            box_images: boxes.rows.map((box) => ({
              ...box,
              image_url: box.image
                ? `/uploads/${config.productUploadSubdir}/boximage/${encodeURIComponent(box.image)}`
                : "",
            })),
            additional_images: additional.rows.map((image) => ({
              ...image,
              image_url: `/uploads/${config.productUploadSubdir}/additional/${encodeURIComponent(image.image)}`,
            })),
          };
        }),
      );
      res.json(rows);
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/products", upload.any(), async (req, res, next) => {
    try {
      const data = productSchema.parse({
        ...req.body,
        slug: slugifyCategoryName(req.body.name),
      });
      const listing = uploadedFile(req.files, "listing_image");
      if (!listing)
        return res
          .status(400)
          .json({ message: "Listing image is required for a new product." });
      const duplicate = useLegacyProducts()
        ? await query(
            "SELECT 1 FROM alpenwild_product_tbl WHERE LOWER(product_name)=LOWER($1) LIMIT 1",
            [data.name],
          )
        : await query(
            "SELECT 1 FROM products WHERE LOWER(name)=LOWER($1) LIMIT 1",
            [data.name],
          );
      if (duplicate.rowCount)
        return res.status(409).json({
          message: "Sorry, name is already added. Please use another name.",
        });
      const banner = uploadedFile(req.files, "banner_image");
      const bannerName = banner ? safeFilename(banner, "product-banner") : "";
      const listingName = listing
        ? safeFilename(listing, "product-listing")
        : "";
      if (banner)
        await fs.rename(
          banner.path,
          path.join(config.productBannerUploadDir, bannerName),
        );
      if (listing)
        await fs.rename(
          listing.path,
          path.join(config.productListingUploadDir, listingName),
        );
      if (useLegacyProducts()) {
        await query(
          "UPDATE alpenwild_product_tbl SET product_order=product_order+1 WHERE product_order >= $1",
          [data.display_order],
        );
      } else {
        await query(
          "UPDATE products SET display_order=display_order+1 WHERE display_order >= $1",
          [data.display_order],
        );
      }
      const result = useLegacyProducts()
        ? await query(
            `INSERT INTO alpenwild_product_tbl
          (product_name,product_slug,category_id,product_menu_name,product_meta_title,
           product_meta_descriptions,product_meta_keywords,product_short_descriptions,
           product_description,product_price,product_banner_title,product_banner_sub_title,
           product_tooltip_text,product_banner,product_banner_alt,product_listing_image,
           product_listing_image_alt,product_order,product_status,product_creation_date)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,CURRENT_DATE)
          RETURNING product_id AS id`,
            [
              data.name,
              data.slug,
              data.category_id,
              data.menu_name,
              data.meta_title,
              data.meta_descriptions,
              data.meta_keywords,
              data.short_descriptions,
              data.description,
              data.price,
              data.banner_title,
              data.banner_sub_title,
              data.tooltip_text,
              bannerName,
              data.banner_alt,
              listingName,
              data.listing_image_alt,
              data.display_order,
              data.status,
            ],
          )
        : await query(
            `INSERT INTO products
          (name,slug,category_id,menu_name,meta_title,meta_descriptions,meta_keywords,
           short_descriptions,description,price,banner_title,banner_sub_title,tooltip_text,
           banner_image,banner_alt,listing_image,listing_image_alt,display_order,status)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
          RETURNING id`,
            [
              data.name,
              data.slug,
              data.category_id,
              data.menu_name,
              data.meta_title,
              data.meta_descriptions,
              data.meta_keywords,
              data.short_descriptions,
              data.description,
              data.price,
              data.banner_title,
              data.banner_sub_title,
              data.tooltip_text,
              bannerName,
              data.banner_alt,
              listingName,
              data.listing_image_alt,
              data.display_order,
              data.status,
            ],
          );
      const productId = result.rows[0].id;
      const boxes = JSON.parse(req.body.box_images || "[]");
      const files = req.files || [];
      for (const [index, box] of boxes.entries()) {
        if (box.title && box.link) {
          const file = files.find(
            (item) => item.fieldname === `box_image_${index}`,
          );
          const imageName = file
            ? safeFilename(file, `product-box-${productId}-${index}`)
            : "";
          if (file)
            await fs.rename(
              file.path,
              path.join(config.productBoxImageUploadDir, imageName),
            );
          await query(
            `INSERT INTO alpenwild_product_box_image_tbl
            (product_id, product_box_image, product_box_image_image_alt,
             product_box_image_title, product_box_image_link)
            VALUES ($1,$2,$3,$4,$5)`,
            [productId, imageName, box.image_alt || "", box.title, box.link],
          );
        }
      }
      for (const file of files.filter(
        (item) => item.fieldname === "additional_images",
      )) {
        const imageName = safeFilename(file, `product-additional-${productId}`);
        await fs.rename(
          file.path,
          path.join(config.productAdditionalUploadDir, imageName),
        );
        await query(
          "INSERT INTO alpenwild_product_additional_image_tbl (product_id, additional_image) VALUES ($1,$2)",
          [productId, imageName],
        );
      }
      res.status(201).json({ id: productId });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/products/:id", upload.any(), async (req, res, next) => {
    try {
      const data = productSchema.parse({
        ...req.body,
        slug: slugifyCategoryName(req.body.name),
      });
      const duplicate = useLegacyProducts()
        ? await query(
            "SELECT 1 FROM alpenwild_product_tbl WHERE LOWER(product_name)=LOWER($1) AND product_id<>$2 LIMIT 1",
            [data.name, req.params.id],
          )
        : await query(
            "SELECT 1 FROM products WHERE LOWER(name)=LOWER($1) AND id<>$2 LIMIT 1",
            [data.name, req.params.id],
          );
      if (duplicate.rowCount)
        return res.status(409).json({
          message: "Sorry, name is already added. Please use another name.",
        });
      const orderTable = useLegacyProducts()
        ? "alpenwild_product_tbl"
        : "products";
      const orderColumn = useLegacyProducts()
        ? "product_order"
        : "display_order";
      const productIdColumn = useLegacyProducts() ? "product_id" : "id";
      const listingColumn = useLegacyProducts()
        ? "product_listing_image"
        : "listing_image";
      const currentProduct = await query(
        `SELECT ${orderColumn} AS display_order, ${listingColumn} AS listing_image
         FROM ${orderTable} WHERE ${productIdColumn}=$1`,
        [req.params.id],
      );
      if (!currentProduct.rowCount)
        return res.status(404).json({ message: "Product not found." });
      const previousOrder = Number(currentProduct.rows[0].display_order);
      const banner = uploadedFile(req.files, "banner_image");
      const listing = uploadedFile(req.files, "listing_image");
      if (!listing && !currentProduct.rows[0].listing_image)
        return res.status(400).json({ message: "Listing image is required." });
      const bannerName = banner ? safeFilename(banner, "product-banner") : null;
      const listingName = listing
        ? safeFilename(listing, "product-listing")
        : null;
      if (banner)
        await fs.rename(
          banner.path,
          path.join(config.productBannerUploadDir, bannerName),
        );
      if (listing)
        await fs.rename(
          listing.path,
          path.join(config.productListingUploadDir, listingName),
        );
      const result = useLegacyProducts()
        ? await query(
            `UPDATE alpenwild_product_tbl SET product_name=$1, product_slug=$2,
            category_id=$3, product_menu_name=$4, product_meta_title=$5,
            product_meta_descriptions=$6, product_meta_keywords=$7,
            product_short_descriptions=$8, product_description=$9, product_price=$10,
            product_banner_title=$11, product_banner_sub_title=$12, product_tooltip_text=$13,
            product_banner=COALESCE($14,product_banner), product_banner_alt=$15,
            product_listing_image=COALESCE($16,product_listing_image),
            product_listing_image_alt=$17, product_order=$18, product_status=$19
            WHERE product_id=$20 RETURNING product_id AS id`,
            productUpdateValues(data, bannerName, listingName, req.params.id),
          )
        : await query(
            `UPDATE products SET name=$1, slug=$2, category_id=$3, menu_name=$4,
            meta_title=$5, meta_descriptions=$6, meta_keywords=$7, short_descriptions=$8,
            description=$9, price=$10, banner_title=$11, banner_sub_title=$12, tooltip_text=$13,
            banner_image=COALESCE($14,banner_image), banner_alt=$15,
            listing_image=COALESCE($16,listing_image), listing_image_alt=$17,
            display_order=$18, status=$19, updated_at=NOW() WHERE id=$20 RETURNING id`,
            productUpdateValues(data, bannerName, listingName, req.params.id),
          );
      if (!result.rowCount)
        return res.status(404).json({ message: "Product not found." });
      if (data.display_order < previousOrder) {
        await query(
          `UPDATE ${orderTable} SET ${orderColumn}=${orderColumn}+1
           WHERE ${orderColumn}>=$1 AND ${orderColumn}<$2 AND ${productIdColumn}<>$3`,
          [data.display_order, previousOrder, req.params.id],
        );
      } else if (data.display_order > previousOrder) {
        await query(
          `UPDATE ${orderTable} SET ${orderColumn}=${orderColumn}-1
           WHERE ${orderColumn}>$1 AND ${orderColumn}<=$2 AND ${productIdColumn}<>$3`,
          [previousOrder, data.display_order, req.params.id],
        );
      }
      const files = req.files || [];
      const boxes = JSON.parse(req.body.box_images || "[]");
      const existingBoxes = await query(
        "SELECT product_box_image_id AS id FROM alpenwild_product_box_image_tbl WHERE product_id=$1",
        [req.params.id],
      );
      const existingBoxIds = new Set(
        existingBoxes.rows.map((box) => String(box.id)),
      );
      for (const [index, box] of boxes.entries()) {
        if (box.id && !existingBoxIds.has(String(box.id)))
          return res
            .status(400)
            .json({ message: "Invalid product box image." });
        if (!box.title || !box.link) continue;
        const file = files.find(
          (item) => item.fieldname === `box_image_${index}`,
        );
        const imageName = file
          ? safeFilename(file, `product-box-${req.params.id}-${index}`)
          : null;
        if (file)
          await fs.rename(
            file.path,
            path.join(config.productBoxImageUploadDir, imageName),
          );
        if (box.id) {
          await query(
            `UPDATE alpenwild_product_box_image_tbl
             SET product_box_image=COALESCE($1,product_box_image),
               product_box_image_image_alt=$2, product_box_image_title=$3,
               product_box_image_link=$4
             WHERE product_box_image_id=$5 AND product_id=$6`,
            [
              imageName,
              box.image_alt || "",
              box.title,
              box.link,
              box.id,
              req.params.id,
            ],
          );
        } else {
          await query(
            `INSERT INTO alpenwild_product_box_image_tbl
            (product_id, product_box_image, product_box_image_image_alt,
             product_box_image_title, product_box_image_link)
            VALUES ($1,$2,$3,$4,$5)`,
            [
              req.params.id,
              imageName || "",
              box.image_alt || "",
              box.title,
              box.link,
            ],
          );
        }
      }
      for (const file of files.filter(
        (item) => item.fieldname === "additional_images",
      )) {
        const imageName = safeFilename(
          file,
          `product-additional-${req.params.id}`,
        );
        await fs.rename(
          file.path,
          path.join(config.productAdditionalUploadDir, imageName),
        );
        await query(
          "INSERT INTO alpenwild_product_additional_image_tbl (product_id, additional_image) VALUES ($1,$2)",
          [req.params.id, imageName],
        );
      }
      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  });

  router.delete(
    "/api/products/:productId/additional-images/:imageId",
    async (req, res, next) => {
      try {
        const result = await query(
          `DELETE FROM alpenwild_product_additional_image_tbl
        WHERE product_additional_image_id=$1 AND product_id=$2 RETURNING additional_image`,
          [req.params.imageId, req.params.productId],
        );
        if (!result.rowCount)
          return res
            .status(404)
            .json({ message: "Additional image not found." });
        res.status(204).end();
      } catch (error) {
        next(error);
      }
    },
  );

  router.patch("/api/products/:id/status", async (req, res, next) => {
    try {
      const status = z.enum(["Active", "Inactive"]).parse(req.body.status);
      const result = useLegacyProducts()
        ? await query(
            "UPDATE alpenwild_product_tbl SET product_status=$1 WHERE product_id=$2 RETURNING product_id AS id",
            [status, req.params.id],
          )
        : await query(
            "UPDATE products SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING id",
            [status, req.params.id],
          );
      if (!result.rowCount)
        return res.status(404).json({ message: "Product not found." });
      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/api/products/:id", async (req, res, next) => {
    try {
      if (useLegacyProducts()) {
        const existingOrders = await query(
          "SELECT 1 FROM alpenwild_order_details_tbl WHERE product_id=$1 LIMIT 1",
          [req.params.id],
        );
        if (existingOrders.rowCount)
          return res.status(409).json({
            message:
              "Order existing under this product. First delete order and then delete this product.",
          });
      }
      const result = useLegacyProducts()
        ? await query(
            "DELETE FROM alpenwild_product_tbl WHERE product_id=$1 RETURNING product_id",
            [req.params.id],
          )
        : await query("DELETE FROM products WHERE id=$1 RETURNING id", [
            req.params.id,
          ]);
      if (!result.rowCount)
        return res
          .status(404)
          .json({ message: "Nothing is deleted successfully" });
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function productUpdateValues(data, bannerName, listingName, id) {
  return [
    data.name,
    data.slug,
    data.category_id,
    data.menu_name,
    data.meta_title,
    data.meta_descriptions,
    data.meta_keywords,
    data.short_descriptions,
    data.description,
    data.price,
    data.banner_title,
    data.banner_sub_title,
    data.tooltip_text,
    bannerName,
    data.banner_alt,
    listingName,
    data.listing_image_alt,
    data.display_order,
    data.status,
    id,
  ];
}
