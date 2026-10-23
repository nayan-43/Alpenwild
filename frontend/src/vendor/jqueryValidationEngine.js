import jquery from "jquery";

window.jQuery = jquery;
window.$ = jquery;

jquery.trim ??= (value) => (value == null ? "" : String(value).trim());
jquery.fn.size ??= function size() {
  return this.length;
};

await import("./jquery.validationEngine.min.js");
await import("./jquery.validationEngine-en.js");

export default jquery;
