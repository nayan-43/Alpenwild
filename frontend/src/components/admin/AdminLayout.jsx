import React, { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import PageHeader from "./PageHeader";
import { api } from "@/lib/api";

export default function AdminLayout({
  page,
  setPage,
  user,
  onLogout,
  onDownloadBookings,
  headerTitle,
  headerSubtitle,
  breadcrumbTitle,
  children,
}) {
  const [copyrightText, setCopyrightText] = useState("");
  const [copyrightError, setCopyrightError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api("/api/settings")
      .then((settings) => {
        if (!cancelled) setCopyrightText(settings.copyright_text || "");
      })
      .catch((error) => {
        if (!cancelled) setCopyrightError(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const title =
    page === "dashboard"
      ? "Dashboard"
      : page === "add"
        ? "Manage Banner"
        : page === "addPromotion"
          ? "Manage Offers Promotions"
          : page === "promotions"
            ? "Manage Offers Promotions"
            : page === "addSpecialFeature"
              ? "Manage Special Feature"
              : page === "specialFeatures"
                ? "Manage Special Feature"
                : page === "addFooterMenu"
                  ? "Manage Footer Menu"
                  : page === "footerMenus"
                    ? "Manage Footer Menu"
                    : page === "addStaticPage"
                      ? "Manage Static Page"
                      : page === "staticPages"
                        ? "Manage Static Page"
                        : page === "addRedirection"
                          ? "Add 301 Redirection"
                          : page === "redirections"
                            ? "Manage 301 Redirection"
                            : page === "addTripType"
                              ? "Add Trip Type"
                              : page === "tripTypes"
                                ? "Manage Trip Type"
                                : page === "addLocation"
                                  ? "Add Location"
                                  : page === "locations"
                                    ? "Manage Location"
                                    : page === "addActivity"
                                      ? "Add Activity"
                                      : page === "activities"
                                        ? "Manage Activity"
                                        : page === "addTestimonial"
                                          ? "Add Testimonial"
                                          : page === "testimonials"
                                            ? "Manage Testimonial"
                                            : page === "addDiscount"
                                              ? "Add Discount"
                                              : page === "discounts"
                                                ? "Manage Discount"
                                                : page === "addTrip"
                                                  ? "Manage Trip"
                                                  : page === "trips"
                                                    ? "Manage Trip"
                                                    : page === "tripItinerary"
                                                      ? "Manage Itinerary"
                                                      : page === "tripFaq"
                                                        ? "Manage Faq"
                                                        : page === "tripFaqEdit"
                                                          ? "Edit Faq"
                                                          : page ===
                                                              "addTripGallery"
                                                            ? "Manage Gallery"
                                                            : page ===
                                                                "tripGalleries"
                                                              ? "Manage Gallery"
                                                              : page ===
                                                                  "addTripBooking"
                                                                ? "Manage Trip Booking"
                                                                : page ===
                                                                    "recentTripBookings"
                                                                  ? "Manage Trip Booking"
                                                                  : page ===
                                                                      "tripBookings"
                                                                    ? "Manage All Booking"
                                                                    : page ===
                                                                        "downloadTripBookings"
                                                                      ? "Download All Bookings"
                                                                      : page ===
                                                                          "tripPayments"
                                                                        ? "Manage Trip Booking"
                                                                        : page ===
                                                                            "addTripLeader"
                                                                          ? "Add Trip Leader"
                                                                          : page ===
                                                                              "tripLeaders"
                                                                            ? "Manage Trip Leader"
                                                                            : page ===
                                                                                "addInvoice"
                                                                              ? "Add Invoice"
                                                                              : page ===
                                                                                  "invoices"
                                                                                ? "Manage Invoice"
                                                                                : page ===
                                                                                    "addCategory"
                                                                                  ? "Add Shop Category"
                                                                                  : page ===
                                                                                      "categories"
                                                                                    ? "Manage Shop Category"
                                                                                    : page ===
                                                                                        "addAttributeType"
                                                                                      ? "Add Attribute Type"
                                                                                      : page ===
                                                                                          "attributeTypes"
                                                                                        ? "Manage Attribute Type"
                                                                                        : page ===
                                                                                            "addAttributeValue"
                                                                                          ? "Add Attribute Value"
                                                                                          : page ===
                                                                                              "attributeValues"
                                                                                            ? "Manage Attribute Value"
                                                                                            : page ===
                                                                                                "addProduct"
                                                                                              ? "Add Product"
                                                                                              : page ===
                                                                                                  "products"
                                                                                                ? "Manage Product"
                                                                                                : page ===
                                                                                                    "addProductAttribute"
                                                                                                  ? "Add Product Attribute"
                                                                                                  : page ===
                                                                                                      "productAttributes"
                                                                                                    ? "Manage Product Attribute"
                                                                                                    : page ===
                                                                                                        "addUser"
                                                                                                      ? "Add User"
                                                                                                      : page ===
                                                                                                          "users"
                                                                                                        ? "Manage User"
                                                                                                        : page ===
                                                                                                            "settings"
                                                                                                          ? "Manage General Settings"
                                                                                                          : page ===
                                                                                                              "emailTemplates"
                                                                                                            ? "Manage Email Template"
                                                                                                            : page ===
                                                                                                                "changeUsername"
                                                                                                              ? "Manage User Name"
                                                                                                              : page ===
                                                                                                                  "changePassword"
                                                                                                                ? "Manage Password"
                                                                                                                : page ===
                                                                                                                    "contests"
                                                                                                                  ? "Manage Contest"
                                                                                                                  : page ===
                                                                                                                      "addContest"
                                                                                                                    ? "Add Contest"
                                                                                                                    : page ===
                                                                                                                        "contestUsers"
                                                                                                                      ? "Manage Contest Users"
                                                                                                                      : page ===
                                                                                                                          "contestUserDetails"
                                                                                                                        ? "Contest User Details"
                                                                                                                        : page ===
                                                                                                                            "contestSubmissions"
                                                                                                                          ? "Manage Contest Submission"
                                                                                                                          : page ===
                                                                                                                              "contestRules"
                                                                                                                            ? "Contest Rules"
                                                                                                                            : page ===
                                                                                                                                "contestEmails"
                                                                                                                              ? "Manage Contest Email Template"
                                                                                                                              : page ===
                                                                                                                                  "mailingList"
                                                                                                                                ? "Manage Mailing List"
                                                                                                                                : page ===
                                                                                                                                    "addMailingList"
                                                                                                                                  ? "Add Mailing List"
                                                                                                                                  : page ===
                                                                                                                                      "orders"
                                                                                                                                    ? "Manage Product Order"
                                                                                                                                    : page ===
                                                                                                                                        "orderDetail"
                                                                                                                                      ? "Order Details"
                                                                                                                                      : "Manage Banner";
  return (
    <div className="app-shell d-flex">
      <Sidebar
        page={page}
        setPage={setPage}
        onLogout={onLogout}
        onDownloadBookings={onDownloadBookings}
      />
      <main className="admin-content flex-grow-1">
        <Topbar user={user} onLogout={onLogout} />
        <PageHeader
          title={headerTitle || title}
          subtitle={headerSubtitle}
          breadcrumbTitle={breadcrumbTitle || title}
          onHomeClick={() => setPage("dashboard")}
        />
        <section className="main-content container-fluid">{children}</section>
        <footer className="admin-footer">
          {copyrightError
            ? `Unable to load copyright text: ${copyrightError}`
            : copyrightText}
        </footer>
      </main>
    </div>
  );
}
