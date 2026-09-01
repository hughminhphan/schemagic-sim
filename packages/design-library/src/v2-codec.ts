import { deepFreeze } from "./canonical";
import { getDesignProfileCodec, type DesignProfileCodec } from "./codec";
import {
  DESIGN_PROFILE_FORMAT,
  DESIGN_PROFILE_SCHEMA_VERSION,
  FACTS_SCHEMA_VERSION,
  MANUFACTURER_REGISTRY_FORMAT,
  type ManufacturerRegistryEntryV1,
  type ManufacturerRegistryV1,
  type PartClassId,
  type ValidationIssue,
} from "./types";
import {
  FACTS_SCHEMA_VERSION_V2,
  type DesignProfileWithFactsV2,
  type FactsV2For,
} from "./v2-types";
import {
  parseDesignProfileEnvelope,
  validateDesignProfileEnvelope,
  validateProfileAdmissionRulesV2,
} from "./v2-validation";
import type { DesignProfileFor } from "./validation";
import {
  FACTS_SCHEMA_VERSION_V3,
  type DesignProfileV3,
  type FactsV3For,
} from "./v3-types";
import type { V3PartClassId } from "./v3-specs";
import {
  parseDesignProfileV3,
  parseDesignProfileV31,
  validateDesignProfileV3,
  validateDesignProfileV31,
  validateProfileAdmissionRulesV3,
  validateProfileAdmissionRulesV31,
} from "./v3-validation";
import type { V31PartClassId } from "./v31-specs";
import {
  FACTS_SCHEMA_VERSION_V31,
  type DesignProfileV31,
  type FactsV31For,
} from "./v31-types";
import type { V32PartClassId } from "./v32-specs";
import {
  FACTS_SCHEMA_VERSION_V32,
  type DesignProfileV32,
  type FactsV32For,
} from "./v32-types";
import {
  parseDesignProfileV32,
  validateDesignProfileV32,
  validateProfileAdmissionRulesV32,
} from "./v32-validation";
import type { V33PartClassId } from "./v33-specs";
import {
  FACTS_SCHEMA_VERSION_V33,
  type DesignProfileV33,
  type FactsV33For,
} from "./v33-types";
import {
  parseDesignProfileV33,
  validateDesignProfileV33,
  validateProfileAdmissionRulesV33,
} from "./v33-validation";
import type { V34PartClassId } from "./v34-specs";
import {
  FACTS_SCHEMA_VERSION_V34,
  type DesignProfileV34,
  type FactsV34For,
} from "./v34-types";
import {
  parseDesignProfileV34,
  validateDesignProfileV34,
  validateProfileAdmissionRulesV34,
} from "./v34-validation";

export interface DesignProfileFactsCodecV2<ClassId extends PartClassId> {
  partClass: ClassId;
  factsSchemaVersion: typeof FACTS_SCHEMA_VERSION_V2;
  validateFacts(input: unknown, manufacturer?: ManufacturerRegistryEntryV1): ValidationIssue[];
  parseFacts(input: unknown, manufacturer?: ManufacturerRegistryEntryV1): FactsV2For<ClassId>;
  validateAdmission(profile: DesignProfileWithFactsV2<ClassId, FactsV2For<ClassId>>): ValidationIssue[];
}

export interface DesignProfileFactsCodecV3<ClassId extends V3PartClassId> {
  partClass: ClassId;
  factsSchemaVersion: typeof FACTS_SCHEMA_VERSION_V3;
  validateFacts(input: unknown, manufacturer?: ManufacturerRegistryEntryV1): ValidationIssue[];
  parseFacts(input: unknown, manufacturer?: ManufacturerRegistryEntryV1): FactsV3For<ClassId>;
  validateAdmission(profile: DesignProfileV3<ClassId>): ValidationIssue[];
}

export interface DesignProfileFactsCodecV31<ClassId extends V31PartClassId> {
  partClass: ClassId;
  factsSchemaVersion: typeof FACTS_SCHEMA_VERSION_V31;
  validateFacts(input: unknown, manufacturer?: ManufacturerRegistryEntryV1): ValidationIssue[];
  parseFacts(input: unknown, manufacturer?: ManufacturerRegistryEntryV1): FactsV31For<ClassId>;
  validateAdmission(profile: DesignProfileV31<ClassId>): ValidationIssue[];
}

