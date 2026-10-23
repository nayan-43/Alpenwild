import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createBookingConfirmationHtml,
  createPaymentConfirmationHtml,
  createRefundConfirmationHtml,
  createTripBookingAdminNotificationHtml,
  createTripBookingInvoicePdf,
} from "../src/tripBookingEmail.js";

test("booking confirmation uses the PHP greeting and database template body", () => {
  assert.equal(
    createBookingConfirmationHtml("<Customer>", "<p>Deposit received.</p>"),
    "Dear &lt;Customer&gt;,<br><p>Deposit received.</p>",
  );
});

test("payment confirmation matches the PHP greeting and signature", () => {
  assert.equal(
    createPaymentConfirmationHtml(
      "<Customer>",
      "<p>Your payment was received.</p>",
    ),
    `Dear &lt;Customer&gt;,<br>
<p>Your payment was received.</p>
<p>Regards,<br><br>
Alpenwild<br>
801-226-9026<br>
<a href="https://www.alpenwild.com">www.alpenwild.com</a></p>`,
  );
});

test("refund confirmation matches PHP content and escapes dynamic values", () => {
  assert.equal(
    createRefundConfirmationHtml({
      firstName: "<Guest>",
      bookingId: 123,
      amount: 50,
      transactionId: "<txn>",
    }),
    `Dear &lt;Guest&gt;,<br>
Your refund of $50.00 against Booking #123 has been processed.<br>
Transaction ID: &lt;txn&gt;.<br>
We've attached an updated invoice for your records.<br>
If you have any questions, reply to this email and we'll be happy to help.
<p>Regards,<br><br>
Alpenwild<br>
801-226-9026<br>
<a href="https://www.alpenwild.com">www.alpenwild.com</a></p>`,
  );
});

