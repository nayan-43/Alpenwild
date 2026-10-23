import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PublicFooter from "@/components/public/PublicFooter";
import PublicFooterExtras from "@/components/public/PublicFooterExtras";
import PublicHeader from "@/components/public/PublicHeader";
import PublicLoader from "@/components/public/PublicLoader";

export default function PublicNotFoundPage() {
  const [footerMenus, setFooterMenus] = useState([]);
  const [publicSettings, setPublicSettings] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    document.title = "Page Not Found | Alpenwild";
    Promise.all([
      fetch("/api/footer-menus").then((response) => response.json()),
      fetch("/api/public-settings").then((response) => response.json()),
    ])
      .then(([menus, settings]) => {
        if (!active) return;
        setFooterMenus(Array.isArray(menus) ? menus : []);
        setPublicSettings(settings || {});
      })
      .catch((error) => {
        if (active)
          setError(error.message || "Unable to load site footer content.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      document.title = "Alpenwild";
    };
  }, []);

  return (
    <div className="public-site">
      <PublicHeader />
      {loading && <PublicLoader />}
      <main>
        <section className="section">
          <div className="container">
            <div className="title clearfix">
              <h2>Page Not Found</h2>
            </div>
            {error && (
              <div className="client-alert" role="alert">
                {error}
              </div>
            )}
            <div className="clearfix">
              <p>
                Sorry, the page you are looking for could not be found. It may
                have moved or the address may be incorrect.
              </p>
              <Link className="button-type" to="/">
                Go to Home
              </Link>
            </div>
          </div>
        </section>
      </main>
      <PublicFooterExtras publicSettings={publicSettings} />
      <PublicFooter footerMenus={footerMenus} />
    </div>
  );
}
