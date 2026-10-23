import React, { useEffect, useRef, useState } from "react";
import RichTextEditor from "@/components/admin/RichTextEditor";
import Icon from "@/components/admin/Icon";
import { FormGroup, SearchableSelect } from "@/components/admin/FormFields";
import { adminThumbnailUrl } from "@/lib/assets";

const fields = [
  ["name", "Name"],
  ["menu_name", "Menu Name"],
  ["meta_title", "Meta Title"],
  ["meta_descriptions", "Meta Descriptions"],
  ["meta_keywords", "Meta Keywords"],
  ["short_descriptions", "Short Description"],
  ["description", "Description"],
  ["price", "Price"],
  ["banner_title", "Banner Title"],
  ["banner_sub_title", "Banner Sub Title"],
  ["tooltip_text", "Tooltip Text"],
];

const requiredFields = [
  "name",
  "category_id",
  "menu_name",
  "meta_title",
  "meta_descriptions",
  "meta_keywords",
  "short_descriptions",
  "description",
  "price",
  "listing_image",
  "display_order",
];
const integerPattern = /^[+-]?\d+$/;
const numberPattern = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;

function ValidationPrompt({ error, field, onDismiss }) {
  return error ? (
    <button
      type="button"
      id={`product-validation-${field}`}
      className="product-validation-prompt"
      data-product-validation-prompt={field}
      aria-label={`${error}. Dismiss message`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onDismiss}
    >
      {error}
    </button>
  ) : null;
}

