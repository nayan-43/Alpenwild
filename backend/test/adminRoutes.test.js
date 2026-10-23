import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalAdminPath,
  pathForAdminPage,
  resolveAdminRoute,
} from "../../frontend/src/routes/adminRoutes.js";

test("admin routes use the PHP administrator path", () => {
  assert.equal(pathForAdminPage("dashboard"), "/administrator");
  assert.equal(pathForAdminPage("users"), "/administrator/users");
  assert.equal(
    canonicalAdminPath("/admin/users/42/edit"),
    "/administrator/users/42/edit",
  );
  assert.deepEqual(resolveAdminRoute("/administrator/users/42/edit"), {
    page: "addUser",
    module: "users",
    editPath: "/administrator/users/42/edit",
  });
});

test("legacy admin paths resolve to canonical administrator routes", () => {
  assert.deepEqual(resolveAdminRoute("/admin/users/42/edit"), {
    page: "addUser",
    module: "users",
    editPath: "/administrator/users/42/edit",
  });
});
