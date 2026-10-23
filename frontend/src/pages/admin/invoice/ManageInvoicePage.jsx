import React from "react";
import ModuleTable from "@/components/admin/ModuleTable";
import { AdminTableIcon } from "@/components/admin/Icon";

const columns = [
  { label: "ID", key: "id" },
  { label: "Email Address", key: "user_email_address" },
  { label: "Activity Name", key: "product_name" },
  {
    label: "Activity Price",
    key: "product_price",
    render: (row) => `$${row.product_price}`,
  },
  { label: "Quantity", key: "party_number" },
  {
    label: "Deposit Amount",
    key: "deposit_amount",
    render: (row) => `$${row.deposit_amount}`,
  },
  {
    label: "Due Amount",
    key: "due_amount",
    render: (row) => `$${row.due_amount}`,
  },
  {
    label: "Invoice Date",
    key: "invoice_date",
    render: (row) => formatDate(row.invoice_date),
  },
  {
    label: "Due Date",
    key: "due_date",
    render: (row) => formatDate(row.due_date),
  },
];

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(`${String(value).split("T")[0]}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
}

export default function ManageInvoicePage(props) {
  return (
    <ModuleTable
      {...props}
      rows={props.items}
      columns={columns}
      initialSortKey="user_email_address"
      renderActions={(row) => (
        <>
          <button title="Edit" onClick={() => props.onEdit(row)}>
            <AdminTableIcon name="edit" />
          </button>
          <button title="Delete" onClick={() => props.onDelete(row)}>
            <AdminTableIcon name="close" />
          </button>
        </>
      )}
    />
  );
}
