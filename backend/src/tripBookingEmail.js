import PDFDocument from "pdfkit";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function invoiceDate(value) {
  const dateText =
    value instanceof Date
      ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`
      : String(value ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return "";
  const date = new Date(`${dateText}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  return date;
}

function formatInvoiceDate(value) {
  const date = invoiceDate(value);
  if (!date) return "";
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = new Intl.DateTimeFormat("en-US", {
    month: "long",
    timeZone: "UTC",
  }).format(date);
  return `${day} ${month} ${date.getUTCFullYear()}`;
}

function formatTripDateRange(startValue, endValue) {
  const start = invoiceDate(startValue);
  const end = invoiceDate(endValue);
  if (!start || !end) return "";
  const monthAndDay = (date) =>
    new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    }).format(date);
  return `${monthAndDay(start)} - ${monthAndDay(end)}, ${end.getUTCFullYear()}`;
}

function formatPhpTripDate(value) {
  const date = invoiceDate(value);
  if (!date) return "";
  const month = new Intl.DateTimeFormat("en-US", {
    month: "long",
    timeZone: "UTC",
  }).format(date);
  return `${month} ${date.getUTCDate()},${date.getUTCFullYear()}`;
}

function formatPaymentDate(value) {
  const date = invoiceDate(value);
  if (!date) return "";
  const day = date.getUTCDate();
  const ordinal =
    day % 100 >= 11 && day % 100 <= 13
      ? "th"
      : { 1: "st", 2: "nd", 3: "rd" }[day % 10] || "th";
  const month = new Intl.DateTimeFormat("en-US", {
    month: "short",
    timeZone: "UTC",
  }).format(date);
  return `${month} ${String(day).padStart(2, "0")}${ordinal}, ${date.getUTCFullYear()}`;
}

