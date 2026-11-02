import { Router } from "express";
import { z } from "zod";
import { tripBookingAmount } from "../../tripBookingAmount.js";

export function createAdminTripBookingUpdatesRouter({
  pool,
  query,
  mailer,
  config,
  getTripBookingDiscount,
  createTripBookingInvoicePdf,
  calculateBookingPaymentDueDate,
  createBookingConfirmationHtml,
  getSiteTitle,
}) {
  const router = Router();

  router.patch("/api/trip-bookings/:bookingId", async (req, res, next) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.bookingId);
      const b = req.body || {};
      const depositAmount = tripBookingAmount.parse(b.deposit_amount || 0);
      const tripTotal = tripBookingAmount.parse(b.initial_booking_amount || 0);
      const singleSupplement = tripBookingAmount.parse(
        b.single_supplement_booking_amount || 0,
      );
      const discount = await getTripBookingDiscount(
        String(b.discount_code || "").trim(),
        tripTotal,
      );
      const applicableDiscount = discount || { amount: 0, description: "" };
      const additionalTravelers = Object.hasOwn(b, "additional_travelers")
        ? z
            .array(
              z.object({
                id: z.coerce.number().int().positive().optional(),
                first_name: z.string().trim().max(255).default(""),
                last_name: z.string().trim().max(255).default(""),
                preferred_name: z.string().trim().max(255).default(""),
                email_address: z.string().max(255).default(""),
                day_phone: z.string().max(255).default(""),
                mobile_phone: z.string().max(255).default(""),
                date_of_birth: z.string().optional().default(""),
                gender: z.string().max(255).default(""),
              }),
            )
            .max(9)
            .parse(b.additional_travelers)
        : null;
      const additionalPrices = Object.hasOwn(b, "additional_prices")
        ? z
            .array(
              z.object({
                id: z.coerce.number().int().positive().optional(),
                description: z.string().trim().min(1).max(255),
                price: tripBookingAmount,
                quantity: z.coerce.number().int().min(1),
                sign: z.enum(["+", "-"]),
              }),
            )
            .parse(b.additional_prices)
        : null;
      if (
        additionalTravelers &&
        additionalTravelers.length > Number(b.party_number || 1) - 1
      )
        return res
          .status(400)
          .json({ message: "Too many additional travelers." });

      if (!pool) throw new Error("DATABASE_URL is not configured");
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const lockedBooking = await client.query(
          `SELECT trips_booking_id
         FROM alpenwild_trips_booking_tbl
         WHERE trips_booking_id=$1
         FOR UPDATE`,
          [id],
        );
        if (!lockedBooking.rowCount) {
          await client.query("ROLLBACK");
          return res.status(404).json({ message: "Booking not found." });
        }
        if (additionalPrices) {
          const existing = await client.query(
            `SELECT trips_additional_price_id AS id
             FROM alpenwild_trips_additional_price_tbl
            WHERE trips_booking_id=$1
            FOR UPDATE`,
            [id],
          );
          const existingIds = new Set(
            existing.rows.map((row) => String(row.id)),
          );
          const submittedIds = additionalPrices
            .filter((price) => price.id !== undefined)
            .map((price) => String(price.id));
          if (submittedIds.some((priceId) => !existingIds.has(priceId)))
            throw new Error(
              "Additional price record does not belong to this booking.",
            );

          await client.query(
            `DELETE FROM alpenwild_trips_additional_price_tbl
            WHERE trips_booking_id=$1
              AND NOT (trips_additional_price_id = ANY($2::bigint[]))`,
            [id, submittedIds],
          );
          for (const price of additionalPrices) {
            if (price.id !== undefined) {
              await client.query(
                `UPDATE alpenwild_trips_additional_price_tbl
                  SET description=$1, price=$2, quantity=$3, sign=$4
                WHERE trips_booking_id=$5 AND trips_additional_price_id=$6`,
                [
                  price.description,
                  price.price,
                  price.quantity,
                  price.sign,
                  id,
                  price.id,
                ],
              );
            } else {
              await client.query(
                `INSERT INTO alpenwild_trips_additional_price_tbl
                (trips_booking_id,description,price,quantity,sign)
               VALUES ($1,$2,$3,$4,$5)`,
                [
                  id,
                  price.description,
                  price.price,
                  price.quantity,
                  price.sign,
                ],
              );
            }
          }
        }
        if (applicableDiscount.amount > 0)
          await client.query(
            `INSERT INTO alpenwild_trips_additional_price_tbl
             (trips_booking_id,description,price,sign)
           VALUES ($1,$2,$3,'-')`,
            [id, applicableDiscount.description, applicableDiscount.amount],
          );
        if (depositAmount > 0) {
          await client.query(
            `INSERT INTO alpenwild_trips_payment_tbl
             (trips_booking_id,name_on_credit_card,payment_price,
              payment_date,payment_status)
           VALUES ($1,'',$2,CURRENT_DATE,'Paid')`,
            [id, depositAmount],
          );
        }
        const [additionalPricesResult, payments] = await Promise.all([
          client.query(
            `SELECT COALESCE(SUM(
             CASE WHEN sign='-' THEN -1 ELSE 1 END * price * quantity
           ), 0) AS total
           FROM alpenwild_trips_additional_price_tbl
           WHERE trips_booking_id=$1`,
            [id],
          ),
          client.query(
            `SELECT COALESCE(SUM(payment_price), 0) AS total
           FROM alpenwild_trips_payment_tbl
           WHERE trips_booking_id=$1`,
            [id],
          ),
        ]);
        const paymentDue =
          tripTotal +
          singleSupplement +
          Number(additionalPricesResult.rows[0].total) -
          Number(payments.rows[0].total);
        await client.query(
          `UPDATE alpenwild_trips_booking_tbl SET
        trips_id=$1, trips_date_id=$2, party_number=$3, booking_start_date=NULLIF($4::text, '')::date, booking_end_date=NULLIF($5::text, '')::date,
        user_first_name=$6, user_last_name=$7, user_preferred_name=$8, user_day_phone=$9, user_mobile_phone=$10,
        user_street_address=$11, user_street_address1=$12, user_city=$13, user_state=$14, user_postal_code=$15,
        user_country=$16, user_gender=$17, user_shipping_first_name=$18, user_shipping_last_name=$19,
        user_shipping_street_address=$20, user_shipping_street_address1=$21, user_shipping_city=$22,
        user_shipping_state=$23, user_shipping_postal_code=$24, user_shipping_country=$25,
        physical_medical_conditions=$26, dietary_restrictions=$27, special_dietary_requirements=$28,
        hear_about_us=$29, special_comments=$30, flight_arrival_details=$31, flight_departure_details=$32,
        rooming_preference=$33, bed_preference=$34, admin_notes=$35, trip_total_payment=$36,
        trip_additional_payment=$37, trip_payment_due=$38
        WHERE trips_booking_id=$39`,
          [
            b.trips_id,
            b.trips_date_id || null,
            b.party_number,
            b.booking_start_date || "",
            b.booking_end_date || "",
            b.first_name || "",
            b.last_name || "",
            b.preferred_name || "",
            b.day_phone || "",
            b.mobile_phone || "",
            b.street_address || "",
            b.street_address1 || "",
            b.city || "",
            b.state || "",
            b.postal_code || "",
            b.country || "",
            b.gender || "",
            b.shipping_first_name || "",
            b.shipping_last_name || "",
            b.shipping_street_address || "",
            b.shipping_street_address1 || "",
            b.shipping_city || "",
            b.shipping_state || "",
            b.shipping_postal_code || "",
            b.shipping_country || "",
            b.physical_medical_conditions || "",
            b.dietary_restrictions || "",
            b.special_dietary_requirements || "",
            b.hear_about_us || "",
            b.special_comments || "",
            b.flight_arrival_details || "",
            b.flight_departure_details || "",
            b.rooming_preference || "",
            b.bed_preference || "",
            b.admin_notes || "",
            tripTotal,
            singleSupplement,
            paymentDue,
            id,
          ],
        );

        if (additionalTravelers) {
          const existing = await client.query(
            `SELECT trips_additional_booking_user_id AS id
           FROM alpenwild_trips_additional_booking_user_tbl
           WHERE trips_booking_id=$1
           FOR UPDATE`,
            [id],
          );
          const existingIds = new Set(
            existing.rows.map((row) => String(row.id)),
          );
          const submittedIds = additionalTravelers
            .filter((traveler) => traveler.id !== undefined)
            .map((traveler) => String(traveler.id));
          if (submittedIds.some((guestId) => !existingIds.has(guestId)))
            throw new Error("Guest record does not belong to this booking.");

          await client.query(
            `DELETE FROM alpenwild_trips_additional_booking_user_tbl
           WHERE trips_booking_id=$1
             AND NOT (trips_additional_booking_user_id = ANY($2::bigint[]))`,
            [id, submittedIds],
          );
          for (const traveler of additionalTravelers) {
            const values = [
              traveler.first_name,
              traveler.last_name,
              traveler.preferred_name,
              traveler.email_address,
              traveler.day_phone,
              traveler.mobile_phone,
              traveler.date_of_birth || null,
              traveler.gender,
            ];
            if (traveler.id !== undefined) {
              await client.query(
                `UPDATE alpenwild_trips_additional_booking_user_tbl SET
                first_name=$1, last_name=$2, preferred_name=$3,
                email_address=$4, day_phone=$5, mobile_phone=$6,
                date_of_birth=$7, gender=$8
               WHERE trips_booking_id=$9 AND trips_additional_booking_user_id=$10`,
                [...values, id, traveler.id],
              );
            } else {
              await client.query(
                `INSERT INTO alpenwild_trips_additional_booking_user_tbl
                (trips_booking_id, first_name, last_name, preferred_name,
                 email_address, day_phone, mobile_phone, date_of_birth, gender)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
                [id, ...values],
              );
            }
          }
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }

      let emailWarning;
      try {
        if (!mailer) throw new Error("SMTP email is not configured.");
        const [
          bookingResult,
          paymentResult,
          additionalPricesResult,
          refundsResult,
          emailOptionResult,
        ] = await Promise.all([
          query(
            `SELECT b.*, u.user_email_address,
                t.trips_name AS trip_name,
                t.trips_available_for AS available_for,
                to_char(d.trips_start_date, 'YYYY-MM-DD') AS date_start,
                to_char(d.trips_end_date, 'YYYY-MM-DD') AS date_end
             FROM alpenwild_trips_booking_tbl b
             LEFT JOIN alpenwild_user_tbl u ON u.user_id=b.user_id
             LEFT JOIN alpenwild_trips_tbl t ON t.trips_id=b.trips_id
             LEFT JOIN alpenwild_trips_date_tbl d
               ON d.trips_date_id=b.trips_date_id AND d.trips_id=b.trips_id
             WHERE b.trips_booking_id=$1`,
            [id],
          ),
          query(
            `SELECT to_char(payment_date, 'YYYY-MM-DD') AS payment_date,
                payment_price
             FROM alpenwild_trips_payment_tbl
             WHERE trips_booking_id=$1 AND payment_status='Paid'
             ORDER BY trips_payment_id DESC`,
            [id],
          ),
          query(
            `SELECT description, price, quantity, sign
             FROM alpenwild_trips_additional_price_tbl
             WHERE trips_booking_id=$1
             ORDER BY trips_additional_price_id`,
            [id],
          ),
          query(
            `SELECT COUNT(*) AS count, COALESCE(SUM(r.amount), 0) AS total
             FROM alpenwild_trips_payment_refund_tbl r
             JOIN alpenwild_trips_payment_tbl p
               ON p.trips_payment_id=r.trips_payment_id
             WHERE p.trips_booking_id=$1`,
            [id],
          ),
          query(
            `SELECT site_configuration_value
             FROM alpenwild_site_configuration_tbl
             WHERE site_configuration_id=18`,
          ),
        ]);
        const booking = bookingResult.rows[0];
        if (!booking)
          throw new Error("The updated booking could not be loaded.");
        const customerEmailEnabled =
          emailOptionResult.rows[0]?.site_configuration_value === "On" ||
          b.send_email === true;
        const customerEmail = String(booking.user_email_address || "").trim();

        const invoiceTripStartDate =
          booking.available_for === "Specefic Date"
            ? booking.date_start
            : booking.booking_start_date;
        const refundTotal = Number(refundsResult.rows[0]?.total || 0);
        const refundItems =
          refundTotal > 0
            ? [
                {
                  description:
                    Number(refundsResult.rows[0]?.count || 0) > 1
                      ? "Refunds (Total)"
                      : "Refund",
                  sign: "-",
                  price: refundTotal,
                },
              ]
            : [];
        const invoiceDate = new Date().toISOString().slice(0, 10);
        const invoice = await createTripBookingInvoicePdf({
          bookingId: id,
          bookingDate: invoiceDate,
          tripName: booking.trip_name,
          tripStartDate: invoiceTripStartDate,
          tripEndDate:
            booking.available_for === "Specefic Date"
              ? booking.date_end
              : booking.booking_end_date,
          dueDate:
            booking.payment_due_date ||
            calculateBookingPaymentDueDate(invoiceTripStartDate) ||
            invoiceDate,
          firstName: booking.user_first_name,
          lastName: booking.user_last_name,
          streetAddress: booking.user_street_address,
          streetAddress1: booking.user_street_address1,
          city: booking.user_city,
          state: booking.user_state,
          postalCode: booking.user_postal_code,
          country: booking.user_country,
          phone: booking.user_day_phone || booking.user_mobile_phone,
          email: customerEmail,
          partyNumber: booking.party_number,
          tripTotal: booking.trip_total_payment,
          singleSupplement: booking.trip_additional_payment,
          additionalItems: additionalPricesResult.rows,
          refundItems,
          totalDue: booking.trip_payment_due,
          paymentHistory: paymentResult.rows.map((payment) => ({
            date: payment.payment_date,
            amount: payment.payment_price,
          })),
        });
        const siteTitle = await getSiteTitle();
        const emailMessage = {
          from: {
            name: siteTitle,
            address: config.smtpFrom || config.smtpUser,
          },
          subject: String(
            b.email_subject || `${siteTitle} Trip Booking Confirmation`,
          ),
          html: createBookingConfirmationHtml(
            booking.user_first_name || "",
            String(b.email_message || ""),
          ),
          attachments: [
            {
              filename: `invoice${id}_${invoiceDate}.pdf`,
              content: invoice,
              contentType: "application/pdf",
            },
          ],
        };
        const deliveryErrors = [];
        if (customerEmailEnabled && !customerEmail)
          deliveryErrors.push("customer: email address is missing");
        for (const [to, label] of [
          ...(customerEmailEnabled && customerEmail
            ? [[customerEmail, "customer"]]
            : []),
          ["payments@yopmail.com,webgrity43@gmail.com", "internal recipients"],
        ]) {
          try {
            await mailer.sendMail({ ...emailMessage, to });
          } catch (error) {
            deliveryErrors.push(`${label}: ${error.message}`);
          }
        }
        if (deliveryErrors.length) throw new Error(deliveryErrors.join("; "));
      } catch (error) {
        emailWarning = `Booking was updated, but invoice email delivery failed: ${error.message}`;
      }
      res.json({
        message: "Booking updated successfully.",
        id,
        ...(emailWarning ? { emailWarning } : {}),
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
