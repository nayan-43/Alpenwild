import { Router } from "express";
import { z } from "zod";

export function createLookupDataRouter({
  query,
  simpleNameSchema,
  useLegacyLocations,
  useLegacyActivities,
  useLegacyTrips,
}) {
  const router = Router();

  async function locationNameConflict(name, excludedId) {
    const result = useLegacyLocations()
      ? await query(
          `SELECT location_id FROM alpenwild_location_tbl
           WHERE location_name=$1
           ${excludedId ? "AND location_id<>$2" : ""}
           LIMIT 1`,
          excludedId ? [name, excludedId] : [name],
        )
      : await query(
          `SELECT id FROM locations
           WHERE name=$1
           ${excludedId ? "AND id<>$2" : ""}
           LIMIT 1`,
          excludedId ? [name, excludedId] : [name],
        );
    return result.rowCount > 0;
  }

  async function activityNameConflict(name, excludedId) {
    const result = useLegacyActivities()
      ? await query(
          `SELECT activity_id FROM alpenwild_activity_tbl
           WHERE LOWER(activity_name)=LOWER($1)
           ${excludedId ? "AND activity_id<>$2" : ""}
           LIMIT 1`,
          excludedId ? [name, excludedId] : [name],
        )
      : await query(
          `SELECT id FROM activities
           WHERE LOWER(name)=LOWER($1)
           ${excludedId ? "AND id<>$2" : ""}
           LIMIT 1`,
          excludedId ? [name, excludedId] : [name],
        );
    return result.rowCount > 0;
  }

  router.get("/api/locations", async (_req, res, next) => {
    try {
      const result = useLegacyLocations()
        ? await query(
            "SELECT location_id AS id, location_name AS name, location_status AS status FROM alpenwild_location_tbl ORDER BY location_id ASC",
          )
        : await query("SELECT id, name, status FROM locations ORDER BY id ASC");
      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/public-trip-filters", async (_req, res, next) => {
    try {
      const [locations, activities] = await Promise.all([
        useLegacyLocations()
          ? query(
              "SELECT location_id AS id, location_name AS name, location_status AS status FROM alpenwild_location_tbl WHERE location_status = 'Active' ORDER BY location_id ASC",
            )
          : query(
              "SELECT id, name, status FROM locations WHERE status = 'Active' ORDER BY id ASC",
            ),
        useLegacyActivities()
          ? query(
              "SELECT activity_id AS id, activity_name AS name, activity_status AS status FROM alpenwild_activity_tbl WHERE activity_status = 'Active' ORDER BY activity_id ASC",
            )
          : query(
              "SELECT id, name, status FROM activities WHERE status = 'Active' ORDER BY id ASC",
            ),
      ]);
      res.json({ locations: locations.rows, activities: activities.rows });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/locations", async (req, res, next) => {
    try {
      const data = simpleNameSchema.parse(req.body);
      if (await locationNameConflict(data.name))
        return res.status(409).json({
          message:
            "Sorry, location name is already added. Please use another name.",
        });
      const result = useLegacyLocations()
        ? await query(
            "INSERT INTO alpenwild_location_tbl (location_name, location_status) VALUES ($1, $2) RETURNING location_id AS id, location_name AS name, location_status AS status",
            [data.name, data.status],
          )
        : await query(
            "INSERT INTO locations (name, status) VALUES ($1, $2) RETURNING id, name, status",
            [data.name, data.status],
          );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      if (error?.code === "23505")
        return res.status(409).json({
          message:
            "Sorry, location name is already added. Please use another name.",
        });
      next(error);
    }
  });

  router.patch("/api/locations/:id", async (req, res, next) => {
    try {
      const data = simpleNameSchema.parse(req.body);
      if (await locationNameConflict(data.name, req.params.id))
        return res.status(409).json({
          message:
            "Sorry, location name is already added. Please use another name.",
        });
      const result = useLegacyLocations()
        ? await query(
            "UPDATE alpenwild_location_tbl SET location_name=$1, location_status=$2 WHERE location_id=$3 RETURNING location_id AS id, location_name AS name, location_status AS status",
            [data.name, data.status, req.params.id],
          )
        : await query(
            "UPDATE locations SET name=$1, status=$2, updated_at=NOW() WHERE id=$3 RETURNING id, name, status",
            [data.name, data.status, req.params.id],
          );
      if (!result.rowCount)
        return res.status(404).json({ message: "Location not found." });
      res.json(result.rows[0]);
    } catch (error) {
      if (error?.code === "23505")
        return res.status(409).json({
          message:
            "Sorry, location name is already added. Please use another name.",
        });
      next(error);
    }
  });

  router.patch("/api/locations/:id/status", async (req, res, next) => {
    try {
      const status = z.enum(["Active", "Inactive"]).parse(req.body.status);
      const result = useLegacyLocations()
        ? await query(
            "UPDATE alpenwild_location_tbl SET location_status=$1 WHERE location_id=$2 RETURNING location_id AS id, location_name AS name, location_status AS status",
            [status, req.params.id],
          )
        : await query(
            "UPDATE locations SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING id, name, status",
            [status, req.params.id],
          );
      if (!result.rowCount)
        return res.status(404).json({ message: "Location not found." });
      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/api/locations/:id", async (req, res, next) => {
    try {
      if (useLegacyTrips()) {
        const trips = await query(
          "SELECT trips_id FROM alpenwild_trips_tbl WHERE location_id=$1 LIMIT 1",
          [req.params.id],
        );
        if (trips.rowCount)
          return res.status(409).json({
            message:
              "Trip existing under this location. First delete trip and then delete this location.",
          });
      }
      const result = useLegacyLocations()
        ? await query(
            "DELETE FROM alpenwild_location_tbl WHERE location_id=$1 RETURNING location_id",
            [req.params.id],
          )
        : await query("DELETE FROM locations WHERE id=$1 RETURNING id", [
            req.params.id,
          ]);
      if (!result.rowCount)
        return res.status(404).json({ message: "Location not found." });
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/activities", async (_req, res, next) => {
    try {
      const result = useLegacyActivities()
        ? await query(
            "SELECT activity_id AS id, activity_name AS name, activity_status AS status FROM alpenwild_activity_tbl ORDER BY activity_id ASC",
          )
        : await query(
            "SELECT id, name, status FROM activities ORDER BY id ASC",
          );
      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/activities", async (req, res, next) => {
    try {
      const data = simpleNameSchema.parse(req.body);
      if (await activityNameConflict(data.name))
        return res.status(409).json({
          message:
            "Sorry, activity name is already added. Please use another name.",
        });
      const result = useLegacyActivities()
        ? await query(
            "INSERT INTO alpenwild_activity_tbl (activity_name, activity_status) VALUES ($1, $2) RETURNING activity_id AS id, activity_name AS name, activity_status AS status",
            [data.name, data.status],
          )
        : await query(
            "INSERT INTO activities (name, status) VALUES ($1, $2) RETURNING id, name, status",
            [data.name, data.status],
          );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      if (error?.code === "23505")
        return res.status(409).json({
          message:
            "Sorry, activity name is already added. Please use another name.",
        });
      next(error);
    }
  });

  router.patch("/api/activities/:id", async (req, res, next) => {
    try {
      const data = simpleNameSchema.parse(req.body);
      if (await activityNameConflict(data.name, req.params.id))
        return res.status(409).json({
          message:
            "Sorry, activity name is already added. Please use another name.",
        });
      const result = useLegacyActivities()
        ? await query(
            "UPDATE alpenwild_activity_tbl SET activity_name=$1, activity_status=$2 WHERE activity_id=$3 RETURNING activity_id AS id, activity_name AS name, activity_status AS status",
            [data.name, data.status, req.params.id],
          )
        : await query(
            "UPDATE activities SET name=$1, status=$2, updated_at=NOW() WHERE id=$3 RETURNING id, name, status",
            [data.name, data.status, req.params.id],
          );
      if (!result.rowCount)
        return res.status(404).json({ message: "Activity not found." });
      res.json(result.rows[0]);
    } catch (error) {
      if (error?.code === "23505")
        return res.status(409).json({
          message:
            "Sorry, activity name is already added. Please use another name.",
        });
      next(error);
    }
  });

  router.patch("/api/activities/:id/status", async (req, res, next) => {
    try {
      const status = z.enum(["Active", "Inactive"]).parse(req.body.status);
      const result = useLegacyActivities()
        ? await query(
            "UPDATE alpenwild_activity_tbl SET activity_status=$1 WHERE activity_id=$2 RETURNING activity_id AS id, activity_name AS name, activity_status AS status",
            [status, req.params.id],
          )
        : await query(
            "UPDATE activities SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING id, name, status",
            [status, req.params.id],
          );
      if (!result.rowCount)
        return res.status(404).json({ message: "Activity not found." });
      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/api/activities/:id", async (req, res, next) => {
    try {
      const result = useLegacyActivities()
        ? await query(
            "DELETE FROM alpenwild_activity_tbl WHERE activity_id=$1 RETURNING activity_id",
            [req.params.id],
          )
        : await query("DELETE FROM activities WHERE id=$1 RETURNING id", [
            req.params.id,
          ]);
      if (!result.rowCount)
        return res.status(404).json({ message: "Activity not found." });
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
