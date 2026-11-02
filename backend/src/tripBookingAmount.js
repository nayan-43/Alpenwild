import { z } from "zod";

export const tripBookingAmount = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const text = value.trim();
  const numberTextPattern = /^[+-]?((\d{1,3}(,\d{3})*)|\d+)?(\.\d+)?$/;
  return numberTextPattern.test(text) ? text.replaceAll(",", "") : text;
}, z.coerce.number().finite().min(0));
