import React, { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import PublicFooter from "@/components/public/PublicFooter";
import PublicFooterExtras from "@/components/public/PublicFooterExtras";
import PublicHeader from "@/components/public/PublicHeader";
import PublicLoader from "@/components/public/PublicLoader";
import {
  localAppLink,
  localizeRichContent,
  thumbnailAssetUrl,
} from "@/lib/assets";

export default function PublicCategoryPage() {
  const { slug } = useParams();
  const [category, setCategory] = useState(null);
  const [footerMenus, setFooterMenus] = useState([]);
  const [publicSettings, setPublicSettings] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const categoryContentRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([
      fetch(`/api/public-categories/${encodeURIComponent(slug)}`).then(
        (response) => {
          if (!response.ok) throw new Error("Unable to load this category.");
          return response.json();
        },
      ),
      fetch("/api/footer-menus").then((response) => response.json()),
      fetch("/api/public-settings").then((response) => response.json()),
    ])
      .then(([categoryData, footerData, settingsData]) => {
        if (cancelled) return;
        setCategory(categoryData);
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

  useEffect(() => {
    document.title =
      category?.meta_title || `${category?.name || "Category"} | Alpenwild`;
  }, [category]);

  useEffect(() => {
    const equalizeCards = () => {
      [".trip_type", ".mHeight"].forEach((selector) => {
        const cards = Array.from(
          categoryContentRef.current?.querySelectorAll(selector) || [],
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
      });
    };

    equalizeCards();
    window.addEventListener("resize", equalizeCards);
    window.addEventListener("load", equalizeCards);
    const images = Array.from(
      categoryContentRef.current?.querySelectorAll("img") || [],
    );
    images.forEach((image) => {
      image.addEventListener("load", equalizeCards);
    });

    return () => {
      window.removeEventListener("resize", equalizeCards);
      window.removeEventListener("load", equalizeCards);
      images.forEach((image) => {
        image.removeEventListener("load", equalizeCards);
      });
    };
  }, [category]);

  return (
    <div className="public-site">
      <PublicHeader />
      {loading && <PublicLoader />}
      <main
        className={`client-static-page client-category-page client-category-${slug}`}
      >
        <div ref={categoryContentRef}>
          <section className="section">
            <div className="container">
              <div className="row">
                <div className="col-xs-12 title">
                  <h1>{category?.name || "Category"}</h1>
                </div>
                {error && (
                  <div className="col-md-12 col-sm-12 col-xs-12">
                    <div className="client-alert">{error}</div>
                  </div>
                )}
                {category?.description && (
                  <div className="col-md-12 col-sm-12 col-xs-12">
                    <div
                      className="client-static-description"
                      dangerouslySetInnerHTML={{
                        __html: localizeRichContent(category.description),
                      }}
                    />
                  </div>
                )}
              </div>
              {category && (
                <div className="row clearfix">
                  {(category.products || []).map((product) => (
                    <div
                      className="col-md-3 col-sm-4 col-xs-12"
                      key={product.id}
                    >
                      <div className="prdctBox mHeight">
                        <figure className="prdctImg">
                          {product.listing_image_url && (
                            <img
                              src={thumbnailAssetUrl(
                                product.listing_image_url,
                                270,
                                183,
                              )}
                              alt={
                                product.listing_image_alt || product.name || ""
                              }
                            />
                          )}
                        </figure>
                        <div className="prdctDetails">
                          <h2 className="prdctTitle">{product.name}</h2>
                          <p>{product.short_descriptions}</p>
                          <h4 className="prdctPrice">
                            Price ${Number(product.price || 0).toFixed(2)}
                          </h4>
                          <Link
                            className="btn btn-default"
                            to={`/product/${encodeURIComponent(product.slug)}`}
                          >
                            Details
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!category.products?.length && (
                    <div className="col-md-12 col-sm-12 col-xs-12">
                      <div className="prdctBox mHeight">
                        <div className="prdctDetails">
                          <h2 className="prdctTitle">
                            Sorry, no products found under this category.
                          </h2>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
          {category?.box_images?.length > 0 && (
            <section className="section">
              <div className="container">
                <div className="row">
                  <div className="col-xs-12 title">
                    <h2>You May Also Enjoy</h2>
                  </div>
                  {category.box_images.map((box) => {
                    const link = localAppLink(box.link) || box.link || "#";
                    const CardLink = link.startsWith("/") ? Link : "a";
                    const linkProps =
                      CardLink === Link ? { to: link } : { href: link };
                    return (
                      <div
                        className="col-md-3 col-sm-4 col-xs-12 gridCol"
                        key={box.id}
                      >
                        <div className="trip_type clearfix">
                          <CardLink {...linkProps}>
                            <div className="trip_img">
                              {box.image_url && (
                                <img
                                  src={thumbnailAssetUrl(
                                    box.image_url,
                                    270,
                                    183,
                                  )}
                                  alt={box.image_alt || ""}
                                />
                              )}
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
            </section>
          )}
        </div>
      </main>
      <PublicFooterExtras publicSettings={publicSettings} />
      <PublicFooter footerMenus={footerMenus} />
    </div>
  );
}
