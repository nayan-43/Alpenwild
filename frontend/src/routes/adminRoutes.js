const ADMIN_ROOT = "/administrator";

export function canonicalAdminPath(path) {
  return path.replace(/^\/admin(?=\/|$)/, ADMIN_ROOT);
}

export function resolveAdminRoute(pathname) {
  const path = canonicalAdminPath(pathname.replace(/\/+$/, "") || ADMIN_ROOT);
  const legacyPath = path.replace(/^\/administrator(?=\/|$)/, "/admin");

  if (path === ADMIN_ROOT || path === `${ADMIN_ROOT}/dashboard`)
    return { page: "dashboard", module: "dashboard" };
  if (path === `${ADMIN_ROOT}/banners`)
    return { page: "banners", module: "banners" };
  if (path === `${ADMIN_ROOT}/banners/add`)
    return { page: "add", module: "banners" };
  if (/^\/admin\/banners\/\d+\/edit$/.test(legacyPath))
    return { page: "add", module: "banners", editPath: path };
  if (path === `${ADMIN_ROOT}/promotions`)
    return { page: "promotions", module: "promotions" };
  if (path === `${ADMIN_ROOT}/promotions/add`)
    return { page: "addPromotion", module: "promotions" };
  if (/^\/admin\/promotions\/\d+\/edit$/.test(legacyPath))
    return { page: "addPromotion", module: "promotions", editPath: path };
  if (path === `${ADMIN_ROOT}/special-features`)
    return { page: "specialFeatures", module: "specialFeatures" };
  if (path === `${ADMIN_ROOT}/special-features/add`)
    return { page: "addSpecialFeature", module: "specialFeatures" };
  if (/^\/admin\/special-features\/\d+\/edit$/.test(legacyPath))
    return {
      page: "addSpecialFeature",
      module: "specialFeatures",
      editPath: path,
    };
  if (path === `${ADMIN_ROOT}/footer-menus`)
    return { page: "footerMenus", module: "footerMenus" };
  if (path === `${ADMIN_ROOT}/footer-menus/add`)
    return { page: "addFooterMenu", module: "footerMenus" };
  if (/^\/admin\/footer-menus\/\d+\/edit$/.test(legacyPath))
    return { page: "addFooterMenu", module: "footerMenus", editPath: path };
  if (path === `${ADMIN_ROOT}/static-pages`)
    return { page: "staticPages", module: "staticPages" };
  if (path === `${ADMIN_ROOT}/static-pages/add`)
    return { page: "addStaticPage", module: "staticPages" };
  if (/^\/admin\/static-pages\/\d+\/edit$/.test(legacyPath))
    return { page: "addStaticPage", module: "staticPages", editPath: path };
  if (path === `${ADMIN_ROOT}/redirections`)
    return { page: "redirections", module: "redirections" };
  if (path === `${ADMIN_ROOT}/redirections/add`)
    return { page: "addRedirection", module: "redirections" };
  if (/^\/admin\/redirections\/\d+\/edit$/.test(legacyPath))
    return { page: "addRedirection", module: "redirections", editPath: path };
  if (path === `${ADMIN_ROOT}/trip-types`)
    return { page: "tripTypes", module: "tripTypes" };
  if (path === `${ADMIN_ROOT}/trip-types/add`)
    return { page: "addTripType", module: "tripTypes" };
  if (/^\/admin\/trip-types\/\d+\/edit$/.test(legacyPath))
    return { page: "addTripType", module: "tripTypes", editPath: path };
  if (path === `${ADMIN_ROOT}/trips`) return { page: "trips", module: "trips" };
  if (path === `${ADMIN_ROOT}/trips/add`)
    return { page: "addTrip", module: "trips" };
  if (/^\/admin\/trips\/\d+\/itinerary$/.test(legacyPath))
    return { page: "tripItinerary", module: "trips", editPath: path };
  if (/^\/admin\/trips\/\d+\/faq$/.test(legacyPath))
    return { page: "tripFaq", module: "trips", editPath: path };
  if (/^\/admin\/trips\/\d+\/faq\/\d+\/edit$/.test(legacyPath))
    return { page: "tripFaqEdit", module: "trips", editPath: path };
  if (/^\/admin\/trips\/\d+\/edit$/.test(legacyPath))
    return { page: "addTrip", module: "trips", editPath: path };
  if (path === `${ADMIN_ROOT}/trip-gallery`)
    return { page: "tripGalleries", module: "trips" };
  if (path === `${ADMIN_ROOT}/trip-gallery/add`)
    return { page: "addTripGallery", module: "trips" };
  if (/^\/admin\/trip-gallery\/\d+\/edit$/.test(legacyPath))
    return { page: "addTripGallery", module: "trips", editPath: path };
  if (path === `${ADMIN_ROOT}/trip-booking/add`)
    return { page: "addTripBooking", module: "trips" };
  if (/^\/admin\/trip-booking\/\d+\/edit$/.test(legacyPath))
    return { page: "addTripBooking", module: "trips", editPath: path };
  if (path === `${ADMIN_ROOT}/trip-booking/recent`)
    return { page: "recentTripBookings", module: "trips" };
  if (path === `${ADMIN_ROOT}/trip-booking`)
    return { page: "tripBookings", module: "trips" };
  if (path === `${ADMIN_ROOT}/trip-booking/download`)
    return { page: "downloadTripBookings", module: "trips" };
  if (path === `${ADMIN_ROOT}/trip-payment`)
    return { page: "tripPayments", module: "trips" };
  if (path === `${ADMIN_ROOT}/trip-leaders`)
    return { page: "tripLeaders", module: "tripLeaders" };
  if (path === `${ADMIN_ROOT}/trip-leaders/add`)
    return { page: "addTripLeader", module: "tripLeaders" };
  if (/^\/admin\/trip-leaders\/\d+\/edit$/.test(legacyPath))
    return { page: "addTripLeader", module: "tripLeaders", editPath: path };
  if (path === `${ADMIN_ROOT}/invoices`)
    return { page: "invoices", module: "invoices" };
  if (path === `${ADMIN_ROOT}/orders`)
    return { page: "orders", module: "orders" };
  if (/^\/admin\/orders\/\d+\/view$/.test(legacyPath))
    return { page: "orderDetail", module: "orders", editPath: path };
  if (path === `${ADMIN_ROOT}/invoices/add`)
    return { page: "addInvoice", module: "invoices" };
  if (/^\/admin\/invoices\/\d+\/edit$/.test(legacyPath))
    return { page: "addInvoice", module: "invoices", editPath: path };
  if (path === `${ADMIN_ROOT}/attribute-types`)
    return { page: "attributeTypes", module: "attributeTypes" };
  if (path === `${ADMIN_ROOT}/attribute-types/add`)
    return { page: "addAttributeType", module: "attributeTypes" };
  if (/^\/admin\/attribute-types\/\d+\/edit$/.test(legacyPath))
    return {
      page: "addAttributeType",
      module: "attributeTypes",
      editPath: path,
    };
  if (path === `${ADMIN_ROOT}/attribute-values`)
    return { page: "attributeValues", module: "attributeValues" };
  if (path === `${ADMIN_ROOT}/attribute-values/add`)
    return { page: "addAttributeValue", module: "attributeValues" };
  if (/^\/admin\/attribute-values\/\d+\/edit$/.test(legacyPath))
    return {
      page: "addAttributeValue",
      module: "attributeValues",
      editPath: path,
    };
  if (path === `${ADMIN_ROOT}/categories`)
    return { page: "categories", module: "categories" };
  if (path === `${ADMIN_ROOT}/categories/add`)
    return { page: "addCategory", module: "categories" };
  if (/^\/admin\/categories\/\d+\/edit$/.test(legacyPath))
    return { page: "addCategory", module: "categories", editPath: path };
  if (path === `${ADMIN_ROOT}/products`)
    return { page: "products", module: "products" };
  if (path === `${ADMIN_ROOT}/products/add`)
    return { page: "addProduct", module: "products" };
  if (/^\/admin\/products\/\d+\/edit$/.test(legacyPath))
    return { page: "addProduct", module: "products", editPath: path };
  if (path === `${ADMIN_ROOT}/product-attributes`)
    return { page: "productAttributes", module: "productAttributes" };
  if (path === `${ADMIN_ROOT}/product-attributes/add`)
    return { page: "addProductAttribute", module: "productAttributes" };
  if (/^\/admin\/product-attributes\/\d+\/edit$/.test(legacyPath))
    return {
      page: "addProductAttribute",
      module: "productAttributes",
      editPath: path,
    };
  if (path === `${ADMIN_ROOT}/locations`)
    return { page: "locations", module: "locations" };
  if (path === `${ADMIN_ROOT}/locations/add`)
    return { page: "addLocation", module: "locations" };
  if (/^\/admin\/locations\/\d+\/edit$/.test(legacyPath))
    return { page: "addLocation", module: "locations", editPath: path };
  if (path === `${ADMIN_ROOT}/activities`)
    return { page: "activities", module: "activities" };
  if (path === `${ADMIN_ROOT}/activities/add`)
    return { page: "addActivity", module: "activities" };
  if (/^\/admin\/activities\/\d+\/edit$/.test(legacyPath))
    return { page: "addActivity", module: "activities", editPath: path };
  if (path === `${ADMIN_ROOT}/testimonials`)
    return { page: "testimonials", module: "testimonials" };
  if (path === `${ADMIN_ROOT}/testimonials/add`)
    return { page: "addTestimonial", module: "testimonials" };
  if (/^\/admin\/testimonials\/\d+\/edit$/.test(legacyPath))
    return { page: "addTestimonial", module: "testimonials", editPath: path };
  if (path === `${ADMIN_ROOT}/discounts`)
    return { page: "discounts", module: "discounts" };
  if (path === `${ADMIN_ROOT}/discounts/add`)
    return { page: "addDiscount", module: "discounts" };
  if (/^\/admin\/discounts\/\d+\/edit$/.test(legacyPath))
    return { page: "addDiscount", module: "discounts", editPath: path };
  if (path === `${ADMIN_ROOT}/users`) return { page: "users", module: "users" };
  if (path === `${ADMIN_ROOT}/users/add`)
    return { page: "addUser", module: "users" };
  if (path === `${ADMIN_ROOT}/mailing-list`)
    return { page: "mailingList", module: "mailingList" };
  if (path === `${ADMIN_ROOT}/mailing-list/add`)
    return { page: "addMailingList", module: "mailingList" };
  if (/^\/admin\/mailing-list\/\d+\/edit$/.test(legacyPath))
    return { page: "addMailingList", module: "mailingList", editPath: path };
  if (path === `${ADMIN_ROOT}/contests`)
    return { page: "contests", module: "contests" };
  if (path === `${ADMIN_ROOT}/contests/add`)
    return { page: "addContest", module: "contests" };
  if (/^\/admin\/contests\/\d+\/edit$/.test(legacyPath))
    return { page: "addContest", module: "contests", editPath: path };
  if (/^\/admin\/contest-users\/\d+\/view$/.test(legacyPath))
    return { page: "contestUserDetails", module: "contests", editPath: path };
  if (path === `${ADMIN_ROOT}/contest-users`)
    return { page: "contestUsers", module: "contests" };
  if (path === `${ADMIN_ROOT}/contest-submissions`)
    return { page: "contestSubmissions", module: "contests" };
  if (path === `${ADMIN_ROOT}/contest-rules`)
    return { page: "contestRules", module: "contests" };
  if (path === `${ADMIN_ROOT}/contest-emails`)
    return { page: "contestEmails", module: "contests" };
  if (path === `${ADMIN_ROOT}/settings`)
    return { page: "settings", module: "settings" };
  if (path === `${ADMIN_ROOT}/email-templates`)
    return { page: "emailTemplates", module: "settings" };
  if (path === `${ADMIN_ROOT}/change-username`)
    return { page: "changeUsername", module: "settings" };
  if (path === `${ADMIN_ROOT}/change-password`)
    return { page: "changePassword", module: "settings" };
  if (/^\/admin\/users\/\d+\/edit$/.test(legacyPath))
    return { page: "addUser", module: "users", editPath: path };

  return { page: "dashboard", module: "dashboard" };
}

