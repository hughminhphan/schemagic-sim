#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../../..");
export const DEFAULT_PART_FEEDER_DATA_ROOT = join(REPO_ROOT, "tools/part-feeder/data");
export const DEFAULT_CONVEYOR_DATA_ROOT = join(REPO_ROOT, "tools/conveyor/data");
export const DEFAULT_LIBRARY_ROOT = join(REPO_ROOT, "packages/model-library/models");
export const DEFAULT_CAMPAIGN_ROOT = join(REPO_ROOT, "docs/campaigns");

function pathInside(path, root) {
  const rel = relative(resolve(root), resolve(path));
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== "..");
}

function validateDataRoots(options) {
  if (options.allowExternalRoot) return;
  if (!pathInside(options.partFeederDataRoot, DEFAULT_PART_FEEDER_DATA_ROOT)) {
    throw new Error("--part-feeder-data-root must stay inside the repository tools/part-feeder/data; pass --allow-external-root to override");
  }
  if (!pathInside(options.conveyorDataRoot, DEFAULT_CONVEYOR_DATA_ROOT)) {
    throw new Error("--conveyor-data-root must stay inside the repository tools/conveyor/data; pass --allow-external-root to override");
  }
}

export function parseArgs(argv) {
  const options = {
    apply: false,
    allowExternalRoot: false,
    restorePath: null,
    partFeederDataRoot: resolve(process.env.PART_FEEDER_DATA_ROOT ?? DEFAULT_PART_FEEDER_DATA_ROOT),
    conveyorDataRoot: resolve(process.env.CONVEYOR_DATA_ROOT ?? DEFAULT_CONVEYOR_DATA_ROOT),
    libraryRoot: resolve(process.env.MODEL_LIBRARY_ROOT ?? DEFAULT_LIBRARY_ROOT),
    campaignRoot: DEFAULT_CAMPAIGN_ROOT,
    reportPath: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--apply") options.apply = true;
    else if (flag === "--dry-run") options.apply = false;
    else if (flag === "--allow-external-root") options.allowExternalRoot = true;
    else {
      const value = argv[++index];
      if (value === undefined) throw new Error(`${flag} requires a value`);
      if (flag === "--part-feeder-data-root") options.partFeederDataRoot = resolve(value);
      else if (flag === "--conveyor-data-root") options.conveyorDataRoot = resolve(value);
      else if (flag === "--library-root") options.libraryRoot = resolve(value);
      else if (flag === "--restore") options.restorePath = resolve(value);
      else if (flag === "--report") options.reportPath = resolve(value);
      else throw new Error(`Unknown option: ${flag}`);
    }
  }
  if (options.restorePath && options.apply) throw new Error("--restore and --apply are separate modes");
  validateDataRoots(options);
  options.reportPath ??= options.restorePath
    ? `${options.restorePath}.restore-report.json`
    : join(options.partFeederDataRoot, "prune-intermediates-report.json");
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

function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function validUrl(value) {
  return typeof value === "string" && /^https?:\/\//.test(value);
}

function logicalPath(path, root, prefix) {
  const suffix = relative(root, path).split(sep).join("/");
  return suffix ? `${prefix}/${suffix}` : prefix;
}

function extractCampaignPaths(text, cited) {
  const pattern = /tools\/(?:part-feeder|conveyor)\/data\/[^\s"'`<>{}\[\]|]+/g;
  for (const match of text.matchAll(pattern)) {
    const cleaned = match[0].replace(/[),.;:]+$/, "").replaceAll("\\", "/");
    cited.add(cleaned);
  }
}

export async function buildCampaignEvidenceIndex(options) {
  const cited = new Set();
  for (const path of await walkFiles(options.campaignRoot ?? DEFAULT_CAMPAIGN_ROOT)) {
    if (extname(path).toLowerCase() !== ".json" && extname(path).toLowerCase() !== ".md") continue;
    extractCampaignPaths(await readFile(path, "utf8"), cited);
  }
  return cited;
}

export async function buildUrlIndexes(options) {
  const byLcsc = new Map();
  const bySha = new Map();
  const recordFiles = [
    ...(await walkFiles(options.partFeederDataRoot)).filter((path) => path.endsWith(".json") || path.endsWith(".jsonl")),
    ...(await walkFiles(options.conveyorDataRoot)).filter((path) => path.endsWith(".json") || path.endsWith(".jsonl")),
  ];

  function inspect(value) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) inspect(item);
      return;
    }
    const lcscId = value.lcsc_id ?? value.lcsc;
    const url = value.datasheet_url ?? value.url ?? value.canonical_datasheet_url;
    if (lcscId && validUrl(url)) byLcsc.set(String(lcscId), url);
    if (typeof value.sha256 === "string" && validUrl(url)) bySha.set(value.sha256.replace(/^sha256:/, ""), url);
    for (const child of Object.values(value)) inspect(child);
  }

  for (const path of recordFiles) {
    if (path.endsWith(".jsonl")) {
      const lines = (await readFile(path, "utf8")).split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        try { inspect(JSON.parse(line)); } catch { /* An unreadable ledger line cannot authorize deletion. */ }
      }
    } else {
      inspect(await readJson(path));
    }
  }

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

