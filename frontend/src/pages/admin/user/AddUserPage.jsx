import React, { useRef, useState } from "react";
import { FormGroup } from "@/components/admin/FormFields";

const requiredFields = [
  "user_first_name",
  "user_last_name",
  "user_preferred_name",
  "user_day_phone",
  "user_mobile_phone",
  "user_email_address",
  "user_street_address",
  "user_country",
  "user_state",
  "user_city",
  "user_postal_code",
  "user_shipping_email_address",
  "user_shipping_first_name",
  "user_shipping_last_name",
  "user_shipping_street_address",
  "user_shipping_country",
  "user_shipping_state",
  "user_shipping_city",
  "user_shipping_postal_code",
];

function ValidationPrompt({ error, field, onDismiss }) {
  return error ? (
    <button
      type="button"
      id={`user-validation-${field}`}
      className="user-validation-prompt"
      data-user-validation-prompt={field}
      aria-label={`${error}. Dismiss message`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onDismiss}
    >
      {error}
    </button>
  ) : null;
}

export const countries = [
  "Afghanistan",
  "Albania",
  "Algeria",
  "American Samoa",
  "Andorra",
  "Angola",
  "Anguilla",
  "Antarctica",
  "Antigua and Barbuda",
  "Argentina",
  "Armenia",
  "Aruba",
  "Australia",
  "Austria",
  "Azerbaijan",
  "Bahamas",
  "Bahrain",
  "Bangladesh",
  "Barbados",
  "Belarus",
  "Belgium",
  "Belize",
  "Benin",
  "Bermuda",
  "Bhutan",
  "Bolivia",
  "Bosnia and Herzegowina",
  "Botswana",
  "Bouvet Island",
  "Brazil",
  "British Indian Ocean Territory",
  "Brunei Darussalam",
  "Bulgaria",
  "Burkina Faso",
  "Burundi",
  "Cambodia",
  "Cameroon",
  "Canada",
  "Cape Verde",
  "Cayman Islands",
  "Central African Republic",
  "Chad",
  "Chile",
  "China",
  "Christmas Island",
  "Cocos (Keeling) Islands",
  "Colombia",
  "Comoros",
  "Congo",
  "Congo, the Democratic Republic of the",
  "Cook Islands",
  "Costa Rica",
  "Cote d'Ivoire",
  "Croatia (Hrvatska)",
  "Cuba",
  "Cyprus",
  "Czech Republic",
  "Denmark",
  "Djibouti",
  "Dominica",
  "Dominican Republic",
  "East Timor",
  "Ecuador",
  "Egypt",
  "El Salvador",
  "Equatorial Guinea",
  "Eritrea",
  "Estonia",
  "Ethiopia",
  "Falkland Islands (Malvinas)",
  "Faroe Islands",
  "Fiji",
  "Finland",
  "France",
  "France Metropolitan",
  "French Guiana",
  "French Polynesia",
  "French Southern Territories",
  "Gabon",
  "Gambia",
  "Georgia",
  "Germany",
  "Ghana",
  "Gibraltar",
  "Greece",
  "Greenland",
  "Grenada",
  "Guadeloupe",
  "Guam",
  "Guatemala",
  "Guinea",
  "Guinea-Bissau",
  "Guyana",
  "Haiti",
  "Heard and Mc Donald Islands",
  "Holy See (Vatican City State)",
  "Honduras",
  "Hong Kong",
  "Hungary",
  "Iceland",
  "India",
  "Indonesia",
  "Iran (Islamic Republic of)",
  "Iraq",
  "Ireland",
  "Israel",
  "Italy",
  "Jamaica",
  "Japan",
  "Jordan",
  "Kazakhstan",
  "Kenya",
  "Kiribati",
  "Korea, Democratic People's Republic of",
  "Korea, Republic of",
  "Kuwait",
  "Kyrgyzstan",
  "Lao, People's Democratic Republic",
  "Latvia",
  "Lebanon",
  "Lesotho",
  "Liberia",
  "Libyan Arab Jamahiriya",
  "Liechtenstein",
  "Lithuania",
  "Luxembourg",
  "Macau",
  "Macedonia, The Former Yugoslav Republic of",
  "Madagascar",
  "Malawi",
  "Malaysia",
  "Maldives",
  "Mali",
  "Malta",
  "Marshall Islands",
  "Martinique",
  "Mauritania",
  "Mauritius",
  "Mayotte",
  "Mexico",
  "Micronesia, Federated States of",
  "Moldova, Republic of",
  "Monaco",
  "Mongolia",
  "Montserrat",
  "Morocco",
  "Mozambique",
  "Myanmar",
  "Namibia",
  "Nauru",
  "Nepal",
  "Netherlands",
  "Netherlands Antilles",
  "New Caledonia",
  "New Zealand",
  "Nicaragua",
  "Niger",
  "Nigeria",
  "Niue",
  "Norfolk Island",
  "Northern Mariana Islands",
  "Norway",
  "Oman",
  "Pakistan",
  "Palau",
  "Panama",
  "Papua New Guinea",
  "Paraguay",
  "Peru",
  "Philippines",
  "Pitcairn",
  "Poland",
  "Portugal",
  "Puerto Rico",
  "Qatar",
  "Reunion",
  "Romania",
  "Russian Federation",
  "Rwanda",
  "Saint Kitts and Nevis",
  "Saint Lucia",
  "Saint Vincent and the Grenadines",
  "Samoa",
  "San Marino",
  "Sao Tome and Principe",
  "Saudi Arabia",
  "Senegal",
  "Seychelles",
  "Sierra Leone",
  "Singapore",
  "Slovakia (Slovak Republic)",
  "Slovenia",
  "Solomon Islands",
  "Somalia",
  "South Africa",
  "South Georgia and the South Sandwich Islands",
  "Spain",
  "Sri Lanka",
  "St. Helena",
  "St. Pierre and Miquelon",
  "Sudan",
  "Suriname",
  "Svalbard and Jan Mayen Islands",
  "Swaziland",
  "Sweden",
  "Switzerland",
  "Syrian Arab Republic",
  "Taiwan, Province of China",
  "Tajikistan",
  "Tanzania, United Republic of",
  "Thailand",
  "Togo",
  "Tokelau",
  "Tonga",
  "Trinidad and Tobago",
  "Tunisia",
  "Turkey",
  "Turkmenistan",
  "Turks and Caicos Islands",
  "Tuvalu",
  "Uganda",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "United States Minor Outlying Islands",
  "Uruguay",
  "Uzbekistan",
  "Vanuatu",
  "Venezuela",
  "Vietnam",
  "Virgin Islands (British)",
  "Virgin Islands (U.S.)",
  "Wallis and Futuna Islands",
  "Western Sahara",
  "Yemen",
  "Yugoslavia",
  "Zambia",
  "Zimbabwe",
];