function currency(value) {
  return `$${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function createBookingConfirmationHtml(firstName, templateMessage) {
  return `Dear ${escapeHtml(firstName)},<br>${templateMessage}`;
}

export function createTripBookingAdminNotificationHtml({
  tripName,
  tripStartDate,
  tripEndDate,
  firstName,
  lastName,
  email,
  preferredName,
  gender,
  dateOfBirth,
  mobilePhone,
  streetAddress,
  streetAddress1,
  city,
  state,
  postalCode,
  country,
  shippingStreetAddress,
  shippingStreetAddress1,
  shippingCity,
  shippingState,
  shippingPostalCode,
  shippingCountry,
  partyNumber,
  additionalTravelers = [],
  paymentDate,
  roomingPreference,
  bedPreference,
  physicalMedicalConditions,
  dietaryRestrictions,
  specialDietaryRequirements,
  specialComments,
  flightArrivalDetails,
  flightDepartureDetails,
  tripTotal,
  singleSupplement,
  paymentAmount,
  paymentDue,
  paymentStatus,
  transactionId,
}) {
  const text = (value) => escapeHtml(value ?? "");
  const address = (street, street1, cityName, stateName, zip, countryName) =>
    `${text([street, street1].filter(Boolean).join(" "))}<br>${text(`${cityName || ""} ${stateName || ""}, ${zip || ""}`)}<br>${text(countryName)}`;
  const primaryRoomCount =
    {
      "Single occupancy": 1,
      "Double occupancy": 2,
      "Triple occupancy": 3,
    }[roomingPreference] ?? "";
  const additionalClientDetails = additionalTravelers
    .map(
      (traveler) =>
        `Name: ${text(traveler.first_name)} ${text(traveler.last_name)}<br>Prefered Name: ${text(traveler.preferred_name)}<br>Mobile Phone: ${text(traveler.mobile_phone)}<br>Email Address: ${text(traveler.email_address)}<br>Gender: ${text(traveler.gender)}<br>Date Of Birth: ${text(traveler.date_of_birth)}<br><br>`,
    )
    .join("");
  const tableCell = (value) => `<td align="left" valign="middle">${value}</td>`;
  const primaryTravelerRow = `<tr>${tableCell(text(lastName))}${tableCell(text(firstName))}${tableCell(text(primaryRoomCount))}${tableCell(text(roomingPreference))}${tableCell(text(bedPreference))}${tableCell(text(dateOfBirth))}${tableCell(address(streetAddress, streetAddress1, city, state, postalCode, country))}${tableCell(text(state))}${tableCell(text(mobilePhone))}${tableCell(text(email))}${tableCell(`${text(physicalMedicalConditions)}<br>${text(dietaryRestrictions)}<br>${text(specialDietaryRequirements)}`)}</tr>`;
  const additionalTravelerRows = additionalTravelers
    .map(
      (traveler) =>
        `<tr>${tableCell(text(traveler.last_name))}${tableCell(text(traveler.first_name))}${tableCell("")}${tableCell("")}${tableCell("")}${tableCell(text(traveler.date_of_birth))}${tableCell("")}${tableCell("")}${tableCell(text(traveler.mobile_phone))}${tableCell(text(traveler.email_address))}${tableCell("")}</tr>`,
    )
    .join("");
  const bookingTable = `<table width="100%" border="1" cellspacing="0" cellpadding="0">
<tr>
<td width="50" align="left" valign="middle"><strong>Last Name</strong></td>
<td width="50" align="left" valign="middle"><strong>First Name (Passport Name)</strong></td>
<td width="50" align="left" valign="middle"><strong>PAX/Room</strong></td>
<td width="70" align="left" valign="middle"><strong>Rooming</strong></td>
<td width="70" align="left" valign="middle"><strong>Number of Beds</strong></td>
<td width="70" align="left" valign="middle"><strong>DOB (mm/dd/yyyy)</strong></td>
<td width="70" align="left" valign="middle"><strong>Address</strong></td>
<td width="70" align="left" valign="middle"><strong>State Country</strong></td>
<td width="70" align="left" valign="middle"><strong>Phone #</strong></td>
<td width="70" align="left" valign="middle"><strong>Email</strong></td>
<td width="70" align="left" valign="middle"><strong>Medical/Dietary Info</strong></td>
</tr>${primaryTravelerRow}${additionalTravelerRows}</table>`;
  const formattedTripDates = [
    formatPhpTripDate(tripStartDate),
    formatPhpTripDate(tripEndDate),
  ]
    .filter(Boolean)
    .join(" - ");
  const depositAmount = paymentAmount
    ? `$${text(paymentAmount)} on ${text(formatPhpTripDate(paymentDate))}<br>`
    : "";

  return `Dear Admin,<br>
<p>Someone has booked a trip. You can view the details from the following link:<a href="http://www.alpenwild.com/trip/admin/trips_booking_manage.php">View Booking</a>.</p>
<p>Some of the booking details are:<br>
<h1>Trip Details:</h1>
Trip Name: ${text(tripName)}<br>
Trip Start Date: ${text(formattedTripDates)}<br>
<h1>User Details</h1>
User Name: ${text(`${firstName || ""} ${lastName || ""}`.trim())}<br>
User Email Address: ${text(email)}<br>
Prefered Name: ${text(preferredName)}<br>
Gender: ${text(gender)}<br>
Date Of Birth: ${text(dateOfBirth)}<br>
Mobile Phone: ${text(mobilePhone)}<br>
Billing Address: ${address(streetAddress, streetAddress1, city, state, postalCode, country)}<br>
Shipping Address: ${address(shippingStreetAddress, shippingStreetAddress1, shippingCity, shippingState, shippingPostalCode, shippingCountry)}<br>
<h1>Additional User Information</h1>
Party Number: ${text(Number(partyNumber) - 1)}<br>
Additional Client Details: ${additionalClientDetails}<br>
<h1>Additional Information</h1>
Rooming Preference: ${text(roomingPreference)}<br>
Bedding Preference: ${text(bedPreference)}<br>
Physical Or medical Conditions: ${text(physicalMedicalConditions)}<br>
Dietary Restrictions And Allergies: ${text(dietaryRestrictions)}<br>
Dietary Requests: ${text(specialDietaryRequirements)}<br>
Special Comments &amp; Questions: ${text(specialComments)}<br>
Flight Arrival Details: ${text(flightArrivalDetails)}<br>
Flight Departure Details: ${text(flightDepartureDetails)}<br>
<h1>Payment Details</h1>
Total Payment: $${text(tripTotal)}<br>Excluding Single Supplement of $${text(singleSupplement)}<br>
Deposit Amount: ${depositAmount}<br>
Payment Due: $${text(paymentDue)}<br>
Payment Status: ${text(paymentStatus)}<br>
<h1>Card Details</h1>
Transaction ID : ${text(transactionId)}</p>
${bookingTable}
<p>Best Regards</p>
<p>Alpenwild <br>
Website: http://www.alpenwild.com/<br>
Email: info@alpenwild.com</p>`;
}

export function createPaymentConfirmationHtml(firstName, templateMessage) {
  return `Dear ${escapeHtml(firstName)},<br>
${templateMessage}
<p>Regards,<br><br>
Alpenwild<br>
801-226-9026<br>
<a href="https://www.alpenwild.com">www.alpenwild.com</a></p>`;
}

export function createRefundConfirmationHtml({
  firstName,
  bookingId,
  amount,
  transactionId,
}) {
  return `Dear ${escapeHtml(firstName || "Guest")},<br>
Your refund of ${currency(amount)} against Booking #${escapeHtml(bookingId)} has been processed.<br>
Transaction ID: ${escapeHtml(transactionId)}.<br>
We've attached an updated invoice for your records.<br>
If you have any questions, reply to this email and we'll be happy to help.
<p>Regards,<br><br>
Alpenwild<br>
801-226-9026<br>
<a href="https://www.alpenwild.com">www.alpenwild.com</a></p>`;
}

export async function createTripBookingInvoicePdf({
  bookingId,
  bookingDate,
  tripName,
  tripStartDate,
  tripEndDate,
  dueDate,
  firstName,
  lastName,
  streetAddress,
  streetAddress1,
  city,
  state,
  postalCode,
  country,
  phone,
  email,
  partyNumber,
  tripTotal,
  singleSupplement,
  additionalItems = [],
  refundItems = [],
  paymentAmount,
  totalDue,
  paymentHistory = [],
}) {
  return new Promise((resolve, reject) => {
    const margin = 42.52;
    const topMargin = 76.54;
    const contentWidth = 510.24;
    const navy = "#1b3147";
    const gray = "#efefef";
    const sectionRuleWidth = 2.25;
    const document = new PDFDocument({
      size: "A4",
      margins: { top: topMargin, bottom: 70.87, left: margin, right: margin },
      bufferPages: true,
    });
    const chunks = [];
    document.on("data", (chunk) => chunks.push(chunk));
    document.once("error", reject);
    document.once("end", () => resolve(Buffer.concat(chunks)));

    const logoPath = fileURLToPath(
      new URL("../../uploads/logo.png", import.meta.url),
    );
    if (existsSync(logoPath)) {
      document.image(logoPath, margin + 7.5, topMargin + 7.5, { width: 140 });
    } else {
      document
        .fillColor(navy)
        .font("Helvetica-Bold")
        .fontSize(22)
        .text("Alpenwild", margin + 7.5, topMargin + 7.5);
    }

    const metadataX = margin + contentWidth * 0.75;
    const metadataWidth = contentWidth * 0.25;
    const metadata = [
      ["Invoice:", String(bookingId)],
      ["Date:", formatInvoiceDate(bookingDate)],
      ["Trip Date:", formatTripDateRange(tripStartDate, tripEndDate)],
      ["Due Date:", formatInvoiceDate(dueDate)],
    ];
    let metadataY = topMargin + 6;
    for (const [label, value] of metadata) {
      document
        .fillColor(navy)
        .font("Helvetica")
        .fontSize(10.5)
        .text(label.toUpperCase(), metadataX, metadataY, {
          width: 66,
        });
      const valueY = metadataY;
      document
        .fillColor("#000000")
        .fontSize(10.5)
        .text(value, metadataX + 68, valueY, {
          width: metadataWidth - 68,
        });
      const labelHeight = document.heightOfString(label.toUpperCase(), {
        width: 66,
        font: "Helvetica",
        fontSize: 10.5,
      });
      const valueHeight = document.heightOfString(value, {
        width: metadataWidth - 68,
        font: "Helvetica",
        fontSize: 10.5,
      });
      metadataY += Math.max(labelHeight, valueHeight) + 2;
    }

    const billingTop = topMargin + 110;
    const billingWidths = [
      contentWidth * 0.45,
      contentWidth * 0.1,
      contentWidth * 0.45,
    ];
    const billingLabels = ["Billing From", "", "Billing To"];
    let billingX = margin;
    for (let index = 0; index < billingWidths.length; index += 1) {
      const cellWidth = billingWidths[index];
      if (billingLabels[index]) {
        document
          .fillColor(navy)
          .font("Helvetica")
          .fontSize(12)
          .text(
            billingLabels[index].toUpperCase(),
            billingX + 10,
            billingTop + 10,
            {
              width: cellWidth - 20,
            },
          );
        document
          .moveTo(billingX, billingTop + 38)
          .lineTo(billingX + cellWidth, billingTop + 38)
          .lineWidth(sectionRuleWidth)
          .stroke(navy);
      }
      billingX += cellWidth;
    }

    const billingFrom =
      "Alpenwild\n1245 S. Eagle Nest Dr.\nWoodland Hills, UT 84653-5528\nPhone: 801-226-9026\nEmail: payments@alpenwild.com\nwww.alpenwild.com";
    const billingTo = [
      "BILL TO",
      `${firstName} ${lastName}`.trim(),
      `${streetAddress || ""} ${streetAddress1 || ""}`.trim(),
      `${city || ""}, ${state || ""},`.trim(),
      `${postalCode || ""} ${country || ""}`.trim(),
      `Phone: ${phone || ""}`,
      `Email: ${email || ""}`,
    ].join("\n");
    const drawBillingBlock = (lines, x, width, y, boldLines = []) => {
      let lineY = y;
      lines.forEach((line, index) => {
        const font = boldLines.includes(index) ? "Helvetica-Bold" : "Helvetica";
        document
          .fillColor("#000000")
          .font(font)
          .fontSize(10.5)
          .text(line, x, lineY, { width, lineGap: 4.5 });
        lineY +=
          document.heightOfString(line, {
            width,
            font,
            fontSize: 10.5,
            lineGap: 4.5,
          }) + 1;
      });
    };
    drawBillingBlock(
      billingFrom.split("\n"),
      margin + 10,
      billingWidths[0] - 20,
      billingTop + 50,
      [0],
    );
    drawBillingBlock(
      billingTo.split("\n"),
      margin + billingWidths[0] + billingWidths[1] + 10,
      billingWidths[2] - 20,
      billingTop + 50,
      [0],
    );

    const tableX = margin;
    const columnWidths = [
      contentWidth * 0.4,
      contentWidth * 0.2,
      contentWidth * 0.2,
      contentWidth * 0.2,
    ];
    const columns = [
      tableX,
      tableX + columnWidths[0],
      tableX + columnWidths[0] + columnWidths[1],
      tableX + columnWidths[0] + columnWidths[1] + columnWidths[2],
    ];
    const drawTableRow = (cells, options = {}) => {
      const {
        header = false,
        summary = false,
        bold = false,
        boldColumns = [],
      } = options;
      const cellTexts = [
        cells[0] ?? "",
        cells[1] ?? "",
        cells[2] ?? "",
        cells[3] ?? "",
      ];
      const fontSize = header ? 12 : 10.5;
      const padding = 7.5;
      const heights = cellTexts.map((text, index) =>
        document.heightOfString(String(text), {
          width: columnWidths[index] - 2 * padding,
          font:
            bold || boldColumns.includes(index)
              ? "Helvetica-Bold"
              : "Helvetica",
          fontSize,
        }),
      );
      const rowHeight = Math.max(
        32,
        ...heights.map((height) => height + 2 * padding),
      );
      const y = document.y;
      if (y + rowHeight > document.page.height - document.page.margins.bottom)
        document.addPage();
      const rowY = document.y;

      if (summary) {
        const summaryWidth = columnWidths[0] + columnWidths[1];
        document
          .rect(tableX, rowY, summaryWidth, rowHeight)
          .fillAndStroke("#ffffff", "#ffffff");
        for (let index = 2; index < 4; index += 1) {
          const cellX = columns[index];
          const cellWidth = columnWidths[index];
          document
            .rect(cellX, rowY, cellWidth, rowHeight)
            .lineWidth(0.75)
            .fillAndStroke(gray, "#ffffff");
          document
            .fillColor("#000000")
            .font(bold ? "Helvetica-Bold" : "Helvetica")
            .fontSize(10.5)
            .text(
              String(cellTexts[index] ?? ""),
              cellX + padding,
              rowY + padding,
              {
                width: cellWidth - 2 * padding,
                align: index === 2 ? "left" : "center",
                lineGap: 1,
              },
            );
        }
      } else {
        for (let index = 0; index < 4; index += 1) {
          const cellX = columns[index];
          const cellWidth = columnWidths[index];
          document
            .rect(cellX, rowY, cellWidth, rowHeight)
            .lineWidth(0.75)
            .fillAndStroke(header ? "#ffffff" : gray, "#ffffff");
          document
            .fillColor("#000000")
            .font(
              bold || boldColumns.includes(index)
                ? "Helvetica-Bold"
                : "Helvetica",
            )
            .fontSize(fontSize)
            .text(
              String(cellTexts[index] ?? ""),
              cellX + padding,
              rowY + padding,
              {
                width: cellWidth - 2 * padding,
                align: index === 0 ? "left" : "center",
                lineGap: 1,
              },
            );
        }
      }
      if (header)
        document
          .moveTo(tableX, rowY + rowHeight)
          .lineTo(tableX + contentWidth, rowY + rowHeight)
          .lineWidth(sectionRuleWidth)
          .stroke(navy);
      document.y = rowY + rowHeight;
    };

    document.y = billingTop + 185;
    drawTableRow(["ACTIVITY", "QTY", "RATE", "AMOUNT"], { header: true });
    const safePartyNumber = Math.max(1, Number(partyNumber) || 1);
    drawTableRow(
      [
        String(tripName || "Trip").toUpperCase(),
        String(safePartyNumber),
        currency(Number(tripTotal) / safePartyNumber),
        currency(tripTotal),
      ],
      { boldColumns: [0] },
    );
    for (const item of additionalItems) {
      const quantity = Math.max(1, Number(item.quantity) || 1);
      const sign = item.sign === "-" ? "-" : "+";
      drawTableRow(
        [
          String(item.description || "").toUpperCase(),
          String(quantity),
          `${sign} ${currency(item.price)}`,
          `${sign} ${currency(Number(item.price) * quantity)}`,
        ],
        { boldColumns: [0] },
      );
    }
    if (Number(singleSupplement) > 0)
      drawTableRow(
        [
          "SINGLE SUPPLEMENT",
          "1",
          currency(singleSupplement),
          currency(singleSupplement),
        ],
        { boldColumns: [0] },
      );

    const payments = paymentHistory.length
      ? paymentHistory
      : Number(paymentAmount || 0) > 0
        ? [{ date: bookingDate, amount: paymentAmount }]
        : [];
    for (const payment of payments)
      drawTableRow(
        [
          "",
          "",
          `Payment on ${formatPaymentDate(payment.date)}`,
          currency(payment.amount),
        ],
        { summary: true, bold: true },
      );
    for (const refund of refundItems)
      drawTableRow(
        [
          "",
          "",
          refund.description || "Refund",
          `${refund.sign === "+" ? "+" : "-"} ${currency(refund.price)}`,
        ],
        {
          summary: true,
          bold: true,
        },
      );
    drawTableRow(["", "", "TOTAL DUE", currency(totalDue)], {
      summary: true,
      bold: true,
    });

    document.y += 37.5;
    document
      .fillColor("#000000")
      .font("Helvetica")
      .fontSize(10.5)
      .text(
        "All bookings are subject to our Terms and Conditions. To view our full policies regarding payments and cancellations, please visit our ",
        tableX + 10,
        document.y,
        { width: contentWidth - 20, continued: true },
      )
      .fillColor("#0000ee")
      .text("Terms and Conditions page", {
        continued: true,
        underline: true,
        link: "https://www.alpenwild.com/staticpage/terms-conditions",
      })
      .fillColor("#000000")
      .text(".");
    document.end();
  });
}
