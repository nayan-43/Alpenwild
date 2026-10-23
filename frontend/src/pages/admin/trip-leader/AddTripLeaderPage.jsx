import React, { useCallback, useEffect, useRef, useState } from "react";
import RichTextEditor from "@/components/admin/RichTextEditor";
import { SearchableSelect } from "@/components/admin/FormFields";
import { api } from "@/lib/api";
import { adminThumbnailUrl } from "@/lib/assets";

function FormRow({ label, children, className = "" }) {
  return (
    <div className={`form-group${className ? ` ${className}` : ""}`}>
      <label className="col-sm-2 control-label">{label}</label>
      <div className="col-sm-10">{children}</div>
    </div>
  );
}

function ValidationPrompt({ error, field, onDismiss }) {
  return error ? (
    <button
      type="button"
      id={`trip-leader-validation-${field}`}
      className="trip-leader-validation-prompt"
      data-trip-leader-validation-prompt={field}
      aria-label={`${error}. Dismiss message`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onDismiss}
    >
      {error}
    </button>
  ) : null;
}

function RadioOptions({
  name,
  options,
  value,
  onChange,
  vertical = false,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedby,
}) {
  return (
    <div
      className={`radio trip-leader-radio${vertical ? " vertical" : ""}`}
      role="radiogroup"
      aria-invalid={ariaInvalid}
      aria-describedby={ariaDescribedby}
    >
      {options.map(([optionValue, label], index) => (
        <React.Fragment key={optionValue}>
          <label>
            <input
              type="radio"
              name={name}
              value={optionValue}
              checked={value === optionValue}
              onChange={(event) => onChange(event.target.value)}
            />
            {label}
          </label>
          {vertical && index < options.length - 1 ? <br /> : null}
        </React.Fragment>
      ))}
    </div>
  );
}

function DescriptionBlock({
  block,
  index,
  editingId,
  canRemove,
  updateBlock,
  updateBlockSize,
  handleBlockImage,
  removeBlock,
  control,
}) {
  const proportionOptions = [
    ["lock", "Lock"],
    ["unlock", "Unlock"],
  ];
  const alignOptions = [
    ...(editingId ? [["none", "None"]] : []),
    ["left", "Left"],
    ["right", "Right"],
    ["center", "Center"],
  ];

  return (
    <div className="row repeat-row trip-leader-description-block">
      <div className="box-header with-border col-md-12 trip-leader-block-heading">
        <h3 className="box-title">Description {index + 1}</h3>
      </div>
      <FormRow label="Image">
        {block.image_url ? (
          <img
            className="form-image-preview"
            src={adminThumbnailUrl(block.image_url)}
            alt={block.image_alt || "Description"}
          />
        ) : null}
        <input
          type="file"
          accept="image/jpeg,image/png,image/gif"
          onChange={(event) =>
            handleBlockImage(index, event.target.files?.[0] || null)
          }
        />
      </FormRow>
      <FormRow label="Image Size" className="trip-leader-image-size">
        <div className="trip-leader-image-size-inner">
          <div className="trip-leader-size-row">
            <label>Image Proportion</label>
            <RadioOptions
              name={`image-proportion-${index}`}
              options={proportionOptions}
              value={block.image_proportion}
              onChange={(value) =>
                updateBlock(index, "image_proportion", value)
              }
            />
          </div>
          <div className="trip-leader-size-row">
            <label htmlFor={`trip-leader-width-${index}`}>Width (in PX)</label>
            {control(
              `block-${index}-image_width`,
              <input
                id={`trip-leader-width-${index}`}
                type="number"
                min="0"
                step="1"
                value={block.image_width}
                onChange={(event) =>
                  updateBlockSize(index, "image_width", event.target.value)
                }
              />,
            )}
          </div>
          <div className="trip-leader-size-row">
            <label htmlFor={`trip-leader-height-${index}`}>
              Height (in PX)
            </label>
            {control(
              `block-${index}-image_height`,
              <input
                id={`trip-leader-height-${index}`}
                type="number"
                min="0"
                step="1"
                value={block.image_height}
                onChange={(event) =>
                  updateBlockSize(index, "image_height", event.target.value)
                }
              />,
            )}
          </div>
        </div>
      </FormRow>
      <FormRow label="Image Align">
        <RadioOptions
          name={`image-align-${index}`}
          options={alignOptions}
          value={block.image_align}
          onChange={(value) => updateBlock(index, "image_align", value)}
        />
      </FormRow>
      <FormRow label="Image Caption">
        <input
          className="form-control"
          placeholder="Enter ..."
          value={block.caption ?? block.description_image_caption ?? ""}
          onChange={(event) =>
            updateBlock(index, "caption", event.target.value)
          }
        />
      </FormRow>
      <FormRow label="Image Alt Text">
        <input
          className="form-control"
          placeholder="Enter ..."
          value={block.image_alt}
          onChange={(event) =>
            updateBlock(index, "image_alt", event.target.value)
          }
        />
      </FormRow>
      <FormRow label="Text Wrap">
        <RadioOptions
          name={`text-wrap-${index}`}
          options={[
            ["yes", "Yes"],
            ["no", "No"],
          ]}
          value={block.text_wrap}
          onChange={(value) => updateBlock(index, "text_wrap", value)}
        />
      </FormRow>
      <FormRow label="Text">
        <RichTextEditor
          value={block.text}
          onChange={(value) => updateBlock(index, "text", value)}
        />
      </FormRow>
      <FormRow label="Order">
        {control(
          `block-${index}-display_order`,
          <input
            className="form-control"
            type="number"
            min="0"
            step="1"
            value={block.display_order}
            onChange={(event) =>
              updateBlock(index, "display_order", event.target.value)
            }
          />,
        )}
      </FormRow>
      {canRemove ? (
        <FormRow label="">
          <button
            className="btn btn-default"
            type="button"
            onClick={() => removeBlock(index)}
          >
            Remove Box Image
          </button>
        </FormRow>
      ) : null}
    </div>
  );
}

