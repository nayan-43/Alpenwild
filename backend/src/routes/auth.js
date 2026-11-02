import crypto from "node:crypto";
import express from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";

export const authCookieName = "alpenwild_admin_session";

const loginAttempts = new Map();
const loginSchema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(200),
  remember: z.boolean().optional().default(false),
});
const forgotSchema = z.object({ username: z.string().trim().min(1).max(100) });
const credentialsSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(12).max(200),
});
const usernameSchema = z.object({
  oldUsername: z.string().trim().min(1).max(100),
  newUsername: z.string().trim().min(1).max(100),
  confirmation: z.string().trim().min(1).max(100),
});

function issueAuthCookie(res, user, remember, config) {
  if (!config.jwtSecret)
    throw new Error("JWT_SECRET must be configured before enabling login.");
  const token = jwt.sign(
    { sub: String(user.id), username: user.username },
    config.jwtSecret,
    { expiresIn: remember ? "30d" : "8h", issuer: "alpenwild-admin" },
  );
  res.cookie(authCookieName, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: (remember ? 30 * 24 : 8) * 60 * 60 * 1000,
    path: "/",
  });
}

function generateLegacyAdminPassword() {
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "123456789";
  const symbols = "!@#$%^&*?";
  const characters = Array.from(
    { length: 12 },
    () => lowercase[crypto.randomInt(lowercase.length)],
  );
  const positions = Array.from(
    { length: characters.length },
    (_, index) => index,
  );
  for (let index = positions.length - 1; index > 0; index -= 1) {
    const otherIndex = crypto.randomInt(index + 1);
    [positions[index], positions[otherIndex]] = [
      positions[otherIndex],
      positions[index],
    ];
  }
  for (const [offset, alphabet, count] of [
    [0, uppercase, 3],
    [3, numbers, 2],
    [5, symbols, 3],
  ]) {
    for (let index = 0; index < count; index += 1) {
      characters[positions[offset + index]] =
        alphabet[crypto.randomInt(alphabet.length)];
    }
  }
  return characters.join("");
}

function verifyLegacyAdminPassword(password, storedPassword) {
  if (!storedPassword || !/^[a-f0-9]{32}$/i.test(storedPassword)) return false;
  const digest = crypto.createHash("md5").update(password).digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(digest, "utf8"),
    Buffer.from(storedPassword.toLowerCase(), "utf8"),
  );
}

