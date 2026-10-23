import React, { useRef, useState } from "react";
import { FormGroup, TextField } from "@/components/admin/FormFields";
import { adminThumbnailUrl } from "@/lib/assets";

const integerPattern = /^[+-]?\d+$/;
const requiredFields = [
  "name",
  "menu_name",
  "meta_title",
  "meta_descriptions",
  "meta_keywords",
  "short_description",
  "description",
  "tooltip_text",
  "banner_image",
  "listing_image",
  "display_order",
];

function ValidationPrompt({ error, field, onDismiss }) {
  return error ? (
    <button
      type="button"
      id={`trip-type-validation-${field}`}
      className="trip-type-validation-prompt"
      data-trip-type-validation-prompt={field}
      aria-label={`${error}. Dismiss message`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onDismiss}
    >
      {error}
    </button>
  ) : null;
}

export default function AddTripTypePage({
  form,
  editingId,
  update,
  save,
  cancel,
}) {
  const formRef = useRef(null);
  const [validationErrors, setValidationErrors] = useState({});
  const boxes = form.box_images || [];
  const hasBanner = Boolean(form.banner_image || form.banner_image_url);
  const hasListingImage = Boolean(form.listing_image || form.listing_image_url);

  function validateField(key) {
    if (key === "banner_image" && !hasBanner) return "* This field is required";
    if (key === "listing_image" && !hasListingImage)
      return "* This field is required";
    if (key === "display_order") {
      const order = String(form.display_order ?? "").trim();
      if (!order) return "* This field is required";
      const numericOrder = Number(order);
      if (
        !integerPattern.test(order) ||
        !Number.isSafeInteger(numericOrder) ||
        numericOrder < -2147483648 ||
        numericOrder > 2147483647
      )
        return "* Not a valid integer";
    } else if (
      requiredFields.includes(key) &&
      !String(form[key] ?? "").trim()
    ) {
      return "* This field is required";
    }
    return "";
  }

  function validateForm() {
    const errors = {};
    for (const key of requiredFields) {
      const error = validateField(key);
      if (error) errors[key] = error;
    }
    return errors;
  }

  function handleBlur(event) {
    const control = event.target.closest?.("[data-trip-type-validation]");
    const key = control?.getAttribute("data-trip-type-validation");
    if (!key || control.contains(event.relatedTarget)) return;
    const error = validateField(key);
    setValidationErrors((current) => {
      const next = { ...current };
      if (error) next[key] = error;
      else delete next[key];
      return next;
    });
  }

  function dismissError(key) {
    setValidationErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function handleSubmit(event) {
    event.preventDefault();
    const errors = validateForm();
    setValidationErrors(errors);
    const firstInvalid = Object.keys(errors)[0];
    if (firstInvalid) {
      const control = formRef.current?.querySelector(
        `[data-trip-type-validation="${firstInvalid}"]`,
      );
      control?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      control?.querySelector("input, textarea")?.focus();
      return;
    }
    save(event);
  }

  function control(key, child) {
    return (
      <div
        className="trip-type-validation-control"
        data-trip-type-validation={key}
      >
        {child}
        <ValidationPrompt
          error={validationErrors[key]}
          field={key}
          onDismiss={() => dismissError(key)}
        />
      </div>
    );
  }

  function field(key, label) {
    return (
      <FormGroup label={label}>
        {control(
          key,
          <input
            className="form-control"
            type="text"
            required={requiredFields.includes(key)}
            value={form[key] ?? ""}
            placeholder="Enter ..."
            aria-invalid={Boolean(validationErrors[key])}
            aria-describedby={
              validationErrors[key] ? `trip-type-validation-${key}` : undefined
            }
            onChange={(event) => update(key, event.target.value)}
          />,
        )}
      </FormGroup>
    );
  }

  function textarea(key, label, rows) {
    return (
      <FormGroup label={label}>
        {control(
          key,
          <textarea
            className="form-control"
            required
            rows={rows}
            value={form[key] ?? ""}
            placeholder="Enter ..."
            aria-invalid={Boolean(validationErrors[key])}
            aria-describedby={
              validationErrors[key] ? `trip-type-validation-${key}` : undefined
            }
            onChange={(event) => update(key, event.target.value)}
          />,
        )}
      </FormGroup>
    );
  }

  function updateBox(index, key, value) {
    update(
      "box_images",
      boxes.map((box, boxIndex) =>
        boxIndex === index ? { ...box, [key]: value } : box,
      ),
    );
  }

  function addBox() {
    update("box_images", [
      ...boxes,
      {
        image: "",
        image_alt: "",
        title: "",
        link: "",
        file: null,
        isNew: true,
      },
    ]);
  }

  return (
    <div className="admin-row">
      <div className="admin-col-full">
        <section className="admin-box box-primary form-panel trip-type-form">
          <div className="box-header with-border">
            <h3 className="box-title">
              {editingId ? "Edit Trip Type" : "Add Trip Type"}
            </h3>
          </div>
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            onBlurCapture={handleBlur}
            onClickCapture={(event) => {
              const prompt = event.target.closest?.(
                "[data-trip-type-validation-prompt]",
              );
              const key = prompt?.getAttribute(
                "data-trip-type-validation-prompt",
              );
              if (key) dismissError(key);
            }}
            className="form-horizontal"
            role="form"
            noValidate
          >
            <div className="box-body">
              {field("name", "Name")}
              {field("menu_name", "Menu Name")}
              <FormGroup label="Display Under Choose Your Trip Style">
                <span className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={form.display_under === "Yes"}
                    onChange={(event) =>
                      update(
                        "display_under",
                        event.target.checked ? "Yes" : "No",
                      )
                    }
                  />
                  Yes
                </span>
              </FormGroup>
              {field("meta_title", "Meta Title")}
              {textarea("meta_descriptions", "Meta Descriptions", 3)}
              {textarea("meta_keywords", "Meta Keywords", 3)}
              {field("short_description", "Short Description")}
              {textarea("description", "Description", 5)}
              {field("tooltip_text", "Banner Caption & Credit")}
              <FormGroup label="Banner Image">
                {form.banner_image_url && (
                  <img
                    className="form-image-preview"
                    src={form.banner_image_url}
                    alt={form.banner_alt || "Banner"}
                  />
                )}
                {control(
                  "banner_image",
                  <input
                    className="form-control"
                    required={!hasBanner}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    aria-invalid={Boolean(validationErrors.banner_image)}
                    aria-describedby={
                      validationErrors.banner_image
                        ? "trip-type-validation-banner_image"
                        : undefined
                    }
                    onChange={(event) =>
                      update("banner_image", event.target.files?.[0] || null)
                    }
                  />,
                )}
              </FormGroup>
              {field("banner_alt", "Banner Image Alt")}
              <FormGroup label="Listing Image">
                {form.listing_image_url && (
                  <img
                    className="form-image-preview"
                    src={form.listing_image_url}
                    alt={form.listing_image_alt || "Listing"}
                  />
                )}
                {control(
                  "listing_image",
                  <input
                    className="form-control"
                    required={!hasListingImage}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    aria-invalid={Boolean(validationErrors.listing_image)}
                    aria-describedby={
                      validationErrors.listing_image
                        ? "trip-type-validation-listing_image"
                        : undefined
                    }
                    onChange={(event) =>
                      update("listing_image", event.target.files?.[0] || null)
                    }
                  />,
                )}
              </FormGroup>
              {field("listing_image_alt", "Listing Image Alt")}
              <FormGroup label="Order">
                {control(
                  "display_order",
                  <input
                    className="form-control"
                    type="text"
                    inputMode="numeric"
                    required
                    value={form.display_order ?? ""}
                    placeholder="Enter ..."
                    aria-invalid={Boolean(validationErrors.display_order)}
                    aria-describedby={
                      validationErrors.display_order
                        ? "trip-type-validation-display_order"
                        : undefined
                    }
                    onChange={(event) =>
                      update("display_order", event.target.value)
                    }
                  />,
                )}
              </FormGroup>

              {boxes.map((box, index) => (
                <div
                  className="full repeat-row trip-type-box-row"
                  key={box.id || index}
                >
                  <div className="repeat-form-heading">
                    <h4>Box Image {index + 1}</h4>
                  </div>
                  <FormGroup label="Image">
                    {box.image_url && (
                      <img
                        className="form-image-preview"
                        src={adminThumbnailUrl(box.image_url)}
                        alt={box.image_alt || box.title || "Box"}
                      />
                    )}
                    <input
                      className="form-control"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={(event) =>
                        updateBox(index, "file", event.target.files[0] || null)
                      }
                    />
                  </FormGroup>
                  <TextField
                    label="Image Alt"
                    value={box.image_alt || ""}
                    onChange={(event) =>
                      updateBox(index, "image_alt", event.target.value)
                    }
                  />
                  <TextField
                    label="Text"
                    value={box.title || ""}
                    onChange={(event) =>
                      updateBox(index, "title", event.target.value)
                    }
                  />
                  <TextField
                    label="Link"
                    value={box.link || ""}
                    onChange={(event) =>
                      updateBox(index, "link", event.target.value)
                    }
                  />
                  {box.isNew && (
                    <div className="trip-type-box-remove-row form-group">
                      <label
                        htmlFor=""
                        className="col-sm-2 control-label"
                      ></label>
                      <div className="col-sm-10">
                        <button
                          type="button"
                          className="btn btn-default remove-box"
                          onClick={() =>
                            update(
                              "box_images",
                              boxes.filter(
                                (_item, boxIndex) => boxIndex !== index,
                              ),
                            )
                          }
                        >
                          Remove Box Image
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div className="trip-type-box-add-row form-group">
                <label htmlFor="" className="col-sm-2 control-label"></label>
                <div className="col-sm-10">
                  <p className="add-help">
                    Please click on the "Add New" button to add new box image.
                  </p>
                  <button
                    type="button"
                    className="btn btn-default add-box"
                    onClick={addBox}
                  >
                    Add New
                  </button>
                </div>
              </div>
            </div>
            <div className="box-footer form-actions">
              <button
                type="button"
                className="btn btn-default"
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
