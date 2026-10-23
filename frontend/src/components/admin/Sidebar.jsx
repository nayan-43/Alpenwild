import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "./Icon";
import { thumbnailAssetUrl } from "@/lib/assets";

function SidebarSubmenu({ open, children }) {
  const submenuRef = useRef(null);
  const previousOpen = useRef(open);

  useLayoutEffect(() => {
    const submenu = submenuRef.current;
    if (!submenu) return undefined;

    if (previousOpen.current === open) {
      submenu.style.height = open ? "auto" : "0px";
      return undefined;
    }

    previousOpen.current = open;
    let animationFrame;
    let openTimer;

    if (open) {
      submenu.style.height = `${submenu.scrollHeight}px`;
      openTimer = window.setTimeout(() => {
        if (previousOpen.current) submenu.style.height = "auto";
      }, 500);
    } else {
      submenu.style.height = `${submenu.getBoundingClientRect().height}px`;
      void submenu.offsetHeight;
      animationFrame = window.requestAnimationFrame(() => {
        submenu.style.height = "0px";
      });
    }

    return () => {
      window.clearTimeout(openTimer);
      window.cancelAnimationFrame(animationFrame);
    };
  }, [open]);

  return (
    <div
      ref={submenuRef}
      className={`submenu ${open ? "open" : ""}`}
      aria-hidden={!open}
    >
      {children}
    </div>
  );
}

const modules = [
  "Trip Leader Module",
  "Invoice Module",
  "Shop Category Module",
  "Attribute Type Module",
  "Attribute Value Module",
  "Product Module",
  "Product Attribute Module",
  "User Module",
  "Product Order Module",
  "Testimonial Module",
  "Static Page Module",
  "Contest Module",
  "Mailing List Module",
  "301 Redirection Module",
  "Admin Settings Module",
];

const moduleIconClasses = {
  "Trip Leader Module": "fa-location-arrow",
  "Invoice Module": "fa-location-arrow",
  "Shop Category Module": "fa-book",
  "Attribute Type Module": "fa-book",
  "Attribute Value Module": "fa-book",
  "Product Module": "fa-book",
  "Product Attribute Module": "fa-book",
  "User Module": "fa-user",
  "Product Order Module": "fa-user",
  "Testimonial Module": "fa-book",
  "Static Page Module": "fa-book",
  "Contest Module": "fa-trophy",
  "Mailing List Module": "fa-book",
  "301 Redirection Module": "fa-book",
  "Admin Settings Module": "fa-share",
};

function ModuleIcon({ module }) {
  return (
    <i
      className={`fa ${moduleIconClasses[module] || "fa-location-arrow"}`}
      aria-hidden="true"
    />
  );
}

const moduleItems = {
  "Trip Leader Module": ["Add Trip Leader", "Manage Trip Leader"],
  "Invoice Module": ["Add Invoice", "Manage Invoice"],
  "Shop Category Module": ["Add Shop Category", "Manage Shop Category"],
  "Attribute Type Module": ["Add Attribute Type", "Manage Attribute Type"],
  "Attribute Value Module": ["Add Attribute Value", "Manage Attribute Value"],
  "Product Module": ["Add Product", "Manage Product"],
  "Product Attribute Module": [
    "Add Product Attribute",
    "Manage Product Attribute",
  ],
  "User Module": ["Add User", "Manage User"],
  "Product Order Module": ["Manage Product Order"],
  "Testimonial Module": ["Add Testimonial", "Manage Testimonial"],
  "Static Page Module": ["Add Static Page", "Manage Static Page"],
  "Contest Module": [
    "Add Contest",
    "Manage Contest",
    "Manage Contest Users",
    "Manage Contest Submission",
    "Download All Submission",
    "Add Contest Rules",
    "Manage Emails",
  ],
  "Mailing List Module": [
    "Add Mailing List",
    "Manage Mailing List",
    "Download Mailing List",
  ],
  "301 Redirection Module": ["Add Redirection", "Manage Redirection"],
  "Admin Settings Module": [
    "Manage Settings",
    "Manage Email Template",
    "Admin Login",
    "Logout",
  ],
};

