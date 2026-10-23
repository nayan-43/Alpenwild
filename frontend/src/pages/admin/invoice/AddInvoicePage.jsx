import React, { useRef, useState } from "react";
import RichTextEditor from "@/components/admin/RichTextEditor";
import { FormGroup, SearchableSelect } from "@/components/admin/FormFields";

const invoiceCountries = [
  "UNITED STATES",
  "ALAND ISLANDS",
  "ALBANIA",
  "ALGERIA",
  "AMERICAN SAMOA",
  "ANDORRA",
  "ANGOLA",
  "ANGUILLA",
  "ANTIGUA & BARBUDA",
  "ARGENTINA",
  "ARMENIA",
  "ARUBA",
  "AUSTRALIA",
  "AUSTRIA",
  "AZERBAIJAN",
  "AZORES",
  "BAHAMAS",
  "BAHRAIN",
  "BANGLADESH",
  "BARBADOS",
  "BELARUS",
  "BELGIUM",
  "BELIZE",
  "BENIN",
  "BERMUDA",
  "BHUTAN",
  "BOLIVIA",
  "BONAIRE",
  "BOSNIA",
  "BOTSWANA",
  "BRAZIL",
  "BRITISH VIRGIN ISLES",
  "BRUNEI",
  "BULGARIA",
  "BURKINA FASO",
  "BURUNDI",
  "CAMBODIA",
  "CAMEROON",
  "CANADA",
  "CANARY ISLANDS",
  "CAPE VERDE",
  "CAYMAN ISLANDS",
  "CENTRAL AFRICAN REPUBLIC",
  "CHAD",
  "CHILE",
  "CHINA",
  "COLOMBIA",
  "CONGO",
  "COOK ISLANDS",
  "COSTA RICA",
  "CROATIA",
  "CURACAO",
  "CYPRUS",
  "CZECH REPUBLIC",
  "DEMOCRATIC REPUBLIC OFCONGO",
  "DENMARK",
  "DJIBOUTI",
  "DOMINICA",
  "DOMINICAN REPUBLIC",
  "ECUADOR",
  "EGYPT",
  "EL SALVADOR",
  "ENGLAND",
  "EQUATORIAL GUINEA",
  "ERITREA",
  "ESTONIA",
  "ETHIOPIA",
  "FAEROE ISLANDS",
  "FIJI",
  "FINLAND",
  "FRANCE",
  "FRENCH GUIANA",
  "FRENCH POLYNESIA",
  "GABON",
  "GAMBIA",
  "GEORGIA",
  "GERMANY",
  "GHANA",
  "GIBRALTAR",
  "GREECE",
  "GREENLAND",
  "GRENADA",
  "GUADELOUPE",
  "GUAM",
  "GUATEMALA",
  "GUERNSEY",
  "GUINEA",
  "GUINEA-BISSAU",
  "GUYANA",
  "HAITI",
  "HOLLAND",
  "HONDURAS",
  "HONG KONG",
  "HUNGARY",
  "ICELAND",
  "INDIA",
  "INDONESIA",
  "IRAN",
  "IRAQ",
  "IRELAND",
  "ISRAEL",
  "ITALY",
  "IVORY COAST",
  "JAMAICA",
  "JAPAN",
  "JERSEY",
  "JORDAN",
  "KAZAKHSTAN",
  "KENYA",
  "KIRIBATI",
  "KOSRAE",
  "KUWAIT",
  "KYRGYZSTAN",
  "LAOS",
  "LATVIA",
  "LEBANON",
  "LESOTHO",
  "LIBERIA",
  "LIBYA",
  "LIECHTENSTEIN",
  "LITHUANIA",
  "LUXEMBOURG",
  "MACAU",
  "MACEDONIA(FYROM)",
  "MADAGASCAR",
  "MADEIRA",
  "MALAWI",
  "MALAYSIA",
  "MALDIVES",
  "MALI",
  "MALTA",
  "MARSHALL ISLANDS",
  "MARTINIQUE",
  "MAURITANIA",
  "MAURITIUS",
  "MEXICO",
  "MICRONESIA",
  "MOLDOVA",
  "MONACO",
  "MONGOLIA",
  "MONTSERRAT",
  "MOROCCO",
  "MOZAMBIQUE",
  "N. MARIANA ISLANDS",
  "NAMIBIA",
  "NEPAL",
  "NETHERLANDS",
  "NETHERLANDS ANTILLES",
  "NEW CALEDONIA",
  "NEW ZEALAND",
  "NICARAGUA",
  "NIGER",
  "NIGERIA",
  "NORFOLK ISLAND",
  "NORTHERN IRELAND",
  "NORWAY",
  "OMAN",
  "PAKISTAN",
  "PALAU",
  "PANAMA",
  "PAPUA NEW GUINEA",
  "PARAGUAY",
  "PERU",
  "PHILIPPINES",
  "POLAND",
  "PONAPE",
  "PORTUGAL",
  "PUERTO RICO",
  "QATAR",
  "REUNION",
  "ROMANIA",
  "ROTA",
  "RUSSIA",
  "RWANDA",
  "SABA",
  "SAIPAN",
  "SAN MARINO",
  "SAUDI ARABIA",
  "SCOTLAND",
  "SENEGAL",
  "SERBIA AND MONTENEGRO",
  "SEYCHELLES",
  "SIERRA LEONE",
  "SINGAPORE",
  "SLOVAKIA",
  "SLOVENIA",
  "SOLOMON ISLANDS",
  "SOUTH AFRICA",
  "SOUTH KOREA",
  "SPAIN",
  "SRI LANKA",
  "ST. BARTHELEMY",
  "ST. CHRISTOPHER",
  "ST. CROIX",
  "ST. EUSTATIUS",
  "ST. JOHN",
  "ST. KITTS & NEVIS",
  "ST. LUCIA",
  "ST. MAARTEN",
  "ST. MARTIN",
  "ST. THOMAS",
  "ST. VINCENT/GRENADINES",
  "SURINAME",
  "SWAZILAND",
  "SWEDEN",
  "SWITZERLAND",
  "SYRIA",
  "TAHITI",
  "TAIWAN",
  "TAJIKISTAN",
  "TANZANIA",
  "THAILAND",
  "TIMOR LESTE",
  "TINIAN",
  "TOGO",
  "TONGA",
  "TORTOLA",
  "TRINIDAD & TOBAGO",
  "TRUK",
  "TUNISIA",
  "TURKEY",
  "TURKMENISTAN",
  "TURKS & CAICOS ISLANDS",
  "TUVALU",
  "UGANDA",
  "UKRAINE",
  "UNION ISLAND",
  "UNITED ARAB EMIRATES",
  "UNITED KINGDOM",
  "URUGUAY",
  "US VIRGIN ISLANDS",
  "UZBEKISTAN",
  "VANUATU",
  "VATICAN CITY STATE",
  "VENEZUELA",
  "VIETNAM",
  "VIRGIN GORDA",
  "WALES",
  "WALLIS & FUTUNA ISLANDS",
  "WESTERN SAMOA",
  "YAP",
  "YEMEN",
  "ZAMBIA",
  "ZIMBABWE",
];

