import { Router } from "express";

export function createProductsRouter({ config, query }) {
  const router = Router();

  function productSelect() {
    return `SELECT p.product_id AS id, p.product_name AS name, p.product_slug AS slug,
      p.category_id, c.category_name AS category_name, p.product_menu_name AS menu_name,
      p.product_meta_title AS meta_title, p.product_meta_descriptions AS meta_descriptions,
      p.product_meta_keywords AS meta_keywords, p.product_short_descriptions AS short_descriptions,
      p.product_description AS description, p.product_price AS price,
      p.product_banner_title AS banner_title, p.product_banner_sub_title AS banner_sub_title,
      p.product_tooltip_text AS tooltip_text, p.product_banner AS banner_image,
      p.product_banner_alt AS banner_alt, p.product_listing_image AS listing_image,
      p.product_listing_image_alt AS listing_image_alt, p.product_order AS display_order,
      p.product_status AS status
      FROM alpenwild_product_tbl p
      LEFT JOIN alpenwild_category_tbl c ON c.category_id = p.category_id`;
  }

  router.get("/api/public-products/:slug", async (req, res, next) => {
    try {
      const result = await query(
        `${productSelect()}
          WHERE p.product_slug=$1 AND p.product_status='Active'
          LIMIT 1`,
        [req.params.slug],
      );
      const product = result.rows[0];
      if (!product)
        return res.status(404).json({ message: "Product not found." });
      const [images, attributes, boxes] = await Promise.all([
        query(
          `SELECT additional_image AS image
             FROM alpenwild_product_additional_image_tbl
            WHERE product_id=$1 AND additional_image<>''
            ORDER BY product_additional_image_id`,
          [product.id],
        ),
        query(
          `SELECT t.attribute_type_id AS type_id,
                  t.attribute_type_name AS type_name,
                  v.attribute_value_id AS value_id,
                  v.attribute_value AS value,
                  v.attribute_value_order AS display_order
             FROM alpenwild_product_attribute_value_tbl pv
             JOIN alpenwild_attribute_type_tbl t
               ON t.attribute_type_id=pv.attribute_type_id
             JOIN alpenwild_attribute_value_tbl v
               ON v.attribute_value_id=pv.attribute_value_id
            WHERE pv.product_id=$1
              AND COALESCE(pv.product_attribute_value_status,'Active')='Active'
              AND t.attribute_type_status='Active'
              AND v.attribute_value_status='Active'
            ORDER BY t.attribute_type_id, v.attribute_value_order, v.attribute_value_id`,
          [product.id],
        ),
        query(
          `SELECT product_box_image AS image,
                  product_box_image_image_alt AS image_alt,
                  product_box_image_title AS title,
                  product_box_image_link AS link
             FROM alpenwild_product_box_image_tbl
            WHERE product_id=$1
            ORDER BY product_box_image_id`,
          [product.id],
        ),
      ]);
      const attributeTypes = new Map();
      for (const row of attributes.rows) {
        const type = attributeTypes.get(row.type_id) || {
          id: row.type_id,
          name: row.type_name,
          values: [],
        };
        type.values.push({ id: row.value_id, value: row.value });
        attributeTypes.set(row.type_id, type);
      }
      res.json({
        ...product,
        listing_image_url: product.listing_image
          ? `/uploads/${config.productUploadSubdir}/listing/${encodeURIComponent(product.listing_image)}`
          : "",
        banner_image_url: product.banner_image
          ? `/uploads/${config.productUploadSubdir}/banner/${encodeURIComponent(product.banner_image)}`
          : "",
        additional_images: images.rows.map(({ image }) => ({
          image,
          image_url: `/uploads/${config.productUploadSubdir}/additional/${encodeURIComponent(image)}`,
        })),
        box_images: boxes.rows.map((box) => ({
          ...box,
          image_url: box.image
            ? `/uploads/${config.productUploadSubdir}/boximage/${encodeURIComponent(box.image)}`
            : "",
        })),
        attribute_types: [...attributeTypes.values()],
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
