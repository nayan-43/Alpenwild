import React from "react";
import RichTextEditor from "@/components/admin/RichTextEditor";

export default function TripItineraryPage({ entries, isNew, update, save }) {
  return (
    <div className="admin-row">
      <div className="admin-col-full">
        <section className="admin-box box-primary">
          <div className="box-header with-border">
            <h3 className="box-title">
              {isNew ? "Add Itinerary" : "Edit Itinerary"}
            </h3>
          </div>
          <form className="form-horizontal" onSubmit={save}>
            <div className="box-body">
              {entries.map((entry, index) => (
                <React.Fragment key={entry.day}>
                  <div className="box-header with-border">
                    <h3
                      className="box-title"
                      style={{ color: "#5B681B", fontSize: "20px" }}
                    >
                      Day {entry.day}
                    </h3>
                  </div>
                  <div className="form-group">
                    <label
                      className="col-sm-2 control-label"
                      htmlFor={`trips_itinerary_title_${entry.day}`}
                    >
                      Title
                    </label>
                    <div className="col-sm-10">
                      <input
                        id={`trips_itinerary_title_${entry.day}`}
                        name={`trips_itinerary_title_${entry.day}`}
                        className="form-control"
                        placeholder="Enter ..."
                        required
                        value={entry.title}
                        onChange={(event) =>
                          update(index, "title", event.target.value)
                        }
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label
                      className="col-sm-2 control-label"
                      htmlFor={`trips_itinerary_description_${entry.day}`}
                    >
                      Description
                    </label>
                    <div className="col-sm-10">
                      <RichTextEditor
                        id={`trips_itinerary_description_${entry.day}`}
                        name={`trips_itinerary_description_${entry.day}`}
                        value={entry.description || ""}
                        onChange={(value) =>
                          update(index, "description", value)
                        }
                      />
                    </div>
                  </div>
                </React.Fragment>
              ))}
              {!entries.length && (
                <p>
                  No active trip date is configured. Add a trip date first to
                  create itinerary days.
                </p>
              )}
            </div>
            <div className="box-footer">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!entries.length}
              >
                Submit
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
