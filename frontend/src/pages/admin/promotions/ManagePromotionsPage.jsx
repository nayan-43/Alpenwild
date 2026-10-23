import React from "react";
import PromotionTable from "./PromotionTable";

export default function ManagePromotionsPage({
  promotions,
  onToggle,
  onDelete,
  onAdd,
  onEdit,
}) {
  return (
    <div className="admin-row">
      <div className="admin-col-full">
        <PromotionTable
          promotions={promotions}
          onToggle={onToggle}
          onDelete={onDelete}
          onAdd={onAdd}
          onEdit={onEdit}
        />
      </div>
    </div>
  );
}