function TextField({
  form,
  update,
  field,
  label,
  required = false,
  type = "text",
  validationError = "",
  onDismiss,
}) {
  return (
    <FormGroup label={label}>
      <div className="user-validation-control" data-user-validation={field}>
        <input
          id={field}
          name={field}
          className="form-control"
          type={type}
          placeholder="Enter ..."
          required={required}
          aria-invalid={Boolean(validationError)}
          aria-describedby={
            validationError ? `user-validation-${field}` : undefined
          }
          value={form[field] || ""}
          onChange={(event) => {
            onDismiss?.();
            update(field, event.target.value);
          }}
        />
        <ValidationPrompt
          error={validationError}
          field={field}
          onDismiss={onDismiss}
        />
      </div>
    </FormGroup>
  );
}

function CountryField({
  form,
  update,
  field,
  label,
  required = false,
  validationError = "",
  onDismiss,
}) {
  return (
    <FormGroup label={label}>
      <div className="user-validation-control" data-user-validation={field}>
        <select
          id={field}
          name={field}
          className="form-control"
          required={required}
          aria-invalid={Boolean(validationError)}
          aria-describedby={
            validationError ? `user-validation-${field}` : undefined
          }
          value={form[field] || ""}
          onChange={(event) => {
            onDismiss?.();
            update(field, event.target.value);
          }}
        >
          <option value="">Select</option>
          {countries.map((country) => (
            <option key={country} value={country.toUpperCase()}>
              {country.toUpperCase()}
            </option>
          ))}
        </select>
        <ValidationPrompt
          error={validationError}
          field={field}
          onDismiss={onDismiss}
        />
      </div>
    </FormGroup>
  );
}

