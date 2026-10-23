import React, { useEffect, useRef, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import DashboardPage from "./admin/dashboard/DashboardPage";
import ManageBannerPage from "./admin/banner/ManageBannerPage";
import AddBannerPage from "./admin/banner/AddBannerPage";
import ManagePromotionsPage from "./admin/promotions/ManagePromotionsPage";
import AddPromotionPage from "./admin/promotions/AddPromotionPage";
import ManageSpecialFeaturePage from "./admin/special-feature/ManageSpecialFeaturePage";
import AddSpecialFeaturePage from "./admin/special-feature/AddSpecialFeaturePage";
import ManageFooterMenuPage from "./admin/footer-menu/ManageFooterMenuPage";
import AddFooterMenuPage from "./admin/footer-menu/AddFooterMenuPage";
import ManageTripTypePage from "./admin/trip-type/ManageTripTypePage";
import AddTripTypePage from "./admin/trip-type/AddTripTypePage";
import ManageLocationPage from "./admin/location/ManageLocationPage";
import AddLocationPage from "./admin/location/AddLocationPage";
import ManageActivityPage from "./admin/activity/ManageActivityPage";
import AddActivityPage from "./admin/activity/AddActivityPage";
import ManageDiscountPage from "./admin/discount/ManageDiscountPage";
import AddDiscountPage from "./admin/discount/AddDiscountPage";
import ManageTripPage from "./admin/trip/ManageTripPage";
import AddTripPage from "./admin/trip/AddTripPage";
import TripItineraryPage from "./admin/trip/TripItineraryPage";
import TripFaqPage from "./admin/trip/TripFaqPage";
import ManageTripGalleryPage from "./admin/trip/ManageTripGalleryPage";
import AddTripGalleryPage from "./admin/trip/AddTripGalleryPage";
import TripSectionPage from "./admin/trip/TripSectionPage";
import AddTripBookingPage from "./admin/trip/AddTripBookingPage";
import ManageTripLeaderPage from "./admin/trip-leader/ManageTripLeaderPage";
import AddTripLeaderPage from "./admin/trip-leader/AddTripLeaderPage";
import ManageInvoicePage from "./admin/invoice/ManageInvoicePage";
import AddInvoicePage from "./admin/invoice/AddInvoicePage";
import ManageAttributeTypePage from "./admin/attribute-type/ManageAttributeTypePage";
import AddAttributeTypePage from "./admin/attribute-type/AddAttributeTypePage";
import ManageAttributeValuePage from "./admin/attribute-value/ManageAttributeValuePage";
import AddAttributeValuePage from "./admin/attribute-value/AddAttributeValuePage";
import ManageCategoryPage from "./admin/category/ManageCategoryPage";
import AddCategoryPage from "./admin/category/AddCategoryPage";
import ManageProductPage from "./admin/product/ManageProductPage";
import AddProductPage from "./admin/product/AddProductPage";
import ManageProductAttributePage from "./admin/product-attribute/ManageProductAttributePage";
import AddProductAttributePage from "./admin/product-attribute/AddProductAttributePage";
import ManageUserPage from "./admin/user/ManageUserPage";
import AddUserPage from "./admin/user/AddUserPage";
import ManageTestimonialPage from "./admin/testimonial/ManageTestimonialPage";
import AddTestimonialPage from "./admin/testimonial/AddTestimonialPage";
import ManageStaticPagePage from "./admin/static-page/ManageStaticPagePage";
import AddStaticPagePage from "./admin/static-page/AddStaticPagePage";
import ManageRedirectionPage from "./admin/redirection/ManageRedirectionPage";
import AddRedirectionPage from "./admin/redirection/AddRedirectionPage";
import LoginPage from "./admin/LoginPage";
import ManageOrderPage from "./admin/order/ManageOrderPage";
import OrderDetailPage from "./admin/order/OrderDetailPage";
import ManageMailingListPage from "./admin/mailing-list/ManageMailingListPage";
import AddMailingListPage from "./admin/mailing-list/AddMailingListPage";
import ContestModulePage from "./admin/contest/ContestModulePage";
import AdminSettingsPage from "./admin/settings/AdminSettingsPage";
import { api, emptyBanner } from "@/lib/api";
import { copyTextToClipboard } from "@/lib/clipboard";
import { serializeComparableForm } from "@/lib/adminFormSnapshot";
import {
  canonicalAdminPath,
  pathForAdminPage,
  resolveAdminRoute,
} from "@/routes/adminRoutes";

const emptyPromotion = {
  title: "",
  text: "",
  link: "",
  image_alt: "",
  display_order: "",
  status: "Active",
  image: null,
};
const emptyMailingList = {
  first_name: "",
  last_name: "",
  email_address: "",
  user_type: "",
  newsletter_signup_option: "",
  interests: [],
};
const emptySpecialFeature = { ...emptyPromotion };
const emptyFooterMenu = {
  title: "",
  under: "",
  link: "",
  link_target: "_self",
  display_order: "",
  status: "Active",
};
const emptyRedirection = {
  old_redirection_url: "",
  new_redirection_url: "",
};
const emptyStaticPage = {
  display_as_page: "No",
  parent_id: 0,
  name: "",
  slug: "",
  menu_name: "",
  menu_assign: "",
  social_sharing_display: "",
  meta_title: "",
  meta_descriptions: "",
  meta_keywords: "",
  description: "",
  banner_title: "",
  banner_sub_title: "",
  tooltip_text: "",
  description_type: "old_description",
  description_blocks: [
    {
      image: "",
      image_file: null,
      image_ratio: "",
      image_proportion: "unlock",
      image_width: "",
      image_height: "",
      image_align: "none",
      image_caption: "",
      image_alt: "",
      text_wrap: "yes",
      text: "",
      display_order: "",
    },
  ],
  box_images: [
    {
      image: "",
      image_file: null,
      image_alt: "",
      title: "",
      link: "",
      display_order: "",
    },
  ],
  display_order: "",
  status: "Active",
  banner_image: null,
};
const emptyTripTypeBox = {
  image: "",
  image_alt: "",
  title: "",
  link: "",
  file: null,
};
const emptyTripType = {
  name: "",
  slug: "",
  menu_name: "",
  display_under: "No",
  meta_title: "",
  meta_descriptions: "",
  meta_keywords: "",
  short_description: "",
  description: "",
  tooltip_text: "",
  banner_alt: "",
  listing_image_alt: "",
  display_order: "",
  status: "Active",
  banner_image: null,
  listing_image: null,
  box_images: [{ ...emptyTripTypeBox }],
};
const emptyLocation = { name: "", status: "Active" };
const emptyActivity = { name: "", status: "Active" };
const emptyTestimonial = {
  trip_id: "",
  client_details: "",
  content: "",
  display_order: "",
  status: "Active",
};

function todayInputValue() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function newDiscountCode() {
  return Array.from(crypto.getRandomValues(new Uint8Array(4)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  )
    .join("")
    .toUpperCase();
}

function discountEditValues(item) {
  return {
    name: String(item.name ?? ""),
    code: String(item.code ?? ""),
    type: String(item.type ?? ""),
    value: String(item.value ?? ""),
    start_date: dateInputValue(item.start_date),
    end_date: dateInputValue(item.end_date),
    status: String(item.status || "Active"),
  };
}

const emptyDiscount = {
  name: "",
  code: "",
  type: "",
  value: "",
  start_date: todayInputValue(),
  end_date: "",
  status: "Active",
};
const emptyTrip = {
  name: "",
  slug: "",
  type_id: "",
  location_id: "",
  activity_ids: [],
  activity_level: "",
  blog_post_display: "",
  blog_posts: [""],
  menu_name: "",
  meta_title: "",
  meta_descriptions: "",
  meta_keywords: "",
  short_description: "",
  description: "",
  days: "",
  nights: "",
  deposit_amount: "",
  deposit_amount_text: "",
  price: "",
  price_text: "",
  single_price: "",
  available_for: "",
  included: "",
  excluded: "",
  highlight: "",
  youtube_content: "",
  activity: "",
  arrival: "",
  departure: "",
  pre_post_tour_travel: "",
  accommodations: "",
  meals: "",
  banner_title: "",
  banner_sub_title: "",
  tooltip_text: "",
  banner_alt: "",
  listing_image_alt: "",
  order: "",
  status: "Active",
  banner_image: null,
  map_image: null,
  listing_image: null,
  dates: [
    {
      start_date: "",
      end_date: "",
      date_range: "",
      price: "",
      single_price: "",
      status: "Active",
    },
  ],
  box_images: [
    {
      image: "",
      image_alt: "",
      title: "",
      link: "",
      display_order: "",
    },
  ],
};
const emptyTripGallery = {
  trip_id: "",
  video_url: "",
  image_alt: "",
  display_order: 1,
  display_in_static_page: false,
  display_in_trip_page: false,
  status: "Active",
  image: null,
};
const emptyTripLeaderBlock = {
  image: "",
  image_file: null,
  text: "",
  display_order: "",
  image_alt: "",
  caption: "",
  image_ratio: "",
  image_proportion: "unlock",
  image_width: "",
  image_height: "",
  image_align: "",
  text_wrap: "yes",
};
const emptyTripLeader = {
  name: "",
  guide_name: "",
  meta_title: "",
  meta_description: "",
  meta_keywords: "",
  short_descriptions: "",
  type: "",
  display_order: "",
  alps_hiking_author: "",
  switzerlandtravel_author: "",
  myswisskitchennew_author: "",
  description_blocks: [{ ...emptyTripLeaderBlock }],
  listing_image: null,
};
const emptyInvoiceItem = { name: "", price: "", quantity: 1 };
const emptyInvoice = {
  first_name: "",
  last_name: "",
  user_email_address: "",
  day_phone: "",
  street_address: "",
  street_address1: "",
  postal_code: "",
  city: "",
  country: "",
  state: "",
  items: [{ ...emptyInvoiceItem }],
  deposit_amount: "",
  invoice_date: todayInputValue(),
  due_date: "",
  email_subject: "Alpenwild Deposit Confirmation",
  email_message:
    "<p>Just to confirm, we have sent you an invoice for #product_name#.</p><p>You can pay your balance through our secure online payment portal.<br><a href='https://www.alpenwild.com/staticpage/make-a-payment/' target='_blank'>https://www.alpenwild.com/staticpage/make-a-payment/</a></p>",
};
const emptyAttributeType = { name: "", status: "Active" };
const emptyAttributeValue = {
  type_id: "",
  name: "",
  display_order: "",
  status: "Active",
};
const emptyCategory = {
  parent_id: 0,
  name: "",
  slug: "",
  menu_name: "",
  meta_title: "",
  meta_keywords: "",
  meta_descriptions: "",
  description: "",
  banner_title: "",
  banner_sub_title: "",
  tooltip_text: "",
  display_order: "",
  status: "Active",
  banner_image: null,
  listing_image: null,
  box_images: [{ image: "", title: "", link: "", file: null }],
};
const emptyProduct = {
  name: "",
  slug: "",
  category_id: "",
  menu_name: "",
  meta_title: "",
  meta_descriptions: "",
  meta_keywords: "",
  short_descriptions: "",
  description: "",
  price: "",
  banner_title: "",
  banner_sub_title: "",
  tooltip_text: "",
  banner_alt: "",
  listing_image_alt: "",
  display_order: "",
  status: "Active",
  banner_image: null,
  listing_image: null,
  additional_images: [],
  box_images: [{ image_alt: "", title: "", link: "" }],
};
const emptyProductAttribute = {
  product_id: "",
  type_id: "",
  value_id: "",
  status: "Active",
};
const emptyUser = {
  user_first_name: "",
  user_last_name: "",
  user_preferred_name: "",
  user_street_address: "",
  user_street_address1: "",
  user_city: "",
  user_state: "",
  user_postal_code: "",
  user_country: "",
  user_day_phone: "",
  user_mobile_phone: "",
  user_email_address: "",
  user_date_of_birth: "",
  user_gender: "",
  user_shipping_email_address: "",
  user_shipping_first_name: "",
  user_shipping_last_name: "",
  user_shipping_street_address: "",
  user_shipping_street_address1: "",
  user_shipping_city: "",
  user_shipping_state: "",
  user_shipping_country: "",
  user_shipping_postal_code: "",
  user_status: "Active",
};

function dateInputValue(value) {
  if (value == null || value === "") return "";
  const dateValue = String(value).split("T")[0];
  const date = new Date(`${dateValue}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === dateValue
    ? dateValue
    : "";
}

export default function AdminApp() {
  useEffect(() => {
    const links = [
      ["/vendor/bootstrap-admin.min.css", "admin-bootstrap"],
      ["/vendor/AdminLTE.min.css", "adminlte"],
      ["/vendor/dataTables.bootstrap.css", "admin-datatables"],
    ].map(([href, name]) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.dataset.adminStyle = name;
      document.head.appendChild(link);
      return link;
    });
    return () => links.forEach((link) => link.remove());
  }, []);

  useEffect(() => {
    const adminLteLinks = [
      "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.5.0/css/font-awesome.min.css",
    ].map((href) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.dataset.adminlteAsset = "true";
      document.head.appendChild(link);
      return link;
    });
    const glyphiconsStyle = document.createElement("style");
    glyphiconsStyle.dataset.adminlteAsset = "glyphicons";
    glyphiconsStyle.textContent = `
      @font-face {
        font-family: "Glyphicons Halflings";
        src: url("/vendor/glyphicons-halflings-regular.woff2") format("woff2");
        font-style: normal;
        font-weight: normal;
        font-display: block;
      }
    `;
    document.head.appendChild(glyphiconsStyle);
    return () => {
      adminLteLinks.forEach((link) => link.remove());
      glyphiconsStyle.remove();
    };
  }, []);
  const [page, setPageState] = useState(
    () => resolveAdminRoute(window.location.pathname).page,
  );
  const [banners, setBanners] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [specialFeatures, setSpecialFeatures] = useState([]);
  const [footerMenus, setFooterMenus] = useState([]);
  const [redirections, setRedirections] = useState([]);
  const [staticPages, setStaticPages] = useState([]);
  const [tripTypes, setTripTypes] = useState([]);
  const [locations, setLocations] = useState([]);
  const [activities, setActivities] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [trips, setTrips] = useState([]);
  const [tripGalleries, setTripGalleries] = useState([]);
  const [tripLeaders, setTripLeaders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [attributeTypes, setAttributeTypes] = useState([]);
  const [attributeValues, setAttributeValues] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [productAttributes, setProductAttributes] = useState([]);
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [mailingList, setMailingList] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderDetailLoading, setOrderDetailLoading] = useState(() =>
    resolveAdminRoute(window.location.pathname).page === "orderDetail",
  );
  const [form, setForm] = useState(emptyBanner);
  const [promotionForm, setPromotionForm] = useState(emptyPromotion);
  const [specialFeatureForm, setSpecialFeatureForm] =
    useState(emptySpecialFeature);
  const [editingId, setEditingId] = useState(null);
  const [editingPromotionId, setEditingPromotionId] = useState(null);
  const [editingSpecialFeatureId, setEditingSpecialFeatureId] = useState(null);
  const [footerForm, setFooterForm] = useState(emptyFooterMenu);
  const [tripTypeForm, setTripTypeForm] = useState(emptyTripType);
  const [editingFooterId, setEditingFooterId] = useState(null);
  const [redirectionForm, setRedirectionForm] = useState(emptyRedirection);
  const [editingRedirectionId, setEditingRedirectionId] = useState(null);
  const [staticPageForm, setStaticPageForm] = useState(emptyStaticPage);
  const [editingStaticPageId, setEditingStaticPageId] = useState(null);
  const [editingTripTypeId, setEditingTripTypeId] = useState(null);
  const [locationForm, setLocationForm] = useState(emptyLocation);
  const [activityForm, setActivityForm] = useState(emptyActivity);
  const [editingLocationId, setEditingLocationId] = useState(null);
  const [editingActivityId, setEditingActivityId] = useState(null);
  const [testimonialForm, setTestimonialForm] = useState(emptyTestimonial);
  const [editingTestimonialId, setEditingTestimonialId] = useState(null);
  const [discountForm, setDiscountForm] = useState(emptyDiscount);
  const [editingDiscountId, setEditingDiscountId] = useState(null);
  const editSnapshots = useRef(new Map());
  const itinerarySnapshot = useRef(null);
  const [tripForm, setTripForm] = useState(emptyTrip);
  const [editingTripId, setEditingTripId] = useState(null);
  const [tripGalleryForm, setTripGalleryForm] = useState(emptyTripGallery);
  const [editingTripGalleryId, setEditingTripGalleryId] = useState(null);
  const [tripLeaderForm, setTripLeaderForm] = useState(emptyTripLeader);
  const [editingTripLeaderId, setEditingTripLeaderId] = useState(null);
  const [invoiceForm, setInvoiceForm] = useState(emptyInvoice);
  const [editingInvoiceId, setEditingInvoiceId] = useState(null);
  const [attributeTypeForm, setAttributeTypeForm] =
    useState(emptyAttributeType);
  const [editingAttributeTypeId, setEditingAttributeTypeId] = useState(null);
  const [attributeValueForm, setAttributeValueForm] =
    useState(emptyAttributeValue);
  const [editingAttributeValueId, setEditingAttributeValueId] = useState(null);
  const [categoryForm, setCategoryForm] = useState(emptyCategory);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [categoryFormRevision, setCategoryFormRevision] = useState(0);
  const [productForm, setProductForm] = useState(emptyProduct);
  const [editingProductId, setEditingProductId] = useState(null);
  const [productAttributeForm, setProductAttributeForm] = useState(
    emptyProductAttribute,
  );
  const [editingProductAttributeId, setEditingProductAttributeId] =
    useState(null);
  const [userForm, setUserForm] = useState(emptyUser);
  const [editingUserId, setEditingUserId] = useState(null);
  const [mailingListForm, setMailingListForm] = useState(emptyMailingList);
  const [editingMailingListId, setEditingMailingListId] = useState(null);
  const [itineraryTrip, setItineraryTrip] = useState(null);
  const [itineraryEntries, setItineraryEntries] = useState([]);
  const [isNewItinerary, setIsNewItinerary] = useState(false);
  const [faqTrip, setFaqTrip] = useState(null);
  const [faqEditId, setFaqEditId] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [contestHeaderSubtitle, setContestHeaderSubtitle] = useState("");
  const currentPathRef = useRef(
    `${window.location.pathname}${window.location.search}`,
  );
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginMessage, setLoginMessage] = useState("");
  const [loginMessageType, setLoginMessageType] = useState("error");
  const [adminDataLoading, setAdminDataLoading] = useState(true);

  useEffect(() => {
    document.title = authUser ? "Alpenwild | Admin" : "Alpenwild | Log in";
  }, [authUser]);

  useEffect(() => {
    if (notice || error)
      window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }, [notice, error]);

  useEffect(() => {
    const noticeSelector =
      ".app-shell .alert.error, .app-shell .alert.success, .app-shell .trip-success-alert, .app-shell .form-error, .app-shell .notice, .login-page .alert.error, .login-page .alert.success";
    let frameId = null;
    const scrollForNotice = (node) => {
      const notice =
        node.nodeType === Node.ELEMENT_NODE
          ? node.matches(noticeSelector)
            ? node
            : node.closest(noticeSelector)
          : node.parentElement?.closest(noticeSelector);
      if (!notice || !notice.textContent.replace(/[×\s]/g, "")) return;
      if (frameId !== null) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
        frameId = null;
      });
    };
    const observer = new MutationObserver((records) => {
      records.forEach((record) => {
        if (record.type === "characterData") {
          scrollForNotice(record.target);
          return;
        }
        record.addedNodes.forEach(scrollForNotice);
      });
    });
    observer.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    return () => {
      observer.disconnect();
      if (frameId !== null) cancelAnimationFrame(frameId);
    };
  }, []);

  useEffect(() => {
    if (
      page !== "addDiscount" ||
      resolveAdminRoute(window.location.pathname).editPath
    ) {
      return;
    }
    setDiscountForm((current) =>
      current.code ? current : { ...current, code: newDiscountCode() },
    );
  }, [page]);

  function resetEditorState() {
    setEditingId(null);
    setEditingPromotionId(null);
    setEditingSpecialFeatureId(null);
    setEditingFooterId(null);
    setEditingRedirectionId(null);
    setEditingStaticPageId(null);
    setEditingTripTypeId(null);
    setEditingLocationId(null);
    setEditingActivityId(null);
    setEditingTestimonialId(null);
    setEditingDiscountId(null);
    setEditingTripId(null);
    setEditingTripGalleryId(null);
    setEditingTripLeaderId(null);
    setEditingInvoiceId(null);
    setEditingAttributeTypeId(null);
    setEditingAttributeValueId(null);
    setEditingCategoryId(null);
    setEditingProductId(null);
    setEditingProductAttributeId(null);
    setEditingUserId(null);
    setEditingMailingListId(null);
    setForm(emptyBanner);
    setPromotionForm(emptyPromotion);
    setSpecialFeatureForm(emptySpecialFeature);
    setFooterForm(emptyFooterMenu);
    setRedirectionForm(emptyRedirection);
    setStaticPageForm(emptyStaticPage);
    setTripTypeForm(emptyTripType);
    setLocationForm(emptyLocation);
    setActivityForm(emptyActivity);
    setTestimonialForm(emptyTestimonial);
    setDiscountForm(emptyDiscount);
    setTripForm(emptyTrip);
    setTripGalleryForm(emptyTripGallery);
    setTripLeaderForm(emptyTripLeader);
    setInvoiceForm(emptyInvoice);
    setAttributeTypeForm(emptyAttributeType);
    setAttributeValueForm(emptyAttributeValue);
    setCategoryForm(emptyCategory);
    setProductForm(emptyProduct);
    setProductAttributeForm(emptyProductAttribute);
    setUserForm(emptyUser);
    setMailingListForm(emptyMailingList);
    setItineraryTrip(null);
    setItineraryEntries([]);
    setIsNewItinerary(false);
    itinerarySnapshot.current = null;
    setFaqTrip(null);
    setFaqEditId(null);
  }

  function downloadAllBookings() {
    window.location.href = "/api/trip-bookings/download";
  }

  function scrollAdminListToTop() {
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    });
  }

  function navigate(pageName, path = pathForAdminPage(pageName)) {
    path = canonicalAdminPath(path);
    window.history.pushState({}, "", path);
    currentPathRef.current = `${window.location.pathname}${window.location.search}`;
    setNotice("");
    setError("");
    const route = resolveAdminRoute(path);
    if (!route.editPath) resetEditorState();
    if (pageName === "addDiscount" && !route.editPath)
      setDiscountForm({ ...emptyDiscount, code: newDiscountCode() });
    setPageState(pageName);
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }

  function completeTripBookingSave(message) {
    const returnTo = new URLSearchParams(window.location.search).get(
      "returnTo",
    );
    navigate(returnTo === "all" ? "tripBookings" : "recentTripBookings");
    setNotice(message);
  }

  async function deleteTripBooking(row) {
    if (!window.confirm("Are you sure, you want to delete this Trips?")) return;
    try {
      await api(`/api/trip-bookings/${row.id}`, { method: "DELETE" });
      setNotice("Trip booking deleted successfully.");
      window.dispatchEvent(new PopStateEvent("popstate"));
    } catch (error) {
      setNotice(error.message);
    }
  }

  useEffect(() => {
    function handleHistoryChange() {
      const currentPath = `${window.location.pathname}${window.location.search}`;
      if (currentPath !== currentPathRef.current) {
        setNotice("");
        setError("");
        currentPathRef.current = currentPath;
      }
      const route = resolveAdminRoute(window.location.pathname);
      if (!route.editPath) resetEditorState();
      setPageState(route.page);
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }

    window.addEventListener("popstate", handleHistoryChange);
    return () => window.removeEventListener("popstate", handleHistoryChange);
  }, []);
  async function load() {
    const [
      bannerData,
      promotionData,
      specialFeatureData,
      footerData,
      redirectionData,
      staticPageData,
      tripTypeData,
      locationData,
      activityData,
      testimonialData,
      discountData,
      tripData,
      tripGalleryData,
      tripLeaderData,
      invoiceData,
      attributeTypeData,
      attributeValueData,
      categoryData,
      productData,
      productAttributeData,
      userData,
      orderData,
      mailingListData,
    ] = await Promise.all([
      api("/api/banners"),
      api("/api/promotions"),
      api("/api/special-features"),
      api("/api/footer-menus"),
      api("/api/redirections"),
      api("/api/static-pages"),
      api("/api/trip-types"),
      api("/api/locations"),
      api("/api/activities"),
      api("/api/testimonials"),
      api("/api/discounts"),
      api("/api/trips"),
      api("/api/trip-galleries").catch(() => []),
      api("/api/trip-leaders").catch(() => []),
      api("/api/invoices"),
      api("/api/attribute-types"),
      api("/api/attribute-values"),
      api("/api/categories"),
      api("/api/products"),
      api("/api/product-attributes"),
      api("/api/users"),
      api("/api/orders").catch(() => []),
      api("/api/mailing-list").catch(() => []),
    ]);
    setBanners(bannerData);
    setPromotions(promotionData);
    setSpecialFeatures(specialFeatureData);
    setFooterMenus(footerData);
    setRedirections(redirectionData);
    setStaticPages(staticPageData);
    setTripTypes(tripTypeData);
    setLocations(locationData);
    setActivities(activityData);
    setTestimonials(testimonialData);
    setDiscounts(discountData);
    setTrips(tripData);
    setTripGalleries(tripGalleryData);
    setTripLeaders(tripLeaderData);
    setInvoices(invoiceData);
    setAttributeTypes(attributeTypeData);
    setAttributeValues(attributeValueData);
    setCategories(categoryData);
    setProducts(productData);
    setProductAttributes(productAttributeData);
    setUsers(userData);
    setOrders(orderData);
    setMailingList(mailingListData);
  }
  useEffect(() => {
    function handleAdminSessionExpired(event) {
      const sessionWasActive =
        event.detail?.expired ||
        sessionStorage.getItem("admin_session_active") === "true";
      if (!sessionWasActive) return;
      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (
        canonicalAdminPath(window.location.pathname) !== "/administrator/login"
      ) {
        sessionStorage.setItem("admin_return_path", currentPath);
      }
      sessionStorage.removeItem("admin_session_active");
      setAuthUser(null);
      setAuthLoading(false);
      setLoginMessage("Please login first to access this page!");
      setLoginMessageType("error");
      setNotice("");
      setError("");
      setPageState("dashboard");
      window.history.replaceState({}, "", "/administrator/login");
    }
    window.addEventListener("admin-session-expired", handleAdminSessionExpired);
    return () =>
      window.removeEventListener(
        "admin-session-expired",
        handleAdminSessionExpired,
      );
  }, []);

  useEffect(() => {
    api("/api/auth/me")
      .then((user) => {
        sessionStorage.setItem("admin_session_active", "true");
        setAuthUser(user);
      })
      .catch((err) => {
        setAuthUser(null);
        if (err.code === "ADMIN_SESSION_EXPIRED") {
          setLoginMessage(err.message);
          setLoginMessageType("error");
        }
      })
      .finally(() => setAuthLoading(false));
  }, []);
  useEffect(() => {
    if (
      !authLoading &&
      !authUser &&
      canonicalAdminPath(window.location.pathname) !== "/administrator/login"
    ) {
      sessionStorage.setItem(
        "admin_return_path",
        `${window.location.pathname}${window.location.search}${window.location.hash}`,
      );
      window.history.replaceState({}, "", "/administrator/login");
    }
  }, [authLoading, authUser]);
  useEffect(() => {
    if (!authUser) return;
    setAdminDataLoading(true);
    load()
      .catch((err) => setError(err.message))
      .finally(() => setAdminDataLoading(false));
  }, [authUser]);
  useEffect(() => {
    if (!authUser || page !== "orderDetail") return;
    const orderId = window.location.pathname.split("/")[3];
    let cancelled = false;
    setOrderDetailLoading(true);
    setSelectedOrder(null);
    api(`/api/orders/${orderId}`)
      .then((order) => {
        if (!cancelled) setSelectedOrder(order);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setOrderDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authUser, page]);
  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function startAdd() {
    setEditingId(null);
    setForm(emptyBanner);
    navigate("add");
  }

  function startEdit(banner) {
    setEditingId(banner.id);
    setForm({
      ...emptyBanner,
      title: banner.title || "",
      sub_heading: banner.sub_heading || "",
      tooltip_text: banner.tooltip_text || "",
      link: banner.link || "",
      image_url: banner.image_url || "",
      image_alt: banner.image_alt || "",
      button_label: banner.button_label || "",
      button_link: banner.button_link || "",
      display_order: banner.display_order || 1,
      status: banner.status || "Active",
    });
    navigate("add", `/administrator/banners/${banner.id}/edit`);
  }

  function startAddPromotion() {
    setEditingPromotionId(null);
    setPromotionForm(emptyPromotion);
    navigate("addPromotion");
  }

  function startEditPromotion(promotion) {
    setEditingPromotionId(promotion.id);
    setPromotionForm({
      ...emptyPromotion,
      title: promotion.title || "",
      text: promotion.text || "",
      link: promotion.link || "",
      image_url: promotion.image_url || "",
      image_alt: promotion.image_alt || "",
      display_order: promotion.display_order || 1,
      status: promotion.status || "Active",
    });
    navigate("addPromotion", `/administrator/promotions/${promotion.id}/edit`);
  }

  function startAddSpecialFeature() {
    setEditingSpecialFeatureId(null);
    setSpecialFeatureForm(emptySpecialFeature);
    navigate("addSpecialFeature");
  }

  function startEditSpecialFeature(feature) {
    setEditingSpecialFeatureId(feature.id);
    setSpecialFeatureForm({
      ...emptySpecialFeature,
      title: feature.title || "",
      text: feature.text || "",
      link: feature.link || "",
      image_url: feature.image_url || "",
      image_alt: feature.image_alt || "",
      display_order: feature.display_order || 1,
      status: feature.status || "Active",
    });
    navigate(
      "addSpecialFeature",
      `/administrator/special-features/${feature.id}/edit`,
    );
  }

  function startAddFooter() {
    setEditingFooterId(null);
    setFooterForm(emptyFooterMenu);
    navigate("addFooterMenu");
  }
  function startEditFooter(item) {
    setEditingFooterId(item.id);
    setFooterForm({ ...emptyFooterMenu, ...item });
    navigate("addFooterMenu", `/administrator/footer-menus/${item.id}/edit`);
  }
  function startAddRedirection() {
    setEditingRedirectionId(null);
    setRedirectionForm(emptyRedirection);
    navigate("addRedirection");
  }
  function startEditRedirection(item) {
    setEditingRedirectionId(item.id);
    setRedirectionForm({ ...emptyRedirection, ...item });
    navigate("addRedirection", `/administrator/redirections/${item.id}/edit`);
  }
  function startAddStaticPage() {
    setEditingStaticPageId(null);
    setStaticPageForm(emptyStaticPage);
    navigate("addStaticPage");
  }
  function startEditStaticPage(item) {
    setEditingStaticPageId(item.id);
    setStaticPageForm({
      ...emptyStaticPage,
      ...item,
      description_blocks: item.description_blocks?.length
        ? item.description_blocks.map((block) => ({
            ...block,
            image_file: null,
          }))
        : emptyStaticPage.description_blocks,
      box_images: item.box_images?.length
        ? item.box_images.map((box) => ({ ...box, image_file: null }))
        : emptyStaticPage.box_images,
      banner_image: null,
    });
    navigate("addStaticPage", `/administrator/static-pages/${item.id}/edit`);
  }
  function startAddTripType() {
    setEditingTripTypeId(null);
    setTripTypeForm(emptyTripType);
    navigate("addTripType");
  }
  function startEditTripType(item) {
    setEditingTripTypeId(item.id);
    setTripTypeForm({
      ...emptyTripType,
      ...item,
      box_images: item.box_images?.length
        ? item.box_images.map((box) => ({ ...box, file: null }))
        : [{ ...emptyTripTypeBox }],
      banner_image: null,
      listing_image: null,
    });
    navigate("addTripType", `/administrator/trip-types/${item.id}/edit`);
  }
  function startAddLocation() {
    setEditingLocationId(null);
    setLocationForm(emptyLocation);
    navigate("addLocation");
  }
  function startEditLocation(item) {
    setEditingLocationId(item.id);
    setLocationForm({ ...emptyLocation, ...item });
    navigate("addLocation", `/administrator/locations/${item.id}/edit`);
  }
  function startAddActivity() {
    setEditingActivityId(null);
    setActivityForm(emptyActivity);
    navigate("addActivity");
  }
  function startEditActivity(item) {
    setEditingActivityId(item.id);
    setActivityForm({ ...emptyActivity, ...item });
    navigate("addActivity", `/administrator/activities/${item.id}/edit`);
  }
  function startAddTestimonial() {
    setEditingTestimonialId(null);
    setTestimonialForm({ ...emptyTestimonial });
    navigate("addTestimonial");
  }
  function startEditTestimonial(item) {
    setEditingTestimonialId(item.id);
    setTestimonialForm({
      ...emptyTestimonial,
      trip_id: item.trip_id || "",
      client_details: item.client_details || "",
      content: item.content || "",
      display_order: item.display_order ?? "",
      status: item.status || "Active",
    });
    navigate("addTestimonial", `/administrator/testimonials/${item.id}/edit`);
  }
  function startAddDiscount() {
    setEditingDiscountId(null);
    navigate("addDiscount");
  }
  function startEditDiscount(item) {
    setEditingDiscountId(item.id);
    const values = discountEditValues(item);
    setDiscountForm({ ...emptyDiscount, ...values });
    navigate("addDiscount", `/administrator/discounts/${item.id}/edit`);
  }
  function startAddTrip() {
    setEditingTripId(null);
    setTripForm({ ...emptyTrip });
    navigate("addTrip");
  }
  function startEditTrip(item) {
    setEditingTripId(item.id);
    setTripForm({
      ...emptyTrip,
      ...item,
      order: item.order ?? item.display_order ?? 1,
      blog_posts: [item.blog_post_display || ""],
      activity_ids: item.activity_ids || [],
      dates: (item.dates && item.dates.length
        ? item.dates
        : emptyTrip.dates
      ).map((date) => ({
        ...date,
        start_date: dateInputValue(date.start_date),
        end_date: dateInputValue(date.end_date),
        date_range: date.date_range ?? "",
        price: date.price ?? "",
        single_price: date.single_price ?? "",
        status: date.status || "Active",
      })),
      box_images:
        item.box_images && item.box_images.length
          ? item.box_images
          : emptyTrip.box_images,
      banner_image: null,
      map_image: null,
      listing_image: null,
    });
    navigate("addTrip", `/administrator/trips/${item.id}/edit`);
  }
  async function updateTripDateAction(date, action) {
    if (!editingTripId || !date.id) return;
    const confirmation =
      action === "delete"
        ? "Are you sure, you want to delete this date?"
        : action === "deactivate"
          ? "Are you sure, you want to deactivate this date?"
          : action === "activate"
            ? "Are you sure, you want to activate this date?"
            : "";
    if (confirmation && !window.confirm(confirmation)) return;
    try {
      if (action === "delete") {
        await api(`/api/trips/${editingTripId}/dates/${date.id}`, {
          method: "DELETE",
        });
        setTripForm((current) => ({
          ...current,
          dates: current.dates.filter((item) => item.id !== date.id),
        }));
        return;
      }
      const status =
        action === "deactivate"
          ? "Inactive"
          : action === "activate"
            ? "Active"
            : action === "soldOut"
              ? "Sold Out"
              : "Active";
      const updated = await api(
        `/api/trips/${editingTripId}/dates/${date.id}/status`,
        { method: "PATCH", body: JSON.stringify({ status }) },
      );
      setTripForm((current) => ({
        ...current,
        dates: current.dates.map((item) =>
          item.id === date.id ? { ...item, status: updated.status } : item,
        ),
      }));
    } catch (err) {
      setError(err.message);
    }
  }
  async function startItinerary(item) {
    try {
      const entries = await api(`/api/trips/${item.id}/itinerary`);
      const days = Math.max(
        0,
        ...(item.dates || []).map((date) => {
          if (Number(date.date_range) > 0) return Number(date.date_range);
          if (!date.start_date || !date.end_date) return 0;
          const start = new Date(`${date.start_date}T00:00:00`);
          const end = new Date(`${date.end_date}T00:00:00`);
          return Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())
            ? 0
            : Math.floor((end - start) / 86400000) + 1;
        }),
      );
      const values = entries.length
        ? entries
        : Array.from({ length: days }, (_, index) => ({
            day: index + 1,
            title: "",
            description: "",
          }));
      itinerarySnapshot.current = serializeComparableForm(values);
      setIsNewItinerary(entries.length === 0);
      setItineraryTrip(item);
      setItineraryEntries(values);
      navigate("tripItinerary", `/administrator/trips/${item.id}/itinerary`);
    } catch (err) {
      setError(err.message);
    }
  }
  function startAddMailingList() {
    setEditingMailingListId(null);
    setMailingListForm(emptyMailingList);
    navigate("addMailingList");
  }
  function startEditMailingList(item) {
    const interests = (item.newsletter_signup_option || "")
      .split("<br>")
      .map((value) => value.trim())
      .filter(Boolean);
    setEditingMailingListId(item.id);
    setMailingListForm({ ...emptyMailingList, ...item, interests });
    navigate("addMailingList", `/administrator/mailing-list/${item.id}/edit`);
  }
  async function saveMailingList(event) {
    event.preventDefault();
    setNotice("");
    setError("");
    if (showUnchangedEdit("mailingList", editingMailingListId, mailingListForm))
      return;
    const newsletter_signup_option = mailingListForm.interests
      .map((interest) => `${interest}<br>`)
      .join("");
    try {
      const wasEditing = Boolean(editingMailingListId);
      await api(
        editingMailingListId
          ? `/api/mailing-list/${editingMailingListId}`
          : "/api/mailing-list",
        {
          method: editingMailingListId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...mailingListForm,
            newsletter_signup_option,
          }),
        },
      );
      setEditingMailingListId(null);
      setMailingListForm(emptyMailingList);
      navigate("mailingList");
      await load();
      setNotice(
        wasEditing
          ? "User updated successfully."
          : "User added successfully. Please enter another.",
      );
    } catch (err) {
      setError(err.message);
    }
  }
  async function removeMailingList(item) {
    if (!window.confirm("Are you sure, you want to delete this Mailing List?"))
      return;
    setNotice("");
    setError("");
    try {
      await api(`/api/mailing-list/${item.id}`, { method: "DELETE" });
      await load();
      setNotice("User details deleted successfully");
    } catch (err) {
      setError(err.message);
    }
  }
  function updateMailingList(field, value) {
    setMailingListForm((current) => {
      if (field !== "interest") return { ...current, [field]: value };
      const interests = value.checked
        ? [...new Set([...current.interests, value.label])]
        : current.interests.filter((interest) => interest !== value.label);
      return { ...current, interests };
    });
  }
  function openTripFaq(item) {
    setFaqTrip(item);
    setFaqEditId(null);
    navigate("tripFaq", `/administrator/trips/${item.id}/faq`);
  }

  useEffect(() => {
    const route = resolveAdminRoute(window.location.pathname);
    if (
      (route.page === "tripItinerary" ||
        route.page === "tripFaq" ||
        route.page === "tripFaqEdit") &&
      !itineraryTrip &&
      !faqTrip
    ) {
      const itineraryMatch = route.editPath?.match(
        /\/trips\/(\d+)\/(?:itinerary|faq(?:\/\d+\/edit)?)$/,
      );
      const item = trips.find((row) => row.id === Number(itineraryMatch?.[1]));
      if (item) {
        if (route.page === "tripFaq" || route.page === "tripFaqEdit") {
          setFaqTrip(item);
          setFaqEditId(
            route.page === "tripFaqEdit"
              ? Number(route.editPath.match(/\/faq\/(\d+)\/edit$/)?.[1])
              : null,
          );
        } else startItinerary(item);
      }
    }
    const match = route.editPath?.match(/\/(\d+)\/edit$/);
    if (!match) return;

    const id = Number(match[1]);
    if (route.module === "banners" && editingId !== id) {
      const banner = banners.find((item) => item.id === id);
      if (banner) {
        setEditingId(banner.id);
        setForm({
          ...emptyBanner,
          title: banner.title || "",
          sub_heading: banner.sub_heading || "",
          tooltip_text: banner.tooltip_text || "",
          link: banner.link || "",
          image_url: banner.image_url || "",
          image_alt: banner.image_alt || "",
          button_label: banner.button_label || "",
          button_link: banner.button_link || "",
          display_order: banner.display_order || 1,
          status: banner.status || "Active",
        });
      }
    }
    if (route.module === "promotions" && editingPromotionId !== id) {
      const promotion = promotions.find((item) => item.id === id);
      if (promotion) {
        setEditingPromotionId(promotion.id);
        setPromotionForm({
          ...emptyPromotion,
          title: promotion.title || "",
          text: promotion.text || "",
          link: promotion.link || "",
          image_url: promotion.image_url || "",
          image_alt: promotion.image_alt || "",
          display_order: promotion.display_order || 1,
          status: promotion.status || "Active",
        });
      }
    }
    if (route.module === "specialFeatures" && editingSpecialFeatureId !== id) {
      const feature = specialFeatures.find((item) => item.id === id);
      if (feature) {
        setEditingSpecialFeatureId(feature.id);
        setSpecialFeatureForm({
          ...emptySpecialFeature,
          title: feature.title || "",
          text: feature.text || "",
          link: feature.link || "",
          image_url: feature.image_url || "",
          image_alt: feature.image_alt || "",
          display_order: feature.display_order || 1,
          status: feature.status || "Active",
        });
      }
    }
    if (route.module === "footerMenus" && editingFooterId !== id) {
      const item = footerMenus.find((row) => row.id === id);
      if (item) {
        setEditingFooterId(id);
        setFooterForm({ ...emptyFooterMenu, ...item });
      }
    }
    if (route.module === "redirections" && editingRedirectionId !== id) {
      const item = redirections.find((row) => row.id === id);
      if (item) startEditRedirection(item);
    }
    if (route.module === "staticPages" && editingStaticPageId !== id) {
      const item = staticPages.find((row) => row.id === id);
      if (item) startEditStaticPage(item);
    }
    if (route.module === "tripTypes" && editingTripTypeId !== id) {
      const item = tripTypes.find((row) => row.id === id);
      if (item) {
        setEditingTripTypeId(id);
        setTripTypeForm({
          ...emptyTripType,
          ...item,
          box_images: item.box_images?.length
            ? item.box_images.map((box) => ({ ...box, file: null }))
            : [{ ...emptyTripTypeBox }],
          banner_image: null,
          listing_image: null,
        });
      }
    }
    if (route.module === "locations" && editingLocationId !== id) {
      const item = locations.find((row) => row.id === id);
      if (item) {
        setEditingLocationId(id);
        setLocationForm({ ...emptyLocation, ...item });
      }
    }
    if (route.module === "activities" && editingActivityId !== id) {
      const item = activities.find((row) => row.id === id);
      if (item) {
        setEditingActivityId(id);
        setActivityForm({ ...emptyActivity, ...item });
      }
    }
    if (route.module === "testimonials" && editingTestimonialId !== id) {
      const item = testimonials.find((row) => row.id === id);
      if (item) startEditTestimonial(item);
    }
    if (route.module === "discounts" && editingDiscountId !== id) {
      const item = discounts.find((row) => row.id === id);
      if (item) {
        const values = discountEditValues(item);
        setEditingDiscountId(id);
        setDiscountForm({ ...emptyDiscount, ...values });
      }
    }
    if (route.page === "addTrip" && editingTripId !== id) {
      const item = trips.find((row) => row.id === id);
      if (item) startEditTrip(item);
    }
    if (route.page === "addTripGallery" && editingTripGalleryId !== id) {
      const item = tripGalleries.find((row) => row.id === id);
      if (item) startEditTripGallery(item);
    }
    if (route.module === "tripLeaders" && editingTripLeaderId !== id) {
      const item = tripLeaders.find((row) => row.id === id);
      if (item) startEditTripLeader(item);
    }
    if (route.module === "invoices" && editingInvoiceId !== id) {
      const item = invoices.find((row) => row.id === id);
      if (item) startEditInvoice(item);
    }
    if (route.module === "categories" && editingCategoryId !== id) {
      const item = categories.find((row) => row.id === id);
      if (item) startEditCategory(item);
    }
    if (route.module === "products" && editingProductId !== id) {
      const item = products.find((row) => row.id === id);
      if (item) startEditProduct(item);
    }
    if (
      route.module === "productAttributes" &&
      editingProductAttributeId !== id
    ) {
      const item = productAttributes.find((row) => row.id === id);
      if (item) startEditProductAttribute(item);
    }
    if (route.module === "users" && editingUserId !== id) {
      const item = users.find((row) => row.id === id);
      if (item) startEditUser(item);
    }
  }, [
    banners,
    promotions,
    specialFeatures,
    footerMenus,
    redirections,
    staticPages,
    tripTypes,
    editingId,
    editingPromotionId,
    editingSpecialFeatureId,
    editingFooterId,
    editingRedirectionId,
    editingStaticPageId,
    editingTripTypeId,
    locations,
    activities,
    editingLocationId,
    editingActivityId,
    testimonials,
    editingTestimonialId,
    discounts,
    editingDiscountId,
    trips,
    editingTripId,
    tripGalleries,
    editingTripGalleryId,
    tripLeaders,
    editingTripLeaderId,
    invoices,
    editingInvoiceId,
    attributeTypes,
    editingAttributeTypeId,
    categories,
    editingCategoryId,
    products,
    editingProductId,
    productAttributes,
    editingProductAttributeId,
    users,
    editingUserId,
    itineraryTrip,
    faqTrip,
  ]);

  useEffect(() => {
    const entries = [
      ["banners", editingId, form],
      ["promotions", editingPromotionId, promotionForm],
      ["specialFeatures", editingSpecialFeatureId, specialFeatureForm],
      ["footerMenus", editingFooterId, footerForm],
      ["redirections", editingRedirectionId, redirectionForm],
      ["staticPages", editingStaticPageId, staticPageForm],
      ["tripTypes", editingTripTypeId, tripTypeForm],
      ["locations", editingLocationId, locationForm],
      ["activities", editingActivityId, activityForm],
      ["testimonials", editingTestimonialId, testimonialForm],
      ["discounts", editingDiscountId, discountForm],
      ["trips", editingTripId, tripForm],
      ["tripGalleries", editingTripGalleryId, tripGalleryForm],
      ["tripLeaders", editingTripLeaderId, tripLeaderForm],
      ["invoices", editingInvoiceId, invoiceForm],
      ["attributeTypes", editingAttributeTypeId, attributeTypeForm],
      ["attributeValues", editingAttributeValueId, attributeValueForm],
      ["categories", editingCategoryId, categoryForm],
      ["products", editingProductId, productForm],
      ["productAttributes", editingProductAttributeId, productAttributeForm],
      ["users", editingUserId, userForm],
      ["mailingList", editingMailingListId, mailingListForm],
    ];
    editSnapshots.current = new Map(
      entries
        .filter(([, id]) => id !== null && id !== undefined)
        .map(([module, id, values]) => [
          `${module}:${id}`,
          serializeComparableForm(values),
        ]),
    );
  }, [
    editingId,
    editingPromotionId,
    editingSpecialFeatureId,
    editingFooterId,
    editingRedirectionId,
    editingStaticPageId,
    editingTripTypeId,
    editingLocationId,
    editingActivityId,
    editingTestimonialId,
    editingDiscountId,
    editingTripId,
    editingTripGalleryId,
    editingTripLeaderId,
    editingInvoiceId,
    editingAttributeTypeId,
    editingAttributeValueId,
    editingCategoryId,
    editingProductId,
    editingProductAttributeId,
    editingUserId,
    editingMailingListId,
  ]);

  function showUnchangedEdit(module, id, values) {
    if (id === null || id === undefined) return false;
    const key = `${module}:${id}`;
    const initialValues = editSnapshots.current.get(key);
    if (
      initialValues === undefined ||
      initialValues !== serializeComparableForm(values)
    )
      return false;
    editSnapshots.current.delete(key);
    navigate(module);
    setNotice("Sorry, nothing is updated.");
    return true;
  }

  async function save(event) {
    event.preventDefault();
    setNotice("");
    setError("");
    if (showUnchangedEdit("banners", editingId, form)) return;
    const body = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      if (key !== "image_url" && value !== null) body.append(key, value);
    });
    try {
      await api(editingId ? `/api/banners/${editingId}` : "/api/banners", {
        method: editingId ? "PATCH" : "POST",
        body,
      });
      const wasEditing = Boolean(editingId);
      setEditingId(null);
      setForm(emptyBanner);
      navigate("banners");
      setNotice(
        wasEditing
          ? "Banner updated successfully."
          : "Banner added successfully.",
      );
      await load();
    } catch (err) {
      setError(err.message);
    }
  }
  async function toggle(banner) {
    try {
      await api(`/api/banners/${banner.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: banner.status === "Active" ? "Inactive" : "Active",
        }),
      });
      await load();
      setNotice("User's Status is updated successfully");
    } catch (err) {
      setError(err.message);
    }
  }

  async function savePromotion(event) {
    event.preventDefault();
    setNotice("");
    setError("");
    if (showUnchangedEdit("promotions", editingPromotionId, promotionForm))
      return;
    const body = new FormData();
    Object.entries(promotionForm).forEach(([key, value]) => {
      if (key !== "image_url" && value !== null) body.append(key, value);
    });
    try {
      await api(
        editingPromotionId
          ? `/api/promotions/${editingPromotionId}`
          : "/api/promotions",
        {
          method: editingPromotionId ? "PATCH" : "POST",
          body,
        },
      );
      const wasEditing = Boolean(editingPromotionId);
      setEditingPromotionId(null);
      setPromotionForm(emptyPromotion);
      navigate("promotions");
      setNotice(
        wasEditing
          ? "Offers promotion updated successfully."
          : "Offers promotion added successfully.",
      );
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function togglePromotion(promotion) {
    try {
      await api(`/api/promotions/${promotion.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: promotion.status === "Active" ? "Inactive" : "Active",
        }),
      });
      await load();
      setNotice("Offers Promotions Status is updated successfully");
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveSpecialFeature(event) {
    event.preventDefault();
    setNotice("");
    setError("");
    if (
      showUnchangedEdit(
        "specialFeatures",
        editingSpecialFeatureId,
        specialFeatureForm,
      )
    )
      return;
    const body = new FormData();
    Object.entries(specialFeatureForm).forEach(([key, value]) => {
      if (key !== "image_url" && value !== null) body.append(key, value);
    });
    try {
      await api(
        editingSpecialFeatureId
          ? `/api/special-features/${editingSpecialFeatureId}`
          : "/api/special-features",
        {
          method: editingSpecialFeatureId ? "PATCH" : "POST",
          body,
        },
      );
      const wasEditing = Boolean(editingSpecialFeatureId);
      setEditingSpecialFeatureId(null);
      setSpecialFeatureForm(emptySpecialFeature);
      navigate("specialFeatures");
      setNotice(
        wasEditing
          ? "Special feature updated successfully."
          : "Special feature added successfully.",
      );
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleSpecialFeature(feature) {
    try {
      await api(`/api/special-features/${feature.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: feature.status === "Active" ? "Inactive" : "Active",
        }),
      });
      await load();
      setNotice("Special Feature Status is updated successfully");
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveFooter(event) {
    event.preventDefault();
    setNotice("");
    setError("");
    if (showUnchangedEdit("footerMenus", editingFooterId, footerForm)) return;
    try {
      await api(
        editingFooterId
          ? `/api/footer-menus/${editingFooterId}`
          : "/api/footer-menus",
        {
          method: editingFooterId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(footerForm),
        },
      );
      setEditingFooterId(null);
      setFooterForm(emptyFooterMenu);
      navigate("footerMenus");
      setNotice("Footer menu saved successfully.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }
  async function toggleFooter(item) {
    try {
      await api(`/api/footer-menus/${item.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: item.status === "Active" ? "Inactive" : "Active",
        }),
      });
      await load();
      setNotice("Footer Menu's Status is updated successfully");
    } catch (err) {
      setError(err.message);
    }
  }
  async function removeFooter(item) {
    if (!window.confirm("Are you sure, you want to delete this Footer Menu?"))
      return;
    try {
      await api(`/api/footer-menus/${item.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }
  async function saveRedirection(event) {
    event.preventDefault();
    setNotice("");
    setError("");
    if (
      showUnchangedEdit("redirections", editingRedirectionId, redirectionForm)
    )
      return;
    try {
      await api(
        editingRedirectionId
          ? `/api/redirections/${editingRedirectionId}`
          : "/api/redirections",
        {
          method: editingRedirectionId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(redirectionForm),
        },
      );
      const wasEditing = Boolean(editingRedirectionId);
      setEditingRedirectionId(null);
      setRedirectionForm(emptyRedirection);
      navigate("redirections");
      setNotice(
        wasEditing
          ? "301 redirection updated successfully."
          : "301 redirection added successfully.",
      );
      await load();
    } catch (err) {
      setError(err.message);
    }
  }
  async function removeRedirection(item) {
    if (!window.confirm("Are you sure, you want to delete this Redirection?"))
      return;
    try {
      await api(`/api/redirections/${item.id}`, { method: "DELETE" });
      setNotice("301 redirection deleted.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }
  async function saveStaticPage(event) {
    event.preventDefault();
    setNotice("");
    setError("");
    if (showUnchangedEdit("staticPages", editingStaticPageId, staticPageForm))
      return;
    const body = new FormData();
    Object.entries(staticPageForm).forEach(([key, value]) => {
      if (key === "description_blocks" || key === "box_images") {
        body.append(
          key,
          JSON.stringify(
            value.map(({ image_file, image_url, ...entry }) => entry),
          ),
        );
      } else if (value !== null) body.append(key, value);
    });
    staticPageForm.description_blocks.forEach((block, index) => {
      if (block.image_file)
        body.append(`description_image_${index}`, block.image_file);
    });
    staticPageForm.box_images.forEach((box, index) => {
      if (box.image_file) body.append(`box_image_${index}`, box.image_file);
    });
    try {
      await api(
        editingStaticPageId
          ? `/api/static-pages/${editingStaticPageId}`
          : "/api/static-pages",
        { method: editingStaticPageId ? "PATCH" : "POST", body },
      );
      const wasEditing = Boolean(editingStaticPageId);
      setEditingStaticPageId(null);
      setStaticPageForm(emptyStaticPage);
      if (wasEditing) {
        navigate("staticPages");
        setNotice("Static Page updated successfully.");
      } else {
        setNotice("Static Page added successfully. Please enter another.");
      }
      await load();
    } catch (err) {
      setError(err.message);
    }
  }
  async function toggleStaticPage(item) {
    try {
      await api(`/api/static-pages/${item.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: item.status === "Active" ? "Inactive" : "Active",
        }),
      });
      setNotice("Static page's Status is updated successfully");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }
  async function removeStaticPage(item) {
    if (!window.confirm("Are you sure, you want to delete this Static Page?"))
      return;
    try {
      await api(`/api/static-pages/${item.id}`, { method: "DELETE" });
      setNotice("Static Page details deleted successfully");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }
  async function copyStaticPageUrl(item) {
    if (!item.slug) {
      setError("This Static Page does not have a URL slug.");
      return;
    }
    const url = new URL(
      `/staticpage/${encodeURIComponent(item.slug)}/`,
      window.location.origin,
    ).toString();
    try {
      await copyTextToClipboard(url);
      setNotice("Static Page URL copied.");
    } catch (copyError) {
      setError(copyError.message);
    }
  }

  async function saveTripType(event) {
    event.preventDefault();
    setNotice("");
    setError("");
    if (showUnchangedEdit("tripTypes", editingTripTypeId, tripTypeForm)) return;
    const body = new FormData();
    Object.entries(tripTypeForm).forEach(([key, value]) => {
      if (
        key === "box_images" ||
        key === "banner_image" ||
        key === "listing_image"
      )
        return;
      if (value !== null) body.append(key, value);
    });
    if (tripTypeForm.banner_image)
      body.append("banner_image", tripTypeForm.banner_image);
    if (tripTypeForm.listing_image)
      body.append("listing_image", tripTypeForm.listing_image);
    const boxImages = (tripTypeForm.box_images || []).map(
      ({ file, image_url, ...box }) => box,
    );
    body.append("box_images", JSON.stringify(boxImages));
    (tripTypeForm.box_images || []).forEach((box, index) => {
      if (box.file) body.append(`box_image_${index}`, box.file);
    });
    try {
      await api(
        editingTripTypeId
          ? `/api/trip-types/${editingTripTypeId}`
          : "/api/trip-types",
        { method: editingTripTypeId ? "PATCH" : "POST", body },
      );
      setEditingTripTypeId(null);
      setTripTypeForm(emptyTripType);
      navigate("tripTypes");
      setNotice("Trip type saved successfully.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }
  async function toggleTripType(item) {
    try {
      await api(`/api/trip-types/${item.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: item.status === "Active" ? "Inactive" : "Active",
        }),
      });
      await load();
      setNotice("Trip Type's Status is updated successfully");
    } catch (err) {
      setError(err.message);
    }
  }
  async function removeTripType(item) {
    if (!window.confirm("Are you sure, you want to delete this Trip Type?"))
      return;
    try {
      await api(`/api/trip-types/${item.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }
  async function saveLocation(event) {
    event.preventDefault();
    setNotice("");
    setError("");
    if (showUnchangedEdit("locations", editingLocationId, locationForm)) return;
    const wasEditing = Boolean(editingLocationId);
    try {
      await api(
        editingLocationId
          ? `/api/locations/${editingLocationId}`
          : "/api/locations",
        {
          method: editingLocationId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(locationForm),
        },
      );
      setEditingLocationId(null);
      setLocationForm(emptyLocation);
      navigate("locations");
      setNotice(
        wasEditing
          ? "Location updated successfully."
          : "Location added successfully. Please enter another.",
      );
      await load();
    } catch (err) {
      setError(err.message);
    }
  }
  async function toggleLocation(item) {
    try {
      await api(`/api/locations/${item.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: item.status === "Active" ? "Inactive" : "Active",
        }),
      });
      await load();
      setNotice("Location's Status is updated successfully");
      scrollAdminListToTop();
    } catch (err) {
      setError(err.message);
    }
  }
  async function removeLocation(item) {
    if (!window.confirm("Are you sure, you want to delete this Location?"))
      return;
    try {
      await api(`/api/locations/${item.id}`, { method: "DELETE" });
      await load();
      setNotice("Location details deleted successfully");
      scrollAdminListToTop();
    } catch (err) {
      setError(err.message);
    }
  }
  async function saveActivity(event) {
    event.preventDefault();
    setNotice("");
    setError("");
    if (showUnchangedEdit("activities", editingActivityId, activityForm))
      return;
    const wasEditing = Boolean(editingActivityId);
    try {
      await api(
        editingActivityId
          ? `/api/activities/${editingActivityId}`
          : "/api/activities",
        {
          method: editingActivityId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(activityForm),
        },
      );
      setEditingActivityId(null);
      setActivityForm(emptyActivity);
      navigate("activities");
      setNotice(
        wasEditing
          ? "Activity updated successfully."
          : "Activity added successfully. Please enter another.",
      );
      await load();
    } catch (err) {
      setError(err.message);
    }
  }
  async function toggleActivity(item) {
    try {
      await api(`/api/activities/${item.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: item.status === "Active" ? "Inactive" : "Active",
        }),
      });
      await load();
      setNotice("Activity's Status is updated successfully");
      scrollAdminListToTop();
    } catch (err) {
      setError(err.message);
    }
  }
  async function removeActivity(item) {
    if (!window.confirm("Are you sure, you want to delete this Activity?"))
      return;
    try {
      await api(`/api/activities/${item.id}`, { method: "DELETE" });
      await load();
      setNotice("Activity details deleted successfully");
      scrollAdminListToTop();
    } catch (err) {
      setError(err.message);
    }
  }
  async function saveTestimonial(event) {
    event.preventDefault();
    setNotice("");
    setError("");
    if (
      showUnchangedEdit("testimonials", editingTestimonialId, testimonialForm)
    )
      return;
    try {
      await api(
        editingTestimonialId
          ? `/api/testimonials/${editingTestimonialId}`
          : "/api/testimonials",
        {
          method: editingTestimonialId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(testimonialForm),
        },
      );
      const wasEditing = Boolean(editingTestimonialId);
      setEditingTestimonialId(null);
      setTestimonialForm({ ...emptyTestimonial });
      await load();
      if (wasEditing) navigate("testimonials");
      setNotice(
        wasEditing
          ? "Testimonial updated successfully."
          : "Testimonial added successfully. Please enter another.",
      );
    } catch (err) {
      setError(err.message);
    }
  }
  async function toggleTestimonial(item) {
    setNotice("");
    setError("");
    try {
      await api(`/api/testimonials/${item.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: item.status === "Active" ? "Inactive" : "Active",
        }),
      });
      await load();
      setNotice("Trip Type's Status is updated successfully");
    } catch (err) {
      setError(err.message);
    }
  }
  async function removeTestimonial(item) {
    if (!window.confirm("Are you sure, you want to delete this Testimonial?"))
      return;
    setNotice("");
    setError("");
    try {
      await api(`/api/testimonials/${item.id}`, { method: "DELETE" });
      await load();
      setNotice("Trip Type details deleted successfully");
    } catch (err) {
      setError(err.message);
    }
  }
  async function saveDiscount(event) {
    event.preventDefault();
    setNotice("");
    setError("");
    if (showUnchangedEdit("discounts", editingDiscountId, discountForm)) return;
    const wasEditing = Boolean(editingDiscountId);
    try {
      const result = await api(
        editingDiscountId
          ? `/api/discounts/${editingDiscountId}`
          : "/api/discounts",
        {
          method: editingDiscountId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(discountForm),
        },
      );
      const unchanged = result?.unchanged === true;
      setEditingDiscountId(null);
      setDiscountForm(emptyDiscount);
      navigate("discounts");
      setNotice(
        unchanged
          ? result.message
          : wasEditing
            ? "Discount updated successfully."
            : "Discount added successfully. Please enter another.",
      );
      await load();
    } catch (err) {
      setError(err.message);
    }
  }
  async function toggleDiscount(item) {
    try {
      await api(`/api/discounts/${item.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: item.status === "Active" ? "Inactive" : "Active",
        }),
      });
      await load();
      setNotice("Discount Status is updated successfully");
      scrollAdminListToTop();
    } catch (err) {
      setError(err.message);
    }
  }
  async function removeDiscount(item) {
    if (!window.confirm("Are you sure, you want to delete this Discount?"))
      return;
    try {
      await api(`/api/discounts/${item.id}`, { method: "DELETE" });
      await load();
      setNotice("Discount details deleted successfully");
      scrollAdminListToTop();
    } catch (err) {
      setError(err.message);
    }
  }
  async function saveTrip(event) {
    event.preventDefault();
    setNotice("");
    setError("");
    if (showUnchangedEdit("trips", editingTripId, tripForm)) return;
    const body = new FormData();
    Object.entries(tripForm).forEach(([key, value]) => {
      if (
        [
          "dates",
          "box_images",
          "blog_posts",
          "activity_ids",
          "banner_image",
          "map_image",
          "listing_image",
        ].includes(key)
      )
        return;
      if (value !== null && value !== undefined) body.append(key, value);
    });
    body.append("activity_ids", JSON.stringify(tripForm.activity_ids || []));
    body.append(
      "dates",
      JSON.stringify(
        (tripForm.dates || []).map(({ image_url, ...date }) => date),
      ),
    );
    body.append(
      "box_images",
      JSON.stringify(
        (tripForm.box_images || []).map(({ file, image_url, ...box }) => box),
      ),
    );
    ["banner_image", "map_image", "listing_image"].forEach((key) => {
      if (tripForm[key]) body.append(key, tripForm[key]);
    });
    (tripForm.box_images || []).forEach((box, index) => {
      if (box.file) body.append(`box_image_${index}`, box.file);
    });
    try {
      await api(editingTripId ? `/api/trips/${editingTripId}` : "/api/trips", {
        method: editingTripId ? "PATCH" : "POST",
        body,
      });
      setEditingTripId(null);
      setTripForm({ ...emptyTrip });
      navigate("trips");
      setNotice("Trip saved successfully.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }
  async function toggleTrip(item) {
    try {
      await api(`/api/trips/${item.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: item.status === "Active" ? "Inactive" : "Active",
        }),
      });
      await load();
      setNotice("Trip's Status is updated successfully.");
    } catch (err) {
      setError(err.message);
    }
  }
  async function removeTrip(item) {
    if (!window.confirm("Are you sure, you want to delete this Trip?")) return;
    try {
      await api(`/api/trips/${item.id}`, { method: "DELETE" });
      await load();
      setNotice("Trip details deleted successfully.");
    } catch (err) {
      setError(err.message);
    }
  }
  function startAddTripGallery() {
    setEditingTripGalleryId(null);
    setTripGalleryForm(emptyTripGallery);
    navigate("addTripGallery");
  }
  function startEditTripGallery(item) {
    setEditingTripGalleryId(item.id);
    setTripGalleryForm({
      ...emptyTripGallery,
      trip_id: item.trip_id,
      video_url: item.video_url || "",
      image_url: item.image_url || "",
      image_alt: item.image_alt || "",
      display_order: item.display_order || 1,
      display_in_static_page: Boolean(item.display_in_static_page),
      display_in_trip_page: Boolean(item.display_in_trip_page),
      status: item.status || "Active",
    });
    navigate("addTripGallery", `/administrator/trip-gallery/${item.id}/edit`);
  }
  async function saveTripGallery(event) {
    event.preventDefault();
    setNotice("");
    setError("");
    if (
      showUnchangedEdit("tripGalleries", editingTripGalleryId, tripGalleryForm)
    )
      return;
    const body = new FormData();
    Object.entries(tripGalleryForm).forEach(([key, value]) => {
      if (!["image", "image_url"].includes(key) && value !== null)
        body.append(key, value);
    });
    if (tripGalleryForm.image) body.append("image", tripGalleryForm.image);
    try {
      await api(
        editingTripGalleryId
          ? `/api/trip-galleries/${editingTripGalleryId}`
          : "/api/trip-galleries",
        { method: editingTripGalleryId ? "PATCH" : "POST", body },
      );
      setEditingTripGalleryId(null);
      setTripGalleryForm(emptyTripGallery);
      navigate("tripGalleries");
      setNotice("Trip gallery saved successfully.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }
  async function toggleTripGallery(item) {
    try {
      await api(`/api/trip-galleries/${item.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: item.status === "Active" ? "Inactive" : "Active",
        }),
      });
      await load();
      setNotice("Gallery's Status is updated successfully");
    } catch (err) {
      setError(err.message);
    }
  }
  async function removeTripGallery(item) {
    if (!window.confirm("Are you sure, you want to delete this Gallery?"))
      return;
    try {
      await api(`/api/trip-galleries/${item.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }
  function startAddTripLeader() {
    setEditingTripLeaderId(null);
    setTripLeaderForm({
      ...emptyTripLeader,
      description_blocks: [{ ...emptyTripLeaderBlock }],
    });
    navigate("addTripLeader");
  }
  function startEditTripLeader(item) {
    setEditingTripLeaderId(item.id);
    setTripLeaderForm({
      ...emptyTripLeader,
      ...item,
      description_blocks: item.description_blocks?.length
        ? item.description_blocks.map((block) => ({
            ...emptyTripLeaderBlock,
            ...block,
          }))
        : [{ ...emptyTripLeaderBlock }],
      listing_image: null,
    });
    navigate("addTripLeader", `/administrator/trip-leaders/${item.id}/edit`);
  }
  async function saveTripLeader(event) {
    event.preventDefault();
    setNotice("");
    setError("");
    if (showUnchangedEdit("tripLeaders", editingTripLeaderId, tripLeaderForm))
      return;
    const body = new FormData();
    Object.entries(tripLeaderForm).forEach(([key, value]) => {
      if (
        key !== "listing_image" &&
        key !== "description_blocks" &&
        value !== null
      )
        body.append(key, value);
    });
    body.append(
      "description_blocks",
      JSON.stringify(
        tripLeaderForm.description_blocks.map(
          ({ image_file, ...block }) => block,
        ),
      ),
    );
    if (tripLeaderForm.listing_image)
      body.append("listing_image", tripLeaderForm.listing_image);
    tripLeaderForm.description_blocks.forEach((block, index) => {
      if (block.image_file)
        body.append(`description_image_${index}`, block.image_file);
    });
    try {
      await api(
        editingTripLeaderId
          ? `/api/trip-leaders/${editingTripLeaderId}`
          : "/api/trip-leaders",
        { method: editingTripLeaderId ? "PATCH" : "POST", body },
      );
      setEditingTripLeaderId(null);
      setTripLeaderForm(emptyTripLeader);
      navigate("tripLeaders");
      setNotice("Trip leader saved successfully.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }
  async function toggleTripLeader(item) {
    try {
      await api(`/api/trip-leaders/${item.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: item.status === "Active" ? "Inactive" : "Active",
        }),
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }
  async function removeTripLeader(item) {
    if (!window.confirm("Are you sure, you want to delete this Trip Leader?"))
      return;
    try {
      await api(`/api/trip-leaders/${item.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }
  async function saveTripLeaderOrder(orders) {
    try {
      await Promise.all(
        Object.entries(orders).map(([id, display_order]) =>
          api(`/api/trip-leaders/${id}/order`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ display_order }),
          }),
        ),
      );
      setNotice("Trip leader order saved successfully.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }
  async function copyTripLeaderUrl(item) {
    const url = `${window.location.origin}/tripleader/${item.name}`;
    try {
      await copyTextToClipboard(url);
      setNotice("Trip leader URL copied.");
    } catch (copyError) {
      setError(copyError.message);
    }
  }
  function startAddInvoice() {
    setEditingInvoiceId(null);
    setInvoiceForm({ ...emptyInvoice, items: [{ ...emptyInvoiceItem }] });
    navigate("addInvoice");
  }
  function startEditInvoice(item) {
    setEditingInvoiceId(item.id);
    setInvoiceForm({
      ...emptyInvoice,
      ...item,
      invoice_date: dateInputValue(item.invoice_date),
      due_date: dateInputValue(item.due_date),
      items: item.items?.length
        ? item.items.map((invoiceItem) => ({ ...invoiceItem }))
        : [{ ...emptyInvoiceItem }],
    });
    navigate("addInvoice", `/administrator/invoices/${item.id}/edit`);
  }
  function startAddAttributeType() {
    setEditingAttributeTypeId(null);
    setAttributeTypeForm(emptyAttributeType);
    navigate("addAttributeType");
  }
  function startEditAttributeType(item) {
    setEditingAttributeTypeId(item.id);
    setAttributeTypeForm({ ...emptyAttributeType, ...item });
    navigate(
      "addAttributeType",
      `/administrator/attribute-types/${item.id}/edit`,
    );
  }
  function startAddAttributeValue() {
    setEditingAttributeValueId(null);
    setAttributeValueForm(emptyAttributeValue);
    navigate("addAttributeValue");
  }
  function startEditAttributeValue(item) {
    setEditingAttributeValueId(item.id);
    setAttributeValueForm({ ...emptyAttributeValue, ...item });
    navigate(
      "addAttributeValue",
      `/administrator/attribute-values/${item.id}/edit`,
    );
  }
  function startAddCategory() {
    setEditingCategoryId(null);
    setCategoryForm({
      ...emptyCategory,
      box_images: [{ image: "", title: "", link: "", file: null }],
    });
    navigate("addCategory");
  }
  function startEditCategory(item) {
    setEditingCategoryId(item.id);
    setCategoryForm({
      ...emptyCategory,
      ...item,
      banner_image: null,
      listing_image: null,
      box_images: (item.box_images || []).map((box) => ({
        ...box,
        file: null,
      })),
    });
    navigate("addCategory", `/administrator/categories/${item.id}/edit`);
  }
  function startAddProduct() {
    setEditingProductId(null);
    setProductForm(emptyProduct);
    navigate("addProduct");
  }
  function startEditProduct(item) {
    const values = {
      ...emptyProduct,
      ...item,
      category_id: item.category_id || "",
      banner_image: null,
      listing_image: null,
      additional_images: [],
      existing_additional_images: item.additional_images || [],
      box_images: item.box_images?.length
        ? item.box_images.map((box) => ({ ...box, image_file: null }))
        : [],
    };
    editSnapshots.current.set(
      `products:${item.id}`,
      serializeComparableForm(values),
    );
    setEditingProductId(item.id);
    setProductForm(values);
    navigate("addProduct", `/administrator/products/${item.id}/edit`);
  }
  function startAddProductAttribute() {
    setEditingProductAttributeId(null);
    setProductAttributeForm(emptyProductAttribute);
    navigate("addProductAttribute");
  }
  function startEditProductAttribute(item) {
    setEditingProductAttributeId(item.id);
    setProductAttributeForm({ ...emptyProductAttribute, ...item });
    navigate(
      "addProductAttribute",
      `/administrator/product-attributes/${item.id}/edit`,
    );
  }
  function startAddUser() {
    setEditingUserId(null);
    setUserForm({ ...emptyUser });
    navigate("addUser");
  }
  function startEditUser(item) {
    setEditingUserId(item.id);
    setUserForm({
      ...emptyUser,
      ...item,
      user_date_of_birth: dateInputValue(item.user_date_of_birth),
      user_status: item.status || "Active",
    });
    navigate("addUser", `/administrator/users/${item.id}/edit`);
  }
  function updateInvoice(field, value) {
    setInvoiceForm((current) => ({ ...current, [field]: value }));
  }
  function updateInvoiceItem(index, field, value) {
    setInvoiceForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    }));
  }
  function addInvoiceItem() {
    setInvoiceForm((current) => ({
      ...current,
      items: [...current.items, { ...emptyInvoiceItem }],
    }));
  }
  function removeInvoiceItem(index) {
    setInvoiceForm((current) => ({
      ...current,
      items: current.items.filter((_item, itemIndex) => itemIndex !== index),
    }));
  }
  async function saveInvoice(event) {
    event.preventDefault();
    setNotice("");
    setError("");
    if (showUnchangedEdit("invoices", editingInvoiceId, invoiceForm)) return;
    try {
      await api(
        editingInvoiceId
          ? `/api/invoices/${editingInvoiceId}`
          : "/api/invoices",
        {
          method: editingInvoiceId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(invoiceForm),
        },
      );
      const wasEditing = Boolean(editingInvoiceId);
      setEditingInvoiceId(null);
      setInvoiceForm(emptyInvoice);
      navigate("invoices");
      setNotice(
        wasEditing
          ? "Invoice updated successfully."
          : "Invoice added successfully.",
      );
      await load();
    } catch (err) {
      setError(err.message);
    }
  }
  async function removeInvoice(item) {
    if (!window.confirm("Are you sure, you want to delete this Invoice?"))
      return;
    try {
      await api(`/api/invoices/${item.id}`, { method: "DELETE" });
      await load();
      setNotice("invoice details deleted successfully");
      scrollAdminListToTop();
    } catch (err) {
      setError(err.message);
    }
  }
  function viewOrder(item) {
    setSelectedOrder(item);
    setOrderDetailLoading(true);
    navigate("orderDetail", `/administrator/orders/${item.id}/view`);
  }
  async function removeOrder(item) {
    if (!window.confirm("Are you sure, you want to delete this Order?")) return;
    try {
      await api(`/api/orders/${item.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }
  async function saveAttributeType(event) {
    event.preventDefault();
    setNotice("");
    setError("");
    if (
      showUnchangedEdit(
        "attributeTypes",
        editingAttributeTypeId,
        attributeTypeForm,
      )
    )
      return;
    try {
      await api(
        editingAttributeTypeId
          ? `/api/attribute-types/${editingAttributeTypeId}`
          : "/api/attribute-types",
        {
          method: editingAttributeTypeId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(attributeTypeForm),
        },
      );
      const wasEditing = Boolean(editingAttributeTypeId);
      setEditingAttributeTypeId(null);
      setAttributeTypeForm(emptyAttributeType);
      if (wasEditing) navigate("attributeTypes");
      setNotice(
        wasEditing
          ? "Attribute type updated successfully."
          : "Attribute type added successfully. Please enter another.",
      );
      await load();
    } catch (err) {
      setError(err.message);
    }
  }
  async function toggleAttributeType(item) {
    try {
      await api(`/api/attribute-types/${item.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: item.status === "Active" ? "Inactive" : "Active",
        }),
      });
      await load();
      setNotice("Attribute type's Status is updated successfully");
    } catch (err) {
      setError(err.message);
    }
  }
  async function removeAttributeType(item) {
    if (
      !window.confirm("Are you sure, you want to delete this Attribute Type?")
    )
      return;
    try {
      await api(`/api/attribute-types/${item.id}`, { method: "DELETE" });
      await load();
      setNotice("Attribute type details deleted successfully");
    } catch (err) {
      setError(err.message);
    }
  }
  async function saveAttributeValue(event) {
    event.preventDefault();
    setNotice("");
    setError("");
    if (
      showUnchangedEdit(
        "attributeValues",
        editingAttributeValueId,
        attributeValueForm,
      )
    )
      return;
    try {
      await api(
        editingAttributeValueId
          ? `/api/attribute-values/${editingAttributeValueId}`
          : "/api/attribute-values",
        {
          method: editingAttributeValueId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(attributeValueForm),
        },
      );
      const wasEditing = Boolean(editingAttributeValueId);
      if (wasEditing) {
        setEditingAttributeValueId(null);
        setAttributeValueForm(emptyAttributeValue);
        navigate("attributeValues");
        setNotice("Attribute Value updated successfully.");
      } else {
        setAttributeValueForm(emptyAttributeValue);
        setNotice("Attribute Value added successfully. Please enter another.");
      }
      await load();
    } catch (err) {
      setError(err.message);
    }
  }
  async function toggleAttributeValue(item) {
    try {
      await api(`/api/attribute-values/${item.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: item.status === "Active" ? "Inactive" : "Active",
        }),
      });
      await load();
      setNotice("Static page's Status is updated successfully");
    } catch (err) {
      setError(err.message);
    }
  }
  async function removeAttributeValue(item) {
    if (
      !window.confirm("Are you sure, you want to delete this Attribute Value?")
    )
      return;
    try {
      await api(`/api/attribute-values/${item.id}`, { method: "DELETE" });
      await load();
      setNotice("Attribute Value details deleted successfully");
    } catch (err) {
      setError(err.message);
    }
  }
  async function saveProduct(event) {
    event.preventDefault();
    setNotice("");
    setError("");
    if (showUnchangedEdit("products", editingProductId, productForm)) return;
    const body = new FormData();
    Object.entries(productForm).forEach(([key, value]) => {
      if (
        [
          "banner_image",
          "listing_image",
          "additional_images",
          "box_images",
          "existing_additional_images",
        ].includes(key) ||
        value === null
      )
        return;
      body.append(key, value);
    });
    body.append(
      "box_images",
      JSON.stringify(
        productForm.box_images.map(({ image_file, ...box }) => box),
      ),
    );
    if (productForm.banner_image)
      body.append("banner_image", productForm.banner_image);
    if (productForm.listing_image)
      body.append("listing_image", productForm.listing_image);
    (productForm.additional_images || []).forEach((file) =>
      body.append("additional_images", file),
    );
    productForm.box_images.forEach((box, index) => {
      if (box.image_file) body.append(`box_image_${index}`, box.image_file);
    });
    try {
      await api(
        editingProductId
          ? `/api/products/${editingProductId}`
          : "/api/products",
        { method: editingProductId ? "PATCH" : "POST", body },
      );
      const wasEditing = Boolean(editingProductId);
      if (wasEditing) {
        setEditingProductId(null);
        setProductForm(emptyProduct);
        navigate("products");
        setNotice("Product updated successfully.");
      } else {
        setProductForm(emptyProduct);
        setNotice("Product added successfully. Please enter another.");
      }
      await load();
    } catch (err) {
      setError(err.message);
    }
  }
  async function toggleProduct(item) {
    try {
      await api(`/api/products/${item.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: item.status === "Active" ? "Inactive" : "Active",
        }),
      });
      await load();
      setNotice("Product's Status is updated successfully");
    } catch (err) {
      setError(err.message);
    }
  }
  async function removeProduct(item) {
    if (!window.confirm("Are you sure, you want to delete this Product?"))
      return;
    try {
      await api(`/api/products/${item.id}`, { method: "DELETE" });
      await load();
      setNotice("Product details deleted successfully");
    } catch (err) {
      setError(err.message);
    }
  }
  async function removeProductAdditionalImage(image) {
    if (!editingProductId) return;
    try {
      await api(
        `/api/products/${editingProductId}/additional-images/${image.id}`,
        { method: "DELETE" },
      );
      setProductForm((current) => ({
        ...current,
        existing_additional_images: current.existing_additional_images.filter(
          (item) => item.id !== image.id,
        ),
      }));
      setNotice("Image details deleted successfully");
    } catch (err) {
      setError(err.message);
    }
  }
  async function saveProductAttribute(event) {
    event.preventDefault();
    setNotice("");
    setError("");
    if (
      showUnchangedEdit(
        "productAttributes",
        editingProductAttributeId,
        productAttributeForm,
      )
    )
      return;
    const wasEditing = Boolean(editingProductAttributeId);
    const duplicateMessage =
      "Sorry, attribute details is already added under this product. Please use another attribute.";
    try {
      await api(
        editingProductAttributeId
          ? `/api/product-attributes/${editingProductAttributeId}`
          : "/api/product-attributes",
        {
          method: editingProductAttributeId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(productAttributeForm),
        },
      );
      setEditingProductAttributeId(null);
      setProductAttributeForm(emptyProductAttribute);
      if (wasEditing) navigate("productAttributes");
      await load();
      setNotice(
        wasEditing
          ? "Attribute details updated successfully."
          : "Attribute details added successfully. Please enter another.",
      );
    } catch (err) {
      if (wasEditing && err.message === duplicateMessage) {
        setEditingProductAttributeId(null);
        setProductAttributeForm(emptyProductAttribute);
        navigate("productAttributes");
        setError(duplicateMessage);
      } else {
        setError(err.message);
      }
    }
  }
  async function removeProductAttribute(item) {
    if (!window.confirm("Are you sure, you want to delete this Attribute?"))
      return;
    setNotice("");
    setError("");
    try {
      await api(`/api/product-attributes/${item.id}`, { method: "DELETE" });
      await load();
      setNotice("Attribute details deleted successfully");
    } catch (err) {
      setError(err.message);
    }
  }
  async function saveUser(event) {
    event.preventDefault();
    setNotice("");
    setError("");
    const wasEditing = Boolean(editingUserId);
    if (showUnchangedEdit("users", editingUserId, userForm)) return;
    try {
      await api(editingUserId ? `/api/users/${editingUserId}` : "/api/users", {
        method: editingUserId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userForm),
      });
      setEditingUserId(null);
      setUserForm({ ...emptyUser });
      await load();
      if (wasEditing) navigate("users");
      setNotice(
        wasEditing
          ? "User updated successfully."
          : "User added successfully. Please enter another.",
      );
    } catch (err) {
      if (
        wasEditing &&
        err.message ===
          "Sorry, email is already added. Please use another email."
      ) {
        navigate("users");
      }
      setError(err.message);
    }
  }
  async function toggleUser(item) {
    setNotice("");
    setError("");
    try {
      await api(`/api/users/${item.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: item.status === "Active" ? "Inactive" : "Active",
        }),
      });
      await load();
      setNotice("User's Status is updated successfully");
    } catch (err) {
      setError(err.message);
    }
  }
  async function removeUser(item) {
    if (!window.confirm("Are you sure, you want to delete this User?")) return;
    setNotice("");
    setError("");
    try {
      await api(`/api/users/${item.id}`, { method: "DELETE" });
      await load();
      setNotice("User details deleted successfully");
    } catch (err) {
      setError(err.message);
    }
  }
  async function saveCategory(event) {
    event.preventDefault();
    setNotice("");
    setError("");
    if (showUnchangedEdit("categories", editingCategoryId, categoryForm))
      return;
    const body = new FormData();
    Object.entries(categoryForm).forEach(([key, value]) => {
      if (
        ["banner_image", "listing_image", "box_images"].includes(key) ||
        value === null
      )
        return;
      body.append(key, value);
    });
    const boxImages = (categoryForm.box_images || []).map(
      ({ file, image_url, ...box }) => box,
    );
    body.append("box_images", JSON.stringify(boxImages));
    if (categoryForm.banner_image)
      body.append("banner_image", categoryForm.banner_image);
    if (categoryForm.listing_image)
      body.append("listing_image", categoryForm.listing_image);
    (categoryForm.box_images || []).forEach((box, index) => {
      if (box.file) body.append(`box_image_${index}`, box.file);
    });
    try {
      const isEditing = Boolean(editingCategoryId);
      await api(
        isEditing ? `/api/categories/${editingCategoryId}` : "/api/categories",
        { method: isEditing ? "PATCH" : "POST", body },
      );
      setEditingCategoryId(null);
      setCategoryForm(emptyCategory);
      setCategoryFormRevision((revision) => revision + 1);
      navigate(isEditing ? "categories" : "addCategory");
      setNotice(
        isEditing
          ? "Category updated successfully."
          : "Category added successfully. Please enter another.",
      );
      await load();
    } catch (err) {
      setError(err.message);
    }
  }
  async function toggleCategory(item) {
    try {
      await api(`/api/categories/${item.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: item.status === "Active" ? "Inactive" : "Active",
        }),
      });
      await load();
      setNotice("Static page's Status is updated successfully");
    } catch (err) {
      setError(err.message);
    }
  }
  async function removeCategory(item) {
    if (!window.confirm("Are you sure, you want to delete this Category?"))
      return;
    try {
      await api(`/api/categories/${item.id}`, { method: "DELETE" });
      await load();
      setNotice("Category details deleted successfully");
    } catch (err) {
      setError(err.message);
    }
  }
  async function saveItinerary(event) {
    event.preventDefault();
    if (
      itineraryTrip &&
      itinerarySnapshot.current === serializeComparableForm(itineraryEntries)
    ) {
      if (isNewItinerary) {
        setNotice("Sorry, nothing is added.");
      } else {
        navigate("trips");
        setNotice("Sorry, nothing is updated.");
      }
      return;
    }
    try {
      await api(`/api/trips/${itineraryTrip.id}/itinerary`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: itineraryEntries }),
      });
      navigate("trips");
      setNotice(
        isNewItinerary
          ? "Itinerary added successfully. Please enter another."
          : "Itinerary updated successfully.",
      );
    } catch (err) {
      setError(err.message);
    }
  }
  async function remove(banner) {
    if (!window.confirm("Are you sure, you want to delete this Banner?"))
      return;
    try {
      await api(`/api/banners/${banner.id}`, { method: "DELETE" });
      setNotice("Banner deleted.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removePromotion(promotion) {
    if (
      !window.confirm(
        "Are you sure, you want to delete this Offers Promotions?",
      )
    )
      return;
    try {
      await api(`/api/promotions/${promotion.id}`, { method: "DELETE" });
      setNotice("Inventory details deleted successfully");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeSpecialFeature(feature) {
    if (
      !window.confirm("Are you sure, you want to delete this Special Feature?")
    )
      return;
    try {
      await api(`/api/special-features/${feature.id}`, { method: "DELETE" });
      setNotice("Special feature deleted.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }
  if (authLoading)
    return <main className="login-page">Loading secure session...</main>;
  if (!authUser)
    return (
      <LoginPage
        sessionMessage={loginMessage}
        sessionMessageType={loginMessageType}
        onLogin={(user) => {
          const storedPath = sessionStorage.getItem("admin_return_path");
          const returnPath =
            storedPath &&
            canonicalAdminPath(storedPath) !== "/administrator/login"
              ? storedPath
              : "/administrator/dashboard";
          sessionStorage.removeItem("admin_return_path");
          setAdminDataLoading(true);
          setAuthUser(user);
          setLoginMessage("");
          setLoginMessageType("error");
          setError("");
          const returnRoute = resolveAdminRoute(returnPath);
          setPageState(returnRoute.page);
          sessionStorage.setItem("admin_session_active", "true");
          window.history.replaceState({}, "", canonicalAdminPath(returnPath));
        }}
      />
    );

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    sessionStorage.removeItem("admin_session_active");
    setAuthUser(null);
    setLoginMessage("You have successfully logout.");
    setLoginMessageType("success");
    window.history.pushState({}, "", "/administrator/login");
    setPageState("dashboard");
  }

  const showManagePageLoader =
    adminDataLoading &&
    [
      "banners",
      "promotions",
      "specialFeatures",
      "footerMenus",
      "redirections",
      "staticPages",
      "tripTypes",
      "locations",
      "activities",
      "testimonials",
      "discounts",
      "trips",
      "tripGalleries",
      "tripLeaders",
      "invoices",
      "orders",
      "attributeTypes",
      "attributeValues",
      "categories",
      "products",
      "productAttributes",
      "users",
      "mailingList",
    ].includes(page);

  return (
    <AdminLayout
      page={page}
      setPage={navigate}
      user={authUser}
      onLogout={logout}
      onDownloadBookings={downloadAllBookings}
      headerTitle={
        page === "addTestimonial"
          ? "Manage Testimonial"
          : page === "addUser"
            ? "Manage User"
            : page === "addProductAttribute"
              ? "Manage Attribute"
              : undefined
      }
      breadcrumbTitle={
        page === "addStaticPage"
          ? `${editingStaticPageId ? "Edit" : "Add"} Static Page`
          : page === "addTestimonial"
            ? `${editingTestimonialId ? "Edit" : "Add"} Testimonial`
            : page === "addUser"
              ? `${editingUserId ? "Edit" : "Add"} User`
              : page === "addProductAttribute"
                ? `${editingProductAttributeId ? "Edit" : "Add"} Attribute`
                : undefined
      }
      headerSubtitle={contestHeaderSubtitle}
    >
      {notice && page !== "trips" && page !== "products" && (
        <div
          className={`alert ${notice === "Sorry, nothing is updated." ? "warning" : "success"}`}
          role="alert"
        >
          <button
            type="button"
            className="admin-alert-close"
            onClick={() => setNotice("")}
            aria-label="Close"
          >
            ×
          </button>
          {notice}
        </div>
      )}
      {error && (
        <div className="alert error" role="alert">
          <button
            type="button"
            className="admin-alert-close"
            onClick={() => setError("")}
            aria-label="Close"
          >
            ×
          </button>
          {error}
        </div>
      )}
      {showManagePageLoader ? (
        <section className="admin-box box-primary module-table-panel">
          <div className="box-body admin-loading-box-body">
            <div
              className="admin-full-page-loader"
              role="status"
              aria-live="polite"
            >
              <span className="admin-spinner" /> Loading data...
            </div>
          </div>
        </section>
      ) : (
        <>
          {page === "dashboard" && <DashboardPage />}
          {page === "settings" && (
            <AdminSettingsPage
              mode="settings"
              onNotice={setNotice}
              onError={setError}
            />
          )}
          {page === "emailTemplates" && (
            <AdminSettingsPage
              mode="emailTemplates"
              onNotice={setNotice}
              onError={setError}
            />
          )}
          {page === "changeUsername" && (
            <AdminSettingsPage
              mode="changeUsername"
              onNotice={setNotice}
              onError={setError}
            />
          )}
          {page === "changePassword" && (
            <AdminSettingsPage
              mode="changePassword"
              onNotice={setNotice}
              onError={setError}
            />
          )}
          {page === "banners" && (
            <ManageBannerPage
              banners={banners}
              onToggle={toggle}
              onDelete={remove}
              onAdd={startAdd}
              onEdit={startEdit}
            />
          )}
          {page === "promotions" && (
            <ManagePromotionsPage
              promotions={promotions}
              onToggle={togglePromotion}
              onDelete={removePromotion}
              onAdd={startAddPromotion}
              onEdit={startEditPromotion}
            />
          )}
          {page === "specialFeatures" && (
            <ManageSpecialFeaturePage
              features={specialFeatures}
              onToggle={toggleSpecialFeature}
              onDelete={removeSpecialFeature}
              onAdd={startAddSpecialFeature}
              onEdit={startEditSpecialFeature}
            />
          )}
          {page === "footerMenus" && (
            <ManageFooterMenuPage
              items={footerMenus}
              onToggle={toggleFooter}
              onDelete={removeFooter}
              onAdd={startAddFooter}
              onEdit={startEditFooter}
            />
          )}
          {page === "redirections" && (
            <ManageRedirectionPage
              items={redirections}
              onDelete={removeRedirection}
              onEdit={startEditRedirection}
            />
          )}
          {page === "staticPages" && (
            <ManageStaticPagePage
              items={staticPages}
              onToggle={toggleStaticPage}
              onDelete={removeStaticPage}
              onAdd={startAddStaticPage}
              onEdit={startEditStaticPage}
              onCopyUrl={copyStaticPageUrl}
            />
          )}
          {page === "tripTypes" && (
            <ManageTripTypePage
              items={tripTypes}
              onToggle={toggleTripType}
              onDelete={removeTripType}
              onAdd={startAddTripType}
              onEdit={startEditTripType}
            />
          )}
          {page === "locations" && (
            <ManageLocationPage
              items={locations}
              onToggle={toggleLocation}
              onDelete={removeLocation}
              onAdd={startAddLocation}
              onEdit={startEditLocation}
            />
          )}
          {page === "activities" && (
            <ManageActivityPage
              items={activities}
              onToggle={toggleActivity}
              onDelete={removeActivity}
              onAdd={startAddActivity}
              onEdit={startEditActivity}
            />
          )}
          {page === "testimonials" && (
            <ManageTestimonialPage
              items={testimonials}
              onToggle={toggleTestimonial}
              onDelete={removeTestimonial}
              onAdd={startAddTestimonial}
              onEdit={startEditTestimonial}
            />
          )}
          {page === "discounts" && (
            <ManageDiscountPage
              items={discounts}
              onError={setError}
              onToggle={toggleDiscount}
              onDelete={removeDiscount}
              onAdd={startAddDiscount}
              onEdit={startEditDiscount}
            />
          )}
          {page === "trips" && (
            <ManageTripPage
              items={trips}
              notice={notice}
              onDismissNotice={() => setNotice("")}
              onToggle={toggleTrip}
              onDelete={removeTrip}
              onAdd={startAddTrip}
              onEdit={startEditTrip}
              onFaq={openTripFaq}
              onItinerary={startItinerary}
            />
          )}
          {(page === "tripFaq" || page === "tripFaqEdit") && faqTrip && (
            <TripFaqPage
              key={`${page}-${faqTrip.id}-${faqEditId || "list"}`}
              trip={faqTrip}
              editId={page === "tripFaqEdit" ? faqEditId : null}
              notice={notice}
              onDismissNotice={() => setNotice("")}
              onEdit={(entry) => {
                setFaqEditId(entry.id);
                navigate(
                  "tripFaqEdit",
                  `/administrator/trips/${faqTrip.id}/faq/${entry.id}/edit`,
                );
              }}
              onUpdateComplete={() => {
                setFaqEditId(null);
                navigate("tripFaq", `/administrator/trips/${faqTrip.id}/faq`);
                setNotice("FAQ updated successfully.");
              }}
              cancel={() => {
                const path =
                  page === "tripFaqEdit"
                    ? `/administrator/trips/${faqTrip.id}/faq`
                    : "/administrator/trips";
                setFaqEditId(null);
                if (page === "tripFaq") setFaqTrip(null);
                navigate(page === "tripFaqEdit" ? "tripFaq" : "trips", path);
              }}
            />
          )}
          {page === "tripGalleries" && (
            <ManageTripGalleryPage
              items={tripGalleries}
              onToggle={toggleTripGallery}
              onDelete={removeTripGallery}
              onAdd={startAddTripGallery}
              onEdit={startEditTripGallery}
            />
          )}
          {page === "tripLeaders" && (
            <ManageTripLeaderPage
              items={tripLeaders}
              onToggle={toggleTripLeader}
              onDelete={removeTripLeader}
              onAdd={startAddTripLeader}
              onEdit={startEditTripLeader}
              onCopyUrl={copyTripLeaderUrl}
              onSaveOrder={saveTripLeaderOrder}
            />
          )}
          {page === "invoices" && (
            <ManageInvoicePage
              items={invoices}
              onDelete={removeInvoice}
              onEdit={startEditInvoice}
            />
          )}
          {page === "orders" && (
            <ManageOrderPage
              items={orders}
              onDelete={removeOrder}
              onView={viewOrder}
            />
          )}
          {page === "orderDetail" && (
            <OrderDetailPage
              order={selectedOrder}
              isLoading={orderDetailLoading}
              onBack={() => {
                setSelectedOrder(null);
                navigate("orders");
              }}
            />
          )}
          {page === "attributeTypes" && (
            <ManageAttributeTypePage
              items={attributeTypes}
              onToggle={toggleAttributeType}
              onDelete={removeAttributeType}
              onAdd={startAddAttributeType}
              onEdit={startEditAttributeType}
            />
          )}
          {page === "attributeValues" && (
            <ManageAttributeValuePage
              items={attributeValues}
              onToggle={toggleAttributeValue}
              onDelete={removeAttributeValue}
              onAdd={startAddAttributeValue}
              onEdit={startEditAttributeValue}
            />
          )}
          {page === "categories" && (
            <ManageCategoryPage
              items={categories}
              onToggle={toggleCategory}
              onDelete={removeCategory}
              onAdd={startAddCategory}
              onEdit={startEditCategory}
            />
          )}
          {page === "products" && (
            <ManageProductPage
              items={products}
              notice={notice}
              onDismissNotice={() => setNotice("")}
              onToggle={toggleProduct}
              onDelete={removeProduct}
              onAdd={startAddProduct}
              onEdit={startEditProduct}
            />
          )}
          {page === "productAttributes" && (
            <ManageProductAttributePage
              items={productAttributes}
              onDelete={removeProductAttribute}
              onAdd={startAddProductAttribute}
              onEdit={startEditProductAttribute}
            />
          )}
          {page === "users" && (
            <ManageUserPage
              items={users}
              onToggle={toggleUser}
              onDelete={removeUser}
              onAdd={startAddUser}
              onEdit={startEditUser}
            />
          )}
          {page === "mailingList" && (
            <ManageMailingListPage
              items={mailingList}
              onDelete={removeMailingList}
              onAdd={startAddMailingList}
              onEdit={startEditMailingList}
              onDownload={() => {
                window.location.href = "/api/mailing-list/download";
              }}
            />
          )}
          {page === "addMailingList" && (
            <AddMailingListPage
              form={mailingListForm}
              editingId={editingMailingListId}
              update={updateMailingList}
              save={saveMailingList}
              cancel={() => navigate("mailingList")}
            />
          )}
          {[
            "contests",
            "addContest",
            "contestUsers",
            "contestUserDetails",
            "contestSubmissions",
            "contestRules",
            "contestEmails",
          ].includes(page) && (
            <ContestModulePage
              mode={page}
              editId={
                resolveAdminRoute(window.location.pathname).editPath?.split(
                  "/",
                )[3]
              }
              onNotice={setNotice}
              onError={setError}
              onHeaderSubtitle={setContestHeaderSubtitle}
            />
          )}
          {page === "add" && (
            <AddBannerPage
              form={form}
              editingId={editingId}
              update={update}
              save={save}
              cancel={() => navigate("banners")}
            />
          )}
          {page === "addPromotion" && (
            <AddPromotionPage
              form={promotionForm}
              editingId={editingPromotionId}
              update={(field, value) =>
                setPromotionForm((current) => ({ ...current, [field]: value }))
              }
              save={savePromotion}
              cancel={() => navigate("promotions")}
            />
          )}
          {page === "addSpecialFeature" && (
            <AddSpecialFeaturePage
              form={specialFeatureForm}
              editingId={editingSpecialFeatureId}
              update={(field, value) =>
                setSpecialFeatureForm((current) => ({
                  ...current,
                  [field]: value,
                }))
              }
              save={saveSpecialFeature}
              cancel={() => navigate("specialFeatures")}
            />
          )}
          {page === "addFooterMenu" && (
            <AddFooterMenuPage
              form={footerForm}
              editingId={editingFooterId}
              update={(field, value) =>
                setFooterForm((current) => ({ ...current, [field]: value }))
              }
              save={saveFooter}
              cancel={() => navigate("footerMenus")}
            />
          )}
          {page === "addRedirection" && (
            <AddRedirectionPage
              form={redirectionForm}
              editingId={editingRedirectionId}
              update={(field, value) =>
                setRedirectionForm((current) => ({
                  ...current,
                  [field]: value,
                }))
              }
              save={saveRedirection}
              cancel={() => navigate("redirections")}
            />
          )}
          {page === "addStaticPage" && (
            <AddStaticPagePage
              form={staticPageForm}
              pages={staticPages}
              editingId={editingStaticPageId}
              update={(field, value) =>
                setStaticPageForm((current) => ({
                  ...current,
                  [field]:
                    typeof value === "function" ? value(current[field]) : value,
                }))
              }
              save={saveStaticPage}
            />
          )}
          {page === "addTripType" && (
            <AddTripTypePage
              form={tripTypeForm}
              editingId={editingTripTypeId}
              update={(field, value) =>
                setTripTypeForm((current) => ({ ...current, [field]: value }))
              }
              save={saveTripType}
              cancel={() => navigate("tripTypes")}
            />
          )}
          {page === "addLocation" && (
            <AddLocationPage
              form={locationForm}
              editingId={editingLocationId}
              update={(field, value) =>
                setLocationForm((current) => ({ ...current, [field]: value }))
              }
              save={saveLocation}
              cancel={() => navigate("locations")}
            />
          )}
          {page === "addActivity" && (
            <AddActivityPage
              form={activityForm}
              editingId={editingActivityId}
              update={(field, value) =>
                setActivityForm((current) => ({ ...current, [field]: value }))
              }
              save={saveActivity}
              cancel={() => navigate("activities")}
            />
          )}
          {page === "addTestimonial" && (
            <AddTestimonialPage
              form={testimonialForm}
              trips={trips}
              editingId={editingTestimonialId}
              update={(field, value) =>
                setTestimonialForm((current) => ({
                  ...current,
                  [field]: value,
                }))
              }
              save={saveTestimonial}
              cancel={() => navigate("testimonials")}
            />
          )}
          {page === "addDiscount" && (
            <AddDiscountPage
              form={discountForm}
              editingId={editingDiscountId}
              update={(field, value) =>
                setDiscountForm((current) => ({ ...current, [field]: value }))
              }
              save={saveDiscount}
              cancel={() => navigate("discounts")}
            />
          )}
          {page === "addTrip" && (
            <AddTripPage
              form={tripForm}
              options={{ tripTypes, locations, activities }}
              editingId={editingTripId}
              update={(field, value) =>
                setTripForm((current) => ({ ...current, [field]: value }))
              }
              save={saveTrip}
              dateAction={updateTripDateAction}
              cancel={() => navigate("trips")}
            />
          )}
          {page === "addTripGallery" && (
            <AddTripGalleryPage
              form={tripGalleryForm}
              trips={trips}
              editingId={editingTripGalleryId}
              update={(field, value) =>
                setTripGalleryForm((current) => ({
                  ...current,
                  [field]: value,
                }))
              }
              save={saveTripGallery}
              cancel={() => navigate("tripGalleries")}
            />
          )}
          {page === "addTripLeader" && (
            <AddTripLeaderPage
              form={tripLeaderForm}
              editingId={editingTripLeaderId}
              update={(field, value) =>
                setTripLeaderForm((current) => ({ ...current, [field]: value }))
              }
              updateBlock={(index, field, value) =>
                setTripLeaderForm((current) => ({
                  ...current,
                  description_blocks: current.description_blocks.map(
                    (block, blockIndex) =>
                      blockIndex === index
                        ? { ...block, [field]: value }
                        : block,
                  ),
                }))
              }
              addBlock={() =>
                setTripLeaderForm((current) => ({
                  ...current,
                  description_blocks: [
                    ...current.description_blocks,
                    {
                      ...emptyTripLeaderBlock,
                      display_order: "",
                    },
                  ],
                }))
              }
              removeBlock={(index) =>
                setTripLeaderForm((current) => ({
                  ...current,
                  description_blocks: current.description_blocks.filter(
                    (_, blockIndex) => blockIndex !== index,
                  ),
                }))
              }
              save={saveTripLeader}
              cancel={() => navigate("tripLeaders")}
            />
          )}
          {page === "addInvoice" && (
            <AddInvoicePage
              form={invoiceForm}
              editingId={editingInvoiceId}
              update={updateInvoice}
              updateItem={updateInvoiceItem}
              addItem={addInvoiceItem}
              removeItem={removeInvoiceItem}
              save={saveInvoice}
              cancel={() => navigate("invoices")}
            />
          )}
          {page === "addAttributeType" && (
            <AddAttributeTypePage
              form={attributeTypeForm}
              editingId={editingAttributeTypeId}
              update={(field, value) =>
                setAttributeTypeForm((current) => ({
                  ...current,
                  [field]: value,
                }))
              }
              save={saveAttributeType}
              cancel={() => navigate("attributeTypes")}
            />
          )}
          {page === "addAttributeValue" && (
            <AddAttributeValuePage
              form={attributeValueForm}
              types={attributeTypes}
              editingId={editingAttributeValueId}
              update={(field, value) =>
                setAttributeValueForm((current) => ({
                  ...current,
                  [field]: value,
                }))
              }
              save={saveAttributeValue}
              cancel={() => navigate("attributeValues")}
            />
          )}
          {page === "addCategory" && (
            <AddCategoryPage
              key={`${editingCategoryId ?? "new"}-${categoryFormRevision}`}
              form={categoryForm}
              parents={categories}
              editingId={editingCategoryId}
              update={(field, value) =>
                setCategoryForm((current) => ({ ...current, [field]: value }))
              }
              save={saveCategory}
              cancel={() => navigate("categories")}
            />
          )}
          {page === "addProduct" && (
            <AddProductPage
              form={productForm}
              categories={categories}
              editingId={editingProductId}
              update={(field, value) =>
                setProductForm((current) => ({ ...current, [field]: value }))
              }
              updateBox={(index, field, value) =>
                setProductForm((current) => ({
                  ...current,
                  box_images: current.box_images.map((box, boxIndex) =>
                    boxIndex === index ? { ...box, [field]: value } : box,
                  ),
                }))
              }
              addBox={() =>
                setProductForm((current) => ({
                  ...current,
                  box_images: [
                    ...current.box_images,
                    { image_alt: "", title: "", link: "", isNew: true },
                  ],
                }))
              }
              removeBox={(index) =>
                setProductForm((current) => ({
                  ...current,
                  box_images: current.box_images.filter(
                    (_box, boxIndex) => boxIndex !== index,
                  ),
                }))
              }
              removeAdditional={removeProductAdditionalImage}
              save={saveProduct}
              cancel={() => navigate("products")}
            />
          )}
          {page === "addProductAttribute" && (
            <AddProductAttributePage
              form={productAttributeForm}
              products={products}
              types={attributeTypes}
              values={attributeValues}
              editingId={editingProductAttributeId}
              update={(field, value) =>
                setProductAttributeForm((current) => ({
                  ...current,
                  [field]: value,
                }))
              }
              save={saveProductAttribute}
            />
          )}
          {page === "addUser" && (
            <AddUserPage
              form={userForm}
              editingId={editingUserId}
              update={(field, value) =>
                setUserForm((current) => ({ ...current, [field]: value }))
              }
              save={saveUser}
              cancel={() => navigate("users")}
            />
          )}
          {page === "addTripBooking" && (
            <AddTripBookingPage
              bookingId={
                resolveAdminRoute(window.location.pathname).editPath?.split(
                  "/",
                )[3]
              }
              cancel={() => navigate("trips")}
              onSaved={completeTripBookingSave}
            />
          )}
          {page === "recentTripBookings" && (
            <TripSectionPage
              title="Manage Recent Booking"
              description="Review and update the latest trip bookings."
              recent
              onNavigate={(path) => navigate("tripPayments", path)}
              onEditNavigate={(path) =>
                navigate("addTripBooking", `${path}?returnTo=recent`)
              }
              onDeleteBooking={deleteTripBooking}
            />
          )}
          {page === "tripBookings" && (
            <TripSectionPage
              title="Manage All Booking"
              description="Review all trip bookings, booking status, payment due, and customer details."
              onNavigate={(path) => navigate("tripPayments", path)}
              onEditNavigate={(path) =>
                navigate("addTripBooking", `${path}?returnTo=all`)
              }
              onDeleteBooking={deleteTripBooking}
            />
          )}
          {page === "downloadTripBookings" && (
            <TripSectionPage
              title="Download All Bookings"
              description="Export the complete booking list in the existing booking export workflow."
              onDownload={(rows) => {
                const headers = [
                  "ID",
                  "Customer",
                  "Trip",
                  "Party",
                  "Booking Date",
                  "Total",
                  "Payment Due",
                  "Status",
                ];
                const values = rows.map((row) => [
                  row.id,
                  `${row.first_name || ""} ${row.last_name || ""}`.trim(),
                  row.trip_name,
                  row.party_number,
                  row.booking_date,
                  row.total_payment,
                  row.payment_due,
                  row.status,
                ]);
                const csv = [headers, ...values]
                  .map((line) =>
                    line
                      .map(
                        (value) =>
                          `"${String(value ?? "").replaceAll('"', '""')}"`,
                      )
                      .join(","),
                  )
                  .join("\n");
                const link = document.createElement("a");
                link.href = URL.createObjectURL(
                  new Blob([csv], { type: "text/csv" }),
                );
                link.download = "trip-bookings.csv";
                link.click();
                URL.revokeObjectURL(link.href);
              }}
            />
          )}
          {page === "tripPayments" &&
            (() => {
              const paymentBookingId = new URLSearchParams(
                window.location.search,
              ).get("booking_id");
              return (
                <TripSectionPage
                  title={
                    paymentBookingId ? "Payment Details" : "Manage Make Payment"
                  }
                  description={
                    paymentBookingId
                      ? "Review and update payments for this booking."
                      : "Review manual payment records associated with trip bookings."
                  }
                  payments={Boolean(paymentBookingId)}
                  makePayments={!paymentBookingId}
                />
              );
            })()}
          {page === "tripItinerary" && (
            <TripItineraryPage
              entries={itineraryEntries}
              isNew={isNewItinerary}
              update={(index, field, value) =>
                setItineraryEntries((current) =>
                  current.map((entry, entryIndex) =>
                    entryIndex === index ? { ...entry, [field]: value } : entry,
                  ),
                )
              }
              save={saveItinerary}
            />
          )}
        </>
      )}
    </AdminLayout>
  );
}
