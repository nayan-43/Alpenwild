import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import $ from "@/vendor/jqueryValidationEngine";
import PublicFooter from "@/components/public/PublicFooter";
import PublicFooterExtras from "@/components/public/PublicFooterExtras";
import PublicHeader from "@/components/public/PublicHeader";
import PublicLoader from "@/components/public/PublicLoader";
import PublicContestPage from "@/pages/PublicContestPage";
import {
  localAppLink,
  localizeRichContent,
  thumbnailAssetUrl,
} from "@/lib/assets";
import { buildPublicVideoGroups, youtubeVideoId } from "@/lib/publicVideos";
import { createPaymentRequestId } from "@/lib/paymentRequestId";
import { RECAPTCHA_SITE_KEY } from "@/lib/recaptcha";

function PaymentForm({ tripTypes, trips, navigate, search }) {
  const months = [
    "01-January",
    "02-February",
    "03-March",
    "04-April",
    "05-May",
    "06-June",
    "07-July",
    "08-August",
    "09-September",
    "10-October",
    "11-November",
    "12-December",
  ];
  const years = Array.from(
    { length: 12 },
    (_, index) => new Date().getFullYear() + index,
  );
  const [state, setState] = useState({
    loading: false,
    error: "",
  });
  const [paymentLinkState, setPaymentLinkState] = useState({
    loading: false,
    error: "",
    booking: null,
  });
  const formRef = useRef(null);
  const paymentLinkParams = new URLSearchParams(search);
  const bookingId = paymentLinkParams.get("bookingid") || "";
  const requestStorageKey = `alpenwild-trip-payment:${bookingId || "direct"}`;
  const [clientRequestId, setClientRequestId] = useState(() => {
    const storedRequestId = window.sessionStorage.getItem(requestStorageKey);
    if (storedRequestId) return storedRequestId;
    const requestId = createPaymentRequestId();
    window.sessionStorage.setItem(requestStorageKey, requestId);
    return requestId;
  });

  function rotatePaymentRequestId() {
    const requestId = createPaymentRequestId();
    window.sessionStorage.setItem(requestStorageKey, requestId);
    setClientRequestId(requestId);
  }

  useEffect(() => {
    const form = formRef.current;
    if (!form) return undefined;
    const $form = $(form);
    $form.validationEngine("attach", { promptPosition: "topLeft" });
    return () => {
      $form.validationEngine("hideAll");
      $form.validationEngine("detach");
    };
  }, [paymentLinkState.booking?.booking_id]);

  useEffect(() => {
    if (!bookingId) {
      setPaymentLinkState({ loading: false, error: "", booking: null });
      return undefined;
    }
    const controller = new AbortController();
    const searchParams = new URLSearchParams(search);
    const params = new URLSearchParams({
      type: searchParams.get("type") || "",
      signature: searchParams.get("signature") || "",
    });
    const adminAmount = searchParams.get("adminamount");
    if (adminAmount !== null) params.set("adminamount", adminAmount);
    setPaymentLinkState({ loading: true, error: "", booking: null });
    fetch(
      `/api/public-trip-payment-links/${encodeURIComponent(bookingId)}?${params}`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(
            result.message || "Unable to load this payment link.",
          );
        return result;
      })
      .then((booking) =>
        setPaymentLinkState({ loading: false, error: "", booking }),
      )
      .catch((error) => {
        if (error.name !== "AbortError")
          setPaymentLinkState({
            loading: false,
            error: error.message,
            booking: null,
          });
      });
    return () => controller.abort();
  }, [bookingId, search]);

  async function submitPayment(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const linkedBooking = paymentLinkState.booking;
    if (bookingId && !linkedBooking) return;
    if (state.loading || !$(form).validationEngine("validate")) return;
    const captcha = form.querySelector(".g-recaptcha");
    const widgetId = captcha?.dataset.widgetId;
    const recaptchaToken = window.grecaptcha?.getResponse
      ? window.grecaptcha.getResponse(
          widgetId === undefined ? undefined : Number(widgetId),
        )
      : "";
    if (import.meta.env.VITE_ENABLE_RECAPTCHA !== "false" && !recaptchaToken) {
      setState({
        loading: false,
        error: "Please click on the reCAPTCHA box.",
      });
      return;
    }
    const values = new FormData(form);
    setState({ loading: true, error: "" });
    try {
      const response = await fetch("/api/trip-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_request_id: clientRequestId,
          trip_id: values.get("addi_trips_id"),
          ...(linkedBooking && {
            booking_id: linkedBooking.booking_id,
            payment_link_type: linkedBooking.type,
            ...(linkedBooking.type === "define_admin" && {
              payment_link_amount: linkedBooking.amount,
            }),
            payment_link_signature: linkedBooking.signature,
          }),
          email: values.get("email_add"),
          name_on_card: values.get("name_on_card"),
          billing_address: values.get("billing_address"),
          city: values.get("city"),
          state: values.get("state"),
          zipcode: values.get("zipcode"),
          amount: values.get("amount"),
          credit_card_last_four: String(values.get("credit_card_number") || "")
            .replace(/\D/g, "")
            .slice(-4),
          credit_card_number: String(
            values.get("credit_card_number") || "",
          ).replace(/\D/g, ""),
          credit_card_expire_month: values.get("credit_card_expire_month"),
          credit_card_expire_year: values.get("credit_card_expire_year"),
          credit_card_cvv_number: values.get("credit_card_cvv_number"),
          recaptcha_token: recaptchaToken,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (result.retryable) rotatePaymentRequestId();
        throw new Error(
          result.payment_id
            ? `${result.message || "Payment could not be confirmed."} Payment reference: ${result.payment_id}.`
            : result.message || "Unable to submit payment.",
        );
      }
      form.reset();
      window.sessionStorage.removeItem(requestStorageKey);
      navigate("/staticpage/thank-you/");
    } catch (error) {
      setState({ loading: false, error: error.message });
    } finally {
      if (widgetId !== undefined) window.grecaptcha?.reset?.(Number(widgetId));
    }
  }

  return (
    <div className="col-md-6 col-md-offset-3 col-sm-6 col-sm-offset-3 col-xs-12 client-payment-section">
      <div className="tabContainer">
        <div className="tabContent mTabContent mTabActive">
          <div className="trips-booking-form">
            <div className="col-left">
              <h2>Make A Payment:</h2>
              <p>
                {paymentLinkState.loading && (
                  <span role="status">
                    Loading your booking payment details…
                  </span>
                )}
                {paymentLinkState.error && (
                  <span
                    className="client-alert client-payment-alert"
                    role="alert"
                  >
                    {paymentLinkState.error}
                  </span>
                )}
                {state.error && (
                  <span
                    className="client-alert client-payment-alert"
                    role="alert"
                  >
                    {state.error}
                  </span>
                )}
              </p>
              <div className="tpbox">
                <div className="tpbox-con">
                  <form
                    id="make_payment_form"
                    key={paymentLinkState.booking?.booking_id || "direct"}
                    name="trips_additional_payment_groupm"
                    ref={formRef}
                    method="post"
                    action="make_payment_process.php"
                    className="form-horizontal"
                    encType="multipart/form-data"
                    data-submitting={state.loading ? "1" : "0"}
                    noValidate
                    onSubmit={submitPayment}
                  >
                    <input type="hidden" name="addi_pay_action" value="add" />
                    <input type="hidden" name="payment_type" value="trip" />
                    <ul className="form-table">
                      {paymentLinkState.booking ? (
                        <>
                          <li className="trip-lists">
                            <div className="ls">Booked Trip*:</div>
                            <div className="rs">
                              <input
                                name="text"
                                id="booked_trip"
                                type="text"
                                className="input_text"
                                size="30"
                                value={paymentLinkState.booking.trip_name}
                                readOnly
                              />
                              <input
                                type="hidden"
                                name="addi_trips_id"
                                value={paymentLinkState.booking.trip_id}
                              />
                            </div>
                          </li>
                          <li>
                            <div className="ls">Email Address*:</div>
                            <div className="rs">
                              <input
                                name="email_add"
                                id="email_add"
                                type="text"
                                className="input_text"
                                size="30"
                                value={paymentLinkState.booking.email}
                                readOnly
                                required
                              />
                            </div>
                          </li>
                          <li>
                            <div className="ls">Total Due Amount*:</div>
                            <div className="rs">
                              <input
                                type="text"
                                id="total_due"
                                size="30"
                                value={`$${paymentLinkState.booking.due}`}
                                className="input_text"
                                readOnly
                              />
                            </div>
                          </li>
                          {paymentLinkState.booking.type === "due" ? (
                            <li>
                              <div className="rs">
                                <input
                                  type="hidden"
                                  name="amount"
                                  id="amount"
                                  className="input_text"
                                  value={paymentLinkState.booking.due}
                                  readOnly
                                />
                              </div>
                            </li>
                          ) : (
                            <li>
                              <div className="ls">
                                {paymentLinkState.booking.type === "custom"
                                  ? "Enter Amount*:"
                                  : "Pay Amount*:"}
                              </div>
                              <div className="rs">
                                <input
                                  type="text"
                                  name="amount"
                                  id="amount"
                                  size="30"
                                  className="input_text"
                                  value={
                                    paymentLinkState.booking.type === "custom"
                                      ? undefined
                                      : Number(
                                          paymentLinkState.booking.amount,
                                        ).toFixed(2)
                                  }
                                  defaultValue={
                                    paymentLinkState.booking.type === "custom"
                                      ? ""
                                      : undefined
                                  }
                                  readOnly={
                                    paymentLinkState.booking.type ===
                                    "define_admin"
                                  }
                                  data-validation-engine={
                                    paymentLinkState.booking.type === "custom"
                                      ? "validate[required],custom[number]"
                                      : undefined
                                  }
                                />
                              </div>
                            </li>
                          )}
                        </>
                      ) : (
                        <>
                          <li className="trip-lists">
                            <label className="ls" htmlFor="addi_trips_id">
                              Select Trip*
                            </label>
                            <div className="rs">
                              <select
                                name="addi_trips_id"
                                id="addi_trips_id"
                                className="select"
                                required
                                data-validation-engine="validate[required]"
                                defaultValue=""
                              >
                                <option value="">
                                  Please Select Your Trips
                                </option>
                                {tripTypes.map((tripType) => (
                                  <optgroup
                                    label={tripType.name}
                                    key={tripType.id}
                                  >
                                    {trips
                                      .filter(
                                        (trip) =>
                                          Number(
                                            trip.type_id || trip.trip_type_id,
                                          ) === Number(tripType.id),
                                      )
                                      .map((trip) => (
                                        <option value={trip.id} key={trip.id}>
                                          {trip.name}
                                        </option>
                                      ))}
                                  </optgroup>
                                ))}
                              </select>
                            </div>
                          </li>
                          <li>
                            <div className="ls">Email Address*:</div>
                            <div className="rs">
                              <input
                                name="email_add"
                                id="email_add"
                                type="text"
                                className="input_text"
                                size="30"
                                required
                                data-validation-engine="validate[required,custom[email]]"
                              />
                            </div>
                          </li>
                        </>
                      )}
                      {[
                        ["name_on_card", "Name on Card*:", "price_view"],
                        ["billing_address", "Billing Address*:"],
                        ["city", "City*:"],
                        ["state", "State*:"],
                        ["zipcode", "Zip Code*:"],
                      ].map(([name, label, wrapperId]) => (
                        <li key={name}>
                          <div className="ls">{label}</div>
                          <div className="rs" id={wrapperId}>
                            <input
                              type="text"
                              name={name}
                              id={name}
                              size="30"
                              className="input_text"
                              required
                              data-validation-engine="validate[required]"
                            />
                          </div>
                        </li>
                      ))}
                      {!paymentLinkState.booking && (
                        <li>
                          <div className="ls">Amount*:</div>
                          <div className="rs">
                            <input
                              type="text"
                              name="amount"
                              id="amount"
                              size="30"
                              className="input_text"
                              required
                              onKeyUp={(event) => {
                                event.currentTarget.value =
                                  event.currentTarget.value
                                    .replace(",", "")
                                    .replace("$", "");
                              }}
                              data-validation-engine="validate[required],custom[number]"
                            />
                          </div>
                        </li>
                      )}
                      <li>
                        <div className="ls">Credit Card Number*:</div>
                        <div className="rs">
                          <input
                            name="credit_card_number"
                            id="credit_card_number"
                            type="text"
                            className="input_text"
                            minLength="14"
                            maxLength="25"
                            autoComplete="off"
                            required
                            data-validation-engine="validate[required]"
                          />
                        </div>
                      </li>
                      <li>
                        <div className="ls">Card Expiration Month*:</div>
                        <div className="rs">
                          <select
                            name="credit_card_expire_month"
                            id="credit_card_expire_month"
                            className="select_text"
                            required
                            data-validation-engine="validate[required]"
                            defaultValue=""
                          >
                            <option value="">
                              --- Select Expiration Month ---
                            </option>
                            {months.map((month) => (
                              <option value={month.slice(0, 2)} key={month}>
                                {month}
                              </option>
                            ))}
                          </select>
                        </div>
                      </li>
                      <li>
                        <div className="ls">Card Expiration Year*:</div>
                        <div className="rs">
                          <select
                            name="credit_card_expire_year"
                            id="credit_card_expire_year"
                            className="select_text"
                            required
                            data-validation-engine="validate[required]"
                            defaultValue=""
                          >
                            <option value="">
                              --- Select Expiration Year ---
                            </option>
                            {years.map((year) => (
                              <option value={year} key={year}>
                                {year}
                              </option>
                            ))}
                          </select>
                        </div>
                      </li>
                      <li>
                        <div className="ls">Credit Card CVV Number*:</div>
                        <div className="rs">
                          <input
                            name="credit_card_cvv_number"
                            id="credit_card_cvv_number"
                            type="password"
                            className="input_text"
                            minLength="3"
                            maxLength="4"
                            required
                            data-validation-engine="validate[required]"
                          />
                        </div>
                      </li>
                      {import.meta.env.VITE_ENABLE_RECAPTCHA !== "false" && (
                        <li>
                          <div
                            className="g-recaptcha"
                            data-sitekey={RECAPTCHA_SITE_KEY}
                          />
                        </li>
                      )}
                    </ul>
                    <p align="center">
                      <input
                        type="hidden"
                        name="addi_pay_submit"
                        value="Make Payment"
                      />
                      <button
                        type="submit"
                        className="buttan btn btn-primary"
                        disabled={
                          state.loading ||
                          paymentLinkState.loading ||
                          (Boolean(bookingId) &&
                            (!paymentLinkState.booking ||
                              Boolean(paymentLinkState.error)))
                        }
                      >
                        {state.loading ? "Submitting..." : "Make Payment"}
                      </button>
                    </p>
                  </form>
                  <div className="clear" />
                </div>
              </div>
            </div>
            <div className="clearfix">
              <div className="booking_tips">
                <h3>3 Ways to Reserve Your Trip:</h3>
                <ol className="numberLst">
                  <li>
                    <strong>Book online</strong> with your Visa, MasterCard,
                    American Express or Discover credit card. We will confirm
                    your reservation via e-mail within one business day.
                  </li>
                  <li>
                    <strong>Call us</strong> at 1-801-226-9026 with your credit
                    card information. We will confirm your reservation
                    immediately over the phone, M-F 8:00 am - 4:00 pm, Mountain
                    Time
                  </li>
                  <li>
                    <strong>E-mail us</strong> at{" "}
                    <a href="mailto:info@alpenwild.com">info@alpenwild.com</a>{" "}
                    to make your deposit by check. We will hold your place and
                    reply via e-mail within one business day. Your check must be
                    received within 7 business days to confirm your reservation.
                  </li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PublicStaticPage() {
  const { slug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [page, setPage] = useState(null);
  const [footerMenus, setFooterMenus] = useState([]);
  const [publicSettings, setPublicSettings] = useState({});
  const [categories, setCategories] = useState([]);
  const [tripTypes, setTripTypes] = useState([]);
  const [trips, setTrips] = useState([]);
  const [tripGalleries, setTripGalleries] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    const requests = [
      fetch(`/api/public-static-pages/${encodeURIComponent(slug)}`).then(
        (response) => {
          if (!response.ok) throw new Error("Unable to load this page.");
          return response.json();
        },
      ),
      fetch("/api/footer-menus").then((response) => response.json()),
      fetch("/api/public-settings").then((response) => response.json()),
    ];
    requests.push(
      slug === "maps-books-for-your-switzerland-adventure"
        ? fetch("/api/public-categories").then((response) => response.json())
        : Promise.resolve([]),
      ["book-your-trip", "make-a-payment", "videos"].includes(slug)
        ? fetch("/api/trip-types").then((response) => response.json())
        : Promise.resolve([]),
      ["book-your-trip", "make-a-payment", "videos"].includes(slug)
        ? fetch("/api/trips").then((response) => response.json())
        : Promise.resolve([]),
      slug === "testimonials"
        ? fetch("/api/testimonials").then((response) =>
            response.ok ? response.json() : [],
          )
        : Promise.resolve([]),
      slug === "videos"
        ? fetch("/api/trip-galleries").then((response) => response.json())
        : Promise.resolve([]),
    );
    Promise.all(requests)
      .then(
        ([
          pageData,
          footerData,
          settingsData,
          categoryData = [],
          tripTypeData = [],
          tripData = [],
          testimonialData = [],
          tripGalleryData = [],
        ]) => {
          if (cancelled) return;
          setPage(pageData);
          setFooterMenus(Array.isArray(footerData) ? footerData : []);
          setPublicSettings(
            settingsData && typeof settingsData === "object"
              ? settingsData
              : {},
          );
          const categoryRows = Array.isArray(categoryData)
            ? categoryData
            : Array.isArray(categoryData?.categories)
              ? categoryData.categories
              : [];
          setCategories(
            slug === "maps-books-for-your-switzerland-adventure"
              ? categoryRows.filter(
                  (category) =>
                    String(category.status).toLowerCase() === "active",
                )
              : [],
          );
          setTripTypes(
            ["book-your-trip", "make-a-payment", "videos"].includes(slug) &&
              Array.isArray(tripTypeData)
              ? tripTypeData
                  .filter((item) => item.status === "Active")
                  .sort((first, second) => Number(first.id) - Number(second.id))
              : [],
          );
          setTrips(
            ["book-your-trip", "make-a-payment", "videos"].includes(slug) &&
              Array.isArray(tripData)
              ? tripData
                  .filter((item) => item.status === "Active")
                  .sort(
                    (first, second) =>
                      Number(first.display_order) -
                        Number(second.display_order) ||
                      Number(first.id) - Number(second.id),
                  )
              : [],
          );
          setTripGalleries(
            slug === "videos" && Array.isArray(tripGalleryData)
              ? tripGalleryData
              : [],
          );
          setTestimonials(
            slug === "testimonials" && Array.isArray(testimonialData)
              ? testimonialData.filter((item) => item.status === "Active")
              : [],
          );
        },
      )
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
    if (!page) return undefined;
    document.title = page.meta_title || `${page.name} | Alpenwild`;
    return () => {
      document.title = "Alpenwild";
    };
  }, [page]);

  const boxImages = page?.box_images || [];
  const showCategoryListing = String(page?.id) === "1673";
  const videoGroups = buildPublicVideoGroups(tripTypes, trips, tripGalleries);

  function handleTripSelection(event) {
    const slugValue = event.target.value;
    if (slugValue) navigate(`/trip/${encodeURIComponent(slugValue)}/booking/`);
  }

  function handleContentClick(event) {
    const link = event.target.closest("a");
    if (!link || link.target === "_blank") return;
    const url = new URL(link.href, window.location.origin);
    if (url.origin !== window.location.origin) return;
    if (
      !/^\/(trip|triptype|staticpage|tour-calendar|product|cart|checkout|shop)(\/|$)/.test(
        url.pathname,
      )
    )
      return;
    event.preventDefault();
    navigate(`${url.pathname}${url.search}${url.hash}`);
  }

  return (
    <div className="public-site">
      <PublicHeader />
      {loading && <PublicLoader />}
      <div className="section static_page">
        <div className="container">
          <div className="row">
            <div className="col-xs-12 title">
              <h1>{page?.name || "Page"}</h1>
            </div>
            {page?.social_sharing_display === "Yes" && (
              <div
                className="col-md-12 clearfix"
                style={{ margin: "0 0 20px 0" }}
              >
                <div
                  className="main-share-div clearfix"
                  style={{ margin: "20px 0 0" }}
                >
                  <div className="share-tools">
                    <div className="addthis_inline_share_toolbox" />
                  </div>
                  <div className="like-tools">
                    <div
                      className="fb-like"
                      data-href="https://www.facebook.com/travelswitzerland/"
                      data-width="100"
                      data-layout="button_count"
                      data-action="like"
                      data-size="large"
                      data-show-faces="false"
                      data-share="false"
                    />
                  </div>
                </div>
              </div>
            )}
            {error && (
              <div className="col-md-12 col-sm-12 col-xs-12">
                <div className="client-alert">{error}</div>
              </div>
            )}
            {!error && page?.description && (
              <div
                className="col-md-12 col-sm-12 col-xs-12"
                onClick={handleContentClick}
                dangerouslySetInnerHTML={{
                  __html: localizeRichContent(page.description),
                }}
              />
            )}
            {slug === "testimonials" && testimonials.length > 0 && (
              <div className="col-md-12 col-sm-12 col-xs-12">
                <div className="client-testimonials-list">
                  {testimonials.map((testimonial, index) => (
                    <blockquote
                      className={index % 2 === 0 ? "even" : "odd"}
                      key={testimonial.id}
                    >
                      <p>{testimonial.content}</p>
                      <p>
                        <cite>{testimonial.client_details}</cite>
                      </p>
                    </blockquote>
                  ))}
                </div>
              </div>
            )}
            {slug === "videos" && (
              <div className="col-md-12 col-sm-12 col-xs-12 no-padding">
                <div className="col-xs-12 title">
                  <h2>Gallery</h2>
                </div>
                {videoGroups.map((tripType) => (
                  <React.Fragment key={tripType.id}>
                    <div className="col-xs-12 title">
                      <h3>{tripType.menu_name || tripType.name}</h3>
                    </div>
                    {tripType.trips.flatMap((trip) =>
                      trip.videos.map((video) => {
                        const videoId = youtubeVideoId(video.video_url);
                        const imageUrl =
                          video.image_url ||
                          `https://i.ytimg.com/vi/${videoId}/0.jpg`;
                        return (
                          <div
                            className="col-md-3 col-sm-4 col-xs-12 gallery gridCol"
                            key={video.id}
                          >
                            <div
                              className="trip_type clearfix"
                              style={{ height: "260px" }}
                            >
                              <div className="trip_img">
                                <a
                                  href={`https://www.youtube.com/embed/${videoId}`}
                                  data-rel="lightcase:myCollection"
                                >
                                  <img
                                    src={thumbnailAssetUrl(imageUrl, 270, 183)}
                                    alt={video.image_alt || ""}
                                  />
                                  <i
                                    className="fa fa-youtube-play"
                                    aria-hidden="true"
                                  />
                                </a>
                              </div>
                              <div className="trip_info">
                                <p>{video.title || trip.name}</p>
                              </div>
                            </div>
                          </div>
                        );
                      }),
                    )}
                  </React.Fragment>
                ))}
              </div>
            )}
            {String(page?.id) === "3903" && <PublicContestPage />}
            {slug === "book-your-trip" && (
              <div className="col-md-12 col-sm-12 col-xs-12">
                <div className="client-book-trip-selector">
                  <label htmlFor="book-trip-select">Select Trip:</label>
                  <select
                    id="book-trip-select"
                    defaultValue=""
                    onChange={handleTripSelection}
                  >
                    <option value="">Please Select Your Trip</option>
                    {tripTypes.map((tripType) => {
                      const typeTrips = trips.filter(
                        (trip) =>
                          Number(trip.type_id || trip.trip_type_id) ===
                          Number(tripType.id),
                      );
                      return (
                        <optgroup label={tripType.name} key={tripType.id}>
                          {typeTrips.map((trip) => (
                            <option value={trip.slug} key={trip.id}>
                              {trip.name}
                            </option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                </div>
              </div>
            )}
            {slug === "make-a-payment" && (
              <PaymentForm
                tripTypes={tripTypes}
                trips={trips}
                navigate={navigate}
                search={location.search}
              />
            )}
          </div>
          {showCategoryListing && (
            <div className="row clearfix">
              {categories.length > 0 ? (
                categories.map((category) => (
                  <div
                    className="col-md-3 col-sm-4 col-xs-12"
                    key={category.id}
                  >
                    <div className="prdctBox mHeight">
                      <figure className="prdctImg">
                        {category.listing_image_url && (
                          <img
                            src={thumbnailAssetUrl(
                              category.listing_thumbnail_url ||
                                category.listing_image_url,
                              270,
                              183,
                            )}
                            alt={category.name}
                          />
                        )}
                      </figure>
                      <div className="prdctDetails">
                        <h2 className="prdctTitle">{category.name}</h2>
                        <Link
                          className="btn btn-default"
                          to={`/category/${encodeURIComponent(category.slug)}`}
                        >
                          Details
                        </Link>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-md-3 col-sm-4 col-xs-12">
                  <div className="prdctBox mHeight">
                    <div className="prdctDetails">
                      <h2 className="prdctTitle">
                        Sorry, no information found for this store page.
                      </h2>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {boxImages.length > 0 && (
        <section className="section enjoyBox">
          <div className="container">
            <div className="clearfix">
              <div className="col-xs-12 title">
                <h2>You May Also Enjoy</h2>
              </div>
              {boxImages.map((box) => {
                const link = localAppLink(box.link) || box.link || "#";
                const CardLink = link.startsWith("/") ? Link : "a";
                const linkProps =
                  CardLink === Link ? { to: link } : { href: link };
                return (
                  <div
                    className="col-md-3 col-sm-4 col-xs-12 gridCol"
                    key={box.id}
                  >
                    <div
                      className="trip_type clearfix"
                      style={{ height: "260px" }}
                    >
                      <CardLink {...linkProps}>
                        <div className="trip_img">
                          {box.image_url && (
                            <img
                              src={thumbnailAssetUrl(box.image_url, 270, 183)}
                              alt={box.image_alt || box.title || ""}
                            />
                          )}
                        </div>
                        <div className="trip_info">
                          <h2>{box.title}</h2>
                        </div>
                      </CardLink>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}
      <PublicFooterExtras publicSettings={publicSettings} />
      <PublicFooter footerMenus={footerMenus} />
    </div>
  );
}
