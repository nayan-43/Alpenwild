import React from "react";
import ModuleTable from "@/components/admin/ModuleTable";
import { adminThumbnailUrl } from "@/lib/assets";

const columns = [
  { label: "ID", key: "id" },
  { label: "Name", key: "name" },
  { label: "Menu Name", key: "menu_name" },
  { label: "Meta Title", key: "meta_title" },
  { label: "Meta Descriptions", key: "meta_descriptions" },
  { label: "Meta Keywords", key: "meta_keywords" },
  {
    label: "Listing Image",
    key: "listing_image",
    searchable: false,
    render: (row) => (
      <div className="thumb">
        <img src={adminThumbnailUrl(row.listing_image_url)} alt={row.name} />
      </div>
    ),
  },
  { label: "Order", key: "display_order" },
  { label: "Status", key: "status" },
];

export default function ManageCategoryPage(props) {
  return (
    <ModuleTable
      {...props}
      rows={props.items}
      columns={columns}
      initialSortKey="name"
    />
  );
}
