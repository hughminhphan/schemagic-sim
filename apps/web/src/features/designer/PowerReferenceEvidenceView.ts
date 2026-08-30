import type { PowerTps54302Evm716ReferenceEvidenceDtoV1 } from "@opencircuit/power-designer/reference-evidence";
import { escapeHtml } from "./view";

const STRICT_RULE_IDS = [
  "power.regulator.output-current",
  "power.inductor.selected-value",
  "power.inductor.saturation-current",
  "power.inductor.rms-current",
  "power.regulator.current-limit",
  "power.control.loop-stability",
  "power.passive.capacitor-effective-capacitance",
  "power.passive.bootstrap-effective-capacitance",
  "power.regulator.minimum-on-time",
  "power.regulator.minimum-off-time",
  "power.request.output-ripple",
  "power.thermal.loss-model",
  "power.thermal.maximum-junction",
] as const;

const REFERENCE_OBSERVATION_IDS = [
  "power.reference.tps54302evm716.tested-operating-envelope",
  "power.reference.tps54302evm716.center-switching-frequency",
  "power.reference.tps54302evm716.maximum-efficiency",
  "power.reference.tps54302evm716.load-regulation",
  "power.reference.tps54302evm716.line-regulation",
  "power.reference.tps54302evm716.output-ripple-full-load",
  "power.reference.tps54302evm716.load-transient-rising",
  "power.reference.tps54302evm716.load-transient-falling",
  "power.reference.tps54302evm716.load-transient-recovery-rising",
  "power.reference.tps54302evm716.load-transient-recovery-falling",
] as const;

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length
    && expected.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function exactStrings(value: unknown, expected: readonly string[]): boolean {
  return Array.isArray(value)
    && value.length === expected.length
    && value.every((entry, index) => entry === expected[index]);
}

function orderedObservationSubset(value: unknown): value is readonly string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) return false;
  let previousIndex = -1;
  for (const entry of value) {
    const index = REFERENCE_OBSERVATION_IDS.indexOf(entry as never);
    if (index <= previousIndex) return false;
    previousIndex = index;
  }
  return true;
}

function exactAssessment(
  value: unknown,
  identityState: "asserted_reference_identity_unattested" | "reference_identity_not_asserted",
  requireNoObservations: boolean,
): boolean {
  const assessment = record(value);
  if (assessment === undefined) return false;
  const observations = assessment.referenceObservationIdsAtRequestedConditions;
  return hasExactKeys(assessment, [
    "recipeId",
    "recipeContentHash",
    "referenceDesignEvidenceContentHash",
    "referenceBomContentHash",
    "referenceLayoutContentHash",
    "identityState",
    "referenceObservationIdsAtRequestedConditions",
    "strictClosedRuleIds",
    "blockedRuleIds",
    "identityAssertionAttestation",
    "physicalAssemblyQualificationAuthority",
    "applicationAuthority",
    "candidateEligibilityAuthority",
  ])
    && assessment.recipeId === "power.reference-evidence.tps54302evm-716"
    && assessment.recipeContentHash === "sha256:0af91dc33d5663f44b107ece068a0acb1552449b279812aab65615a3f10f9cc2"
    && assessment.referenceDesignEvidenceContentHash === "sha256:72741d2cc9247c93984a9f9ec30ac498f0ca89665aedcf73be3fff5abe605cbb"
    && assessment.referenceBomContentHash === "sha256:a00103510946887a5a3c8f938954a5ac908b23ef76c02e050a1d1ebcfedf3b22"
    && assessment.referenceLayoutContentHash === "sha256:e7c4135d2e9649f79280035eb1e1174c3ea8ea48e7133f50e9e149d8b43c450a"
    && assessment.identityState === identityState
    && orderedObservationSubset(observations)
    && (!requireNoObservations || observations.length === 0)
    && exactStrings(assessment.strictClosedRuleIds, [])
    && exactStrings(assessment.blockedRuleIds, STRICT_RULE_IDS)
    && assessment.identityAssertionAttestation === "none"
    && assessment.physicalAssemblyQualificationAuthority === false
    && assessment.applicationAuthority === false
    && assessment.candidateEligibilityAuthority === false;
}

function exactPart(
  value: unknown,
  manufacturerId: string,
  manufacturerPartNumber: string,
  nominalValue: string | null,
): boolean {
  const part = record(value);
  return part !== undefined
    && hasExactKeys(part, ["manufacturerId", "manufacturerPartNumber", "nominalValue"])
    && part.manufacturerId === manufacturerId
    && part.manufacturerPartNumber === manufacturerPartNumber
    && part.nominalValue === nominalValue;
}

