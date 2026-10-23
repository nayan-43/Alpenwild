import React from "react";

export default function ValidationEngineMessage({ id, message, onDismiss }) {
  function handleKeyDown(event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onDismiss();
    }
  }

  return (
    <div
      className="formError"
      style={{ top: 0, left: 15, transform: "translateY(-100%)" }}
      role="button"
      tabIndex={0}
      aria-label={`${message}. Dismiss message`}
      onClick={onDismiss}
      onKeyDown={handleKeyDown}
    >
      <div className="formErrorContent" id={id} role="alert">
        {message}
      </div>
      <div className="formErrorArrow" aria-hidden="true">
        {Array.from({ length: 10 }, (_, index) => (
          <div className={`line${10 - index}`} key={index} />
        ))}
      </div>
    </div>
  );
}
