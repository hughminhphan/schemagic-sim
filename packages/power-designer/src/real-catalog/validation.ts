import { REAL_PRIMARY_PART_CLASSES } from "./types";
import type {
  CatalogValidationIssue,
  CatalogValidationResult,
  NumericUnit,
  RealPrimaryPartCatalog,
  RealPrimaryPartClass,
} from "./types";

type JsonObject = Record<string, unknown>;

const NUMERIC_UNITS = new Set<NumericUnit>(["V", "A", "Hz", "s", "ohm", "K", "degC", "degree"]);
const PART_CLASSES = new Set<string>(REAL_PRIMARY_PART_CLASSES);
const CONTROL_MODES = new Set(["peak_current_mode", "current_mode", "voltage_mode"]);
const COMPENSATION_MODES = new Set(["internal", "external", "application_dependent"]);
const CURRENT_SENSE_MECHANISMS = new Set([
  "integrated_switch_current",
  "external_sense_resistor",
  "low_side_rds_on_or_shunt",
  "rsense_or_inductor_dcr",
]);
const TRUSTED_MANUFACTURERS: ReadonlyMap<string, { displayName: string; domains: readonly string[] }> = new Map([
  ["analog-devices", { displayName: "Analog Devices", domains: ["www.analog.com"] }],
  ["onsemi", { displayName: "onsemi", domains: ["www.onsemi.com"] }],
  ["texas-instruments", { displayName: "Texas Instruments", domains: ["www.ti.com"] }],
]);

function objectAt(value: unknown, path: string, issues: CatalogValidationIssue[]): JsonObject | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    issues.push({ path, code: "invalid_type", message: "Expected an object." });
    return null;
  }
  return value as JsonObject;
}

function exactKeys(value: JsonObject, allowed: readonly string[], path: string, issues: CatalogValidationIssue[]): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) {
      issues.push({ path: `${path}.${key}`, code: "unknown_key", message: "Unknown keys are rejected by the closed catalog contract." });
    }
  }
  for (const key of allowed) {
    if (!(key in value)) issues.push({ path: `${path}.${key}`, code: "missing_key", message: "Required key is missing." });
  }
}

function stringAt(value: unknown, path: string, issues: CatalogValidationIssue[], allowNull = false): string | null {
  if (allowNull && value === null) return null;
  if (typeof value !== "string" || value.length === 0) {
    issues.push({ path, code: "invalid_string", message: "Expected a non-empty string." });
    return null;
  }
  return value;
}

function numberOrNull(value: unknown, path: string, issues: CatalogValidationIssue[]): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    issues.push({ path, code: "invalid_number", message: "Expected a finite number or null." });
    return null;
  }
  return value;
}

function arrayAt(value: unknown, path: string, issues: CatalogValidationIssue[]): readonly unknown[] {
  if (!Array.isArray(value)) {
    issues.push({ path, code: "invalid_type", message: "Expected an array." });
    return [];
  }
  return value;
}

function validateSourceRefs(value: unknown, path: string, issues: CatalogValidationIssue[]): void {
  const refs = arrayAt(value, path, issues);
  refs.forEach((entry, index) => {
    const itemPath = `${path}[${index}]`;
    const ref = objectAt(entry, itemPath, issues);
    if (!ref) return;
    exactKeys(ref, ["sourceId", "locator"], itemPath, issues);
    stringAt(ref.sourceId, `${itemPath}.sourceId`, issues);
    stringAt(ref.locator, `${itemPath}.locator`, issues);
  });
}

