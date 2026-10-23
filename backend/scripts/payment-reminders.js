import nodemailer from "nodemailer";
import { config } from "../src/config.js";
import { pool, query } from "../src/db.js";
import { createTripBookingInvoicePdf } from "../src/tripBookingEmail.js";
import {
  calculateReminderInvoiceDueDate,
  createSignedPaymentUrl,
  escapeHtml,
  getPaymentReminderType,
} from "../src/paymentReminderSchedule.js";

const args = new Set(process.argv.slice(2));
for (const arg of args) {
  if (arg !== "--send" && !arg.startsWith("--date="))
    throw new Error(`Unknown argument: ${arg}`);
}
const sendEnabled = args.has("--send");
const dateArgument = [...args].find((arg) => arg.startsWith("--date="));
const requestedDate = dateArgument?.slice("--date=".length);
if (requestedDate && !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate))
  throw new Error("--date must use YYYY-MM-DD format.");
if (requestedDate) {
  const parsedDate = new Date(`${requestedDate}T00:00:00.000Z`);
  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== requestedDate
  )
    throw new Error("--date must be a real calendar date.");
}
if (requestedDate && sendEnabled)
  throw new Error("--date is available for dry runs only.");

if (!pool) throw new Error("DATABASE_URL is not configured.");

async function getSiteTitle() {
  const result = await query(
    `SELECT site_configuration_value
       FROM alpenwild_site_configuration_tbl
      WHERE site_configuration_id=$1`,
    [1],
  );
  return (
    String(result.rows[0]?.site_configuration_value || "").trim() || "Alpenwild"
  );
}

function dateRange(booking) {
  if (booking.available_for === "Specefic Date")
    return {
      start: booking.date_start || booking.booking_start_date,
      end: booking.date_end || booking.booking_end_date,
    };
  return {
    start: booking.booking_start_date || booking.date_start,
    end: booking.booking_end_date || booking.date_end,
  };
}

async function loadInvoice(booking, today, tripStartDate) {
  const [additionalItems, paymentHistory, refunds] = await Promise.all([
    query(
      `SELECT description, sign, price, quantity
         FROM alpenwild_trips_additional_price_tbl
        WHERE trips_booking_id=$1
        ORDER BY trips_additional_price_id ASC`,
      [booking.booking_id],
    ),
    query(
      `SELECT to_char(payment_date, 'YYYY-MM-DD') AS date, payment_price AS amount
         FROM alpenwild_trips_payment_tbl
        WHERE trips_booking_id=$1
        ORDER BY trips_payment_id DESC`,
      [booking.booking_id],
    ),
    query(
      `SELECT COALESCE(SUM(r.amount), 0) AS total, COUNT(*) AS count
         FROM alpenwild_trips_payment_refund_tbl r
         JOIN alpenwild_trips_payment_tbl p
           ON p.trips_payment_id=r.trips_payment_id
        WHERE p.trips_booking_id=$1`,
      [booking.booking_id],
    ),
  ]);

  const refundTotal = Number(refunds.rows[0]?.total || 0);
  const refundItems =
    refundTotal > 0
      ? [
          {
            description:
              Number(refunds.rows[0].count) > 1 ? "Refunds (Total)" : "Refund",
            sign: "-",
            price: refundTotal,
          },
        ]
      : [];
  const dates = dateRange(booking);
  const dueDate =
    booking.payment_due_date ||
    calculateReminderInvoiceDueDate(today, tripStartDate) ||
    today;

  return createTripBookingInvoicePdf({
    bookingId: booking.booking_id,
    bookingDate: today,
    tripName: booking.trip_name,
    tripStartDate: dates.start,
    tripEndDate: dates.end,
    dueDate,
    firstName: booking.first_name,
    lastName: booking.last_name,
    streetAddress: booking.street_address,
    streetAddress1: booking.street_address1,
    city: booking.city,
    state: booking.state,
    postalCode: booking.postal_code,
    country: booking.country,
    phone: booking.phone,
    email: booking.email,
    partyNumber: booking.party_number,
    tripTotal: Number(booking.trip_total_payment || 0),
    singleSupplement:
      booking.rooming_preference === "Single occupancy"
        ? Number(booking.trip_additional_payment || 0)
        : 0,
    additionalItems: additionalItems.rows,
    refundItems,
    totalDue: Number(booking.trip_payment_due || 0),
    paymentHistory: paymentHistory.rows.map((payment) => ({
      date: payment.date,
      amount: Number(payment.amount),
    })),
  });
}

