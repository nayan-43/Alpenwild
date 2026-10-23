import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import $ from "@/vendor/jqueryValidationEngine";
import PublicFooter from "@/components/public/PublicFooter";
import PublicFooterExtras from "@/components/public/PublicFooterExtras";
import PublicHeader from "@/components/public/PublicHeader";
import PublicLoader from "@/components/public/PublicLoader";
import {
  localAssetUrl,
  localizeRichContent,
  thumbnailAssetUrl,
} from "@/lib/assets";
import { bookingCountries } from "@/lib/bookingCountries";
import { RECAPTCHA_SITE_KEY } from "@/lib/recaptcha";

async function fetchJson(url, fallback = null) {
  const response = await fetch(url);
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}.`);
  }
  if (!body.trim()) return fallback;
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`${url} returned invalid JSON.`);
  }
}

function formatDateRange(date, trip) {
  const start = new Date(`${String(date.start_date).slice(0, 10)}T00:00:00`);
  const end = new Date(`${String(date.end_date).slice(0, 10)}T00:00:00`);
  if (trip?.available_for !== "Specefic Date") {
    const days = date.trips_date_range || date.date_range || "Custom";
    return `${start.toLocaleDateString("en-US", { month: "long", year: "numeric" })} to ${end.toLocaleDateString("en-US", { month: "long", year: "numeric" })} for ${days} Days`;
  }
  return `${formatDate(date.start_date).replace(", ", ",")} - ${formatDate(date.end_date).replace(", ", ",")}`;
}

function imageUrl(trip, folder) {
  const source = localAssetUrl(
    trip?.[`${folder}_image_url`] ||
      (trip?.[`${folder}_image`]
        ? `images/trip/${folder}/${trip[`${folder}_image`]}`
        : ""),
  );
  return folder === "banner" ? thumbnailAssetUrl(source, 1170, 448) : source;
}

function formatDate(value) {
  if (!value) return "";
  const dateValue = String(value).slice(0, 10);
  const date = new Date(`${dateValue}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? dateValue
    : `${date.toLocaleDateString("en-US", { month: "long", day: "numeric" })}, ${date.getFullYear()}`;
}

function dateOfBirthFromForm(values, monthName, dayName, yearName) {
  const month = values.get(monthName);
  const day = values.get(dayName);
  const year = values.get(yearName);
  return month && day && year
    ? `${year}-${month}-${String(day).padStart(2, "0")}`
    : "";
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  minLength,
  maxLength,
  onChange,
}) {
  const validationRules = [
    ...(required ? ["required"] : []),
    ...(type === "email" ? ["custom[email]"] : []),
    ...(minLength ? [`minSize[${minLength}]`] : []),
    ...(maxLength ? [`maxSize[${maxLength}]`] : []),
  ];
  return (
    <li>
      <div className="ls">{label}</div>
      <div className="rs">
        <input
          className="input3"
          name={name}
          type={type}
          required={required}
          minLength={minLength}
          maxLength={maxLength}
          onChange={onChange}
          data-validation-engine={
            validationRules.length
              ? `validate[${validationRules.join(",")}]`
              : undefined
          }
        />
      </div>
    </li>
  );
}

function CountryField({ label, name }) {
  return (
    <li>
      <div className="ls">{label}</div>
      <div className="rs">
        <select
          className="select1"
          name={name}
          required
          defaultValue="UNITED STATES"
          data-validation-engine="validate[required]"
        >
          {bookingCountries.map((country) => (
            <option value={country} key={country}>
              {country}
            </option>
          ))}
        </select>
      </div>
    </li>
  );
}

function SelectField({ label, name, children, ...props }) {
  return (
    <li>
      <div className="ls">{label}</div>
      <div className="rs">
        <select className="select1" name={name} {...props}>
          {children}
        </select>
      </div>
    </li>
  );
}

