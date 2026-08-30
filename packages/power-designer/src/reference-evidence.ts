import { TPS54302EVM_716_REFERENCE_DESIGN_RUNTIME_V1 } from "@opencircuit/design-library/v2-runtime";
import {
  POWER_TPS54302EVM_716_REFERENCE_IDENTITY_ASSERTION_V1,
  assessTps54302Evm716ReferenceEvidenceV1,
  type PowerReferenceDesignEvidenceAssessmentV1,
} from "@opencircuit/design-recipes/power-reference-design-evidence";
import type { BuckDesignRequestV2 } from "@opencircuit/design-schema";

type DeepReadonly<Value> = Value extends (...args: never[]) => unknown
  ? Value
  : Value extends readonly (infer Entry)[]
    ? readonly DeepReadonly<Entry>[]
    : Value extends object
      ? { readonly [Key in keyof Value]: DeepReadonly<Value[Key]> }
      : Value;

function deepFreeze<Value>(value: Value): DeepReadonly<Value> {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value as DeepReadonly<Value>;
}

export interface PowerReferenceEvidencePartV1 {
  manufacturerId: string;
  manufacturerPartNumber: string;
  nominalValue: string | null;
}

export interface PowerTps54302Evm716ReferenceEvidenceV1 {
  kind: "power_reference_design_evidence";
  schemaVersion: 1;
  application: "power.buck";
  reference: {
    manufacturerId: "texas-instruments";
    referenceDesignId: "TPS54302EVM-716";
    assemblyId: "PWR716-003";
    documentId: "SLVUAP9B";
    documentRevision: "Rev. B";
    sourceContentHash: `sha256:${string}`;
    evidenceContentHash: `sha256:${string}`;
    bomContentHash: `sha256:${string}`;
    layoutReferenceContentHash: `sha256:${string}`;
    recipeId: "power.reference-evidence.tps54302evm-716";
    recipeContentHash: `sha256:${string}`;
  };
  requestAssessment: PowerReferenceDesignEvidenceAssessmentV1;
  candidateAssessment: PowerReferenceDesignEvidenceAssessmentV1;
  bomComparison: {
    matchesInstalledCandidate: false;
    referenceDesign: {
      regulator: PowerReferenceEvidencePartV1;
      inductor: PowerReferenceEvidencePartV1;
    };
    installedCandidate: {
      regulator: PowerReferenceEvidencePartV1;
      inductor: PowerReferenceEvidencePartV1;
    };
    consequence: "reference_observations_do_not_apply_to_installed_candidate";
  };
  boundaries: {
    identityAssertionAttestation: "none";
    strictConstraintAuthority: false;
    physicalAssemblyQualificationAuthority: false;
    applicationAuthority: false;
    candidateEligibilityAuthority: false;
    selectedPartModelCoverage: "not_claimed";
    externalNetworkLinkIncluded: false;
  };
}

export type PowerTps54302Evm716ReferenceEvidenceDtoV1 =
  DeepReadonly<PowerTps54302Evm716ReferenceEvidenceV1>;

const INSTALLED_REGULATOR = {
  manufacturerId: "texas-instruments",
  manufacturerPartNumber: "TPS54302DDCR",
  nominalValue: null,
} as const satisfies PowerReferenceEvidencePartV1;

const INSTALLED_INDUCTOR = {
  manufacturerId: "bel-fuse",
  manufacturerPartNumber: "F1F2-0804-100M",
  nominalValue: "10uH",
} as const satisfies PowerReferenceEvidencePartV1;

/**
 * Builds a display-only sidecar for the exact published EVM identity. The
 * result is intentionally separate from DesignResultV2 and ConstraintDecisionV3:
 * callers must bind it to their transient production-generation authority.
 */
export function assessPowerTps54302Evm716ReferenceEvidenceV1(
  request: Readonly<BuckDesignRequestV2>,
): PowerTps54302Evm716ReferenceEvidenceDtoV1 {
  const runtime = TPS54302EVM_716_REFERENCE_DESIGN_RUNTIME_V1;
  const requestAssessment = assessTps54302Evm716ReferenceEvidenceV1(
    request,
    POWER_TPS54302EVM_716_REFERENCE_IDENTITY_ASSERTION_V1,
  );
  const candidateAssessment = assessTps54302Evm716ReferenceEvidenceV1(request, null);

  return deepFreeze({
    kind: "power_reference_design_evidence",
    schemaVersion: 1,
    application: "power.buck",
    reference: {
      manufacturerId: runtime.identity.manufacturerId,
      referenceDesignId: runtime.identity.referenceDesignId,
      assemblyId: runtime.identity.assemblyId,
      documentId: runtime.document.documentId,
      documentRevision: runtime.document.revision,
      sourceContentHash: runtime.document.contentHash,
      evidenceContentHash: runtime.evidenceContentHash,
      bomContentHash: runtime.bomContentHash,
      layoutReferenceContentHash: runtime.layoutReferenceContentHash,
      recipeId: requestAssessment.recipeId,
      recipeContentHash: requestAssessment.recipeContentHash,
    },
    requestAssessment,
    candidateAssessment,
    bomComparison: {
      matchesInstalledCandidate: false,
      referenceDesign: {
        regulator: runtime.referenceParts.regulator,
        inductor: runtime.referenceParts.inductor,
      },
      installedCandidate: {
        regulator: INSTALLED_REGULATOR,
        inductor: INSTALLED_INDUCTOR,
      },
      consequence: "reference_observations_do_not_apply_to_installed_candidate",
    },
    boundaries: {
      identityAssertionAttestation: "none",
      strictConstraintAuthority: false,
      physicalAssemblyQualificationAuthority: false,
      applicationAuthority: false,
      candidateEligibilityAuthority: false,
      selectedPartModelCoverage: "not_claimed",
      externalNetworkLinkIncluded: false,
    },
  });
}