function AuthorSelector({
  title,
  value,
  onChange,
  label,
  authors = [],
  loading,
}) {
  const selectedAuthorExists = authors.some(
    (author) => String(author.id) === String(value),
  );
  return (
    <div className="form-group trip-leader-author-group">
      <div className="row repeat-row repeat-form-wrap23">
        <div className="box-header with-border repeat-form-heading">
          <h3 className="box-title">{title}</h3>
        </div>
        <FormRow label="Select Author">
          <SearchableSelect
            bare
            label={label}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            buttonProps={{ disabled: loading }}
          >
            <option value="">-- Select Author --</option>
            {value && !selectedAuthorExists ? (
              <option value={value}>Saved Author ID: {value}</option>
            ) : null}
            {authors.map((author) => (
              <option key={author.id} value={author.id}>
                {author.name}
              </option>
            ))}
          </SearchableSelect>
        </FormRow>
      </div>
    </div>
  );
}

export default function AddTripLeaderPage({
  form,
  editingId,
  update,
  updateBlock,
  addBlock,
  removeBlock,
  save,
  cancel,
}) {
  const formRef = useRef(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [authorSources, setAuthorSources] = useState(null);
  const [authorSourcesLoading, setAuthorSourcesLoading] = useState(true);
  const [authorSourcesError, setAuthorSourcesError] = useState("");

  const loadAuthorSources = useCallback(async () => {
    setAuthorSourcesLoading(true);
    setAuthorSourcesError("");
    setAuthorSources(null);
    try {
      const response = await api("/api/trip-leader-authors");
      const authorLists = response?.authors;
      if (
        !authorLists ||
        !Array.isArray(authorLists.alpsHiking) ||
        !Array.isArray(authorLists.switzerlandTravel) ||
        !Array.isArray(authorLists.mySwissKitchen)
      )
        throw new Error(
          "The author-list response is invalid. Restart the backend and try again.",
        );
      setAuthorSources(response);
    } catch (error) {
      setAuthorSourcesError(error.message);
    } finally {
      setAuthorSourcesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAuthorSources();
  }, [loadAuthorSources]);

  function validateField(field) {
    const requiredValues = {
      name: form.name,
      guide_name: form.guide_name,
      meta_title: form.meta_title,
      meta_description: form.meta_description,
      meta_keywords: form.meta_keywords,
      short_descriptions: form.short_descriptions,
    };
    if (Object.hasOwn(requiredValues, field)) {
      return String(requiredValues[field] ?? "").trim()
        ? ""
        : "* This field is required";
    }
    if (field === "type")
      return ["Guides", "Office Staff"].includes(form.type)
        ? ""
        : "* This field is required";
    if (field === "listing_image") {
      return form.listing_image || form.listing_image_url
        ? ""
        : "* This field is required";
    }
    if (field === "display_order") {
      const value = String(form.display_order ?? "").trim();
      if (!value) return "* This field is required";
      const numericValue = Number(value);
      return /^[+-]?\d+$/.test(value) &&
        Number.isSafeInteger(numericValue) &&
        numericValue >= -2147483648 &&
        numericValue <= 2147483647
        ? ""
        : "* Not a valid integer";
    }
    const blockMatch =
      /^block-(\d+)-(image_width|image_height|display_order)$/.exec(field);
    if (blockMatch) {
      const [, index, property] = blockMatch;
      const value = String(
        form.description_blocks[Number(index)]?.[property] ?? "",
      ).trim();
      if (!value) return "";
      const numericValue = Number(value);
      return /^\d+$/.test(value) &&
        Number.isSafeInteger(numericValue) &&
        numericValue <= 2147483647
        ? ""
        : "* Not a valid integer";
    }
    return "";
  }

  function validateForm() {
    const fields = [
      "name",
      "guide_name",
      "meta_title",
      "meta_description",
      "meta_keywords",
      "short_descriptions",
      "type",
      "listing_image",
      "display_order",
      ...form.description_blocks.flatMap((_, index) => [
        `block-${index}-image_width`,
        `block-${index}-image_height`,
        `block-${index}-display_order`,
      ]),
    ];
    return Object.fromEntries(
      fields
        .map((field) => [field, validateField(field)])
        .filter(([, error]) => error),
    );
  }

  function handleBlur(event) {
    const wrapper = event.target.closest?.("[data-trip-leader-validation]");
    const field = wrapper?.getAttribute("data-trip-leader-validation");
    if (!field || wrapper.contains(event.relatedTarget)) return;
    const error = validateField(field);
    setValidationErrors((current) => {
      const next = { ...current };
      if (error) next[field] = error;
      else delete next[field];
      return next;
    });
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
        `[data-trip-leader-validation="${firstInvalid}"]`,
      );
      wrapper?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      wrapper?.querySelector("input, textarea")?.focus();
      return;
    }
    save(event);
  }

  function handleBlockImage(index, file) {
    updateBlock(index, "image_file", file);
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        updateBlock(index, "image_ratio", String(image.width / image.height));
        updateBlock(index, "image_width", image.width);
        updateBlock(index, "image_height", image.height);
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function control(field, child) {
    return (
      <div
        className="trip-leader-validation-control"
        data-trip-leader-validation={field}
      >
        {React.cloneElement(child, {
          "aria-invalid": Boolean(validationErrors[field]),
          "aria-describedby": validationErrors[field]
            ? `trip-leader-validation-${field}`
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
    const prompt = event.target.closest?.(
      "[data-trip-leader-validation-prompt]",
    );
    const field = prompt?.getAttribute("data-trip-leader-validation-prompt");
    if (field) dismissError(field);
  }

  function updateBlockSize(index, field, value) {
    updateBlock(index, field, value);
    const block = form.description_blocks[index];
    if (block.image_proportion !== "lock" || !block.image_ratio || !value)
      return;
    if (field === "image_width") {
      updateBlock(
        index,
        "image_height",
        Math.round(Number(value) / Number(block.image_ratio)) || 0,
      );
    }
    if (field === "image_height") {
      updateBlock(
        index,
        "image_width",
        Math.round(Number(value) * Number(block.image_ratio)) || 0,
      );
    }
  }

  return (
    <div className="admin-row">
      <div className="admin-col-full">
        <section className="admin-box box-primary form-panel trip-form-panel trip-leader-form">
          <div className="box-header with-border">
            <h3 className="box-title">
              {editingId ? "Edit" : "Add"} Trip Leader
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
              {authorSourcesError && (
                <div className="alert error" role="alert">
                  <p>{authorSourcesError}</p>
                  <button
                    className="btn btn-default"
                    type="button"
                    onClick={loadAuthorSources}
                    disabled={authorSourcesLoading}
                  >
                    {authorSourcesLoading ? "Loading..." : "Retry"}
                  </button>
                </div>
              )}
              {authorSources && !authorSources.configured && (
                <div className="alert warning" role="status">
                  WordPress author databases are not configured yet. Saved
                  author IDs are preserved; configure the MySQL settings to load
                  selectable authors.
                </div>
              )}
              {editingId && form.slug ? (
                <FormRow label="Trip Leader Link">
                  <div className="checkbox">
                    <p>
                      {window.location.origin}/tripleader/{form.slug}/
                    </p>
                  </div>
                </FormRow>
              ) : null}
              <FormRow label="Title">
                {control(
                  "name",
                  <input
                    className="form-control"
                    placeholder="Enter ..."
                    value={form.name}
                    onChange={(event) => update("name", event.target.value)}
                  />,
                )}
              </FormRow>
              <FormRow label="Guide Name">
                {control(
                  "guide_name",
                  <input
                    className="form-control"
                    placeholder="Enter ..."
                    value={form.guide_name}
                    onChange={(event) =>
                      update("guide_name", event.target.value)
                    }
                  />,
                )}
              </FormRow>
              <FormRow label="Meta Title">
                {control(
                  "meta_title",
                  <input
                    className="form-control txt_remain"
                    placeholder="Enter ..."
                    value={form.meta_title}
                    onChange={(event) =>
                      update("meta_title", event.target.value)
                    }
                  />,
                )}
                <span className="remainingC" />
              </FormRow>
              <FormRow label="Mets Descriptions">
                {control(
                  "meta_description",
                  <textarea
                    className="form-control txt_remain2"
                    placeholder="Enter ..."
                    value={form.meta_description}
                    onChange={(event) =>
                      update("meta_description", event.target.value)
                    }
                  />,
                )}
                <span className="remainingC2" />
              </FormRow>
              <FormRow label="Meta Keywords">
                {control(
                  "meta_keywords",
                  <textarea
                    className="form-control"
                    placeholder="Enter ..."
                    value={form.meta_keywords}
                    onChange={(event) =>
                      update("meta_keywords", event.target.value)
                    }
                  />,
                )}
              </FormRow>
              <FormRow label="Short Description">
                {control(
                  "short_descriptions",
                  <textarea
                    className="form-control"
                    placeholder="Enter ..."
                    value={form.short_descriptions}
                    onChange={(event) =>
                      update("short_descriptions", event.target.value)
                    }
                  />,
                )}
              </FormRow>
              <FormRow label="Type">
                {control(
                  "type",
                  <RadioOptions
                    name="trip-leader-type"
                    options={[
                      ["Guides", "Guides"],
                      ["Office Staff", "Office Staff"],
                    ]}
                    value={form.type}
                    onChange={(value) => update("type", value)}
                    vertical
                  />,
                )}
              </FormRow>
              <FormRow label="Leader Listing Image">
                {form.listing_image_url ? (
                  <img
                    className="form-image-preview"
                    src={adminThumbnailUrl(form.listing_image_url)}
                    alt={form.name}
                  />
                ) : null}
                {control(
                  "listing_image",
                  <input
                    type="file"
                    onChange={(event) =>
                      update("listing_image", event.target.files?.[0] || null)
                    }
                  />,
                )}
              </FormRow>
              <FormRow label="Description">
                <div className="trip-leader-description-help">
                  To embed a Youtube video in the editor, please use the this
                  shortcode: [youtubevideo src="npH0gdNwJ1s"
                  style="float:left;margin-right:10px;"]. Here, 'npH0gdNwJ1s' in
                  src will need to be replaced by the youtube video id and the
                  style paramaeters will allow you to position the video image
                  left/right along with specifying other styling like Margin.
                  Ensure you keep the code format as is and are not using any
                  space when adding the video id/style parameters.
                </div>
              </FormRow>
              <div className="form-group box_description_add">
                {form.description_blocks.map((block, index) => (
                  <DescriptionBlock
                    key={block.id || index}
                    block={block}
                    index={index}
                    editingId={editingId}
                    canRemove={Boolean(editingId) || index > 0}
                    updateBlock={updateBlock}
                    updateBlockSize={updateBlockSize}
                    handleBlockImage={handleBlockImage}
                    removeBlock={removeBlock}
                    control={control}
                  />
                ))}
              </div>
              <FormRow label="">
                <p>
                  Please click on the "Add New" button to add new box image.
                </p>
                <button
                  className="btn btn-success"
                  type="button"
                  onClick={addBlock}
                >
                  Add New
                </button>
              </FormRow>
              <FormRow label="Order">
                {control(
                  "display_order",
                  <input
                    className="form-control"
                    placeholder="Enter ..."
                    type="text"
                    inputMode="numeric"
                    value={form.display_order}
                    onChange={(event) =>
                      update("display_order", event.target.value)
                    }
                  />,
                )}
              </FormRow>
              <AuthorSelector
                title="Select Author For Post Fetch From Alps Hiking"
                label="Alps Hiking Author"
                value={form.alps_hiking_author}
                onChange={(value) => update("alps_hiking_author", value)}
                authors={authorSources?.authors?.alpsHiking}
                loading={authorSourcesLoading}
              />
              <AuthorSelector
                title="Select Author For Post Fetch From Switzerland Travel"
                label="Switzerland Travel Author"
                value={form.switzerlandtravel_author}
                onChange={(value) => update("switzerlandtravel_author", value)}
                authors={authorSources?.authors?.switzerlandTravel}
                loading={authorSourcesLoading}
              />
              <AuthorSelector
                title="Select Author For Post Fetch From My Swisskitchen New"
                label="My Swisskitchen New Author"
                value={form.myswisskitchennew_author}
                onChange={(value) => update("myswisskitchennew_author", value)}
                authors={authorSources?.authors?.mySwissKitchen}
                loading={authorSourcesLoading}
              />
            </div>
            <div className="box-footer form-actions">
              <button
                className="btn btn-default"
                type="button"
                onClick={cancel}
              >
                Cancel
              </button>
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
