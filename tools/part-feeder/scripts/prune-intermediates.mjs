#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../../..");
const DEFAULT_PART_FEEDER_DATA_ROOT = join(REPO_ROOT, "tools/part-feeder/data");
const DEFAULT_CONVEYOR_DATA_ROOT = join(REPO_ROOT, "tools/conveyor/data");
const DEFAULT_LIBRARY_ROOT = join(REPO_ROOT, "packages/model-library/models");

function pathInside(path, root) {
  const rel = relative(root, path);
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== "..");
}

function parseArgs(argv) {
  const options = {
    apply: false,
    partFeederDataRoot: resolve(process.env.PART_FEEDER_DATA_ROOT ?? DEFAULT_PART_FEEDER_DATA_ROOT),
    conveyorDataRoot: resolve(process.env.CONVEYOR_DATA_ROOT ?? DEFAULT_CONVEYOR_DATA_ROOT),
    libraryRoot: resolve(process.env.MODEL_LIBRARY_ROOT ?? DEFAULT_LIBRARY_ROOT),
    reportPath: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--apply") options.apply = true;
    else if (flag === "--dry-run") options.apply = false;
    else {
      const value = argv[++index];
      if (value === undefined) throw new Error(`${flag} requires a value`);
      if (flag === "--part-feeder-data-root") options.partFeederDataRoot = resolve(value);
      else if (flag === "--conveyor-data-root") options.conveyorDataRoot = resolve(value);
      else if (flag === "--library-root") options.libraryRoot = resolve(value);
      else if (flag === "--report") options.reportPath = resolve(value);
      else throw new Error(`Unknown option: ${flag}`);
    }
  }
  options.reportPath ??= join(options.partFeederDataRoot, "prune-intermediates-report.json");
  return options;
}

async function walkFiles(root) {
  const files = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) files.push(path);
    }
  }
  try {
    await walk(root);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return files.sort();
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT" || error instanceof SyntaxError) return null;
    throw error;
  }
}

async function sha256(path) {
  const hash = createHash("sha256");
  await new Promise((resolvePromise, reject) => {
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.once("end", resolvePromise);
    stream.once("error", reject);
  });
  return hash.digest("hex");
}

function validUrl(value) {
  return typeof value === "string" && /^https?:\/\//.test(value);
}

async function buildUrlIndexes(options) {
  const byLcsc = new Map();
  const bySha = new Map();
  const jsonFiles = [
    ...(await walkFiles(options.partFeederDataRoot)).filter((path) => path.endsWith(".json")),
    ...(await walkFiles(options.conveyorDataRoot)).filter((path) => path.endsWith(".json")),
  ];

  function inspect(value) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) inspect(item);
      return;
    }
    const lcscId = value.lcsc_id ?? value.lcsc;
    const url = value.datasheet_url ?? value.url;
    if (lcscId && validUrl(url)) byLcsc.set(String(lcscId), url);
    if (typeof value.sha256 === "string" && validUrl(url)) bySha.set(value.sha256.replace(/^sha256:/, ""), url);
    for (const child of Object.values(value)) inspect(child);
  }

  for (const path of jsonFiles) inspect(await readJson(path));

  for (const manufacturer of await readdir(options.libraryRoot, { withFileTypes: true })) {
    if (!manufacturer.isDirectory()) continue;
    const manufacturerRoot = join(options.libraryRoot, manufacturer.name);
    for (const model of await readdir(manufacturerRoot, { withFileTypes: true })) {
      if (!model.isDirectory()) continue;
      const packageId = `${manufacturer.name}/${model.name}`;
      const sources = await readJson(join(manufacturerRoot, model.name, "sources.json"));
      if (!Array.isArray(sources)) continue;
      for (const source of sources) {
        if (typeof source.sha256 === "string" && validUrl(source.url)) {
          bySha.set(source.sha256.replace(/^sha256:/, ""), { url: source.url, packageId });
        }
      }
    }
  }
  return { byLcsc, bySha };
}

async function buildClosedPdfIndex(options, urls) {
  const candidates = new Map();
  const manifestPaths = [
    ...(await walkFiles(join(options.partFeederDataRoot, "staging"))),
    ...(await walkFiles(options.conveyorDataRoot)),
  ].filter((path) => path.endsWith(`${sep}manifest.json`));

  for (const manifestPath of manifestPaths) {
    const manifest = await readJson(manifestPath);
    const records = manifest?.datasheets;
    if (!Array.isArray(records) || records.length === 0) continue;
    const successful = records.filter((record) => record?.status === "downloaded" || record?.status === "cached");
    const closed = successful.length > 0 && successful.every((record) => typeof record.sha256 === "string" && record.path);
    if (!closed) continue;
    for (const record of successful) {
      const path = resolve(dirname(manifestPath), record.path);
      if (!pathInside(path, dirname(manifestPath))) continue;
      const recordedSha256 = record.sha256.replace(/^sha256:/, "");
      const reviewed = urls.bySha.get(recordedSha256);
      const recordedUrl = (typeof reviewed === "object" ? reviewed.url : reviewed)
        ?? urls.byLcsc.get(String(record.lcsc_id));
      if (!validUrl(recordedUrl)) continue;
      candidates.set(path, {
        manifestPath,
        recordedSha256,
        recordedUrl,
        packageId: typeof reviewed === "object" ? reviewed.packageId : null,
      });
    }
  }
  return candidates;
}

