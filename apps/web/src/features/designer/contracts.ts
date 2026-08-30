import {
  DesignParseErrorV2,
  parseElectricalDesignRequestV2,
  validateDesignRequest,
  type DesignApplication,
  type CandidateIdV2,
  type ConstraintDecisionV3,
  type DesignRequest,
  type DesignResult,
  type DesignResultV2,
  type ElectricalDesignRequestV2,
  type PrimaryPartCustomizationSidecarV1,
  type PrimaryPartCustomizedResultSidecarV1,
  type Quantity,
  type SIUnit,
} from "@opencircuit/design-schema";
import type {
  OfferSnapshot,
  SourcingRequestPacketV1,
  SourcingRequestPolicyV1,
} from "@opencircuit/sourcing-schema";
import type { DesignExecutionReportV2 } from "@opencircuit/design-engine/v2-motor-runtime";
import type {
  ProductionDesignArtifactKindV2,
  ProductionDesignArtifactV2,
} from "@opencircuit/design-export/production-artifact-v2";
import type {
  PrimaryPartCustomizedArtifactKindV1,
  PrimaryPartCustomizedArtifactV1,
} from "@opencircuit/design-export/primary-part-customized-artifact-v1";
import type { PowerTps54302Evm716ReferenceEvidenceDtoV1 } from "@opencircuit/power-designer/reference-evidence";
import { unitConversion } from "./units";

export interface DesignerPreset {
  id: string;
  name: string;
  description: string;
  createRequest(): DesignerRequest;
}

export interface DesignerSelectOption {
  value: string;
  label: string;
}

export interface DesignerUnitOption extends DesignerSelectOption {
  fromCanonical(value: number): number;
  toCanonical(value: number): number;
}

interface DesignerParameterFieldBase {
  id: string;
  label: string;
  description?: string;
  section: "advanced" | "basic";
}

export interface DesignerNumberField extends DesignerParameterFieldBase {
  control: "number";
  minimum?: number;
  maximum?: number;
  step?: number | "any";
  unitOptions: readonly DesignerUnitOption[];
  read(request: Readonly<DesignerRequest>): { value: number; unit: string };
  write(request: Readonly<DesignerRequest>, value: number, unit: string): DesignerRequest;
}

export interface DesignerSelectField extends DesignerParameterFieldBase {
  control: "select";
  options: readonly DesignerSelectOption[];
  read(request: Readonly<DesignerRequest>): string;
  write(request: Readonly<DesignerRequest>, value: string): DesignerRequest;
}

export interface DesignerCheckboxField extends DesignerParameterFieldBase {
  control: "checkbox";
  read(request: Readonly<DesignerRequest>): boolean;
  write(request: Readonly<DesignerRequest>, value: boolean): DesignerRequest;
}

export type DesignerParameterField = DesignerNumberField | DesignerSelectField | DesignerCheckboxField;

export type DesignerRequest = DesignRequest | ElectricalDesignRequestV2;
export type DesignerResult = DesignResult | DesignResultV2;
interface DesignerProductionGenerationBaseV2 {
  readonly application: DesignApplication;
  readonly contextManifestContentHash: string;
  readonly result: Readonly<DesignResultV2>;
  readonly execution: Readonly<DesignExecutionReportV2>;
  /** Transient, display-only evidence kept outside the canonical result and policy decision. */
  readonly referenceDesignEvidence?: PowerTps54302Evm716ReferenceEvidenceDtoV1;
}

export interface DesignerProductionContextGenerationV2 extends DesignerProductionGenerationBaseV2 {
  readonly kind: "production_context_verified";
}

export interface DesignerProductionConstraintObservationV3 extends DesignerProductionGenerationBaseV2 {
  readonly kind: "production_constraint_observation";
  readonly constraintDecision: Readonly<ConstraintDecisionV3>;
}

export type DesignerProductionGenerationV2 =
  | DesignerProductionContextGenerationV2
  | DesignerProductionConstraintObservationV3;
export type DesignerGeneration = DesignerResult | DesignerProductionGenerationV2;

