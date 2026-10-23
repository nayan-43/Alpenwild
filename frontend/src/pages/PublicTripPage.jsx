import React, { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import PublicFooter from "@/components/public/PublicFooter";
import PublicFooterExtras from "@/components/public/PublicFooterExtras";
import PublicHeader from "@/components/public/PublicHeader";
import PublicLoader from "@/components/public/PublicLoader";
import {
  localAppLink,
  localAssetUrl,
  localizeRichContent,
  thumbnailAssetUrl,
} from "../lib/assets";

function imageUrl(trip, folder) {
  const value = localAssetUrl(
    trip?.[`${folder}_image_url`] ||
      (trip?.[`${folder}_image`]
        ? localAssetUrl(`images/trip/${folder}/${trip[`${folder}_image`]}`)
        : ""),
  );
  return folder === "banner" ? thumbnailAssetUrl(value, 1170, 448) : value;
}

function duration(trip) {
  if (trip?.days && trip?.nights)
    return `${trip.days} Days/${trip.nights} Nights`;
  const date = trip?.dates?.[0];
  if (!date?.date_range) return "";
  return `${date.date_range} Days/${Math.max(0, date.date_range - 1)} Nights`;
}

function formatTripPrice(amount) {
  return Number(amount || 0).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });
}

function dateLabel(date) {
  if (!date?.start_date || !date?.end_date) return "";
  const format = (value) => {
    const raw = String(value);
    const legacyDate = raw.match(/^(\d{2})-(\d{2})-(\d{4})(?:\s|$)/);
    const parsed = legacyDate
      ? new Date(
          Date.UTC(
            Number(legacyDate[3]),
            Number(legacyDate[2]) - 1,
            Number(legacyDate[1]),
          ),
        )
      : new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(parsed);
  };
  const start = format(date.start_date);
  const end = format(date.end_date);
  return start && end ? `${start} - ${end}` : "";
}

