import { deepFreeze, type DeepReadonly } from "./canonical";

export type PowerReferenceDesignRuntimeUnitV1 = "1" | "A" | "A/s" | "Hz" | "K" | "V" | "s";

export interface PowerReferenceDesignRuntimeQuantityV1 {
  value: number;
  unit: PowerReferenceDesignRuntimeUnitV1;
}

export interface PowerReferenceDesignRuntimeRangeV1 {
  minimum: PowerReferenceDesignRuntimeQuantityV1;
  maximum: PowerReferenceDesignRuntimeQuantityV1;
}

export interface PowerReferenceDesignRuntimeConditionV1 {
  parameterId: string;
  range: PowerReferenceDesignRuntimeRangeV1;
}

/**
 * Minimum observation projection needed for request-condition filtering. Source
 * URLs, licensing text, locators, explanations, and the published BOM stay on
 * the explicit non-browser evidence-artifact surface.
 */
export interface PowerReferenceDesignRuntimeObservationV1 {
  id: string;
  measurand: string;
  value: PowerReferenceDesignRuntimeQuantityV1 | null;
  range: PowerReferenceDesignRuntimeRangeV1 | null;
  conditions: readonly PowerReferenceDesignRuntimeConditionV1[];
}

function q(
  value: number,
  unit: PowerReferenceDesignRuntimeUnitV1,
): PowerReferenceDesignRuntimeQuantityV1 {
  return { value, unit };
}

function range(
  minimum: number,
  maximum: number,
  unit: PowerReferenceDesignRuntimeUnitV1,
): PowerReferenceDesignRuntimeRangeV1 {
  return { minimum: q(minimum, unit), maximum: q(maximum, unit) };
}

function condition(
  parameterId: string,
  minimum: number,
  maximum: number,
  unit: PowerReferenceDesignRuntimeUnitV1,
): PowerReferenceDesignRuntimeConditionV1 {
  return { parameterId, range: range(minimum, maximum, unit) };
}

