import { defineConfig } from "vite";

export default defineConfig({
  worker: { format: "es" },
  build: {
    target: "es2022",
    sourcemap: true,
    chunkSizeWarningLimit: 7000,
  },
  server: {
    host: "127.0.0.1",
  },
  preview: {
    host: "127.0.0.1",
  },
});
