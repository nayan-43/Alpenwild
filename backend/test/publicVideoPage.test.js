import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPublicVideoGroups,
  youtubeVideoId,
} from "../../frontend/src/lib/publicVideos.js";

test("public video gallery groups active static-page videos by ordered trip type and trip", () => {
  const groups = buildPublicVideoGroups(
    [
      { id: 2, name: "Later", display_order: 1, status: "Active" },
      { id: 1, name: "Earlier", display_order: 2, status: "Active" },
      { id: 3, name: "Inactive", display_order: 3, status: "Inactive" },
    ],
    [
      {
        id: 11,
        name: "Second Trip",
        type_id: 1,
        display_order: 2,
        status: "Active",
      },
      {
        id: 10,
        name: "First Trip",
        type_id: 1,
        display_order: 1,
        status: "Active",
      },
      {
        id: 12,
        name: "Inactive Trip",
        type_id: 1,
        display_order: 3,
        status: "Inactive",
      },
    ],
    [
      {
        id: 101,
        trip_id: 10,
        display_order: 2,
        video_url: "https://youtu.be/abcdefghijk",
        display_in_static_page: true,
        status: "Active",
      },
      {
        id: 100,
        trip_id: 10,
        display_order: 1,
        video_url: "https://www.youtube.com/watch?v=lmnopqrstuv",
        display_in_static_page: "1",
        status: "Active",
      },
      {
        id: 102,
        trip_id: 10,
        video_url: "https://youtu.be/wxyzabcdefg",
        display_in_static_page: false,
        status: "Active",
      },
      {
        id: 103,
        trip_id: 10,
        video_url: "https://youtu.be/12345678901",
        display_in_static_page: true,
        status: "Inactive",
      },
      {
        id: 104,
        trip_id: 11,
        video_url: "https://youtu.be/abcdefghijk",
        display_in_static_page: true,
        status: "Active",
      },
    ],
  );

  assert.deepEqual(
    groups.map(({ name, trips }) => [
      name,
      trips.map(({ name: tripName, videos }) => [
        tripName,
        videos.map((video) => video.id),
      ]),
    ]),
    [
      ["Later", []],
      ["Earlier", [["First Trip", [100, 101]], ["Second Trip", [104]]]],
    ],
  );
});

test("YouTube video ID parser supports common YouTube URL forms only", () => {
  assert.equal(youtubeVideoId("https://youtu.be/abcdefghijk"), "abcdefghijk");
  assert.equal(
    youtubeVideoId("https://www.youtube.com/watch?v=lmnopqrstuv"),
    "lmnopqrstuv",
  );
  assert.equal(
    youtubeVideoId("https://youtube.com/embed/wxyzabcdefg"),
    "wxyzabcdefg",
  );
  assert.equal(youtubeVideoId("https://youtube.com.evil.test/watch?v=abc"), "");
  assert.equal(youtubeVideoId("not a URL"), "");
});
