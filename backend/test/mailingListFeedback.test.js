import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("mailing list save and delete feedback matches PHP and survives navigation", async () => {
  const phpForm = await readFile(
    new URL("../../../administrator/add_mailing_list.php", import.meta.url),
    "utf8",
  );
  const phpClass = await readFile(
    new URL(
      "../../../includes/classes/mailing_list_class.php",
      import.meta.url,
    ),
    "utf8",
  );
  const adminApp = await readFile(
    new URL("../../frontend/src/pages/AdminApp.jsx", import.meta.url),
    "utf8",
  );
  const save = adminApp.match(
    /async function saveMailingList\(event\) \{[\s\S]*?\n  \}/,
  )?.[0];
  const remove = adminApp.match(
    /async function removeMailingList\(item\) \{[\s\S]*?\n  \}/,
  )?.[0];

  assert.ok(save, "mailing list save handler exists");
  assert.match(
    phpForm,
    /"User added successfully\. Please enter another\.",\s*"Sorry, nothing is added\."/,
  );
  assert.match(
    phpForm,
    /"User updated successfully\.",\s*"Sorry, nothing is updated\."/,
  );
  assert.match(
    save,
    /navigate\("mailingList"\);\s*await load\(\);\s*setNotice\(\s*wasEditing\s*\?\s*"User updated successfully\."\s*:\s*"User added successfully\. Please enter another\."/,
  );
  assert.ok(remove, "mailing list delete handler exists");
  assert.match(
    phpClass,
    /messagedisplay\('User details deleted successfully', 1\)/,
  );
  assert.match(
    remove,
    /await load\(\);\s*setNotice\("User details deleted successfully"\)/,
  );
});