function isProtectedConveyorStaging(path, conveyorRoot) {
  return pathInside(path, join(conveyorRoot, "staging"));
}

function isDownloadIntermediate(path, partRoot) {
  if (!pathInside(path, join(partRoot, "downloads"))) return false;
  const name = path.slice(path.lastIndexOf(sep) + 1);
  return /^cache\.(?:z\d+|zip|full\.zip)(?:\.part)?$/.test(name)
    || /\.(?:part|partial|tmp|temp)$/.test(name);
}

function keepReason(path, options) {
  const name = path.slice(path.lastIndexOf(sep) + 1).toLowerCase();
  if (path === join(options.partFeederDataRoot, "jlcparts.sqlite3")) return "keep catalog database; external destination requires a human choice";
  if (isProtectedConveyorStaging(path, options.conveyorDataRoot)) return "keep protected tools/conveyor/data/staging evidence";
  if (name.includes("extraction") || path.includes(`${sep}extractions${sep}`)) return "keep extraction artifact";
  if (name.includes("ledger") || name.endsWith(".jsonl")) return "keep ledger";
  if (name.includes("state") || name.endsWith(".sqlite3") || name.endsWith(".sqlite3-wal") || name.endsWith(".sqlite3-shm")) return "keep state database";
  if (name.endsWith(".pdf")) return "keep PDF without a complete hashed closed-tranche record and recorded URL";
  return "keep outside bounded deletion categories";
}

async function classify(options) {
  const urls = await buildUrlIndexes(options);
  const closedPdfs = await buildClosedPdfIndex(options, urls);
  const roots = [options.partFeederDataRoot, options.conveyorDataRoot];
  const files = [];
  for (const root of roots) {
    for (const path of await walkFiles(root)) {
      if (resolve(path) === resolve(options.reportPath)) continue;
      const fileStat = await stat(path);
      let action = "keep";
      let reason;
      const detail = {};
      if (isDownloadIntermediate(path, options.partFeederDataRoot)) {
        action = "delete";
        reason = "regenerable jlcparts download intermediate";
      } else if (!isProtectedConveyorStaging(path, options.conveyorDataRoot) && closedPdfs.has(path)) {
        const candidate = closedPdfs.get(path);
        const actualSha256 = await sha256(path);
        if (actualSha256 === candidate.recordedSha256) {
          action = "delete";
          reason = "closed-tranche PDF with verified SHA-256 and recorded source URL";
          Object.assign(detail, candidate, { actualSha256 });
        } else {
          reason = "keep PDF because bytes do not match the recorded SHA-256";
          Object.assign(detail, candidate, { actualSha256 });
        }
      } else {
        reason = keepReason(path, options);
      }
      const isPartFeeder = root === options.partFeederDataRoot;
      const logicalRoot = isPartFeeder ? "tools/part-feeder/data" : "tools/conveyor/data";
      files.push({
        root: isPartFeeder ? "part-feeder" : "conveyor",
        path,
        relativePath: join(logicalRoot, relative(root, path)),
        bytes: fileStat.size,
        action,
        reason,
        ...detail,
      });
    }
  }
  return files;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const startedAt = new Date().toISOString();
  const files = await classify(options);
  const deletionCandidates = files.filter((file) => file.action === "delete");
  const deletion = { performed: options.apply, deleted: 0, bytes: 0, failures: [] };
  if (options.apply) {
    for (const file of deletionCandidates) {
      try {
        await unlink(file.path);
        deletion.deleted += 1;
        deletion.bytes += file.bytes;
      } catch (error) {
        deletion.failures.push({ path: file.path, error: error.message });
      }
    }
  }
  const report = {
    schemaVersion: 1,
    kind: "opencircuit-storage-prune-report",
    mode: options.apply ? "apply" : "dry-run",
    startedAt,
    finishedAt: new Date().toISOString(),
    roots: {
      partFeederDataRoot: options.partFeederDataRoot,
      conveyorDataRoot: options.conveyorDataRoot,
      libraryRoot: options.libraryRoot,
    },
    summary: {
      scannedFiles: files.length,
      keepFiles: files.length - deletionCandidates.length,
      deleteFiles: deletionCandidates.length,
      deleteBytes: deletionCandidates.reduce((total, file) => total + file.bytes, 0),
    },
    deletion,
    files,
  };
  await mkdir(dirname(options.reportPath), { recursive: true });
  await writeFile(options.reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`${options.apply ? "Applied" : "Dry run"}: ${report.summary.deleteFiles} files, ${report.summary.deleteBytes} bytes reclaimable`);
  console.log(`Report: ${options.reportPath}`);
  if (deletion.failures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 2;
});
