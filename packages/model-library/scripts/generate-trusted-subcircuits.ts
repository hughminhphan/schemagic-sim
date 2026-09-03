import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { parseSpiceLibrary, sanitize } from "@opencircuit/model-import";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "..");
const repositoryRoot = resolve(packageRoot, "../..");
const modelsRoot = join(packageRoot, "models");
const generatedPath = join(packageRoot, "src/generated/trusted-subcircuits.ts");
const validatorPath = join(repositoryRoot, "packages/component-schema/validate-package.mjs");
const admissionPolicyPath = join(packageRoot, "admission-policy.json");

const MAX_INPUT_BYTES = 1_048_576;
const ENTRYPOINT_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const ASSET_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export const TRUSTED_SUBCIRCUIT_PACKAGE_ALLOWLIST = [
  "ams1117/AMS1117-3.3",
  "microchip/MCP1700-3302E",
  "microchip/MCP6002",
  "microchip/MCP6004",
  "microchip/MCP6561",
  "nexperia/74HC00",
  "nexperia/74HC02",
  "nexperia/74HC04",
  "nexperia/74HC08",
  "nexperia/74HC14",
  "nexperia/74HC32",
  "nexperia/74HC86",
  "renesas/ICM7555",
  "senba/GL5528",
  "st/LM317T",
  "st/LM337",
  "st/LM7805",
  "st/LM7812",
  "st/TIP120",
  "st/TIP125",
  "ti/LM1117-5.0",
  "ti/LM13700",
  "ti/LM311",
  "ti/LM324",
  "ti/LM339",
  "ti/LM35",
  "ti/LM358",
  "ti/LM386",
  "ti/LM393",
  "ti/LM4040A25",
  "ti/LM4562",
  "ti/LM741",
  "ti/LM833",
  "ti/LMC555",
  "ti/LMV358",
  "ti/NE5532",
  "ti/NE5534",
  "ti/NE555",
  "ti/OP07C",
  "ti/OPA2134",
  "ti/TL071",
  "ti/TL072",
  "ti/TL074",
  "ti/TL081",
  "ti/TL084",
  "ti/TL431",
  "ti/TLC555",
  "ti/TLV3702",
  "ti/TLV9062",
  "vishay/NTCLE100E3103JB0",
] as const;

interface ComponentDocument {
  model_type: string;
  generator?: { tool_or_agent?: string };
  reviewer?: { tool_or_agent?: string };
  test_results?: { status?: string };
  symbol_pins: Array<{ number: string }>;
  spice_pin_mapping: Array<{ symbol_pin_number: string; subckt_node: string; order: number }>;
}

interface ValidationResultsDocument {
  native_wasm_all_pass: boolean;
  expectations_all_pass: boolean;
  expectation_fail_count: number;
  benches: Array<{ analysis?: string; native_wasm_pass: boolean | null; engine_note?: string; checks?: Array<{ pass?: boolean }> }>;
}

interface GeneratedAsset {
  packageId: string;
  assetId: string;
  contentHash: `sha256:${string}`;
  entrypoint: string;
  symbolPinOrder: string[];
  canonicalText: string;
}

export function isCompletedActorIdentity(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const normalized = value.trim();
  return normalized.length > 0 && !/^pending(?:-|$)/iu.test(normalized);
}

function fail(packageId: string, message: string): never {
  throw new Error(`trusted subcircuit ${packageId}: ${message}`);
}

function inventoryPackageIds(): string[] {
  const packages: string[] = [];
  for (const manufacturer of readdirSync(modelsRoot, { withFileTypes: true })) {
    if (!manufacturer.isDirectory()) throw new Error(`model-library manufacturer ${manufacturer.name} is not a real directory`);
    for (const componentPackage of readdirSync(join(modelsRoot, manufacturer.name), { withFileTypes: true })) {
      if (!componentPackage.isDirectory()) throw new Error(`model-library package ${manufacturer.name}/${componentPackage.name} is not a real directory`);
      packages.push(`${manufacturer.name}/${componentPackage.name}`);
    }
  }
  return packages.sort();
}

function admissionSets(): { legacy: Set<string>; strict: Set<string> } {
  const policy = JSON.parse(readFileSync(admissionPolicyPath, "utf8")) as {
    legacy_inventory?: { packages?: unknown };
    strict_evidence_contract_packages?: unknown;
  };
  const legacy = policy.legacy_inventory?.packages;
  const strict = policy.strict_evidence_contract_packages;
  if (!Array.isArray(legacy) || !legacy.every((entry) => typeof entry === "string")) throw new Error("invalid legacy admission policy");
  if (!Array.isArray(strict) || !strict.every((entry) => typeof entry === "string")) throw new Error("invalid strict admission policy");
  return { legacy: new Set(legacy), strict: new Set(strict) };
}

