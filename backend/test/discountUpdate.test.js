import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { serializeComparableForm } from "../../frontend/src/lib/adminFormSnapshot.js";

test("unchanged discount edits return the PHP no-update message without updating", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const phpClass = await readFile(
    new URL("../../../includes/classes/discount_class.php", import.meta.url),
    "utf8",
  );
  const phpForm = await readFile(
    new URL("../../../administrator/add_discount.php", import.meta.url),
    "utf8",
  );
  const editRoute = app.match(
    /app\.patch\("\/api\/discounts\/:id"[\s\S]*?\n\}\);/,
  )?.[0];

  assert.ok(editRoute, "discount edit route exists");
  assert.match(phpClass, /function discount_edit\(/);
  assert.match(phpForm, /discount_edit\([\s\S]*?Sorry, nothing is updated\./);
  assert.match(
    editRoute,
    /SELECT discount_name AS name, discount_code AS code/,
  );
  assert.match(editRoute, /const unchanged\s*=/);
  assert.match(editRoute, /if\s*\(unchanged\)[\s\S]*?unchanged:\s*true/);
  assert.match(editRoute, /Sorry, nothing is updated\./);
});

test("unchanged discount edits show the PHP warning on the manage page", async () => {
  const app = await readFile(
    new URL("../../frontend/src/pages/AdminApp.jsx", import.meta.url),
    "utf8",
  );
  const table = await readFile(
    new URL(
      "../../frontend/src/components/admin/ModuleTable.jsx",
      import.meta.url,
    ),
    "utf8",
  );
  const styles = await readFile(
    new URL("../../frontend/src/styles.css", import.meta.url),
    "utf8",
  );

  assert.match(app, /result\?\.unchanged === true/);
  assert.match(
    app,
    /unchanged\s*\?\s*result\.message\s*:\s*wasEditing\s*\?\s*"Discount updated successfully\."\s*:\s*"Discount added successfully\. Please enter another\."/,
  );
  assert.match(
    table,
    /alert \$\{notice === "Sorry, nothing is updated\."\s*\?\s*"warning"/,
  );
  assert.match(styles, /\.alert\.warning\s*\{[\s\S]*?background:\s*#f39c12/);
});

test("React detects unchanged edits across all AdminApp form modules", async () => {
  const app = await readFile(
    new URL("../../frontend/src/pages/AdminApp.jsx", import.meta.url),
    "utf8",
  );

  const expectedModules = [
    "banners",
    "promotions",
    "specialFeatures",
    "footerMenus",
    "redirections",
    "staticPages",
    "tripTypes",
    "locations",
    "activities",
    "testimonials",
    "discounts",
    "trips",
    "tripGalleries",
    "tripLeaders",
    "invoices",
    "attributeTypes",
    "attributeValues",
    "products",
    "productAttributes",
    "users",
    "categories",
    "mailingList",
  ];
  const guardedModules = new Set(
    [...app.matchAll(/showUnchangedEdit\(\s*"([^"]+)"/g)].map(
      (match) => match[1],
    ),
  );

  assert.match(app, /serializeComparableForm/);
  assert.match(app, /function showUnchangedEdit\(module, id, values\)/);
  assert.match(app, /setNotice\("Sorry, nothing is updated\."\)/);
  for (const module of expectedModules) {
    assert.ok(guardedModules.has(module), `${module} save checks for changes`);
    assert.match(
      app,
      new RegExp(`\\["${module}",\\s*[^,]+,\\s*\\w+\\]`),
      `${module} edit values are captured as the baseline`,
    );
  }
});

test("form snapshots ignore object key ordering but preserve nested values", () => {
  const first = {
    name: "Trip",
    nested: { end: "2027-02-02", start: "2027-02-01" },
  };
  const sameValues = {
    nested: { start: "2027-02-01", end: "2027-02-02" },
    name: "Trip",
  };
  const changedValues = {
    ...sameValues,
    nested: { ...sameValues.nested, end: "2027-02-03" },
  };

  assert.equal(
    serializeComparableForm(first),
    serializeComparableForm(sameValues),
  );
  assert.notEqual(
    serializeComparableForm(first),
    serializeComparableForm(changedValues),
  );
});

test("separate Contest, FAQ, and booking edit forms reject unchanged submits", async () => {
  const contest = await readFile(
    new URL(
      "../../frontend/src/pages/admin/contest/ContestModulePage.jsx",
      import.meta.url,
    ),
    "utf8",
  );
  const faq = await readFile(
    new URL(
      "../../frontend/src/pages/admin/trip/TripFaqPage.jsx",
      import.meta.url,
    ),
    "utf8",
  );
  const booking = await readFile(
    new URL(
      "../../frontend/src/pages/admin/trip/AddTripBookingPage.jsx",
      import.meta.url,
    ),
    "utf8",
  );
  const itinerary = await readFile(
    new URL("../../frontend/src/pages/AdminApp.jsx", import.meta.url),
    "utf8",
  );
  const tripSection = await readFile(
    new URL(
      "../../frontend/src/pages/admin/trip/TripSectionPage.jsx",
      import.meta.url,
    ),
    "utf8",
  );
  const settings = await readFile(
    new URL(
      "../../frontend/src/pages/admin/settings/AdminSettingsPage.jsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(contest, /editId\s*&&[\s\S]*?Sorry, nothing is updated\./);
  assert.match(faq, /editingId\s*&&[\s\S]*?Sorry, nothing is updated\./);
  assert.match(booking, /bookingId\s*&&[\s\S]*?Sorry, nothing is updated\./);
  assert.match(
    itinerary,
    /itinerarySnapshot\.current\s*===\s*serializeComparableForm\(itineraryEntries\)/,
  );
  assert.match(
    tripSection,
    /paymentEditSnapshot\.current\s*===\s*currentEdits/,
  );
  assert.match(settings, /settingsSnapshot\.current\s*===\s*currentSettings/);
  assert.match(
    settings,
    /templateSnapshots\.current\.get\(snapshotKey\)\s*===\s*serializeComparableForm\(template\)/,
  );
  assert.match(
    contest,
    /initialSnapshot\s*===\s*serializeComparableForm\(settings\)/,
  );
});
