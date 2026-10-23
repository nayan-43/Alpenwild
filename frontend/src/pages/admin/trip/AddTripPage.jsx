import React, { useRef, useState } from "react";
import RichTextEditor from "@/components/admin/RichTextEditor";
import { SearchableSelect } from "@/components/admin/FormFields";
import { adminThumbnailUrl } from "@/lib/assets";

const numberPattern = /^[+-]?((\d{1,3}(,\d{3})*)|\d+)?(\.\d+)?$/;
const integerPattern = /^[+-]?\d+$/;

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

const requiredTripFields = [
  "name",
  "type_id",
  "location_id",
  "menu_name",
  "meta_title",
  "meta_descriptions",
  "meta_keywords",
  "short_description",
  "description",
  "deposit_amount",
  "deposit_amount_text",
  "price",
  "single_price",
  "available_for",
  "days",
  "nights",
  "included",
  "excluded",
  "activity",
  "arrival",
  "departure",
  "pre_post_tour_travel",
  "accommodations",
  "meals",
  "order",
];

function validateTripForm(form) {
  const errors = {};
  for (const field of requiredTripFields) {
    if (String(form[field] ?? "").trim() === "")
      errors[field] =
        field === "available_for"
          ? "* Please select an option"
          : "* This field is required";
  }

  for (const field of [
    "deposit_amount",
    "price",
    "single_price",
    "days",
    "nights",
  ]) {
    if (!errors[field]) {
      const value = String(form[field] ?? "").trim();
      const numericValue = Number(value.replaceAll(",", ""));
      if (!numberPattern.test(value) || !Number.isFinite(numericValue))
        errors[field] = "* Invalid floating decimal number";
      else if (
        ["deposit_amount", "price", "single_price"].includes(field) &&
        numericValue < 0
      )
        errors[field] = "* The value must be zero or greater";
    }
  }

  for (const [index, date] of (form.dates || []).entries()) {
    const hasStartDate = String(date.start_date || "").trim() !== "";
    const hasEndDate = String(date.end_date || "").trim() !== "";
    if (!hasStartDate && !hasEndDate) continue;
    if (!hasStartDate)
      errors[`dates.${index}.start_date`] = "* This field is required";
    else if (!isValidDate(date.start_date))
      errors[`dates.${index}.start_date`] = "* Enter a valid date";
    if (!hasEndDate)
      errors[`dates.${index}.end_date`] = "* This field is required";
    else if (!isValidDate(date.end_date))
      errors[`dates.${index}.end_date`] = "* Enter a valid date";
    if (
      hasStartDate &&
      hasEndDate &&
      isValidDate(date.start_date) &&
      isValidDate(date.end_date) &&
      date.end_date < date.start_date
    )
      errors[`dates.${index}.end_date`] =
        "* End date must be on or after start date";
  }

  if (!errors.order) {
    const order = String(form.order ?? "").trim();
    if (!integerPattern.test(order)) errors.order = "* Not a valid integer";
    else if (Number(order) < 1) errors.order = "* The value must be at least 1";
  }

  for (const field of ["type_id", "location_id"]) {
    const value = String(form[field] ?? "").trim();
    if (value && (!integerPattern.test(value) || Number(value) < 1))
      errors[field] = "* Please select a valid option";
  }

  for (const [index, date] of (form.dates || []).entries()) {
    for (const field of ["date_range", "price", "single_price"]) {
      const value = String(date[field] ?? "").trim();
      if (!value) continue;
      const isInteger = field === "date_range";
      const isValid = isInteger
        ? integerPattern.test(value)
        : numberPattern.test(value) &&
          Number.isFinite(Number(value.replaceAll(",", "")));
      if (!isValid)
        errors[`dates.${index}.${field}`] = isInteger
          ? "* Not a valid integer"
          : "* Invalid floating decimal number";
      else if (Number(value.replaceAll(",", "")) < 0)
        errors[`dates.${index}.${field}`] =
          "* The value must be zero or greater";
    }
  }

  for (const [index, box] of (form.box_images || []).entries()) {
    const value = String(box.display_order ?? "").trim();
    if (value && !integerPattern.test(value))
      errors[`box_images.${index}.display_order`] = "* Not a valid integer";
  }

  if (
    !["Specefic Date", "Specefic Month", "Year Round"].includes(
      form.available_for,
    )
  )
    errors.available_for = "* Please select an option";

  for (const [field, label] of [
    ["banner_image", "Banner Image"],
    ["map_image", "Map"],
    ["listing_image", "Listing Image"],
  ]) {
    if (!form[field] && !form[`${field}_url`])
      errors[field] = `* ${label} is required`;
  }

  return errors;
}

