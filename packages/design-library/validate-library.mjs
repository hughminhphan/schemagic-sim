import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PART_CLASS_IDS,
  loadReviewedDesignLibraryEnvelope,
  validateCodecRegistryBoundary,
  validateCommercialDataBoundary,
  validateDesignLibrary,
  validateDesignLibraryEnvelope,
} from "./src/index.ts";

const root = dirname(fileURLToPath(import.meta.url));
const json = async (path) => JSON.parse(await readFile(join(root, path), "utf8"));
const prefix = (base, entries) => entries.map((entry) => ({ ...entry, path: entry.path ? `${base}.${entry.path}` : base }));
const profileFiles = async (directory) => {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === "ENOENT") return [];
    throw error;
  }
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await profileFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".json")) files.push(path);
  }
  return files.sort();
};
const manufacturerRegistry = await json("manufacturers.json");
const admission = await json("admission.json");
const catalogRelease = await json("catalog-release.json");
const profiles = {};
for (const file of await profileFiles(join(root, "parts"))) {
  const packagePath = `packages/design-library/${relative(root, file).split(sep).join("/")}`;
  profiles[packagePath] = JSON.parse(await readFile(file, "utf8"));
}
const documents = { manufacturerRegistry, admission, catalogRelease, profiles };
const hasFactsV2Profiles = Object.values(profiles).some((profile) => profile?.factsSchemaVersion === "2.0.0");
const issues = [
  ...(hasFactsV2Profiles ? [] : validateDesignLibrary(documents)),
  ...validateDesignLibraryEnvelope(documents),
  ...validateCodecRegistryBoundary(),
];
const schemaNames = (await readdir(join(root, "schema/facts"))).filter((name) => name.endsWith(".json"));
for (const name of schemaNames) {
  const schema = await json(`schema/facts/${name}`);
  issues.push(...prefix(`schema.facts.${name}`, validateCommercialDataBoundary(schema)));
}
for (const name of ["profile.v1.schema.json", "profile-envelope.v1.schema.json", "profile.facts-v2.schema.json", "profile-envelope.facts-v2.schema.json", "profile.facts-v3.schema.json", "profile-envelope.facts-v3.schema.json", "profile.facts-v3-1.schema.json", "profile-envelope.facts-v3-1.schema.json", "profile.facts-v3-2.schema.json", "profile-envelope.facts-v3-2.schema.json", "manufacturer-registry.v1.schema.json", "admission.v1.schema.json", "catalog-release.v1.schema.json"]) {
  const schema = await json(`schema/${name}`);
  issues.push(...prefix(`schema.${name}`, validateCommercialDataBoundary(schema)));
}
const expectedV1SchemaNames = PART_CLASS_IDS.map((partClass) => `${partClass}.v1.schema.json`).sort();
const expectedV2SchemaNames = PART_CLASS_IDS.map((partClass) => `${partClass}.v2.schema.json`).sort();
const actualV1SchemaNames = schemaNames.filter((name) => name.endsWith(".v1.schema.json")).sort();
const actualV2SchemaNames = schemaNames.filter((name) => name.endsWith(".v2.schema.json")).sort();
const expectedV3SchemaNames = ["motor.supply-tvs-diode.v3.schema.json", "shared.n-channel-power-mosfet.v3.schema.json"];
const actualV3SchemaNames = schemaNames.filter((name) => name.endsWith(".v3.schema.json")).sort();
const expectedV31SchemaNames = ["motor.full-bridge-gate-driver.v3-1.schema.json"];
const actualV31SchemaNames = schemaNames.filter((name) => name.endsWith(".v3-1.schema.json")).sort();
const expectedV32SchemaNames = ["motor.integrated-h-bridge.v3-2.schema.json"];
const actualV32SchemaNames = schemaNames.filter((name) => name.endsWith(".v3-2.schema.json")).sort();
if (JSON.stringify(actualV1SchemaNames) !== JSON.stringify(expectedV1SchemaNames)) issues.push({ path: "schema/facts", code: "codec_schema_coverage", message: "Expected one frozen V1 language-neutral fact schema for each of twelve classes" });
if (JSON.stringify(actualV2SchemaNames) !== JSON.stringify(expectedV2SchemaNames)) issues.push({ path: "schema/facts", code: "codec_schema_coverage", message: "Expected one additive facts-V2 language-neutral fact schema for each of twelve classes" });
if (JSON.stringify(actualV3SchemaNames) !== JSON.stringify(expectedV3SchemaNames)) issues.push({ path: "schema/facts", code: "codec_schema_coverage", message: "Expected facts-V3 schemas only for the selected MOSFET and supply-TVS classes" });
if (JSON.stringify(actualV31SchemaNames) !== JSON.stringify(expectedV31SchemaNames)) issues.push({ path: "schema/facts", code: "codec_schema_coverage", message: "Expected facts 3.1.0 schema only for the selected Motor gate-driver class" });
if (JSON.stringify(actualV32SchemaNames) !== JSON.stringify(expectedV32SchemaNames)) issues.push({ path: "schema/facts", code: "codec_schema_coverage", message: "Expected facts 3.2.0 schema only for the selected Motor integrated H-bridge class" });
let loadedEnvelope;
if (issues.length === 0) {
  try {
    loadedEnvelope = loadReviewedDesignLibraryEnvelope(documents);
  } catch (error) {
    issues.push({ path: "catalogRelease", code: "reviewed_loader_failure", message: error instanceof Error ? error.message : String(error) });
  }
}
if (issues.length > 0) {
  for (const entry of issues) process.stderr.write(`${entry.path} [${entry.code}] ${entry.message}\n`);
  process.exitCode = 1;
} else process.stdout.write(`scheMAGIC design-library contracts valid; ${loadedEnvelope?.profiles.length ?? 0} reviewed production profiles.\n`);
