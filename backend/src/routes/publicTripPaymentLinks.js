import { Router } from "express";
import { z } from "zod";

export function createPublicTripPaymentLinksRouter({
  query,
  isValidPaymentLinkSignature,
}) {
  const router = Router();

  router.get(
    "/api/public-trip-payment-links/:bookingId",
    async (req, res, next) => {
      try {
        const bookingId = z.coerce
          .number()
          .int()
          .positive()
          .parse(req.params.bookingId);
        const type = z
          .enum(["due", "custom", "define_admin"])
          .parse(req.query.type);
        const amount =
          type === "define_admin"
            ? z.coerce.number().finite().positive().parse(req.query.adminamount)
            : "";
        if (
          !isValidPaymentLinkSignature(
            bookingId,
            type,
            amount,
            req.query.signature,
          )
        )
          return res
            .status(400)
            .json({ message: "This payment link is invalid." });

        const result = await query(
          `SELECT b.trips_booking_id AS booking_id, b.trips_id AS trip_id,
          b.trip_payment_due AS due, t.trips_name AS trip_name,
          u.user_email_address AS email
         FROM alpenwild_trips_booking_tbl b
         JOIN alpenwild_trips_tbl t ON t.trips_id=b.trips_id
         JOIN alpenwild_user_tbl u ON u.user_id=b.user_id
        WHERE b.trips_booking_id=$1
          AND b.trips_booking_status='Active'
          AND COALESCE(b.trip_payment_due, 0) > 0`,
          [bookingId],
        );
        const booking = result.rows[0];
        if (!booking)
          return res.status(404).json({
            message: "This payment link has no active booking balance.",
          });
        const due = Number(booking.due);
        if (type === "define_admin" && amount > due)
          return res.status(400).json({
            message: "Payment amount cannot exceed the outstanding balance.",
          });
        res.json({
          booking_id: Number(booking.booking_id),
          trip_id: Number(booking.trip_id),
          trip_name: booking.trip_name,
          email: booking.email,
          due,
          type,
          amount:
            type === "due" ? due : type === "define_admin" ? amount : null,
          signature: req.query.signature,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
