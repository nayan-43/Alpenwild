function comparableFormValue(value) {
  if (Array.isArray(value)) return value.map(comparableFormValue);
  if (value instanceof Date) return value.toISOString();
  if (typeof File !== "undefined" && value instanceof File)
    return {
      name: value.name,
      size: value.size,
      type: value.type,
      lastModified: value.lastModified,
    };
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, comparableFormValue(value[key])]),
    );
  return value;
}

export function serializeComparableForm(value) {
  return JSON.stringify(comparableFormValue(value));
}
