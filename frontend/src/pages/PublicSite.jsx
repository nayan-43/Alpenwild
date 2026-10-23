import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import PublicFooter from "@/components/public/PublicFooter";
import PublicFooterExtras from "@/components/public/PublicFooterExtras";
import PublicHeader from "@/components/public/PublicHeader";
import PublicLoader from "@/components/public/PublicLoader";
import { localAppLink, localAssetUrl, thumbnailAssetUrl } from "@/lib/assets";

function publicRoute(value) {
  if (!value) return null;
  const link = localAppLink(value);
  if (!link) return null;
  const path = new URL(link, window.location.origin).pathname;
  return /^(\/)?(trip|triptype|staticpage|tour-calendar|search|category|product|cart|checkout|shop)(\/|$)/i.test(
    path,
  )
    ? link
    : null;
}

function imageUrl(item, folder) {
  const source = localAssetUrl(
    item.image_url ||
      item.listing_thumbnail_url ||
      item.listing_image_url ||
      item.banner_image_url ||
      (item.image_filename ? `images/${folder}/${item.image_filename}` : ""),
  );
  if (folder === "banner") return thumbnailAssetUrl(source, 1170, 569);
  if (folder === "triptype/listing" && item.listing_thumbnail_url)
    return source;
  return thumbnailAssetUrl(source, 370, 183);
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

export default function PublicSite() {
  const [content, setContent] = useState({
    banners: [],
    tripTypes: [],
    specialFeatures: [],
    promotions: [],
    footerMenus: [],
    publicSettings: {},
  });
  const [activeBanner, setActiveBanner] = useState(0);
  // Bootstrap 3 slide state: { index, dir, running } mirrors `.next` / `.prev`
  const [slide, setSlide] = useState(null);
  const [carouselPaused, setCarouselPaused] = useState(false);
  const [bannerAction, setBannerAction] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Swiss Hiking | Alps Hiking | Switzerland Travel";
    return () => {
      document.title = "Alpenwild";
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all(
      [
        "banners",
        "trip-types",
        "special-features",
        "promotions",
        "footer-menus",
        "public-settings",
      ].map((endpoint) =>
        fetch(`/api/${endpoint}`).then((response) => response.json()),
      ),
    )
      .then(
        ([
          banners,
          tripTypes,
          specialFeatures,
          promotions,
          footerMenus,
          publicSettings,
        ]) => {
          if (cancelled) return;
          setContent({
            banners: Array.isArray(banners) ? shuffle(banners) : [],
            tripTypes: Array.isArray(tripTypes) ? tripTypes : [],
            specialFeatures: Array.isArray(specialFeatures)
              ? specialFeatures
              : [],
            promotions: Array.isArray(promotions) ? promotions : [],
            footerMenus: Array.isArray(footerMenus) ? footerMenus : [],
            publicSettings:
              publicSettings && typeof publicSettings === "object"
                ? publicSettings
                : {},
          });
        },
      )
      .catch(() => {
        if (!cancelled) setError("Unable to load homepage content.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const banners = content.banners.filter((item) => item.status === "Active");
  const tripTypes = content.tripTypes.filter(
    (item) => item.status === "Active" && item.display_under === "Yes",
  );
  const specialFeatures = content.specialFeatures.filter(
    (item) => item.status === "Active",
  );
  const promotions = content.promotions.filter(
    (item) => item.status === "Active",
  );

  const bannerIndexRef = useRef(0);
  const slideRef = useRef(false);
  useEffect(() => {
    bannerIndexRef.current = activeBanner;
  }, [activeBanner]);
  useEffect(() => {
    slideRef.current = Boolean(slide);
  }, [slide]);

  function goToSlide(index, dir) {
    if (!banners.length || slide || index === activeBanner) return;
    setBannerAction(null);
    setSlide({ index, dir, running: false });
  }

  useEffect(() => {
    if (activeBanner >= banners.length) setActiveBanner(0);
  }, [activeBanner, banners.length]);

  // Bootstrap 3 animates in two frames: the incoming item is rendered first as
  // `.next`/`.prev`, then moved to `.next.left`/`.prev.right` (the transform
  // transition is defined in public-legacy.css, copied from bootstrap.css).
  useEffect(() => {
    if (!slide || slide.running) return undefined;
    const frame = window.requestAnimationFrame(() =>
      setSlide((current) =>
        current ? { ...current, running: true } : current,
      ),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [slide]);

  useEffect(() => {
    if (!slide?.running) return undefined;
    const timer = window.setTimeout(() => {
      setActiveBanner(slide.index);
      setSlide(null);
    }, 620);
    return () => window.clearTimeout(timer);
  }, [slide]);

  // data-ride="carousel" -> 5000ms interval, paused while hovered/focused
  useEffect(() => {
    if (carouselPaused || banners.length < 2) return undefined;
    const timer = window.setInterval(() => {
      if (slideRef.current || !banners.length) return;
      setBannerAction(null);
      setSlide({
        index: (bannerIndexRef.current + 1) % banners.length,
        dir: "next",
        running: false,
      });
    }, 5000);
    return () => window.clearInterval(timer);
  }, [carouselPaused, banners.length]);

  // sitejs12.js `equalheight(".trip_type")`: every card in a row is stretched to
  // the height of the tallest card in that row (on load and on resize).
  useEffect(() => {
    let active = true;
    let frame;

    function equalize() {
      const items = Array.from(
        document.querySelectorAll(".legacy-home .trip_type"),
      );
      items.forEach((item) => {
        item.style.height = "auto";
      });
      let group = [];
      let rowTop = null;
      const flush = () => {
        if (group.length) {
          const tallest = Math.max(...group.map((item) => item.offsetHeight));
          group.forEach((item) => {
            item.style.height = `${tallest}px`;
          });
        }
        group = [];
      };
      items.forEach((item) => {
        if (rowTop !== null && item.offsetTop !== rowTop) flush();
        rowTop = item.offsetTop;
        group.push(item);
      });
      flush();
    }

    function scheduleEqualize() {
      if (!active) return;
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(equalize);
    }

    const images = Array.from(
      document.querySelectorAll(".legacy-home .trip_type img"),
    );
    images.forEach((image) => {
      image.addEventListener("load", scheduleEqualize);
      image.addEventListener("error", scheduleEqualize);
    });

    equalize();
    window.addEventListener("resize", scheduleEqualize);
    document.fonts?.ready.then(scheduleEqualize);
    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", scheduleEqualize);
      images.forEach((image) => {
        image.removeEventListener("load", scheduleEqualize);
        image.removeEventListener("error", scheduleEqualize);
      });
    };
  }, [content]);

  // Bootstrap 3 carousel classes: .active / .next / .prev (+ .left / .right)
  function carouselItemClass(index) {
    if (!slide) return index === activeBanner ? "item active" : "item";
    if (index === activeBanner) {
      if (!slide.running) return "item active";
      return `item active ${slide.dir === "next" ? "left" : "right"}`;
    }
    if (index === slide.index) {
      if (!slide.running)
        return slide.dir === "next" ? "item next" : "item prev";
      return slide.dir === "next" ? "item next left" : "item prev right";
    }
    return "item";
  }

  return (
    <div className="public-site legacy-home">
      <PublicHeader />
      {loading && <PublicLoader />}
      <main>
        {error && <div className="client-alert">{error}</div>}
        <section
          className="homepage_carousel"
          onMouseEnter={() => setCarouselPaused(true)}
          onMouseLeave={() => setCarouselPaused(false)}
          onFocus={() => setCarouselPaused(true)}
          onBlur={() => setCarouselPaused(false)}
        >
          <div className="container">
            <div id="carousel" className="carousel slide">
              <div className="carousel-inner">
                {banners.map((banner, index) => {
                  const route = publicRoute(banner.link);
                  const BannerLink = route ? Link : "a";
                  const linkProps = route
                    ? { to: route }
                    : { href: banner.link || "#" };
                  const buttonRoute = publicRoute(banner.button_link);
                  const ButtonLink = buttonRoute ? Link : "a";
                  const buttonProps = buttonRoute
                    ? { to: buttonRoute }
                    : { href: banner.button_link || "#" };
                  const isPhotoOpen = bannerAction === banner.id;
                  return (
                    <div
                      className={carouselItemClass(index)}
                      key={banner.id}
                      style={{
                        backgroundImage: `url(${imageUrl(banner, "banner")})`,
                      }}
                    >
                      <BannerLink {...linkProps}>
                        <img
                          src={imageUrl(banner, "banner")}
                          alt={banner.image_alt || banner.title || ""}
                        />
                        <div className="banner_txt">
                          <h1>{banner.title}</h1>
                          <p>{banner.subtitle || banner.sub_heading}</p>
                        </div>
                      </BannerLink>
                      <div
                        className={`banner_content ${isPhotoOpen ? "openit" : ""}`}
                      >
                        <p>{banner.tooltip_text}</p>
                      </div>
                      <i
                        className="fa fa-camera"
                        title="Photo Credit"
                        role="button"
                        tabIndex={0}
                        aria-label="Show photo credit"
                        onClick={() =>
                          setBannerAction(isPhotoOpen ? null : banner.id)
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setBannerAction(isPhotoOpen ? null : banner.id);
                          }
                        }}
                      />
                      {banner.button_label && banner.button_link && (
                        <ButtonLink className="learn_more_btn" {...buttonProps}>
                          {banner.button_label}
                        </ButtonLink>
                      )}
                    </div>
                  );
                })}
              </div>
              <a
                className="carousel-control left"
                href="#carousel"
                aria-label="Previous banner"
                onClick={(event) => {
                  event.preventDefault();
                  goToSlide(
                    (activeBanner - 1 + banners.length) % banners.length,
                    "prev",
                  );
                }}
              >
                <img src="/images/controls_prev.png" alt="Previous" />
              </a>
              <a
                className="carousel-control right"
                href="#carousel"
                aria-label="Next banner"
                onClick={(event) => {
                  event.preventDefault();
                  goToSlide((activeBanner + 1) % banners.length, "next");
                }}
              >
                <img src="/images/controls_next.png" alt="Next" />
              </a>
            </div>
          </div>
        </section>
        <section className="section gap_small">
          <div className="container">
            <div className="row">
              <div className="col-xs-12 title">
                <h2>Choose Your Trip Style</h2>
              </div>
              {tripTypes.map((item) => (
                <div
                  className="col-md-4 col-sm-4 col-xs-12 gridCol"
                  key={item.id}
                >
                  <div className="trip_type clearfix">
                    <Link to={`/triptype/${encodeURIComponent(item.slug)}/`}>
                      <div className="trip_img">
                        <img
                          src={imageUrl(item, "triptype/listing")}
                          alt={item.listing_image_alt || item.image_alt || ""}
                        />
                      </div>
                      <div className="trip_info">
                        <h2>{item.menu_name || item.name}</h2>
                        <p>{item.short_description}</p>
                      </div>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="section blue_bg gap_small">
          <div className="container">
            <div className="row">
              <div className="col-xs-12 title">
                <h2>Special Features</h2>
              </div>
              {specialFeatures.map((item) => {
                const route = publicRoute(item.link);
                const FeatureLink = route ? Link : "a";
                const linkProps = route
                  ? { to: route }
                  : { href: localAppLink(item.link) || item.link || "#" };
                return (
                  <div
                    className="col-md-4 col-sm-4 col-xs-12 gridCol"
                    key={item.id}
                  >
                    <div className="trip_type clearfix">
                      <FeatureLink
                        {...linkProps}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <div className="trip_img">
                          <img
                            src={imageUrl(item, "special_feature")}
                            alt={item.image_alt || ""}
                          />
                        </div>
                        <div className="trip_info">
                          <h2>{item.title}</h2>
                          <p>{item.text}</p>
                        </div>
                      </FeatureLink>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
        <section className="section gap_small">
          <div className="container">
            <div className="row">
              <div className="col-xs-12 title">
                <h2>Offers and Promotions</h2>
              </div>
              {promotions.map((item) => {
                const route = publicRoute(item.link);
                const PromotionLink = route ? Link : "a";
                const linkProps = route
                  ? { to: route }
                  : { href: localAppLink(item.link) || item.link || "#" };
                return (
                  <div
                    className="col-md-4 col-sm-4 col-xs-12 gridCol"
                    key={item.id}
                  >
                    <div className="trip_type clearfix">
                      <PromotionLink {...linkProps}>
                        <div className="trip_img">
                          <img
                            src={imageUrl(item, "offers_promotions")}
                            alt={item.image_alt || ""}
                          />
                        </div>
                        <div className="trip_info">
                          <h2>{item.title}</h2>
                          <p>{item.text}</p>
                        </div>
                      </PromotionLink>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>
      <PublicFooterExtras publicSettings={content.publicSettings} />
      <PublicFooter footerMenus={content.footerMenus} />
    </div>
  );
}
