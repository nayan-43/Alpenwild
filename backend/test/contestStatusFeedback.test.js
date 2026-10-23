import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("contest status actions show PHP success messages", async () => {
  const contestClass = await readFile(
    new URL("../../../includes/classes/contest_class.php", import.meta.url),
    "utf8",
  );
  const contestPage = await readFile(
    new URL(
      "../../frontend/src/pages/admin/contest/ContestModulePage.jsx",
      import.meta.url,
    ),
    "utf8",
  );
  const updateStatus = contestPage.match(
    /async function updateStatus\(path, body, message\) \{[\s\S]*?\n  \}/,
  )?.[0];

  assert.ok(updateStatus, "contest status handler exists");
  assert.match(updateStatus, /await api\(path/);
  assert.match(updateStatus, /await load\(\);\s*onNotice\(message\)/);
  assert.match(updateStatus, /catch \(error\) \{\s*onError\(error\.message\)/);
  assert.match(contestPage, /"Contest's Status is updated successfully"/);
  assert.match(contestPage, /"User's Status is updated successfully"/);
  assert.match(contestPage, /"Submission's Status is updated successfully"/);
  assert.match(contestPage, /"Winner's Status is updated successfully"/);

  for (const message of [
    "Contest\\'s Status is updated successfully",
    "User\\'s Status is updated successfully",
    "Submission\\'s Status is updated successfully",
    "Winner\\'s Status is updated successfully",
  ]) {
    assert.ok(
      contestClass.includes(`messagedisplay('${message}', 1)`),
      `PHP displays ${message.replaceAll("\\'", "'")}`,
    );
  }
});

test("contest add, edit, and unchanged messages survive navigation and match PHP", async () => {
  const contestClass = await readFile(
    new URL("../../../includes/classes/contest_class.php", import.meta.url),
    "utf8",
  );
  const phpForm = await readFile(
    new URL("../../../administrator/add_contest_page.php", import.meta.url),
    "utf8",
  );
  const contestPage = await readFile(
    new URL(
      "../../frontend/src/pages/admin/contest/ContestModulePage.jsx",
      import.meta.url,
    ),
    "utf8",
  );
  const save = contestPage.match(
    /async function save\(event\) \{[\s\S]*?\n  \}/,
  )?.[0];

  assert.ok(save, "contest save handler exists");
  assert.match(
    phpForm,
    /"Contest added successfully\. Please enter another\.",\s*"Sorry, nothing is added\."/,
  );
  assert.match(
    phpForm,
    /"Contest updated successfully\.",\s*"Sorry, nothing is updated\."/,
  );
  assert.match(contestClass, /messagedisplay\(\$contest_success_message, 1\)/);
  assert.match(
    save,
    /setForm\(emptyContest\);\s*onNotice\("Contest added successfully\. Please enter another\."\)/,
  );
  assert.match(
    save,
    /pushState\(\{\}, "", "\/administrator\/contests"\);\s*window\.dispatchEvent\(new PopStateEvent\("popstate"\)\);\s*onNotice\("Contest updated successfully\."\)/,
  );
  assert.match(
    save,
    /pushState\(\{\}, "", "\/administrator\/contests"\);\s*window\.dispatchEvent\(new PopStateEvent\("popstate"\)\);\s*onNotice\("Sorry, nothing is updated\."\)/,
  );
});

test("contest deletion shows PHP-matching success feedback", async () => {
  const contestClass = await readFile(
    new URL("../../../includes/classes/contest_class.php", import.meta.url),
    "utf8",
  );
  const contestPage = await readFile(
    new URL(
      "../../frontend/src/pages/admin/contest/ContestModulePage.jsx",
      import.meta.url,
    ),
    "utf8",
  );
  const remove = contestPage.match(
    /const deleteItem = async \(item\) => \{[\s\S]*?\n  \};/,
  )?.[0];

  assert.ok(remove, "contest delete handler exists");
  assert.match(
    contestClass,
    /messagedisplay\('Contest details deleted successfully', 1\)/,
  );
  assert.match(
    remove,
    /await api\(`\/\$\{resource\}\/\$\{item\.id\}`,[\s\S]*?await load\(\);[\s\S]*?onNotice\([\s\S]*?"Contest details deleted successfully"/,
  );
  assert.match(remove, /catch \(error\) \{\s*onError\(error\.message\)/);
});

test("opening Add Contest resets values left from a prior edit", async () => {
  const contestPage = await readFile(
    new URL(
      "../../frontend/src/pages/admin/contest/ContestModulePage.jsx",
      import.meta.url,
    ),
    "utf8",
  );
  const routeEffect = contestPage.match(
    /useEffect\(\(\) => \{\s*onHeaderSubtitle\(""\);[\s\S]*?\}, \[mode, editId\]\);/,
  )?.[0];
  const save = contestPage.match(
    /async function save\(event\) \{[\s\S]*?\n  \}/,
  )?.[0];

  assert.ok(routeEffect, "contest route effect exists");
  assert.match(
    routeEffect,
    /mode === "addContest" && !editId\) setForm\(emptyContest\)/,
  );
  assert.ok(save, "contest save handler exists");
  assert.match(
    save,
    /if \(editId\) \{\s*setForm\(emptyContest\);[\s\S]*?Contest updated successfully/,
  );
});
