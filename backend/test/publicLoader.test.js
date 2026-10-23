import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("public pages show the shared uploads loader while initial data loads", async () => {
  const pages = [
    "PublicSite",
    "PublicTripTypePage",
    "PublicTripPage",
    "PublicTourCalendarPage",
    "PublicStaticPage",
    "PublicCategoryPage",
    "PublicTripLeaderListingPage",
    "PublicTripLeaderPage",
    "PublicTripBookingPage",
    "PublicSearchPage",
    "PublicProductPage",
    "PublicCartPage",
    "PublicUserRegistrationPage",
    "PublicCheckoutPage",
    "PublicCheckoutConfirmPage",
    "PublicNotFoundPage",
    "PublicContestPage",
  ];

  await access(new URL("../../uploads/bx_loader.gif", import.meta.url));

  for (const page of pages) {
    const source = await readFile(
      new URL(`../../frontend/src/pages/${page}.jsx`, import.meta.url),
      "utf8",
    );
    assert.match(
      source,
      /import PublicLoader from "@\/components\/public\/PublicLoader"/,
    );
    assert.match(source, /<PublicLoader \/>/);
  }

  const loader = await readFile(
    new URL(
      "../../frontend/src/components/public/PublicLoader.jsx",
      import.meta.url,
    ),
    "utf8",
  );
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
  assert.match(loader, /src="\/uploads\/bx_loader\.gif"/);
  assert.match(loader, /role="status"/);
  assert.match(
    header,
    /navigationState\.status === "loading" && <PublicLoader \/>/,
  );
  assert.match(styles, /\.public-loading-overlay\s*\{[^}]*position:\s*fixed/s);
});
