let pendingCheckoutDraft = null;

export function setShopCheckoutDraft(draft) {
  pendingCheckoutDraft = draft;
}

export function readShopCheckoutDraft() {
  return pendingCheckoutDraft;
}

export function clearShopCheckoutDraft() {
  pendingCheckoutDraft = null;
}
