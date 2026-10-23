import React, { useRef, useState } from "react";
import { FormGroup, SearchableSelect } from "@/components/admin/FormFields";
import RichTextEditor from "@/components/admin/RichTextEditor";
import { adminThumbnailUrl } from "@/lib/assets";

const requiredFields = [
  "name",
  "menu_name",
  "meta_title",
  "meta_descriptions",
  "meta_keywords",
  "description",
  "listing_image",
  "display_order",
];
const integerPattern = /^[+-]?\d+$/;

function ValidationPrompt({ error, field, onDismiss }) {
  return error ? (
    <button
      type="button"
      id={`category-validation-${field}`}
      className="category-validation-prompt"
      data-category-validation-prompt={field}
      aria-label={`${error}. Dismiss message`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onDismiss}
    >
      {error}
    </button>
  ) : null;
}

function plainText(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .trim();
}

export default function AddCategoryPage({
  form,
  parents,
  editingId,
  update,
  save,
  cancel,
}) {
  const formRef = useRef(null);
  const [validationErrors, setValidationErrors] = useState({});
  const boxes = form.box_images || [];

  function validateField(key, value = form[key]) {
    if (key === "listing_image") {
      return form.listing_image || form.listing_image_url
        ? ""
        : "* This field is required";
    }
    if (key === "description") {
      return plainText(value) ? "" : "* This field is required";
    }
    if (key === "display_order") {
      const order = String(value ?? "").trim();
      if (!order) return "* This field is required";
      const numericOrder = Number(order);
      if (
        !integerPattern.test(order) ||
        !Number.isSafeInteger(numericOrder) ||
        numericOrder < -2147483648 ||
        numericOrder > 2147483647
      )
        return "* Not a valid integer";
      return "";
    }
    return requiredFields.includes(key) && !String(value ?? "").trim()
      ? "* This field is required"
      : "";
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
    const control = event.target.closest?.("[data-category-validation]");
    const key = control?.getAttribute("data-category-validation");
    if (!key || control.contains(event.relatedTarget)) return;
    const error = validateField(
      key,
      key === "description" ? form.description : event.target.value,
    );
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
    const firstInvalid = requiredFields.find((key) => errors[key]);
    if (firstInvalid) {
      const control = formRef.current?.querySelector(
        `[data-category-validation="${firstInvalid}"]`,
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
        className="category-validation-control"
        data-category-validation={key}
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

  function field(key, label, required = requiredFields.includes(key)) {
    const maxLength = key === "meta_title" ? 60 : undefined;
    return (
      <FormGroup label={label}>
        {control(
          key,
          <input
            className="form-control"
            type="text"
            required={required}
            maxLength={maxLength}
            value={form[key] ?? ""}
            placeholder="Enter ..."
            aria-invalid={Boolean(validationErrors[key])}
            aria-describedby={
              validationErrors[key] ? `category-validation-${key}` : undefined
            }
            onChange={(event) => {
              update(key, event.target.value);
            }}
          />,
        )}
      </FormGroup>
    );
  }

  function textarea(key, label) {
    const maxLength = key === "meta_descriptions" ? 160 : undefined;
    return (
      <FormGroup label={label}>
        {control(
          key,
          <textarea
            className="form-control"
            required
            maxLength={maxLength}
            rows="3"
            value={form[key] || ""}
            placeholder="Enter ..."
            aria-invalid={Boolean(validationErrors[key])}
            aria-describedby={
              validationErrors[key] ? `category-validation-${key}` : undefined
            }
            onChange={(event) => {
              update(key, event.target.value);
            }}
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
      { image: "", title: "", link: "", file: null, newlyAdded: true },
    ]);
  }

  function removeBox(index) {
    update(
      "box_images",
      boxes.filter((_box, boxIndex) => boxIndex !== index),
    );
  }

  return (
    <div className="admin-row">
      <div className="admin-col-full">
        <section className="admin-box box-primary form-panel category-form">
          <div className="box-header with-border">
            <h3 className="box-title">
              {editingId ? "Edit Category" : "Add Category"}
            </h3>
          </div>
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            onBlurCapture={handleBlur}
            onClickCapture={(event) => {
              const prompt = event.target.closest?.(
                "[data-category-validation-prompt]",
              );
              const key = prompt?.getAttribute(
                "data-category-validation-prompt",
              );
              if (key) dismissError(key);
            }}
            className="form-horizontal"
            role="form"
            noValidate
          >
            <div className="box-body">
              <SearchableSelect
                label="Parent Category"
                value={form.parent_id || 0}
                onChange={(event) => update("parent_id", event.target.value)}
              >
                <option value="0">-- Select Parent Category --</option>
                {parents
                  .filter(
                    (item) =>
                      Number(item.parent_id || 0) === 0 &&
                      String(item.id) !== String(editingId),
                  )
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </SearchableSelect>
              {field("name", "Name")}
              {field("menu_name", "Menu Name")}
              {field("meta_title", "Meta Title")}
              {textarea("meta_descriptions", "Meta Descriptions")}
              {textarea("meta_keywords", "Meta Keywords")}
              <FormGroup label="Description">
                {control(
                  "description",
                  <RichTextEditor
                    value={form.description || ""}
                    required
                    aria-invalid={Boolean(validationErrors.description)}
                    aria-describedby={
                      validationErrors.description
                        ? "category-validation-description"
                        : undefined
                    }
                    onChange={(value) => update("description", value)}
                    onBlur={(value) =>
                      setValidationErrors((current) => {
                        const next = { ...current };
                        const error = validateField("description", value);
                        if (error) next.description = error;
                        else delete next.description;
                        return next;
                      })
                    }
                  />,
                )}
              </FormGroup>
              {field("banner_title", "Banner Title")}
              {field("banner_sub_title", "Banner Sub Title")}
              {field("tooltip_text", "Tooltip Text")}
              <FormGroup label="Banner Image">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(event) =>
                    update("banner_image", event.target.files[0] || null)
                  }
                />
              </FormGroup>
              <FormGroup label="Listing Image">
                {control(
                  "listing_image",
                  <input
                    type="file"
                    required={!form.listing_image_url && !form.listing_image}
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    aria-invalid={Boolean(validationErrors.listing_image)}
                    aria-describedby={
                      validationErrors.listing_image
                        ? "category-validation-listing_image"
                        : undefined
                    }
                    onChange={(event) =>
                      update("listing_image", event.target.files[0] || null)
                    }
                  />,
                )}
              </FormGroup>
              <FormGroup label="Order">
                {control(
                  "display_order",
                  <input
                    className="form-control"
                    type="text"
                    required
                    inputMode="numeric"
                    value={form.display_order ?? ""}
                    placeholder="Enter ..."
                    aria-invalid={Boolean(validationErrors.display_order)}
                    aria-describedby={
                      validationErrors.display_order
                        ? "category-validation-display_order"
                        : undefined
                    }
                    onChange={(event) =>
                      update("display_order", event.target.value)
                    }
                  />,
                )}
              </FormGroup>

              <div className="full category-box-images">
                {boxes.map((box, index) => (
                  <div className="category-box-row" key={box.id || index}>
                    <div className="category-box-heading">
                      <h3>Box Image {index + 1}</h3>
                    </div>
                    <FormGroup label="Image" className="category-box-field">
                      {box.image_url && (
                        <img
                          className="category-box-image-preview"
                          src={adminThumbnailUrl(box.image_url)}
                          alt={box.title || "Box image"}
                        />
                      )}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={(event) =>
                          updateBox(
                            index,
                            "file",
                            event.target.files[0] || null,
                          )
                        }
                      />
                    </FormGroup>
                    <FormGroup label="Text" className="category-box-field">
                      <input
                        className="form-control"
                        value={box.title || ""}
                        placeholder="Enter ..."
                        onChange={(event) =>
                          updateBox(index, "title", event.target.value)
                        }
                      />
                    </FormGroup>
                    <FormGroup label="Link" className="category-box-field">
                      <input
                        className="form-control"
                        value={box.link || ""}
                        placeholder="Enter ..."
                        onChange={(event) =>
                          updateBox(index, "link", event.target.value)
                        }
                      />
                    </FormGroup>
                    {box.newlyAdded && (
                      <FormGroup
                        label=""
                        className="category-box-action-row category-box-remove-row"
                      >
                        <button
                          type="button"
                          className="btn btn-default"
                          onClick={() => removeBox(index)}
                        >
                          Remove Box Image
                        </button>
                      </FormGroup>
                    )}
                  </div>
                ))}
                <FormGroup
                  label=""
                  className="category-box-action-row category-box-add-row"
                >
                  <p className="category-box-help">
                    Please click on the &quot;Add New&quot; button to add new
                    box image.
                  </p>
                  <button
                    type="button"
                    className="btn btn-default"
                    onClick={addBox}
                  >
                    Add New
                  </button>
                </FormGroup>
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
              <button type="submit" className="btn btn-primary">
                Submit
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
