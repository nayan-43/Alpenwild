import { Router } from "express";
import { z } from "zod";

const contestSchema = z.object({
  display_in_home: z.enum(["Yes", "No"]).default("No"),
  contest_title: z.string().trim().min(1).max(255),
  contest_start_date: z.string().min(1),
  contest_end_date: z.string().min(1),
  contest_image_min_width: z.coerce.number().int(),
  contest_image_max_width: z.coerce.number().int(),
  contest_image_min_height: z.coerce.number().int(),
  contest_image_max_height: z.coerce.number().int(),
  contest_image_min_size: z.coerce.number().int(),
  contest_image_max_size: z.coerce.number().int(),
});

const contestSelect = `SELECT id, display_in_home, contest_title, contest_start_date,
  contest_end_date, contest_image_min_width, contest_image_max_width,
  contest_image_min_height, contest_image_max_height, contest_image_min_size,
  contest_image_max_size, contest_status AS status FROM alpenwild_contest_tbl`;

export function createContestsRouter({ query }) {
  const router = Router();

  router.get("/api/contests", async (_req, res, next) => {
    try {
      res.json((await query(`${contestSelect} ORDER BY id DESC`)).rows);
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/contests", async (req, res, next) => {
    try {
      const data = contestSchema.parse(req.body);
      const result = await query(
        `INSERT INTO alpenwild_contest_tbl
        (display_in_home, contest_title, contest_start_date, contest_end_date,
         contest_image_min_width, contest_image_max_width, contest_image_min_height,
         contest_image_max_height, contest_image_min_size, contest_image_max_size,
         contest_status, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'Active',NOW(),NOW()) RETURNING id`,
        [
          data.display_in_home,
          data.contest_title,
          data.contest_start_date,
          data.contest_end_date,
          data.contest_image_min_width,
          data.contest_image_max_width,
          data.contest_image_min_height,
          data.contest_image_max_height,
          data.contest_image_min_size,
          data.contest_image_max_size,
        ],
      );
      res
        .status(201)
        .json(
          (await query(`${contestSelect} WHERE id=$1`, [result.rows[0].id]))
            .rows[0],
        );
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/contests/:id", async (req, res, next) => {
    try {
      const data = contestSchema.parse(req.body);
      const result = await query(
        `UPDATE alpenwild_contest_tbl SET display_in_home=$1,contest_title=$2,contest_start_date=$3,contest_end_date=$4,contest_image_min_width=$5,contest_image_max_width=$6,contest_image_min_height=$7,contest_image_max_height=$8,contest_image_min_size=$9,contest_image_max_size=$10,updated_at=NOW() WHERE id=$11 RETURNING id`,
        [
          data.display_in_home,
          data.contest_title,
          data.contest_start_date,
          data.contest_end_date,
          data.contest_image_min_width,
          data.contest_image_max_width,
          data.contest_image_min_height,
          data.contest_image_max_height,
          data.contest_image_min_size,
          data.contest_image_max_size,
          req.params.id,
        ],
      );
      if (!result.rowCount)
        return res.status(404).json({ message: "Contest not found." });
      res.json(
        (await query(`${contestSelect} WHERE id=$1`, [req.params.id])).rows[0],
      );
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/contests/:id/status", async (req, res, next) => {
    try {
      const status = z.enum(["Active", "Inactive"]).parse(req.body.status);
      const result = await query(
        "UPDATE alpenwild_contest_tbl SET contest_status=$1,updated_at=NOW() WHERE id=$2 RETURNING id",
        [status, req.params.id],
      );
      if (!result.rowCount)
        return res.status(404).json({ message: "Contest not found." });
      res.json({ id: result.rows[0].id, status });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/api/contests/:id", async (req, res, next) => {
    try {
      const result = await query(
        "DELETE FROM alpenwild_contest_tbl WHERE id=$1 RETURNING id",
        [req.params.id],
      );
      if (!result.rowCount)
        return res.status(404).json({ message: "Contest not found." });
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
