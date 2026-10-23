export function matchesAdminTableSearch(row, columns, search, searchKeys) {
  const term = search.toLowerCase().trim();
  if (!term) return true;

  const searchableColumns = searchKeys
    ? columns.filter((column) => searchKeys.includes(column.key))
    : columns.filter((column) => column.searchable !== false);

  return searchableColumns.some((column) => {
    const value = column.searchValue
      ? column.searchValue(row)
      : row[column.key];
    return String(value ?? "")
      .toLowerCase()
      .includes(term);
  });
}
