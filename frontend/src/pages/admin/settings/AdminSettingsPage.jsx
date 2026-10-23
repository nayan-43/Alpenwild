import React, { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { localAssetUrl } from "@/lib/assets";
import { serializeComparableForm } from "@/lib/adminFormSnapshot";
import Icon, { AdminTableIcon } from "@/components/admin/Icon";
import { SearchableSelect } from "@/components/admin/FormFields";
import ModuleTable from "@/components/admin/ModuleTable";
import RichTextEditor from "@/components/admin/RichTextEditor";
import ValidationEngineMessage from "@/components/admin/ValidationEngineMessage";

const settingFields = [
  ["site_title", "Site Title"],
  ["site_tagline", "Site Tagline"],
  ["site_url", "Site URL"],
  ["date_format", "Date Format"],
  ["time_format", "Time Format"],
  ["time_zone", "Current Timezone"],
  ["admin_receiving_email_id", "Admin Receiving Email ID"],
  ["admin_sending_email_id", "Admin Sending Email ID"],
  ["admin_order_receiving_email_id", "Admin Order Receiving Email ID"],
  ["backend_pagination", "Back-end Pagination Number"],
  ["frontend_pagination", "Front-end Pagination Number"],
  ["authorize_api_login_id", "Authorize API Login ID"],
  ["authorize_api_transaction_key", "Authorize API Transaction Key"],
  ["site_logo", "Upload Logo"],
  ["copyright_text", "Copyright Text"],
  ["private_departure_text", "Private Departure Text"],
  ["private_departure_link", "Private Departure Link"],
  ["user_email_option", "User Email Send:"],
  ["reminder_email_option", "Reminder Email Send:"],
  ["footer_image_one", "Footer Image One"],
  ["footer_image_one_url", "Footer Image One Url"],
  ["footer_image_two", "Footer Image Two"],
  ["footer_image_two_url", "Footer Image Two Url"],
  ["footer_image_three", "Footer Image Three"],
  ["footer_image_three_url", "Footer Image Three Url"],
  ["footer_image_four", "Footer Image Four"],
  ["footer_image_four_url", "Footer Image Four Url"],
];

const timezoneOptions = [
  ["Pacific/Midway", "(UTC-11:00) Midway Island"],
  ["Pacific/Samoa", "(UTC-11:00) Samoa"],
  ["Pacific/Honolulu", "(UTC-10:00) Hawaii"],
  ["US/Alaska", "(UTC-09:00) Alaska"],
  ["America/Los_Angeles", "(UTC-08:00) Pacific Time (US & Canada)"],
  ["America/Tijuana", "(UTC-08:00) Tijuana"],
  ["US/Arizona", "(UTC-07:00) Arizona"],
  ["America/Chihuahua", "(UTC-07:00) Chihuahua"],
  ["America/Chihuahua", "(UTC-07:00) La Paz"],
  ["America/Mazatlan", "(UTC-07:00) Mazatlan"],
  ["US/Mountain", "(UTC-07:00) Mountain Time (US & Canada)"],
  ["America/Managua", "(UTC-06:00) Central America"],
  ["US/Central", "(UTC-06:00) Central Time (US & Canada)"],
  ["America/Mexico_City", "(UTC-06:00) Guadalajara"],
  ["America/Mexico_City", "(UTC-06:00) Mexico City"],
  ["America/Monterrey", "(UTC-06:00) Monterrey"],
  ["Canada/Saskatchewan", "(UTC-06:00) Saskatchewan"],
  ["America/Bogota", "(UTC-05:00) Bogota"],
  ["US/Eastern", "(UTC-05:00) Eastern Time (US & Canada)"],
  ["US/East-Indiana", "(UTC-05:00) Indiana (East)"],
  ["America/Lima", "(UTC-05:00) Lima"],
  ["America/Bogota", "(UTC-05:00) Quito"],
  ["Canada/Atlantic", "(UTC-04:00) Atlantic Time (Canada)"],
  ["America/Caracas", "(UTC-04:30) Caracas"],
  ["America/La_Paz", "(UTC-04:00) La Paz"],
  ["America/Santiago", "(UTC-04:00) Santiago"],
  ["Canada/Newfoundland", "(UTC-03:30) Newfoundland"],
  ["America/Sao_Paulo", "(UTC-03:00) Brasilia"],
  ["America/Argentina/Buenos_Aires", "(UTC-03:00) Buenos Aires"],
  ["America/Argentina/Buenos_Aires", "(UTC-03:00) Georgetown"],
  ["America/Godthab", "(UTC-03:00) Greenland"],
  ["America/Noronha", "(UTC-02:00) Mid-Atlantic"],
  ["Atlantic/Azores", "(UTC-01:00) Azores"],
  ["Atlantic/Cape_Verde", "(UTC-01:00) Cape Verde Is."],
  ["Africa/Casablanca", "(UTC+00:00) Casablanca"],
  ["Europe/London", "(UTC+00:00) Edinburgh"],
  ["Etc/Greenwich", "(UTC+00:00) Greenwich Mean Time : Dublin"],
  ["Europe/Lisbon", "(UTC+00:00) Lisbon"],
  ["Europe/London", "(UTC+00:00) London"],
  ["Africa/Monrovia", "(UTC+00:00) Monrovia"],
  ["UTC", "(UTC+00:00) UTC"],
  ["Europe/Amsterdam", "(UTC+01:00) Amsterdam"],
  ["Europe/Belgrade", "(UTC+01:00) Belgrade"],
  ["Europe/Berlin", "(UTC+01:00) Berlin"],
  ["Europe/Berlin", "(UTC+01:00) Bern"],
  ["Europe/Bratislava", "(UTC+01:00) Bratislava"],
  ["Europe/Brussels", "(UTC+01:00) Brussels"],
  ["Europe/Budapest", "(UTC+01:00) Budapest"],
  ["Europe/Copenhagen", "(UTC+01:00) Copenhagen"],
  ["Europe/Ljubljana", "(UTC+01:00) Ljubljana"],
  ["Europe/Madrid", "(UTC+01:00) Madrid"],
  ["Europe/Paris", "(UTC+01:00) Paris"],
  ["Europe/Prague", "(UTC+01:00) Prague"],
  ["Europe/Rome", "(UTC+01:00) Rome"],
  ["Europe/Sarajevo", "(UTC+01:00) Sarajevo"],
  ["Europe/Skopje", "(UTC+01:00) Skopje"],
  ["Europe/Stockholm", "(UTC+01:00) Stockholm"],
  ["Europe/Vienna", "(UTC+01:00) Vienna"],
  ["Europe/Warsaw", "(UTC+01:00) Warsaw"],
  ["Africa/Lagos", "(UTC+01:00) West Central Africa"],
  ["Europe/Zagreb", "(UTC+01:00) Zagreb"],
  ["Europe/Athens", "(UTC+02:00) Athens"],
  ["Europe/Bucharest", "(UTC+02:00) Bucharest"],
  ["Africa/Cairo", "(UTC+02:00) Cairo"],
  ["Africa/Harare", "(UTC+02:00) Harare"],
  ["Europe/Helsinki", "(UTC+02:00) Helsinki"],
  ["Europe/Istanbul", "(UTC+02:00) Istanbul"],
  ["Asia/Jerusalem", "(UTC+02:00) Jerusalem"],
  ["Europe/Helsinki", "(UTC+02:00) Kyiv"],
  ["Africa/Johannesburg", "(UTC+02:00) Pretoria"],
  ["Europe/Riga", "(UTC+02:00) Riga"],
  ["Europe/Sofia", "(UTC+02:00) Sofia"],
  ["Europe/Tallinn", "(UTC+02:00) Tallinn"],
  ["Europe/Vilnius", "(UTC+02:00) Vilnius"],
  ["Asia/Baghdad", "(UTC+03:00) Baghdad"],
  ["Asia/Kuwait", "(UTC+03:00) Kuwait"],
  ["Europe/Minsk", "(UTC+03:00) Minsk"],
  ["Africa/Nairobi", "(UTC+03:00) Nairobi"],
  ["Asia/Riyadh", "(UTC+03:00) Riyadh"],
  ["Europe/Volgograd", "(UTC+03:00) Volgograd"],
  ["Asia/Tehran", "(UTC+03:30) Tehran"],
  ["Asia/Muscat", "(UTC+04:00) Abu Dhabi"],
  ["Asia/Baku", "(UTC+04:00) Baku"],
  ["Europe/Moscow", "(UTC+04:00) Moscow"],
  ["Asia/Muscat", "(UTC+04:00) Muscat"],
  ["Europe/Moscow", "(UTC+04:00) St. Petersburg"],
  ["Asia/Tbilisi", "(UTC+04:00) Tbilisi"],
  ["Asia/Yerevan", "(UTC+04:00) Yerevan"],
  ["Asia/Kabul", "(UTC+04:30) Kabul"],
  ["Asia/Karachi", "(UTC+05:00) Islamabad"],
  ["Asia/Karachi", "(UTC+05:00) Karachi"],
  ["Asia/Tashkent", "(UTC+05:00) Tashkent"],
  ["Asia/Calcutta", "(UTC+05:30) Chennai"],
  ["Asia/Kolkata", "(UTC+05:30) Kolkata"],
  ["Asia/Calcutta", "(UTC+05:30) Mumbai"],
  ["Asia/Calcutta", "(UTC+05:30) New Delhi"],
  ["Asia/Calcutta", "(UTC+05:30) Sri Jayawardenepura"],
  ["Asia/Katmandu", "(UTC+05:45) Kathmandu"],
  ["Asia/Almaty", "(UTC+06:00) Almaty"],
  ["Asia/Dhaka", "(UTC+06:00) Astana"],
  ["Asia/Dhaka", "(UTC+06:00) Dhaka"],
  ["Asia/Yekaterinburg", "(UTC+06:00) Ekaterinburg"],
  ["Asia/Rangoon", "(UTC+06:30) Rangoon"],
  ["Asia/Bangkok", "(UTC+07:00) Bangkok"],
  ["Asia/Bangkok", "(UTC+07:00) Hanoi"],
  ["Asia/Jakarta", "(UTC+07:00) Jakarta"],
  ["Asia/Novosibirsk", "(UTC+07:00) Novosibirsk"],
  ["Asia/Hong_Kong", "(UTC+08:00) Beijing"],
  ["Asia/Chongqing", "(UTC+08:00) Chongqing"],
  ["Asia/Hong_Kong", "(UTC+08:00) Hong Kong"],
  ["Asia/Krasnoyarsk", "(UTC+08:00) Krasnoyarsk"],
  ["Asia/Kuala_Lumpur", "(UTC+08:00) Kuala Lumpur"],
  ["Australia/Perth", "(UTC+08:00) Perth"],
  ["Asia/Singapore", "(UTC+08:00) Singapore"],
  ["Asia/Taipei", "(UTC+08:00) Taipei"],
  ["Asia/Ulan_Bator", "(UTC+08:00) Ulaan Bataar"],
  ["Asia/Urumqi", "(UTC+08:00) Urumqi"],
  ["Asia/Irkutsk", "(UTC+09:00) Irkutsk"],
  ["Asia/Tokyo", "(UTC+09:00) Osaka"],
  ["Asia/Tokyo", "(UTC+09:00) Sapporo"],
  ["Asia/Seoul", "(UTC+09:00) Seoul"],
  ["Asia/Tokyo", "(UTC+09:00) Tokyo"],
  ["Australia/Adelaide", "(UTC+09:30) Adelaide"],
  ["Australia/Darwin", "(UTC+09:30) Darwin"],
  ["Australia/Brisbane", "(UTC+10:00) Brisbane"],
  ["Australia/Canberra", "(UTC+10:00) Canberra"],
  ["Pacific/Guam", "(UTC+10:00) Guam"],
  ["Australia/Hobart", "(UTC+10:00) Hobart"],
  ["Australia/Melbourne", "(UTC+10:00) Melbourne"],
  ["Pacific/Port_Moresby", "(UTC+10:00) Port Moresby"],
  ["Australia/Sydney", "(UTC+10:00) Sydney"],
  ["Asia/Yakutsk", "(UTC+10:00) Yakutsk"],
  ["Asia/Vladivostok", "(UTC+11:00) Vladivostok"],
  ["Pacific/Auckland", "(UTC+12:00) Auckland"],
  ["Pacific/Fiji", "(UTC+12:00) Fiji"],
  ["Pacific/Kwajalein", "(UTC+12:00) International Date Line West"],
  ["Asia/Kamchatka", "(UTC+12:00) Kamchatka"],
  ["Asia/Magadan", "(UTC+12:00) Magadan"],
  ["Pacific/Fiji", "(UTC+12:00) Marshall Is."],
  ["Asia/Magadan", "(UTC+12:00) New Caledonia"],
  ["Asia/Magadan", "(UTC+12:00) Solomon Is."],
  ["Pacific/Auckland", "(UTC+12:00) Wellington"],
  ["Pacific/Tongatapu", "(UTC+13:00) Nuku'alofa"],
];

const imageKeys = new Set([
  "site_logo",
  "footer_image_one",
  "footer_image_two",
  "footer_image_three",
  "footer_image_four",
]);

const requiredSettingKeys = [
  "site_title",
  "site_tagline",
  "site_url",
  "date_format",
  "time_format",
  "time_zone",
  "admin_receiving_email_id",
  "admin_sending_email_id",
  "admin_order_receiving_email_id",
  "backend_pagination",
  "frontend_pagination",
  "authorize_api_login_id",
  "authorize_api_transaction_key",
  "site_logo",
  "copyright_text",
  "private_departure_text",
  "private_departure_link",
];

const emailSettingKeys = new Set([
  "admin_receiving_email_id",
  "admin_sending_email_id",
  "admin_order_receiving_email_id",
]);

const paginationSettingKeys = new Set([
  "backend_pagination",
  "frontend_pagination",
]);

const emailTemplateColumns = [
  { label: "ID", key: "id" },
  { label: "Name", key: "name" },
  { label: "Subject", key: "subject" },
];

function settingImageUrl(value) {
  return localAssetUrl(value);
}

function SettingsField({ fieldKey, label, error, onDismiss, children }) {
  return (
    <div className="form-group row">
      <label className="col-sm-2 control-label" htmlFor={fieldKey}>
        {label}
      </label>
      <div className="col-sm-10">
        <div
          className="settings-validation-control"
          data-settings-validation={fieldKey}
        >
          {children}
          {error ? (
            <ValidationEngineMessage
              id={`settings-validation-${fieldKey}`}
              message={error}
              onDismiss={onDismiss}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function AdminSettingsPage({
  mode = "settings",
  onNotice,
  onError,
}) {
  const [settings, setSettings] = useState({});
  const [settingFiles, setSettingFiles] = useState({});
  const settingsSnapshot = useRef(null);
  const templateSnapshots = useRef(new Map());
  const [templates, setTemplates] = useState([]);
  const [templateTotalEntries, setTemplateTotalEntries] = useState(0);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateSubjectError, setTemplateSubjectError] = useState("");
  const [credentials, setCredentials] = useState({
    currentPassword: "",
    newPassword: "",
    confirmation: "",
    newUsername: "",
  });
  const [busy, setBusy] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [credentialErrors, setCredentialErrors] = useState({});
  const [credentialTouched, setCredentialTouched] = useState({});
  useEffect(() => {
    settingsSnapshot.current = null;
    templateSnapshots.current.clear();
    if (mode === "settings")
      api("/api/settings")
        .then((result) => {
          setSettings(result);
          setSettingFiles({});
          settingsSnapshot.current = serializeComparableForm({
            settings: result,
            settingFiles: {},
          });
        })
        .catch(onError);
    if (mode === "emailTemplates") {
      api("/api/email-templates")
        .then((result) => {
          setTemplates(result.rows);
          setTemplateTotalEntries(result.totalEntries);
        })
        .catch(onError);
    }
    setEditingTemplate(null);
  }, [mode, onError]);

  function validateSetting(field, value = settings[field]) {
    if (field === "site_logo" && settingFiles.site_logo) return "";
    const text = String(value ?? "").trim();
    if (requiredSettingKeys.includes(field) && !text)
      return "* This field is required";
    if (
      emailSettingKeys.has(field) &&
      text &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)
    )
      return "* Invalid email address";
    if (paginationSettingKeys.has(field) && text && !/^-?\d+$/.test(text))
      return "* Please enter a valid integer";
    if (field === "date_format" && text && !/^(?:[1-9]|1[01])$/.test(text))
      return "* Please select a valid date format";
    if (field === "time_format" && text && !/^[1-3]$/.test(text))
      return "* Please select a valid time format";
    return "";
  }

  function updateSetting(field, value) {
    setSettings((current) => ({ ...current, [field]: value }));
    if (validationErrors[field] && !validateSetting(field, value)) {
      setValidationErrors((current) => {
        const next = { ...current };
        delete next[field];
        return next;
      });
    }
  }

  function handleSettingsBlur(event) {
    const control = event.target.closest?.("[data-settings-validation]");
    const field = control?.getAttribute("data-settings-validation");
    if (!field || control.contains(event.relatedTarget)) return;
    const error = validateSetting(field);
    setValidationErrors((current) => {
      const next = { ...current };
      if (error) next[field] = error;
      else delete next[field];
      return next;
    });
  }

  function dismissSettingError(field) {
    setValidationErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function saveSettings(event) {
    event.preventDefault();
    const errors = Object.fromEntries(
      requiredSettingKeys
        .map((field) => [field, validateSetting(field)])
        .filter(([, error]) => error),
    );
    setValidationErrors(errors);
    const firstInvalid = requiredSettingKeys.find((field) => errors[field]);
    if (firstInvalid) {
      const control = event.currentTarget.querySelector(
        `[data-settings-validation="${firstInvalid}"]`,
      );
      control?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      control?.querySelector("input, select, button")?.focus();
      return;
    }
    const currentSettings = serializeComparableForm({
      settings,
      settingFiles,
    });
    if (settingsSnapshot.current === currentSettings) {
      onNotice("Sorry, nothing is updated.");
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      Object.entries(settings).forEach(([key, value]) => {
        if (!key.endsWith("_preview")) body.append(key, value || "");
      });
      Object.entries(settingFiles).forEach(([key, file]) => {
        if (file) body.append(key, file);
      });
      const result = await api("/api/settings", {
        method: "PUT",
        body,
      });
      setSettings(result.settings);
      setSettingFiles({});
      settingsSnapshot.current = serializeComparableForm({
        settings: result.settings,
        settingFiles: {},
      });
      onNotice("Settings updated successfully.");
    } catch (error) {
      onError(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveCredential(event, type) {
    event.preventDefault();
    setBusy(true);
    try {
      await api(`/api/auth/change-${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          type === "username"
            ? {
                oldUsername: credentials.currentPassword,
                newUsername: credentials.newUsername,
                confirmation: credentials.confirmation,
              }
            : credentials,
        ),
      });
      onNotice(
        `${type === "username" ? "Username" : "Password"} updated successfully.`,
      );
      setCredentials({
        currentPassword: "",
        newPassword: "",
        confirmation: "",
        newUsername: "",
      });
      setCredentialErrors({});
      setCredentialTouched({});
    } catch (error) {
      onError(error.message);
    } finally {
      setBusy(false);
    }
  }

  function validateCredentialField(field, type, values = credentials) {
    const value = String(values[field] ?? "");
    const usernameField = type === "username";
    const expectedConfirmation = usernameField
      ? String(values.newUsername ?? "").trim()
      : values.newPassword;
    if (usernameField && !value.trim()) return "* This field is required";
    if (!usernameField && !value) return "* This field is required";
    if (usernameField && value.trim().length > 100)
      return "* Please enter no more than 100 characters";
    if (!usernameField && value.length > 200)
      return "* Please enter no more than 200 characters";
    if (type === "password" && field === "newPassword" && value.length < 12)
      return "* Please enter at least 12 characters";
    if (
      field === "confirmation" &&
      (usernameField ? value.trim() : value) !== expectedConfirmation
    )
      return "* Fields do not match";
    return "";
  }

  function handleCredentialBlur(event, type) {
    const control = event.target.closest?.("[data-credential-validation]");
    const field = control?.getAttribute("data-credential-validation");
    if (!field || control.contains(event.relatedTarget)) return;
    setCredentialTouched((current) => ({ ...current, [field]: true }));
    const error = validateCredentialField(field, type);
    setCredentialErrors((current) => {
      const next = { ...current };
      if (error) next[field] = error;
      else delete next[field];
      return next;
    });
  }

  function updateCredential(field, value, type) {
    const next = { ...credentials, [field]: value };
    setCredentials(next);
    setCredentialErrors((current) => {
      const errors = { ...current };
      const fields = [
        field,
        ...(field === "newUsername" || field === "newPassword"
          ? ["confirmation"]
          : []),
      ];
      for (const key of fields) {
        if (!credentialTouched[key] && !errors[key]) continue;
        const error = validateCredentialField(key, type, next);
        if (error) errors[key] = error;
        else delete errors[key];
      }
      return errors;
    });
  }

  function submitCredential(event, type, fields) {
    event.preventDefault();
    const errors = Object.fromEntries(
      fields
        .map((field) => [field.key, validateCredentialField(field.key, type)])
        .filter(([, error]) => error),
    );
    setCredentialErrors(errors);
    setCredentialTouched(
      Object.fromEntries(fields.map(({ key }) => [key, true])),
    );
    const firstInvalid = fields.find((field) => errors[field.key]);
    if (firstInvalid) {
      event.currentTarget
        .querySelector(`#credential-${firstInvalid.key}`)
        ?.focus();
      return;
    }
    saveCredential(event, type);
  }

  async function saveTemplate(template) {
    const snapshotKey = String(template.id);
    if (
      templateSnapshots.current.get(snapshotKey) ===
      serializeComparableForm(template)
    ) {
      setEditingTemplate(null);
      onNotice("Sorry, nothing is updated.");
      return;
    }
    try {
      const updated = await api(`/api/email-templates/${template.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(template),
      });
      setTemplates((items) =>
        items.map((item) => (item.id === updated.id ? updated : item)),
      );
      setEditingTemplate(null);
      templateSnapshots.current.delete(snapshotKey);
      setTemplateSubjectError("");
      onNotice("Email template updated successfully.");
    } catch (error) {
      onError(error.message);
    }
  }

  function handleTemplateSubmit(event) {
    event.preventDefault();
    if (!String(editingTemplate?.subject ?? "").trim()) {
      setTemplateSubjectError("* This field is required");
      event.currentTarget.querySelector("#email-template-subject")?.focus();
      return;
    }
    setTemplateSubjectError("");
    saveTemplate(editingTemplate);
  }

  if (mode === "emailTemplates" && editingTemplate)
    return (
      <section className="module-page settings-box box box-primary">
        <div className="box-header with-border">
        <h3 className="box-title">Edit Email Template</h3>
      </div>
        <form
          className="settings-card settings-form"
          onSubmit={handleTemplateSubmit}
        >
          <div className="form-field">
            <span>
              <label htmlFor="email-template-subject">Subject</label>
            </span>
            <div className="settings-validation-control">
              <input
                id="email-template-subject"
                className="form-control"
                value={editingTemplate.subject}
                aria-invalid={Boolean(templateSubjectError)}
                aria-describedby={
                  templateSubjectError
                    ? "email-template-subject-error"
                    : undefined
                }
                onChange={(event) => {
                  const subject = event.target.value;
                  setEditingTemplate((current) => ({ ...current, subject }));
                  if (subject.trim()) setTemplateSubjectError("");
                }}
                onBlur={() =>
                  setTemplateSubjectError(
                    String(editingTemplate.subject ?? "").trim()
                      ? ""
                      : "* This field is required",
                  )
                }
              />
              {templateSubjectError ? (
                <ValidationEngineMessage
                  id="email-template-subject-error"
                  message={templateSubjectError}
                  onDismiss={() => setTemplateSubjectError("")}
                />
              ) : null}
            </div>
          </div>
          <label className="form-field email-template-body-field">
            <span>Email body</span>
            <RichTextEditor
              value={editingTemplate.body}
              onChange={(body) =>
                setEditingTemplate((current) => ({ ...current, body }))
              }
            />
          </label>
          <div className="settings-box-footer">
            <button
              type="button"
              className="btn btn-default"
              onClick={() => {
                setEditingTemplate(null);
                setTemplateSubjectError("");
                templateSnapshots.current.delete(String(editingTemplate.id));
              }}
            >
              Cancel
            </button>
            <button className="btn btn-primary" disabled={busy}>
              Submit
            </button>
          </div>
        </form>
      </section>
    );

  if (mode === "emailTemplates")
    return (
      <section className="module-page">
        <ModuleTable
          rows={templates}
          columns={emailTemplateColumns}
          totalEntries={templateTotalEntries}
          initialSortKey="id"
          initialSortDirection="desc"
          renderActions={(template) => (
            <button
              title="Edit"
              type="button"
              onClick={() => {
                setTemplateSubjectError("");
                setEditingTemplate({ ...template });
                templateSnapshots.current.set(
                  String(template.id),
                  serializeComparableForm(template),
                );
              }}
            >
              <AdminTableIcon name="edit" />
            </button>
          )}
        />
      </section>
    );

  if (mode === "changeUsername" || mode === "changePassword") {
    const username = mode === "changeUsername";
    const credentialType = username ? "username" : "password";
    const credentialFields = username
      ? [
          {
            key: "currentPassword",
            label: "Old User Name",
            type: "text",
            maxLength: 100,
          },
          {
            key: "newUsername",
            label: "New User Name",
            type: "text",
            maxLength: 100,
          },
          {
            key: "confirmation",
            label: "Retype New user Name",
            type: "text",
            maxLength: 100,
          },
        ]
      : [
          {
            key: "currentPassword",
            label: "Old Password",
            type: "password",
            maxLength: 200,
            autoComplete: "current-password",
          },
          {
            key: "newPassword",
            label: "New Password",
            type: "password",
            maxLength: 200,
            autoComplete: "new-password",
          },
          {
            key: "confirmation",
            label: "Retype New Password",
            type: "password",
            maxLength: 200,
            autoComplete: "new-password",
          },
        ];
    return (
      <section className="admin-box box-primary form-panel">
        <div className="box-header with-border">
          <h3 className="box-title">
            {username ? "Edit User Name" : "Edit Password"}
          </h3>
        </div>
        <form
          className="form-horizontal"
          noValidate
          onBlurCapture={(event) => handleCredentialBlur(event, credentialType)}
          onSubmit={(event) =>
            submitCredential(event, credentialType, credentialFields)
          }
        >
          <div className="box-body">
            {credentialFields.map(
              ({ key, label, type, maxLength, autoComplete }) => (
                <div className="form-group row" key={key}>
                  <label
                    className="col-sm-2 control-label"
                    htmlFor={`credential-${key}`}
                  >
                    {label}
                  </label>
                  <div className="col-sm-10">
                    <div className="settings-validation-control">
                      <div data-credential-validation={key}>
                        <input
                          id={`credential-${key}`}
                          name={key}
                          type={type}
                          className="form-control"
                          placeholder="Enter ..."
                          maxLength={maxLength}
                          autoComplete={autoComplete}
                          aria-invalid={Boolean(credentialErrors[key])}
                          aria-describedby={
                            credentialErrors[key]
                              ? `credential-error-${key}`
                              : undefined
                          }
                          value={credentials[key]}
                          onChange={(event) =>
                            updateCredential(
                              key,
                              event.target.value,
                              credentialType,
                            )
                          }
                        />
                        {credentialErrors[key] ? (
                          <ValidationEngineMessage
                            id={`credential-error-${key}`}
                            message={credentialErrors[key]}
                            onDismiss={() =>
                              setCredentialErrors((current) => {
                                const next = { ...current };
                                delete next[key];
                                return next;
                              })
                            }
                          />
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              ),
            )}
          </div>
          <div className="box-footer">
            <button className="btn btn-primary" disabled={busy}>
              Submit
            </button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <section className="module-page settings-box box box-primary">
      <div className="box-header with-border">
        <h3 className="box-title">Edit Settings</h3>
      </div>
      <form
        className="settings-card settings-form form-horizontal settings-edit-form"
        onSubmit={saveSettings}
        onBlurCapture={handleSettingsBlur}
        noValidate
      >
        <div className="box-body">
          {settingFields.map(([key, label]) => {
            let options =
              key === "date_format"
                ? [
                    ["1", "2004-06-29"],
                    ["2", "06-29-2004"],
                    ["3", "29-06-2004"],
                    ["4", "29 Jun 2004"],
                    ["5", "29 June 2004"],
                    ["6", "Jun 29,2004"],
                    ["7", "Tue Jun 29th,2004"],
                    ["8", "Tuesday Jun 29th,2004"],
                    ["9", "Tuesday June 29th,2004"],
                    ["10", "29 June 2004 Tuesday"],
                    ["11", "6/20/2012"],
                  ]
                : key === "time_format"
                  ? [
                      ["1", "06:20 pm"],
                      ["2", "06:20 PM"],
                      ["3", "18:20"],
                    ]
                  : key === "time_zone"
                    ? timezoneOptions
                    : null;
            if (
              key === "user_email_option" ||
              key === "reminder_email_option"
            ) {
              return (
                <div className="form-group row" key={key}>
                  <label className="col-sm-2 control-label">{label}</label>
                  <div className="col-sm-10">
                    <div className="settings-radio-options">
                      {["On", "Off"].map((value) => (
                        <label key={value}>
                          <input
                            type="radio"
                            name={key}
                            value={value}
                            checked={settings[key] === value}
                            onChange={() => updateSetting(key, value)}
                          />
                          {value}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              );
            }
            return options ? (
              <SettingsField
                fieldKey={key}
                label={label}
                error={validationErrors[key]}
                onDismiss={() => dismissSettingError(key)}
                key={key}
              >
                <SearchableSelect
                  bare
                  label={label}
                  value={settings[key] || ""}
                  placeholder={
                    key === "date_format"
                      ? "[ Date Format ]"
                      : key === "time_format"
                        ? "[ Time Format ]"
                        : "[ Timezone ]"
                  }
                  className={validationErrors[key] ? "is-invalid" : ""}
                  buttonProps={{
                    id: key,
                    name: key,
                    "aria-invalid": Boolean(validationErrors[key]),
                    "aria-describedby": validationErrors[key]
                      ? `settings-validation-${key}`
                      : undefined,
                  }}
                  onChange={(event) => updateSetting(key, event.target.value)}
                >
                  {options.map(([value, text], index) => (
                    <option value={value} key={`${value}-${index}`}>
                      {text}
                    </option>
                  ))}
                </SearchableSelect>
              </SettingsField>
            ) : (
              <React.Fragment key={key}>
                {imageKeys.has(key) ? (
                  <SettingsField
                    fieldKey={key}
                    label={label}
                    error={validationErrors[key]}
                    onDismiss={() => dismissSettingError(key)}
                  >
                    <div className="logo-upload-control">
                      {(settings[key] || settings[`${key}_preview`]) && (
                        <div className="settings-preview-frame">
                          <img
                            src={
                              settings[`${key}_preview`] ||
                              settingImageUrl(settings[key])
                            }
                            alt={label}
                          />
                        </div>
                      )}
                      <input
                        id={key}
                        name={key}
                        type="file"
                        accept="image/*"
                        aria-invalid={Boolean(validationErrors[key])}
                        aria-describedby={
                          validationErrors[key]
                            ? `settings-validation-${key}`
                            : undefined
                        }
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          const previewUrl = URL.createObjectURL(file);
                          setSettingFiles((current) => ({
                            ...current,
                            [key]: file,
                          }));
                          setSettings((current) => ({
                            ...current,
                            [`${key}_preview`]: previewUrl,
                          }));
                          if (key === "site_logo") dismissSettingError(key);
                        }}
                      />
                    </div>
                  </SettingsField>
                ) : (
                  <SettingsField
                    fieldKey={key}
                    label={label}
                    error={validationErrors[key]}
                    onDismiss={() => dismissSettingError(key)}
                  >
                    <input
                      id={key}
                      name={key}
                      type="text"
                      className="form-control"
                      placeholder={
                        key.endsWith("_url") ? "Enter URL ..." : "Enter ..."
                      }
                      value={settings[key] || ""}
                      aria-invalid={Boolean(validationErrors[key])}
                      aria-describedby={
                        validationErrors[key]
                          ? `settings-validation-${key}`
                          : undefined
                      }
                      onChange={(event) =>
                        updateSetting(key, event.target.value)
                      }
                    />
                  </SettingsField>
                )}
              </React.Fragment>
            );
          })}
        </div>
        <div className="box-footer">
          <button className="btn btn-primary" disabled={busy}>
            Submit
          </button>
        </div>
      </form>
    </section>
  );
}