function validateSourceContentHash(value: unknown, path: string, issues: CatalogValidationIssue[]): void {
  const hash = objectAt(value, path, issues);
  if (!hash) return;
  exactKeys(hash, ["state", "value", "reason"], path, issues);
  if (hash.state === "verified") {
    if (typeof hash.value !== "string" || !/^sha256:[0-9a-f]{64}$/.test(hash.value)) {
      issues.push({ path: `${path}.value`, code: "invalid_content_hash", message: "Verified source content requires a canonical lowercase sha256:<64 hex> value." });
    }
    if (hash.reason !== null) {
      issues.push({ path: `${path}.reason`, code: "verified_hash_has_reason", message: "A verified content hash must keep reason null." });
    }
  } else if (hash.state === "missing") {
    if (hash.value !== null) {
      issues.push({ path: `${path}.value`, code: "missing_hash_has_value", message: "A missing content hash must keep value null." });
    }
    stringAt(hash.reason, `${path}.reason`, issues);
  } else {
    issues.push({ path: `${path}.state`, code: "invalid_content_hash_state", message: "Expected verified or missing." });
  }
}

function validateNumericFact(
  value: unknown,
  path: string,
  expectedUnit: NumericUnit,
  issues: CatalogValidationIssue[],
  allowNegative = false,
): void {
  const fact = objectAt(value, path, issues);
  if (!fact) return;
  if (fact.state === "primary_source") {
    exactKeys(fact, ["state", "minimum", "typical", "maximum", "unit", "qualification", "sourceRefs"], path, issues);
    const minimum = numberOrNull(fact.minimum, `${path}.minimum`, issues);
    const typical = numberOrNull(fact.typical, `${path}.typical`, issues);
    const maximum = numberOrNull(fact.maximum, `${path}.maximum`, issues);
    if (minimum === null && typical === null && maximum === null) {
      issues.push({ path, code: "empty_known_fact", message: "A primary-source numeric fact must populate at least one bound." });
    }
    for (const [name, number] of [["minimum", minimum], ["typical", typical], ["maximum", maximum]] as const) {
      if (!allowNegative && number !== null && number < 0) {
        issues.push({ path: `${path}.${name}`, code: "negative_value", message: "This field cannot be negative." });
      }
    }
    if (minimum !== null && typical !== null && minimum > typical) {
      issues.push({ path, code: "invalid_range", message: "minimum must not exceed typical." });
    }
    if (typical !== null && maximum !== null && typical > maximum) {
      issues.push({ path, code: "invalid_range", message: "typical must not exceed maximum." });
    }
    if (minimum !== null && maximum !== null && minimum > maximum) {
      issues.push({ path, code: "invalid_range", message: "minimum must not exceed maximum." });
    }
    if (fact.qualification !== null) stringAt(fact.qualification, `${path}.qualification`, issues);
    const refs = arrayAt(fact.sourceRefs, `${path}.sourceRefs`, issues);
    validateSourceRefs(fact.sourceRefs, `${path}.sourceRefs`, issues);
    if (refs.length === 0) {
      issues.push({ path: `${path}.sourceRefs`, code: "missing_provenance", message: "Every populated fact requires a source URL reference and precise locator." });
    }
  } else if (fact.state === "unknown") {
    exactKeys(fact, ["state", "minimum", "typical", "maximum", "unit", "reason", "sourceRefs"], path, issues);
    for (const key of ["minimum", "typical", "maximum"] as const) {
      if (fact[key] !== null) issues.push({ path: `${path}.${key}`, code: "unknown_has_value", message: "Unknown facts must keep all values null." });
    }
    stringAt(fact.reason, `${path}.reason`, issues);
    const refs = arrayAt(fact.sourceRefs, `${path}.sourceRefs`, issues);
    validateSourceRefs(fact.sourceRefs, `${path}.sourceRefs`, issues);
    if (refs.length !== 0) issues.push({ path: `${path}.sourceRefs`, code: "unknown_has_provenance", message: "Unknown facts must use an empty sourceRefs list." });
  } else {
    issues.push({ path: `${path}.state`, code: "invalid_state", message: "Expected primary_source or unknown." });
  }

  if (fact.unit !== expectedUnit || !NUMERIC_UNITS.has(fact.unit as NumericUnit)) {
    issues.push({ path: `${path}.unit`, code: "invalid_unit", message: `Expected unit ${expectedUnit}.` });
  }
}

