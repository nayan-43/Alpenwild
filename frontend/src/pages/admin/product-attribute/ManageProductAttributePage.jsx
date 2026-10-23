import React from "react";
import ModuleTable from "@/components/admin/ModuleTable";
import { AdminTableIcon } from "@/components/admin/Icon";

const columns = [
  { label: "ID", key: "id" },
  { label: "Product", key: "product_name" },
  { label: "Type", key: "type_name" },
  { label: "Value", key: "value_name" },
];

export default function ManageProductAttributePage(props) {
  return (
    <ModuleTable
      {...props}
      rows={props.items}
      columns={columns}
      initialSortKey="product_name"
      tieBreakKeys={["type_name"]}
      renderActions={(item) => (
        <>
          <button
            className="btn btn-link p-0"
            title="Edit"
            aria-label="Edit product attribute"
            onClick={() => props.onEdit(item)}
          >
            <AdminTableIcon name="edit" />
          </button>
          <button
            className="btn btn-link p-0"
            title="Delete"
            aria-label="Delete product attribute"
            onClick={() => props.onDelete(item)}
          >
            <AdminTableIcon name="close" />
          </button>
        </>
      )}
    />
  );
}
