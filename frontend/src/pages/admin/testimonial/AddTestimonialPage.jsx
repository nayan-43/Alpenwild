import React, { useRef, useState } from "react";
import { FormGroup, SearchableSelect } from "@/components/admin/FormFields";

const requiredFields = ["client_details", "content", "display_order"];
const integerPattern = /^[+-]?\d+$/;

function ValidationPrompt({ error, field, onDismiss }) {
  return error ? (
    <button
      type="button"
      id={`testimonial-validation-${field}`}
      className="testimonial-validation-prompt"
      data-testimonial-validation-prompt={field}
      aria-label={`${error}. Dismiss message`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onDismiss}
    >
      {error}
    </button>
  ) : null;
}

export default function AddTestimonialPage({
  form,
  trips,
  editingId,
  update,
  save,
}) {
  const formRef = useRef(null);
  const [validationErrors, setValidationErrors] = useState({});
  const activeTrips = trips.filter((trip) => trip.status === "Active");

  function validateField(field) {
    const value = String(form[field] ?? "").trim();
    if (!value) return "* This field is required";
    if (field === "display_order" && !integerPattern.test(value))
      return "* Not a valid integer";
    return "";
  }

  function dismissError(field) {
    setValidationErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleBlur(event) {
    const control = event.target.closest?.("[data-testimonial-validation]");
    const field = control?.getAttribute("data-testimonial-validation");
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
        `[data-testimonial-validation="${firstInvalid}"]`,
      );
      control?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      control?.querySelector("input, textarea")?.focus();
      return;
    }
    save(event);
  }

  function validationControl(field, child) {
    return (
      <div
        className="testimonial-validation-control"
        data-testimonial-validation={field}
      >
        {child}
        <ValidationPrompt
          error={validationErrors[field]}
          field={field}
          onDismiss={() => dismissError(field)}
        />
      </div>
    );
  }

  return (
    <div className="admin-row">
      <div className="admin-col-full">
        <section className="admin-box box-primary form-panel">
          <div className="box-header with-border">
            <h3 className="box-title">
              {editingId ? "Edit Testimonial" : "Add Testimonial"}
            </h3>
          </div>
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            onBlurCapture={handleBlur}
            onClickCapture={(event) => {
              const prompt = event.target.closest?.(
                "[data-testimonial-validation-prompt]",
              );
              const field = prompt?.getAttribute(
                "data-testimonial-validation-prompt",
              );
              if (field) dismissError(field);
            }}
            className="form-horizontal testimonial-form"
            role="form"
            noValidate
          >
            <div className="box-body">
              <FormGroup label="Trip (If you want to display the same testimonial under a trip).">
                <SearchableSelect
                  bare
                  label="Trip"
                  placeholder="-- Select Trip --"
                  value={form.trip_id}
                  onChange={(event) => update("trip_id", event.target.value)}
                  buttonProps={{ id: "trips_id" }}
                >
                  <option value="">-- Select Trip --</option>
                  {activeTrips.map((trip) => (
                    <option value={trip.id} key={trip.id}>
                      {trip.name}
                    </option>
                  ))}
                </SearchableSelect>
              </FormGroup>
              <FormGroup label="Client Details">
                {validationControl(
                  "client_details",
                  <input
                    id="testimonial_client_details"
                    name="testimonial_client_details"
                    className="form-control"
                    required
                    value={form.client_details}
                    onChange={(event) => {
                      dismissError("client_details");
                      update("client_details", event.target.value);
                    }}
                    placeholder="Enter ..."
                    aria-invalid={Boolean(validationErrors.client_details)}
                    aria-describedby={
                      validationErrors.client_details
                        ? "testimonial-validation-client_details"
                        : undefined
                    }
                  />,
                )}
              </FormGroup>
              <FormGroup label="Description">
                {validationControl(
                  "content",
                  <textarea
                    id="testimonial_content"
                    name="testimonial_content"
                    className="form-control"
                    required
                    value={form.content}
                    onChange={(event) => {
                      dismissError("content");
                      update("content", event.target.value);
                    }}
                    placeholder="Enter ..."
                    aria-invalid={Boolean(validationErrors.content)}
                    aria-describedby={
                      validationErrors.content
                        ? "testimonial-validation-content"
                        : undefined
                    }
                  />,
                )}
              </FormGroup>
              <FormGroup label="Order">
                {validationControl(
                  "display_order",
                  <input
                    id="testimonial_order"
                    name="testimonial_order"
                    className="form-control"
                    required
                    type="text"
                    value={form.display_order}
                    onChange={(event) => {
                      dismissError("display_order");
                      update("display_order", event.target.value);
                    }}
                    placeholder="Enter ..."
                    aria-invalid={Boolean(validationErrors.display_order)}
                    aria-describedby={
                      validationErrors.display_order
                        ? "testimonial-validation-display_order"
                        : undefined
                    }
                  />,
                )}
              </FormGroup>
            </div>
            <div className="box-footer">
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
