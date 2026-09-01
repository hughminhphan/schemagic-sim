import {
  parseElectricalDesignRequestV2,
  serializeDesignResultV2,
  type BrushedDcMotorDesignRequestV2,
  type BrushedDcMotorDesignRequestV3,
  type BuckDesignRequestV2,
  type BuckDesignRequestV3,
  type CandidateIdV2,
  type Quantity,
  type PrimaryPartCustomizationSidecarV1,
  type PrimaryPartCustomizedResultSidecarV1,
  type SIUnit,
} from "@opencircuit/design-schema";
import { MOTOR_DESIGN_V2_PRODUCTION_STATUS } from "@opencircuit/motor-designer/v2-status";
import { MOTOR_CONSTRAINT_POLICY_V3_PRODUCTION_STATUS } from "@opencircuit/motor-designer/v3-status";
import { POWER_DESIGN_V2_PRODUCTION_STATUS } from "@opencircuit/power-designer/v2-status";
import { POWER_CONSTRAINT_POLICY_V3_PRODUCTION_STATUS } from "@opencircuit/power-designer/v3-status";
import type {
  PrimaryPartCustomizedArtifactKindV1,
  PrimaryPartCustomizedInstalledArtifactKindV1,
  PrimaryPartCustomizedReplayableArtifactKindV1,
} from "@opencircuit/design-export/primary-part-customized-artifact-v1";
import type { ProductionDesignArtifactKindV2 } from "@opencircuit/design-export/production-artifact-v2";
import type {
  DesignResultExecutionContextV2,
  GenerateElectricalContextV2,
} from "@opencircuit/design-engine/v2-export-runtime";
import type {
  SourcingRequestPacketInputV1,
  SourcingRequestPolicyV1,
} from "@opencircuit/sourcing-schema";
import {
  createSchemaParameterFormContract,
  type DesignerApplicationAdapter,
  type DesignerCustomizedTargetInspectionReceiptFileV1,
  type DesignerPrimaryPartCustomizationContractV1,
  type DesignerPrimaryPartCustomizationTargetV1,
  type DesignerProductionGenerationV2,
  type DesignerRequest,
  type DesignerSourcingRequestPacketContractV1,
} from "./contracts";

type ProductionGenerator = (request: DesignerRequest) => Promise<DesignerProductionGenerationV2>;

const MOTOR_PRODUCTION_ARTIFACT_KINDS = Object.freeze([
  "electrical_bom_csv",
  "scenario_spice",
  "structural_svg",
  "engineering_report_html",
  "structural_kicad",
] as const satisfies readonly ProductionDesignArtifactKindV2[]);

const POWER_PRODUCTION_ARTIFACT_KINDS = Object.freeze([
  ...MOTOR_PRODUCTION_ARTIFACT_KINDS,
  "physical_handoff_json",
] as const satisfies readonly ProductionDesignArtifactKindV2[]);

function assertAdvertisedProductionArtifactKind(
  application: "Motor" | "Power",
  kinds: readonly ProductionDesignArtifactKindV2[],
  kind: ProductionDesignArtifactKindV2,
): void {
  if (!kinds.includes(kind)) {
    throw new Error(`${application} production artifact kind is unavailable: ${kind}`);
  }
}

function productionGenerationFingerprint(generation: Readonly<DesignerProductionGenerationV2>): string {
  return JSON.stringify({
    kind: generation.kind,
    application: generation.application,
    contextManifestContentHash: generation.contextManifestContentHash,
    result: serializeDesignResultV2(generation.result),
    execution: generation.execution,
    ...(generation.referenceDesignEvidence === undefined
      ? {}
      : { referenceDesignEvidence: generation.referenceDesignEvidence }),
    ...(generation.kind === "production_constraint_observation"
      ? { constraintDecision: generation.constraintDecision }
      : {}),
  });
}

function customizedResultFingerprint(result: Readonly<PrimaryPartCustomizedResultSidecarV1>): string {
  return JSON.stringify(result);
}

function exactInstalledProductionGenerationBoundary(generator: ProductionGenerator): Readonly<{
  generate: ProductionGenerator;
  authorizesProductionGeneration(value: unknown): boolean;
}> {
  const fingerprints = new WeakMap<object, string>();
  return Object.freeze({
    async generate(request: DesignerRequest): Promise<DesignerProductionGenerationV2> {
      const generation = await generator(request);
      fingerprints.set(generation, productionGenerationFingerprint(generation));
      return generation;
    },
    authorizesProductionGeneration(value: unknown): boolean {
      if (value === null || typeof value !== "object") return false;
      // Installed generators return a transitively frozen graph. Exact identity
      // rejects clones and forgeries without repeatedly re-parsing that graph.
      return fingerprints.has(value);
    },
  });
}