export interface DesignProfileFactsCodecV32<ClassId extends V32PartClassId> {
  partClass: ClassId;
  factsSchemaVersion: typeof FACTS_SCHEMA_VERSION_V32;
  validateFacts(input: unknown, manufacturer?: ManufacturerRegistryEntryV1): ValidationIssue[];
  parseFacts(input: unknown, manufacturer?: ManufacturerRegistryEntryV1): FactsV32For<ClassId>;
  validateAdmission(profile: DesignProfileV32<ClassId>): ValidationIssue[];
}

export interface DesignProfileFactsCodecV33<ClassId extends V33PartClassId> {
  partClass: ClassId;
  factsSchemaVersion: typeof FACTS_SCHEMA_VERSION_V33;
  validateFacts(input: unknown, manufacturer?: ManufacturerRegistryEntryV1): ValidationIssue[];
  parseFacts(input: unknown, manufacturer?: ManufacturerRegistryEntryV1): FactsV33For<ClassId>;
  validateAdmission(profile: DesignProfileV33<ClassId>): ValidationIssue[];
}

export interface DesignProfileFactsCodecV34<ClassId extends V34PartClassId> {
  partClass: ClassId;
  factsSchemaVersion: typeof FACTS_SCHEMA_VERSION_V34;
  validateFacts(input: unknown, manufacturer?: ManufacturerRegistryEntryV1): ValidationIssue[];
  parseFacts(input: unknown, manufacturer?: ManufacturerRegistryEntryV1): FactsV34For<ClassId>;
  validateAdmission(profile: DesignProfileV34<ClassId>): ValidationIssue[];
}

export type VersionedDesignProfileCodec<ClassId extends PartClassId> =
  | DesignProfileCodec<ClassId>
  | DesignProfileFactsCodecV2<ClassId>
  | (ClassId extends V3PartClassId ? DesignProfileFactsCodecV3<ClassId> : never)
  | (ClassId extends V31PartClassId ? DesignProfileFactsCodecV31<ClassId> : never)
  | (ClassId extends V32PartClassId ? DesignProfileFactsCodecV32<ClassId> : never)
  | (ClassId extends V33PartClassId ? DesignProfileFactsCodecV33<ClassId> : never)
  | (ClassId extends V34PartClassId ? DesignProfileFactsCodecV34<ClassId> : never);

export type DesignProfileForCodec<
  Codec extends VersionedDesignProfileCodec<PartClassId>,
> = Codec extends DesignProfileFactsCodecV2<infer ClassId>
  ? DesignProfileWithFactsV2<ClassId, FactsV2For<ClassId>>
  : Codec extends DesignProfileFactsCodecV3<infer ClassId>
    ? DesignProfileV3<ClassId>
  : Codec extends DesignProfileFactsCodecV31<infer ClassId>
    ? DesignProfileV31<ClassId>
  : Codec extends DesignProfileFactsCodecV32<infer ClassId>
    ? DesignProfileV32<ClassId>
  : Codec extends DesignProfileFactsCodecV33<infer ClassId>
    ? DesignProfileV33<ClassId>
  : Codec extends DesignProfileFactsCodecV34<infer ClassId>
    ? DesignProfileV34<ClassId>
  : Codec extends DesignProfileCodec<infer ClassId>
    ? DesignProfileFor<ClassId>
    : never;

function unknownCommonFact(explanation: string) {
  return {
    value: null,
    state: "unknown" as const,
    evidence: [],
    validFor: [],
    explanation,
  };
}

