import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("location actions show PHP-matching alerts and scroll to the top", async () => {
  const phpLocation = await readFile(
    new URL("../../../administrator/add_location.php", import.meta.url),
    "utf8",
  );
  const phpLocationClass = await readFile(
    new URL("../../../includes/classes/location_class.php", import.meta.url),
    "utf8",
  );
  const adminApp = await readFile(
    new URL("../../frontend/src/pages/AdminApp.jsx", import.meta.url),
    "utf8",
  );
  const save = adminApp.match(
    /async function saveLocation\(event\) \{[\s\S]*?\n  \}/,
  )?.[0];
  const scrollHelper = adminApp.match(
    /function scrollAdminListToTop\(\) \{[\s\S]*?\n  \}/,
  )?.[0];
  const navigate = adminApp.match(
    /function navigate\(pageName, path = pathForAdminPage\(pageName\)\) \{[\s\S]*?\n  \}/,
  )?.[0];
  const toggle = adminApp.match(
    /async function toggleLocation\(item\) \{[\s\S]*?\n  \}/,
  )?.[0];
  const remove = adminApp.match(
    /async function removeLocation\(item\) \{[\s\S]*?\n  \}/,
  )?.[0];

  assert.ok(save, "location save handler exists");
  assert.match(
    phpLocation,
    /"Location added successfully\. Please enter another\.",\s*"Sorry, nothing is added\."/,
  );
  assert.match(
    phpLocation,
    /"Location updated successfully\.",\s*"Sorry, nothing is updated\."/,
  );
  assert.match(
    save,
    /wasEditing\s*\?\s*"Location updated successfully\."\s*:\s*"Location added successfully\. Please enter another\."/,
  );
  assert.ok(toggle, "location status handler exists");
  assert.match(
    phpLocationClass,
    /messagedisplay\('Location\\'s Status is updated successfully', 1\)/,
  );
  assert.match(
    toggle,
    /setNotice\("Location's Status is updated successfully"\)/,
  );
  assert.ok(remove, "location delete handler exists");
  assert.match(
    phpLocationClass,
    /messagedisplay\('Location details deleted successfully', 1\)/,
  );
  assert.match(remove, /setNotice\("Location details deleted successfully"\)/);

  assert.ok(scrollHelper, "location scroll helper exists");
  assert.match(
    scrollHelper,
    /window\.requestAnimationFrame\(\(\) => \{\s*window\.scrollTo\(\{ top: 0, left: 0, behavior: "smooth" \}\)/,
  );
  assert.ok(navigate, "admin navigation handler exists");
  assert.match(
    navigate,
    /setPageState\(pageName\);\s*window\.scrollTo\(\{ top: 0, left: 0, behavior: "auto" \}\)/,
  );
  const historyChange = adminApp.match(
    /function handleHistoryChange\(\) \{[\s\S]*?\n    \}/,
  )?.[0];
  assert.ok(historyChange, "browser history handler exists");
  assert.match(
    historyChange,
    /setPageState\(route\.page\);\s*window\.scrollTo\(\{ top: 0, left: 0, behavior: "auto" \}\)/,
  );
  assert.match(
    toggle,
    /await load\(\);[\s\S]*?setNotice\("Location's Status is updated successfully"\);[\s\S]*?scrollAdminListToTop\(\)/,
  );
  assert.match(
    remove,
    /await load\(\);[\s\S]*?setNotice\("Location details deleted successfully"\);[\s\S]*?scrollAdminListToTop\(\)/,
  );
});

test("activity actions show PHP-matching alerts and scroll to the top", async () => {
  const phpActivity = await readFile(
    new URL("../../../administrator/add_activity.php", import.meta.url),
    "utf8",
  );
  const phpActivityClass = await readFile(
    new URL("../../../includes/classes/activity_class.php", import.meta.url),
    "utf8",
  );
  const adminApp = await readFile(
    new URL("../../frontend/src/pages/AdminApp.jsx", import.meta.url),
    "utf8",
  );
  const save = adminApp.match(
    /async function saveActivity\(event\) \{[\s\S]*?\n  \}/,
  )?.[0];
  const toggle = adminApp.match(
    /async function toggleActivity\(item\) \{[\s\S]*?\n  \}/,
  )?.[0];
  const remove = adminApp.match(
    /async function removeActivity\(item\) \{[\s\S]*?\n  \}/,
  )?.[0];
  const navigate = adminApp.match(
    /function navigate\(pageName, path = pathForAdminPage\(pageName\)\) \{[\s\S]*?\n  \}/,
  )?.[0];

  assert.ok(save, "activity save handler exists");
  assert.match(
    phpActivity,
    /"Activity added successfully\. Please enter another\.",\s*"Sorry, nothing is added\."/,
  );
  assert.match(
    phpActivity,
    /"Activity updated successfully\.",\s*"Sorry, nothing is updated\."/,
  );
  assert.match(
    save,
    /wasEditing\s*\?\s*"Activity updated successfully\."\s*:\s*"Activity added successfully\. Please enter another\."/,
  );
  assert.ok(toggle, "activity status handler exists");
  assert.match(
    phpActivityClass,
    /messagedisplay\('Activity\\'s Status is updated successfully', 1\)/,
  );
  assert.match(
    toggle,
    /setNotice\("Activity's Status is updated successfully"\)/,
  );
  assert.ok(remove, "activity delete handler exists");
  assert.match(
    phpActivityClass,
    /messagedisplay\('Activity details deleted successfully', 1\)/,
  );
  assert.match(remove, /setNotice\("Activity details deleted successfully"\)/);
  assert.match(
    navigate,
    /setPageState\(pageName\);\s*window\.scrollTo\(\{ top: 0, left: 0, behavior: "auto" \}\)/,
  );
  assert.match(
    toggle,
    /await load\(\);[\s\S]*?setNotice\("Activity's Status is updated successfully"\);[\s\S]*?scrollAdminListToTop\(\)/,
  );
  assert.match(
    remove,
    /await load\(\);[\s\S]*?setNotice\("Activity details deleted successfully"\);[\s\S]*?scrollAdminListToTop\(\)/,
  );
});
