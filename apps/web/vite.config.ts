import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { defineConfig, type Plugin } from "vite";

const DESIGNER_EXAMPLE_MANIFEST_HASH = "552798dcc0e084654c1b64ea20370d0008ef69d62d06d2a2ef1809aa9da19692";
const DESIGNER_EXAMPLE_IDS = ["m1-compact", "m2-power", "p1-compact", "p2-high-voltage"] as const;

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function designerExampleAssets(): Plugin {
  const sourceRoot = resolve(import.meta.dirname, "../../packages/designer-examples");

  function verifiedAssets(): ReadonlyMap<string, Buffer> {
    const manifest = readFileSync(resolve(sourceRoot, "artifacts/manifest.json"));
    if (sha256(manifest) !== DESIGNER_EXAMPLE_MANIFEST_HASH) {
      throw new Error("Designer demonstration manifest no longer matches the browser gallery contract.");
    }
    const parsed = JSON.parse(manifest.toString("utf8")) as {
      examples?: Array<{ id?: string; artifact?: { path?: string; byteLength?: number; contentHash?: string } }>;
    };
    if (!Array.isArray(parsed.examples)
      || parsed.examples.length !== DESIGNER_EXAMPLE_IDS.length
      || parsed.examples.some((entry, index) => entry.id !== DESIGNER_EXAMPLE_IDS[index])) {
      throw new Error("Designer demonstration manifest has an unsupported example set.");
    }
    const assets = new Map<string, Buffer>([["manifest.json", manifest]]);
    for (const entry of parsed.examples) {
      const artifact = entry.artifact;
      if (!entry.id
        || !artifact
        || artifact.path !== `artifacts/${entry.id}.json`
        || !Number.isSafeInteger(artifact.byteLength)
        || typeof artifact.contentHash !== "string") {
        throw new Error(`Designer demonstration ${entry.id ?? "unknown"} has an invalid artifact binding.`);
      }
      const bytes = readFileSync(resolve(sourceRoot, artifact.path));
      if (bytes.byteLength !== artifact.byteLength || `sha256:${sha256(bytes)}` !== artifact.contentHash) {
        throw new Error(`Designer demonstration ${entry.id} does not match its manifest identity.`);
      }
      assets.set(artifact.path, bytes);
    }
    return assets;
  }

  return {
    name: "opencircuit-designer-example-assets",
    buildStart() {
      for (const [path, source] of verifiedAssets()) {
        this.emitFile({ type: "asset", fileName: `designer-examples/${path}`, source });
      }
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.method !== "GET" && request.method !== "HEAD") {
          next();
          return;
        }
        const pathname = request.url ? new URL(request.url, "http://127.0.0.1").pathname : "";
        const prefix = "/designer-examples/";
        if (!pathname.startsWith(prefix)) {
          next();
          return;
        }
        const source = verifiedAssets().get(pathname.slice(prefix.length));
        if (!source) {
          response.statusCode = 404;
          response.end();
          return;
        }
        response.statusCode = 200;
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        response.setHeader("Content-Length", String(source.byteLength));
        response.setHeader("Cache-Control", "no-cache");
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.end(request.method === "HEAD" ? undefined : source);
      });
    },
  };
}

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
  plugins: [designerExampleAssets(), compressWasmPreview()],
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