function AdditionalImageDropzone({ files, update }) {
  const [previews, setPreviews] = useState([]);
  const [dragged, setDragged] = useState(false);

  useEffect(() => {
    const nextPreviews = (files || []).map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));
    setPreviews(nextPreviews);
    return () =>
      nextPreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
  }, [files]);

  function addFiles(selected) {
    const images = Array.from(selected || []).filter((file) =>
      file.type.startsWith("image/"),
    );
    const existing = files || [];
    const uniqueImages = images.filter(
      (file) =>
        !existing.some(
          (current) =>
            current.name === file.name &&
            current.size === file.size &&
            current.lastModified === file.lastModified,
        ),
    );
    update("additional_images", [...existing, ...uniqueImages]);
  }

  function removeFile(index) {
    if (!window.confirm("Are you sure you want to remove this file?")) return;
    update(
      "additional_images",
      files.filter((_item, fileIndex) => fileIndex !== index),
    );
  }

  return (
    <>
      <div
        className={`jFiler${dragged ? " dragged" : ""}`}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragged(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget))
            setDragged(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragged(false);
          addFiles(event.dataTransfer.files);
        }}
      >
        <div className="jFiler-input-dragDrop">
          <div className="jFiler-input-inner">
            <div className="jFiler-input-icon" aria-hidden="true">
              <i className="icon-jfi-cloud-up-o" />
            </div>
            <div className="jFiler-input-text">
              <h3>Drag&amp;Drop files here</h3>
              <span>or</span>
            </div>
            <label className="jFiler-input-choose-btn blue">
              Browse Files
              <input
                className="jFiler-input-hidden"
                type="file"
                accept="image/*"
                multiple
                style={{ display: "none" }}
                onChange={(event) => {
                  addFiles(event.target.files);
                  event.target.value = "";
                }}
              />
            </label>
          </div>
        </div>
        {previews.length ? (
          <ul className="jFiler-items-list jFiler-items-grid">
            {previews.map((preview, index) => (
              <li
                className="jFiler-item"
                key={`${preview.file.name}-${preview.file.lastModified}-${index}`}
              >
                <div className="jFiler-item-container">
                  <div className="jFiler-item-inner">
                    <div className="jFiler-item-thumb">
                      <div className="jFiler-item-info">
                        <span className="jFiler-item-title">
                          <b title={preview.file.name}>
                            {preview.file.name.length > 25
                              ? `${preview.file.name.slice(0, 25)}...`
                              : preview.file.name}
                          </b>
                        </span>
                        <span className="jFiler-item-others">
                          {formatFileSize(preview.file.size)}
                        </span>
                      </div>
                      <div className="jFiler-item-thumb-image">
                        <img src={preview.url} alt={preview.file.name} />
                      </div>
                    </div>
                    <div className="jFiler-item-assets jFiler-row">
                      <span className="jFiler-item-others text-success">
                        <span aria-hidden="true">✓</span> Success
                      </span>
                      <button
                        type="button"
                        className="jFiler-item-trash-action"
                        aria-label={`Remove ${preview.file.name}`}
                        onClick={() => removeFile(index)}
                      >
                        <Icon name="trash" size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </>
  );
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AddProductPage({
  form,
  categories,
  editingId,
  update,
  updateBox,
  addBox,
  removeBox,
  removeAdditional,
  save,
  cancel,
}) {
  const formRef = useRef(null);
  const [validationErrors, setValidationErrors] = useState({});
  const hasListingImage = Boolean(form.listing_image || form.listing_image_url);

  function validateField(key) {
    const value = String(form[key] ?? "").trim();
    if (key === "listing_image")
      return hasListingImage ? "" : "* This field is required";
    if (!value) return "* This field is required";
    if (
      key === "price" &&
      (!numberPattern.test(value) || !Number.isFinite(Number(value)))
    )
      return "* Not a valid number";
    if (key === "display_order") {
      const order = Number(value);
      if (
        !integerPattern.test(value) ||
        !Number.isSafeInteger(order) ||
        order < -2147483648 ||
        order > 2147483647
      )
        return "* Not a valid integer";
    }
    if (
      key === "description" &&
      !value
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;|&#160;/gi, " ")
        .trim()
    )
      return "* This field is required";
    return "";
  }

  function validateForm() {
    const errors = {};
    for (const key of requiredFields) {
      const error = validateField(key);
      if (error) errors[key] = error;
    }
    return errors;
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

  function handleBlur(event) {
    const control = event.target.closest?.("[data-product-validation]");
    const key = control?.getAttribute("data-product-validation");
    if (!key || control.contains(event.relatedTarget)) return;
    const error = validateField(key);
    setValidationErrors((current) => {
      const next = { ...current };
      if (error) next[key] = error;
      else delete next[key];
      return next;
    });
  }

  function handleSubmit(event) {
    event.preventDefault();
    const errors = validateForm();
    setValidationErrors(errors);
    const firstInvalid = requiredFields.find((key) => errors[key]);
    if (firstInvalid) {
      const control = formRef.current?.querySelector(
        `[data-product-validation="${firstInvalid}"]`,
      );
      control?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      control?.querySelector("input, textarea, button")?.focus();
      return;
    }
    save(event);
  }

  function control(key, child) {
    return (
      <div className="product-validation-control" data-product-validation={key}>
        {child}
        <ValidationPrompt
          error={validationErrors[key]}
          field={key}
          onDismiss={() => dismissError(key)}
        />
      </div>
    );
  }

  function renderField([key, label]) {
    const props = {
      className: "form-control",
      required: requiredFields.includes(key),
      value: form[key] ?? "",
      placeholder: "Enter ...",
      "aria-invalid": Boolean(validationErrors[key]),
      "aria-describedby": validationErrors[key]
        ? `product-validation-${key}`
        : undefined,
      onChange: (event) => {
        const maxLength =
          key === "meta_title"
            ? 60
            : key === "meta_descriptions"
              ? 160
              : undefined;
        updateField(
          key,
          maxLength
            ? event.target.value.slice(0, maxLength)
            : event.target.value,
        );
      },
    };
    let input;
    if (key === "description") {
      input = (
        <RichTextEditor
          {...props}
          onChange={(value) => updateField(key, value)}
          onBlur={() => {
            const error = validateField(key);
            setValidationErrors((current) => {
              const next = { ...current };
              if (error) next[key] = error;
              else delete next[key];
              return next;
            });
          }}
        />
      );
    } else if (
      ["meta_descriptions", "meta_keywords", "short_descriptions"].includes(key)
    ) {
      input = <textarea {...props} />;
    } else {
      input = (
        <input
          {...props}
          type="text"
          maxLength={
            key === "meta_title"
              ? 60
              : key === "meta_descriptions"
                ? 160
                : undefined
          }
        />
      );
    }

    return (
      <FormGroup label={label} className="product-field" key={key}>
        {control(key, input)}
      </FormGroup>
    );
  }

  return (
    <div className="admin-row">
      <div className="admin-col-full">
        <section className="admin-box box-primary form-panel product-form">
          <div className="box-header with-border">
            <h3 className="box-title">
              {editingId ? "Edit Product" : "Add Product"}
            </h3>
          </div>
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            onBlurCapture={handleBlur}
            onClickCapture={(event) => {
              const prompt = event.target.closest?.(
                "[data-product-validation-prompt]",
              );
              const key = prompt?.getAttribute(
                "data-product-validation-prompt",
              );
              if (key) dismissError(key);
            }}
            className="form-horizontal"
            role="form"
            noValidate
            encType="multipart/form-data"
          >
            <div className="box-body">
              {renderField(fields[0])}
              <FormGroup label="Category" className="product-field">
                {control(
                  "category_id",
                  <SearchableSelect
                    bare
                    label="Category"
                    required
                    value={form.category_id}
                    onChange={(event) =>
                      updateField("category_id", event.target.value)
                    }
                    buttonProps={{
                      "aria-invalid": Boolean(validationErrors.category_id),
                      "aria-describedby": validationErrors.category_id
                        ? "product-validation-category_id"
                        : undefined,
                    }}
                  >
                    <option value="">-- Select Category --</option>
                    {categories
                      .filter(
                        (item) =>
                          item.status === "Active" ||
                          String(item.id) === String(form.category_id),
                      )
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                  </SearchableSelect>,
                )}
              </FormGroup>
              {fields.slice(1, 7).map(renderField)}
              {renderField(fields[7])}
              {fields.slice(8).map(renderField)}
              <FormGroup label="Banner Image" className="product-field">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    updateField("banner_image", event.target.files[0] || null)
                  }
                />
              </FormGroup>
              {renderField(["banner_alt", "Banner Image Alt"])}
              <FormGroup label="Listing Image" className="product-field">
                {control(
                  "listing_image",
                  <input
                    type="file"
                    accept="image/*"
                    aria-invalid={Boolean(validationErrors.listing_image)}
                    aria-describedby={
                      validationErrors.listing_image
                        ? "product-validation-listing_image"
                        : undefined
                    }
                    onChange={(event) =>
                      updateField(
                        "listing_image",
                        event.target.files[0] || null,
                      )
                    }
                  />,
                )}
              </FormGroup>
              {renderField(["listing_image_alt", "Listing Image Alt"])}
              <FormGroup
                label="Uploaded Additional Images"
                className="product-field product-uploaded-images-field"
              >
                <div className="product-uploaded-images">
                  {(form.existing_additional_images || []).map((image) => (
                    <div className="product-existing-image" key={image.id}>
                      <img
                        src={adminThumbnailUrl(image.image_url)}
                        alt={image.image}
                      />
                      <button
                        type="button"
                        className="blktxt"
                        onClick={() => removeAdditional(image)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </FormGroup>
              <FormGroup
                label="Additional Images"
                className="product-field product-additional-images-field"
              >
                <AdditionalImageDropzone
                  files={form.additional_images}
                  update={update}
                />
              </FormGroup>
              {renderField(["display_order", "Order"])}
              <div className="full product-box-images">
                {form.box_images.map((box, index) => (
                  <section
                    className="repeat-form-wrap product-box-row"
                    key={index}
                  >
                    <div className="box-header with-border">
                      <h3 className="box-title">Box Image {index + 1}</h3>
                    </div>
                    {box.image_url ? (
                      <img
                        className="form-image-preview product-box-image-preview"
                        src={adminThumbnailUrl(box.image_url)}
                        alt={box.image_alt || box.title}
                      />
                    ) : null}
                    <FormGroup label="Image">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) =>
                          updateBox(
                            index,
                            "image_file",
                            e.target.files[0] || null,
                          )
                        }
                      />
                    </FormGroup>
                    <FormGroup label="Image Alt">
                      <input
                        className="form-control"
                        placeholder="Enter ..."
                        value={box.image_alt}
                        onChange={(e) =>
                          updateBox(index, "image_alt", e.target.value)
                        }
                      />
                    </FormGroup>
                    <FormGroup label="Text">
                      <input
                        className="form-control"
                        placeholder="Enter ..."
                        value={box.title}
                        onChange={(e) =>
                          updateBox(index, "title", e.target.value)
                        }
                      />
                    </FormGroup>
                    <FormGroup label="Link">
                      <input
                        className="form-control"
                        placeholder="Enter ..."
                        value={box.link}
                        onChange={(e) =>
                          updateBox(index, "link", e.target.value)
                        }
                      />
                    </FormGroup>
                    {box.isNew ? (
                      <FormGroup label="">
                        <button
                          type="button"
                          className="btn btn-default"
                          onClick={() => removeBox(index)}
                        >
                          Remove Box Image
                        </button>
                      </FormGroup>
                    ) : null}
                  </section>
                ))}
                <FormGroup label="">
                  <p className="product-box-help">
                    Please click on the "Add New" button to add new box image.
                  </p>
                  <button
                    type="button"
                    className="btn btn-default"
                    onClick={addBox}
                  >
                    Add New
                  </button>
                </FormGroup>
              </div>
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
