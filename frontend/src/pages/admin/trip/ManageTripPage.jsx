import React from "react";
import ModuleTable from "@/components/admin/ModuleTable";
import { AdminTableIcon } from "@/components/admin/Icon";

function formatTripDate(value) {
  if (!value) return "";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
}

function depositDetails(row) {
  return String(row.deposit_amount_text || "").replace(
    /#depositamount#/g,
    `$${row.deposit_amount ?? 0}`,
  );
}

function priceDetails(row) {
  return `$${row.price ?? 0} ${row.price_text || ""}`.trim();
}

function dateDetails(row) {
  return (row.dates || [])
    .filter((date) => date.status !== "Temp Delete")
    .map((date) => {
      const range =
        row.available_for !== "Specefic Date" && date.date_range
          ? ` for ${date.date_range} days`
          : "";
      return `${formatTripDate(date.start_date)} - ${formatTripDate(date.end_date)}${range}`;
    })
    .join("\n");
}

const columns = [
  { label: "ID", key: "id" },
  { label: "Name", key: "name" },
  { label: "Trip Type", key: "type_name" },
  { label: "Location", key: "location_name" },
  {
    label: "Deposit Details",
    key: "deposit_amount",
    render: depositDetails,
    searchValue: depositDetails,
  },
  {
    label: "Price Details",
    key: "price",
    render: priceDetails,
    searchValue: priceDetails,
  },
  {
    label: "Date Details",
    key: "dates",
    render: (row) => <span className="preserve-lines">{dateDetails(row)}</span>,
    searchValue: dateDetails,
  },
  { label: "Order", key: "display_order" },
  { label: "Status", key: "status" },
];

export default function ManageTripPage(props) {
  return (
    <ModuleTable
      {...props}
      rows={props.items}
      columns={columns}
      initialSortKey="display_order"
      notice={props.notice}
      onDismissNotice={props.onDismissNotice}
      renderActions={(row) => (
        <>
          <button title="FAQ" onClick={() => props.onFaq(row)}>
            <AdminTableIcon name="question" />
          </button>
          <button title="Edit" onClick={() => props.onEdit(row)}>
            <AdminTableIcon name="edit" />
          </button>
          <button title="Change status" onClick={() => props.onToggle(row)}>
            <AdminTableIcon
              name="status"
              className={
                String(row.status).toLowerCase() === "inactive"
                  ? "inactive"
                  : ""
              }
            />
          </button>
          <button title="Delete" onClick={() => props.onDelete(row)}>
            <AdminTableIcon name="close" />
          </button>
          <button title="Itinerary" onClick={() => props.onItinerary(row)}>
            <AdminTableIcon name="map" />
          </button>
        </>
      )}
    />
  );
}
