import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  classify,
  parseArgs,
  restoreFromList,
} from "../scripts/prune-intermediates.mjs";

const execFileAsync = promisify(execFile);
const PRUNE_SCRIPT = fileURLToPath(new URL("../scripts/prune-intermediates.mjs", import.meta.url));

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function fixture() {
  const root = await mkdtemp(join(process.env.TMPDIR ?? tmpdir(), "opencircuit-prune-test-"));
  const partFeederDataRoot = join(root, "tools/part-feeder/data");
  const conveyorDataRoot = join(root, "tools/conveyor/data");
  const libraryRoot = join(root, "packages/model-library/models");
  const campaignRoot = join(root, "docs/campaigns");
  await Promise.all([
    mkdir(partFeederDataRoot, { recursive: true }),
    mkdir(conveyorDataRoot, { recursive: true }),
    mkdir(libraryRoot, { recursive: true }),
    mkdir(campaignRoot, { recursive: true }),
  ]);
  return {
    root,
    options: {
      apply: false,
      allowExternalRoot: true,
      partFeederDataRoot,
      conveyorDataRoot,
      libraryRoot,
      campaignRoot,
      reportPath: join(root, "report.json"),
    },
  };
}

async function addManifest(directory, records) {
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "manifest.json"), `${JSON.stringify({ datasheets: records }, null, 2)}\n`);
}

test("parseArgs defaults to dry-run and rejects external data roots without an override", () => {
  assert.equal(parseArgs([]).apply, false);
  assert.throws(
    () => parseArgs(["--part-feeder-data-root", "/outside/part-feeder"]),
    /--allow-external-root/,
  );
  assert.throws(
    () => parseArgs(["--conveyor-data-root", "/outside/conveyor"]),
    /--allow-external-root/,
  );
  const allowed = parseArgs([
    "--allow-external-root",
    "--part-feeder-data-root", "/outside/part-feeder",
    "--conveyor-data-root", "/outside/conveyor",
  ]);
  assert.equal(allowed.partFeederDataRoot, "/outside/part-feeder");
  assert.equal(allowed.conveyorDataRoot, "/outside/conveyor");
});

test("CLI default dry-run reports candidates without deleting them", async (t) => {
  const { root, options } = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const candidate = join(options.partFeederDataRoot, "downloads/cache.z99");
  await mkdir(join(options.partFeederDataRoot, "downloads"), { recursive: true });
  await writeFile(candidate, "dry-run candidate");

  await execFileAsync(process.execPath, [
    PRUNE_SCRIPT,
    "--allow-external-root",
    "--part-feeder-data-root", options.partFeederDataRoot,
    "--conveyor-data-root", options.conveyorDataRoot,
    "--library-root", options.libraryRoot,
    "--report", options.reportPath,
  ]);

  assert.equal(await readFile(candidate, "utf8"), "dry-run candidate");
  const report = JSON.parse(await readFile(options.reportPath, "utf8"));
  assert.equal(report.mode, "dry-run");
  assert.equal(report.summary.deleteFiles, 1);
  assert.equal(report.deletion.performed, false);
  assert.equal(report.deletion.deleted, 0);
});

