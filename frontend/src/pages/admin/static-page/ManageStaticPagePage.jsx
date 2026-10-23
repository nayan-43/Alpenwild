import React from "react";
import ModuleTable from "../../../components/admin/ModuleTable";
import { AdminTableIcon } from "../../../components/admin/Icon";

const columns = [
  { label: "ID", key: "id" },
  {
    label: "Name",
    key: "name",
    render: (row) => (
      <>
        {row.id === 65 && (
          <strong className="static-page-old-marker">Old</strong>
        )}
        {row.id === 65 ? " " : ""}
        {row.name}
      </>
    ),
  },
  {
    label: "Menu Name",
    key: "menu_name",
    render: (row) => (
      <>
        {row.id === 65 && (
          <strong className="static-page-old-marker">Old</strong>
        )}
        {row.id === 65 ? " " : ""}
        {row.menu_name}
      </>
    ),
  },
  { label: "Slug", key: "slug", render: (row) => row.slug || "" },
  {
    label: "Meta Title",
    key: "meta_title",
    render: (row) => row.meta_title || "",
  },
  {
    label: "Meta Descriptions",
    key: "meta_descriptions",
    render: (row) => row.meta_descriptions || "",
  },
  {
    label: "Order",
    key: "display_order",
    render: (row) => row.display_order ?? "",
  },
  { label: "Status", key: "status", render: (row) => row.status || "" },
];

export default function ManageStaticPagePage(props) {
  return (
    <ModuleTable
      {...props}
      rows={props.items}
      columns={columns}
      initialSortKey="name"
      renderActions={(row) => (
        <>
          <button title="Edit" onClick={() => props.onEdit(row)}>
            <AdminTableIcon name="edit" />
          </button>
          <button title="Change Status" onClick={() => props.onToggle(row)}>
            <AdminTableIcon
              name="status"
              className={
                String(row.status).toLowerCase() === "inactive"
                  ? "inactive"
                  : ""
              }
            />
          </button>
          <button title="Delete" onClick={() => props.onDelete(row)}>
            <AdminTableIcon name="close" />
          </button>
          <button
            title="Copy Page URL to Clipboard"
            onClick={() => props.onCopyUrl(row)}
          >
            <AdminTableIcon name="clipboard" />
          </button>
        </>
      )}
    />
  );
}
