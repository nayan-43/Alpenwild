import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("trip itinerary structure and save messages match the PHP form", async () => {
  const [phpForm, phpClass, adminApp, reactPage, richTextEditor] =
    await Promise.all([
      readFile(
        new URL("../../../administrator/add_itinerary.php", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL(
          "../../../includes/classes/trip_itinerary_class.php",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL("../../frontend/src/pages/AdminApp.jsx", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL(
          "../../frontend/src/pages/admin/trip/TripItineraryPage.jsx",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../../frontend/src/components/admin/RichTextEditor.jsx",
          import.meta.url,
        ),
        "utf8",
      ),
    ]);

  assert.match(phpForm, /class="box box-primary"/);
  assert.match(phpForm, /class="box-header with-border"/);
  assert.match(phpForm, /class="form-horizontal"/);
  assert.match(phpForm, /class="form-group"/);
  assert.match(phpForm, /class="col-sm-2 control-label"/);
  assert.match(phpForm, /class="col-sm-10"/);
  assert.match(phpForm, /class="box-footer"/);
  assert.match(
    phpForm,
    /Itinerary added successfully\. Please enter another\./,
  );
  assert.match(phpForm, /Itinerary updated successfully\./);
  assert.match(phpForm, /Sorry, nothing is added\./);
  assert.match(phpForm, /Sorry, nothing is updated\./);
  assert.match(
    reactPage,
    /className="admin-box box-primary"[\s\S]*?className="box-header with-border"[\s\S]*?className="form-horizontal"[\s\S]*?className="form-group"[\s\S]*?className="col-sm-2 control-label"[\s\S]*?className="col-sm-10"[\s\S]*?className="box-footer"/,
  );
  assert.match(reactPage, /style=\{\{ color: "#5B681B", fontSize: "20px" \}\}/);
  assert.match(
    reactPage,
    /name=\{`trips_itinerary_title_\$\{entry\.day\}`\}[\s\S]*?name=\{`trips_itinerary_description_\$\{entry\.day\}`\}/,
  );
  assert.match(richTextEditor, /id=\{id \|\| generatedId\}/);
  assert.match(richTextEditor, /name=\{name\}/);
  assert.match(
    phpClass,
    /if \(\$trips_itinerary_add\['affectedRow'\] > 0\)[\s\S]*?header\('Location: manage_trip\.php'\);/,
  );
  assert.match(
    adminApp,
    /isNewItinerary[\s\S]*?Itinerary added successfully\. Please enter another\.[\s\S]*?Itinerary updated successfully\./,
  );
  assert.match(adminApp, /setNotice\("Sorry, nothing is added\."\)/);
  assert.match(adminApp, /setNotice\("Sorry, nothing is updated\."\)/);
});
