import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import $ from "@/vendor/jqueryValidationEngine";
import PublicLoader from "@/components/public/PublicLoader";
import { localAssetUrl, thumbnailAssetUrl } from "@/lib/assets";
import { RECAPTCHA_SITE_KEY } from "@/lib/recaptcha";
import { submitCallbackForm, submitNewsletterForm } from "@/lib/publicForms";

const desktopLogoUrl = thumbnailAssetUrl(
  "1_1625721414_1_1625662529_1_1518177529_logo.png",
  285,
  60,
);

function isNavigationTree(value) {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item.key === "string" &&
        typeof item.label === "string" &&
        typeof item.href === "string" &&
        isNavigationTree(item.children),
    )
  );
}

function resetCaptcha(form) {
  const captcha = form.querySelector(".g-recaptcha");
  const widgetId = captcha?.dataset.widgetId;
  if (widgetId !== undefined) window.grecaptcha?.reset?.(Number(widgetId));
}

export default function PublicHeader() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [modal, setModal] = useState("");
  const [compact, setCompact] = useState(false);
  const [openDropdown, setOpenDropdown] = useState("");
  const [navigationItems, setNavigationItems] = useState([]);
  const [navigationState, setNavigationState] = useState({
    status: "loading",
    error: "",
  });
  const [navigationRetry, setNavigationRetry] = useState(0);
  const [finderOptions, setFinderOptions] = useState({
    locations: [],
    activities: [],
  });
  const [finderSelections, setFinderSelections] = useState({
    locations: searchParams
      .getAll("trips_location_id[]")
      .filter((value) => value !== ""),
    activities: searchParams
      .getAll("activity_id[]")
      .filter((value) => value !== ""),
  });
  const [finderAllSelections, setFinderAllSelections] = useState({
    locations: searchParams.getAll("trips_location_id[]").includes(""),
    activities: searchParams.getAll("activity_id[]").includes(""),
  });
  const [finderMonth, setFinderMonth] = useState(
    searchParams.get("trips_month") || "",
  );
  const [finderState, setFinderState] = useState({ status: "idle", error: "" });
  const [finderRetry, setFinderRetry] = useState(0);
  const [formState, setFormState] = useState({
    busy: false,
    message: "",
    error: "",
  });
  const formRequestId = useRef(0);

  async function submitForm(event, submit, onSuccess) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!$(form).validationEngine("validate")) return;
    const requestId = ++formRequestId.current;
    setFormState({ busy: true, message: "", error: "" });
    try {
      const result = await submit(form);
      if (requestId !== formRequestId.current) return;
      if (onSuccess) {
        onSuccess(result);
        return;
      }
      form.reset();
      resetCaptcha(form);
      setFormState({
        busy: false,
        message: result.message || "Thank you. Your request was received.",
        error: "",
      });
    } catch (error) {
      if (requestId !== formRequestId.current) return;
      resetCaptcha(form);
      setFormState({ busy: false, message: "", error: error.message });
    }
  }

  useEffect(() => {
    const handleScroll = () => setCompact(window.scrollY > 40);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setNavigationState({ status: "loading", error: "" });
    fetch("/api/public-navigation")
      .then((response) => {
        if (!response.ok) {
          return response
            .json()
            .catch(() => ({}))
            .then((body) => {
              throw new Error(
                body.message ||
                  `Unable to load the navigation (${response.status}).`,
              );
            });
        }
        if (!response.headers.get("content-type")?.includes("application/json"))
          throw new Error(
            "The navigation API returned HTML instead of JSON. Restart the backend and try again.",
          );
        return response.json();
      })
      .then((items) => {
        if (!isNavigationTree(items))
          throw new Error("Navigation was returned in an unexpected format.");
        if (cancelled) return;
        setNavigationItems(items);
        setNavigationState({ status: "ready", error: "" });
      })
      .catch((error) => {
        if (!cancelled) {
          setNavigationState({
            status: "error",
            error: error.message || "Unable to load the navigation.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [navigationRetry]);

  useEffect(() => {
    if (!modal) return undefined;
    formRequestId.current += 1;
    setFormState({ busy: false, message: "", error: "" });
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setModal("");
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modal]);

  useEffect(() => {
    if (
      import.meta.env.VITE_ENABLE_RECAPTCHA === "false" ||
      !["callback", "newsletter"].includes(modal)
    )
      return undefined;

    const renderCaptcha = () => {
      if (!window.grecaptcha?.render) return false;
      document
        .querySelectorAll(".client-modal .g-recaptcha")
        .forEach((element) => {
          if (!element.querySelector("iframe") && !element.dataset.rendered) {
            const widgetId = window.grecaptcha.render(element, {
              sitekey: element.dataset.sitekey,
            });
            element.dataset.widgetId = String(widgetId);
            element.dataset.rendered = "true";
          }
        });
      return true;
    };

    if (renderCaptcha()) return undefined;
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (renderCaptcha() || attempts >= 100) window.clearInterval(timer);
    }, 100);
    if (!document.querySelector('script[data-recaptcha="google"]')) {
      const script = document.createElement("script");
      script.src = "https://www.google.com/recaptcha/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.dataset.recaptcha = "google";
      document.head.appendChild(script);
    }
    return () => window.clearInterval(timer);
  }, [modal]);

  useEffect(() => {
    if (!["callback", "newsletter"].includes(modal)) return undefined;
    const form = document.querySelector(".client-modal form");
    if (!form) return undefined;
    const $form = $(form);
    $form.validationEngine("attach", { promptPosition: "topLeft" });
    return () => {
      $form.validationEngine("hideAll");
      $form.validationEngine("detach");
    };
  }, [modal]);

  useEffect(() => {
    if (modal !== "trip-finder") return undefined;
    let cancelled = false;
    setFinderState({ status: "loading", error: "" });
    fetch("/api/public-trip-filters")
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load trip options.");
        return response.json();
      })
      .then(({ locations, activities }) => {
        if (!Array.isArray(locations) || !Array.isArray(activities))
          throw new Error(
            "Trip options were returned in an unexpected format.",
          );
        if (cancelled) return;
        setFinderOptions({ locations, activities });
        setFinderState({ status: "ready", error: "" });
      })
      .catch(() => {
        if (!cancelled) {
          setFinderState({
            status: "error",
            error: "Trip options couldn't be loaded. Please try again.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [modal, finderRetry]);

  return (
    <>
      {navigationState.status === "loading" && <PublicLoader />}
      <header
        id="header"
        className={`fixed client-header ${compact ? "is-compact" : ""}`}
      >
        <div className="header clearfix visible-xs visible-sm client-mobile-bar">
          <button
            className={`mob-navicon client-menu-toggle ${mobileMenuOpen ? "open" : ""}`}
            type="button"
            aria-label="Toggle menu"
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            <span />
            <span />
            <span />
          </button>
          <Link className="mob-logo client-mobile-logo" to="/">
            <img src={localAssetUrl("logo-mob.png")} alt="Alpenwild" />
          </Link>
          <button
            id="mob-search"
            className="fa fa-search mob-search client-mobile-search"
            type="button"
            aria-label="Toggle search"
            onClick={() => setMobileSearchOpen((open) => !open)}
          >
            <i className="fa fa-search" />
          </button>
          <span
            className="fa fa-phone mob-phone client-mobile-phone"
            aria-label="Call Alpenwild"
          />
        </div>
        {mobileSearchOpen && (
          <div className="clearfix" id="mob-search_box">
            <form
              className="search_box"
              onSubmit={(event) => {
                event.preventDefault();
                const value = new FormData(event.currentTarget).get("stse");
                if (String(value || "").trim())
                  navigate(`/search?stse=${encodeURIComponent(value)}`);
              }}
            >
              <input
                name="stse"
                type="text"
                placeholder="Enter Your Search"
                autoFocus
              />
              <button type="submit" aria-label="Submit search"></button>
            </form>
          </div>
        )}
        <div className="header_top hidden-xs hidden-sm">
          <div className="container">
            <div className="navbar client-header-main" role="navigation">
              <div className="navbar-header">
                <div className="logo client-logo">
                  <Link to="/">
                    <img src={desktopLogoUrl} alt="Alpenwild" />
                  </Link>
                </div>
              </div>
              <div className="col-xs-12 col-sm-7 col-md-8 header_right">
                <div className="row">
                  <div className="header_right_top client-header-tools">
                    <div className="header_top_nav">
                      <nav aria-label="Header actions">
                        <ul>
                          <li>
                            <a
                              href="#trip-finder"
                              onClick={(event) => {
                                event.preventDefault();
                                setModal("trip-finder");
                              }}
                            >
                              Trip Finder
                            </a>
                          </li>
                          <li>
                            <a
                              href="#newsletter"
                              onClick={(event) => {
                                event.preventDefault();
                                setModal("newsletter");
                              }}
                            >
                              Newsletter Signup
                            </a>
                          </li>
                          <li>
                            <a
                              href="#request-call"
                              onClick={(event) => {
                                event.preventDefault();
                                setModal("callback");
                              }}
                            >
                              Request a Call
                            </a>
                          </li>
                        </ul>
                      </nav>
                    </div>
                    <span className="header_right_phone client-phone">
                      &nbsp;
                    </span>
                    <div className="header_right_search">
                      <form
                        className="search_box"
                        onSubmit={(event) => {
                          event.preventDefault();
                          const value = new FormData(event.currentTarget).get(
                            "stse",
                          );
                          if (String(value || "").trim()) {
                            navigate(
                              `/search?stse=${encodeURIComponent(String(value).trim())}`,
                            );
                          }
                        }}
                      >
                        <input
                          name="stse"
                          type="text"
                          placeholder="Enter Your Search"
                        />
                        {/* <button
                          type="submit"
                          className="search"
                          aria-label="Submit search"
                        ></button> */}
                        <input type="submit" value="" />
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="navwrap">
          <div className="container">
            <div className="col-xs-12">
              <div className="row">
                <div id="mainnav" className="main_nav">
                  <nav aria-label="Main navigation">
                    <ul
                      className={`client-nav ${mobileMenuOpen ? "mobile-open" : ""}`}
                    >
                      {navigationState.status === "error" && (
                        <li className="alert alert-danger" role="alert">
                          Navigation couldn&apos;t be loaded.{" "}
                          {navigationState.error}{" "}
                          <button
                            type="button"
                            onClick={() =>
                              setNavigationRetry((retry) => retry + 1)
                            }
                          >
                            Retry
                          </button>
                        </li>
                      )}
                      {navigationState.status === "ready" &&
                        navigationItems.length === 0 && (
                          <li>No menu available.</li>
                        )}
                      {navigationItems.map((item) => {
                        const { key: itemKey, ...itemProps } = item;
                        return (
                          <NavItem
                            key={itemKey}
                            {...itemProps}
                            itemKey={itemKey}
                            openDropdown={openDropdown}
                            setOpenDropdown={setOpenDropdown}
                          />
                        );
                      })}
                    </ul>
                  </nav>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>
      {modal && (
        <div className="client-modal-backdrop" onClick={() => setModal("")}>
          <div
            className="client-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="client-modal-close"
              type="button"
              aria-label="Close"
              onClick={() => setModal("")}
            >
              <i className="fa fa-times-circle-o" aria-hidden="true" />
            </button>
            {modal === "trip-finder" ? (
              <form
                className="client-header-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const values = new FormData(event.currentTarget);
                  const params = new URLSearchParams();
                  values.getAll("trips_location_id[]").forEach((value) => {
                    params.append("trips_location_id[]", value);
                  });
                  values.getAll("activity_id[]").forEach((value) => {
                    params.append("activity_id[]", value);
                  });
                  const month = values.get("trips_month");
                  if (month) params.set("trips_month", month);
                  navigate(`/search?${params.toString()}`);
                  setModal("");
                }}
              >
                <div className="form_holder clearfix">
                  <label htmlFor="finder-location">
                    Choose Locations <sup>*</sup>
                  </label>
                  <FinderMultiSelect
                    id="finder-location"
                    name="trips_location_id[]"
                    placeholder="Choose Locations"
                    allLabel="All Locations"
                    options={finderOptions.locations}
                    selected={finderSelections.locations}
                    onSelectedChange={(selected) =>
                      setFinderSelections((current) => ({
                        ...current,
                        locations: selected,
                      }))
                    }
                    allSelected={finderAllSelections.locations}
                    onAllSelectedChange={(allSelected) =>
                      setFinderAllSelections((current) => ({
                        ...current,
                        locations: allSelected,
                      }))
                    }
                  />
                </div>
                <div className="form_holder clearfix">
                  <label htmlFor="finder-activity">
                    Choose Activities <sup>*</sup>
                  </label>
                  <FinderMultiSelect
                    id="finder-activity"
                    name="activity_id[]"
                    placeholder="Choose Activities"
                    allLabel="All Activities"
                    options={finderOptions.activities}
                    selected={finderSelections.activities}
                    onSelectedChange={(selected) =>
                      setFinderSelections((current) => ({
                        ...current,
                        activities: selected,
                      }))
                    }
                    allSelected={finderAllSelections.activities}
                    onAllSelectedChange={(allSelected) =>
                      setFinderAllSelections((current) => ({
                        ...current,
                        activities: allSelected,
                      }))
                    }
                  />
                </div>
                <div className="form_holder clearfix">
                  <label htmlFor="finder-month">
                    Choose Date <sup>*</sup>
                  </label>
                  <select
                    id="finder-month"
                    name="trips_month"
                    value={finderMonth}
                    onChange={(event) => setFinderMonth(event.target.value)}
                  >
                    <option value="">All Dates</option>
                    {Array.from({ length: 12 }, (_, index) => {
                      const month = String(index + 1).padStart(2, "0");
                      return (
                        <option key={month} value={month}>
                          {new Date(2000, index, 1).toLocaleString("en-US", {
                            month: "long",
                          })}
                        </option>
                      );
                    })}
                  </select>
                </div>
                {finderState.status === "loading" && (
                  <p className="client-form-status" role="status">
                    Loading trip options...
                  </p>
                )}
                {finderState.status === "error" && (
                  <p className="client-form-error" role="alert">
                    {finderState.error}{" "}
                    <button
                      type="button"
                      className="client-form-retry"
                      onClick={() => setFinderRetry((attempt) => attempt + 1)}
                    >
                      Try again
                    </button>
                  </p>
                )}
                <div className="form_holder clearfix client-header-form-submit">
                  <button
                    type="submit"
                    disabled={finderState.status !== "ready"}
                  >
                    Find My Trip
                  </button>
                </div>
              </form>
            ) : modal === "newsletter" ? (
              <form
                className="client-header-form"
                noValidate
                onSubmit={(event) =>
                  submitForm(event, submitNewsletterForm, () => {
                    setModal("");
                    navigate("/staticpage/thank-you-for-subscribing/");
                  })
                }
              >
                <div className="form_holder clearfix">
                  <label htmlFor="newsletter-first-name">
                    First Name <sup>*</sup>
                  </label>
                  <input
                    id="newsletter-first-name"
                    name="first_name"
                    type="text"
                    data-validation-engine="validate[required]"
                  />
                </div>
                <div className="form_holder clearfix">
                  <label htmlFor="newsletter-last-name">
                    Last Name <sup>*</sup>
                  </label>
                  <input
                    id="newsletter-last-name"
                    name="last_name"
                    type="text"
                    data-validation-engine="validate[required]"
                  />
                </div>
                <div className="form_holder clearfix">
                  <label htmlFor="newsletter-email">
                    Email Address <sup>*</sup>
                  </label>
                  <input
                    id="newsletter-email"
                    name="email_address"
                    type="email"
                    data-validation-engine="validate[required,custom[email]]"
                  />
                </div>
                <div className="form_holder clearfix client-newsletter-interests">
                  <label>
                    <strong>Interests</strong>
                  </label>
                  {[
                    [
                      "news_signup1",
                      "Interests – Hiking and trekking",
                      "Hiking and trekking",
                    ],
                    [
                      "news_signup2",
                      "Interests – Cultural and gourmet",
                      "Cultural and gourmet",
                    ],
                    [
                      "news_signup3",
                      "Interests – Ski and winter",
                      "Ski and winter",
                    ],
                  ].map(([name, value, label]) => (
                    <div className="checkbox" key={name}>
                      <input type="checkbox" name={name} value={value} id={name} />{" "}
                      <label htmlFor={name}>{label}</label>
                    </div>
                  ))}
                </div>
                <input type="hidden" name="form_id" value="" />
                {import.meta.env.VITE_ENABLE_RECAPTCHA !== "false" && (
                  <div className="form_holder clearfix">
                    <div
                      className="g-recaptcha"
                      data-sitekey={RECAPTCHA_SITE_KEY}
                    />
                  </div>
                )}
                <div className="form_holder clearfix client-header-form-submit">
                  {formState.error && (
                    <p className="client-form-error" role="alert">
                      {formState.error}
                    </p>
                  )}
                  {formState.message && (
                    <p className="client-form-success" role="status">
                      {formState.message}
                    </p>
                  )}
                  <p>
                    See our{" "}
                    <Link
                      to="/staticpage/privacy-policy/"
                      onClick={() => setModal("")}
                    >
                      Privacy Policy
                    </Link>
                    .
                  </p>
                  <button
                    type="submit"
                    name="button"
                    value="Submit"
                    disabled={formState.busy}
                  >
                    {formState.busy ? "Submitting..." : "Submit"}
                  </button>
                </div>
              </form>
            ) : modal === "callback" ? (
              <form
                className="client-callback-form"
                noValidate
                onSubmit={(event) =>
                  submitForm(event, submitCallbackForm, () => {
                    setModal("");
                    navigate("/staticpage/thank-you-for-call-me-back-request/");
                  })
                }
              >
                <input type="hidden" name="contactformsubmit" value="Yes" />
                <div className="client-callback-field form_holder">
                  <label htmlFor="callback-name">
                    Name <sup>*</sup>
                  </label>
                  <input
                    id="callback-name"
                    name="first_name"
                    type="text"
                    data-validation-engine="validate[required]"
                  />
                </div>
                <div className="client-callback-field form_holder">
                  <label htmlFor="callback-email">
                    Email <sup>*</sup>
                  </label>
                  <input
                    id="callback-email"
                    name="email"
                    type="email"
                    data-validation-engine="validate[required,custom[email]]"
                  />
                </div>
                <div className="client-callback-field form_holder">
                  <label htmlFor="callback-phone">
                    Phone Number <sup>*</sup>
                  </label>
                  <input
                    id="callback-phone"
                    name="phone_number"
                    type="text"
                    data-validation-engine="validate[required]"
                  />
                </div>
                <div className="client-callback-field form_holder">
                  <label htmlFor="callback-time">
                    Best time to call (indicate your time zone) <sup>*</sup>
                  </label>
                  <input
                    id="callback-time"
                    name="best_time"
                    type="text"
                    data-validation-engine="validate[required]"
                  />
                </div>
                <div className="client-callback-field form_holder">
                  <label htmlFor="callback-comments">
                    Questions or Comments <sup>*</sup>
                  </label>
                  <textarea
                    id="callback-comments"
                    name="question_comments"
                    data-validation-engine="validate[required]"
                  />
                </div>
                <input
                  className="client-callback-trap"
                  name="customer_name"
                  type="text"
                  autoComplete="off"
                  tabIndex="-1"
                />
                {import.meta.env.VITE_ENABLE_RECAPTCHA !== "false" && (
                  <div className="client-callback-field form_holder">
                    <div
                      className="g-recaptcha"
                      data-sitekey={RECAPTCHA_SITE_KEY}
                    />
                  </div>
                )}
                <div className="client-callback-field client-callback-submit">
                  {formState.error && (
                    <p className="client-form-error" role="alert">
                      {formState.error}
                    </p>
                  )}
                  {formState.message && (
                    <p className="client-form-success" role="status">
                      {formState.message}
                    </p>
                  )}
                  <button type="submit" disabled={formState.busy}>
                    {formState.busy ? "Submitting..." : "Call Me Back"}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <h2>
                  {modal === "trip-finder"
                    ? "Find Your Trip"
                    : "Newsletter Signup"}
                </h2>
                <p>
                  {modal === "trip-finder"
                    ? "Tell us what kind of adventure you are looking for."
                    : "Please continue to the Alpenwild form to complete your request."}
                </p>
                <Link
                  className="client-button"
                  to={
                    modal === "newsletter"
                      ? "/#newsletter"
                      : "/staticpage/contact-us/"
                  }
                  onClick={() => setModal("")}
                >
                  Continue
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function FinderMultiSelect({
  id,
  name,
  placeholder,
  allLabel,
  options,
  selected,
  onSelectedChange,
  allSelected,
  onAllSelectedChange,
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const close = (event) => {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const toggle = (value) => {
    onAllSelectedChange(false);
    onSelectedChange(
      selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value],
    );
  };
  const selectedNames = options
    .filter((option) => selected.includes(String(option.id)))
    .map((option) => option.name);

  return (
    <div
      className={`client-finder-select btn-group ${open ? "is-open" : ""}`}
      ref={wrapperRef}
    >
      <button
        id={id}
        className="client-finder-select-control"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>
          {allSelected
            ? allLabel
            : selectedNames.length
              ? selectedNames.join(", ")
              : placeholder}
        </span>
        {/* <i className="fa fa-caret-down" aria-hidden="true" /> */}
        <b className="caret"></b>
      </button>
      <div
        className="client-finder-options"
        role="listbox"
        aria-label={placeholder}
      >
        <label className="client-finder-option client-finder-all">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(event) => {
              onSelectedChange([]);
              onAllSelectedChange(event.target.checked);
            }}
          />
          <span>{allLabel}</span>
        </label>
        {options.map((option) => {
          const value = String(option.id);
          return (
            <label className="client-finder-option" key={value}>
              <input
                type="checkbox"
                name={name}
                value={value}
                checked={selected.includes(value)}
                onChange={() => toggle(value)}
              />
              <span>{option.name}</span>
            </label>
          );
        })}
      </div>
      {allSelected && <input type="hidden" name={name} value="" />}
    </div>
  );
}

function NavItem({
  label,
  href,
  children,
  itemKey,
  openDropdown,
  setOpenDropdown,
  depth = 0,
}) {
  const hasChildren = children?.length > 0;
  const isOpen = openDropdown === itemKey;
  const positionNestedDropdown = (event) => {
    if (
      !depth ||
      !hasChildren ||
      window.matchMedia("(max-width: 991px)").matches
    )
      return;

    const item = event.currentTarget;
    const dropdown = item.querySelector(":scope > .client-dropdown");
    if (!dropdown) return;

    const itemRect = item.getBoundingClientRect();
    const width = dropdown.getBoundingClientRect().width || 300;
    const gap = 8;
    const height =
      dropdown.getBoundingClientRect().height || dropdown.scrollHeight;
    const left =
      itemRect.right + width <= window.innerWidth - gap
        ? itemRect.right
        : Math.max(gap, itemRect.left - width);
    const top = Math.max(
      gap,
      Math.min(itemRect.top, window.innerHeight - height - gap),
    );
    dropdown.style.left = `${left}px`;
    dropdown.style.top = `${top}px`;
  };

  return (
    <li
      className={`client-nav-item ${depth ? "client-nav-nested-item" : ""} ${hasChildren ? "has-dropdown has-sub" : ""} ${isOpen ? "open" : ""}`}
      onMouseEnter={positionNestedDropdown}
    >
      {href.startsWith("/") ? (
        <Link
          to={href}
          onClick={(event) => {
            if (!hasChildren || !event.target.closest(".nav-chevron")) return;
            event.preventDefault();
            setOpenDropdown(isOpen ? "" : itemKey);
          }}
        >
          {label}
          {hasChildren && (
            <span
              className={`nav-chevron ${depth ? "submenuIcon" : ""}`}
              aria-hidden="true"
            />
          )}
        </Link>
      ) : (
        <a
          href={href}
          onClick={(event) => {
            if (href === "#") event.preventDefault();
            if (!hasChildren || !event.target.closest(".nav-chevron")) return;
            event.preventDefault();
            setOpenDropdown(isOpen ? "" : itemKey);
          }}
        >
          {label}
          {hasChildren && (
            <span
              className={`nav-chevron ${depth ? "submenuIcon" : ""}`}
              aria-hidden="true"
            />
          )}
        </a>
      )}
      {hasChildren && (
        <ul
          className={`client-dropdown ${depth ? "client-dropdown-nested" : ""}`}
        >
          {children.map((child) => {
            const { key: childKey, ...childProps } = child;
            return (
              <NavItem
                key={childKey}
                {...childProps}
                itemKey={childKey}
                openDropdown={openDropdown}
                setOpenDropdown={setOpenDropdown}
                depth={depth + 1}
              />
            );
          })}
        </ul>
      )}
    </li>
  );
}

// const menuItem = (key, label, path, children) => ({
//   key,
//   label,
//   href:
//     path === "#"
//       ? "#"
//       : path === "tour-calendar/" ||
//           path.startsWith("staticpage/") ||
//           path.startsWith("triptype/") ||
//           path.startsWith("trip/")
//         ? `/${path}`
//         : `/staticpage/${path.replace(/^\/+|\/+$/g, "")}/`,
//   children,
// });

// const navigationItems = [
//   menuItem("trips", "Trips", "#", [
//     menuItem("trips-hike", "Hike", "triptype/hiking-tours/", [
//       menuItem("trips-hike-provence", "Provence", "trip/provence/overview/"),
//       menuItem(
//         "trips-hike-crete",
//         "Crete Sea to Summit",
//         "trip/crete/overview/",
//       ),
//       menuItem(
//         "trips-hike-swiss",
//         "Best of the Swiss Alps",
//         "trip/best-of-the-swiss-alps/overview/",
//       ),
//       menuItem(
//         "trips-hike-jungfrau",
//         "Exploring The Jungfrau",
//         "trip/exploring-the-jungfrau/overview/",
//       ),
//       menuItem(
//         "trips-hike-dolomites",
//         "Italian Dolomites",
//         "trip/italian-dolomites/overview/",
//       ),
//       menuItem(
//         "trips-hike-french",
//         "Best of the French Alps",
//         "trip/best-of-the-french-alps/overview/",
//       ),
//       menuItem(
//         "trips-hike-croatia",
//         "Exploring Croatia",
//         "trip/exploring-croatia/overview/",
//       ),
//       menuItem(
//         "trips-hike-lakes",
//         "Italian Lakes Discovery",
//         "trip/italian-lakes/overview/",
//       ),
//       menuItem(
//         "trips-hike-slovenia",
//         "Best of Slovenia and the Julian Alps",
//         "trip/best-of-slovenia-and-the-julian-alps/overview/",
//       ),
//     ]),
//     menuItem("trips-trek", "Trek", "triptype/trekking-tours/", [
//       menuItem(
//         "trips-trek-norway",
//         "The Long Crossing of Norway",
//         "trip/norway-long-crossing/overview/",
//       ),
//       menuItem(
//         "trips-trek-tyrol",
//         "Tyrolean Traverse",
//         "trip/tyrolean-traverse/overview/",
//       ),
//       menuItem(
//         "trips-trek-giants",
//         "Tour of the Giants",
//         "trip/tour-of-the-giants/overview/",
//       ),
//       menuItem(
//         "trips-trek-alta-via",
//         "Alta Via 1 - Italian Dolomites",
//         "trip/alta-via-1/overview/",
//       ),
//       menuItem(
//         "trips-trek-haute-route",
//         "Chamonix-Zermatt Haute Route",
//         "trip/chamonix-zermatt-haute-route/overview/",
//       ),
//       menuItem(
//         "trips-trek-deluxe-haute",
//         "Deluxe Haute Route",
//         "trip/deluxe-haute-route/overview/",
//       ),
//       menuItem(
//         "trips-trek-tmb",
//         "Deluxe Tour du Mont Blanc",
//         "trip/tour-du-mont-blanc/overview/",
//       ),
//       menuItem(
//         "trips-trek-via-alpina",
//         "Via Alpina - Swiss Alpine Route",
//         "trip/via-alpina/overview/",
//       ),
//       menuItem(
//         "trips-trek-oberland",
//         "Bernese Oberland Traverse",
//         "trip/bernese-oberland-traverse/overview/",
//       ),
//       menuItem(
//         "trips-trek-st-moritz",
//         "St Moritz to Italy",
//         "trip/st-moritz-to-italy/overview/",
//       ),
//       menuItem(
//         "trips-trek-england",
//         "England Coast to Coast",
//         "trip/england-coast-to-coast/overview/",
//       ),
//       menuItem(
//         "trips-trek-women-tmb",
//         "Women Only Deluxe Tour du Mont Blanc",
//         "trip/womens-only-deluxe-tour-du-mont-blanc/overview/",
//       ),
//       menuItem(
//         "trips-trek-women-alpina",
//         "Women Only-Swiss Via Alpina",
//         "trip/women-only-via-alpina/overview/",
//       ),
//     ]),
//     menuItem("trips-rail", "Rail and Sightseeing", "triptype/rail-tours/", [
//       menuItem(
//         "trips-rail-scenic",
//         "Scenic Alps by Rail",
//         "trip/scenic-alps-by-rail/overview/",
//       ),
//       menuItem(
//         "trips-rail-track-2",
//         "Scenic Alps by Rail - Track 2",
//         "trip/scenic-alps-by-rail-track-2/overview/",
//       ),
//       menuItem(
//         "trips-rail-cheese",
//         "Cheese, Chocolate, & the Alps",
//         "trip/cheese-chocolate-the-alps/overview/",
//       ),
//       menuItem(
//         "trips-rail-christmas",
//         "Christmas in Switzerland",
//         "trip/christmas-in-switzerland/overview/",
//       ),
//       menuItem(
//         "trips-rail-christmas-edition",
//         "Scenic Alps by Rail - Christmas Edition",
//         "trip/scenic-alps-by-rail-christmas-edition/overview/",
//       ),
//       menuItem(
//         "trips-rail-self-guided",
//         "Self-Guided - Scenic Alps by Rail",
//         "trip/self-guided-scenic-alps-by-rail/overview/",
//       ),
//       menuItem(
//         "trips-rail-glacier",
//         "Self-Guided- Glacier Express",
//         "trip/self-guided-glacier-express/overview/",
//       ),
//     ]),
//     menuItem(
//       "trips-self-guided",
//       "Self-Guided Tours",
//       "triptype/self-guided-tours/",
//       [
//         menuItem(
//           "trips-self-guided-st-moritz",
//           "Self-Guided St. Moritz to Italy",
//           "trip/self-guided-st-moritz-to-italy/overview/",
//         ),
//         menuItem(
//           "trips-self-guided-haute",
//           "Self-Guided Haute Route",
//           "trip/self-guided-haute-route/overview/",
//         ),
//         menuItem(
//           "trips-self-guided-tmb",
//           "Self-Guided Tour du Mont Blanc",
//           "trip/self-guided-tour-du-mont-blanc/overview/",
//         ),
//         menuItem(
//           "trips-self-guided-jungfrau",
//           "Self-Guided Jungfrau",
//           "trip/self-guided-jungfrau/overview/",
//         ),
//         menuItem(
//           "trips-self-guided-swiss",
//           "Self-Guided Best of Swiss Alps",
//           "trip/self-guided-best-of-swiss-alps/overview/",
//         ),
//         menuItem(
//           "trips-self-guided-via-alpina",
//           "Self-Guided Via Alpina",
//           "trip/self-guided-via-alpina/overview/",
//         ),
//         menuItem(
//           "trips-self-guided-oberland",
//           "Self-Guided Bernese Oberland Traverse",
//           "trip/self-guided-bernese-oberland-traverse/overview/",
//         ),
//         menuItem(
//           "trips-self-guided-eiger",
//           "Self-Guided Eiger to Matterhorn",
//           "trip/eiger-to-the-matterhorn/gallery/#overview",
//         ),
//         menuItem(
//           "trips-self-guided-austria",
//           "Self-Guided Austria Zillertal Alps",
//           "trip/self-guided-austria-zillertal-alps/overview/",
//         ),
//       ],
//     ),
//     menuItem(
//       "trips-custom",
//       "Custom and Guided Tours",
//       "triptype/custom-and-guided-tours/",
//       [
//         menuItem(
//           "trips-custom-private",
//           "Private Guided and Custom Trips",
//           "trip/private-guided-trips/overview/",
//         ),
//       ],
//     ),
//     menuItem(
//       "trips-addons",
//       "Tour Add-Ons & Getaways",
//       "triptype/tour-add-ons-getaways/",
//       [
//         menuItem(
//           "trips-addons-lucerne",
//           "Lucerne Getaway",
//           "trip/lucerne-getaway/overview/",
//         ),
//         menuItem(
//           "trips-addons-liechtenstein",
//           "Liechtenstein Getaway",
//           "trip/liechtenstein-getaway/overview/",
//         ),
//         menuItem(
//           "trips-addons-leukerbad",
//           "Leukerbad Getaway",
//           "trip/leukerbad-getaway/overview/",
//         ),
//         menuItem(
//           "trips-addons-saas-fee",
//           "Saas-Fee Getaway",
//           "trip/saas-fee-getaway/overview/",
//         ),
//         menuItem(
//           "trips-addons-zermatt",
//           "Zermatt Getaway",
//           "trip/zermatt-and-the-matterhorn-getaway/overview/",
//         ),
//         menuItem(
//           "trips-addons-appenzell",
//           "Appenzell Getaway",
//           "trip/appenzell-getaway/overview/",
//         ),
//         menuItem(
//           "trips-addons-annecy",
//           "Annecy Add-On",
//           "trip/annecy-getaway/overview/",
//         ),
//         menuItem(
//           "trips-addons-venice",
//           "Venice Add-On",
//           "trip/venice-getaway/overview/",
//         ),
//         menuItem(
//           "trips-addons-milan",
//           "Milan Add-On",
//           "trip/milan-getaway/overview/",
//         ),
//         menuItem(
//           "trips-addons-paris",
//           "Paris Add-On",
//           "trip/paris-add-on/overview/",
//         ),
//       ],
//     ),
//     menuItem("trips-winter", "Winter Tours", "triptype/winter-tours/", [
//       menuItem(
//         "trips-winter-yellowstone",
//         "Nordic Yellowstone",
//         "trip/nordic-ski-journey-grand-teton-yellowstone/overview/",
//       ),
//     ]),
//   ]),
//   menuItem("calendar", "Tour Calendar", "tour-calendar/"),
//   menuItem("about-tours", "About Our Tours", "#", [
//     menuItem("about-tours-stay", "Where We Stay", "staticpage/where-we-stay/"),
//     menuItem(
//       "about-tours-travel",
//       "How We Travel",
//       "staticpage/how-we-travel/",
//     ),
//     menuItem("about-tours-guided-faq", "FAQ Guided Tours", "#", [
//       menuItem(
//         "about-tours-guided-experience",
//         "FAQ – Alpenwild Experience",
//         "staticpage/faq-alpenwild-experience/",
//       ),
//       menuItem(
//         "about-tours-guided-tmb",
//         "FAQ - Tour du Mont Blanc",
//         "staticpage/tour-du-mont-blanc-faq/",
//       ),
//       menuItem(
//         "about-tours-guided-haute",
//         "FAQ - Haute Route",
//         "staticpage/haute-route-faq/",
//       ),
//     ]),
//     menuItem("about-tours-self-faq", "FAQ Self-Guided Tours", "#", [
//       menuItem(
//         "about-tours-self-haute",
//         "Self-Guided FAQ - Haute Route",
//         "staticpage/self-guided-haute-route-faq/",
//       ),
//       menuItem(
//         "about-tours-self-tmb",
//         "Self-Guided FAQ - Tour du Mont Blanc",
//         "staticpage/self-guided-tour-du-mont-blanc-faq/",
//       ),
//     ]),
//     menuItem(
//       "about-tours-agents",
//       "Travel Agents + Alpenwild",
//       "staticpage/travel-agents-alpenwild/",
//     ),
//     menuItem(
//       "about-tours-alps",
//       "Why You'll Love The Alps",
//       "staticpage/why-youll-love-the-alps/",
//     ),
//   ]),
//   menuItem("plan", "Plan a Trip", "#", [
//     menuItem("plan-packing", "Packing Lists", "#", [
//       menuItem(
//         "plan-packing-trekking",
//         "Packing List – Alps Trekking Tours",
//         "staticpage/packing-list-alps-trekking-tours/",
//       ),
//       menuItem(
//         "plan-packing-hiking",
//         "Packing List – Alps Hiking Tours",
//         "staticpage/alps-hiking-packing-list/",
//       ),
//       menuItem(
//         "plan-packing-walking",
//         "Packing List – Alps Walking and Sightseeing Tours",
//         "staticpage/packing-list-alps-walking-and-sightseeing-tours/",
//       ),
//       menuItem(
//         "plan-packing-winter",
//         "Packing List - Winter Tours- Christmas in Switzerland",
//         "staticpage/packing-list-winter-tours-christmas-in-switzerland/",
//       ),
//     ]),
//     menuItem(
//       "plan-weather",
//       "Weather In The Alps",
//       "staticpage/weather-in-the-alps/",
//     ),
//     menuItem(
//       "plan-haute-route",
//       "Haute Route Essentials",
//       "staticpage/haute-route-essentials/",
//     ),
//     menuItem(
//       "plan-tmb",
//       "Tour du Mont Blanc Essentials",
//       "staticpage/tour-du-mont-blanc-essentials/",
//     ),
//     menuItem(
//       "plan-self-guided",
//       "Is a Self-Guided Trip for me?",
//       "staticpage/is-a-self-guided-trip-for-me/",
//     ),
//     menuItem(
//       "plan-car",
//       "Car Travel in Switzerland",
//       "staticpage/car-travel-in-switzerland/",
//     ),
//     menuItem(
//       "plan-maps",
//       "Maps & Books",
//       "staticpage/maps-books-for-your-switzerland-adventure/",
//     ),
//   ]),
//   menuItem("book", "Book a Trip", "#", [
//     menuItem("book-trip", "Book Your Trip", "staticpage/book-your-trip/"),
//     menuItem("book-payment", "Make a Payment", "staticpage/make-a-payment/"),
//   ]),
//   menuItem("about", "About Us", "#", [
//     menuItem(
//       "about-sustainability",
//       "Sustainability Commitment",
//       "staticpage/sustainability-commitment/",
//     ),
//     menuItem(
//       "about-why",
//       "Why Choose Alpenwild",
//       "staticpage/why-choose-alpenwild/",
//     ),
//     menuItem(
//       "about-story",
//       "The Alpenwild Story",
//       "staticpage/the-alpenwild-story/",
//     ),
//     menuItem(
//       "about-guides",
//       "Guides and Trip Leaders",
//       "staticpage/guides-and-trip-leaders/",
//     ),
//   ]),
//   menuItem("contact", "Contact Us", "staticpage/contact-us/"),
// ];
