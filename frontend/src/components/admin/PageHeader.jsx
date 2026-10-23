import React from "react";

export default function PageHeader({
  title,
  subtitle,
  breadcrumbTitle = title,
  onHomeClick,
}) {
  return (
    <section className="page-head d-flex justify-content-between align-items-center">
      <div className="page-head-titles">
        <h1>{title}</h1>
        {subtitle ? <h2>{subtitle}</h2> : null}
      </div>
      <p>
        <button type="button" className="breadcrumb-home" onClick={onHomeClick}>
          <i className="fa fa-dashboard" aria-hidden="true" /> Home
        </button>{" "}
        <b>›</b> {breadcrumbTitle}
      </p>
    </section>
  );
}
