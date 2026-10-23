import React, { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { serializeComparableForm } from "@/lib/adminFormSnapshot";
import { FormGroup, SearchableSelect } from "@/components/admin/FormFields";
import RichTextEditor from "@/components/admin/RichTextEditor";
import { countries as countryNames } from "@/pages/admin/user/AddUserPage";

const emptyForm = {
  user_email_address: "",
  trips_id: "",
  trips_date_id: "",
  party_number: 1,
  first_name: "",
  last_name: "",
  preferred_name: "",
  street_address: "",
  street_address1: "",
  city: "",
  state: "",
  postal_code: "",
  country: "UNITED STATES",
  day_phone: "",
  mobile_phone: "",
  date_of_birth: "1934-01-01",
  gender: "",
  shipping_first_name: "",
  shipping_last_name: "",
  shipping_street_address: "",
  shipping_street_address1: "",
  shipping_city: "",
  shipping_state: "",
  shipping_postal_code: "",
  shipping_country: "UNITED STATES",
  physical_medical_conditions: "",
  dietary_restrictions: "",
  special_dietary_requirements: "",
  hear_about_us: "",
  special_comments: "",
  flight_arrival_details: "",
  flight_departure_details: "",
  booking_start_date: "",
  booking_end_date: "",
  rooming_preference: "",
  bed_preference: "",
  initial_booking_amount: "",
  single_supplement_booking_amount: "",
  deposit_amount: "",
  trip_payment_due: "",
  discount_code: "",
  credit_card_type: "",
  credit_card_number: "",
  credit_card_expire_month: "",
  credit_card_expire_year: "",
  credit_card_cvv_number: "",
  shipping_same: false,
  email_subject: "Alpenwild Deposit Confirmation",
  email_message: "",
  send_email: false,
  admin_notes: "",
  additional_travelers: [],
  additional_prices: [],
};

const fields = [
  ["first_name", "First Name (as it appears on passport):"],
  ["last_name", "Last Name:"],
  ["preferred_name", "Preferred Name:"],
  ["day_phone", "Day Phone Number:"],
  ["mobile_phone", "Mobile Phone Number:"],
];

const billingAddressFields = [
  ["street_address", "Street Address:"],
  ["street_address1", "Street Address 2:"],
  ["city", "City:"],
  ["state", "State:"],
  ["postal_code", "Zip Code:"],
  ["country", "Country:"],
];

const bookingTextLabels = {
  physical_medical_conditions:
    "Physical or medical conditions (please specify who in your party this affects):",
  dietary_restrictions:
    "Dietary Restrictions and Allergies (please specify who in your party this affects):",
  special_dietary_requirements:
    "Dietary Requests (please specify who in your party this affects):",
  special_comments: "Special Comments & Questions:",
  flight_arrival_details: "Flight Arrival Details:",
  flight_departure_details: "Flight Departure Details:",
  admin_notes: "Admin Notes",
};

const bookingTextHelp = {
  physical_medical_conditions:
    "This will only be shared with your guide and must be disclosed for your safety.",
  dietary_restrictions: "e.g. peanut allergy, lactose intolerance, etc.",
  special_dietary_requirements:
    "e.g. vegetarian, no veal, gluten-free, no pork, no fish, etc",
  special_comments:
    "(Please tell us about any special accommodations, considerations, or requests our guides should be aware of. Likewise please let us know if you’re celebrating a particular event--anniversary, graduation, birthday, whatever!)",
  flight_arrival_details: "(Can be submitted later)",
  flight_departure_details: "(Can be submitted later)",
};

const shippingLabels = {
  shipping_first_name: "First Name (as it appears on passport):",
  shipping_last_name: "Last Name:",
  shipping_street_address: "Street Address:",
  shipping_street_address1: "Street Address 2:",
  shipping_city: "City:",
  shipping_state: "State:",
  shipping_postal_code: "Zip Code:",
  shipping_country: "Country:",
};

const months = Array.from({ length: 12 }, (_, index) =>
  String(index + 1).padStart(2, "0"),
);
const birthMonths = [
  ["01", "Jan"],
  ["02", "Feb"],
  ["03", "Mar"],
  ["04", "Apr"],
  ["05", "May"],
  ["06", "Jun"],
  ["07", "Jul"],
  ["08", "Aug"],
  ["09", "Sep"],
  ["10", "Oct"],
  ["11", "Nov"],
  ["12", "Dec"],
];
const cardMonths = [
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
const birthYears = Array.from({ length: 77 }, (_, index) =>
  String(1934 + index),
);
const years = Array.from({ length: 12 }, (_, index) => String(2020 + index));
const countries = countryNames.map((country) => country.toUpperCase());
const bookingNumberPattern = /^[+-]?((\d{1,3}(,\d{3})*)|\d+)?(\.\d+)?$/;
const bookingIntegerPattern = /^[+-]?\d+$/;
const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value).slice(0, 10)
    : date
        .toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
          timeZone: "UTC",
        })
        .replace(", ", ",");
};

function BookingValidationPrompt({ error, validationKey, onDismiss }) {
  return error ? (
    <button
      type="button"
      id={`booking-validation-${validationKey}`}
      className="booking-validation-prompt"
      data-booking-validation-prompt={validationKey}
      aria-label={`${error}. Dismiss message`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onDismiss}
    >
      {error}
    </button>
  ) : null;
}

