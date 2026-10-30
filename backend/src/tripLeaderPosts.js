import mysql from "mysql2/promise";

const sources = [
  {
    key: "alpsHiking",
    postsTable: "NYy_posts",
    usersTable: "NYy_users",
    metaTable: "NYy_postmeta",
    path: "Alpshiking",
    publicBase: "https://alpshiking.swisshikingvacations.com/",
  },
  {
    key: "switzerlandTravel",
    postsTable: "vtf_posts",
    usersTable: "vtf_users",
    metaTable: "vtf_postmeta",
    path: "Switzerlandtravel",
    publicBase: "https://switzerlandtravel.swisshikingvacations.com/",
  },
  {
    key: "mySwissKitchen",
    postsTable: "tBa_posts",
    usersTable: "tBa_users",
    metaTable: "tBa_postmeta",
    path: "myswisskitchen",
    publicBase: "https://myswisskitchen.swisshikingvacations.com/",
  },
];

function legacyBlogUrl(value, source) {
  const original = String(value || "").trim();
  if (!original) return "";
  const prefix = `https://www.alpenwild.com/${source.path}/`;
  if (original.startsWith(prefix)) {
    return `${source.publicBase}${original.slice(prefix.length)}`;
  }
  return original;
}

export function createTripLeaderPostsService(
  settings,
  createPool = mysql.createPool,
) {
  let pools;
  const configured = Boolean(settings.host && settings.user);

  return {
    isConfigured() {
      return configured;
    },

    async load(authorIds) {
      if (!configured) {
        return Object.fromEntries(sources.map(({ key }) => [key, []]));
      }

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
        sources.map(async (source) => {
          const authorId = Number(authorIds[source.key] || 0);
          const limit = authorId ? 10 : 5;
          const authorFilter = authorId ? "AND post_author = ?" : "";
          const [rows] = await pools[source.key].query(
            `SELECT ID AS id, post_title AS title, guid, post_date AS post_date
             FROM \`${source.postsTable}\`
             WHERE post_status='publish' AND post_type='post' ${authorFilter}
             ORDER BY post_date DESC LIMIT ?`,
            authorId ? [authorId, limit] : [limit],
          );
          const posts = await Promise.all(
            rows.map(async (post) => {
              const [metaRows] = await pools[source.key].query(
                `SELECT p.guid AS image_url
                 FROM \`${source.metaTable}\` m
                 JOIN \`${source.postsTable}\` p ON p.ID = m.meta_value
                 WHERE m.post_id=? AND m.meta_key='_thumbnail_id'
                   AND p.post_type='attachment'
                 LIMIT 1`,
                [post.id],
              );
              let authorDetails = "";
              if (authorId) {
                const [userRows] = await pools[source.key].query(
                  `SELECT user_nicename AS name
                   FROM \`${source.usersTable}\` WHERE ID=? LIMIT 1`,
                  [authorId],
                );
                authorDetails = userRows[0]?.name
                  ? `Post by ${userRows[0].name}`
                  : "";
              }
              return {
                ...post,
                url: legacyBlogUrl(post.guid, source),
                author_details: authorDetails,
                image_url: legacyBlogUrl(metaRows[0]?.image_url, source),
                path: source.path,
              };
            }),
          );
          return [source.key, posts];
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
