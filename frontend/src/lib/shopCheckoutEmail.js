const checkoutEmailKey = "shop_checkout_email";

export function saveShopCheckoutEmail(email) {
  if (email) window.sessionStorage.setItem(checkoutEmailKey, email);
}

export function readShopCheckoutEmail() {
  return window.sessionStorage.getItem(checkoutEmailKey) || "";
}

export function clearShopCheckoutEmail() {
  window.sessionStorage.removeItem(checkoutEmailKey);
}