function validatePackage(packageId: string, packageDirectory: string, strict: boolean): void {
  const result = spawnSync(process.execPath, [validatorPath, ...(strict ? ["--require-evidence-contract"] : []), packageDirectory], {
    encoding: "utf8",
    timeout: 30_000,
  });
  if (result.status !== 0) fail(packageId, `component-schema validation failed: ${result.stdout}${result.stderr}`);
}

function checkedPinOrder(packageId: string, component: ComponentDocument, derivedPinCount: number): string[] {
  if (!Array.isArray(component.symbol_pins) || !Array.isArray(component.spice_pin_mapping)) fail(packageId, "pin metadata is missing");
  const symbolPins = component.symbol_pins.map((pin) => pin.number);
  if (new Set(symbolPins).size !== symbolPins.length) fail(packageId, "symbol pin numbers are not unique");
  const ordered = [...component.spice_pin_mapping].sort((left, right) => left.order - right.order);
  if (ordered.length !== derivedPinCount || ordered.length !== symbolPins.length) fail(packageId, "declared and derived pin counts differ");
  if (!ordered.every((mapping, index) => mapping.order === index + 1)) fail(packageId, "SPICE pin orders must be contiguous from one");
  const mappedPins = ordered.map((mapping) => mapping.symbol_pin_number);
  if (new Set(mappedPins).size !== mappedPins.length || mappedPins.some((pin) => !symbolPins.includes(pin))) fail(packageId, "SPICE pin mapping is not an exact symbol-pin permutation");
  if (ordered.some((mapping) => typeof mapping.subckt_node !== "string" || mapping.subckt_node.length === 0)) fail(packageId, "SPICE subcircuit node labels must be non-empty");
  return mappedPins;
}

function buildAsset(packageId: string, strict: boolean): GeneratedAsset {
  const packageDirectory = join(modelsRoot, ...packageId.split("/"));
  validatePackage(packageId, packageDirectory, strict);
  const component = JSON.parse(readFileSync(join(packageDirectory, "component.json"), "utf8")) as ComponentDocument;
  if (component.model_type !== "subckt") fail(packageId, "allowlisted package is not model_type=subckt");
  if (component.test_results?.status !== "complete") fail(packageId, "model validation is not complete");
  const reviewerRaw = component.reviewer?.tool_or_agent;
  const generatorRaw = component.generator?.tool_or_agent;
  const reviewer = typeof reviewerRaw === "string" ? reviewerRaw.trim() : "";
  const generator = typeof generatorRaw === "string" ? generatorRaw.trim() : "";
  if (!isCompletedActorIdentity(reviewer)) fail(packageId, "model lacks a named completed reviewer");
  if (!isCompletedActorIdentity(generator)) fail(packageId, "model lacks a named completed generator");

  const validation = JSON.parse(readFileSync(join(packageDirectory, "validation-results.json"), "utf8")) as ValidationResultsDocument;
  if (validation.native_wasm_all_pass !== true) fail(packageId, "stored native/WASM comparison is not all-pass");
  if (validation.expectations_all_pass !== true || validation.expectation_fail_count !== 0) fail(packageId, "stored expectation validation is not all-pass");
  if (!Array.isArray(validation.benches) || validation.benches.length === 0) fail(packageId, "stored validation has no benches");
  if (validation.benches.some((bench) => bench.native_wasm_pass !== true && !(bench.native_wasm_pass === null && bench.analysis === "noise" && typeof bench.engine_note === "string" && bench.engine_note.trim().length > 0))) fail(packageId, "stored validation contains a failed, malformed, or unexplained native/WASM comparison");
  if (validation.benches.some((bench) => !Array.isArray(bench.checks) || bench.checks.some((check) => check?.pass !== true))) fail(packageId, "stored validation contains a missing, malformed, or failed expectation check");
  if (reviewer === generator) fail(packageId, "model reviewer and generator must be independent identities");

  const raw = readFileSync(join(packageDirectory, "model.cir"), "utf8");
  const parsed = parseSpiceLibrary(raw, {
    filename: "model.cir",
    maxInputBytes: MAX_INPUT_BYTES,
    maxIncludeDepth: 0,
    maxSubcktDepth: 32,
  });
  if (parsed.warnings.length !== 0) fail(packageId, `source parser warning: ${parsed.warnings[0]!.message}`);
  if (parsed.statements.some((statement) => statement.kind === "lib-section-start" || statement.kind === "lib-section-end")) fail(packageId, ".lib sections are not admitted");
  const sanitized = sanitize(parsed, { preserveComments: false });
  if (sanitized.blockedReasons.length !== 0) fail(packageId, `source sanitizer block: ${sanitized.blockedReasons[0]!.message}`);
  if (sanitized.removed.length !== 0) fail(packageId, `source sanitizer removed executable content: ${sanitized.removed[0]!.reason}`);
  const canonicalText = sanitized.cleanText;
  if (canonicalText.length === 0) fail(packageId, "canonical model is empty");

  const canonical = parseSpiceLibrary(canonicalText, {
    filename: "trusted-model.lib",
    maxInputBytes: MAX_INPUT_BYTES,
    maxIncludeDepth: 0,
    maxSubcktDepth: 32,
  });
  if (canonical.warnings.length !== 0) fail(packageId, `canonical parser warning: ${canonical.warnings[0]!.message}`);
  const resanitized = sanitize(canonical, { preserveComments: false });
  if (resanitized.blockedReasons.length !== 0 || resanitized.removed.length !== 0 || resanitized.cleanText !== canonicalText) fail(packageId, "canonical bytes are not a stable fixed-option sanitizer output");
  const topLevel = canonical.subckts.filter((subcircuit) => subcircuit.parentSubckt === undefined && subcircuit.librarySection === undefined);
  if (topLevel.length !== 1) fail(packageId, `expected exactly one top-level subcircuit, found ${topLevel.length}`);
  const entrypoint = topLevel[0]!.name;
  if (!ENTRYPOINT_PATTERN.test(entrypoint)) fail(packageId, "entrypoint is not a safe Circuit V2 identifier");
  const symbolPinOrder = checkedPinOrder(packageId, component, topLevel[0]!.pins.length);

  const assetId = `schemagic.model-library:${packageId.replace("/", ":")}`;
  if (!ASSET_ID_PATTERN.test(assetId)) fail(packageId, "derived asset ID is outside the Circuit V2 identifier grammar");
  return {
    packageId,
    assetId,
    contentHash: `sha256:${createHash("sha256").update(canonicalText, "utf8").digest("hex")}`,
    entrypoint,
    symbolPinOrder,
    canonicalText,
  };
}

