import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "@/lib/api";
import { serializeComparableForm } from "@/lib/adminFormSnapshot";
import Icon, { AdminTableIcon } from "@/components/admin/Icon";
import { SearchableSelect } from "@/components/admin/FormFields";

const bookingColumns = [
  ["Trips Booking No", "id"],
  ["Trips Name", "trip_name"],
  ["User Details", "customer"],
  ["Additional User Details", "additional_users"],
  ["Total Payment", "total_payment"],
  ["Deposit Details", "deposits"],
  ["Refund Details", "refunds"],
  ["Trips Date Details", "trip_dates"],
  ["Booking Start Date", "booking_start_date"],
  ["Booking End Date", "booking_end_date"],
  ["Booking Date", "booking_date"],
  ["Payment Due", "payment_due"],
  ["Booking Status", "status"],
  ["Option", "actions"],
];
const paymentColumns = [
  ["ID", "id"],
  ["Booking", "booking_id"],
  ["Customer", "customer"],
  ["Trip", "trip_name"],
  ["Amount", "amount"],
  ["Payment Date", "payment_date"],
  ["Status", "status"],
  ["Gateway", "gateway"],
  ["Option", "actions"],
];
const bookingPaymentColumns = [
  ["Payment Made", "amount"],
  ["Payment Date", "payment_date"],
  ["Payment Status", "status"],
  ["Option", "actions"],
];
const makePaymentColumns = [
  ["Name", "name_on_card"],
  ["Address", "bill_address"],
  ["City", "city"],
  ["State", "state"],
  ["Zip Code", "zip_code"],
  ["Email", "email_address"],
  ["Amount", "amount"],
  ["Option", "actions"],
];

function displayDate(value) {
  if (value == null || value === "") return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date
    .toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })
    .replace(", ", ",");
}

function displayNumericDate(value) {
  if (value == null || value === "") return "N/A";
  return String(value).slice(0, 10);
}

function displayLines(value) {
  if (!value || !String(value).trim()) return "N/A";
  return String(value)
    .split("\n")
    .map((line, index) => (
      <React.Fragment key={`${line}-${index}`}>
        {index > 0 && <br />}
        {line || "N/A"}
      </React.Fragment>
    ));
}

