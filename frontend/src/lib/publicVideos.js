function isEnabled(value) {
  return value === true || value === 1 || value === "1" || value === "true";
}

export function youtubeVideoId(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    let id = "";

    if (host === "youtu.be") {
      id = url.pathname.split("/").filter(Boolean)[0] || "";
    } else if (host === "youtube.com" || host === "m.youtube.com") {
      id =
        url.searchParams.get("v") ||
        url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1] ||
        "";
    }

    return /^[\w-]{11}$/.test(id) ? id : "";
  } catch {
    return "";
  }
}

export function buildPublicVideoGroups(tripTypes, trips, galleries) {
  const activeTrips = trips
    .filter((trip) => trip.status === "Active")
    .sort(
      (first, second) =>
        Number(first.display_order) - Number(second.display_order) ||
        Number(first.id) - Number(second.id),
    );
  const activeGalleries = galleries.filter(
    (gallery) =>
      gallery.status === "Active" &&
      isEnabled(gallery.display_in_static_page) &&
      youtubeVideoId(gallery.video_url),
  );

  return tripTypes
    .filter((tripType) => tripType.status === "Active")
    .map((tripType) => ({
      ...tripType,
      trips: activeTrips
        .filter(
          (trip) =>
            Number(trip.type_id || trip.trip_type_id) === Number(tripType.id),
        )
        .map((trip) => ({
          ...trip,
          videos: activeGalleries
            .filter(
              (gallery) => Number(gallery.trip_id) === Number(trip.id),
            )
            .sort(
              (first, second) =>
                Number(first.display_order) - Number(second.display_order) ||
                Number(first.id) - Number(second.id),
            ),
        })),
    }));
}
