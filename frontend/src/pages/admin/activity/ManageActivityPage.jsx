import React from "react";
import ModuleTable from "@/components/admin/ModuleTable";

const columns = [
  { label: "ID", key: "id" },
  { label: "Name", key: "name" },
  { label: "Status", key: "status" },
];

export default function ManageActivityPage(props) {
  return (
    <ModuleTable
      {...props}
      rows={props.items}
      columns={columns}
      initialSortKey="name"
    />
  );
}
