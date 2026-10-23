import fs from "node:fs/promises";
import path from "node:path";
import { query, pool } from "./db.js";

const bootstrapMigration = await fs.readFile(
  path.resolve(process.cwd(), "database/001_initial.sql"),
  "utf8",
);
if (!pool) {
  throw new Error(
    "DATABASE_URL is not configured. Copy .env.example to .env first.",
  );
}

const existingOrderTables = await query(
  "SELECT to_regclass(format('%I.%I', current_schema(), 'alpenwild_order_tbl')) IS NOT NULL AS exists",
);
if (!existingOrderTables.rows[0].exists) {
  await query(bootstrapMigration);
  console.log("PostgreSQL bootstrap migration applied successfully.");
} else {
  console.log(
    "Existing shop order table found; skipping the bootstrap migration.",
  );
}
await pool.end();
