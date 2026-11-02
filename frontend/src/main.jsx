import React, { Suspense, useEffect, useLayoutEffect } from "react";
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
import "./vendor/lightcase.css";
import "./public.css";
import "./public-legacy.css";
const AdminApp = React.lazy(() => import("./pages/admin/AdminApp"));
const Site = React.lazy(() => import("./pages/Site"));
const Trip = React.lazy(() => import("./pages/Trip"));
const TripType = React.lazy(() => import("./pages/TripType"));
const TourCalendar = React.lazy(() => import("./pages/TourCalendar"));
const StaticPage = React.lazy(() => import("./pages/StaticPage"));
const Category = React.lazy(() => import("./pages/Category"));
const TripLeaderListing = React.lazy(() => import("./pages/TripLeaderListing"));
const TripLeader = React.lazy(() => import("./pages/TripLeader"));
const TripBooking = React.lazy(() => import("./pages/TripBooking"));
const Search = React.lazy(() => import("./pages/Search"));
const Product = React.lazy(() => import("./pages/Product"));
const Cart = React.lazy(() => import("./pages/Cart"));
const Checkout = React.lazy(() => import("./pages/Checkout"));
const CheckoutConfirm = React.lazy(() => import("./pages/CheckoutConfirm"));
const UserRegistration = React.lazy(() => import("./pages/UserRegistration"));
const NotFound = React.lazy(() => import("./pages/NotFound"));
import { localAppLink } from "@/lib/assets";

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
    const isAdminPath = /^\/(?:administrator|admin)(?:\/|$)/.test(pathname);
    for (const id of [
      "public-legacy-stylesheet",
      "public-responsive-stylesheet",
    ]) {
      const stylesheet = document.getElementById(id);
      if (stylesheet instanceof HTMLLinkElement) {
        stylesheet.media = isAdminPath ? "not all" : "all";
      }
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

function PublicRedirectionResolver() {
  const { pathname, search, hash } = useLocation();

  useEffect(() => {
    if (/^\/(?:administrator|admin|api)(?:\/|$)/i.test(pathname)) return;
    let cancelled = false;
    const currentUrl = `${pathname}${search}${hash}`;
    fetch(`/api/public-redirection?path=${encodeURIComponent(pathname)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((redirect) => {
        if (cancelled || !redirect?.new_redirection_url) return;
        const destination = localAppLink(redirect.new_redirection_url);
        if (!destination || destination === currentUrl) return;
        if (/^https?:\/\//i.test(destination)) {
          window.location.replace(destination);
        } else {
          window.history.replaceState({}, "", destination);
          window.dispatchEvent(new PopStateEvent("popstate"));
        }
      })
      .catch((error) => {
        console.error("Unable to resolve public redirect.", error);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname, search, hash]);

  return null;
}

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <ScrollToTop />
    <PublicLegacyStylesheet />
    <PublicRedirectionResolver />
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<Site />} />
        <Route path="/administrator/*" element={<AdminApp />} />
        <Route path="/admin/*" element={<LegacyAdminRedirect />} />
        <Route path="/triptype/:slug" element={<TripType />} />
        <Route path="/trip/:slug/:section" element={<Trip />} />
        <Route path="/trip/:slug" element={<Trip />} />
        <Route path="/tour-calendar" element={<TourCalendar />} />
        <Route path="/staticpage/:slug" element={<StaticPage />} />
        <Route path="/category/:slug" element={<Category />} />
        <Route
          path="/staticpage/guides-and-trip-leaders/"
          element={<TripLeaderListing />}
        />
        <Route path="/tripleader/:slug" element={<TripLeader />} />
        <Route path="/trip/:slug/booking/" element={<TripBooking />} />
        <Route path="/search" element={<Search />} />
        <Route path="/product/:slug" element={<Product />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/user-registration" element={<UserRegistration />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/checkoutconfirm" element={<CheckoutConfirm />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  </BrowserRouter>,
);
