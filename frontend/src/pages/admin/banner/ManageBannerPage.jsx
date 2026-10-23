import React from "react";
import BannerTable from "./BannerTable";

export default function ManageBannerPage({
  banners,
  onToggle,
  onDelete,
  onAdd,
  onEdit,
}) {
  return (
    <div className="admin-row">
      <div className="admin-col-full">
        <BannerTable
          banners={banners}
          onToggle={onToggle}
          onDelete={onDelete}
          onAdd={onAdd}
          onEdit={onEdit}
        />
      </div>
    </div>
  );
}
