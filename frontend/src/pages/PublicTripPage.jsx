import React, { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import PublicFooter from "@/components/public/PublicFooter";
import PublicFooterExtras from "@/components/public/PublicFooterExtras";
import PublicHeader from "@/components/public/PublicHeader";
import PublicLoader from "@/components/public/PublicLoader";
import {
  legacyWordpressUrl,
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

function tripDateLabel(trip, date) {
  const label = dateLabel(date);
  if (!label) return "";
  return trip?.available_for !== "Specefic Date" && date?.date_range
    ? `${label} for ${date.date_range} days`
    : label;
}

function overviewDescriptionPreview(markup) {
  const parsed = new DOMParser().parseFromString(markup, "text/html");
  const nodes = Array.from(parsed.body.childNodes);
  const paragraphIndex = nodes.findIndex(
    (node) => node.nodeType === Node.ELEMENT_NODE && node.nodeName === "P",
  );
  if (paragraphIndex < 0) return null;

  const hasMore = nodes
    .slice(paragraphIndex + 1)
    .some(
      (node) => node.textContent.trim() || node.nodeType === Node.ELEMENT_NODE,
    );
  if (!hasMore) return null;

  const preview = document.implementation.createHTMLDocument("");
  nodes
    .slice(0, paragraphIndex + 1)
    .forEach((node) => preview.body.append(node.cloneNode(true)));
  const readMore = preview.createElement("span");
  readMore.className = "readmoreinfo";
  readMore.textContent = "(Read more...)";
  preview.body.lastElementChild.append(" ", readMore);

  return preview.body.innerHTML;
}

function TripOverviewDescription({ description }) {
  const [expanded, setExpanded] = useState(false);
  const fullMarkup = localizeRichContent(description);
  const previewMarkup = overviewDescriptionPreview(fullMarkup);

  return (
    <>
      <div
        className="client-trip-overview-full"
        dangerouslySetInnerHTML={{ __html: fullMarkup }}
      />
      <div
        className="client-trip-overview-mobile"
        onClick={(event) => {
          if (
            event.target instanceof Element &&
            event.target.closest(".readmoreinfo")
          ) {
            setExpanded(true);
          }
        }}
        dangerouslySetInnerHTML={{
          __html: expanded || !previewMarkup ? fullMarkup : previewMarkup,
        }}
      />
    </>
  );
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
          (Array.isArray(allGallery) ? allGallery : [])
            .filter(
              (item) =>
                String(item.trip_id) === String(current?.id) &&
                item.status === "Active" &&
                String(item.display_in_trip_page) === "1",
            )
            .sort(
              (first, second) =>
                Number(first.display_order || 0) -
                Number(second.display_order || 0),
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
                  className="inner_banner"
                  ref={bannerRef}
                  style={{
                    backgroundImage: `url("${imageUrl(trip, "banner")}")`,
                  }}
                >
                  <img
                    src={imageUrl(trip, "banner")}
                    alt={trip.banner_alt || ""}
                  />
                  <div className="banner_txt">
                    <div className="col-md-10 col-sm-10 col-xs-12">
                      <h1>{trip.name}</h1>
                      <p>{trip.banner_sub_title}</p>
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
                                tab === "itinerary" ? "hide-on-mobile" : ""
                              }`}
                              key={tab}
                            >
                              <Link
                                to={`/trip/${encodeURIComponent(trip.slug)}/${tab}/#overview`}
                              >
                                {tab === "faq"
                                  ? "FAQ"
                                  : tab[0].toUpperCase() + tab.slice(1)}
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
                      <div
                        className="main-share-div hide-on-mobile clearfix"
                        style={{ margin: "20px 0 0" }}
                      >
                        <div className="share-tools">
                          <div className="addthis_inline_share_toolbox" />
                        </div>
                        <div className="like-tools">
                          <div
                            className="fb-like"
                            data-href="https://www.facebook.com/travelswitzerland/"
                            data-width="100"
                            data-layout="button_count"
                            data-action="like"
                            data-size="large"
                            data-show-faces="false"
                            data-share="false"
                          />
                        </div>
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
                      <div className="side_div hide-on-mobile client-trip-sidebar-section client-trip-testimonial-section">
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
                      <div className="side_div highlight_details hide-on-mobile client-trip-sidebar-section client-trip-posts">
                        <h3>Recent Blog Posts</h3>
                        <div className="box">
                          <ul className="post-list">
                            {tripPosts.map((post) => (
                              <li key={`${post.url}-${post.name}`}>
                                <img
                                  src={
                                    post.image
                                      ? localAssetUrl(
                                          /^(https?:|\/uploads\/|\/images\/|images\/)/i.test(
                                            post.image,
                                          )
                                            ? legacyWordpressUrl(post.image)
                                            : `images/trip/${post.image}`,
                                        )
                                      : thumbnailAssetUrl(
                                          "/uploads/welcome.jpg",
                                          100,
                                          100,
                                          1,
                                        )
                                  }
                                  width="100"
                                  height="100"
                                  alt=""
                                />
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
                          <TripOverviewDescription
                            description={
                              trip.description || trip.short_description || ""
                            }
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
                          <>
                            {[
                              ["Arrival", trip.arrival],
                              ["Departure", trip.departure],
                              [
                                "Pre- and Post-Tour Travel",
                                trip.pre_post_tour_travel,
                              ],
                              ["Accommodations", trip.accommodations],
                              ["Meals", trip.meals],
                            ].map(([heading, content]) => (
                              <div className="details_pionts" key={heading}>
                                <h2>{heading}</h2>
                                <div
                                  dangerouslySetInnerHTML={{
                                    __html: localizeRichContent(content),
                                  }}
                                />
                              </div>
                            ))}
                          </>
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
                    {["overview", "details"].includes(section) && (
                      <div className="trip-vid-mobile">
                        {trip.youtube_content ? (
                          <div className="side_div highlight_details client-trip-video">
                            <h3>Trip Videos</h3>
                            <div
                              className="box"
                              dangerouslySetInnerHTML={{
                                __html: localizeRichContent(
                                  trip.youtube_content,
                                ),
                              }}
                            />
                          </div>
                        ) : (
                          gallery.length > 0 && (
                            <div className="slider_trip show-on-modile">
                              {gallery.map((item) => {
                                const image = item.image_url || item.image;
                                const video = item.video_url || "";
                                const videoId =
                                  video.match(
                                    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|watch\?v=))([^?&/]+)/i,
                                  )?.[1] || "";
                                const thumbnail = image
                                  ? thumbnailAssetUrl(image, 370, 250)
                                  : videoId
                                    ? `https://i.ytimg.com/vi/${videoId}/0.jpg`
                                    : "";

                                return (
                                  <div className="trip-gallery" key={item.id}>
                                    <a href={video || localAssetUrl(image)}>
                                      {thumbnail && (
                                        <img
                                          src={thumbnail}
                                          alt={item.image_alt || ""}
                                        />
                                      )}
                                      {video && (
                                        <>
                                          <i
                                            className="fa fa-youtube-play"
                                            aria-hidden="true"
                                          />
                                          <br />
                                          {item.title || video}
                                        </>
                                      )}
                                    </a>
                                  </div>
                                );
                              })}
                            </div>
                          )
                        )}
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
                          className="client-trip-book client-trip-book-inline book hide-on-mobile"
                          to={`/trip/${encodeURIComponent(trip.slug)}/itinerary/`}
                        >
                          View Detailed Itinerary
                        </Link>
                        <button
                          className="client-trip-book client-trip-book-inline book show-on-modile print_page"
                          type="button"
                          onClick={() => {
                            setPrintError("");
                            setPrintOpen(true);
                          }}
                        >
                          View Detailed Itinerary
                        </button>
                      </div>
                    )}
                  </article>
                  {section !== "gallery" && (
                    <aside className="col-md-4 col-sm-5 col-xs-12 right_side client-trip-sidebar client-trip-right">
                      <div className="display-flex">
                        {section === "overview" && (
                          <>
                            <div className="side_div order-4 client-trip-panel">
                              <h3>Tour Price</h3>
                              <div className="box client-trip-box">
                                <p>
                                  <strong>
                                    ${formatTripPrice(trip.price)}
                                  </strong>{" "}
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
                                            {formatTripPrice(
                                              trip.deposit_amount,
                                            )}
                                          </strong>
                                        )}
                                      </React.Fragment>
                                    ))}
                                </p>
                              </div>
                            </div>
                            <div className="side_div order-2 client-trip-panel">
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
                                      <strong>
                                        {tripDateLabel(trip, date)}
                                      </strong>
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
                              <div className="side_div order-3 highlight_details client-trip-panel">
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
                          <div className="trip-vid-desktop side_div highlight_details client-trip-panel client-trip-video">
                            <h3>Trip Videos</h3>
                            <div
                              className="box client-trip-box"
                              dangerouslySetInnerHTML={{
                                __html: localizeRichContent(
                                  trip.youtube_content,
                                ),
                              }}
                            />
                          </div>
                        )}
                        {trip.map_image_url && (
                          <div className="side_div order-1">
                            <div className="map">
                              <a href={localAssetUrl(trip.map_image_url)}>
                                <img
                                  src={thumbnailAssetUrl(
                                    trip.map_image_url,
                                    370,
                                    296,
                                    3,
                                  )}
                                  alt=""
                                />
                                <div className="zoom">
                                  <i
                                    className="fa fa-search"
                                    aria-hidden="true"
                                  />
                                </div>
                              </a>
                            </div>
                          </div>
                        )}
                        {["itinerary", "faq", "gallery"].includes(section) && (
                          <div className="side_div client-trip-panel">
                            <h3>Activity Level</h3>
                            <div
                              className="box client-trip-box client-rich-text"
                              dangerouslySetInnerHTML={{
                                __html: localizeRichContent(
                                  trip.activity || "",
                                ),
                              }}
                            />
                          </div>
                        )}
                        {section === "details" && (
                          <>
                            <div className="side_div highlight_details">
                              <h3>Included</h3>
                              <div className="box">
                                <div
                                  dangerouslySetInnerHTML={{
                                    __html: localizeRichContent(trip.included),
                                  }}
                                />
                              </div>
                            </div>
                            <div className="side_div highlight_details">
                              <h3>Not Included</h3>
                              <div className="box">
                                <div
                                  dangerouslySetInnerHTML={{
                                    __html: localizeRichContent(trip.excluded),
                                  }}
                                />
                              </div>
                            </div>
                            <Link
                              className="book show-on-modile"
                              to={`/trip/${encodeURIComponent(trip.slug)}/booking/`}
                            >
                              Book This Trip Now
                              <span>
                                <i
                                  className="fa fa-calendar"
                                  aria-hidden="true"
                                />
                              </span>
                            </Link>
                          </>
                        )}
                      </div>
                    </aside>
                  )}
                </div>
                {section === "overview" && (
                  <Link
                    className="book show-on-modile"
                    to={`/trip/${encodeURIComponent(trip.slug)}/booking/`}
                  >
                    Book This Trip Now
                    <span>
                      <i className="fa fa-calendar" aria-hidden="true" />
                    </span>
                  </Link>
                )}
                {testimonials.length > 0 && (
                  <div className="col-xs-12 show-on-modile" id="mobile-place">
                    <div className="side_div client-trip-sidebar-section client-trip-testimonial-section">
                      <h3>Testimonials</h3>
                      <div className="box testimonial client-trip-testimonial">
                        <p>
                          {testimonials[0].content} -{" "}
                          <em>{testimonials[0].client_details}</em>
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
            {section === "overview" && trip.box_images?.length > 0 && (
              <section className="section enjoyBox">
                <div className="container">
                  <div className="row">
                    <div className="col-xs-12 title">
                      <h2>You May Also Enjoy</h2>
                    </div>
                    {trip.box_images.map((box) => (
                      <div
                        className="col-md-3 col-sm-4 col-xs-12 gridCol"
                        key={box.id}
                      >
                        <div className="trip_type clearfix">
                          <a href={localAppLink(box.link) || box.link}>
                            <div className="trip_img">
                              <img
                                src={thumbnailAssetUrl(
                                  box.image_url || box.image,
                                  270,
                                  183,
                                )}
                                alt={box.image_alt || ""}
                              />
                            </div>
                            <div className="trip_info">
                              <h2>{box.title}</h2>
                            </div>
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}
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
