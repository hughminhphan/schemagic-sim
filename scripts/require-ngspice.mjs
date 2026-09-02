#!/usr/bin/env node
// Preflight for `npm run verify`.
//
// The workspace test suites shell out to a NATIVE ngspice binary. There is no
// silent skip: a missing binary means the numerical gates did not run, and a
// green run would be a lie. This script resolves the binary the same way the
// rest of the repository does and fails loudly with one actionable message.
//
// Resolution order:
//   1. $NGSPICE_BIN (absolute path or a name on PATH)
//   2. /opt/homebrew/bin/ngspice   (the path CI symlinks and macOS brew uses)
//   3. /usr/local/bin/ngspice, /usr/bin/ngspice
//   4. ngspice on PATH
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

export const NGSPICE_FALLBACK_PATHS = [
  "/opt/homebrew/bin/ngspice",
  "/usr/local/bin/ngspice",
  "/usr/bin/ngspice",
];

export const NGSPICE_MISSING_MESSAGE = [
  "Native ngspice was not found, so the numerical gates cannot run.",
  "",
  "Set NGSPICE_BIN to the binary, or install ngspice so that one of these exists:",
  ...NGSPICE_FALLBACK_PATHS.map((candidate) => `  ${candidate}`),
  "",
  "  macOS:  brew install ngspice        (installs /opt/homebrew/bin/ngspice)",
  "  Ubuntu: sudo apt-get install -y ngspice",
  "  Pinned release reference: tools/native-ngspice-reference/build-ngspice-46-linux.sh",
  "",
  "  Example: NGSPICE_BIN=/opt/homebrew/bin/ngspice npm run verify",
  "",
  "This requirement is never skipped. A run without native ngspice is not a pass.",
].join("\n");

/** Resolve a usable native ngspice binary, or undefined when none is runnable. */
export function resolveNgspiceBinary(env = process.env) {
  const configured = env.NGSPICE_BIN?.trim();
  const candidates = configured ? [configured] : [...NGSPICE_FALLBACK_PATHS, "ngspice"];
  for (const candidate of candidates) {
    if (candidate.includes("/") && !existsSync(candidate)) continue;
    const probe = spawnSync(candidate, ["--version"], { encoding: "utf8", timeout: 30_000 });
    if (probe.error === undefined && probe.status === 0) return { binary: candidate, version: `${probe.stdout ?? ""}`.trim() };
  }
  return undefined;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const resolved = resolveNgspiceBinary();
  if (resolved === undefined) {
    const configured = process.env.NGSPICE_BIN?.trim();
    if (configured) console.error(`NGSPICE_BIN is set to "${configured}" but that binary could not be executed.\n`);
    console.error(NGSPICE_MISSING_MESSAGE);
    process.exit(1);
  }
  const firstLine = resolved.version.split("\n").find((line) => line.trim().length > 0) ?? "";
  console.log(`native ngspice: ${resolved.binary}${firstLine ? ` (${firstLine.trim()})` : ""}`);
}
