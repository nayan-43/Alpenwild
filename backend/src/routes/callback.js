import { Router } from "express";
import { z } from "zod";
import { buildCallMeBackEmailHtml } from "../callMeBackEmail.js";

const callbackSchema = z.object({
  name: z.string().trim().min(1).max(255),
  email: z.string().trim().email().max(255),
  phone_number: z.string().trim().min(1).max(100),
  best_time: z.string().trim().min(1).max(255),
  question_comments: z.string().trim().min(1).max(5000),
  customer_name: z.string().max(255).default(""),
  recaptcha_token: z.string().max(5000).default(""),
});

export function createCallbackRouter({
  config,
  mailer,
  verifyRecaptcha,
  getSiteTitle,
}) {
  const router = Router();

  router.post("/api/public/callback", async (req, res, next) => {
    try {
      const data = callbackSchema.parse(req.body);
      if (data.customer_name)
        return res
          .status(400)
          .json({ message: "Unable to process this request." });
      if (config.recaptchaEnabled && !config.recaptchaSecret)
        return res
          .status(503)
          .json({ message: "Callback requests are not configured." });
      if (
        config.recaptchaEnabled &&
        !(await verifyRecaptcha(data.recaptcha_token))
      )
        return res
          .status(400)
          .json({ message: "Robot verification failed, please try again." });
      if (!mailer)
        return res
          .status(503)
          .json({ message: "Callback requests are not configured." });
      const siteTitle = await getSiteTitle();
      await mailer.sendMail({
        from: {
          name: siteTitle,
          address: config.smtpFrom || config.smtpUser,
        },
        to: config.callbackRecipientEmail,
        replyTo: data.email,
        subject: `${siteTitle} Call Me Back`,
        html: buildCallMeBackEmailHtml(data),
      });
      res
        .status(200)
        .json({ message: "Thank you. We will call you back soon." });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