function factsEnvelope<ClassId extends PartClassId>(
  partClass: ClassId,
  facts: unknown,
  manufacturer?: ManufacturerRegistryEntryV1,
): unknown {
  return {
    format: DESIGN_PROFILE_FORMAT,
    schemaVersion: DESIGN_PROFILE_SCHEMA_VERSION,
    partClass,
    part: {
      manufacturerId: manufacturer?.manufacturerId ?? "schemagic-codec-validation",
      manufacturerPartNumber: "FACTS-V2-CODEC",
    },
    factsSchemaVersion: FACTS_SCHEMA_VERSION_V2,
    commonFacts: {
      packageName: unknownCommonFact("Facts-only codec validation does not supply a package name."),
      boardArea: unknownCommonFact("Facts-V2 carries mounted board area inside class facts."),
      maximumHeight: unknownCommonFact("Facts-V2 carries mounted maximum height inside class facts."),
    },
    facts,
  };
}

function registryFor(manufacturer: ManufacturerRegistryEntryV1 | undefined): ManufacturerRegistryV1 | undefined {
  return manufacturer === undefined ? undefined : {
    format: MANUFACTURER_REGISTRY_FORMAT,
    schemaVersion: DESIGN_PROFILE_SCHEMA_VERSION,
    manufacturers: [manufacturer],
  };
}

function factsEnvelopeV3<ClassId extends V3PartClassId>(
  partClass: ClassId,
  facts: unknown,
  manufacturer?: ManufacturerRegistryEntryV1,
): unknown {
  return {
    format: DESIGN_PROFILE_FORMAT,
    schemaVersion: DESIGN_PROFILE_SCHEMA_VERSION,
    partClass,
    part: {
      manufacturerId: manufacturer?.manufacturerId ?? "schemagic-codec-validation",
      manufacturerPartNumber: "FACTS-V3-CODEC",
    },
    factsSchemaVersion: FACTS_SCHEMA_VERSION_V3,
    commonFacts: {
      packageName: unknownCommonFact("Facts-only codec validation does not supply a package name."),
      boardArea: unknownCommonFact("Facts-V3 carries mounted board area inside class facts."),
      maximumHeight: unknownCommonFact("Facts-V3 carries mounted maximum height inside class facts."),
    },
    facts,
  };
}

function factsEnvelopeV31<ClassId extends V31PartClassId>(
  partClass: ClassId,
  facts: unknown,
  manufacturer?: ManufacturerRegistryEntryV1,
): unknown {
  return {
    format: DESIGN_PROFILE_FORMAT,
    schemaVersion: DESIGN_PROFILE_SCHEMA_VERSION,
    partClass,
    part: {
      manufacturerId: manufacturer?.manufacturerId ?? "schemagic-codec-validation",
      manufacturerPartNumber: "FACTS-V31-CODEC",
    },
    factsSchemaVersion: FACTS_SCHEMA_VERSION_V31,
    commonFacts: {
      packageName: unknownCommonFact("Facts-only codec validation does not supply a package name."),
      boardArea: unknownCommonFact("Facts 3.1.0 carries mounted board area inside class facts."),
      maximumHeight: unknownCommonFact("Facts 3.1.0 carries mounted maximum height inside class facts."),
    },
    facts,
  };
}

function factsEnvelopeV32<ClassId extends V32PartClassId>(
  partClass: ClassId,
  facts: unknown,
  manufacturer?: ManufacturerRegistryEntryV1,
): unknown {
  return {
    format: DESIGN_PROFILE_FORMAT,
    schemaVersion: DESIGN_PROFILE_SCHEMA_VERSION,
    partClass,
    part: {
      manufacturerId: manufacturer?.manufacturerId ?? "schemagic-codec-validation",
      manufacturerPartNumber: "FACTS-V32-CODEC",
    },
    factsSchemaVersion: FACTS_SCHEMA_VERSION_V32,
    commonFacts: {
      packageName: unknownCommonFact("Facts-only codec validation does not supply a package name."),
      boardArea: unknownCommonFact("Facts 3.2.0 carries mounted board area inside class facts."),
      maximumHeight: unknownCommonFact("Facts 3.2.0 carries mounted maximum height inside class facts."),
    },
    facts,
  };
}