function validateTextFact(
  value: unknown,
  path: string,
  allowedValues: ReadonlySet<string>,
  issues: CatalogValidationIssue[],
  allowKnown = true,
): void {
  const fact = objectAt(value, path, issues);
  if (!fact) return;
  if (fact.state === "primary_source") {
    exactKeys(fact, ["state", "value", "qualification", "sourceRefs"], path, issues);
    const factValue = stringAt(fact.value, `${path}.value`, issues);
    if (!allowKnown) issues.push({ path, code: "unsupported_stability_claim", message: "Part-only profiles cannot carry a stability pass or fail claim." });
    if (factValue !== null && !allowedValues.has(factValue)) {
      issues.push({ path: `${path}.value`, code: "invalid_value", message: "Value is outside the closed enum." });
    }
    if (fact.qualification !== null) stringAt(fact.qualification, `${path}.qualification`, issues);
    const refs = arrayAt(fact.sourceRefs, `${path}.sourceRefs`, issues);
    validateSourceRefs(fact.sourceRefs, `${path}.sourceRefs`, issues);
    if (refs.length === 0) issues.push({ path: `${path}.sourceRefs`, code: "missing_provenance", message: "Every populated fact requires a source URL reference and precise locator." });
  } else if (fact.state === "unknown") {
    exactKeys(fact, ["state", "value", "reason", "sourceRefs"], path, issues);
    if (fact.value !== null) issues.push({ path: `${path}.value`, code: "unknown_has_value", message: "Unknown facts must keep value null." });
    stringAt(fact.reason, `${path}.reason`, issues);
    const refs = arrayAt(fact.sourceRefs, `${path}.sourceRefs`, issues);
    validateSourceRefs(fact.sourceRefs, `${path}.sourceRefs`, issues);
    if (refs.length !== 0) issues.push({ path: `${path}.sourceRefs`, code: "unknown_has_provenance", message: "Unknown facts must use an empty sourceRefs list." });
  } else {
    issues.push({ path: `${path}.state`, code: "invalid_state", message: "Expected primary_source or unknown." });
  }
}

function validateSource(value: unknown, path: string, issues: CatalogValidationIssue[]): void {
  const source = objectAt(value, path, issues);
  if (!source) return;
  exactKeys(
    source,
    ["sourceId", "manufacturerId", "sourceType", "title", "url", "documentId", "revision", "publicationDate", "retrievedAt", "contentHash", "retrievalMethod", "publicationRights", "licenseNote"],
    path,
    issues,
  );
  stringAt(source.sourceId, `${path}.sourceId`, issues);
  stringAt(source.manufacturerId, `${path}.manufacturerId`, issues);
  if (source.sourceType !== "manufacturer_product_page" && source.sourceType !== "manufacturer_datasheet") {
    issues.push({ path: `${path}.sourceType`, code: "invalid_source_type", message: "Only official manufacturer product pages and datasheets are allowed." });
  }
  stringAt(source.title, `${path}.title`, issues);
  const url = stringAt(source.url, `${path}.url`, issues);
  if (url !== null) {
    try {
      if (new URL(url).protocol !== "https:") throw new Error("not https");
    } catch {
      issues.push({ path: `${path}.url`, code: "invalid_url", message: "Source URL must be valid HTTPS." });
    }
  }
  for (const key of ["documentId", "revision", "publicationDate"] as const) {
    if (source[key] !== null) stringAt(source[key], `${path}.${key}`, issues);
  }
  const retrievedAt = stringAt(source.retrievedAt, `${path}.retrievedAt`, issues);
  if (retrievedAt !== null && (!Number.isFinite(Date.parse(retrievedAt)) || !/(?:Z|[+-]\d{2}:\d{2})$/.test(retrievedAt))) {
    issues.push({ path: `${path}.retrievedAt`, code: "invalid_retrieval_time", message: "retrievedAt must be an RFC 3339 timestamp with timezone." });
  }
  validateSourceContentHash(source.contentHash, `${path}.contentHash`, issues);
  if (source.retrievalMethod !== "official_manufacturer_https") {
    issues.push({ path: `${path}.retrievalMethod`, code: "invalid_retrieval_method", message: "Only official manufacturer HTTPS retrieval is accepted." });
  }
  if (source.publicationRights !== "link_and_factual_extract_only") {
    issues.push({ path: `${path}.publicationRights`, code: "invalid_publication_rights", message: "Only link-and-factual-extract publication is permitted." });
  }
  stringAt(source.licenseNote, `${path}.licenseNote`, issues);
}

