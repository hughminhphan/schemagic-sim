import type { EvidenceRef } from "@opencircuit/design-schema";
import { isManufacturerId } from "@opencircuit/sourcing-schema";
import { REVIEWED_REAL_LICENSE_NOTE } from "./catalog";
import { REVIEWED_REAL_MANUFACTURER_ALLOWLIST } from "./manufacturer-allowlist";
import {
  GATE_DRIVER_FACT_IDS,
  INTEGRATED_BRIDGE_FACT_IDS,
  type ReviewedFact,
  type ReviewedManufacturer,
  type ReviewedRealMotorCatalog,
  type ReviewedRealMotorProfile,
} from "./types";

const CATALOG_KEYS = ["schemaVersion", "catalogId", "provenanceState", "catalogAdmission", "retrievedAt", "manufacturers", "integratedBridges", "gateDrivers"];
const MANUFACTURER_KEYS = ["id", "displayName", "primarySourceHosts"];
const PROFILE_KEYS = ["id", "kind", "part", "identityEvidence", "package", "authorship", "facts"];
const PART_KEYS = ["manufacturerId", "manufacturerPartNumber"];
const PACKAGE_KEYS = ["name", "bodyAreaM2"];
const AUTHORSHIP_KEYS = ["provenanceState", "catalogAdmission", "ownerTrack", "authoredAt", "note"];
const FACT_KEYS = ["value", "state", "evidence", "explanation"];
const EVIDENCE_KEYS = ["sourceId", "locator", "retrievedAt", "contentHash", "licenseNote"];

const STRING_FACTS = new Set(["bridgeTopology", "powerStage", "highSideSupply", "package.name"]);
const DUTY_FACTS = new Set(["maximumHighSideDutyCycle", "bootstrapMaximumDutyCycle"]);
const ID_PATTERN = /^motor\.real\.(?:integrated|gate-driver)\.[a-z0-9][a-z0-9.-]*$/;
const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const MANUFACTURER_ALLOWLIST_BY_ID = new Map(REVIEWED_REAL_MANUFACTURER_ALLOWLIST.map((entry) => [entry.id, entry]));

function fail(path: string, message: string): never {
  throw new Error(`${path}: ${message}`);
}

function objectAt(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(path, "must be a plain object");
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail(path, "must be a plain object");
  return value as Record<string, unknown>;
}

function exactKeys(value: unknown, expected: readonly string[], path: string): Record<string, unknown> {
  const object = objectAt(value, path);
  const expectedSet = new Set(expected);
  for (const key of Object.keys(object)) if (!expectedSet.has(key)) fail(`${path}.${key}`, "unknown key in closed schema");
  for (const key of expected) {
    if (key === "contentHash") continue;
    if (!Object.prototype.hasOwnProperty.call(object, key)) fail(`${path}.${key}`, "required key is missing");
  }
  return object;
}

function stringAt(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim() === "") fail(path, "must be a non-empty string");
  return value;
}

function finitePositive(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) fail(path, "must be a finite positive number");
  return value;
}

function timestampAt(value: unknown, path: string): string {
  const timestamp = stringAt(value, path);
  if (!TIMESTAMP_PATTERN.test(timestamp) || Number.isNaN(Date.parse(timestamp))) fail(path, "must be an RFC 3339 timestamp with an explicit offset");
  return timestamp;
}

function evidenceAt(value: unknown, path: string, manufacturer: ReviewedManufacturer): void {
  const evidence = exactKeys(value, EVIDENCE_KEYS, path) as unknown as EvidenceRef;
  let url: URL;
  try {
    url = new URL(stringAt(evidence.sourceId, `${path}.sourceId`));
  } catch {
    fail(`${path}.sourceId`, "must be an official manufacturer URL");
  }
  if (url.protocol !== "https:") fail(`${path}.sourceId`, "must use HTTPS");
  if (!manufacturer.primarySourceHosts.includes(url.hostname.toLowerCase())) {
    fail(`${path}.sourceId`, `host is not registered for manufacturer ${manufacturer.id}`);
  }
  const locator = stringAt(evidence.locator, `${path}.locator`);
  if (!/(?:\bpage\s+\d+\b|official product page)/i.test(locator)) {
    fail(`${path}.locator`, "must identify a page or official product-page location");
  }
  timestampAt(evidence.retrievedAt, `${path}.retrievedAt`);
  if (evidence.licenseNote !== REVIEWED_REAL_LICENSE_NOTE) fail(`${path}.licenseNote`, "must use the non-redistribution provenance note");
  if (evidence.contentHash !== undefined && (typeof evidence.contentHash !== "string" || !HASH_PATTERN.test(evidence.contentHash))) {
    fail(`${path}.contentHash`, "must be a lowercase sha256 digest");
  }
}