function displayValue(row, key) {
  if (key === "total_payment") {
    if (row.total_payment === null || row.total_payment === undefined)
      return "N/A";
    return (
      <>
        ${row.total_payment}
        {row.additional_payment !== null &&
          row.additional_payment !== undefined &&
          Number(row.additional_payment) !== 0 && (
            <>
              <br />
              Excluding Single Supplement of ${row.additional_payment}
            </>
          )}
      </>
    );
  }
  if (key === "customer")
    return displayLines(
      [
        `${row.first_name || row.customer_first_name || ""} ${row.last_name || row.customer_last_name || ""}`.trim(),
        row.street_address,
        row.street_address1,
        `${row.city || ""}${row.state ? `, ${row.state}` : ""} ${row.postal_code || ""}`.trim(),
        row.country,
        row.email,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  if (
    [
      "booking_date",
      "payment_date",
      "booking_start_date",
      "booking_end_date",
    ].includes(key)
  )
    return displayDate(row[key]);
  if (
    ["total_payment", "payment_due", "amount", "additional_payment"].includes(
      key,
    )
  ) {
    if (row[key] === null || row[key] === undefined || row[key] === "")
      return "N/A";
    return `$${Number(row[key] || 0).toFixed(2)}`;
  }
  if (["additional_users", "deposits", "refunds", "trip_dates"].includes(key))
    return displayLines(row[key]);
  return row[key] === null || row[key] === undefined || row[key] === ""
    ? "N/A"
    : row[key];
}

function getPaginationItems(currentPage, totalPages) {
  if (totalPages <= 7)
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  if (currentPage <= 5) return [1, 2, 3, 4, 5, "ellipsis", totalPages];
  if (currentPage >= totalPages - 4)
    return [
      1,
      "ellipsis",
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  return [
    1,
    "ellipsis",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "ellipsis",
    totalPages,
  ];
}

function ActionImage({ name }) {
  return (
    <img
      className="table-action-image"
      src={`/images/admin/${name}`}
      alt=""
      aria-hidden="true"
    />
  );
}

function ActionIcons({
  payments,
  status,
  onViewPayment,
  onDeletePayment,
  onEdit,
  onStatus,
  onPreview,
  onDelete,
  onPaymentLink,
  onRefund,
}) {
  return (
    <div className="table-action-icons">
      {payments ? (
        <button
          type="button"
          title="Delete payment"
          className="icon-button danger"
          onClick={onDeletePayment}
        >
          <ActionImage name="delete.gif" />
        </button>
      ) : (
        <>
          <button
            type="button"
            title="View payment"
            className="icon-button"
            onClick={onViewPayment}
          >
            <ActionImage name="credit.card.icon.png" />
          </button>
          <button
            type="button"
            title="Edit booking"
            className="icon-button"
            onClick={onEdit}
          >
            <AdminTableIcon name="edit" />
          </button>
          <button
            type="button"
            title="Change status"
            className="icon-button"
            onClick={onStatus}
          >
            <AdminTableIcon
              name="status"
              className={
                String(status).toLowerCase() === "inactive" ? "inactive" : ""
              }
            />
          </button>
          <button
            type="button"
            title="Preview booking"
            className="icon-button"
            onClick={onPreview}
          >
            <ActionImage name="bspreview.gif" />
          </button>
          <button
            type="button"
            title="Delete booking"
            className="icon-button"
            onClick={onDelete}
          >
            <ActionImage name="delete.gif" />
          </button>
          <button
            type="button"
            title="Send payment link"
            className="icon-button"
            onClick={onPaymentLink}
          >
            <ActionImage name="Payment.png" />
          </button>
          <button
            type="button"
            title="Refund"
            className="icon-button"
            onClick={onRefund}
          >
            <AdminTableIcon name="undo" />
          </button>
        </>
      )}
    </div>
  );
}

export default function TripSectionPage({
  title,
  description,
  recent = false,
  payments = false,
  makePayments = false,
  onDownload,
  onNavigate,
  onEditNavigate,
  onDeleteBooking,
}) {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [tripFilter, setTripFilter] = useState("");
  const [tripOptions, setTripOptions] = useState([]);
  const [sort, setSort] = useState({ key: "booking_date", direction: "desc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [paymentEdits, setPaymentEdits] = useState({});
  const paymentEditSnapshot = useRef(null);
  const [savingPayments, setSavingPayments] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [previewBooking, setPreviewBooking] = useState(null);
  const [refundBooking, setRefundBooking] = useState(null);
  const [refundRows, setRefundRows] = useState([]);
  const [refundAmounts, setRefundAmounts] = useState({});
  const [paymentLinkBooking, setPaymentLinkBooking] = useState(null);
  const [paymentLinkAmount, setPaymentLinkAmount] = useState("");
  const [paymentLinkMode, setPaymentLinkMode] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    setLoading(true);
    Promise.all([
      api(
        makePayments
          ? "/api/make-payments"
          : payments
            ? "/api/trip-bookings/payments"
            : `/api/trip-bookings${recent ? "?recent=true" : ""}`,
      ),
      payments ? Promise.resolve(null) : api("/api/trip-bookings/options"),
    ])
      .then(([data, options]) => {
        const nextRows = Array.isArray(data) ? data : data?.rows;
        setRows(Array.isArray(nextRows) ? nextRows : []);
        if (payments) {
          const initialEdits = Object.fromEntries(
            (Array.isArray(nextRows) ? nextRows : []).map((row) => [
              row.id,
              {
                amount: row.amount ?? "",
                payment_date: row.payment_date
                  ? String(row.payment_date).slice(0, 10)
                  : "",
              },
            ]),
          );
          setPaymentEdits(initialEdits);
          paymentEditSnapshot.current = serializeComparableForm(initialEdits);
        }
        setTripOptions(Array.isArray(options?.trips) ? options.trips : []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [payments, makePayments, recent]);
  const paymentBookingId = payments
    ? new URLSearchParams(window.location.search).get("booking_id")
    : null;
  const canSort = (payments || makePayments) && !paymentBookingId;
  const columns = makePayments
    ? makePaymentColumns
    : payments
      ? paymentBookingId
        ? bookingPaymentColumns
        : paymentColumns
      : bookingColumns;
  const filteredRows = rows
    .filter(
      (row) =>
        !paymentBookingId ||
        String(row.booking_id) === String(paymentBookingId),
    )
    .filter((row) => !tripFilter || String(row.trip_id) === String(tripFilter))
    .filter((row) => {
      const term = search.trim().toLowerCase();
      if (!term) return true;
      return columns.some(
        ([, key]) =>
          key !== "actions" &&
          String(displayValue(row, key)).toLowerCase().includes(term),
      );
    });
  const visibleRows = canSort
    ? [...filteredRows].sort((a, b) => {
        const left = String(
          a[sort.key] ?? displayValue(a, sort.key),
        ).toLowerCase();
        const right = String(
          b[sort.key] ?? displayValue(b, sort.key),
        ).toLowerCase();
        return (
          left.localeCompare(right, undefined, { numeric: true }) *
          (sort.direction === "asc" ? 1 : -1)
        );
      })
    : filteredRows;
  const pageCount = Math.max(1, Math.ceil(visibleRows.length / pageSize));
  const pagedRows = visibleRows.slice((page - 1) * pageSize, page * pageSize);
  const paymentSummary = payments ? visibleRows[0] : null;
  function toggleSort(key) {
    if (!canSort || key === "actions") return;
    setSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  }
  async function savePayments() {
    if (!paymentBookingId) return;
    const currentEdits = serializeComparableForm(paymentEdits);
    if (paymentEditSnapshot.current === currentEdits) {
      setPaymentMessage("Sorry, nothing is updated.");
      return;
    }
    setSavingPayments(true);
    setPaymentMessage("");
    try {
      const result = await api(
        `/api/trip-bookings/${paymentBookingId}/payments`,
        {
          method: "PATCH",
          body: {
            payments: rows.map((row) => ({
              id: row.id,
              ...paymentEdits[row.id],
            })),
          },
        },
      );
      setPaymentMessage(
        result.message || "Payment details updated successfully.",
      );
      paymentEditSnapshot.current = currentEdits;
    } catch (err) {
      setPaymentMessage(err.message);
    } finally {
      setSavingPayments(false);
    }
  }
  async function deletePayment(paymentId) {
    if (!window.confirm("Are you sure, you want to delete this payment?"))
      return;
    try {
      await api(
        makePayments
          ? `/api/make-payments/${paymentId}`
          : `/api/trip-payments/${paymentId}`,
        { method: "DELETE" },
      );
      setRows((current) => current.filter((row) => row.id !== paymentId));
      setPaymentMessage("Payment details deleted successfully.");
    } catch (err) {
      setPaymentMessage(err.message);
    }
  }
  async function changeBookingStatus(row) {
    const status =
      String(row.status || "Active").toLowerCase() === "active"
        ? "Inactive"
        : "Active";
    try {
      await api(`/api/trip-bookings/${row.id}/status`, {
        method: "PATCH",
        body: { status },
      });
      setRows((current) =>
        current.map((item) =>
          item.id === row.id ? { ...item, status } : item,
        ),
      );
      setPaymentMessage(`Booking status updated successfully: ${status}.`);
    } catch (err) {
      setError(err.message);
    }
  }
  async function openBookingPreview(row) {
    const bookingWindow = window.open(
      "",
      "Nl",
      "width=600,height=400,scrollbars=yes",
    );
    if (!bookingWindow) {
      setError("The booking details window was blocked by the browser.");
      return;
    }
    bookingWindow.document.write(
      "<p style='font:16px Arial;padding:16px'>Loading booking details...</p>",
    );
    try {
      const detail = await api(`/api/trip-bookings/${row.id}`);
      const booking = { ...row, ...detail };
      const lines = [
        ["Trip Details", booking.trip_name],
        [
          "User Details",
          [
            booking.first_name,
            booking.last_name,
            booking.street_address,
            booking.city,
            booking.state,
            booking.postal_code,
            booking.country,
          ]
            .filter(Boolean)
            .join("\n"),
        ],
        ["Party Number", booking.party_number],
        ["Additional Client Details", booking.additional_users],
        ["Rooming Preference", booking.rooming_preference],
        ["Bedding Preference", booking.bed_preference],
        ["Physical Or medical Conditions", booking.physical_medical_conditions],
        ["Special Dietary Requirements", booking.special_dietary_requirements],
        ["Hear About Us", booking.hear_about_us],
        ["Special Comments & Questions", booking.special_comments],
        ["Flight Arrival Details", booking.flight_arrival_details],
        ["Flight Departure Details", booking.flight_departure_details],
        [
          "Payment Due",
          `$${Number(booking.payment_due || booking.trip_payment_due || 0).toFixed(2)}`,
        ],
      ];
      const escapeHtml = (value) =>
        String(value ?? "-").replace(
          /[&<>\"']/g,
          (char) =>
            ({
              "&": "&amp;",
              "<": "&lt;",
              ">": "&gt;",
              '"': "&quot;",
              "'": "&#39;",
            })[char],
        );
      bookingWindow.document.open();
      bookingWindow.document.write(
        `<!doctype html><html><head><title>Booking Details</title><style>body{margin:8px;background:#ddd;font:13px Arial;color:#000}h1{font: bold 32px Georgia;margin:12px 0}table{border-collapse:collapse;width:100%}td{padding:3px 4px;vertical-align:top;border-bottom:1px solid #eee;white-space:pre-line}td:first-child{width:25%;font-weight:bold;background:#bbb}td:last-child{background:#aaa}</style></head><body><h1>Booking Details</h1><table>${lines.map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`).join("")}</table></body></html>`,
      );
      bookingWindow.document.close();
    } catch (err) {
      bookingWindow.close();
      setError(err.message);
    }
  }
  function openPaymentLink(row) {
    setError("");
    setPaymentMessage("");
    setPaymentLinkBooking(row);
    setPaymentLinkAmount("");
    setPaymentLinkMode("");
  }
  async function sendPaymentLink(type) {
    if (!paymentLinkBooking) return;
    const apiType = type === "admin" ? "define_admin" : type;
    const amount = ["due", "custom"].includes(apiType)
      ? Number(paymentLinkBooking.payment_due || 0)
      : Number(paymentLinkAmount);
    if (!amount || amount <= 0) {
      setError("Please enter a valid payment amount.");
      return;
    }
    try {
      const result = await api(
        `/api/trip-bookings/${paymentLinkBooking.id}/payment-link`,
        { method: "POST", body: { type: apiType, amount } },
      );
      setPaymentMessage(result.message);
      setPaymentLinkBooking(null);
    } catch (err) {
      setError(err.message);
    }
  }
  function confirmPaymentLink(type) {
    const messages = {
      due: "Are you sure you want to send the Total Due Amount payment link?",
      custom: "Are you sure you want to send the User Defined Payment link?",
    };
    if (type === "admin") {
      setPaymentLinkMode("admin");
      return;
    }
    if (window.confirm(messages[type])) sendPaymentLink(type);
  }
  async function openRefund(row) {
    try {
      setRefundBooking(row);
      setRefundRows(await api(`/api/trip-bookings/${row.id}/refunds`));
      setRefundAmounts({});
    } catch (err) {
      setError(err.message);
    }
  }
  async function processRefund(payment) {
    const amount = Number(
      refundAmounts[payment.payment_id] ?? payment.refundable_balance,
    );
    if (!amount || amount <= 0 || amount > Number(payment.refundable_balance))
      return;
    try {
      const result = await api(
        `/api/trip-payments/${payment.payment_id}/refund`,
        { method: "POST", body: { amount } },
      );
      setPaymentMessage(
        [result.message, result.emailWarning].filter(Boolean).join(" "),
      );
      setRefundBooking(null);
    } catch (err) {
      setError(err.message);
    }
  }
  const pageSizeControl = (
    <label className="table-page-size">
      Show{" "}
      <select
        value={pageSize}
        onChange={(event) => {
          setPageSize(Number(event.target.value));
          setPage(1);
        }}
      >
        {[10, 25, 50, 100].map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>{" "}
      entries
    </label>
  );
  return (
    <section className="admin-box box-primary module-table-panel">
      {/* <div className="box-header with-border">
        <h3 className="box-title">{title}</h3>
      </div> */}
      <div className={`box-body admin-loading-box-body`}>
        {loading && (
          <div
            className="admin-full-page-loader"
            role="status"
            aria-live="polite"
          >
            <span className="admin-spinner" /> Loading data...
          </div>
        )}
        {/* <p className="cell-muted">{description}</p> */}
        {error && (
          <div className="alert error" role="alert">
            <button
              type="button"
              className="admin-alert-close"
              onClick={() => setError("")}
              aria-label="Close"
            >
              ×
            </button>
            {error}
          </div>
        )}
        {paymentMessage && (
          <div
            className={
              paymentMessage === "Sorry, nothing is updated."
                ? "alert warning"
                : "trip-success-alert"
            }
            role="alert"
          >
            <button
              type="button"
              className="trip-success-alert-close"
              onClick={() => setPaymentMessage("")}
              aria-label="Close"
            >
              ×
            </button>
            <div className="trip-success-alert-title">
              <span aria-hidden="true">✓</span> Alert!
            </div>
            <div>{paymentMessage}</div>
          </div>
        )}
        {paymentSummary && (
          <div className="payment-detail-summary">
            <h3>Payment Details</h3>
            <dl>
              <dt>Trip Details</dt>
              <dd>{paymentSummary.trip_name || "-"}</dd>
              <dt>User Details</dt>
              <dd>
                {[
                  `${paymentSummary.customer_first_name || ""} ${paymentSummary.customer_last_name || ""}`.trim(),
                  paymentSummary.customer_street_address,
                  paymentSummary.customer_street_address1,
                  `${paymentSummary.customer_city || ""}${paymentSummary.customer_state ? `, ${paymentSummary.customer_state}` : ""} ${paymentSummary.customer_postal_code || ""}`.trim(),
                  paymentSummary.customer_country,
                ]
                  .filter(Boolean)
                  .map((line, index) => (
                    <React.Fragment key={`${line}-${index}`}>
                      {index > 0 && <br />}
                      {line}
                    </React.Fragment>
                  ))}
              </dd>
              <dt>Booking Date</dt>
              <dd>{displayDate(paymentSummary.booking_date)}</dd>
              <dt>Trip Date Details</dt>
              <dd>{displayLines(paymentSummary.trip_dates)}</dd>
              <dt>Booking For</dt>
              <dd>
                {paymentSummary.booking_start_date != null
                  ? `${displayDate(paymentSummary.booking_start_date)} to ${displayDate(paymentSummary.booking_end_date)}`
                  : "-"}
              </dd>
              <dt>Total Payment</dt>
              <dd>
                {displayValue(paymentSummary, "total_payment")}
                {/* {paymentSummary.additional_payment
                  ? ` (excluding single supplement $${paymentSummary.additional_payment})`
                  : ""} */}
              </dd>
              {paymentSummary.additional_prices && (
                <>
                  <dt>Additional Prices</dt>
                  <dd>{displayLines(paymentSummary.additional_prices)}</dd>
                </>
              )}
              <dt>Payment Due</dt>
              <dd>{displayValue(paymentSummary, "payment_due")}</dd>
            </dl>
          </div>
        )}
        {!payments && (
          <div
            className={`data-toolbar${makePayments ? " make-payment-toolbar" : ""}${recent ? " recent-booking-toolbar" : ""}`}
          >
            <div className="table-toolbar-left">
              {!makePayments && (
                <span className="table-search-title">Search Booking</span>
              )}
              {!makePayments && (
                <div className="table-trip-filter">
                  <SearchableSelect
                    bare
                    label="Search By Trip"
                    value={tripFilter}
                    placeholder="--- Search By Trip ---"
                    onChange={(event) => {
                      setTripFilter(event.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">--- Search By Trip ---</option>
                    {[...tripOptions]
                      .sort((left, right) =>
                        left.name.localeCompare(right.name, undefined, {
                          sensitivity: "base",
                          numeric: true,
                        }),
                      )
                      .map((trip) => (
                        <option key={trip.id} value={trip.id}>
                          {trip.name}
                        </option>
                      ))}
                  </SearchableSelect>
                </div>
              )}
              {!makePayments && (
                <input
                  className="form-control table-text-search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search Text"
                  aria-label="Search Text"
                />
              )}
            </div>
            <div
              className="table-page-size-row"
              style={{ flexDirection: makePayments ? "row-reverse" : "row" }}
            >
              {pageSizeControl}
              {makePayments && (
                <div style={{ display: "flex", gap: "8px" }}>
                  <label htmlFor="">Search:</label>
                  <input
                    className="form-control table-text-search"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                    placeholder="Search Text"
                    aria-label="Search Text"
                  />
                </div>
              )}
            </div>
          </div>
        )}
        {!payments && onDownload && (
          <button
            className="btn btn-primary table-action-button"
            onClick={() => onDownload(rows)}
          >
            <Icon name="download" size={14} /> Download CSV
          </button>
        )}
        <div className="table-scroll">
          <table
            className={`table table-bordered table-hover dataTable align-middle admin-table module-admin-table${paymentBookingId ? " payment-detail-table" : ""}${makePayments ? " make-payment-table" : ""}${!payments && !makePayments ? " trip-booking-table" : ""}`}
          >
            <thead>
              <tr>
                {columns.map(([label, key]) => (
                  <th
                    key={label}
                    onClick={canSort ? () => toggleSort(key) : undefined}
                    className={
                      !canSort || key === "actions"
                        ? "no-sort"
                        : `sortable ${
                            sort.key === key
                              ? sort.direction === "asc"
                                ? "sorting_asc"
                                : "sorting_desc"
                              : "sorting"
                          }`
                    }
                  >
                    {!canSort || key === "actions" ? (
                      label
                    ) : (
                      <button type="button" className="sort-button">
                        {label}
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((row) => (
                <tr key={row.id}>
                  {columns.map(([, key]) => (
                    <td
                      key={key}
                      className={key === "actions" ? "table-actions-cell" : ""}
                    >
                      {key === "actions" ? (
                        <ActionIcons
                          payments={payments || makePayments}
                          status={row.status}
                          onViewPayment={() =>
                            onNavigate?.(
                              `/administrator/trip-payment?booking_id=${row.id}`,
                            )
                          }
                          onDeletePayment={() => deletePayment(row.id)}
                          onEdit={() =>
                            onEditNavigate?.(
                              `/administrator/trip-booking/${row.id}/edit`,
                            )
                          }
                          onStatus={() => changeBookingStatus(row)}
                          onPreview={() => openBookingPreview(row)}
                          onPaymentLink={() => openPaymentLink(row)}
                          onRefund={() => openRefund(row)}
                          onDelete={() => {
                            const result = onDeleteBooking?.(row);
                            Promise.resolve(result).then(() =>
                              setRows((current) =>
                                current.filter((item) => item.id !== row.id),
                              ),
                            );
                          }}
                        />
                      ) : paymentBookingId && key === "amount" ? (
                        <input
                          className="form-control"
                          type="number"
                          min="0"
                          step="0.01"
                          value={paymentEdits[row.id]?.amount ?? ""}
                          onChange={(event) =>
                            setPaymentEdits((current) => ({
                              ...current,
                              [row.id]: {
                                ...current[row.id],
                                amount: event.target.value,
                              },
                            }))
                          }
                        />
                      ) : paymentBookingId && key === "payment_date" ? (
                        <input
                          className="form-control"
                          type="date"
                          value={paymentEdits[row.id]?.payment_date ?? ""}
                          onChange={(event) =>
                            setPaymentEdits((current) => ({
                              ...current,
                              [row.id]: {
                                ...current[row.id],
                                payment_date: event.target.value,
                              },
                            }))
                          }
                        />
                      ) : (
                        displayValue(row, key)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && !pagedRows.length && !error && (
            <p className="empty-state">No booking records found.</p>
          )}
        </div>
        {paymentBookingId && (
          <div className="payment-submit-row">
            <button
              type="button"
              className="btn btn-primary"
              onClick={savePayments}
              disabled={savingPayments}
            >
              {savingPayments ? "Saving..." : "Submit"}
            </button>
          </div>
        )}
        {!paymentBookingId && (
          <div className="table-pagination">
            <div className="table-pagination-info">
              Showing {visibleRows.length ? (page - 1) * pageSize + 1 : 0} to{" "}
              {Math.min(page * pageSize, visibleRows.length)} of{" "}
              {visibleRows.length} entries
              {visibleRows.length !== rows.length
                ? ` (filtered from ${rows.length} total entries)`
                : ""}
            </div>
            <div className="table-pagination-controls">
              <nav className="pagination" aria-label="Booking pages">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                >
                  Previous
                </button>
                {getPaginationItems(page, pageCount).map((pageNumber, index) =>
                  pageNumber === "ellipsis" ? (
                    <span
                      className="pagination-ellipsis"
                      key={`ellipsis-${index}`}
                    >
                      ...
                    </span>
                  ) : (
                    <button
                      type="button"
                      className={pageNumber === page ? "active" : ""}
                      aria-current={pageNumber === page ? "page" : undefined}
                      key={pageNumber}
                      onClick={() => setPage(pageNumber)}
                    >
                      {pageNumber}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  disabled={page >= pageCount}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                </button>
              </nav>
            </div>
          </div>
        )}
        {previewBooking &&
          createPortal(
            <div
              className="booking-preview-overlay"
              role="dialog"
              aria-modal="true"
              aria-label="Booking Details"
              onMouseDown={(event) =>
                event.target === event.currentTarget && setPreviewBooking(null)
              }
            >
              <div className="booking-preview-window">
                <div className="booking-preview-header">
                  <h3>Booking Details</h3>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => setPreviewBooking(null)}
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>
                <dl className="booking-preview-details">
                  <dt>Trip Details</dt>
                  <dd>{previewBooking.trip_name || "-"}</dd>
                  <dt>User Details</dt>
                  <dd>
                    {[
                      previewBooking.first_name,
                      previewBooking.last_name,
                      previewBooking.street_address,
                      previewBooking.city,
                      previewBooking.state,
                      previewBooking.postal_code,
                      previewBooking.country,
                    ]
                      .filter(Boolean)
                      .join("\n") || "-"}
                  </dd>
                  <dt>Party Number</dt>
                  <dd>{previewBooking.party_number || "-"}</dd>
                  <dt>Rooming Preference</dt>
                  <dd>{previewBooking.rooming_preference || "-"}</dd>
                  <dt>Bedding Preference</dt>
                  <dd>{previewBooking.bed_preference || "-"}</dd>
                  <dt>Special Dietary Requirements</dt>
                  <dd>{previewBooking.special_dietary_requirements || "-"}</dd>
                  <dt>Special Comments &amp; Questions</dt>
                  <dd>{previewBooking.special_comments || "-"}</dd>
                  <dt>Flight Arrival Details</dt>
                  <dd>{previewBooking.flight_arrival_details || "-"}</dd>
                  <dt>Flight Departure Details</dt>
                  <dd>{previewBooking.flight_departure_details || "-"}</dd>
                  <dt>Payment Due</dt>
                  <dd>{displayValue(previewBooking, "payment_due")}</dd>
                </dl>
              </div>
            </div>,
            document.body,
          )}
        {refundBooking &&
          createPortal(
            <div
              className="booking-preview-overlay"
              role="dialog"
              aria-modal="true"
              onMouseDown={(event) =>
                event.target === event.currentTarget && setRefundBooking(null)
              }
            >
              <div className="booking-refund-window">
                <div className="booking-preview-header">
                  <h3>Manage Refunds</h3>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => setRefundBooking(null)}
                  >
                    ×
                  </button>
                </div>
                <table className="table table-bordered refund-modal-table">
                  <thead>
                    <tr>
                      <th>Payment Date</th>
                      <th>Amount</th>
                      <th>Refunded</th>
                      <th>Remaining</th>
                      <th>Status</th>
                      <th>Transaction ID</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {refundRows.map((payment) => (
                      <tr key={payment.payment_id}>
                        <td>{displayNumericDate(payment.payment_date)}</td>
                        <td>${Number(payment.payment_price).toFixed(2)}</td>
                        <td>${Number(payment.refunded_amount).toFixed(2)}</td>
                        <td>
                          ${Number(payment.refundable_balance).toFixed(2)}
                        </td>
                        <td>{payment.refund_status || "-"}</td>
                        <td>{payment.transaction_id || "-"}</td>
                        <td>
                          {payment.transaction_id &&
                          Number(payment.refundable_balance) > 0 ? (
                            <div className="refund-inline-action">
                              <input
                                className="form-control"
                                type="number"
                                min="0.01"
                                max={payment.refundable_balance}
                                step="0.01"
                                value={
                                  refundAmounts[payment.payment_id] ??
                                  Number(payment.refundable_balance).toFixed(2)
                                }
                                onChange={(event) =>
                                  setRefundAmounts((current) => ({
                                    ...current,
                                    [payment.payment_id]: event.target.value,
                                  }))
                                }
                              />
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => processRefund(payment)}
                              >
                                Refund
                              </button>
                            </div>
                          ) : payment.transaction_id ? (
                            "Fully refunded"
                          ) : (
                            "No transaction id"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>,
            document.body,
          )}
        {paymentLinkBooking &&
          createPortal(
            <div
              className="booking-preview-overlay"
              role="dialog"
              aria-modal="true"
              onMouseDown={(event) =>
                event.target === event.currentTarget &&
                setPaymentLinkBooking(null)
              }
            >
              <div className="payment-link-modal">
                <button
                  type="button"
                  className="payment-link-close"
                  onClick={() => setPaymentLinkBooking(null)}
                  aria-label="Close"
                >
                  ×
                </button>
                <h3>Share The Payment Link</h3>
                <p className="payment-link-total">
                  Total due Amount $
                  {Number(paymentLinkBooking.payment_due || 0).toFixed(2)}
                </p>
                <div className="payment-link-actions">
                  <button
                    type="button"
                    className="btn btn-default"
                    onClick={() => confirmPaymentLink("due")}
                  >
                    Pay Total Due Amount
                  </button>
                  <button
                    type="button"
                    className="btn btn-default"
                    onClick={() => confirmPaymentLink("custom")}
                  >
                    Pay User Defined Amount
                  </button>
                  <button
                    type="button"
                    className="btn btn-default"
                    onClick={() => confirmPaymentLink("admin")}
                  >
                    Pay Admin defined Custom Amount
                  </button>
                </div>
                {paymentLinkMode && (
                  <div className="payment-link-custom">
                    <input
                      autoFocus
                      className="form-control"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={paymentLinkAmount}
                      onChange={(event) =>
                        setPaymentLinkAmount(event.target.value)
                      }
                      placeholder="Enter Amount"
                    />
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() =>
                        window.confirm(
                          "Are you sure you want to send the Admin Defined Custom Amount payment link?",
                        ) && sendPaymentLink(paymentLinkMode)
                      }
                    >
                      Submit
                    </button>
                  </div>
                )}
              </div>
            </div>,
            document.body,
          )}
      </div>
    </section>
  );
}
