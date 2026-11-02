import { Router } from "express";

export function createAdminTripBookingExportRouter({ query }) {
  const router = Router();

  router.get("/api/trip-bookings/download", async (_req, res, next) => {
    try {
      const result =
        await query(`SELECT b.*, t.trips_name, t.trips_available_for,
        d.trips_start_date AS selected_start_date, d.trips_end_date AS selected_end_date,
        d.trips_date_range AS selected_date_range,
        u.user_email_address,
        COALESCE((SELECT json_agg(to_jsonb(a) ORDER BY a.trips_additional_booking_user_id)
          FROM alpenwild_trips_additional_booking_user_tbl a
          WHERE a.trips_booking_id=b.trips_booking_id), '[]'::json) AS guests,
        COALESCE((SELECT json_agg(json_build_object('amount', p.payment_price, 'date', p.payment_date)
          ORDER BY p.payment_date ASC, p.trips_payment_id ASC)
          FROM alpenwild_trips_payment_tbl p
          WHERE p.trips_booking_id=b.trips_booking_id), '[]'::json) AS all_payments,
        COALESCE((SELECT json_agg(json_build_object('amount', p.payment_price, 'date', p.payment_date)
          ORDER BY p.payment_date ASC, p.trips_payment_id ASC)
          FROM alpenwild_trips_payment_tbl p
          WHERE p.trips_booking_id=b.trips_booking_id AND p.payment_status='paid'), '[]'::json) AS paid_payments
      FROM alpenwild_trips_booking_tbl b
      LEFT JOIN alpenwild_trips_tbl t ON t.trips_id=b.trips_id
      LEFT JOIN alpenwild_user_tbl u ON u.user_id=b.user_id
      LEFT JOIN alpenwild_trips_date_tbl d ON d.trips_date_id=b.trips_date_id
      ORDER BY b.trips_booking_date DESC NULLS LAST, b.trips_booking_id DESC`);

      const baseHeaders = [
        "Email",
        "Trip",
        "Trip Dates",
        "Trip Start Date",
        "Trip End Date",
        "Gender",
        "Last Name (as it appears on passport)",
        "First Name (as it appears on passport)",
        "Preferred Name",
        "Rooming Preferrence",
        "Number of Beds",
        "DOB",
        "Street Address",
        "Street Address 2",
        "City",
        "State",
        "Zip Code",
        "Country",
        "Mobile Phone Number",
        "Shipping First name",
        "Shipping Last Name",
        "Shipping Street Address",
        " Shipping StreetAddress2",
        "Shipping City",
        "Shipping State",
        "Shipping Zip Code",
        "Shipping Country",
        "Physical or medical conditions (please specify who in your party this affects)",
        "Dietary Restrictions and Allergies (please specify who in your party this affects):",
        "Dietary Requests (please specify who in your party this affects):",
        "How did you hear about us?:",
        "Special Comments & Questions:",
        "Flight Arrival Details:",
        "Flight Departure Details:",
        "Pre-Post?",
        "Registration Date:",
        "Initial Amount",
        "Single Suppliment",
        "Deposit",
        "Balance",
        "Admin Note",
        "Booking Status",
      ];
      const guestHeaders = [];
      for (let i = 1; i <= 9; i++)
        guestHeaders.push(
          `Guest${i} First Name`,
          `Guest${i} Last Name`,
          `Guest${i} Preferred Name`,
          `Guest${i} Email`,
          `Guest${i} Gender`,
          `Guest${i} Mobile Number`,
          `Guest${i} DOB`,
        );
      const maxPayments = result.rows.reduce(
        (max, row) => Math.max(max, row.all_payments?.length || 0),
        0,
      );
      const depositHeaders = [];
      for (let i = 1; i <= maxPayments; i++)
        depositHeaders.push(`Deposit Amount ${i}`, `Deposit Date ${i}`);
      const headers = [...baseHeaders, ...guestHeaders, ...depositHeaders];
      const legacyValue = (item) =>
        String(item ?? "")
          .trim()
          .replaceAll("''", "'")
          .replaceAll("\\'", "'")
          .replaceAll(",", "-")
          .replace(/\r\n|\n|\r/g, "-");
      const cell = (item, fallback = "N/A") => {
        const normalized = legacyValue(item);
        return normalized === "" ? fallback : normalized;
      };
      const formatDate = (date, format = "iso") => {
        if (date == null || date === "") return "";
        const parsed = new Date(date);
        if (Number.isNaN(parsed.getTime())) return "";
        const parts = new Intl.DateTimeFormat("en-US", {
          month: "long",
          day: format === "year-month" ? undefined : "numeric",
          year: "numeric",
          timeZone: "UTC",
        }).formatToParts(parsed);
        const part = (type) =>
          parts.find((item) => item.type === type)?.value || "";
        if (format === "iso")
          return `${part("year")}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}-${String(parsed.getUTCDate()).padStart(2, "0")}`;
        if (format === "month-year") return `${part("month")}, ${part("year")}`;
        return `${part("month")} ${part("day")},${part("year")}`;
      };
      const rows = result.rows.map((row) => {
        const bookingStart = row.booking_start_date ?? null;
        const bookingEnd = row.booking_end_date ?? null;
        const tripStart = bookingStart || row.selected_start_date;
        const tripEnd = bookingEnd || row.selected_end_date;
        let tripDates = "";
        if (bookingStart) {
          tripDates = formatDate(bookingStart, "long");
        } else if (
          row.trips_available_for === "Specefic Date" &&
          row.selected_start_date &&
          row.selected_end_date
        ) {
          tripDates = `${formatDate(row.selected_start_date, "long")} - ${formatDate(row.selected_end_date, "long")}`;
        } else if (
          row.trips_available_for !== "Specefic Date" &&
          row.selected_start_date &&
          row.selected_end_date
        ) {
          const duration =
            row.selected_date_range && row.selected_date_range !== "0"
              ? row.selected_date_range
              : "";
          tripDates = `Year Round. Available for:\t${formatDate(row.selected_start_date, "month-year")} to ${formatDate(row.selected_end_date, "month-year")}${duration ? ` for ${duration} Days` : ""}`;
        }
        const guests = Array.isArray(row.guests) ? row.guests : [];
        const allPayments = Array.isArray(row.all_payments)
          ? row.all_payments
          : [];
        const payments = Array.isArray(row.paid_payments)
          ? row.paid_payments
          : [];
        const deposit = allPayments.reduce(
          (sum, payment) => sum + Number(payment.amount || 0),
          0,
        );
        const cells = [
          cell(row.user_email_address),
          cell(row.trips_name),
          cell(tripDates, ""),
          cell(formatDate(tripStart), ""),
          cell(formatDate(tripEnd), ""),
          cell(row.user_gender),
          cell(row.user_last_name),
          cell(row.user_first_name),
          cell(row.user_preferred_name),
          cell(row.rooming_preference),
          cell(row.bed_preference),
          cell(row.user_date_of_birth),
          cell(row.user_street_address),
          cell(row.user_street_address1),
          cell(row.user_city),
          cell(row.user_state),
          cell(row.user_postal_code),
          cell(row.user_country),
          cell(row.user_mobile_phone),
          cell(row.user_shipping_first_name),
          cell(row.user_shipping_last_name),
          cell(row.user_shipping_street_address),
          cell(row.user_shipping_street_address1),
          cell(row.user_shipping_city),
          cell(row.user_shipping_state),
          cell(row.user_shipping_postal_code),
          cell(row.user_shipping_country),
          cell(row.physical_medical_conditions),
          cell(row.dietary_restrictions),
          cell(row.special_dietary_requirements),
          cell(row.hear_about_us),
          cell(row.special_comments),
          cell(row.flight_arrival_details),
          cell(row.flight_departure_details),
          "",
          cell(row.trips_booking_date),
          cell(row.trip_total_payment),
          cell(row.trip_additional_payment, "0"),
          cell(deposit, "0"),
          cell(row.trip_payment_due),
          cell(row.admin_notes),
          cell(row.trips_booking_status),
        ];
        for (let i = 0; i < 9; i++) {
          const guest = guests[i] || {};
          cells.push(
            guest.first_name ? cell(guest.first_name) : "",
            guest.last_name ? cell(guest.last_name) : "",
            guest.preferred_name ? cell(guest.preferred_name) : "",
            guest.email_address ? cell(guest.email_address) : "",
            guest.gender ? cell(guest.gender) : "",
            guest.mobile_phone ? cell(guest.mobile_phone) : "",
            guest.date_of_birth ? cell(guest.date_of_birth) : "",
          );
        }
        for (let i = 0; i < maxPayments; i++) {
          cells.push(
            payments[i] ? cell(payments[i].amount) : "",
            payments[i] ? cell(formatDate(payments[i].date)) : "",
          );
        }
        return cells;
      });
      const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join(
        "\n",
      );
      res.setHeader("Content-Type", "text/octect-stream");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="booking_list_${Math.floor(Date.now() / 1000)}.csv"`,
      );
      res.send(csv);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
