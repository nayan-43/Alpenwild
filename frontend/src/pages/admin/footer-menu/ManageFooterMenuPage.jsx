import React from "react";
import ModuleTable from "../../../components/admin/ModuleTable";

const columns = [
  { label: "ID", key: "id" },
  { label: "Title", key: "title" },
  { label: "Under", key: "under" },
  { label: "Link", key: "link" },
  { label: "Order", key: "display_order" },
  { label: "Status", key: "status" },
];

export default function ManageFooterMenuPage(props) {
  return (
    <ModuleTable
      {...props}
      rows={props.items}
      columns={columns}
      initialSortKey="title"
    />
  );
}