function exactInstalledSourcingRequestPacketBoundary(
  productionBoundary: Readonly<{ authorizesProductionGeneration(value: unknown): boolean }>,
): DesignerSourcingRequestPacketContractV1 {
  return Object.freeze({
    async exportPacket(
      source: Readonly<DesignerProductionGenerationV2>,
      candidateId: CandidateIdV2,
      buildQuantity: number,
      policy: Readonly<SourcingRequestPolicyV1>,
    ) {
      if (!productionBoundary.authorizesProductionGeneration(source)) {
        throw new Error("Sourcing request export requires an authorized production generation");
      }
      const candidate = source.result.candidates.find((entry) => entry.id === candidateId);
      if (candidate === undefined) {
        throw new Error("Sourcing request export requires an exact candidate from the authorized generation");
      }
      const sourceFingerprintBefore = productionGenerationFingerprint(source);
      const sourceResultBytesBefore = serializeDesignResultV2(source.result);
      const policyFingerprintBefore = JSON.stringify(policy);
      const input: SourcingRequestPacketInputV1 = {
        designResultRef: {
          schemaVersion: 2,
          designResultContentHash: source.result.contentHash,
          requestHash: source.result.requestHash,
          libraryVersion: source.result.libraryVersion,
          libraryContentHash: source.result.libraryContentHash,
        },
        candidateRef: { id: candidate.id, recipeId: candidate.recipeId },
        bomLines: candidate.components.map((component) => ({
          lineId: component.id,
          manufacturerId: component.part.manufacturerId,
          manufacturerPartNumber: component.part.manufacturerPartNumber,
          quantityPerAssembly: component.quantityPerAssembly,
        })),
        buildQuantity,
        policy,
      };
      try {
        const {
          serializeSourcingRequestPacketV1,
          verifySourcingRequestPacketV1,
        } = await import("@opencircuit/sourcing-schema/request-packet-v1");
        if (!productionBoundary.authorizesProductionGeneration(source)) {
          throw new Error("Sourcing request export authority became stale");
        }
        const content = serializeSourcingRequestPacketV1(input);
        const packet = verifySourcingRequestPacketV1(content, input);
        return Object.freeze({
          kind: "provider_neutral_sourcing_request_packet" as const,
          filename: `schemagic-${source.application.replaceAll(".", "-")}-${packet.contentHash.slice(7, 19)}-sourcing-request-v1.json`,
          mimeType: "application/json;charset=utf-8" as const,
          content,
          packet,
        });
      } finally {
        if (
          serializeDesignResultV2(source.result) !== sourceResultBytesBefore
          || productionGenerationFingerprint(source) !== sourceFingerprintBefore
          || JSON.stringify(policy) !== policyFingerprintBefore
        ) {
          throw new Error("Sourcing request export mutated its authorized source or policy");
        }
      }
    },
  });
}

type InstalledPrimaryPartCustomizationRuntime = Readonly<{
  listTargets(
    source: Readonly<{ result: DesignerProductionGenerationV2["result"]; execution: DesignerProductionGenerationV2["execution"] }>,
    sourceCandidateId: string,
  ): readonly DesignerPrimaryPartCustomizationTargetV1[];
  generate(
    instruction: Readonly<PrimaryPartCustomizationSidecarV1>,
    source: Readonly<{ result: DesignerProductionGenerationV2["result"]; execution: DesignerProductionGenerationV2["execution"] }>,
  ): Readonly<PrimaryPartCustomizedResultSidecarV1>;
  assert(
    result: Readonly<PrimaryPartCustomizedResultSidecarV1>,
    source: Readonly<{ result: DesignerProductionGenerationV2["result"]; execution: DesignerProductionGenerationV2["execution"] }>,
  ): Readonly<PrimaryPartCustomizedResultSidecarV1>;
  installedArtifactContext(): Readonly<{
    engineeringContext: Readonly<GenerateElectricalContextV2>;
    executionContext: Readonly<DesignResultExecutionContextV2>;
  }>;
}>;

const PRIMARY_PART_CUSTOMIZED_REPLAYABLE_ARTIFACT_KINDS = Object.freeze([
  "customized_target_electrical_bom_csv",
  "customized_target_structural_svg",
] as const satisfies readonly PrimaryPartCustomizedReplayableArtifactKindV1[]);

const PRIMARY_PART_CUSTOMIZED_INSTALLED_ARTIFACT_KINDS = Object.freeze([
  "customized_target_engineering_report_html",
  "customized_target_structural_kicad",
  "customized_target_behavioral_scenario_spice",
] as const satisfies readonly PrimaryPartCustomizedInstalledArtifactKindV1[]);

const PRIMARY_PART_CUSTOMIZED_ARTIFACT_KINDS = Object.freeze([
  ...PRIMARY_PART_CUSTOMIZED_REPLAYABLE_ARTIFACT_KINDS,
  ...PRIMARY_PART_CUSTOMIZED_INSTALLED_ARTIFACT_KINDS,
] as const satisfies readonly PrimaryPartCustomizedArtifactKindV1[]);

const CUSTOMIZED_TARGET_INSPECTION_RECEIPT_MAX_BYTES_V1 = 4 * 1024 * 1024;

export type AuthorizedPrimaryPartCustomizedFileKindV1 =
  | PrimaryPartCustomizedArtifactKindV1
  | "customized_target_inspection_receipt";

export interface AuthorizedPrimaryPartCustomizedFileRequestV1 {
  readonly kind: AuthorizedPrimaryPartCustomizedFileKindV1;
  readonly asserted: Readonly<PrimaryPartCustomizedResultSidecarV1>;
  readonly installedArtifactContext?: Readonly<{
    engineeringContext: Readonly<GenerateElectricalContextV2>;
    executionContext: Readonly<DesignResultExecutionContextV2>;
  }>;
  readonly assertCurrent: () => void;
}

const authorizedPrimaryPartCustomizedFileRequests = new WeakMap<
  object,
  Readonly<AuthorizedPrimaryPartCustomizedFileRequestV1>
>();

function authorizePrimaryPartCustomizedFileRequestV1(
  request: Readonly<AuthorizedPrimaryPartCustomizedFileRequestV1>,
): object {
  const token = Object.freeze(Object.create(null) as object);
  authorizedPrimaryPartCustomizedFileRequests.set(token, Object.freeze(request));
  return token;
}

