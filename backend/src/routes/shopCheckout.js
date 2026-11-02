import { Router } from "express";
import { z } from "zod";
import { calculateShopTotals } from "../shopCart.js";
import { buildShopOrderEmails } from "../shopOrderEmail.js";

export function createShopCheckoutRouter({
  query,
  pool,
  config,
  mailer,
  authorizeNetCharge,
  getSiteTitle,
  getAdminOrderReceivingEmail,
}) {
  const router = Router();
  router.post("/api/public/shop-checkout", async (req, res, next) => {
    try {
      const addressSchema = z.object({
        first_name: z.string().trim().min(1).max(255),
        last_name: z.string().trim().min(1).max(255),
        street_address: z.string().trim().min(1).max(255),
        street_address1: z.string().trim().max(255).default(""),
        city: z.string().trim().min(1).max(255),
        state: z.string().trim().min(1).max(255),
        postal_code: z.string().trim().min(1).max(255),
        country: z.string().trim().min(1).max(255),
        email: z.string().trim().email().max(255),
        phone: z.string().trim().min(1).max(255),
      });
      const data = z
        .object({
          customer: addressSchema,
          shipping: addressSchema,
          items: z
            .array(
              z.object({
                product_id: z.coerce.number().int().positive(),
                quantity: z.coerce.number().int().min(1).max(100),
                attributes: z
                  .array(
                    z.object({
                      type_id: z.coerce.number().int().positive(),
                      value_id: z.coerce.number().int().positive(),
                    }),
                  )
                  .max(20)
                  .default([]),
              }),
            )
            .min(1)
            .max(50),
          discount_code: z.string().trim().max(255).default(""),
          credit_card_number: z.string().regex(/^\d{14,25}$/),
          credit_card_expire_month: z.string().regex(/^(0[1-9]|1[0-2])$/),
          credit_card_expire_year: z.coerce
            .number()
            .int()
            .min(new Date().getFullYear())
            .max(new Date().getFullYear() + 20),
          credit_card_cvv_number: z.string().regex(/^\d{3,4}$/),
          agree: z.literal(true),
        })
        .parse(req.body);
      if (!config.authorizeNetLogin || !config.authorizeNetTransactionKey)
        return res
          .status(503)
          .json({ message: "Online shop payment is not configured." });

      const now = new Date();
      if (
        data.credit_card_expire_year === now.getFullYear() &&
        Number(data.credit_card_expire_month) < now.getMonth() + 1
      )
        return res
          .status(400)
          .json({ message: "The credit card has expired." });

      const lines = [];
      for (const item of data.items) {
        const productResult = await query(
          `SELECT product_id AS id, product_name AS name, product_price AS price,
                product_status AS status
           FROM alpenwild_product_tbl WHERE product_id=$1 LIMIT 1`,
          [item.product_id],
        );
        const product = productResult.rows[0];
        if (!product || product.status !== "Active")
          return res.status(400).json({
            message: "A product in your cart is no longer available.",
          });
        const available = await query(
          `SELECT pv.attribute_type_id AS type_id,
                pv.attribute_value_id AS value_id,
                t.attribute_type_name AS type_name,
                v.attribute_value AS value_name
           FROM alpenwild_product_attribute_value_tbl pv
           JOIN alpenwild_attribute_type_tbl t
             ON t.attribute_type_id=pv.attribute_type_id
           JOIN alpenwild_attribute_value_tbl v
             ON v.attribute_value_id=pv.attribute_value_id
          WHERE pv.product_id=$1
            AND COALESCE(pv.product_attribute_value_status,'Active')='Active'
            AND t.attribute_type_status='Active'
            AND v.attribute_value_status='Active'`,
          [item.product_id],
        );
        const expectedTypes = new Set(
          available.rows.map((attribute) => String(attribute.type_id)),
        );
        const suppliedByType = new Map(
          item.attributes.map((attribute) => [
            String(attribute.type_id),
            String(attribute.value_id),
          ]),
        );
        const allowedPairs = new Set(
          available.rows.map(
            (attribute) => `${attribute.type_id}:${attribute.value_id}`,
          ),
        );
        if (
          expectedTypes.size !== suppliedByType.size ||
          [...expectedTypes].some((typeId) => !suppliedByType.has(typeId)) ||
          item.attributes.some(
            (attribute) =>
              !allowedPairs.has(`${attribute.type_id}:${attribute.value_id}`),
          )
        )
          return res.status(400).json({
            message: `Please choose valid options for ${product.name}.`,
          });
        lines.push({
          product,
          quantity: item.quantity,
          attributes: item.attributes.map((attribute) => {
            const details = available.rows.find(
              (row) =>
                String(row.type_id) === String(attribute.type_id) &&
                String(row.value_id) === String(attribute.value_id),
            );
            return {
              ...attribute,
              type_name: details.type_name,
              value_name: details.value_name,
            };
          }),
        });
      }

      let discount = null;
      if (data.discount_code) {
        const discountResult = await query(
          `SELECT discount_type AS type, discount_value AS value
           FROM alpenwild_discount_tbl
          WHERE discount_code=$1 AND discount_status='Active'
            AND discount_start_date<=CURRENT_DATE
            AND discount_end_date>=CURRENT_DATE
          LIMIT 1`,
          [data.discount_code],
        );
        discount = discountResult.rows[0] || null;
        if (!discount)
          return res
            .status(400)
            .json({ message: "The discount code is invalid or expired." });
      }
      const totals = calculateShopTotals(
        lines.map(({ product, quantity }) => ({
          price: product.price,
          quantity,
        })),
        discount,
      );
      const existingCustomer = await query(
        `SELECT user_id FROM alpenwild_user_tbl
        WHERE LOWER(user_email_address)=LOWER($1)
        ORDER BY user_id LIMIT 1`,
        [data.customer.email],
      );
      const charge = await authorizeNetCharge({
        cardNumber: data.credit_card_number,
        expiration: `${data.credit_card_expire_month}${data.credit_card_expire_year}`,
        amount: totals.total,
        cvv: data.credit_card_cvv_number,
        invoice: `AW-${Date.now()}`,
        email: data.customer.email,
        firstName: data.customer.first_name,
        lastName: data.customer.last_name,
        address: data.customer.street_address,
        city: data.customer.city,
        state: data.customer.state,
        zip: data.customer.postal_code,
        customerId: existingCustomer.rows[0]?.user_id || "",
        phone: data.customer.phone,
        customerIp: req.ip,
        shippingFirstName: data.shipping.first_name,
        shippingLastName: data.shipping.last_name,
        shippingAddress: data.shipping.street_address,
        shippingCity: data.shipping.city,
        shippingState: data.shipping.state,
        shippingZip: data.shipping.postal_code,
        description: "Alpenwild Gear Store",
      });
      if (!charge.approved) {
        return res.status(402).json({
          message: charge.reason || "Payment was declined.",
        });
      }

      let client;
      let orderId;
      try {
        client = await pool.connect();
        await client.query("BEGIN");
        let userId = existingCustomer.rows[0]?.user_id;
        if (userId) {
          await client.query(
            `UPDATE alpenwild_user_tbl SET
             user_first_name=$1,user_last_name=$2,user_street_address=$3,
             user_street_address1=$4,user_city=$5,user_state=$6,
             user_postal_code=$7,user_country=$8,user_day_phone=$9,
             user_mobile_phone=$10,user_shipping_email_address=$11,
             user_shipping_first_name=$12,user_shipping_last_name=$13,
             user_shipping_street_address=$14,user_shipping_street_address1=$15,
             user_shipping_city=$16,user_shipping_state=$17,
             user_shipping_postal_code=$18,user_shipping_country=$19
           WHERE user_id=$20`,
            [
              data.customer.first_name,
              data.customer.last_name,
              data.customer.street_address,
              data.customer.street_address1,
              data.customer.city,
              data.customer.state,
              data.customer.postal_code,
              data.customer.country,
              data.customer.phone,
              data.customer.phone,
              data.shipping.email,
              data.shipping.first_name,
              data.shipping.last_name,
              data.shipping.street_address,
              data.shipping.street_address1,
              data.shipping.city,
              data.shipping.state,
              data.shipping.postal_code,
              data.shipping.country,
              userId,
            ],
          );
        } else {
          const customer = await client.query(
            `INSERT INTO alpenwild_user_tbl
            (user_first_name,user_last_name,user_street_address,
             user_street_address1,user_city,user_state,user_postal_code,
             user_country,user_day_phone,user_mobile_phone,user_email_address,
             user_shipping_email_address,user_shipping_first_name,
             user_shipping_last_name,user_shipping_street_address,
             user_shipping_street_address1,user_shipping_city,user_shipping_state,
             user_shipping_postal_code,user_shipping_country,user_status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,'Active')
           RETURNING user_id`,
            [
              data.customer.first_name,
              data.customer.last_name,
              data.customer.street_address,
              data.customer.street_address1,
              data.customer.city,
              data.customer.state,
              data.customer.postal_code,
              data.customer.country,
              data.customer.phone,
              data.customer.email,
              data.shipping.email,
              data.shipping.first_name,
              data.shipping.last_name,
              data.shipping.street_address,
              data.shipping.street_address1,
              data.shipping.city,
              data.shipping.state,
              data.shipping.postal_code,
              data.shipping.country,
            ],
          );
          userId = customer.rows[0].user_id;
        }
        const order = await client.query(
          `INSERT INTO alpenwild_order_tbl
          (user_id,order_total_price,order_discount_price,order_shipping_price,order_date)
         VALUES ($1,$2,$3,$4,CURRENT_DATE) RETURNING order_id`,
          [userId, totals.total, totals.discount, totals.shipping],
        );
        orderId = order.rows[0].order_id;
        for (const line of lines) {
          const detail = await client.query(
            `INSERT INTO alpenwild_order_details_tbl
            (order_id,product_id,product_attribute_id,product_quantity,
             product_price,product_total_price)
           VALUES ($1,$2,0,$3,$4,$5) RETURNING *`,
            [
              orderId,
              line.product.id,
              line.quantity,
              line.product.price,
              Number(line.product.price) * line.quantity,
            ],
          );
          const orderDetailId =
            detail.rows[0].order_detail_id ?? detail.rows[0].order_details_id;
          if (line.attributes.length && orderDetailId == null)
            throw new Error(
              "The inserted order detail did not return its identifier.",
            );
          for (const attribute of line.attributes)
            await client.query(
              `INSERT INTO alpenwild_order_attribute_details_tbl
              (order_id,product_id,product_attribute_id,
               product_attribute_type_id,product_attribute_value_id)
             VALUES ($1,$2,$3,$4,$5)`,
              [
                orderId,
                line.product.id,
                orderDetailId,
                attribute.type_id,
                attribute.value_id,
              ],
            );
        }
        await client.query("COMMIT");
      } catch (error) {
        if (client) {
          try {
            await client.query("ROLLBACK");
          } catch (rollbackError) {
            console.error(
              "Unable to roll back failed shop order persistence.",
              rollbackError,
            );
          }
        }
        console.error(
          `Authorize.Net approved shop order but saving order ${orderId || "(unassigned)"} failed; transaction ${charge.transactionId}.`,
          error,
        );
        return res.status(502).json({
          message: `Payment was approved, but we could not save the order. Contact Alpenwild and reference transaction ${charge.transactionId}.`,
        });
      } finally {
        client?.release();
      }

      let emailSent = false;
      if (mailer) {
        const siteTitle = await getSiteTitle();
        const { customerHtml, adminHtml } = buildShopOrderEmails({
          customer: data.customer,
          shipping: data.shipping,
          items: lines.map(({ product, quantity, attributes }) => ({
            name: product.name,
            price: product.price,
            quantity,
            attributes,
          })),
          totals,
          transactionId: charge.transactionId,
        });
        const from = {
          name: siteTitle,
          address: config.smtpFrom || config.smtpUser,
        };
        try {
          await mailer.sendMail({
            from,
            to: data.customer.email,
            subject: `${siteTitle} - Order Notification : ${orderId}`,
            html: customerHtml,
          });
          emailSent = true;
        } catch (emailError) {
          console.error(
            `Shop order ${orderId} was saved, but the confirmation email failed.`,
            emailError,
          );
        }
        try {
          await mailer.sendMail({
            from,
            replyTo: data.customer.email,
            to: await getAdminOrderReceivingEmail(),
            subject: `${siteTitle} - New Order Notification : ${orderId}`,
            html: adminHtml,
          });
        } catch (emailError) {
          console.error(
            `Shop order ${orderId} was saved, but the admin notification email failed.`,
            emailError,
          );
        }
      }
      res.status(201).json({
        order_id: orderId,
        total: totals.total,
        email_sent: emailSent,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
