import React, { useEffect, useState } from "react";
import ModuleTable from "@/components/admin/ModuleTable";
import { AdminTableIcon } from "@/components/admin/Icon";
import { adminThumbnailUrl } from "@/lib/assets";

export default function ManageTripLeaderPage(props) {
  const [orders, setOrders] = useState({});
  useEffect(() => {
    setOrders(
      Object.fromEntries(
        props.items.map((item) => [item.id, item.display_order ?? 1]),
      ),
    );
  }, [props.items]);

  const columns = [
    { label: "ID", key: "id" },
    { label: "Name", key: "guide_name" },
    {
      label: "Image",
      key: "listing_image_url",
      searchable: false,
      render: (row) =>
        row.listing_image_url ? (
          <img
            className="thumb"
            src={adminThumbnailUrl(row.listing_image_url)}
            alt={row.name}
          />
        ) : (
          "—"
        ),
    },
    { label: "Title", key: "name" },
    { label: "Meta Title", key: "meta_title" },
    { label: "Meta Description", key: "meta_description" },
    {
      label: "Order",
      key: "display_order",
      render: (row) => (
        <input
          className="table-order-input"
          type="number"
          min="1"
          value={orders[row.id] ?? row.display_order ?? 1}
          onChange={(event) =>
            setOrders((current) => ({
              ...current,
              [row.id]: event.target.value,
            }))
          }
        />
      ),
    },
    { label: "Status", key: "status" },
  ];

  const renderActions = (row) => (
    <>
      <button title="Edit" onClick={() => props.onEdit(row)}>
        <AdminTableIcon name="edit" />
      </button>
      <button title="Change status" onClick={() => props.onToggle(row)}>
        <AdminTableIcon
          name="status"
          className={
            String(row.status).toLowerCase() === "inactive" ? "inactive" : ""
          }
        />
      </button>
      <button title="Delete" onClick={() => props.onDelete(row)}>
        <AdminTableIcon name="close" />
      </button>
      <button title="Copy Page URL" onClick={() => props.onCopyUrl(row)}>
        <AdminTableIcon name="clipboard" />
      </button>
    </>
  );

  return (
    <ModuleTable
      {...props}
      rows={props.items}
      columns={columns}
      initialSortKey="guide_name"
      renderActions={renderActions}
      footerActions={
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => props.onSaveOrder(orders)}
        >
          Submit
        </button>
      }
    />
  );
}