export function _consumeAuthorizedPrimaryPartCustomizedFileRequestV1(
  token: unknown,
): Readonly<AuthorizedPrimaryPartCustomizedFileRequestV1> {
  if (token === null || typeof token !== "object") {
    throw new Error("Customized-target file export requires an exact application authorization token");
  }
  const request = authorizedPrimaryPartCustomizedFileRequests.get(token);
  if (request === undefined) {
    throw new Error("Customized-target file export requires an exact application authorization token");
  }
  authorizedPrimaryPartCustomizedFileRequests.delete(token);
  request.assertCurrent();
  return request;
}

function isPrimaryPartCustomizedArtifactKindV1(value: unknown): value is PrimaryPartCustomizedArtifactKindV1 {
  return typeof value === "string"
    && (PRIMARY_PART_CUSTOMIZED_ARTIFACT_KINDS as readonly string[]).includes(value);
}

function isPrimaryPartCustomizedReplayableArtifactKindV1(
  value: PrimaryPartCustomizedArtifactKindV1,
): value is PrimaryPartCustomizedReplayableArtifactKindV1 {
  return (PRIMARY_PART_CUSTOMIZED_REPLAYABLE_ARTIFACT_KINDS as readonly string[]).includes(value);
}

function exactInstalledPrimaryPartCustomizationBoundary(
  productionBoundary: Readonly<{ authorizesProductionGeneration(value: unknown): boolean }>,
  runtime: () => Promise<InstalledPrimaryPartCustomizationRuntime>,
): DesignerPrimaryPartCustomizationContractV1 {
  const authorizations = new WeakMap<object, Readonly<{
    source: Readonly<DesignerProductionGenerationV2>;
    sourceFingerprint: string;
    fingerprint: string;
  }>>();
  const exactSource = (source: Readonly<DesignerProductionGenerationV2>) => ({
    result: source.result,
    execution: source.execution,
  });
  return Object.freeze({
    inspectionReceiptMaxBytes: CUSTOMIZED_TARGET_INSPECTION_RECEIPT_MAX_BYTES_V1,
    async listTargets(
      source: Readonly<DesignerProductionGenerationV2>,
      sourceCandidateId: CandidateIdV2,
    ): Promise<readonly DesignerPrimaryPartCustomizationTargetV1[]> {
      if (!productionBoundary.authorizesProductionGeneration(source)) {
        throw new Error("Primary-part customization requires an authorized production generation");
      }
      return (await runtime()).listTargets(exactSource(source), sourceCandidateId);
    },
    async generate(
      source: Readonly<DesignerProductionGenerationV2>,
      instruction: Readonly<PrimaryPartCustomizationSidecarV1>,
    ): Promise<Readonly<PrimaryPartCustomizedResultSidecarV1>> {
      if (!productionBoundary.authorizesProductionGeneration(source)) {
        throw new Error("Primary-part customization requires an authorized production generation");
      }
      const result = (await runtime()).generate(instruction, exactSource(source));
      authorizations.set(result, {
        source,
        sourceFingerprint: productionGenerationFingerprint(source),
        fingerprint: customizedResultFingerprint(result),
      });
      return result;
    },
    authorizesCustomizedResult(
      value: unknown,
      source: Readonly<DesignerProductionGenerationV2>,
    ): boolean {
      if (
        value === null
        || typeof value !== "object"
        || !productionBoundary.authorizesProductionGeneration(source)
      ) return false;
      const authorization = authorizations.get(value);
      if (authorization === undefined || authorization.source !== source) return false;
      try {
        return authorization.sourceFingerprint === productionGenerationFingerprint(source)
          && authorization.fingerprint
            === customizedResultFingerprint(value as PrimaryPartCustomizedResultSidecarV1);
      } catch {
        return false;
      }
    },
    async exportArtifact(
      source: Readonly<DesignerProductionGenerationV2>,
      customizedResult: Readonly<PrimaryPartCustomizedResultSidecarV1>,
      kind: PrimaryPartCustomizedArtifactKindV1,
    ) {
      if (!isPrimaryPartCustomizedArtifactKindV1(kind)) {
        throw new Error(`Unsupported customized-target artifact kind: ${String(kind)}`);
      }
      if (!productionBoundary.authorizesProductionGeneration(source)) {
        throw new Error("Customized-target export requires an authorized production generation");
      }
      const authorization = authorizations.get(customizedResult);
      if (authorization === undefined || authorization.source !== source) {
        throw new Error("Customized-target export requires the exact authorized customized result and source");
      }

      const sourceFingerprintBefore = productionGenerationFingerprint(source);
      const sourceResultBytesBefore = serializeDesignResultV2(source.result);
      const customizedFingerprintBefore = customizedResultFingerprint(customizedResult);
      if (
        authorization.sourceFingerprint !== sourceFingerprintBefore
        || authorization.fingerprint !== customizedFingerprintBefore
      ) {
        throw new Error("Customized-target export authority is stale or mutated");
      }
      const assertExportAuthorizationCurrent = (): void => {
        if (
          !productionBoundary.authorizesProductionGeneration(source)
          || authorization.source !== source
          || authorization.sourceFingerprint !== productionGenerationFingerprint(source)
          || authorization.fingerprint !== customizedResultFingerprint(customizedResult)
        ) {
          throw new Error("Customized-target export authority became stale");
        }
      };

      try {
        const installedRuntime = await runtime();
        assertExportAuthorizationCurrent();
        const asserted = installedRuntime.assert(customizedResult, exactSource(source));
        const assertedFingerprint = customizedResultFingerprint(asserted);
        if (
          assertedFingerprint !== customizedFingerprintBefore
          || assertedFingerprint !== authorization.fingerprint
        ) {
          throw new Error("Installed customized-target assertion did not reproduce the authorized result");
        }
        const installedArtifactContext = isPrimaryPartCustomizedReplayableArtifactKindV1(kind)
          ? undefined
          : installedRuntime.installedArtifactContext();
        const artifactRuntime = await import("./PrimaryPartCustomizedArtifactRuntime");
        assertExportAuthorizationCurrent();
        const authorizationToken = authorizePrimaryPartCustomizedFileRequestV1({
          kind,
          asserted,
          ...(installedArtifactContext === undefined ? {} : { installedArtifactContext }),
          assertCurrent: () => {
            assertExportAuthorizationCurrent();
            if (customizedResultFingerprint(asserted) !== assertedFingerprint) {
              throw new Error("Installed customized-target assertion became stale");
            }
          },
        });
        const artifact = artifactRuntime.exportAuthorizedPrimaryPartCustomizedFileV1(
          authorizationToken,
        );
        if (artifact.kind !== kind) {
          throw new Error("Customized-target file renderer returned a mismatched artifact kind");
        }
        return artifact;
      } finally {
        if (
          serializeDesignResultV2(source.result) !== sourceResultBytesBefore
          || productionGenerationFingerprint(source) !== sourceFingerprintBefore
          || customizedResultFingerprint(customizedResult) !== customizedFingerprintBefore
        ) {
          throw new Error("Customized-target export mutated its authorized source or result");
        }
      }
    },
    async exportInspectionReceipt(
      source: Readonly<DesignerProductionGenerationV2>,
      customizedResult: Readonly<PrimaryPartCustomizedResultSidecarV1>,
    ): Promise<Readonly<DesignerCustomizedTargetInspectionReceiptFileV1>> {
      if (!productionBoundary.authorizesProductionGeneration(source)) {
        throw new Error("Customized-target inspection receipt export requires an authorized production generation");
      }
      const authorization = authorizations.get(customizedResult);
      if (authorization === undefined || authorization.source !== source) {
        throw new Error("Customized-target inspection receipt export requires the exact authorized customized result and source");
      }

      const sourceFingerprintBefore = productionGenerationFingerprint(source);
      const sourceResultBytesBefore = serializeDesignResultV2(source.result);
      const customizedFingerprintBefore = customizedResultFingerprint(customizedResult);
      if (
        authorization.sourceFingerprint !== sourceFingerprintBefore
        || authorization.fingerprint !== customizedFingerprintBefore
      ) {
        throw new Error("Customized-target inspection receipt export authority is stale or mutated");
      }

      try {
        const installedRuntime = await runtime();
        const asserted = installedRuntime.assert(customizedResult, exactSource(source));
        const assertedFingerprint = customizedResultFingerprint(asserted);
        if (
          assertedFingerprint !== customizedFingerprintBefore
          || assertedFingerprint !== authorization.fingerprint
        ) {
          throw new Error("Installed customized-target assertion did not reproduce the authorized result");
        }
        const artifactRuntime = await import("./PrimaryPartCustomizedArtifactRuntime");
        const assertReceiptExportAuthorizationCurrent = (): void => {
          if (
            !productionBoundary.authorizesProductionGeneration(source)
            || authorization.source !== source
            || authorization.sourceFingerprint !== productionGenerationFingerprint(source)
            || authorization.fingerprint !== customizedResultFingerprint(customizedResult)
            || customizedResultFingerprint(asserted) !== assertedFingerprint
          ) {
            throw new Error("Customized-target inspection receipt export authority became stale");
          }
        };
        assertReceiptExportAuthorizationCurrent();
        const authorizationToken = authorizePrimaryPartCustomizedFileRequestV1({
          kind: "customized_target_inspection_receipt",
          asserted,
          assertCurrent: assertReceiptExportAuthorizationCurrent,
        });
        const artifact = artifactRuntime.exportAuthorizedPrimaryPartCustomizedFileV1(
          authorizationToken,
        );
        if (
          artifact.kind !== "customized_target_inspection_receipt"
          || artifact.mimeType !== "application/json;charset=utf-8"
          || new TextEncoder().encode(artifact.content).byteLength
            > CUSTOMIZED_TARGET_INSPECTION_RECEIPT_MAX_BYTES_V1
        ) {
          throw new Error("Customized-target inspection receipt renderer returned a mismatched file");
        }
        if (
          !productionBoundary.authorizesProductionGeneration(source)
          || productionGenerationFingerprint(source) !== sourceFingerprintBefore
          || customizedResultFingerprint(customizedResult) !== customizedFingerprintBefore
        ) {
          throw new Error("Customized-target inspection receipt export authority became stale");
        }
        return artifact;
      } finally {
        if (
          serializeDesignResultV2(source.result) !== sourceResultBytesBefore
          || productionGenerationFingerprint(source) !== sourceFingerprintBefore
          || customizedResultFingerprint(customizedResult) !== customizedFingerprintBefore
        ) {
          throw new Error("Customized-target inspection receipt export mutated its authorized source or result");
        }
      }
    },
    async restoreInspectionReceipt(
      source: Readonly<DesignerProductionGenerationV2>,
      sourceCandidateId: CandidateIdV2,
      receiptBytes: Uint8Array,
    ): Promise<Readonly<PrimaryPartCustomizedResultSidecarV1>> {
      if (!productionBoundary.authorizesProductionGeneration(source)) {
        throw new Error("Customized-target inspection receipt replay requires an authorized production generation");
      }
      if (!source.result.candidates.some((candidate) => candidate.id === sourceCandidateId)) {
        throw new Error("Customized-target inspection receipt replay requires an exact candidate from the authorized generation");
      }
      if (!(receiptBytes instanceof Uint8Array)) {
        throw new Error("Customized-target inspection receipt replay requires exact bytes");
      }
      if (receiptBytes.byteLength > CUSTOMIZED_TARGET_INSPECTION_RECEIPT_MAX_BYTES_V1) {
        throw new Error("Customized-target inspection receipt exceeds the installed byte limit");
      }

      const capturedReceiptBytes = new Uint8Array(receiptBytes);
      const sourceFingerprintBefore = productionGenerationFingerprint(source);
      const sourceResultBytesBefore = serializeDesignResultV2(source.result);
      const artifactRuntime = await import("./PrimaryPartCustomizedArtifactRuntime");
      const receipt = artifactRuntime.verifyCustomizedTargetInspectionReceiptBytesV1(
        capturedReceiptBytes,
      );
      if (receipt.customizedResult.source.candidateId !== sourceCandidateId) {
        throw new Error("Customized-target inspection receipt does not bind to the selected source candidate");
      }
      if (
        !productionBoundary.authorizesProductionGeneration(source)
        || productionGenerationFingerprint(source) !== sourceFingerprintBefore
      ) {
        throw new Error("Customized-target inspection receipt replay source became stale");
      }
      const installedRuntime = await runtime();
      if (
        !productionBoundary.authorizesProductionGeneration(source)
        || productionGenerationFingerprint(source) !== sourceFingerprintBefore
      ) {
        throw new Error("Customized-target inspection receipt replay source became stale");
      }
      const asserted = installedRuntime.assert(receipt.customizedResult, exactSource(source));
      const assertedFingerprint = customizedResultFingerprint(asserted);
      if (assertedFingerprint !== customizedResultFingerprint(receipt.customizedResult)) {
        throw new Error("Installed customized-target assertion did not reproduce the receipt result");
      }
      if (
        customizedResultFingerprint(receipt.customizedResult) !== assertedFingerprint
      ) {
        throw new Error("Customized-target inspection receipt replay did not reproduce its exact result");
      }
      if (
        !productionBoundary.authorizesProductionGeneration(source)
        || serializeDesignResultV2(source.result) !== sourceResultBytesBefore
        || productionGenerationFingerprint(source) !== sourceFingerprintBefore
      ) {
        throw new Error("Customized-target inspection receipt replay mutated or lost its authorized source");
      }

      authorizations.set(asserted, {
        source,
        sourceFingerprint: sourceFingerprintBefore,
        fingerprint: assertedFingerprint,
      });
      return asserted;
    },
  });
}

