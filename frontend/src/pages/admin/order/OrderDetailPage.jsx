import React from "react";

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function addressLines(address) {
  return [
    `${address.first_name} ${address.last_name}`.trim(),
    address.street_address,
    address.street_address1,
    [address.city, address.state, address.postal_code]
      .filter(Boolean)
      .join(", "),
    address.country,
  ].filter(Boolean);
}

export default function OrderDetailPage({ order, isLoading = false, onBack }) {
  if (isLoading) {
    return (
      <section className="admin-box box-primary module-table-panel">
        <div className="box-body admin-loading-box-body">
          <div
            className="admin-full-page-loader"
            role="status"
            aria-live="polite"
          >
            <span className="admin-spinner" aria-hidden="true" />
            Loading order details...
          </div>
        </div>
      </section>
    );
  }

  if (!order) {
    return (
      <section className="admin-box box-primary">
        <div className="box-body">Order not found.</div>
      </section>
    );
  }

  return (
    <section className="admin-box box-primary order-detail-panel">
      <div className="box-body order-detail-content">
        <table className="order-detail-table">
          <caption>Orders Details</caption>
          <thead>
            <tr>
              <th>User Details</th>
              <th>Shipping Details</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                {addressLines(order.customer || {})
                  .slice(0, 1)
                  .map((line, index) => (
                    <div key={`customer-${index}`}>{line}</div>
                  ))}
                {order.email ? (
                  <a href={`mailto:${order.email}`}>{order.email}</a>
                ) : null}
                {addressLines(order.customer || {})
                  .slice(1)
                  .map((line, index) => (
                    <div key={`customer-address-${index}`}>{line}</div>
                  ))}
              </td>
              <td>
                {addressLines(order.shipping || {}).map((line, index) => (
                  <div key={`shipping-${index}`}>{line}</div>
                ))}
              </td>
            </tr>
          </tbody>
        </table>
        <table className="order-detail-table order-products-table">
          <thead>
            <tr>
              <th>Products</th>
              <th>Quantity</th>
              <th>Price</th>
              <th>Total Price</th>
            </tr>
          </thead>
          <tbody>
            {(order.items || []).map((item, index) => (
              <tr key={`${item.product_id}-${index}`}>
                <td>
                  <div>{item.product_name}</div>
                  {item.attributes?.map((attribute, attributeIndex) => (
                    <div key={`${attribute.type}-${attributeIndex}`}>
                      {attribute.type}: {attribute.value}
                    </div>
                  ))}
                </td>
                <td className="order-number">{item.quantity}</td>
                <td className="order-number">{money(item.price)}</td>
                <td className="order-number">{money(item.total_price)}</td>
              </tr>
            ))}
            <tr>
              <td colSpan="1" />
              <td colSpan="3" className="order-totals-cell">
                <table className="order-totals-table">
                  <tbody>
                    <tr>
                      <td>Discount:</td>
                      <td>{money(order.discount_price)}</td>
                    </tr>
                    <tr>
                      <td>Shipping Price:</td>
                      <td>{money(order.shipping_price)}</td>
                    </tr>
                    <tr>
                      <td>Total:</td>
                      <td>{money(order.total_price)}</td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="box-footer">
        <button type="button" className="btn btn-default" onClick={onBack}>
          Back to Product Orders
        </button>
      </div>
    </section>
  );
}