export interface DesignerPrimaryPartCustomizationTargetV1 {
  readonly instruction: Readonly<PrimaryPartCustomizationSidecarV1>;
  readonly targetProfile: Readonly<{
    readonly profileId: string;
    readonly contentHash: string;
    readonly manufacturerId: string;
    readonly manufacturerPartNumber: string;
  }>;
}

export interface DesignerCustomizedTargetInspectionReceiptFileV1 {
  readonly kind: "customized_target_inspection_receipt";
  readonly filename: string;
  readonly mimeType: "application/json;charset=utf-8";
  readonly content: string;
}

export type DesignerPrimaryPartCustomizedArtifactKindV1 = Extract<
  PrimaryPartCustomizedArtifactKindV1,
  | "customized_target_electrical_bom_csv"
  | "customized_target_structural_svg"
  | "customized_target_engineering_report_html"
  | "customized_target_structural_kicad"
  | "customized_target_behavioral_scenario_spice"
>;

export interface DesignerPrimaryPartCustomizationContractV1 {
  readonly inspectionReceiptMaxBytes: number;
  listTargets(
    source: Readonly<DesignerProductionGenerationV2>,
    sourceCandidateId: CandidateIdV2,
  ): Promise<readonly DesignerPrimaryPartCustomizationTargetV1[]>;
  generate(
    source: Readonly<DesignerProductionGenerationV2>,
    instruction: Readonly<PrimaryPartCustomizationSidecarV1>,
  ): Promise<Readonly<PrimaryPartCustomizedResultSidecarV1>>;
  authorizesCustomizedResult(
    value: unknown,
    source: Readonly<DesignerProductionGenerationV2>,
  ): boolean;
  exportArtifact(
    source: Readonly<DesignerProductionGenerationV2>,
    customizedResult: Readonly<PrimaryPartCustomizedResultSidecarV1>,
    kind: DesignerPrimaryPartCustomizedArtifactKindV1,
  ): Promise<PrimaryPartCustomizedArtifactV1>;
  exportInspectionReceipt(
    source: Readonly<DesignerProductionGenerationV2>,
    customizedResult: Readonly<PrimaryPartCustomizedResultSidecarV1>,
  ): Promise<Readonly<DesignerCustomizedTargetInspectionReceiptFileV1>>;
  restoreInspectionReceipt(
    source: Readonly<DesignerProductionGenerationV2>,
    sourceCandidateId: CandidateIdV2,
    receiptBytes: Uint8Array,
  ): Promise<Readonly<PrimaryPartCustomizedResultSidecarV1>>;
}

export interface DesignerSourcingRequestPacketArtifactV1 {
  readonly kind: "provider_neutral_sourcing_request_packet";
  readonly filename: string;
  readonly mimeType: "application/json;charset=utf-8";
  readonly content: string;
  readonly packet: Readonly<SourcingRequestPacketV1>;
}

export interface DesignerSourcingRequestPacketContractV1 {
  exportPacket(
    source: Readonly<DesignerProductionGenerationV2>,
    candidateId: CandidateIdV2,
    buildQuantity: number,
    policy: Readonly<SourcingRequestPolicyV1>,
  ): Promise<Readonly<DesignerSourcingRequestPacketArtifactV1>>;
}

export interface DesignerValidationIssue {
  path: string;
  message: string;
}

export interface DesignerParameterFormContract {
  fields(request: Readonly<DesignerRequest>): readonly DesignerParameterField[];
  validate(request: Readonly<DesignerRequest>): readonly DesignerValidationIssue[];
}

