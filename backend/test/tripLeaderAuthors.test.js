import assert from "node:assert/strict";
import test from "node:test";
import { createTripLeaderAuthorsService } from "../src/tripLeaderAuthors.js";

const settings = {
  host: "mysql.example.test",
  port: 3306,
  user: "read_only",
  password: "secret",
  ssl: true,
  databases: {
    alpsHiking: "alpenwi1_alpshiking",
    switzerlandTravel: "alpenwi1_switzerlandtravel",
    mySwissKitchen: "alpenwi1_myswisskitchennew",
  },
};

test("disabled trip-leader author sources do not create MySQL pools", async () => {
  let poolCreated = false;
  const service = createTripLeaderAuthorsService(
    { ...settings, host: "", user: "", password: "" },
    () => {
      poolCreated = true;
    },
  );

  assert.equal(service.isConfigured(), false);
  assert.equal(service.isPartiallyConfigured(), false);
  await assert.rejects(service.load(), /settings are incomplete/);
  assert.equal(poolCreated, false);
});

test("a blank local MySQL password is allowed when host and user are configured", async () => {
  const poolConfigs = [];
  const service = createTripLeaderAuthorsService(
    { ...settings, host: "localhost", user: "root", password: "" },
    (poolConfig) => {
      poolConfigs.push(poolConfig);
      return {
        async query() {
          return [[], []];
        },
        async end() {},
      };
    },
  );

  assert.equal(service.isConfigured(), true);
  assert.equal(service.isPartiallyConfigured(), false);
  await service.load();
  assert.equal(poolConfigs.length, 3);
  assert.equal(poolConfigs[0].password, "");
});

test("incomplete host or user settings are detected", () => {
  const service = createTripLeaderAuthorsService(
    { ...settings, host: "localhost", user: "", password: "" },
    () => {
      throw new Error("Pool must not be created for partial settings.");
    },
  );

  assert.equal(service.isConfigured(), false);
  assert.equal(service.isPartiallyConfigured(), true);
});

test("author loader queries the three configured WordPress user tables", async () => {
  const poolConfigs = [];
  const queries = [];
  const service = createTripLeaderAuthorsService(settings, (poolConfig) => {
    poolConfigs.push(poolConfig);
    const index = poolConfigs.length;
    return {
      async query(sql) {
        queries.push({ database: poolConfig.database, sql });
        return [
          [
            {
              id: index,
              name: `Author ${index}`,
            },
          ],
        ];
      },
      async end() {},
    };
  });

  const authors = await service.load();

  assert.deepEqual(
    poolConfigs.map(({ database }) => database),
    [
      "alpenwi1_alpshiking",
      "alpenwi1_switzerlandtravel",
      "alpenwi1_myswisskitchennew",
    ],
  );
  assert.deepEqual(
    queries.map(({ sql }) => sql),
    [
      "SELECT ID AS id, user_nicename AS name FROM `NYy_users`",
      "SELECT ID AS id, user_nicename AS name FROM `vtf_users`",
      "SELECT ID AS id, user_nicename AS name FROM `tBa_users`",
    ],
  );
  assert.equal(poolConfigs[0].ssl.rejectUnauthorized, true);
  assert.deepEqual(authors, {
    alpsHiking: [{ id: "1", name: "Author 1" }],
    switzerlandTravel: [{ id: "2", name: "Author 2" }],
    mySwissKitchen: [{ id: "3", name: "Author 3" }],
  });
});
