import { Router } from "express";

export function createTripPostsRouter({ query }) {
  const router = Router();

  router.get("/api/trip-posts/:tripId", async (req, res, next) => {
    try {
      const result = await query(
        `SELECT post_url AS url, post_name AS name, post_image AS image
         FROM alpenwild_trip_posts_tbl WHERE trips_id=$1 ORDER BY post_name`,
        [req.params.tripId],
      );
      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