function evidenceListAt(value: unknown, path: string, manufacturer: ReviewedManufacturer, allowEmpty: boolean): void {
  if (!Array.isArray(value)) fail(path, "must be an evidence array");
  if (!allowEmpty && value.length === 0) fail(path, "must contain primary-source evidence");
  value.forEach((entry, index) => evidenceAt(entry, `${path}[${index}]`, manufacturer));
}

function factAt(value: unknown, factId: string, path: string, manufacturer: ReviewedManufacturer): void {
  const fact = exactKeys(value, FACT_KEYS, path) as unknown as ReviewedFact;
  stringAt(fact.explanation, `${path}.explanation`);
  if (fact.state === "unknown") {
    if (fact.value !== null) fail(`${path}.value`, "unknown facts must be null");
    if (!Array.isArray(fact.evidence) || fact.evidence.length !== 0) fail(`${path}.evidence`, "unknown facts must have empty evidence");
    return;
  }
  if (fact.state !== "reviewed") fail(`${path}.state`, "must be reviewed or unknown");
  if (fact.value === null) fail(`${path}.value`, "reviewed facts cannot be null");
  evidenceListAt(fact.evidence, `${path}.evidence`, manufacturer, false);
  if (STRING_FACTS.has(factId)) {
    stringAt(fact.value, `${path}.value`);
  } else {
    const number = finitePositive(fact.value, `${path}.value`);
    if (DUTY_FACTS.has(factId) && number > 1) fail(`${path}.value`, "duty cycle must not exceed 1");
  }
}

function knownNumber(profile: ReviewedRealMotorProfile, factId: string): number | undefined {
  const fact = (profile.facts as Record<string, ReviewedFact>)[factId];
  return fact?.state === "reviewed" && typeof fact.value === "number" ? fact.value : undefined;
}

function ordered(profile: ReviewedRealMotorProfile, lowerId: string, upperId: string, path: string, allowEqual = false): void {
  const lower = knownNumber(profile, lowerId);
  const upper = knownNumber(profile, upperId);
  if (lower === undefined || upper === undefined) return;
  if (allowEqual ? lower > upper : lower >= upper) fail(path, `${lowerId} must be ${allowEqual ? "at most" : "less than"} ${upperId}`);
}

