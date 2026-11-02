import fs from "node:fs/promises";
import path from "node:path";
import express from "express";

export function createHealthRouter() {
  const router = express.Router();
  router.get("/api/health", (_req, res) => res.json({ ok: true }));
  return router;
}

export function createFrontendFallbackRouter() {
  const router = express.Router();
  router.get("/{*splat}", (_req, res, next) => {
    const client = path.resolve(process.cwd(), "dist", "index.html");
    fs.access(client)
      .then(() => res.sendFile(client))
      .catch(() => next());
  });
  return router;
}
