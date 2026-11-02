import { Router } from "express";

export function createPublicContestsRouter({ query, config }) {
  const router = Router();

  router.get("/api/public/contests", async (_req, res, next) => {
    try {
      const [contests, submissions, rules] = await Promise.all([
        query(
          `SELECT id, contest_title, contest_start_date, contest_end_date,
                contest_image_min_width, contest_image_max_width,
                contest_image_min_height, contest_image_max_height,
                contest_image_min_size, contest_image_max_size,
                (CURRENT_DATE BETWEEN contest_start_date AND contest_end_date) AS is_open
           FROM alpenwild_contest_tbl
          WHERE contest_status='Active'
          ORDER BY id DESC`,
        ),
        query(
          `SELECT s.submission_id AS id, s.contest_id, s.submission_image AS image,
                s.submission_image_title AS title,
                s.submission_image_description AS description,
                u.user_name
           FROM alpenwild_contest_submission s
           JOIN alpenwild_contest_users u ON u.user_id=s.user_id
           JOIN alpenwild_contest_tbl c ON c.id=s.contest_id
          WHERE s.submission_status='Approved' AND c.contest_status='Active'
          ORDER BY s.submission_id DESC`,
        ),
        query(
          `SELECT static_page_description AS rules
           FROM alpenwild_static_page_tbl WHERE static_page_id=3904`,
        ),
      ]);
      res.json({
        contests: contests.rows,
        submissions: submissions.rows.map((row) => ({
          ...row,
          image_url: `/uploads/${config.contestUploadSubdir}/${encodeURIComponent(row.image)}`,
        })),
        rules: rules.rows[0]?.rules || "",
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