function factsEnvelopeV33<ClassId extends V33PartClassId>(
  partClass: ClassId,
  facts: unknown,
  manufacturer?: ManufacturerRegistryEntryV1,
): unknown {
  return {
    format: DESIGN_PROFILE_FORMAT,
    schemaVersion: DESIGN_PROFILE_SCHEMA_VERSION,
    partClass,
    part: {
      manufacturerId: manufacturer?.manufacturerId ?? "schemagic-codec-validation",
      manufacturerPartNumber: "FACTS-V33-CODEC",
    },
    factsSchemaVersion: FACTS_SCHEMA_VERSION_V33,
    commonFacts: {
      packageName: unknownCommonFact("Facts-only codec validation does not supply a package name."),
      boardArea: unknownCommonFact("Facts 3.3.0 carries mounted board area inside class facts."),
      maximumHeight: unknownCommonFact("Facts 3.3.0 carries mounted maximum height inside class facts."),
    },
    facts,
  };
}

function factsEnvelopeV34<ClassId extends V34PartClassId>(
  partClass: ClassId,
  facts: unknown,
  manufacturer?: ManufacturerRegistryEntryV1,
): unknown {
  return {
    format: DESIGN_PROFILE_FORMAT,
    schemaVersion: DESIGN_PROFILE_SCHEMA_VERSION,
    partClass,
    part: {
      manufacturerId: manufacturer?.manufacturerId ?? "schemagic-codec-validation",
      manufacturerPartNumber: "FACTS-V34-CODEC",
    },
    factsSchemaVersion: FACTS_SCHEMA_VERSION_V34,
    commonFacts: {
      packageName: unknownCommonFact("Facts-only codec validation does not supply a package name."),
      boardArea: unknownCommonFact("Facts 3.4.0 carries mounted board area inside class facts."),
      maximumHeight: unknownCommonFact("Facts 3.4.0 carries mounted maximum height inside class facts."),
    },
    facts,
  };
}

function codecForV2<ClassId extends PartClassId>(partClass: ClassId): DesignProfileFactsCodecV2<ClassId> {
  return Object.freeze({
    partClass,
    factsSchemaVersion: FACTS_SCHEMA_VERSION_V2,
    validateFacts: (input: unknown, manufacturer?: ManufacturerRegistryEntryV1) => validateDesignProfileEnvelope(
      factsEnvelope(partClass, input, manufacturer),
      registryFor(manufacturer),
    ),
    parseFacts: (input: unknown, manufacturer?: ManufacturerRegistryEntryV1) => {
      const profile = parseDesignProfileEnvelope(
        factsEnvelope(partClass, input, manufacturer),
        registryFor(manufacturer),
      );
      if (profile.factsSchemaVersion !== FACTS_SCHEMA_VERSION_V2 || profile.partClass !== partClass) {
        throw new Error(`facts [codec_mismatch]: Expected ${partClass} facts ${FACTS_SCHEMA_VERSION_V2}`);
      }
      return profile.facts as FactsV2For<ClassId>;
    },
    validateAdmission: (profile: DesignProfileWithFactsV2<ClassId, FactsV2For<ClassId>>) => validateProfileAdmissionRulesV2(profile),
  });
}

function codecForV3<ClassId extends V3PartClassId>(partClass: ClassId): DesignProfileFactsCodecV3<ClassId> {
  return Object.freeze({
    partClass,
    factsSchemaVersion: FACTS_SCHEMA_VERSION_V3,
    validateFacts: (input: unknown, manufacturer?: ManufacturerRegistryEntryV1) => validateDesignProfileV3(
      factsEnvelopeV3(partClass, input, manufacturer),
      registryFor(manufacturer),
    ),
    parseFacts: (input: unknown, manufacturer?: ManufacturerRegistryEntryV1) => {
      const profile = parseDesignProfileV3(
        factsEnvelopeV3(partClass, input, manufacturer),
        registryFor(manufacturer),
      );
      if (profile.partClass !== partClass) {
        throw new Error(`facts [codec_mismatch]: Expected ${partClass} facts ${FACTS_SCHEMA_VERSION_V3}`);
      }
      return profile.facts as FactsV3For<ClassId>;
    },
    validateAdmission: (profile: DesignProfileV3<ClassId>) => validateProfileAdmissionRulesV3(profile),
  });
}

