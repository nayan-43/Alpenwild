export function calculatePublicBookingAmounts({
  tripPrice,
  singleSupplement,
  depositPerPerson,
  partyNumber,
  discountAmount,
}) {
  const initialBookingAmount = tripPrice * partyNumber;
  const singleSupplementBookingAmount = singleSupplement;
  const total = initialBookingAmount + singleSupplementBookingAmount;
  const requestedDeposit =
    depositPerPerson > 0 ? depositPerPerson * partyNumber : total;
  const paymentAmount = Math.min(
    requestedDeposit,
    Math.max(0, total - discountAmount),
  );

  return {
    initial_booking_amount: initialBookingAmount,
    single_supplement_booking_amount: singleSupplementBookingAmount,
    deposit_amount: paymentAmount,
    payment_amount: paymentAmount,
  };
}
