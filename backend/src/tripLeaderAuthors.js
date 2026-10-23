import mysql from "mysql2/promise";

const sources = [
  { key: "alpsHiking", table: "NYy_users" },
  { key: "switzerlandTravel", table: "vtf_users" },
  { key: "mySwissKitchen", table: "tBa_users" },
];

export function createTripLeaderAuthorsService(
  settings,
  createPool = mysql.createPool,
) {
  let pools;
  const hasConnectionSettings = [
    settings.host,
    settings.user,
    settings.password,
  ].some(Boolean);
  const configured = Boolean(settings.host && settings.user);

  return {
    isConfigured() {
      return configured;
    },

    isPartiallyConfigured() {
      return hasConnectionSettings && !configured;
    },

    async load() {
      if (!configured)
        throw new Error("Trip-leader author database settings are incomplete.");

      pools ??= Object.fromEntries(
        sources.map(({ key }) => [
          key,
          createPool({
            host: settings.host,
            port: settings.port,
            user: settings.user,
            password: settings.password,
            database: settings.databases[key],
            waitForConnections: true,
            connectionLimit: 2,
            queueLimit: 10,
            connectTimeout: 10000,
            ...(settings.ssl ? { ssl: { rejectUnauthorized: true } } : {}),
          }),
        ]),
      );

      const results = await Promise.all(
        sources.map(async ({ key, table }) => {
          const [rows] = await pools[key].query(
            `SELECT ID AS id, user_nicename AS name FROM \`${table}\``,
          );
          return [
            key,
            rows.map(({ id, name }) => ({
              id: String(id),
              name: String(name ?? ""),
            })),
          ];
        }),
      );
      return Object.fromEntries(results);
    },

    async close() {
      if (!pools) return;
      await Promise.all(Object.values(pools).map((pool) => pool.end()));
      pools = undefined;
    },
  };
}