export async function buildClosedPdfIndex(options, urls) {
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
      if (!pathInside(path, dirname(manifestPath)) || extname(path).toLowerCase() !== ".pdf") continue;
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

export function isProtectedStaging(path, options) {
  for (const root of [options.partFeederDataRoot, options.conveyorDataRoot]) {
    if (!pathInside(path, root)) continue;
    const segments = [basename(root), ...relative(root, path).split(sep)];
    if (segments.includes("staging")) return true;
  }
  return false;
}

function isDownloadIntermediate(path, partRoot) {
  if (!pathInside(path, join(partRoot, "downloads"))) return false;
  const name = basename(path);
  return /^cache\.(?:z\d+|zip|full\.zip)(?:\.part)?$/.test(name)
    || /\.(?:part|partial|tmp|temp)$/.test(name);
}

function explicitKeepReason(path, relativePath, options, campaignEvidence) {
  const name = basename(path).toLowerCase();
  if (path === join(options.partFeederDataRoot, "jlcparts.sqlite3")) return "keep catalog database; external destination requires a human choice";
  if (isProtectedStaging(path, options)) return "keep path below a staging segment under a tool data root";
  if (campaignEvidence.has(relativePath)) return "keep evidence cited by docs/campaigns";
  if (name.includes("extraction") || path.includes(`${sep}extractions${sep}`)) return "keep extraction artifact";
  if (name.includes("ledger") || name.endsWith(".jsonl")) return "keep ledger";
  if (name.includes("state") || name.endsWith(".sqlite3") || name.endsWith(".sqlite3-wal") || name.endsWith(".sqlite3-shm")) return "keep state database";
  return null;
}

export async function classify(options) {
  validateDataRoots(options);
  const campaignEvidence = await buildCampaignEvidenceIndex(options);
  const urls = await buildUrlIndexes(options);
  const closedPdfs = await buildClosedPdfIndex(options, urls);
  const roots = [options.partFeederDataRoot, options.conveyorDataRoot];
  const files = [];
  for (const root of roots) {
    for (const path of await walkFiles(root)) {
      if (resolve(path) === resolve(options.reportPath)) continue;
      const fileStat = await stat(path);
      const isPartFeeder = root === options.partFeederDataRoot;
      const prefix = isPartFeeder ? "tools/part-feeder/data" : "tools/conveyor/data";
      const relativePath = logicalPath(path, root, prefix);
      let action = "keep";
      let reason = explicitKeepReason(path, relativePath, options, campaignEvidence);
      const detail = {};
      if (!reason && isDownloadIntermediate(path, options.partFeederDataRoot)) {
        action = "delete";
        reason = "regenerable jlcparts download intermediate";
      } else if (!reason && extname(path).toLowerCase() === ".pdf" && closedPdfs.has(path)) {
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
      } else if (!reason && extname(path).toLowerCase() === ".pdf") {
        reason = "keep PDF without a complete hashed closed-tranche record and recorded URL";
      } else if (!reason) {
        reason = "keep outside bounded deletion categories";
      }
      files.push({
        root: isPartFeeder ? "part-feeder" : "conveyor",
        path,
        relativePath,
        bytes: fileStat.size,
        action,
        reason,
        ...detail,
      });
    }
  }
  return files;
}

function restoreDestination(relativePath, options) {
  const partPrefix = "tools/part-feeder/data/";
  const conveyorPrefix = "tools/conveyor/data/";
  if (relativePath.startsWith(partPrefix)) {
    const destination = resolve(options.partFeederDataRoot, relativePath.slice(partPrefix.length));
    if (!pathInside(destination, options.partFeederDataRoot)) throw new Error(`restore path escapes part-feeder root: ${relativePath}`);
    return destination;
  }
  if (relativePath.startsWith(conveyorPrefix)) {
    const destination = resolve(options.conveyorDataRoot, relativePath.slice(conveyorPrefix.length));
    if (!pathInside(destination, options.conveyorDataRoot)) throw new Error(`restore path escapes conveyor root: ${relativePath}`);
    return destination;
  }
  throw new Error(`restore path is outside supported tool data roots: ${relativePath}`);
}

export async function restoreFromList(options) {
  validateDataRoots(options);
  const document = JSON.parse(await readFile(options.restorePath, "utf8"));
  const records = Array.isArray(document) ? document : document.files;
  if (!Array.isArray(records)) throw new Error("restore list must be an array or contain a files array");
  const result = { requested: records.length, restored: 0, restoredBytes: 0, alreadyPresent: 0, failures: [] };
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const relativePath = record.relativePath ?? record.path;
    const recordedSha256 = String(record.recordedSha256 ?? record.sha256 ?? "").replace(/^sha256:/, "");
    const recordedUrl = record.recordedUrl ?? record.url;
    try {
      if (typeof relativePath !== "string" || !relativePath.endsWith(".pdf")) throw new Error("record requires a PDF relativePath");
      if (!/^[a-f0-9]{64}$/i.test(recordedSha256)) throw new Error("record requires a SHA-256 digest");
      if (!validUrl(recordedUrl)) throw new Error("record requires an HTTP or HTTPS URL");
      const destination = restoreDestination(relativePath, options);
      try {
        const existingSha256 = await sha256(destination);
        if (existingSha256 !== recordedSha256) throw new Error("existing file does not match recorded SHA-256; refusing to overwrite");
        result.alreadyPresent += 1;
        continue;
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      const response = await fetch(recordedUrl, { redirect: "follow", signal: AbortSignal.timeout(60_000) });
      if (!response.ok) throw new Error(`fetch returned HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      const actualSha256 = sha256Bytes(bytes);
      if (actualSha256 !== recordedSha256) throw new Error(`downloaded SHA-256 mismatch: expected ${recordedSha256}, got ${actualSha256}`);
      if (Number.isSafeInteger(record.bytes) && bytes.byteLength !== record.bytes) {
        throw new Error(`downloaded size mismatch: expected ${record.bytes}, got ${bytes.byteLength}`);
      }
      await mkdir(dirname(destination), { recursive: true });
      const tempPath = join(dirname(destination), `.${basename(destination)}.restore-${process.pid}-${index}.tmp`);
      try {
        await writeFile(tempPath, bytes, { flag: "wx" });
        await rename(tempPath, destination);
      } catch (error) {
        await unlink(tempPath).catch(() => {});
        throw error;
      }
      result.restored += 1;
      result.restoredBytes += bytes.byteLength;
    } catch (error) {
      result.failures.push({ relativePath, recordedUrl, error: error.message });
    }
  }
  return result;
}

async function writeReport(reportPath, report) {
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

async function runRestore(options) {
  const startedAt = new Date().toISOString();
  const restoration = await restoreFromList(options);
  const report = {
    schemaVersion: 1,
    kind: "opencircuit-storage-restore-report",
    mode: "restore",
    startedAt,
    finishedAt: new Date().toISOString(),
    restorePath: options.restorePath,
    roots: {
      partFeederDataRoot: options.partFeederDataRoot,
      conveyorDataRoot: options.conveyorDataRoot,
    },
    restoration,
  };
  await writeReport(options.reportPath, report);
  console.log(`Restored: ${restoration.restored} files, ${restoration.restoredBytes} bytes; ${restoration.alreadyPresent} already present; ${restoration.failures.length} failures`);
  console.log(`Report: ${options.reportPath}`);
  if (restoration.failures.length) process.exitCode = 1;
}

async function runPrune(options) {
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
      campaignRoot: options.campaignRoot,
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
  await writeReport(options.reportPath, report);
  console.log(`${options.apply ? "Applied" : "Dry run"}: ${report.summary.deleteFiles} files, ${report.summary.deleteBytes} bytes reclaimable`);
  console.log(`Report: ${options.reportPath}`);
  if (deletion.failures.length) process.exitCode = 1;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.restorePath) await runRestore(options);
  else await runPrune(options);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 2;
  });
}
