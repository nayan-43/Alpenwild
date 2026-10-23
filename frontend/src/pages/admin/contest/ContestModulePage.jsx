import React, { useEffect, useRef, useState } from "react";
import ModuleTable from "@/components/admin/ModuleTable";
import RichTextEditor from "@/components/admin/RichTextEditor";
import Icon, { AdminTableIcon } from "@/components/admin/Icon";
import ValidationEngineMessage from "@/components/admin/ValidationEngineMessage";
import { api } from "@/lib/api";
import { serializeComparableForm } from "@/lib/adminFormSnapshot";
import { adminThumbnailUrl } from "@/lib/assets";

const contestFields = [
  ["contest_title", "Title of The Contest", "text"],
  ["contest_start_date", "Contest Start Date", "date"],
  ["contest_end_date", "Contest End Date", "date"],
];

const imageDimensionFields = [
  ["contest_image_min_width", "Min Width"],
  ["contest_image_max_width", "Max Width"],
  ["contest_image_min_height", "Min Height"],
  ["contest_image_max_height", "Max Height"],
];

const imageSizeFields = [
  ["contest_image_min_size", "Min File Size"],
  ["contest_image_max_size", "Max File Size"],
];

const emptyContest = {
  display_in_home: "No",
  contest_title: "",
  contest_start_date: "",
  contest_end_date: "",
  contest_image_min_width: "",
  contest_image_max_width: "",
  contest_image_min_height: "",
  contest_image_max_height: "",
  contest_image_min_size: "",
  contest_image_max_size: "",
};

function displayContestDate(value) {
  if (!value) return "—";
  const timestamp = value instanceof Date ? value.toISOString() : String(value);
  return timestamp.slice(0, 19).replace("T", " ");
}

