import React, { useRef, useState } from "react";

function ValidationPrompt({ error, onDismiss }) {
  return error ? (
    <button
      type="button"
      id="location-validation-name"
      className="location-validation-prompt"
      aria-label={`${error}. Dismiss message`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onDismiss}
    >
      {error}
    </button>
  ) : null;
}

export default function AddLocationPage({
  form,
  editingId,
  update,
  save,
  cancel,
}) {
  const formRef = useRef(null);
  const [validationError, setValidationError] = useState("");

  function validateName() {
    return String(form.name ?? "").trim() ? "" : "* This field is required";
  }

  function handleBlur(event) {
    if (!event.target.closest("[data-location-validation]")) return;
    setValidationError(validateName());
  }

  function handleSubmit(event) {
    event.preventDefault();
    const error = validateName();
    setValidationError(error);
    if (error) {
      const control = formRef.current?.querySelector(
        "[data-location-validation]",
      );
      control?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      control?.querySelector("input")?.focus();
      return;
    }
    save(event);
  }

  return (
    <div className="admin-row">
      <div className="admin-col-full">
        <section className="admin-box box-primary form-panel location-form">
          <div className="box-header with-border">
            <h3 className="box-title">
              {editingId ? "Edit Location" : "Add Location"}
            </h3>
          </div>
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            onBlurCapture={handleBlur}
            onClickCapture={(event) => {
              if (event.target.closest?.(".location-validation-prompt"))
                setValidationError("");
            }}
            className="form-horizontal"
            role="form"
            noValidate
          >
            <div className="box-body">
              <div className="form-group">
                <label className="col-sm-2 control-label" htmlFor="location-name">
                  Name
                </label>
                <div className="col-sm-10">
                  <div data-location-validation className="location-validation-control">
                    <input
                      id="location-name"
                      className="form-control"
                      required
                      value={form.name}
                      placeholder="Enter ..."
                      aria-invalid={Boolean(validationError)}
                      aria-describedby={
                        validationError
                          ? "location-validation-name"
                          : undefined
                      }
                      onChange={(event) => update("name", event.target.value)}
                    />
                    <ValidationPrompt
                      error={validationError}
                      onDismiss={() => setValidationError("")}
                    />
                  </div>
                </div>
              </div>
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
