import React, { useRef, useState } from "react";
import ValidationEngineMessage from "@/components/admin/ValidationEngineMessage";

export default function AddRedirectionPage({
  form,
  editingId,
  update,
  save,
  cancel,
}) {
  const formRef = useRef(null);
  const [validationErrors, setValidationErrors] = useState({});
  const fields = [
    ["old_redirection_url", "Old URL"],
    ["new_redirection_url", "New URL"],
  ];

  function validateField(field) {
    return String(form[field] ?? "").trim() ? "" : "* This field is required";
  }

  function updateField(field, value) {
    update(field, value);
    if (validationErrors[field] && String(value).trim()) {
      setValidationErrors((current) => {
        const next = { ...current };
        delete next[field];
        return next;
      });
    }
  }

  function handleBlur(event) {
    const control = event.target.closest?.("[data-redirection-validation]");
    const field = control?.getAttribute("data-redirection-validation");
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
      fields
        .map(([field]) => [field, validateField(field)])
        .filter(([, error]) => error),
    );
    setValidationErrors(errors);
    const firstInvalid = Object.keys(errors)[0];
    if (firstInvalid) {
      const control = formRef.current?.querySelector(
        `[data-redirection-validation="${firstInvalid}"]`,
      );
      control?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      control?.querySelector("input")?.focus();
      return;
    }
    save(event);
  }

  function validatedInput(field, label) {
    const error = validationErrors[field];
    return (
      <div
        className="redirection-validation-control"
        data-redirection-validation={field}
      >
        <input
          className="form-control"
          id={field}
          name={field}
          type="text"
          placeholder="Enter ..."
          value={form[field] || ""}
          aria-label={label}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error ? `redirection-validation-${field}` : undefined
          }
          onChange={(event) => updateField(field, event.target.value)}
        />
        {error ? (
          <ValidationEngineMessage
            id={`redirection-validation-${field}`}
            message={error}
            onDismiss={() =>
              setValidationErrors((current) => {
                const next = { ...current };
                delete next[field];
                return next;
              })
            }
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="admin-row">
      <div className="admin-col-full">
        <section className="admin-box box-primary form-panel">
          <div className="box-header with-border">
            <h3 className="box-title">
              {editingId ? "Edit 301 Redirection" : "Add 301 Redirection"}
            </h3>
          </div>
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            onBlurCapture={handleBlur}
            className="form-horizontal"
            role="form"
            noValidate
          >
            <div className="box-body form-horizontal redirection-form">
              {fields.map(([field, label]) => (
                <div className="form-group row" key={field}>
                  <label className="col-sm-2 control-label" htmlFor={field}>
                    {label}
                  </label>
                  <div className="col-sm-10">
                    {validatedInput(field, label)}
                  </div>
                </div>
              ))}
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
      </div>
    </div>
  );
}