async function run() {
  try {
    const dateResult = requestedDate
      ? { rows: [{ today: requestedDate }] }
      : await query("SELECT CURRENT_DATE::text AS today");
    const today = dateResult.rows[0].today;
    const [settings, template, bookings] = await Promise.all([
      query(
        `SELECT site_configuration_value AS value
           FROM alpenwild_site_configuration_tbl
          WHERE site_configuration_id=19`,
      ),
      query(
        `SELECT email_template_subject AS subject,
                email_template_message AS body
           FROM alpenwild_email_template_tbl
          WHERE email_template_id=3`,
      ),
      query(
        `SELECT b.trips_booking_id AS booking_id, b.trips_id,
                b.trips_date_id, b.party_number, b.rooming_preference,
                b.trip_total_payment, b.trip_additional_payment,
                b.trip_payment_due,
                to_char(b.payment_due_date, 'YYYY-MM-DD') AS payment_due_date,
                to_char(b.booking_start_date, 'YYYY-MM-DD') AS booking_start_date,
                to_char(b.booking_end_date, 'YYYY-MM-DD') AS booking_end_date,
                to_char(b.trips_booking_date, 'YYYY-MM-DD') AS trips_booking_date,
                t.trips_name AS trip_name, t.trips_available_for AS available_for,
                to_char(d.trips_start_date, 'YYYY-MM-DD') AS date_start,
                to_char(d.trips_end_date, 'YYYY-MM-DD') AS date_end,
                COALESCE(NULLIF(b.shipping_first_name, ''), u.user_first_name) AS first_name,
                COALESCE(NULLIF(b.shipping_last_name, ''), u.user_last_name) AS last_name,
                COALESCE(NULLIF(b.shipping_street_address, ''), u.user_street_address) AS street_address,
                COALESCE(NULLIF(b.shipping_street_address1, ''), u.user_street_address1) AS street_address1,
                COALESCE(NULLIF(b.shipping_city, ''), u.user_city) AS city,
                COALESCE(NULLIF(b.shipping_state, ''), u.user_state) AS state,
                COALESCE(NULLIF(b.shipping_postal_code, ''), u.user_postal_code) AS postal_code,
                COALESCE(NULLIF(b.shipping_country, ''), u.user_country) AS country,
                COALESCE(NULLIF(u.user_day_phone, ''), u.user_mobile_phone) AS phone,
                u.user_email_address AS email
           FROM alpenwild_trips_booking_tbl b
           JOIN alpenwild_trips_tbl t ON t.trips_id=b.trips_id
           JOIN alpenwild_user_tbl u ON u.user_id=b.user_id
           LEFT JOIN alpenwild_trips_date_tbl d
             ON d.trips_date_id=b.trips_date_id AND d.trips_id=b.trips_id
          WHERE b.trips_booking_status='Active'
            AND COALESCE(b.trip_payment_due, 0) > 0
             AND EXISTS (
               SELECT 1
                 FROM alpenwild_trips_payment_tbl p
                WHERE p.trips_booking_id=b.trips_booking_id
             )
           ORDER BY b.trips_booking_date DESC NULLS LAST`,
      ),
    ]);

    if (
      !template.rows[0] ||
      typeof template.rows[0].body !== "string" ||
      typeof template.rows[0].subject !== "string"
    )
      throw new Error("Payment reminder email template (ID 3) was not found.");
    const eligibleBookings = bookings.rows.flatMap((booking) => {
      const tripStartDate = booking.booking_start_date || booking.date_start;
      const reminderType = getPaymentReminderType({
        today,
        tripStartDate,
        bookingDate: booking.trips_booking_date,
        pendingAmount: booking.trip_payment_due,
      });
      return reminderType ? [{ booking, reminderType, tripStartDate }] : [];
    });

    console.log(
      `Payment reminders for ${today}: ${eligibleBookings.length} eligible booking(s).`,
    );
    if (!sendEnabled) {
      for (const { booking, reminderType } of eligibleBookings)
        console.log(
          `DRY RUN booking=${booking.booking_id} reminder=${reminderType} email=${booking.email}`,
        );
      console.log("No email sent. Re-run with --send to deliver reminders.");
      return;
    }

    if (settings.rows[0]?.value !== "On") {
      console.log("Reminder_Email is not On; no emails were sent.");
      return;
    }
    if (!config.smtpHost || !config.smtpUser || !config.smtpPassword)
      throw new Error("SMTP_HOST, SMTP_USER, and SMTP_PASSWORD are required.");
    if (typeof config.clientOrigin !== "string")
      throw new Error(
        "Set CLIENT_ORIGIN to the public React site URL before sending reminders.",
      );
    const publicOrigin = new URL(config.clientOrigin);
    if (["localhost", "127.0.0.1", "::1"].includes(publicOrigin.hostname))
      throw new Error(
        "CLIENT_ORIGIN must be the deployed public React site URL before sending reminders.",
      );
    if (!config.jwtSecret)
      throw new Error("JWT_SECRET is required to create payment links.");

    const mailer = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: { user: config.smtpUser, pass: config.smtpPassword },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 30000,
    });
    const siteTitle = await getSiteTitle();
    const failures = [];
    for (const { booking, reminderType, tripStartDate } of eligibleBookings) {
      if (!booking.email) {
        failures.push(`Booking ${booking.booking_id} has no customer email.`);
        continue;
      }
      try {
        const attachment = await loadInvoice(booking, today, tripStartDate);
        const totalDueUrl = createSignedPaymentUrl({
          origin: config.clientOrigin,
          bookingId: booking.booking_id,
          type: "due",
          jwtSecret: config.jwtSecret,
        });
        const partialDueUrl = createSignedPaymentUrl({
          origin: config.clientOrigin,
          bookingId: booking.booking_id,
          type: "custom",
          jwtSecret: config.jwtSecret,
        });
        const body = template.rows[0].body
          .replaceAll("#TOTALDUE#", totalDueUrl)
          .replaceAll("#PARTIALDUE#", partialDueUrl);
        const reminderEmail = {
          from: {
            name: siteTitle,
            address: config.smtpFrom || config.smtpUser,
          },
          subject: template.rows[0].subject,
          html: `Dear ${escapeHtml(booking.first_name)},<br>${body}<p>Regards,<br><br>${escapeHtml(siteTitle)}<br>801-226-9026<br><a href="https://www.alpenwild.com">www.alpenwild.com</a></p>`,
          attachments: [
            {
              filename: `invoice${booking.booking_id}_${today}.pdf`,
              content: attachment,
              contentType: "application/pdf",
            },
          ],
        };
        await mailer.sendMail({
          ...reminderEmail,
          to: booking.email,
        });
        await mailer.sendMail({
          ...reminderEmail,
          to: "payments@yopmail.com,coder.web@yahoo.com",
        });
        console.log(
          `SENT booking=${booking.booking_id} reminder=${reminderType} customer=${booking.email} internal=payments@yopmail.com,coder.web@yahoo.com`,
        );
      } catch (error) {
        failures.push(`Booking ${booking.booking_id}: ${error.message}`);
      }
    }
    if (failures.length)
      throw new Error(`Reminder delivery failed:\n${failures.join("\n")}`);
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