function codecForV31<ClassId extends V31PartClassId>(partClass: ClassId): DesignProfileFactsCodecV31<ClassId> {
  return Object.freeze({
    partClass,
    factsSchemaVersion: FACTS_SCHEMA_VERSION_V31,
    validateFacts: (input: unknown, manufacturer?: ManufacturerRegistryEntryV1) => validateDesignProfileV31(
      factsEnvelopeV31(partClass, input, manufacturer),
      registryFor(manufacturer),
    ),
    parseFacts: (input: unknown, manufacturer?: ManufacturerRegistryEntryV1) => {
      const profile = parseDesignProfileV31(
        factsEnvelopeV31(partClass, input, manufacturer),
        registryFor(manufacturer),
      );
      if (profile.partClass !== partClass) {
        throw new Error(`facts [codec_mismatch]: Expected ${partClass} facts ${FACTS_SCHEMA_VERSION_V31}`);
      }
      return profile.facts as FactsV31For<ClassId>;
    },
    validateAdmission: (profile: DesignProfileV31<ClassId>) => validateProfileAdmissionRulesV31(profile),
  });
}

function codecForV32<ClassId extends V32PartClassId>(partClass: ClassId): DesignProfileFactsCodecV32<ClassId> {
  return Object.freeze({
    partClass,
    factsSchemaVersion: FACTS_SCHEMA_VERSION_V32,
    validateFacts: (input: unknown, manufacturer?: ManufacturerRegistryEntryV1) => validateDesignProfileV32(
      factsEnvelopeV32(partClass, input, manufacturer),
      registryFor(manufacturer),
    ),
    parseFacts: (input: unknown, manufacturer?: ManufacturerRegistryEntryV1) => {
      const profile = parseDesignProfileV32(
        factsEnvelopeV32(partClass, input, manufacturer),
        registryFor(manufacturer),
      );
      if (profile.partClass !== partClass) {
        throw new Error(`facts [codec_mismatch]: Expected ${partClass} facts ${FACTS_SCHEMA_VERSION_V32}`);
      }
      return profile.facts as FactsV32For<ClassId>;
    },
    validateAdmission: (profile: DesignProfileV32<ClassId>) => validateProfileAdmissionRulesV32(profile),
  });
}

function codecForV33<ClassId extends V33PartClassId>(partClass: ClassId): DesignProfileFactsCodecV33<ClassId> {
  return Object.freeze({
    partClass,
    factsSchemaVersion: FACTS_SCHEMA_VERSION_V33,
    validateFacts: (input: unknown, manufacturer?: ManufacturerRegistryEntryV1) => validateDesignProfileV33(
      factsEnvelopeV33(partClass, input, manufacturer),
      registryFor(manufacturer),
    ),
    parseFacts: (input: unknown, manufacturer?: ManufacturerRegistryEntryV1) => {
      const profile = parseDesignProfileV33(
        factsEnvelopeV33(partClass, input, manufacturer),
        registryFor(manufacturer),
      );
      if (profile.partClass !== partClass) {
        throw new Error(`facts [codec_mismatch]: Expected ${partClass} facts ${FACTS_SCHEMA_VERSION_V33}`);
      }
      return profile.facts as FactsV33For<ClassId>;
    },
    validateAdmission: (profile: DesignProfileV33<ClassId>) => validateProfileAdmissionRulesV33(profile),
  });
}

function codecForV34<ClassId extends V34PartClassId>(partClass: ClassId): DesignProfileFactsCodecV34<ClassId> {
  return Object.freeze({
    partClass,
    factsSchemaVersion: FACTS_SCHEMA_VERSION_V34,
    validateFacts: (input: unknown, manufacturer?: ManufacturerRegistryEntryV1) => validateDesignProfileV34(
      factsEnvelopeV34(partClass, input, manufacturer),
      registryFor(manufacturer),
    ),
    parseFacts: (input: unknown, manufacturer?: ManufacturerRegistryEntryV1) => {
      const profile = parseDesignProfileV34(
        factsEnvelopeV34(partClass, input, manufacturer),
        registryFor(manufacturer),
      );
      if (profile.partClass !== partClass) {
        throw new Error(`facts [codec_mismatch]: Expected ${partClass} facts ${FACTS_SCHEMA_VERSION_V34}`);
      }
      return profile.facts as FactsV34For<ClassId>;
    },
    validateAdmission: (profile: DesignProfileV34<ClassId>) => validateProfileAdmissionRulesV34(profile),
  });
}

