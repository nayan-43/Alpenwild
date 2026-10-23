function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function formatAmount(value) {
  return Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  });
}

function buildOrderDetailsTable({ items, totals, transactionId }) {
  const productRows = items
    .map(
      (item) => `<tr>
        <td align="left" valign="middle"><h4>${escapeHtml(item.name)}</h4>${(item.attributes || [])
          .map(
            (attribute) =>
              `${escapeHtml(attribute.type_name)}: ${escapeHtml(attribute.value_name)}<br>`,
          )
          .join("")}</td>
        <td align="left" valign="middle">${escapeHtml(item.quantity)}</td>
        <td align="left" valign="middle">${escapeHtml(item.price)}</td>
        <td align="left" valign="middle">${escapeHtml(Number(item.price) * Number(item.quantity))}</td>
      </tr>`,
    )
    .join("");

  return `<table width="100%" border="0" cellspacing="2" cellpadding="0">
      <tr>
        <td width="20%" align="left" valign="middle"><strong>Product Name</strong></td>
        <td width="20%" align="left" valign="middle"><strong>Quantity</strong></td>
        <td width="50%" align="left" valign="middle"><strong>Price</strong></td>
        <td width="70" align="left" valign="middle"><strong>Total Price</strong></td>
      </tr>
      ${productRows}
    </table>
    <table align="right" width="240" border="0" cellspacing="0" cellpadding="3">
      <tr><td>Sub Total:</td><td width="70">$ ${formatAmount(totals.subtotal)}</td></tr>
      ${totals.discount ? `<tr><td>Discount:</td><td>$ ${formatAmount(totals.discount)}</td></tr>` : ""}
      <tr><td>Shipping:</td><td>$ ${formatAmount(totals.shipping)}</td></tr>
      <tr><td>Total:</td><td>$ ${formatAmount(totals.total)}</td></tr>
      <tr><td>Transaction ID:</td><td>${escapeHtml(transactionId)}</td></tr>
    </table>`;
}

export function buildShopOrderEmails({
  customer,
  shipping,
  items,
  totals,
  transactionId,
}) {
  const orderDetails = buildOrderDetailsTable({ items, totals, transactionId });
  const customerHtml = `<table width="800" cellpadding="6" border="0" align="center">
    <tbody>
      <tr><td style="font-size:12px; color:#000000; font-family:Verdana;" align="left"><p>Dear ${escapeHtml(customer.first_name)} ,<br />
      Just to confirm, we have received your order and we will mail it out shortly!</td></tr>
      <tr><td style="font-size:12px; color:#000000; font-family:Verdana;" align="left">Your order details are:<br />${orderDetails} </td></tr>
      <tr><td style="font-size:12px; color:#000000; font-family:Verdana;" align="left">As always, if you have any questions, please feel free to call our office or drop us a quick email.</td></tr>
      <tr><td style="font-size:12px; color:#000000; font-family:Verdana;" align="left">See you in the Alps!</td></tr>
      <tr><td style="font-size:12px; color:#000000; font-family:Verdana;" align="left">Regards,<br>Alpenwild<br>801-226-9026<br><a href="https://www.alpenwild.com/">www.alpenwild.com</a></td></tr>
    </tbody>
  </table>`;
  const billingAddress = [customer.street_address, customer.street_address1]
    .filter(Boolean)
    .join(" ");
  const shippingAddress = [shipping.street_address, shipping.street_address1]
    .filter(Boolean)
    .join(" ");
  const adminHtml = `<table width="800" cellpadding="6" border="0" align="center">
    <tbody>
      <tr><td style="font-size:12px; color:#000000; font-family:Verdana;" align="left">Dear Admin ,<br />A new user has submitted a new order. Following are the details:<br /><h1>User Details</h1>
      Name: ${escapeHtml(customer.first_name)} ${escapeHtml(customer.last_name)}<br>
      Email Address: ${escapeHtml(customer.email)}<br>
      Phone: ${escapeHtml(customer.phone)}<br>
      Address: ${escapeHtml(billingAddress)}<br>${escapeHtml(customer.city)} ${escapeHtml(customer.state)}, ${escapeHtml(customer.postal_code)}<br>
      <h1>Shipping Details</h1>
      Name: ${escapeHtml(shipping.first_name)} ${escapeHtml(shipping.last_name)}<br>
      Address: ${escapeHtml(shippingAddress)}<br>${escapeHtml(shipping.city)} ${escapeHtml(shipping.state)}, ${escapeHtml(shipping.postal_code)}<br>
      <h1>Order Details</h1>
      ${orderDetails}
      </td></tr>
      <tr><td style="font-size:12px; color:#000000; font-family:Verdana;" align="left">You can view the order at any time. Just log in to your admin, and visit the &quot;Manage Order&quot; Page.</td></tr>
      <tr><td style="font-size:12px; color:#000000; font-family:Verdana;" align="left">Kind Regards,<br />Alpenwild<br />https://www.alpenwild.com/</td></tr>
    </tbody>
  </table>
  <p>&nbsp;</p>`;

  return { customerHtml, adminHtml };
}