function quantity<Unit extends SIUnit>(value: number, unit: Unit, displayUnit: string): Quantity<Unit> {
  return { value, unit, displayUnit };
}

function powerRequest(): BuckDesignRequestV2 {
  const request = parseElectricalDesignRequestV2({
    format: "schemagic-design-request",
    schemaVersion: 2,
    application: "power.buck",
    requirements: {
      inputVoltage: {
        minimum: quantity(12, "V", "V"),
        nominal: quantity(12, "V", "V"),
        maximum: quantity(12, "V", "V"),
      },
      outputVoltage: quantity(5, "V", "V"),
      dcOutputVoltageRegulation: {
        minimum: quantity(4.7, "V", "V"),
        maximum: quantity(5.3, "V", "V"),
      },
      maximumOutputCurrent: quantity(0.2, "A", "A"),
      ambientTemperature: quantity(298.15, "K", "°C"),
      switchingFrequency: {
        selection: "automatic",
        minimum: quantity(250_000, "Hz", "kHz"),
        preferred: null,
        maximum: quantity(600_000, "Hz", "kHz"),
      },
      maximumOutputRipple: quantity(0.03, "V", "mV"),
      loadTransientTarget: null,
    },
    objective: "area",
    constraints: {
      allowedTopologyFamilies: ["power.buck.integrated-synchronous"],
      maximumJunctionTemperature: quantity(398.15, "K", "°C"),
      allowedPackages: [],
      maximumComponentHeight: null,
      maximumBoardArea: null,
      allowEstimatedValues: true,
      allowUnknownWarnings: true,
      allowUnknownHardConstraints: false,
    },
    assumptions: [
      {
        id: "power-browser.exact-vfb-condition",
        description: "The input is fixed at the exact 12 V condition of the reviewed TPS54302 feedback-reference production spread, and the request explicitly accepts a 4.7 V to 5.3 V DC regulation envelope.",
        source: "fixture",
        affects: ["requirements.dcOutputVoltageRegulation", "requirements.inputVoltage", "power.feedback.output-voltage"],
      },
      {
        id: "power-browser.unknown-inspection-opt-in",
        description: "Loop stability, passive effective values, current capability, timing, loss, and thermal proofs remain unknown unless explicitly inspected.",
        source: "user",
        affects: ["constraints.allowUnknownHardConstraints", "ranking"],
      },
      {
        id: "power-browser.no-selected-part-model",
        description: "No executable model is bundled for the exact selected regulator or passive stage; selected-part simulation fidelity is unavailable.",
        source: "unavailable",
        affects: ["simulation"],
      },
    ],
    libraryVersion: POWER_DESIGN_V2_PRODUCTION_STATUS.catalogVersion,
  });
  if (request.application !== "power.buck") throw new Error("Expected a Power production request");
  return request;
}