/** Closed code-owned facts-V2 registry. There is no runtime registration surface. */
export const DESIGN_PROFILE_FACTS_CODECS_V2 = deepFreeze({
  "motor.integrated-h-bridge": codecForV2("motor.integrated-h-bridge"),
  "motor.full-bridge-gate-driver": codecForV2("motor.full-bridge-gate-driver"),
  "power.integrated-synchronous-buck-regulator": codecForV2("power.integrated-synchronous-buck-regulator"),
  "power.external-fet-synchronous-buck-controller": codecForV2("power.external-fet-synchronous-buck-controller"),
  "shared.n-channel-power-mosfet": codecForV2("shared.n-channel-power-mosfet"),
  "shared.current-sense-resistor": codecForV2("shared.current-sense-resistor"),
  "shared.general-purpose-resistor": codecForV2("shared.general-purpose-resistor"),
  "shared.switching-diode": codecForV2("shared.switching-diode"),
  "shared.mlcc-capacitor": codecForV2("shared.mlcc-capacitor"),
  "shared.bulk-capacitor": codecForV2("shared.bulk-capacitor"),
  "motor.supply-tvs-diode": codecForV2("motor.supply-tvs-diode"),
  "power.power-inductor": codecForV2("power.power-inductor"),
} satisfies { [ClassId in PartClassId]: DesignProfileFactsCodecV2<ClassId> });

export const DESIGN_PROFILE_FACTS_CODECS_V3 = deepFreeze({
  "shared.n-channel-power-mosfet": codecForV3("shared.n-channel-power-mosfet"),
  "motor.supply-tvs-diode": codecForV3("motor.supply-tvs-diode"),
} satisfies { [ClassId in V3PartClassId]: DesignProfileFactsCodecV3<ClassId> });

export const DESIGN_PROFILE_FACTS_CODECS_V31 = deepFreeze({
  "motor.full-bridge-gate-driver": codecForV31("motor.full-bridge-gate-driver"),
} satisfies { [ClassId in V31PartClassId]: DesignProfileFactsCodecV31<ClassId> });

export const DESIGN_PROFILE_FACTS_CODECS_V32 = deepFreeze({
  "motor.integrated-h-bridge": codecForV32("motor.integrated-h-bridge"),
} satisfies { [ClassId in V32PartClassId]: DesignProfileFactsCodecV32<ClassId> });

export const DESIGN_PROFILE_FACTS_CODECS_V33 = deepFreeze({
  "power.integrated-synchronous-buck-regulator": codecForV33("power.integrated-synchronous-buck-regulator"),
} satisfies { [ClassId in V33PartClassId]: DesignProfileFactsCodecV33<ClassId> });

export const DESIGN_PROFILE_FACTS_CODECS_V34 = deepFreeze({
  "power.power-inductor": codecForV34("power.power-inductor"),
} satisfies { [ClassId in V34PartClassId]: DesignProfileFactsCodecV34<ClassId> });

