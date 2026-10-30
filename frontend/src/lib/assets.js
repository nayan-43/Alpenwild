const localHosts = new Set([
  "alpenwild.com",
  "www.alpenwild.com",
  "localhost",
  "127.0.0.1",
  "192.168.0.121",
]);

const wordpressPathHosts = {
  Alpshiking: "https://alpshiking.swisshikingvacations.com",
  Switzerlandtravel: "https://switzerlandtravel.swisshikingvacations.com",
  myswisskitchen: "https://myswisskitchen.swisshikingvacations.com",
};

export function legacyWordpressUrl(value) {
  const source = String(value || "").trim();
  if (!source) return "";
  return source.replace(
    /^https?:\/\/(?:www\.)?alpenwild\.com\/(Alpshiking|Switzerlandtravel|myswisskitchen)\//i,
    (_match, path) => `${wordpressPathHosts[path]}/`,
  );
}

export function thumbnailAssetUrl(
  value,
  width,
  height,
  zoomCrop = 1,
  quality = 90,
) {
  const source = localAssetUrl(value);
  if (
    !/^\/uploads\//i.test(source) ||
    !Number.isInteger(Number(width)) ||
    !Number.isInteger(Number(height)) ||
    Number(width) < 1 ||
    Number(height) < 1 ||
    ![0, 1, 2, 3].includes(Number(zoomCrop)) ||
    !Number.isInteger(Number(quality)) ||
    Number(quality) < 1 ||
    Number(quality) > 100
  ) {
    return source;
  }
  const params = new URLSearchParams({
    src: source,
    w: String(Number(width)),
    h: String(Number(height)),
    zc: String(Number(zoomCrop)),
    q: String(Number(quality)),
  });
  return `/api/public-thumbnail?${params.toString()}`;
}

export function adminThumbnailUrl(value) {
  return thumbnailAssetUrl(value, 150, 90);
}

function legacyThumbnailUrl(value) {
  let url;
  try {
    url = new URL(value, globalThis.location?.origin || "http://localhost");
  } catch {
    return "";
  }
  const source = url.searchParams.get("src");
  const width = Number(url.searchParams.get("w"));
  const height = Number(url.searchParams.get("h"));
  if (!source || !width || !height) return source ? localAssetUrl(source) : "";
  return thumbnailAssetUrl(
    source,
    width,
    height,
    Number(url.searchParams.get("zc") || 1),
    Number(url.searchParams.get("q") || 90),
  );
}

export function localAssetUrl(value) {
  const source = String(value || "").trim();
  if (!source) return "";
  if (/^(data:|blob:|#)/i.test(source)) return source;
  if (source.startsWith("//")) return source;
  if (/^\/api\//i.test(source)) return source;
  if (/^\/?timthumb\.php(?:\?|$)/i.test(source)) {
    return legacyThumbnailUrl(source);
  }
  if (/^\/uploads\//i.test(source)) return source;
  if (/^uploads\//i.test(source)) return `/${source}`;

  let pathname = source;
  let suffix = "";
  if (/^https?:\/\//i.test(source)) {
    const url = new URL(legacyWordpressUrl(source));
    if (!localHosts.has(url.hostname.toLowerCase())) return source;
    if (/\/timthumb\.php$/i.test(url.pathname)) {
      return legacyThumbnailUrl(url.href);
    }
    pathname = url.pathname;
    suffix = `${url.search}${url.hash}`;
  }

  pathname = pathname
    .replace(/^\/alpen(?=\/|$)/i, "")
    .replace(/^\/+/, "")
    .replace(/^images\//i, "")
    .replace(/^staticpage\//i, "static_page/");
  return `/uploads/${pathname}${suffix}`;
}

export function localAppLink(value) {
  const source = String(value || "").trim();
  if (
    !source ||
    source.startsWith("#") ||
    /^(mailto:|tel:|javascript:)/i.test(source)
  ) {
    return source || null;
  }

  let url;
  try {
    url = new URL(source, window.location.origin);
  } catch {
    return null;
  }
  if (
    url.origin !== window.location.origin &&
    !localHosts.has(url.hostname.toLowerCase())
  ) {
    return null;
  }

  let pathname = url.pathname.replace(/^\/alpen(?=\/|$)/i, "") || "/";
  const wordpressPath = pathname.match(
    /^\/(Alpshiking|Switzerlandtravel|myswisskitchen)(?:\/(.*))?$/i,
  );
  if (wordpressPath) {
    const sourcePath = Object.keys(wordpressPathHosts).find(
      (key) => key.toLowerCase() === wordpressPath[1].toLowerCase(),
    );
    if (sourcePath) {
      const suffix = wordpressPath[2]
        ? `/${wordpressPath[2].replace(/^\/+/, "")}`
        : "/";
      return `${wordpressPathHosts[sourcePath]}${suffix}${url.search}${url.hash}`;
    }
  }
  pathname = pathname
    .replace(/^\/welcome\/where-we-stay\/?$/i, "/staticpage/where-we-stay/")
    .replace(/^\/welcome\/how-we-travel\/?$/i, "/staticpage/how-we-travel/")
    .replace(
      /^\/haute-route\/haute-route-essentials\/?$/i,
      "/staticpage/haute-route-essentials/",
    )
    .replace(/^\/trip\/details\/([^/]+)\/?$/i, "/trip/$1/overview/");
  if (/\/trip_search\.php$/i.test(pathname)) {
    return `/search${url.search}${url.hash}`;
  }
  if (/\/trip_overview\.php$/i.test(pathname)) {
    const slug = url.searchParams.get("trip_slug");
    if (slug) return `/trip/${encodeURIComponent(slug)}/overview/`;
  }
  if (/\.php$/i.test(pathname)) {
    const slug = pathname
      .split("/")
      .filter(Boolean)
      .at(-1)
      .replace(/\.php$/i, "");
    return `/staticpage/${encodeURIComponent(slug)}/${url.search}${url.hash}`;
  }
  return `${pathname}${url.search}${url.hash}`;
}

export function localizeRichContent(value) {
  const source = String(value || "");
  if (!source) return "";
  const document = new DOMParser().parseFromString(source, "text/html");
  document.querySelectorAll("[src]").forEach((element) => {
    element.setAttribute("src", localAssetUrl(element.getAttribute("src")));
  });
  document.querySelectorAll("a[href]").forEach((element) => {
    const link = localAppLink(element.getAttribute("href"));
    if (link) element.setAttribute("href", link);
  });
  document.querySelectorAll("[style]").forEach((element) => {
    element.setAttribute(
      "style",
      element
        .getAttribute("style")
        .replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (match, _quote, url) => {
          return `url("${localAssetUrl(url)}")`;
        }),
    );
  });
  return document.body.innerHTML;
}

export function localizeLegacyContent(value) {
  const source = String(value || "");
  if (
    !/https?:\/\/(?:www\.)?alpenwild\.com|https?:\/\/localhost\/alpen|timthumb\.php|(?:src|href)\s*=\s*["']\/?images\//i.test(
      source,
    )
  ) {
    return source;
  }
  return localizeRichContent(source);
}
