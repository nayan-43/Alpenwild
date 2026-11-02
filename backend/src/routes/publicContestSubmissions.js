import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { Router } from "express";
import multer from "multer";
import sharp from "sharp";
import { z } from "zod";

const contestSubmissionUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, callback) =>
    callback(null, /^image\/(jpeg|png|gif)$/.test(file.mimetype)),
});

export function createPublicContestSubmissionsRouter({
  query,
  pool,
  config,
  verifyRecaptcha,
  mailer,
  getSiteTitle,
  getAdminReceivingEmail,
  escapeHtml,
}) {
  const router = Router();
  router.post(
    "/api/public/contest-submissions",
    contestSubmissionUpload.array("images", 10),
    async (req, res, next) => {
      const savedFiles = [];
      let client;
      try {
        const data = z
          .object({
            contest_id: z.coerce.number().int().positive(),
            first_name: z.string().trim().min(1).max(255),
            last_name: z.string().trim().min(1).max(255),
            email: z.string().trim().email().max(255),
            phone: z
              .string()
              .trim()
              .regex(/^\d{10}$/),
            address: z.string().trim().min(1).max(1000),
            city: z.string().trim().min(1).max(255),
            state: z.string().trim().min(1).max(255),
            zip: z.string().trim().min(1).max(40),
            entries: z
              .string()
              .transform((value, context) => {
                try {
                  return JSON.parse(value);
                } catch {
                  context.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Submission image details are invalid.",
                  });
                  return z.NEVER;
                }
              })
              .pipe(
                z
                  .array(
                    z.object({
                      title: z.string().max(255).default(""),
                      description: z.string().max(10000).default(""),
                    }),
                  )
                  .min(1)
                  .max(10),
              ),
            recaptcha_token: z.string().max(5000).default(""),
            agree: z.literal("true"),
          })
          .parse(req.body);
        const files = req.files || [];
        if (files.length !== data.entries.length)
          return res.status(400).json({
            message: "Please attach one image for each submission entry.",
          });
        if (config.recaptchaEnabled && !config.recaptchaSecret)
          return res
            .status(503)
            .json({ message: "Contest submissions are not configured." });
        if (
          config.recaptchaEnabled &&
          !(await verifyRecaptcha(data.recaptcha_token))
        )
          return res
            .status(400)
            .json({ message: "Robot verification failed, please try again." });

        const contestResult = await query(
          `SELECT id, contest_title, contest_image_min_width,
                contest_image_max_width, contest_image_min_height,
                contest_image_max_height, contest_image_max_size
           FROM alpenwild_contest_tbl
          WHERE id=$1 AND contest_status='Active'
            AND CURRENT_DATE BETWEEN contest_start_date AND contest_end_date`,
          [data.contest_id],
        );
        const contest = contestResult.rows[0];
        if (!contest)
          return res
            .status(400)
            .json({ message: "The selected contest is not currently open." });

        const preparedFiles = [];
        for (const [index, file] of files.entries()) {
          const metadata = await sharp(file.buffer).metadata();
          const allowedFormat = ["jpeg", "png", "gif"].includes(
            metadata.format,
          );
          const withinDimensions =
            metadata.width >= contest.contest_image_min_width &&
            metadata.width <= contest.contest_image_max_width &&
            metadata.height >= contest.contest_image_min_height &&
            metadata.height <= contest.contest_image_max_height;
          const withinSize =
            file.size < Number(contest.contest_image_max_size) * 1_000_000;
          if (!allowedFormat || !withinDimensions || !withinSize)
            return res.status(400).json({
              message: `Image ${index + 1} must be a JPG, PNG, or GIF within the contest's image dimensions and file-size limits.`,
            });
          const extension = { jpeg: ".jpg", png: ".png", gif: ".gif" }[
            metadata.format
          ];
          preparedFiles.push({
            buffer: file.buffer,
            filename: `${crypto.randomUUID()}${extension}`,
          });
        }

        client = await pool.connect();
        await client.query("BEGIN");
        const contestant = await client.query(
          `INSERT INTO alpenwild_contest_users
          (contest_id,user_name,user_email,user_phone,user_address,user_city,
           user_state,user_zip,user_status,created_at,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Active',NOW(),NOW())
         RETURNING user_id`,
          [
            data.contest_id,
            `${data.first_name} ${data.last_name}`.trim(),
            data.email,
            data.phone,
            data.address,
            data.city,
            data.state,
            data.zip,
          ],
        );
        const userId = contestant.rows[0].user_id;
        for (const [index, file] of preparedFiles.entries()) {
          const insert = await client.query(
            `INSERT INTO alpenwild_contest_submission
            (user_id,contest_id,submission_image,submission_image_title,
             submission_image_description,submission_winner,
             submission_image_likes,submission_status,created_at,updated_at)
           VALUES ($1,$2,$3,$4,$5,'No',0,'Disapproved',NOW(),NOW())
           RETURNING submission_id`,
            [
              userId,
              data.contest_id,
              file.filename,
              data.entries[index].title,
              data.entries[index].description,
            ],
          );
          const filename = `${insert.rows[0].submission_id}_${file.filename}`;
          await fs.writeFile(
            path.join(config.contestUploadDir, filename),
            file.buffer,
            { flag: "wx" },
          );
          savedFiles.push(path.join(config.contestUploadDir, filename));
          await client.query(
            "UPDATE alpenwild_contest_submission SET submission_image=$1 WHERE submission_id=$2",
            [filename, insert.rows[0].submission_id],
          );
        }
        await client.query("COMMIT");
        client.release();
        client = null;

        if (mailer) {
          try {
            const emailTemplate = await query(
              `SELECT contest_submissions_user, contest_submissions_admin
               FROM alpenwild_contest_emails WHERE id=1`,
            );
            const siteTitle = await getSiteTitle();
            const contestantName =
              `${data.first_name} ${data.last_name}`.trim();
            const emailDetails = `<p>Contest: ${escapeHtml(contest.contest_title)}</p><p>Name: ${escapeHtml(contestantName)}<br>Email: ${escapeHtml(data.email)}<br>Phone: ${escapeHtml(data.phone)}</p>`;
            const from = {
              name: siteTitle,
              address: config.smtpFrom || config.smtpUser,
            };
            if (emailTemplate.rows[0]?.contest_submissions_user)
              await mailer.sendMail({
                from,
                to: data.email,
                subject: `${siteTitle} Contest Submission`,
                html: `Dear ${escapeHtml(contestantName)},<br>${emailTemplate.rows[0].contest_submissions_user}${emailDetails}`,
              });
            if (emailTemplate.rows[0]?.contest_submissions_admin)
              await mailer.sendMail({
                from,
                replyTo: data.email,
                to: await getAdminReceivingEmail(),
                subject: `${siteTitle} Contest Submission`,
                html: `Dear Admin,<br>${emailTemplate.rows[0].contest_submissions_admin}${emailDetails}`,
              });
          } catch (emailError) {
            console.error(
              "Contest submission saved, but notification email failed.",
              emailError,
            );
          }
        }
        res.status(201).json({
          message:
            "Thank you for joining the contest. Your entry will be visible as soon as it is approved.",
        });
      } catch (error) {
        if (client) {
          await client.query("ROLLBACK");
          client.release();
        }
        await Promise.all(
          savedFiles.map((filename) =>
            fs
              .rm(filename)
              .catch((cleanupError) =>
                console.error(
                  "Unable to remove an uncommitted contest image.",
                  cleanupError,
                ),
              ),
          ),
        );
        next(error);
      }
    },
  );
  return router;
}
