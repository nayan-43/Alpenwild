import React, { useRef, useState } from "react";
import { FormGroup, SearchableSelect } from "@/components/admin/FormFields";

const integerPattern = /^[+-]?\d+$/;
const gallerySourceError = "* You must fill one of the following fields";

function ValidationPrompt({ error, field, onDismiss }) {
  return error ? (
    <button
      type="button"
      id={`gallery-validation-${field}`}
      className="gallery-validation-prompt"
      data-gallery-validation-prompt={field}
      aria-label={`${error}. Dismiss message`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onDismiss}
    >
      {error}
    </button>
  ) : null;
}

function GalleryControl({ field, error, onDismiss, children }) {
  return (
    <div className="gallery-validation-control" data-gallery-validation={field}>
      {children}
      <ValidationPrompt error={error} field={field} onDismiss={onDismiss} />
    </div>
  );
}

export default function AddTripGalleryPage({
  form,
  trips,
  editingId,
  update,
  save,
  cancel,
}) {
  const formRef = useRef(null);
  const [validationErrors, setValidationErrors] = useState({});
  const hasExistingImage = Boolean(form.image_url);
  const hasGallerySource = Boolean(form.video_url?.trim() || form.image);

  const validateField = (field) => {
    if (field === "trip_id" && !String(form.trip_id ?? "").trim())
      return "* This field is required";
    if (field === "display_order") {
      const order = String(form.display_order ?? "").trim();
      if (!order) return "* This field is required";
      if (!integerPattern.test(order)) return "* Not a valid integer";
      if (Number(order) < 1) return "* The value must be at least 1";
    }
    if (
      !hasExistingImage &&
      !hasGallerySource &&
      ["video_url", "image"].includes(field)
    ) {
      return gallerySourceError;
    }
    return "";
  };

  const validateForm = () => {
    const errors = {};
    for (const field of ["trip_id", "display_order", "video_url", "image"]) {
      const error = validateField(field);
      if (error) errors[field] = error;
    }
    return errors;
  };

  const handleBlur = (event) => {
    const control = event.target.closest?.("[data-gallery-validation]");
    const field = control?.getAttribute("data-gallery-validation");
    if (!field || control.contains(event.relatedTarget)) return;

    if (["video_url", "image"].includes(field)) {
      const sourceError = validateField(field);
      setValidationErrors((current) => {
        const next = { ...current };
        if (sourceError) {
          next.video_url = sourceError;
          next.image = sourceError;
        } else {
          delete next.video_url;
          delete next.image;
        }
        return next;
      });
      return;
    }

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
    const prompt = event.target.closest?.("[data-gallery-validation-prompt]");
    const field = prompt?.getAttribute("data-gallery-validation-prompt");
    if (field) dismissError(field);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const errors = validateForm();
    setValidationErrors(errors);
    const firstInvalid = Object.keys(errors)[0];
    if (firstInvalid) {
      const control = formRef.current?.querySelector(
        `[data-gallery-validation="${firstInvalid}"]`,
      );
      control?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      const target = control?.querySelector("input, select");
      target?.focus();
      return;
    }
    save(event);
  };

  return (
    <section className="admin-box box-primary form-panel trip-gallery-form">
      <div className="box-header with-border">
        <h2 className="box-title">{editingId ? "Edit" : "Add"} Gallery</h2>
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
          <FormGroup label="Trip">
            <GalleryControl
              field="trip_id"
              error={validationErrors.trip_id}
              onDismiss={() => dismissError("trip_id")}
            >
              <SearchableSelect
                bare
                label="Trip"
                placeholder="-- Select Trip --"
                required
                value={form.trip_id}
                onChange={(event) => update("trip_id", event.target.value)}
                buttonProps={{
                  "aria-invalid": Boolean(validationErrors.trip_id),
                  "aria-describedby": validationErrors.trip_id
                    ? "gallery-validation-trip_id"
                    : undefined,
                }}
              >
                <option value="">-- Select Trip --</option>
                {trips.map((trip) => (
                  <option value={trip.id} key={trip.id}>
                    {trip.name}
                  </option>
                ))}
              </SearchableSelect>
            </GalleryControl>
          </FormGroup>
          <FormGroup label="Youtube Video URL">
            <GalleryControl
              field="video_url"
              error={validationErrors.video_url}
              onDismiss={() => dismissError("video_url")}
            >
              <input
                className="form-control"
                type="text"
                placeholder="Enter ..."
                value={form.video_url}
                aria-invalid={Boolean(validationErrors.video_url)}
                aria-describedby={
                  validationErrors.video_url
                    ? "gallery-validation-video_url"
                    : undefined
                }
                onChange={(event) => update("video_url", event.target.value)}
              />
            </GalleryControl>
          </FormGroup>
          <FormGroup label="Image">
            <GalleryControl
              field="image"
              error={validationErrors.image}
              onDismiss={() => dismissError("image")}
            >
              <input
                className="form-control"
                type="file"
                accept="image/*"
                aria-invalid={Boolean(validationErrors.image)}
                aria-describedby={
                  validationErrors.image
                    ? "gallery-validation-image"
                    : undefined
                }
                onChange={(event) =>
                  update("image", event.target.files?.[0] || null)
                }
              />
              {form.image_url && (
                <img
                  className="form-image-preview"
                  src={form.image_url}
                  alt={form.image_alt || "Current gallery image"}
                />
              )}
            </GalleryControl>
          </FormGroup>
          <FormGroup label="Image Alt">
            <input
              className="form-control"
              type="text"
              placeholder="Enter ..."
              value={form.image_alt}
              onChange={(event) => update("image_alt", event.target.value)}
            />
          </FormGroup>
          <FormGroup label="Order">
            <GalleryControl
              field="display_order"
              error={validationErrors.display_order}
              onDismiss={() => dismissError("display_order")}
            >
              <input
                className="form-control"
                type="text"
                inputMode="numeric"
                required
                value={form.display_order}
                aria-invalid={Boolean(validationErrors.display_order)}
                aria-describedby={
                  validationErrors.display_order
                    ? "gallery-validation-display_order"
                    : undefined
                }
                onChange={(event) =>
                  update("display_order", event.target.value)
                }
              />
            </GalleryControl>
          </FormGroup>
          <FormGroup label="Display in">
            <div className="checkbox-list gallery-checkboxes">
              <label>
                <input
                  type="checkbox"
                  checked={form.display_in_static_page}
                  onChange={(event) =>
                    update("display_in_static_page", event.target.checked)
                  }
                />
                Static Page
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={form.display_in_trip_page}
                  onChange={(event) =>
                    update("display_in_trip_page", event.target.checked)
                  }
                />
                Trip Page
              </label>
            </div>
          </FormGroup>
        </div>
        <div className="box-footer form-actions">
          <button className="btn btn-default" type="button" onClick={cancel}>
            Cancel
          </button>
          <button className="btn btn-primary" type="submit">
            Submit
          </button>
        </div>
      </form>
    </section>
  );
}
