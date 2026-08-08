import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { parseRawfile } from "./rawfile.mjs";

import { existsSync } from "node:fs";
export const DEFAULT_NGSPICE_PATH = process.env.NGSPICE_BIN
  ?? ["/opt/homebrew/bin/ngspice", "/usr/bin/ngspice", "/usr/local/bin/ngspice"].find(p => existsSync(p))
  ?? "ngspice";
const MAX_CAPTURE_BYTES = 16 * 1024 * 1024;
let versionCache;

function collect(stream, limit = MAX_CAPTURE_BYTES) {
  const chunks = [];
  let total = 0;
  let truncated = false;
  stream.on("data", (chunk) => {
    if (total >= limit) {
      truncated = true;
      return;
    }
    const kept = chunk.subarray(0, limit - total);
    chunks.push(kept);
    total += kept.length;
    if (kept.length < chunk.length) truncated = true;
  });
  return () => `${Buffer.concat(chunks).toString("utf8")}${truncated ? "\n[output truncated]" : ""}`;
}

async function spawnWithTimeout(command, args, { cwd, timeoutMs }) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32",
    });
    const stdout = collect(child.stdout);
    const stderr = collect(child.stderr);
    let timedOut = false;
    let settled = false;

    const timer = setTimeout(() => {
      timedOut = true;
      if (process.platform !== "win32") {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {
          child.kill("SIGKILL");
        }
      } else {
        child.kill("SIGKILL");
      }
    }, timeoutMs);
    timer.unref();

    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolvePromise({ code, signal, timedOut, stdout: stdout(), stderr: stderr() });
    });
  });
}

export async function getNativeVersion(ngspicePath = DEFAULT_NGSPICE_PATH) {
  if (versionCache?.path === ngspicePath) return versionCache.version;
  const result = await spawnWithTimeout(ngspicePath, ["--version"], {
    cwd: process.cwd(),
    timeoutMs: 5_000,
  });
  if (result.code !== 0) throw new Error(`Unable to read native ngspice version: ${result.stderr}`);
  const version = result.stdout.match(/ngspice-[^\s:]+/i)?.[0] ?? result.stdout.trim().split(/\r?\n/)[0];
  versionCache = { path: ngspicePath, version };
  return version;
}

export async function runNative(options) {
  const {
    netlistPath,
    netlist,
    ngspicePath = DEFAULT_NGSPICE_PATH,
    timeoutMs = 30_000,
  } = typeof options === "string" ? { netlistPath: options } : options;

  if ((netlistPath ? 1 : 0) + (netlist ? 1 : 0) !== 1) {
    throw new Error("runNative requires exactly one of netlistPath or netlist");
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error("timeoutMs must be positive");

  const tempDir = await mkdtemp(join(tmpdir(), "opencircuit-native-ngspice-"));
  const rawPath = join(tempDir, "out.raw");
  let inputPath;
  let cwd;

  try {
    if (netlistPath) {
      inputPath = resolve(netlistPath);
      cwd = dirname(inputPath);
    } else {
      inputPath = join(tempDir, "input.cir");
      cwd = tempDir;
      await writeFile(inputPath, netlist, "utf8");
    }

    const started = performance.now();
    const child = await spawnWithTimeout(ngspicePath, ["-b", "-r", rawPath, inputPath], {
      cwd,
      timeoutMs,
    });
    const timingMs = performance.now() - started;

    if (child.timedOut) {
      throw new Error(`Native ngspice timed out after ${timeoutMs} ms for ${basename(inputPath)}\n${child.stderr}`);
    }
    if (child.code !== 0) {
      throw new Error(`Native ngspice failed with exit code ${child.code}${child.signal ? ` (${child.signal})` : ""}\n${child.stdout}\n${child.stderr}`);
    }

    const rawfile = parseRawfile(await readFile(rawPath));
    return {
      rawfile,
      vectors: rawfile.vectors,
      stderr: child.stderr,
      stdout: child.stdout,
      timingMs,
      version: await getNativeVersion(ngspicePath),
      executable: ngspicePath,
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
