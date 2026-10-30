import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import PublicFooter from "@/components/public/PublicFooter";
import PublicFooterExtras from "@/components/public/PublicFooterExtras";
import PublicHeader from "@/components/public/PublicHeader";
import PublicLoader from "@/components/public/PublicLoader";
import {
  localAppLink,
  localizeRichContent,
  thumbnailAssetUrl,
} from "@/lib/assets";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function readJson(response, fallback = null) {
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.includes("application/json")) {
    return fallback;
  }
  return response.json();
}

function legacyBlogUrl(value, path) {
  const original = String(value || "").trim();
  if (!original || !path) return original;
  const prefixes = {
    Alpshiking: "https://alpshiking.swisshikingvacations.com/",
    Switzerlandtravel: "https://switzerlandtravel.swisshikingvacations.com/",
    myswisskitchen: "https://myswisskitchen.swisshikingvacations.com/",
  };
  const legacyPrefix = `https://www.alpenwild.com/${path}/`;
  return original.startsWith(legacyPrefix)
    ? `${prefixes[path]}${original.slice(legacyPrefix.length)}`
    : original;
}

function TripLeaderPostSlider({ posts }) {
  const trackRef = useRef(null);
  const [visibleCount, setVisibleCount] = useState(4);
  const [index, setIndex] = useState(posts.length);
  const [transitionEnabled, setTransitionEnabled] = useState(true);

  useEffect(() => {
    const updateVisibleCount = () => {
      const width = window.innerWidth;
      setVisibleCount(
        width <= 480 ? 1 : width <= 767 ? 2 : width <= 991 ? 3 : 4,
      );
    };
    updateVisibleCount();
    window.addEventListener("resize", updateVisibleCount);
    return () => window.removeEventListener("resize", updateVisibleCount);
  }, []);

  useEffect(() => {
    setTransitionEnabled(false);
    setIndex(posts.length);
    const frame = window.requestAnimationFrame(() => {
      setTransitionEnabled(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [posts, visibleCount]);

  useEffect(() => {
    const equalize = () => {
      const cards = Array.from(
        trackRef.current?.querySelectorAll(".trip_type") || [],
      );
      cards.forEach((card) => {
        card.style.height = "auto";
      });
      if (window.innerWidth <= 767) return;
      for (let start = 0; start < cards.length; start += visibleCount) {
        const row = cards.slice(start, start + visibleCount);
        const height = Math.max(...row.map((card) => card.offsetHeight), 0);
        row.forEach((card) => {
          card.style.height = `${height}px`;
        });
      }
    };
    const frame = window.requestAnimationFrame(equalize);
    window.addEventListener("resize", equalize);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", equalize);
    };
  }, [posts, visibleCount, index]);

  if (!posts.length) return <div className="slider_hiking" />;

  const repeatedPosts = [...posts, ...posts, ...posts];
  const slideWidth = `${100 / repeatedPosts.length}%`;

  const move = (direction) => {
    setTransitionEnabled(true);
    setIndex((current) => current + direction);
  };

  const handleTransitionEnd = () => {
    const resetPosition = (nextIndex) => {
      setTransitionEnabled(false);
      setIndex(nextIndex);
      window.requestAnimationFrame(() => {
        const track = trackRef.current?.querySelector(".slick-track");
        track?.getBoundingClientRect();
        window.requestAnimationFrame(() => setTransitionEnabled(true));
      });
    };

    if (index >= posts.length * 2) {
      resetPosition(posts.length);
    } else if (index < posts.length) {
      resetPosition(posts.length * 2 - 1);
    }
  };

  return (
    <div
      className="slider_hiking slick-slider slick-initialized"
      ref={trackRef}
    >
      <button
        className="slick-prev slick-arrow"
        type="button"
        onClick={() => move(-1)}
        aria-label="Previous posts"
      />
      <div className="slick-list">
        <div
          className="slick-track"
          style={{
            display: "flex",
            width: `${(repeatedPosts.length * 100) / visibleCount}%`,
            transform: `translate3d(-${
              index * (100 / repeatedPosts.length)
            }%, 0, 0)`,
            transition: transitionEnabled ? "transform 300ms ease" : "none",
          }}
          onTransitionEnd={handleTransitionEnd}
        >
          {repeatedPosts.map((post, repeatedIndex) => (
            <div
              className="slick-slide col-md-3 col-sm-4 col-xs-12"
              key={`${post.id}-${repeatedIndex}`}
              style={{ flex: `0 0 ${slideWidth}`, maxWidth: slideWidth }}
            >
              <div className="trip_type clearfix">
                <a
                  href={
                    post.url ||
                    legacyBlogUrl(post.guid, post.path) ||
                    post.guid ||
                    "#"
                  }
                >
                  <div className="trip_img">
                    <img
                      src={
                        post.image_url
                          ? post.image_url
                          : thumbnailAssetUrl(
                              "/uploads/welcome.jpg",
                              270,
                              183,
                              1,
                            )
                      }
                      width="270"
                      height="183"
                      alt=""
                    />
                  </div>
                  <div className="trip_info">
                    <h2>{post.title}</h2>
                    <p style={{ fontSize: "11px", textAlign: "center" }}>
                      {post.author_details}
                      <br />
                      {post.post_date
                        ? new Date(post.post_date).toLocaleDateString()
                        : ""}
                    </p>
                  </div>
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
      <button
        className="slick-next slick-arrow"
        type="button"
        onClick={() => move(1)}
        aria-label="Next posts"
      />
    </div>
  );
}

export default function PublicTripLeaderPage() {
  const { slug } = useParams();
  const [leader, setLeader] = useState(null);
  const [staticPage, setStaticPage] = useState(null);
  const [posts, setPosts] = useState({});
  const [footerMenus, setFooterMenus] = useState([]);
  const [publicSettings, setPublicSettings] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title =
      leader?.meta_title || `${leader?.name || "Trip Leader"} | Alpenwild`;
    return () => {
      document.title = "Alpenwild";
    };
  }, [leader]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([
      fetch(`/api/public-trip-leaders/${encodeURIComponent(slug)}`).then(
        (response) =>
          readJson(response).then((data) => {
            if (!data) throw new Error("Unable to load this trip leader.");
            return data;
          }),
      ),
      fetch("/api/public-static-pages/guides-and-trip-leaders").then(
        (response) => readJson(response),
      ),
      fetch(`/api/public-trip-leaders/${encodeURIComponent(slug)}/posts`).then(
        (response) => readJson(response, {}),
      ),
      fetch("/api/footer-menus").then((response) => readJson(response, [])),
      fetch("/api/public-settings").then((response) => readJson(response, {})),
    ])
      .then(([leaderData, pageData, postData, footerData, settingsData]) => {
        if (cancelled) return;
        setLeader(leaderData);
        setStaticPage(pageData);
        setPosts(postData || {});
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
  }, [slug]);

  const descriptionMarkup = useMemo(() => {
    const description = localizeRichContent(leader?.description || "").replace(
      /<img([^>]*?)src="([^"]*top\.png)"([^>]*)>/i,
      '<img$1class="topImg"$2$3>',
    );
    const blocks = (leader?.description_blocks || [])
      .map((block) => {
        const align = ["left", "right", "center"].includes(block.image_align)
          ? block.image_align
          : "left";
        const imageStyle =
          align === "center"
            ? "float:center; display:block; margin:10px auto;"
            : `float:${align}; margin:10px 20px;`;
        const image = block.image_url
          ? `<img style="${imageStyle}" src="${thumbnailAssetUrl(
              block.image_url,
              Number(block.image_width),
              Number(block.image_height),
              0,
              100,
            )}" alt="${escapeHtml(block.image_alt)}" title="${escapeHtml(
              block.image_alt,
            )}">`
          : "";
        const imageClass = `${align}-img entryImg${
          block.caption ? " captionWrap" : ""
        }`;
        const text = localizeRichContent(block.text || "");
        const caption = localizeRichContent(block.caption || "");
        return image
          ? `<div class="row img-align">${
              block.text_wrap === "no"
                ? align === "center"
                  ? `<div class="col-md-12 col-xs-12 col-sm-12 text-center"><div class="${imageClass}">${image}<div class="caption">${caption}</div></div></div><div class="col-md-12">${text}</div>`
                  : `<div class="col-md-4 col-sm-6 col-xs-12 ${align === "right" ? "pull-right" : "pull-center"}"><div class="${imageClass}">${image}<div class="caption">${caption}</div></div></div><div class="col-md-8 col-sm-6 col-xs-12">${text}</div>`
                : `<div class="col-md-12 col-xs-12 col-sm-12"><div class="${imageClass}">${image}<div class="caption">${caption}</div></div>${text}</div>`
            }</div>`
          : `<div class="row"><div class="col-md-12 col-xs-12 col-sm-12">${text}</div></div>`;
      })
      .join("");
    return `${description}${blocks}`;
  }, [leader]);

  return (
    <div className="public-site">
      <PublicHeader />
      {loading && <PublicLoader />}
      <div className="section static_page">
        <div className="container">
          <div className="row">
            <div className="col-xs-12 title">
              <h1>{leader?.name || "Trip Leader"}</h1>
            </div>
            <div
              className="col-md-12 col-sm-12 col-xs-12 client-static-description"
              dangerouslySetInnerHTML={{
                __html: `${error ? `<p>${error}</p>` : ""}${descriptionMarkup}`,
              }}
            />
            {[
              [
                "alpsHiking",
                leader?.alps_hiking_author,
                leader?.guide_name
                  ? `Posts By ${leader.guide_name} From Alps Hiking`
                  : "Recent Posts From Alps Hiking",
              ],
              [
                "switzerlandTravel",
                leader?.switzerlandtravel_author,
                leader?.guide_name
                  ? `Posts By ${leader.guide_name} From Switzerland Travel`
                  : "Recent Posts From Switzerland Travel",
              ],
              [
                "mySwissKitchen",
                leader?.myswisskitchennew_author,
                leader?.guide_name
                  ? `Posts By ${leader.guide_name} From Swiss Food`
                  : "Recent Posts From Swiss Food",
              ],
            ].map(([source, author, title]) => (
              <div className="col-md-12 col-sm-12 col-xs-12" key={title}>
                <div className="section enjoyBox">
                  <div className="container">
                    <div className="clearfix">
                      <div className="col-xs-12 title">
                        <h2>
                          {author && Number(author) !== 0
                            ? title
                            : title.replace(
                                /^Posts By.*? From /,
                                "Recent Posts From ",
                              )}
                        </h2>
                      </div>
                      <TripLeaderPostSlider posts={posts[source] || []} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {staticPage?.box_images?.length > 0 && (
        <div className="section enjoyBox">
          <div className="container">
            <div className="clearfix">
              <div className="col-xs-12 title">
                <h2>You May Also Enjoy</h2>
              </div>
              {staticPage.box_images.map((box) => {
                const link = localAppLink(box.link) || box.link || "#";
                return (
                  <div
                    className="col-md-3 col-sm-4 col-xs-12 gridCol"
                    key={box.id}
                  >
                    <div className="trip_type clearfix">
                      <a href={link}>
                        <div className="trip_img">
                          {box.image_url && (
                            <img
                              src={thumbnailAssetUrl(
                                box.image_url,
                                270,
                                183,
                                1,
                              )}
                              alt={box.image_alt || ""}
                              onError={(event) => {
                                if (event.currentTarget.src !== box.image_url) {
                                  event.currentTarget.src = box.image_url;
                                }
                              }}
                            />
                          )}
                        </div>
                        <div className="trip_info">
                          <h2>{box.title}</h2>
                        </div>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      <PublicFooterExtras publicSettings={publicSettings} />
      <PublicFooter footerMenus={footerMenus} />
    </div>
  );
}
