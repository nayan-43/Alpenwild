import assert from "node:assert/strict";
import test from "node:test";

test("reCAPTCHA can be disabled through VITE_ENABLE_RECAPTCHA", async () => {
  const originalSetting = process.env.VITE_ENABLE_RECAPTCHA;
  try {
    process.env.VITE_ENABLE_RECAPTCHA = "false";
    const disabled = await import("../src/config.js?captcha-disabled");
    assert.equal(disabled.config.recaptchaEnabled, false);

    process.env.VITE_ENABLE_RECAPTCHA = "true";
    const enabled = await import("../src/config.js?captcha-enabled");
    assert.equal(enabled.config.recaptchaEnabled, true);
  } finally {
    if (originalSetting === undefined) {
      delete process.env.VITE_ENABLE_RECAPTCHA;
    } else {
      process.env.VITE_ENABLE_RECAPTCHA = originalSetting;
    }
  }
});