function profileAt(value: unknown, expectedKind: ReviewedRealMotorProfile["kind"], path: string): ReviewedRealMotorProfile {
  const object = exactKeys(value, PROFILE_KEYS, path);
  const id = stringAt(object.id, `${path}.id`);
  if (!ID_PATTERN.test(id)) fail(`${path}.id`, "must be a stable reviewed-real motor profile ID");
  const expectedIdPrefix = expectedKind === "integrated_bridge" ? "motor.real.integrated." : "motor.real.gate-driver.";
  if (!id.startsWith(expectedIdPrefix)) fail(`${path}.id`, `must start with ${expectedIdPrefix} for ${expectedKind}`);
  if (/synthetic/i.test(id)) fail(`${path}.id`, "reviewed-real profiles cannot use synthetic identities");
  if (object.kind !== expectedKind) fail(`${path}.kind`, `must be ${expectedKind}`);

  const part = exactKeys(object.part, PART_KEYS, `${path}.part`);
  const manufacturerId = stringAt(part.manufacturerId, `${path}.part.manufacturerId`);
  if (!isManufacturerId(manufacturerId)) fail(`${path}.part.manufacturerId`, "must be a stable lowercase registry key");
  const manufacturer = MANUFACTURER_ALLOWLIST_BY_ID.get(manufacturerId);
  if (manufacturer === undefined) fail(`${path}.part.manufacturerId`, "must reference the code-owned manufacturer allowlist");
  const mpn = stringAt(part.manufacturerPartNumber, `${path}.part.manufacturerPartNumber`);
  if (mpn !== mpn.trim()) fail(`${path}.part.manufacturerPartNumber`, "must not contain surrounding whitespace");
  if (/synthetic/i.test(mpn)) fail(`${path}.part.manufacturerPartNumber`, "reviewed-real profiles require an exact real MPN");
  evidenceListAt(object.identityEvidence, `${path}.identityEvidence`, manufacturer, false);

  const packageFacts = exactKeys(object.package, PACKAGE_KEYS, `${path}.package`);
  factAt(packageFacts.name, "package.name", `${path}.package.name`, manufacturer);
  factAt(packageFacts.bodyAreaM2, "package.bodyAreaM2", `${path}.package.bodyAreaM2`, manufacturer);

  const authorship = exactKeys(object.authorship, AUTHORSHIP_KEYS, `${path}.authorship`);
  if (authorship.provenanceState !== "authored_from_primary_sources") fail(`${path}.authorship.provenanceState`, "must be authored_from_primary_sources");
  if (authorship.catalogAdmission !== "pending_independent_review") fail(`${path}.authorship.catalogAdmission`, "must remain pending independent review");
  if (authorship.ownerTrack !== "motor") fail(`${path}.authorship.ownerTrack`, "must be motor");
  timestampAt(authorship.authoredAt, `${path}.authorship.authoredAt`);
  stringAt(authorship.note, `${path}.authorship.note`);

  const factIds = expectedKind === "integrated_bridge" ? INTEGRATED_BRIDGE_FACT_IDS : GATE_DRIVER_FACT_IDS;
  const facts = exactKeys(object.facts, factIds, `${path}.facts`);
  for (const factId of factIds) factAt(facts[factId], factId, `${path}.facts.${factId}`, manufacturer);

  const profile = value as ReviewedRealMotorProfile;
  if ((profile.facts.bridgeTopology as ReviewedFact).value !== "full_bridge") fail(`${path}.facts.bridgeTopology.value`, "must be full_bridge");
  const expectedPowerStage = expectedKind === "integrated_bridge" ? "integrated_fet" : "external_n_channel_mosfet";
  if ((profile.facts.powerStage as ReviewedFact).value !== expectedPowerStage) fail(`${path}.facts.powerStage.value`, `must be ${expectedPowerStage}`);
  const highSideSupply = (profile.facts.highSideSupply as ReviewedFact).value;
  if (highSideSupply !== null && !["charge_pump", "bootstrap_with_charge_pump", "bootstrap_with_top_off_charge_pump"].includes(String(highSideSupply))) {
    fail(`${path}.facts.highSideSupply.value`, "unsupported high-side supply classification");
  }
  ordered(profile, "supplyMinimumV", "supplyMaximumV", `${path}.facts.supplyMinimumV`);
  ordered(profile, "supplyMaximumV", "absoluteMaximumV", `${path}.facts.supplyMaximumV`, true);
  ordered(profile, "continuousCurrentA", "peakCurrentA", `${path}.facts.continuousCurrentA`, true);
  ordered(profile, "currentLimitMinimumA", "currentLimitMaximumA", `${path}.facts.currentLimitMinimumA`, true);
  ordered(profile, "operatingAmbientMinimumK", "operatingAmbientMaximumK", `${path}.facts.operatingAmbientMinimumK`);
  ordered(profile, "driverBiasMinimumV", "driverBiasMaximumV", `${path}.facts.driverBiasMinimumV`);
  return profile;
}

