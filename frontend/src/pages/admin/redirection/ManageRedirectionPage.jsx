import React from "react";
import ModuleTable from "@/components/admin/ModuleTable";
import { AdminTableIcon } from "@/components/admin/Icon";

const columns = [
  { label: "ID", key: "id" },
  { label: "Old URL", key: "old_redirection_url" },
  { label: "New URL", key: "new_redirection_url" },
];

export default function ManageRedirectionPage({ items, onEdit, onDelete }) {
  return (
    <ModuleTable
      rows={items}
      columns={columns}
      initialSortKey="old_redirection_url"
      onEdit={onEdit}
      onDelete={onDelete}
      renderActions={(row) => (
        <>
          <button title="Edit" onClick={() => onEdit(row)}>
            <AdminTableIcon name="edit" />
          </button>
          <button title="Delete" onClick={() => onDelete(row)}>
            <AdminTableIcon name="close" />
          </button>
        </>
      )}
    />
  );
}
