import React, { useRef, useState } from "react";
import { FormGroup, SearchableSelect } from "@/components/admin/FormFields";

function ValidationPrompt({ field, error, onDismiss }) {
  return error ? (
    <button
      type="button"
      id={`product-attribute-validation-${field}`}
      className="product-validation-prompt"
      aria-label={`${error}. Dismiss message`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onDismiss}
    >
      {error}
    </button>
  ) : null;
}

export default function AddProductAttributePage({
  form,
  products,
  types,
  values,
  editingId,
  update,
  save,
}) {
  const formRef = useRef(null);
  const [validationErrors, setValidationErrors] = useState({});
  const selectedType = String(form.type_id || "");
  const activeProducts = products.filter(
    (product) => String(product.status).toLowerCase() === "active",
  );
  const activeTypes = types.filter(
    (type) => String(type.status).toLowerCase() === "active",
  );
  const availableValues = values.filter((value) => {
    const valueType = value.type_id ?? value.attribute_type_id;
    return (
      String(value.status).toLowerCase() === "active" &&
      (!selectedType || String(valueType) === selectedType)
    );
  });

  function validateField(field) {
    const value = String(form[field] ?? "");
    const validOptions = {
      product_id: activeProducts,
      type_id: activeTypes,
      value_id: availableValues,
    }[field];
    const isSelected = validOptions?.some(
      (option) =>
        String(option.id ?? option.attribute_value_id) === value && value,
    );
    return isSelected ? "" : "* This field is required";
  }

  function dismissError(field) {
    setValidationErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function updateField(field, value) {
    update(field, value);
    dismissError(field);
  }

  function handleBlur(event) {
    const control = event.target.closest?.("[data-product-validation]");
    const field = control?.getAttribute("data-product-validation");
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
      ["product_id", "type_id", "value_id"]
        .map((field) => [field, validateField(field)])
        .filter(([, error]) => error),
    );
    setValidationErrors(errors);
    const firstInvalid = ["product_id", "type_id", "value_id"].find(
      (field) => errors[field],
    );
    if (firstInvalid) {
      const control = formRef.current?.querySelector(
        `[data-product-validation="${firstInvalid}"]`,
      );
      control?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      control?.querySelector("button")?.focus();
      return;
    }
    save(event);
  }

  function renderSelect(field, label, options, optionLabel, placeholder) {
    const error = validationErrors[field];
    const errorId = `product-attribute-validation-${field}`;
    return (
      <FormGroup label={label}>
        <div
          className="product-validation-control"
          data-product-validation={field}
        >
          <SearchableSelect
            bare
            label={label}
            required
            placeholder={placeholder}
            value={form[field]}
            onChange={(event) => {
              if (field === "type_id") {
                updateField("type_id", event.target.value);
                updateField("value_id", "");
              } else {
                updateField(field, event.target.value);
              }
            }}
            buttonProps={{
              "aria-invalid": Boolean(error),
              "aria-describedby": error ? errorId : undefined,
            }}
          >
            <option value="">{placeholder}</option>
            {options.map((option) => (
              <option
                key={option.id ?? option.attribute_value_id}
                value={option.id ?? option.attribute_value_id}
              >
                {optionLabel(option)}
              </option>
            ))}
          </SearchableSelect>
          <ValidationPrompt
            field={field}
            error={error}
            onDismiss={() => dismissError(field)}
          />
        </div>
      </FormGroup>
    );
  }

  return (
    <div className="admin-row">
      <div className="admin-col-full">
        <section className="admin-box box-primary form-panel product-attribute-form">
          <div className="box-header with-border">
            <h3 className="box-title">
              {editingId ? "Edit Attribute" : "Add Attribute"}
            </h3>
          </div>
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            onBlurCapture={handleBlur}
            onClickCapture={(event) => {
              if (event.target.closest?.(".product-validation-prompt")) {
                const field = event.target
                  .closest("[data-product-validation]")
                  ?.getAttribute("data-product-validation");
                if (field) dismissError(field);
              }
            }}
            className="form-horizontal"
            role="form"
            noValidate
          >
            <div className="box-body">
              {renderSelect(
                "product_id",
                "Product",
                activeProducts,
                (product) => product.name,
                "-- Select Product --",
              )}
              {renderSelect(
                "type_id",
                "Attribute Type",
                activeTypes,
                (type) => type.name,
                "-- Select Attribute Type --",
              )}
              {renderSelect(
                "value_id",
                "Attribute Value",
                availableValues,
                (value) => value.name ?? value.attribute_value,
                "-- Select Attribute Value --",
              )}
            </div>
            <div className="box-footer">
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