function validateFacts(value: unknown, path: string, issues: CatalogValidationIssue[]): void {
  const facts = objectAt(value, path, issues);
  if (!facts) return;
  exactKeys(facts, ["electrical", "timing", "thermal", "control"], path, issues);

  const electrical = objectAt(facts.electrical, `${path}.electrical`, issues);
  if (electrical) {
    exactKeys(electrical, ["inputVoltage", "outputVoltage", "maximumOutputCurrent", "feedbackReference", "currentLimit", "currentSenseThreshold", "currentSenseMechanism"], `${path}.electrical`, issues);
    validateNumericFact(electrical.inputVoltage, `${path}.electrical.inputVoltage`, "V", issues);
    validateNumericFact(electrical.outputVoltage, `${path}.electrical.outputVoltage`, "V", issues);
    validateNumericFact(electrical.maximumOutputCurrent, `${path}.electrical.maximumOutputCurrent`, "A", issues);
    validateNumericFact(electrical.feedbackReference, `${path}.electrical.feedbackReference`, "V", issues);
    validateNumericFact(electrical.currentLimit, `${path}.electrical.currentLimit`, "A", issues);
    validateNumericFact(electrical.currentSenseThreshold, `${path}.electrical.currentSenseThreshold`, "V", issues);
    validateTextFact(electrical.currentSenseMechanism, `${path}.electrical.currentSenseMechanism`, CURRENT_SENSE_MECHANISMS, issues);
  }

  const timing = objectAt(facts.timing, `${path}.timing`, issues);
  if (timing) {
    exactKeys(timing, ["switchingFrequency", "minimumOnTime", "minimumOffTime", "softStartTime"], `${path}.timing`, issues);
    validateNumericFact(timing.switchingFrequency, `${path}.timing.switchingFrequency`, "Hz", issues);
    validateNumericFact(timing.minimumOnTime, `${path}.timing.minimumOnTime`, "s", issues);
    validateNumericFact(timing.minimumOffTime, `${path}.timing.minimumOffTime`, "s", issues);
    validateNumericFact(timing.softStartTime, `${path}.timing.softStartTime`, "s", issues);
  }

  const thermal = objectAt(facts.thermal, `${path}.thermal`, issues);
  if (thermal) {
    exactKeys(thermal, ["operatingJunctionTemperature", "maximumJunctionTemperature", "thermalShutdownTemperature"], `${path}.thermal`, issues);
    validateNumericFact(thermal.operatingJunctionTemperature, `${path}.thermal.operatingJunctionTemperature`, "degC", issues, true);
    validateNumericFact(thermal.maximumJunctionTemperature, `${path}.thermal.maximumJunctionTemperature`, "K", issues);
    validateNumericFact(thermal.thermalShutdownTemperature, `${path}.thermal.thermalShutdownTemperature`, "degC", issues, true);
  }

  const control = objectAt(facts.control, `${path}.control`, issues);
  if (control) {
    exactKeys(control, ["mode", "compensation", "loopCrossoverFrequency", "phaseMargin", "stabilityAssessment"], `${path}.control`, issues);
    validateTextFact(control.mode, `${path}.control.mode`, CONTROL_MODES, issues);
    validateTextFact(control.compensation, `${path}.control.compensation`, COMPENSATION_MODES, issues);
    validateNumericFact(control.loopCrossoverFrequency, `${path}.control.loopCrossoverFrequency`, "Hz", issues);
    validateNumericFact(control.phaseMargin, `${path}.control.phaseMargin`, "degree", issues, true);
    validateTextFact(control.stabilityAssessment, `${path}.control.stabilityAssessment`, new Set(), issues, false);
  }
}

