import { Router } from "express";
import { z } from "zod";

export function createAdminMakePaymentsRouter({ query }) {
  const router = Router();

  router.get("/api/make-payments", async (_req, res, next) => {
    try {
      const result = await query(
        `SELECT pid AS id, name_on_card, bill_address, city, state,
          zip_code, email_address, amount
        FROM alpenwild_makepayment_tbl ORDER BY pid DESC`,
      );
      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/api/make-payments/:paymentId", async (req, res, next) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.paymentId);
      const result = await query(
        "DELETE FROM alpenwild_makepayment_tbl WHERE pid=$1 RETURNING pid",
        [id],
      );
      if (!result.rows[0])
        return res.status(404).json({ message: "Payment not found." });
      res.json({ message: "Payment details deleted successfully." });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
