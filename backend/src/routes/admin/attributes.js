import { Router } from "express";
import { z } from "zod";

const attributeValueSchema = z.object({
  type_id: z.coerce.number().int().positive(),
  name: z.string().trim().min(1).max(255),
  display_order: z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    z.coerce.number().int(),
  ),
  status: z.enum(["Active", "Inactive"]).default("Active"),
});

export function createAttributesRouter({
  query,
  simpleNameSchema,
  useLegacyAttributeTypes,
  useLegacyAttributeValues,
  useLegacyProductAttributes,
}) {
  const router = Router();

  function attributeValueStorage() {
    return useLegacyAttributeValues()
      ? {
          table: "alpenwild_attribute_value_tbl",
          id: "attribute_value_id",
          type: "attribute_type_id",
          name: "attribute_value",
          order: "attribute_value_order",
          status: "attribute_value_status",
        }
      : {
          table: "attribute_values",
          id: "id",
          type: "type_id",
          name: "name",
          order: "display_order",
          status: "status",
        };
  }

  router.get("/api/attribute-types", async (_req, res, next) => {
    try {
      const result = useLegacyAttributeTypes()
        ? await query(
            "SELECT attribute_type_id AS id, attribute_type_name AS name, attribute_type_status AS status FROM alpenwild_attribute_type_tbl ORDER BY attribute_type_id ASC",
          )
        : await query(
            "SELECT id, name, status FROM attribute_types ORDER BY id ASC",
          );
      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/attribute-types", async (req, res, next) => {
    try {
      const data = simpleNameSchema.parse(req.body);
      const duplicate = useLegacyAttributeTypes()
        ? await query(
            "SELECT 1 FROM alpenwild_attribute_type_tbl WHERE LOWER(attribute_type_name)=LOWER($1) LIMIT 1",
            [data.name],
          )
        : await query(
            "SELECT 1 FROM attribute_types WHERE LOWER(name)=LOWER($1) LIMIT 1",
            [data.name],
          );
      if (duplicate.rowCount)
        return res.status(409).json({
          message:
            "Sorry, attribute_type name is already added. Please use another name.",
        });
      const result = useLegacyAttributeTypes()
        ? await query(
            "INSERT INTO alpenwild_attribute_type_tbl (attribute_type_name, attribute_type_status) VALUES ($1, $2) RETURNING attribute_type_id AS id, attribute_type_name AS name, attribute_type_status AS status",
            [data.name, data.status],
          )
        : await query(
            "INSERT INTO attribute_types (name, status) VALUES ($1, $2) RETURNING id, name, status",
            [data.name, data.status],
          );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/attribute-types/:id", async (req, res, next) => {
    try {
      const data = simpleNameSchema.parse(req.body);
      const duplicate = useLegacyAttributeTypes()
        ? await query(
            "SELECT 1 FROM alpenwild_attribute_type_tbl WHERE LOWER(attribute_type_name)=LOWER($1) AND attribute_type_id<>$2 LIMIT 1",
            [data.name, req.params.id],
          )
        : await query(
            "SELECT 1 FROM attribute_types WHERE LOWER(name)=LOWER($1) AND id<>$2 LIMIT 1",
            [data.name, req.params.id],
          );
      if (duplicate.rowCount)
        return res.status(409).json({
          message:
            "Sorry, attribute_type name is already added. Please use another name.",
        });
      const result = useLegacyAttributeTypes()
        ? await query(
            "UPDATE alpenwild_attribute_type_tbl SET attribute_type_name=$1, attribute_type_status=$2 WHERE attribute_type_id=$3 RETURNING attribute_type_id AS id, attribute_type_name AS name, attribute_type_status AS status",
            [data.name, data.status, req.params.id],
          )
        : await query(
            "UPDATE attribute_types SET name=$1, status=$2, updated_at=NOW() WHERE id=$3 RETURNING id, name, status",
            [data.name, data.status, req.params.id],
          );
      if (!result.rowCount)
        return res.status(404).json({ message: "Attribute type not found." });
      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/attribute-types/:id/status", async (req, res, next) => {
    try {
      const status = z.enum(["Active", "Inactive"]).parse(req.body.status);
      const result = useLegacyAttributeTypes()
        ? await query(
            "UPDATE alpenwild_attribute_type_tbl SET attribute_type_status=$1 WHERE attribute_type_id=$2 RETURNING attribute_type_id AS id, attribute_type_name AS name, attribute_type_status AS status",
            [status, req.params.id],
          )
        : await query(
            "UPDATE attribute_types SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING id, name, status",
            [status, req.params.id],
          );
      if (!result.rowCount)
        return res.status(404).json({ message: "Attribute type not found." });
      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/api/attribute-types/:id", async (req, res, next) => {
    try {
      if (useLegacyAttributeTypes()) {
        const linked = await query(
          "SELECT 1 FROM alpenwild_attribute_value_tbl WHERE attribute_type_id=$1 LIMIT 1",
          [req.params.id],
        );
        if (linked.rowCount)
          return res.status(409).json({
            message:
              "Value existing under this attribute type. First delete value and then delete this attribute type.",
          });
        const result = await query(
          "DELETE FROM alpenwild_attribute_type_tbl WHERE attribute_type_id=$1 RETURNING attribute_type_id",
          [req.params.id],
        );
        if (!result.rowCount)
          return res.status(404).json({ message: "Attribute type not found." });
        return res.status(204).end();
      }
      const result = await query(
        "DELETE FROM attribute_types WHERE id=$1 RETURNING id",
        [req.params.id],
      );
      if (!result.rowCount)
        return res.status(404).json({ message: "Attribute type not found." });
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/attribute-values", async (_req, res, next) => {
    try {
      const result = useLegacyAttributeValues()
        ? await query(`SELECT v.attribute_value_id AS id, v.attribute_type_id AS type_id,
            t.attribute_type_name AS type_name, v.attribute_value AS name,
            v.attribute_value_order AS display_order, v.attribute_value_status AS status
           FROM alpenwild_attribute_value_tbl v
           LEFT JOIN alpenwild_attribute_type_tbl t ON t.attribute_type_id = v.attribute_type_id
           ORDER BY v.attribute_value_order ASC, v.attribute_value_id ASC`)
        : await query(`SELECT v.id, v.type_id, t.name AS type_name, v.name,
            v.display_order, v.status
           FROM attribute_values v
           LEFT JOIN attribute_types t ON t.id = v.type_id
           ORDER BY v.display_order ASC, v.id ASC`);
      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/attribute-values", async (req, res, next) => {
    try {
      const data = attributeValueSchema.parse(req.body);
      const storage = attributeValueStorage();
      const duplicate = useLegacyAttributeValues()
        ? await query(
            "SELECT 1 FROM alpenwild_attribute_value_tbl WHERE LOWER(attribute_value)=LOWER($1) LIMIT 1",
            [data.name],
          )
        : await query(
            "SELECT 1 FROM attribute_values WHERE LOWER(name)=LOWER($1) LIMIT 1",
            [data.name],
          );
      if (duplicate.rowCount)
        return res.status(409).json({
          message: "Sorry, name is already added. Please use another name.",
        });
      await query(
        `UPDATE ${storage.table}
         SET ${storage.order}=${storage.order}+1
         WHERE ${storage.type}=$1 AND ${storage.order}>=$2`,
        [data.type_id, data.display_order],
      );
      const result = await query(
        `INSERT INTO ${storage.table}
         (${storage.type}, ${storage.name}, ${storage.order}, ${storage.status})
         VALUES ($1, $2, $3, $4)
         RETURNING ${storage.id} AS id, ${storage.type} AS type_id,
           ${storage.name} AS name, ${storage.order} AS display_order,
           ${storage.status} AS status`,
        [data.type_id, data.name, data.display_order, data.status],
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/attribute-values/:id", async (req, res, next) => {
    try {
      const data = attributeValueSchema.parse(req.body);
      const storage = attributeValueStorage();
      const duplicate = useLegacyAttributeValues()
        ? await query(
            `SELECT 1 FROM alpenwild_attribute_value_tbl
             WHERE LOWER(attribute_value)=LOWER($1) AND attribute_value_id<>$2 LIMIT 1`,
            [data.name, req.params.id],
          )
        : await query(
            `SELECT 1 FROM attribute_values
             WHERE LOWER(name)=LOWER($1) AND id<>$2 LIMIT 1`,
            [data.name, req.params.id],
          );
      if (duplicate.rowCount)
        return res.status(409).json({
          message: "Sorry, name is already added. Please use another name.",
        });
      const current = await query(
        `SELECT ${storage.order} AS display_order
         FROM ${storage.table} WHERE ${storage.id}=$1`,
        [req.params.id],
      );
      if (!current.rowCount)
        return res.status(404).json({ message: "Attribute value not found." });
      const oldOrder = Number(current.rows[0].display_order);
      if (data.display_order < oldOrder) {
        await query(
          `UPDATE ${storage.table}
           SET ${storage.order}=${storage.order}+1
           WHERE ${storage.type}=$1 AND ${storage.order}>=$2 AND ${storage.order}<$3`,
          [data.type_id, data.display_order, oldOrder],
        );
      } else if (data.display_order > oldOrder) {
        await query(
          `UPDATE ${storage.table}
           SET ${storage.order}=${storage.order}-1
           WHERE ${storage.type}=$1 AND ${storage.order}>$2 AND ${storage.order}<=$3`,
          [data.type_id, oldOrder, data.display_order],
        );
      }
      const result = await query(
        `UPDATE ${storage.table}
         SET ${storage.type}=$1, ${storage.name}=$2, ${storage.order}=$3,
           ${storage.status}=$4
         ${useLegacyAttributeValues() ? "" : ", updated_at=NOW()"}
         WHERE ${storage.id}=$5
         RETURNING ${storage.id} AS id, ${storage.type} AS type_id,
           ${storage.name} AS name, ${storage.order} AS display_order,
           ${storage.status} AS status`,
        [
          data.type_id,
          data.name,
          data.display_order,
          data.status,
          req.params.id,
        ],
      );
      if (!result.rowCount)
        return res.status(404).json({ message: "Attribute value not found." });
      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/attribute-values/:id/status", async (req, res, next) => {
    try {
      const status = z.enum(["Active", "Inactive"]).parse(req.body.status);
      const result = useLegacyAttributeValues()
        ? await query(
            `UPDATE alpenwild_attribute_value_tbl SET attribute_value_status=$1
            WHERE attribute_value_id=$2
            RETURNING attribute_value_id AS id, attribute_type_id AS type_id,
              attribute_value AS name, attribute_value_order AS display_order,
              attribute_value_status AS status`,
            [status, req.params.id],
          )
        : await query(
            `UPDATE attribute_values SET status=$1, updated_at=NOW()
            WHERE id=$2 RETURNING id, type_id, name, display_order, status`,
            [status, req.params.id],
          );
      if (!result.rowCount)
        return res.status(404).json({ message: "Attribute value not found." });
      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/api/attribute-values/:id", async (req, res, next) => {
    try {
      const associationTable = useLegacyProductAttributes()
        ? "alpenwild_product_attribute_value_tbl"
        : "product_attributes";
      const valueColumn = useLegacyProductAttributes()
        ? "attribute_value_id"
        : "value_id";
      const inUse = await query(
        `SELECT 1 FROM ${associationTable} WHERE ${valueColumn}=$1 LIMIT 1`,
        [req.params.id],
      );
      if (inUse.rowCount)
        return res.status(409).json({
          message:
            "Some of the product(s) use this attribute value. First remove this attribute value from the product(s) and then delete this attribute value.",
        });
      const result = useLegacyAttributeValues()
        ? await query(
            "DELETE FROM alpenwild_attribute_value_tbl WHERE attribute_value_id=$1 RETURNING attribute_value_id",
            [req.params.id],
          )
        : await query("DELETE FROM attribute_values WHERE id=$1 RETURNING id", [
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
