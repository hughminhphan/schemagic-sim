import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { defineConfig, type Plugin } from "vite";

function compressWasmPreview(): Plugin {
  const cache = new Map<string, Buffer>();
  return {
    name: "opencircuit-compress-wasm-preview",
    configurePreviewServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = request.url ? new URL(request.url, "http://127.0.0.1").pathname : "";
        const accepted = request.headers["accept-encoding"] ?? "";
        if (!pathname.endsWith(".wasm") || (!accepted.includes("br") && !accepted.includes("gzip"))) {
          next();
          return;
        }
        const assetPath = resolve(import.meta.dirname, "dist", pathname.replace(/^\//, ""));
        if (!existsSync(assetPath)) {
          next();
          return;
        }
        const encoding = accepted.includes("br") ? "br" : "gzip";
        const cacheKey = `${assetPath}:${encoding}`;
        let compressed = cache.get(cacheKey);
        if (!compressed) {
          const source = readFileSync(assetPath);
          compressed = encoding === "br"
            ? brotliCompressSync(source, { params: { [constants.BROTLI_PARAM_QUALITY]: 9 } })
            : gzipSync(source, { level: 9 });
          cache.set(cacheKey, compressed);
        }
        response.statusCode = 200;
        response.setHeader("Content-Type", "application/wasm");
        response.setHeader("Content-Encoding", encoding);
        response.setHeader("Vary", "Accept-Encoding");
        response.setHeader("Content-Length", String(compressed.byteLength));
        response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        response.end(compressed);
      });
    },
  };
}

export default defineConfig({
  plugins: [compressWasmPreview()],
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
