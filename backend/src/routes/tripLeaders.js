import { Router } from "express";
import {
  createTripLeaderSerializer,
  tripLeaderSelect,
} from "../tripLeaderData.js";

export function createTripLeadersRouter({ config, query, tripLeaderPosts }) {
  const router = Router();
  const serializeTripLeader = createTripLeaderSerializer({ config, query });

  router.get("/api/public-trip-leaders", async (_req, res, next) => {
    try {
      const result = await query(
        `${tripLeaderSelect} WHERE trip_leader_status='Active'
         ORDER BY trip_leader_order ASC, trip_leader_id ASC`,
      );
      res.json(await Promise.all(result.rows.map(serializeTripLeader)));
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/public-trip-leaders/:slug", async (req, res, next) => {
    try {
      const result = await query(
        `${tripLeaderSelect} WHERE trip_leader_slug=$1 AND trip_leader_status='Active' LIMIT 1`,
        [req.params.slug],
      );
      if (!result.rowCount)
        return res.status(404).json({ message: "Trip leader not found." });
      res.json(await serializeTripLeader(result.rows[0]));
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/public-trip-leaders/:slug/posts", async (req, res, next) => {
    try {
      const result = await query(
        `${tripLeaderSelect} WHERE trip_leader_slug=$1 AND trip_leader_status='Active' LIMIT 1`,
        [req.params.slug],
      );
      if (!result.rowCount)
        return res.status(404).json({ message: "Trip leader not found." });
      const leader = result.rows[0];
      res.json(
        await tripLeaderPosts.load({
          alpsHiking: leader.alps_hiking_author,
          switzerlandTravel: leader.switzerlandtravel_author,
          mySwissKitchen: leader.myswisskitchennew_author,
        }),
      );
    } catch (error) {
      console.error("Unable to load trip-leader posts.", error);
      next(error);
    }
  });

  return router;
}
