import { compareAscii, deepFreeze, detachedJsonSnapshot } from "./canonical";
import { PART_CLASS_SPECS, type FactsFor, type PartClassSpec } from "./specs";
import { classifyCommercialBoundaryKey, parseDesignProfile, validateDesignProfile, validateFactsForCodec, validateProfileAdmissionRules, type DesignProfileFor } from "./validation";
import { FACTS_SCHEMA_VERSION, PART_CLASS_IDS, type ManufacturerRegistryEntryV1, type ManufacturerRegistryV1, type PartClassId, type ValidationIssue } from "./types";

export interface DesignProfileCodec<ClassId extends PartClassId = PartClassId> {
  partClass: ClassId;
  factsSchemaVersion: typeof FACTS_SCHEMA_VERSION;
  spec: PartClassSpec;
  validateFacts(input: unknown, manufacturer?: ManufacturerRegistryEntryV1): ValidationIssue[];
  parseFacts(input: unknown, manufacturer?: ManufacturerRegistryEntryV1): FactsFor<ClassId>;
  validateAdmission(profile: DesignProfileFor<ClassId>): ValidationIssue[];
}

function codecFor<ClassId extends PartClassId>(partClass: ClassId): DesignProfileCodec<ClassId> {
  return Object.freeze({
    partClass,
    factsSchemaVersion: FACTS_SCHEMA_VERSION,
    spec: PART_CLASS_SPECS[partClass],
    validateFacts: (input: unknown, manufacturer?: ManufacturerRegistryEntryV1) => validateFactsForCodec(input, partClass, manufacturer),
    parseFacts: (input: unknown, manufacturer?: ManufacturerRegistryEntryV1) => {
      const snapshot = detachedJsonSnapshot(input);
      const manufacturerSnapshot = manufacturer === undefined ? undefined : detachedJsonSnapshot(manufacturer);
      const first = validateFactsForCodec(snapshot, partClass, manufacturerSnapshot)[0];
      if (first) throw new Error(`${first.path} [${first.code}]: ${first.message}`);
      return snapshot as FactsFor<ClassId>;
    },
    validateAdmission: (profile: DesignProfileFor<ClassId>) => validateProfileAdmissionRules(profile),
  });
}

export const DESIGN_PROFILE_CODECS = deepFreeze(Object.fromEntries(
  PART_CLASS_IDS.map((partClass) => [partClass, codecFor(partClass)]),
) as { [ClassId in PartClassId]: DesignProfileCodec<ClassId> });

export function getDesignProfileCodec<ClassId extends PartClassId>(partClass: ClassId): DesignProfileCodec<ClassId> {
  if (!Object.prototype.hasOwnProperty.call(DESIGN_PROFILE_CODECS, partClass)) {
    throw new TypeError(`partClass [unknown_part_class]: ${String(partClass)}`);
  }
  return DESIGN_PROFILE_CODECS[partClass] as unknown as DesignProfileCodec<ClassId>;
}

export function parseDesignProfileFor<ClassId extends PartClassId>(
  codec: DesignProfileCodec<ClassId>,
  input: unknown,
  registry?: ManufacturerRegistryV1,
): DesignProfileFor<ClassId> {
  const profile = registry === undefined
    ? (() => {
        const snapshot = detachedJsonSnapshot(input);
        const first = validateDesignProfile(snapshot).filter((entry) => entry.code !== "unknown_manufacturer")[0];
        if (first) throw new Error(`${first.path || "profile"} [${first.code}]: ${first.message}`);
        return deepFreeze(snapshot) as DesignProfileFor<ClassId>;
      })()
    : deepFreeze(parseDesignProfile(input, registry)) as DesignProfileFor<ClassId>;
  if (profile.partClass !== codec.partClass) throw new Error(`partClass [codec_mismatch]: Expected ${codec.partClass}`);
  return profile;
}

/** V1 is the only supported persisted version; migration is a detached, closed reconstruction. */
export function migrateDesignProfileFor<ClassId extends PartClassId>(
  codec: DesignProfileCodec<ClassId>,
  input: unknown,
  registry?: ManufacturerRegistryV1,
): DesignProfileFor<ClassId> {
  return parseDesignProfileFor(codec, input, registry);
}

export function validateCodecRegistryBoundary(): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const classes = Object.keys(DESIGN_PROFILE_CODECS).sort(compareAscii);
  const expected = [...PART_CLASS_IDS].sort(compareAscii);
  if (classes.join("\u0000") !== expected.join("\u0000")) issues.push({ path: "codecs", code: "codec_coverage", message: "Codec registry must exactly cover the twelve manifest classes" });
  for (const partClass of PART_CLASS_IDS) {
    const codec = DESIGN_PROFILE_CODECS[partClass];
    for (const key of [...Object.keys(codec.spec.facts), ...Object.keys(codec.spec.operatingRanges)]) {
      const category = classifyCommercialBoundaryKey(key);
      if (category !== undefined) {
        issues.push({ path: `codecs.${partClass}.${key}`, code: "commercial_boundary_violation", message: `Codec persisted keys cannot declare commercial/provider ${category} state` });
      }
    }
    for (const [factId, fact] of Object.entries(codec.spec.facts)) {
      for (const parameterId of fact.requiredRangeParameters ?? []) {
        if (!(parameterId in codec.spec.operatingRanges)) {
          issues.push({ path: `codecs.${partClass}.facts.${factId}`, code: "missing_range_codec", message: `Required range ${parameterId} is not declared by the class codec` });
        }
      }
    }
  }
  return issues;
}
