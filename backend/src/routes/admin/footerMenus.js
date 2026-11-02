import { Router } from "express";
import { z } from "zod";

const footerMenuSchema = z.object({
  title: z.string().trim().min(1).max(255),
  under: z.enum([
    "Blogs",
    "HappyGuests",
    "WhatNew",
    "AlpenwildRecommended",
    "NecessaryInfo",
  ]),
  link: z.string().trim().min(1).max(1000),
  link_target: z.enum(["_self", "_blank", "_parent", "_top"]),
  display_order: z.preprocess(
    (value) =>
      typeof value === "string" && /^[+-]?\d+$/.test(value)
        ? Number(value)
        : value,
    z.number().int(),
  ),
  status: z.enum(["Active", "Inactive"]).default("Active"),
});

export function createFooterMenusRouter({ query, useLegacyFooterMenus }) {
  const router = Router();

  router.get("/api/footer-menus", async (_req, res, next) => {
    try {
      const select = useLegacyFooterMenus()
        ? `SELECT footer_menu_id AS id, footer_menu_title AS title,
            footer_menu_under AS under, footer_menu_link AS link,
            footer_menu_link_target AS link_target,
            footer_menu_order AS display_order, footer_menu_status AS status
           FROM alpenwild_footer_menu_tbl`
        : `SELECT id, title, under, link, link_target, display_order, status
           FROM footer_menus`;
      const result = await query(
        `${select} ORDER BY display_order ASC, id ASC`,
      );
      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/footer-menus", async (req, res, next) => {
    try {
      const data = footerMenuSchema.parse(req.body);
      const duplicate = useLegacyFooterMenus()
        ? await query(
            "SELECT footer_menu_id FROM alpenwild_footer_menu_tbl WHERE LOWER(footer_menu_title) = LOWER($1) AND footer_menu_under = $2 LIMIT 1",
            [data.title, data.under],
          )
        : await query(
            "SELECT id FROM footer_menus WHERE LOWER(title) = LOWER($1) AND under = $2 LIMIT 1",
            [data.title, data.under],
          );
      if (duplicate.rowCount)
        return res.status(409).json({
          message: "Sorry, name is already added. Please use another name.",
        });
      const result = useLegacyFooterMenus()
        ? await query(
            `INSERT INTO alpenwild_footer_menu_tbl
             (footer_menu_title, footer_menu_under, footer_menu_link,
              footer_menu_link_target, footer_menu_order, footer_menu_status)
             VALUES ($1,$2,$3,$4,$5,$6)
             RETURNING footer_menu_id AS id, footer_menu_title AS title,
              footer_menu_under AS under, footer_menu_link AS link,
              footer_menu_link_target AS link_target,
              footer_menu_order AS display_order, footer_menu_status AS status`,
            [
              data.title,
              data.under,
              data.link,
              data.link_target,
              data.display_order,
              data.status,
            ],
          )
        : await query(
            `INSERT INTO footer_menus
             (title, under, link, link_target, display_order, status)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [
              data.title,
              data.under,
              data.link,
              data.link_target,
              data.display_order,
              data.status,
            ],
          );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/footer-menus/:id", async (req, res, next) => {
    try {
      const data = footerMenuSchema.parse(req.body);
      const duplicate = useLegacyFooterMenus()
        ? await query(
            "SELECT footer_menu_id FROM alpenwild_footer_menu_tbl WHERE LOWER(footer_menu_title) = LOWER($1) AND footer_menu_under = $2 AND footer_menu_id <> $3 LIMIT 1",
            [data.title, data.under, req.params.id],
          )
        : await query(
            "SELECT id FROM footer_menus WHERE LOWER(title) = LOWER($1) AND under = $2 AND id <> $3 LIMIT 1",
            [data.title, data.under, req.params.id],
          );
      if (duplicate.rowCount)
        return res.status(409).json({
          message: "Sorry, name is already added. Please use another name.",
        });
      const result = useLegacyFooterMenus()
        ? await query(
            `UPDATE alpenwild_footer_menu_tbl SET footer_menu_title = $1,
             footer_menu_under = $2, footer_menu_link = $3,
             footer_menu_link_target = $4, footer_menu_order = $5,
             footer_menu_status = $6 WHERE footer_menu_id = $7
             RETURNING footer_menu_id AS id, footer_menu_title AS title,
              footer_menu_under AS under, footer_menu_link AS link,
              footer_menu_link_target AS link_target,
              footer_menu_order AS display_order, footer_menu_status AS status`,
            [
              data.title,
              data.under,
              data.link,
              data.link_target,
              data.display_order,
              data.status,
              req.params.id,
            ],
          )
        : await query(
            `UPDATE footer_menus SET title = $1, under = $2, link = $3,
             link_target = $4, display_order = $5, status = $6,
             updated_at = NOW() WHERE id = $7 RETURNING *`,
            [
              data.title,
              data.under,
              data.link,
              data.link_target,
              data.display_order,
              data.status,
              req.params.id,
            ],
          );
      if (!result.rowCount)
        return res.status(404).json({ message: "Footer menu not found." });
      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/footer-menus/:id/status", async (req, res, next) => {
    try {
      const status = z.enum(["Active", "Inactive"]).parse(req.body.status);
      const result = useLegacyFooterMenus()
        ? await query(
            `UPDATE alpenwild_footer_menu_tbl SET footer_menu_status = $1
             WHERE footer_menu_id = $2 RETURNING footer_menu_id AS id,
              footer_menu_title AS title, footer_menu_under AS under,
              footer_menu_link AS link, footer_menu_link_target AS link_target,
              footer_menu_order AS display_order, footer_menu_status AS status`,
            [status, req.params.id],
          )
        : await query(
            "UPDATE footer_menus SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
            [status, req.params.id],
          );
      if (!result.rowCount)
        return res.status(404).json({ message: "Footer menu not found." });
      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/api/footer-menus/:id", async (req, res, next) => {
    try {
      const result = useLegacyFooterMenus()
        ? await query(
            "DELETE FROM alpenwild_footer_menu_tbl WHERE footer_menu_id = $1 RETURNING footer_menu_id",
            [req.params.id],
          )
        : await query("DELETE FROM footer_menus WHERE id = $1 RETURNING id", [
            req.params.id,
          ]);
      if (!result.rowCount)
        return res.status(404).json({ message: "Footer menu not found." });
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
