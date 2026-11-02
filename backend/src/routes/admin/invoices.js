import { Router } from "express";
import { z } from "zod";

const invoiceItemSchema = z.object({
  name: z.string().trim().min(1).max(255),
  price: z.coerce.number(),
  quantity: z.coerce.number().int().min(1).max(10),
});

const invoiceSchema = z.object({
  first_name: z.string().trim().min(1).max(255),
  last_name: z.string().trim().min(1).max(255),
  user_email_address: z.string().trim().min(1).max(255),
  day_phone: z.string().trim().min(1).max(50),
  street_address: z.string().trim().min(1).max(255),
  street_address1: z.string().max(255).default(""),
  postal_code: z.string().trim().min(1).max(20),
  city: z.string().trim().min(1).max(255),
  country: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(255),
  items: z.array(invoiceItemSchema).min(1),
  deposit_amount: z.coerce.number(),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  email_subject: z.string().trim().min(1).max(255),
  email_message: z.string().trim().min(1).max(30000),
});

function serializeInvoice(row) {
  const names = String(row.product_name || "").split(",");
  const prices = String(row.product_price || "").split(",");
  const quantities = String(row.party_number || "").split(",");
  return {
    id: row.invoice_id,
    first_name: row.first_name || "",
    last_name: row.last_name || "",
    user_email_address: row.user_email_address || "",
    day_phone: row.day_phone || "",
    street_address: row.street_address || "",
    street_address1: row.street_address1 || "",
    postal_code: row.postal_code || "",
    city: row.city || "",
    country: row.country || "",
    state: row.state || "",
    product_name: names.join(", "),
    product_price: prices.join(", "),
    party_number: quantities.join(", "),
    items: names.map((name, index) => ({
      name,
      price: Number(prices[index] || 0),
      quantity: Number(quantities[index] || 1),
    })),
    deposit_amount: Number(row.deposit_amount || 0),
    due_amount: Number(row.due_amount || 0),
    invoice_date: row.invoice_date,
    due_date: row.due_date,
    email_subject: "Alpenwild Deposit Confirmation",
    email_message:
      "Just to confirm, we have sent you an invoice for #product_name#.",
  };
}

function invoiceValues(data) {
  const total = data.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  return [
    data.first_name,
    data.last_name,
    data.user_email_address,
    data.day_phone,
    data.street_address,
    data.street_address1,
    data.postal_code,
    data.city,
    data.country,
    data.state,
    data.items.map((item) => item.name).join(","),
    data.items.map((item) => item.price).join(","),
    data.deposit_amount,
    data.items.map((item) => item.quantity).join(","),
    data.due_date,
    data.invoice_date,
    total - data.deposit_amount,
    new Date(),
  ];
}

export function createInvoicesRouter({ query }) {
  const router = Router();

  router.get("/api/invoices", async (_req, res, next) => {
    try {
      const result = await query(
        "SELECT * FROM alpenwild_invoice_tbl ORDER BY invoice_id DESC",
      );
      res.json(result.rows.map(serializeInvoice));
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/invoices", async (req, res, next) => {
    try {
      const data = invoiceSchema.parse(req.body);
      const invoiceId = await query(
        "SELECT nextval(COALESCE(pg_get_serial_sequence($$alpenwild_invoice_tbl$$, $$invoice_id$$), $$alpenwild_invoice_id_seq$$)::regclass) AS invoice_id",
      );
      const result = await query(
        `INSERT INTO alpenwild_invoice_tbl
        (invoice_id,first_name,last_name,user_email_address,day_phone,street_address,street_address1,postal_code,city,country,state,product_name,product_price,deposit_amount,party_number,due_date,invoice_date,due_amount,created_at)
        OVERRIDING SYSTEM VALUE
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
        [invoiceId.rows[0].invoice_id, ...invoiceValues(data)],
      );
      res.status(201).json(serializeInvoice(result.rows[0]));
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/invoices/:id", async (req, res, next) => {
    try {
      const data = invoiceSchema.parse(req.body);
      const values = invoiceValues(data);
      const result = await query(
        `UPDATE alpenwild_invoice_tbl SET
        first_name=$1,last_name=$2,user_email_address=$3,day_phone=$4,street_address=$5,street_address1=$6,
        postal_code=$7,city=$8,country=$9,state=$10,product_name=$11,product_price=$12,deposit_amount=$13,
        party_number=$14,due_date=$15,invoice_date=$16,due_amount=$17 WHERE invoice_id=$18 RETURNING *`,
        [...values.slice(0, 17), req.params.id],
      );
      if (!result.rowCount)
        return res.status(404).json({ message: "Invoice not found." });
      res.json(serializeInvoice(result.rows[0]));
    } catch (error) {
      next(error);
    }
  });

  router.delete("/api/invoices/:id", async (req, res, next) => {
    try {
      const result = await query(
        "DELETE FROM alpenwild_invoice_tbl WHERE invoice_id=$1 RETURNING invoice_id",
        [req.params.id],
      );
      if (!result.rowCount)
        return res.status(404).json({ message: "Invoice not found." });
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
