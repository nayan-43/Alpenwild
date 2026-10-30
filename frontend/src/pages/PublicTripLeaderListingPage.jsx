import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import PublicFooter from "@/components/public/PublicFooter";
import PublicFooterExtras from "@/components/public/PublicFooterExtras";
import PublicHeader from "@/components/public/PublicHeader";
import PublicLoader from "@/components/public/PublicLoader";
import { localAssetUrl, thumbnailAssetUrl } from "@/lib/assets";

function LeaderCard({ leader }) {
  const link = `/tripleader/${encodeURIComponent(leader.slug)}`;
  return (
    <div className="col-md-3 col-sm-4 col-xs-6 types gridCol">
      <div
        className={`trip_type clearfix ${
          leader.type === "Guides" ? "tripleaderguide" : "tripleaderofficestaff"
        }`}
      >
        <Link to={link} target="_blank" rel="noreferrer">
          <div className="trip_img">
            {leader.listing_image_url && (
              <img
                className="trip-leader-listing-image"
                src={localAssetUrl(leader.listing_image_url)}
                alt={leader.name}
              />
            )}
          </div>
          <div className="trip_info">
            <h2>{leader.name}</h2>
            <p>{leader.short_descriptions} ...</p>
            <p>
              <button className="btn btn-default" type="button">
                Read More
              </button>
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}

export default function PublicTripLeaderListingPage() {
  const [leaders, setLeaders] = useState([]);
  const [footerMenus, setFooterMenus] = useState([]);
  const [publicSettings, setPublicSettings] = useState({});
  const [staticPage, setStaticPage] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const contentRef = useRef(null);
  const enjoyRef = useRef(null);

  useEffect(() => {
    document.title = "Guides and Trip Leaders | Alpenwild";
    return () => {
      document.title = "Alpenwild";
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch("/api/public-trip-leaders").then((response) => {
        if (!response.ok) throw new Error("Unable to load trip leaders.");
        return response.json();
      }),
      fetch("/api/public-static-pages/guides-and-trip-leaders").then(
        (response) => (response.ok ? response.json() : null),
      ),
      fetch("/api/footer-menus").then((response) => response.json()),
      fetch("/api/public-settings").then((response) => response.json()),
    ])
      .then(([leaderData, pageData, footerData, settingsData]) => {
        if (cancelled) return;
        setLeaders(Array.isArray(leaderData) ? leaderData : []);
        setStaticPage(pageData);
        setFooterMenus(Array.isArray(footerData) ? footerData : []);
        setPublicSettings(settingsData || {});
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
  }, []);

  const guides = useMemo(
    () => leaders.filter((leader) => leader.type === "Guides"),
    [leaders],
  );
  const officeStaff = useMemo(
    () => leaders.filter((leader) => leader.type === "Office Staff"),
    [leaders],
  );

  useEffect(() => {
    let frameId = 0;

    const equalize = () => {
      const shouldEqualize = window.innerWidth > 767;
      [
        [contentRef.current, [".tripleaderguide", ".tripleaderofficestaff"]],
        [enjoyRef.current, [".tripleaderbox"]],
      ].forEach(([root, selectors]) => {
        selectors.forEach((selector) => {
          const cards = Array.from(root?.querySelectorAll(selector) || []);
          cards.forEach((card) => {
            card.style.height = "auto";
          });
          if (!shouldEqualize) return;
          const rows = new Map();
          cards.forEach((card) => {
            const row = card.offsetTop;
            const rowCards = rows.get(row) || [];
            rowCards.push(card);
            rows.set(row, rowCards);
          });
          rows.forEach((rowCards) => {
            const height = Math.max(
              ...rowCards.map((card) => card.offsetHeight),
            );
            rowCards.forEach((card) => {
              card.style.height = `${Math.ceil(height)}px`;
            });
          });
        });
      });
    };

    const scheduleEqualize = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(equalize);
    };

    scheduleEqualize();
    window.addEventListener("load", scheduleEqualize);
    window.addEventListener("resize", scheduleEqualize);
    const images = [
      ...Array.from(contentRef.current?.querySelectorAll("img") || []),
      ...Array.from(enjoyRef.current?.querySelectorAll("img") || []),
    ];
    images.forEach((image) => image.addEventListener("load", scheduleEqualize));
    const observer = new ResizeObserver(scheduleEqualize);
    if (contentRef.current) observer.observe(contentRef.current);
    if (enjoyRef.current) observer.observe(enjoyRef.current);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("load", scheduleEqualize);
      window.removeEventListener("resize", scheduleEqualize);
      images.forEach((image) =>
        image.removeEventListener("load", scheduleEqualize),
      );
      observer.disconnect();
    };
  }, [guides, officeStaff, staticPage?.box_images]);

  return (
    <div className="public-site">
      <PublicHeader />
      {loading && <PublicLoader />}
      <main className="client-static-page client-trip-leader-page">
        <div className="section">
          <div className="container" ref={contentRef}>
            <div className="row">
              <div className="col-xs-12 title">
                <h1>{staticPage?.name || "Guides and Trip Leaders"}</h1>
              </div>
              {staticPage?.social_sharing_display === "Yes" && (
                <div
                  className="col-md-12 clearfix"
                  style={{ margin: "0 0 20px" }}
                >
                  <div
                    className="main-share-div clearfix"
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
              )}
              {error && <div className="client-alert">{error}</div>}
              {guides.map((leader) => (
                <LeaderCard leader={leader} key={leader.id} />
              ))}
              <div className="col-xs-12 title">
                <h2>Alpenwild Office Staff</h2>
              </div>
              {officeStaff.map((leader) => (
                <LeaderCard leader={leader} key={leader.id} />
              ))}
            </div>
          </div>
        </div>
      </main>
      {staticPage?.box_images?.length > 0 && (
        <section className="section enjoyBox" ref={enjoyRef}>
          <div className="container">
            <div className="clearfix">
              <div className="col-xs-12 title">
                <h2>You May Also Enjoy</h2>
              </div>
              {staticPage.box_images.map((box) => (
                <div
                  className="col-md-3 col-sm-4 col-xs-12 gridCol"
                  key={box.id}
                >
                  <div className="trip_type clearfix tripleaderbox">
                    <a href={box.link || "#"}>
                      <div className="trip_img">
                        {box.image_url && (
                          <img
                            src={thumbnailAssetUrl(box.image_url, 270, 183, 1)}
                            alt={box.image_alt || ""}
                          />
                        )}
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
      <PublicFooterExtras publicSettings={publicSettings} />
      <PublicFooter footerMenus={footerMenus} />
    </div>
  );
}
