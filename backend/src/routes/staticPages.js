import { Router } from "express";

export function createPublicStaticPagesRouter({
  query,
  useLegacyStaticPages,
  useLegacyTripTypes,
  useLegacyTrips,
  staticPageSelect,
  serializeStaticPage,
  staticPageBoxImages,
  staticPageDescriptionBlocks,
  redirectionSelect,
  buildPublicNavigation,
}) {
  const router = Router();

  router.get("/api/public-redirection", async (req, res, next) => {
    try {
      const requestedPath = String(req.query.path || "").trim();
      if (!requestedPath || requestedPath.length > 2048) {
        return res.json(null);
      }
      const result = await query(
        `${redirectionSelect()}
         WHERE LOWER(TRIM(BOTH '/' FROM old_redirection_url)) =
           LOWER(TRIM(BOTH '/' FROM $1))
         LIMIT 1`,
        [requestedPath],
      );
      res.json(result.rows[0] || null);
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/public-static-pages", async (_req, res, next) => {
    try {
      const statusColumn = useLegacyStaticPages()
        ? "static_page_status"
        : "status";
      const result = await query(
        `${staticPageSelect()} WHERE ${statusColumn}='Active' ORDER BY parent_id ASC, display_order ASC, id ASC`,
      );
      res.json(result.rows.map(serializeStaticPage));
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/public-navigation", async (_req, res, next) => {
    try {
      const statusColumn = useLegacyStaticPages()
        ? "static_page_status"
        : "status";
      const menuColumn = useLegacyStaticPages()
        ? "static_page_menu_assign"
        : "menu_assign";
      const pageResult = await query(
        `${staticPageSelect()} WHERE ${statusColumn}='Active' AND ${menuColumn}='Self In Header' ORDER BY display_order ASC, id ASC`,
      );
      const hasTripPlaceholder = pageResult.rows.some(
        (page) => String(page.parent_id) === "7",
      );
      let tripTypes = [];
      let trips = [];

      if (hasTripPlaceholder) {
        const tripTypeResult = useLegacyTripTypes()
          ? await query(
              `SELECT trip_type_id AS id, trip_type_slug AS slug,
                trip_type_menu_name AS menu_name, trip_type_order AS display_order,
                trip_type_status AS status
               FROM alpenwild_trip_type_tbl
               WHERE trip_type_status='Active'
               ORDER BY trip_type_order ASC, trip_type_id ASC`,
            )
          : await query(
              `SELECT id, slug, menu_name, display_order, status
               FROM trip_types WHERE status='Active'
               ORDER BY display_order ASC, id ASC`,
            );
        const tripResult = useLegacyTrips()
          ? await query(
              `SELECT trips_id AS id, trips_type_id AS type_id,
                trips_slug AS slug, trips_menu_name AS menu_name,
                trips_order AS display_order, trips_status AS status
               FROM alpenwild_trips_tbl
               WHERE trips_status='Active'
               ORDER BY trips_order ASC, trips_id ASC`,
            )
          : await query(
              `SELECT id, type_id, slug, menu_name, display_order, status
               FROM trips WHERE status='Active'
               ORDER BY display_order ASC, id ASC`,
            );
        tripTypes = tripTypeResult.rows;
        trips = tripResult.rows;
      }

      res.json(buildPublicNavigation(pageResult.rows, tripTypes, trips));
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/public-static-pages/:slug", async (req, res, next) => {
    try {
      const slugColumn = useLegacyStaticPages() ? "static_page_slug" : "slug";
      const statusColumn = useLegacyStaticPages()
        ? "static_page_status"
        : "status";
      const result = await query(
        `${staticPageSelect()} WHERE ${slugColumn}=$1 AND ${statusColumn}='Active' LIMIT 1`,
        [req.params.slug],
      );
      if (!result.rowCount)
        return res.status(404).json({ message: "Page not found." });
      res.json({
        ...serializeStaticPage(result.rows[0]),
        box_images: await staticPageBoxImages(result.rows[0].id),
        description_blocks: await staticPageDescriptionBlocks(
          result.rows[0].id,
        ),
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