test("classification protects nested staging, campaign citations, and non-PDF records before deletion rules", async (t) => {
  const { root, options } = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));

  const protectedPdf = Buffer.from("protected staging PDF");
  const protectedDir = join(options.conveyorDataRoot, "batch-1/staging/tranche/datasheets");
  await mkdir(protectedDir, { recursive: true });
  await writeFile(join(protectedDir, "protected.pdf"), protectedPdf);
  await addManifest(join(options.conveyorDataRoot, "batch-1"), [{
    status: "downloaded",
    path: "staging/tranche/datasheets/protected.pdf",
    sha256: digest(protectedPdf),
    url: "https://example.test/protected.pdf",
  }]);

  const citedPdf = Buffer.from("campaign cited PDF");
  const citedDir = join(options.conveyorDataRoot, "batch-2/datasheets");
  await mkdir(citedDir, { recursive: true });
  await writeFile(join(citedDir, "cited.pdf"), citedPdf);
  await addManifest(join(options.conveyorDataRoot, "batch-2"), [{
    status: "downloaded",
    path: "datasheets/cited.pdf",
    sha256: digest(citedPdf),
    url: "https://example.test/cited.pdf",
  }]);
  await writeFile(join(options.campaignRoot, "selection.json"), `${JSON.stringify({
    source_path: "tools/conveyor/data/batch-2/datasheets/cited.pdf",
  })}\n`);

  const deletablePdf = Buffer.from("uncited closed PDF");
  const deletableDir = join(options.conveyorDataRoot, "batch-3/datasheets");
  await mkdir(deletableDir, { recursive: true });
  await writeFile(join(deletableDir, "delete.pdf"), deletablePdf);
  await addManifest(join(options.conveyorDataRoot, "batch-3"), [{
    status: "downloaded",
    path: "datasheets/delete.pdf",
    sha256: digest(deletablePdf),
    url: "https://example.test/delete.pdf",
  }]);

  const ledgerBytes = Buffer.from("{}\n");
  const manifestOnlyBytes = Buffer.from("manifest-listed non-PDF");
  const orderingDir = join(options.conveyorDataRoot, "batch-4");
  await mkdir(orderingDir, { recursive: true });
  await writeFile(join(orderingDir, "completion-ledger.jsonl"), ledgerBytes);
  await writeFile(join(orderingDir, "artifact.bin"), manifestOnlyBytes);
  await addManifest(orderingDir, [{
    status: "downloaded",
    path: "completion-ledger.jsonl",
    sha256: digest(ledgerBytes),
    url: "https://example.test/not-a-pdf",
  }, {
    status: "downloaded",
    path: "artifact.bin",
    sha256: digest(manifestOnlyBytes),
    url: "https://example.test/artifact.bin",
  }]);

  const downloads = join(options.partFeederDataRoot, "downloads");
  await mkdir(downloads, { recursive: true });
  await writeFile(join(downloads, "cache.z01"), "regenerable");
  await writeFile(join(downloads, "cache.z02"), "cited intermediate");
  await writeFile(join(options.campaignRoot, "review.md"), "Evidence: `tools/part-feeder/data/downloads/cache.z02`\n");

  const files = await classify(options);
  const byRelativePath = new Map(files.map((file) => [file.relativePath, file]));
  assert.match(byRelativePath.get("tools/conveyor/data/batch-1/staging/tranche/datasheets/protected.pdf").reason, /staging segment/);
  assert.equal(byRelativePath.get("tools/conveyor/data/batch-1/staging/tranche/datasheets/protected.pdf").action, "keep");
  assert.match(byRelativePath.get("tools/conveyor/data/batch-2/datasheets/cited.pdf").reason, /docs\/campaigns/);
  assert.equal(byRelativePath.get("tools/conveyor/data/batch-2/datasheets/cited.pdf").action, "keep");
  assert.equal(byRelativePath.get("tools/conveyor/data/batch-3/datasheets/delete.pdf").action, "delete");
  assert.equal(byRelativePath.get("tools/conveyor/data/batch-4/completion-ledger.jsonl").action, "keep");
  assert.match(byRelativePath.get("tools/conveyor/data/batch-4/completion-ledger.jsonl").reason, /ledger/);
  assert.equal(byRelativePath.get("tools/conveyor/data/batch-4/artifact.bin").action, "keep");
  assert.match(byRelativePath.get("tools/conveyor/data/batch-4/artifact.bin").reason, /outside bounded deletion categories/);
  assert.equal(byRelativePath.get("tools/part-feeder/data/downloads/cache.z01").action, "delete");
  assert.equal(byRelativePath.get("tools/part-feeder/data/downloads/cache.z02").action, "keep");
  assert.match(byRelativePath.get("tools/part-feeder/data/downloads/cache.z02").reason, /docs\/campaigns/);
  assert.equal(options.apply, false);
});

test("restore mode verifies SHA-256 before writing", async (t) => {
  const { root, options } = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const payload = Buffer.from("restored PDF bytes");
  const server = createServer((request, response) => {
    response.writeHead(200, { "content-type": "application/pdf" });
    response.end(payload);
  });
  await new Promise((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise));
  t.after(() => new Promise((resolvePromise) => server.close(resolvePromise)));
  const { port } = server.address();
  const restorePath = join(root, "deletion-list.json");
  await writeFile(restorePath, `${JSON.stringify({ files: [{
    relativePath: "tools/conveyor/data/batch-5/datasheets/restored.pdf",
    bytes: payload.byteLength,
    recordedSha256: digest(payload),
    recordedUrl: `http://127.0.0.1:${port}/restored.pdf`,
  }] })}\n`);
  options.restorePath = restorePath;
  const result = await restoreFromList(options);
  assert.deepEqual(result, { requested: 1, restored: 1, restoredBytes: payload.byteLength, alreadyPresent: 0, failures: [] });
  const destination = join(options.conveyorDataRoot, "batch-5/datasheets/restored.pdf");
  assert.deepEqual(await readFile(destination), payload);

  await writeFile(restorePath, `${JSON.stringify({ files: [{
    relativePath: "tools/conveyor/data/batch-5/datasheets/restored.pdf",
    bytes: payload.byteLength,
    recordedSha256: "0".repeat(64),
    recordedUrl: `http://127.0.0.1:${port}/restored.pdf`,
  }] })}\n`);
  const mismatch = await restoreFromList(options);
  assert.equal(mismatch.restored, 0);
  assert.equal(mismatch.failures.length, 1);
  assert.match(mismatch.failures[0].error, /refusing to overwrite/);
  assert.deepEqual(await readFile(destination), payload);
});
