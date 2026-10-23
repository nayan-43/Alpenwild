function xmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function buildSitemapXml(origin, { pages, tripTypes, trips }) {
  const urls = [
    [origin, "1", "Daily"],
    [`${origin}/blog/`, "0.50", "weekly"],
    ...pages.map(({ slug }) => [
      `${origin}/staticpage/${encodeURIComponent(slug)}/`,
      "0.50",
      "weekly",
    ]),
    ...tripTypes.map(({ slug }) => [
      `${origin}/triptype/${encodeURIComponent(slug)}/`,
      "0.50",
      "weekly",
    ]),
    ...trips.map(({ slug }) => [
      `${origin}/trip/${encodeURIComponent(slug)}/overview/`,
      "0.50",
      "weekly",
    ]),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map(
      ([loc, priority, changefreq]) =>
        `<url><loc>${xmlEscape(loc)}</loc><priority>${priority}</priority><changefreq>${changefreq}</changefreq></url>`,
    )
    .join("\n")}\n</urlset>`;
}