const modulePageMap = {
  "Contest Module:Add Contest": "addContest",
  "Contest Module:Manage Contest": "contests",
  "Contest Module:Manage Contest Users": "contestUsers",
  "Contest Module:Manage Contest Submission": "contestSubmissions",
  "Contest Module:Download All Submission": "contestSubmissions",
  "Contest Module:Add Contest Rules": "contestRules",
  "Contest Module:Manage Emails": "contestEmails",
  "Mailing List Module:Add Mailing List": "addMailingList",
  "Mailing List Module:Manage Mailing List": "mailingList",
  "Mailing List Module:Download Mailing List": "mailingList",
  "Trip Leader Module:Add Trip Leader": "addTripLeader",
  "Trip Leader Module:Manage Trip Leader": "tripLeaders",
  "Invoice Module:Add Invoice": "addInvoice",
  "Invoice Module:Manage Invoice": "invoices",
  "Attribute Type Module:Add Attribute Type": "addAttributeType",
  "Attribute Type Module:Manage Attribute Type": "attributeTypes",
  "Attribute Value Module:Add Attribute Value": "addAttributeValue",
  "Attribute Value Module:Manage Attribute Value": "attributeValues",
  "Product Module:Add Product": "addProduct",
  "Product Module:Manage Product": "products",
  "Product Attribute Module:Add Product Attribute": "addProductAttribute",
  "Product Attribute Module:Manage Product Attribute": "productAttributes",
  "Shop Category Module:Add Shop Category": "addCategory",
  "Shop Category Module:Manage Shop Category": "categories",
  "User Module:Add User": "addUser",
  "User Module:Manage User": "users",
  "Product Order Module:Manage Product Order": "orders",
  "Testimonial Module:Add Testimonial": "addTestimonial",
  "Testimonial Module:Manage Testimonial": "testimonials",
  "Static Page Module:Add Static Page": "addStaticPage",
  "Static Page Module:Manage Static Page": "staticPages",
  "301 Redirection Module:Add Redirection": "addRedirection",
  "301 Redirection Module:Manage Redirection": "redirections",
  "Admin Settings Module:Manage Settings": "settings",
  "Admin Settings Module:Manage Email Template": "emailTemplates",
  "Admin Settings Module:Change Username": "changeUsername",
  "Admin Settings Module:Change Password": "changePassword",
  "Admin Settings Module:Logout": "logout",
};

