# Trip leader WordPress author sources

The trip-leader form can load author names and IDs from the three existing
WordPress MySQL databases. The Node backend makes the database connections;
the React browser never receives MySQL credentials.

## Sources

| Site                | Database                     | Table       |
| ------------------- | ---------------------------- | ----------- |
| Alps Hiking         | `alpenwi1_alpshiking`        | `NYy_users` |
| Switzerland Travel  | `alpenwi1_switzerlandtravel` | `vtf_users` |
| My Swisskitchen New | `alpenwi1_myswisskitchennew` | `tBa_users` |

The backend selects only each WordPress user's `ID` and `user_nicename`. These
IDs are saved in the existing PostgreSQL trip-leader author fields.

## Enable on Bluehost

1. Confirm the Node backend is running on a Bluehost plan/environment that
   supports persistent Node.js applications and can connect to the MySQL
   databases. If MySQL is on another host, ask Bluehost to allowlist the
   backend host.
2. In Bluehost, verify the exact MySQL host value, port, and account permitted
   to read the three databases. Prefer one dedicated MySQL account with
   `SELECT` permission only on the three WordPress `*_users` tables. Do not
   reuse a WordPress administrator password.
3. Set the following variables in the backend's production environment (or its
   private `.env` file, never in frontend variables or committed files):

   ```dotenv
   TRIP_LEADER_AUTHORS_MYSQL_HOST=your-bluehost-mysql-host
   TRIP_LEADER_AUTHORS_MYSQL_PORT=3306
   TRIP_LEADER_AUTHORS_MYSQL_USER=your-read-only-mysql-user
   TRIP_LEADER_AUTHORS_MYSQL_PASSWORD=your-secret-password
   TRIP_LEADER_AUTHORS_MYSQL_SSL=true
   TRIP_LEADER_AUTHORS_ALPS_HIKING_DB=alpenwi1_alpshiking
   TRIP_LEADER_AUTHORS_SWITZERLAND_TRAVEL_DB=alpenwi1_switzerlandtravel
   TRIP_LEADER_AUTHORS_MY_SWISSKITCHEN_DB=alpenwi1_myswisskitchennew
   ```

   Use the actual Bluehost host and SSL requirements. Set SSL to `false` only
   when the connection is local/trusted and Bluehost confirms TLS is not
   required. If Bluehost provides a custom CA certificate, configure the
   backend deployment with the provider's CA/trust instructions before enabling
   TLS.

4. Restart the backend after changing the environment. The MySQL pools are
   created lazily when an authenticated administrator opens the trip-leader
   form, so no WordPress connection is attempted while these settings are
   blank.
5. Open **Admin → Trip Leaders → Add** or edit a leader. Confirm all three
   searchable author selectors show author names. Save a test selection and
   verify the selected IDs persist when reopening the leader.

The API route is `GET /api/trip-leader-authors` and requires an admin session.
It connects to the three configured databases in parallel. Connection/query
failures return an error in the form with a retry action; they are not silently
treated as empty author lists.

## Current behavior before configuration

With the MySQL host, username, and password unset, the API reports that author
sources are disabled and does not open any MySQL connections. The form keeps
existing saved author IDs visible and allows the rest of the trip-leader form
to be used. If only some connection credentials are configured, the endpoint
returns a configuration error rather than attempting a partial setup.

## Troubleshooting

- **Connection refused/timeout:** confirm Bluehost permits Node-to-MySQL
  connections and that host/port are correct.
- **Access denied:** grant the backend MySQL account `SELECT` on the exact
  databases/tables and confirm the Bluehost account's database-user mapping.
- **Table not found:** check exact database/table letter casing; the table names
  are case-sensitive on some Linux-hosted MySQL installations.
- **TLS/certificate error:** check Bluehost's required SSL mode and CA setup;
  do not disable certificate verification to work around a production error.
