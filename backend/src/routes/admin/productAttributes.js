import { Router } from "express";
import { z } from "zod";

const productAttributeSchema = z.object({
  product_id: z.coerce.number().int().positive(),
  type_id: z.coerce.number().int().positive(),
  value_id: z.coerce.number().int().positive(),
  status: z.enum(["Active", "Inactive"]).default("Active"),
});

export function createProductAttributesRouter({
  query,
  useLegacyProductAttributes,
  useLegacyProducts,
  useLegacyAttributeTypes,
  useLegacyAttributeValues,
}) {
  const router = Router();

  function productAttributeSelect() {
    const association = useLegacyProductAttributes()
      ? "alpenwild_product_attribute_value_tbl"
      : "product_attributes";
    const productTable = useLegacyProducts()
      ? "alpenwild_product_tbl"
      : "products";
    const productId = useLegacyProducts() ? "product_id" : "id";
    const productName = useLegacyProducts() ? "product_name" : "name";
    const typeTable = useLegacyAttributeTypes()
      ? "alpenwild_attribute_type_tbl"
      : "attribute_types";
    const typeId = useLegacyAttributeTypes() ? "attribute_type_id" : "id";
    const typeName = useLegacyAttributeTypes() ? "attribute_type_name" : "name";
    const valueTable = useLegacyAttributeValues()
      ? "alpenwild_attribute_value_tbl"
      : "attribute_values";
    const valueId = useLegacyAttributeValues() ? "attribute_value_id" : "id";
    const valueName = useLegacyAttributeValues() ? "attribute_value" : "name";
    return useLegacyProductAttributes()
      ? `SELECT a.product_attribute_value_id AS id, a.product_id,
        a.attribute_type_id AS type_id, a.attribute_value_id AS value_id,
        p.${productName} AS product_name, t.${typeName} AS type_name,
        v.${valueName} AS value_name, 'Active' AS status
       FROM ${association} a
       LEFT JOIN ${productTable} p ON p.${productId}=a.product_id
       LEFT JOIN ${typeTable} t ON t.${typeId}=a.attribute_type_id
       LEFT JOIN ${valueTable} v ON v.${valueId}=a.attribute_value_id`
      : `SELECT a.id, a.product_id, a.type_id, a.value_id,
        p.${productName} AS product_name, t.${typeName} AS type_name,
        v.${valueName} AS value_name, a.status
       FROM ${association} a
       LEFT JOIN ${productTable} p ON p.${productId}=a.product_id
       LEFT JOIN ${typeTable} t ON t.${typeId}=a.type_id
       LEFT JOIN ${valueTable} v ON v.${valueId}=a.value_id`;
  }

  router.get(
    ["/api/product-attributes", "/api/product-attribute-values"],
    async (_req, res, next) => {
      try {
        const result = await query(
          `${productAttributeSelect()} ORDER BY 1 ASC`,
        );
        res.json(result.rows);
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    ["/api/product-attributes", "/api/product-attribute-values"],
    async (req, res, next) => {
      try {
        const data = productAttributeSchema.parse(req.body);
        const duplicate = useLegacyProductAttributes()
          ? await query(
              "SELECT 1 FROM alpenwild_product_attribute_value_tbl WHERE product_id=$1 AND attribute_value_id=$2 LIMIT 1",
              [data.product_id, data.value_id],
            )
          : await query(
              "SELECT 1 FROM product_attributes WHERE product_id=$1 AND value_id=$2 LIMIT 1",
              [data.product_id, data.value_id],
            );
        if (duplicate.rowCount) {
          return res.status(409).json({
            message:
              "Sorry, attribute details is already added under this product. Please use another attribute.",
          });
        }
        const result = useLegacyProductAttributes()
          ? await query(
              `INSERT INTO alpenwild_product_attribute_value_tbl
          (product_id, attribute_type_id, attribute_value_id)
         VALUES ($1, $2, $3)
         RETURNING product_attribute_value_id AS id, product_id,
           attribute_type_id AS type_id, attribute_value_id AS value_id,
           'Active' AS status`,
              [data.product_id, data.type_id, data.value_id],
            )
          : await query(
              `INSERT INTO product_attributes (product_id, type_id, value_id, status)
         VALUES ($1, $2, $3, $4)
         RETURNING id, product_id, type_id, value_id, status`,
              [data.product_id, data.type_id, data.value_id, data.status],
            );
        res.status(201).json(result.rows[0]);
      } catch (error) {
        next(error);
      }
    },
  );

  router.patch(
    ["/api/product-attributes/:id", "/api/product-attribute-values/:id"],
    async (req, res, next) => {
      try {
        const data = productAttributeSchema.parse(req.body);
        const duplicate = useLegacyProductAttributes()
          ? await query(
              `SELECT 1 FROM alpenwild_product_attribute_value_tbl
         WHERE product_id=$1 AND attribute_value_id=$2 AND product_attribute_value_id<>$3 LIMIT 1`,
              [data.product_id, data.value_id, req.params.id],
            )
          : await query(
              "SELECT 1 FROM product_attributes WHERE product_id=$1 AND value_id=$2 AND id<>$3 LIMIT 1",
              [data.product_id, data.value_id, req.params.id],
            );
        if (duplicate.rowCount) {
          return res.status(409).json({
            message:
              "Sorry, attribute details is already added under this product. Please use another attribute.",
          });
        }
        const result = useLegacyProductAttributes()
          ? await query(
              `UPDATE alpenwild_product_attribute_value_tbl SET product_id=$1,
           attribute_type_id=$2, attribute_value_id=$3
         WHERE product_attribute_value_id=$4
         RETURNING product_attribute_value_id AS id, product_id,
           attribute_type_id AS type_id, attribute_value_id AS value_id,
           'Active' AS status`,
              [data.product_id, data.type_id, data.value_id, req.params.id],
            )
          : await query(
              `UPDATE product_attributes SET product_id=$1, type_id=$2, value_id=$3,
           status=$4, updated_at=NOW() WHERE id=$5
         RETURNING id, product_id, type_id, value_id, status`,
              [
                data.product_id,
                data.type_id,
                data.value_id,
                data.status,
                req.params.id,
              ],
            );
        if (!result.rowCount)
          return res
            .status(404)
            .json({ message: "Product attribute not found." });
        res.json(result.rows[0]);
      } catch (error) {
        next(error);
      }
    },
  );

  router.patch(
    [
      "/api/product-attributes/:id/status",
      "/api/product-attribute-values/:id/status",
    ],
    async (req, res, next) => {
      try {
        const status = z.enum(["Active", "Inactive"]).parse(req.body.status);
        const result = useLegacyProductAttributes()
          ? await query(
              `SELECT product_attribute_value_id AS id, product_id,
              attribute_type_id AS type_id, attribute_value_id AS value_id,
              'Active' AS status
             FROM alpenwild_product_attribute_value_tbl
             WHERE product_attribute_value_id=$1`,
              [req.params.id],
            )
          : await query(
              `UPDATE product_attributes SET status=$1, updated_at=NOW()
         WHERE id=$2 RETURNING id, product_id, type_id, value_id, status`,
              [status, req.params.id],
            );
        if (!result.rowCount)
          return res
            .status(404)
            .json({ message: "Product attribute not found." });
        res.json(result.rows[0]);
      } catch (error) {
        next(error);
      }
    },
  );

  router.delete(
    ["/api/product-attributes/:id", "/api/product-attribute-values/:id"],
    async (req, res, next) => {
      try {
        const result = useLegacyProductAttributes()
          ? await query(
              "DELETE FROM alpenwild_product_attribute_value_tbl WHERE product_attribute_value_id=$1 RETURNING product_attribute_value_id",
              [req.params.id],
            )
          : await query(
              "DELETE FROM product_attributes WHERE id=$1 RETURNING id",
              [req.params.id],
            );
        if (!result.rowCount)
          return res
            .status(404)
            .json({ message: "Product attribute not found." });
        res.status(204).end();
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