export function buildTrustedSubcircuitAssets(): GeneratedAsset[] {
  const inventory = new Set(inventoryPackageIds());
  const allowlist = [...TRUSTED_SUBCIRCUIT_PACKAGE_ALLOWLIST];
  if (new Set(allowlist).size !== allowlist.length || !allowlist.every((entry, index) => index === 0 || allowlist[index - 1]! < entry)) throw new Error("trusted subcircuit allowlist must be unique and bytewise sorted");
  const admission = admissionSets();
  const assets = allowlist.map((packageId) => {
    if (!inventory.has(packageId)) fail(packageId, "allowlisted package is absent from the library inventory");
    const isLegacy = admission.legacy.has(packageId);
    const isStrict = admission.strict.has(packageId);
    if (isLegacy === isStrict) fail(packageId, "package must occur in exactly one code-owned admission-policy set");
    return buildAsset(packageId, isStrict);
  });
  if (new Set(assets.map((asset) => asset.assetId)).size !== assets.length) throw new Error("trusted subcircuit asset IDs are not unique");
  if (new Set(assets.map((asset) => asset.contentHash)).size !== assets.length) throw new Error("trusted subcircuit canonical hashes are not unique");
  return assets;
}

export function generateTrustedSubcircuitSource(): string {
  const assets = buildTrustedSubcircuitAssets();
  const payload = assets.map((asset) => ({
    packageId: asset.packageId,
    ref: { assetId: asset.assetId, contentHash: asset.contentHash, entrypoint: asset.entrypoint },
    symbolPinOrder: asset.symbolPinOrder,
    canonicalText: asset.canonicalText,
  }));
  return [
    "// Generated by scripts/generate-trusted-subcircuits.ts. Do not edit by hand.",
    "// This is an exact code-owned admission list, not a discovery cache.",
    `export const GENERATED_TRUSTED_SUBCIRCUITS = ${JSON.stringify(payload, null, 2)} as const;`,
    "",
  ].join("\n");
}

function runCli(): void {
  const generated = generateTrustedSubcircuitSource();
  if (process.argv.includes("--write")) {
    writeFileSync(generatedPath, generated, "utf8");
    return;
  }
  const tracked = readFileSync(generatedPath, "utf8");
  if (tracked !== generated) throw new Error("generated trusted subcircuit registry is stale; run npm run generate:trusted-registry --workspace=@opencircuit/model-library");
}

if (process.argv.includes("--write") || process.argv.includes("--check")) runCli();
