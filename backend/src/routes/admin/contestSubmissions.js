import fs from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import { ZipArchive } from "archiver";
import { z } from "zod";

async function sendContestSubmissionArchive(res, rows, contestUploadDir) {
  const csvValue = (value) => {
    const text = String(value ?? "");
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const csvRows = [
    [
      "ID",
      "Contestant Name",
      "Contest Name",
      "Image",
      "Title",
      "Description",
      "Winner Status",
      "Status",
    ],
    ...rows.map((row) => [
      row.id,
      row.user_name,
      row.contest_title,
      row.submission_image,
      row.title,
      row.description,
      row.winner_status,
      row.status,
    ]),
  ];
  const images = await Promise.all(
    rows
      .filter((row) => row.submission_image)
      .map(async (row) => {
        const name = path.basename(row.submission_image);
        const image = await fs.readFile(path.join(contestUploadDir, name));
        return { name, image };
      }),
  );

  res.set({
    "Content-Type": "application/zip",
    "Content-Disposition": "attachment; filename=file.zip",
    "Cache-Control": "no-store",
    Pragma: "no-cache",
  });
  const archive = new ZipArchive();
  archive.on("error", (error) => {
    console.error("Contest submission archive generation failed:", error);
    if (!res.headersSent) {
      res
        .status(500)
        .json({ message: "Unable to generate the submission download." });
    } else if (!res.writableEnded) {
      res.destroy(error);
    }
  });
  archive.pipe(res);
  archive.append(csvRows.map((row) => row.map(csvValue).join(",")).join("\n"), {
    name: "file.csv",
  });
  for (const { name, image } of images) archive.append(image, { name });
  await archive.finalize();
}

export function createContestAdminRouter({ query, requireAuth, config }) {
  const router = Router();

  router.get("/api/contest-users", async (req, res, next) => {
    try {
      const filters = [];
      const values = [];
      let contestId;
      if (req.query.contest_id !== undefined) {
        contestId = z.coerce
          .number()
          .int()
          .positive()
          .parse(req.query.contest_id);
        values.push(contestId);
        filters.push(`contest_id=$${values.length}`);
      }
      const [users, count, contest] = await Promise.all([
        query(
          `SELECT user_id AS id,contest_id,user_name,user_email,user_phone,user_address,user_city,user_state,user_zip,user_status AS status FROM alpenwild_contest_users ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""} ORDER BY user_id DESC`,
          values,
        ),
        query("SELECT COUNT(*)::int AS total FROM alpenwild_contest_users"),
        contestId
          ? query(
              "SELECT contest_title FROM alpenwild_contest_tbl WHERE id=$1",
              [contestId],
            )
          : Promise.resolve({ rows: [] }),
      ]);
      res.json({
        rows: users.rows,
        totalEntries: count.rows[0].total,
        contestTitle: contest.rows[0]?.contest_title || "",
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/contest-users/:id", async (req, res, next) => {
    try {
      const result = await query(
        `SELECT user_id AS id,contest_id,user_name,user_email,user_phone,user_address,user_city,user_state,user_zip FROM alpenwild_contest_users WHERE user_id=$1`,
        [req.params.id],
      );
      if (!result.rowCount)
        return res.status(404).json({ message: "Contest user not found." });
      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/contest-users/:id/status", async (req, res, next) => {
    try {
      const status = z.enum(["Active", "Inactive"]).parse(req.body.status);
      const result = await query(
        "UPDATE alpenwild_contest_users SET user_status=$1,updated_at=NOW() WHERE user_id=$2 RETURNING user_id AS id",
        [status, req.params.id],
      );
      if (!result.rowCount)
        return res.status(404).json({ message: "Contest user not found." });
      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/api/contest-users/:id", async (req, res, next) => {
    try {
      await query("DELETE FROM alpenwild_contest_users WHERE user_id=$1", [
        req.params.id,
      ]);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/contest-submissions", async (req, res, next) => {
    try {
      const filters = [];
      const values = [];
      let userId;
      let contestId;
      for (const key of ["user_id", "contest_id"]) {
        if (req.query[key] !== undefined) {
          const id = z.coerce.number().int().positive().parse(req.query[key]);
          if (key === "user_id") userId = id;
          else contestId = id;
          values.push(id);
          filters.push(`s.${key}=$${values.length}`);
        }
      }
      const [submissions, context] = await Promise.all([
        query(
          `SELECT s.submission_id AS id,s.user_id,s.contest_id,s.submission_image,s.submission_image_title AS title,s.submission_image_description AS description,s.submission_winner AS winner_status,s.submission_status AS status,u.user_name,c.contest_title FROM alpenwild_contest_submission s LEFT JOIN alpenwild_contest_users u ON u.user_id=s.user_id LEFT JOIN alpenwild_contest_tbl c ON c.id=s.contest_id ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""} ORDER BY s.submission_id DESC`,
          values,
        ),
        userId && contestId
          ? query(
              `SELECT u.user_name,c.contest_title FROM alpenwild_contest_users u JOIN alpenwild_contest_tbl c ON c.id=$2 WHERE u.user_id=$1`,
              [userId, contestId],
            )
          : Promise.resolve({ rows: [] }),
      ]);
      const row = context.rows[0];
      res.json({
        rows: submissions.rows,
        context: row
          ? { userName: row.user_name, contestTitle: row.contest_title }
          : null,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get(
    "/api/contest-submissions/download",
    requireAuth,
    async (_req, res, next) => {
      try {
        const result = await query(
          `SELECT s.submission_id AS id,s.user_id,s.contest_id,u.user_name,c.contest_title,s.submission_image,s.submission_image_title AS title,s.submission_image_description AS description,s.submission_winner AS winner_status,s.submission_status AS status FROM alpenwild_contest_submission s LEFT JOIN alpenwild_contest_users u ON u.user_id=s.user_id LEFT JOIN alpenwild_contest_tbl c ON c.id=s.contest_id ORDER BY s.submission_id DESC`,
        );
        await sendContestSubmissionArchive(
          res,
          result.rows,
          config.contestUploadDir,
        );
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/api/contest-submissions/:id/download",
    requireAuth,
    async (req, res, next) => {
      try {
        const result = await query(
          `SELECT s.submission_id AS id,u.user_name,c.contest_title,s.submission_image,s.submission_image_title AS title,s.submission_image_description AS description,s.submission_winner AS winner_status,s.submission_status AS status FROM alpenwild_contest_submission s LEFT JOIN alpenwild_contest_users u ON u.user_id=s.user_id LEFT JOIN alpenwild_contest_tbl c ON c.id=s.contest_id WHERE s.submission_id=$1`,
          [req.params.id],
        );
        if (!result.rowCount)
          return res.status(404).json({ message: "Submission not found." });
        await sendContestSubmissionArchive(
          res,
          result.rows,
          config.contestUploadDir,
        );
      } catch (error) {
        next(error);
      }
    },
  );

  router.patch(
    "/api/contest-submissions/:id/status",
    async (req, res, next) => {
      try {
        const status = z
          .enum(["Approved", "Disapproved"])
          .parse(req.body.status);
        await query(
          "UPDATE alpenwild_contest_submission SET submission_status=$1,updated_at=NOW() WHERE submission_id=$2",
          [status, req.params.id],
        );
        res.json({ id: Number(req.params.id), status });
      } catch (error) {
        next(error);
      }
    },
  );

  router.patch(
    "/api/contest-submissions/:id/winner",
    async (req, res, next) => {
      try {
        const winner = z.enum(["Yes", "No"]).parse(req.body.winner_status);
        await query(
          "UPDATE alpenwild_contest_submission SET submission_winner=$1,updated_at=NOW() WHERE submission_id=$2",
          [winner, req.params.id],
        );
        res.json({ id: Number(req.params.id), winner_status: winner });
      } catch (error) {
        next(error);
      }
    },
  );

  router.delete("/api/contest-submissions/:id", async (req, res, next) => {
    try {
      await query(
        "DELETE FROM alpenwild_contest_submission WHERE submission_id=$1",
        [req.params.id],
      );
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/contest-settings", async (_req, res, next) => {
    try {
      const rules = await query(
        "SELECT static_page_description AS rules FROM alpenwild_static_page_tbl WHERE static_page_id=3904",
      );
      if (!rules.rowCount)
        return res
          .status(404)
          .json({ message: "Contest rules record was not found." });
      const email = await query(
        "SELECT * FROM alpenwild_contest_emails WHERE id=1",
      );
      res.json({ rules: rules.rows[0].rules, ...(email.rows[0] || {}) });
    } catch (error) {
      next(error);
    }
  });

  router.put("/api/contest-settings", async (req, res, next) => {
    try {
      const data = z
        .object({
          rules: z.string().max(100000),
          contest_submissions_user: z.string().max(1500),
          contest_submissions_admin: z.string().max(1500),
          contest_approval_user: z.string().max(1500),
          contest_approval_admin: z.string().max(1500),
          contest_disapproval_user: z.string().max(1500),
          contest_disapproval_admin: z.string().max(1500),
          contest_winner_user: z.string().max(1500),
          contest_winner_admin: z.string().max(1500),
        })
        .parse(req.body);
      const rules = await query(
        "UPDATE alpenwild_static_page_tbl SET static_page_description=$1 WHERE static_page_id=3904",
        [data.rules],
      );
      if (!rules.rowCount)
        return res
          .status(404)
          .json({ message: "Contest rules record was not found." });
      await query(
        "UPDATE alpenwild_contest_emails SET contest_submissions_user=$1,contest_submissions_admin=$2,contest_approval_user=$3,contest_approval_admin=$4,contest_disapproval_user=$5,contest_disapproval_admin=$6,contest_winner_user=$7,contest_winner_admin=$8 WHERE id=1",
        [
          data.contest_submissions_user,
          data.contest_submissions_admin,
          data.contest_approval_user,
          data.contest_approval_admin,
          data.contest_disapproval_user,
          data.contest_disapproval_admin,
          data.contest_winner_user,
          data.contest_winner_admin,
        ],
      );
      res.json({ message: "Contest settings updated successfully." });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