function motorRequest(
  topology: "motor.hbridge.integrated" | "motor.hbridge.external-nmos",
  supplyVoltage: number,
  continuousCurrent: number,
  stallCurrent: number,
): BrushedDcMotorDesignRequestV2 {
  const request = parseElectricalDesignRequestV2({
    format: "schemagic-design-request",
    schemaVersion: 2,
    application: "motor.brushed-dc",
    requirements: {
      supplyVoltage: {
        minimum: quantity(supplyVoltage * 0.75, "V", "V"),
        nominal: quantity(supplyVoltage, "V", "V"),
        maximum: quantity(supplyVoltage * 1.25, "V", "V"),
      },
      motorNominalVoltage: quantity(supplyVoltage, "V", "V"),
      continuousCurrent: quantity(continuousCurrent, "A", "A"),
      stallCurrent: quantity(stallCurrent, "A", "A"),
      pwmFrequency: quantity(20_000, "Hz", "kHz"),
      logicVoltage: quantity(3.3, "V", "V"),
      ambientTemperature: quantity(313.15, "K", "°C"),
      operatingModes: ["brake", "coast", "forward", "reverse"],
      currentLimitTarget: null,
      operatingPoint: {
        dutyCycle: quantity(0.8, "1", "%"),
        loadCurrent: quantity(continuousCurrent, "A", "A"),
        loadCurrentBasis: "continuous_rating",
        loadProfile: "steady_state",
      },
      motorModel: {
        windingResistance: quantity(supplyVoltage / stallCurrent, "ohm", "Ω"),
        windingResistanceSource: "estimated_from_nominal_voltage_and_stall_current",
        windingInductance: null,
        backEmfConstant: null,
        targetSpeed: null,
      },
    },
    objective: topology === "motor.hbridge.integrated" ? "area" : "efficiency",
    constraints: {
      allowedTopologyFamilies: [topology],
      maximumJunctionTemperature: quantity(398.15, "K", "°C"),
      allowedPackages: [],
      maximumComponentHeight: null,
      maximumBoardArea: null,
      allowEstimatedValues: true,
      allowUnknownWarnings: true,
      allowUnknownHardConstraints: false,
    },
    assumptions: [
      {
        id: "motor-browser.dynamic-data-unavailable",
        description: "Motor inductance, back-EMF constant, and target speed are unavailable; no selected-part simulation fidelity is claimed.",
        source: "unavailable",
        affects: ["fast_decay_brake", "startup"],
      },
      {
        id: "motor-browser.unknown-inspection-opt-in",
        description: "Hard constraints with unavailable reviewed evidence remain unknown; evidence-incomplete candidates are excluded unless the user explicitly opts in.",
        source: "user",
        affects: ["constraints.allowUnknownHardConstraints", "ranking"],
      },
      {
        id: "motor-browser.winding-resistance-estimate",
        description: "Winding resistance starts as nominal voltage divided by stall current and remains visibly estimated.",
        source: "derived",
        affects: ["requirements.motorModel.windingResistance", "stall_or_current_limit"],
      },
    ],
    libraryVersion: MOTOR_DESIGN_V2_PRODUCTION_STATUS.catalogVersion,
  });
  if (request.application !== "motor.brushed-dc") throw new Error("Expected a Motor production request");
  return request;
}

