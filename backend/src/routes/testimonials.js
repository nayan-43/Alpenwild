import { Router } from "express";
import { z } from "zod";

const testimonialSchema = z.object({
  trip_id: z.preprocess(
    (value) => (value === "" || value === undefined ? null : value),
    z.coerce.number().int().positive().nullable().default(null),
  ),
  client_details: z.string().trim().min(1).max(255),
  content: z.string().trim().min(1).max(30000),
  display_order: z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    z.coerce.number().int(),
  ),
  status: z.enum(["Active", "Inactive"]).default("Active"),
});

export function createTestimonialsRouter({ query, useLegacyTestimonials }) {
  const router = Router();

  function testimonialSelect() {
    return useLegacyTestimonials()
      ? `SELECT testimonial_id AS id, trips_id AS trip_id,
          testimonial_client_details AS client_details,
          testimonial_content AS content, testimonial_order AS display_order,
          testimonial_status AS status
         FROM alpenwild_testimonial_tbl`
      : `SELECT id, trip_id, client_details, content, display_order, status
         FROM testimonials`;
  }

  function testimonialTableName() {
    return useLegacyTestimonials()
      ? "alpenwild_testimonial_tbl"
      : "testimonials";
  }

  function testimonialIdColumn() {
    return useLegacyTestimonials() ? "testimonial_id" : "id";
  }

  function testimonialOrderColumn() {
    return useLegacyTestimonials() ? "testimonial_order" : "display_order";
  }

  async function shiftTestimonialOrders(order, direction, bounds = {}) {
    const table = testimonialTableName();
    const orderColumn = testimonialOrderColumn();
    const conditions =
      direction === "up"
        ? `${orderColumn} >= $1${bounds.before ? ` AND ${orderColumn} < $2` : ""}`
        : `${orderColumn} > $1${bounds.through ? ` AND ${orderColumn} <= $2` : ""}`;
    const values =
      bounds.before || bounds.through ? [order, bounds.bound] : [order];
    await query(
      `UPDATE ${table} SET ${orderColumn} = ${orderColumn} ${direction === "up" ? "+" : "-"} 1 WHERE ${conditions}`,
      values,
    );
  }

  router.get("/api/testimonials", async (_req, res, next) => {
    try {
      const result = await query(
        `${testimonialSelect()} ORDER BY display_order ASC, id ASC`,
      );
      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/testimonials", async (req, res, next) => {
    try {
      const data = testimonialSchema.parse(req.body);

      await shiftTestimonialOrders(data.display_order, "up");
      const result = useLegacyTestimonials()
        ? await query(
            `INSERT INTO alpenwild_testimonial_tbl
               (trips_id, testimonial_client_details, testimonial_content,
                testimonial_order, testimonial_status)
             VALUES ($1,$2,$3,$4,$5)
             RETURNING testimonial_id AS id, trips_id AS trip_id,
               testimonial_client_details AS client_details,
               testimonial_content AS content, testimonial_order AS display_order,
               testimonial_status AS status`,
            [
              data.trip_id || 0,
              data.client_details,
              data.content,
              data.display_order,
              data.status,
            ],
          )
        : await query(
            `INSERT INTO testimonials
               (trip_id, client_details, content, display_order, status)
             VALUES ($1,$2,$3,$4,$5) RETURNING id, trip_id, client_details,
               content, display_order, status`,
            [
              data.trip_id,
              data.client_details,
              data.content,
              data.display_order,
              data.status,
            ],
          );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/testimonials/:id", async (req, res, next) => {
    try {
      const data = testimonialSchema.parse(req.body);

      const idColumn = testimonialIdColumn();
      const current = await query(
        `SELECT ${testimonialOrderColumn()} AS display_order FROM ${testimonialTableName()} WHERE ${idColumn}=$1`,
        [req.params.id],
      );
      if (!current.rowCount)
        return res.status(404).json({ message: "Testimonial not found." });
      const oldOrder = Number(current.rows[0].display_order);
      if (data.display_order < oldOrder) {
        await shiftTestimonialOrders(data.display_order, "up", {
          before: true,
          bound: oldOrder,
        });
      } else if (data.display_order > oldOrder) {
        await shiftTestimonialOrders(oldOrder, "down", {
          through: true,
          bound: data.display_order,
        });
      }
      const result = useLegacyTestimonials()
        ? await query(
            `UPDATE alpenwild_testimonial_tbl
             SET trips_id=$1, testimonial_client_details=$2,
               testimonial_content=$3, testimonial_order=$4,
               testimonial_status=$5
             WHERE testimonial_id=$6
             RETURNING testimonial_id AS id, trips_id AS trip_id,
               testimonial_client_details AS client_details,
               testimonial_content AS content, testimonial_order AS display_order,
               testimonial_status AS status`,
            [
              data.trip_id || 0,
              data.client_details,
              data.content,
              data.display_order,
              data.status,
              req.params.id,
            ],
          )
        : await query(
            `UPDATE testimonials SET trip_id=$1, client_details=$2, content=$3,
               display_order=$4, status=$5, updated_at=NOW()
             WHERE id=$6 RETURNING id, trip_id, client_details, content,
               display_order, status`,
            [
              data.trip_id,
              data.client_details,
              data.content,
              data.display_order,
              data.status,
              req.params.id,
            ],
          );
      if (!result.rowCount)
        return res.status(404).json({ message: "Testimonial not found." });
      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/testimonials/:id/status", async (req, res, next) => {
    try {
      const status = z.enum(["Active", "Inactive"]).parse(req.body.status);

      const result = useLegacyTestimonials()
        ? await query(
            `UPDATE alpenwild_testimonial_tbl SET testimonial_status=$1
             WHERE testimonial_id=$2
             RETURNING testimonial_id AS id, trips_id AS trip_id,
               testimonial_client_details AS client_details,
               testimonial_content AS content, testimonial_order AS display_order,
               testimonial_status AS status`,
            [status, req.params.id],
          )
        : await query(
            `UPDATE testimonials SET status=$1, updated_at=NOW() WHERE id=$2
             RETURNING id, trip_id, client_details, content, display_order, status`,
            [status, req.params.id],
          );
      if (!result.rowCount)
        return res.status(404).json({ message: "Testimonial not found." });
      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/api/testimonials/:id", async (req, res, next) => {
    try {
      const idColumn = testimonialIdColumn();
      const orderColumn = testimonialOrderColumn();
      const result = await query(
        `DELETE FROM ${testimonialTableName()} WHERE ${idColumn}=$1 RETURNING ${orderColumn} AS display_order`,
        [req.params.id],
      );
      if (!result.rowCount)
        return res
          .status(404)
          .json({ message: "Nothing is deleted successfully" });
      await query(
        `UPDATE ${testimonialTableName()} SET ${orderColumn}=${orderColumn}-1 WHERE ${orderColumn} > $1`,
        [result.rows[0].display_order],
      );
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
