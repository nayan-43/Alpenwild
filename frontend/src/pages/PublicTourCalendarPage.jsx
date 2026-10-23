import React, { useEffect, useState } from "react";
import PublicFooter from "@/components/public/PublicFooter";
import PublicFooterExtras from "@/components/public/PublicFooterExtras";
import PublicHeader from "@/components/public/PublicHeader";
import PublicLoader from "@/components/public/PublicLoader";
import { localizeRichContent } from "@/lib/assets";

export default function PublicTourCalendarPage() {
  const [page, setPage] = useState(null);
  const [footerMenus, setFooterMenus] = useState([]);
  const [publicSettings, setPublicSettings] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title =
      "Tour Calendar | Alps Tours | Swiss Hiking | Switzerland Tour";
    return () => {
      document.title = "Alpenwild";
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch("/api/public-static-pages/tour-calendar").then((response) => {
        if (!response.ok) throw new Error("Unable to load the tour calendar.");
        return response.json();
      }),
      fetch("/api/footer-menus").then((response) => response.json()),
      fetch("/api/public-settings").then((response) => response.json()),
    ])
      .then(([pageData, footerData, settingsData]) => {
        if (cancelled) return;
        setPage(pageData && typeof pageData === "object" ? pageData : null);
        setFooterMenus(Array.isArray(footerData) ? footerData : []);
        setPublicSettings(
          settingsData && typeof settingsData === "object" ? settingsData : {},
        );
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

  // const bannerSource =
  //   page?.banner_image_url ||
  //   (page?.banner_image
  //     : "");

  return (
    <div className="public-site">
      <PublicHeader />
      {loading && <PublicLoader />}
      <main className="client-static-page client-tour-calendar-page">
        {/* {bannerSource && (
          <section className="client-static-banner">
            <img src={bannerSource} alt={page?.banner_title || page?.name} />
            {(page?.banner_title || page?.banner_sub_title) && (
              <div className="client-static-banner-copy">
                <h1>{page.banner_title || page.name}</h1>
                <p>{page.banner_sub_title}</p>
              </div>
            )}
          </section>
        )} */}
        <div className="client-container client-static-content">
          <h1>{page?.name || "Tour Calendar"}</h1>
          {error && <div className="client-alert">{error}</div>}
          {!error && page?.description && (
            <div
              className="client-static-description"
              dangerouslySetInnerHTML={{
                __html: localizeRichContent(page.description),
              }}
            />
          )}
        </div>
      </main>
      <PublicFooterExtras publicSettings={publicSettings} />
      <PublicFooter footerMenus={footerMenus} />
    </div>
  );
}