async function generateMotorProduction(request: DesignerRequest) {
  if (request.schemaVersion !== 2 || request.application !== "motor.brushed-dc") {
    throw new Error("Motor production generation requires a Motor V2 request");
  }
  if (request.constraints.allowUnknownHardConstraints) {
    const { allowUnknownWarnings: _warnings, allowUnknownHardConstraints: _hard, ...constraints } = request.constraints;
    const observationRequest: BrushedDcMotorDesignRequestV3 = {
      ...request,
      schemaVersion: 3,
      constraintPolicy: "production_strict_v1",
      constraints,
    };
    const { generateMotorConstraintObservationV3 } = await import("@opencircuit/motor-designer/v3");
    const generated = generateMotorConstraintObservationV3(observationRequest);
    return Object.freeze({
      kind: generated.kind,
      application: generated.application,
      contextManifestContentHash: generated.observation.result.libraryContentHash,
      result: generated.observation.result,
      execution: generated.observation.execution,
      constraintDecision: generated.decision,
    });
  }
  const { generateVerifiedMotorDesignV2 } = await import("@opencircuit/motor-designer/v2");
  return generateVerifiedMotorDesignV2(request);
}

async function generatePowerProduction(request: DesignerRequest) {
  if (request.schemaVersion !== 2 || request.application !== "power.buck") {
    throw new Error("Power production generation requires a Power V2 request");
  }
  if (request.constraints.allowUnknownHardConstraints) {
    const { allowUnknownWarnings: _warnings, allowUnknownHardConstraints: _hard, ...constraints } = request.constraints;
    const observationRequest: BuckDesignRequestV3 = {
      ...request,
      schemaVersion: 3,
      constraintPolicy: "production_strict_v1",
      constraints,
    };
    const [{ generateBuckConstraintObservationV3 }, { assessPowerTps54302Evm716ReferenceEvidenceV1 }] = await Promise.all([
      import("@opencircuit/power-designer/v3"),
      import("@opencircuit/power-designer/reference-evidence"),
    ]);
    const generated = generateBuckConstraintObservationV3(observationRequest);
    return Object.freeze({
      kind: generated.kind,
      application: generated.application,
      contextManifestContentHash: generated.observation.result.libraryContentHash,
      result: generated.observation.result,
      execution: generated.observation.execution,
      constraintDecision: generated.decision,
      referenceDesignEvidence: assessPowerTps54302Evm716ReferenceEvidenceV1(request),
    });
  }
  const [{ generateVerifiedBuckDesignV2 }, { assessPowerTps54302Evm716ReferenceEvidenceV1 }] = await Promise.all([
    import("@opencircuit/power-designer/v2"),
    import("@opencircuit/power-designer/reference-evidence"),
  ]);
  const generated = await generateVerifiedBuckDesignV2(request);
  return Object.freeze({
    ...generated,
    referenceDesignEvidence: assessPowerTps54302Evm716ReferenceEvidenceV1(request),
  });
}

