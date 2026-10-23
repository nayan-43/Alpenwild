import assert from "node:assert/strict";
import test from "node:test";
import { buildPublicNavigation } from "../src/publicNavigation.js";

test("builds the active PHP header hierarchy in display order", () => {
  const navigation = buildPublicNavigation([
    {
      id: 3,
      parent_id: 0,
      menu_name: "Second",
      slug: "second",
      display_as_page: "Yes",
      menu_assign: "Self In Header",
      display_order: 2,
      status: "Active",
    },
    {
      id: 7,
      parent_id: 0,
      menu_name: "Trips",
      slug: "trips",
      display_as_page: "No",
      menu_assign: "Self In Header",
      display_order: 1,
      status: "Active",
    },
    {
      id: 8,
      parent_id: 7,
      menu_name: "PHP placeholder",
      slug: "placeholder",
      display_as_page: "Yes",
      menu_assign: "Self In Header",
      display_order: 1,
      status: "Active",
    },
    {
      id: 9,
      parent_id: 3,
      menu_name: "Nested page",
      slug: "nested",
      display_as_page: "No",
      menu_assign: "Self In Header",
      display_order: 1,
      status: "Active",
    },
    {
      id: 10,
      parent_id: 0,
      menu_name: "Inactive",
      slug: "inactive",
      display_as_page: "Yes",
      menu_assign: "Self In Header",
      display_order: 0,
      status: "Inactive",
    },
    {
      id: 11,
      parent_id: 0,
      menu_name: "Footer only",
      slug: "footer",
      display_as_page: "Yes",
      menu_assign: "Self In Footer",
      display_order: 0,
      status: "Active",
    },
  ]);

  assert.deepEqual(
    navigation.map((item) => item.label),
    ["Trips", "Second"],
  );
  assert.equal(navigation[0].href, "#");
  assert.deepEqual(navigation[0].children, []);
  assert.equal(navigation[1].href, "/staticpage/second/");
  assert.equal(navigation[1].children[0].href, "#");
});

test("replaces page 7 children with active trip types and trips", () => {
  const navigation = buildPublicNavigation(
    [
      {
        id: 7,
        parent_id: 0,
        menu_name: "Trips",
        slug: "trips",
        display_as_page: "No",
        menu_assign: "Self In Header",
        display_order: 1,
        status: "Active",
      },
      {
        id: 8,
        parent_id: 7,
        menu_name: "PHP placeholder",
        slug: "placeholder",
        display_as_page: "Yes",
        menu_assign: "Self In Header",
        display_order: 1,
        status: "Active",
      },
    ],
    [
      {
        id: 2,
        menu_name: "Walking",
        slug: "walking",
        display_order: 2,
        status: "Active",
      },
      {
        id: 1,
        menu_name: "Hiking",
        slug: "hiking",
        display_order: 1,
        status: "Active",
      },
      {
        id: 3,
        menu_name: "Hidden type",
        slug: "hidden",
        display_order: 0,
        status: "Inactive",
      },
    ],
    [
      {
        id: 21,
        type_id: 1,
        menu_name: "Second trip",
        slug: "second",
        display_order: 2,
        status: "Active",
      },
      {
        id: 20,
        type_id: 1,
        menu_name: "First trip",
        slug: "first",
        display_order: 1,
        status: "Active",
      },
      {
        id: 22,
        type_id: 1,
        menu_name: "Inactive trip",
        slug: "inactive",
        display_order: 0,
        status: "Inactive",
      },
    ],
  );

  assert.deepEqual(
    navigation[0].children.map((item) => item.label),
    ["Hiking", "Walking"],
  );
  assert.deepEqual(
    navigation[0].children[0].children.map((item) => item.label),
    ["First trip", "Second trip"],
  );
  assert.equal(
    navigation[0].children[0].children[0].href,
    "/trip/first/overview/",
  );
});
