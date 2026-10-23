import React from "react";

export default function PublicLoader() {
  return (
    <div className="public-loading-overlay" role="status" aria-label="Loading">
      <img src="/uploads/bx_loader.gif" alt="" />
    </div>
  );
}