export default function Sidebar({
  page,
  setPage,
  onLogout,
  onDownloadBookings,
}) {
  function handleModuleItemClick(item, target) {
    if (item === "Download All Submission") {
      window.location.assign("/api/contest-submissions/download");
      return;
    }
    if (item === "Download Mailing List") {
      window.location.assign("/api/mailing-list/download");
      return;
    }
    if (target === "logout") onLogout();
    else if (target) setPage(target);
  }

  const [dashboardOpen, setDashboardOpen] = useState(page === "dashboard");
  const [bannerOpen, setBannerOpen] = useState(
    page === "add" || page === "banners",
  );
  const [promotionsOpen, setPromotionsOpen] = useState(
    page === "addPromotion" || page === "promotions",
  );
  const [specialFeatureOpen, setSpecialFeatureOpen] = useState(
    page === "addSpecialFeature" || page === "specialFeatures",
  );
  const [footerMenuOpen, setFooterMenuOpen] = useState(
    page === "addFooterMenu" || page === "footerMenus",
  );
  const [tripTypeOpen, setTripTypeOpen] = useState(
    page === "addTripType" || page === "tripTypes",
  );
  const [locationOpen, setLocationOpen] = useState(
    page === "addLocation" || page === "locations",
  );
  const [activityOpen, setActivityOpen] = useState(
    page === "addActivity" || page === "activities",
  );
  const [discountOpen, setDiscountOpen] = useState(
    page === "addDiscount" || page === "discounts",
  );
  const tripPages = [
    "addTrip",
    "trips",
    "tripItinerary",
    "addTripGallery",
    "tripGalleries",
    "addTripBooking",
    "recentTripBookings",
    "tripBookings",
    "downloadTripBookings",
    "tripPayments",
  ];
  const [tripOpen, setTripOpen] = useState(tripPages.includes(page));
  const [openModule, setOpenModule] = useState(
    [
      "addContest",
      "contests",
      "contestUsers",
      "contestUserDetails",
      "contestSubmissions",
      "contestRules",
      "contestEmails",
    ].includes(page)
      ? "Contest Module"
      : page === "addMailingList" || page === "mailingList"
        ? "Mailing List Module"
        : page === "addTripLeader" || page === "tripLeaders"
          ? "Trip Leader Module"
          : page === "addInvoice" || page === "invoices"
            ? "Invoice Module"
            : page === "addCategory" || page === "categories"
              ? "Shop Category Module"
              : page === "addProductAttribute" || page === "productAttributes"
                ? "Product Attribute Module"
                : page === "addUser" || page === "users"
                  ? "User Module"
                  : page === "addTestimonial" || page === "testimonials"
                    ? "Testimonial Module"
                    : page === "addStaticPage" || page === "staticPages"
                      ? "Static Page Module"
                      : page === "addRedirection" || page === "redirections"
                        ? "301 Redirection Module"
                        : page === "settings" ||
                            page === "emailTemplates" ||
                            page === "changeUsername" ||
                            page === "changePassword"
                          ? "Admin Settings Module"
                          : null,
  );
  const [adminLoginOpen, setAdminLoginOpen] = useState(
    page === "changeUsername" || page === "changePassword",
  );

  function toggleModule(module, setter) {
    const nextOpen = !module;
    setDashboardOpen(false);
    setBannerOpen(false);
    setPromotionsOpen(false);
    setSpecialFeatureOpen(false);
    setFooterMenuOpen(false);
    setTripTypeOpen(false);
    setLocationOpen(false);
    setActivityOpen(false);
    setDiscountOpen(false);
    setTripOpen(false);
    setAdminLoginOpen(false);
    setter(nextOpen);
  }
  const [hoveredGroup, setHoveredGroup] = useState(null);
  const [flyoutTop, setFlyoutTop] = useState(0);

  useEffect(() => {
    setDashboardOpen(page === "dashboard");
    setBannerOpen(page === "add" || page === "banners");
    setPromotionsOpen(page === "addPromotion" || page === "promotions");
    setSpecialFeatureOpen(
      page === "addSpecialFeature" || page === "specialFeatures",
    );
    setFooterMenuOpen(page === "addFooterMenu" || page === "footerMenus");
    setTripTypeOpen(page === "addTripType" || page === "tripTypes");
    setLocationOpen(page === "addLocation" || page === "locations");
    setActivityOpen(page === "addActivity" || page === "activities");
    setDiscountOpen(page === "addDiscount" || page === "discounts");
    setTripOpen(tripPages.includes(page));
    if (
      [
        "addContest",
        "contests",
        "contestUsers",
        "contestUserDetails",
        "contestSubmissions",
        "contestRules",
        "contestEmails",
      ].includes(page)
    )
      setOpenModule("Contest Module");
    if (page === "addMailingList" || page === "mailingList")
      setOpenModule("Mailing List Module");
    if (page === "addTripLeader" || page === "tripLeaders")
      setOpenModule("Trip Leader Module");
    if (page === "addInvoice" || page === "invoices")
      setOpenModule("Invoice Module");
    if (page === "addAttributeType" || page === "attributeTypes")
      setOpenModule("Attribute Type Module");
    if (page === "addAttributeValue" || page === "attributeValues")
      setOpenModule("Attribute Value Module");
    if (page === "addProduct" || page === "products")
      setOpenModule("Product Module");
    if (page === "addProductAttribute" || page === "productAttributes")
      setOpenModule("Product Attribute Module");
    if (page === "addCategory" || page === "categories")
      setOpenModule("Shop Category Module");
    if (page === "addUser" || page === "users") setOpenModule("User Module");
    if (page === "addTestimonial" || page === "testimonials")
      setOpenModule("Testimonial Module");
    if (page === "addStaticPage" || page === "staticPages")
      setOpenModule("Static Page Module");
    if (page === "addRedirection" || page === "redirections")
      setOpenModule("301 Redirection Module");
    if (page === "orders") setOpenModule("Product Order Module");
    if (
      page === "settings" ||
      page === "emailTemplates" ||
      page === "changeUsername" ||
      page === "changePassword"
    )
      setOpenModule("Admin Settings Module");
    setAdminLoginOpen(page === "changeUsername" || page === "changePassword");
  }, [page]);

  function showFlyout(group, event) {
    setHoveredGroup(group);
    setFlyoutTop(event.currentTarget.getBoundingClientRect().top);
  }

  function isModulePageActive(module) {
    if (
      module === "Admin Settings Module" &&
      ["changeUsername", "changePassword"].includes(page)
    ) {
      return true;
    }
    return Object.entries(modulePageMap).some(
      ([key, target]) => key.startsWith(`${module}:`) && target === page,
    );
  }

  return (
    <aside className="sidebar" onMouseLeave={() => setHoveredGroup(null)}>
      <Link
        className="brand"
        to="/"
        onClick={(event) => {
          event.preventDefault();
          setPage("dashboard");
        }}
      >
        <img
          src={thumbnailAssetUrl(
            "1_1625721414_1_1625662529_1_1518177529_logo.png",
            140,
            118,
            3,
          )}
          alt="Alpenwild"
        />
      </Link>
      <div className="sidebar-nav">
        <div className="nav-label">MAIN NAVIGATION</div>
        <div
          className="nav-group"
          onMouseEnter={(event) => showFlyout("dashboard", event)}
        >
          <button
            className={`nav-item group-title ${page === "dashboard" ? "active" : ""}`}
            onClick={() => toggleModule(dashboardOpen, setDashboardOpen)}
          >
            {/* <Icon name="dashboard" /> */}
            <i className="fa fa-dashboard"></i>{" "}
            <span className="nav-text">Dashboard</span>{" "}
            <span className={`nav-chevron ${dashboardOpen ? "open" : ""}`}>
              <Icon name="chevron" size={13} />
            </span>
          </button>
          <SidebarSubmenu open={dashboardOpen}>
            <button
              className={`sub-item ${page === "dashboard" ? "active" : ""}`}
              onClick={() => setPage("dashboard")}
            >
              <span className="sub-dot" /> Dashboard
            </button>
          </SidebarSubmenu>
        </div>
        <div
          className="nav-group"
          onMouseEnter={(event) => showFlyout("banner", event)}
        >
          <button
            className={`nav-item group-title ${page === "add" || page === "banners" ? "active" : ""}`}
            onClick={() => toggleModule(bannerOpen, setBannerOpen)}
          >
            <Icon name="plane" />{" "}
            <span className="nav-text">Banner Module</span>{" "}
            <span className={`nav-chevron ${bannerOpen ? "open" : ""}`}>
              <Icon name="chevron" size={13} />
            </span>
          </button>
          <SidebarSubmenu open={bannerOpen}>
            <button
              className={`sub-item ${page === "add" ? "active" : ""}`}
              onClick={() => setPage("add")}
            >
              <span className="sub-dot" /> Add Banner
            </button>
            <button
              className={`sub-item ${page === "banners" ? "active" : ""}`}
              onClick={() => setPage("banners")}
            >
              <span className="sub-dot" /> Manage Banner
            </button>
          </SidebarSubmenu>
        </div>
        <div
          className="nav-group"
          onMouseEnter={(event) => showFlyout("promotions", event)}
        >
          <button
            className={`nav-item group-title ${page === "addPromotion" || page === "promotions" ? "active" : ""}`}
            onClick={() => toggleModule(promotionsOpen, setPromotionsOpen)}
          >
            <Icon name="plane" />{" "}
            <span className="nav-text">Offers Promotions Module</span>{" "}
            <span className={`nav-chevron ${promotionsOpen ? "open" : ""}`}>
              <Icon name="chevron" size={13} />
            </span>
          </button>
          <SidebarSubmenu open={promotionsOpen}>
            <button
              className={`sub-item ${page === "addPromotion" ? "active" : ""}`}
              onClick={() => setPage("addPromotion")}
            >
              <span className="sub-dot" /> Add Offers Promotions
            </button>
            <button
              className={`sub-item ${page === "promotions" ? "active" : ""}`}
              onClick={() => setPage("promotions")}
            >
              <span className="sub-dot" /> Manage Offers Promotions
            </button>
          </SidebarSubmenu>
        </div>
        <div
          className="nav-group"
          onMouseEnter={(event) => showFlyout("specialFeatures", event)}
        >
          <button
            className={`nav-item group-title ${page === "addSpecialFeature" || page === "specialFeatures" ? "active" : ""}`}
            onClick={() =>
              toggleModule(specialFeatureOpen, setSpecialFeatureOpen)
            }
          >
            <Icon name="plane" />{" "}
            <span className="nav-text">Special Feature Module</span>{" "}
            <span className={`nav-chevron ${specialFeatureOpen ? "open" : ""}`}>
              <Icon name="chevron" size={13} />
            </span>
          </button>
          <SidebarSubmenu open={specialFeatureOpen}>
            <button
              className={`sub-item ${page === "addSpecialFeature" ? "active" : ""}`}
              onClick={() => setPage("addSpecialFeature")}
            >
              <span className="sub-dot" /> Add Special Feature
            </button>
            <button
              className={`sub-item ${page === "specialFeatures" ? "active" : ""}`}
              onClick={() => setPage("specialFeatures")}
            >
              <span className="sub-dot" /> Manage Special Feature
            </button>
          </SidebarSubmenu>
        </div>
        <div
          className="nav-group"
          onMouseEnter={(event) => showFlyout("footerMenus", event)}
        >
          <button
            className={`nav-item group-title ${page === "addFooterMenu" || page === "footerMenus" ? "active" : ""}`}
            onClick={() => toggleModule(footerMenuOpen, setFooterMenuOpen)}
          >
            <Icon name="plane" />{" "}
            <span className="nav-text">Footer Menu Module</span>{" "}
            <span className={`nav-chevron ${footerMenuOpen ? "open" : ""}`}>
              <Icon name="chevron" size={13} />
            </span>
          </button>
          <SidebarSubmenu open={footerMenuOpen}>
            <button
              className={`sub-item ${page === "addFooterMenu" ? "active" : ""}`}
              onClick={() => setPage("addFooterMenu")}
            >
              <span className="sub-dot" /> Add Footer Menu
            </button>
            <button
              className={`sub-item ${page === "footerMenus" ? "active" : ""}`}
              onClick={() => setPage("footerMenus")}
            >
              <span className="sub-dot" /> Manage Footer Menus
            </button>
          </SidebarSubmenu>
        </div>
        <div
          className="nav-group"
          onMouseEnter={(event) => showFlyout("tripTypes", event)}
        >
          <button
            className={`nav-item group-title ${page === "addTripType" || page === "tripTypes" ? "active" : ""}`}
            onClick={() => toggleModule(tripTypeOpen, setTripTypeOpen)}
          >
            <Icon name="plane" />{" "}
            <span className="nav-text">Trip Type Module</span>{" "}
            <span className={`nav-chevron ${tripTypeOpen ? "open" : ""}`}>
              <Icon name="chevron" size={13} />
            </span>
          </button>
          <SidebarSubmenu open={tripTypeOpen}>
            <button
              className={`sub-item ${page === "addTripType" ? "active" : ""}`}
              onClick={() => setPage("addTripType")}
            >
              <span className="sub-dot" /> Add Trip Type
            </button>
            <button
              className={`sub-item ${page === "tripTypes" ? "active" : ""}`}
              onClick={() => setPage("tripTypes")}
            >
              <span className="sub-dot" /> Manage Trip Type
            </button>
          </SidebarSubmenu>
        </div>
        <div
          className="nav-group"
          onMouseEnter={(event) => showFlyout("locations", event)}
        >
          <button
            className={`nav-item group-title ${page === "addLocation" || page === "locations" ? "active" : ""}`}
            onClick={() => toggleModule(locationOpen, setLocationOpen)}
          >
            <Icon name="plane" />{" "}
            <span className="nav-text">Location Module</span>{" "}
            <span className={`nav-chevron ${locationOpen ? "open" : ""}`}>
              <Icon name="chevron" size={13} />
            </span>
          </button>
          <SidebarSubmenu open={locationOpen}>
            <button
              className={`sub-item ${page === "addLocation" ? "active" : ""}`}
              onClick={() => setPage("addLocation")}
            >
              <span className="sub-dot" /> Add Location
            </button>
            <button
              className={`sub-item ${page === "locations" ? "active" : ""}`}
              onClick={() => setPage("locations")}
            >
              <span className="sub-dot" /> Manage Location
            </button>
          </SidebarSubmenu>
        </div>
        <div
          className="nav-group"
          onMouseEnter={(event) => showFlyout("activities", event)}
        >
          <button
            className={`nav-item group-title ${page === "addActivity" || page === "activities" ? "active" : ""}`}
            onClick={() => toggleModule(activityOpen, setActivityOpen)}
          >
            <Icon name="plane" />{" "}
            <span className="nav-text">Activity Module</span>{" "}
            <span className={`nav-chevron ${activityOpen ? "open" : ""}`}>
              <Icon name="chevron" size={13} />
            </span>
          </button>
          <SidebarSubmenu open={activityOpen}>
            <button
              className={`sub-item ${page === "addActivity" ? "active" : ""}`}
              onClick={() => setPage("addActivity")}
            >
              <span className="sub-dot" /> Add Activity
            </button>
            <button
              className={`sub-item ${page === "activities" ? "active" : ""}`}
              onClick={() => setPage("activities")}
            >
              <span className="sub-dot" /> Manage Activity
            </button>
          </SidebarSubmenu>
        </div>
        <div
          className="nav-group"
          onMouseEnter={(event) => showFlyout("discounts", event)}
        >
          <button
            className={`nav-item group-title ${page === "addDiscount" || page === "discounts" ? "active" : ""}`}
            onClick={() => toggleModule(discountOpen, setDiscountOpen)}
          >
            <Icon name="plane" />{" "}
            <span className="nav-text">Discount Module</span>{" "}
            <span className={`nav-chevron ${discountOpen ? "open" : ""}`}>
              <Icon name="chevron" size={13} />
            </span>
          </button>
          <SidebarSubmenu open={discountOpen}>
            <button
              className={`sub-item ${page === "addDiscount" ? "active" : ""}`}
              onClick={() => setPage("addDiscount")}
            >
              <span className="sub-dot" /> Add Discount
            </button>
            <button
              className={`sub-item ${page === "discounts" ? "active" : ""}`}
              onClick={() => setPage("discounts")}
            >
              <span className="sub-dot" /> Manage Discount
            </button>
          </SidebarSubmenu>
        </div>
        <div
          className="nav-group"
          onMouseEnter={(event) => showFlyout("trips", event)}
        >
          <button
            className={`nav-item group-title ${tripPages.includes(page) ? "active" : ""}`}
            onClick={() => toggleModule(tripOpen, setTripOpen)}
          >
            <Icon name="plane" /> <span className="nav-text">Trip Module</span>{" "}
            <span className={`nav-chevron ${tripOpen ? "open" : ""}`}>
              <Icon name="chevron" size={13} />
            </span>
          </button>
          <SidebarSubmenu open={tripOpen}>
            <button
              className={`sub-item ${page === "addTrip" ? "active" : ""}`}
              onClick={() => setPage("addTrip")}
            >
              <span className="sub-dot" /> Add Trip
            </button>
            <button
              className={`sub-item ${page === "trips" ? "active" : ""}`}
              onClick={() => setPage("trips")}
            >
              <span className="sub-dot" /> Manage Trip
            </button>
            <button
              className={`sub-item ${page === "addTripGallery" ? "active" : ""}`}
              onClick={() => setPage("addTripGallery")}
            >
              <span className="sub-dot" /> Add Gallery
            </button>
            <button
              className={`sub-item ${page === "tripGalleries" ? "active" : ""}`}
              onClick={() => setPage("tripGalleries")}
            >
              <span className="sub-dot" /> Manage Gallery
            </button>
            <button
              className={`sub-item ${page === "addTripBooking" ? "active" : ""}`}
              onClick={() => setPage("addTripBooking")}
            >
              <span className="sub-dot" /> Add Booking
            </button>
            <button
              className={`sub-item ${page === "recentTripBookings" ? "active" : ""}`}
              onClick={() => setPage("recentTripBookings")}
            >
              <span className="sub-dot" /> Manage Recent Booking
            </button>
            <button
              className={`sub-item ${page === "tripBookings" ? "active" : ""}`}
              onClick={() => setPage("tripBookings")}
            >
              <span className="sub-dot" /> Manage All Booking
            </button>
            <button
              className={`sub-item ${page === "downloadTripBookings" ? "active" : ""}`}
              onClick={() =>
                onDownloadBookings
                  ? onDownloadBookings()
                  : setPage("downloadTripBookings")
              }
            >
              <span className="sub-dot" /> Download All Bookings
            </button>
            <button
              className={`sub-item ${page === "tripPayments" ? "active" : ""}`}
              onClick={() => setPage("tripPayments")}
            >
              <span className="sub-dot" /> Manage Make Payment
            </button>
          </SidebarSubmenu>
        </div>
        {modules.map((module) => (
          <div
            className="nav-group"
            key={module}
            onMouseEnter={(event) => showFlyout(module, event)}
          >
            <button
              className={`nav-item muted ${isModulePageActive(module) ? "active" : ""}`}
              onClick={() =>
                setOpenModule(openModule === module ? null : module)
              }
            >
              <ModuleIcon module={module} />{" "}
              <span className="nav-text">{module}</span>{" "}
              <span
                className={`nav-chevron ${openModule === module ? "open" : ""}`}
              >
                <Icon name="chevron" size={13} />
              </span>
            </button>
            <SidebarSubmenu open={openModule === module}>
              {(moduleItems[module] || []).map((item) => {
                const target = modulePageMap[`${module}:${item}`];
                return item === "Admin Login" ? (
                  <div className="admin-login-subnav" key={item}>
                    <button
                      className={`sub-item admin-login-toggle ${page === "changeUsername" || page === "changePassword" ? "active" : ""}`}
                      onClick={() => setAdminLoginOpen((open) => !open)}
                    >
                      <span className="sub-dot" /> Admin Login
                      <Icon
                        name="chevron"
                        size={12}
                        className={`admin-login-chevron ${adminLoginOpen ? "open" : ""}`}
                      />
                    </button>
                    <div
                      className={`admin-login-children ${adminLoginOpen ? "open" : ""}`}
                    >
                      <button
                        className={page === "changeUsername" ? "active" : ""}
                        onClick={() => setPage("changeUsername")}
                      >
                        <span className="sub-dot" />
                        Change Username
                      </button>
                      <button
                        className={page === "changePassword" ? "active" : ""}
                        onClick={() => setPage("changePassword")}
                      >
                        <span className="sub-dot" />
                        Change Password
                      </button>
                    </div>
                  </div>
                ) : target ? (
                  <button
                    className={`sub-item ${page === target && item !== "Download All Submission" ? "active" : ""}`}
                    key={item}
                    onClick={() => handleModuleItemClick(item, target)}
                  >
                    <span className="sub-dot" /> {item}
                  </button>
                ) : (
                  <div className="sub-item disabled" key={item}>
                    {item}
                  </div>
                );
              })}
            </SidebarSubmenu>
          </div>
        ))}
      </div>
      {hoveredGroup && (
        <div
          className="sidebar-flyout"
          style={{ top: `${flyoutTop}px` }}
          onMouseEnter={() => setHoveredGroup(hoveredGroup)}
        >
          {hoveredGroup === "dashboard" && (
            <>
              <div className="flyout-title">
                <Icon name="dashboard" />
                <span>Dashboard</span>
              </div>
              <div className="flyout-submenu">
                <button
                  className={`sub-item ${page === "dashboard" ? "active" : ""}`}
                  onClick={() => setPage("dashboard")}
                >
                  <span className="sub-dot" /> Dashboard
                </button>
              </div>
            </>
          )}
          {hoveredGroup === "trips" && (
            <>
              <div className="flyout-title">
                <Icon name="plane" />
                <span>Trip Module</span>
              </div>
              <div className="flyout-submenu">
                <button
                  className={`sub-item ${page === "addTrip" ? "active" : ""}`}
                  onClick={() => setPage("addTrip")}
                >
                  <span className="sub-dot" /> Add Trip
                </button>
                <button
                  className={`sub-item ${page === "trips" ? "active" : ""}`}
                  onClick={() => setPage("trips")}
                >
                  <span className="sub-dot" /> Manage Trip
                </button>
                <button
                  className={`sub-item ${page === "addTripGallery" ? "active" : ""}`}
                  onClick={() => setPage("addTripGallery")}
                >
                  <span className="sub-dot" /> Add Gallery
                </button>
                <button
                  className={`sub-item ${page === "tripGalleries" ? "active" : ""}`}
                  onClick={() => setPage("tripGalleries")}
                >
                  <span className="sub-dot" /> Manage Gallery
                </button>
                <button
                  className={`sub-item ${page === "addTripBooking" ? "active" : ""}`}
                  onClick={() => setPage("addTripBooking")}
                >
                  <span className="sub-dot" /> Add Booking
                </button>
                <button
                  className={`sub-item ${page === "recentTripBookings" ? "active" : ""}`}
                  onClick={() => setPage("recentTripBookings")}
                >
                  <span className="sub-dot" /> Manage Recent Booking
                </button>
                <button
                  className={`sub-item ${page === "tripBookings" ? "active" : ""}`}
                  onClick={() => setPage("tripBookings")}
                >
                  <span className="sub-dot" /> Manage All Booking
                </button>
                <button
                  className={`sub-item`}
                  onClick={() =>
                    onDownloadBookings
                      ? onDownloadBookings()
                      : setPage("downloadTripBookings")
                  }
                >
                  <span className="sub-dot" /> Download All Bookings
                </button>
                <button
                  className={`sub-item ${page === "tripPayments" ? "active" : ""}`}
                  onClick={() => setPage("tripPayments")}
                >
                  <span className="sub-dot" /> Manage Make Payment
                </button>
              </div>
            </>
          )}
          {hoveredGroup === "banner" && (
            <>
              <div className="flyout-title">
                <Icon name="plane" />
                <span>Banner Module</span>
              </div>
              <div className="flyout-submenu">
                <button
                  className={`sub-item ${page === "add" ? "active" : ""}`}
                  onClick={() => setPage("add")}
                >
                  <span className="sub-dot" /> Add Banner
                </button>
                <button
                  className={`sub-item ${page === "banners" ? "active" : ""}`}
                  onClick={() => setPage("banners")}
                >
                  <span className="sub-dot" /> Manage Banner
                </button>
              </div>
            </>
          )}
          {hoveredGroup === "promotions" && (
            <>
              <div className="flyout-title">
                <Icon name="plane" />
                <span>Offers Promotions Module</span>
              </div>
              <div className="flyout-submenu">
                <button
                  className={`sub-item ${page === "addPromotion" ? "active" : ""}`}
                  onClick={() => setPage("addPromotion")}
                >
                  <span className="sub-dot" /> Add Offers Promotions
                </button>
                <button
                  className={`sub-item ${page === "promotions" ? "active" : ""}`}
                  onClick={() => setPage("promotions")}
                >
                  <span className="sub-dot" /> Manage Offers Promotions
                </button>
              </div>
            </>
          )}
          {hoveredGroup === "specialFeatures" && (
            <>
              <div className="flyout-title">
                <Icon name="plane" />
                <span>Special Feature Module</span>
              </div>
              <div className="flyout-submenu">
                <button
                  className={`sub-item ${page === "addSpecialFeature" ? "active" : ""}`}
                  onClick={() => setPage("addSpecialFeature")}
                >
                  <span className="sub-dot" /> Add Special Feature
                </button>
                <button
                  className={`sub-item ${page === "specialFeatures" ? "active" : ""}`}
                  onClick={() => setPage("specialFeatures")}
                >
                  <span className="sub-dot" /> Manage Special Feature
                </button>
              </div>
            </>
          )}
          {hoveredGroup === "footerMenus" && (
            <>
              <div className="flyout-title">
                <Icon name="plane" />
                <span>Footer Menu Module</span>
              </div>
              <div className="flyout-submenu">
                <button
                  className={`sub-item ${page === "addFooterMenu" ? "active" : ""}`}
                  onClick={() => setPage("addFooterMenu")}
                >
                  <span className="sub-dot" /> Add Footer Menu
                </button>
                <button
                  className={`sub-item ${page === "footerMenus" ? "active" : ""}`}
                  onClick={() => setPage("footerMenus")}
                >
                  <span className="sub-dot" /> Manage Footer Menus
                </button>
              </div>
            </>
          )}
          {hoveredGroup === "tripTypes" && (
            <>
              <div className="flyout-title">
                <Icon name="plane" />
                <span>Trip Type Module</span>
              </div>
              <div className="flyout-submenu">
                <button
                  className={`sub-item ${page === "addTripType" ? "active" : ""}`}
                  onClick={() => setPage("addTripType")}
                >
                  <span className="sub-dot" /> Add Trip Type
                </button>
                <button
                  className={`sub-item ${page === "tripTypes" ? "active" : ""}`}
                  onClick={() => setPage("tripTypes")}
                >
                  <span className="sub-dot" /> Manage Trip Type
                </button>
              </div>
            </>
          )}
          {hoveredGroup === "locations" && (
            <>
              <div className="flyout-title">
                <Icon name="plane" />
                <span>Location Module</span>
              </div>
              <div className="flyout-submenu">
                <button
                  className={`sub-item ${page === "addLocation" ? "active" : ""}`}
                  onClick={() => setPage("addLocation")}
                >
                  <span className="sub-dot" /> Add Location
                </button>
                <button
                  className={`sub-item ${page === "locations" ? "active" : ""}`}
                  onClick={() => setPage("locations")}
                >
                  <span className="sub-dot" /> Manage Location
                </button>
              </div>
            </>
          )}
          {hoveredGroup === "activities" && (
            <>
              <div className="flyout-title">
                <Icon name="plane" />
                <span>Activity Module</span>
              </div>
              <div className="flyout-submenu">
                <button
                  className={`sub-item ${page === "addActivity" ? "active" : ""}`}
                  onClick={() => setPage("addActivity")}
                >
                  <span className="sub-dot" /> Add Activity
                </button>
                <button
                  className={`sub-item ${page === "activities" ? "active" : ""}`}
                  onClick={() => setPage("activities")}
                >
                  <span className="sub-dot" /> Manage Activity
                </button>
              </div>
            </>
          )}
          {hoveredGroup === "discounts" && (
            <>
              <div className="flyout-title">
                <Icon name="plane" />
                <span>Discount Module</span>
              </div>
              <div className="flyout-submenu">
                <button
                  className={`sub-item ${page === "addDiscount" ? "active" : ""}`}
                  onClick={() => setPage("addDiscount")}
                >
                  <span className="sub-dot" /> Add Discount
                </button>
                <button
                  className={`sub-item ${page === "discounts" ? "active" : ""}`}
                  onClick={() => setPage("discounts")}
                >
                  <span className="sub-dot" /> Manage Discount
                </button>
              </div>
            </>
          )}
          {modules.includes(hoveredGroup) && (
            <>
              <div className="flyout-title">
                <ModuleIcon module={hoveredGroup} />
                <span>{hoveredGroup}</span>
              </div>
              <div className="flyout-submenu">
                {(moduleItems[hoveredGroup] || []).map((item) => {
                  const target = modulePageMap[`${hoveredGroup}:${item}`];
                  return item === "Admin Login" ? (
                    <div className="admin-login-subnav" key={item}>
                      <button
                        className={`sub-item admin-login-toggle ${page === "changeUsername" || page === "changePassword" ? "active" : ""}`}
                        onClick={() => setAdminLoginOpen((open) => !open)}
                      >
                        <span className="sub-dot" /> Admin Login
                        <Icon
                          name="chevron"
                          size={12}
                          className={`admin-login-chevron ${adminLoginOpen ? "open" : ""}`}
                        />
                      </button>
                      <div
                        className={`admin-login-children ${adminLoginOpen ? "open" : ""}`}
                      >
                        <button
                          className={page === "changeUsername" ? "active" : ""}
                          onClick={() => setPage("changeUsername")}
                        >
                          <span className="sub-dot" />
                          Change Username
                        </button>
                        <button
                          className={page === "changePassword" ? "active" : ""}
                          onClick={() => setPage("changePassword")}
                        >
                          <span className="sub-dot" />
                          Change Password
                        </button>
                      </div>
                    </div>
                  ) : target ? (
                    <button
                      className={`sub-item ${page === target ? "active" : ""}`}
                      key={item}
                      onClick={() => handleModuleItemClick(item, target)}
                    >
                      <span className="sub-dot" /> {item}
                    </button>
                  ) : (
                    <div className="sub-item disabled" key={item}>
                      {item}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