function validateIdentity(value: unknown, path: string, issues: CatalogValidationIssue[]): void {
  const identity = objectAt(value, path, issues);
  if (!identity) return;
  exactKeys(identity, ["part", "manufacturerDisplayName", "sourceRefs"], path, issues);
  const part = objectAt(identity.part, `${path}.part`, issues);
  if (part) {
    exactKeys(part, ["manufacturerId", "manufacturerPartNumber"], `${path}.part`, issues);
    stringAt(part.manufacturerId, `${path}.part.manufacturerId`, issues);
    stringAt(part.manufacturerPartNumber, `${path}.part.manufacturerPartNumber`, issues);
  }
  stringAt(identity.manufacturerDisplayName, `${path}.manufacturerDisplayName`, issues);
  const refs = arrayAt(identity.sourceRefs, `${path}.sourceRefs`, issues);
  validateSourceRefs(identity.sourceRefs, `${path}.sourceRefs`, issues);
  if (refs.length === 0) issues.push({ path: `${path}.sourceRefs`, code: "missing_identity_provenance", message: "Exact MPN identity requires an official source locator." });
}

function validateProfile(value: unknown, path: string, issues: CatalogValidationIssue[]): void {
  const profile = objectAt(value, path, issues);
  if (!profile) return;
  const partClass = typeof profile.partClass === "string" ? profile.partClass : "";
  const classSpecificKey = partClass === "power.integrated-synchronous-buck-regulator" ? "integratedPowerStage" : "externalGateDrive";
  exactKeys(
    profile,
    ["schemaVersion", "profileKind", "profileId", "partClass", "displayName", "identity", "evidenceReviewState", "manifestReviewState", "admissionState", "sources", "facts", classSpecificKey],
    path,
    issues,
  );
  if (profile.schemaVersion !== "1.0.0") issues.push({ path: `${path}.schemaVersion`, code: "invalid_version", message: "Expected profile schema version 1.0.0." });
  if (profile.profileKind !== "real_primary_part_evidence") issues.push({ path: `${path}.profileKind`, code: "invalid_kind", message: "Expected a real primary-part evidence profile." });
  stringAt(profile.profileId, `${path}.profileId`, issues);
  if (!PART_CLASSES.has(partClass)) issues.push({ path: `${path}.partClass`, code: "invalid_part_class", message: "Part class is outside the closed Track B4 set." });
  stringAt(profile.displayName, `${path}.displayName`, issues);
  validateIdentity(profile.identity, `${path}.identity`, issues);
  if (profile.evidenceReviewState !== "authored_primary_source_extraction") issues.push({ path: `${path}.evidenceReviewState`, code: "invalid_review_state", message: "Expected authored_primary_source_extraction; this is not independent review." });
  if (profile.manifestReviewState !== "authored") issues.push({ path: `${path}.manifestReviewState`, code: "invalid_manifest_review_state", message: "Independent manifest review is not yet complete." });
  if (profile.admissionState !== "blocked_facts_v2_authoring_review_and_admission") issues.push({ path: `${path}.admissionState`, code: "invalid_admission_state", message: "Profiles must remain blocked until facts-V2 profile authoring, independent review, and admission are complete." });
  const sources = arrayAt(profile.sources, `${path}.sources`, issues);
  if (sources.length === 0) issues.push({ path: `${path}.sources`, code: "missing_sources", message: "At least one official manufacturer source is required." });
  sources.forEach((entry, index) => validateSource(entry, `${path}.sources[${index}]`, issues));
  sources.forEach((entry, index) => {
    const source = entry && typeof entry === "object" && !Array.isArray(entry) ? entry as Record<string, unknown> : null;
    const contentHash = source?.contentHash && typeof source.contentHash === "object" && !Array.isArray(source.contentHash)
      ? source.contentHash as Record<string, unknown>
      : null;
    if (contentHash?.state !== "verified") {
      issues.push({
        path: `${path}.sources[${index}].contentHash.state`,
        code: "post_capture_state_requires_verified_source_hash",
        message: "The post-capture admission state requires every official source to retain a verified exact-byte hash.",
      });
    }
  });
  validateFacts(profile.facts, `${path}.facts`, issues);

  const classFacts = objectAt(profile[classSpecificKey], `${path}.${classSpecificKey}`, issues);
  if (classFacts && classSpecificKey === "integratedPowerStage") {
    exactKeys(classFacts, ["highSideOnResistance", "lowSideOnResistance"], `${path}.integratedPowerStage`, issues);
    validateNumericFact(classFacts.highSideOnResistance, `${path}.integratedPowerStage.highSideOnResistance`, "ohm", issues);
    validateNumericFact(classFacts.lowSideOnResistance, `${path}.integratedPowerStage.lowSideOnResistance`, "ohm", issues);
  } else if (classFacts) {
    exactKeys(classFacts, ["voltage", "sourceCurrent", "sinkCurrent", "deadTime"], `${path}.externalGateDrive`, issues);
    validateNumericFact(classFacts.voltage, `${path}.externalGateDrive.voltage`, "V", issues);
    validateNumericFact(classFacts.sourceCurrent, `${path}.externalGateDrive.sourceCurrent`, "A", issues);
    validateNumericFact(classFacts.sinkCurrent, `${path}.externalGateDrive.sinkCurrent`, "A", issues);
    validateNumericFact(classFacts.deadTime, `${path}.externalGateDrive.deadTime`, "s", issues);
  }
}

