import React from "react";
import ModuleTable from "@/components/admin/ModuleTable";
import { AdminTableIcon } from "@/components/admin/Icon";

const columns = [
  { label: "ID", key: "id" },
  { label: "Last Name", key: "last_name" },
  { label: "First Name", key: "first_name" },
  { label: "Email Address", key: "email_address" },
  { label: "User Type", key: "user_type" },
  { label: "Date of Inquiry", key: "date_of_inquiry" },
  { label: "Source of Inquiry", key: "source_of_inquiry" },
  {
    label: "Option for Newsletter Signup",
    key: "newsletter_signup_option",
    render: (row) =>
      (row.newsletter_signup_option || "")
        .split(/<br\s*\/?>/i)
        .filter(Boolean)
        .map((interest, index) => (
          <React.Fragment key={`${interest}-${index}`}>
            {index > 0 && <br />}
            {interest.replaceAll("â€“", "-")}
          </React.Fragment>
        )),
  },
];

export default function ManageMailingListPage({ onDownload, onAdd, ...props }) {
  return (
    <>
      {/* <div className="mailing-list-toolbar">
        <button className="btn btn-primary" onClick={onDownload}>
          <i className="fa fa-download" aria-hidden="true" /> Download Mailing
          List
        </button>
      </div> */}
      <ModuleTable
        {...props}
        rows={props.items}
        columns={columns}
        initialSortKey="last_name"
        initialSortDirection="desc"
        searchKeys={columns.map(({ key }) => key)}
        renderActions={(row) => (
          <>
            <button title="Edit" onClick={() => props.onEdit(row)}>
              <AdminTableIcon name="edit" />
            </button>
            <button title="Delete" onClick={() => props.onDelete(row)}>
              <AdminTableIcon name="close" />
            </button>
          </>
        )}
      />
    </>
  );
}
