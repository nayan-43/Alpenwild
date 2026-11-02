import { Router } from "express";
import { z } from "zod";

export function createAdminTripBookingLookupsRouter({ query }) {
  const router = Router();

  router.get("/api/trip-bookings/user", async (req, res, next) => {
    try {
      const email = z.string().email().parse(req.query.email);
      const result = await query(
        `SELECT user_first_name AS first_name, user_last_name AS last_name,
          user_preferred_name AS preferred_name, user_street_address AS street_address,
          user_street_address1 AS street_address1, user_city AS city,
          user_state AS state, user_postal_code AS postal_code,
          user_country AS country, user_day_phone AS day_phone,
          user_mobile_phone AS mobile_phone, user_date_of_birth AS date_of_birth,
          user_gender AS gender, user_shipping_first_name AS shipping_first_name,
          user_shipping_last_name AS shipping_last_name,
          user_shipping_street_address AS shipping_street_address,
          user_shipping_street_address1 AS shipping_street_address1,
          user_shipping_city AS shipping_city, user_shipping_state AS shipping_state,
          user_shipping_postal_code AS shipping_postal_code,
          user_shipping_country AS shipping_country
         FROM alpenwild_user_tbl WHERE LOWER(user_email_address)=LOWER($1)
         LIMIT 1`,
        [email],
      );
      res.json(result.rows[0] || null);
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/trip-bookings/:bookingId", async (req, res, next) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.bookingId);
      const result = await query(
        `SELECT b.*, u.user_email_address,
          COALESCE((SELECT json_agg(json_build_object(
            'id', a.trips_additional_booking_user_id,
            'first_name', COALESCE(a.first_name, ''),
            'last_name', COALESCE(a.last_name, ''),
            'preferred_name', COALESCE(a.preferred_name, ''),
            'email_address', COALESCE(a.email_address, ''),
            'day_phone', COALESCE(a.day_phone, ''),
            'mobile_phone', COALESCE(a.mobile_phone, ''),
            'date_of_birth', CASE
              WHEN a.date_of_birth ~ '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$'
                THEN to_char(to_date(a.date_of_birth, 'MM/DD/YYYY'), 'YYYY-MM-DD')
              ELSE ''
            END,
            'gender', COALESCE(a.gender, '')
          ) ORDER BY a.trips_additional_booking_user_id)
          FROM alpenwild_trips_additional_booking_user_tbl a
          WHERE a.trips_booking_id=b.trips_booking_id), '[]'::json) AS additional_travelers,
          COALESCE((SELECT json_agg(json_build_object(
            'id', ap.trips_additional_price_id,
            'description', ap.description,
            'price', ap.price,
            'quantity', ap.quantity,
            'sign', ap.sign
          ) ORDER BY ap.trips_additional_price_id)
          FROM alpenwild_trips_additional_price_tbl ap
          WHERE ap.trips_booking_id=b.trips_booking_id), '[]'::json) AS additional_prices
       FROM alpenwild_trips_booking_tbl b
       LEFT JOIN alpenwild_user_tbl u ON u.user_id=b.user_id
       WHERE b.trips_booking_id=$1`,
        [id],
      );
      if (!result.rows[0])
        return res.status(404).json({ message: "Booking not found." });
      const row = result.rows[0];
      res.json({
        ...row,
        user_email_address: row.user_email_address || "",
        first_name: row.user_first_name || "",
        last_name: row.user_last_name || "",
        preferred_name: row.user_preferred_name || "",
        street_address: row.user_street_address || "",
        street_address1: row.user_street_address1 || "",
        city: row.user_city || "",
        state: row.user_state || "",
        postal_code: row.user_postal_code || "",
        country: row.user_country || "UNITED STATES",
        day_phone: row.user_day_phone || "",
        mobile_phone: row.user_mobile_phone || "",
        date_of_birth: row.user_date_of_birth || "",
        gender: row.user_gender || "",
        shipping_first_name: row.user_shipping_first_name || "",
        shipping_last_name: row.user_shipping_last_name || "",
        shipping_street_address: row.user_shipping_street_address || "",
        shipping_street_address1: row.user_shipping_street_address1 || "",
        shipping_city: row.user_shipping_city || "",
        shipping_state: row.user_shipping_state || "",
        shipping_postal_code: row.user_shipping_postal_code || "",
        shipping_country: row.user_shipping_country || "UNITED STATES",
        initial_booking_amount: row.trip_total_payment || "",
        single_supplement_booking_amount: row.trip_additional_payment || "",
        additional_travelers: row.additional_travelers || [],
        additional_prices: row.additional_prices || [],
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