function normalizedMpnPathSegment(mpn: string): string {
  return mpn.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function collectSourceRefs(value: unknown, refs: JsonObject[] = []): JsonObject[] {
  if (Array.isArray(value)) {
    for (const item of value) collectSourceRefs(item, refs);
  } else if (value && typeof value === "object") {
    const object = value as JsonObject;
    if (Object.keys(object).length === 2 && "sourceId" in object && "locator" in object) refs.push(object);
    for (const child of Object.values(object)) collectSourceRefs(child, refs);
  }
  return refs;
}

function validateCatalogSemantics(catalog: JsonObject, issues: CatalogValidationIssue[]): void {
  const manufacturers = Array.isArray(catalog.manufacturers) ? catalog.manufacturers.filter((item): item is JsonObject => !!item && typeof item === "object" && !Array.isArray(item)) : [];
  const profiles = Array.isArray(catalog.profiles) ? catalog.profiles.filter((item): item is JsonObject => !!item && typeof item === "object" && !Array.isArray(item)) : [];
  const declaredManufacturerIds = new Set<string>();

  manufacturers.forEach((manufacturer, index) => {
    const id = typeof manufacturer.manufacturerId === "string" ? manufacturer.manufacturerId : "";
    const displayName = typeof manufacturer.displayName === "string" ? manufacturer.displayName : "";
    const domains = Array.isArray(manufacturer.officialDomains) ? manufacturer.officialDomains.filter((domain): domain is string => typeof domain === "string") : [];
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) issues.push({ path: `$.manufacturers[${index}].manufacturerId`, code: "unstable_manufacturer_id", message: "Manufacturer IDs must be stable normalized kebab-case keys." });
    if (declaredManufacturerIds.has(id)) issues.push({ path: `$.manufacturers[${index}].manufacturerId`, code: "duplicate_manufacturer", message: "Manufacturer ID is duplicated." });
    declaredManufacturerIds.add(id);

    const trusted = TRUSTED_MANUFACTURERS.get(id);
    if (!trusted) {
      issues.push({ path: `$.manufacturers[${index}].manufacturerId`, code: "unexpected_manufacturer", message: "Manufacturer is outside the code-owned Track B4 allowlist." });
      return;
    }
    if (displayName !== trusted.displayName) {
      issues.push({ path: `$.manufacturers[${index}].displayName`, code: "manufacturer_name_drift", message: "Manufacturer display name differs from the code-owned identity." });
    }
    if (domains.length !== trusted.domains.length || domains.some((domain, domainIndex) => domain !== trusted.domains[domainIndex])) {
      issues.push({ path: `$.manufacturers[${index}].officialDomains`, code: "manufacturer_domain_drift", message: "Official domains differ from the code-owned manufacturer allowlist." });
    }
  });

  for (const trustedManufacturerId of TRUSTED_MANUFACTURERS.keys()) {
    if (!declaredManufacturerIds.has(trustedManufacturerId)) {
      issues.push({ path: "$.manufacturers", code: "missing_trusted_manufacturer", message: `Code-owned manufacturer ${trustedManufacturerId} is missing from the catalog registry.` });
    }
  }

  const profileIds = new Set<string>();
  const partKeys = new Set<string>();
  const countByClass = new Map<RealPrimaryPartClass, number>();

  profiles.forEach((profile, index) => {
    const path = `$.profiles[${index}]`;
    const profileId = typeof profile.profileId === "string" ? profile.profileId : "";
    if (profileIds.has(profileId)) issues.push({ path: `${path}.profileId`, code: "duplicate_profile_id", message: "Profile ID is duplicated." });
    profileIds.add(profileId);
    const identity = profile.identity && typeof profile.identity === "object" && !Array.isArray(profile.identity) ? profile.identity as JsonObject : {};
    const part = identity.part && typeof identity.part === "object" && !Array.isArray(identity.part) ? identity.part as JsonObject : {};
    const manufacturerId = typeof part.manufacturerId === "string" ? part.manufacturerId : "";
    const mpn = typeof part.manufacturerPartNumber === "string" ? part.manufacturerPartNumber : "";
    const partKey = `${manufacturerId}\u0000${mpn.toUpperCase()}`;
    if (partKeys.has(partKey)) issues.push({ path: `${path}.identity.part`, code: "duplicate_part_identity", message: "Manufacturer ID plus exact MPN must be unique." });
    partKeys.add(partKey);
    const expectedProfileId = `real.${manufacturerId}.${normalizedMpnPathSegment(mpn)}`;
    if (profileId !== expectedProfileId) issues.push({ path: `${path}.profileId`, code: "unstable_profile_id", message: `Expected stable profile ID ${expectedProfileId}.` });

    const manufacturer = TRUSTED_MANUFACTURERS.get(manufacturerId);
    if (!manufacturer) {
      issues.push({ path: `${path}.identity.part.manufacturerId`, code: "unknown_manufacturer", message: "Manufacturer ID is not in the closed registry." });
    } else if (identity.manufacturerDisplayName !== manufacturer.displayName) {
      issues.push({ path: `${path}.identity.manufacturerDisplayName`, code: "manufacturer_name_mismatch", message: "Display name must match the registry without changing the machine identity." });
    }

    const sourceIds = new Set<string>();
    const sources = Array.isArray(profile.sources) ? profile.sources.filter((item): item is JsonObject => !!item && typeof item === "object" && !Array.isArray(item)) : [];
    sources.forEach((source, sourceIndex) => {
      const sourceId = typeof source.sourceId === "string" ? source.sourceId : "";
      if (sourceIds.has(sourceId)) issues.push({ path: `${path}.sources[${sourceIndex}].sourceId`, code: "duplicate_source_id", message: "Source ID is duplicated within the profile." });
      sourceIds.add(sourceId);
      if (source.manufacturerId !== manufacturerId) issues.push({ path: `${path}.sources[${sourceIndex}].manufacturerId`, code: "source_manufacturer_mismatch", message: "A profile may only cite its identified manufacturer for primary-part facts." });
      if (manufacturer && typeof source.url === "string") {
        try {
          const hostname = new URL(source.url).hostname.toLowerCase();
          if (!manufacturer.domains.includes(hostname)) {
            issues.push({ path: `${path}.sources[${sourceIndex}].url`, code: "non_manufacturer_domain", message: "Source URL is not on an official registered manufacturer domain." });
          }
        } catch {
          // Shape validation reports malformed URLs.
        }
      }
    });

    for (const sourceRef of collectSourceRefs(profile)) {
      if (typeof sourceRef.sourceId === "string" && !sourceIds.has(sourceRef.sourceId)) {
        issues.push({ path, code: "dangling_source_ref", message: `Source reference ${sourceRef.sourceId} is not declared by the profile.` });
      }
    }

    if (PART_CLASSES.has(profile.partClass as string)) {
      const partClass = profile.partClass as RealPrimaryPartClass;
      countByClass.set(partClass, (countByClass.get(partClass) ?? 0) + 1);
    }
  });

  for (const partClass of REAL_PRIMARY_PART_CLASSES) {
    if ((countByClass.get(partClass) ?? 0) < 3) issues.push({ path: "$.profiles", code: "insufficient_part_class_tranche", message: `${partClass} requires at least three profiles in this tranche.` });
  }
  const distinctManufacturers = new Set(profiles.map((profile) => {
    const identity = profile.identity as JsonObject | undefined;
    const part = identity?.part as JsonObject | undefined;
    return typeof part?.manufacturerId === "string" ? part.manufacturerId : "";
  }).filter(Boolean));
  if (distinctManufacturers.size < 3) issues.push({ path: "$.profiles", code: "insufficient_manufacturer_span", message: "The tranche must span at least three manufacturers overall." });
}

