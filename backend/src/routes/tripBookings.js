import { Router } from "express";
import { z } from "zod";
import { calculatePublicBookingAmounts } from "../tripBookingAmounts.js";

export function createTripBookingsRouter({
  query,
  config,
  verifyRecaptcha,
  getTripBookingDiscount,
  authorizeNetCharge,
  getSiteTitle,
  calculateBookingPaymentDueDate,
  handleTripBooking,
  validDateOrNull,
}) {
  const router = Router();
  router.post("/api/trip-bookings", handleTripBooking);
  const bookingDateSchema = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((value) => validDateOrNull(value) === value, "Enter a valid date.");

  router.post("/api/public/trip-bookings", async (req, res, next) => {
    try {
      const data = z
        .object({
          user_email_address: z.string().trim().email().max(255),
          trips_id: z.coerce.number().int().positive(),
          trips_date_id: z.coerce.number().int().positive(),
          party_number: z.coerce.number().int().min(1).max(10),
          first_name: z.string().trim().min(1).max(255),
          last_name: z.string().trim().min(1).max(255),
          mobile_phone: z.string().trim().min(10).max(20),
          date_of_birth: bookingDateSchema,
          gender: z.string().max(20).default(""),
          street_address: z.string().trim().min(1).max(255),
          street_address1: z.string().trim().max(255).default(""),
          city: z.string().trim().min(1).max(255),
          state: z.string().trim().min(1).max(255),
          postal_code: z.string().trim().min(1).max(255),
          country: z.string().trim().min(1).max(255),
          shipping_first_name: z.string().trim().min(1).max(255),
          shipping_last_name: z.string().trim().min(1).max(255),
          shipping_street_address: z.string().trim().min(1).max(255),
          shipping_street_address1: z.string().trim().max(255).default(""),
          shipping_city: z.string().trim().min(1).max(255),
          shipping_state: z.string().trim().min(1).max(255),
          shipping_postal_code: z.string().trim().min(1).max(255),
          shipping_country: z.string().trim().min(1).max(255),
          booking_start_date: z.string().optional().default(""),
          booking_end_date: z.string().optional().default(""),
          rooming_preference: z.string().max(250).default(""),
          bed_preference: z.string().max(250).default(""),
          preferred_name: z.string().max(255).default(""),
          physical_medical_conditions: z.string().max(10000).default(""),
          dietary_restrictions: z.string().max(10000).default(""),
          special_dietary_requirements: z.string().max(10000).default(""),
          hear_about_us: z.string().max(250).default(""),
          special_comments: z.string().max(30000).default(""),
          flight_arrival_details: z.string().max(10000).default(""),
          flight_departure_details: z.string().max(10000).default(""),
          discount_code: z.string().trim().max(255).default(""),
          credit_card_number: z.string().regex(/^\d{14,25}$/),
          credit_card_last_four: z.string().regex(/^\d{4}$/),
          credit_card_expire_month: z.string().regex(/^(0[1-9]|1[0-2])$/),
          credit_card_expire_year: z.coerce
            .number()
            .int()
            .min(new Date().getFullYear())
            .max(new Date().getFullYear() + 20),
          credit_card_cvv_number: z.string().regex(/^\d{3,4}$/),
          additional_travelers: z
            .array(
              z.object({
                first_name: z.string().trim().min(1).max(255),
                last_name: z.string().trim().min(1).max(255),
                preferred_name: z.string().trim().max(255).default(""),
                email_address: z.string().email().or(z.literal("")).default(""),
                mobile_phone: z.string().max(255).default(""),
                gender: z.string().max(255).default(""),
                date_of_birth: bookingDateSchema,
              }),
            )
            .max(9)
            .default([]),
          recaptcha_token: z.string().max(5000).default(""),
          agree: z.literal("1"),
        })
        .parse(req.body);

      if (config.recaptchaEnabled && !config.recaptchaSecret)
        return res
          .status(503)
          .json({ message: "Trip booking is not configured." });
      if (
        config.recaptchaEnabled &&
        !(await verifyRecaptcha(data.recaptcha_token))
      )
        return res
          .status(400)
          .json({ message: "Robot verification failed, please try again." });

      if (data.additional_travelers.length > data.party_number - 1)
        return res
          .status(400)
          .json({ message: "Too many additional travelers." });

      const tripResult = await query(
        `SELECT t.trips_id, t.trips_name, t.trips_status, t.trips_available_for,
        t.trips_price, t.trips_single_price,
          t.trips_deposit_amount,
        d.trips_date_status,
        to_char(d.trips_start_date, 'YYYY-MM-DD') AS trips_start_date,
        to_char(d.trips_end_date, 'YYYY-MM-DD') AS trips_end_date
         FROM alpenwild_trips_tbl t
         JOIN alpenwild_trips_date_tbl d ON d.trips_id=t.trips_id
        WHERE t.trips_id=$1 AND d.trips_date_id=$2 LIMIT 1`,
        [data.trips_id, data.trips_date_id],
      );
      const trip = tripResult.rows[0];
      const today = new Date().toISOString().slice(0, 10);
      if (
        !trip ||
        trip.trips_status !== "Active" ||
        trip.trips_date_status !== "Active" ||
        String(trip.trips_end_date).slice(0, 10) < today
      )
        return res
          .status(400)
          .json({ message: "The selected trip date is no longer available." });

      const bookingStartDate = validDateOrNull(data.booking_start_date);
      const bookingEndDate = validDateOrNull(data.booking_end_date);
      if (
        trip.trips_available_for !== "Specefic Date" &&
        (!bookingStartDate ||
          !bookingEndDate ||
          bookingStartDate > bookingEndDate)
      )
        return res
          .status(400)
          .json({ message: "Please enter a valid trip start and end date." });

      const tripBaseAmount = Number(trip.trips_price || 0) * data.party_number;
      const singleSupplement =
        data.rooming_preference === "Single occupancy"
          ? Number(trip.trips_single_price || 0)
          : 0;
      const tripTotal = tripBaseAmount + singleSupplement;
      if (!Number.isFinite(tripTotal) || tripTotal < 0)
        throw new Error("Trip pricing is invalid.");
      const discount = await getTripBookingDiscount(
        data.discount_code,
        tripBaseAmount,
      );
      if (discount === null)
        return res
          .status(400)
          .json({ message: "Discount code is invalid or expired." });
      const discountAmount = discount.amount;

      const amounts = calculatePublicBookingAmounts({
        tripPrice: Number(trip.trips_price || 0),
        singleSupplement:
          data.rooming_preference === "Single occupancy"
            ? Number(trip.trips_single_price || 0)
            : 0,
        depositPerPerson: Number(trip.trips_deposit_amount || 0),
        partyNumber: data.party_number,
        discountAmount,
      });
      if (
        amounts.payment_amount > 0 &&
        (!config.authorizeNetLogin || !config.authorizeNetTransactionKey)
      )
        return res
          .status(503)
          .json({ message: "Online payment is not configured." });

      const now = new Date();
      if (
        data.credit_card_expire_year === now.getFullYear() &&
        Number(data.credit_card_expire_month) < now.getMonth() + 1
      )
        return res.status(400).json({
          message: "The credit card has expired. Please use a valid card.",
        });

      req.body = {
        ...data,
        day_phone: data.mobile_phone,
        send_email: true,
        email_subject: `${await getSiteTitle()} Trip Booking Confirmation`,
        email_message: "",
        booking_start_date: bookingStartDate || "",
        booking_end_date: bookingEndDate || "",
        payment_due_date: calculateBookingPaymentDueDate(
          trip.trips_available_for === "Specefic Date"
            ? trip.trips_start_date
            : bookingStartDate,
        ),
        invoice_trip_start_date:
          trip.trips_available_for === "Specefic Date"
            ? trip.trips_start_date
            : bookingStartDate,
        invoice_trip_end_date:
          trip.trips_available_for === "Specefic Date"
            ? trip.trips_end_date
            : bookingEndDate,
        trip_name: trip.trips_name,
        ...amounts,
      };
      return handleTripBooking(req, res, next);
    } catch (error) {
      next(error);
    }
  });
  return router;
}
