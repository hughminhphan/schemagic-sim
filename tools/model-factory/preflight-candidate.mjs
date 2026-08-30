#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  repairKnownEvidenceDefects,
  validateBulkCandidateEvidence,
} from "./lib/bulk-adapter.mjs";

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!["--part", "--extraction", "--datasheet"].includes(flag) || value === undefined) {
      throw new Error("usage: preflight-candidate.mjs --part PART.json --extraction EXTRACTION.json --datasheet DATASHEET.pdf");
    }
    values[flag.slice(2)] = value;
  }
  for (const name of ["part", "extraction", "datasheet"]) {
    if (!values[name]) throw new Error(`missing --${name}`);
  }
  return values;
}

function loadJson(file, label) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`${label} is not readable JSON: ${error.message}`);
  }
}

export function runCandidatePreflight({ partPath, extractionPath, datasheetPath }) {
  const resolvedDatasheet = path.resolve(datasheetPath);
  if (!fs.statSync(resolvedDatasheet).isFile()) throw new Error("datasheet path is not a regular file");
  const part = {
    ...loadJson(partPath, "part"),
    datasheet_path: resolvedDatasheet,
  };
  const extraction = repairKnownEvidenceDefects(
    part,
    loadJson(extractionPath, "extraction"),
  );
  const accepted = validateBulkCandidateEvidence(part, extraction);
  return {
    schema_version: "1.0.0",
    status: "accepted",
    family: accepted.family,
    route: accepted.route,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  try {
    process.stdout.write(`${JSON.stringify(runCandidatePreflight({
      partPath: path.resolve(args.part),
      extractionPath: path.resolve(args.extraction),
      datasheetPath: path.resolve(args.datasheet),
    }), null, 2)}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({
      schema_version: "1.0.0",
      status: "rejected",
      reason: error.message,
    }, null, 2)}\n`);
    process.exitCode = 2;
  }
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
