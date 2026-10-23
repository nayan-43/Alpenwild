import React, { useRef, useState } from "react";
import { FormGroup } from "@/components/admin/FormFields";
import { adminThumbnailUrl } from "@/lib/assets";

const integerPattern = /^[+-]?\d+$/;

function ValidationPrompt({ error, field, onDismiss }) {
  return error ? (
    <button
      type="button"
      id={`promotion-validation-${field}`}
      className="promotion-validation-prompt"
      data-promotion-validation-prompt={field}
      aria-label={`${error}. Dismiss message`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onDismiss}
    >
      {error}
    </button>
  ) : null;
}

export default function AddPromotionPage({
  form,
  editingId,
  update,
  save,
  cancel,
  entityLabel = "Offers Promotions",
}) {
  const formRef = useRef(null);
  const [validationErrors, setValidationErrors] = useState({});
  const useLegacyValidation = ["Offers Promotions", "Special Feature"].includes(
    entityLabel,
  );
  const hasImage = Boolean(form.image || form.image_url);

  const validateField = (field) => {
    if (["title", "text", "link", "image_alt"].includes(field)) {
      if (!String(form[field] ?? "").trim()) return "* This field is required";
    }
    if (field === "image" && !hasImage) return "* This field is required";
    if (field === "display_order") {
      const order = String(form.display_order ?? "").trim();
      if (!order) return "* This field is required";
      if (!integerPattern.test(order)) return "* Not a valid integer";
    }
    return "";
  };

  const validateForm = () => {
    const errors = {};
    for (const field of [
      "title",
      "text",
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
    if (!useLegacyValidation) return;
    const control = event.target.closest?.("[data-promotion-validation]");
    const field = control?.getAttribute("data-promotion-validation");
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

  const handleSubmit = (event) => {
    if (!useLegacyValidation) {
      save(event);
      return;
    }
    event.preventDefault();
    const errors = validateForm();
    setValidationErrors(errors);
    const firstInvalid = Object.keys(errors)[0];
    if (firstInvalid) {
      const control = formRef.current?.querySelector(
        `[data-promotion-validation="${firstInvalid}"]`,
      );
      control?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      control?.querySelector("input, textarea")?.focus();
      return;
    }
    save(event);
  };

  const control = (field, child) => (
    <div
      className="promotion-validation-control"
      data-promotion-validation={field}
    >
      {child}
      <ValidationPrompt
        error={useLegacyValidation ? validationErrors[field] : ""}
        field={field}
        onDismiss={() => dismissError(field)}
      />
    </div>
  );

  const field = (name, label, placeholder = "Enter ...") => (
    <FormGroup label={label}>
      {control(
        name,
        <input
          className="form-control"
          type="text"
          value={form[name] ?? ""}
          placeholder={placeholder}
          required
          aria-invalid={Boolean(useLegacyValidation && validationErrors[name])}
          aria-describedby={
            useLegacyValidation && validationErrors[name]
              ? `promotion-validation-${name}`
              : undefined
          }
          onChange={(event) => update(name, event.target.value)}
        />,
      )}
    </FormGroup>
  );

  return (
    <div className="admin-row">
      <div className="admin-col-full">
        <section
          className={`admin-box box-primary form-panel${useLegacyValidation ? " promotion-form" : ""}`}
        >
          <div className="box-header with-border">
            <h3 className="box-title">
              {editingId ? `Edit ${entityLabel}` : `Add ${entityLabel}`}
            </h3>
          </div>
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            onBlurCapture={handleBlur}
            onClickCapture={(event) => {
              const prompt = event.target.closest?.(
                "[data-promotion-validation-prompt]",
              );
              const field = prompt?.getAttribute(
                "data-promotion-validation-prompt",
              );
              if (field) dismissError(field);
            }}
            className="form-horizontal"
            role="form"
            noValidate={useLegacyValidation}
          >
            <div className="box-body">
              {useLegacyValidation ? (
                <>
                  {field("title", "Title")}
                  <FormGroup label="Text">
                    {control(
                      "text",
                      <textarea
                        className="form-control"
                        value={form.text ?? ""}
                        placeholder="Enter ..."
                        required
                        rows="4"
                        aria-invalid={Boolean(validationErrors.text)}
                        aria-describedby={
                          validationErrors.text
                            ? "promotion-validation-text"
                            : undefined
                        }
                        onChange={(event) => update("text", event.target.value)}
                      />,
                    )}
                  </FormGroup>
                  {field("link", "Link")}
                </>
              ) : (
                <>
                  <TextField
                    label="Title"
                    required
                    value={form.title}
                    onChange={(event) => update("title", event.target.value)}
                    placeholder="Enter ..."
                  />
                  <TextareaField
                    label="Text"
                    required
                    value={form.text}
                    onChange={(event) => update("text", event.target.value)}
                    placeholder="Enter ..."
                    rows="4"
                  />
                  <TextField
                    label="Link"
                    required
                    value={form.link}
                    onChange={(event) => update("link", event.target.value)}
                    placeholder="https://..."
                  />
                </>
              )}
              <FormGroup label="Image">
                {useLegacyValidation ? (
                  control(
                    "image",
                    <>
                      <input
                        className="form-control"
                        required={!hasImage}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        aria-invalid={Boolean(validationErrors.image)}
                        aria-describedby={
                          validationErrors.image
                            ? "promotion-validation-image"
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
                          alt={form.image_alt || "Current promotion"}
                        />
                      )}
                    </>,
                  )
                ) : (
                  <input
                    className="form-control"
                    required={!editingId}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={(event) =>
                      update("image", event.target.files[0] || null)
                    }
                  />
                )}
              </FormGroup>
              {useLegacyValidation ? (
                <>
                  {field("image_alt", "Image Alt", "Enter alt text")}
                  <FormGroup label="Order">
                    {control(
                      "display_order",
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
                            ? "promotion-validation-display_order"
                            : undefined
                        }
                        onChange={(event) =>
                          update("display_order", event.target.value)
                        }
                      />,
                    )}
                  </FormGroup>
                </>
              ) : (
                <>
                  <TextField
                    label="Image Alt"
                    required
                    value={form.image_alt}
                    onChange={(event) =>
                      update("image_alt", event.target.value)
                    }
                    placeholder="Enter alt text"
                  />
                  <TextField
                    label="Order"
                    required
                    type="number"
                    min="1"
                    value={form.display_order}
                    onChange={(event) =>
                      update("display_order", event.target.value)
                    }
                    placeholder="Enter ..."
                  />
                </>
              )}
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
                Submit
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
