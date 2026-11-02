import { Router } from "express";

function serializeOrder(row) {
  return {
    id: row.order_id,
    order_date: row.order_date,
    name: [row.user_first_name, row.user_last_name].filter(Boolean).join(" "),
    email: row.user_email_address || "",
    total_price: Number(row.order_total_price || 0),
    discount_price: Number(row.order_discount_price || 0),
    shipping_price: Number(row.order_shipping_price || 0),
  };
}

export function createOrdersRouter({ query }) {
  const router = Router();

  router.get("/api/orders", async (_req, res, next) => {
    try {
      const result = await query(
        `SELECT o.*, u.user_first_name, u.user_last_name, u.user_email_address
         FROM alpenwild_order_tbl o
         LEFT JOIN alpenwild_user_tbl u ON u.user_id=o.user_id
         ORDER BY o.order_id DESC`,
      );
      res.json(result.rows.map(serializeOrder));
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/orders/:id", async (req, res, next) => {
    try {
      const result = await query(
        `SELECT o.*, u.*
         FROM alpenwild_order_tbl o
         LEFT JOIN alpenwild_user_tbl u ON u.user_id=o.user_id
         WHERE o.order_id=$1`,
        [req.params.id],
      );
      if (!result.rowCount)
        return res.status(404).json({ message: "Order not found." });
      const order = serializeOrder(result.rows[0]);
      const detailIdColumn = await query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema=current_schema()
           AND table_name='alpenwild_order_details_tbl'
           AND column_name=ANY($1::text[])
         ORDER BY array_position($1::text[], column_name)
         LIMIT 1`,
        [["order_detail_id", "order_details_id"]],
      );
      const orderDetailIdColumn = detailIdColumn.rows[0]?.column_name;
      if (!orderDetailIdColumn) {
        throw new Error(
          "Unable to resolve the order detail ID column for product view.",
        );
      }
      const details = await query(
        `SELECT d.product_id, d.product_attribute_id, d.product_quantity,
                d.product_price, d.product_total_price,
                p.product_name
         FROM alpenwild_order_details_tbl d
         LEFT JOIN alpenwild_product_tbl p ON p.product_id=d.product_id
         WHERE d.order_id=$1
         ORDER BY d.${orderDetailIdColumn}`,
        [req.params.id],
      );
      const attributeDetailIdColumn = await query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema=current_schema()
           AND table_name='alpenwild_order_attribute_details_tbl'
           AND column_name=ANY($1::text[])
         ORDER BY array_position($1::text[], column_name)
         LIMIT 1`,
        [["order_attribute_detail_id", "order_attribute_details_id"]],
      );
      const orderAttributeDetailIdColumn =
        attributeDetailIdColumn.rows[0]?.column_name;
      if (!orderAttributeDetailIdColumn) {
        throw new Error(
          "Unable to resolve the order attribute detail ID column for product view.",
        );
      }
      const attributes = await query(
        `SELECT a.product_attribute_id, t.attribute_type_name,
                v.attribute_value
         FROM alpenwild_order_attribute_details_tbl a
         LEFT JOIN alpenwild_attribute_type_tbl t
           ON t.attribute_type_id=a.product_attribute_type_id
         LEFT JOIN alpenwild_attribute_value_tbl v
           ON v.attribute_value_id=a.product_attribute_value_id
         WHERE a.order_id=$1
         ORDER BY a.${orderAttributeDetailIdColumn}`,
        [req.params.id],
      );
      const attributesByProduct = new Map();
      for (const attribute of attributes.rows) {
        const current =
          attributesByProduct.get(attribute.product_attribute_id) || [];
        current.push({
          type: attribute.attribute_type_name || "",
          value: attribute.attribute_value || "",
        });
        attributesByProduct.set(attribute.product_attribute_id, current);
      }
      res.json({
        ...order,
        customer: {
          first_name: result.rows[0].user_first_name || "",
          last_name: result.rows[0].user_last_name || "",
          email: result.rows[0].user_email_address || "",
          street_address: result.rows[0].user_street_address || "",
          street_address1: result.rows[0].user_street_address1 || "",
          city: result.rows[0].user_city || "",
          state: result.rows[0].user_state || "",
          postal_code: result.rows[0].user_postal_code || "",
          country: result.rows[0].user_country || "",
        },
        shipping: {
          first_name: result.rows[0].user_shipping_first_name || "",
          last_name: result.rows[0].user_shipping_last_name || "",
          street_address: result.rows[0].user_shipping_street_address || "",
          street_address1: result.rows[0].user_shipping_street_address1 || "",
          city: result.rows[0].user_shipping_city || "",
          state: result.rows[0].user_shipping_state || "",
          postal_code: result.rows[0].user_shipping_postal_code || "",
          country: result.rows[0].user_shipping_country || "",
        },
        items: details.rows.map((item) => ({
          ...item,
          quantity: Number(item.product_quantity || 0),
          price: Number(item.product_price || 0),
          total_price: Number(item.product_total_price || 0),
          attributes: attributesByProduct.get(item.product_attribute_id) || [],
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/api/orders/:id", async (req, res, next) => {
    try {
      const result = await query(
        "DELETE FROM alpenwild_order_tbl WHERE order_id=$1 RETURNING order_id",
        [req.params.id],
      );
      if (!result.rowCount)
        return res.status(404).json({ message: "Order not found." });
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
