import { Router } from "express";
import { z } from "zod";

const itinerarySchema = z.object({
  day: z.coerce.number().int().positive(),
  title: z.string().trim().min(1).max(255),
  description: z.string().max(30000).default(""),
});

export function createTripItineraryRouter({ query }) {
  const router = Router();

  router.get("/api/trips/:id/itinerary", async (req, res, next) => {
    try {
      const result = await query(
        `SELECT trips_itinerary_id AS id,
        trips_itinerary_day AS day, trips_itinerary_title AS title,
        trips_itinerary_description AS description
        FROM alpenwild_trips_itinerary_tbl WHERE trips_id=$1
        ORDER BY trips_itinerary_day`,
        [req.params.id],
      );
      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  });

  router.put("/api/trips/:id/itinerary", async (req, res, next) => {
    try {
      const entries = z.array(itinerarySchema).parse(req.body.entries || []);
      const trip = await query(
        "SELECT trips_id FROM alpenwild_trips_tbl WHERE trips_id=$1",
        [req.params.id],
      );
      if (!trip.rowCount)
        return res.status(404).json({ message: "Trip not found." });
      await query("DELETE FROM alpenwild_trips_itinerary_tbl WHERE trips_id=$1", [
        req.params.id,
      ]);
      for (const entry of entries) {
        await query(
          `INSERT INTO alpenwild_trips_itinerary_tbl
          (trips_id,trips_itinerary_day,trips_itinerary_title,trips_itinerary_description)
          VALUES ($1,$2,$3,$4)`,
          [req.params.id, entry.day, entry.title, entry.description],
        );
      }
      res.json(entries);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
