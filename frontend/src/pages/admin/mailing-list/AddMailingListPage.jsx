import React, { useRef, useState } from "react";
import Icon from "@/components/admin/Icon";
import ValidationEngineMessage from "@/components/admin/ValidationEngineMessage";

const userTypes = [
  "Prospect",
  "Friend",
  "Client",
  "Referral",
  "Trade",
  "Agent",
  "Media",
  "Employee",
];
const newsletterInterests = [
  "Interests - Hiking and trekking",
  "Interests - Cultural and gourmet",
  "Interests - Ski and winter",
];

export default function AddMailingListPage({
  form,
  editingId,
  update,
  save,
  cancel,
}) {
  const formRef = useRef(null);
  const [validationErrors, setValidationErrors] = useState({});

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
    const control = event.target.closest?.("[data-mailing-validation]");
    const field = control?.getAttribute("data-mailing-validation");
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
      ["first_name", "last_name", "email_address"]
        .map((field) => [field, validateField(field)])
        .filter(([, error]) => error),
    );
    setValidationErrors(errors);
    const firstInvalid = Object.keys(errors)[0];
    if (firstInvalid) {
      const control = formRef.current?.querySelector(
        `[data-mailing-validation="${firstInvalid}"]`,
      );
      control?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      control?.querySelector("input")?.focus();
      return;
    }
    save(event);
  }

  function validatedInput(field, input) {
    return (
      <div
        className="mailing-validation-control"
        data-mailing-validation={field}
      >
        {React.cloneElement(input, {
          "aria-invalid": Boolean(validationErrors[field]),
          "aria-describedby": validationErrors[field]
            ? `mailing-validation-${field}`
            : undefined,
        })}
        {validationErrors[field] ? (
          <ValidationEngineMessage
            id={`mailing-validation-${field}`}
            message={validationErrors[field]}
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
              {editingId ? "Edit User" : "Add User"}
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
            <div className="box-body form-horizontal mailing-list-form">
              {[
                ["first_name", "First Name"],
                ["last_name", "Last Name"],
                ["email_address", "Email Address"],
              ].map(([field, label]) => (
                <div className="form-group row" key={field}>
                  <label className="col-sm-2 control-label" htmlFor={field}>
                    {label}
                  </label>
                  <div className="col-sm-10">
                    {validatedInput(
                      field,
                      <input
                        className="form-control"
                        id={field}
                        type="text"
                        placeholder="Enter ..."
                        value={form[field] || ""}
                        onChange={(event) =>
                          updateField(field, event.target.value)
                        }
                      />,
                    )}
                  </div>
                </div>
              ))}
              <div className="form-group row">
                <label className="col-sm-2 control-label">User Type</label>
                <div className="col-sm-10">
                  <div className="mailing-radio-options">
                    {userTypes.map((type) => (
                      <label key={type}>
                        <input
                          type="radio"
                          name="user_type"
                          value={type}
                          checked={form.user_type === type}
                          onChange={() => update("user_type", type)}
                        />
                        {type}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="form-group row">
                <label className="col-sm-2 control-label">
                  Option for Newsletter Signup
                </label>
                <div className="col-sm-10">
                  <div className="mailing-checkbox-options">
                    {newsletterInterests.map((interest) => (
                      <label key={interest}>
                        <input
                          type="checkbox"
                          checked={form.interests.includes(interest)}
                          onChange={(event) =>
                            update("interest", {
                              label: interest,
                              checked: event.target.checked,
                            })
                          }
                        />
                        <strong>{interest.replace(" - ", " – ")}</strong>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
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
