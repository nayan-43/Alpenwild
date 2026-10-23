export function tripDuration(trip) {
  const date = trip.dates?.[0];
  let derivedDays;
  let derivedNights;

  if (date) {
    if (Number(date.date_range) === 0 && date.start_date && date.end_date) {
      const start = Date.parse(`${date.start_date}T00:00:00Z`);
      const end = Date.parse(`${date.end_date}T00:00:00Z`);
      if (Number.isFinite(start) && Number.isFinite(end)) {
        derivedNights = Math.round((end - start) / 86_400_000);
        derivedDays = derivedNights + 1;
      }
    } else if (date.date_range !== undefined && date.date_range !== null) {
      derivedDays = Number(date.date_range);
      derivedNights = derivedDays - 1;
    }
  }

  const days = trip.days ?? derivedDays;
  const nights = trip.nights ?? derivedNights;
  return days !== undefined &&
    days !== null &&
    nights !== undefined &&
    nights !== null
    ? `${days} Days/${nights} Nights`
    : "";
}
