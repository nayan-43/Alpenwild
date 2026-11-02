import { Router } from "express";
import crypto from "node:crypto";
import { z } from "zod";

export function createTripPaymentsRouter({
  query,
  pool,
  config,
  mailer,
  verifyRecaptcha,
  authorizeNetCharge,
  isValidPaymentLinkSignature,
  createTripBookingInvoicePdf,
  calculateBookingPaymentDueDate,
  createPaymentConfirmationHtml,
  getSiteTitle,
}) {
  const router = Router();
  router.post("/api/trip-payments", async (req, res, next) => {
    let paymentId;
    let paymentRequestClaimed = false;
    try {
      const data = z
        .object({
          payment_type: z.literal("trip").default("trip"),
          client_request_id: z.string().uuid(),
          trip_id: z.coerce.number().int().positive(),
          booking_id: z.coerce.number().int().positive().optional(),
          payment_link_type: z
            .enum(["due", "custom", "define_admin"])
            .optional(),
          payment_link_amount: z.coerce.number().positive().optional(),
          payment_link_signature: z
            .string()
            .regex(/^[a-f0-9]{64}$/i)
            .optional(),
          email: z.string().email(),
          name_on_card: z.string().trim().min(1).max(255),
          billing_address: z.string().trim().min(1).max(255),
          city: z.string().trim().min(1).max(255),
          state: z.string().trim().min(1).max(255),
          zipcode: z.string().trim().min(1).max(30),
          amount: z.coerce
            .number()
            .finite()
            .positive()
            .refine(
              (amount) =>
                Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-7,
              "Enter an amount with no more than two decimal places.",
            ),
          credit_card_number: z.string().regex(/^\d{14,25}$/),
          credit_card_expire_month: z.string().regex(/^(0[1-9]|1[0-2])$/),
          credit_card_expire_year: z.coerce
            .number()
            .int()
            .min(new Date().getFullYear())
            .max(new Date().getFullYear() + 11),
          credit_card_cvv_number: z.string().regex(/^\d{3,4}$/),
          credit_card_last_four: z.string().regex(/^\d{4}$/),
          recaptcha_token: z.string().max(5000).default(""),
        })
        .parse(req.body);
      if (
        data.booking_id &&
        (!data.payment_link_type ||
          !data.payment_link_signature ||
          !isValidPaymentLinkSignature(
            data.booking_id,
            data.payment_link_type,
            data.payment_link_amount,
            data.payment_link_signature,
          ))
      )
        return res
          .status(400)
          .json({ message: "This payment link is invalid." });
      if (
        !data.booking_id &&
        (data.payment_link_type || data.payment_link_signature)
      )
        return res
          .status(400)
          .json({ message: "This payment link is invalid." });
      if (data.amount < 50)
        return res.status(400).json({
          message: "You have to pay minimun $50.",
        });
      if (config.recaptchaEnabled && !config.recaptchaSecret)
        return res
          .status(503)
          .json({ message: "Online payments are not configured." });
      if (config.recaptchaEnabled && !data.recaptcha_token)
        return res
          .status(400)
          .json({ message: "Please click on the reCAPTCHA box." });
      if (
        config.recaptchaEnabled &&
        !(await verifyRecaptcha(data.recaptcha_token))
      )
        return res
          .status(400)
          .json({ message: "Robot verification failed, please try again." });
      if (!config.authorizeNetLogin || !config.authorizeNetTransactionKey)
        return res
          .status(503)
          .json({ message: "Online card payments are not configured." });

      const now = new Date();
      if (
        data.credit_card_expire_year === now.getFullYear() &&
        Number(data.credit_card_expire_month) < now.getMonth() + 1
      )
        return res.status(400).json({
          message: "The credit card has expired. Please use a valid card.",
        });

      const userResult = await query(
        `SELECT user_id, user_first_name, user_last_name,
          user_day_phone, user_mobile_phone, user_street_address,
          user_street_address1, user_city, user_state, user_postal_code,
          user_country, user_email_address
         FROM alpenwild_user_tbl
        WHERE LOWER(user_email_address)=LOWER($1)
        ORDER BY user_first_name LIMIT 1`,
        [data.email],
      );
      const user = userResult.rows[0];
      if (!user)
        return res.status(404).json({
          message:
            "You seem to have entered an incorrect email id or a different email id. Please check and correct to proceed further. In case you are a new visitor and are looking to make a new booking for the selected trip, then please click here.",
        });
      const bookingResult = await query(
        `SELECT b.trips_booking_id AS id, b.trip_payment_due AS due,
          b.trip_total_payment AS trip_total,
          b.trip_additional_payment AS single_supplement,
          b.party_number, b.rooming_preference,
          b.booking_start_date, b.booking_end_date, b.payment_due_date,
          t.trips_name AS trip_name, t.trips_available_for AS available_for,
          to_char(d.trips_start_date, 'YYYY-MM-DD') AS date_start,
          to_char(d.trips_end_date, 'YYYY-MM-DD') AS date_end
         FROM alpenwild_trips_booking_tbl b
         JOIN alpenwild_trips_tbl t ON t.trips_id=b.trips_id
         LEFT JOIN alpenwild_trips_date_tbl d
           ON d.trips_date_id=b.trips_date_id AND d.trips_id=b.trips_id
        WHERE b.trips_id=$1 AND b.user_id=$2
          AND b.trips_booking_status='Active'
          AND ($3::bigint IS NULL OR b.trips_booking_id=$3)
        ORDER BY b.trips_booking_id DESC LIMIT 1`,
        [data.trip_id, user.user_id, data.booking_id || null],
      );
      const booking = bookingResult.rows[0];
      if (!booking)
        return res.status(404).json({
          message:
            "There's no open Trip Booking by you for the selected trip. Please check if you've mistakenly chosen an incorrect trip. In case you are looking at making a new Booking for the selected trip, then click here.",
        });
      const requestFingerprint = crypto
        .createHash("sha256")
        .update(
          JSON.stringify({
            booking_id: booking.id,
            trip_id: data.trip_id,
            email: user.user_email_address.toLowerCase(),
            amount: data.amount,
            name_on_card: data.name_on_card,
            card_last_four: data.credit_card_last_four,
          }),
        )
        .digest("hex");
      const claimedRequest = await query(
        `INSERT INTO alpenwild_public_trip_payment_request_tbl
        (request_id,booking_id,request_fingerprint,status)
       VALUES ($1,$2,$3,'processing')
       ON CONFLICT (request_id) DO NOTHING
       RETURNING request_id`,
        [data.client_request_id, booking.id, requestFingerprint],
      );
      paymentRequestClaimed = Boolean(claimedRequest.rowCount);
      if (!claimedRequest.rowCount) {
        const existingResult = await query(
          `SELECT booking_id,request_fingerprint,status,payment_id,
            transaction_id,response_message
           FROM alpenwild_public_trip_payment_request_tbl
          WHERE request_id=$1`,
          [data.client_request_id],
        );
        const existing = existingResult.rows[0];
        if (
          !existing ||
          Number(existing.booking_id) !== Number(booking.id) ||
          existing.request_fingerprint !== requestFingerprint
        )
          return res.status(409).json({
            message:
              "This payment submission has already been used with different details. Reload the page before trying again.",
          });
        if (existing.status === "paid") {
          const balanceResult = await query(
            `SELECT trip_payment_due AS remaining_balance
             FROM alpenwild_trips_booking_tbl
            WHERE trips_booking_id=$1`,
            [booking.id],
          );
          return res.status(200).json({
            id: existing.payment_id,
            status: "Paid",
            transaction_id: existing.transaction_id,
            remaining_balance: Number(
              balanceResult.rows[0]?.remaining_balance || 0,
            ),
            message: "Payment approved.",
          });
        }
        if (existing.status === "declined")
          return res.status(402).json({
            message: existing.response_message || "Payment was declined.",
            retryable: true,
          });
        return res.status(409).json({
          message:
            "This payment is already being processed or its result is not yet confirmed. Do not submit another payment. Please wait or contact Alpenwild.",
          payment_id: existing.payment_id,
        });
      }
      const currentDue = Number(booking.due || 0);
      const rejectRequest = async (
        statusCode,
        message,
        pendingPaymentId = null,
      ) => {
        if (pendingPaymentId)
          await query(
            "DELETE FROM alpenwild_trips_payment_tbl WHERE trips_payment_id=$1 AND payment_status='Pending'",
            [pendingPaymentId],
          );
        await query(
          `UPDATE alpenwild_public_trip_payment_request_tbl
            SET status='declined',payment_id=NULL,response_message=$1,
                updated_at=CURRENT_TIMESTAMP
          WHERE request_id=$2`,
          [message, data.client_request_id],
        );
        return res.status(statusCode).json({ message, retryable: true });
      };
      if (currentDue <= 0)
        return rejectRequest(404, "This booking has no remaining balance.");
      if (data.amount > currentDue)
        return rejectRequest(
          400,
          "Payment amount cannot exceed the outstanding balance.",
        );
      if (
        (data.payment_link_type === "due" && data.amount !== currentDue) ||
        (data.payment_link_type === "define_admin" &&
          data.amount !== data.payment_link_amount)
      )
        return rejectRequest(
          400,
          "The payment amount or booking balance has changed. Reload the payment link.",
        );

      const pendingPayment = await query(
        `INSERT INTO alpenwild_trips_payment_tbl
        (trips_booking_id,name_on_credit_card,credit_card_number,payment_price,
         payment_date,payment_status,transaction_id,gateway)
       VALUES ($1,$2,$3,$4,CURRENT_DATE,'Pending',NULL,'authorize_net')
       RETURNING trips_payment_id AS id`,
        [
          booking.id,
          data.name_on_card,
          data.credit_card_last_four,
          data.amount,
        ],
      );
      paymentId = pendingPayment.rows[0].id;
      await query(
        `UPDATE alpenwild_public_trip_payment_request_tbl
          SET payment_id=$1,updated_at=CURRENT_TIMESTAMP
        WHERE request_id=$2`,
        [paymentId, data.client_request_id],
      );
      const paymentTransaction = await pool.connect();
      let remainingBalance;
      let charge;
      try {
        await paymentTransaction.query("BEGIN");
        const lockedBooking = await paymentTransaction.query(
          `SELECT trip_payment_due AS due
           FROM alpenwild_trips_booking_tbl
          WHERE trips_booking_id=$1 AND trips_booking_status='Active'
          FOR UPDATE`,
          [booking.id],
        );
        const lockedDue = Number(lockedBooking.rows[0]?.due || 0);
        if (!lockedBooking.rowCount || data.amount > lockedDue) {
          await paymentTransaction.query("ROLLBACK");
          return rejectRequest(
            400,
            "Payment amount cannot exceed the outstanding balance. Reload the payment link.",
            paymentId,
          );
        }
        if (
          (data.payment_link_type === "due" && data.amount !== lockedDue) ||
          (data.payment_link_type === "define_admin" &&
            data.amount !== data.payment_link_amount)
        ) {
          await paymentTransaction.query("ROLLBACK");
          return rejectRequest(
            400,
            "The payment amount or booking balance has changed. Reload the payment link.",
            paymentId,
          );
        }
        const gatewayInvoice = `p${crypto
          .createHash("sha256")
          .update(data.client_request_id)
          .digest("hex")
          .slice(0, 19)}`;
        charge = await authorizeNetCharge({
          cardNumber: data.credit_card_number,
          expiration: `${data.credit_card_expire_month}${data.credit_card_expire_year}`,
          amount: data.amount,
          cvv: data.credit_card_cvv_number,
          invoice: gatewayInvoice,
          email: user.user_email_address,
          firstName: data.name_on_card,
          address: data.billing_address,
          city: data.city,
          state: data.state || "N/A",
          zip: data.zipcode,
          customerIp: req.ip || "",
        });
        if (!charge.approved) {
          await paymentTransaction.query(
            "DELETE FROM alpenwild_trips_payment_tbl WHERE trips_payment_id=$1 AND payment_status='Pending'",
            [paymentId],
          );
          await paymentTransaction.query(
            `UPDATE alpenwild_public_trip_payment_request_tbl
              SET status='declined',payment_id=NULL,response_message=$1,
                  updated_at=CURRENT_TIMESTAMP
            WHERE request_id=$2`,
            [charge.reason, data.client_request_id],
          );
          await paymentTransaction.query("COMMIT");
          paymentId = null;
          return res.status(402).json({
            message: charge.reason,
            retryable: true,
          });
        }
        const paymentStatusResult = await paymentTransaction.query(
          `UPDATE alpenwild_trips_payment_tbl
            SET payment_status='Paid',transaction_id=$1
          WHERE trips_payment_id=$2
          RETURNING trips_payment_id`,
          [charge.transactionId || null, paymentId],
        );
        if (!paymentStatusResult.rowCount)
          throw new Error("Approved payment could not be marked as paid.");
        const balance = await paymentTransaction.query(
          `UPDATE alpenwild_trips_booking_tbl
            SET trip_payment_due=GREATEST(0, COALESCE(trip_payment_due, 0) - $1)
          WHERE trips_booking_id=$2 AND COALESCE(trip_payment_due, 0) >= $1
          RETURNING trip_payment_due AS due`,
          [data.amount, booking.id],
        );
        if (!balance.rowCount)
          throw new Error(
            "Approved payment could not update the booking balance.",
          );
        remainingBalance = Number(balance.rows[0].due);
        await paymentTransaction.query(
          `UPDATE alpenwild_public_trip_payment_request_tbl
            SET status='paid',transaction_id=$1,response_message='Payment approved.',
                updated_at=CURRENT_TIMESTAMP
          WHERE request_id=$2`,
          [charge.transactionId || null, data.client_request_id],
        );
        await paymentTransaction.query("COMMIT");
      } catch (error) {
        try {
          await paymentTransaction.query("ROLLBACK");
        } catch (rollbackError) {
          console.error(
            "Trip payment transaction rollback failed.",
            rollbackError,
          );
        }
        throw error;
      } finally {
        paymentTransaction.release();
      }
      if (mailer) {
        try {
          const templateResult = await query(
            `SELECT email_template_subject,email_template_message
             FROM alpenwild_email_template_tbl
            WHERE email_template_id=$1 LIMIT 1`,
            [remainingBalance === 0 ? 5 : 2],
          );
          const template = templateResult.rows[0];
          if (!template)
            throw new Error(
              `Payment confirmation email template ${remainingBalance === 0 ? 5 : 2} is missing.`,
            );
          const paymentsResult = await query(
            `SELECT to_char(payment_date, 'YYYY-MM-DD') AS payment_date,
                  payment_price
             FROM alpenwild_trips_payment_tbl
            WHERE trips_booking_id=$1 AND payment_status='Paid'
            ORDER BY trips_payment_id DESC`,
            [booking.id],
          );
          const additionalItemsResult = await query(
            `SELECT description, sign, price, quantity
             FROM alpenwild_trips_additional_price_tbl
            WHERE trips_booking_id=$1
            ORDER BY trips_additional_price_id ASC`,
            [booking.id],
          );
          const refundResult = await query(
            `SELECT COALESCE(SUM(r.amount), 0) AS total,
                  COUNT(*) AS count
             FROM alpenwild_trips_payment_refund_tbl r
             JOIN alpenwild_trips_payment_tbl p
               ON p.trips_payment_id=r.trips_payment_id
            WHERE p.trips_booking_id=$1`,
            [booking.id],
          );
          const totalRefund = Number(refundResult.rows[0]?.total || 0);
          const refundItems =
            totalRefund > 0
              ? [
                  {
                    description:
                      Number(refundResult.rows[0].count) > 1
                        ? "Refunds (Total)"
                        : "Refund",
                    sign: "-",
                    price: totalRefund,
                  },
                ]
              : [];
          const invoiceTripStartDate =
            booking.available_for === "Specefic Date"
              ? booking.date_start
              : booking.booking_start_date;
          const invoice = await createTripBookingInvoicePdf({
            bookingId: booking.id,
            bookingDate: new Date().toISOString().slice(0, 10),
            tripName: booking.trip_name,
            tripStartDate: invoiceTripStartDate,
            tripEndDate:
              booking.available_for === "Specefic Date"
                ? booking.date_end
                : booking.booking_end_date,
            dueDate:
              booking.payment_due_date ||
              calculateBookingPaymentDueDate(invoiceTripStartDate) ||
              new Date().toISOString().slice(0, 10),
            firstName: user.user_first_name,
            lastName: user.user_last_name,
            streetAddress: data.billing_address,
            streetAddress1: user.user_street_address1,
            city: data.city || user.user_city,
            state: data.state || user.user_state,
            postalCode: data.zipcode || user.user_postal_code,
            country: user.user_country,
            phone: user.user_day_phone || user.user_mobile_phone,
            email: user.user_email_address,
            partyNumber: booking.party_number,
            tripTotal: booking.trip_total,
            singleSupplement: booking.single_supplement,
            additionalItems: additionalItemsResult.rows,
            refundItems,
            paymentAmount: data.amount,
            totalDue: remainingBalance,
            paymentHistory: paymentsResult.rows.map((payment) => ({
              date: payment.payment_date,
              amount: payment.payment_price,
            })),
          });
          const siteTitle = await getSiteTitle();
          await mailer.sendMail({
            from: {
              name: siteTitle,
              address: config.smtpFrom || config.smtpUser,
            },
            to: user.user_email_address,
            subject: template.email_template_subject,
            html: createPaymentConfirmationHtml(
              user.user_first_name,
              template.email_template_message,
            ),
            attachments: [
              {
                filename: `invoice${booking.id}_${new Date().toISOString().slice(0, 10)}.pdf`,
                content: invoice,
                contentType: "application/pdf",
              },
            ],
          });
        } catch (error) {
          console.error("Trip payment confirmation email failed.", error);
        }
      } else {
        console.error(
          "Trip payment confirmation email was not sent because SMTP is not configured.",
        );
      }
      res.status(201).json({
        id: paymentId,
        status: "Paid",
        transaction_id: charge.transactionId || null,
        remaining_balance: remainingBalance,
        message: "Payment approved.",
      });
    } catch (error) {
      if (paymentRequestClaimed) {
        console.error(
          "Trip payment request outcome could not be confirmed.",
          error,
        );
        return res.status(502).json({
          message:
            "We could not confirm the payment result. Do not submit another payment. Contact Alpenwild before trying again.",
          ...(paymentId ? { payment_id: paymentId } : {}),
        });
      }
      next(error);
    }
  });
  return router;
}
