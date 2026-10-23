import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PublicFooter from "@/components/public/PublicFooter";
import PublicFooterExtras from "@/components/public/PublicFooterExtras";
import PublicHeader from "@/components/public/PublicHeader";
import PublicLoader from "@/components/public/PublicLoader";
import { thumbnailAssetUrl } from "@/lib/assets";

function LeaderCard({ leader }) {
  return (
    <article className="client-trip-leader-card">
      <Link to={`/tripleader/${leader.slug}`}>
        <div className="client-trip-leader-image">
          {leader.listing_image_url && (
            <img
              src={thumbnailAssetUrl(leader.listing_image_url, 270, 183, 2)}
              alt={leader.name}
            />
          )}
        </div>
        <div className="client-trip-leader-info">
          <h2>{leader.name}</h2>
          <p>{leader.short_descriptions} ...</p>
          <span className="client-button">Read More</span>
        </div>
      </Link>
    </article>
  );
}

export default function PublicTripLeaderListingPage() {
  const [leaders, setLeaders] = useState([]);
  const [footerMenus, setFooterMenus] = useState([]);
  const [publicSettings, setPublicSettings] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

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
      fetch("/api/footer-menus").then((response) => response.json()),
      fetch("/api/public-settings").then((response) => response.json()),
    ])
      .then(([leaderData, footerData, settingsData]) => {
        if (cancelled) return;
        setLeaders(Array.isArray(leaderData) ? leaderData : []);
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

  return (
    <div className="public-site">
      <PublicHeader />
      {loading && <PublicLoader />}
      <main className="client-static-page client-trip-leader-page">
        <div className="client-container client-static-content">
          <h1>Guides and Trip Leaders</h1>
          {error && <div className="client-alert">{error}</div>}
          <div className="client-trip-leader-grid">
            {guides.map((leader) => (
              <LeaderCard leader={leader} key={leader.id} />
            ))}
          </div>
          <h2 className="client-trip-leader-heading">Alpenwild Office Staff</h2>
          <div className="client-trip-leader-grid">
            {officeStaff.map((leader) => (
              <LeaderCard leader={leader} key={leader.id} />
            ))}
          </div>
        </div>
      </main>
      <PublicFooterExtras publicSettings={publicSettings} />
      <PublicFooter footerMenus={footerMenus} />
    </div>
  );
}