export default function ContestModulePage({
  mode,
  editId,
  onNotice,
  onError,
  onHeaderSubtitle,
}) {
  const [rows, setRows] = useState([]);
  const [totalEntries, setTotalEntries] = useState(0);
  const [contestTitle, setContestTitle] = useState("");
  const [form, setForm] = useState(emptyContest);
  const [settings, setSettings] = useState({ rules: "" });
  const contestSettingsSnapshot = useRef(null);
  const [loading, setLoading] = useState(true);
  const editSnapshot = useRef(null);
  const isContest = mode === "contests" || mode === "addContest";

  async function load() {
    setLoading(true);
    try {
      if (isContest) {
        const data = await api("/api/contests");
        setRows(data);
        if (editId) {
          const values = {
            ...emptyContest,
            ...data.find((item) => String(item.id) === String(editId)),
          };
          setForm(values);
          editSnapshot.current = serializeComparableForm(values);
        } else {
          editSnapshot.current = null;
        }
      } else if (mode === "contestUsers") {
        const data = await api(`/api/contest-users${window.location.search}`);
        setRows(data.rows);
        setTotalEntries(data.totalEntries);
        setContestTitle(data.contestTitle || "");
      } else if (mode === "contestUserDetails")
        setForm(await api(`/api/contest-users/${editId}`));
      else if (mode === "contestSubmissions") {
        const data = await api(
          `/api/contest-submissions${window.location.search}`,
        );
        setRows(data.rows);
        onHeaderSubtitle(
          data.context
            ? `Username: ${data.context.userName}, Contest Name: ${data.context.contestTitle}`
            : "",
        );
      } else {
        const values = await api("/api/contest-settings");
        setSettings(values);
        contestSettingsSnapshot.current = serializeComparableForm(values);
      }
    } catch (error) {
      onError(error.message);
    } finally {
      setLoading(false);
    }
  }
  async function updateStatus(path, body, message) {
    onNotice("");
    try {
      await api(path, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await load();
      onNotice(message);
    } catch (error) {
      onError(error.message);
    }
  }
  useEffect(() => {
    onHeaderSubtitle("");
    editSnapshot.current = null;
    contestSettingsSnapshot.current = null;
    if (mode === "addContest" && !editId) setForm(emptyContest);
    load();
  }, [mode, editId]);
  useEffect(() => {
    if (mode === "contestUsers" && contestTitle) {
      onHeaderSubtitle(`Contest Name: ${contestTitle}`);
    }
  }, [mode, contestTitle, onHeaderSubtitle]);
  async function save(event) {
    event.preventDefault();
    onNotice("");
    onError("");
    try {
      if (editId && editSnapshot.current === serializeComparableForm(form)) {
        window.history.pushState({}, "", "/administrator/contests");
        window.dispatchEvent(new PopStateEvent("popstate"));
        onNotice("Sorry, nothing is updated.");
        return;
      }
      await api(editId ? `/api/contests/${editId}` : "/api/contests", {
        method: editId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (editId) {
        setForm(emptyContest);
        window.history.pushState({}, "", "/administrator/contests");
        window.dispatchEvent(new PopStateEvent("popstate"));
        onNotice("Contest updated successfully.");
      } else {
        setForm(emptyContest);
        onNotice("Contest added successfully. Please enter another.");
      }
    } catch (error) {
      onError(error.message);
    }
  }
  if (mode === "addContest" || (mode === "contests" && editId))
    return (
      <ContestForm form={form} setForm={setForm} save={save} editId={editId} />
    );
  if ((mode === "contestRules" || mode === "contestEmails") && loading)
    return (
      <div className="admin-box box-primary">
        <div className="box-body">Loading...</div>
      </div>
    );
  if (mode === "contestRules" || mode === "contestEmails")
    return (
      <ContestSettings
        mode={mode}
        settings={settings}
        setSettings={setSettings}
        initialSnapshot={contestSettingsSnapshot.current}
        onNotice={onNotice}
        onError={onError}
      />
    );
  if (mode === "contestUserDetails")
    return loading ? (
      <div className="admin-box box-primary">
        <div className="box-body">Loading...</div>
      </div>
    ) : (
      <ContestUserDetails user={form} />
    );
  if (loading)
    return (
      <div className="admin-box box-primary">
        <div className="box-body">Loading...</div>
      </div>
    );
  const columns =
    mode === "contestUsers"
      ? [
          { label: "ID", key: "id" },
          { label: "Contest ID", key: "contest_id" },
          { label: "Name", key: "user_name" },
          { label: "Email", key: "user_email" },
          { label: "Phone", key: "user_phone" },
          { label: "Address", key: "user_address" },
          { label: "Status", key: "status" },
        ]
      : mode === "contestSubmissions"
        ? [
            { label: "ID", key: "id" },
            { label: "Contestant Name", key: "user_name" },
            { label: "Contest Name", key: "contest_title" },
            {
              label: "Image",
              key: "submission_image",
              render: (item) =>
                item.submission_image ? (
                  <a
                    href={`/uploads/contest/${item.submission_image}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <img
                      className="contest-submission-thumb"
                      src={adminThumbnailUrl(
                        `/uploads/contest/${item.submission_image}`,
                      )}
                      alt={item.title || "Contest submission"}
                    />
                  </a>
                ) : (
                  "—"
                ),
            },
            { label: "Title", key: "title" },
            { label: "Description", key: "description" },
            { label: "Winner Status", key: "winner_status" },
            { label: "Status", key: "status" },
          ]
        : [
            { label: "ID", key: "id" },
            { label: "Display at Home", key: "display_in_home" },
            { label: "Contest Name", key: "contest_title" },
            {
              label: "Start Date",
              key: "contest_start_date",
              render: (item) => displayContestDate(item.contest_start_date),
            },
            {
              label: "End Date",
              key: "contest_end_date",
              render: (item) => displayContestDate(item.contest_end_date),
            },
            { label: "Status", key: "status" },
          ];
  const deleteItem = async (item) => {
    const entity =
      mode === "contestUsers"
        ? "User"
        : mode === "contestSubmissions"
          ? "Submission"
          : "Contest";
    if (!window.confirm(`Are you sure, you want to delete this ${entity}?`))
      return;
    const resource =
      mode === "contestUsers"
        ? "api/contest-users"
        : mode === "contestSubmissions"
          ? "api/contest-submissions"
          : "api/contests";
    onNotice("");
    onError("");
    try {
      await api(`/${resource}/${item.id}`, { method: "DELETE" });
      await load();
      onNotice(
        mode === "contestUsers"
          ? "User details deleted successfully"
          : mode === "contestSubmissions"
            ? "Submission details deleted successfully"
            : "Contest details deleted successfully",
      );
    } catch (error) {
      onError(error.message);
    }
  };
  const renderActions =
    mode === "contests"
      ? (item) => (
          <>
            <button
              className="btn btn-link p-0"
              title="Edit"
              onClick={() =>
                navigateTo(`/administrator/contests/${item.id}/edit`)
              }
            >
              <AdminTableIcon name="edit" />
            </button>
            <a
              className="table-action-link"
              title="View All User"
              href={`/administrator/contest-users?contest_id=${item.id}`}
            >
              <AdminTableIcon name="user" />
            </a>
            <button
              className="btn btn-link p-0"
              title="Change status"
              onClick={() =>
                updateStatus(
                  `/api/contests/${item.id}/status`,
                  { status: item.status === "Active" ? "Inactive" : "Active" },
                  "Contest's Status is updated successfully",
                )
              }
            >
              <AdminTableIcon
                name="status"
                className={
                  String(item.status).toLowerCase() === "inactive"
                    ? "inactive"
                    : ""
                }
              />
            </button>
            <button
              className="btn btn-link p-0"
              title="Delete"
              onClick={() => deleteItem(item)}
            >
              <AdminTableIcon name="close" />
            </button>
          </>
        )
      : mode === "contestUsers"
        ? (item) => (
            <>
              <a
                className="table-action-link"
                title="View Details"
                href={`/administrator/contest-users/${item.id}/view`}
              >
                <AdminTableIcon name="eye" />
              </a>
              <a
                className="table-action-link"
                title="View All Submission"
                href={`/administrator/contest-submissions?user_id=${item.id}&contest_id=${item.contest_id}`}
              >
                <AdminTableIcon name="bullseye" />
              </a>
              <button
                title="Change status"
                onClick={() =>
                  updateStatus(
                    `/api/contest-users/${item.id}/status`,
                    {
                      status: item.status === "Active" ? "Inactive" : "Active",
                    },
                    "User's Status is updated successfully",
                  )
                }
              >
                <AdminTableIcon
                  name="status"
                  className={
                    String(item.status).toLowerCase() === "inactive"
                      ? "inactive"
                      : ""
                  }
                />
              </button>
              <button title="Delete" onClick={() => deleteItem(item)}>
                <AdminTableIcon name="close" />
              </button>
            </>
          )
        : mode === "contestSubmissions"
          ? (item) => (
              <>
                <button
                  title="Change winner status"
                  onClick={() =>
                    updateStatus(
                      `/api/contest-submissions/${item.id}/winner`,
                      {
                        winner_status:
                          item.winner_status === "Yes" ? "No" : "Yes",
                      },
                      "Winner's Status is updated successfully",
                    )
                  }
                >
                  <AdminTableIcon name="trophy" />
                </button>
                <button
                  title="Change status"
                  onClick={() =>
                    updateStatus(
                      `/api/contest-submissions/${item.id}/status`,
                      {
                        status:
                          item.status === "Approved"
                            ? "Disapproved"
                            : "Approved",
                      },
                      "Submission's Status is updated successfully",
                    )
                  }
                >
                  <AdminTableIcon
                    name="status"
                    className={
                      String(item.status).toLowerCase() === "disapproved"
                        ? "inactive"
                        : ""
                    }
                  />
                </button>
                <button title="Delete" onClick={() => deleteItem(item)}>
                  <AdminTableIcon name="close" />
                </button>
                <a
                  className="table-action-link"
                  title="Download"
                  href={`/api/contest-submissions/${item.id}/download`}
                >
                  <AdminTableIcon name="download" />
                </a>
              </>
            )
          : undefined;
  const table = (
    <ModuleTable
      key={`contest-table-${mode}`}
      rows={rows}
      columns={columns}
      initialSortKey={
        mode === "contests"
          ? "contest_title"
          : mode === "contestUsers" || mode === "contestSubmissions"
            ? "id"
            : undefined
      }
      initialSortDirection={
        mode === "contestUsers" || mode === "contestSubmissions"
          ? "desc"
          : "asc"
      }
      renderActions={renderActions}
      totalEntries={mode === "contestUsers" ? totalEntries : undefined}
    />
  );
  return mode === "contestSubmissions" ? (
    <>
      <div className="contest-submission-toolbar">
        <button
          className="btn btn-primary"
          onClick={() => {
            window.location.href = "/api/contest-submissions/download";
          }}
        >
          Download All Submission
        </button>
      </div>
      {table}
    </>
  ) : (
    table
  );
}

function ContestForm({ form, setForm, save, editId }) {
  const requiredFields = contestFields
    .map(([field]) => field)
    .concat(
      imageDimensionFields.map(([field]) => field),
      imageSizeFields.map(([field]) => field),
    );
  const formRef = useRef(null);
  const [validationErrors, setValidationErrors] = useState({});

  function validateField(field) {
    return String(form[field] ?? "").trim() ? "" : "* This field is required";
  }

  function validateForm() {
    return Object.fromEntries(
      requiredFields
        .map((field) => [field, validateField(field)])
        .filter(([, error]) => error),
    );
  }

  function update(field, value) {
    setForm({ ...form, [field]: value });
    if (validationErrors[field] && String(value).trim()) {
      setValidationErrors((current) => {
        const next = { ...current };
        delete next[field];
        return next;
      });
    }
  }

  function dismissError(field) {
    setValidationErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleBlur(event) {
    const control = event.target.closest?.("[data-contest-validation]");
    const field = control?.getAttribute("data-contest-validation");
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
    const errors = validateForm();
    setValidationErrors(errors);
    const firstInvalid = requiredFields.find((field) => errors[field]);
    if (firstInvalid) {
      const control = formRef.current?.querySelector(
        `[data-contest-validation="${firstInvalid}"]`,
      );
      control?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      control?.querySelector("input")?.focus();
      return;
    }
    save(event);
  }

  function validatedControl(field, input) {
    return (
      <div
        className="contest-validation-control"
        data-contest-validation={field}
      >
        {React.cloneElement(input, {
          "aria-invalid": Boolean(validationErrors[field]),
          "aria-describedby": validationErrors[field]
            ? `contest-validation-${field}`
            : undefined,
        })}
        {validationErrors[field] ? (
          <ValidationEngineMessage
            id={`contest-validation-${field}`}
            message={validationErrors[field]}
            onDismiss={() => dismissError(field)}
          />
        ) : null}
      </div>
    );
  }

  const renderNumberField = ([field, label]) => (
    <div className="form-group row" key={field}>
      <label className="col-sm-2 control-label" htmlFor={field}>
        {label}
      </label>
      <div className="col-sm-10">
        {validatedControl(
          field,
          <input
            className="form-control"
            id={field}
            type="number"
            placeholder="Enter ..."
            value={form[field] ?? ""}
            onChange={(event) => update(field, event.target.value)}
          />,
        )}
      </div>
    </div>
  );

  return (
    <section className="admin-box box-primary form-panel contest-form">
      <div className="box-header with-border">
        <h3 className="box-title">
          {editId ? "Edit Contest Page" : "Add Contest Page"}
        </h3>
      </div>
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        onBlurCapture={handleBlur}
        noValidate
      >
        <div className="box-body form-horizontal">
          <div className="form-group row">
            <label className="col-sm-2 control-label">Display In Home</label>
            <div className="col-sm-10">
              <div className="checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={form.display_in_home === "Yes"}
                    onChange={(e) =>
                      update("display_in_home", e.target.checked ? "Yes" : "No")
                    }
                  />{" "}
                  Yes
                </label>
              </div>
            </div>
          </div>
          {contestFields.map(([field, label, type]) => (
            <div className="form-group row" key={field}>
              <label className="col-sm-2 control-label" htmlFor={field}>
                {label}
              </label>
              <div className="col-sm-10">
                {validatedControl(
                  field,
                  <input
                    className="form-control"
                    id={field}
                    placeholder="Enter ..."
                    type={type}
                    value={
                      type === "date" && form[field]
                        ? String(form[field]).slice(0, 10)
                        : form[field] || ""
                    }
                    onChange={(e) => update(field, e.target.value)}
                  />,
                )}
              </div>
            </div>
          ))}
          <div className="form-group row">
            <label className="col-sm-2 control-label">Image Dimention</label>
            <div className="col-sm-10">
              {imageDimensionFields.map(renderNumberField)}
            </div>
          </div>
          <div className="form-group row">
            <label className="col-sm-2 control-label">Image Upload Size</label>
            <div className="col-sm-10">
              {imageSizeFields.map(renderNumberField)}
            </div>
          </div>
        </div>
        <div className="box-footer form-actions">
          <button className="btn btn-primary">Submit</button>
        </div>
      </form>
    </section>
  );
}

function ContestSettings({
  mode,
  settings,
  setSettings,
  initialSnapshot,
  onNotice,
  onError,
}) {
  const fields =
    mode === "contestRules"
      ? [["rules", "Add Rules"]]
      : [
          ["contest_submissions_user", "Submission Mail for User"],
          ["contest_submissions_admin", "Submission Mail for Admin"],
          ["contest_approval_user", "Approval Mail for User"],
          ["contest_approval_admin", "Approval Mail for Admin"],
          ["contest_disapproval_user", "Disapproval Mail for User"],
          ["contest_disapproval_admin", "Disapproval Mail for Admin"],
          ["contest_winner_user", "Winner Mail for User"],
          ["contest_winner_admin", "Winner Mail for Admin"],
        ];
  return (
    <section className="admin-box box-primary form-panel">
      <div className="box-header with-border">
        <h3 className="box-title">
          {mode === "contestRules"
            ? "Add Contest Rules"
            : "Manage Contest Email Template"}
        </h3>
      </div>
      <div className="box-body form-horizontal">
        {fields.map(([field, label]) => (
          <div className="form-group row" key={field}>
            <label className="col-sm-2 control-label">{label}</label>
            <div className="col-sm-10">
              <RichTextEditor
                value={settings[field] || ""}
                onChange={(value) =>
                  setSettings({ ...settings, [field]: value })
                }
                required
              />
            </div>
          </div>
        ))}
      </div>
      <div className="box-footer form-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={async () => {
            if (
              initialSnapshot !== null &&
              initialSnapshot === serializeComparableForm(settings)
            ) {
              onNotice("Sorry, nothing is updated.");
              return;
            }
            try {
              await api("/api/contest-settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rules: "", ...settings }),
              });
              onNotice("Contest settings updated successfully.");
            } catch (error) {
              onError(error.message);
            }
          }}
        >
          Submit
        </button>
      </div>
    </section>
  );
}

function ContestUserDetails({ user }) {
  const fields = [
    ["User Name", user.user_name],
    ["User Email", user.user_email],
    ["User Phone", user.user_phone],
    ["Address", user.user_address],
    ["City", user.user_city],
    ["State", user.user_state],
    ["ZIP", user.user_zip],
  ];
  return (
    <section className="admin-box box-primary form-panel">
      <div className="box-header with-border">
        <h3 className="box-title">View User Details</h3>
      </div>
      <div className="box-body form-horizontal">
        {fields.map(([label, value]) => (
          <div className="form-group row" key={label}>
            <label className="col-sm-2 control-label">{label}</label>
            <div className="col-sm-10">
              <input
                className="form-control"
                type="text"
                value={value || ""}
                readOnly
              />
            </div>
          </div>
        ))}
        <div className="form-group row">
          <label className="col-sm-2 control-label">Images</label>
          <div className="col-sm-10">
            <a
              href={`/administrator/contest-submissions?user_id=${user.id}&contest_id=${user.contest_id}`}
            >
              View All Uploaded Images
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function navigateTo(path) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
