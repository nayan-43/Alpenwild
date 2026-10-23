import React, { useEffect, useRef, useState } from "react";
import PublicLoader from "@/components/public/PublicLoader";
import { localizeRichContent, thumbnailAssetUrl } from "@/lib/assets";
import { RECAPTCHA_SITE_KEY } from "@/lib/recaptcha";

const recaptchaEnabled = import.meta.env.VITE_ENABLE_RECAPTCHA !== "false";

export default function PublicContestPage() {
  const [data, setData] = useState({
    contests: [],
    submissions: [],
    rules: "",
  });
  const [tab, setTab] = useState("form");
  const [contestId, setContestId] = useState("");
  const [entries, setEntries] = useState([
    { file: null, title: "", description: "" },
  ]);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zip: "",
  });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const captchaRef = useRef(null);
  const widgetId = useRef(null);
  const openContests = data.contests.filter((contest) => contest.is_open);
  const selectedContest = data.contests.find(
    (contest) => String(contest.id) === contestId,
  );
  const contestSubmissions = data.submissions.filter(
    (submission) => String(submission.contest_id) === contestId,
  );

  async function loadContestData() {
    const response = await fetch("/api/public/contests");
    const result = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(result.message || "Unable to load contest information.");
    setData(result);
  }

  useEffect(() => {
    let active = true;
    loadContestData()
      .catch((loadError) => {
        if (active) setError(loadError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!recaptchaEnabled || !RECAPTCHA_SITE_KEY || !captchaRef.current) return;
    let attempts = 0;
    let intervalId;
    const render = () => {
      if (
        !captchaRef.current ||
        !window.grecaptcha?.render ||
        widgetId.current !== null
      )
        return false;
      widgetId.current = window.grecaptcha.render(captchaRef.current, {
        sitekey: RECAPTCHA_SITE_KEY,
      });
      return true;
    };
    if (!render()) {
      if (!document.querySelector('script[data-contest-recaptcha="true"]')) {
        const script = document.createElement("script");
        script.src = "https://www.google.com/recaptcha/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        script.dataset.contestRecaptcha = "true";
        document.head.appendChild(script);
      }
      intervalId = window.setInterval(() => {
        attempts += 1;
        if (render() || attempts >= 100) window.clearInterval(intervalId);
      }, 150);
    }
    return () => {
      if (intervalId) window.clearInterval(intervalId);
      widgetId.current = null;
    };
  }, [tab]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateEntry(index, field, value) {
    setEntries((current) =>
      current.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, [field]: value } : entry,
      ),
    );
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    if (!selectedContest?.is_open) {
      setError("Please select a contest that is currently open.");
      return;
    }
    if (entries.some((entry) => !entry.file)) {
      setError("Please select an image for each submission.");
      return;
    }
    const token = recaptchaEnabled
      ? window.grecaptcha?.getResponse?.(widgetId.current) || ""
      : "";
    if (recaptchaEnabled && !token) {
      setError("Please complete the reCAPTCHA check.");
      return;
    }
    const payload = new FormData();
    payload.set("contest_id", contestId);
    payload.set("first_name", form.first_name);
    payload.set("last_name", form.last_name);
    payload.set("email", form.email);
    payload.set("phone", form.phone.replace(/\D/g, ""));
    payload.set("address", form.address);
    payload.set("city", form.city);
    payload.set("state", form.state);
    payload.set("zip", form.zip);
    payload.set(
      "entries",
      JSON.stringify(
        entries.map(({ title, description }) => ({ title, description })),
      ),
    );
    payload.set("recaptcha_token", token);
    payload.set("agree", "true");
    entries.forEach((entry) => payload.append("images", entry.file));
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/public/contest-submissions", {
        method: "POST",
        body: payload,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          result.message || "Unable to submit your contest entry.",
        );
      setNotice(result.message);
      setForm({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        state: "",
        zip: "",
      });
      setEntries([{ file: null, title: "", description: "" }]);
      event.currentTarget.reset();
      await loadContestData();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
      if (widgetId.current !== null)
        window.grecaptcha?.reset?.(widgetId.current);
    }
  }

  return (
    <>
      {loading && <PublicLoader />}
      <section className="client-contest">
        <nav className="client-contest-tabs" aria-label="Contest sections">
          {[
            ["form", "Contest Form"],
            ["submissions", "Submissions"],
            ["rules", "Contest Rules"],
          ].map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={tab === value ? "active" : ""}
              onClick={() => setTab(value)}
            >
              {label}
            </button>
          ))}
        </nav>
        {error && (
          <div className="client-alert" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div
            className="client-booking-alert client-booking-alert-success"
            role="status"
          >
            {notice}
          </div>
        )}
        {tab === "form" && (
          <form className="client-contest-form" onSubmit={submit}>
            <label>
              Select Contest
              <select
                required
                value={contestId}
                onChange={(event) => setContestId(event.target.value)}
              >
                <option value="">-- Select Contest --</option>
                {openContests.map((contest) => (
                  <option value={contest.id} key={contest.id}>
                    {contest.contest_title}
                  </option>
                ))}
              </select>
            </label>
            {!openContests.length && (
              <p role="status">
                There are no contests open for entries right now.
              </p>
            )}
            <div className="client-contest-contact">
              {[
                ["first_name", "First Name", "text"],
                ["last_name", "Last Name", "text"],
                ["email", "Email Address", "email"],
                ["phone", "Phone (10 digits)", "tel"],
                ["address", "Address", "text"],
                ["city", "City", "text"],
                ["state", "State", "text"],
                ["zip", "ZIP", "text"],
              ].map(([field, label, type]) => (
                <label key={field}>
                  {label}
                  <input
                    required
                    type={type}
                    value={form[field]}
                    pattern={field === "phone" ? "[0-9]{10}" : undefined}
                    onChange={(event) => updateForm(field, event.target.value)}
                  />
                </label>
              ))}
            </div>
            {entries.map((entry, index) => (
              <fieldset className="client-contest-entry" key={index}>
                <legend>Submission Image {index + 1}</legend>
                <label>
                  Image
                  <input
                    required
                    type="file"
                    accept=".jpg,.jpeg,.png,.gif,image/jpeg,image/png,image/gif"
                    onChange={(event) =>
                      updateEntry(
                        index,
                        "file",
                        event.target.files?.[0] || null,
                      )
                    }
                  />
                </label>
                {selectedContest && (
                  <small>
                    {selectedContest.contest_image_min_width}–
                    {selectedContest.contest_image_max_width}px wide,{" "}
                    {selectedContest.contest_image_min_height}–
                    {selectedContest.contest_image_max_height}px high; file must
                    be under {selectedContest.contest_image_max_size} MB.
                  </small>
                )}
                <label>
                  Image Title
                  <input
                    value={entry.title}
                    onChange={(event) =>
                      updateEntry(index, "title", event.target.value)
                    }
                  />
                </label>
                <label>
                  Description
                  <textarea
                    value={entry.description}
                    onChange={(event) =>
                      updateEntry(index, "description", event.target.value)
                    }
                  />
                </label>
                {entries.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setEntries((current) =>
                        current.filter((_, entryIndex) => entryIndex !== index),
                      )
                    }
                  >
                    Remove Image
                  </button>
                )}
              </fieldset>
            ))}
            {entries.length < 10 && (
              <button
                type="button"
                onClick={() =>
                  setEntries((current) => [
                    ...current,
                    { file: null, title: "", description: "" },
                  ])
                }
              >
                Add New Image
              </button>
            )}
            {recaptchaEnabled && (
              <div className="client-booking-captcha">
                {RECAPTCHA_SITE_KEY ? (
                  <div ref={captchaRef} />
                ) : (
                  <p role="alert">
                    reCAPTCHA is enabled but its site key is missing.
                  </p>
                )}
              </div>
            )}
            <label className="client-contest-terms">
              <input type="checkbox" required />
              Accept the terms and conditions of the contest.
            </label>
            <button
              className="client-button"
              type="submit"
              disabled={busy || !openContests.length}
            >
              {busy ? "Submitting…" : "Submit"}
            </button>
          </form>
        )}
        {tab === "submissions" && (
          <>
            <div className="client-contest-filters">
              <button type="button" onClick={() => setContestId("")}>
                Show All
              </button>
              {data.contests.map((contest) => (
                <button
                  type="button"
                  key={contest.id}
                  onClick={() => setContestId(String(contest.id))}
                >
                  {contest.contest_title}
                </button>
              ))}
            </div>
            <div className="client-contest-gallery">
              {data.submissions
                .filter(
                  (submission) =>
                    !contestId || String(submission.contest_id) === contestId,
                )
                .map((submission) => (
                  <article key={submission.id}>
                    <img
                      src={thumbnailAssetUrl(submission.image_url, 400, 400)}
                      alt={submission.title || submission.user_name}
                    />
                    <h3>{submission.title || submission.user_name}</h3>
                    <p>{submission.description}</p>
                    <small>{submission.user_name}</small>
                  </article>
                ))}
            </div>
          </>
        )}
        {tab === "rules" && (
          <div
            className="client-contest-rules"
            dangerouslySetInnerHTML={{
              __html: localizeRichContent(data.rules || ""),
            }}
          />
        )}
      </section>
    </>
  );
}