function BookingField({
  label,
  validationKey,
  error,
  onDismiss,
  className = "",
  children,
}) {
  return (
    <FormGroup label={label}>
      <div
        className={`booking-validation-control${className ? ` ${className}` : ""}`}
        data-booking-validation={validationKey}
      >
        {children}
        <BookingValidationPrompt
          error={error}
          validationKey={validationKey}
          onDismiss={onDismiss}
        />
      </div>
    </FormGroup>
  );
}

function Input({
  form,
  update,
  name,
  label,
  type = "text",
  required = false,
  className = "",
  validationKey,
  error,
  onDismiss,
}) {
  if (name === "country" || name === "shipping_country") {
    return (
      <BookingField
        label={label}
        validationKey={validationKey}
        error={error}
        onDismiss={onDismiss}
      >
        <SearchableSelect
          bare
          label={label}
          required={required}
          value={form[name] ?? ""}
          onChange={(event) => update(name, event.target.value)}
          buttonProps={{
            "aria-invalid": Boolean(error),
            "aria-describedby": error
              ? `booking-validation-${validationKey}`
              : undefined,
          }}
        >
          {countries.map((country) => (
            <option key={country} value={country}>
              {country}
            </option>
          ))}
        </SearchableSelect>
      </BookingField>
    );
  }
  return (
    <BookingField
      label={label}
      className={className}
      validationKey={validationKey}
      error={error}
      onDismiss={onDismiss}
    >
      <input
        className="form-control"
        type={type}
        placeholder="Enter ..."
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={
          error ? `booking-validation-${validationKey}` : undefined
        }
        value={form[name] ?? ""}
        onChange={(event) => update(name, event.target.value)}
      />
    </BookingField>
  );
}

function BookingSelect({
  label,
  value,
  onChange,
  required = false,
  validationKey,
  error,
  onDismiss,
  children,
}) {
  return (
    <BookingField
      label={label}
      validationKey={validationKey}
      error={error}
      onDismiss={onDismiss}
    >
      <SearchableSelect
        bare
        label={label}
        value={value}
        onChange={onChange}
        required={required}
        buttonProps={{
          "aria-invalid": Boolean(error),
          "aria-describedby": error
            ? `booking-validation-${validationKey}`
            : undefined,
        }}
      >
        {children}
      </SearchableSelect>
    </BookingField>
  );
}