export function getDesignProfileCodecForVersion<ClassId extends PartClassId>(
  partClass: ClassId,
  factsSchemaVersion: typeof FACTS_SCHEMA_VERSION,
): DesignProfileCodec<ClassId>;
export function getDesignProfileCodecForVersion<ClassId extends PartClassId>(
  partClass: ClassId,
  factsSchemaVersion: typeof FACTS_SCHEMA_VERSION_V2,
): DesignProfileFactsCodecV2<ClassId>;
export function getDesignProfileCodecForVersion<ClassId extends V3PartClassId>(
  partClass: ClassId,
  factsSchemaVersion: typeof FACTS_SCHEMA_VERSION_V3,
): DesignProfileFactsCodecV3<ClassId>;
export function getDesignProfileCodecForVersion<ClassId extends V31PartClassId>(
  partClass: ClassId,
  factsSchemaVersion: typeof FACTS_SCHEMA_VERSION_V31,
): DesignProfileFactsCodecV31<ClassId>;
export function getDesignProfileCodecForVersion<ClassId extends V32PartClassId>(
  partClass: ClassId,
  factsSchemaVersion: typeof FACTS_SCHEMA_VERSION_V32,
): DesignProfileFactsCodecV32<ClassId>;
export function getDesignProfileCodecForVersion<ClassId extends V33PartClassId>(
  partClass: ClassId,
  factsSchemaVersion: typeof FACTS_SCHEMA_VERSION_V33,
): DesignProfileFactsCodecV33<ClassId>;
export function getDesignProfileCodecForVersion<ClassId extends V34PartClassId>(
  partClass: ClassId,
  factsSchemaVersion: typeof FACTS_SCHEMA_VERSION_V34,
): DesignProfileFactsCodecV34<ClassId>;
export function getDesignProfileCodecForVersion<ClassId extends PartClassId>(
  partClass: ClassId,
  factsSchemaVersion: typeof FACTS_SCHEMA_VERSION | typeof FACTS_SCHEMA_VERSION_V2 | typeof FACTS_SCHEMA_VERSION_V3 | typeof FACTS_SCHEMA_VERSION_V31 | typeof FACTS_SCHEMA_VERSION_V32 | typeof FACTS_SCHEMA_VERSION_V33 | typeof FACTS_SCHEMA_VERSION_V34,
): VersionedDesignProfileCodec<ClassId> {
  if (factsSchemaVersion === FACTS_SCHEMA_VERSION) return getDesignProfileCodec(partClass);
  if (factsSchemaVersion === FACTS_SCHEMA_VERSION_V2 && Object.prototype.hasOwnProperty.call(DESIGN_PROFILE_FACTS_CODECS_V2, partClass)) {
    return DESIGN_PROFILE_FACTS_CODECS_V2[partClass] as DesignProfileFactsCodecV2<ClassId>;
  }
  if (factsSchemaVersion === FACTS_SCHEMA_VERSION_V3 && Object.prototype.hasOwnProperty.call(DESIGN_PROFILE_FACTS_CODECS_V3, partClass)) {
    return DESIGN_PROFILE_FACTS_CODECS_V3[partClass as V3PartClassId] as VersionedDesignProfileCodec<ClassId>;
  }
  if (factsSchemaVersion === FACTS_SCHEMA_VERSION_V31 && Object.prototype.hasOwnProperty.call(DESIGN_PROFILE_FACTS_CODECS_V31, partClass)) {
    return DESIGN_PROFILE_FACTS_CODECS_V31[partClass as V31PartClassId] as VersionedDesignProfileCodec<ClassId>;
  }
  if (factsSchemaVersion === FACTS_SCHEMA_VERSION_V32 && Object.prototype.hasOwnProperty.call(DESIGN_PROFILE_FACTS_CODECS_V32, partClass)) {
    return DESIGN_PROFILE_FACTS_CODECS_V32[partClass as V32PartClassId] as VersionedDesignProfileCodec<ClassId>;
  }
  if (factsSchemaVersion === FACTS_SCHEMA_VERSION_V33 && Object.prototype.hasOwnProperty.call(DESIGN_PROFILE_FACTS_CODECS_V33, partClass)) {
    return DESIGN_PROFILE_FACTS_CODECS_V33[partClass as V33PartClassId] as VersionedDesignProfileCodec<ClassId>;
  }
  if (factsSchemaVersion === FACTS_SCHEMA_VERSION_V34 && Object.prototype.hasOwnProperty.call(DESIGN_PROFILE_FACTS_CODECS_V34, partClass)) {
    return DESIGN_PROFILE_FACTS_CODECS_V34[partClass as V34PartClassId] as VersionedDesignProfileCodec<ClassId>;
  }
  throw new TypeError(`factsSchemaVersion [unknown_codec_version]: ${String(factsSchemaVersion)}`);
}

