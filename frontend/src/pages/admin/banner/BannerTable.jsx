import React, { useMemo, useState } from "react";
import { AdminTableIcon } from "../../../components/admin/Icon";
import { adminThumbnailUrl } from "@/lib/assets";
import { matchesAdminTableSearch } from "@/lib/adminTableSearch";

const PAGE_SIZES = [10, 25, 50, 100];
const COLUMNS = [
  { label: "ID", key: "id" },
  { label: "Title", key: "title" },
  { label: "Sub Heading", key: "sub_heading" },
  { label: "Tooltip Text", key: "tooltip_text" },
  { label: "Banner", key: "image_filename", searchable: false },
  { label: "Status", key: "status" },
  { label: "Order", key: "display_order" },
];

export default function BannerTable({ banners, onToggle, onDelete, onEdit }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sort, setSort] = useState({ key: "title", direction: "asc" });

  const filtered = useMemo(() => {
    return banners.filter((banner) =>
      matchesAdminTableSearch(banner, COLUMNS, search),
    );
  }, [banners, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((left, right) => {
      const first = left[sort.key] ?? "";
      const second = right[sort.key] ?? "";
      const result =
        typeof first === "number" && typeof second === "number"
          ? first - second
          : String(first).localeCompare(String(second), undefined, {
              numeric: true,
              sensitivity: "base",
            });
      return sort.direction === "asc" ? result : -result;
    });
  }, [filtered, sort]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pages);
  const visible = sorted.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  function updateSearch(event) {
    setSearch(event.target.value);
    setPage(1);
  }

  function updatePageSize(event) {
    setPageSize(Number(event.target.value));
    setPage(1);
  }

  function updateSort(key) {
    setPage(1);
    setSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  }

  return (
    <section className="admin-box box-primary banner-panel">
      <div className="box-body">
        <div className="data-toolbar">
          <label>
            Show{" "}
            <select value={pageSize} onChange={updatePageSize}>
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>{" "}
            entries
          </label>
          <label>
            Search: <input value={search} onChange={updateSearch} />
          </label>
        </div>
      </div>
      <div className="box-body table-responsive">
        <table className="table table-bordered table-hover dataTable banner-table module-admin-table">
          <thead>
            <tr>
              {COLUMNS.map((column) => (
                <th
                  key={column.key}
                  className={
                    sort.key === column.key
                      ? sort.direction === "asc"
                        ? "sorting_asc"
                        : "sorting_desc"
                      : "sorting"
                  }
                >
                  <button
                    className="sort-button"
                    type="button"
                    onClick={() => updateSort(column.key)}
                  >
                    {column.label}
                  </button>
                </th>
              ))}
              <th>Option</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((banner) => (
              <tr key={banner.id}>
                <td>{banner.id}</td>
                <td>{banner.title}</td>
                <td>{banner.sub_heading || "—"}</td>
                <td>{banner.tooltip_text || "—"}</td>
                <td>
                  <div className="thumb">
                    {banner.image_filename && (
                      <img
                        src={adminThumbnailUrl(banner.image_url)}
                        alt={banner.image_alt || banner.title}
                      />
                    )}
                  </div>
                </td>
                <td>{banner.status}</td>
                <td>{banner.display_order}</td>
                <td className="options">
                  <button title="Edit" onClick={() => onEdit(banner)}>
                    <AdminTableIcon name="edit" />
                  </button>
                  <button
                    title="Change status"
                    onClick={() => onToggle(banner)}
                  >
                    <AdminTableIcon
                      name="status"
                      className={
                        String(banner.status).toLowerCase() === "inactive"
                          ? "inactive"
                          : ""
                      }
                    />
                  </button>
                  <button title="Delete" onClick={() => onDelete(banner)}>
                    <AdminTableIcon name="close" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="box-footer data-footer">
        <span>
          Showing {sorted.length ? (currentPage - 1) * pageSize + 1 : 0} to{" "}
          {Math.min(currentPage * pageSize, sorted.length)} of {sorted.length}{" "}
          entries
          {filtered.length !== banners.length
            ? ` (filtered from ${banners.length} total entries)`
            : ""}
        </span>
        <div className="pagination">
          <button
            disabled={currentPage === 1}
            onClick={() => setPage(currentPage - 1)}
          >
            Previous
          </button>
          {Array.from({ length: pages }, (_, index) => (
            <button
              className={currentPage === index + 1 ? "active" : ""}
              key={index + 1}
              onClick={() => setPage(index + 1)}
            >
              {index + 1}
            </button>
          ))}
          <button
            disabled={currentPage === pages}
            onClick={() => setPage(currentPage + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
