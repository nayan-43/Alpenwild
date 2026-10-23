export function calculateShopTotals(items, discount) {
  const subtotalCents = items.reduce(
    (total, item) =>
      total + Math.round(Number(item.price) * 100) * Number(item.quantity),
    0,
  );
  const requestedDiscountCents =
    discount?.type === "Fixed"
      ? Math.round(Number(discount.value) * 100)
      : discount?.type === "Percentage"
        ? Math.round((subtotalCents * Number(discount.value)) / 100)
        : 0;
  const discountCents = Math.min(
    subtotalCents,
    Math.max(0, requestedDiscountCents),
  );
  const shippingCents = subtotalCents - discountCents > 5000 ? 0 : 500;
  return {
    subtotal: subtotalCents / 100,
    discount: discountCents / 100,
    shipping: shippingCents / 100,
    total: (subtotalCents - discountCents + shippingCents) / 100,
  };
}
