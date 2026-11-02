import { Router } from "express";
import { z } from "zod";

export function createShopCustomersRouter({
  query,
  userSchema,
  useLegacyUsers,
  userInsert,
  userSelectById,
}) {
  const router = Router();

  router.post("/api/public/shop-customer/register", async (req, res, next) => {
    try {
      const data = userSchema.parse(req.body);
      const duplicate = useLegacyUsers()
        ? await query(
            "SELECT user_id FROM alpenwild_user_tbl WHERE LOWER(user_email_address)=LOWER($1) LIMIT 1",
            [data.user_email_address],
          )
        : await query(
            "SELECT id FROM users WHERE LOWER(email_address)=LOWER($1) LIMIT 1",
            [data.user_email_address],
          );
      if (duplicate.rowCount)
        return res.status(409).json({
          message:
            "Sorry, email is already added. Please use another email address.",
        });
      const inserted = await userInsert(data);
      const result = await query(userSelectById(), [inserted.rows[0].id]);
      res.status(201).json({ user: result.rows[0] });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/public/shop-customer", async (req, res, next) => {
    try {
      const { user_email_address: email } = z
        .object({
          user_email_address: z.string().trim().email().max(255),
        })
        .parse(req.body);
      const result = await query(
        `SELECT user_first_name, user_last_name, user_street_address,
              user_street_address1, user_city, user_state, user_postal_code,
              user_country, user_day_phone, user_mobile_phone,
              user_email_address, user_shipping_email_address,
              user_shipping_first_name, user_shipping_last_name,
              user_shipping_street_address, user_shipping_street_address1,
              user_shipping_city, user_shipping_state,
              user_shipping_postal_code, user_shipping_country
         FROM alpenwild_user_tbl
        WHERE LOWER(user_email_address)=LOWER($1)
        ORDER BY user_id
        LIMIT 1`,
        [email],
      );
      const user = result.rows[0];
      if (!user)
        return res.status(404).json({
          code: "ACCOUNT_NOT_FOUND",
          message:
            "No account was found for this email address. Please register first.",
        });
      res.json({
        customer: {
          first_name: user.user_first_name || "",
          last_name: user.user_last_name || "",
          street_address: user.user_street_address || "",
          street_address1: user.user_street_address1 || "",
          city: user.user_city || "",
          state: user.user_state || "",
          postal_code: user.user_postal_code || "",
          country: user.user_country || "",
          email: user.user_email_address || "",
          phone: user.user_mobile_phone || user.user_day_phone || "",
        },
        shipping: {
          first_name: user.user_shipping_first_name || "",
          last_name: user.user_shipping_last_name || "",
          street_address: user.user_shipping_street_address || "",
          street_address1: user.user_shipping_street_address1 || "",
          city: user.user_shipping_city || "",
          state: user.user_shipping_state || "",
          postal_code: user.user_shipping_postal_code || "",
          country: user.user_shipping_country || "",
          email:
            user.user_shipping_email_address || user.user_email_address || "",
          phone: user.user_mobile_phone || user.user_day_phone || "",
        },
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
