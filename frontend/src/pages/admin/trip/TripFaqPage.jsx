import React, { useEffect, useRef, useState } from "react";
import RichTextEditor from "@/components/admin/RichTextEditor";
import ModuleTable from "@/components/admin/ModuleTable";
import { AdminTableIcon } from "@/components/admin/Icon";
import { serializeComparableForm } from "@/lib/adminFormSnapshot";

export default function TripFaqPage({
  trip,
  cancel,
  onEdit,
  onUpdateComplete,
  notice,
  onDismissNotice,
  editId = null,
}) {
  const [entries, setEntries] = useState([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [editingId, setEditingId] = useState(editId);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const editSnapshot = useRef(null);

  async function load() {
    const response = await fetch(`/api/trip-faqs/${trip.id}`);
    if (!response.ok) throw new Error("Unable to load FAQs.");
    setEntries(await response.json());
  }

  useEffect(() => {
    load().catch((loadError) => setError(loadError.message));
  }, [trip.id]);

  useEffect(() => {
    if (!editId || !entries.length) return;
    const entry = entries.find((item) => Number(item.id) === Number(editId));
    if (entry) {
      setEditingId(entry.id);
      setQuestion(entry.question || "");
      setAnswer(entry.answer || "");
      editSnapshot.current = serializeComparableForm({
        question: entry.question || "",
        answer: entry.answer || "",
      });
    }
  }, [editId, entries]);

  async function save(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    if (
      editingId &&
      editSnapshot.current === serializeComparableForm({ question, answer })
    ) {
      setMessage("Sorry, nothing is updated.");
      return;
    }
    try {
      const response = await fetch(
        editingId
          ? `/api/trip-faqs/${trip.id}/${editingId}`
          : `/api/trip-faqs/${trip.id}`,
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question, answer }),
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.message || "Unable to save FAQ.");
      if (editingId && editId && onUpdateComplete) {
        onUpdateComplete();
        return;
      }
      setQuestion("");
      setAnswer("");
      setEditingId(null);
      editSnapshot.current = null;
      setMessage(
        editingId ? "FAQ updated successfully." : "FAQ added successfully.",
      );
      await load();
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  function edit(entry) {
    if (onEdit) {
      onEdit(entry);
      return;
    }
    setEditingId(entry.id);
    setQuestion(entry.question || "");
    setAnswer(entry.answer || "");
    editSnapshot.current = serializeComparableForm({
      question: entry.question || "",
      answer: entry.answer || "",
    });
    setMessage("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function remove(id) {
    if (
      !window.confirm(
        "Are you sure you want to delete this Question and Answer?",
      )
    )
      return;
    try {
      const response = await fetch(`/api/trip-faqs/${trip.id}/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Unable to delete FAQ.");
      await load();
    } catch (removeError) {
      setError(removeError.message);
    }
  }

  return (
    <div className="admin-row">
      <div className="admin-col-full">
        <section className="admin-box box-primary faq-panel">
          {(message || error) && (
            <div className="box-body">
              <div
                className={
                  error
                    ? "alert error"
                    : message === "Sorry, nothing is updated."
                      ? "alert warning"
                      : "alert success"
                }
                role="alert"
              >
                <button
                  type="button"
                  className="admin-alert-close"
                  onClick={() => {
                    setError("");
                    setMessage("");
                  }}
                  aria-label="Close"
                >
                  ×
                </button>
                {error || message}
              </div>
            </div>
          )}
          <form className="form-horizontal" onSubmit={save}>
            <div className="box-body">
              <div className="form-group row">
                <label
                  className="col-sm-2 control-label"
                  htmlFor="faq-question"
                >
                  Question
                </label>
                <div className="col-sm-10">
                  <input
                    id="faq-question"
                    name="question"
                    type="text"
                    className="form-control"
                    placeholder="Enter ..."
                    required
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                  />
                </div>
              </div>
              <div className="form-group row">
                <label className="col-sm-2 control-label" htmlFor="faq-answer">
                  Answer
                </label>
                <div className="col-sm-10">
                  <RichTextEditor
                    value={answer}
                    onChange={setAnswer}
                    required
                  />
                </div>
              </div>
            </div>
            <div className="box-footer">
              <button
                type="button"
                className="btn btn-default button"
                onClick={cancel}
                style={{ marginLeft: "50%" }}
              >
                Cancel
              </button>{" "}
              <button type="submit" className="btn btn-primary">
                {editingId ? "Update" : "Submit"}
              </button>
              {editingId && !editId && (
                <button
                  type="button"
                  className="btn btn-default button"
                  onClick={() => {
                    setEditingId(null);
                    setQuestion("");
                    setAnswer("");
                    editSnapshot.current = null;
                  }}
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>
          {!editId && (
            <ModuleTable
              embedded
              rows={entries.map((entry, index) => ({
                ...entry,
                serial: index + 1,
                trip_name: trip.name,
              }))}
              columns={[
                { label: "Sl no", key: "serial" },
                { label: "Trips Name", key: "trip_name" },
                {
                  label: "Question",
                  key: "question",
                  render: (row) => faqPreviewText(row.question),
                },
                {
                  label: "Answer",
                  key: "answer",
                  render: (row) => (
                    <div
                      className="faq-answer-preview"
                      dangerouslySetInnerHTML={{
                        __html: faqPreviewMarkup(row.answer),
                      }}
                    />
                  ),
                },
              ]}
              tableClassName="faq-data-table"
              actionLabel="Action"
              notice={notice}
              onDismissNotice={onDismissNotice}
              initialSortKey="serial"
              renderActions={(row) => (
                <>
                  <button
                    className="btn btn-link p-0"
                    type="button"
                    title="Edit"
                    onClick={() => edit(row)}
                  >
                    <AdminTableIcon name="edit" />
                  </button>
                  <button
                    className="btn btn-link p-0"
                    type="button"
                    title="Delete"
                    onClick={() => remove(row.id)}
                  >
                    <AdminTableIcon name="close" />
                  </button>
                </>
              )}
            />
          )}
        </section>
      </div>
    </div>
  );
}

function stripMarkup(value) {
  const element = document.createElement("div");
  element.innerHTML = String(value || "");
  return element.textContent || "";
}

function faqPreviewText(value) {
  const text = stripMarkup(value).replace(/\s+/g, " ").trim();
  const preview = text.slice(0, 100);
  const hasOverflowLetters = (text.match(/[a-z]/gi) || []).length >= 100;
  return `${preview}${hasOverflowLetters ? "......." : ""}`;
}

function faqPreviewMarkup(value) {
  const html = String(value || "");
  const preview = html.slice(0, 100);
  const hasOverflowLetters = (html.match(/[a-z]/gi) || []).length >= 100;
  return `${preview}${hasOverflowLetters ? "......." : ""}`;
}
