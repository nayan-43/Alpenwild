# Alpenwild

This is the React + Node + PostgreSQL application for Alpenwild.

The structure is now split into `frontend` and `backend`:

- `frontend`: React public entry point and `/administrator` dashboard/banner section
- `backend`: Express API, PostgreSQL connection, uploads and migrations

## Current scope

- React admin shell matching the existing AdminLTE visual language
- Dashboard summary cards
- Banner list
- Add banner with image upload
- Active/inactive status toggle
- Delete banner
- PostgreSQL migration extends the existing `alpenwild_administrator_tbl` and creates application tables

## Run locally

1. Copy `.env.example` to `.env` and set `DATABASE_URL` to your PostgreSQL database. The API requires PostgreSQL and will not start without this setting.
2. Run `npm install` inside this folder.
3. Ensure the existing `alpenwild_*` tables and data are present in PostgreSQL.
4. Run `npm run db:migrate`.
5. Run `npm run dev`.
6. Open `http://localhost:5173` for the React public entry point or `http://localhost:5173/administrator` for administration.

The migration uses the existing administrator table and removes transitional non-prefixed duplicate tables; administrator authentication relies on the existing `administrator_password` field.

Public forms do not require administrator authentication. Set `VITE_ENABLE_RECAPTCHA=false` in `.env` to disable CAPTCHA on public forms; set it to `true` and provide `VITE_RECAPTCHA_SITE_KEY` (the public Google site key) and `RECAPTCHA_SECRET` (the private server-side key) to enable reCAPTCHA on every form and server-side verification. Change `VITE_RECAPTCHA_SITE_KEY` once to update the key used by all frontend CAPTCHA widgets. Restart the Vite development server or rebuild the frontend after changing Vite environment variables. SMTP settings (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM`) are required for callback email and admin password recovery. Callback email goes to `CALLBACK_RECIPIENT_EMAIL`; admin recovery sends a PHP-compatible generated password to the same recipients used by the PHP recovery page and updates only `administrator_password` using the PHP MD5 format. Public and admin images are served from the application's local `uploads` directory.

Successful public trip bookings use email template 6, attach a generated PDF invoice, and send only to the customer's submitted email address. Internal Alpenwild recipients remain disabled. On approved payment, the customer is redirected to the thank-you page with the PHP success alert: "Booking added successfully. Please enter another." Declined payments display the gateway message in the PHP-style red alert and remove the failed booking/payment records.

Make a Payment follows the PHP approval flow: an existing customer and active booking are required, payments must be at least $50 and cannot exceed the remaining balance, and a payment is recorded only after Authorize.Net approval. Approved payments update the booking balance and send the customer the matching partial-payment or paid-in-full email template with a PDF invoice, then redirect to the thank-you page. Declined payments are not retained. Internal Alpenwild recipients remain disabled for payment emails.

## Public shop, contests, and sitemap

- The public header menu is loaded from active static pages assigned to “Self In Header”, ordered by their configured display order. When the PHP trip-menu placeholder (static page ID `7`) has children, the API inserts active trip types and their active trips in the same order and with the PHP routes.
- The shop is available at `/category/:slug`, `/product/:slug`, `/cart`, and `/checkout`. The cart is kept in the visitor's browser. Checkout reloads product and option prices on the server, revalidates discount dates and selections, applies the PHP shipping rule, and charges with the existing backend-only Authorize.Net configuration (`AUTHORIZE_NET_LOGIN`, `AUTHORIZE_NET_TRANSACTION_KEY`, and `AUTHORIZE_NET_SANDBOX`). Like the PHP flow, it creates the order only after payment approval and never stores the card number, expiration, or CVV. Configure production gateway credentials and SMTP before accepting live orders.
- The public contest form, approved-entry gallery, and rules render on the static page with ID `3903`; contest rules are read from static page ID `3904`. Submissions are pending approval and accept at most 10 JPG/PNG/GIF images per entry. Configure `CONTEST_UPLOAD_SUBDIR`, `VITE_RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET`, and SMTP for production. The submission handler enforces each contest's active dates and configured image dimensions and maximum size.
- `/sitemap.xml` is generated dynamically from active static pages, trip types, and trips, plus the homepage and blog. It requires no scheduled job. Set `CLIENT_ORIGIN` to the canonical production site origin so sitemap URLs use the public hostname.
- `crondeleteunwantedfile.php` is intentionally not ported: it deletes files from served directories and writes PHP/Apache rules to those paths. Do not run it against the React deployment. Configure the production web server so uploaded/static files cannot execute PHP or other scripts instead.

## Scheduled jobs

The backend includes standalone scripts intended to be run by the production host's scheduler (not from React or as part of the API server):

- `npm run cron:payment-reminders` previews bookings eligible under the PHP rules. It sends nothing unless invoked with `npm run cron:payment-reminders -- --send`. Sending requires `Reminder_Email` to be `On`, SMTP settings, `JWT_SECRET`, and `CLIENT_ORIGIN` set to the deployed public React site URL. Like PHP, it sends a customer copy and a separate copy to the two internal recipients; it does not mark reminders as sent, so repeated runs on an eligible date send again. React payment links are signed and use the new payment page instead of PHP's legacy `paymetsnow.php` URLs.
- `npm run cron:cleanup-unsuccessful-bookings` previews the exact zero-payment and booking-ID-zero records targeted by the PHP cleanup. It deletes nothing unless invoked with `npm run cron:cleanup-unsuccessful-bookings -- --execute`. Review the preview before enabling it; it intentionally preserves the legacy PHP rule, which has no booking-age limit.

Use the hosting provider's scheduler to set the intended frequency and timezone after verifying the old site's actual cron configuration. The payment reminder uses PostgreSQL `CURRENT_DATE`, so configure the database session timezone to match the legacy PHP site's timezone. Run both commands manually in preview mode first and retain scheduler logs. The old `crondeleteunwantedfile.php` is not migrated; configure static-file restrictions in the deployed web server instead.