export function validateReviewedRealMotorCatalog(value: unknown): asserts value is ReviewedRealMotorCatalog {
  const catalog = exactKeys(value, CATALOG_KEYS, "catalog");
  if (catalog.schemaVersion !== "motor-primary-source-tranche.v1alpha2") fail("catalog.schemaVersion", "unsupported schema version");
  if (catalog.catalogId !== "schemagic-motor-a4-primary-tranche") fail("catalog.catalogId", "unexpected catalog identity");
  if (catalog.provenanceState !== "authored_from_primary_sources") fail("catalog.provenanceState", "must be authored_from_primary_sources");
  if (catalog.catalogAdmission !== "pending_independent_review") fail("catalog.catalogAdmission", "must remain pending independent review");
  timestampAt(catalog.retrievedAt, "catalog.retrievedAt");

  if (!Array.isArray(catalog.manufacturers)) fail("catalog.manufacturers", "must be an array");
  if (catalog.manufacturers.length !== REVIEWED_REAL_MANUFACTURER_ALLOWLIST.length) {
    fail("catalog.manufacturers", "must exactly match the code-owned manufacturer allowlist; extra or missing manufacturers are forbidden");
  }
  for (const [index, value] of catalog.manufacturers.entries()) {
    const path = `catalog.manufacturers[${index}]`;
    const entry = exactKeys(value, MANUFACTURER_KEYS, path);
    const expected = REVIEWED_REAL_MANUFACTURER_ALLOWLIST[index]!;
    const id = stringAt(entry.id, `${path}.id`);
    if (!isManufacturerId(id)) fail(`${path}.id`, "must be a stable lowercase registry key");
    if (id !== expected.id) fail(`${path}.id`, `must exactly match code-owned manufacturer ${expected.id}`);
    if (stringAt(entry.displayName, `${path}.displayName`) !== expected.displayName) fail(`${path}.displayName`, `must exactly match code-owned display name ${expected.displayName}`);
    if (!Array.isArray(entry.primarySourceHosts) || entry.primarySourceHosts.length !== expected.primarySourceHosts.length) {
      fail(`${path}.primarySourceHosts`, "must exactly match code-owned official source hosts");
    }
    for (const [hostIndex, rawHost] of entry.primarySourceHosts.entries()) {
      const host = stringAt(rawHost, `${path}.primarySourceHosts[${hostIndex}]`);
      if (host !== expected.primarySourceHosts[hostIndex]) fail(`${path}.primarySourceHosts[${hostIndex}]`, `must exactly match code-owned host ${expected.primarySourceHosts[hostIndex]}`);
    }
  }

  if (!Array.isArray(catalog.integratedBridges)) fail("catalog.integratedBridges", "must be an array");
  if (!Array.isArray(catalog.gateDrivers)) fail("catalog.gateDrivers", "must be an array");
  if (catalog.integratedBridges.length < 3) fail("catalog.integratedBridges", "must contain at least three integrated bridges");
  if (catalog.gateDrivers.length < 3) fail("catalog.gateDrivers", "must contain at least three full-bridge gate drivers");

  const profiles = [
    ...catalog.integratedBridges.map((profile, index) => profileAt(profile, "integrated_bridge", `catalog.integratedBridges[${index}]`)),
    ...catalog.gateDrivers.map((profile, index) => profileAt(profile, "gate_driver", `catalog.gateDrivers[${index}]`)),
  ];
  const profileIds = new Set<string>();
  const partKeys = new Set<string>();
  for (const [index, profile] of profiles.entries()) {
    if (profileIds.has(profile.id)) fail(`catalog.profiles[${index}].id`, "duplicate profile ID");
    profileIds.add(profile.id);
    const partKey = `${profile.part.manufacturerId}\u0000${profile.part.manufacturerPartNumber.toLocaleLowerCase("en-US")}`;
    if (partKeys.has(partKey)) fail(`catalog.profiles[${index}].part`, "duplicate manufacturer and MPN identity");
    partKeys.add(partKey);
  }

  const integratedManufacturers = new Set(profiles.filter((profile) => profile.kind === "integrated_bridge").map((profile) => profile.part.manufacturerId));
  const gateDriverManufacturers = new Set(profiles.filter((profile) => profile.kind === "gate_driver").map((profile) => profile.part.manufacturerId));
  const allManufacturers = new Set(profiles.map((profile) => profile.part.manufacturerId));
  if (integratedManufacturers.size < 3) fail("catalog.integratedBridges", "must span at least three manufacturers");
  if (gateDriverManufacturers.size < 3) fail("catalog.gateDrivers", "must span at least three manufacturers");
  if (allManufacturers.size < 3) fail("catalog", "must span at least three manufacturers overall");
}

export function assertValidReviewedRealMotorCatalog(catalog: unknown): asserts catalog is ReviewedRealMotorCatalog {
  validateReviewedRealMotorCatalog(catalog);
}