export default function PublicTripBookingPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [trip, setTrip] = useState(null);
  const [footerMenus, setFooterMenus] = useState([]);
  const [publicSettings, setPublicSettings] = useState({});
  const [hasFaq, setHasFaq] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [bannerAction, setBannerAction] = useState("");
  const [partyNumber, setPartyNumber] = useState(1);
  const [shippingSame, setShippingSame] = useState(false);
  const [roomingPreference, setRoomingPreference] = useState("");
  const [discountState, setDiscountState] = useState({
    checking: false,
    applied: false,
    message: "",
    error: false,
  });
  const [submitState, setSubmitState] = useState({
    loading: false,
    message: "",
    error: "",
  });
  const bookingFormRef = useRef(null);
  const bookingStatusRef = useRef(null);
  const bannerRef = useRef(null);
  const discountInputRef = useRef(null);

  useEffect(() => {
    if (!submitState.error && !submitState.message) return;
    bookingStatusRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [submitState.error, submitState.message]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([
      fetchJson("/api/trips", []),
      fetchJson("/api/footer-menus", []),
      fetchJson("/api/public-settings", {}),
    ])
      .then(async ([tripData, footerData, settingsData]) => {
        if (cancelled) return;
        const found = Array.isArray(tripData)
          ? tripData.find(
              (item) => item.slug === slug && item.status === "Active",
            )
          : null;
        if (!found) throw new Error("Unable to load this trip.");
        const faqData = await fetchJson(`/api/trip-faqs/${found.id}`, []);
        setTrip(found);
        setFooterMenus(Array.isArray(footerData) ? footerData : []);
        setPublicSettings(settingsData || {});
        setHasFaq(Array.isArray(faqData) && faqData.length > 0);
        document.title = `Book Your Trip: ${found.name} | Alpenwild`;
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!bannerAction) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!bannerRef.current?.contains(event.target)) setBannerAction("");
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setBannerAction("");
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [bannerAction]);

  useEffect(() => {
    if (!trip || import.meta.env.VITE_ENABLE_RECAPTCHA === "false")
      return undefined;
    let attempts = 0;
    const renderBookingCaptcha = () => {
      const element = document.querySelector(
        ".trips-booking-form .g-recaptcha",
      );
      if (
        !element ||
        element.querySelector("iframe") ||
        element.dataset.rendered === "true" ||
        !window.grecaptcha?.render
      ) {
        return false;
      }
      window.grecaptcha.render(element, {
        sitekey: element.dataset.sitekey,
      });
      element.dataset.rendered = "true";
      return true;
    };
    const timer = window.setInterval(() => {
      attempts += 1;
      if (renderBookingCaptcha() || attempts >= 100) {
        window.clearInterval(timer);
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [trip]);

  useEffect(() => {
    const form = bookingFormRef.current;
    if (!trip || !form) return undefined;
    const $form = $(form);
    $form.validationEngine("attach", { promptPosition: "topLeft" });
    return () => {
      $form.validationEngine("hideAll");
      $form.validationEngine("detach");
    };
  }, [trip]);

  const dateGroups = (trip?.dates || [])
    .filter(
      (date) =>
        date.status === "Active" &&
        (!date.end_date ||
          date.end_date >= new Date().toISOString().slice(0, 10)),
    )
    .reduce((groups, date) => {
      const year = String(date.start_date || "").slice(0, 4) || "Dates";
      const group = groups.find((item) => item.year === year);
      if (group) group.dates.push(date);
      else groups.push({ year, dates: [date] });
      return groups;
    }, []);

  async function submitBooking(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (submitState.loading || !$(form).validationEngine("validate")) return;
    const values = new FormData(form);
    const value = (name) => values.get(name) || "";
    const dateId = values.get("trips_date_id");
    const dob = dateOfBirthFromForm(values, "month2", "day2", "year2");
    const additionalTravelers = Array.from(
      { length: Math.max(0, partyNumber - 1) },
      (_, index) => {
        const number = index + 1;
        return {
          first_name: values.get(`additional_first_name${number}`) || "",
          last_name: values.get(`additional_last_name${number}`) || "",
          preferred_name:
            values.get(`additional_preferred_name${number}`) || "",
          email_address:
            values.get(`additional_user_email_address${number}`) || "",
          mobile_phone: values.get(`additional_mobile_phone${number}`) || "",
          gender: values.get(`additional_gender${number}`) || "",
          date_of_birth: dateOfBirthFromForm(
            values,
            `additional_month${number}`,
            `additional_day${number}`,
            `additional_year${number}`,
          ),
        };
      },
    ).filter((traveler) => traveler.first_name || traveler.last_name);
    const payload = {
      user_email_address: value("user_email_address"),
      trips_id: trip.id,
      trips_date_id:
        dateId ||
        (trip.dates || []).find((date) => date.status === "Active")?.id,
      party_number: partyNumber,
      first_name: value("first_name"),
      last_name: value("last_name"),
      preferred_name: value("preferred_name"),
      street_address: value("street_address"),
      street_address1: value("street_address1"),
      city: value("city"),
      state: value("state"),
      postal_code: value("postal_code"),
      country: value("country"),
      day_phone: value("day_phone") || value("mobile_phone"),
      mobile_phone: value("mobile_phone"),
      date_of_birth: dob,
      gender: value("gender"),
      shipping_first_name: value("shipping_first_name"),
      shipping_last_name: value("shipping_last_name"),
      shipping_street_address: value("shipping_street_address"),
      shipping_street_address1: value("shipping_street_address1"),
      shipping_city: value("shipping_city"),
      shipping_state: value("shipping_state"),
      shipping_postal_code: value("shipping_postal_code"),
      shipping_country: value("shipping_country"),
      rooming_preference: value("rooming_preference"),
      bed_preference: value("bed_preference"),
      physical_medical_conditions: value("physical_medical_conditions"),
      dietary_restrictions: value("dietary_restrictions"),
      special_dietary_requirements: value("special_dietary_requirements"),
      hear_about_us: value("hear_about_us"),
      special_comments: value("special_comments"),
      flight_arrival_details: value("flight_arrival_details"),
      flight_departure_details: value("flight_departure_details"),
      booking_start_date: value("tripstart_date"),
      booking_end_date: value("tripend_date"),
      discount_code: value("discount_code"),
      credit_card_last_four: String(values.get("credit_card_number") || "")
        .replace(/\D/g, "")
        .slice(-4),
      credit_card_number: String(
        values.get("credit_card_number") || "",
      ).replace(/\D/g, ""),
      credit_card_expire_month: values.get("credit_card_expire_month"),
      credit_card_expire_year: values.get("credit_card_expire_year"),
      credit_card_cvv_number: values.get("credit_card_cvv_number"),
      additional_travelers: additionalTravelers,
      recaptcha_token:
        window.grecaptcha?.getResponse?.() ||
        form.querySelector('[name="g-recaptcha-response"]')?.value ||
        "",
      agree: value("agree"),
    };
    setSubmitState({ loading: true, message: "", error: "" });
    try {
      const response = await fetch("/api/public/trip-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok && result.booking_id)
        throw new Error(
          `${result.message || "Your booking could not be completed."} Booking reference: ${result.booking_id}.`,
        );
      if (!response.ok)
        throw new Error(result.message || "Unable to submit your booking.");
      form.reset();
      window.grecaptcha?.reset?.();
      navigate("/staticpage/thank-you/");
    } catch (submitError) {
      window.grecaptcha?.reset?.();
      setSubmitState({
        loading: false,
        message: "",
        error: submitError.message,
      });
    }
  }

  async function checkDiscount() {
    const discountCode = discountInputRef.current?.value.trim() || "";
    if (!discountCode) {
      setDiscountState({
        checking: false,
        applied: false,
        message: "Please enter voucher code",
        error: true,
      });
      return;
    }
    setDiscountState({
      checking: true,
      applied: false,
      message: "",
      error: false,
    });
    try {
      const response = await fetch("/api/discount-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discount_code: discountCode }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Please try again.");
      if (!result.success) {
        if (discountInputRef.current) discountInputRef.current.value = "";
        setDiscountState({
          checking: false,
          applied: false,
          message: result.message,
          error: true,
        });
        return;
      }
      setDiscountState({
        checking: false,
        applied: true,
        message: "You have successfully activated your coupon code.",
        error: false,
      });
    } catch (discountError) {
      setDiscountState({
        checking: false,
        applied: false,
        message: discountError.message || "Please try again.",
        error: true,
      });
    }
  }

  return (
    <div className="public-site">
      <PublicHeader />
      {loading && <PublicLoader />}
      {trip && (
        <div className="banner">
          <div className="container">
            <section
              className="inner_banner client-detail-banner"
              ref={bannerRef}
            >
              <img
                src={imageUrl(trip, "banner")}
                alt={trip.banner_alt || trip.name}
              />
              <div className="banner_txt client-detail-banner-copy">
                <div className="col-md-10 col-sm-10 col-xs-12">
                  <h1>{trip.name}</h1>
                  <p
                    dangerouslySetInnerHTML={{
                      __html: localizeRichContent(trip.banner_sub_title || ""),
                    }}
                  />
                </div>
              </div>
              <div
                className="banner_content client-detail-banner-popover client-detail-banner-photo"
                style={{
                  display: bannerAction === "photo" ? "block" : "none",
                }}
              >
                <p
                  dangerouslySetInnerHTML={{
                    __html: localizeRichContent(trip.tooltip_text || ""),
                  }}
                />
              </div>
              <div
                className="banner_activity_content client-detail-banner-popover client-detail-banner-activity-popover"
                style={{
                  display: bannerAction === "activity" ? "block" : "none",
                }}
              >
                <p
                  dangerouslySetInnerHTML={{
                    __html: localizeRichContent(trip.activity || ""),
                  }}
                />
              </div>
              {trip.activity_level && (
                <button
                  className="activity-level client-detail-banner-action"
                  type="button"
                  title="Trip Difficulty Level"
                  aria-label="Show trip difficulty level"
                  onClick={() =>
                    setBannerAction((current) =>
                      current === "activity" ? "" : "activity",
                    )
                  }
                >
                  <img
                    src={localAssetUrl(
                      `images/activity_${String(trip.activity_level)
                        .toLowerCase()
                        .replace(/\s+/g, "_")}.png`,
                    )}
                    alt=""
                  />
                </button>
              )}
              <button
                className="fa fa-camera"
                type="button"
                title="Photo Credit"
                aria-label="Show photo credit"
                onClick={() =>
                  setBannerAction((current) =>
                    current === "photo" ? "" : "photo",
                  )
                }
              />
            </section>
          </div>
        </div>
      )}
      <div className="section client-trip-booking-page">
        <div className="container">
          <div className="row">
            <a name="overview" id="overview"></a>
            <div className="col-md-3 col-sm-12 col-xs-12">
              <div className="laft_menu">
                <ul>
                  <li>
                    <Link to={`/trip/${slug}/overview/`}>Overview</Link>
                  </li>
                  <li>
                    <Link to={`/trip/${slug}/itinerary/#overview`}>
                      Itinerary
                    </Link>
                  </li>
                  <li className="active">
                    <Link to={`/trip/${slug}/details/#overview`}>Details</Link>
                  </li>
                  <li>
                    <Link to={`/trip/${slug}/gallery/#overview`}>Gallery</Link>
                  </li>
                  {hasFaq && (
                    <li>
                      <Link to={`/trip/${slug}/faq/#overview`}>FAQ</Link>
                    </li>
                  )}
                </ul>
                <Link to={`/trip/${slug}/booking/`}>
                  <div className="book">
                    Book This Trip Now
                    <span>
                      <i className="fa fa-calendar" aria-hidden="true" />
                    </span>
                  </div>
                </Link>
              </div>
            </div>
            <div className="col-md-5 col-sm-7 col-xs-12 no-padding">
              <div className="col-xs-12 title">
                <h2>Book Your Trip</h2>
              </div>
              {error && <div className="client-alert">{error}</div>}
              {trip && (
                <>
                  <div className="col-md-12 col-sm-12 col-xs-12">
                    <div className="tabbing">
                      <ul className="tabNav">
                        <li className="active">
                          <a href="#tab1" className="mResTabAccordA active">
                            Trip Reservation
                          </a>
                        </li>
                        <li>
                          <Link
                            id="make_a_payment"
                            className="mResTabAccordA"
                            to="/staticpage/make-a-payment/"
                          >
                            Make Payment
                          </Link>
                        </li>
                      </ul>
                      <div className="tabContainer">
                        <div className="tabContent mTabActive" id="tab1">
                          <form
                            id="trip_booking"
                            name="trip_booking"
                            method="POST"
                            encType="multipart/form-data"
                            ref={bookingFormRef}
                            className="form-horizontal"
                            noValidate
                            onSubmit={submitBooking}
                          >
                            <input type="hidden" name="action" value="add" />
                            <input
                              type="hidden"
                              name="trips_id"
                              value={trip.id}
                            />
                            <input type="hidden" name="user_id" value="" />
                            <input type="hidden" name="start_day" value="" />
                            <div className="trips-booking-form">
                              <div className="col-left">
                                <h2>Book Your Trip: {trip.name}</h2>
                                <div
                                  ref={bookingStatusRef}
                                  className={
                                    submitState.error
                                      ? "client-booking-alert client-booking-alert-error"
                                      : ""
                                  }
                                  role={
                                    submitState.error
                                      ? "alert"
                                      : submitState.message
                                        ? "status"
                                        : undefined
                                  }
                                >
                                  {submitState.error || submitState.message}
                                </div>
                                <h3>Trip Details</h3>
                                <ul className="form-table">
                                  <Field
                                    label="Email Address*:"
                                    name="user_email_address"
                                    type="email"
                                    required
                                  />
                                  <SelectField
                                    label="Select Range*:"
                                    name="trips_date_id"
                                    required
                                    data-validation-engine="validate[required]"
                                    defaultValue=""
                                    onChange={() =>
                                      setSubmitState((current) => ({
                                        ...current,
                                        message: "",
                                        error: "",
                                      }))
                                    }
                                  >
                                    <option value="">
                                      --- Please Select Range ---
                                    </option>
                                    {dateGroups.map((group) => (
                                      <optgroup
                                        label={group.year}
                                        key={group.year}
                                      >
                                        {group.dates.map((date) => (
                                          <option value={date.id} key={date.id}>
                                            {formatDateRange(date, trip)}
                                          </option>
                                        ))}
                                      </optgroup>
                                    ))}
                                  </SelectField>
                                  {trip.available_for !== "Specefic Date" && (
                                    <>
                                      <Field
                                        label="Trips Start date*:"
                                        name="tripstart_date"
                                        type="date"
                                        required
                                        onChange={() =>
                                          setSubmitState((current) => ({
                                            ...current,
                                            message: "",
                                            error: "",
                                          }))
                                        }
                                      />
                                      <Field
                                        label="Trips End date*:"
                                        name="tripend_date"
                                        type="date"
                                        required
                                        onChange={() =>
                                          setSubmitState((current) => ({
                                            ...current,
                                            message: "",
                                            error: "",
                                          }))
                                        }
                                      />
                                    </>
                                  )}
                                  <SelectField
                                    label="Number in party*:"
                                    name="party_number"
                                    value={partyNumber}
                                    onChange={(event) =>
                                      setPartyNumber(Number(event.target.value))
                                    }
                                  >
                                    {Array.from(
                                      { length: 10 },
                                      (_, index) => index + 1,
                                    ).map((number) => (
                                      <option value={number} key={number}>
                                        {number} person
                                      </option>
                                    ))}
                                  </SelectField>
                                </ul>
                                <h3>User&apos;s Billing Information</h3>
                                <ul className="form-table">
                                  <li>
                                    <div className="ls">Gender:</div>
                                    <div className="rs">
                                      <input
                                        type="radio"
                                        name="gender"
                                        value="Male"
                                        id="male"
                                      />{" "}
                                      {/* Male&nbsp;&nbsp;&nbsp;&nbsp; */}
                                      <label htmlFor="male">Male</label>
                                      <input
                                        type="radio"
                                        name="gender"
                                        value="Female"
                                        id="female"
                                      />{" "}
                                      <label htmlFor="female">Female</label>
                                    </div>
                                  </li>
                                  <Field
                                    label="First Name (as it appears on passport)*:"
                                    name="first_name"
                                    required
                                  />
                                  <Field
                                    label="Last Name (as it appears on passport)*:"
                                    name="last_name"
                                    required
                                  />
                                  <Field
                                    label="Preferred Name:"
                                    name="preferred_name"
                                  />
                                  <Field
                                    label="Mobile Phone Number*:"
                                    name="mobile_phone"
                                    type="tel"
                                    required
                                    minLength={10}
                                    maxLength={20}
                                  />
                                  <li>
                                    <div className="ls">Date Of Birth*:</div>
                                    <div className="rs">
                                      <select
                                        className="select2"
                                        name="month2"
                                        defaultValue="01"
                                        required
                                        data-validation-engine="validate[required]"
                                      >
                                        {[
                                          "Jan",
                                          "Feb",
                                          "Mar",
                                          "Apr",
                                          "May",
                                          "Jun",
                                          "Jul",
                                          "Aug",
                                          "Sep",
                                          "Oct",
                                          "Nov",
                                          "Dec",
                                        ].map((month, index) => (
                                          <option
                                            value={String(index + 1).padStart(
                                              2,
                                              "0",
                                            )}
                                            key={month}
                                          >
                                            {month}
                                          </option>
                                        ))}
                                      </select>
                                      <select
                                        className="select2"
                                        name="day2"
                                        defaultValue="1"
                                        required
                                        data-validation-engine="validate[required]"
                                      >
                                        {Array.from(
                                          { length: 31 },
                                          (_, index) => (
                                            <option
                                              value={index + 1}
                                              key={index + 1}
                                            >
                                              {index + 1}
                                            </option>
                                          ),
                                        )}
                                      </select>
                                      <select
                                        className="select2"
                                        name="year2"
                                        defaultValue="1930"
                                        required
                                        data-validation-engine="validate[required]"
                                      >
                                        {Array.from(
                                          { length: 87 },
                                          (_, index) => (
                                            <option
                                              value={1930 + index}
                                              key={1930 + index}
                                            >
                                              {1930 + index}
                                            </option>
                                          ),
                                        )}
                                      </select>
                                    </div>
                                  </li>
                                  <Field
                                    label="Street Address*:"
                                    name="street_address"
                                    required
                                  />
                                  <Field
                                    label="Street Address 2:"
                                    name="street_address1"
                                  />
                                  <Field label="City*:" name="city" required />
                                  <Field
                                    label="State*:"
                                    name="state"
                                    required
                                  />
                                  <Field
                                    label="Zip Code*:"
                                    name="postal_code"
                                    required
                                  />
                                  <CountryField
                                    label="Country*:"
                                    name="country"
                                  />
                                </ul>
                                {Array.from(
                                  { length: Math.max(0, partyNumber - 1) },
                                  (_, index) => (
                                    <div className="additional-box" key={index}>
                                      <h3>Guest {index + 2} Information</h3>
                                      <ul className="form-table">
                                        <Field
                                          label="First Name (as it appears on passport):"
                                          name={`additional_first_name${index + 1}`}
                                          required
                                        />
                                        <Field
                                          label="Last Name (as it appears on passport):"
                                          name={`additional_last_name${index + 1}`}
                                          required
                                        />
                                        <Field
                                          label="Email:"
                                          name={`additional_user_email_address${index + 1}`}
                                          type="email"
                                        />
                                        <Field
                                          label="Preferred Name:"
                                          name={`additional_preferred_name${index + 1}`}
                                        />
                                        <li>
                                          <div className="ls">Gender:</div>
                                          <div className="rs">
                                            <input
                                              type="radio"
                                              name={`additional_gender${index + 1}`}
                                              value="Male"
                                              id="male"
                                            />{" "}
                                            <label htmlFor="male">Male</label>
                                            <input
                                              type="radio"
                                              name={`additional_gender${index + 1}`}
                                              value="Female"
                                              id="female"
                                            />{" "}
                                            <label htmlFor="female">
                                              Female
                                            </label>
                                          </div>
                                        </li>
                                        <Field
                                          label="Mobile No.:"
                                          name={`additional_mobile_phone${index + 1}`}
                                          type="tel"
                                        />
                                        <li>
                                          <div className="ls">
                                            Date of Birth:
                                          </div>
                                          <div className="rs">
                                            <select
                                              className="select2"
                                              name={`additional_month${index + 1}`}
                                              defaultValue="01"
                                              required
                                              data-validation-engine="validate[required]"
                                            >
                                              {[
                                                "Jan",
                                                "Feb",
                                                "Mar",
                                                "Apr",
                                                "May",
                                                "Jun",
                                                "Jul",
                                                "Aug",
                                                "Sep",
                                                "Oct",
                                                "Nov",
                                                "Dec",
                                              ].map((month, monthIndex) => (
                                                <option
                                                  value={String(
                                                    monthIndex + 1,
                                                  ).padStart(2, "0")}
                                                  key={month}
                                                >
                                                  {month}
                                                </option>
                                              ))}
                                            </select>
                                            <select
                                              className="select2"
                                              name={`additional_day${index + 1}`}
                                              defaultValue="1"
                                              required
                                              data-validation-engine="validate[required]"
                                            >
                                              {Array.from(
                                                { length: 31 },
                                                (_, dayIndex) => (
                                                  <option
                                                    value={dayIndex + 1}
                                                    key={dayIndex + 1}
                                                  >
                                                    {dayIndex + 1}
                                                  </option>
                                                ),
                                              )}
                                            </select>
                                            <select
                                              className="select2"
                                              name={`additional_year${index + 1}`}
                                              defaultValue="1930"
                                              required
                                              data-validation-engine="validate[required]"
                                            >
                                              {Array.from(
                                                { length: 87 },
                                                (_, yearIndex) => (
                                                  <option
                                                    value={1930 + yearIndex}
                                                    key={1930 + yearIndex}
                                                  >
                                                    {1930 + yearIndex}
                                                  </option>
                                                ),
                                              )}
                                            </select>
                                          </div>
                                        </li>
                                      </ul>
                                    </div>
                                  ),
                                )}
                                <h3>User&apos;s Shipping Information</h3>
                                <label>
                                  <input
                                    className="chkbox"
                                    type="checkbox"
                                    name="shipping_same"
                                    value="checkbox"
                                    checked={shippingSame}
                                    onChange={(event) => {
                                      setShippingSame(event.target.checked);
                                      if (bookingFormRef.current) {
                                        [
                                          "first_name",
                                          "last_name",
                                          "street_address",
                                          "street_address1",
                                          "city",
                                          "state",
                                          "postal_code",
                                          "country",
                                        ].forEach((field) => {
                                          const source =
                                            bookingFormRef.current.elements[
                                              field
                                            ];
                                          const target =
                                            bookingFormRef.current.elements[
                                              `shipping_${field === "postal_code" ? "postal_code" : field}`
                                            ];
                                          if (source && target)
                                            target.value = event.target.checked
                                              ? source.value
                                              : "";
                                        });
                                      }
                                    }}
                                  />{" "}
                                  Same as billing address
                                </label>
                                <ul className="form-table">
                                  <Field
                                    label="First Name (as it appears on passport)*:"
                                    name="shipping_first_name"
                                    required
                                  />
                                  <Field
                                    label="Last Name (as it appears on passport)*:"
                                    name="shipping_last_name"
                                    required
                                  />
                                  <Field
                                    label="Street Address*:"
                                    name="shipping_street_address"
                                    required
                                  />
                                  <Field
                                    label="Street Address 2:"
                                    name="shipping_street_address1"
                                  />
                                  <Field
                                    label="City*:"
                                    name="shipping_city"
                                    required
                                  />
                                  <Field
                                    label="State*:"
                                    name="shipping_state"
                                    required
                                  />
                                  <Field
                                    label="Zip Code*:"
                                    name="shipping_postal_code"
                                    required
                                  />
                                  <CountryField
                                    label="Country*:"
                                    name="shipping_country"
                                  />
                                </ul>
                                <h3>Rooming Information</h3>
                                <ul className="form-table">
                                  <SelectField
                                    label="Rooming Preference:"
                                    name="rooming_preference"
                                    className="select_text"
                                    value={roomingPreference}
                                    onChange={(event) =>
                                      setRoomingPreference(event.target.value)
                                    }
                                  >
                                    <option value="">
                                      --- Please Select Rooming Preference ---
                                    </option>
                                    <option>Single occupancy</option>
                                    <option>Double occupancy</option>
                                    <option>Triple occupancy</option>
                                  </SelectField>
                                  <li
                                    id="bed_pref"
                                    style={{
                                      display:
                                        roomingPreference === "Single occupancy"
                                          ? "none"
                                          : "block",
                                    }}
                                  >
                                    <div className="ls">Bed Preference:</div>
                                    <div className="rs">
                                      <select
                                        className="select_text"
                                        name="bed_preference"
                                        defaultValue=""
                                      >
                                        <option value="">
                                          --- Please Select Bed Preference ---
                                        </option>
                                        <option>Two beds</option>
                                        <option>One bed</option>
                                      </select>
                                    </div>
                                  </li>
                                </ul>
                                <h3>Special/Additional Information</h3>
                                <ul className="form-table">
                                  <li>
                                    <label>
                                      Physical or medical conditions (please
                                      specify who in your party this affects):
                                    </label>
                                    <textarea name="physical_medical_conditions" />
                                    <small>
                                      This will only be shared with your guide
                                      and must be disclosed for your safety.
                                    </small>
                                  </li>
                                  <li>
                                    <label>
                                      Dietary Restrictions and Allergies (please
                                      specify who in your party this affects):
                                    </label>
                                    <textarea name="dietary_restrictions" />
                                    <small>
                                      e.g. peanut allergy, lactose intolerance,
                                      etc.
                                    </small>
                                  </li>
                                  <li>
                                    <label>
                                      Dietary Requests (please specify who in
                                      your party this affects):
                                    </label>
                                    <textarea name="special_dietary_requirements" />
                                    <small>
                                      e.g. vegetarian, no veal, gluten-free, no
                                      pork, no fish, etc
                                    </small>
                                  </li>
                                  <SelectField
                                    label="How did you hear about us?"
                                    name="hear_about_us"
                                    defaultValue=""
                                  >
                                    <option value="">
                                      **Please choose one of the following**
                                    </option>
                                    <option value="Traveled with us previously">
                                      Traveled with us previously
                                    </option>
                                    <option value="friend">
                                      From a friend
                                    </option>
                                    <option value="Alpenwild internet ad">
                                      Internet ads for Alpenwild
                                    </option>
                                    <option value="Alpenwild web search">
                                      Internet search results for Alpenwild
                                    </option>
                                    <option value="Social media site">
                                      Internet - Social media sites (YouTube,
                                      Facebook, etc.)
                                    </option>
                                    <option value="Alpenwild e-Newsletter">
                                      Alpenwild e-Newsletter
                                    </option>
                                    <option value="Other">
                                      Other (please specify in comment field
                                      below)
                                    </option>
                                  </SelectField>
                                  <li>
                                    <label>
                                      Special Comments &amp; Questions:
                                    </label>
                                    <br />
                                    <span
                                      style={{
                                        fontSize: 10,
                                        lineHeight: "14px",
                                      }}
                                    >
                                      (Please tell us about any special
                                      accommodations, considerations, or
                                      requests our guides should be aware of.
                                      Likewise please let us know if you&apos;re
                                      celebrating a particular
                                      event--anniversary, graduation, birthday,
                                      whatever!)
                                    </span>
                                    <textarea name="special_comments" />
                                  </li>
                                  <li>
                                    <label>
                                      Flight Arrival Details
                                      <br />
                                      (Can be submitted later):
                                    </label>
                                    <textarea name="flight_arrival_details" />
                                  </li>
                                  <li>
                                    <label>
                                      Flight Departure Details
                                      <br />
                                      (Can be submitted later):
                                    </label>
                                    <textarea name="flight_departure_details" />
                                  </li>
                                </ul>
                                <h3>Discount</h3>
                                <p>
                                  <span>
                                    If you have a voucher code add it:{" "}
                                  </span>
                                  <input
                                    ref={discountInputRef}
                                    id="discount_code"
                                    name="discount_code"
                                    readOnly={discountState.applied}
                                  />
                                  {!discountState.applied && (
                                    <button
                                      type="button"
                                      name="discount"
                                      id="discount"
                                      className="button-type"
                                      disabled={discountState.checking}
                                      onClick={checkDiscount}
                                    >
                                      {discountState.checking
                                        ? "Checking..."
                                        : "ADD"}
                                    </button>
                                  )}
                                </p>
                                {discountState.message && (
                                  <div
                                    className={`client-booking-alert ${discountState.error ? "client-booking-alert-error" : "client-booking-alert-success"}`}
                                    role={
                                      discountState.error ? "alert" : "status"
                                    }
                                  >
                                    {discountState.message}
                                  </div>
                                )}
                                <h3>Client&apos;s Payment Information</h3>
                                <small>
                                  (Your confirmed deposit reserves your place on
                                  the trip and protects the rate against
                                  currency fluctuations. Once you&apos;ve made
                                  your deposit, we will confirm your reservation
                                  by email within one business day. If you do
                                  not receive a confirmation or if you wish to
                                  discuss any special arrangements, please{" "}
                                  <Link to="/staticpage/contact-us/">
                                    contact us
                                  </Link>
                                  )
                                </small>
                                <ul className="form-table">
                                  <Field
                                    label="Credit Card Number*:"
                                    name="credit_card_number"
                                    required
                                    minLength={14}
                                    maxLength={25}
                                  />
                                  <SelectField
                                    label="Card Expiration Month*:"
                                    name="credit_card_expire_month"
                                    required
                                    data-validation-engine="validate[required]"
                                    defaultValue=""
                                  >
                                    <option value="">
                                      --- Select Expiration Month ---
                                    </option>
                                    {[
                                      "January",
                                      "February",
                                      "March",
                                      "April",
                                      "May",
                                      "June",
                                      "July",
                                      "August",
                                      "September",
                                      "October",
                                      "November",
                                      "December",
                                    ].map((month, index) => (
                                      <option
                                        value={String(index + 1).padStart(
                                          2,
                                          "0",
                                        )}
                                        key={month}
                                      >
                                        {String(index + 1).padStart(2, "0")}-
                                        {month}
                                      </option>
                                    ))}
                                  </SelectField>
                                  <SelectField
                                    label="Card Expiration Year*:"
                                    name="credit_card_expire_year"
                                    required
                                    data-validation-engine="validate[required]"
                                    defaultValue={String(
                                      new Date().getFullYear(),
                                    )}
                                  >
                                    {Array.from({ length: 13 }, (_, index) => (
                                      <option
                                        key={new Date().getFullYear() + index}
                                      >
                                        {new Date().getFullYear() + index}
                                      </option>
                                    ))}
                                  </SelectField>
                                  <Field
                                    label="Credit Card CVV Number*:"
                                    name="credit_card_cvv_number"
                                    type="password"
                                    required
                                    minLength={3}
                                    maxLength={4}
                                  />
                                  <li>
                                    $500 (or $750 for Self-Guided Rail Tours)
                                    per person deposit required at time of
                                    booking or full payment if trip departs
                                    within 120 days
                                  </li>
                                  {import.meta.env.VITE_ENABLE_RECAPTCHA !==
                                    "false" && (
                                    <li>
                                      <div
                                        className="g-recaptcha"
                                        data-sitekey={RECAPTCHA_SITE_KEY}
                                      />
                                    </li>
                                  )}
                                </ul>
                                <p>
                                  By submitting this form, you agree to the{" "}
                                  <Link
                                    to="/staticpage/terms-conditions/"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="shadowbox"
                                  >
                                    Terms and Conditions
                                  </Link>
                                  , which includes important information you
                                  should know before submitting your
                                  reservation.
                                </p>
                                <p>
                                  <input
                                    className="chkbox"
                                    type="checkbox"
                                    name="agree"
                                    value="1"
                                    required
                                    data-validation-engine="validate[required]"
                                  />{" "}
                                  I have read and accepted the{" "}
                                  <Link
                                    to="/staticpage/terms-conditions/"
                                    className="shadowbox"
                                  >
                                    Terms and Conditions
                                  </Link>
                                </p>
                                <p align="center">
                                  <button
                                    className="buttan btn btn-primary"
                                    id="submitbutton"
                                    type="submit"
                                    name="submit"
                                    value="Submit"
                                    disabled={submitState.loading}
                                  >
                                    {submitState.loading
                                      ? "Submitting..."
                                      : "Submit"}
                                  </button>
                                </p>
                              </div>
                              <div className="col-right">
                                <h3>3 Ways to Reserve Your Trip:</h3>
                                <ol>
                                  <li>
                                    <strong>Book online</strong> with your Visa,
                                    MasterCard, American Express or Discover
                                    credit card. We will confirm your
                                    reservation via e-mail within one business
                                    day.
                                  </li>
                                  <li>
                                    <strong>
                                      <Link to="/staticpage/contact-us/">
                                        Contact us
                                      </Link>
                                    </strong>{" "}
                                    by phone with your credit card information.
                                    We will confirm your reservation immediately
                                    over the phone, M-F 8:00 am - 4:00 pm,
                                    Mountain Time
                                  </li>
                                  <li>
                                    <strong>E-mail us</strong> at{" "}
                                    <a href="mailto:info@alpenwild.com">
                                      info@alpenwild.com
                                    </a>{" "}
                                    to make your deposit by check. We will hold
                                    your place and reply via e-mail within one
                                    business day. Your check must be received
                                    within 7 business days to confirm your
                                    reservation.
                                  </li>
                                </ol>
                              </div>
                            </div>
                          </form>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="col-md-4 col-sm-5 col-xs-12 right_side">
              <div className="side_div">
                <h3>Activity Level</h3>
                <div
                  className="box activity-box"
                  dangerouslySetInnerHTML={{
                    __html: localizeRichContent(trip?.activity || ""),
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <PublicFooterExtras publicSettings={publicSettings} />
      <PublicFooter footerMenus={footerMenus} />
    </div>
  );
}
