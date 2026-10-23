import React from "react";
import ModuleTable from "@/components/admin/ModuleTable";
import { AdminTableIcon } from "@/components/admin/Icon";

const columns = [
  { label: "ID", key: "id" },
  {
    label: "Date",
    key: "order_date",
    render: (row) => formatDate(row.order_date),
  },
  { label: "Name", key: "name" },
  { label: "Email", key: "email" },
  {
    label: "Total Price",
    key: "total_price",
    render: (row) => `$${Number(row.total_price).toFixed(2)}`,
  },
  {
    label: "Discount Price",
    key: "discount_price",
    render: (row) => `$${Number(row.discount_price).toFixed(2)}`,
  },
  {
    label: "Shipping Price",
    key: "shipping_price",
    render: (row) => `$${Number(row.shipping_price).toFixed(2)}`,
  },
];

function formatDate(value) {
  if (!value) return "—";
  const date = String(value).split("T")[0];
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "—";
}

export default function ManageOrderPage({ items, onDelete, onView }) {
  return (
    <ModuleTable
      rows={items}
      columns={columns}
      initialSortKey="id"
      initialSortDirection="desc"
      renderActions={(row) => (
        <>
          <button title="View" onClick={() => onView(row)}>
            <AdminTableIcon name="eye" />
          </button>
          <button title="Delete" onClick={() => onDelete(row)}>
            <AdminTableIcon name="close" />
          </button>
        </>
      )}
    />
  );
}
