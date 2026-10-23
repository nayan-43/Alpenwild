import React from "react";
import ModuleTable from "@/components/admin/ModuleTable";

const columns = [
  { label: "ID", key: "id" },
  { label: "Type", key: "type_name" },
  { label: "Value", key: "name" },
  { label: "Order", key: "display_order" },
  { label: "Status", key: "status" },
];

const tieBreakKeys = ["name"];

export default function ManageAttributeValuePage(props) {
  return (
    <ModuleTable
      {...props}
      rows={props.items}
      columns={columns}
      initialSortKey="type_name"
      tieBreakKeys={tieBreakKeys}
    />
  );
}