export interface DesignerApplicationAdapter {
  application: DesignApplication;
  name: string;
  shortName: string;
  description: string;
  status: "ready" | "blocked" | "unavailable";
  statusMessage?: string;
  productionStatus?: {
    reason: string | null;
    reviewedProfileCount: number;
    installedRecipeSet: boolean;
    constraintPolicy?: {
      id: "production_strict_v1";
      contentHash: string;
      productionEngineeringGapRuleCount: number;
    };
  };
  presets: readonly DesignerPreset[];
  parameterForm: DesignerParameterFormContract;
  generate(request: DesignerRequest): DesignerGeneration | Promise<DesignerGeneration>;
  authorizesProductionGeneration?(value: unknown): boolean;
  primaryPartCustomization?: DesignerPrimaryPartCustomizationContractV1;
  sourcingRequestPacket?: DesignerSourcingRequestPacketContractV1;
  /** Exact browser artifacts this adapter is prepared to generate and verify. */
  productionArtifactKinds?: readonly ProductionDesignArtifactKindV2[];
  exportProductionArtifact?(input: Readonly<{
    result: Readonly<DesignResultV2>;
    candidateId: CandidateIdV2;
    kind: ProductionDesignArtifactKindV2;
    scenarioId?: string;
    constraintDecision?: Readonly<ConstraintDecisionV3>;
  }>): ProductionDesignArtifactV2 | Promise<ProductionDesignArtifactV2>;
}

export interface DesignerRouteOptions {
  applications: readonly DesignerApplicationAdapter[];
  offerSnapshots?: readonly OfferSnapshot[];
  simulatorPath?: string;
}

const OBJECTIVE_OPTIONS: readonly DesignerSelectOption[] = [
  { value: "balanced", label: "Balanced" },
  { value: "efficiency", label: "Efficiency" },
  { value: "bom_cost", label: "BOM cost" },
  { value: "area", label: "Board area" },
  { value: "temperature", label: "Temperature" },
  { value: "availability", label: "Availability" },
  { value: "lead_time", label: "Lead time" },
];

const UNIT_LABELS: Partial<Record<SIUnit, readonly string[]>> = {
  A: ["mA", "A"],
  F: ["pF", "nF", "µF", "mF", "F"],
  H: ["µH", "mH", "H"],
  Hz: ["Hz", "kHz", "MHz"],
  K: ["°C", "K"],
  V: ["mV", "V"],
  W: ["mW", "W"],
  m: ["mm", "m"],
  m2: ["mm²", "m²"],
  ohm: ["mΩ", "Ω", "kΩ"],
  s: ["µs", "ms", "s"],
};

function unitOptions(quantity: Quantity): DesignerUnitOption[] {
  const labels = UNIT_LABELS[quantity.unit] ?? [quantity.displayUnit || quantity.unit];
  const ordered = [...new Set([quantity.displayUnit, ...labels])].filter(Boolean);
  return ordered.map((label) => {
    const conversion = unitConversion(quantity.unit, label);
    return {
      value: label,
      label,
      ...conversion,
    };
  });
}

function isQuantity(value: unknown): value is Quantity {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.value === "number" && typeof record.unit === "string" && typeof record.displayUnit === "string";
}

