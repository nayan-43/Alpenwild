import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import PublicFooter from "@/components/public/PublicFooter";
import PublicFooterExtras from "@/components/public/PublicFooterExtras";
import PublicHeader from "@/components/public/PublicHeader";
import PublicLoader from "@/components/public/PublicLoader";
import { getShopTotals, readShopCart, readShopDiscount } from "@/lib/shopCart";
import {
  readShopCheckoutEmail,
  saveShopCheckoutEmail,
} from "@/lib/shopCheckoutEmail";
import { setShopCheckoutDraft } from "@/lib/shopCheckoutDraft";

function AddressDisplay({ title, value, user = false }) {
  const name = [value.first_name, value.last_name].filter(Boolean).join(" ");
  const address = [
    value.street_address,
    [value.city, value.postal_code].filter(Boolean).join(", "),
    value.state ? `${value.state},` : "",
    value.country,
  ].filter(Boolean);
  return (
    <div className="col-md-6 col-sm-6 col-xs-12 mHeight">
      <div className="row">
        <div className="col-md-2 col-sm-4 col-xs-6">
          <p>
            <strong>{user ? "User:" : "Shipping:"}</strong>
          </p>
        </div>
        <div className="col-md-10 col-sm-8 col-xs-6">
          <p>{name}</p>
        </div>
      </div>
      <div className="row">
        <div className="col-md-2 col-sm-4 col-xs-6">
          <p>
            <strong>Address:</strong>
          </p>
        </div>
        <div className="col-md-10 col-sm-8 col-xs-6">
          <p>
            {address.map((line, index) => (
              <React.Fragment key={`${title}-${index}`}>
                {index > 0 && <br />}
                {line}
              </React.Fragment>
            ))}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PublicCheckoutPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const emailFromUrl = searchParams.get("user_email_address")?.trim() || "";
  const [email] = useState(() => emailFromUrl || readShopCheckoutEmail());
  const [items] = useState(readShopCart);
  const [discount] = useState(readShopDiscount);
  const [customer, setCustomer] = useState(null);
  const [shipping, setShipping] = useState(null);
  const [accountLoading, setAccountLoading] = useState(Boolean(email));
  const [card, setCard] = useState({
    number: "",
    month: "",
    year: "",
    cvv: "",
  });
  const [footerMenus, setFooterMenus] = useState([]);
  const [publicSettings, setPublicSettings] = useState({});
  const [error, setError] = useState("");
  const [footerLoading, setFooterLoading] = useState(true);
  const totals = getShopTotals(items, discount);

  useEffect(() => {
    let active = true;
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
        if (active) setFooterLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!emailFromUrl) return;
    saveShopCheckoutEmail(emailFromUrl);
    navigate("/checkout", { replace: true });
  }, [emailFromUrl, navigate]);

  useEffect(() => {
    if (!email) {
      setError("Enter your primary email address from the cart to continue.");
      setAccountLoading(false);
      return;
    }
    const controller = new AbortController();
    setAccountLoading(true);
    fetch("/api/public/shop-customer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_email_address: email }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (result.code === "ACCOUNT_NOT_FOUND") {
          saveShopCheckoutEmail(email);
          navigate("/user-registration", { replace: true });
          return;
        }
        if (!response.ok)
          throw new Error(result.message || "Unable to find this account.");
        setCustomer(result.customer);
        setShipping(result.shipping);
      })
      .catch((lookupError) => {
        if (lookupError.name !== "AbortError") setError(lookupError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setAccountLoading(false);
      });
    return () => controller.abort();
  }, [email, navigate]);

  async function submitOrder(event) {
    event.preventDefault();
    if (!items.length || !customer || !shipping) return;
    setShopCheckoutDraft({
      checkout: {
        customer,
        shipping,
        items: items.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          attributes: (item.attributes || []).map((attribute) => ({
            type_id: attribute.type_id,
            value_id: attribute.value_id,
          })),
        })),
        discount_code: discount?.code || "",
        credit_card_number: card.number.replace(/\D/g, ""),
        credit_card_expire_month: card.month,
        credit_card_expire_year: card.year,
        credit_card_cvv_number: card.cvv,
        agree: true,
      },
      displayItems: items,
      discount,
    });
    navigate("/checkoutconfirm");
  }

  return (
    <div className="public-site">
      <PublicHeader />
      {(footerLoading || accountLoading) && <PublicLoader />}
      <main>
        <section className="section">
          <div className="container">
            <div className="title clearfix">
              <h2>Checkout</h2>
            </div>
            {!items.length ? (
              <div className="clearfix">
                <p>Your shopping cart is empty.</p>
                <Link className="button-type" to="/cart">
                  Return to Cart
                </Link>
              </div>
            ) : accountLoading ? (
              <div className="clearfix" role="status">
                Loading your saved account details…
              </div>
            ) : !customer || !shipping ? (
              <div className="clearfix">
                {error && (
                  <div className="client-alert" role="alert">
                    {error}
                  </div>
                )}
                <Link className="button-type" to="/cart">
                  Return to Cart
                </Link>
              </div>
            ) : (
              <form name="user_payment_groupm" onSubmit={submitOrder}>
                {error && (
                  <div className="clearfix client-alert" role="alert">
                    {error}
                  </div>
                )}
                <div className="checkoutRow clearfix">
                  <div className="col-md-12 title">
                    <h3>Shipping Address</h3>
                  </div>
                  <AddressDisplay title="User" value={customer} user />
                  <AddressDisplay title="Shipping" value={shipping} />
                </div>
                <div className="checkoutRow clearfix">
                  <div className="col-md-12 title">
                    <h3>Shipping Rate</h3>
                  </div>
                  <div className="col-md-6 col-sm-6 col-xs-6">
                    <p>Shipping rate</p>
                  </div>
                  <div className="col-md-6 col-sm-6 col-xs-6">
                    <p>${totals.shipping.toFixed(2)}</p>
                  </div>
                </div>
                <div className="checkoutRow clearfix">
                  <div className="col-md-12 form_holder clearfix title">
                    <h3>Payment Details</h3>
                  </div>
                  <div className="form_holder clearfix">
                    <div className="col-md-2 col-sm-4 col-xs-12">
                      <label htmlFor="credit_card_number">
                        Credit Card Number:
                      </label>
                    </div>
                    <div className="col-md-6 col-sm-8 col-xs-12">
                      <input
                        id="credit_card_number"
                        name="credit_card_number"
                        type="text"
                        required
                        inputMode="numeric"
                        autoComplete="cc-number"
                        minLength="14"
                        maxLength="25"
                        value={card.number}
                        onChange={(event) =>
                          setCard((current) => ({
                            ...current,
                            number: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="form_holder clearfix">
                    <div className="col-md-2 col-sm-4 col-xs-12">
                      <label htmlFor="credit_card_expire_month">
                        Card Expiration Month:
                      </label>
                    </div>
                    <div className="col-md-6 col-sm-8 col-xs-12">
                      <select
                        id="credit_card_expire_month"
                        name="credit_card_expire_month"
                        className="select"
                        required
                        autoComplete="cc-exp-month"
                        value={card.month}
                        onChange={(event) =>
                          setCard((current) => ({
                            ...current,
                            month: event.target.value,
                          }))
                        }
                      >
                        <option value="">
                          --- Select Expiration Month ---
                        </option>
                        {Array.from({ length: 12 }, (_, index) => {
                          const month = String(index + 1).padStart(2, "0");
                          return (
                            <option key={month} value={month}>
                              {month}-
                              {new Date(2000, index).toLocaleString("en", {
                                month: "long",
                              })}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>
                  <div className="form_holder clearfix">
                    <div className="col-md-2 col-sm-4 col-xs-12">
                      <label htmlFor="credit_card_expire_year">
                        Card Expiration Year:
                      </label>
                    </div>
                    <div className="col-md-6 col-sm-8 col-xs-12">
                      <select
                        id="credit_card_expire_year"
                        name="credit_card_expire_year"
                        className="select"
                        required
                        autoComplete="cc-exp-year"
                        value={card.year}
                        onChange={(event) =>
                          setCard((current) => ({
                            ...current,
                            year: event.target.value,
                          }))
                        }
                      >
                        <option value="">--- Select Expiration Year ---</option>
                        {Array.from({ length: 20 }, (_, index) => {
                          const year = String(new Date().getFullYear() + index);
                          return (
                            <option key={year} value={year}>
                              {year}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>
                  <div className="form_holder clearfix">
                    <div className="col-md-2 col-sm-4 col-xs-12">
                      <label htmlFor="credit_card_cvv_number">
                        Card CVV Number:
                      </label>
                    </div>
                    <div className="col-md-6 col-sm-8 col-xs-12">
                      <input
                        id="credit_card_cvv_number"
                        name="credit_card_cvv_number"
                        type="password"
                        required
                        autoComplete="cc-csc"
                        inputMode="numeric"
                        minLength="3"
                        maxLength="4"
                        value={card.cvv}
                        onChange={(event) =>
                          setCard((current) => ({
                            ...current,
                            cvv: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
                <div className="checkoutRow clearfix">
                  <div className="col-md-12 title">
                    <h3>Continue Checkout</h3>
                  </div>
                  <div className="col-md-6 col-sm-6 col-xs-12">
                    <p>Continue Checkout Procedure to confirm this order.</p>
                  </div>
                  <div className="col-md-6 col-sm-6 col-xs-12">
                    <p>
                      <button
                        type="submit"
                        className="btn btn-success"
                        name="submit"
                        value="Continue Checkout"
                      >
                        Continue Checkout
                      </button>
                    </p>
                  </div>
                </div>
              </form>
            )}
          </div>
        </section>
      </main>
      <PublicFooterExtras publicSettings={publicSettings} />
      <PublicFooter footerMenus={footerMenus} />
    </div>
  );
}
