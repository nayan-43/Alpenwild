import React from "react";
import ModuleTable from "@/components/admin/ModuleTable";
import { adminThumbnailUrl } from "@/lib/assets";

const priceFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const columns = [
  { label: "ID", key: "id" },
  { label: "Name", key: "name" },
  { label: "Category", key: "category_name" },
  { label: "Short Description", key: "short_descriptions" },
  {
    label: "Listing Image",
    key: "listing_image",
    searchable: false,
    render: (row) =>
      row.listing_image_url ? (
        <img
          className="thumb"
          src={adminThumbnailUrl(row.listing_image_url)}
          alt={row.listing_image_alt || row.name}
        />
      ) : (
        "—"
      ),
  },
  {
    label: "Price Details",
    key: "price",
    render: (row) => priceFormatter.format(Number(row.price || 0)),
  },
  { label: "Order", key: "display_order" },
  { label: "Status", key: "status" },
];

export default function ManageProductPage(props) {
  return (
    <ModuleTable
      {...props}
      rows={props.items}
      columns={columns}
      initialSortKey="display_order"
    />
  );
}