function safePowerReferenceEvidence(
  value: unknown,
): value is PowerTps54302Evm716ReferenceEvidenceDtoV1 {
  try {
    const evidence = record(value);
    if (evidence === undefined) return false;
    const reference = record(evidence.reference);
    const comparison = record(evidence.bomComparison);
    const referenceDesign = record(comparison?.referenceDesign);
    const installedCandidate = record(comparison?.installedCandidate);
    const boundaries = record(evidence.boundaries);
    return hasExactKeys(evidence, [
      "kind",
      "schemaVersion",
      "application",
      "reference",
      "requestAssessment",
      "candidateAssessment",
      "bomComparison",
      "boundaries",
    ])
      && reference !== undefined
      && hasExactKeys(reference, [
        "manufacturerId",
        "referenceDesignId",
        "assemblyId",
        "documentId",
        "documentRevision",
        "sourceContentHash",
        "evidenceContentHash",
        "bomContentHash",
        "layoutReferenceContentHash",
        "recipeId",
        "recipeContentHash",
      ])
      && comparison !== undefined
      && hasExactKeys(comparison, [
        "matchesInstalledCandidate",
        "referenceDesign",
        "installedCandidate",
        "consequence",
      ])
      && referenceDesign !== undefined
      && hasExactKeys(referenceDesign, ["regulator", "inductor"])
      && installedCandidate !== undefined
      && hasExactKeys(installedCandidate, ["regulator", "inductor"])
      && boundaries !== undefined
      && hasExactKeys(boundaries, [
        "identityAssertionAttestation",
        "strictConstraintAuthority",
        "physicalAssemblyQualificationAuthority",
        "applicationAuthority",
        "candidateEligibilityAuthority",
        "selectedPartModelCoverage",
        "externalNetworkLinkIncluded",
      ])
      && evidence.kind === "power_reference_design_evidence"
      && evidence.schemaVersion === 1
      && evidence.application === "power.buck"
      && reference.manufacturerId === "texas-instruments"
      && reference.referenceDesignId === "TPS54302EVM-716"
      && reference.assemblyId === "PWR716-003"
      && reference.documentId === "SLVUAP9B"
      && reference.documentRevision === "Rev. B"
      && reference.sourceContentHash === "sha256:6b899344dda01d5cc4ddc729b98d11525e66b849a8dd6a6c50e2544a547ce18e"
      && reference.evidenceContentHash === "sha256:72741d2cc9247c93984a9f9ec30ac498f0ca89665aedcf73be3fff5abe605cbb"
      && reference.bomContentHash === "sha256:a00103510946887a5a3c8f938954a5ac908b23ef76c02e050a1d1ebcfedf3b22"
      && reference.layoutReferenceContentHash === "sha256:e7c4135d2e9649f79280035eb1e1174c3ea8ea48e7133f50e9e149d8b43c450a"
      && reference.recipeId === "power.reference-evidence.tps54302evm-716"
      && reference.recipeContentHash === "sha256:0af91dc33d5663f44b107ece068a0acb1552449b279812aab65615a3f10f9cc2"
      && exactAssessment(evidence.requestAssessment, "asserted_reference_identity_unattested", false)
      && exactAssessment(evidence.candidateAssessment, "reference_identity_not_asserted", true)
      && comparison.matchesInstalledCandidate === false
      && comparison.consequence === "reference_observations_do_not_apply_to_installed_candidate"
      && exactPart(referenceDesign?.regulator, "texas-instruments", "TPS54302DDC", null)
      && exactPart(referenceDesign?.inductor, "wurth-elektronik", "7447714100", "10uH")
      && exactPart(installedCandidate?.regulator, "texas-instruments", "TPS54302DDCR", null)
      && exactPart(installedCandidate?.inductor, "bel-fuse", "F1F2-0804-100M", "10uH")
      && boundaries.identityAssertionAttestation === "none"
      && boundaries.strictConstraintAuthority === false
      && boundaries.physicalAssemblyQualificationAuthority === false
      && boundaries.applicationAuthority === false
      && boundaries.candidateEligibilityAuthority === false
      && boundaries.selectedPartModelCoverage === "not_claimed"
      && boundaries.externalNetworkLinkIncluded === false;
  } catch {
    return false;
  }
}

