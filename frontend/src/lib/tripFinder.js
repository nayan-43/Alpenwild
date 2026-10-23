function monthDay(value) {
  const source = String(value || "");
  const isoDate = source.match(/^\d{4}-(\d{2})-(\d{2})/);
  if (isoDate) return `${isoDate[1]}-${isoDate[2]}`;
  const legacyDate = source.match(/^(\d{2})-(\d{2})-\d{4}/);
  return legacyDate ? `${legacyDate[1]}-${legacyDate[2]}` : "";
}

function sortableDate(value) {
  const source = String(value || "");
  if (/^\d{4}-\d{2}-\d{2}/.test(source)) return source.slice(0, 10);
  const legacyDate = source.match(/^(\d{2})-(\d{2})-(\d{4})/);
  return legacyDate ? `${legacyDate[3]}-${legacyDate[1]}-${legacyDate[2]}` : "";
}

function tripFinderDates(trip, month) {
  const dates = Array.isArray(trip.dates) ? trip.dates : [];
  if (!month) return dates;

  const firstDay = `${month}-01`;
  const lastDay = `${month}-31`;
  return dates.filter((date) => {
    const start = monthDay(date.start_date);
    const end = monthDay(date.end_date);
    return start && end && start <= firstDay && end >= lastDay;
  });
}

export function filterTripsForFinder(
  trips,
  { locationIds = [], activityIds = [], month = "" } = {},
) {
  const selectedLocations = new Set(
    locationIds.map(String).filter((id) => id !== ""),
  );
  const selectedActivities = new Set(
    activityIds.map(String).filter((id) => id !== ""),
  );
  const selectedMonth = /^\d{1,2}$/.test(String(month))
    ? String(month).padStart(2, "0")
    : "";
  const validMonth =
    Number(selectedMonth) >= 1 && Number(selectedMonth) <= 12
      ? selectedMonth
      : "";

  return trips
    .map((trip) => ({
      trip,
      dates: tripFinderDates(trip, validMonth),
    }))
    .filter(
      ({ trip, dates }) =>
        trip.status === "Active" &&
        dates.length > 0 &&
        Array.isArray(trip.activity_ids) &&
        trip.activity_ids.length > 0 &&
        (!selectedLocations.size ||
          selectedLocations.has(String(trip.location_id))) &&
        (!selectedActivities.size ||
          trip.activity_ids.some((id) => selectedActivities.has(String(id)))),
    )
    .sort((left, right) => {
      const leftDate =
        left.dates
          .map((date) => sortableDate(date.start_date))
          .filter(Boolean)
          .sort()[0] || "";
      const rightDate =
        right.dates
          .map((date) => sortableDate(date.start_date))
          .filter(Boolean)
          .sort()[0] || "";
      return leftDate.localeCompare(rightDate);
    })
    .map(({ trip }) => trip);
}
