import { Router } from "express";
import { z } from "zod";

const discountSchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    code: z.string().trim().min(1).max(255),
    type: z.enum(["Fixed", "Percentage"]),
    value: z.preprocess(
      (value) =>
        typeof value === "string" && /^[+-]?\d+$/.test(value)
          ? Number(value)
          : value,
      z.number().int(),
    ),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    status: z.enum(["Active", "Inactive"]).default("Active"),
  })
  .superRefine((data, context) => {
    if (data.end_date < data.start_date) {
      context.addIssue({
        code: "custom",
        path: ["end_date"],
        message: "End date must be on or after the start date.",
      });
    }
  });

export function createDiscountsRouter({ query, useLegacyDiscounts }) {
  const router = Router();

  const discountColumns = () =>
    useLegacyDiscounts()
      ? {
          table: "alpenwild_discount_tbl",
          id: "discount_id",
          code: "discount_code",
        }
      : { table: "discounts", id: "id", code: "code" };

  router.get("/api/discounts", async (_req, res, next) => {
    try {
      const result = useLegacyDiscounts()
        ? await query(`SELECT discount_id AS id, discount_name AS name, discount_code AS code,
            discount_type AS type, discount_value AS value, discount_start_date AS start_date,
            discount_end_date AS end_date, discount_status AS status
           FROM alpenwild_discount_tbl ORDER BY discount_id ASC`)
        : await query(
            "SELECT id, name, code, type, value, start_date, end_date, status FROM discounts ORDER BY id ASC",
          );
      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/discount-check", async (req, res, next) => {
    try {
      const code = z
        .string()
        .trim()
        .max(255)
        .parse(req.body?.discount_code || "");
      if (!code)
        return res.json({
          success: false,
          message: "Please enter voucher code",
        });
      const result = useLegacyDiscounts()
        ? await query(
            `SELECT discount_status AS status, discount_type AS type,
                    discount_value AS value,
                    discount_start_date AS start_date,
                    discount_end_date AS end_date
               FROM alpenwild_discount_tbl
              WHERE discount_code=$1
              LIMIT 1`,
            [code],
          )
        : await query(
            `SELECT status, type, value, start_date, end_date
               FROM discounts
              WHERE code=$1
              LIMIT 1`,
            [code],
          );
      const discount = result.rows[0];
      if (!discount || discount.status !== "Active")
        return res.json({
          success: false,
          message: "You have entered an wrong voucher code.",
        });
      const today = new Date().toISOString().slice(0, 10);
      if (String(discount.start_date).slice(0, 10) > today)
        return res.json({
          success: false,
          message: "You have entered an invalid voucher code.",
        });
      if (String(discount.end_date).slice(0, 10) < today)
        return res.json({
          success: false,
          message: "You have entered an expired voucher code..",
        });
      res.json({
        success: true,
        type: discount.type,
        value: Number(discount.value || 0),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/discounts", async (req, res, next) => {
    try {
      const data = discountSchema.parse(req.body);
      const columns = discountColumns();
      const duplicate = await query(
        `SELECT 1 FROM ${columns.table}
         WHERE LOWER(${columns.code})=LOWER($1) LIMIT 1`,
        [data.code],
      );
      if (duplicate.rowCount)
        return res.status(409).json({
          message: "Discount code is already added. Please use another code.",
        });
      const result = useLegacyDiscounts()
        ? await query(
            `INSERT INTO alpenwild_discount_tbl
            (discount_name, discount_code, discount_start_date, discount_end_date,
             discount_type, discount_value, discount_status)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           RETURNING discount_id AS id, discount_name AS name, discount_code AS code,
            discount_type AS type, discount_value AS value, discount_start_date AS start_date,
            discount_end_date AS end_date, discount_status AS status`,
            [
              data.name,
              data.code,
              data.start_date,
              data.end_date,
              data.type,
              data.value,
              data.status,
            ],
          )
        : await query(
            `INSERT INTO discounts
            (name, code, type, value, start_date, end_date, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [
              data.name,
              data.code,
              data.type,
              data.value,
              data.start_date,
              data.end_date,
              data.status,
            ],
          );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/discounts/:id", async (req, res, next) => {
    try {
      const data = discountSchema.parse(req.body);
      const columns = discountColumns();
      const duplicate = await query(
        `SELECT 1 FROM ${columns.table}
         WHERE LOWER(${columns.code})=LOWER($1) AND ${columns.id}<>$2 LIMIT 1`,
        [data.code, req.params.id],
      );
      if (duplicate.rowCount)
        return res.status(409).json({
          message: "Discount code is already added. Please use another code.",
        });
      const existing = useLegacyDiscounts()
        ? await query(
            `SELECT discount_name AS name, discount_code AS code,
                discount_type AS type, discount_value AS value,
                discount_start_date AS start_date, discount_end_date AS end_date,
                discount_status AS status
             FROM alpenwild_discount_tbl WHERE discount_id=$1`,
            [req.params.id],
          )
        : await query(
            `SELECT name, code, type, value, start_date, end_date, status
             FROM discounts WHERE id=$1`,
            [req.params.id],
          );
      if (!existing.rowCount)
        return res.status(404).json({ message: "Discount not found." });
      const current = existing.rows[0];
      const unchanged =
        current.name === data.name &&
        current.code === data.code &&
        current.type === data.type &&
        Number(current.value) === data.value &&
        String(current.start_date).slice(0, 10) === data.start_date &&
        String(current.end_date).slice(0, 10) === data.end_date &&
        current.status === data.status;
      if (unchanged)
        return res.json({
          unchanged: true,
          message: "Sorry, nothing is updated.",
        });
      const result = useLegacyDiscounts()
        ? await query(
            `UPDATE alpenwild_discount_tbl SET discount_name=$1, discount_code=$2,
            discount_start_date=$3, discount_end_date=$4, discount_type=$5,
            discount_value=$6, discount_status=$7 WHERE discount_id=$8
           RETURNING discount_id AS id, discount_name AS name, discount_code AS code,
            discount_type AS type, discount_value AS value, discount_start_date AS start_date,
            discount_end_date AS end_date, discount_status AS status`,
            [
              data.name,
              data.code,
              data.start_date,
              data.end_date,
              data.type,
              data.value,
              data.status,
              req.params.id,
            ],
          )
        : await query(
            `UPDATE discounts SET name=$1, code=$2, type=$3, value=$4,
            start_date=$5, end_date=$6, status=$7, updated_at=NOW() WHERE id=$8 RETURNING *`,
            [
              data.name,
              data.code,
              data.type,
              data.value,
              data.start_date,
              data.end_date,
              data.status,
              req.params.id,
            ],
          );
      if (!result.rowCount)
        return res.status(404).json({ message: "Discount not found." });
      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/discounts/:id/status", async (req, res, next) => {
    try {
      const status = z.enum(["Active", "Inactive"]).parse(req.body.status);
      const result = useLegacyDiscounts()
        ? await query(
            `UPDATE alpenwild_discount_tbl SET discount_status=$1 WHERE discount_id=$2
           RETURNING discount_id AS id, discount_name AS name, discount_code AS code,
            discount_type AS type, discount_value AS value, discount_start_date AS start_date,
            discount_end_date AS end_date, discount_status AS status`,
            [status, req.params.id],
          )
        : await query(
            "UPDATE discounts SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *",
            [status, req.params.id],
          );
      if (!result.rowCount)
        return res.status(404).json({ message: "Discount not found." });
      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/api/discounts/:id", async (req, res, next) => {
    try {
      const result = useLegacyDiscounts()
        ? await query(
            "DELETE FROM alpenwild_discount_tbl WHERE discount_id=$1 RETURNING discount_id",
            [req.params.id],
          )
        : await query("DELETE FROM discounts WHERE id=$1 RETURNING id", [
            req.params.id,
          ]);
      if (!result.rowCount)
        return res.status(404).json({ message: "Discount not found." });
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
