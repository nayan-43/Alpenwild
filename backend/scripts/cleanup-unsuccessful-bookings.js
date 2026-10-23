import { pool, query } from "../src/db.js";

const args = new Set(process.argv.slice(2));
for (const arg of args)
  if (arg !== "--execute") throw new Error(`Unknown argument: ${arg}`);
const execute = args.has("--execute");

if (!pool) throw new Error("DATABASE_URL is not configured.");

async function run() {
  try {
    const counts = await query(
      `SELECT
         (SELECT COUNT(*)::int FROM alpenwild_trips_booking_tbl
           WHERE trip_total_payment=0) AS zero_payment_bookings,
         (SELECT COUNT(*)::int FROM alpenwild_trips_payment_tbl
           WHERE trips_booking_id=0) AS zero_id_payments,
         (SELECT COUNT(*)::int FROM alpenwild_trips_additional_booking_user_tbl
           WHERE trips_booking_id=0) AS zero_id_additional_users`,
    );
    // console.log("Legacy PHP cleanup candidates:", counts.rows[0]);
    if (!execute) {
      console.log("Dry run only. Re-run with --execute to delete these rows.");
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const bookings = await client.query(
        `DELETE FROM alpenwild_trips_booking_tbl
          WHERE trip_total_payment=0`,
      );
      const payments = await client.query(
        `DELETE FROM alpenwild_trips_payment_tbl
          WHERE trips_booking_id=0`,
      );
      const additionalUsers = await client.query(
        `DELETE FROM alpenwild_trips_additional_booking_user_tbl
          WHERE trips_booking_id=0`,
      );
      await client.query("COMMIT");
      console.log("Deleted rows:", {
        zeroIdPayments: payments.rowCount,
        zeroIdAdditionalUsers: additionalUsers.rowCount,
        zeroPaymentBookings: bookings.rowCount,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