test("trip reservation staff notification matches PHP subject content and escapes booking data", () => {
  const html = createTripBookingAdminNotificationHtml({
    tripName: "<Alpine Trek>",
    tripStartDate: "2026-10-16",
    tripEndDate: "2026-10-25",
    firstName: "Ava",
    lastName: "Hiker",
    email: "ava@example.com",
    preferredName: "",
    gender: "Female",
    dateOfBirth: "1990-01-02",
    mobilePhone: "8015550100",
    streetAddress: "10 Alpine Way",
    streetAddress1: "",
    city: "Sandy",
    state: "UT",
    postalCode: "84070",
    country: "US",
    shippingStreetAddress: "20 Summit Road",
    shippingStreetAddress1: "",
    shippingCity: "Sandy",
    shippingState: "UT",
    shippingPostalCode: "84070",
    shippingCountry: "US",
    partyNumber: 2,
    additionalTravelers: [
      {
        first_name: "Sam",
        last_name: "<Hiker>",
        preferred_name: "",
        email_address: "sam@example.com",
        mobile_phone: "8015550101",
        gender: "",
        date_of_birth: "1992-03-04",
      },
    ],
    paymentDate: new Date(2026, 9, 16),
    roomingPreference: "Double occupancy",
    bedPreference: "Two beds",
    physicalMedicalConditions: "",
    dietaryRestrictions: "",
    specialDietaryRequirements: "Vegetarian",
    specialComments: "",
    flightArrivalDetails: "",
    flightDepartureDetails: "",
    tripTotal: 2000,
    singleSupplement: 0,
    paymentAmount: 500,
    paymentDue: 1500,
    paymentStatus: "Paid",
    transactionId: "TX-123",
  });

  assert.match(
    html,
    /Someone has booked a trip[\s\S]*?href="http:\/\/www\.alpenwild\.com\/trip\/admin\/trips_booking_manage\.php">View Booking/,
  );
  assert.match(html, /Trip Name: &lt;Alpine Trek&gt;/);
  assert.match(html, /Trip Start Date: October 16,2026 - October 25,2026/);
  assert.match(html, /Party Number: 1<br>\s*Additional Client Details:/);
  assert.match(html, /&lt;Hiker&gt;/);
  assert.match(html, /Total Payment: \$2000/);
  assert.match(html, /Excluding Single Supplement of \$0/);
  assert.match(html, /Deposit Amount: \$500 on October 16,2026/);
  assert.match(html, /Payment Due: \$1500/);
  assert.match(html, /Transaction ID : TX-123/);
  assert.match(
    html,
    /PAX\/Room[\s\S]*?Number of Beds[\s\S]*?Medical\/Dietary Info/,
  );
  assert.match(html, /State Country/);
  assert.doesNotMatch(html, /Payment Received|Booking #123|Shipping Name/);
  assert.doesNotMatch(html, /<Alpine Trek>|<Hiker>/);
});

const invoiceDetails = {
  bookingId: 25505,
  bookingDate: "2026-10-06",
  tripName: "Crete Sea to Summit",
  tripStartDate: "2027-05-04",
  tripEndDate: "2027-05-13",
  dueDate: "2027-01-04",
  firstName: "Test",
  lastName: "Customer",
  streetAddress: "123 Test Street",
  streetAddress1: "",
  city: "Salt Lake City",
  state: "UT",
  postalCode: "84101",
  country: "UNITED STATES",
  phone: "8015550134",
  email: "customer@example.com",
  partyNumber: 1,
  tripTotal: 4895,
  singleSupplement: 300,
  paymentAmount: 500,
  totalDue: 4820,
  additionalItems: [
    {
      description: "Early booking discount",
      price: 100,
      quantity: 1,
      sign: "-",
    },
    { description: "Extra night", price: 250, quantity: 2, sign: "+" },
  ],
  refundItems: [{ description: "Refund", price: 75, sign: "-" }],
};

test("booking invoice attachment is a generated PDF with PHP invoice rows", async () => {
  const invoice = await createTripBookingInvoicePdf(invoiceDetails);
  const php = await readFile(
    new URL(
      "../../../administrator/add_trip_booking_step2.php",
      import.meta.url,
    ),
    "utf8",
  );
  const generator = await readFile(
    new URL("../src/tripBookingEmail.js", import.meta.url),
    "utf8",
  );

  assert.ok(Buffer.isBuffer(invoice));
  assert.match(invoice.toString("latin1", 0, 8), /^%PDF-/);
  assert.match(php, /width="40%"/);
  assert.match(php, /width="20%"/);
  assert.match(php, /font-size: 16px;">Billing From/);
  assert.match(php, /border-bottom: 3px solid #1B3147/);
  assert.match(
    php,
    /date\("M dS, Y", strtotime\(\$payment_price_last_array\['payment_date'\]\)\)/,
  );
  assert.match(php, /Terms and Conditions page<\/a>/);
  assert.match(php, /Activity/);
  assert.match(php, /Single Supplement/);
  assert.match(php, /TOTAL DUE/);
  for (const heading of ["ACTIVITY", "QTY", "RATE", "AMOUNT"]) {
    assert.ok(generator.includes(`"${heading}"`));
  }
  assert.match(generator, /columnWidths\[0\] \+ columnWidths\[1\]/);
  assert.match(generator, /Number\(item\.price\) \* quantity/);
  assert.match(generator, /summary: true/);
  assert.match(generator, /size: "A4"/);
  assert.match(generator, /function formatPaymentDate\(value\)/);
  assert.match(
    generator,
    /Payment on \$\{formatPaymentDate\(payment\.date\)\}/,
  );
  assert.match(generator, /minimumFractionDigits: 2/);
  assert.match(generator, /underline: true/);
  assert.match(
    generator,
    /link: "https:\/\/www\.alpenwild\.com\/staticpage\/terms-conditions"/,
  );
});

test("payment receipt invoice includes the paid payment history", async () => {
  const invoice = await createTripBookingInvoicePdf({
    ...invoiceDetails,
    paymentHistory: [
      { date: "2026-10-06", amount: 500 },
      { date: "2026-10-07", amount: 500 },
    ],
  });

  assert.ok(Buffer.isBuffer(invoice));
  assert.match(invoice.toString("latin1", 0, 8), /^%PDF-/);
  assert.match(
    invoice.toString("latin1"),
    /\/MediaBox \[0 0 595\.28 841\.89\]/,
  );
});
