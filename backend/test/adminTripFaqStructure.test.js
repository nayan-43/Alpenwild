import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("trip FAQ form and listing retain the PHP AdminLTE structure", async () => {
  const [
    phpManageFaq,
    phpEditFaq,
    reactFaq,
    moduleTable,
    adminLayout,
    styles,
    backendApp,
    adminApp,
  ] = await Promise.all([
    readFile(
      new URL("../../../administrator/manage_faq_page.php", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../../../administrator/faq_page_edit.php", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../../frontend/src/pages/admin/trip/TripFaqPage.jsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../../frontend/src/components/admin/ModuleTable.jsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../../frontend/src/components/admin/AdminLayout.jsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../../frontend/src/styles.css", import.meta.url), "utf8"),
    readFile(new URL("../src/app.js", import.meta.url), "utf8"),
    readFile(
      new URL("../../frontend/src/pages/AdminApp.jsx", import.meta.url),
      "utf8",
    ),
  ]);

  for (const phpPage of [phpManageFaq, phpEditFaq]) {
    assert.match(phpPage, /class="box box-primary"/);
    assert.match(phpPage, /class="form-horizontal"/);
    assert.match(phpPage, /class="form-group"/);
    assert.match(phpPage, /class="col-sm-2 control-label"/);
    assert.match(phpPage, /class="col-sm-10"/);
    assert.match(phpPage, /class="box-body"/);
    assert.match(phpPage, /class="box-footer"/);
  }

  assert.match(reactFaq, /className="admin-box box-primary faq-panel"/);
  assert.match(reactFaq, /className="form-horizontal"/);
  assert.match(reactFaq, /className="form-group row"/);
  assert.match(reactFaq, /className="col-sm-2 control-label"/);
  assert.match(reactFaq, /className="col-sm-10"/);
  assert.match(reactFaq, /className="box-body"/);
  assert.match(reactFaq, /className="box-footer"/);
  assert.match(reactFaq, /embedded\s*$/m);
  assert.match(moduleTable, /embedded \? "faq-table-module"/);
  assert.match(reactFaq, /label: "Trips Name"/);
  assert.match(reactFaq, /label: "Question"/);
  assert.match(reactFaq, /label: "Answer"/);
  assert.match(reactFaq, /actionLabel="Action"/);
  assert.match(adminLayout, /page === "tripFaqEdit"\s*\?\s*"Edit Faq"/);
  assert.match(phpManageFaq, /class="display"/);
  assert.match(phpManageFaq, /style="width:100%"/);
  assert.match(moduleTable, /embedded \? "dataTable" : "table table-bordered/);
  assert.match(
    moduleTable,
    /style=\{embedded \? \{ width: "100%" \} : undefined\}/,
  );
  assert.match(
    styles,
    /\.faq-data-table thead th\s*\{[^}]*padding: 10px;[^}]*border-bottom: 1px solid rgba\(0, 0, 0, 0\.3\);/s,
  );
  assert.match(
    styles,
    /\.faq-data-table thead > tr > th\.sorting::before[\s\S]*content: "▲";/,
  );
  assert.doesNotMatch(
    styles,
    /\.faq-data-table (?:th|td):first-child\s*\{[^}]*width:/s,
  );
  assert.doesNotMatch(
    styles,
    /\.faq-data-table (?:th|td):last-child\s*\{[^}]*width:/s,
  );
  assert.doesNotMatch(styles, /\.faq-question-preview\s*\{[^}]*max-width:/s);
  assert.match(
    styles,
    /\.faq-panel \.faq-data-table \.options button\.btn-link:hover,[\s\S]*?text-decoration: none !important;/,
  );
  assert.match(
    backendApp,
    /VALUES \(\$1,\$2,\$3,COALESCE\(\(SELECT MAX\(faq_order\) \+ 1 FROM alpenwild_faq_page_tbl WHERE static_page_id=\$4\),1\)\)[\s\S]*?\[data\.question, data\.answer, req\.params\.tripId, req\.params\.tripId\]/,
  );
  assert.match(
    backendApp,
    /async function ensureLegacyTripFaqIdentity\(\)[\s\S]*?CREATE SEQUENCE IF NOT EXISTS alpenwild_faq_page_tbl_id_seq[\s\S]*?MAX\(id\)[\s\S]*?ALTER TABLE alpenwild_faq_page_tbl ALTER COLUMN id SET DEFAULT nextval/,
  );
  assert.match(backendApp, /await ensureLegacyTripFaqIdentity\(\);/);
  assert.match(phpEditFaq, /manage_faq_page\.php\?faq_id=/);
  assert.match(reactFaq, /if \(editingId && editId && onUpdateComplete\)/);
  assert.match(reactFaq, /onUpdateComplete\(\);/);
  assert.match(
    adminApp,
    /onUpdateComplete=\{\(\) => \{[\s\S]*?navigate\("tripFaq", `\/administrator\/trips\/\$\{faqTrip\.id\}\/faq`\);[\s\S]*?setNotice\("FAQ updated successfully\."\);/,
  );
});
