import React from "react";
import ModuleTable from "@/components/admin/ModuleTable";

const columns = [
  { label: "ID", key: "id" },
  { label: "First Name", key: "user_first_name" },
  { label: "Last Name", key: "user_last_name" },
  { label: "Email", key: "user_email_address" },
  { label: "Phone", key: "user_mobile_phone" },
  { label: "Country", key: "user_country" },
  { label: "Status", key: "status" },
];

export default function ManageUserPage(props) {
  return (
    <ModuleTable
      {...props}
      rows={props.items}
      columns={columns}
      initialSortKey="user_first_name"
      searchKeys={columns.map(({ key }) => key)}
    />
  );
}