export function parseDesignProfileForV3<ClassId extends V3PartClassId>(
  codec: DesignProfileFactsCodecV3<ClassId>,
  input: unknown,
  registry?: ManufacturerRegistryV1,
): DesignProfileV3<ClassId> {
  const profile = parseDesignProfileV3(input, registry);
  if (profile.partClass !== codec.partClass) {
    throw new Error(`partClass [codec_mismatch]: Expected ${codec.partClass}`);
  }
  return profile as DesignProfileV3<ClassId>;
}

export function parseDesignProfileForV31<ClassId extends V31PartClassId>(
  codec: DesignProfileFactsCodecV31<ClassId>,
  input: unknown,
  registry?: ManufacturerRegistryV1,
): DesignProfileV31<ClassId> {
  const profile = parseDesignProfileV31(input, registry);
  if (profile.partClass !== codec.partClass) {
    throw new Error(`partClass [codec_mismatch]: Expected ${codec.partClass}`);
  }
  return profile as DesignProfileV31<ClassId>;
}

export function parseDesignProfileForV32<ClassId extends V32PartClassId>(
  codec: DesignProfileFactsCodecV32<ClassId>,
  input: unknown,
  registry?: ManufacturerRegistryV1,
): DesignProfileV32<ClassId> {
  if (codec.factsSchemaVersion !== FACTS_SCHEMA_VERSION_V32) {
    throw new Error(`factsSchemaVersion [codec_mismatch]: Expected ${FACTS_SCHEMA_VERSION_V32}`);
  }
  const profile = parseDesignProfileV32(input, registry);
  if (profile.partClass !== codec.partClass) {
    throw new Error(`partClass [codec_mismatch]: Expected ${codec.partClass}`);
  }
  return profile as DesignProfileV32<ClassId>;
}

export function parseDesignProfileForV33<ClassId extends V33PartClassId>(
  codec: DesignProfileFactsCodecV33<ClassId>,
  input: unknown,
  registry?: ManufacturerRegistryV1,
): DesignProfileV33<ClassId> {
  if (codec.factsSchemaVersion !== FACTS_SCHEMA_VERSION_V33) {
    throw new Error(`factsSchemaVersion [codec_mismatch]: Expected ${FACTS_SCHEMA_VERSION_V33}`);
  }
  const profile = parseDesignProfileV33(input, registry);
  if (profile.partClass !== codec.partClass) {
    throw new Error(`partClass [codec_mismatch]: Expected ${codec.partClass}`);
  }
  return profile as DesignProfileV33<ClassId>;
}

export function parseDesignProfileForV34<ClassId extends V34PartClassId>(
  codec: DesignProfileFactsCodecV34<ClassId>,
  input: unknown,
  registry?: ManufacturerRegistryV1,
): DesignProfileV34<ClassId> {
  if (codec.factsSchemaVersion !== FACTS_SCHEMA_VERSION_V34) {
    throw new Error(`factsSchemaVersion [codec_mismatch]: Expected ${FACTS_SCHEMA_VERSION_V34}`);
  }
  const profile = parseDesignProfileV34(input, registry);
  if (profile.partClass !== codec.partClass) {
    throw new Error(`partClass [codec_mismatch]: Expected ${codec.partClass}`);
  }
  return profile as DesignProfileV34<ClassId>;
}

export function parseDesignProfileForV2<ClassId extends PartClassId>(
  codec: DesignProfileFactsCodecV2<ClassId>,
  input: unknown,
  registry?: ManufacturerRegistryV1,
): DesignProfileWithFactsV2<ClassId, FactsV2For<ClassId>> {
  const profile = parseDesignProfileEnvelope(input, registry);
  if (profile.factsSchemaVersion !== FACTS_SCHEMA_VERSION_V2) {
    throw new Error(`factsSchemaVersion [codec_mismatch]: Expected ${FACTS_SCHEMA_VERSION_V2}`);
  }
  if (profile.partClass !== codec.partClass) {
    throw new Error(`partClass [codec_mismatch]: Expected ${codec.partClass}`);
  }
  return profile as DesignProfileWithFactsV2<ClassId, FactsV2For<ClassId>>;
}
