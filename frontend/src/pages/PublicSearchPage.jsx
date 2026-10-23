import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PublicFooter from "@/components/public/PublicFooter";
import PublicFooterExtras from "@/components/public/PublicFooterExtras";
import PublicHeader from "@/components/public/PublicHeader";
import PublicLoader from "@/components/public/PublicLoader";
import { filterTripsForFinder } from "@/lib/tripFinder";

function excerpt(value, length = 220) {
  const text = String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > length ? `${text.slice(0, length)} ...` : text;
}

export default function PublicSearchPage() {
  const [params] = useSearchParams();
  const isTripFinder = !params.has("stse");
  const term = params.get("stse")?.trim() || "";
  const queryString = params.toString();
  const [trips, setTrips] = useState([]);
  const [pages, setPages] = useState([]);
  const [menus, setMenus] = useState([]);
  const [settings, setSettings] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Search | Alpenwild";
    return () => {
      document.title = "Alpenwild";
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    const filters = new URLSearchParams(queryString);
    const locationIds = filters.getAll("trips_location_id[]");
    const activityIds = filters.getAll("activity_id[]");

    async function fetchJson(endpoint) {
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error(`Unable to load ${endpoint}.`);
      return response.json();
    }

    Promise.all([
      fetchJson("/api/trips"),
      isTripFinder
        ? Promise.resolve([])
        : fetchJson("/api/public-static-pages"),
      fetchJson("/api/footer-menus"),
      fetchJson("/api/public-settings"),
    ])
      .then(([tripData, pageData, footerData, settingData]) => {
        if (cancelled) return;
        if (!Array.isArray(tripData) || !Array.isArray(pageData))
          throw new Error(
            "Search results were returned in an unexpected format.",
          );
        if (isTripFinder) {
          setTrips(
            filterTripsForFinder(tripData, {
              locationIds,
              activityIds,
              month: filters.get("trips_month") || "",
            }),
          );
          setPages([]);
        } else {
          const query = term.toLowerCase();
          const matches = (value) =>
            String(value || "")
              .toLowerCase()
              .includes(query);
          setTrips(
            tripData.filter(
              (item) =>
                item.status === "Active" &&
                (!query || matches(item.name) || matches(item.description)),
            ),
          );
          setPages(
            pageData.filter(
              (item) =>
                item.status === "Active" &&
                (!query || matches(item.name) || matches(item.description)),
            ),
          );
        }
        setMenus(Array.isArray(footerData) ? footerData : []);
        setSettings(settingData || {});
        setError("");
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isTripFinder, term, queryString]);

  function tripDuration(trip) {
    const firstDate = trip.dates?.[0];
    let days = trip.days;
    let nights = trip.nights;
    if ((days === undefined || days === null || days === "") && firstDate) {
      const dateRange = Number(firstDate.date_range || 0);
      if (dateRange) {
        days = dateRange;
        nights = dateRange - 1;
      } else {
        const start = Date.parse(`${firstDate.start_date}T00:00:00Z`);
        const end = Date.parse(`${firstDate.end_date}T00:00:00Z`);
        if (Number.isFinite(start) && Number.isFinite(end)) {
          nights = Math.round((end - start) / 86400000);
          days = nights + 1;
        }
      }
    }
    if (days === undefined || days === null || days === "") return "";
    if (nights === undefined || nights === null || nights === "")
      nights = Number(days) - 1;
    return `${days} Days/${nights} Nights`;
  }

  return (
    <div className="public-site">
      <PublicHeader />
      {loading && <PublicLoader />}
      <main className={isTripFinder ? "" : "client-search-page"}>
        <div className={isTripFinder ? "" : "container client-container"}>
          {error ? (
            <div className="client-alert">{error}</div>
          ) : isTripFinder ? (
            <section className="section client-section client-trip-listing">
              <div className="container client-container">
                <div className="row">
                  <div className="col-xs-12 title">
                    <h2>Choose Your Trip</h2>
                  </div>
                  {trips.map((trip) => (
                    <div
                      className="col-md-3 col-sm-4 col-xs-6 types gridCol"
                      key={trip.id}
                    >
                      <div
                        className="trip_type clearfix"
                        style={{ height: "451px" }}
                      >
                        <Link
                          to={`/trip/${encodeURIComponent(trip.slug)}/overview/`}
                        >
                          <div className="trip_img">
                            <img
                              src={trip.listing_thumbnail_url || ""}
                              alt={trip.listing_image_alt || trip.name}
                            />
                          </div>
                          <div className="trip_info">
                            <h2>{trip.name}</h2>
                            <p>{trip.short_description} ...</p>
                            <span className="date">
                              <i className="fa fa-calendar" />{" "}
                              {tripDuration(trip)}
                            </span>
                            <span>
                              <i className="fa fa-credit-card" /> From $
                              {Number(trip.price || 0).toLocaleString("en-US", {
                                maximumFractionDigits: 0,
                              })}
                            </span>
                          </div>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : (
            <>
              <h1>Search Result For Trip</h1>
              {trips.length ? (
                trips.map((trip) => (
                  <Link
                    className="client-search-result"
                    to={`/trip/${trip.slug}/overview/`}
                    key={`trip-${trip.id}`}
                  >
                    <h2>{trip.name}</h2>
                    <p>{excerpt(trip.short_description || trip.description)}</p>
                  </Link>
                ))
              ) : (
                <p className="no-result">No trip(s) found.</p>
              )}
              <h1>Search Result For Pages</h1>
              {pages.length ? (
                pages.map((page) => (
                  <Link
                    className="client-search-result"
                    to={`/staticpage/${page.slug}/`}
                    key={`page-${page.id}`}
                  >
                    <h2>{page.name}</h2>
                    <p>{excerpt(page.description)}</p>
                  </Link>
                ))
              ) : (
                <p className="no-result">No page(s) found.</p>
              )}
            </>
          )}
        </div>
      </main>
      <PublicFooterExtras publicSettings={settings} />
      <PublicFooter footerMenus={menus} />
    </div>
  );
}
