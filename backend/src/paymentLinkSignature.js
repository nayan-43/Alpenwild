import crypto from "node:crypto";

export function paymentLinkSignature(bookingId, type, amount, jwtSecret) {
  if (!jwtSecret)
    throw new Error("JWT_SECRET must be configured to create payment links.");
  const signedAmount = type === "define_admin" ? Number(amount).toFixed(2) : "";
  return crypto
    .createHmac("sha256", jwtSecret)
    .update(`${bookingId}:${type}:${signedAmount}`)
    .digest("hex");
}
