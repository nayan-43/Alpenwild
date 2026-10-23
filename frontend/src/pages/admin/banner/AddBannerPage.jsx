import React, { useRef, useState } from "react";
import { FormGroup } from "@/components/admin/FormFields";
import { adminThumbnailUrl } from "@/lib/assets";

const integerPattern = /^[+-]?\d+$/;

function ValidationPrompt({ error, field, onDismiss }) {
  return error ? (
    <button
      type="button"
      id={`banner-validation-${field}`}
      className="banner-validation-prompt"
      data-banner-validation-prompt={field}
      aria-label={`${error}. Dismiss message`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onDismiss}
    >
      {error}
    </button>
  ) : null;
}

function BannerControl({ field, error, onDismiss, children }) {
  return (
    <div className="banner-validation-control" data-banner-validation={field}>
      {children}
      <ValidationPrompt error={error} field={field} onDismiss={onDismiss} />
    </div>
  );
}

export default function AddBannerPage({
  form,
  editingId,
  update,
  save,
  cancel,
}) {
  const formRef = useRef(null);
  const [validationErrors, setValidationErrors] = useState({});
  const hasImage = Boolean(form.image || form.image_url);

  const validateField = (field) => {
    if (
      ["title", "sub_heading", "tooltip_text", "link", "image_alt"].includes(
        field,
      )
    ) {
      if (!String(form[field] ?? "").trim()) return "* This field is required";
    }
    if (field === "image" && !hasImage) return "* This field is required";
    if (field === "display_order") {
      const order = String(form.display_order ?? "").trim();
      if (!order) return "* This field is required";
      if (!integerPattern.test(order)) return "* Not a valid integer";
      if (Number(order) < 1) return "* The value must be at least 1";
    }
    return "";
  };

  const validateForm = () => {
    const errors = {};
    for (const field of [
      "title",
      "sub_heading",
      "tooltip_text",
      "link",
      "image",
      "image_alt",
      "display_order",
    ]) {
      const error = validateField(field);
      if (error) errors[field] = error;
    }
    return errors;
  };

  const handleBlur = (event) => {
    const control = event.target.closest?.("[data-banner-validation]");
    const field = control?.getAttribute("data-banner-validation");
    if (!field || control.contains(event.relatedTarget)) return;
    const error = validateField(field);
    setValidationErrors((current) => {
      const next = { ...current };
      if (error) next[field] = error;
      else delete next[field];
      return next;
    });
  };

  const dismissError = (field) => {
    setValidationErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const handlePromptClick = (event) => {
    const prompt = event.target.closest?.("[data-banner-validation-prompt]");
    const field = prompt?.getAttribute("data-banner-validation-prompt");
    if (field) dismissError(field);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const errors = validateForm();
    setValidationErrors(errors);
    const firstInvalid = Object.keys(errors)[0];
    if (firstInvalid) {
      const control = formRef.current?.querySelector(
        `[data-banner-validation="${firstInvalid}"]`,
      );
      control?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      control?.querySelector("input")?.focus();
      return;
    }
    save(event);
  };

  const field = (name, label, placeholder = "Enter ...") => (
    <FormGroup label={label}>
      <BannerControl
        field={name}
        error={validationErrors[name]}
        onDismiss={() => dismissError(name)}
      >
        <input
          className="form-control"
          type="text"
          value={form[name] ?? ""}
          placeholder={placeholder}
          required
          aria-invalid={Boolean(validationErrors[name])}
          aria-describedby={
            validationErrors[name] ? `banner-validation-${name}` : undefined
          }
          onChange={(event) => update(name, event.target.value)}
        />
      </BannerControl>
    </FormGroup>
  );

  return (
    <div className="admin-row">
      <div className="admin-col-full">
        <section className="admin-box box-primary form-panel banner-form">
          <div className="box-header with-border">
            <h3 className="box-title">
              {editingId ? "Edit Banner" : "Add Banner"}
            </h3>
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
            <div className="box-body">
              {field("title", "Title")}
              {field("sub_heading", "Sub Heading")}
              {field("tooltip_text", "Tooltip Text")}
              {field("link", "Link")}
              <FormGroup label="Banner">
                <BannerControl
                  field="image"
                  error={validationErrors.image}
                  onDismiss={() => dismissError("image")}
                >
                  <input
                    className="form-control"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    required={!hasImage}
                    aria-invalid={Boolean(validationErrors.image)}
                    aria-describedby={
                      validationErrors.image
                        ? "banner-validation-image"
                        : undefined
                    }
                    onChange={(event) =>
                      update("image", event.target.files?.[0] || null)
                    }
                  />
                  {form.image_url && (
                    <img
                      className="form-image-preview"
                      src={adminThumbnailUrl(form.image_url)}
                      alt={form.image_alt || "Current banner"}
                    />
                  )}
                </BannerControl>
              </FormGroup>
              {field("image_alt", "Banner Alt", "Enter alt text")}
              <FormGroup label="Button Text">
                <input
                  className="form-control"
                  type="text"
                  value={form.button_label ?? ""}
                  placeholder="Enter ..."
                  onChange={(event) =>
                    update("button_label", event.target.value)
                  }
                />
              </FormGroup>
              <FormGroup label="Button Link">
                <input
                  className="form-control"
                  type="text"
                  value={form.button_link ?? ""}
                  placeholder="Enter ..."
                  onChange={(event) =>
                    update("button_link", event.target.value)
                  }
                />
              </FormGroup>
              <FormGroup label="Order">
                <BannerControl
                  field="display_order"
                  error={validationErrors.display_order}
                  onDismiss={() => dismissError("display_order")}
                >
                  <input
                    className="form-control"
                    type="text"
                    inputMode="numeric"
                    value={form.display_order ?? ""}
                    placeholder="Enter ..."
                    required
                    aria-invalid={Boolean(validationErrors.display_order)}
                    aria-describedby={
                      validationErrors.display_order
                        ? "banner-validation-display_order"
                        : undefined
                    }
                    onChange={(event) =>
                      update("display_order", event.target.value)
                    }
                  />
                </BannerControl>
              </FormGroup>
            </div>
            <div className="box-footer form-actions">
              <button
                type="button"
                className="btn btn-default"
                onClick={cancel}
              >
                Cancel
              </button>
              <button className="btn btn-primary" type="submit">
                {editingId ? "Update" : "Submit"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
