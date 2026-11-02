import { Router } from "express";
import { z } from "zod";

export function createAdminTripBookingPaymentLinksRouter({
  query,
  config,
  mailer,
  paymentLinkSignature,
  getSiteTitle,
}) {
  const router = Router();

  router.post(
    "/api/trip-bookings/:bookingId/payment-link",
    async (req, res, next) => {
      try {
        if (!mailer)
          return res
            .status(503)
            .json({ message: "SMTP email is not configured." });
        const bookingId = z.coerce
          .number()
          .int()
          .positive()
          .parse(req.params.bookingId);
        const type = z
          .enum(["due", "custom", "define_admin"])
          .parse(req.body?.type || "due");
        const requestedAmount =
          req.body?.amount == null || req.body.amount === ""
            ? null
            : z.coerce.number().positive().parse(req.body.amount);
        const result = await query(
          `SELECT b.user_first_name, u.user_email_address, b.user_shipping_email_address, b.trip_payment_due, t.trips_name FROM alpenwild_trips_booking_tbl b LEFT JOIN alpenwild_user_tbl u ON u.user_id=b.user_id LEFT JOIN alpenwild_trips_tbl t ON t.trips_id=b.trips_id WHERE b.trips_booking_id=$1`,
          [bookingId],
        );
        const booking = result.rows[0];
        if (!booking)
          return res.status(404).json({ message: "Booking not found." });
        const recipient =
          booking.user_email_address || booking.user_shipping_email_address;
        if (!recipient)
          return res
            .status(400)
            .json({ message: "Booking has no email address." });
        const amount =
          type === "due"
            ? Number(booking.trip_payment_due || 0)
            : requestedAmount;
        if (!amount || amount <= 0)
          return res
            .status(400)
            .json({ message: "Payment amount must be greater than zero." });
        const clientOrigin =
          config.clientOrigin === true
            ? `${req.protocol}://${req.get("host")}`
            : String(config.clientOrigin);
        const paymentUrl = `${clientOrigin.replace(/\/$/, "")}/staticpage/make-a-payment/?type=${encodeURIComponent(type)}&bookingid=${bookingId}${type === "define_admin" ? `&adminamount=${encodeURIComponent(amount)}` : ""}`;
        const signature = paymentLinkSignature(bookingId, type, amount);
        const signedPaymentUrl = `${paymentUrl}&signature=${encodeURIComponent(signature)}`;
        const siteTitle = await getSiteTitle();
        await mailer.sendMail({
          from: {
            name: siteTitle,
            address: config.smtpFrom || config.smtpUser,
          },
          to: recipient,
          subject: `${siteTitle} Invoice`,
          html: `<html><body><p>Hi ${booking.user_first_name || ""},</p><p>I hope you're doing well and getting excited for your upcoming adventure with ${siteTitle}!</p><p>You can make your trip payment securely using the link below:</p><p><a href="${signedPaymentUrl}">Pay Now</a></p><p>Once your payment is received, we'll send a confirmation and update your booking details.</p><p>Thank you again for traveling with us!</p></body></html>`,
        });
        res.json({ message: "Payment link sent successfully." });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