export function validateRealPrimaryPartCatalog(value: unknown): CatalogValidationResult {
  const issues: CatalogValidationIssue[] = [];
  const catalog = objectAt(value, "$", issues);
  if (!catalog) return { valid: false, issues };
  exactKeys(catalog, ["schemaVersion", "catalogKind", "version", "authoredAt", "manufacturers", "profiles"], "$", issues);
  if (catalog.schemaVersion !== "1.0.0") issues.push({ path: "$.schemaVersion", code: "invalid_version", message: "Expected catalog schema version 1.0.0." });
  if (catalog.catalogKind !== "real_primary_part_evidence_tranche") issues.push({ path: "$.catalogKind", code: "invalid_kind", message: "Expected the isolated real primary-part evidence tranche." });
  stringAt(catalog.version, "$.version", issues);
  const authoredAt = stringAt(catalog.authoredAt, "$.authoredAt", issues);
  if (authoredAt !== null && !/^\d{4}-\d{2}-\d{2}$/.test(authoredAt)) issues.push({ path: "$.authoredAt", code: "invalid_date", message: "authoredAt must use YYYY-MM-DD." });

  const manufacturers = arrayAt(catalog.manufacturers, "$.manufacturers", issues);
  manufacturers.forEach((entry, index) => {
    const path = `$.manufacturers[${index}]`;
    const manufacturer = objectAt(entry, path, issues);
    if (!manufacturer) return;
    exactKeys(manufacturer, ["manufacturerId", "displayName", "officialDomains"], path, issues);
    stringAt(manufacturer.manufacturerId, `${path}.manufacturerId`, issues);
    stringAt(manufacturer.displayName, `${path}.displayName`, issues);
    const domains = arrayAt(manufacturer.officialDomains, `${path}.officialDomains`, issues);
    if (domains.length === 0) issues.push({ path: `${path}.officialDomains`, code: "missing_domains", message: "At least one official domain is required." });
    domains.forEach((domain, domainIndex) => stringAt(domain, `${path}.officialDomains[${domainIndex}]`, issues));
  });

  const profiles = arrayAt(catalog.profiles, "$.profiles", issues);
  profiles.forEach((entry, index) => validateProfile(entry, `$.profiles[${index}]`, issues));
  validateCatalogSemantics(catalog, issues);
  return { valid: issues.length === 0, issues };
}

export function assertValidRealPrimaryPartCatalog(value: unknown): asserts value is RealPrimaryPartCatalog {
  const result = validateRealPrimaryPartCatalog(value);
  if (!result.valid) {
    const summary = result.issues.map((issue) => `${issue.path} [${issue.code}] ${issue.message}`).join("\n");
    throw new Error(`Invalid real primary-part catalog:\n${summary}`);
  }
}
