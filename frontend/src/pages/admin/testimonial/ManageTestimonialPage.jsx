import React from "react";
import ModuleTable from "@/components/admin/ModuleTable";

const columns = [
  { label: "ID", key: "id" },
  { label: "Client Details", key: "client_details" },
  {
    label: "Testimonial",
    key: "content",
    render: (row) => (
      <span title={row.content}>
        {row.content.length > 120
          ? `${row.content.slice(0, 120)}…`
          : row.content}
      </span>
    ),
  },
  { label: "Order", key: "display_order" },
  { label: "Status", key: "status" },
];

export default function ManageTestimonialPage(props) {
  return (
    <ModuleTable
      {...props}
      rows={props.items}
      columns={columns}
      initialSortKey="display_order"
    />
  );
}