export function pathForAdminPage(page) {
  switch (page) {
    case "banners":
      return `${ADMIN_ROOT}/banners`;
    case "add":
      return `${ADMIN_ROOT}/banners/add`;
    case "promotions":
      return `${ADMIN_ROOT}/promotions`;
    case "addPromotion":
      return `${ADMIN_ROOT}/promotions/add`;
    case "specialFeatures":
      return `${ADMIN_ROOT}/special-features`;
    case "addSpecialFeature":
      return `${ADMIN_ROOT}/special-features/add`;
    case "footerMenus":
      return `${ADMIN_ROOT}/footer-menus`;
    case "addFooterMenu":
      return `${ADMIN_ROOT}/footer-menus/add`;
    case "staticPages":
      return `${ADMIN_ROOT}/static-pages`;
    case "addStaticPage":
      return `${ADMIN_ROOT}/static-pages/add`;
    case "redirections":
      return `${ADMIN_ROOT}/redirections`;
    case "addRedirection":
      return `${ADMIN_ROOT}/redirections/add`;
    case "tripTypes":
      return `${ADMIN_ROOT}/trip-types`;
    case "addTripType":
      return `${ADMIN_ROOT}/trip-types/add`;
    case "trips":
      return `${ADMIN_ROOT}/trips`;
    case "addTrip":
      return `${ADMIN_ROOT}/trips/add`;
    case "tripGalleries":
      return `${ADMIN_ROOT}/trip-gallery`;
    case "addTripGallery":
      return `${ADMIN_ROOT}/trip-gallery/add`;
    case "addTripBooking":
      return `${ADMIN_ROOT}/trip-booking/add`;
    case "recentTripBookings":
      return `${ADMIN_ROOT}/trip-booking/recent`;
    case "tripBookings":
      return `${ADMIN_ROOT}/trip-booking`;
    case "downloadTripBookings":
      return `${ADMIN_ROOT}/trip-booking/download`;
    case "tripPayments":
      return `${ADMIN_ROOT}/trip-payment`;
    case "tripLeaders":
      return `${ADMIN_ROOT}/trip-leaders`;
    case "addTripLeader":
      return `${ADMIN_ROOT}/trip-leaders/add`;
    case "invoices":
      return `${ADMIN_ROOT}/invoices`;
    case "orders":
      return `${ADMIN_ROOT}/orders`;
    case "addInvoice":
      return `${ADMIN_ROOT}/invoices/add`;
    case "attributeTypes":
      return `${ADMIN_ROOT}/attribute-types`;
    case "addAttributeType":
      return `${ADMIN_ROOT}/attribute-types/add`;
    case "attributeValues":
      return `${ADMIN_ROOT}/attribute-values`;
    case "addAttributeValue":
      return `${ADMIN_ROOT}/attribute-values/add`;
    case "categories":
      return `${ADMIN_ROOT}/categories`;
    case "addCategory":
      return `${ADMIN_ROOT}/categories/add`;
    case "products":
      return `${ADMIN_ROOT}/products`;
    case "addProduct":
      return `${ADMIN_ROOT}/products/add`;
    case "productAttributes":
      return `${ADMIN_ROOT}/product-attributes`;
    case "addProductAttribute":
      return `${ADMIN_ROOT}/product-attributes/add`;
    case "locations":
      return `${ADMIN_ROOT}/locations`;
    case "addLocation":
      return `${ADMIN_ROOT}/locations/add`;
    case "activities":
      return `${ADMIN_ROOT}/activities`;
    case "addActivity":
      return `${ADMIN_ROOT}/activities/add`;
    case "testimonials":
      return `${ADMIN_ROOT}/testimonials`;
    case "addTestimonial":
      return `${ADMIN_ROOT}/testimonials/add`;
    case "discounts":
      return `${ADMIN_ROOT}/discounts`;
    case "addDiscount":
      return `${ADMIN_ROOT}/discounts/add`;
    case "users":
      return `${ADMIN_ROOT}/users`;
    case "addUser":
      return `${ADMIN_ROOT}/users/add`;
    case "mailingList":
      return `${ADMIN_ROOT}/mailing-list`;
    case "addMailingList":
      return `${ADMIN_ROOT}/mailing-list/add`;
    case "contests":
      return `${ADMIN_ROOT}/contests`;
    case "addContest":
      return `${ADMIN_ROOT}/contests/add`;
    case "contestUsers":
      return `${ADMIN_ROOT}/contest-users`;
    case "contestUserDetails":
      return `${ADMIN_ROOT}/contest-users`;
    case "contestSubmissions":
      return `${ADMIN_ROOT}/contest-submissions`;
    case "contestRules":
      return `${ADMIN_ROOT}/contest-rules`;
    case "contestEmails":
      return `${ADMIN_ROOT}/contest-emails`;
    case "settings":
      return `${ADMIN_ROOT}/settings`;
    case "emailTemplates":
      return `${ADMIN_ROOT}/email-templates`;
    case "changeUsername":
      return `${ADMIN_ROOT}/change-username`;
    case "changePassword":
      return `${ADMIN_ROOT}/change-password`;
    default:
      return ADMIN_ROOT;
  }
}
