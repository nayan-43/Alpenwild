import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PublicFooter from "@/components/public/PublicFooter";
import PublicFooterExtras from "@/components/public/PublicFooterExtras";
import PublicHeader from "@/components/public/PublicHeader";
import PublicLoader from "@/components/public/PublicLoader";
import {
  localAppLink,
  localizeRichContent,
  thumbnailAssetUrl,
} from "@/lib/assets";
import { readShopCart, writeShopCart } from "@/lib/shopCart";

export default function PublicProductPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [footerMenus, setFooterMenus] = useState([]);
  const [publicSettings, setPublicSettings] = useState({});
  const [selected, setSelected] = useState({});
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState("");
  const [thumbnailStart, setThumbnailStart] = useState(0);
  const [thumbnailCount, setThumbnailCount] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const galleryColumn = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch(`/api/public-products/${encodeURIComponent(slug)}`).then(
        async (response) => {
          const result = await response.json().catch(() => ({}));
          if (!response.ok)
            throw new Error(result.message || "Unable to load this product.");
          return result;
        },
      ),
      fetch("/api/footer-menus").then((response) => response.json()),
      fetch("/api/public-settings").then((response) => response.json()),
    ])
      .then(([productData, footerData, settingsData]) => {
        if (cancelled) return;
        setProduct(productData);
        setActiveImage(productData.listing_image_url || "");
        setSelected(
          Object.fromEntries(
            (productData.attribute_types || []).map((type) => [
              type.id,
              String(type.values[0]?.id || ""),
            ]),
          ),
        );
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
    if (product)
      document.title = product.meta_title || `${product.name} | Alpenwild`;
  }, [product]);

  const gallery = useMemo(
    () =>
      [
        product?.listing_image_url
          ? {
              image_url: product.listing_image_url,
              image_alt: product.listing_image_alt || product.name,
            }
          : null,
        ...(product?.additional_images || []).map((image) => ({
          image_url: image.image_url,
          image_alt: product.name,
        })),
      ].filter(Boolean),
    [product],
  );
  const activeImageIndex = Math.max(
    0,
    gallery.findIndex((image) => image.image_url === activeImage),
  );
  const activeGalleryImage = gallery[activeImageIndex];
  const maxThumbnailStart = Math.max(0, gallery.length - thumbnailCount);

  useEffect(() => {
    const column = galleryColumn.current;
    if (!column) return undefined;

    const updateVisibleThumbnails = () => {
      setThumbnailCount(
        Math.max(1, Math.min(10, Math.floor(column.clientWidth / 96))),
      );
    };
    updateVisibleThumbnails();
    const observer = new ResizeObserver(updateVisibleThumbnails);
    observer.observe(column);
    return () => observer.disconnect();
  }, [gallery.length]);

  useEffect(() => {
    setThumbnailStart((start) =>
      Math.min(start, Math.max(0, gallery.length - thumbnailCount)),
    );
  }, [gallery.length, thumbnailCount]);

  function showGalleryImage(index) {
    setActiveImage(gallery[index]?.image_url || "");
    setThumbnailStart((start) =>
      Math.min(
        Math.max(0, index - thumbnailCount + 1),
        Math.max(0, gallery.length - thumbnailCount),
      ),
    );
  }

  function moveThumbnails(direction) {
    setThumbnailStart((start) => {
      const next = start + direction;
      if (next < 0) return maxThumbnailStart;
      if (next > maxThumbnailStart) return 0;
      return next;
    });
  }

  function addToCart(event) {
    event.preventDefault();
    if (!product) return;
    const attributes = (product.attribute_types || []).map((type) => ({
      type_id: Number(type.id),
      value_id: Number(selected[type.id]),
      type_name: type.name,
      value_name:
        type.values.find((value) => String(value.id) === selected[type.id])
          ?.value || "",
    }));
    if (attributes.some((item) => !item.value_id)) {
      setError("Please choose an option for each product attribute.");
      return;
    }
    const item = {
      product_id: Number(product.id),
      slug: product.slug,
      name: product.name,
      image: product.listing_image_url,
      price: Number(product.price),
      quantity: Math.max(1, Math.min(100, Number(quantity) || 1)),
      attributes,
    };
    const cart = readShopCart();
    const key = JSON.stringify([
      item.product_id,
      ...attributes.map((attribute) => [attribute.type_id, attribute.value_id]),
    ]);
    const existing = cart.findIndex(
      (row) =>
        JSON.stringify([
          row.product_id,
          ...(row.attributes || []).map((attribute) => [
            attribute.type_id,
            attribute.value_id,
          ]),
        ]) === key,
    );
    if (existing >= 0)
      cart[existing] = {
        ...cart[existing],
        quantity: Math.min(100, cart[existing].quantity + item.quantity),
      };
    else cart.push(item);
    writeShopCart(cart);
    setError("");
    navigate("/cart");
  }

  return (
    <div className="public-site">
      <PublicHeader />
      {loading && <PublicLoader />}
      {product?.banner_image_url && (
        <div className="banner">
          <div className="container">
            <div
              className="inner_banner"
              style={{
                backgroundImage: `url("${thumbnailAssetUrl(
                  product.banner_image_url,
                  1170,
                  448,
                )}")`,
              }}
            >
              <img
                src={thumbnailAssetUrl(product.banner_image_url, 1170, 448)}
                alt={product.banner_alt || product.name}
              />
              <div className="banner_txt">
                <div className="col-md-10 col-sm-10 col-xs-12">
                  <h1>{product.banner_title || product.name}</h1>
                  {product.banner_sub_title && (
                    <p>{product.banner_sub_title}</p>
                  )}
                </div>
              </div>
              {product.tooltip_text && (
                <div className="banner_content">
                  <p>{product.tooltip_text}</p>
                </div>
              )}
              <i className="fa fa-camera" />
            </div>
          </div>
        </div>
      )}
      <main className="client-shop-product">
        {error && (
          <div className="client-alert" role="alert">
            {error}
          </div>
        )}
        {product && (
          <section className="section">
            <div className="container">
              <div className="row clearfix prdctDetailBox">
                <div
                  className="col-md-5 col-sm-6 col-xs-12"
                  ref={galleryColumn}
                >
                  <div className="clearfix title visible-xs">
                    <h1>{product.name}</h1>
                  </div>
                  {activeImage && (
                    <figure
                      className="prdctPic"
                      style={{
                        border: "1px solid rgba(50, 50, 50, .07)",
                        padding: "15px",
                        margin: "0 auto 15px",
                        textAlign: "center",
                      }}
                    >
                      <img
                        id="img_01"
                        src={thumbnailAssetUrl(activeImage, 301, 274)}
                        height="274"
                        width="301"
                        data-zoom-image={activeImage}
                        alt={
                          activeGalleryImage?.image_alt ||
                          product.listing_image_alt ||
                          product.name
                        }
                      />
                    </figure>
                  )}
                  <div
                    className="bx-wrapper"
                    style={{
                      width: `${Math.min(gallery.length, thumbnailCount) * 94}px`,
                      maxWidth: "100%",
                      position: "relative",
                      margin: "0 auto",
                    }}
                  >
                    <div
                      className="bx-viewport"
                      style={{
                        width: "100%",
                        height: "69px",
                        overflow: "hidden",
                        position: "relative",
                      }}
                    >
                      <div
                        className="prdctThumb"
                        id="gal1"
                        style={{
                          display: "flex",
                          position: "relative",
                          transform: `translateX(${thumbnailStart * -94}px)`,
                          transition: "transform 0.5s ease",
                        }}
                      >
                        {gallery.map((image, index) => (
                          <a
                            href="#"
                            key={image.image_url}
                            data-image={image.image_url}
                            data-zoom-image={image.image_url}
                            className={
                              index === activeImageIndex ? "active" : ""
                            }
                            style={{
                              display: "block",
                              flex: "0 0 94px",
                              width: "96px",
                              minWidth: "96px",
                              height: "69px",
                              border: "1px solid #ddd",
                            }}
                            onClick={(event) => {
                              event.preventDefault();
                              showGalleryImage(index);
                            }}
                          >
                            <img
                              src={thumbnailAssetUrl(image.image_url, 90, 67)}
                              height="67"
                              width="90"
                              style={{
                                display: "block",
                                objectFit: "contain",
                              }}
                              alt={image.image_alt}
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                    {gallery.length > 1 && (
                      <div className="bx-controls bx-has-controls-direction">
                        <div className="bx-controls-direction">
                          <a
                            className="bx-prev"
                            href="#"
                            aria-label="Previous product images"
                            // style={{
                            //   position: "absolute",
                            //   top: "50%",
                            //   left: 0,
                            //   zIndex: 999,
                            //   display: "block",
                            //   transform: "translateY(-50%)",
                            //   padding: "5px",
                            //   backgroundColor: "rgba(0, 0, 0, .5)",
                            //   color: "#fff",
                            //   fontSize: "35px",
                            //   lineHeight: "24px",
                            //   textDecoration: "none",
                            // }}
                            onClick={(event) => {
                              event.preventDefault();
                              moveThumbnails(-1);
                            }}
                          >
                            <i className="fa fa-angle-left" />
                          </a>
                          <a
                            className="bx-next"
                            href="#"
                            aria-label="Next product images"
                            // style={{
                            //   position: "absolute",
                            //   top: "50%",
                            //   right: 0,
                            //   zIndex: 999,
                            //   display: "block",
                            //   transform: "translateY(-50%)",
                            //   padding: "5px",
                            //   backgroundColor: "rgba(0, 0, 0, .5)",
                            //   color: "#fff",
                            //   fontSize: "35px",
                            //   lineHeight: "24px",
                            //   textDecoration: "none",
                            // }}
                            onClick={(event) => {
                              event.preventDefault();
                              moveThumbnails(1);
                            }}
                          >
                            <i className="fa fa-angle-right" />
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="col-md-7 col-sm-6 col-xs-12 p-details">
                  <div className="clearfix title product-title-style hidden-xs">
                    <h1>{product.name}</h1>
                  </div>
                  <div className="clearfix prdctDesc">
                    <p className="prdctId">
                      Item model number: <strong>COCO-01</strong>
                    </p>
                    <h4 className="prdctPrice blue">
                      Price: $
                      <span>{Number(product.price || 0).toFixed(2)}</span>
                    </h4>
                    <p>{product.short_descriptions}</p>
                    <form onSubmit={addToCart}>
                      {(product.attribute_types || []).map((type) => (
                        <p key={type.id}>
                          <label htmlFor={`product-attribute-${type.id}`}>
                            {type.name}
                          </label>{" "}
                          <select
                            id={`product-attribute-${type.id}`}
                            name="attribute[]"
                            required
                            value={selected[type.id] || ""}
                            onChange={(event) =>
                              setSelected((current) => ({
                                ...current,
                                [type.id]: event.target.value,
                              }))
                            }
                          >
                            {type.values.map((value) => (
                              <option value={value.id} key={value.id}>
                                {value.value}
                              </option>
                            ))}
                          </select>
                        </p>
                      ))}
                      <div className="quan-block clearfix">
                        <div className="quan">
                          <label htmlFor="product-quantity">Quantity</label>
                          <input
                            id="product-quantity"
                            type="number"
                            min="1"
                            max="100"
                            value={quantity}
                            onChange={(event) =>
                              setQuantity(event.target.value)
                            }
                          />
                        </div>
                        <div className="addto">
                          <button
                            name="add"
                            type="submit"
                            className="button-style"
                          >
                            Add To cart
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>
                <div className="col-md-12 col-sm-12 col-xs-12 prdctDesc description-style">
                  <h3 className="text-uppercase">Product Description</h3>
                  {product.description && (
                    <div
                      dangerouslySetInnerHTML={{
                        __html: localizeRichContent(product.description),
                      }}
                    />
                  )}
                  <p>
                    <strong>Shipping:</strong> Shipping rate is flat $5, but for
                    purchases over $50, shipping is free within the United
                    States.
                    <br />
                    If you are ordering outside of the US, please call
                    801.226.9026 to place your order.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
      {product?.box_images?.length > 0 && (
        <section className="section">
          <div className="container">
            <div className="row">
              <div className="col-xs-12 title">
                <h2>You May Also Enjoy</h2>
              </div>
              {product.box_images.map((box) => {
                const link = localAppLink(box.link) || box.link || "#";
                const CardLink = link.startsWith("/") ? Link : "a";
                const linkProps =
                  CardLink === Link ? { to: link } : { href: link };
                return (
                  <div
                    className="col-md-3 col-sm-4 col-xs-12 gridCol"
                    key={`${box.title}-${box.link}`}
                  >
                    <div className="trip_type clearfix">
                      <CardLink {...linkProps}>
                        <div className="trip_img">
                          {box.image_url && (
                            <img
                              src={thumbnailAssetUrl(box.image_url, 270, 183)}
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
      <PublicFooterExtras publicSettings={publicSettings} />
      <PublicFooter footerMenus={footerMenus} />
    </div>
  );
}