export function motorDesignerAdapter(): DesignerApplicationAdapter {
  const productionGenerationBoundary = exactInstalledProductionGenerationBoundary(generateMotorProduction);
  const sourcingRequestPacket = exactInstalledSourcingRequestPacketBoundary(productionGenerationBoundary);
  const primaryPartCustomization = exactInstalledPrimaryPartCustomizationBoundary(
    productionGenerationBoundary,
    async () => {
      const [runtime, installed] = await Promise.all([
        import("@opencircuit/motor-designer/v3"),
        import("@opencircuit/motor-designer/v2"),
      ]);
      return {
        listTargets: runtime.listMotorPrimaryPartCustomizationTargetsV1,
        generate: runtime.generateMotorPrimaryPartCustomizedResultV1,
        assert: runtime.assertMotorPrimaryPartCustomizedResultV1,
        installedArtifactContext: () => Object.freeze({
          engineeringContext: installed.getMotorDesignContextV2(),
          executionContext: Object.freeze({}),
        }),
      };
    },
  );
  return {
    application: "motor.brushed-dc",
    name: "scheMAGIC Motor Designer",
    shortName: "Brushed-DC motor driver",
    description: "Generate deterministic integrated and external-NMOS structural observations, with unresolved safety evidence kept visible.",
    status: "ready",
    statusMessage: "The production generation context is installed. Integrated strict generation retains zero candidates until unresolved hard constraints are explicitly inspected; that opt-in exposes one ineligible STSPIN840 structural observation. The installed successor adds a source-bound DRV8876 coast/reverse/forward/brake mode map when PMODE is sampled high at device power-up, but does not make any candidate eligible or prove physical switching behavior. External strict generation enumerates exact MIC4606-2 direct-gate structures with separate bootstrap and VDD-local capacitor roles but retains zero because required safety and requirement evidence remains unknown; explicit inspection Pareto-retains two deterministic structural observations and the installed V3 policy marks both ineligible. Microchip Rev H binds the direct xHO/xLO structure, xLO resistor caution, and nominal capacitor-role floors to exactly three reviewed 10 µF MLCC profiles; the 100 nF C1608 is excluded from both capacitor roles and no series-gate resistor appears in the BOM. For the driver's switch-node-only interface, three xHS rules pass only the nominal 0 V-to-requested-bus excursion; recirculation undershoot, wiring overshoot, parasitics, and TVS coordination remain unproved. The structural candidate implements no VDD driver-bias rail, so an actual source inside the reviewed VDD range remains a required unknown; effective capacitance, bootstrap charge and refresh, local bias support, bulk adequacy, placement, motor.external.gate-network, and switching also remain unknown. The three reviewed 100 kΩ profiles remain pulldown-only. Simulation fidelity and commercial sourcing remain gated.",
    productionStatus: {
      reason: MOTOR_DESIGN_V2_PRODUCTION_STATUS.reason,
      reviewedProfileCount: MOTOR_DESIGN_V2_PRODUCTION_STATUS.reviewedProfileCount,
      installedRecipeSet: MOTOR_DESIGN_V2_PRODUCTION_STATUS.installedRecipeSet,
      constraintPolicy: {
        id: MOTOR_CONSTRAINT_POLICY_V3_PRODUCTION_STATUS.constraintPolicy,
        contentHash: MOTOR_CONSTRAINT_POLICY_V3_PRODUCTION_STATUS.contentHash,
        productionEngineeringGapRuleCount: MOTOR_CONSTRAINT_POLICY_V3_PRODUCTION_STATUS.productionEngineeringGapRuleCount,
      },
    },
    presets: [
      {
        id: "motor.integrated-12v",
        name: "12 V compact integrated bridge",
        description: "A compact 12 V, 1.5 A run / 3 A stall brushed-DC operating point.",
        createRequest: () => motorRequest("motor.hbridge.integrated", 12, 1.5, 3),
      },
      {
        id: "motor.external-24v",
        name: "24 V external-NMOS bridge",
        description: "A 24 V, 5 A external-NMOS request that fails closed on unresolved evidence; explicit inspection exposes source-bound direct-gate structures with separate bootstrap and VDD-local 10 µF roles and no series-gate BOM line.",
        createRequest: () => motorRequest("motor.hbridge.external-nmos", 24, 5, 20),
      },
    ],
    parameterForm: createSchemaParameterFormContract(),
    generate: productionGenerationBoundary.generate,
    authorizesProductionGeneration: productionGenerationBoundary.authorizesProductionGeneration,
    primaryPartCustomization,
    sourcingRequestPacket,
    productionArtifactKinds: MOTOR_PRODUCTION_ARTIFACT_KINDS,
    exportProductionArtifact: async ({ result, candidateId, kind, scenarioId, constraintDecision }) => {
      if (result.request.application !== "motor.brushed-dc") {
        throw new Error("Motor production export requires a Motor V2 result");
      }
      assertAdvertisedProductionArtifactKind("Motor", MOTOR_PRODUCTION_ARTIFACT_KINDS, kind);
      const [{ getMotorDesignContextV2 }, { exportProductionDesignArtifactV2 }] = await Promise.all([
        import("@opencircuit/motor-designer/v2"),
        import("@opencircuit/design-export/production-artifact-v2"),
      ]);
      const engineeringContext = getMotorDesignContextV2();
      const exactDecision = constraintDecision === undefined
        ? undefined
        : (await import("@opencircuit/motor-designer/v3"))
            .assertMotorProductionConstraintObservationDecisionV3(constraintDecision, result);
      return exportProductionDesignArtifactV2(result, candidateId, kind, {
        engineeringContext,
        executionContext: Object.freeze({}),
        ...(scenarioId === undefined ? {} : { scenarioId }),
        ...(exactDecision === undefined ? {} : { constraintDecision: exactDecision }),
      });
    },
  };
}

