import React from "react";
import PromotionTable from "../promotions/PromotionTable";

export default function ManageSpecialFeaturePage({
  features,
  onToggle,
  onDelete,
  onAdd,
  onEdit,
}) {
  return (
    <div className="admin-row">
      <div className="admin-col-full">
        <PromotionTable
          promotions={features}
          onToggle={onToggle}
          onDelete={onDelete}
          onAdd={onAdd}
          onEdit={onEdit}
          entityLabel="Special Feature"
        />
      </div>
    </div>
  );
}
