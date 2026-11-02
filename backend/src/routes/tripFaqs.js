import { Router } from "express";
import { z } from "zod";

const tripFaqSchema = z.object({
  question: z.string().trim().min(1).max(10000),
  answer: z.string().trim().min(1).max(30000),
});

export function createTripFaqsRouter({ query }) {
  const router = Router();

  router.get("/api/trip-faqs/:tripId", async (req, res, next) => {
    try {
      const result = await query(
        `SELECT id, question, answer, faq_order
         FROM alpenwild_faq_page_tbl
         WHERE static_page_id=$1
         ORDER BY faq_order ASC, id DESC`,
        [req.params.tripId],
      );
      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/trip-faqs/:tripId", async (req, res, next) => {
    try {
      const data = tripFaqSchema.parse(req.body);
      const result = await query(
        `INSERT INTO alpenwild_faq_page_tbl (question,answer,static_page_id,faq_order)
         VALUES ($1,$2,$3,COALESCE((SELECT MAX(faq_order) + 1 FROM alpenwild_faq_page_tbl WHERE static_page_id=$4),1))
         RETURNING id, question, answer, faq_order`,
        [data.question, data.answer, req.params.tripId, req.params.tripId],
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  });

  router.put("/api/trip-faqs/:tripId/:id", async (req, res, next) => {
    try {
      const data = tripFaqSchema.parse(req.body);
      const result = await query(
        `UPDATE alpenwild_faq_page_tbl SET question=$1, answer=$2
         WHERE id=$3 AND static_page_id=$4
         RETURNING id, question, answer, faq_order`,
        [data.question, data.answer, req.params.id, req.params.tripId],
      );
      if (!result.rowCount)
        return res.status(404).json({ message: "FAQ not found." });
      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/api/trip-faqs/:tripId/:id", async (req, res, next) => {
    try {
      await query(
        "DELETE FROM alpenwild_faq_page_tbl WHERE id=$1 AND static_page_id=$2",
        [req.params.id, req.params.tripId],
      );
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
