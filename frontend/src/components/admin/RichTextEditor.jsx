import React, { useEffect, useId, useRef } from "react";
import { localizeLegacyContent } from "../../lib/assets";

const CKEDITOR_SRC = "/vendor/ckeditor/ckeditor.js";

function loadCkeditor() {
  if (window.CKEDITOR) return Promise.resolve(window.CKEDITOR);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${CKEDITOR_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(window.CKEDITOR), {
        once: true,
      });
      existing.addEventListener("error", reject, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = CKEDITOR_SRC;
    script.onload = () => resolve(window.CKEDITOR);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export default function RichTextEditor({
  value = "",
  onChange,
  onBlur,
  id,
  name,
  required = false,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedby,
}) {
  const textareaRef = useRef(null);
  const editorRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const onBlurRef = useRef(onBlur);
  const valueRef = useRef(value);
  const generatedId = `react-ckeditor-${useId().replace(/:/g, "")}`;
  onChangeRef.current = onChange;
  onBlurRef.current = onBlur;
  valueRef.current = value;

  useEffect(() => {
    let cancelled = false;
    loadCkeditor().then((CKEDITOR) => {
      if (cancelled || !textareaRef.current || editorRef.current) return;
      const editor = CKEDITOR.replace(textareaRef.current, {
        customConfig: "/vendor/ckeditor/config.js",
        height: 245,
        resize_enabled: true,
        removeButtons: "Underline,Subscript,Superscript",
        format_tags: "p;h1;h2;h3;pre",
      });
      editorRef.current = editor;
      editor.on("instanceReady", () => {
        const value = valueRef.current || "";
        const localizedValue = localizeLegacyContent(value);
        editor.setData(localizedValue);
        if (localizedValue !== value) onChangeRef.current?.(localizedValue);
      });
      editor.on("change", () => onChangeRef.current?.(editor.getData()));
      editor.on("blur", () => onBlurRef.current?.(editor.getData()));
    });
    return () => {
      cancelled = true;
      if (editorRef.current) {
        editorRef.current.destroy();
        editorRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    const localizedValue = localizeLegacyContent(value || "");
    if (editor && editor.getData() !== localizedValue)
      editor.setData(localizedValue);
    if (localizedValue !== (value || "")) onChangeRef.current?.(localizedValue);
  }, [value]);

  return (
    <textarea
      id={id || generatedId}
      name={name}
      ref={textareaRef}
      className="form-control ckeditor"
      placeholder="Enter ..."
      value={value || ""}
      required={required}
      aria-invalid={ariaInvalid}
      aria-describedby={ariaDescribedby}
      onChange={() => {}}
    />
  );
}
