function isActive(row) {
  return row.status === "Active";
}

function byDisplayOrder(a, b) {
  const orderDifference =
    Number(a.display_order || 0) - Number(b.display_order || 0);
  return orderDifference || Number(a.id) - Number(b.id);
}

function buildTripTypeItems(tripTypes, trips) {
  return tripTypes
    .filter(isActive)
    .sort(byDisplayOrder)
    .map((tripType) => ({
      key: `trip-type:${tripType.id}`,
      label: tripType.menu_name,
      href: `/triptype/${tripType.slug}/`,
      children: trips
        .filter(
          (trip) =>
            isActive(trip) && String(trip.type_id) === String(tripType.id),
        )
        .sort(byDisplayOrder)
        .map((trip) => ({
          key: `trip:${trip.id}`,
          label: trip.menu_name,
          href: `/trip/${trip.slug}/overview/`,
          children: [],
        })),
    }));
}

export function buildPublicNavigation(staticPages, tripTypes = [], trips = []) {
  const pages = staticPages
    .filter((page) => isActive(page) && page.menu_assign === "Self In Header")
    .sort(byDisplayOrder);
  const tripTypeItems = buildTripTypeItems(tripTypes, trips);

  function buildChildren(parentId) {
    return pages
      .filter((page) => String(page.parent_id) === String(parentId))
      .map((page) => {
        const pageChildren = pages.filter(
          (candidate) => String(candidate.parent_id) === String(page.id),
        );
        const children =
          String(page.id) === "7" && pageChildren.length > 0
            ? tripTypeItems
            : buildChildren(page.id);

        return {
          key: `static-page:${page.id}`,
          label: page.menu_name,
          href:
            page.display_as_page === "Yes" ? `/staticpage/${page.slug}/` : "#",
          children,
        };
      });
  }

  return buildChildren(0);
}
