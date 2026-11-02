import { Router } from "express";

export function createAdminDashboardRouter({ query, config }) {
  const router = Router();

  router.get("/api/dashboard", async (_req, res, next) => {
    try {
      const result = await query(
        `SELECT COUNT(*)::int AS banners, COUNT(*) FILTER (WHERE status = 'Active')::int AS "activeBanners" FROM ${config.bannerTable}`,
      );
      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
