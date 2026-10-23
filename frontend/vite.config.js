import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "frontend",
  envDir: path.resolve(process.cwd()),
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "frontend/src"),
    },
  },
  server: {
    host: true,
    port: 5173,
    forwardConsole: false,
    proxy: {
      "/api": "http://localhost:4100",
      "/uploads": "http://localhost:4100",
    },
    watch: {
      usePolling: true,
      interval: 100,
    },
    hmr: {
      protocol: 'ws',
      overlay: true,
    },
  },
  build: { outDir: "../dist", emptyOutDir: true },
});