function ValidationPrompt({ error, field, onDismiss }) {
  return error ? (
    <button
      type="button"
      id={`invoice-validation-${field}`}
      className="invoice-validation-prompt"
      data-invoice-validation-prompt={field}
      aria-label={`${error}. Dismiss message`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onDismiss}
    >
      {error}
    </button>
  ) : null;
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function hasEditorText(value) {
  return (
    String(value ?? "")
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/gi, " ")
      .trim().length > 0
  );
}

export default function AddInvoicePage({
  form,
  editingId,
  update,
  updateItem,
  addItem,
  removeItem,
  save,
  cancel,
}) {
  const formRef = useRef(null);
  const [validationErrors, setValidationErrors] = useState({});

  function validateField(field) {
    if (field === "street_address1") return "";
    if (field.startsWith("item-")) {
      const [, indexText, property] = field.split("-");
      const item = form.items[Number(indexText)];
      const value = String(item?.[property] ?? "").trim();
      if (!value) return "* This field is required";
      if (property === "price" && !Number.isFinite(Number(value)))
        return "* Please enter a valid number";
      return "";
    }
    if (field === "email_message")
      return hasEditorText(form.email_message)
        ? ""
        : "* This field is required";
    const value = String(form[field] ?? "").trim();
    if (!value) return "* This field is required";
    if (["invoice_date", "due_date"].includes(field) && !isValidDate(value))
      return "* Please enter a valid date";
    if (field === "deposit_amount" && !Number.isFinite(Number(value)))
      return "* Please enter a valid number";
    return "";
  }

  function validateForm() {
    const fields = [
      "user_email_address",
      "first_name",
      "last_name",
      "day_phone",
      "street_address",
      "street_address1",
      "city",
      "state",
      "postal_code",
      "country",
      ...form.items.flatMap((_, index) => [
        `item-${index}-name`,
        `item-${index}-price`,
      ]),
      "deposit_amount",
      "invoice_date",
      "due_date",
      "email_subject",
      "email_message",
    ];
    return Object.fromEntries(
      fields
        .map((field) => [field, validateField(field)])
        .filter(([, error]) => error),
    );
  }

  function setFieldError(field) {
    const error = validateField(field);
    setValidationErrors((current) => {
      const next = { ...current };
      if (error) next[field] = error;
      else delete next[field];
      return next;
    });
  }

  function handleBlur(event) {
    const wrapper = event.target.closest?.("[data-invoice-validation]");
    const field = wrapper?.getAttribute("data-invoice-validation");
    if (
      !field ||
      (wrapper.contains(event.relatedTarget) &&
        !event.relatedTarget.matches?.("[data-invoice-validation-prompt]"))
    )
      return;
    setFieldError(field);
  }

  function dismissError(field) {
    setValidationErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleSubmit(event) {
    event.preventDefault();
    const errors = validateForm();
    setValidationErrors(errors);
    const firstInvalid = Object.keys(errors)[0];
    if (firstInvalid) {
      const wrapper = formRef.current?.querySelector(
        `[data-invoice-validation="${firstInvalid}"]`,
      );
      wrapper?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      const editorFrame = wrapper?.querySelector(".cke iframe");
      (
        editorFrame || wrapper?.querySelector("input, select, textarea, button")
      )?.focus();
      return;
    }
    save(event);
  }

  function control(field, child) {
    return (
      <div
        className="invoice-validation-control"
        data-invoice-validation={field}
      >
        {React.cloneElement(child, {
          "aria-invalid": Boolean(validationErrors[field]),
          "aria-describedby": validationErrors[field]
            ? `invoice-validation-${field}`
            : undefined,
        })}
        <ValidationPrompt
          error={validationErrors[field]}
          field={field}
          onDismiss={() => dismissError(field)}
        />
      </div>
    );
  }

  function handlePromptClick(event) {
    const prompt = event.target.closest?.("[data-invoice-validation-prompt]");
    const field = prompt?.getAttribute("data-invoice-validation-prompt");
    if (field) dismissError(field);
  }

  return (
    <section className="admin-box box-primary form-panel invoice-form">
      <div className="box-header with-border">
        <h2 className="box-title">{editingId ? "Edit" : "Add"} Invoice</h2>
      </div>
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        onBlurCapture={handleBlur}
        onClickCapture={handlePromptClick}
        className="form-horizontal"
        role="form"
        noValidate
      >
        <div className="box-body invoice-details">
          <FormGroup label="Email Address">
            {control(
              "user_email_address",
              <input
                className="form-control"
                placeholder="Enter ..."
                required
                value={form.user_email_address}
                onChange={(event) =>
                  update("user_email_address", event.target.value)
                }
              />,
            )}
          </FormGroup>
          <FormGroup label="First Name:">
            {control(
              "first_name",
              <input
                className="form-control"
                placeholder="Enter ..."
                required
                value={form.first_name}
                onChange={(event) => update("first_name", event.target.value)}
              />,
            )}
          </FormGroup>
          <FormGroup label="Last Name:">
            {control(
              "last_name",
              <input
                className="form-control"
                placeholder="Enter ..."
                required
                value={form.last_name}
                onChange={(event) => update("last_name", event.target.value)}
              />,
            )}
          </FormGroup>
          <FormGroup label="Day Phone Number:">
            {control(
              "day_phone",
              <input
                className="form-control"
                placeholder="Enter ..."
                required
                value={form.day_phone}
                onChange={(event) => update("day_phone", event.target.value)}
              />,
            )}
          </FormGroup>
          <FormGroup label="Street Address:">
            {control(
              "street_address",
              <input
                className="form-control"
                placeholder="Enter ..."
                required
                value={form.street_address}
                onChange={(event) =>
                  update("street_address", event.target.value)
                }
              />,
            )}
          </FormGroup>
          <FormGroup label="Street Address 2:">
            {control(
              "street_address1",
              <input
                className="form-control"
                placeholder="Enter ..."
                value={form.street_address1}
                onChange={(event) =>
                  update("street_address1", event.target.value)
                }
              />,
            )}
          </FormGroup>
          <FormGroup label="City:">
            {control(
              "city",
              <input
                className="form-control"
                placeholder="Enter ..."
                required
                value={form.city}
                onChange={(event) => update("city", event.target.value)}
              />,
            )}
          </FormGroup>
          <FormGroup label="State:">
            {control(
              "state",
              <input
                className="form-control"
                placeholder="Enter ..."
                required
                value={form.state}
                onChange={(event) => update("state", event.target.value)}
              />,
            )}
          </FormGroup>
          <FormGroup label="Zip Code:">
            {control(
              "postal_code",
              <input
                className="form-control"
                placeholder="Enter ..."
                required
                value={form.postal_code}
                onChange={(event) => update("postal_code", event.target.value)}
              />,
            )}
          </FormGroup>
          <FormGroup label="Country:">
            <div
              className="invoice-validation-control"
              data-invoice-validation="country"
            >
              <SearchableSelect
                bare
                label="Country"
                required
                value={form.country}
                onChange={(event) => {
                  update("country", event.target.value);
                  if (event.target.value) dismissError("country");
                }}
                buttonProps={{
                  "aria-invalid": Boolean(validationErrors.country),
                  "aria-describedby": validationErrors.country
                    ? "invoice-validation-country"
                    : undefined,
                }}
              >
                <option value="">Select Country</option>
                {invoiceCountries.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </SearchableSelect>
              <ValidationPrompt
                error={validationErrors.country}
                field="country"
                onDismiss={() => dismissError("country")}
              />
            </div>
          </FormGroup>
        </div>
        <div className="box-header with-border">
          <h3 className="box-title">Invoice Items</h3>
        </div>
        <div className="box-body invoice-items">
          {form.items.map((item, index) => (
            <div className="invoice-item" key={index}>
              <FormGroup label={`Item ${index + 1}`}>
                <div className="invoice-item-heading" />
              </FormGroup>
              <FormGroup label="Activity Name:">
                {control(
                  `item-${index}-name`,
                  <input
                    className="form-control"
                    placeholder="Enter ..."
                    required
                    value={item.name}
                    onChange={(event) =>
                      updateItem(index, "name", event.target.value)
                    }
                  />,
                )}
              </FormGroup>
              <FormGroup label="Activity Price:">
                {control(
                  `item-${index}-price`,
                  <input
                    className="form-control"
                    placeholder="Enter ..."
                    required
                    type="text"
                    inputMode="decimal"
                    value={item.price}
                    onChange={(event) =>
                      updateItem(index, "price", event.target.value)
                    }
                  />,
                )}
              </FormGroup>
              <FormGroup label="Quantity:">
                <select
                  className="form-control"
                  value={item.quantity}
                  onChange={(event) =>
                    updateItem(index, "quantity", event.target.value)
                  }
                >
                  {Array.from({ length: 10 }, (_, number) => (
                    <option key={number + 1} value={number + 1}>
                      {number + 1}
                    </option>
                  ))}
                </select>
              </FormGroup>
              <FormGroup label="">
                {form.items.length > 1 && (
                  <button
                    className="btn btn-default"
                    type="button"
                    onClick={() => removeItem(index)}
                  >
                    Remove
                  </button>
                )}
              </FormGroup>
            </div>
          ))}
          <FormGroup label="" className="invoice-add-row">
            <button className="btn btn-default" type="button" onClick={addItem}>
              Add New
            </button>
          </FormGroup>
        </div>
        <div className="box-body invoice-details">
          <FormGroup label="Deposit Amount:">
            {control(
              "deposit_amount",
              <input
                className="form-control"
                placeholder="Enter ..."
                required
                type="text"
                inputMode="decimal"
                value={form.deposit_amount}
                onChange={(event) =>
                  update("deposit_amount", event.target.value)
                }
              />,
            )}
          </FormGroup>
          <FormGroup label="Invoice Date:">
            {control(
              "invoice_date",
              <input
                className="form-control"
                placeholder="Enter ..."
                required
                type="date"
                value={form.invoice_date}
                onChange={(event) => update("invoice_date", event.target.value)}
              />,
            )}
          </FormGroup>
          <FormGroup label="Due Date:">
            {control(
              "due_date",
              <input
                className="form-control"
                placeholder="Enter ..."
                required
                type="date"
                value={form.due_date}
                onChange={(event) => update("due_date", event.target.value)}
              />,
            )}
          </FormGroup>
          <FormGroup label="Subject:">
            {control(
              "email_subject",
              <input
                className="form-control"
                placeholder="Enter ..."
                required
                value={form.email_subject}
                onChange={(event) =>
                  update("email_subject", event.target.value)
                }
              />,
            )}
          </FormGroup>
          <FormGroup label="Email Message">
            {control(
              "email_message",
              <RichTextEditor
                value={form.email_message}
                required
                onChange={(value) => update("email_message", value)}
                onBlur={() => setFieldError("email_message")}
              />,
            )}
          </FormGroup>
        </div>
        <div className="box-footer form-actions">
          <button type="button" className="btn btn-default" onClick={cancel}>
            Cancel
          </button>
          <button className="btn btn-primary" type="submit">
            {editingId ? "Update" : "Submit"}
          </button>
        </div>
      </form>
    </section>
  );
}
