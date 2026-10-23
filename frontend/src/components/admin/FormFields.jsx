import React, { useEffect, useMemo, useRef, useState } from "react";

export function FormGroup({ label, children, className = "" }) {
  return (
    <div className={`form-group${className ? ` ${className}` : ""}`}>
      <label className="col-sm-2 control-label">{label}</label>
      <div className="col-sm-10">{children}</div>
    </div>
  );
}

export function TextField({ label, className = "", ...props }) {
  return <FormGroup label={label}><input className={`form-control${className ? ` ${className}` : ""}`} {...props} /></FormGroup>;
}

export function SelectField({ label, children, className = "", ...props }) {
  return <FormGroup label={label}><select className={`form-control${className ? ` ${className}` : ""}`} {...props}>{children}</select></FormGroup>;
}

export function TextareaField({ label, className = "", ...props }) {
  return <FormGroup label={label}><textarea className={`form-control${className ? ` ${className}` : ""}`} {...props} /></FormGroup>;
}

export function SearchableSelect({
  label,
  value = "",
  onChange,
  children,
  required = false,
  placeholder = "Select",
  bare = false,
  className = "",
  containerProps = {},
  buttonProps = {},
}) {
  const optionText = (children) =>
    React.Children.toArray(children)
      .map((child) => (typeof child === "string" || typeof child === "number" ? child : child?.props?.children ? optionText(child.props.children) : ""))
      .join("");
  const containerRef = useRef(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const options = useMemo(
    () =>
      React.Children.toArray(children).flatMap((child) => {
        if (child?.type === "option") {
          return [{
            value: String(child.props.value ?? child.props.children ?? ""),
            label: optionText(child.props.children),
          }];
        }
        if (child?.type === "optgroup") {
          return React.Children.toArray(child.props.children)
            .filter((option) => option?.type === "option")
            .map((option) => ({
              value: String(option.props.value ?? option.props.children ?? ""),
              label: optionText(option.props.children),
              group: child.props.label,
            }));
        }
        return [];
      }),
    [children],
  );
  const selected = options.find((option) => option.value === String(value));
  const filtered = options.filter((option) =>
    option.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  useEffect(() => {
    const close = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const select = (option) => {
    onChange?.({ target: { value: option.value } });
    setQuery("");
    setOpen(false);
  };

  const control = (
      <div className="searchable-select" ref={containerRef} {...containerProps}>
        <button
          {...buttonProps}
          type="button"
          className={`form-control searchable-select-display${open ? " open" : ""}${className ? ` ${className}` : ""}`}
          aria-label={label}
          onClick={() => setOpen((currentOpen) => !currentOpen)}
        >
          <span>{selected?.label || placeholder}</span>
          <span className="searchable-select-arrow" aria-hidden="true" />
        </button>
        {open && (
          <div className="searchable-select-menu" role="listbox">
            <input
              autoFocus
              className="form-control searchable-select-input"
              value={query}
              placeholder=""
              required={required && !value}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setOpen(false);
                if (event.key === "Enter" && filtered[0]) {
                  event.preventDefault();
                  select(filtered[0]);
                }
              }}
            />
            {filtered.length ? filtered.map((option, index) => (
              <React.Fragment key={`${option.value}-${option.label}`}>
                {option.group && (index === 0 || filtered[index - 1].group !== option.group) && (
                  <div className="searchable-select-group">{option.group}</div>
                )}
                <button
                  type="button"
                  className={`searchable-select-option${option.value === String(value) ? " selected" : ""}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => select(option)}
                >
                  {option.label}
                </button>
              </React.Fragment>
            )) : (
              <div className="searchable-select-empty">No results found</div>
            )}
          </div>
        )}
      </div>
  );
  return bare ? control : <FormGroup label={label}>{control}</FormGroup>;
}
