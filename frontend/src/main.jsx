import React, { useEffect, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./vendor/validationEngine.jquery.min.css";
import "./styles.css";
import "./public.css";
import "./public-legacy.css";
import AdminApp from "./pages/AdminApp";
import PublicSite from "./pages/PublicSite";
import PublicTripPage from "./pages/PublicTripPage";
import PublicTripTypePage from "./pages/PublicTripTypePage";
import PublicTourCalendarPage from "./pages/PublicTourCalendarPage";
import PublicStaticPage from "./pages/PublicStaticPage";
import PublicCategoryPage from "./pages/PublicCategoryPage";
import PublicTripLeaderListingPage from "./pages/PublicTripLeaderListingPage";
import PublicTripLeaderPage from "./pages/PublicTripLeaderPage";
import PublicTripBookingPage from "./pages/PublicTripBookingPage";
import PublicSearchPage from "./pages/PublicSearchPage";
import PublicProductPage from "./pages/PublicProductPage";
import PublicCartPage from "./pages/PublicCartPage";
import PublicCheckoutPage from "./pages/PublicCheckoutPage";
import PublicCheckoutConfirmPage from "./pages/PublicCheckoutConfirmPage";
import PublicUserRegistrationPage from "./pages/PublicUserRegistrationPage";
import PublicNotFoundPage from "./pages/PublicNotFoundPage";

function ScrollToTop() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname, search]);

  return null;
}

function PublicLegacyStylesheet() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    const stylesheet = document.getElementById("public-legacy-stylesheet");
    if (stylesheet instanceof HTMLLinkElement) {
      const isAdminPath = /^\/(?:administrator|admin)(?:\/|$)/.test(pathname);
      stylesheet.media = isAdminPath ? "not all" : "all";
    }
  }, [pathname]);

  return null;
}

function LegacyAdminRedirect() {
  const { pathname, search, hash } = useLocation();
  return (
    <Navigate
      replace
      to={`${pathname.replace(/^\/admin(?=\/|$)/, "/administrator")}${search}${hash}`}
    />
  );
}

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <ScrollToTop />
    <PublicLegacyStylesheet />
    <Routes>
      <Route path="/" element={<PublicSite />} />
      <Route path="/administrator/*" element={<AdminApp />} />
      <Route path="/admin/*" element={<LegacyAdminRedirect />} />
      <Route path="/triptype/:slug" element={<PublicTripTypePage />} />
      <Route path="/trip/:slug/:section" element={<PublicTripPage />} />
      <Route path="/trip/:slug" element={<PublicTripPage />} />
      <Route path="/tour-calendar" element={<PublicTourCalendarPage />} />
      <Route path="/staticpage/:slug" element={<PublicStaticPage />} />
      <Route path="/category/:slug" element={<PublicCategoryPage />} />
      <Route
        path="/staticpage/guides-and-trip-leaders/"
        element={<PublicTripLeaderListingPage />}
      />
      <Route path="/tripleader/:slug" element={<PublicTripLeaderPage />} />
      <Route path="/trip/:slug/booking/" element={<PublicTripBookingPage />} />
      <Route path="/search" element={<PublicSearchPage />} />
      <Route path="/product/:slug" element={<PublicProductPage />} />
      <Route path="/cart" element={<PublicCartPage />} />
      <Route path="/user-registration" element={<PublicUserRegistrationPage />} />
      <Route path="/checkout" element={<PublicCheckoutPage />} />
      <Route
        path="/checkoutconfirm"
        element={<PublicCheckoutConfirmPage />}
      />
      <Route path="*" element={<PublicNotFoundPage />} />
    </Routes>
  </BrowserRouter>,
);