function getBookingFieldError(form, field, selectedTrip) {
  const requiredFields = new Set([
    "user_email_address",
    "trips_id",
    "first_name",
    "last_name",
    "street_address",
    "city",
    "state",
    "postal_code",
    "country",
    "shipping_first_name",
    "shipping_last_name",
    "shipping_street_address",
    "shipping_city",
    "shipping_state",
    "shipping_postal_code",
    "shipping_country",
    "initial_booking_amount",
    "single_supplement_booking_amount",
    "email_subject",
    "email_message",
  ]);
  if (
    (field === "booking_start_date" || field === "booking_end_date") &&
    selectedTrip?.available_for !== "Specefic Date"
  ) {
    requiredFields.add(field);
  }

  if (requiredFields.has(field)) {
    const value =
      field === "email_message"
        ? String(form.email_message || "")
            .replace(/<[^>]*>/g, "")
            .replace(/&nbsp;|&#160;/gi, "")
            .trim()
        : String(form[field] ?? "").trim();
    if (!value) return "* This field is required";
  }

  if (field === "user_email_address") {
    const email = String(form.user_email_address ?? "").trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return "* Enter a valid email address";
  }

  if (
    field === "trips_date_id" &&
    selectedTrip?.available_for === "Specefic Date"
  ) {
    if (!String(form.trips_date_id ?? "").trim())
      return "* Please select a trip date range";
  }

  const additionalPriceMatch = field.match(
    /^additional_prices\.(\d+)\.(description|price|quantity|sign)$/,
  );
  if (additionalPriceMatch) {
    const [, indexValue, priceField] = additionalPriceMatch;
    const price = form.additional_prices?.[Number(indexValue)];
    const value = String(price?.[priceField] ?? "").trim();
    if (!value) return "* This field is required";
    if (priceField === "price") {
      const numericValue = Number(value.replaceAll(",", ""));
      if (!bookingNumberPattern.test(value) || !Number.isFinite(numericValue))
        return "* Enter a valid price";
      if (numericValue < 0) return "* Price cannot be negative";
    }
    if (priceField === "quantity" && !bookingIntegerPattern.test(value))
      return "* Enter a whole number";
  }

  if (
    ["initial_booking_amount", "single_supplement_booking_amount"].includes(
      field,
    )
  ) {
    const value = String(form[field] ?? "").trim();
    if (
      value &&
      (!bookingNumberPattern.test(value) ||
        !Number.isFinite(Number(value.replaceAll(",", ""))))
    )
      return "* Enter a valid amount";
  }
  if (field === "deposit_amount") {
    const value = String(form.deposit_amount ?? "").trim();
    if (
      value &&
      (!bookingNumberPattern.test(value) ||
        !Number.isFinite(Number(value.replaceAll(",", ""))))
    )
      return "* Enter a valid amount";
  }

  return "";
}

const stepOneBookingFields = ["user_email_address", "trips_id"];
const stepTwoBookingFields = [
  "trips_date_id",
  "booking_start_date",
  "booking_end_date",
  "first_name",
  "last_name",
  "street_address",
  "city",
  "state",
  "postal_code",
  "country",
  "shipping_first_name",
  "shipping_last_name",
  "shipping_street_address",
  "shipping_city",
  "shipping_state",
  "shipping_postal_code",
  "shipping_country",
  "initial_booking_amount",
  "single_supplement_booking_amount",
  "deposit_amount",
  "email_subject",
  "email_message",
];

export default function AddTripBookingPage({ cancel, onSaved, bookingId }) {
  const [form, setForm] = useState(emptyForm);
  const [options, setOptions] = useState({ trips: [], discounts: [] });
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadingUser, setLoadingUser] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [validationErrors, setValidationErrors] = useState({});
  const formRef = useRef(null);
  const editSnapshot = useRef(null);
  const savingRef = useRef(false);
  const update = (name, value) =>
    setForm((current) => ({ ...current, [name]: value }));

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadFailed(false);
    setError("");
    editSnapshot.current = null;
    setForm(emptyForm);
    setStep(1);
    Promise.all([
      api("/api/trip-bookings/options"),
      api("/api/email-templates"),
      bookingId
        ? api(`/api/trip-bookings/${bookingId}`)
        : Promise.resolve(null),
    ])
      .then(([data, templates, booking]) => {
        if (!active) return;
        const templateRows = Array.isArray(templates)
          ? templates
          : templates?.rows;
        const bookingTemplate = Array.isArray(templateRows)
          ? templateRows.find((template) => Number(template.id) === 6)
          : null;
        setOptions({
          trips: Array.isArray(data?.trips) ? data.trips : [],
          discounts: Array.isArray(data?.discounts) ? data.discounts : [],
        });
        const values = {
          ...emptyForm,
          email_subject: bookingTemplate?.subject || emptyForm.email_subject,
          email_message: bookingTemplate?.body || emptyForm.email_message,
          ...(booking || {}),
        };
        setForm(values);
        editSnapshot.current = booking ? serializeComparableForm(values) : null;
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message);
        setLoadFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [bookingId]);

  async function lookupUser() {
    if (!form.user_email_address) return;
    setLoadingUser(true);
    setError("");
    try {
      const user = await api(
        `/api/trip-bookings/user?email=${encodeURIComponent(form.user_email_address)}`,
      );
      if (user) setForm((current) => ({ ...current, ...user }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingUser(false);
    }
  }

  const getStepErrors = (currentStep) => {
    const selected = options.trips.find(
      (trip) => String(trip.id) === String(form.trips_id),
    );
    const fields =
      currentStep === 1 ? stepOneBookingFields : stepTwoBookingFields;
    const errors = {};
    for (const field of fields) {
      const fieldError = getBookingFieldError(form, field, selected);
      if (fieldError) errors[field] = fieldError;
    }
    if (currentStep === 2) {
      (form.additional_prices || []).forEach((_, index) => {
        for (const field of ["description", "price", "quantity", "sign"]) {
          const key = `additional_prices.${index}.${field}`;
          const fieldError = getBookingFieldError(form, key, selected);
          if (fieldError) errors[key] = fieldError;
        }
      });
    }
    return errors;
  };

  const focusFirstInvalidField = (errors) => {
    const field = Object.keys(errors)[0];
    if (!field) return;
    const element = formRef.current?.querySelector(
      `[data-booking-validation="${field}"]`,
    );
    element?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    const focusTarget = element?.matches("input, select, textarea, button")
      ? element
      : element?.querySelector("input, select, textarea, button");
    focusTarget?.focus();
  };

  const validateStep = (currentStep) => {
    const errors = getStepErrors(currentStep);
    setValidationErrors(errors);
    if (Object.keys(errors).length) focusFirstInvalidField(errors);
    return errors;
  };

  const handleFieldBlur = (event) => {
    const wrapper = event.target.closest?.("[data-booking-validation]");
    const field = wrapper?.getAttribute("data-booking-validation");
    if (!field || wrapper.contains(event.relatedTarget)) return;
    const selected = options.trips.find(
      (trip) => String(trip.id) === String(form.trips_id),
    );
    const fieldError = getBookingFieldError(form, field, selected);
    setValidationErrors((current) => {
      if (current[field] === fieldError) return current;
      const next = { ...current };
      if (fieldError) next[field] = fieldError;
      else delete next[field];
      return next;
    });
  };

  const dismissFieldError = (field) => {
    setValidationErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const handlePromptClick = (event) => {
    const prompt = event.target.closest?.("[data-booking-validation-prompt]");
    const field = prompt?.getAttribute("data-booking-validation-prompt");
    if (field) dismissFieldError(field);
  };
  const fieldValidationProps = (field) => ({
    validationKey: field,
    error: validationErrors[field],
    onDismiss: () => dismissFieldError(field),
  });

  async function save(event) {
    event.preventDefault();
    if (savingRef.current) return;
    setError("");
    if (Object.keys(validateStep(2)).length) return;
    if (!form.email_subject.trim()) {
      setError("Subject is required.");
      return;
    }
    if (!form.email_message.replace(/<[^>]*>/g, "").trim()) {
      setError("Email Message is required.");
      return;
    }
    if (bookingId && editSnapshot.current === serializeComparableForm(form)) {
      onSaved?.("Sorry, nothing is updated.");
      return;
    }
    const sendEmail = event.nativeEvent.submitter?.value === "Submit Send";
    savingRef.current = true;
    setSaving(true);
    try {
      const saved = await api(
        bookingId ? `/api/trip-bookings/${bookingId}` : "/api/trip-bookings",
        {
          method: bookingId ? "PATCH" : "POST",
          body: {
            ...form,
            trips_date_id: form.trips_date_id || undefined,
            credit_card_expire_year: form.credit_card_expire_year || undefined,
            send_email: sendEmail || form.send_email,
            payment_amount: 0,
            credit_card_last_four: form.credit_card_number.slice(-4),
          },
        },
      );
      onSaved?.(
        [
          bookingId
            ? "Trip booking updated successfully."
            : "Trip booking created successfully.",
          saved?.emailWarning,
        ]
          .filter(Boolean)
          .join(" "),
      );
      if (!bookingId) {
        setForm(emptyForm);
        setStep(1);
      }
    } catch (err) {
      if (
        err.field &&
        formRef.current?.querySelector(
          `[data-booking-validation="${err.field}"]`,
        )
      ) {
        const fieldErrors = { [err.field]: err.message };
        setValidationErrors((current) => ({ ...current, ...fieldErrors }));
        focusFirstInvalidField(fieldErrors);
      } else {
        setError(err.message);
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const selectedTrip = options.trips.find(
    (trip) => String(trip.id) === String(form.trips_id),
  );
  const selectedDate = selectedTrip?.dates?.find(
    (date) => String(date.id) === String(form.trips_date_id),
  );
  const additional = form.additional_travelers || [];
  const additionalPrices = form.additional_prices || [];
  const tripGroups = options.trips.reduce((groups, trip) => {
    const label = trip.type_name || "Trip";
    const group = groups.find((item) => item.label === label);
    if (group) group.trips.push(trip);
    else groups.push({ label, trips: [trip] });
    return groups;
  }, []);
  const setAdditional = (index, name, value) =>
    update(
      "additional_travelers",
      additional.map((item, i) =>
        i === index ? { ...item, [name]: value } : item,
      ),
    );
  const setAdditionalPrice = (index, name, value) =>
    update(
      "additional_prices",
      additionalPrices.map((item, i) =>
        i === index ? { ...item, [name]: value } : item,
      ),
    );

  if (loading || loadFailed) {
    return (
      <section className="admin-box box-primary form-panel trip-booking-form">
        <div className="box-header with-border">
          <h3 className="box-title">
            {bookingId ? "Edit Trip Booking" : "Add Trip Booking"}
          </h3>
        </div>
        <div className="box-body">
          {loading ? (
            <p role="status">Loading booking details...</p>
          ) : (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="admin-box box-primary form-panel trip-booking-form">
      <div className="box-header with-border">
        <h3 className="box-title">
          {bookingId ? "Edit Trip Booking" : "Add Trip Booking"}
        </h3>
      </div>
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
      <form
        ref={formRef}
        onSubmit={save}
        onBlurCapture={handleFieldBlur}
        onClickCapture={handlePromptClick}
        className="form-horizontal"
        role="form"
        noValidate
      >
        {step === 1 ? (
          <div className="box-body">
            {/* <div className="full repeat-form-heading"><h4>Booking Selection</h4></div> */}
            <BookingField
              label="Email Address"
              {...fieldValidationProps("user_email_address")}
            >
              <input
                className="form-control"
                type="text"
                required
                name="user_email_address"
                value={form.user_email_address}
                onChange={(e) => update("user_email_address", e.target.value)}
                onBlur={lookupUser}
                aria-invalid={Boolean(validationErrors.user_email_address)}
                aria-describedby={
                  validationErrors.user_email_address
                    ? "booking-validation-user_email_address"
                    : undefined
                }
              />
            </BookingField>
            <BookingSelect
              label="Trip"
              required
              {...fieldValidationProps("trips_id")}
              value={form.trips_id}
              name="trips_id"
              onChange={(e) => {
                update("trips_id", e.target.value);
                update("trips_date_id", "");
              }}
            >
              <option value="">Please Select Your Trip</option>
              {tripGroups.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.trips.map((trip) => (
                    <option key={trip.id} value={trip.id}>
                      {trip.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </BookingSelect>
            <BookingSelect
              label="Number in party"
              value={form.party_number}
              onChange={(e) => update("party_number", Number(e.target.value))}
            >
              {Array.from({ length: 10 }, (_, index) => index + 1).map(
                (number) => (
                  <option key={number} value={number}>
                    {number} person{number > 1 ? "s" : ""}
                  </option>
                ),
              )}
            </BookingSelect>
            {loadingUser && (
              <p className="full cell-muted">Looking up existing customer...</p>
            )}
            <div className="full form-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setError("");
                  if (Object.keys(validateStep(1)).length) return;
                  setForm((current) => ({
                    ...current,
                    initial_booking_amount:
                      current.initial_booking_amount ||
                      String(
                        Math.ceil(
                          Number(selectedTrip?.price || 0) *
                            Number(current.party_number || 1),
                        ),
                      ),
                    single_supplement_booking_amount:
                      current.single_supplement_booking_amount ||
                      String(
                        Math.ceil(Number(selectedTrip?.single_price || 0)),
                      ),
                    additional_travelers: Array.from(
                      {
                        length: Math.max(
                          Number(current.party_number || 1) - 1,
                          0,
                        ),
                      },
                      (_, index) =>
                        current.additional_travelers?.[index] || {
                          first_name: "",
                          last_name: "",
                          preferred_name: "",
                          email_address: "",
                          mobile_phone: "",
                          date_of_birth: "",
                          gender: "",
                        },
                    ),
                  }));
                  setStep(2);
                }}
              >
                {bookingId ? "Next" : "Submit"}
              </button>
            </div>
          </div>
        ) : (
          <div className="box-body">
            <BookingSelect
              label="Select Range:"
              required
              {...fieldValidationProps("trips_date_id")}
              value={form.trips_date_id}
              onChange={(e) => {
                const date = selectedTrip?.dates?.find(
                  (item) => String(item.id) === e.target.value,
                );
                update("trips_date_id", e.target.value);
                update(
                  "booking_start_date",
                  date?.start_date?.slice(0, 10) || "",
                );
                update("booking_end_date", date?.end_date?.slice(0, 10) || "");
                update(
                  "initial_booking_amount",
                  date
                    ? Number(date.price || 0) * Number(form.party_number || 1)
                    : "",
                );
                update(
                  "single_supplement_booking_amount",
                  date?.single_price ?? "",
                );
              }}
            >
              <option value="">--- Please Select Range ---</option>
              {selectedTrip?.dates?.map((date) => (
                <option key={date.id} value={date.id}>
                  {formatDate(date.start_date)} - {formatDate(date.end_date)}
                </option>
              ))}
            </BookingSelect>
            {selectedTrip?.available_for !== "Specefic Date" && (
              <>
                <Input
                  form={form}
                  update={update}
                  name="booking_start_date"
                  label="Trips Start Date:"
                  type="date"
                  required
                  {...fieldValidationProps("booking_start_date")}
                />
                <Input
                  form={form}
                  update={update}
                  name="booking_end_date"
                  label="Trips End Date:"
                  type="date"
                  required
                  {...fieldValidationProps("booking_end_date")}
                />
              </>
            )}
            <div className="full booking-section-heading">
              <h4>User&apos;s Billing Information:</h4>
            </div>
            <FormGroup label="Gender:">
              <div className="radio">
                <div className="radio-option">
                  <input
                    type="radio"
                    name="gender"
                    value="Male"
                    id="gender-male"
                    checked={form.gender === "Male"}
                    onChange={(event) => update("gender", event.target.value)}
                  />
                  <label
                    key="Male"
                    htmlFor="gender-male"
                    style={{ paddingLeft: 0 }}
                  >
                    Male
                  </label>
                </div>
                <div className="radio-option">
                  <input
                    type="radio"
                    name="gender"
                    value="Female"
                    id="gender-female"
                    checked={form.gender === "Female"}
                    onChange={(event) => update("gender", event.target.value)}
                  />
                  <label
                    key="Female"
                    htmlFor="gender-female"
                    style={{ paddingLeft: 0 }}
                  >
                    Female
                  </label>
                </div>
                {/* {["Male", "Female"].map((value) => (
                ))} */}
              </div>
            </FormGroup>
            {fields.map(([name, label]) => (
              <Input
                key={name}
                form={form}
                update={update}
                name={name}
                label={label}
                required={[
                  "first_name",
                  "last_name",
                  "city",
                  "country",
                ].includes(name)}
                {...(["first_name", "last_name"].includes(name)
                  ? fieldValidationProps(name)
                  : {})}
              />
            ))}
            <FormGroup label="Date Of Birth:">
              <div className="row booking-date-selects">
                <div className="col-sm-4">
                  <SearchableSelect
                    bare
                    value={form.date_of_birth?.slice(5, 7) || ""}
                    onChange={(event) => {
                      const date = form.date_of_birth || "1934-01-01";
                      update(
                        "date_of_birth",
                        `${date.slice(0, 4)}-${event.target.value}-${date.slice(8, 10)}`,
                      );
                    }}
                  >
                    {birthMonths.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </SearchableSelect>
                </div>
                <div className="col-sm-4">
                  <SearchableSelect
                    bare
                    value={form.date_of_birth?.slice(8, 10) || ""}
                    onChange={(event) => {
                      const date = form.date_of_birth || "1934-01-01";
                      update(
                        "date_of_birth",
                        `${date.slice(0, 4)}-${date.slice(5, 7)}-${event.target.value}`,
                      );
                    }}
                  >
                    {Array.from({ length: 31 }, (_, index) =>
                      String(index + 1).padStart(2, "0"),
                    ).map((day) => (
                      <option key={day}>{Number(day)}</option>
                    ))}
                  </SearchableSelect>
                </div>
                <div className="col-sm-4">
                  <SearchableSelect
                    bare
                    value={form.date_of_birth?.slice(0, 4) || ""}
                    onChange={(event) => {
                      const date = form.date_of_birth || "1934-01-01";
                      update(
                        "date_of_birth",
                        `${event.target.value}-${date.slice(5, 7)}-${date.slice(8, 10)}`,
                      );
                    }}
                  >
                    {birthYears.map((year) => (
                      <option key={year}>{year}</option>
                    ))}
                  </SearchableSelect>
                </div>
              </div>
            </FormGroup>
            {billingAddressFields.map(([name, label]) => (
              <Input
                key={name}
                form={form}
                update={update}
                name={name}
                label={label}
                required={[
                  "street_address",
                  "city",
                  "state",
                  "postal_code",
                  "country",
                ].includes(name)}
                {...([
                  "street_address",
                  "city",
                  "state",
                  "postal_code",
                  "country",
                ].includes(name)
                  ? fieldValidationProps(name)
                  : {})}
              />
            ))}
            <div className="full booking-section-heading">
              <h4>User&apos;s Shipping Information:</h4>
            </div>
            <FormGroup label=" " className="booking-same-address">
              <input
                className="booking-checkbox"
                type="checkbox"
                id="same_shipping"
                checked={form.shipping_same}
                onChange={(event) => {
                  const checked = event.target.checked;
                  update("shipping_same", checked);
                  if (checked) {
                    setForm((current) => ({
                      ...current,
                      shipping_same: true,
                      shipping_first_name: current.first_name,
                      shipping_last_name: current.last_name,
                      shipping_street_address: current.street_address,
                      shipping_street_address1: current.street_address1,
                      shipping_city: current.city,
                      shipping_state: current.state,
                      shipping_postal_code: current.postal_code,
                      shipping_country: current.country,
                    }));
                  }
                }}
              />
              <label htmlFor="same_shipping" style={{ fontWeight: "normal" }}>
                Same as billing address
              </label>
            </FormGroup>
            {[
              "shipping_first_name",
              "shipping_last_name",
              "shipping_street_address",
              "shipping_street_address1",
              "shipping_city",
              "shipping_state",
              "shipping_postal_code",
              "shipping_country",
            ].map((name) => (
              <Input
                key={name}
                form={form}
                update={update}
                name={name}
                label={shippingLabels[name]}
                required={[
                  "shipping_first_name",
                  "shipping_last_name",
                  "shipping_street_address",
                  "shipping_city",
                  "shipping_state",
                  "shipping_postal_code",
                  "shipping_country",
                ].includes(name)}
                {...([
                  "shipping_first_name",
                  "shipping_last_name",
                  "shipping_street_address",
                  "shipping_city",
                  "shipping_state",
                  "shipping_postal_code",
                  "shipping_country",
                ].includes(name)
                  ? fieldValidationProps(name)
                  : {})}
              />
            ))}
            {Number(form.party_number) > 1 && (
              <div className="full repeat-form-heading">
                <h4>Guest Information:</h4>
              </div>
            )}
            {Number(form.party_number) > 1 &&
              additional.map((traveler, index) => (
                <div className="full repeat-row" key={traveler.id || index}>
                  <div className="full repeat-form-heading">
                    <h4>Guest {index + 1}:</h4>
                  </div>
                  <Input
                    form={traveler}
                    update={(name, value) => setAdditional(index, name, value)}
                    name="first_name"
                    label="First Name (as it appears on passport):"
                  />
                  <Input
                    form={traveler}
                    update={(name, value) => setAdditional(index, name, value)}
                    name="last_name"
                    label="Last Name (as it appears on passport):"
                  />
                  <Input
                    form={traveler}
                    update={(name, value) => setAdditional(index, name, value)}
                    name="email_address"
                    label="Email"
                    type="email"
                  />
                  <Input
                    form={traveler}
                    update={(name, value) => setAdditional(index, name, value)}
                    name="preferred_name"
                    label="Preferred Name"
                  />
                  <BookingSelect
                    label="Gender:"
                    value={traveler.gender || ""}
                    onChange={(e) =>
                      setAdditional(index, "gender", e.target.value)
                    }
                  >
                    <option value="">Select</option>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </BookingSelect>
                  <Input
                    form={traveler}
                    update={(name, value) => setAdditional(index, name, value)}
                    name="mobile_phone"
                    label="Mobile No.:"
                  />
                  <Input
                    form={traveler}
                    update={(name, value) => setAdditional(index, name, value)}
                    name="date_of_birth"
                    label="Date of Birth:"
                    type="date"
                  />
                </div>
              ))}
            <div className="full booking-section-heading">
              <h4>Rooming Information:</h4>
            </div>
            <BookingSelect
              label="Rooming Preference:"
              value={form.rooming_preference}
              onChange={(e) => update("rooming_preference", e.target.value)}
            >
              <option value="">--- Please Select Rooming Preference ---</option>
              <option>Single occupancy</option>
              <option>Double occupancy</option>
              <option>Triple occupancy</option>
            </BookingSelect>
            {form.rooming_preference !== "Single occupancy" && (
              <BookingSelect
                label="Bed Preference:"
                value={form.bed_preference}
                onChange={(e) => update("bed_preference", e.target.value)}
              >
                <option value="">--- Please Select Bed Preference ---</option>
                <option>Two beds</option>
                <option>One bed</option>
              </BookingSelect>
            )}
            <div className="full booking-section-heading">
              <h4>Special/Additional Information:</h4>
            </div>
            {[
              "physical_medical_conditions",
              "dietary_restrictions",
              "special_dietary_requirements",
            ].map((name) => (
              <FormGroup label={bookingTextLabels[name]} key={name}>
                <textarea
                  className="form-control"
                  placeholder={form[name] ? "Enter ..." : "N/A"}
                  cols="30"
                  value={form[name] || ""}
                  onChange={(e) => update(name, e.target.value)}
                />
                {bookingTextHelp[name] && (
                  <small>{bookingTextHelp[name]}</small>
                )}
              </FormGroup>
            ))}
            <BookingSelect
              label="How did you hear about us?:"
              value={form.hear_about_us}
              onChange={(e) => update("hear_about_us", e.target.value)}
            >
              <option value="">**Please choose one of the following**</option>
              <option>Traveled with us previously</option>
              <option value="friend">From a friend</option>
              <option value="Alpenwild internet ad">
                Internet ads for Alpenwild
              </option>
              <option value="Alpenwild web search">
                Internet search results for Alpenwild
              </option>
              <option value="Social media site">
                Internet - Social media sites (YouTube, Facebook, etc.)
              </option>
              <option value="Alpenwild e-Newsletter">
                Alpenwild e-Newsletter
              </option>
              <option>Other</option>
            </BookingSelect>
            {[
              "special_comments",
              "flight_arrival_details",
              "flight_departure_details",
            ].map((name) => (
              <FormGroup label={bookingTextLabels[name]} key={name}>
                <textarea
                  className="form-control"
                  placeholder={form[name] ? "Enter ..." : "N/A"}
                  cols="30"
                  value={form[name] || ""}
                  onChange={(e) => update(name, e.target.value)}
                />
                {bookingTextHelp[name] && (
                  <small>{bookingTextHelp[name]}</small>
                )}
              </FormGroup>
            ))}
            <div className="full booking-section-heading">
              <h4>Initial Booking Price Information:</h4>
            </div>
            <Input
              form={form}
              update={update}
              name="initial_booking_amount"
              label="Initial Booking Amount:"
              type="text"
              required
              {...fieldValidationProps("initial_booking_amount")}
            />
            <Input
              form={form}
              update={update}
              name="single_supplement_booking_amount"
              label="Single Supplement Booking Amount:"
              type="text"
              required
              {...fieldValidationProps("single_supplement_booking_amount")}
            />
            <div className="full booking-additional-price-section">
              <div className="booking-additional-price-heading">
                {/* <label className="control-label">
                  Additional Price Information:
                </label> */}
                <h4>Additional Price Information:</h4>
              </div>
              {additionalPrices.map((item, index) => (
                <div
                  className="booking-additional-price-row form-group"
                  key={item.id || index}
                >
                  <label
                    className="control-label col-sm-2"
                    htmlFor={`additional-price-description-${index}`}
                  >
                    Description
                  </label>
                  <div className="booking-additional-price-cell booking-additional-price-description col-sm-2">
                    <div
                      className="booking-validation-control"
                      data-booking-validation={`additional_prices.${index}.description`}
                    >
                      <input
                        id={`additional-price-description-${index}`}
                        className="form-control"
                        required
                        aria-invalid={Boolean(
                          validationErrors[
                            `additional_prices.${index}.description`
                          ],
                        )}
                        value={item.description || ""}
                        onChange={(event) =>
                          setAdditionalPrice(
                            index,
                            "description",
                            event.target.value,
                          )
                        }
                      />
                      <BookingValidationPrompt
                        error={
                          validationErrors[
                            `additional_prices.${index}.description`
                          ]
                        }
                        validationKey={`additional_prices.${index}.description`}
                        onDismiss={() =>
                          dismissFieldError(
                            `additional_prices.${index}.description`,
                          )
                        }
                      />
                    </div>
                  </div>
                  <label
                    className="control-label col-sm-1"
                    htmlFor={`additional-price-amount-${index}`}
                  >
                    Price
                  </label>
                  <div className="booking-additional-price-cell booking-additional-price-amount col-sm-2">
                    <div
                      className="booking-validation-control"
                      data-booking-validation={`additional_prices.${index}.price`}
                    >
                      <input
                        id={`additional-price-amount-${index}`}
                        className="form-control"
                        type="text"
                        required
                        aria-invalid={Boolean(
                          validationErrors[`additional_prices.${index}.price`],
                        )}
                        value={item.price ?? ""}
                        onChange={(event) =>
                          setAdditionalPrice(index, "price", event.target.value)
                        }
                      />
                      <BookingValidationPrompt
                        error={
                          validationErrors[`additional_prices.${index}.price`]
                        }
                        validationKey={`additional_prices.${index}.price`}
                        onDismiss={() =>
                          dismissFieldError(`additional_prices.${index}.price`)
                        }
                      />
                    </div>
                  </div>
                  <label
                    className="control-label col-sm-1"
                    htmlFor={`additional-price-quantity-${index}`}
                  >
                    Quantity
                  </label>
                  <div className="booking-additional-price-cell booking-additional-price-quantity col-sm-2">
                    <div
                      className="booking-validation-control"
                      data-booking-validation={`additional_prices.${index}.quantity`}
                    >
                      <input
                        id={`additional-price-quantity-${index}`}
                        className="form-control"
                        type="text"
                        required
                        aria-invalid={Boolean(
                          validationErrors[
                            `additional_prices.${index}.quantity`
                          ],
                        )}
                        value={item.quantity ?? ""}
                        onChange={(event) =>
                          setAdditionalPrice(
                            index,
                            "quantity",
                            event.target.value,
                          )
                        }
                      />
                      <BookingValidationPrompt
                        error={
                          validationErrors[
                            `additional_prices.${index}.quantity`
                          ]
                        }
                        validationKey={`additional_prices.${index}.quantity`}
                        onDismiss={() =>
                          dismissFieldError(
                            `additional_prices.${index}.quantity`,
                          )
                        }
                      />
                    </div>
                  </div>
                  <div className="booking-additional-price-cell booking-additional-price-operator col-sm-1">
                    <div
                      className="booking-validation-control"
                      data-booking-validation={`additional_prices.${index}.sign`}
                    >
                      <select
                        className="form-control"
                        aria-label="Additional price operator"
                        required
                        aria-invalid={Boolean(
                          validationErrors[`additional_prices.${index}.sign`],
                        )}
                        value={item.sign || ""}
                        onChange={(event) =>
                          setAdditionalPrice(index, "sign", event.target.value)
                        }
                      >
                        <option value="">Select Operator</option>
                        <option value="+">+</option>
                        <option value="-">-</option>
                      </select>
                      <BookingValidationPrompt
                        error={
                          validationErrors[`additional_prices.${index}.sign`]
                        }
                        validationKey={`additional_prices.${index}.sign`}
                        onDismiss={() =>
                          dismissFieldError(`additional_prices.${index}.sign`)
                        }
                      />
                    </div>
                  </div>
                  <div className="booking-additional-price-cell booking-additional-price-remove col-sm-1">
                    <button
                      type="button"
                      onClick={() =>
                        update(
                          "additional_prices",
                          additionalPrices.filter(
                            (_, itemIndex) => itemIndex !== index,
                          ),
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              <div className="booking-additional-price-add-row form-group">
                <label htmlFor="" className="col-sm-2"></label>
                <div className="col-sm-10">
                  <button
                    type="button"
                    className="btn btn-default"
                    onClick={() =>
                      update("additional_prices", [
                        ...additionalPrices,
                        { description: "", price: "", quantity: "", sign: "" },
                      ])
                    }
                  >
                    Add more
                  </button>
                </div>
              </div>
            </div>
            <BookingSelect
              label="Select Discount:"
              value={form.discount_code}
              onChange={(e) => update("discount_code", e.target.value)}
            >
              <option value="">--- Please Discount ---</option>
              {options.discounts.map((discount) => (
                <option key={discount.id} value={discount.code}>
                  {discount.name} ({discount.code})
                </option>
              ))}
            </BookingSelect>
            {bookingId && (
              <div className="full booking-deposit-row form-group">
                <label className="col-sm-2 control-label">
                  Deposit Amount:
                </label>
                <div className="col-sm-6">
                  <div
                    className="booking-validation-control"
                    data-booking-validation="deposit_amount"
                  >
                    <input
                      className="form-control"
                      type="text"
                      placeholder="Enter ..."
                      aria-invalid={Boolean(validationErrors.deposit_amount)}
                      aria-describedby={
                        validationErrors.deposit_amount
                          ? "booking-validation-deposit_amount"
                          : undefined
                      }
                      value={form.deposit_amount ?? ""}
                      onChange={(event) =>
                        update("deposit_amount", event.target.value)
                      }
                    />
                    <BookingValidationPrompt
                      error={validationErrors.deposit_amount}
                      validationKey="deposit_amount"
                      onDismiss={() => dismissFieldError("deposit_amount")}
                    />
                  </div>
                </div>
                <label
                  className="col-sm-4 control-label booking-total-due"
                  style={{
                    textAlign: "left",
                    fontWeight: "bold",
                  }}
                >
                  Total Due: ${Number(form.trip_payment_due || 0).toFixed(2)}
                </label>
              </div>
            )}
            <div className="full booking-section-heading">
              <h4>Client&apos;s Payment Information:</h4>
            </div>
            <Input
              form={form}
              update={update}
              name="credit_card_number"
              label="Credit Card Number:"
            />
            <BookingSelect
              label="Card Expiration Month:"
              value={form.credit_card_expire_month}
              onChange={(e) =>
                update("credit_card_expire_month", e.target.value)
              }
            >
              <option value="">Select</option>
              {cardMonths.map((month) => (
                <option key={month} value={month.slice(0, 2)}>
                  {month}
                </option>
              ))}
            </BookingSelect>
            <BookingSelect
              label="Card Expiration Year:"
              value={form.credit_card_expire_year}
              onChange={(e) =>
                update("credit_card_expire_year", e.target.value)
              }
            >
              <option value="">Select</option>
              {years.map((year) => (
                <option key={year}>{year}</option>
              ))}
            </BookingSelect>
            <Input
              form={form}
              update={update}
              name="credit_card_cvv_number"
              label="Credit Card CVV Number:"
            />
            <Input
              form={form}
              update={update}
              name="email_subject"
              label="Subject:"
              required
              {...fieldValidationProps("email_subject")}
            />
            <BookingField
              label="Email Message"
              {...fieldValidationProps("email_message")}
            >
              <RichTextEditor
                value={form.email_message}
                onChange={(value) => update("email_message", value)}
                onBlur={(value) =>
                  setValidationErrors((current) => {
                    const fieldError = getBookingFieldError(
                      { ...form, email_message: value },
                      "email_message",
                      selectedTrip,
                    );
                    const next = { ...current };
                    if (fieldError) next.email_message = fieldError;
                    else delete next.email_message;
                    return next;
                  })
                }
              />
            </BookingField>
            <FormGroup label="Admin Notes">
              <textarea
                className="form-control"
                cols="30"
                style={{ height: "55px" }}
                value={form.admin_notes}
                onChange={(e) => update("admin_notes", e.target.value)}
              />
            </FormGroup>
            <div className="full booking-submit-actions">
              <div
                className="pull-left"
                style={{ display: "flex", gap: "8px" }}
              >
                <button
                  type="button"
                  className="btn btn-default"
                  onClick={() => setStep(1)}
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Submit"}
                </button>
              </div>
              <button
                type="submit"
                className="btn btn-primary pull-right"
                name="submit"
                value="Submit Send"
                disabled={saving}
              >
                {saving ? "Saving..." : "Submit and Send"}
              </button>
            </div>
          </div>
        )}
      </form>
    </section>
  );
}
