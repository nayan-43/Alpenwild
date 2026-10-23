import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PublicFooter from "@/components/public/PublicFooter";
import PublicFooterExtras from "@/components/public/PublicFooterExtras";
import PublicHeader from "@/components/public/PublicHeader";
import PublicLoader from "@/components/public/PublicLoader";
import { thumbnailAssetUrl } from "@/lib/assets";
import {
  getShopTotals,
  readShopCart,
  readShopDiscount,
  writeShopCart,
  writeShopDiscount,
} from "@/lib/shopCart";

const getCartItemKey = (item) =>
  JSON.stringify([
    item.product_id,
    ...(item.attributes || []).map((attribute) => [
      attribute.type_id,
      attribute.value_id,
    ]),
  ]);

export default function PublicCartPage() {
  const [items, setItems] = useState(readShopCart);
  const [itemsToDelete, setItemsToDelete] = useState([]);
  const [discount, setDiscount] = useState(readShopDiscount);
  const [discountCode, setDiscountCode] = useState(
    () => readShopDiscount()?.code || "",
  );
  const [footerMenus, setFooterMenus] = useState([]);
  const [publicSettings, setPublicSettings] = useState({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

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
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function updateCart(next) {
    setItems(next);
    writeShopCart(next);
  }

  function submitCartUpdate(event) {
    event.preventDefault();
    if (itemsToDelete.length) {
      const deleted = new Set(itemsToDelete);
      updateCart(items.filter((item) => !deleted.has(getCartItemKey(item))));
      setItemsToDelete([]);
    }
  }

  async function applyDiscount(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const response = await fetch("/api/discount-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discount_code: discountCode }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success)
        throw new Error(result.message || "Unable to validate this discount.");
      const nextDiscount = {
        code: discountCode.trim(),
        type: result.type,
        value: Number(result.value),
      };
      setDiscount(nextDiscount);
      writeShopDiscount(nextDiscount);
      setNotice("You have successfully activated your coupon code.");
    } catch (applyError) {
      setDiscount(null);
      writeShopDiscount(null);
      setError(applyError.message);
    } finally {
      setBusy(false);
    }
  }

  const totals = getShopTotals(items, discount);

  return (
    <div className="public-site">
      <PublicHeader />
      {loading && <PublicLoader />}
      <main>
        <section className="section">
          <div className="container">
            <div className="title clearfix">
              <h2>Shopping Cart</h2>
            </div>
            {error && (
              <div className="client-alert" role="alert">
                {error}
              </div>
            )}
            {notice && (
              <div className="client-shop-notice" role="status">
                {notice}
              </div>
            )}
            <form
              id="shopping_cart"
              name="shopping_cart"
              method="post"
              onSubmit={submitCartUpdate}
            >
              <input type="hidden" name="action" value="Update" />
              <div className="cart-table-cover clearfix">
                <table
                  className="table checkout-table"
                  cellPadding="0"
                  cellSpacing="0"
                >
                  <thead>
                    <tr>
                      <th>
                        <h4>Delete</h4>
                      </th>
                      <th>
                        <h4>Products Image</h4>
                      </th>
                      <th>
                        <h4>Details</h4>
                      </th>
                      <th align="center">
                        <h4>Quantity</h4>
                      </th>
                      <th align="center">
                        <h4>Unite Price</h4>
                      </th>
                      <th align="center">
                        <h4>Total</h4>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length ? (
                      items.map((item, index) => (
                        <tr key={`${item.product_id}-${index}`}>
                          <td>
                            <label>
                              <input
                                type="checkbox"
                                name="cart_delete[]"
                                value={getCartItemKey(item)}
                                checked={itemsToDelete.includes(
                                  getCartItemKey(item),
                                )}
                                onChange={(event) =>
                                  setItemsToDelete((current) =>
                                    event.target.checked
                                      ? [...current, getCartItemKey(item)]
                                      : current.filter(
                                          (key) => key !== getCartItemKey(item),
                                        ),
                                  )
                                }
                              />
                            </label>
                          </td>
                          <td className="imgWrap">
                            <div className="img-wrap">
                              {item.image && (
                                <img
                                  src={thumbnailAssetUrl(item.image, 90, 67)}
                                  alt={item.name}
                                />
                              )}
                            </div>
                          </td>
                          <td className="p-d">
                            <div className="p-name">{item.name}</div>
                            {(item.attributes || []).map((attribute) => (
                              <p key={attribute.type_id}>
                                <strong>
                                  {attribute.type_name}: {attribute.value_name}
                                </strong>
                              </p>
                            ))}
                          </td>
                          <td className="cartQuan" align="center">
                            <input
                              type="text"
                              name={`cart_quantity[${getCartItemKey(item)}]`}
                              value={item.quantity}
                              aria-label={`Quantity for ${item.name}`}
                              onChange={(event) => {
                                const quantity = Math.max(
                                  1,
                                  Math.min(
                                    100,
                                    Number(event.target.value) || 1,
                                  ),
                                );
                                updateCart(
                                  items.map((row, rowIndex) =>
                                    rowIndex === index
                                      ? { ...row, quantity }
                                      : row,
                                  ),
                                );
                              }}
                            />
                          </td>
                          <td className="nowrap" align="center">
                            <p>$ {Number(item.price).toFixed(2)}</p>
                          </td>
                          <td className="nowrap" align="center">
                            <p>
                              ${" "}
                              {(
                                Number(item.price) * Number(item.quantity)
                              ).toFixed(2)}
                            </p>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" className="text-center">
                          Your shopping cart is empty.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="clearfix">
                <table className="table coupon-table">
                  <tbody>
                    <tr>
                      <td>
                        <span>If you have a voucher code add it: </span>
                        <input
                          type="text"
                          name="discount_code"
                          id="shop-discount-code"
                          value={discountCode}
                          onChange={(event) =>
                            setDiscountCode(event.target.value)
                          }
                        />{" "}
                        <input
                          type="button"
                          value={busy ? "Checking…" : "ADD"}
                          className="button-type"
                          name="discount"
                          disabled={busy}
                          onClick={applyDiscount}
                        />
                        {discount && (
                          <button
                            type="button"
                            onClick={() => {
                              setDiscount(null);
                              setDiscountCode("");
                              writeShopDiscount(null);
                            }}
                          >
                            Remove discount
                          </button>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="clearfix">
                <table className="total-table">
                  <tbody>
                    <tr>
                      <td>
                        <h4>Sub Total:</h4>
                      </td>
                      <td>$ {totals.subtotal.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td>
                        <h4>Discount:</h4>
                      </td>
                      <td>(-)$ {totals.discount.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td>
                        <h4>Shipping:</h4>
                      </td>
                      <td>$ {totals.shipping.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td>
                        <h4>Total:</h4>
                      </td>
                      <td>$ {totals.total.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="clearfix" style={{ margin: "15px 0" }}>
                <div className="row">
                  <div className="col-md-12 col-sm-12 col-xs-12 text-right">
                    <button
                      type="submit"
                      className="button-type"
                      name="sub_btn"
                      value="Update"
                    >
                      Update
                    </button>{" "}
                    <Link
                      to="/staticpage/get-the-gear-we-love/"
                      className="button-type"
                    >
                      Continue Shopping
                    </Link>
                  </div>
                </div>
              </div>
            </form>
            <form id="checkout" name="checkout" method="get" action="/checkout">
              <div
                className="clearfix"
                style={{
                  margin: "15px 0 0",
                  borderBottom: "rgba(50,50,50,.2) solid 1px",
                  paddingBottom: "25px",
                }}
              >
                <div className="row">
                  <div className="col-lg-12 col-md-12 col-sm-12 col-xs-12 place-order text-right">
                    <span>Enter Your Primary Email Address </span>
                    <input
                      type="email"
                      name="user_email_address"
                      defaultValue=""
                      required
                      placeholder="Enter Email"
                      style={{ marginRight: "4px" }}
                    />
                    <button type="submit" className="button-type">
                      Order
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </section>
      </main>
      <PublicFooterExtras publicSettings={publicSettings} />
      <PublicFooter footerMenus={footerMenus} />
    </div>
  );
}
