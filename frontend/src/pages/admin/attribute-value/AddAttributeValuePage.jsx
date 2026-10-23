import React, { useRef, useState } from "react";
import { FormGroup, SearchableSelect } from "@/components/admin/FormFields";

const integerPattern = /^[+-]?\d+$/;

function ValidationPrompt({ error, field, onDismiss }) {
  return error ? (
    <button
      type="button"
      id={`attribute-value-validation-${field}`}
      className="attribute-value-validation-prompt"
      data-attribute-value-validation-prompt={field}
      aria-label={`${error}. Dismiss message`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onDismiss}
    >
      {error}
    </button>
  ) : null;
}

export default function AddAttributeValuePage({
  form,
  types,
  editingId,
  update,
  save,
  cancel,
}) {
  const formRef = useRef(null);
  const [validationErrors, setValidationErrors] = useState({});

  function validateField(key) {
    if (key === "type_id")
      return String(form.type_id ?? "").trim()
        ? ""
        : "* This field is required";
    if (key === "name")
      return String(form.name ?? "").trim() ? "" : "* This field is required";
    if (key === "display_order") {
      const order = String(form.display_order ?? "").trim();
      if (!order) return "* This field is required";
      if (!integerPattern.test(order)) return "* Not a valid integer";
    }
    return "";
  }

  function validateForm() {
    const errors = {};
    for (const key of ["type_id", "name", "display_order"]) {
      const error = validateField(key);
      if (error) errors[key] = error;
    }
    return errors;
  }

  function handleBlur(event) {
    const control = event.target.closest?.("[data-attribute-value-validation]");
    const key = control?.getAttribute("data-attribute-value-validation");
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

  function updateField(key, value) {
    update(key, value);
    if (validationErrors[key]) dismissError(key);
  }

  function handleSubmit(event) {
    event.preventDefault();
    const errors = validateForm();
    setValidationErrors(errors);
    const firstInvalid = ["type_id", "name", "display_order"].find(
      (key) => errors[key],
    );
    if (firstInvalid) {
      const control = formRef.current?.querySelector(
        `[data-attribute-value-validation="${firstInvalid}"]`,
      );
      control?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      control?.querySelector("input, button")?.focus();
      return;
    }
    save(event);
  }

  function control(key, child) {
    return (
      <div
        className="attribute-value-validation-control"
        data-attribute-value-validation={key}
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

  return (
    <div className="admin-row">
      <div className="admin-col-full">
        <section className="admin-box box-primary form-panel attribute-value-form">
          <div className="box-header with-border">
            <h3 className="box-title">
              {editingId ? "Edit Attribute Value" : "Add Attribute Value"}
            </h3>
          </div>
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            onBlurCapture={handleBlur}
            onClickCapture={(event) => {
              const prompt = event.target.closest?.(
                "[data-attribute-value-validation-prompt]",
              );
              const key = prompt?.getAttribute(
                "data-attribute-value-validation-prompt",
              );
              if (key) dismissError(key);
            }}
            className="form-horizontal"
            role="form"
            noValidate
          >
            <div className="box-body">
              <FormGroup label="Attribute Type">
                {control(
                  "type_id",
                  <SearchableSelect
                    label="Attribute Type"
                    bare
                    required
                    value={form.type_id}
                    onChange={(event) =>
                      updateField("type_id", event.target.value)
                    }
                    buttonProps={{
                      "aria-invalid": Boolean(validationErrors.type_id),
                      "aria-describedby": validationErrors.type_id
                        ? "attribute-value-validation-type_id"
                        : undefined,
                    }}
                  >
                    <option value="">-- Select Attribute Type --</option>
                    {types
                      .filter(
                        (type) =>
                          type.status === "Active" ||
                          String(type.id) === String(form.type_id),
                      )
                      .map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                  </SearchableSelect>,
                )}
              </FormGroup>
              <FormGroup label="Name">
                {control(
                  "name",
                  <input
                    className="form-control"
                    required
                    value={form.name ?? ""}
                    placeholder="Enter ..."
                    aria-invalid={Boolean(validationErrors.name)}
                    aria-describedby={
                      validationErrors.name
                        ? "attribute-value-validation-name"
                        : undefined
                    }
                    onChange={(event) =>
                      updateField("name", event.target.value)
                    }
                  />,
                )}
              </FormGroup>
              <FormGroup label="Order">
                {control(
                  "display_order",
                  <input
                    className="form-control"
                    required
                    type="text"
                    inputMode="numeric"
                    value={form.display_order ?? ""}
                    placeholder="Enter ..."
                    aria-invalid={Boolean(validationErrors.display_order)}
                    aria-describedby={
                      validationErrors.display_order
                        ? "attribute-value-validation-display_order"
                        : undefined
                    }
                    onChange={(event) =>
                      updateField("display_order", event.target.value)
                    }
                  />,
                )}
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
