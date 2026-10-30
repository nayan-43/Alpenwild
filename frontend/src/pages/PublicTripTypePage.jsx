import React, { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import PublicFooter from "@/components/public/PublicFooter";
import PublicFooterExtras from "@/components/public/PublicFooterExtras";
import PublicHeader from "@/components/public/PublicHeader";
import PublicLoader from "@/components/public/PublicLoader";
import { localAppLink, localAssetUrl, thumbnailAssetUrl } from "@/lib/assets";
import { tripDuration } from "@/lib/tripDuration";

function imageUrl(item, type) {
  const value =
    (type ? item[`${type}_image_url`] : item.image_url) ||
    item[`${type}_url`] ||
    item[`${type}_image`];
  if (!value) return "";
  const source = localAssetUrl(
    /^(https?:|\/uploads\/|\/images\/|images\/)/i.test(value)
      ? value
      : `images/triptype/${type}/${value}`,
  );
  return type === "banner"
    ? thumbnailAssetUrl(source, 1170, 448)
    : thumbnailAssetUrl(source, 270, 183);
}

export default function PublicTripTypePage() {
  const { slug } = useParams();
  const [showTooltip, setShowTooltip] = useState(false);
  const [tripType, setTripType] = useState(null);
  const [trips, setTrips] = useState([]);
  const [footerMenus, setFooterMenus] = useState([]);
  const [publicSettings, setPublicSettings] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const tripTypeContentRef = useRef(null);

  useEffect(() => {
    if (!tripType) return undefined;
    document.title = tripType.meta_title || `${tripType.name} | Alpenwild`;
    return () => {
      document.title = "Alpenwild";
    };
  }, [tripType]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all(
      ["trip-types", "trips", "footer-menus", "public-settings"].map(
        (endpoint) =>
          fetch(`/api/${endpoint}`).then((response) => {
            if (!response.ok) throw new Error(`Unable to load ${endpoint}.`);
            return response.json();
          }),
      ),
    )
      .then(([tripTypes, allTrips, menus, settings]) => {
        if (cancelled) return;
        const current = tripTypes.find(
          (item) => item.status === "Active" && item.slug === slug,
        );
        setTripType(current || null);
        setTrips(
          (Array.isArray(allTrips) ? allTrips : []).filter(
            (trip) =>
              trip.status === "Active" &&
              String(trip.type_id) === String(current?.id),
          ),
        );
        setFooterMenus(Array.isArray(menus) ? menus : []);
        setPublicSettings(
          settings && typeof settings === "object" ? settings : {},
        );
        if (!current) setError("Trip category not found.");
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
  }, [slug]);

  useEffect(() => {
    const equalizeTripCards = () => {
      const cards = Array.from(
        tripTypeContentRef.current?.querySelectorAll(".trip_type") || [],
      );
      cards.forEach((card) => {
        card.style.height = "auto";
      });
      if (window.innerWidth <= 767) return;

      const rows = new Map();
      cards.forEach((card) => {
        const row = Math.round(card.getBoundingClientRect().top);
        const rowCards = rows.get(row) || [];
        rowCards.push(card);
        rows.set(row, rowCards);
      });

      rows.forEach((rowCards) => {
        const height = Math.max(
          ...rowCards.map((card) => card.getBoundingClientRect().height),
        );
        rowCards.forEach((card) => {
          card.style.height = `${Math.ceil(height)}px`;
        });
      });
    };

    equalizeTripCards();
    window.addEventListener("resize", equalizeTripCards);
    window.addEventListener("load", equalizeTripCards);
    const images = Array.from(
      tripTypeContentRef.current?.querySelectorAll("img") || [],
    );
    images.forEach((image) => {
      image.addEventListener("load", equalizeTripCards);
    });
    return () => {
      window.removeEventListener("resize", equalizeTripCards);
      window.removeEventListener("load", equalizeTripCards);
      images.forEach((image) => {
        image.removeEventListener("load", equalizeTripCards);
      });
    };
  }, [tripType, trips]);

  return (
    <div className="public-site">
      <PublicHeader />
      {loading && <PublicLoader />}
      <main>
        {error ? (
          <div className="client-alert">{error}</div>
        ) : tripType ? (
          <>
            <div className="banner">
              <div className="container">
                <div
                  className="inner_banner"
                  style={{
                    backgroundImage: `url("${imageUrl(tripType, "banner")}")`,
                  }}
                >
                  <img
                    src={imageUrl(tripType, "banner")}
                    alt={tripType.banner_alt || ""}
                  />
                  <div className="banner_txt">
                    <div className="col-md-10 col-sm-10 col-xs-12">
                      <h1>{tripType.name}</h1>
                      <p>
                        {String(tripType.description || "")
                          .split(/\r?\n/)
                          .map((line, index) => (
                            <React.Fragment key={index}>
                              {index > 0 && <br />}
                              {line}
                            </React.Fragment>
                          ))}
                      </p>
                    </div>
                  </div>
                  <div
                    className="banner_content"
                    style={{ display: showTooltip ? "block" : "none" }}
                  >
                    <p>{tripType.tooltip_text || ""}</p>
                  </div>
                  <button
                    className="fa fa-camera"
                    type="button"
                    aria-label="Show photo credit"
                    aria-expanded={showTooltip}
                    onClick={() => setShowTooltip((visible) => !visible)}
                  />
                </div>
              </div>
            </div>
            <div className="section" ref={tripTypeContentRef}>
              <div className="container">
                <div className="row">
                  <div className="col-xs-12 title">
                    <h2>Choose Your Trip</h2>
                  </div>
                  {trips.map((trip) => (
                    <div
                      className="col-md-3 col-sm-4 col-xs-6 types gridCol"
                      key={trip.id}
                    >
                      <div className="trip_type clearfix">
                        <Link
                          to={`/trip/${encodeURIComponent(trip.slug)}/overview`}
                        >
                          <div className="trip_img">
                            <img
                              src={
                                trip.listing_thumbnail_url ||
                                imageUrl(trip, "listing")
                              }
                              alt={trip.listing_image_alt || ""}
                            />
                          </div>
                          <div className="trip_info trip_info2">
                            <h2>{trip.name}</h2>
                            <p>{trip.short_description} ...</p>
                            <span className="date">
                              <i
                                className="fa fa-calendar"
                                aria-hidden="true"
                              />{" "}
                              {tripDuration(trip)}
                            </span>
                            <span>
                              <i
                                className="fa fa-credit-card"
                                aria-hidden="true"
                              />{" "}
                              From $
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
            </div>
            {tripType.box_images?.length > 0 && (
              <div className="section enjoyBox">
                <div className="container">
                  <div className="col-xs-12 title">
                    <h2>You May Also Enjoy</h2>
                  </div>
                  <div className="row">
                    {tripType.box_images.map((box) => {
                      const link = localAppLink(box.link) || box.link || "#";
                      const CardLink = link.startsWith("/") ? Link : "a";
                      const linkProps =
                        CardLink === Link ? { to: link } : { href: link };
                      return (
                        <div
                          className="col-md-3 col-sm-4 col-xs-12"
                          key={box.id}
                        >
                          <div className="trip_type clearfix">
                            <CardLink {...linkProps}>
                              <div className="trip_img">
                                <img
                                  src={imageUrl(box, "")}
                                  alt={box.image_alt || ""}
                                />
                              </div>
                              <div className="trip_info">
                                <h2>{box.title}</h2>
                              </div>
                            </CardLink>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </>
        ) : null}
      </main>
      <PublicFooterExtras publicSettings={publicSettings} />
      <PublicFooter footerMenus={footerMenus} />
    </div>
  );
}
