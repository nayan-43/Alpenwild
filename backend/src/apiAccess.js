export const publicApiPaths = new Set([
  "/public-thumbnail",
  "/public-redirection",
  "/banners",
  "/promotions",
  "/special-features",
  "/trip-types",
  "/trips",
  "/public-static-pages",
  "/public-navigation",
  "/footer-menus",
  "/public-settings",
  "/public-categories",
  "/public-trip-leaders",
  "/public-trip-filters",
  "/testimonials",
  "/trip-galleries",
  "/trip-faqs",
]);

const publicApiPrefixes = [
  "/trip-posts/",
  "/trip-faqs/",
  "/public-static-pages/",
  "/public-categories/",
  "/public-products/",
  "/public-category-images/",
  "/trip-images/listing/",
  "/trip-type-images/listing/",
  "/public-trip-leaders/",
  "/public-trip-payment-links/",
];

const publicPostPaths = new Set([
  "/public/mailing-list",
  "/public/callback",
  "/public/trip-bookings",
  "/public/contest-submissions",
  "/public/shop-customer",
  "/public/shop-customer/register",
  "/public/shop-checkout",
  "/trip-payments",
  "/discount-check",
]);

const publicPostPathsWithOriginCheck = new Set([
  "/public/trip-bookings",
  "/public/contest-submissions",
  "/public/shop-customer",
  "/public/shop-customer/register",
  "/public/shop-checkout",
  "/trip-payments",
  "/discount-check",
]);

export function createApiAccessMiddleware({
  requireAuth,
  verifyRequestOrigin,
}) {
  return (req, res, next) => {
    if (req.path.startsWith("/auth/") || req.path === "/health") return next();
    if (
      req.method === "GET" &&
      (publicApiPaths.has(req.path) ||
        publicApiPrefixes.some((prefix) => req.path.startsWith(prefix)) ||
        /^\/trips\/\d+\/itinerary$/.test(req.path))
    )
      return next();
    if (req.method === "POST" && publicPostPaths.has(req.path))
      return publicPostPathsWithOriginCheck.has(req.path)
        ? verifyRequestOrigin(req, res, next)
        : next();
    requireAuth(req, res, () => verifyRequestOrigin(req, res, next));
  };
}
