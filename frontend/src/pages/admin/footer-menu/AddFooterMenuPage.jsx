import React, { useRef, useState } from "react";
import { FormGroup, SearchableSelect } from "@/components/admin/FormFields";

const integerPattern = /^[+-]?\d+$/;

function ValidationPrompt({ error, field, onDismiss }) {
  return error ? (
    <button
      type="button"
      id={`footer-validation-${field}`}
      className="footer-validation-prompt"
      data-footer-validation-prompt={field}
      aria-label={`${error}. Dismiss message`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onDismiss}
    >
      {error}
    </button>
  ) : null;
}

export default function AddFooterMenuPage({
  form,
  editingId,
  update,
  save,
  cancel,
}) {
  const formRef = useRef(null);
  const [validationErrors, setValidationErrors] = useState({});

  const validateField = (field) => {
    if (["title", "under", "link"].includes(field)) {
      if (!String(form[field] ?? "").trim()) return "* This field is required";
    }
    if (field === "display_order") {
      const order = String(form.display_order ?? "").trim();
      if (!order) return "* This field is required";
      if (!integerPattern.test(order)) return "* Not a valid integer";
    }
    return "";
  };

  const validateForm = () => {
    const errors = {};
    for (const field of ["title", "under", "link", "display_order"]) {
      const error = validateField(field);
      if (error) errors[field] = error;
    }
    return errors;
  };

  const handleBlur = (event) => {
    const control = event.target.closest?.("[data-footer-validation]");
    const field = control?.getAttribute("data-footer-validation");
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
    event.preventDefault();
    const errors = validateForm();
    setValidationErrors(errors);
    const firstInvalid = Object.keys(errors)[0];
    if (firstInvalid) {
      const control = formRef.current?.querySelector(
        `[data-footer-validation="${firstInvalid}"]`,
      );
      control?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      control?.querySelector("input")?.focus();
      return;
    }
    save(event);
  };

  const control = (field, child) => (
    <div
      className="footer-validation-control"
      data-footer-validation={field}
    >
      {child}
      <ValidationPrompt
        error={validationErrors[field]}
        field={field}
        onDismiss={() => dismissError(field)}
      />
    </div>
  );

  const textField = (name, label, placeholder = "Enter ...") => (
    <FormGroup label={label}>
      {control(
        name,
        <input
          className="form-control"
          type="text"
          value={form[name] ?? ""}
          placeholder={placeholder}
          required
          aria-invalid={Boolean(validationErrors[name])}
          aria-describedby={
            validationErrors[name] ? `footer-validation-${name}` : undefined
          }
          onChange={(event) => update(name, event.target.value)}
        />,
      )}
    </FormGroup>
  );

  return (
    <div className="admin-row">
      <div className="admin-col-full">
        <section className="admin-box box-primary form-panel">
          <div className="box-header with-border">
            <h3 className="box-title">
              {editingId ? "Edit Footer Menu" : "Add Footer Menu"}
            </h3>
          </div>
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            onBlurCapture={handleBlur}
            onClickCapture={(event) => {
              const prompt = event.target.closest?.(
                "[data-footer-validation-prompt]",
              );
              const field = prompt?.getAttribute(
                "data-footer-validation-prompt",
              );
              if (field) dismissError(field);
            }}
            className="form-horizontal footer-menu-form"
            role="form"
            noValidate
          >
            <div className="box-body">
              {textField("title", "Title")}
              <FormGroup label="Display Under Heading">
                {control(
                  "under",
                  <SearchableSelect
                    bare
                    label="Display Under Heading"
                    value={form.under}
                    placeholder="-- Select Heading --"
                    required
                    className={validationErrors.under ? "is-invalid" : ""}
                    buttonProps={{
                      "aria-invalid": Boolean(validationErrors.under),
                      "aria-describedby": validationErrors.under
                        ? "footer-validation-under"
                        : undefined,
                    }}
                    onChange={(event) => {
                      update("under", event.target.value);
                      setValidationErrors((current) => {
                        const next = { ...current };
                        if (event.target.value)
                          delete next.under;
                        else next.under = "* This field is required";
                        return next;
                      });
                    }}
                  >
                    <option value="">-- Select Heading --</option>
                    <option value="Blogs">Blogs</option>
                    <option value="HappyGuests">Happy Guests</option>
                    <option value="WhatNew">What's New?</option>
                    <option value="AlpenwildRecommended">
                      Alpenwild Recommended
                    </option>
                    <option value="NecessaryInfo">Necessary Info</option>
                  </SearchableSelect>,
                )}
              </FormGroup>
              {textField("link", "Link")}
              <FormGroup label="Link Traget">
                <SearchableSelect
                  bare
                  label="Link Traget"
                  value={form.link_target}
                  onChange={(event) =>
                    update("link_target", event.target.value)
                  }
                >
                  <option value="_self">Self</option>
                  <option value="_blank">Blank</option>
                  <option value="_parent">Parent</option>
                  <option value="_top">Top</option>
                </SearchableSelect>
              </FormGroup>
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
                        ? "footer-validation-display_order"
                        : undefined
                    }
                    onChange={(event) =>
                      update("display_order", event.target.value)
                    }
                  />,
                )}
              </FormGroup>
            </div>
            <div className="box-footer form-actions">
              <button type="button" className="btn btn-default" onClick={cancel}>
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
