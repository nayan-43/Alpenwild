import { Router } from "express";
import { z } from "zod";

const redirectionSchema = z.object({
  old_redirection_url: z.string().trim().min(1).max(255),
  new_redirection_url: z.string().trim().min(1).max(255),
});

export function redirectionSelect(useLegacyRedirections) {
  return useLegacyRedirections()
    ? `SELECT redirection_id AS id, old_redirection_url, new_redirection_url
       FROM alpenwild_redirection_tbl`
    : `SELECT id, old_redirection_url, new_redirection_url
       FROM redirections`;
}

export function createRedirectionsRouter({ query, useLegacyRedirections }) {
  const router = Router();

  function redirectionColumns() {
    return useLegacyRedirections()
      ? {
          table: "alpenwild_redirection_tbl",
          id: "redirection_id",
        }
      : { table: "redirections", id: "id" };
  }

  router.get("/api/redirections", async (_req, res, next) => {
    try {
      const result = await query(
        `${redirectionSelect(useLegacyRedirections)} ORDER BY id ASC`,
      );
      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/redirections", async (req, res, next) => {
    try {
      const data = redirectionSchema.parse(req.body);
      const columns = redirectionColumns();
      const duplicate = await query(
        `SELECT 1 FROM ${columns.table}
         WHERE LOWER(old_redirection_url) = LOWER($1) LIMIT 1`,
        [data.old_redirection_url],
      );
      if (duplicate.rowCount)
        return res.status(409).json({
          message: "Old URL is already added. Please use another URL.",
        });
      const result = useLegacyRedirections()
        ? await query(
            `INSERT INTO alpenwild_redirection_tbl
             (old_redirection_url, new_redirection_url)
             VALUES ($1, $2)
             RETURNING redirection_id AS id, old_redirection_url,
               new_redirection_url`,
            [data.old_redirection_url, data.new_redirection_url],
          )
        : await query(
            `INSERT INTO redirections
             (old_redirection_url, new_redirection_url)
             VALUES ($1, $2) RETURNING id, old_redirection_url,
               new_redirection_url`,
            [data.old_redirection_url, data.new_redirection_url],
          );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/redirections/:id", async (req, res, next) => {
    try {
      const data = redirectionSchema.parse(req.body);
      const columns = redirectionColumns();
      const duplicate = await query(
        `SELECT 1 FROM ${columns.table}
         WHERE LOWER(old_redirection_url) = LOWER($1)
           AND ${columns.id} <> $2 LIMIT 1`,
        [data.old_redirection_url, req.params.id],
      );
      if (duplicate.rowCount)
        return res.status(409).json({
          message: "Old URL is already added. Please use another URL.",
        });
      const result = useLegacyRedirections()
        ? await query(
            `UPDATE alpenwild_redirection_tbl
             SET old_redirection_url=$1, new_redirection_url=$2
             WHERE redirection_id=$3
             RETURNING redirection_id AS id, old_redirection_url,
               new_redirection_url`,
            [data.old_redirection_url, data.new_redirection_url, req.params.id],
          )
        : await query(
            `UPDATE redirections
             SET old_redirection_url=$1, new_redirection_url=$2, updated_at=NOW()
             WHERE id=$3
             RETURNING id, old_redirection_url, new_redirection_url`,
            [data.old_redirection_url, data.new_redirection_url, req.params.id],
          );
      if (!result.rowCount)
        return res.status(404).json({ message: "Redirection not found." });
      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/api/redirections/:id", async (req, res, next) => {
    try {
      const columns = redirectionColumns();
      const result = await query(
        `DELETE FROM ${columns.table} WHERE ${columns.id}=$1 RETURNING ${columns.id}`,
        [req.params.id],
      );
      if (!result.rowCount)
        return res.status(404).json({ message: "Redirection not found." });
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
