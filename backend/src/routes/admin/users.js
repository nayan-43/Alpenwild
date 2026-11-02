import { Router } from "express";
import { z } from "zod";

export function createUsersRouter({
  query,
  userSchema,
  useLegacyUsers,
  userSelect,
  userSelectById,
  userInsert,
  userUpdate,
  userUpdateBookings,
  userHasOrders,
}) {
  const router = Router();

  router.get("/api/users", async (_req, res, next) => {
    try {
      const result = await query(
        `${userSelect()} ORDER BY ${useLegacyUsers() ? "user_id" : "id"} ASC`,
      );
      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/users", async (req, res, next) => {
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
          message: "Sorry, email is already added. Please use another email.",
        });
      const inserted = await userInsert(data);
      const result = await query(userSelectById(), [inserted.rows[0].id]);
      res.status(201).json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/users/:id", async (req, res, next) => {
    try {
      const data = userSchema.parse(req.body);
      const duplicate = useLegacyUsers()
        ? await query(
            "SELECT user_id FROM alpenwild_user_tbl WHERE LOWER(user_email_address)=LOWER($1) AND user_id<>$2 LIMIT 1",
            [data.user_email_address, req.params.id],
          )
        : await query(
            "SELECT id FROM users WHERE LOWER(email_address)=LOWER($1) AND id<>$2 LIMIT 1",
            [data.user_email_address, req.params.id],
          );
      if (duplicate.rowCount)
        return res.status(409).json({
          message: "Sorry, email is already added. Please use another email.",
        });
      const updated = await userUpdate(data, req.params.id);
      if (!updated.rowCount)
        return res.status(404).json({ message: "User not found." });
      await userUpdateBookings(data, req.params.id);
      const result = await query(userSelectById(), [req.params.id]);
      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/users/:id/status", async (req, res, next) => {
    try {
      const status = z.enum(["Active", "Inactive"]).parse(req.body.status);
      const result = useLegacyUsers()
        ? await query(
            `UPDATE alpenwild_user_tbl SET user_status=$1
             WHERE user_id=$2 RETURNING user_id AS id`,
            [status, req.params.id],
          )
        : await query(
            "UPDATE users SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING id",
            [status, req.params.id],
          );
      if (!result.rowCount)
        return res
          .status(404)
          .json({ message: "Nothing is deleted successfully" });
      const user = await query(userSelectById(), [req.params.id]);
      res.json(user.rows[0]);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/api/users/:id", async (req, res, next) => {
    try {
      if (await userHasOrders(req.params.id))
        return res.status(409).json({
          message:
            "Order existing under this user. First delete order and then delete this user.",
        });
      const result = useLegacyUsers()
        ? await query(
            "DELETE FROM alpenwild_user_tbl WHERE user_id=$1 RETURNING user_id",
            [req.params.id],
          )
        : await query("DELETE FROM users WHERE id=$1 RETURNING id", [
            req.params.id,
          ]);
      if (!result.rowCount)
        return res.status(404).json({ message: "User not found." });
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
