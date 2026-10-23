const storageKey = "alpenwild-shop-cart";
const discountStorageKey = "alpenwild-shop-discount";

export function readShopCart() {
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function writeShopCart(items) {
  window.localStorage.setItem(storageKey, JSON.stringify(items));
}

export function clearShopCart() {
  window.localStorage.removeItem(storageKey);
  window.localStorage.removeItem(discountStorageKey);
}

export function readShopDiscount() {
  try {
    return JSON.parse(
      window.localStorage.getItem(discountStorageKey) || "null",
    );
  } catch {
    return null;
  }
}

export function writeShopDiscount(discount) {
  if (discount)
    window.localStorage.setItem(discountStorageKey, JSON.stringify(discount));
  else window.localStorage.removeItem(discountStorageKey);
}

export function getShopTotals(items, discount = null) {
  const subtotal = items.reduce(
    (total, item) =>
      total + Number(item.price || 0) * Number(item.quantity || 0),
    0,
  );
  const rawDiscount =
    discount?.type === "Fixed"
      ? Number(discount.value)
      : discount?.type === "Percentage"
        ? (subtotal * Number(discount.value)) / 100
        : 0;
  const discountAmount = Math.min(subtotal, Math.max(0, rawDiscount));
  const shipping = subtotal - discountAmount > 50 ? 0 : 5;
  return {
    subtotal,
    discount: discountAmount,
    shipping,
    total: subtotal - discountAmount + shipping,
  };
}
