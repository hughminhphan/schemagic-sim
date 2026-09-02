#!/usr/bin/env node
// Relative-link checker for the Markdown under docs/.
//
// Checks two things per Markdown file:
//   1. Every relative [text](target) link resolves to a file or directory.
//   2. Every repo-root-relative path mentioned in backticks (`docs/...`,
//      `packages/...`, `tools/...`, `apps/...`, `scripts/...`) still exists.
//      The campaign records reference each other this way rather than with
//      Markdown links, so the second check is what catches a move.
//
// Usage: node scripts/check-doc-links.mjs [rootDir]
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(process.argv[2] ?? join(repoRoot, "docs"));

const MD_LINK = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const BACKTICK_PATH = /`((?:docs|packages|tools|apps|scripts|examples|spikes|launch)\/[A-Za-z0-9._\/-]+)`/g;

function markdownFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) markdownFiles(full, out);
    else if (entry.name.endsWith(".md")) out.push(full);
  }
  return out;
}

function exists(p) {
  try { statSync(p); return true; } catch { return false; }
}

// A recorded path is only checkable when git would track it. The campaign
// records cite conveyor and feeder working data (tools/*/data, catalog dumps)
// that is deliberately gitignored and, for product lanes, deliberately unread.
// Those citations are provenance, not navigation, so they are not link errors.
const ignoredCache = new Map();
function isGitIgnored(paths) {
  const unknown = paths.filter((p) => !ignoredCache.has(p));
  if (unknown.length > 0) {
    // Ask about both forms: a rule like "dist/" only matches the directory
    // spelling, and these paths often do not exist in a clean checkout.
    const probes = unknown.flatMap((p) => [p, `${p}/`]);
    const result = spawnSync("git", ["-C", repoRoot, "check-ignore", "--stdin", "--no-index"], {
      input: probes.join("\n"),
      encoding: "utf8",
    });
    const ignored = new Set(`${result.stdout ?? ""}`.split("\n").map((l) => l.trim().replace(/\/$/, "")).filter(Boolean));
    for (const p of unknown) ignoredCache.set(p, ignored.has(p));
  }
  return ignoredCache;
}

// docs/batch-N-selection.json and friends are naming templates, not files.
// docs/batch-N-selection.json and friends are naming templates, not files:
// a bare capital letter or a bracketed token standing alone in a path segment.
const PLACEHOLDER = /(^|[-\/_.])([A-Z]|\.\.\.|<|\{)(?=$|[-\/_.])/;

const files = markdownFiles(root);
const broken = [];
const repoPathCandidates = [];

for (const file of files) {
  const text = readFileSync(file, "utf8");
  const lines = text.split("\n");

  for (const [index, line] of lines.entries()) {
    for (const match of line.matchAll(MD_LINK)) {
      const target = match[1];
      if (/^(https?:|mailto:|#|<)/.test(target)) continue;
      const cleaned = target.split("#")[0];
      if (cleaned === "") continue;
      const resolved = cleaned.startsWith("/")
        ? join(repoRoot, cleaned.slice(1))
        : resolve(dirname(file), cleaned);
      if (!exists(resolved)) {
        broken.push({ file, line: index + 1, target, kind: "markdown link" });
      }
    }

    for (const match of line.matchAll(BACKTICK_PATH)) {
      const target = match[1];
      if (target.includes("*") || PLACEHOLDER.test(target)) continue;
      if (!existsSync(join(repoRoot, target))) {
        repoPathCandidates.push({ file, line: index + 1, target, kind: "repo path" });
      }
    }
  }
}

const ignored = isGitIgnored(repoPathCandidates.map((c) => c.target));
for (const candidate of repoPathCandidates) {
  if (!ignored.get(candidate.target)) broken.push(candidate);
}
broken.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

console.log(`checked ${files.length} Markdown files under ${relative(repoRoot, root) || "."}`);
if (broken.length === 0) {
  console.log("all relative links and referenced repo paths resolve");
  process.exit(0);
}
console.error(`\n${broken.length} unresolved reference${broken.length === 1 ? "" : "s"}:`);
for (const b of broken) {
  console.error(`  ${relative(repoRoot, b.file)}:${b.line}  ${b.kind}: ${b.target}`);
}
process.exit(1);