function ValidationPrompt({
  error,
  validationKey,
  noArrow = false,
  onDismiss,
}) {
  return error ? (
    <button
      type="button"
      id={validationKey ? `trip-validation-${validationKey}` : undefined}
      className={`trip-validation-prompt${noArrow ? " no-arrow" : ""}`}
      data-trip-validation-prompt={validationKey}
      aria-label={`${error}. Dismiss message`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onDismiss}
    >
      {error}
    </button>
  ) : null;
}

const textAreas = [["description", "Description", true]];

const postDateTextAreas = [
  ["included", "Included", true],
  ["excluded", "Excluded", true],
  ["highlight", "Highlight"],
  ["youtube_content", "YouTube Content"],
  ["activity", "Activity Details", true],
  ["arrival", "Arrival", true],
  ["departure", "Departure", true],
  ["pre_post_tour_travel", "Pre/Post Tour Travel", true],
  ["accommodations", "Accommodations", true],
  ["meals", "Meals", true],
];

function Input({
  form,
  update,
  name,
  label,
  type = "text",
  required = false,
  validationKey,
  error,
  onBlur,
  onDismiss,
  inputMode,
  min,
  max,
  step,
}) {
  return (
    <div className="form-group">
      <label className="col-sm-2 control-label">{label}</label>
      <div className="col-sm-10">
        <input
          className="form-control"
          required={required}
          type={type}
          min={min}
          max={max}
          step={step}
          inputMode={
            inputMode ||
            ([
              "deposit_amount",
              "price",
              "single_price",
              "days",
              "nights",
            ].includes(validationKey)
              ? "decimal"
              : validationKey === "order"
                ? "numeric"
                : undefined)
          }
          value={form[name] ?? ""}
          data-trip-validation={validationKey}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error ? `trip-validation-${validationKey}` : undefined
          }
          onBlur={onBlur}
          onChange={(event) => update(name, event.target.value)}
        />
        <ValidationPrompt
          error={error}
          validationKey={validationKey}
          onDismiss={onDismiss}
        />
      </div>
    </div>
  );
}

function ImageInput({
  form,
  update,
  name,
  label,
  required = false,
  validationKey,
  error,
  onBlur,
  onDismiss,
}) {
  return (
    <div className="form-group">
      <label className="col-sm-2 control-label">{label}</label>
      <div className="col-sm-10">
        <input
          className="form-control"
          type="file"
          accept="image/*"
          required={required && !form[`${name}_url`]}
          data-trip-validation={validationKey}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error ? `trip-validation-${validationKey}` : undefined
          }
          onBlur={onBlur}
          onChange={(event) => update(name, event.target.files?.[0] || null)}
        />
        {form[`${name}_url`] && (
          <img
            className="form-image-preview"
            src={form[`${name}_url`]}
            alt={label}
          />
        )}
        <ValidationPrompt
          error={error}
          validationKey={validationKey}
          onDismiss={onDismiss}
        />
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  required = false,
  validationKey,
  error,
  onBlur,
  onDismiss,
  children,
}) {
  return (
    <div className="form-group">
      <label className="col-sm-2 control-label">{label}</label>
      <div className="col-sm-10">
        <SearchableSelect
          bare
          label={label}
          value={value}
          onChange={onChange}
          required={required}
          containerProps={{
            "data-trip-validation": validationKey,
          }}
          buttonProps={{
            "aria-invalid": Boolean(error),
            "aria-describedby": error
              ? `trip-validation-${validationKey}`
              : undefined,
            onBlur,
          }}
        >
          {children}
        </SearchableSelect>
        <ValidationPrompt
          error={error}
          validationKey={validationKey}
          onDismiss={onDismiss}
        />
      </div>
    </div>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  required = false,
  rows,
  validationKey,
  error,
  onBlur,
  onDismiss,
}) {
  return (
    <div className="form-group">
      <label className="col-sm-2 control-label">{label}</label>
      <div className="col-sm-10">
        <textarea
          className="form-control"
          required={required}
          rows={rows}
          value={value}
          data-trip-validation={validationKey}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error ? `trip-validation-${validationKey}` : undefined
          }
          onBlur={onBlur}
          onChange={onChange}
        />
        <ValidationPrompt
          error={error}
          validationKey={validationKey}
          onDismiss={onDismiss}
        />
      </div>
    </div>
  );
}

