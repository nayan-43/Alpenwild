import React, { useRef, useState } from "react";
import { FormGroup } from "@/components/admin/FormFields";

const fields = ["name", "code", "type", "value", "start_date", "end_date"];

function ValidationPrompt({ error, field, onDismiss }) {
  return error ? (
    <button
      type="button"
      id={`discount-validation-${field}`}
      className="discount-validation-prompt"
      data-discount-validation-prompt={field}
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

export default function AddDiscountPage({
  form,
  editingId,
  update,
  save,
  cancel,
}) {
  const formRef = useRef(null);
  const [validationErrors, setValidationErrors] = useState({});

  function validateField(field) {
    const value = String(form[field] ?? "").trim();
    if (["name", "code"].includes(field) && !value)
      return "* This field is required";
    if (field === "type")
      return ["Fixed", "Percentage"].includes(form.type)
        ? ""
        : "* This field is required";
    if (field === "value") {
      if (!value) return "* This field is required";
      return /^[+-]?\d+$/.test(value) && Number.isSafeInteger(Number(value))
        ? ""
        : "* Not a valid integer";
    }
    if (["start_date", "end_date"].includes(field)) {
      if (!value) return "* This field is required";
      if (!isValidDate(value)) return "* Please enter a valid date";
      if (
        field === "end_date" &&
        form.start_date &&
        isValidDate(form.start_date) &&
        value < form.start_date
      )
        return "* End date must be on or after the start date";
    }
    return "";
  }

  function validateForm() {
    return Object.fromEntries(
      fields
        .map((field) => [field, validateField(field)])
        .filter(([, error]) => error),
    );
  }

  function setFieldErrors(keys) {
    setValidationErrors((current) => {
      const next = { ...current };
      for (const field of keys) {
        const error = validateField(field);
        if (error) next[field] = error;
        else delete next[field];
      }
      return next;
    });
  }

  function handleBlur(event) {
    const wrapper = event.target.closest?.("[data-discount-validation]");
    const field = wrapper?.getAttribute("data-discount-validation");
    if (!field || wrapper.contains(event.relatedTarget)) return;
    setFieldErrors(field === "start_date" ? [field, "end_date"] : [field]);
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
        `[data-discount-validation="${firstInvalid}"]`,
      );
      wrapper?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      wrapper?.querySelector("input, select")?.focus();
      return;
    }
    save(event);
  }

  function control(field, child) {
    return (
      <div
        className="discount-validation-control"
        data-discount-validation={field}
      >
        {React.cloneElement(child, {
          "aria-invalid": Boolean(validationErrors[field]),
          "aria-describedby": validationErrors[field]
            ? `discount-validation-${field}`
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

  function handleValidationPromptClick(event) {
    const prompt = event.target.closest?.("[data-discount-validation-prompt]");
    const field = prompt?.getAttribute("data-discount-validation-prompt");
    if (field) dismissError(field);
  }

  return (
    <div className="admin-row">
      <div className="admin-col-full">
        <section className="admin-box box-primary form-panel discount-form">
          <div className="box-header with-border">
            <h3 className="box-title">
              {editingId ? "Edit Discount" : "Add Discount"}
            </h3>
          </div>
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            onBlurCapture={handleBlur}
            onClickCapture={handleValidationPromptClick}
            className="form-horizontal"
            role="form"
            noValidate
          >
            <div className="box-body">
              <FormGroup label="Title">
                {control(
                  "name",
                  <input
                    className="form-control"
                    placeholder="Enter ..."
                    required
                    value={form.name}
                    onChange={(event) => update("name", event.target.value)}
                  />,
                )}
              </FormGroup>
              <FormGroup label="Code">
                {control(
                  "code",
                  <input
                    className="form-control"
                    placeholder="Enter ..."
                    required
                    value={form.code}
                    onChange={(event) => update("code", event.target.value)}
                  />,
                )}
              </FormGroup>
              <FormGroup label="Type">
                {control(
                  "type",
                  <select
                    className="form-control"
                    required
                    value={form.type}
                    onChange={(event) => update("type", event.target.value)}
                  >
                    <option value="">Select Type</option>
                    <option value="Fixed">Fixed</option>
                    <option value="Percentage">Percentage (%)</option>
                  </select>,
                )}
              </FormGroup>
              <FormGroup label="Value">
                {control(
                  "value",
                  <input
                    className="form-control"
                    placeholder="Enter ..."
                    required
                    type="text"
                    inputMode="numeric"
                    value={form.value}
                    onChange={(event) => update("value", event.target.value)}
                  />,
                )}
              </FormGroup>
              <FormGroup label="Start Date (dd-mm-yy)">
                {control(
                  "start_date",
                  <input
                    className="form-control"
                    required
                    type="date"
                    max={form.end_date || undefined}
                    value={form.start_date}
                    onChange={(event) =>
                      update("start_date", event.target.value)
                    }
                  />,
                )}
              </FormGroup>
              <FormGroup label="End Date (dd-mm-yy)">
                {control(
                  "end_date",
                  <input
                    className="form-control"
                    required
                    type="date"
                    min={form.start_date || undefined}
                    value={form.end_date}
                    onChange={(event) => update("end_date", event.target.value)}
                  />,
                )}
              </FormGroup>
            </div>
            <div className="box-footer form-actions">
              <button type="button" className="button" onClick={cancel}>
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