const runtimeProjection = {
  identity: {
    manufacturerId: "texas-instruments",
    referenceDesignId: "TPS54302EVM-716",
    assemblyId: "PWR716-003",
  },
  document: {
    documentId: "SLVUAP9B",
    revision: "Rev. B",
    contentHash: "sha256:6b899344dda01d5cc4ddc729b98d11525e66b849a8dd6a6c50e2544a547ce18e",
  },
  evidenceContentHash: "sha256:72741d2cc9247c93984a9f9ec30ac498f0ca89665aedcf73be3fff5abe605cbb",
  bomContentHash: "sha256:a00103510946887a5a3c8f938954a5ac908b23ef76c02e050a1d1ebcfedf3b22",
  layoutReferenceContentHash: "sha256:e7c4135d2e9649f79280035eb1e1174c3ea8ea48e7133f50e9e149d8b43c450a",
  referenceParts: {
    regulator: {
      manufacturerId: "texas-instruments",
      manufacturerPartNumber: "TPS54302DDC",
      nominalValue: null,
    },
    inductor: {
      manufacturerId: "wurth-elektronik",
      manufacturerPartNumber: "7447714100",
      nominalValue: "10uH",
    },
  },
  observations: [
    {
      id: "power.reference.tps54302evm716.tested-operating-envelope",
      measurand: "inputVoltage",
      value: null,
      range: range(8, 28, "V"),
      conditions: [
        condition("outputVoltage", 5, 5, "V"),
        condition("outputCurrent", 0, 3, "A"),
        condition("ambientTemperature", 298.15, 298.15, "K"),
      ],
    },
    {
      id: "power.reference.tps54302evm716.center-switching-frequency",
      measurand: "switchingFrequency",
      value: q(400_000, "Hz"),
      range: null,
      conditions: [
        condition("inputVoltage", 24, 24, "V"),
        condition("outputVoltage", 5, 5, "V"),
        condition("ambientTemperature", 298.15, 298.15, "K"),
      ],
    },
    {
      id: "power.reference.tps54302evm716.maximum-efficiency",
      measurand: "efficiency",
      value: q(0.9557, "1"),
      range: null,
      conditions: [
        condition("inputVoltage", 12, 12, "V"),
        condition("outputVoltage", 5, 5, "V"),
        condition("outputCurrent", 1, 1, "A"),
        condition("ambientTemperature", 298.15, 298.15, "K"),
      ],
    },
    {
      id: "power.reference.tps54302evm716.load-regulation",
      measurand: "loadRegulation",
      value: q(0.005, "1"),
      range: null,
      conditions: [
        condition("inputVoltage", 12, 12, "V"),
        condition("outputVoltage", 5, 5, "V"),
        condition("outputCurrent", 0, 3, "A"),
        condition("ambientTemperature", 298.15, 298.15, "K"),
      ],
    },
    {
      id: "power.reference.tps54302evm716.line-regulation",
      measurand: "lineRegulation",
      value: q(0.005, "1"),
      range: null,
      conditions: [
        condition("inputVoltage", 8, 28, "V"),
        condition("outputVoltage", 5, 5, "V"),
        condition("outputCurrent", 1.5, 1.5, "A"),
        condition("ambientTemperature", 298.15, 298.15, "K"),
      ],
    },
    {
      id: "power.reference.tps54302evm716.output-ripple-full-load",
      measurand: "outputRipple",
      value: q(0.03, "V"),
      range: null,
      conditions: [
        condition("inputVoltage", 24, 24, "V"),
        condition("outputVoltage", 5, 5, "V"),
        condition("outputCurrent", 3, 3, "A"),
        condition("ambientTemperature", 298.15, 298.15, "K"),
      ],
    },
    {
      id: "power.reference.tps54302evm716.load-transient-rising",
      measurand: "loadTransientVoltage",
      value: q(0.15, "V"),
      range: null,
      conditions: [
        condition("inputVoltage", 24, 24, "V"),
        condition("outputVoltage", 5, 5, "V"),
        condition("outputCurrentBefore", 0.75, 0.75, "A"),
        condition("outputCurrentAfter", 2.25, 2.25, "A"),
        condition("loadSlewRate", 250_000, 250_000, "A/s"),
        condition("ambientTemperature", 298.15, 298.15, "K"),
      ],
    },
    {
      id: "power.reference.tps54302evm716.load-transient-falling",
      measurand: "loadTransientVoltage",
      value: q(0.15, "V"),
      range: null,
      conditions: [
        condition("inputVoltage", 24, 24, "V"),
        condition("outputVoltage", 5, 5, "V"),
        condition("outputCurrentBefore", 2.25, 2.25, "A"),
        condition("outputCurrentAfter", 0.75, 0.75, "A"),
        condition("loadSlewRate", 250_000, 250_000, "A/s"),
        condition("ambientTemperature", 298.15, 298.15, "K"),
      ],
    },
    {
      id: "power.reference.tps54302evm716.load-transient-recovery-rising",
      measurand: "loadTransientRecoveryTime",
      value: q(150e-6, "s"),
      range: null,
      conditions: [
        condition("inputVoltage", 24, 24, "V"),
        condition("outputVoltage", 5, 5, "V"),
        condition("outputCurrentBefore", 0.75, 0.75, "A"),
        condition("outputCurrentAfter", 2.25, 2.25, "A"),
        condition("loadSlewRate", 250_000, 250_000, "A/s"),
        condition("ambientTemperature", 298.15, 298.15, "K"),
      ],
    },
    {
      id: "power.reference.tps54302evm716.load-transient-recovery-falling",
      measurand: "loadTransientRecoveryTime",
      value: q(150e-6, "s"),
      range: null,
      conditions: [
        condition("inputVoltage", 24, 24, "V"),
        condition("outputVoltage", 5, 5, "V"),
        condition("outputCurrentBefore", 2.25, 2.25, "A"),
        condition("outputCurrentAfter", 0.75, 0.75, "A"),
        condition("loadSlewRate", 250_000, 250_000, "A/s"),
        condition("ambientTemperature", 298.15, 298.15, "K"),
      ],
    },
  ] satisfies PowerReferenceDesignRuntimeObservationV1[],
} as const;

export const TPS54302EVM_716_REFERENCE_DESIGN_RUNTIME_V1 =
  deepFreeze(runtimeProjection);

export const TPS54302EVM_716_REFERENCE_DESIGN_IDENTITY_ASSERTION_V1 =
  deepFreeze({
    referenceDesignId: runtimeProjection.identity.referenceDesignId,
    assemblyId: runtimeProjection.identity.assemblyId,
    evidenceContentHash: runtimeProjection.evidenceContentHash,
    bomContentHash: runtimeProjection.bomContentHash,
    layoutReferenceContentHash: runtimeProjection.layoutReferenceContentHash,
  });

export type Tps54302Evm716ReferenceDesignRuntimeV1 =
  DeepReadonly<typeof runtimeProjection>;