function RichField({
  label,
  value,
  onChange,
  validationKey,
  error,
  onBlur,
  onDismiss,
}) {
  return (
    <div className="form-group">
      <label className="col-sm-2 control-label">{label}</label>
      <div
        className="col-sm-10"
        data-trip-validation={validationKey}
        aria-invalid={Boolean(error)}
        aria-describedby={
          error ? `trip-validation-${validationKey}` : undefined
        }
      >
        <RichTextEditor value={value} onChange={onChange} onBlur={onBlur} />
        <ValidationPrompt
          error={error}
          validationKey={validationKey}
          onDismiss={onDismiss}
        />
      </div>
    </div>
  );
}

export default function AddTripPage({
  form,
  options,
  editingId,
  update,
  save,
  dateAction,
  cancel,
}) {
  const formRef = useRef(null);
  const [validationErrors, setValidationErrors] = useState({});
  const validateFieldOnBlur = (field, value) => {
    let currentForm = form;
    const nestedField = /^(dates|box_images)\.(\d+)\.(.+)$/.exec(field);
    if (value !== undefined && nestedField) {
      const [, collection, index, key] = nestedField;
      currentForm = {
        ...form,
        [collection]: (form[collection] || []).map((item, itemIndex) =>
          itemIndex === Number(index) ? { ...item, [key]: value } : item,
        ),
      };
    } else if (value !== undefined) {
      currentForm = { ...form, [field]: value };
    }
    const error = validateTripForm(currentForm)[field];
    setValidationErrors((current) => {
      if (current[field] === error) return current;
      const next = { ...current };
      if (error) next[field] = error;
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
  const updateTripField = (field, value) => {
    update(field, value);
  };
  const handleFieldBlur = (event) => {
    const field = event.target.closest?.("[data-trip-validation]");
    const validationKey = field?.getAttribute("data-trip-validation");
    if (!validationKey || field.contains(event.relatedTarget)) return;
    const value = field.matches(".searchable-select")
      ? (form[validationKey] ?? "")
      : field.matches(".radio")
        ? field.querySelector('input[type="radio"]:checked')?.value || ""
        : event.target.type === "file"
          ? event.target.files?.[0]
          : "value" in event.target
            ? event.target.value
            : undefined;
    validateFieldOnBlur(validationKey, value);
  };
  const handlePromptClick = (event) => {
    const prompt = event.target.closest?.("[data-trip-validation-prompt]");
    const validationKey = prompt?.getAttribute("data-trip-validation-prompt");
    if (validationKey) dismissFieldError(validationKey);
  };
  const handleSubmit = (event) => {
    event.preventDefault();
    const errors = validateTripForm(form);
    setValidationErrors(errors);
    const firstInvalidField = Object.keys(errors)[0];
    if (firstInvalidField) {
      const field = formRef.current?.querySelector(
        `[data-trip-validation="${firstInvalidField}"]`,
      );
      field?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      const focusTarget = field?.matches(
        "input, select, textarea, button, iframe",
      )
        ? field
        : field?.querySelector("iframe, input, select, textarea, button");
      focusTarget?.focus();
      return;
    }
    save(event);
  };

  const dates = form.dates || [];
  const boxes = form.box_images || [];
  const blogPosts =
    form.blog_posts && form.blog_posts.length
      ? form.blog_posts
      : [form.blog_post_display || ""];
  const setDate = (index, key, value) =>
    update(
      "dates",
      dates.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
    );
  const setBox = (index, key, value) =>
    update(
      "box_images",
      boxes.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
    );
  const setBlogPost = (index, value) => {
    const next = blogPosts.map((item, i) => (i === index ? value : item));
    update("blog_posts", next);
    update("blog_post_display", next[0] || "");
  };
  return (
    <div className="admin-row">
      <div className="admin-col-full">
        <section className="admin-box box-primary form-panel trip-form-panel">
          <div className="box-header with-border">
            <h3 className="box-title">
              {editingId ? "Edit Trip" : "Add Trip"}
            </h3>
          </div>
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            onBlurCapture={handleFieldBlur}
            onClickCapture={handlePromptClick}
            className="form-horizontal"
            role="form"
            noValidate
          >
            <div className="box-body">
              <Input
                form={form}
                update={updateTripField}
                name="name"
                label="Name"
                required
                validationKey="name"
                error={validationErrors.name}
              />
              <Input
                form={form}
                update={updateTripField}
                name="slug"
                label="Slug"
              />
              <SelectField
                label="Trip Type"
                required
                validationKey="type_id"
                error={validationErrors.type_id}
                value={form.type_id || ""}
                onChange={(e) => updateTripField("type_id", e.target.value)}
              >
                <option value="">-- Select Trip Type --</option>
                {options.tripTypes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="Location"
                required
                validationKey="location_id"
                error={validationErrors.location_id}
                value={form.location_id || ""}
                onChange={(e) => updateTripField("location_id", e.target.value)}
              >
                <option value="">-- Select Location --</option>
                {options.locations.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </SelectField>
              <div className="form-group trip-activity-field">
                <label className="col-sm-2 control-label">Activity</label>
                <div className="col-sm-10">
                  <div className="checkbox checkbox-list">
                    {options.activities.map((item) => (
                      <label key={item.id} className="checkbox-field">
                        <input
                          type="checkbox"
                          checked={(form.activity_ids || []).includes(item.id)}
                          onChange={(e) =>
                            update(
                              "activity_ids",
                              e.target.checked
                                ? [...(form.activity_ids || []), item.id]
                                : (form.activity_ids || []).filter(
                                    (id) => id !== item.id,
                                  ),
                            )
                          }
                        />
                        {item.name}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <SelectField
                label="Activity Level"
                value={form.activity_level || ""}
                onChange={(e) => update("activity_level", e.target.value)}
              >
                <option value="">-- Select Activity Level --</option>
                {[
                  { value: "Easy", label: "Easy" },
                  { value: "Moderate", label: "Moderate" },
                  {
                    value: "moderately_strenuous",
                    label: "Moderately Strenuous",
                  },
                  { value: "Strenuous", label: "Strenuous" },
                ].map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </SelectField>
              <div className="trip-blog-posts full">
                {blogPosts.map((blogPost, index) => (
                  <div className="trip-blog-post" key={index}>
                    <h3>Box Blog Post {index + 1}</h3>
                    <SelectField
                      label="Select Post"
                      value={blogPost}
                      onChange={(event) =>
                        setBlogPost(index, event.target.value)
                      }
                    >
                      <option value="">-- Select Blog --</option>
                      <option value="Alps Hiking">Alps Hiking</option>
                      <option value="Switzerland Travel">
                        Switzerland Travel
                      </option>
                      <option value="My Swisskitchen New">
                        My Swisskitchen New
                      </option>
                    </SelectField>
                    {index > 0 && (
                      <div className="form-group repeat-action-row">
                        <label className="col-sm-2 control-label" />
                        <div className="col-sm-10">
                          <button
                            type="button"
                            className="btn btn-default button"
                            onClick={() => {
                              const next = blogPosts.filter(
                                (_item, itemIndex) => itemIndex !== index,
                              );
                              update("blog_posts", next);
                              update("blog_post_display", next[0] || "");
                            }}
                          >
                            Remove Blog Post
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <div className="form-group repeat-add-row">
                  <label className="col-sm-2 control-label" />
                  <div className="col-sm-10">
                    <p className="add-help">
                      Please click on the "Add New" button to add new blog post.
                    </p>
                    <button
                      type="button"
                      className="btn btn-default button"
                      onClick={() => update("blog_posts", [...blogPosts, ""])}
                    >
                      Add New
                    </button>
                  </div>
                </div>
              </div>
              <Input
                form={form}
                update={updateTripField}
                name="menu_name"
                label="Menu Name"
                required
                validationKey="menu_name"
                error={validationErrors.menu_name}
              />
              <Input
                form={form}
                update={updateTripField}
                name="meta_title"
                label="Meta Title"
                required
                validationKey="meta_title"
                error={validationErrors.meta_title}
              />
              <TextareaField
                label="Meta Descriptions"
                required
                validationKey="meta_descriptions"
                error={validationErrors.meta_descriptions}
                value={form.meta_descriptions || ""}
                onChange={(event) =>
                  updateTripField("meta_descriptions", event.target.value)
                }
              />
              <TextareaField
                label="Meta Keywords"
                required
                validationKey="meta_keywords"
                error={validationErrors.meta_keywords}
                value={form.meta_keywords || ""}
                onChange={(event) =>
                  updateTripField("meta_keywords", event.target.value)
                }
              />
              <TextareaField
                label="Short Description"
                required
                rows="4"
                validationKey="short_description"
                error={validationErrors.short_description}
                value={form.short_description || ""}
                onChange={(event) =>
                  updateTripField("short_description", event.target.value)
                }
              />
              {textAreas.map(([name, label, required]) => (
                <RichField
                  key={name}
                  label={label}
                  value={form[name] || ""}
                  onChange={(value) => updateTripField(name, value)}
                  onBlur={(value) => validateFieldOnBlur(name, value)}
                  validationKey={required ? name : undefined}
                  error={validationErrors[name]}
                />
              ))}
              <Input
                form={form}
                update={updateTripField}
                name="deposit_amount"
                label="Deposit Amount"
                type="text"
                required
                validationKey="deposit_amount"
                error={validationErrors.deposit_amount}
              />
              <Input
                form={form}
                update={updateTripField}
                name="deposit_amount_text"
                label="Deposit Amount Text (Use #depositamount# in the text to display the above amount in the trip module)."
                required
                validationKey="deposit_amount_text"
                error={validationErrors.deposit_amount_text}
              />
              <Input
                form={form}
                update={updateTripField}
                name="price"
                label="Price For Double Occupancy"
                type="text"
                required
                validationKey="price"
                error={validationErrors.price}
              />
              <Input
                form={form}
                update={updateTripField}
                name="price_text"
                label="Price Suffix Text"
              />
              <Input
                form={form}
                update={updateTripField}
                name="single_price"
                label="Price For Single Supplement"
                type="text"
                required
                validationKey="single_price"
                error={validationErrors.single_price}
              />
              <div className="form-group">
                <label className="col-sm-2 control-label">Available For</label>
                <div className="col-sm-10">
                  <div
                    className="radio"
                    data-trip-validation="available_for"
                    aria-invalid={Boolean(validationErrors.available_for)}
                    aria-describedby={
                      validationErrors.available_for
                        ? "trip-validation-available_for"
                        : undefined
                    }
                  >
                    {["Specefic Date", "Specefic Month", "Year Round"].map(
                      (value) => (
                        <label key={value}>
                          <input
                            type="radio"
                            name="available_for"
                            value={value}
                            required
                            checked={form.available_for === value}
                            onChange={(event) =>
                              updateTripField(
                                "available_for",
                                event.target.value,
                              )
                            }
                          />
                          {value}
                        </label>
                      ),
                    )}
                  </div>
                  <ValidationPrompt
                    error={validationErrors.available_for}
                    validationKey="available_for"
                    noArrow
                  />
                </div>
              </div>
              <Input
                form={form}
                update={updateTripField}
                name="days"
                label="Trip Days"
                type="text"
                required
                validationKey="days"
                error={validationErrors.days}
              />
              <Input
                form={form}
                update={updateTripField}
                name="nights"
                label="Trip Nights"
                type="text"
                required
                validationKey="nights"
                error={validationErrors.nights}
              />
              {dates.map((date, index) => (
                <div className="full repeat-row" key={date.id || index}>
                  <div className="repeat-form-heading">
                    <h4>Date {index + 1}</h4>
                  </div>
                  <Input
                    form={date}
                    update={(key, value) => setDate(index, key, value)}
                    name="start_date"
                    label="Start Date"
                    type="date"
                    validationKey={`dates.${index}.start_date`}
                    error={validationErrors[`dates.${index}.start_date`]}
                  />
                  <Input
                    form={date}
                    update={(key, value) => setDate(index, key, value)}
                    name="end_date"
                    label="End Date"
                    type="date"
                    validationKey={`dates.${index}.end_date`}
                    error={validationErrors[`dates.${index}.end_date`]}
                  />
                  {(date.id || form.available_for !== "Specefic Date") && (
                    <Input
                      form={date}
                      update={(key, value) => setDate(index, key, value)}
                      name="date_range"
                      label={date.id ? "Entry Day" : "Enter Day"}
                      type="number"
                      inputMode="numeric"
                      min="0"
                      step="1"
                      validationKey={`dates.${index}.date_range`}
                      error={validationErrors[`dates.${index}.date_range`]}
                    />
                  )}
                  <p className="full form-help">
                    Leave the field blank if not diffrent from the general price
                  </p>
                  <Input
                    form={date}
                    update={(key, value) => setDate(index, key, value)}
                    name="price"
                    label="Price (Double)"
                    type="number"
                    min="0"
                    step="0.01"
                    validationKey={`dates.${index}.price`}
                    error={validationErrors[`dates.${index}.price`]}
                  />
                  <Input
                    form={date}
                    update={(key, value) => setDate(index, key, value)}
                    name="single_price"
                    label="Price (Single)"
                    type="number"
                    min="0"
                    step="0.01"
                    validationKey={`dates.${index}.single_price`}
                    error={validationErrors[`dates.${index}.single_price`]}
                  />
                  {(date.id || index > 0) && (
                    <div className="form-group repeat-action-row">
                      <label className="col-sm-2 control-label" />
                      <div className="date-actions col-sm-10">
                        {date.id && (
                          <>
                            <button
                              type="button"
                              className="btn btn-default button"
                              onClick={() => dateAction(date, "delete")}
                            >
                              Delete Date
                            </button>
                            <button
                              type="button"
                              className="btn btn-default button"
                              onClick={() =>
                                dateAction(
                                  date,
                                  date.status === "Inactive"
                                    ? "activate"
                                    : "deactivate",
                                )
                              }
                            >
                              {date.status === "Inactive"
                                ? "Activate"
                                : "Deactivate"}
                            </button>
                            <button
                              type="button"
                              className="btn btn-default button"
                              onClick={() =>
                                dateAction(
                                  date,
                                  date.status === "Sold Out"
                                    ? "activate"
                                    : "soldOut",
                                )
                              }
                            >
                              {date.status === "Sold Out"
                                ? "Unsold"
                                : "Sold Out"}
                            </button>
                          </>
                        )}
                        {index > 0 && (
                          <button
                            type="button"
                            className="btn btn-default button"
                            onClick={() =>
                              update(
                                "dates",
                                dates.filter((_item, i) => i !== index),
                              )
                            }
                          >
                            Remove Date
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div className="form-group repeat-add-row">
                <label className="col-sm-2 control-label" />
                <div className="col-sm-10">
                  <p className="add-help">
                    Please click on the "Add New" button to add new date.
                  </p>
                  <button
                    type="button"
                    className="btn btn-default button"
                    onClick={() =>
                      update("dates", [
                        ...dates,
                        {
                          start_date: "",
                          end_date: "",
                          date_range: "",
                          price: "",
                          single_price: "",
                          status: "Active",
                        },
                      ])
                    }
                  >
                    Add New
                  </button>
                </div>
              </div>
              {postDateTextAreas.map(([name, label, required]) => (
                <RichField
                  key={name}
                  label={label}
                  value={form[name] || ""}
                  onChange={(value) => updateTripField(name, value)}
                  onBlur={
                    required
                      ? (value) => validateFieldOnBlur(name, value)
                      : undefined
                  }
                  validationKey={required ? name : undefined}
                  error={validationErrors[name]}
                />
              ))}
              <Input
                form={form}
                update={update}
                name="banner_sub_title"
                label="Banner Sub Title"
              />
              <Input
                form={form}
                update={update}
                name="tooltip_text"
                label="Banner Caption & Credit"
              />
              <ImageInput
                form={form}
                update={updateTripField}
                name="banner_image"
                label="Banner Image"
                required
                validationKey="banner_image"
                error={validationErrors.banner_image}
              />
              <Input
                form={form}
                update={update}
                name="banner_alt"
                label="Banner Image Alt"
              />
              <ImageInput
                form={form}
                update={updateTripField}
                name="map_image"
                label="Map"
                required
                validationKey="map_image"
                error={validationErrors.map_image}
              />
              <ImageInput
                form={form}
                update={updateTripField}
                name="listing_image"
                label="Listing Image"
                required
                validationKey="listing_image"
                error={validationErrors.listing_image}
              />
              <Input
                form={form}
                update={update}
                name="listing_image_alt"
                label="Listing Image Alt"
              />
              <Input
                form={form}
                update={updateTripField}
                name="order"
                label="Order"
                type="text"
                required
                validationKey="order"
                error={validationErrors.order}
              />
              {boxes.map((box, index) => (
                <div className="full repeat-row" key={box.id || index}>
                  <div className="repeat-form-heading">
                    <h4>Box Image {index + 1}</h4>
                  </div>
                  <div className="form-group">
                    <label className="col-sm-2 control-label">Image</label>
                    <div className="col-sm-10">
                      <input
                        className="form-control"
                        type="file"
                        accept="image/*"
                        onChange={(e) =>
                          setBox(index, "file", e.target.files[0] || null)
                        }
                      />
                      {box.image_url && (
                        <img
                          className="form-image-preview"
                          src={adminThumbnailUrl(box.image_url)}
                          alt={box.image_alt || "Box image"}
                        />
                      )}
                    </div>
                  </div>
                  <Input
                    form={box}
                    update={(key, value) => setBox(index, key, value)}
                    name="image_alt"
                    label="Image Alt"
                  />
                  <Input
                    form={box}
                    update={(key, value) => setBox(index, key, value)}
                    name="title"
                    label="Text"
                  />
                  <Input
                    form={box}
                    update={(key, value) => setBox(index, key, value)}
                    name="link"
                    label="Link"
                  />
                  <Input
                    form={box}
                    update={(key, value) => setBox(index, key, value)}
                    name="display_order"
                    label="Order"
                    type="number"
                    validationKey={`box_images.${index}.display_order`}
                    error={
                      validationErrors[`box_images.${index}.display_order`]
                    }
                  />
                  <div className="form-group repeat-action-row">
                    <label className="col-sm-2 control-label" />
                    <div className="col-sm-10">
                      <button
                        type="button"
                        className="btn btn-default button"
                        onClick={() =>
                          update(
                            "box_images",
                            boxes.filter((_item, i) => i !== index),
                          )
                        }
                      >
                        Remove Box Image
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              <div className="form-group repeat-add-row">
                <label className="col-sm-2 control-label" />
                <div className="col-sm-10">
                  <p className="add-help">
                    Please click on the "Add New" button to add new box image.
                  </p>
                  <button
                    type="button"
                    className="btn btn-default button"
                    onClick={() =>
                      update("box_images", [
                        ...boxes,
                        {
                          image: "",
                          image_alt: "",
                          title: "",
                          link: "",
                          display_order: boxes.length + 1,
                        },
                      ])
                    }
                  >
                    Add New
                  </button>
                </div>
              </div>
            </div>
            <div className="box-footer form-actions">
              <button
                type="button"
                className="btn btn-default button"
                onClick={cancel}
              >
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
