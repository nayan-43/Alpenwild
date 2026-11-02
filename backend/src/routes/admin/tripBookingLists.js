import { Router } from "express";

export function createAdminTripBookingListsRouter({ query }) {
  const router = Router();

  router.get("/api/trip-bookings/options", async (_req, res, next) => {
    try {
      const [result, discounts] = await Promise.all([
        query(
          `SELECT t.trips_id AS id, t.trips_name AS name,
          t.trips_available_for AS available_for,
          t.trips_price AS price, t.trips_single_price AS single_price,
          tt.trip_type_name AS type_name,
          COALESCE(json_agg(json_build_object(
            'id', d.trips_date_id,
            'start_date', to_char(d.trips_start_date, 'YYYY-MM-DD'),
            'end_date', to_char(d.trips_end_date, 'YYYY-MM-DD'),
            'price', d.trips_price,
            'single_price', d.trips_single_price
          ) ORDER BY d.trips_start_date) FILTER (WHERE d.trips_date_id IS NOT NULL), '[]') AS dates
         FROM alpenwild_trips_tbl t
         LEFT JOIN alpenwild_trip_type_tbl tt ON tt.trip_type_id=t.trips_type_id
         LEFT JOIN alpenwild_trips_date_tbl d
           ON d.trips_id=t.trips_id AND d.trips_date_status='Active'
         WHERE t.trips_status='Active'
         GROUP BY t.trips_id, t.trips_name, t.trips_available_for,
           t.trips_price, t.trips_single_price, tt.trip_type_name, t.trips_order
         ORDER BY tt.trip_type_name, t.trips_order, t.trips_name`,
        ),
        query(`SELECT discount_id AS id, discount_name AS name, discount_code AS code,
          discount_type AS type, discount_value AS value,
          discount_start_date AS start_date, discount_end_date AS end_date
        FROM alpenwild_discount_tbl
        WHERE discount_status='Active'
          AND discount_start_date <= CURRENT_DATE
          AND discount_end_date >= CURRENT_DATE
        ORDER BY discount_name`),
      ]);
      res.json({ trips: result.rows, discounts: discounts.rows });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/trip-bookings", async (req, res, next) => {
    try {
      const recent = req.query.recent === "true";
      const tripId = req.query.trips_id ? Number(req.query.trips_id) : null;
      const result = await query(
        `SELECT b.trips_booking_id AS id, b.trips_id AS trip_id,
          t.trips_name AS trip_name, t.trips_available_for AS available_for,
          b.user_first_name AS first_name, b.user_last_name AS last_name,
          b.user_street_address AS street_address, b.user_street_address1 AS street_address1,
          b.user_city AS city, b.user_state AS state, b.user_postal_code AS postal_code,
          b.user_country AS country, b.user_shipping_email_address AS email,
          b.user_id AS user_id, b.trips_date_id AS trip_date_id,
          b.party_number,
          COALESCE(
            b.trips_booking_date,
            (SELECT MIN(p.payment_date)
               FROM alpenwild_trips_payment_tbl p
              WHERE p.trips_booking_id=b.trips_booking_id)
          ) AS booking_date,
          b.booking_start_date, b.booking_end_date,
          b.trip_total_payment AS total_payment,
          b.trip_additional_payment AS additional_payment,
          b.trip_payment_due AS payment_due, b.trips_booking_status AS status,
          COALESCE((SELECT string_agg(
            '$' || COALESCE(p.payment_price::text, '0') || ' on ' || COALESCE(to_char(p.payment_date, 'FMMonth FMDD,YYYY'), '-'),
            E'\\n' ORDER BY p.trips_payment_id)
            FROM alpenwild_trips_payment_tbl p
            WHERE p.trips_booking_id=b.trips_booking_id), '') AS deposits,
          COALESCE((SELECT string_agg(
            '$' || COALESCE(r.amount::text, '0') || ' on ' || COALESCE(to_char(r.created_at, 'FMMonth FMDD,YYYY'), '-'),
            E'\\n' ORDER BY r.created_at)
            FROM alpenwild_trips_payment_refund_tbl r
            JOIN alpenwild_trips_payment_tbl p ON p.trips_payment_id=r.trips_payment_id
            WHERE p.trips_booking_id=b.trips_booking_id), '') AS refunds,
          COALESCE((SELECT string_agg(
            COALESCE(a.first_name, '') || ' ' || COALESCE(a.last_name, '') || E'\\n' ||
            COALESCE(a.preferred_name, '') || E'\\n' || COALESCE(a.mobile_phone, '') || E'\\n' ||
            COALESCE(a.email_address, '') || E'\\n' || COALESCE(a.date_of_birth::text, ''),
            E'\\n\\n' ORDER BY a.trips_additional_booking_user_id)
            FROM alpenwild_trips_additional_booking_user_tbl a
            WHERE a.trips_booking_id=b.trips_booking_id), '') AS additional_users,
          COALESCE((SELECT string_agg(
            CASE WHEN t.trips_available_for = 'Specefic Date'
              THEN to_char(d.trips_start_date, 'FMMonth FMDD,YYYY') || ' - ' || to_char(d.trips_end_date, 'FMMonth FMDD,YYYY')
              ELSE CASE WHEN t.trips_available_for = 'Year Round' THEN 'Year Round. Available for: ' ELSE 'Specific Months. Available for: ' END ||
                COALESCE(d.trips_date_range::text, 'Custom') || ' Days (' || to_char(d.trips_start_date, 'FMMonth, YYYY') || ' to ' || to_char(d.trips_end_date, 'FMMonth, YYYY') || ').' END,
            E'\\n' ORDER BY d.trips_start_date)
            FROM alpenwild_trips_date_tbl d
            WHERE d.trips_id=b.trips_id AND (b.trips_date_id IS NULL OR d.trips_date_id=b.trips_date_id)), '') AS trip_dates
          FROM alpenwild_trips_booking_tbl b
          LEFT JOIN alpenwild_trips_tbl t ON t.trips_id=b.trips_id
         WHERE ($1::int IS NULL OR b.trips_id=$1)
         ORDER BY booking_date DESC NULLS LAST, b.trips_booking_id DESC
         ${recent ? "LIMIT 500" : ""}`,
        [tripId],
      );
      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/trip-bookings/payments", async (_req, res, next) => {
    try {
      const result = await query(
        `SELECT p.trips_payment_id AS id, p.trips_booking_id AS booking_id,
          b.user_first_name AS first_name, b.user_last_name AS last_name,
          t.trips_name AS trip_name, p.payment_price AS amount,
          b.trips_booking_date AS booking_date, b.booking_start_date,
          b.booking_end_date, b.trip_total_payment AS total_payment,
          b.trip_additional_payment AS additional_payment,
          b.trip_payment_due AS payment_due,
          u.user_first_name AS customer_first_name, u.user_last_name AS customer_last_name,
          u.user_street_address AS customer_street_address,
          u.user_street_address1 AS customer_street_address1,
          u.user_city AS customer_city, u.user_state AS customer_state,
          u.user_postal_code AS customer_postal_code,
          u.user_country AS customer_country,
          COALESCE((SELECT string_agg(to_char(d.trips_start_date, 'FMMonth FMDD,YYYY') || ' - ' || to_char(d.trips_end_date, 'FMMonth FMDD,YYYY'), E'\\n')
            FROM alpenwild_trips_date_tbl d
            WHERE d.trips_id=b.trips_id AND (b.trips_date_id IS NULL OR d.trips_date_id=b.trips_date_id)), '') AS trip_dates,
          COALESCE((SELECT string_agg(ap.description || ': ' || ap.sign || ' $' ||
            to_char(ap.price * ap.quantity, 'FM999999990.00'), E'\\n')
            FROM alpenwild_trips_additional_price_tbl ap
            WHERE ap.trips_booking_id=b.trips_booking_id), '') AS additional_prices,
          p.payment_date, p.payment_status AS status, p.transaction_id,
          p.gateway
         FROM alpenwild_trips_payment_tbl p
         LEFT JOIN alpenwild_trips_booking_tbl b ON b.trips_booking_id=p.trips_booking_id
         LEFT JOIN alpenwild_user_tbl u ON u.user_id=b.user_id
         LEFT JOIN alpenwild_trips_tbl t ON t.trips_id=b.trips_id
         ORDER BY p.payment_date DESC NULLS LAST, p.trips_payment_id DESC`,
      );
      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
