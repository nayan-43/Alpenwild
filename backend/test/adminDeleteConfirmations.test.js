import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("admin module delete confirmations match the PHP wording and entity labels", async () => {
  const adminApp = await readFile(
    new URL("../../frontend/src/pages/AdminApp.jsx", import.meta.url),
    "utf8",
  );
  const phpFooter = await readFile(
    new URL("../../../administrator/includes/footer.php", import.meta.url),
    "utf8",
  );
  const entityByHandler = {
    removeMailingList: "Mailing List",
    removeFooter: "Footer Menu",
    removeRedirection: "Redirection",
    removeStaticPage: "Static Page",
    removeTripType: "Trip Type",
    removeLocation: "Location",
    removeActivity: "Activity",
    removeTestimonial: "Testimonial",
    removeDiscount: "Discount",
    removeTrip: "Trip",
    removeTripGallery: "Gallery",
    removeTripLeader: "Trip Leader",
    removeInvoice: "Invoice",
    removeOrder: "Order",
    removeAttributeType: "Attribute Type",
    removeAttributeValue: "Attribute Value",
    removeProduct: "Product",
    removeProductAttribute: "Attribute",
    removeUser: "User",
    removeCategory: "Category",
    removePromotion: "Offers Promotions",
    removeSpecialFeature: "Special Feature",
  };

  assert.match(
    phpFooter,
    /confirm\("Are you sure, you want to delete this " \+ cc \+ "\?"\)/,
  );
  for (const [handler, entity] of Object.entries(entityByHandler)) {
    const functionPattern = new RegExp(
      `async function ${handler}\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}`,
    );
    const body = adminApp.match(functionPattern)?.[0];
    assert.ok(body, `${handler} handler exists`);
    assert.ok(
      body.includes(`Are you sure, you want to delete this ${entity}?`),
      `${handler} uses the PHP confirmation text for ${entity}`,
    );
    assert.ok(
      phpFooter.includes(`\\'${entity}\\')`),
      `PHP table uses the ${entity} confirmation label`,
    );
  }
});

test("booking, FAQ, and payment delete confirmations retain PHP wording", async () => {
  const adminApp = await readFile(
    new URL("../../frontend/src/pages/AdminApp.jsx", import.meta.url),
    "utf8",
  );
  const phpFooter = await readFile(
    new URL("../../../administrator/includes/footer.php", import.meta.url),
    "utf8",
  );
  const contestPage = await readFile(
    new URL(
      "../../frontend/src/pages/admin/contest/ContestModulePage.jsx",
      import.meta.url,
    ),
    "utf8",
  );
  const faqPage = await readFile(
    new URL(
      "../../frontend/src/pages/admin/trip/TripFaqPage.jsx",
      import.meta.url,
    ),
    "utf8",
  );
  const tripSection = await readFile(
    new URL(
      "../../frontend/src/pages/admin/trip/TripSectionPage.jsx",
      import.meta.url,
    ),
    "utf8",
  );
  const phpTripPayment = await readFile(
    new URL("../../../administrator/manage_trip_payment.php", import.meta.url),
    "utf8",
  );
  const phpTripMakePayment = await readFile(
    new URL(
      "../../../administrator/manage_trip_make_payment.php",
      import.meta.url,
    ),
    "utf8",
  );
  const phpFaq = await readFile(
    new URL("../../../administrator/manage_faq_page.php", import.meta.url),
    "utf8",
  );

  assert.match(adminApp, /Are you sure, you want to delete this Trips\?/);
  assert.match(phpTripPayment, /Are you sure, you want to delete this Trips/);
  assert.match(
    contestPage,
    /Are you sure, you want to delete this \$\{entity\}\?/,
  );
  assert.match(contestPage, /mode === "contestUsers"\s*\?\s*"User"/);
  assert.match(
    contestPage,
    /mode === "contestSubmissions"\s*\?\s*"Submisiion"/,
  );
  assert.match(contestPage, /:\s*"Contest"/);
  for (const entity of ["Contest", "User", "Submisiion"])
    assert.ok(
      phpFooter.includes(`\\'${entity}\\')`),
      `PHP table uses the ${entity} confirmation label`,
    );
  assert.match(
    phpFaq,
    /Are you sure you want to delete this Question and Answer\?/,
  );
  assert.match(
    faqPage,
    /Are you sure you want to delete this Question and Answer\?/,
  );
  assert.match(
    phpTripMakePayment,
    /Are you sure, you want to delete this payment\?/,
  );
  assert.match(tripSection, /Are you sure, you want to delete this payment\?/);
});
