import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("trip itinerary routes preserve public reads and authorized replacement writes", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const apiAccess = await readFile(
    new URL("../src/apiAccess.js", import.meta.url),
    "utf8",
  );
  const routes = await readFile(
    new URL("../src/routes/tripItinerary.js", import.meta.url),
    "utf8",
  );
  const middlewareIndex = app.indexOf("createApiAccessMiddleware({");
  const mountIndex = app.indexOf("app.use(createTripItineraryRouter(");

  assert.ok(middlewareIndex >= 0);
  assert.ok(mountIndex > middlewareIndex);
  assert.match(
    apiAccess,
    /const publicApiPaths = new Set\([\s\S]*?\\\/trips\\\/\\d\+\\\/itinerary/,
  );
  assert.match(routes, /router\.get\("\/api\/trips\/:id\/itinerary"/);
  assert.match(routes, /router\.put\("\/api\/trips\/:id\/itinerary"/);
  assert.match(routes, /z\.array\(itinerarySchema\)/);
  assert.match(routes, /SELECT trips_id FROM alpenwild_trips_tbl/);
  assert.match(routes, /Trip not found/);
  assert.match(routes, /DELETE FROM alpenwild_trips_itinerary_tbl/);
  assert.match(routes, /INSERT INTO alpenwild_trips_itinerary_tbl/);
});