export function createAuthRouter({
  config,
  query,
  pool,
  mailer,
  getSiteTitle,
  getAdminReceivingEmail,
  requireAuth,
  verifyRequestOrigin,
}) {
  const router = express.Router();

  router.post(
    "/api/auth/login",
    verifyRequestOrigin,
    async (req, res, next) => {
      const key = req.ip || "unknown";
      const now = Date.now();
      const attempts = loginAttempts.get(key);
      if (
        attempts &&
        now - attempts.startedAt < 10 * 60 * 1000 &&
        attempts.count >= 5
      )
        return res
          .status(429)
          .json({ message: "Too many login attempts. Try again later." });
      if (attempts && now - attempts.startedAt >= 10 * 60 * 1000)
        loginAttempts.delete(key);

      try {
        if (!config.databaseUrl || !config.jwtSecret)
          return res
            .status(503)
            .json({ message: "Authentication is not configured." });
        const data = loginSchema.parse(req.body);
        const result = await query(
          `SELECT administrator_id AS id,
                administrator_username AS username,
                administrator_name AS display_name,
                administrator_password AS legacy_password_md5
         FROM alpenwild_administrator_tbl
         WHERE LOWER(administrator_username)=LOWER($1) LIMIT 1`,
          [data.username],
        );
        const admin = result.rows[0];
        const valid = verifyLegacyAdminPassword(
          data.password,
          admin?.legacy_password_md5,
        );
        if (!valid) {
          const current = loginAttempts.get(key);
          loginAttempts.set(key, {
            startedAt: current?.startedAt || now,
            count: (current?.count || 0) + 1,
          });
          return res
            .status(401)
            .json({ message: "Invalid username or password." });
        }
        loginAttempts.delete(key);
        issueAuthCookie(res, admin, data.remember, config);
        res.json({
          id: admin.id,
          username: admin.username,
          display_name: admin.display_name,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post("/api/auth/logout", verifyRequestOrigin, (_req, res) => {
    res.clearCookie(authCookieName, {
      httpOnly: true,
      sameSite: "strict",
      path: "/",
    });
    res.status(204).end();
  });

  router.post(
    "/api/auth/forgot-password",
    verifyRequestOrigin,
    async (req, res, next) => {
      try {
        const { username } = forgotSchema.parse(req.body);
        if (!mailer)
          return res
            .status(503)
            .json({ message: "Password email is not configured." });
        const result = await query(
          `SELECT administrator_id AS id
           FROM alpenwild_administrator_tbl
           WHERE LOWER(administrator_username)=LOWER($1) LIMIT 1`,
          [username],
        );
        const admin = result.rows[0];
        if (!admin)
          return res.status(404).json({
            message: "No administrator account was found with that username.",
          });
        const siteTitle = await getSiteTitle();
        const temporaryPassword = generateLegacyAdminPassword();
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const update = await client.query(
            `UPDATE alpenwild_administrator_tbl
             SET administrator_password=$1
             WHERE administrator_id=$2`,
            [
              crypto.createHash("md5").update(temporaryPassword).digest("hex"),
              admin.id,
            ],
          );
          if (update.rowCount !== 1)
            throw new Error(
              "Administrator password update did not affect one account.",
            );
          await mailer.sendMail({
            from: {
              name: siteTitle,
              address: config.smtpFrom || config.smtpUser,
            },
            to: await getAdminReceivingEmail(),
            subject: `New Password ${siteTitle}`,
            html: `<p style="font:normal 14px calibri;">Dear Admin,<br><br>Your New Password is: ${temporaryPassword}</p>`,
          });
          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        } finally {
          client.release();
        }
        res.json({
          message: "A new password will be sent to your e-mail address.",
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get("/api/auth/me", requireAuth, async (req, res, next) => {
    try {
      const result = await query(
        `SELECT administrator_id AS id,
                administrator_username AS username,
                administrator_name AS display_name
         FROM alpenwild_administrator_tbl
         WHERE administrator_id=$1`,
        [req.admin.sub],
      );
      if (!result.rowCount) {
        res.clearCookie(authCookieName, {
          httpOnly: true,
          sameSite: "strict",
          path: "/",
        });

        return res.status(401).json({
          message: "Please login first to access this page!",
          code: "ADMIN_SESSION_EXPIRED",
        });
      }
      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/api/auth/change-username",
    requireAuth,
    verifyRequestOrigin,
    async (req, res, next) => {
      try {
        const data = usernameSchema.parse(req.body);
        const result = await query(
          `SELECT administrator_username AS username
           FROM alpenwild_administrator_tbl WHERE administrator_id=$1`,
          [req.admin.sub],
        );
        if (
          !result.rowCount ||
          result.rows[0].username.toLowerCase() !==
            data.oldUsername.toLowerCase()
        )
          return res
            .status(400)
            .json({ message: "Old username is incorrect." });
        if (data.newUsername !== data.confirmation)
          return res
            .status(400)
            .json({ message: "Username confirmation does not match." });
        await query(
          `UPDATE alpenwild_administrator_tbl
           SET administrator_username=$1 WHERE administrator_id=$2`,
          [data.newUsername, req.admin.sub],
        );
        res.json({ message: "Username updated successfully." });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/api/auth/change-password",
    requireAuth,
    verifyRequestOrigin,
    async (req, res, next) => {
      try {
        const data = credentialsSchema.parse(req.body);
        const result = await query(
          `SELECT administrator_password AS legacy_password_md5
           FROM alpenwild_administrator_tbl WHERE administrator_id=$1`,
          [req.admin.sub],
        );
        const admin = result.rows[0];
        const valid = verifyLegacyAdminPassword(
          data.currentPassword,
          admin?.legacy_password_md5,
        );
        if (!valid)
          return res
            .status(400)
            .json({ message: "Current password is incorrect." });
        await query(
          `UPDATE alpenwild_administrator_tbl
           SET administrator_password=$1
           WHERE administrator_id=$2`,
          [
            crypto.createHash("md5").update(data.newPassword).digest("hex"),
            req.admin.sub,
          ],
        );
        res.json({ message: "Password updated successfully." });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
