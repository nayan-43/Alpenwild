import React from "react";
import ModuleTable from "@/components/admin/ModuleTable";
import { adminThumbnailUrl } from "@/lib/assets";

const columns = [
  { label: "ID", key: "id" },
  { label: "Trip Name", key: "trip_name" },
  {
    label: "Image",
    key: "image_url",
    searchable: false,
    render: (row) =>
      row.image_url ? (
        <img
          className="thumb"
          src={adminThumbnailUrl(row.image_url)}
          alt={row.image_alt || row.trip_name}
        />
      ) : (
        "No Image"
      ),
  },
  { label: "Video", key: "video_url" },
  { label: "Order", key: "display_order" },
  { label: "Status", key: "status" },
];

export default function ManageTripGalleryPage(props) {
  return (
    <ModuleTable
      {...props}
      rows={props.items}
      columns={columns}
      initialSortKey="display_order"
    />
  );
}
