import { Router } from "express";
import { z } from "zod";

export function createAdminTripBookingManagementRouter({ query }) {
  const router = Router();

  router.patch(
    "/api/trip-bookings/:bookingId/status",
    async (req, res, next) => {
      try {
        const id = z.coerce
          .number()
          .int()
          .positive()
          .parse(req.params.bookingId);
        const status = z
          .string()
          .trim()
          .min(1)
          .max(100)
          .parse(req.body?.status);
        const result = await query(
          `UPDATE alpenwild_trips_booking_tbl
       SET trips_booking_status=$1
       WHERE trips_booking_id=$2
       RETURNING trips_booking_status AS status`,
          [status, id],
        );
        if (!result.rows[0])
          return res.status(404).json({ message: "Booking not found." });
        res.json({
          message: "Booking status updated successfully.",
          status: result.rows[0].status,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.delete("/api/trip-bookings/:bookingId", async (req, res, next) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.bookingId);
      const result = await query(
        `DELETE FROM alpenwild_trips_booking_tbl
       WHERE trips_booking_id=$1
       RETURNING trips_booking_id`,
        [id],
      );
      if (!result.rows[0])
        return res.status(404).json({ message: "Booking not found." });
      res.json({ message: "Booking deleted successfully." });
    } catch (error) {
      next(error);
    }
  });

  router.patch(
    "/api/trip-bookings/:bookingId/payments",
    async (req, res, next) => {
      try {
        const bookingId = z.coerce
          .number()
          .int()
          .positive()
          .parse(req.params.bookingId);
        const payments = z
          .array(
            z.object({
              id: z.coerce.number().int().positive(),
              amount: z.coerce.number().min(0),
              payment_date: z.string().min(1),
            }),
          )
          .parse(req.body.payments);
        const bookingResult = await query(
          `SELECT trip_payment_due FROM alpenwild_trips_booking_tbl WHERE trips_booking_id=$1`,
          [bookingId],
        );
        if (!bookingResult.rows[0])
          return res.status(404).json({ message: "Booking not found." });
        let oldTotal = 0;
        let newTotal = 0;
        for (const payment of payments) {
          const current = await query(
            `SELECT payment_price FROM alpenwild_trips_payment_tbl WHERE trips_payment_id=$1 AND trips_booking_id=$2`,
            [payment.id, bookingId],
          );
          if (!current.rows[0]) continue;
          oldTotal += Number(current.rows[0].payment_price || 0);
          newTotal += payment.amount;
          await query(
            `UPDATE alpenwild_trips_payment_tbl SET payment_price=$1, payment_date=$2 WHERE trips_payment_id=$3 AND trips_booking_id=$4`,
            [payment.amount, payment.payment_date, payment.id, bookingId],
          );
        }
        const due =
          Number(bookingResult.rows[0].trip_payment_due || 0) +
          oldTotal -
          newTotal;
        await query(
          `UPDATE alpenwild_trips_booking_tbl SET trip_payment_due=$1 WHERE trips_booking_id=$2`,
          [Math.max(0, due), bookingId],
        );
        res.json({ message: "Payment details updated successfully." });
      } catch (error) {
        next(error);
      }
    },
  );

  router.delete("/api/trip-payments/:paymentId", async (req, res, next) => {
    try {
      const paymentId = z.coerce
        .number()
        .int()
        .positive()
        .parse(req.params.paymentId);
      const payment = await query(
        `DELETE FROM alpenwild_trips_payment_tbl
       WHERE trips_payment_id=$1
       RETURNING trips_booking_id AS booking_id, payment_price AS amount`,
        [paymentId],
      );
      if (!payment.rows[0])
        return res.status(404).json({ message: "Payment not found." });
      await query(
        `UPDATE alpenwild_trips_booking_tbl
       SET trip_payment_due=COALESCE(trip_payment_due, 0) + $1
       WHERE trips_booking_id=$2`,
        [payment.rows[0].amount || 0, payment.rows[0].booking_id],
      );
      res.json({ message: "Payment details deleted successfully." });
    } catch (error) {
      next(error);
    }
  });

  router.get(
    "/api/trip-bookings/:bookingId/refunds",
    async (req, res, next) => {
      try {
        const bookingId = z.coerce
          .number()
          .int()
          .positive()
          .parse(req.params.bookingId);
        const result = await query(
          `SELECT p.trips_payment_id AS payment_id, p.payment_price, p.payment_date,
          p.payment_status, p.transaction_id, COALESCE(p.refunded_amount, 0) AS refunded_amount,
          COALESCE(p.refund_status, '') AS refund_status,
          GREATEST(p.payment_price - COALESCE(p.refunded_amount, 0), 0) AS refundable_balance
       FROM alpenwild_trips_payment_tbl p WHERE p.trips_booking_id=$1 ORDER BY p.payment_date ASC`,
          [bookingId],
        );
        res.json(result.rows);
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
