import React, { useRef, useState } from "react";
import RichTextEditor from "../../../components/admin/RichTextEditor";
import { SearchableSelect } from "@/components/admin/FormFields";
import { adminThumbnailUrl } from "@/lib/assets";

const integerPattern = /^[+-]?\d+$/;

function ValidationPrompt({ error, onDismiss }) {
  return error ? (
    <button
      type="button"
      className="testimonial-validation-prompt"
      aria-label={`${error}. Dismiss message`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onDismiss}
    >
      {error}
    </button>
  ) : null;
}

function StaticPageFormGroup({ label, children }) {
  return (
    <div className="form-group">
      <label className="col-sm-2 control-label text-end">{label}</label>
      <div className="col-sm-10">{children}</div>
    </div>
  );
}

function StaticPageRepeatGroup({ label, children, labelStyle, controlStyle }) {
  return (
    <>
      <label className="col-sm-2 control-label text-end" style={labelStyle}>
        {label}
      </label>
      <div className="col-sm-10" style={controlStyle}>
        {children}
      </div>
    </>
  );
}

export default function AddStaticPagePage({
  form,
  pages,
  editingId,
  update,
  save,
}) {
  const formRef = useRef(null);
  const [validationErrors, setValidationErrors] = useState({});
  const isLegacyContentPage = Number(editingId) === 65;
  const descriptionBlocks = form.description_blocks ?? [
    {
      image: "",
      image_file: null,
      image_proportion: "unlock",
      image_width: "",
      image_height: "",
      image_align: "none",
      image_caption: "",
      image_alt: "",
      text_wrap: "yes",
      text: "",
      display_order: "",
    },
  ];
  const boxImages = form.box_images?.length
    ? form.box_images
    : [
        {
          image: "",
          image_file: null,
          image_alt: "",
          title: "",
          link: "",
          display_order: "",
        },
      ];
  const updateBlock = (index, key, value) => {
    update("description_blocks", (currentBlocks) =>
      (currentBlocks ?? descriptionBlocks).map((block, blockIndex) =>
        blockIndex === index ? { ...block, [key]: value } : block,
      ),
    );
  };
  const selectDescriptionImage = (index, file) => {
    if (!file) {
      updateBlock(index, "image_file", null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    updateBlock(index, "image_file", file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      updateBlock(
        index,
        "image_ratio",
        image.naturalWidth / image.naturalHeight,
      );
      updateBlock(index, "image_width", String(image.naturalWidth));
      updateBlock(index, "image_height", String(image.naturalHeight));
    };
    image.onerror = () => URL.revokeObjectURL(objectUrl);
    image.src = objectUrl;
  };
  const updateBox = (index, key, value) => {
    update("box_images", (currentBoxes) =>
      (currentBoxes ?? boxImages).map((box, boxIndex) =>
        boxIndex === index ? { ...box, [key]: value } : box,
      ),
    );
  };
  const addDescription = () =>
    update("description_blocks", (currentBlocks) => [
      ...(currentBlocks ?? descriptionBlocks),
      {
        image: "",
        image_file: null,
        image_ratio: "",
        image_proportion: "unlock",
        image_width: "",
        image_height: "",
        image_align: "none",
        image_caption: "",
        image_alt: "",
        text_wrap: "yes",
        text: "",
        display_order: "",
      },
    ]);
  const addBox = () =>
    update("box_images", (currentBoxes) => [
      ...(currentBoxes ?? boxImages),
      {
        image: "",
        image_file: null,
        image_alt: "",
        title: "",
        link: "",
        display_order: "",
      },
    ]);
  function validateField(field, valueOverride) {
    const imageMatch = field.match(/^description_image_(\d+)$/);
    const textMatch = field.match(/^description_text_(\d+)$/);
    let value = valueOverride ?? form[field];
    let required =
      ["name", "menu_name", "menu_assign", "social_sharing_display"].includes(
        field,
      ) ||
      (!isLegacyContentPage && field === "description_type") ||
      field === "display_order";

    if (imageMatch) {
      const block = descriptionBlocks[Number(imageMatch[1])];
      required =
        Boolean(block) && !block.id && !block.image_url && !block.image;
      value = block?.image_file;
    } else if (textMatch) {
      required = Boolean(descriptionBlocks[Number(textMatch[1])]);
      value = valueOverride ?? descriptionBlocks[Number(textMatch[1])]?.text;
    } else if (
      form.display_as_page === "Yes" &&
      ["meta_title", "meta_descriptions", "meta_keywords"].includes(field)
    ) {
      required = true;
    } else if (
      form.display_as_page === "Yes" &&
      form.description_type === "old_description" &&
      field === "description"
    ) {
      required = true;
    }

    if (!required) return "";
    if (field.startsWith("description_image_")) {
      if (!value) return "* This field is required";
    } else {
      const textValue = String(value ?? "")
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;|&#160;/gi, " ")
        .trim();
      if (!textValue) return "* This field is required";
    }
    if (field === "display_order") {
      const order = String(value).trim();
      if (
        !integerPattern.test(order) ||
        Number(order) < -2147483648 ||
        Number(order) > 2147483647
      )
        return "* Not a valid integer";
    }
    return "";
  }

  function setFieldError(field, value) {
    const error = validateField(field, value);
    setValidationErrors((current) => {
      const next = { ...current };
      if (error) next[field] = error;
      else delete next[field];
      return next;
    });
  }

  function handleBlur(event) {
    const control = event.target.closest?.("[data-static-page-validation]");
    const field = control?.getAttribute("data-static-page-validation");
    if (!field || control.contains(event.relatedTarget)) return;
    setFieldError(field);
  }

  function validationControl(field, child) {
    return (
      <div
        className="testimonial-validation-control"
        data-static-page-validation={field}
      >
        {child}
        <ValidationPrompt
          error={validationErrors[field]}
          onDismiss={() =>
            setValidationErrors((current) => {
              const next = { ...current };
              delete next[field];
              return next;
            })
          }
        />
      </div>
    );
  }

  function handleSubmit(event) {
    event.preventDefault();
    const fields = [
      "name",
      "menu_name",
      "menu_assign",
      "social_sharing_display",
      "display_order",
    ];
    if (!isLegacyContentPage) fields.push("description_type");
    if (form.display_as_page === "Yes") {
      fields.push("meta_title", "meta_descriptions", "meta_keywords");
      if (form.description_type === "old_description")
        fields.push("description");
    }
    if (form.description_type === "new_description" && !isLegacyContentPage) {
      descriptionBlocks.forEach((block, index) => {
        fields.push(`description_text_${index}`);
        if (!block.id && !block.image_url && !block.image)
          fields.push(`description_image_${index}`);
      });
    }
    const errors = Object.fromEntries(
      fields
        .map((field) => [field, validateField(field)])
        .filter(([, error]) => error),
    );
    setValidationErrors(errors);
    const firstInvalid = fields.find((field) => errors[field]);
    if (firstInvalid) {
      const control = formRef.current?.querySelector(
        `[data-static-page-validation="${firstInvalid}"]`,
      );
      control?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      control?.querySelector("input, textarea")?.focus();
      return;
    }
    save(event);
  }

  const field = (key, label) => (
    <StaticPageFormGroup label={label}>
      {validationControl(
        key,
        <input
          className="form-control"
          placeholder="Enter ..."
          value={form[key] ?? ""}
          aria-invalid={Boolean(validationErrors[key])}
          onChange={(e) => update(key, e.target.value)}
        />,
      )}
    </StaticPageFormGroup>
  );
  const blockField = (block, index, key, label, labelPaddingTop = 10) => (
    <StaticPageRepeatGroup
      label={label}
      labelStyle={labelPaddingTop ? { paddingTop: labelPaddingTop } : undefined}
      controlStyle={{ paddingTop: 10 }}
    >
      <input
        className={
          key.includes("width") ||
          key.includes("height") ||
          key === "display_order"
            ? undefined
            : "form-control"
        }
        placeholder={
          key.includes("width") ||
          key.includes("height") ||
          key === "display_order"
            ? undefined
            : "Enter ..."
        }
        type={
          key.includes("width") ||
          key.includes("height") ||
          key === "display_order"
            ? "number"
            : "text"
        }
        step="1"
        value={block[key] ?? ""}
        onChange={(e) => {
          const value = e.target.value;
          const ratio = Number(block.image_ratio);
          if (
            key === "image_width" &&
            block.image_proportion === "lock" &&
            ratio > 0 &&
            value !== ""
          ) {
            update("description_blocks", (currentBlocks) =>
              (currentBlocks ?? descriptionBlocks).map((current, blockIndex) =>
                blockIndex === index
                  ? {
                      ...current,
                      image_width: value,
                      image_height: String(Math.round(Number(value) / ratio)),
                    }
                  : current,
              ),
            );
          } else {
            updateBlock(index, key, value);
          }
        }}
      />
    </StaticPageRepeatGroup>
  );
  const boxField = (box, index, key, label) => (
    <StaticPageRepeatGroup
      label={label}
      labelStyle={{ paddingTop: 10 }}
      controlStyle={{ paddingTop: 10 }}
    >
      <input
        className="form-control"
        placeholder="Enter ..."
        type="number"
        step="1"
        value={box[key] ?? ""}
        onChange={(e) => updateBox(index, key, e.target.value)}
      />
    </StaticPageRepeatGroup>
  );
  return (
    <div className="admin-row">
      <div className="admin-col-full">
        <section className="admin-box box-primary form-panel static-page-form">
          <div className="box-header with-border col-md-12">
            <h3 className="box-title">
              {editingId ? "Edit Static Page" : "Add Static Page"}
            </h3>
          </div>
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            onBlur={handleBlur}
            className="form-horizontal"
          >
            <div className="box-body">
              {editingId && (
                <StaticPageFormGroup label="Page Link">
                  <div className="checkbox">
                    <p>
                      {window.location.origin}/staticpage/
                      {form.slug}/
                    </p>
                  </div>
                </StaticPageFormGroup>
              )}
              <StaticPageFormGroup label="Display As Page">
                <div className="checkbox">
                  <label>
                    <input
                      type="checkbox"
                      checked={form.display_as_page === "Yes"}
                      onChange={(e) =>
                        update(
                          "display_as_page",
                          e.target.checked ? "Yes" : "No",
                        )
                      }
                    />{" "}
                    Yes
                  </label>
                </div>
              </StaticPageFormGroup>
              <StaticPageFormGroup label="Parent Page">
                <SearchableSelect
                  bare
                  label="Parent Page"
                  value={form.parent_id}
                  onChange={(e) => update("parent_id", e.target.value)}
                >
                  <option value="0">-- Select Parent Page --</option>
                  {pages
                    .filter((p) => p.display_as_page === "No")
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </SearchableSelect>
              </StaticPageFormGroup>
              {field("name", "Name")}
              {field("slug", "Slug")}
              {field("menu_name", "Menu Name")}
              <StaticPageFormGroup label="Assign Under Menu">
                {validationControl(
                  "menu_assign",
                  <div className="radio">
                    <label htmlFor="header">
                      <input
                        type="radio"
                        name="menu_assign"
                        value="Self In Header"
                        id="header"
                        checked={form.menu_assign === "Self In Header"}
                        onChange={(e) => update("menu_assign", e.target.value)}
                      />{" "}
                      Header
                    </label>
                    <label htmlFor="footer">
                      <input
                        type="radio"
                        name="menu_assign"
                        value="Self In Footer"
                        id="footer"
                        checked={form.menu_assign === "Self In Footer"}
                        onChange={(e) => update("menu_assign", e.target.value)}
                      />{" "}
                      Footer
                    </label>
                  </div>,
                )}
              </StaticPageFormGroup>
              <StaticPageFormGroup label="Social Sharing Display">
                {validationControl(
                  "social_sharing_display",
                  <div className="radio">
                    <label htmlFor="yes">
                      <input
                        type="radio"
                        name="social_sharing_display"
                        value="Yes"
                        id="yes"
                        checked={form.social_sharing_display === "Yes"}
                        onChange={(e) =>
                          update("social_sharing_display", e.target.value)
                        }
                      />{" "}
                      Yes
                    </label>
                    <label htmlFor="no">
                      <input
                        type="radio"
                        name="social_sharing_display"
                        value="No"
                        id="no"
                        checked={form.social_sharing_display === "No"}
                        onChange={(e) =>
                          update("social_sharing_display", e.target.value)
                        }
                      />{" "}
                      No
                    </label>
                  </div>,
                )}
              </StaticPageFormGroup>
              {field("meta_title", "Meta Title")}
              {field("meta_descriptions", "Mets Descriptions")}
              {field("meta_keywords", "Meta Keywords")}
              {!isLegacyContentPage && (
                <StaticPageFormGroup label="Content View as">
                  {validationControl(
                    "description_type",
                    <div className="radio">
                      <label htmlFor="old_description">
                        <input
                          type="radio"
                          name="description_type"
                          value="old_description"
                          id="old_description"
                          checked={form.description_type === "old_description"}
                          onChange={(e) =>
                            update("description_type", e.target.value)
                          }
                        />{" "}
                        Old Content&nbsp;&nbsp;
                      </label>
                      <label htmlFor="new-content">
                        <input
                          type="radio"
                          name="description_type"
                          value="new_description"
                          id="new-content"
                          checked={form.description_type === "new_description"}
                          onChange={(e) =>
                            update("description_type", e.target.value)
                          }
                        />{" "}
                        New Content
                      </label>
                    </div>,
                  )}
                </StaticPageFormGroup>
              )}
              {!isLegacyContentPage && (
                <StaticPageFormGroup label="Description">
                  <div>
                    To embed a Youtube video in the editor, please use the this
                    shortcode: [youtubevideo src="npH0gdNwJ1s"
                    style="float:left;margin-right:10px;"]. Here, 'npH0gdNwJ1s'
                    in src will need to be replaced by the youtube video id and
                    the style paramaeters will allow you to position the video
                    image left/right along with specifying other styling like
                    Margin. Ensure you keep the code format as is and are not
                    using any space when adding the video id/style parameters.
                  </div>
                </StaticPageFormGroup>
              )}
              {form.description_type === "new_description" ? (
                !isLegacyContentPage && (
                  <div className="form-group">
                    {descriptionBlocks.map((block, index) => (
                      <div
                        className="row repeat-description-wrap"
                        key={index}
                        style={{ paddingTop: 10, margin: 0 }}
                      >
                        <input type="hidden" value={block.image_ratio ?? ""} />
                        <div className="box-header with-border col-md-12">
                          <h3
                            className="box-title"
                            style={{ color: "#5B681B", fontSize: 20 }}
                          >
                            Description {index + 1}
                          </h3>
                        </div>
                        <StaticPageRepeatGroup
                          label="Image"
                          controlStyle={{ paddingTop: 10 }}
                        >
                          {block.image_url && (
                            <img
                              src={adminThumbnailUrl(block.image_url)}
                              width="150"
                              height="90"
                              alt={
                                block.image_alt || `Description ${index + 1}`
                              }
                              style={{ paddingBottom: 10 }}
                            />
                          )}
                          {validationControl(
                            `description_image_${index}`,
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/gif"
                              onChange={(e) =>
                                selectDescriptionImage(
                                  index,
                                  e.target.files[0] || null,
                                )
                              }
                            />,
                          )}
                        </StaticPageRepeatGroup>
                        <StaticPageRepeatGroup
                          label="Image Size"
                          controlStyle={{ paddingTop: 10 }}
                        >
                          <div className="form-group row">
                            <label className="col-sm-2 control-label text-end">
                              Image Proportion
                            </label>
                            <div
                              className="col-sm-10"
                              style={{ paddingTop: 10 }}
                            >
                              <div className="radio">
                                <label>
                                  <input
                                    type="radio"
                                    name={`image_proportion_${index}`}
                                    checked={block.image_proportion === "lock"}
                                    onChange={() =>
                                      updateBlock(
                                        index,
                                        "image_proportion",
                                        "lock",
                                      )
                                    }
                                  />{" "}
                                  Lock{" "}
                                  <input
                                    type="radio"
                                    name={`image_proportion_${index}`}
                                    checked={
                                      block.image_proportion === "unlock"
                                    }
                                    onChange={() =>
                                      updateBlock(
                                        index,
                                        "image_proportion",
                                        "unlock",
                                      )
                                    }
                                  />{" "}
                                  Unlock
                                </label>
                              </div>
                            </div>
                          </div>
                          {blockField(
                            block,
                            index,
                            "image_width",
                            "Width (in PX)",
                            0,
                          )}
                          {blockField(
                            block,
                            index,
                            "image_height",
                            "Height (in PX)",
                            0,
                          )}
                        </StaticPageRepeatGroup>
                        <StaticPageRepeatGroup
                          label="Image Align"
                          labelStyle={{ paddingTop: 10 }}
                          controlStyle={{ paddingTop: 10 }}
                        >
                          <div className="radio">
                            <label>
                              {[
                                ...(block.id || block.image_url
                                  ? ["none"]
                                  : []),
                                "left",
                                "right",
                                "center",
                              ].map((value) => (
                                <React.Fragment key={value}>
                                  <input
                                    type="radio"
                                    name={`image_align_${index}`}
                                    checked={block.image_align === value}
                                    onChange={() =>
                                      updateBlock(index, "image_align", value)
                                    }
                                  />{" "}
                                  {value[0].toUpperCase() + value.slice(1)}{" "}
                                </React.Fragment>
                              ))}
                            </label>
                          </div>
                        </StaticPageRepeatGroup>
                        <StaticPageRepeatGroup
                          label="Image Caption"
                          labelStyle={{ paddingTop: 10 }}
                          controlStyle={{ paddingTop: 10 }}
                        >
                          <input
                            className="form-control"
                            placeholder="Enter ..."
                            value={block.image_caption}
                            onChange={(e) =>
                              updateBlock(
                                index,
                                "image_caption",
                                e.target.value,
                              )
                            }
                          />
                        </StaticPageRepeatGroup>
                        <StaticPageRepeatGroup
                          label="Image Alt Text"
                          labelStyle={{ paddingTop: 10 }}
                          controlStyle={{ paddingTop: 10 }}
                        >
                          <input
                            className="form-control"
                            placeholder="Enter ..."
                            value={block.image_alt}
                            onChange={(e) =>
                              updateBlock(index, "image_alt", e.target.value)
                            }
                          />
                        </StaticPageRepeatGroup>
                        <StaticPageRepeatGroup
                          label="Text Wrap"
                          labelStyle={{ paddingTop: 10 }}
                          controlStyle={{ paddingTop: 10 }}
                        >
                          <div className="radio">
                            <label>
                              {["yes", "no"].map((value) => (
                                <React.Fragment key={value}>
                                  <input
                                    type="radio"
                                    name={`text_wrap_${index}`}
                                    checked={block.text_wrap === value}
                                    onChange={() =>
                                      updateBlock(index, "text_wrap", value)
                                    }
                                  />{" "}
                                  {value === "yes" ? "Yes" : "No"}
                                </React.Fragment>
                              ))}
                            </label>
                          </div>
                        </StaticPageRepeatGroup>
                        <StaticPageRepeatGroup
                          label="Text"
                          labelStyle={{ paddingTop: 10 }}
                          controlStyle={{ paddingTop: 10 }}
                        >
                          {validationControl(
                            `description_text_${index}`,
                            <RichTextEditor
                              value={block.text}
                              onChange={(value) =>
                                updateBlock(index, "text", value)
                              }
                              onBlur={(value) =>
                                setFieldError(
                                  `description_text_${index}`,
                                  value,
                                )
                              }
                              aria-invalid={Boolean(
                                validationErrors[`description_text_${index}`],
                              )}
                            />,
                          )}
                        </StaticPageRepeatGroup>
                        {blockField(block, index, "display_order", "Order")}
                        {(block.id || descriptionBlocks.length > 1) && (
                          <StaticPageRepeatGroup
                            label=""
                            labelStyle={{ paddingTop: 10 }}
                            controlStyle={{ paddingTop: 10 }}
                          >
                            <button
                              type="button"
                              className="btn btn-default"
                              onClick={() =>
                                update("description_blocks", (currentBlocks) =>
                                  (currentBlocks ?? descriptionBlocks).filter(
                                    (_, blockIndex) => blockIndex !== index,
                                  ),
                                )
                              }
                            >
                              Remove Description
                            </button>
                          </StaticPageRepeatGroup>
                        )}
                      </div>
                    ))}
                    <div className="form-group row">
                      <label className="col-sm-2 control-label"></label>
                      <div className="col-sm-10">
                        <p>
                          Please click on the "Add New" button to add new box
                          image.
                        </p>
                        <button
                          type="button"
                          className="btn btn-success"
                          onClick={addDescription}
                        >
                          Add New
                        </button>
                      </div>
                    </div>
                  </div>
                )
              ) : (
                <StaticPageFormGroup label="">
                  {validationControl(
                    "description",
                    <RichTextEditor
                      value={form.description}
                      onChange={(value) => update("description", value)}
                      onBlur={(value) => setFieldError("description", value)}
                      aria-invalid={Boolean(validationErrors.description)}
                    />,
                  )}
                </StaticPageFormGroup>
              )}
              <StaticPageFormGroup label="Order">
                {validationControl(
                  "display_order",
                  <input
                    className="form-control"
                    type="number"
                    step="1"
                    value={form.display_order}
                    aria-invalid={Boolean(validationErrors.display_order)}
                    onChange={(e) => update("display_order", e.target.value)}
                  />,
                )}
              </StaticPageFormGroup>
              <div className="form-group box_image_add">
                {boxImages.map((box, index) => (
                  <div
                    className="row repeat-form-wrap"
                    key={index}
                    style={{ paddingTop: 10, margin: 0 }}
                  >
                    <div className="box-header with-border">
                      <h3
                        className="box-title"
                        style={{ color: "#5B681B", fontSize: 20 }}
                      >
                        Box Image {index + 1}
                      </h3>
                    </div>
                    <StaticPageRepeatGroup
                      label="Image"
                      controlStyle={{ paddingTop: 10 }}
                    >
                      {box.image_url && (
                        <img
                          src={adminThumbnailUrl(box.image_url)}
                          width="150"
                          height="90"
                          alt={
                            box.image_alt ||
                            box.title ||
                            `Box Image ${index + 1}`
                          }
                          style={{ paddingBottom: 10 }}
                        />
                      )}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/gif"
                        onChange={(e) =>
                          updateBox(
                            index,
                            "image_file",
                            e.target.files[0] || null,
                          )
                        }
                      />
                    </StaticPageRepeatGroup>
                    <StaticPageRepeatGroup
                      label="Image Alt"
                      controlStyle={{ paddingTop: 10 }}
                    >
                      <input
                        className="form-control"
                        placeholder="Enter ..."
                        value={box.image_alt}
                        onChange={(e) =>
                          updateBox(index, "image_alt", e.target.value)
                        }
                      />
                    </StaticPageRepeatGroup>
                    <StaticPageRepeatGroup
                      label="Text"
                      labelStyle={{ paddingTop: 10 }}
                      controlStyle={{ paddingTop: 10 }}
                    >
                      <input
                        className="form-control"
                        placeholder="Enter ..."
                        value={box.title}
                        onChange={(e) =>
                          updateBox(index, "title", e.target.value)
                        }
                      />
                    </StaticPageRepeatGroup>
                    <StaticPageRepeatGroup
                      label="Link"
                      labelStyle={{ paddingTop: 10 }}
                      controlStyle={{ paddingTop: 10 }}
                    >
                      <input
                        className="form-control"
                        placeholder="Enter ..."
                        value={box.link}
                        onChange={(e) =>
                          updateBox(index, "link", e.target.value)
                        }
                      />
                    </StaticPageRepeatGroup>
                    {boxField(box, index, "display_order", "Order")}
                    {(box.id || boxImages.length > 1) && (
                      <>
                        <label className="col-sm-2 control-label"></label>
                        <div className="col-sm-10" style={{ paddingTop: 10 }}>
                          <button
                            type="button"
                            className="btn btn-default"
                            onClick={() => {
                              if (
                                box.id &&
                                !window.confirm(
                                  "Are you sure, you want to delete this box image?",
                                )
                              )
                                return;
                              update("box_images", (currentBoxes) =>
                                (currentBoxes ?? boxImages).filter(
                                  (_, boxIndex) => boxIndex !== index,
                                ),
                              );
                            }}
                          >
                            Remove Box Image
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <div className="form-group">
                <label className="col-sm-2 control-label"></label>
                <div className="col-sm-10">
                  <p>
                    Please click on the "Add New" button to add new box image.
                  </p>
                  <button
                    type="button"
                    className="btn btn-default"
                    onClick={addBox}
                  >
                    Add New
                  </button>
                </div>
              </div>
            </div>
            <div className="box-footer form-actions">
              <button className="btn btn-primary">Submit</button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
