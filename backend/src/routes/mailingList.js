import { Router } from "express";
import { z } from "zod";

const mailingListSchema = z.object({
  first_name: z.string().trim().min(1).max(255),
  last_name: z.string().trim().min(1).max(255),
  email_address: z.string().trim().min(1).max(255),
  user_type: z.enum([
    "",
    "Prospect",
    "Friend",
    "Client",
    "Referral",
    "Trade",
    "Agent",
    "Media",
    "Employee",
  ]),
  newsletter_signup_option: z.string().max(1000).default(""),
});

const mailingListSelect = `SELECT mailing_list_id AS id, first_name, last_name,
  email_address, user_type, newsletter_signup_option, source_of_inquiry,
  TO_CHAR(date_of_inquiry, 'YYYY-MM-DD') AS date_of_inquiry
  FROM alpenwild_mailing_list_tbl`;

const publicNewsletterSchema = z.object({
  first_name: z.string().trim().min(1).max(255),
  last_name: z.string().trim().min(1).max(255),
  email_address: z.string().trim().email().max(255),
  newsletter_signup_option: z.string().max(1000).default(""),
  recaptcha_token: z.string().max(5000).default(""),
  form_id: z.string().max(255).default(""),
});

async function createMailingListEntry(query, data, sourceOfInquiry) {
  const duplicate = await query(
    "SELECT mailing_list_id FROM alpenwild_mailing_list_tbl WHERE LOWER(email_address)=LOWER($1) LIMIT 1",
    [data.email_address],
  );
  if (duplicate.rowCount) return null;
  const result = await query(
    `INSERT INTO alpenwild_mailing_list_tbl
    (first_name, last_name, email_address, newsletter_signup_option, user_type, source_of_inquiry, date_of_inquiry)
    VALUES ($1,$2,$3,$4,$5,$6,CURRENT_DATE)
    RETURNING mailing_list_id AS id`,
    [
      data.first_name,
      data.last_name,
      data.email_address,
      data.newsletter_signup_option,
      data.user_type,
      sourceOfInquiry,
    ],
  );
  const row = await query(`${mailingListSelect} WHERE mailing_list_id=$1`, [
    result.rows[0].id,
  ]);
  return row.rows[0];
}

export function createMailingListRouter({ query, config, verifyRecaptcha }) {
  const router = Router();

  router.get("/api/mailing-list", async (_req, res, next) => {
    try {
      const result = await query(
        `${mailingListSelect} WHERE mailing_list_id <> 0 ORDER BY date_of_inquiry DESC, mailing_list_id DESC`,
      );
      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/mailing-list", async (req, res, next) => {
    try {
      const data = mailingListSchema.parse(req.body);
      const row = await createMailingListEntry(
        query,
        data,
        "Alpenwild Submitted ",
      );
      if (!row)
        return res.status(409).json({
          message: "Sorry, email is already added. Please use another email.",
        });
      res.status(201).json(row);
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/public/mailing-list", async (req, res, next) => {
    try {
      const data = publicNewsletterSchema.parse(req.body);
      if (data.form_id)
        return res
          .status(400)
          .json({ message: "Unable to process this request." });
      if (config.recaptchaEnabled && !config.recaptchaSecret)
        return res
          .status(503)
          .json({ message: "Newsletter signup is not configured." });
      if (
        config.recaptchaEnabled &&
        !(await verifyRecaptcha(data.recaptcha_token))
      )
        return res
          .status(400)
          .json({ message: "Robot verification failed, please try again." });
      const row = await createMailingListEntry(
        query,
        { ...data, user_type: "Prospect" },
        "Newsletter Signup",
      );
      if (!row)
        return res.status(409).json({
          message: "You have already subscribed to our database.",
        });
      res.status(201).json({
        message: "Thank you for subscribing to our email newsletter.",
      });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/mailing-list/:id", async (req, res, next) => {
    try {
      const data = mailingListSchema.parse(req.body);
      const duplicate = await query(
        "SELECT mailing_list_id FROM alpenwild_mailing_list_tbl WHERE LOWER(email_address)=LOWER($1) AND mailing_list_id<>$2 LIMIT 1",
        [data.email_address, req.params.id],
      );
      if (duplicate.rowCount)
        return res.status(409).json({
          message: "Sorry, email is already added. Please use another email.",
        });
      const result = await query(
        `UPDATE alpenwild_mailing_list_tbl SET first_name=$1,last_name=$2,email_address=$3,newsletter_signup_option=$4,user_type=$5 WHERE mailing_list_id=$6 RETURNING mailing_list_id AS id`,
        [
          data.first_name,
          data.last_name,
          data.email_address,
          data.newsletter_signup_option,
          data.user_type,
          req.params.id,
        ],
      );
      if (!result.rowCount)
        return res
          .status(404)
          .json({ message: "Mailing list user not found." });
      const row = await query(`${mailingListSelect} WHERE mailing_list_id=$1`, [
        req.params.id,
      ]);
      res.json(row.rows[0]);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/api/mailing-list/:id", async (req, res, next) => {
    try {
      const result = await query(
        "DELETE FROM alpenwild_mailing_list_tbl WHERE mailing_list_id=$1 RETURNING mailing_list_id",
        [req.params.id],
      );
      if (!result.rowCount)
        return res
          .status(404)
          .json({ message: "Mailing list user not found." });
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/mailing-list/download", async (_req, res, next) => {
    try {
      const result = await query(
        `${mailingListSelect} ORDER BY date_of_inquiry DESC, mailing_list_id DESC`,
      );
      const escape = (value) =>
        `"${String(value ?? "").replaceAll('"', '""')}"`;
      const lines = [
        "First Name,Last Name,Email Address,User Type,Interests,Date Of Inquiry",
        ...result.rows.map((row) =>
          [
            row.first_name || "N/A",
            row.last_name || "N/A",
            row.email_address || "N/A",
            row.user_type || "N/A",
            row.newsletter_signup_option
              .replaceAll("<br>", "")
              .replaceAll("Interests – ", " - "),
            row.date_of_inquiry,
          ]
            .map(escape)
            .join(","),
        ),
      ];
      res
        .type("text/csv")
        .set("Content-Disposition", "attachment; filename=mailing_list.csv")
        .send(lines.join("\n"));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
