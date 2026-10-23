export async function copyTextToClipboard(text) {
  if (globalThis.navigator?.clipboard?.writeText) {
    try {
      await globalThis.navigator.clipboard.writeText(text);
      return;
    } catch {
      if (!globalThis.document) throw new Error("Clipboard access was denied.");
    }
  }

  if (!globalThis.document) {
    throw new Error("Clipboard access is unavailable in this environment.");
  }

  const input = globalThis.document.createElement("textarea");
  input.value = text;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  globalThis.document.body.appendChild(input);
  input.select();
  input.setSelectionRange(0, input.value.length);

  try {
    if (!globalThis.document.execCommand("copy")) {
      throw new Error("The browser could not copy the text to the clipboard.");
    }
  } finally {
    input.remove();
  }
}
