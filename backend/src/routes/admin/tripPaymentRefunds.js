import { Router } from "express";
import { z } from "zod";

export function createAdminTripPaymentRefundsRouter({
  pool,
  query,
  config,
  mailer,
  authorizeNetRefund,
  createTripBookingInvoicePdf,
  calculateBookingPaymentDueDate,
  createRefundConfirmationHtml,
  getSiteTitle,
}) {
  const router = Router();

  router.post(
    "/api/trip-payments/:paymentId/refund",
    async (req, res, next) => {
      let client;
      let transactionOpen = false;
      try {
        const paymentId = z.coerce
          .number()
          .int()
          .positive()
          .parse(req.params.paymentId);
        const amount = z.coerce.number().positive().parse(req.body?.amount);
        client = await pool.connect();
        await client.query("BEGIN");
        transactionOpen = true;
        const paymentResult = await client.query(
          `SELECT p.trips_payment_id, p.trips_booking_id, p.payment_price,
          p.payment_date, p.payment_status, p.transaction_id,
          p.credit_card_number, p.refunded_amount,
          b.user_id, b.user_first_name, b.user_last_name,
          b.user_street_address, b.user_street_address1, b.user_city,
          b.user_state, b.user_postal_code, b.user_country,
          b.user_day_phone, b.user_mobile_phone, b.party_number,
          b.trips_id, b.trips_date_id, b.booking_start_date, b.booking_end_date,
          b.trip_total_payment, b.trip_additional_payment,
          b.trip_payment_due, b.payment_due_date,
          u.user_email_address, t.trips_name AS trip_name,
          t.trips_available_for AS available_for,
          to_char(d.trips_start_date, 'YYYY-MM-DD') AS date_start,
          to_char(d.trips_end_date, 'YYYY-MM-DD') AS date_end
       FROM alpenwild_trips_payment_tbl p
       JOIN alpenwild_trips_booking_tbl b ON b.trips_booking_id=p.trips_booking_id
       LEFT JOIN alpenwild_user_tbl u ON u.user_id=b.user_id
       LEFT JOIN alpenwild_trips_tbl t ON t.trips_id=b.trips_id
       LEFT JOIN alpenwild_trips_date_tbl d
         ON d.trips_date_id=b.trips_date_id AND d.trips_id=b.trips_id
       WHERE p.trips_payment_id=$1
       FOR UPDATE OF p, b`,
          [paymentId],
        );
        const payment = paymentResult.rows[0];
        if (!payment) {
          await client.query("ROLLBACK");
          transactionOpen = false;
          return res.status(404).json({ message: "Payment record not found." });
        }
        const remaining =
          Number(payment.payment_price || 0) -
          Number(payment.refunded_amount || 0);
        if (amount > remaining) {
          await client.query("ROLLBACK");
          transactionOpen = false;
          return res
            .status(400)
            .json({ message: "Refund amount exceeds remaining balance." });
        }
        if (!payment.transaction_id) {
          await client.query("ROLLBACK");
          transactionOpen = false;
          return res
            .status(400)
            .json({ message: "No transaction id available for refund." });
        }
        if (!payment.credit_card_number) {
          await client.query("ROLLBACK");
          transactionOpen = false;
          return res
            .status(400)
            .json({ message: "No card information available for refund." });
        }
        const refund = await authorizeNetRefund({
          cardNumber: payment.credit_card_number,
          amount,
          transactionId: payment.transaction_id,
        });
        if (!refund.configured) {
          await client.query("ROLLBACK");
          transactionOpen = false;
          return res
            .status(503)
            .json({ message: "Authorize.Net credentials are not configured." });
        }
        if (!refund.approved) {
          await client.query("ROLLBACK");
          transactionOpen = false;
          return res.status(400).json({ message: refund.reason });
        }
        const refundedAmount = Number(payment.refunded_amount || 0) + amount;
        await client.query(
          `UPDATE alpenwild_trips_payment_tbl
       SET refunded_amount=$1, refund_status=$2
       WHERE trips_payment_id=$3`,
          [
            refundedAmount,
            refundedAmount >= Number(payment.payment_price)
              ? "full"
              : "partial",
            paymentId,
          ],
        );
        await client.query(
          `INSERT INTO alpenwild_trips_payment_refund_tbl
       (trips_payment_id, refund_transaction_id, amount, status, created_at)
       VALUES ($1,$2,$3,'approved',CURRENT_TIMESTAMP)`,
          [paymentId, refund.transactionId, amount],
        );
        await client.query(
          `UPDATE alpenwild_trips_booking_tbl
       SET trip_payment_due=COALESCE(trip_payment_due,0)+$1
       WHERE trips_booking_id=$2`,
          [amount, payment.trips_booking_id],
        );
        await client.query("COMMIT");
        transactionOpen = false;

        let emailWarning;
        const customerEmail = String(payment.user_email_address || "").trim();
        if (!customerEmail) {
          emailWarning =
            "Refund processed, but confirmation email was not sent: customer email address is missing.";
        } else if (!mailer) {
          emailWarning =
            "Refund processed, but confirmation email was not sent: SMTP email is not configured.";
        } else {
          try {
            const [paymentHistoryResult, additionalItemsResult, refundsResult] =
              await Promise.all([
                query(
                  `SELECT to_char(payment_date, 'YYYY-MM-DD') AS payment_date,
                  payment_price
               FROM alpenwild_trips_payment_tbl
               WHERE trips_booking_id=$1 AND payment_status='Paid'
               ORDER BY trips_payment_id DESC`,
                  [payment.trips_booking_id],
                ),
                query(
                  `SELECT description, price, quantity, sign
               FROM alpenwild_trips_additional_price_tbl
               WHERE trips_booking_id=$1
               ORDER BY trips_additional_price_id`,
                  [payment.trips_booking_id],
                ),
                query(
                  `SELECT COUNT(*) AS count, COALESCE(SUM(r.amount), 0) AS total
               FROM alpenwild_trips_payment_refund_tbl r
               JOIN alpenwild_trips_payment_tbl p
                 ON p.trips_payment_id=r.trips_payment_id
               WHERE p.trips_booking_id=$1`,
                  [payment.trips_booking_id],
                ),
              ]);
            const bookingDate = new Date().toISOString().slice(0, 10);
            const invoiceTripStartDate =
              payment.available_for === "Specefic Date"
                ? payment.date_start
                : payment.booking_start_date;
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
            const invoice = await createTripBookingInvoicePdf({
              bookingId: payment.trips_booking_id,
              bookingDate,
              tripName: payment.trip_name,
              tripStartDate: invoiceTripStartDate,
              tripEndDate:
                payment.available_for === "Specefic Date"
                  ? payment.date_end
                  : payment.booking_end_date,
              dueDate:
                payment.payment_due_date ||
                calculateBookingPaymentDueDate(invoiceTripStartDate) ||
                bookingDate,
              firstName: payment.user_first_name,
              lastName: payment.user_last_name,
              streetAddress: payment.user_street_address,
              streetAddress1: payment.user_street_address1,
              city: payment.user_city,
              state: payment.user_state,
              postalCode: payment.user_postal_code,
              country: payment.user_country,
              phone: payment.user_day_phone || payment.user_mobile_phone,
              email: customerEmail,
              partyNumber: payment.party_number,
              tripTotal: payment.trip_total_payment,
              singleSupplement: payment.trip_additional_payment,
              additionalItems: additionalItemsResult.rows,
              refundItems,
              totalDue: Number(payment.trip_payment_due || 0) + amount,
              paymentHistory: paymentHistoryResult.rows.map((item) => ({
                date: item.payment_date,
                amount: item.payment_price,
              })),
            });
            const siteTitle = await getSiteTitle();
            const emailMessage = {
              from: {
                name: siteTitle,
                address: config.smtpFrom || config.smtpUser,
              },
              subject: `${siteTitle} Refund Confirmation (Booking #${payment.trips_booking_id})`,
              html: createRefundConfirmationHtml({
                firstName: payment.user_first_name,
                bookingId: payment.trips_booking_id,
                amount,
                transactionId: refund.transactionId,
              }),
              attachments: [
                {
                  filename: `invoice${payment.trips_booking_id}_${bookingDate}.pdf`,
                  content: invoice,
                  contentType: "application/pdf",
                },
              ],
            };
            const deliveryErrors = [];
            for (const [to, label] of [
              [customerEmail, "customer"],
              [
                "payments@yopmail.com,webgrity43@gmail.com",
                "internal recipients",
              ],
            ]) {
              try {
                await mailer.sendMail({ ...emailMessage, to });
              } catch (error) {
                deliveryErrors.push(`${label}: ${error.message}`);
              }
            }
            if (deliveryErrors.length)
              emailWarning = `Refund processed, but confirmation email delivery failed: ${deliveryErrors.join("; ")}`;
          } catch (error) {
            emailWarning = `Refund processed, but confirmation email delivery failed: ${error.message}`;
          }
        }
        res.json({
          message: "Refund processed successfully.",
          refund_transaction_id: refund.transactionId,
          ...(emailWarning ? { emailWarning } : {}),
        });
      } catch (error) {
        if (transactionOpen && client) {
          try {
            await client.query("ROLLBACK");
          } catch (rollbackError) {
            console.error(
              "Trip refund transaction rollback failed.",
              rollbackError,
            );
          }
        }
        next(error);
      } finally {
        client?.release();
      }
    },
  );

  return router;
}