export default function AddUserPage({ form, editingId, update, save, cancel }) {
  const formRef = useRef(null);
  const [validationErrors, setValidationErrors] = useState({});

  function validateField(field) {
    return requiredFields.includes(field) && !String(form[field] ?? "").trim()
      ? "* This field is required"
      : "";
  }

  function dismissError(field) {
    setValidationErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleBlur(event) {
    const control = event.target.closest?.("[data-user-validation]");
    const field = control?.getAttribute("data-user-validation");
    if (!field || control.contains(event.relatedTarget)) return;
    const error = validateField(field);
    setValidationErrors((current) => {
      const next = { ...current };
      if (error) next[field] = error;
      else delete next[field];
      return next;
    });
  }

  function handleSubmit(event) {
    event.preventDefault();
    const errors = Object.fromEntries(
      requiredFields
        .map((field) => [field, validateField(field)])
        .filter(([, error]) => error),
    );
    setValidationErrors(errors);
    const firstInvalid = requiredFields.find((field) => errors[field]);
    if (firstInvalid) {
      const control = formRef.current?.querySelector(
        `[data-user-validation="${firstInvalid}"]`,
      );
      control?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      control?.querySelector("input, select")?.focus();
      return;
    }
    save(event);
  }

  return (
    <div className="admin-row">
      <div className="admin-col-full">
        <section className="admin-box box-primary form-panel">
          <div className="box-header with-border">
            <h3 className="box-title">
              {editingId ? "Edit User" : "Add User"}
            </h3>
          </div>
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            onBlurCapture={handleBlur}
            onClickCapture={(event) => {
              const prompt = event.target.closest?.(
                "[data-user-validation-prompt]",
              );
              const field = prompt?.getAttribute("data-user-validation-prompt");
              if (field) dismissError(field);
            }}
            className="form-horizontal user-form"
            role="form"
            noValidate
          >
            <div className="box-body">
              <FormGroup label="Gender">
                <div className="radio user-gender-options">
                  {["Male", "Female"].map((gender) => (
                    <label key={gender} className="user-gender-option">
                      <input
                        type="radio"
                        name="user_gender"
                        value={gender}
                        checked={form.user_gender === gender}
                        onChange={() => update("user_gender", gender)}
                      />{" "}
                      {gender}
                    </label>
                  ))}
                </div>
              </FormGroup>
              <TextField
                form={form}
                update={update}
                field="user_first_name"
                label="First Name"
                required
                validationError={validationErrors.user_first_name}
                onDismiss={() => dismissError("user_first_name")}
              />
              <TextField
                form={form}
                update={update}
                field="user_last_name"
                label="Last Name"
                required
                validationError={validationErrors.user_last_name}
                onDismiss={() => dismissError("user_last_name")}
              />
              <TextField
                form={form}
                update={update}
                field="user_preferred_name"
                label="Preferred Name"
                required
                validationError={validationErrors.user_preferred_name}
                onDismiss={() => dismissError("user_preferred_name")}
              />
              <TextField
                form={form}
                update={update}
                field="user_day_phone"
                label="Day Phone Number"
                required
                validationError={validationErrors.user_day_phone}
                onDismiss={() => dismissError("user_day_phone")}
              />
              <TextField
                form={form}
                update={update}
                field="user_mobile_phone"
                label="Mobile Phone Number"
                required
                validationError={validationErrors.user_mobile_phone}
                onDismiss={() => dismissError("user_mobile_phone")}
              />
              <TextField
                form={form}
                update={update}
                field="user_email_address"
                label="Email Address"
                required
                validationError={validationErrors.user_email_address}
                onDismiss={() => dismissError("user_email_address")}
              />
              <TextField
                form={form}
                update={update}
                field="user_date_of_birth"
                label="Date Of Birth"
                type="date"
              />

              <TextField
                form={form}
                update={update}
                field="user_street_address"
                label="Street Address"
                required
              />
              <TextField
                form={form}
                update={update}
                field="user_street_address1"
                label="Street Address1"
              />
              <CountryField
                form={form}
                update={update}
                field="user_country"
                label="Country"
                required
                validationError={validationErrors.user_country}
                onDismiss={() => dismissError("user_country")}
              />
              <TextField
                form={form}
                update={update}
                field="user_state"
                label="State"
                required
                validationError={validationErrors.user_state}
                onDismiss={() => dismissError("user_state")}
              />
              <TextField
                form={form}
                update={update}
                field="user_city"
                label="City"
                required
                validationError={validationErrors.user_city}
                onDismiss={() => dismissError("user_city")}
              />
              <TextField
                form={form}
                update={update}
                field="user_postal_code"
                label="Post Code"
                required
                validationError={validationErrors.user_postal_code}
                onDismiss={() => dismissError("user_postal_code")}
              />

              <TextField
                form={form}
                update={update}
                field="user_shipping_email_address"
                label="Shipping Email Address"
                required
                validationError={validationErrors.user_shipping_email_address}
                onDismiss={() => dismissError("user_shipping_email_address")}
              />
              <TextField
                form={form}
                update={update}
                field="user_shipping_first_name"
                label="Shipping First Name"
                required
                validationError={validationErrors.user_shipping_first_name}
                onDismiss={() => dismissError("user_shipping_first_name")}
              />
              <TextField
                form={form}
                update={update}
                field="user_shipping_last_name"
                label="Shipping Last Name"
                required
                validationError={validationErrors.user_shipping_last_name}
                onDismiss={() => dismissError("user_shipping_last_name")}
              />
              <TextField
                form={form}
                update={update}
                field="user_shipping_street_address"
                label="Shipping Street Address"
                required
                validationError={validationErrors.user_shipping_street_address}
                onDismiss={() => dismissError("user_shipping_street_address")}
              />
              <TextField
                form={form}
                update={update}
                field="user_shipping_street_address1"
                label="Shipping Street Address1"
              />
              <CountryField
                form={form}
                update={update}
                field="user_shipping_country"
                label="Shipping Country"
                required
                validationError={validationErrors.user_shipping_country}
                onDismiss={() => dismissError("user_shipping_country")}
              />
              <TextField
                form={form}
                update={update}
                field="user_shipping_state"
                label="Shipping State"
                required
                validationError={validationErrors.user_shipping_state}
                onDismiss={() => dismissError("user_shipping_state")}
              />
              <TextField
                form={form}
                update={update}
                field="user_shipping_city"
                label="Shipping City"
                required
                validationError={validationErrors.user_shipping_city}
                onDismiss={() => dismissError("user_shipping_city")}
              />
              <TextField
                form={form}
                update={update}
                field="user_shipping_postal_code"
                label="Shipping Post Code"
                required
                validationError={validationErrors.user_shipping_postal_code}
                onDismiss={() => dismissError("user_shipping_postal_code")}
              />
            </div>
            <div className="box-footer form-actions">
              <button type="button" className="btn btn-default" onClick={cancel}>
                Cancel
              </button>
              <button className="btn btn-primary">
                {editingId ? "Update" : "Submit"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