function getAtPath(root: unknown, path: readonly string[]): unknown {
  let current = root;
  for (const key of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function setAtPath(root: DesignerRequest, path: readonly string[], value: unknown): DesignerRequest {
  const clone = structuredClone(root) as unknown as Record<string, unknown>;
  let current = clone;
  path.slice(0, -1).forEach((key) => {
    const next = current[key];
    if (!next || typeof next !== "object" || Array.isArray(next)) throw new Error(`Cannot update ${path.join(".")}`);
    current = next as Record<string, unknown>;
  });
  const finalKey = path.at(-1);
  if (!finalKey) throw new Error("Parameter path is empty");
  current[finalKey] = value;
  return clone as unknown as DesignerRequest;
}

function words(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/^./, (character) => character.toUpperCase());
}

function quantityFields(root: unknown, basePath: readonly string[], section: "advanced" | "basic"): DesignerNumberField[] {
  const fields: DesignerNumberField[] = [];
  function visit(value: unknown, path: string[]): void {
    if (isQuantity(value)) {
      const initialOptions = unitOptions(value);
      const labelParts = path.slice(basePath.length);
      const label = labelParts.length > 1
        ? `${words(labelParts.at(-2)!)} · ${words(labelParts.at(-1)!)}`
        : words(labelParts.at(-1) ?? path.at(-1) ?? "Value");
      fields.push({
        id: path.join("."),
        label,
        section,
        control: "number",
        step: "any",
        unitOptions: initialOptions,
        read(request) {
          const current = getAtPath(request, path);
          if (!isQuantity(current)) throw new Error(`Missing quantity ${path.join(".")}`);
          const option = unitOptions(current).find((entry) => entry.value === current.displayUnit) ?? unitOptions(current)[0]!;
          return { value: option.fromCanonical(current.value), unit: option.value };
        },
        write(request, displayValue, displayUnit) {
          const current = getAtPath(request, path);
          if (!isQuantity(current)) throw new Error(`Missing quantity ${path.join(".")}`);
          const option = unitOptions(current).find((entry) => entry.value === displayUnit);
          if (!option) throw new Error(`Unsupported display unit ${displayUnit}`);
          return setAtPath(request, path, { ...current, value: option.toCanonical(displayValue), displayUnit });
        },
      });
      return;
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    for (const key of Object.keys(value as Record<string, unknown>).sort((a, b) => a.localeCompare(b))) {
      visit((value as Record<string, unknown>)[key], [...path, key]);
    }
  }
  visit(root, [...basePath]);
  return fields;
}

function constraintCheckbox(
  id: string,
  label: string,
  section: "advanced" | "basic" = "advanced",
  description?: string,
): DesignerCheckboxField {
  const path = ["constraints", id];
  return {
    id: path.join("."),
    label,
    section,
    control: "checkbox",
    ...(description === undefined ? {} : { description }),
    read(request) {
      return getAtPath(request, path) === true;
    },
    write(request, value) {
      return setAtPath(request, path, value);
    },
  };
}

/**
 * Generic frozen-schema form contract. Application adapters may replace or
 * extend it without changing the shared renderer.
 */
export function createSchemaParameterFormContract(): DesignerParameterFormContract {
  return {
    fields(request) {
      const objectiveOptions = request.schemaVersion === 2
        ? OBJECTIVE_OPTIONS.filter((option) => ["area", "balanced", "efficiency", "temperature"].includes(option.value))
        : OBJECTIVE_OPTIONS;
      const objective: DesignerSelectField = {
        id: "objective",
        label: "Optimization objective",
        section: "basic",
        control: "select",
        options: objectiveOptions,
        read: (current) => current.objective,
        write: (current, value) => ({ ...structuredClone(current), objective: value } as DesignerRequest),
      };
      return [
        objective,
        ...quantityFields(request.requirements, ["requirements"], "basic"),
        ...quantityFields(request.constraints, ["constraints"], "advanced"),
        constraintCheckbox(
          "allowEstimatedValues",
          "Allow estimated candidate outputs",
          "advanced",
          "Controls derived candidate values and metrics. Request-declared estimates remain visibly identified and are not hidden by this switch.",
        ),
        constraintCheckbox(
          "allowUnknownWarnings",
          "Allow warning checks with unknown evidence",
          "advanced",
          "Used by the strict evidence gate. Reference design inspection includes warning observations by design.",
        ),
        constraintCheckbox(
          "allowUnknownHardConstraints",
          "Inspect candidates with unresolved hard constraints",
          "basic",
          "Opt-in. Shows permissive V2 structural observations under the installed V3 policy; unknown is not pass and no observation becomes eligible without required evidence.",
        ),
      ];
    },
    validate(request) {
      if (request.schemaVersion === 1) return validateDesignRequest(request);
      try {
        parseElectricalDesignRequestV2(request);
        return [];
      } catch (error) {
        if (!(error instanceof DesignParseErrorV2)) return [{ path: "", message: "Invalid production V2 request." }];
        return error.issues.map((issue) => ({
          path: issue.path
            .split("/")
            .slice(1)
            .map((token) => token.replaceAll("~1", "/").replaceAll("~0", "~"))
            .join("."),
          message: issue.message,
        }));
      }
    },
  };
}

export function unavailableApplication(
  application: DesignApplication,
  name: string,
  shortName: string,
  description: string,
  statusMessage: string,
): DesignerApplicationAdapter {
  return {
    application,
    name,
    shortName,
    description,
    status: "unavailable",
    statusMessage,
    presets: [],
    parameterForm: createSchemaParameterFormContract(),
    generate: () => {
      throw new Error(statusMessage);
    },
  };
}