function invalidBoundaryMarkup(): string {
  return `<section class="designer-reference-evidence designer-reference-evidence-invalid" data-power-reference-evidence-invalid role="status" aria-labelledby="designer-reference-evidence-invalid-title"><span class="designer-section-code">REFERENCE BOUNDARY INVALID</span><h2 id="designer-reference-evidence-invalid-title">Reference evidence withheld</h2><p>The auxiliary reference record was malformed or attempted to exceed its observation-only authority. No reference observations, BOM comparison, strict-rule closure, or candidate effect are shown.</p></section>`;
}

export function renderPowerReferenceEvidence(value: unknown): string {
  if (value === undefined) return "";
  if (!safePowerReferenceEvidence(value)) return invalidBoundaryMarkup();

  const observations = value.requestAssessment.referenceObservationIdsAtRequestedConditions;
  const referenceRegulator = value.bomComparison.referenceDesign.regulator;
  const referenceInductor = value.bomComparison.referenceDesign.inductor;
  const installedRegulator = value.bomComparison.installedCandidate.regulator;
  const installedInductor = value.bomComparison.installedCandidate.inductor;
  return `<section class="designer-reference-evidence" data-power-reference-evidence aria-labelledby="designer-reference-evidence-title"><header><div><span class="designer-section-code">REFERENCE ONLY · NOT CANDIDATE EVIDENCE</span><h2 id="designer-reference-evidence-title">${escapeHtml(value.reference.referenceDesignId)} reference observations</h2><p>${escapeHtml(value.reference.assemblyId)} · ${escapeHtml(value.reference.documentId)} ${escapeHtml(value.reference.documentRevision)}</p></div><span class="designer-reference-evidence-chip">UNATTESTED</span></header><p class="designer-reference-evidence-boundary"><strong>Identity asserted but unattested.</strong> These manufacturer evaluation-module observations are condition-filtered reference context only. They have zero strict-constraint authority, zero candidate-eligibility authority, and do not qualify a physical assembly.</p><dl class="designer-stat-grid"><div><dt>Request-relevant observations</dt><dd>${observations.length}</dd></div><div><dt>Strict rules closed</dt><dd>0</dd></div><div><dt>Strict rules still blocked</dt><dd>${value.requestAssessment.blockedRuleIds.length}</dd></div><div><dt>Candidate observations</dt><dd>0</dd></div></dl><div class="designer-reference-evidence-grid"><section aria-labelledby="designer-reference-observations-title"><h3 id="designer-reference-observations-title">Condition-relevant EVM observations</h3>${observations.length === 0 ? `<p>No published EVM observation covers the current requested conditions.</p>` : `<ul data-power-reference-observations>${observations.map((id) => `<li><code>${escapeHtml(id)}</code></li>`).join("")}</ul>`}<p>The installed candidate identity is not asserted as this EVM, so none of these observations applies to it.</p></section><section aria-labelledby="designer-reference-bom-title"><h3 id="designer-reference-bom-title">Exact MPN / BOM mismatch</h3><div class="designer-reference-bom"><article><span>Published EVM</span><code>${escapeHtml(referenceRegulator.manufacturerPartNumber)}</code><code>${escapeHtml(referenceInductor.manufacturerPartNumber)} · ${escapeHtml(referenceInductor.nominalValue ?? "unspecified")}</code></article><i aria-hidden="true">≠</i><article><span>Installed candidate path</span><code>${escapeHtml(installedRegulator.manufacturerPartNumber)}</code><code>${escapeHtml(installedInductor.manufacturerPartNumber)} · ${escapeHtml(installedInductor.nominalValue ?? "unspecified")}</code></article></div><p>Both inductors are nominally 10uH; the mismatch is exact MPN and BOM identity, not nominal inductance.</p><p>No eligibility, strict-rule, selected-part model, provider, sourcing, or commercial effect.</p></section></div><details><summary>Exact reference identities</summary><dl><div><dt>Evidence</dt><dd><code>${escapeHtml(value.reference.evidenceContentHash)}</code></dd></div><div><dt>Published BOM</dt><dd><code>${escapeHtml(value.reference.bomContentHash)}</code></dd></div><div><dt>Published layout reference</dt><dd><code>${escapeHtml(value.reference.layoutReferenceContentHash)}</code></dd></div><div><dt>Observation recipe</dt><dd><code>${escapeHtml(value.reference.recipeContentHash)}</code></dd></div></dl></details></section>`;
}
