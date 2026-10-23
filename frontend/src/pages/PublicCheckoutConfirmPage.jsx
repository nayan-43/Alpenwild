import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import PublicFooter from "@/components/public/PublicFooter";
import PublicFooterExtras from "@/components/public/PublicFooterExtras";
import PublicHeader from "@/components/public/PublicHeader";
import PublicLoader from "@/components/public/PublicLoader";
import { thumbnailAssetUrl } from "@/lib/assets";
import { clearShopCart, getShopTotals } from "@/lib/shopCart";
import { clearShopCheckoutEmail } from "@/lib/shopCheckoutEmail";
import {
  clearShopCheckoutDraft,
  readShopCheckoutDraft,
} from "@/lib/shopCheckoutDraft";

export default function PublicCheckoutConfirmPage() {
  const navigate = useNavigate();
  const [draft] = useState(readShopCheckoutDraft);
  const checkout = draft?.checkout;
  const displayItems = draft?.displayItems || [];
  const discount = draft?.discount || null;
  const [footerMenus, setFooterMenus] = useState([]);
  const [publicSettings, setPublicSettings] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const totals = getShopTotals(displayItems, discount);

  useEffect(() => {
    document.title = "Confirm Checkout | Alpenwild";
    return () => {
      document.title = "Alpenwild";
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!checkout || !displayItems.length) {
      navigate("/checkout", { replace: true });
      setLoading(false);
      return;
    }
    Promise.all([
      fetch("/api/footer-menus").then((response) => response.json()),
      fetch("/api/public-settings").then((response) => response.json()),
    ])
      .then(([menus, settings]) => {
        if (!active) return;
        setFooterMenus(Array.isArray(menus) ? menus : []);
        setPublicSettings(settings || {});
      })
      .catch(() => {
        if (active) setError("Unable to load site footer content.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [checkout, displayItems.length, navigate]);

  async function payNow() {
    if (busy || !checkout) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/public/shop-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checkout),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(result.message || "Unable to complete your order.");
      clearShopCheckoutDraft();
      clearShopCart();
      clearShopCheckoutEmail();
      navigate("/staticpage/thank-you-for-order-for-maps-books/");
    } catch (paymentError) {
      setError(paymentError.message);
      setBusy(false);
    }
  }

  return (
    <div className="public-site">
      <PublicHeader />
      {loading && <PublicLoader />}
      <main>
        <section className="section">
          <div className="container">
            <div className="title clearfix">
              <h2>Confirm Checkout</h2>
            </div>
            {error && (
              <div className="clearfix client-alert" role="alert">
                {error}
              </div>
            )}
            {checkout && displayItems.length > 0 && (
              <div id="shopping_cart" name="shopping_cart">
                <div className="clearfix headRow">
                  <div className="col-md-5 col-sm-4 col-xs-12 mHeight cartCell">
                    <h4>Products</h4>
                  </div>
                  <div className="col-md-2 col-sm-2 col-xs-12 mHeight cartCell hidden-xs">
                    <h4>Quantity</h4>
                  </div>
                  <div className="col-md-2 col-sm-2 col-xs-12 mHeight cartCell hidden-xs">
                    <h4>Unite Price</h4>
                  </div>
                  <div className="col-md-2 col-sm-2 col-xs-12 mHeight cartCell hidden-xs">
                    <h4>Total</h4>
                  </div>
                </div>
                {displayItems.map((item, index) => (
                  <div className="clearfix" key={`${item.product_id}-${index}`}>
                    <div className="col-md-5 col-sm-4 col-xs-12 mHeight cartCell imgWrap">
                      {item.image && (
                        <img
                          src={thumbnailAssetUrl(item.image, 90, 67)}
                          alt={item.name || "Product"}
                        />
                      )}
                      <p>
                        <strong>{item.name}</strong>
                      </p>
                      {(item.attributes || []).map((attribute) => (
                        <p key={`${attribute.type_id}-${attribute.value_id}`}>
                          <strong>
                            {attribute.type_name}: {attribute.value_name}
                          </strong>
                        </p>
                      ))}
                    </div>
                    <div className="col-md-2 col-sm-2 col-xs-12 mHeight cartCell cartQuan">
                      <label className="visible-xs">Quantity: </label>
                      {item.quantity}
                    </div>
                    <div className="col-md-2 col-sm-2 col-xs-12 mHeight cartCell">
                      <p>
                        <span className="visible-xs">Unite Price: </span>$
                        {Number(item.price).toFixed(2)}
                      </p>
                    </div>
                    <div className="col-md-2 col-sm-2 col-xs-12 mHeight cartCell">
                      <p>
                        <span className="visible-xs">Total Price: </span>$
                        {(Number(item.price) * Number(item.quantity)).toFixed(
                          2,
                        )}
                      </p>
                    </div>
                  </div>
                ))}
                {[
                  ["Sub Total:", totals.subtotal],
                  ["Discount:", -totals.discount],
                  ["Shipping:", totals.shipping],
                  ["Total:", totals.total],
                ].map(([label, amount]) => (
                  <div className="clearfix" key={label}>
                    <div className="col-md-2 col-md-offset-8 col-sm-3 col-sm-offset-6 col-xs-6 mHeight">
                      <p>{label}</p>
                    </div>
                    <div className="col-md-2 col-sm-3 col-xs-6 mHeight">
                      <p>
                        {amount < 0 ? "(-)$ " : "$ "}
                        {Math.abs(amount).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
                <div className="clearfix">
                  <div className="col-md-12 col-sm-12 col-xs-12 mHeight text-right">
                    <button
                      type="button"
                      className="btn btn-success"
                      onClick={payNow}
                      disabled={busy}
                    >
                      {busy ? "Processing…" : "Pay Now"}
                    </button>{" "}
                    <Link
                      to="/cart"
                      className="btn btn-success"
                      onClick={clearShopCheckoutDraft}
                    >
                      Edit Order
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
      <PublicFooterExtras publicSettings={publicSettings} />
      <PublicFooter footerMenus={footerMenus} />
    </div>
  );
}
