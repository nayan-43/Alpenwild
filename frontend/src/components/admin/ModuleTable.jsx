import React, { useMemo, useState } from "react";
import { AdminTableIcon } from "./Icon";
import { matchesAdminTableSearch } from "@/lib/adminTableSearch";

const PAGE_SIZES = [10, 25, 50, 100];

export default function ModuleTable({
  rows,
  columns,
  onEdit,
  onToggle,
  onDelete,
  renderActions,
  footerActions,
  tableClassName = "",
  actionLabel = "Option",
  totalEntries = rows.length,
  initialSortKey = columns[0]?.key,
  initialSortDirection = "asc",
  searchKeys,
  tieBreakKeys = [],
  notice,
  onDismissNotice,
  embedded = false,
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [hasUserSorted, setHasUserSorted] = useState(false);
  const [sort, setSort] = useState({
    key: initialSortKey,
    direction: initialSortDirection,
  });
  const filtered = useMemo(() => {
    return rows.filter((row) =>
      matchesAdminTableSearch(row, columns, search, searchKeys),
    );
  }, [rows, columns, search, searchKeys]);
  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        const sortKeys = [
          sort.key,
          ...(!hasUserSorted && sort.key === initialSortKey
            ? tieBreakKeys.filter((key) => key !== sort.key)
            : []),
        ];
        for (const key of sortKeys) {
          const result = String(a[key] ?? "").localeCompare(
            String(b[key] ?? ""),
            undefined,
            { numeric: true, sensitivity: "base" },
          );
          if (result)
            return key === sort.key && sort.direction === "desc"
              ? -result
              : result;
        }
        return 0;
      }),
    [filtered, sort, tieBreakKeys, initialSortKey, hasUserSorted],
  );
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pages);
  const visible = sorted.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const paginationItems = getPaginationItems(currentPage, pages);
  function updateSort(key) {
    setPage(1);
    setHasUserSorted(true);
    setSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  }
  const Wrapper = embedded ? "div" : "section";
  return (
    <Wrapper
      className={
        embedded ? "faq-table-module" : "admin-box box-primary banner-panel"
      }
    >
      {notice && (
        <div className="box-body">
          <div
            className={`alert ${notice === "Sorry, nothing is updated." ? "warning" : "success"}`}
            role="alert"
          >
            <button
              type="button"
              className="admin-alert-close"
              onClick={onDismissNotice}
              aria-label="Close"
            >
              ×
            </button>
            {notice}
          </div>
        </div>
      )}
      <div className="box-body table-responsive">
        <div className="data-toolbar">
          <label>
            Show{" "}
            <select
              className=""
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size}>{size}</option>
              ))}
            </select>{" "}
            entries
          </label>
          <label>
            Search:{" "}
            <input
              className=""
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </label>
        </div>
        <table
          style={embedded ? { width: "100%" } : undefined}
          className={`${embedded ? "dataTable" : "table table-bordered table-hover dataTable align-middle banner-table module-table module-admin-table"} ${tableClassName}`}
        >
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  onClick={() => updateSort(column.key)}
                  className={
                    sort.key === column.key
                      ? sort.direction === "asc"
                        ? "sorting_asc"
                        : "sorting_desc"
                      : !hasUserSorted &&
                          sort.key === initialSortKey &&
                          tieBreakKeys.includes(column.key)
                        ? "sorting_asc"
                        : "sorting"
                  }
                >
                  <button className="sort-button" type="button">
                    {column.label}
                  </button>
                </th>
              ))}
              <th>{actionLabel}</th>
            </tr>
          </thead>
          <tbody>
            {visible.length ? (
              visible.map((row) => (
                <tr key={row.id}>
                  {columns.map((column) => (
                    <td key={column.key}>
                      {column.render
                        ? column.render(row)
                        : row[column.key] || "—"}
                    </td>
                  ))}
                  <td className="options">
                    {renderActions ? (
                      renderActions(row)
                    ) : (
                      <>
                        <button
                          className="btn btn-link p-0"
                          title="Edit"
                          onClick={() => onEdit(row)}
                        >
                          <AdminTableIcon name="edit" />
                        </button>
                        <button
                          className="btn btn-link p-0"
                          title="Change status"
                          onClick={() => onToggle(row)}
                        >
                          <AdminTableIcon
                            name="status"
                            className={
                              String(row.status).toLowerCase() === "inactive"
                                ? "inactive"
                                : ""
                            }
                          />
                        </button>
                        <button
                          className="btn btn-link p-0"
                          title="Delete"
                          onClick={() => onDelete(row)}
                        >
                          <AdminTableIcon name="close" />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  className={`text-center ${embedded ? "dataTables_empty" : ""}`}
                  colSpan={columns.length + 1}
                >
                  No data available in table
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="box-footer data-footer">
        <span>
          Showing {sorted.length ? (currentPage - 1) * pageSize + 1 : 0} to{" "}
          {Math.min(currentPage * pageSize, sorted.length)} of {sorted.length}{" "}
          entries
          {totalEntries > rows.length || filtered.length !== rows.length
            ? ` (filtered from ${totalEntries} total entries)`
            : ""}
        </span>
        <div className="pagination">
          <button
            disabled={currentPage === 1}
            onClick={() => setPage(currentPage - 1)}
          >
            Previous
          </button>
          {paginationItems.map((item, index) =>
            item === "ellipsis" ? (
              <span className="pagination-ellipsis" key={`ellipsis-${index}`}>
                ...
              </span>
            ) : (
              <button
                className={currentPage === item ? "active" : ""}
                key={item}
                onClick={() => setPage(item)}
              >
                {item}
              </button>
            ),
          )}
          <button
            disabled={currentPage === pages}
            onClick={() => setPage(currentPage + 1)}
          >
            Next
          </button>
        </div>
        {footerActions ? (
          <div className="table-footer-actions">{footerActions}</div>
        ) : null}
      </div>
    </Wrapper>
  );
}

function getPaginationItems(currentPage, totalPages) {
  if (totalPages <= 7)
    return Array.from({ length: totalPages }, (_, index) => index + 1);

  if (currentPage <= 5) return [1, 2, 3, 4, 5, "ellipsis", totalPages];
  if (currentPage >= totalPages - 4)
    return [
      1,
      "ellipsis",
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];

  return [
    1,
    "ellipsis",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "ellipsis",
    totalPages,
  ];
}