export default function PublicTripPage() {
  const { slug, section = "overview" } = useParams();
  const [trip, setTrip] = useState(null);
  const [footerMenus, setFooterMenus] = useState([]);
  const [publicSettings, setPublicSettings] = useState({});
  const [testimonials, setTestimonials] = useState([]);
  const [tripPosts, setTripPosts] = useState([]);
  const [gallery, setGallery] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [printOpen, setPrintOpen] = useState(false);
  const [printError, setPrintError] = useState("");
  const [bannerAction, setBannerAction] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const bannerRef = useRef(null);
  const printContentRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([
      fetch("/api/trips").then((response) => {
        if (!response.ok) throw new Error("Unable to load trips.");
        return response.json();
      }),
      fetch("/api/footer-menus").then((response) => response.json()),
      fetch("/api/public-settings").then((response) => response.json()),
      fetch("/api/testimonials")
        .then((response) => (response.ok ? response.json() : []))
        .catch(() => []),
      fetch("/api/trip-galleries")
        .then((response) => (response.ok ? response.json() : []))
        .catch(() => []),
    ])
      .then(async ([trips, menus, settings, allTestimonials, allGallery]) => {
        if (cancelled) return;
        const current = (Array.isArray(trips) ? trips : []).find(
          (item) => item.status === "Active" && item.slug === slug,
        );
        const postsResponse = current
          ? await fetch(`/api/trip-posts/${current.id}`).catch(() => null)
          : null;
        const posts =
          postsResponse?.ok && postsResponse ? await postsResponse.json() : [];
        setTrip(current || null);
        setFooterMenus(Array.isArray(menus) ? menus : []);
        setPublicSettings(
          settings && typeof settings === "object" ? settings : {},
        );
        setTestimonials(
          (Array.isArray(allTestimonials) ? allTestimonials : [])
            .filter(
              (item) =>
                item.status === "Active" &&
                String(item.trip_id) === String(current?.id),
            )
            .sort(() => Math.random() - 0.5),
        );
        setTripPosts(Array.isArray(posts) ? posts : []);
        const faqResponse = current
          ? await fetch(`/api/trip-faqs/${current.id}`).catch(() => null)
          : null;
        const tripFaqs =
          faqResponse?.ok && faqResponse ? await faqResponse.json() : [];
        setFaqs(Array.isArray(tripFaqs) ? tripFaqs : []);
        setGallery(
          (Array.isArray(allGallery) ? allGallery : []).filter(
            (item) =>
              String(item.trip_id) === String(current?.id) &&
              item.status === "Active" &&
              item.display_in_trip_page !== false,
          ),
        );
        if (!current) setError("Trip not found.");
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
    if (!trip) return undefined;
    document.title = trip.meta_title || `${trip.name} | Alpenwild`;
    return () => {
      document.title = "Alpenwild";
    };
  }, [trip]);

  useEffect(() => {
    if (!bannerAction) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!bannerRef.current?.contains(event.target)) setBannerAction("");
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setBannerAction("");
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [bannerAction]);

  return (
    <div className="public-site">
      <PublicHeader />
      {loading && <PublicLoader />}
      <main>
        {error ? (
          <div className="client-alert">{error}</div>
        ) : trip ? (
          <>
            <div className="banner">
              <div className="container">
                <section
                  className="inner_banner client-detail-banner"
                  ref={bannerRef}
                >
                  <img
                    src={imageUrl(trip, "banner")}
                    alt={trip.banner_alt || trip.name}
                  />
                  <div className="banner_txt client-detail-banner-copy">
                    <div className="col-md-10 col-sm-10 col-xs-12">
                      <h1>{trip.name}</h1>
                      <p>{trip.banner_sub_title || trip.short_description}</p>
                    </div>
                  </div>
                  {bannerAction === "photo" && trip.tooltip_text && (
                    <div
                      className="banner_content client-detail-banner-popover client-detail-banner-photo"
                      style={{ display: "block" }}
                    >
                      <p>{trip.tooltip_text}</p>
                    </div>
                  )}
                  {bannerAction === "activity" && trip.activity && (
                    <div
                      className="banner_activity_content client-detail-banner-popover client-detail-banner-activity-popover"
                      style={{ display: "block" }}
                    >
                      <div
                        dangerouslySetInnerHTML={{
                          __html: localizeRichContent(trip.activity),
                        }}
                      />
                    </div>
                  )}
                  {trip.activity_level && (
                    <button
                      className="activity-level client-detail-banner-action"
                      type="button"
                      title="Trip Difficulty Level"
                      aria-label="Show trip difficulty level"
                      onClick={() =>
                        setBannerAction((current) =>
                          current === "activity" ? "" : "activity",
                        )
                      }
                    >
                      <img
                        src={localAssetUrl(
                          `images/activity_${String(trip.activity_level)
                            .toLowerCase()
                            .replace(/\s+/g, "_")}.png`,
                        )}
                        alt=""
                      />
                    </button>
                  )}
                  <button
                    className="fa fa-camera"
                    type="button"
                    title="Photo Credit"
                    aria-label="Show photo credit"
                    onClick={() =>
                      setBannerAction((current) =>
                        current === "photo" ? "" : "photo",
                      )
                    }
                  />
                </section>
              </div>
            </div>
            <section className="section client-section client-trip-detail">
              <div className="container client-container">
                <div className="row">
                  <a name="overview" id="overview" />
                  <aside className="col-md-3 col-sm-12 col-xs-12 client-trip-sidebar">
                    <div className="laft_menu">
                      <div className="clearfix">
                        <ul
                          className="client-trip-tabs"
                          aria-label="Trip sections"
                        >
                          {[
                            "overview",
                            "itinerary",
                            "details",
                            "gallery",
                            ...(faqs.length > 0 ? ["faq"] : []),
                          ].map((tab) => (
                            <li
                              className={`${section === tab ? "active" : ""} ${
                                tab === "itinerary" && section === "overview"
                                  ? "hide-on-mobile"
                                  : ""
                              }`}
                              key={tab}
                            >
                              <Link
                                to={`/trip/${encodeURIComponent(trip.slug)}/${tab}/#overview`}
                              >
                                {tab[0].toUpperCase() + tab.slice(1)}
                              </Link>
                            </li>
                          ))}
                        </ul>
                        <Link
                          className="book hide-on-mobile client-trip-book"
                          to={`/trip/${encodeURIComponent(trip.slug)}/booking/`}
                        >
                          Book This Trip Now
                          <span>
                            <i className="fa fa-calendar" aria-hidden="true" />
                          </span>
                        </Link>
                      </div>
                    </div>
                    <button
                      className="print_page hide-on-mobile client-trip-print"
                      type="button"
                      aria-label="Print itinerary"
                      onClick={() => {
                        setPrintError("");
                        setPrintOpen(true);
                      }}
                    >
                      <img src="/images/print.png" alt="Print Itinerary" />
                    </button>
                    {testimonials.length > 0 && (
                      <div className="side_div client-trip-sidebar-section client-trip-testimonial-section">
                        <h3>Testimonials</h3>
                        <div className="box testimonial client-trip-testimonial">
                          <p>
                            {testimonials[0].content} -{" "}
                            <em>{testimonials[0].client_details}</em>
                          </p>
                        </div>
                      </div>
                    )}
                    {tripPosts.length > 0 && (
                      <div className="side_div highlight_details client-trip-sidebar-section client-trip-posts">
                        <h3>Recent Blog Posts</h3>
                        <div className="box">
                          <ul className="post-list">
                            {tripPosts.map((post) => (
                              <li key={`${post.url}-${post.name}`}>
                                {post.image && (
                                  <img
                                    src={localAssetUrl(
                                      /^(https?:|\/uploads\/|\/images\/|images\/)/i.test(
                                        post.image,
                                      )
                                        ? post.image
                                        : `images/trip/${post.image}`,
                                    )}
                                    alt=""
                                  />
                                )}
                                <a
                                  href={localAppLink(post.url) || post.url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {post.name}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </aside>
                  <article
                    className={
                      section === "gallery"
                        ? "col-md-9 col-sm-12 col-xs-12 no-padding"
                        : "col-md-5 col-sm-7 col-xs-12 title details"
                    }
                  >
                    {section !== "gallery" && (
                      <div className="client-trip-description details_pionts">
                        {section === "overview" ? (
                          <div
                            className="client-rich-text"
                            dangerouslySetInnerHTML={{
                              __html: localizeRichContent(
                                trip.description ||
                                  trip.short_description ||
                                  "",
                              ),
                            }}
                          />
                        ) : section === "itinerary" ? (
                          <div className="client-rich-text details_pionts">
                            <h2>Itinerary</h2>
                            {(trip.itinerary || []).map((item) => (
                              <div
                                className="client-trip-itinerary-day"
                                key={item.id}
                              >
                                <h3>
                                  Day {item.day}: {item.title}
                                </h3>
                                {item.description && (
                                  <div
                                    dangerouslySetInnerHTML={{
                                      __html: localizeRichContent(
                                        item.description,
                                      ),
                                    }}
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        ) : section === "details" ? (
                          <div className="client-rich-text details_pionts">
                            <h2>Trip Details</h2>
                            {trip.included && (
                              <>
                                <h3>Included</h3>
                                <div
                                  dangerouslySetInnerHTML={{
                                    __html: localizeRichContent(trip.included),
                                  }}
                                />
                              </>
                            )}
                            {trip.excluded && (
                              <>
                                <h3>Not Included</h3>
                                <div
                                  dangerouslySetInnerHTML={{
                                    __html: localizeRichContent(trip.excluded),
                                  }}
                                />
                              </>
                            )}
                            {trip.accommodations && (
                              <>
                                <h3>Accommodations</h3>
                                <div
                                  dangerouslySetInnerHTML={{
                                    __html: localizeRichContent(
                                      trip.accommodations,
                                    ),
                                  }}
                                />
                              </>
                            )}
                            {trip.meals && (
                              <>
                                <h3>Meals</h3>
                                <div
                                  dangerouslySetInnerHTML={{
                                    __html: localizeRichContent(trip.meals),
                                  }}
                                />
                              </>
                            )}
                          </div>
                        ) : section === "faq" ? (
                          <div className="client-rich-text details_pionts">
                            <h2>FAQ</h2>
                            {faqs.map((faq) => (
                              <div className="client-trip-faq" key={faq.id}>
                                <h3>{faq.question}</h3>
                                <div
                                  dangerouslySetInnerHTML={{
                                    __html: localizeRichContent(faq.answer),
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                        ) : section === "booking" ? (
                          <div className="client-rich-text">
                            <h2>Book This Trip</h2>
                            <p>
                              To reserve your place on this trip, please contact
                              Alpenwild or continue to the booking form.
                            </p>
                            <Link
                              className="client-trip-book book"
                              to={`/trip/${encodeURIComponent(trip.slug)}/booking/`}
                            >
                              Continue to Booking
                            </Link>
                          </div>
                        ) : null}
                      </div>
                    )}
                    {section === "gallery" && (
                      <>
                        <div className="col-xs-12 title">
                          <h2>Gallery</h2>
                        </div>
                        {gallery.map((item) => (
                          <div
                            className="col-md-4 col-sm-4 col-xs-12 gallery gridCol"
                            key={item.id}
                          >
                            <div className="trip_type clearfix">
                              <div className="trip_img">
                                <a
                                  href={localAssetUrl(
                                    item.video_url ||
                                      item.image_url ||
                                      item.image,
                                  )}
                                >
                                  {item.image_url || item.image ? (
                                    <img
                                      src={thumbnailAssetUrl(
                                        item.image_url || item.image,
                                        370,
                                        250,
                                      )}
                                      alt={item.image_alt || trip.name}
                                    />
                                  ) : null}
                                  {item.video_url && (
                                    <>
                                      <i
                                        className="fa fa-youtube-play"
                                        aria-hidden="true"
                                      />
                                      <br />
                                      {item.title || item.video_url}
                                    </>
                                  )}
                                </a>
                              </div>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                    {section === "overview" && (
                      <div className="client-trip-itinerary details_pionts black_txt">
                        <h2>Overview Itinerary</h2>
                        {(trip.itinerary || []).map((item) => (
                          <p key={item.id}>
                            Day {item.day} – {item.title}
                          </p>
                        ))}
                        <Link
                          className="client-trip-book client-trip-book-inline book"
                          to={`/trip/${encodeURIComponent(trip.slug)}/itinerary/`}
                        >
                          View Detailed Itinerary
                        </Link>
                      </div>
                    )}
                  </article>
                  {section !== "gallery" && (
                    <aside className="col-md-4 col-sm-5 col-xs-12 right_side client-trip-sidebar client-trip-right">
                      {section === "overview" && (
                        <>
                          <div className="side_div client-trip-panel">
                            <h3>Tour Price</h3>
                            <div className="box client-trip-box">
                              <p>
                                <strong>${formatTripPrice(trip.price)}</strong>{" "}
                                {trip.price_text}
                              </p>
                              <p>
                                <strong>
                                  ${formatTripPrice(trip.single_price)}
                                </strong>{" "}
                                single supplement
                              </p>
                              <p>
                                {String(trip.deposit_amount_text || "")
                                  .split("#depositamount#")
                                  .map((part, index, parts) => (
                                    <React.Fragment key={index}>
                                      {part}
                                      {index < parts.length - 1 && (
                                        <strong>
                                          $
                                          {formatTripPrice(trip.deposit_amount)}
                                        </strong>
                                      )}
                                    </React.Fragment>
                                  ))}
                              </p>
                            </div>
                          </div>
                          <div className="side_div client-trip-panel">
                            <h3>Trip Dates</h3>
                            <div className="box total_price client-trip-box">
                              {(trip.dates || [])
                                .filter(
                                  (date) =>
                                    !["Inactive", "Temp Delete"].includes(
                                      date.status,
                                    ) && dateLabel(date),
                                )
                                .slice(0, 5)
                                .map((date) => (
                                  <p key={date.id}>
                                    <strong>{dateLabel(date)}</strong>
                                    {date.status &&
                                      date.status !== "Active" && (
                                        <span className="client-trip-date-status">
                                          {date.status}
                                        </span>
                                      )}
                                  </p>
                                ))}
                              <p>
                                Or,{" "}
                                <Link
                                  className="client-private-departure-link"
                                  to="/staticpage/contact-us/"
                                >
                                  book a private departure
                                </Link>
                              </p>
                            </div>
                          </div>
                          {trip.highlight && (
                            <div className="side_div highlight_details client-trip-panel">
                              <h3>Trip Highlights</h3>
                              <div
                                className="box client-trip-box client-rich-text"
                                dangerouslySetInnerHTML={{
                                  __html: localizeRichContent(trip.highlight),
                                }}
                              />
                            </div>
                          )}
                        </>
                      )}
                      {trip.youtube_content && section !== "gallery" && (
                        <div className="side_div highlight_details client-trip-panel client-trip-video">
                          <h3>Trip Videos</h3>
                          <div
                            className="box client-trip-box"
                            dangerouslySetInnerHTML={{
                              __html: localizeRichContent(trip.youtube_content),
                            }}
                          />
                        </div>
                      )}
                      {!trip.youtube_content &&
                        section === "details" &&
                        gallery.length > 0 && (
                          <div className="side_div client-trip-panel client-trip-gallery-preview">
                            <h3>Trip Gallery</h3>
                            <div className="box client-trip-box">
                              {gallery.slice(0, 1).map((item) => (
                                <img
                                  key={item.id}
                                  src={thumbnailAssetUrl(
                                    item.image_url || item.image,
                                    370,
                                    250,
                                  )}
                                  alt={item.image_alt || trip.name}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      {trip.map_image_url && (
                        <div className="side_div client-trip-map">
                          <img
                            src={thumbnailAssetUrl(
                              trip.map_image_url,
                              370,
                              296,
                              3,
                            )}
                            alt={`${trip.name} map`}
                          />
                        </div>
                      )}
                      {["itinerary", "faq", "gallery"].includes(section) && (
                        <div className="side_div client-trip-panel">
                          <h3>Activity Level</h3>
                          <div
                            className="box client-trip-box client-rich-text"
                            dangerouslySetInnerHTML={{
                              __html: localizeRichContent(trip.activity || ""),
                            }}
                          />
                        </div>
                      )}
                      {section === "details" && (
                        <>
                          {trip.included && (
                            <div className="side_div highlight_details client-trip-panel">
                              <h3>Included</h3>
                              <div
                                className="box client-trip-box client-rich-text"
                                dangerouslySetInnerHTML={{
                                  __html: localizeRichContent(trip.included),
                                }}
                              />
                            </div>
                          )}
                          {trip.excluded && (
                            <div className="side_div highlight_details client-trip-panel">
                              <h3>Not Included</h3>
                              <div
                                className="box client-trip-box client-rich-text"
                                dangerouslySetInnerHTML={{
                                  __html: localizeRichContent(trip.excluded),
                                }}
                              />
                            </div>
                          )}
                        </>
                      )}
                    </aside>
                  )}
                </div>
              </div>
            </section>
          </>
        ) : null}
      </main>
      {printOpen && trip && (
        <div
          className="client-modal-backdrop client-print-backdrop"
          onClick={() => setPrintOpen(false)}
        >
          <div
            className="client-modal client-print-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Print itinerary"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="client-modal-close"
              type="button"
              aria-label="Close print itinerary"
              onClick={() => setPrintOpen(false)}
            >
              <i className="fa fa-times-circle-o" aria-hidden="true" />
            </button>
            <div className="client-print-toolbar">
              <button
                type="button"
                onClick={() => {
                  const content = printContentRef.current?.innerHTML;
                  if (!content) {
                    setPrintError(
                      "Unable to prepare the itinerary for printing.",
                    );
                    return;
                  }
                  const printWindow = window.open(
                    "",
                    "Print",
                    "height=600,width=800",
                  );
                  if (!printWindow) {
                    setPrintError(
                      "Please allow pop-ups to print this itinerary.",
                    );
                    return;
                  }
                  printWindow.document.write(
                    `<html><head><title>Print</title></head><body>${content}</body></html>`,
                  );
                  printWindow.document.close();
                  printWindow.focus();
                  printWindow.print();
                  if (Boolean(window.chrome)) {
                    printWindow.setTimeout(() => printWindow.close(), 10000);
                  } else {
                    printWindow.close();
                  }
                }}
              >
                <i className="fa fa-print" aria-hidden="true" /> Print Itinerary
              </button>
            </div>
            {printError && (
              <p className="client-print-error" role="alert">
                {printError}
              </p>
            )}
            <div
              className="client-print-content client-rich-text"
              ref={printContentRef}
            >
              <h2>Itinerary</h2>
              {(trip.itinerary || []).map((item) => (
                <section className="client-print-day" key={item.id}>
                  <h3>
                    Day {item.day} – {item.title}
                  </h3>
                  {item.description && (
                    <div
                      dangerouslySetInnerHTML={{
                        __html: localizeRichContent(item.description),
                      }}
                    />
                  )}
                </section>
              ))}
            </div>
          </div>
        </div>
      )}
      <PublicFooterExtras publicSettings={publicSettings} />
      <PublicFooter footerMenus={footerMenus} />
    </div>
  );
}