export function powerDesignerAdapter(): DesignerApplicationAdapter {
  const productionGenerationBoundary = exactInstalledProductionGenerationBoundary(generatePowerProduction);
  const sourcingRequestPacket = exactInstalledSourcingRequestPacketBoundary(productionGenerationBoundary);
  const primaryPartCustomization = exactInstalledPrimaryPartCustomizationBoundary(
    productionGenerationBoundary,
    async () => {
      const [runtime, installed] = await Promise.all([
        import("@opencircuit/power-designer/v3"),
        import("@opencircuit/power-designer/v2"),
      ]);
      return {
        listTargets: runtime.listPowerPrimaryPartCustomizationTargetsV1,
        generate: runtime.generatePowerPrimaryPartCustomizedResultV1,
        assert: runtime.assertPowerPrimaryPartCustomizedResultV1,
        installedArtifactContext: () => Object.freeze({
          engineeringContext: installed.getPowerDesignContextV2(),
          executionContext: Object.freeze({}),
        }),
      };
    },
  );
  return {
    application: "power.buck",
    name: "scheMAGIC Power Designer",
    shortName: "Buck converter",
    description: "Generate deterministic integrated synchronous-buck observations from an exact reviewed BOM, with every unsupported proof kept visible.",
    status: "ready",
    statusMessage: "The production generation context is installed. Strict generation excludes one exact-BOM option because unresolved hard constraints are disallowed. Explicit unknown-evidence inspection retains it as one policy-ineligible structural observation using the reviewed Bel Fuse F1F2-0804-100M 10 µH inductor and two exact Murata GRM32ER71E226KE15L 22 µF output capacitors, with zero rejections. Its reviewed VFB/resistor corners fit the explicit 4.7 V to 5.3 V DC regulation envelope, the divider-resistor evidence satisfies its bounded 25 °C power/voltage rule, and the absent load-transient target emits no rule; 13 other constraints remain unknown. Nominal passive values and a reference-aligned BOM do not prove effective capacitance, selected-part simulation, eligibility, provider, or sourcing authority.",
    productionStatus: {
      reason: POWER_DESIGN_V2_PRODUCTION_STATUS.reason,
      reviewedProfileCount: POWER_DESIGN_V2_PRODUCTION_STATUS.reviewedProfileCount,
      installedRecipeSet: POWER_DESIGN_V2_PRODUCTION_STATUS.installedRecipeSet,
      constraintPolicy: {
        id: POWER_CONSTRAINT_POLICY_V3_PRODUCTION_STATUS.constraintPolicy,
        contentHash: POWER_CONSTRAINT_POLICY_V3_PRODUCTION_STATUS.contentHash,
        productionEngineeringGapRuleCount: POWER_CONSTRAINT_POLICY_V3_PRODUCTION_STATUS.productionEngineeringGapRuleCount,
      },
    },
    presets: [{
      id: "power.integrated-12v-low-current",
      name: "12 V to 5 V evidence inspection",
      description: "A 12 V, 200 mA integrated buck point using the exact reviewed TPS54302DDCR, Bel Fuse F1F2-0804-100M 10 µH inductor, and two Murata GRM32ER71E226KE15L 22 µF output capacitors.",
      createRequest: powerRequest,
    }],
    parameterForm: createSchemaParameterFormContract(),
    generate: productionGenerationBoundary.generate,
    authorizesProductionGeneration: productionGenerationBoundary.authorizesProductionGeneration,
    primaryPartCustomization,
    sourcingRequestPacket,
    productionArtifactKinds: POWER_PRODUCTION_ARTIFACT_KINDS,
    exportProductionArtifact: async ({ result, candidateId, kind, scenarioId, constraintDecision }) => {
      if (result.request.application !== "power.buck") {
        throw new Error("Power production export requires a Power V2 result");
      }
      assertAdvertisedProductionArtifactKind("Power", POWER_PRODUCTION_ARTIFACT_KINDS, kind);
      const [{ getPowerDesignContextV2 }, exportRuntime] = await Promise.all([
        import("@opencircuit/power-designer/v2"),
        import("@opencircuit/design-export/production-artifact-v2"),
      ]);
      const engineeringContext = getPowerDesignContextV2();
      const exactDecision = constraintDecision === undefined
        ? undefined
        : (await import("@opencircuit/power-designer/v3"))
            .assertPowerProductionConstraintObservationDecisionV3(constraintDecision, result);
      if (kind === "physical_handoff_json") {
        return exportRuntime.exportProductionPowerPhysicalHandoffArtifactV2(
          result,
          candidateId,
          engineeringContext,
        );
      }
      return exportRuntime.exportProductionDesignArtifactV2(result, candidateId, kind, {
        engineeringContext,
        executionContext: Object.freeze({}),
        ...(scenarioId === undefined ? {} : { scenarioId }),
        ...(exactDecision === undefined ? {} : { constraintDecision: exactDecision }),
      });
    },
  };
}

export function designerApplications(): readonly DesignerApplicationAdapter[] {
  return [motorDesignerAdapter(), powerDesignerAdapter()];
}
