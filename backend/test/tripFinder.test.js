import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { filterTripsForFinder } from "../../frontend/src/lib/tripFinder.js";

const baseTrip = {
  status: "Active",
  location_id: 4,
  activity_ids: [8],
  dates: [{ start_date: "2026-05-20", end_date: "2026-07-15" }],
};

test("public header uses the PHP header section structure and classes", async () => {
  const php = await readFile(
    new URL("../../../header.php", import.meta.url),
    "utf8",
  );
  const header = await readFile(
    new URL(
      "../../frontend/src/components/public/PublicHeader.jsx",
      import.meta.url,
    ),
    "utf8",
  );
  const hasClasses = (source, attribute, classNames) =>
    classNames.split(/\s+/).every((className) =>
      new RegExp(`${attribute}="[^"]*\\b${className}\\b[^"]*"`).test(source),
    );

  for (const className of [
    "header clearfix visible-xs visible-sm",
    "header_top hidden-xs hidden-sm",
    "navbar-header",
    "header_right",
    "header_right_top",
    "header_top_nav",
    "header_right_phone",
    "header_right_search",
    "navwrap",
  ]) {
    assert.ok(
      hasClasses(php, "class", className),
      `PHP uses ${className}`,
    );
    assert.ok(
      hasClasses(header, "className", className),
      `React includes the PHP ${className} structure`,
    );
  }
  assert.match(php, /<header id="header" class="fixed">/);
  assert.match(
    header,
    /<header\s+id="header"\s+className=\{`fixed client-header/,
  );
  assert.match(php, /<div class="container">[\s\S]*?<div class="navbar"/);
  assert.match(
    header,
    /className="header_top hidden-xs hidden-sm"[\s\S]*?className="container"[\s\S]*?className="navbar client-header-main"/,
  );
  assert.match(php, /<div class="navwrap hidden-xs hidden-sm">[\s\S]*?<div id='mainnav'>/);
  assert.match(
    header,
    /className="navwrap"[\s\S]*?className="container"[\s\S]*?id="mainnav"/,
  );
  assert.match(header, /<ul\s+className=\{`client-nav/);
  assert.match(
    header,
    /<li\s+className=\{`client-nav-item[\s\S]*?<ul\s+className=\{`client-dropdown/,
  );
});

test("public nav submenus align to their parent and do not underline on hover", async () => {
  const header = await readFile(
    new URL(
      "../../frontend/src/components/public/PublicHeader.jsx",
      import.meta.url,
    ),
    "utf8",
  );
  const styles = await readFile(
    new URL("../../frontend/src/public.css", import.meta.url),
    "utf8",
  );
  const nestedPositioning = header.match(
    /const positionNestedDropdown = \(event\) => \{[\s\S]*?\n  \};/,
  )?.[0];

  assert.ok(nestedPositioning, "nested submenu positioning handler exists");
  assert.match(nestedPositioning, /dropdown\.style\.left = `\$\{left\}px`/);
  assert.match(nestedPositioning, /Math\.min\(itemRect\.top, window\.innerHeight - height - gap\)/);
  assert.match(nestedPositioning, /dropdown\.style\.top = `\$\{top\}px`/);
  assert.match(styles, /\.client-dropdown-nested\s*\{\s*position:\s*fixed;/);
  assert.match(styles, /\.client-nav-item:hover,\s*\.public-site #header #mainnav \.client-nav-item\.open\s*\{\s*z-index:\s*10001;/);
  assert.match(styles, /\.client-dropdown-nested\s*\{\s*position:\s*fixed;\s*z-index:\s*10002;/);
  assert.match(styles, /\.client-nav a\s*\{[^}]*text-decoration:\s*none;/);
  assert.match(styles, /\.client-nav a:hover\s*\{[^}]*text-decoration:\s*none;/);
  assert.match(styles, /\.public-site #header #mainnav \.client-nav a:active \{[\s\S]*?text-decoration:\s*none !important;/);
});

test("trip finder criteria follow the PHP result query", async () => {
  const php = await readFile(
    new URL("../../../trip_search.php", import.meta.url),
    "utf8",
  );

  assert.match(
    php,
    /tt\.trips_status='Active' and tdt\.trips_id=tt\.trips_id and tat\.trips_id=tt\.trips_id/,
  );
  assert.match(php, /DATE_FORMAT\(tdt\.trips_start_date,'%m-%d'\)<='/);
  assert.match(php, /DATE_FORMAT\(tdt\.trips_end_date,'%m-%d'\)>='/);
  assert.match(php, /order by tdt\.trips_start_date asc/);
});

test("finder all options use PHP labels and blank query values", async () => {
  const header = await readFile(
    new URL(
      "../../frontend/src/components/public/PublicHeader.jsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(header, /allSelected\s*\?\s*allLabel/);
  assert.match(
    header,
    /allSelected\s*&&\s*<input type="hidden" name=\{name\} value="" \/>/,
  );
  assert.match(header, /values\.getAll\("trips_location_id\[\]"\)\.forEach/);
  assert.match(header, /values\.getAll\("activity_id\[\]"\)\.forEach/);
  assert.match(
    header,
    /const \[finderSelections, setFinderSelections\] = useState/,
  );
  assert.match(header, /const \[finderMonth, setFinderMonth\] = useState/);
  assert.match(header, /useSearchParams/);
  assert.match(
    header,
    /\.getAll\("trips_location_id\[\]"\)[\s\S]*?\.filter\(\(value\) => value !== ""\)/,
  );
  assert.match(
    header,
    /\.getAll\("activity_id\[\]"\)[\s\S]*?\.filter\(\(value\) => value !== ""\)/,
  );
  assert.match(header, /searchParams\.get\("trips_month"\) \|\| ""/);
  assert.match(
    header,
    /searchParams\.getAll\("trips_location_id\[\]"\)\.includes\(""\)/,
  );
  assert.match(
    header,
    /searchParams\.getAll\("activity_id\[\]"\)\.includes\(""\)/,
  );
  const multiSelect = header.match(
    /function FinderMultiSelect\([\s\S]*?\n\}\n\nfunction NavItem/,
  )?.[0];
  assert.ok(multiSelect, "finder multi-select component exists");
  assert.match(
    multiSelect,
    /if \(!wrapperRef\.current\?\.contains\(event\.target\)\) setOpen\(false\)/,
  );
  const toggleSelection = multiSelect.match(
    /const toggle = \(value\) => \{[\s\S]*?\n  \};/,
  )?.[0];
  assert.ok(toggleSelection, "finder selection toggle exists");
  assert.doesNotMatch(toggleSelection, /setOpen/);
});

test("trip finder results use the PHP trip card structure and classes", async () => {
  const php = await readFile(
    new URL("../../../trip_search.php", import.meta.url),
    "utf8",
  );
  const page = await readFile(
    new URL("../../frontend/src/pages/PublicSearchPage.jsx", import.meta.url),
    "utf8",
  );

  for (const className of [
    "col-xs-12 title",
    "col-md-3 col-sm-4 col-xs-6 types gridCol",
    "trip_type clearfix",
    "trip_img",
    "trip_info",
  ]) {
    assert.ok(php.includes(`class="${className}"`), `PHP uses ${className}`);
    assert.ok(
      page.includes(`className="${className}"`),
      `React uses ${className}`,
    );
  }
  assert.match(php, /class="section"/);
  assert.match(page, /className="section client-section client-trip-listing"/);
  assert.match(php, /class="container"/);
  assert.match(page, /className="container client-container"/);
  assert.match(php, /class="row"/);
  assert.match(page, /className="row"/);
  assert.match(page, /<h2>\{trip\.name\}<\/h2>/);
  assert.match(page, /<span className="date">/);
});

test("trip finder requires an active trip with at least one date and activity", () => {
  const results = filterTripsForFinder([
    { ...baseTrip, id: 1 },
    { ...baseTrip, id: 2, status: "Inactive" },
    { ...baseTrip, id: 3, activity_ids: [] },
    { ...baseTrip, id: 4, dates: [] },
  ]);

  assert.deepEqual(
    results.map((trip) => trip.id),
    [1],
  );
});

test("trip finder matches selected location and any selected activity", () => {
  const results = filterTripsForFinder(
    [
      { ...baseTrip, id: 1 },
      { ...baseTrip, id: 2, location_id: 5 },
      { ...baseTrip, id: 3, activity_ids: [9] },
    ],
    { locationIds: ["4"], activityIds: ["8", "9"] },
  );

  assert.deepEqual(
    results.map((trip) => trip.id),
    [1, 3],
  );
});

test("blank all-option values leave location and activity filters unrestricted", () => {
  const results = filterTripsForFinder(
    [
      { ...baseTrip, id: 1 },
      { ...baseTrip, id: 2, location_id: 5, activity_ids: [9] },
    ],
    { locationIds: [""], activityIds: [""] },
  );

  assert.deepEqual(
    results.map((trip) => trip.id),
    [1, 2],
  );
});

test("trip finder uses PHP full-month date boundaries rather than any overlap", () => {
  const results = filterTripsForFinder(
    [
      { ...baseTrip, id: 1 },
      {
        ...baseTrip,
        id: 2,
        dates: [{ start_date: "2026-05-20", end_date: "2026-06-30" }],
      },
      {
        ...baseTrip,
        id: 3,
        dates: [{ start_date: "2026-06-02", end_date: "2026-08-15" }],
      },
    ],
    { month: "06" },
  );

  assert.deepEqual(
    results.map((trip) => trip.id),
    [1],
  );
});

test("trip finder sorts by the start date of the matching departure", () => {
  const results = filterTripsForFinder([
    {
      ...baseTrip,
      id: 1,
      dates: [{ start_date: "2026-09-01", end_date: "2026-09-15" }],
    },
    {
      ...baseTrip,
      id: 2,
      dates: [{ start_date: "2026-06-01", end_date: "2026-06-15" }],
    },
    {
      ...baseTrip,
      id: 3,
      dates: [{ start_date: "2026-07-01", end_date: "2026-07-15" }],
    },
  ]);

  assert.deepEqual(
    results.map((trip) => trip.id),
    [2, 3, 1],
  );
});
