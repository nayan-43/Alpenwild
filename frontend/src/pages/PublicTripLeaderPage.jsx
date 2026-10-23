import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import PublicFooter from "@/components/public/PublicFooter";
import PublicFooterExtras from "@/components/public/PublicFooterExtras";
import PublicHeader from "@/components/public/PublicHeader";
import PublicLoader from "@/components/public/PublicLoader";
import { localizeRichContent, thumbnailAssetUrl } from "@/lib/assets";

export default function PublicTripLeaderPage() {
  const { slug } = useParams();
  const [leader, setLeader] = useState(null);
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
        (response) => {
          if (!response.ok) throw new Error("Unable to load this trip leader.");
          return response.json();
        },
      ),
      fetch("/api/footer-menus").then((response) => response.json()),
      fetch("/api/public-settings").then((response) => response.json()),
    ])
      .then(([leaderData, footerData, settingsData]) => {
        if (cancelled) return;
        setLeader(leaderData);
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

  return (
    <div className="public-site">
      <PublicHeader />
      {loading && <PublicLoader />}
      <main className="client-static-page client-trip-leader-detail-page">
        <div className="client-container client-static-content">
          <h1>{leader?.name || "Trip Leader"}</h1>
          {error && <div className="client-alert">{error}</div>}
          {leader?.description && (
            <div
              className="client-static-description"
              dangerouslySetInnerHTML={{
                __html: localizeRichContent(leader.description),
              }}
            />
          )}
          {leader?.description_blocks?.map((block) => (
            <section
              className="client-trip-leader-description-block"
              key={block.id}
            >
              {block.image_url && (
                <img
                  src={thumbnailAssetUrl(
                    block.image_url,
                    Number(block.image_width),
                    Number(block.image_height),
                    0,
                    100,
                  )}
                  alt={block.description_image_alt || ""}
                />
              )}
              <div
                dangerouslySetInnerHTML={{
                  __html: localizeRichContent(block.text),
                }}
              />
            </section>
          ))}
          {[
            [
              leader?.alps_hiking_author,
              leader?.guide_name
                ? `Posts By ${leader.guide_name} From Alps Hiking`
                : "Recent Posts From Alps Hiking",
            ],
            [
              leader?.switzerlandtravel_author,
              leader?.guide_name
                ? `Posts By ${leader.guide_name} From Switzerland Travel`
                : "Recent Posts From Switzerland Travel",
            ],
            [
              leader?.myswisskitchennew_author,
              leader?.guide_name
                ? `Posts By ${leader.guide_name} From Swiss Food`
                : "Recent Posts From Swiss Food",
            ],
          ].map(([author, title]) => (
            <section className="client-trip-leader-posts" key={title}>
              <h2>
                {author && Number(author) !== 0
                  ? title
                  : title.replace(/^Posts By.*? From /, "Recent Posts From ")}
              </h2>
              <p className="client-trip-leader-posts-empty">
                Recent posts will appear here.
              </p>
            </section>
          ))}
        </div>
      </main>
      <PublicFooterExtras publicSettings={publicSettings} />
      <PublicFooter footerMenus={footerMenus} />
    </div>
  );
}
