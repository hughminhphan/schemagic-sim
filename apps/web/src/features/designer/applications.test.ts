import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  calculateConstraintDecisionV3ContentHash,
  canonicalElectricalDesignRequestV2Payload,
  canonicalDesignResultV2ContentHash,
  createPrimaryPartCustomizationSidecarV1,
  designSha256ContentHash,
  serializeDesignResultV2,
} from "@opencircuit/design-schema";
import { MOTOR_DESIGN_V2_PRODUCTION_STATUS } from "@opencircuit/motor-designer/v2-status";
import { MOTOR_CONSTRAINT_POLICY_V3_PRODUCTION_STATUS } from "@opencircuit/motor-designer/v3-status";
import { POWER_DESIGN_V2_PRODUCTION_STATUS } from "@opencircuit/power-designer/v2-status";
import { POWER_CONSTRAINT_POLICY_V3_PRODUCTION_STATUS } from "@opencircuit/power-designer/v3-status";
import {
  parseSourcingRequestPacketV1,
  verifySourcingRequestPacketV1,
  type SourcingRequestPacketInputV1,
  type SourcingRequestPolicyV1,
} from "@opencircuit/sourcing-schema/request-packet-v1";
import {
  applicationChooser,
  isAuthorizedStrictPowerInspectionSource,
  verifiedProductionGeneration,
} from "./DesignerRoute";
import { designerApplications } from "./applications";
import { lcscExactMpnSearchUrl, renderImportedResult } from "./ImportedResultView";
import { renderPrimaryPartCustomization } from "./PrimaryPartCustomizationView";
import { renderPowerReferenceEvidence } from "./PowerReferenceEvidenceView";
import { serializeImportedDesignResult } from "./ResultImport";

describe("production Designer application readiness", () => {
  it("encodes an exact MPN as the sole LCSC search query", () => {
    expect(lcscExactMpnSearchUrl("AC/DC?rev=2&#<\"'"))
      .toBe("https://www.lcsc.com/search?q=AC%2FDC%3Frev%3D2%26%23%3C%22'");
  });

  it("opens reviewed Motor and Power production generation", () => {
    const applications = designerApplications();
    const html = applicationChooser(applications);

    expect(applications.map((application) => application.application)).toEqual(["motor.brushed-dc", "power.buck"]);
    expect(applications.map((application) => application.status)).toEqual(["ready", "ready"]);
    expect(applications.map((application) => application.presets.length)).toEqual([2, 1]);
    expect(applications.every((application) => application.exportProductionArtifact !== undefined)).toBe(true);
    expect(applications.map((application) => application.productionArtifactKinds)).toEqual([
      [
        "electrical_bom_csv",
        "scenario_spice",
        "structural_svg",
        "engineering_report_html",
        "structural_kicad",
      ],
      [
        "electrical_bom_csv",
        "scenario_spice",
        "structural_svg",
        "engineering_report_html",
        "structural_kicad",
        "physical_handoff_json",
      ],
    ]);
    expect(html).toContain("2 starting points");
    expect(html).toContain("1 starting point");
    expect(html).not.toContain("Await reviewed release");
    expect(html.match(/Set requirements →/g)).toHaveLength(2);
    expect(html).not.toContain("Generate candidates");
  });

  it("shows the exact code-owned readiness status without inventing a capability", () => {
    const applications = designerApplications();
    const html = applicationChooser(applications);

    expect(applications.map((application) => application.productionStatus)).toEqual([
      {
        reason: MOTOR_DESIGN_V2_PRODUCTION_STATUS.reason,
        reviewedProfileCount: MOTOR_DESIGN_V2_PRODUCTION_STATUS.reviewedProfileCount,
        installedRecipeSet: MOTOR_DESIGN_V2_PRODUCTION_STATUS.installedRecipeSet,
        constraintPolicy: {
          id: MOTOR_CONSTRAINT_POLICY_V3_PRODUCTION_STATUS.constraintPolicy,
          contentHash: MOTOR_CONSTRAINT_POLICY_V3_PRODUCTION_STATUS.contentHash,
          productionEngineeringGapRuleCount: 0,
        },
      },
      {
        reason: POWER_DESIGN_V2_PRODUCTION_STATUS.reason,
        reviewedProfileCount: POWER_DESIGN_V2_PRODUCTION_STATUS.reviewedProfileCount,
        installedRecipeSet: POWER_DESIGN_V2_PRODUCTION_STATUS.installedRecipeSet,
        constraintPolicy: {
          id: POWER_CONSTRAINT_POLICY_V3_PRODUCTION_STATUS.constraintPolicy,
          contentHash: POWER_CONSTRAINT_POLICY_V3_PRODUCTION_STATUS.contentHash,
          productionEngineeringGapRuleCount: 0,
        },
      },
    ]);
    expect(html.match(/<dt>Reviewed profiles<\/dt><dd>19<\/dd>/g)).toHaveLength(1);
    expect(html.match(/<dt>Reviewed profiles<\/dt><dd>15<\/dd>/g)).toHaveLength(1);
    expect(html.match(/<dt>Native recipe set<\/dt><dd>installed<\/dd>/g)).toHaveLength(2);
    expect(html.match(/<dt>V3 production policy<\/dt><dd>installed · 0 engineering-gap rules<\/dd>/g)).toHaveLength(2);
    expect(html).toContain(MOTOR_CONSTRAINT_POLICY_V3_PRODUCTION_STATUS.contentHash);
    expect(html).toContain(POWER_CONSTRAINT_POLICY_V3_PRODUCTION_STATUS.contentHash);
    expect(MOTOR_DESIGN_V2_PRODUCTION_STATUS.reason).toBeNull();
    expect(POWER_DESIGN_V2_PRODUCTION_STATUS.reason).toBeNull();
    expect(POWER_DESIGN_V2_PRODUCTION_STATUS.catalogVersion).toBe("2026-08-27.2");
    expect(html.match(/generation_context_contract_satisfied/g)).toHaveLength(2);
    expect(html).toContain("Integrated strict generation retains zero candidates");
    expect(html).toContain("source-bound DRV8876 coast/reverse/forward/brake mode map when PMODE is sampled high at device power-up");
    expect(html).toContain("does not make any candidate eligible or prove physical switching behavior");
    expect(html).toContain("External strict generation enumerates exact MIC4606-2 direct-gate structures with separate bootstrap and VDD-local capacitor roles but retains zero");
    expect(html).toContain("explicit inspection Pareto-retains two deterministic structural observations");
    expect(html).toContain("nominal capacitor-role floors to exactly three reviewed 10 µF MLCC profiles");
    expect(html).toContain("the 100 nF C1608 is excluded from both capacitor roles");
    expect(html).toContain("three xHS rules pass only the nominal 0 V-to-requested-bus excursion");
    expect(html).toContain("recirculation undershoot, wiring overshoot, parasitics, and TVS coordination remain unproved");
    expect(html).toContain("implements no VDD driver-bias rail");
    expect(html).toContain("actual source inside the reviewed VDD range remains a required unknown");
    expect(html).toContain("effective capacitance, bootstrap charge and refresh, local bias support, bulk adequacy, placement");
    expect(html).toContain("no series-gate resistor appears in the BOM");
    expect(html).toContain("motor.external.gate-network, and switching also remain unknown");
    expect(html).toContain("three reviewed 100 kΩ profiles remain pulldown-only");
    expect(html).toContain("Strict generation excludes one exact-BOM option");
    expect(html).toContain("retains it as one policy-ineligible structural observation");
    expect(html).toContain("F1F2-0804-100M 10 µH");
    expect(html).toContain("two exact Murata GRM32ER71E226KE15L 22 µF output capacitors");
    expect(html).toContain("zero rejections");
    expect(html).toContain("reviewed VFB/resistor corners fit the explicit 4.7 V to 5.3 V DC regulation envelope");
    expect(html).toContain("divider-resistor evidence satisfies its bounded 25 °C power/voltage rule");
    expect(html).toContain("absent load-transient target emits no rule");
    expect(html).toContain("13 other constraints remain unknown");
    expect(html).toContain("Nominal passive values and a reference-aligned BOM do not prove effective capacitance, selected-part simulation, eligibility, provider, or sourcing authority");
    expect(html).not.toContain("inspection cannot override that hard failure");
    expect(html).not.toContain("required external-NMOS production recipe contract");
    expect(html).toContain("V1 remains legacy audit-only");
    expect(html).toContain("V2 receives structural validation only");
  });

  it("keeps production wiring free of fixture, test, and directly callable artifact authority", async () => {
    const source = readFileSync(new URL("./applications.ts", import.meta.url), "utf8");
    const artifactRuntimeSource = readFileSync(
      new URL("./PrimaryPartCustomizedArtifactRuntime.ts", import.meta.url),
      "utf8",
    );
    const routeSource = readFileSync(new URL("./DesignerRoute.ts", import.meta.url), "utf8");
    expect(source).not.toContain("/fixtures");
    expect(source).not.toContain("/v2-testing");
    expect(source).toContain("@opencircuit/motor-designer/v2-status");
    expect(source).toContain("@opencircuit/motor-designer/v3-status");
    expect(source).toContain("@opencircuit/power-designer/v2-status");
    expect(source).toContain("@opencircuit/power-designer/v3-status");
    expect(source).not.toMatch(/from "@opencircuit\/(?:motor|power)-designer";/);
    expect(source).toContain('await import("@opencircuit/motor-designer/v2")');
    expect(source).toContain('import("@opencircuit/power-designer/v2")');
    expect(source).toContain('await import("@opencircuit/motor-designer/v3")');
    expect(source).toContain('import("@opencircuit/power-designer/v3")');
    expect(source).toContain('import("@opencircuit/power-designer/reference-evidence")');
    expect(source).toContain("referenceDesignEvidence: generation.referenceDesignEvidence");
    expect(source).toContain("assertMotorPrimaryPartCustomizedResultV1");
    expect(source).toContain("assertPowerPrimaryPartCustomizedResultV1");
    expect(source).toContain("assertMotorProductionConstraintObservationDecisionV3");
    expect(source).toContain("assertPowerProductionConstraintObservationDecisionV3");
    expect(source).toContain('import("./PrimaryPartCustomizedArtifactRuntime")');
    expect(source).toContain("authorizedPrimaryPartCustomizedFileRequests = new WeakMap");
    expect(source).toContain("function authorizePrimaryPartCustomizedFileRequestV1(");
    expect(source).toContain("export function _consumeAuthorizedPrimaryPartCustomizedFileRequestV1(");
    expect(source).not.toContain('"../../../../../packages/design-export/src/primary-part-customized-artifact-v1"');
    expect(source).not.toContain('"../../../../../packages/design-export/src/primary-part-customized-installed-artifact-v1"');
    expect(artifactRuntimeSource).toContain('"../../../../../packages/design-export/src/primary-part-customized-artifact-v1"');
    expect(artifactRuntimeSource).toContain('"../../../../../packages/design-export/src/primary-part-customized-installed-artifact-v1"');
    expect(artifactRuntimeSource).toContain('"../../../../../packages/design-export/src/customized-target-inspection-receipt-v1"');
    expect(artifactRuntimeSource).toContain("exportAuthorizedPrimaryPartCustomizedFileV1(");
    expect(artifactRuntimeSource).toContain("verifyCustomizedTargetInspectionReceiptBytesV1(");
    expect(artifactRuntimeSource).not.toContain("authorizePrimaryPartCustomizedFileRequestV1");
    const artifactRuntime = await import("./PrimaryPartCustomizedArtifactRuntime");
    expect(Object.keys(artifactRuntime).sort()).toEqual([
      "exportAuthorizedPrimaryPartCustomizedFileV1",
      "verifyCustomizedTargetInspectionReceiptBytesV1",
    ]);
    expect(() => artifactRuntime.exportAuthorizedPrimaryPartCustomizedFileV1(Object.freeze({})))
      .toThrow("Customized-target file export requires an exact application authorization token");
    expect(source).not.toContain("evaluateConstraintDecisionV3");
    expect(source).not.toContain("ConstraintPolicyCatalogV3");
    expect(source).toContain('import("@opencircuit/design-export/production-artifact-v2")');
    expect(source).toContain("getMotorDesignContextV2()");
    expect(source).toContain("getPowerDesignContextV2()");
    expect(source).toContain("generateVerifiedMotorDesignV2(request)");
    expect(source).toContain("generateVerifiedBuckDesignV2(request)");
    expect(source).not.toContain("exportDesignResultScenarioSpiceV2");
    expect(source).not.toContain("exportDesignResultScenarioSimulationCsvV2");
    expect(source).not.toContain("exportCommercialBomCsvV2");
    expect(source).not.toContain("ForTesting");
    expect(routeSource).toContain("#authorizedDisplayedObservationDecision");
    expect(routeSource).toContain("policy-detached observation artifact");
    expect(routeSource).toContain("policy-detached observation preview");
  });

  it("exports only an exact provider-neutral sourcing request from an authorized generation", async () => {
    const motor = designerApplications()[0]!;
    const request = structuredClone(motor.presets[0]!.createRequest());
    request.constraints.allowUnknownHardConstraints = true;
    const generation = await motor.generate(request);
    if (!("kind" in generation)) throw new Error("Expected an authorized Motor generation");
    const candidate = generation.result.candidates[0];
    const contract = motor.sourcingRequestPacket;
    if (candidate === undefined || contract === undefined) throw new Error("Expected a sourcing request capability");
    const policy: SourcingRequestPolicyV1 = {
      schemaVersion: 1,
      region: "US",
      currency: "USD",
      allowedLifecycle: ["active"],
      allowBackorder: false,
      allowMarketplace: false,
      maximumSnapshotAgeSeconds: 3_600,
    };
    const sourceBefore = JSON.stringify(generation);
    const first = await contract.exportPacket(generation, candidate.id, 25, policy);
    const repeated = await contract.exportPacket(generation, candidate.id, 25, structuredClone(policy));
    expect(repeated).toEqual(first);
    expect(first).toMatchObject({
      kind: "provider_neutral_sourcing_request_packet",
      mimeType: "application/json;charset=utf-8",
      packet: {
        designResultRef: {
          schemaVersion: 2,
          designResultContentHash: generation.result.contentHash,
          requestHash: generation.result.requestHash,
          libraryVersion: generation.result.libraryVersion,
          libraryContentHash: generation.result.libraryContentHash,
        },
        candidateRef: { id: candidate.id, recipeId: candidate.recipeId },
        buildQuantity: 25,
        policy,
        boundaries: {
          purpose: "provider_neutral_sourcing_request",
          offers: "not_included",
          providerUrls: "not_included",
          providerSelection: "not_included",
          credentials: "not_included",
          commercialObservations: "not_included",
          providerAccess: "not_authorized",
        },
      },
    });
    expect(first.filename).toMatch(/^schemagic-motor-brushed-dc-[0-9a-f]{12}-sourcing-request-v1\.json$/u);
    expect(parseSourcingRequestPacketV1(first.content)).toEqual(first.packet);
    expect(first.content).not.toMatch(/https?:\/\//u);
    expect(first.packet.bomLines).toEqual(candidate.components.map((component) => ({
      lineId: component.id,
      manufacturerId: component.part.manufacturerId,
      manufacturerPartNumber: component.part.manufacturerPartNumber,
      quantityPerAssembly: component.quantityPerAssembly,
    })).sort((left, right) => left.lineId.localeCompare(right.lineId)));
    const exactInput: SourcingRequestPacketInputV1 = {
      designResultRef: first.packet.designResultRef,
      candidateRef: first.packet.candidateRef,
      bomLines: first.packet.bomLines,
      buildQuantity: first.packet.buildQuantity,
      policy: first.packet.policy,
    };
    expect(verifySourcingRequestPacketV1(first.content, exactInput)).toEqual(first.packet);
    expect(JSON.stringify(generation)).toBe(sourceBefore);

    await expect(contract.exportPacket(structuredClone(generation), candidate.id, 25, policy))
      .rejects.toThrow("authorized production generation");
    await expect(contract.exportPacket(
      generation,
      "candidate:v2:sha256:0000000000000000000000000000000000000000000000000000000000000000",
      25,
      policy,
    )).rejects.toThrow("exact candidate");
    await expect(contract.exportPacket(generation, candidate.id, 25, {
      ...policy,
      provider: "digikey",
    } as never)).rejects.toMatchObject({ code: "invalid_input" });
  }, 60_000);

  it("authorizes an exact Motor target customization without mutating the ordinary generation", async () => {
    const [motor, power] = designerApplications();
    const request = structuredClone(motor!.presets[0]!.createRequest());
    request.constraints.allowUnknownHardConstraints = true;
    const generation = await motor!.generate(request);
    if (!("kind" in generation)) throw new Error("Expected a Motor production generation");
    const sourceCandidate = generation.result.candidates.find((candidate) => (
      candidate.recipeId === "motor.native.integrated-h-bridge.facts-v3-2"
    ));
    if (sourceCandidate === undefined) throw new Error("Expected an integrated Motor candidate");
    const ordinaryBytes = serializeDesignResultV2(generation.result);
    const customization = motor!.primaryPartCustomization;
    if (customization === undefined) throw new Error("Expected installed Motor customization");

    const targets = await customization.listTargets(generation, sourceCandidate.id);
    expect(targets).toHaveLength(1);
    const target = targets[0]!;
    expect(target.instruction).toMatchObject({
      application: "motor.brushed-dc",
      sourceResultContentHash: generation.result.contentHash,
      sourceCandidateId: sourceCandidate.id,
      substitution: {
        role: "primary",
        sourceProfile: { profileId: sourceCandidate.components.find((entry) => entry.id === "primary")!.profileId },
        targetProfile: { profileId: target.targetProfile.profileId },
      },
    });
    expect(target.targetProfile.manufacturerPartNumber).not.toBe(
      sourceCandidate.components.find((entry) => entry.id === "primary")!.part.manufacturerPartNumber,
    );

    const customized = await customization.generate(generation, target.instruction);
    expect(serializeDesignResultV2(generation.result)).toBe(ordinaryBytes);
    expect(customized.targetResultProjection.candidates).toHaveLength(1);
    expect(customized.targetResultProjection.candidates[0]!.components.find((entry) => entry.id === "primary")?.profileId)
      .toBe(target.targetProfile.profileId);
    expect(customized.constraintDecision.source.resultContentHash)
      .toBe(customized.targetResultProjection.contentHash);
    expect(customized.constraintDecision.candidates).toHaveLength(1);
    expect(customized.constraintDecision.candidates[0]!.eligible).toBe(false);
    expect(customized.claimBoundary).toEqual({
      ordinaryGenerationMutation: "none",
      targetConstraintPolicyEligibility: "evaluated",
      ranking: "not_recomputed",
      selectedPartModel: "not_added",
      commercialAuthority: "not_added",
    });
    expect(customization.authorizesCustomizedResult(customized, generation)).toBe(true);
    expect(customization.authorizesCustomizedResult(structuredClone(customized), generation)).toBe(false);
    expect(customization.authorizesCustomizedResult(customized, structuredClone(generation))).toBe(false);

    const sourceFingerprintBeforeExport = JSON.stringify(generation);
    const customizedFingerprintBeforeExport = JSON.stringify(customized);
    const firstBom = await customization.exportArtifact(
      generation,
      customized,
      "customized_target_electrical_bom_csv",
    );
    const repeatedBom = await customization.exportArtifact(
      generation,
      customized,
      "customized_target_electrical_bom_csv",
    );
    const firstSvg = await customization.exportArtifact(
      generation,
      customized,
      "customized_target_structural_svg",
    );
    const repeatedSvg = await customization.exportArtifact(
      generation,
      customized,
      "customized_target_structural_svg",
    );
    const firstReport = await customization.exportArtifact(
      generation,
      customized,
      "customized_target_engineering_report_html",
    );
    const repeatedReport = await customization.exportArtifact(
      generation,
      customized,
      "customized_target_engineering_report_html",
    );
    const firstKicad = await customization.exportArtifact(
      generation,
      customized,
      "customized_target_structural_kicad",
    );
    const repeatedKicad = await customization.exportArtifact(
      generation,
      customized,
      "customized_target_structural_kicad",
    );
    const firstSpice = await customization.exportArtifact(
      generation,
      customized,
      "customized_target_behavioral_scenario_spice",
    );
    const repeatedSpice = await customization.exportArtifact(
      generation,
      customized,
      "customized_target_behavioral_scenario_spice",
    );
    expect(repeatedBom).toEqual(firstBom);
    expect(repeatedSvg).toEqual(firstSvg);
    expect(repeatedReport).toEqual(firstReport);
    expect(repeatedKicad).toEqual(firstKicad);
    expect(repeatedSpice).toEqual(firstSpice);
    expect(firstBom).toMatchObject({ kind: "customized_target_electrical_bom_csv" });
    expect(firstBom.filename).toMatch(/\.csv$/);
    expect(firstBom.content).toContain(target.targetProfile.manufacturerPartNumber);
    expect(firstSvg).toMatchObject({ kind: "customized_target_structural_svg" });
    expect(firstSvg.filename).toMatch(/\.svg$/);
    expect(firstSvg.content).toContain("<svg");
    expect(firstSvg.content).toContain(target.targetProfile.manufacturerPartNumber);
    expect(firstReport).toMatchObject({
      kind: "customized_target_engineering_report_html",
      mimeType: "text/html;charset=utf-8",
    });
    expect(firstReport.filename).toMatch(/-customized-target-engineering-report\.html$/u);
    expect(firstReport.content).toContain("scheMAGIC customized-target engineering report");
    expect(firstReport.content).not.toContain("schemagic-printable-report-metadata-v2");
    expect(firstKicad).toMatchObject({
      kind: "customized_target_structural_kicad",
      mimeType: "application/x-kicad-schematic;charset=utf-8",
    });
    expect(firstKicad.filename).toMatch(/-customized-target-structural\.kicad_sch$/u);
    expect(firstKicad.content).toContain("CUSTOMIZED TARGET - INSPECTION ONLY");
    expect(firstKicad.content).toContain('"Footprint" ""');
    expect(firstKicad.content).not.toContain("scheMAGIC Metadata V2");
    expect(firstSpice).toMatchObject({
      kind: "customized_target_behavioral_scenario_spice",
      mimeType: "text/x-spice;charset=utf-8",
    });
    expect(firstSpice.filename).toMatch(/-customized-target-[A-Za-z0-9._-]+-behavioral\.cir$/u);
    expect(firstSpice.content).toContain("coverage-tier behavioral");
    expect(firstSpice.content).toContain("omissionCount");
    expect(firstSpice.content).toContain(":0");
    const targetDefaultScenarioId = customized.targetResultProjection.candidates[0]!.circuit.defaultScenarioId;
    expect(targetDefaultScenarioId).not.toBeNull();
    expect(firstSpice.content).toContain(targetDefaultScenarioId!);
    const firstReceipt = await customization.exportInspectionReceipt(generation, customized);
    const repeatedReceipt = await customization.exportInspectionReceipt(generation, customized);
    expect(repeatedReceipt).toEqual(firstReceipt);
    expect(firstReceipt).toMatchObject({
      kind: "customized_target_inspection_receipt",
      mimeType: "application/json;charset=utf-8",
    });
    expect(firstReceipt.filename).toMatch(/-customized-target-inspection-receipt-v1\.json$/u);
    const receiptRuntime = await import(
      "../../../../../packages/design-export/src/customized-target-inspection-receipt-v1"
    );
    const parsedReceipt = receiptRuntime.parseCustomizedTargetInspectionReceiptV1Text(firstReceipt.content);
    expect(receiptRuntime.verifyCustomizedTargetInspectionReceiptV1(parsedReceipt)).toEqual(parsedReceipt);
    expect(parsedReceipt.artifacts).toEqual([
      {
        kind: firstBom.kind,
        filename: firstBom.filename,
        mimeType: firstBom.mimeType,
        utf8ByteLength: new TextEncoder().encode(firstBom.content).byteLength,
        utf8Sha256: designSha256ContentHash(firstBom.content),
      },
      {
        kind: firstSvg.kind,
        filename: firstSvg.filename,
        mimeType: firstSvg.mimeType,
        utf8ByteLength: new TextEncoder().encode(firstSvg.content).byteLength,
        utf8Sha256: designSha256ContentHash(firstSvg.content),
      },
    ]);
    expect(parsedReceipt.claimBoundary).toMatchObject({
      purpose: "inspection_only",
      artifactReplay: "required",
      parseAndSelfHash: "integrity_only",
      installedContextAuthority: "not_conferred",
      ordinaryResultEvidence: "not_evidence",
      eligibilityEvidence: "not_evidence",
      rankingEvidence: "not_evidence",
      simulationData: "not_included",
      commercialAuthority: "not_added",
      attestation: "none",
    });
    expect(customization.authorizesCustomizedResult(parsedReceipt.customizedResult, generation)).toBe(false);
    const restored = await customization.restoreInspectionReceipt(
      generation,
      sourceCandidate.id,
      new TextEncoder().encode(firstReceipt.content),
    );
    expect(restored).not.toBe(parsedReceipt.customizedResult);
    expect(restored).not.toBe(customized);
    expect(JSON.stringify(restored)).toBe(JSON.stringify(customized));
    expect(customization.authorizesCustomizedResult(restored, generation)).toBe(true);
    expect(await customization.exportArtifact(
      generation,
      restored,
      "customized_target_electrical_bom_csv",
    )).toEqual(firstBom);
    expect(await customization.exportArtifact(
      generation,
      restored,
      "customized_target_structural_svg",
    )).toEqual(firstSvg);
    expect(await customization.exportArtifact(
      generation,
      restored,
      "customized_target_engineering_report_html",
    )).toEqual(firstReport);
    expect(await customization.exportArtifact(
      generation,
      restored,
      "customized_target_structural_kicad",
    )).toEqual(firstKicad);
    expect(await customization.exportArtifact(
      generation,
      restored,
      "customized_target_behavioral_scenario_spice",
    )).toEqual(firstSpice);

    await expect(customization.restoreInspectionReceipt(
      structuredClone(generation),
      sourceCandidate.id,
      new TextEncoder().encode(firstReceipt.content),
    )).rejects.toThrow("authorized production generation");
    await expect(customization.restoreInspectionReceipt(
      generation,
      "candidate:v2:sha256:0000000000000000000000000000000000000000000000000000000000000000",
      new TextEncoder().encode(firstReceipt.content),
    )).rejects.toThrow("exact candidate");
    await expect(customization.restoreInspectionReceipt(
      generation,
      sourceCandidate.id,
      new TextEncoder().encode(`${firstReceipt.content}\n`),
    )).rejects.toMatchObject({ code: "invalid_receipt" });
    await expect(customization.restoreInspectionReceipt(
      generation,
      sourceCandidate.id,
      new Uint8Array(customization.inspectionReceiptMaxBytes + 1),
    )).rejects.toThrow("exceeds the installed byte limit");
    const descriptorDrift = structuredClone(parsedReceipt);
    (descriptorDrift.artifacts[0] as { utf8ByteLength: number }).utf8ByteLength += 1;
    (descriptorDrift as { contentHash: string }).contentHash =
      receiptRuntime.calculateCustomizedTargetInspectionReceiptContentHashV1(descriptorDrift);
    await expect(customization.restoreInspectionReceipt(
      generation,
      sourceCandidate.id,
      new TextEncoder().encode(receiptRuntime.serializeCustomizedTargetInspectionReceiptV1(descriptorDrift)),
    )).rejects.toMatchObject({ code: "artifact_descriptor_mismatch" });

    const portableMotor = designerApplications()[0]!;
    const portableGeneration = await portableMotor.generate(structuredClone(request));
    if (!("kind" in portableGeneration)) throw new Error("Expected a portable Motor production generation");
    expect(serializeDesignResultV2(portableGeneration.result)).toBe(ordinaryBytes);
    const portableCustomization = portableMotor.primaryPartCustomization!;
    const portableRestored = await portableCustomization.restoreInspectionReceipt(
      portableGeneration,
      sourceCandidate.id,
      new TextEncoder().encode(firstReceipt.content),
    );
    expect(JSON.stringify(portableRestored)).toBe(JSON.stringify(customized));
    expect(portableCustomization.authorizesCustomizedResult(portableRestored, portableGeneration)).toBe(true);
    expect(serializeDesignResultV2(generation.result)).toBe(ordinaryBytes);
    expect(JSON.stringify(generation)).toBe(sourceFingerprintBeforeExport);
    expect(JSON.stringify(customized)).toBe(customizedFingerprintBeforeExport);

    await expect(customization.exportArtifact(
      generation,
      structuredClone(customized),
      "customized_target_electrical_bom_csv",
    )).rejects.toThrow("exact authorized customized result and source");
    const mutatedCustomizedClone = structuredClone(customized);
    (mutatedCustomizedClone as { targetResultProjection: { contentHash: string } })
      .targetResultProjection.contentHash = "sha256:0000000000000000000000000000000000000000000000000000000000000000";
    await expect(customization.exportArtifact(
      generation,
      mutatedCustomizedClone,
      "customized_target_electrical_bom_csv",
    )).rejects.toThrow("exact authorized customized result and source");
    const mutatedSourceClone = structuredClone(generation);
    (mutatedSourceClone as { contextManifestContentHash: string }).contextManifestContentHash =
      "sha256:0000000000000000000000000000000000000000000000000000000000000000";
    await expect(customization.exportArtifact(
      mutatedSourceClone,
      customized,
      "customized_target_electrical_bom_csv",
    )).rejects.toThrow("authorized production generation");
    await expect(customization.exportArtifact(
      structuredClone(generation),
      structuredClone(customized),
      "scenario_spice" as never,
    )).rejects.toThrow("Unsupported customized-target artifact kind: scenario_spice");
    await expect(customization.exportArtifact(
      generation,
      customized,
      "electrical_bom_csv" as never,
    )).rejects.toThrow("Unsupported customized-target artifact kind: electrical_bom_csv");

    const motorLeaf = await import("@opencircuit/motor-designer/v3");
    const independentlyGenerated = motorLeaf.generateMotorPrimaryPartCustomizedResultV1(
      target.instruction,
      { result: generation.result, execution: generation.execution },
    );
    expect(JSON.stringify(independentlyGenerated)).toBe(JSON.stringify(customized));
    expect(customization.authorizesCustomizedResult(independentlyGenerated, generation)).toBe(false);
    await expect(customization.exportArtifact(
      generation,
      independentlyGenerated,
      "customized_target_electrical_bom_csv",
    )).rejects.toThrow("exact authorized customized result and source");
    const directTarget = independentlyGenerated.targetResultProjection.candidates[0]!;
    const directDefaultScenarioId = directTarget.circuit.defaultScenarioId;
    if (directDefaultScenarioId === null) throw new Error("Expected a default behavioral target scenario");
    for (const ordinaryExport of [
      { kind: "electrical_bom_csv" as const },
      { kind: "engineering_report_html" as const },
      { kind: "structural_kicad" as const },
      {
        kind: "scenario_spice" as const,
        scenarioId: directDefaultScenarioId,
      },
    ]) {
      await expect(motor!.exportProductionArtifact?.({
        result: independentlyGenerated.targetResultProjection,
        candidateId: directTarget.id,
        ...ordinaryExport,
      })).rejects.toMatchObject({ code: "engineering_context_unverified" });
    }
    await expect(customization.listTargets(structuredClone(generation), sourceCandidate.id))
      .rejects.toThrow("authorized production generation");

    const pendingHtml = renderPrimaryPartCustomization({
      sourceCandidate,
      targets,
      instruction: target.instruction,
      phase: "idle",
    });
    expect(pendingHtml).toContain("ENGINEERING CHANGE ORDER · PRIMARY ROLE ONLY");
    expect(pendingHtml).toContain("target eligibility not yet evaluated");
    expect(pendingHtml).toContain("Evaluate substitution");
    expect(pendingHtml).toContain("Verify inspection receipt JSON");
    expect(pendingHtml).not.toContain("data-primary-customization-result");
    const customizedHtml = renderPrimaryPartCustomization({
      sourceCandidate,
      targets,
      instruction: target.instruction,
      customizedResult: customized,
      phase: "idle",
    });
    expect(customizedHtml).toContain("TARGET-ONLY PROJECTION · INSTALLED V3 POLICY");
    expect(customizedHtml).toContain(target.targetProfile.manufacturerPartNumber);
    expect(customizedHtml).toContain("Ineligible under installed V3 policy");
    expect(customizedHtml).toContain("The ordinary generated result is unchanged.");
    expect(customizedHtml).toContain("Ranking</dt><dd>not recomputed");
    expect(customizedHtml).toContain("Selected-part model</dt><dd>not added");
    expect(customizedHtml).toContain("Commercial authority</dt><dd>not added");
    expect(customizedHtml).toContain('data-customized-target-export="customized_target_engineering_report_html"');
    expect(customizedHtml).toContain('data-customized-target-export="customized_target_structural_kicad"');
    expect(customizedHtml).toContain('data-customized-target-export="customized_target_behavioral_scenario_spice"');
    expect(customizedHtml).toContain("The engineering report is for inspection only.");
    expect(customizedHtml).toContain("It adds no release, physical-fidelity, or commercial authority.");
    expect(customizedHtml).toContain("The KiCad schematic is structural only and its footprints stay empty.");
    expect(customizedHtml).toContain("Opening it in external KiCad remains UNVERIFIED");
    expect(customizedHtml).toContain("Scenario SPICE is the exact default behavioral input and is available only with zero omissions.");
    expect(customizedHtml).toContain("It adds no selected-part model, samples, physical fidelity, ranking, or eligibility authority.");
    expect(customizedHtml).toContain("binds only the exact BOM CSV and structural SVG");
    expect(customizedHtml).toContain("Download inspection receipt JSON");
    expect(customizedHtml).toContain("Parsing and replay prove byte association only");
    expect(customizedHtml).not.toContain("data-production-export");
    expect(customizedHtml).not.toContain("Open in Simulator");
    const exportingHtml = renderPrimaryPartCustomization({
      sourceCandidate,
      targets,
      instruction: target.instruction,
      customizedResult: customized,
      phase: "idle",
      exportingArtifact: "customized_target_behavioral_scenario_spice",
    });
    expect(exportingHtml).toContain('aria-busy="true"');
    expect(exportingHtml).toContain("Preparing target behavioral Scenario SPICE…");
    expect(exportingHtml.match(/data-customized-target-export="[^"]+"[^>]* disabled/g)).toHaveLength(5);

    const externalRequest = structuredClone(motor!.presets[1]!.createRequest());
    externalRequest.constraints.allowUnknownHardConstraints = true;
    const externalGeneration = await motor!.generate(externalRequest);
    if (!("kind" in externalGeneration)) throw new Error("Expected an external Motor generation");
    if (externalGeneration.kind !== "production_constraint_observation") throw new Error("Expected an external Motor policy observation");
    expect(externalGeneration.result.candidates).toHaveLength(2);
    expect(externalGeneration.result.candidates.every((candidate) => (
      candidate.components.every((component) => component.id !== "gate-resistor")
    ))).toBe(true);
    expect(externalGeneration.constraintDecision.eligibleCandidateIds).toEqual([]);
    await expect(customization.exportArtifact(
      externalGeneration,
      customized,
      "customized_target_electrical_bom_csv",
    )).rejects.toThrow("exact authorized customized result and source");

    const nextIntegratedGeneration = await motor!.generate(structuredClone(request));
    if (!("kind" in nextIntegratedGeneration)) throw new Error("Expected a next Motor production generation");
    await expect(customization.exportArtifact(
      nextIntegratedGeneration,
      customized,
      "customized_target_structural_svg",
    )).rejects.toThrow("exact authorized customized result and source");

    const powerRequest = structuredClone(power!.presets[0]!.createRequest());
    powerRequest.constraints.allowUnknownHardConstraints = true;
    const powerGeneration = await power!.generate(powerRequest);
    if (!("kind" in powerGeneration)) throw new Error("Expected a Power production generation");
    expect(powerGeneration.result.candidates).toHaveLength(1);
    expect(powerGeneration.execution.rejections).toEqual([]);
    const powerCandidateId = powerGeneration.result.candidates[0]?.id;
    if (!powerCandidateId) throw new Error("Expected the retained Power observation identity");
    expect(await power!.primaryPartCustomization!.listTargets(
      powerGeneration,
      powerCandidateId,
    )).toEqual([]);
    await expect(customization.exportArtifact(
      powerGeneration,
      customized,
      "customized_target_electrical_bom_csv",
    )).rejects.toThrow("authorized production generation");
    await expect(power!.primaryPartCustomization!.exportArtifact(
      powerGeneration,
      customized,
      "customized_target_electrical_bom_csv",
    )).rejects.toThrow("exact authorized customized result and source");
  }, 240_000);

  it("keeps strict generation empty until an explicit unknown-evidence opt-in", async () => {
    const motor = designerApplications()[0]!;
    const preset = motor.presets[0]!;
    const request = preset.createRequest();

    expect(request).toMatchObject({
      schemaVersion: 2,
      application: "motor.brushed-dc",
      libraryVersion: MOTOR_DESIGN_V2_PRODUCTION_STATUS.catalogVersion,
      constraints: { allowUnknownHardConstraints: false },
    });
    expect(motor.parameterForm.validate(request)).toEqual([]);
    const strict = await motor.generate(structuredClone(request));
    expect("kind" in strict && strict.kind).toBe("production_context_verified");
    if (!("kind" in strict)) throw new Error("Expected a verified production generation");
    expect(strict.result.schemaVersion).toBe(2);
    expect(strict.result.candidates).toEqual([]);
    expect(strict.execution.rejections.some((entry) => entry.reasonCode === "unknown_constraint_disallowed")).toBe(true);
    expect(verifiedProductionGeneration(strict, motor)).toBe(strict);
    expect(() => verifiedProductionGeneration(strict.result, motor))
      .toThrow("did not return a verified production generation");
    expect(() => verifiedProductionGeneration({
      ...strict,
      contextManifestContentHash: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    }, motor)).toThrow("context-mismatched production generation");
    const strictHtml = renderImportedResult({
      result: strict.result,
      trust: "production_context_verified",
      execution: strict.execution,
      contextManifestContentHash: strict.contextManifestContentHash,
    }, undefined);
    expect(strictHtml).toContain("VERIFIED EXECUTION REPORT · EXACT REGENERATION");
    expect(strictHtml).toContain("Exact execution ledger");
    expect(strictHtml).toContain("<details open>");
    expect(strictHtml).toContain('data-execution-group="recipe-feasibility"');
    expect(strictHtml).toContain('data-execution-group="electrical-hard-failure"');
    expect(strictHtml).toContain('data-execution-group="evidence-policy-exclusion"');
    expect(strictHtml).toContain('data-execution-group="duplicate"');
    expect(strictHtml).toContain('data-execution-group="objective-relative-pareto"');
    expect(strictHtml).toContain("unknown_constraint_disallowed");
    expect(strictHtml).toContain("Verified generation · no retained selection");
    expect(strictHtml).not.toContain(">Verified selection<");
    expect(strictHtml).not.toContain("data-imported-pin");
    expect(strictHtml).not.toContain("data-lcsc-search");
    expect(strictHtml).not.toContain("data-production-evidence-dossier");
    expect(strictHtml).not.toContain("data-production-constraint-policy");

    const permissiveRequest = structuredClone(request);
    permissiveRequest.constraints.allowUnknownHardConstraints = true;
    const first = await motor.generate(permissiveRequest);
    const second = await motor.generate(structuredClone(permissiveRequest));
    expect(first).toEqual(second);
    if (!("kind" in first) || first.kind !== "production_constraint_observation") {
      throw new Error("Expected an installed-policy production observation");
    }
    expect(first.kind).toBe("production_constraint_observation");
    expect(first.constraintDecision.policy).toEqual({
      constraintPolicy: "production_strict_v1",
      contentHash: MOTOR_CONSTRAINT_POLICY_V3_PRODUCTION_STATUS.contentHash,
    });
    expect(first.constraintDecision.source.resultContentHash).toBe(first.result.contentHash);
    expect(first.constraintDecision.eligibleCandidateIds).toEqual([]);
    expect(first.constraintDecision.candidates).toHaveLength(first.result.candidates.length);
    expect(first.constraintDecision.candidates.every((entry) => !entry.eligible)).toBe(true);
    expect(first.constraintDecision.candidates.flatMap((entry) => entry.rules)
      .some((rule) => rule.disposition === "blocked_unknown")).toBe(true);
    expect(first.constraintDecision.candidates.flatMap((entry) => entry.rules)
      .some((rule) => rule.criticality === "engineering_gap")).toBe(false);
    expect(verifiedProductionGeneration(first, motor)).toBe(first);
    const forgedDecisionPayload = {
      ...structuredClone(first.constraintDecision),
      policy: {
        ...first.constraintDecision.policy,
        contentHash: POWER_CONSTRAINT_POLICY_V3_PRODUCTION_STATUS.contentHash,
      },
    };
    const forgedDecision = {
      ...forgedDecisionPayload,
      contentHash: calculateConstraintDecisionV3ContentHash(forgedDecisionPayload),
    };
    expect(() => verifiedProductionGeneration({ ...first, constraintDecision: forgedDecision }, motor))
      .toThrow("policy-mismatched production observation");
    await expect(motor.exportProductionArtifact?.({
      result: first.result,
      candidateId: first.result.candidates[0]!.id,
      kind: "electrical_bom_csv",
      constraintDecision: forgedDecision,
    })).rejects.toMatchObject({
      name: "ConstraintDecisionEvaluationErrorV3",
      code: "decision_context_mismatch",
    });
    const forgedEligibilityPayload = {
      ...structuredClone(first.constraintDecision),
      candidates: first.constraintDecision.candidates.map((entry) => ({
        ...structuredClone(entry),
        rules: entry.rules.map((rule) => ({
          ...structuredClone(rule),
          criticality: "engineering_gap" as const,
          disposition: rule.truth === "unknown" ? "inspectable_unknown" as const : "satisfied" as const,
        })),
        eligible: true,
      })),
      eligibleCandidateIds: [...first.constraintDecision.source.candidateIds],
    };
    const forgedEligibilityDecision = {
      ...forgedEligibilityPayload,
      contentHash: calculateConstraintDecisionV3ContentHash(forgedEligibilityPayload),
    };
    expect(() => verifiedProductionGeneration({
      ...first,
      constraintDecision: forgedEligibilityDecision,
    }, motor)).toThrow("did not authorize this exact production generation");
    expect(first.result.schemaVersion).toBe(2);
    expect(first.result.candidates.length).toBeGreaterThan(0);
    expect(first.result.candidates.every((candidate) => candidate.constraints.some((constraint) => constraint.status === "unknown"))).toBe(true);
    const candidate = first.result.candidates[0]!;
    expect(candidate.circuit.circuits[0]!.wires.length).toBeGreaterThan(0);
    expect(candidate.circuit.defaultCircuitId).toBe("assembly");
    expect(candidate.circuit.circuits.map((entry) => entry.id)).toEqual([
      "assembly",
      "behavioral-operating-point",
    ]);
    expect(candidate.circuit.scenarios).toEqual([
      expect.objectContaining({
        id: "pwm_loaded_steady_state",
        circuitId: "behavioral-operating-point",
        config: { mode: "op" },
      }),
    ]);
    expect(candidate.circuit.defaultScenarioId).toBe("pwm_loaded_steady_state");
    expect(candidate.circuit.designBlocks).toEqual([
      expect.objectContaining({ netlist: expect.objectContaining({ kind: "schematic_only" }) }),
    ]);
    const selectedPrimary = candidate.components.find((component) => component.id === "primary")!;
    expect(candidate.circuit.circuits[0]!.components.find((component) => component.id === "primary"))
      .toEqual(expect.objectContaining({ type: "design_block", mpn: selectedPrimary.part.manufacturerPartNumber }));
    expect(candidate.circuitBomNonRepresentations).toHaveLength(candidate.components.length);
    expect(candidate.circuitBomNonRepresentations.every((entry) => (
      entry.circuitId === "behavioral-operating-point"
    ))).toBe(true);
    const artifact = await motor.exportProductionArtifact?.({
      result: first.result,
      candidateId: candidate.id,
      kind: "electrical_bom_csv",
      constraintDecision: first.constraintDecision,
    });
    expect(artifact?.kind).toBe("electrical_bom_csv");
    expect(artifact?.filename).toMatch(/^schemagic-motor-brushed-dc-[0-9a-f]{12}-electrical-bom\.csv$/u);
    expect(artifact?.content).toContain(candidate.components[0]!.part.manufacturerPartNumber);
    expect(artifact?.content).toContain("observation_only,ineligible");
    expect(artifact?.content).toContain(first.constraintDecision.contentHash);
    expect(artifact?.content).toContain(first.constraintDecision.policy.contentHash);
    const scenarioArtifact = await motor.exportProductionArtifact?.({
      result: first.result,
      candidateId: candidate.id,
      kind: "scenario_spice",
      scenarioId: "pwm_loaded_steady_state",
    });
    expect(scenarioArtifact).toMatchObject({
      kind: "scenario_spice",
      mimeType: "text/x-spice;charset=utf-8",
    });
    expect(scenarioArtifact?.filename).toMatch(/-pwm-loaded-steady-state-behavioral\.cir$/u);
    expect(scenarioArtifact?.content).toContain(`* result-hash ${first.result.contentHash}`);
    expect(scenarioArtifact?.content).toContain(`* candidate-id ${candidate.id}`);
    expect(scenarioArtifact?.content).toContain("* scenario-id pwm_loaded_steady_state");
    expect(scenarioArtifact?.content).toContain("* coverage-tier behavioral");
    expect(scenarioArtifact?.content).toContain("* model-boundary ");
    await expect(motor.exportProductionArtifact?.({
      result: first.result,
      candidateId: candidate.id,
      kind: "scenario_spice",
      scenarioId: "stale-or-tampered-scenario",
    })).rejects.toThrow("scheMAGIC scenario SPICE export was rejected");
    await expect(motor.exportProductionArtifact?.({
      result: first.result,
      candidateId: candidate.id,
      kind: "physical_handoff_json",
    })).rejects.toThrow("Motor production artifact kind is unavailable: physical_handoff_json");

    const verifiedImported = {
      result: first.result,
      trust: "production_constraint_observation" as const,
      execution: first.execution,
      contextManifestContentHash: first.contextManifestContentHash,
      constraintDecision: first.constraintDecision,
    };
    const exactHtml = renderImportedResult(verifiedImported, candidate.id, undefined, "pwm_loaded_steady_state", undefined, true, {
      status: "ready",
      url: "blob:https://schemagic.test/exact-motor-svg",
      filename: "schemagic-motor.svg",
    }, new Set([candidate.id]));
    const serializedObservation = serializeImportedDesignResult(verifiedImported);
    expect(JSON.parse(serializedObservation)).toEqual(first.result);
    expect(serializedObservation).not.toContain("constraintDecision");
    const primary = candidate.components.find((component) => component.id === "primary") ?? candidate.components[0]!;
    expect(exactHtml).toContain('data-production-export="electrical_bom_csv"');
    expect(exactHtml).toContain('data-production-export="structural_svg"');
    expect(exactHtml).toContain('data-production-export="engineering_report_html"');
    expect(exactHtml).toContain('data-production-export="structural_kicad"');
    expect(exactHtml).not.toContain('data-production-export="physical_handoff_json"');
    expect(exactHtml).toContain("data-production-schematic-preview");
    expect(exactHtml).toContain("EXACT STRUCTURAL PROJECTION · NO SIMULATION DATA");
    expect(exactHtml).toContain('alt="Exact structural schematic for motor.native.integrated-h-bridge.facts-v3-2"');
    expect(exactHtml).toContain("Primary manufacturer / MPN");
    expect(exactHtml).toContain(`${primary.part.manufacturerId} / ${primary.part.manufacturerPartNumber}`);
    expect(exactHtml).toMatch(new RegExp(`data-imported-pin="${candidate.id}"[^>]*checked`, "u"));
    expect(exactHtml).toContain("Pin up to three inspectable V2 observations");
    expect(exactHtml).toContain("data-pinned-comparison");
    expect(exactHtml).toContain("PINNED DECISION SET · 1/3");
    expect(exactHtml).toContain("data-production-execution-ledger");
    expect(exactHtml).toContain("Objective-relative Pareto");
    expect(exactHtml).toContain("request's configured electrical criteria, not universal superiority");
    expect(exactHtml).toContain("PRODUCTION V3 POLICY · V2 DESIGN OBSERVATION");
    expect(exactHtml).toContain("PRODUCTION STRICT V3 · INSTALLED POLICY");
    expect(exactHtml).toContain("Operating charts");
    expect(exactHtml).toContain('data-designer-operating-chart="constraint-status"');
    expect(exactHtml).toContain('data-designer-operating-chart="motor-current-envelope"');
    expect(exactHtml).toContain("Requested motor current envelope");
    expect(exactHtml).toContain("not measurements, simulation samples, efficiency curves, or selected-part verification");
    expect(exactHtml).toContain("0 eligible");
    expect(exactHtml).toContain('data-production-constraint-policy');
    expect(exactHtml).toContain('class="designer-policy-rule-disclosure"');
    expect(exactHtml).toContain("Blocked rule detail");
    expect(exactHtml).toContain('data-truth="unknown"');
    expect(exactHtml).toContain('data-criticality="safety"');
    expect(exactHtml).toContain('data-disposition="blocked_unknown"');
    expect(exactHtml).not.toContain('data-criticality="engineering_gap"');
    expect(exactHtml).toContain("This V3 decision is regenerated from the installed policy and is not accepted from imports.");
    expect(exactHtml).toContain("The electrical BOM CSV and structural SVG embed this exact recorded V3 decision and policy boundary; no eligibility is inferred.");
    expect(exactHtml.match(/data-production-observation-boundary=/gu)).toHaveLength(3);
    expect(exactHtml).toContain('data-production-observation-boundary="selected_detail" role="status"');
    expect(exactHtml).toContain('class="designer-workspace-selection-status" role="status"');
    expect(exactHtml).toContain('aria-label="Selected design eligibility: Policy-ineligible"');
    expect(exactHtml).toContain('data-designer-solution-announcement role="status" aria-live="polite" aria-atomic="true"');
    expect(exactHtml).toContain("Ineligible");
    expect(exactHtml).not.toContain("Generated candidate");
    expect(exactHtml).not.toContain("DETERMINISTIC PRODUCTION ORDER");
    expect(exactHtml).not.toContain("viable");
    expect(exactHtml).toContain("Exact V2 observation execution ledger");
    expect(exactHtml).toContain("data-production-evidence-dossier");
    expect(exactHtml).toContain("Selected-part evidence dossier");
    expect(exactHtml).toContain("Traceability only.");
    expect(exactHtml).toContain("no new review, admission, model, commercial, or simulation authority");
    expect(exactHtml.match(/data-production-evidence-line=/gu)).toHaveLength(candidate.components.length);
    expect(exactHtml.match(/data-lcsc-search=/gu)).toHaveLength(candidate.components.length);
    for (const component of candidate.components) {
      const mpn = component.part.manufacturerPartNumber;
      expect(exactHtml).toContain(`data-production-evidence-line="${component.id}"><header><span>${component.id}</span><code>${component.part.manufacturerId} / ${mpn}</code>`);
      expect(exactHtml).toContain(`data-lcsc-search="${mpn}" href="${lcscExactMpnSearchUrl(mpn)}" target="_blank" rel="noopener noreferrer" aria-describedby="designer-lcsc-search-boundary" aria-label="Search LCSC for ${mpn} (opens in a new tab)">Search LCSC for ${mpn}</a>`);
    }
    expect(exactHtml).toContain("data-lcsc-search-boundary");
    expect(exactHtml).toContain("Robonyx has not queried or verified stock, price, lifecycle, lead time, packaging, or orderability.");
    expect(exactHtml).toContain('data-production-export="scenario_spice" data-production-scenario="pwm_loaded_steady_state"');
    expect(exactHtml).toContain("Behavioral SPICE projection available");
    expect(exactHtml).toMatch(/<button disabled>Portable Simulation CSV<\/button>/u);
    expect(exactHtml).toMatch(/<button disabled>Commercial export<\/button>/u);

    const dossierImported = structuredClone(verifiedImported);
    const dossierCandidate = dossierImported.result.candidates[0]!;
    for (const component of dossierCandidate.components) component.evidence = [];
    const firstDossierComponent = dossierCandidate.components[0]!;
    const duplicate = {
      sourceId: "source-a",
      locator: "locator-a",
      contentHash: "hash-a",
      retrievedAt: "2026-01-01T00:00:00Z",
      licenseNote: "license-a<&",
    };
    firstDossierComponent.evidence = [
      { sourceId: "source-no-optionals", locator: "locator-no-optionals", licenseNote: "license-no-optionals" },
      { sourceId: "source-b", locator: "locator-a", contentHash: "hash-a", retrievedAt: "2026-01-01T00:00:00Z", licenseNote: "license-f" },
      { sourceId: "source-a", locator: "locator-b", contentHash: "hash-a", retrievedAt: "2026-01-01T00:00:00Z", licenseNote: "license-e" },
      { sourceId: "source-a", locator: "locator-a", contentHash: "hash-b", retrievedAt: "2026-01-01T00:00:00Z", licenseNote: "license-d" },
      { sourceId: "source-a", locator: "locator-a", contentHash: "hash-a", retrievedAt: "2026-02-01T00:00:00Z", licenseNote: "license-c" },
      { sourceId: "source-a", locator: "locator-a", contentHash: "hash-a", retrievedAt: "2026-01-01T00:00:00Z", licenseNote: "license-b" },
      duplicate,
      structuredClone(duplicate),
    ];
    const { contentHash: _staleDossierHash, ...dossierPayload } = dossierImported.result;
    const dossierResult = { ...dossierPayload, contentHash: canonicalDesignResultV2ContentHash(dossierPayload) };
    const dossierHtml = renderImportedResult({ ...dossierImported, result: dossierResult }, dossierCandidate.id);
    expect(dossierHtml.match(/data-production-evidence-ref/gu)).toHaveLength(7);
    expect(dossierHtml.match(/>Not supplied</gu)).toHaveLength(2);
    expect(dossierHtml).toContain("<dt>sourceId</dt>");
    expect(dossierHtml).toContain("<dt>locator</dt>");
    expect(dossierHtml).toContain("<dt>contentHash</dt>");
    expect(dossierHtml).toContain("<dt>retrievedAt</dt>");
    expect(dossierHtml).toContain("<dt>licenseNote</dt>");
    expect(dossierHtml).toContain("license-a&lt;&amp;");
    expect(dossierHtml).toContain("No persisted selected-part evidence references for this BOM component.");
    const orderedEvidenceMarkers = [
      "license-a&lt;&amp;",
      "license-b",
      "license-c",
      "license-d",
      "license-e",
      "license-f",
      "license-no-optionals",
    ];
    const orderedEvidencePositions = orderedEvidenceMarkers.map((marker) => dossierHtml.indexOf(marker));
    expect(orderedEvidencePositions.every((position, index) => position >= 0
      && (index === 0 || orderedEvidencePositions[index - 1]! < position))).toBe(true);

    const demonstrationHtml = renderImportedResult(verifiedImported, candidate.id, undefined, undefined, {
      code: "M1",
      title: "Content fixture",
      topology: "Integrated H-bridge",
      artifactContentHash: first.result.contentHash,
    }, true, undefined, new Set([candidate.id]));
    expect(demonstrationHtml).not.toContain("data-imported-pin");
    expect(demonstrationHtml).not.toContain("data-pinned-comparison");
    expect(demonstrationHtml).not.toContain("data-production-execution-ledger");
    expect(demonstrationHtml).not.toContain("data-lcsc-search");
    expect(demonstrationHtml).not.toContain("data-production-evidence-dossier");
    expect(demonstrationHtml).not.toContain("data-production-constraint-policy");
    expect(demonstrationHtml).not.toContain("data-production-export=");
    expect(demonstrationHtml).not.toContain("PRODUCTION V3 POLICY · V2 DESIGN OBSERVATION");
    expect(demonstrationHtml).not.toContain("PRODUCTION V2 · EXACT ENGINEERING CONTEXT VERIFIED");
    expect(demonstrationHtml).toContain("STRUCTURALLY VALID · ENGINEERING CONTEXT NOT VERIFIED");
    expect(demonstrationHtml).toContain('data-trust="structurally_valid"');
  }, 30_000);

  it("keeps exact MIC4606-2 direct-gate observations structural and V3-ineligible", async () => {
    const motor = designerApplications()[0]!;
    const request = motor.presets[1]!.createRequest();
    expect(request).toMatchObject({
      application: "motor.brushed-dc",
      constraints: {
        allowedTopologyFamilies: ["motor.hbridge.external-nmos"],
        allowUnknownHardConstraints: false,
      },
    });
    const strict = await motor.generate(structuredClone(request));
    if (!("kind" in strict)) throw new Error("Expected a verified production generation");
    const permissiveRequest = structuredClone(request);
    permissiveRequest.constraints.allowUnknownHardConstraints = true;
    const first = await motor.generate(permissiveRequest);
    if (!("kind" in first) || first.kind !== "production_constraint_observation") {
      throw new Error("Expected an installed-policy production observation");
    }
    expect(strict.contextManifestContentHash).toBe("sha256:06a4ef8b8141852bf9506c6f4f632a7b349b0947c449f85172313380dc195d38");
    expect({
      strictRequest: strict.result.requestHash,
      strictResult: strict.result.contentHash,
      permissiveRequest: first.result.requestHash,
      permissiveResult: first.result.contentHash,
      candidateIds: first.result.candidates.map((candidate) => candidate.id),
      decision: first.constraintDecision.contentHash,
    }).toEqual({
      strictRequest: "sha256:2fd2159070a51d75077ea7e2d7aa968af94728cc3d869aaf42f9dfc0be13d563",
      strictResult: "sha256:e89dcf5512270699df5f7886772a7ae2dcdaead9eea5e53133320420c6d9b435",
      permissiveRequest: "sha256:3eb6902cfb864b7e6977388fee7fa76535f9388b905b10e943849bb3207ab94f",
      permissiveResult: "sha256:0ea210d5fdd7f9fa5fd29a0815b94bb80d5deef79b022631cf43b6afdf50c176",
      candidateIds: [
        "candidate:v2:sha256:6b16171207d7e5afdb3284ad6d566cf2ccf9d565fbfea6a353c6d183b6b45bed",
        "candidate:v2:sha256:d0c2ae8814e0ec945608bf4998e571b0884059f000e29590785960ebaccbca70",
      ],
      decision: "sha256:f797708f3ebbd0ef2eec06f189cbd02f642f9292f2501368e62a44a7feaf7b3e",
    });
    expect(strict.result.candidates).toEqual([]);
    expect(strict.result.rejectedCandidates).toHaveLength(54);
    expect(strict.result.rejectedCandidates.every((rejection) => rejection.constraints.some((constraint) => (
      constraint.ruleId === "motor.external.gate-network"
      && constraint.status === "unknown"
      && constraint.evidence.some((evidence) => evidence.sourceId === "microchip-mic4606-ds20005604h")
      && rejection.constraints.some((candidateConstraint) => (
        candidateConstraint.ruleId === "motor.external.tvs-stand-off"
        && candidateConstraint.status === "unknown"
      ))
    )))).toBe(true);
    expect(strict.execution.rejections).toHaveLength(54);
    expect(strict.execution.rejections.every((rejection) => (
      rejection.stage === "check"
      && rejection.reasonCode === "unknown_constraint_disallowed"
    ))).toBe(true);
    const expectedStrictExternalCounts = {
      recipes: 6,
      supportedRecipes: 3,
      enumerated: 54,
      solved: 54,
      matchOutcomes: 54,
      matched: 54,
      checked: 54,
      estimated: 0,
      deduped: 0,
      pareto: 0,
      materialized: 0,
      coverageValidated: 0,
      rejected: 54,
    } as const;
    expect(strict.execution.counts).toEqual(expectedStrictExternalCounts);
    expect(verifiedProductionGeneration(strict, motor)).toBe(strict);

    const strictHtml = renderImportedResult({
      result: strict.result,
      trust: "production_context_verified",
      execution: strict.execution,
      contextManifestContentHash: strict.contextManifestContentHash,
    }, undefined);
    expect(strictHtml).toContain("Strict generation enumerated and checked 54 exact MIC4606-2 direct-gate options with separate bootstrap and VDD-local capacitor roles");
    expect(strictHtml).toContain("No series-gate resistor is selected");
    expect(strictHtml).toContain("exactly three reviewed 10 µF MLCC profiles while excluding the 100 nF C1608 from both roles");
    expect(strictHtml).toContain("Three interface-specific xHS rules pass only the nominal 0 V-to-requested-bus excursion");
    expect(strictHtml).toContain("No VDD driver-bias rail is implemented");
    expect(strictHtml).toContain("Those nominal passes do not prove effective capacitance, bootstrap charge or refresh, local bias support, bulk adequacy, placement");
    expect(strictHtml).toContain("motor.external.gate-network, or switching behavior");
    expect(strictHtml).toContain("unknown_constraint_disallowed");
    expect(strictHtml).not.toContain("No external-NMOS candidate was enumerated");
    expect(strictHtml).not.toContain("data-production-export=");

    const repeated = await motor.generate(structuredClone(permissiveRequest));
    expect(repeated).toEqual(first);
    expect(first.constraintDecision.eligibleCandidateIds).toEqual([]);
    expect(first.constraintDecision.policy.contentHash).toBe(MOTOR_CONSTRAINT_POLICY_V3_PRODUCTION_STATUS.contentHash);
    expect(first.contextManifestContentHash).toBe("sha256:06a4ef8b8141852bf9506c6f4f632a7b349b0947c449f85172313380dc195d38");
    expect(first.constraintDecision.candidates).toHaveLength(2);
    expect(first.constraintDecision.candidates.every((candidate) => !candidate.eligible)).toBe(true);
    expect(first.result.rejectedCandidates).toHaveLength(52);
    expect(first.execution.rejections).toHaveLength(52);
    expect(first.execution.rejections.every((rejection) => rejection.reasonCode === "pareto_dominated")).toBe(true);
    expect(first.execution.counts).toEqual({
      recipes: 6,
      supportedRecipes: 3,
      enumerated: 54,
      solved: 54,
      matchOutcomes: 54,
      matched: 54,
      checked: 54,
      estimated: 54,
      deduped: 54,
      pareto: 2,
      materialized: 54,
      coverageValidated: 54,
      rejected: 52,
    });
    for (const candidate of first.result.candidates) {
      expect(candidate.components).toHaveLength(8);
      expect(candidate.components.some((component) => component.id === "gate-resistor")).toBe(false);
      expect(candidate.components).toContainEqual(expect.objectContaining({
        id: "bootstrap-capacitor",
        quantityPerAssembly: 2,
        profileId: "packages/design-library/parts/shared.mlcc-capacitor/murata-manufacturing/GRM31CR61H106KA12L.json",
      }));
      expect(candidate.components).toContainEqual(expect.objectContaining({
        id: "local-decoupling",
        quantityPerAssembly: 1,
        profileId: "packages/design-library/parts/shared.mlcc-capacitor/murata-manufacturing/GRM31CR61H106KA12L.json",
      }));
      expect(candidate.components).toContainEqual(expect.objectContaining({
        id: "driver",
        quantityPerAssembly: 1,
        part: expect.objectContaining({ manufacturerPartNumber: "MIC4606-2YML-T5" }),
      }));
      expect(candidate.constraints).toContainEqual(expect.objectContaining({
        ruleId: "motor.external.gate-network",
        status: "unknown",
        evidence: expect.arrayContaining([expect.objectContaining({
          sourceId: "microchip-mic4606-ds20005604h",
          contentHash: "sha256:68f16441b44a35a2e768799e649bd832842727fd7d7f57a4cf80e193d6737135",
        })]),
      }));
      expect(candidate.constraints).toEqual(expect.arrayContaining([
        expect.objectContaining({ ruleId: "motor.external.bootstrap-capacitance-nominal", status: "pass" }),
        expect.objectContaining({ ruleId: "motor.external.local-capacitance-nominal", status: "pass" }),
        expect.objectContaining({ ruleId: "motor.external.bootstrap-capacitance", status: "unknown" }),
        expect.objectContaining({ ruleId: "motor.external.local-capacitance-effective", status: "unknown" }),
        expect.objectContaining({ ruleId: "motor.external.bulk-capacitance", status: "unknown" }),
        expect.objectContaining({ ruleId: "motor.external.capacitor-placement", status: "unknown" }),
        expect.objectContaining({ ruleId: "motor.external.driver-switch-node-operating-minimum", status: "pass" }),
        expect.objectContaining({ ruleId: "motor.external.driver-switch-node-operating-maximum", status: "pass" }),
        expect.objectContaining({ ruleId: "motor.external.driver-switch-node-absolute-maximum", status: "pass" }),
        expect.objectContaining({ ruleId: "motor.external.driver-bias-source", status: "unknown" }),
        expect.objectContaining({ ruleId: "motor.external.tvs-published-clamp-driver-switch-node-limit", status: "pass" }),
        expect.objectContaining({ ruleId: "motor.external.tvs-published-clamp-mosfet-limit", status: "pass" }),
        expect.objectContaining({ ruleId: "motor.external.tvs-stand-off", status: "unknown" }),
        expect.objectContaining({ ruleId: "motor.external.tvs-coordination", status: "unknown" }),
      ]));
    }
    expect(first.constraintDecision.candidates.every((candidate) => (
      candidate.rules.filter((rule) => rule.disposition === "satisfied").length === 9
      && candidate.rules.filter((rule) => rule.disposition !== "satisfied").length === 21
    ))).toBe(true);
    expect(JSON.stringify(first.result)).not.toContain("C1608X7R1H104K080AA");

    const html = renderImportedResult({
      result: first.result,
      trust: "production_constraint_observation",
      execution: first.execution,
      contextManifestContentHash: first.contextManifestContentHash,
      constraintDecision: first.constraintDecision,
    }, first.result.candidates[0]!.id, undefined, undefined, undefined, true);
    expect(html).toContain("2 structural observations");
    expect(html).toContain("0 eligible");
    expect(html).toContain("MIC4606-2YML-T5");
    expect(html).toContain("motor.external.gate-network");
    expect(html).not.toContain("No external-NMOS candidate was enumerated");
    expect(html).not.toContain("gate-resistor</th>");
    expect(html).toContain('data-production-export="electrical_bom_csv"');
    expect(html).not.toContain("data-primary-customization");
    expect(html).not.toContain("data-customized-target-export");
  }, 120_000);

  it("retains the reviewed Bel Power BOM only as an exact ineligible unknown-evidence observation", async () => {
    const power = designerApplications()[1]!;
    const request = power.presets[0]!.createRequest();
    expect(request).toMatchObject({
      schemaVersion: 2,
      application: "power.buck",
      libraryVersion: POWER_DESIGN_V2_PRODUCTION_STATUS.catalogVersion,
      requirements: {
        inputVoltage: {
          minimum: { value: 12, unit: "V" },
          maximum: { value: 12, unit: "V" },
        },
        dcOutputVoltageRegulation: {
          minimum: { value: 4.7, unit: "V" },
          maximum: { value: 5.3, unit: "V" },
        },
        maximumOutputCurrent: { value: 0.2, unit: "A" },
      },
      constraints: { allowUnknownHardConstraints: false },
    });
    const strict = await power.generate(structuredClone(request));
    if (!("kind" in strict)) throw new Error("Expected a verified Power generation");
    expect(strict.application).toBe("power.buck");
    expect(strict.contextManifestContentHash).toBe("sha256:7ef5a9f9f7e1724e253e81850adc64673154fcfd9668b9b476d4d15125dfcbd3");
    expect(strict.result.requestHash).toBe("sha256:30b8c0fac110f71ce3e71c9347afe725f2a1ad29aa4fdb6bfde8bc87cc73771c");
    expect(strict.result.contentHash).toBe("sha256:d3b7fed4eb2d5f5e862ed8dfafb629771f813b967fd166902c4bd51bc6aabef2");
    expect(strict.result.libraryVersion).toBe("2026-08-27.2");
    expect(strict.result.candidates).toEqual([]);
    expect(strict.referenceDesignEvidence).toMatchObject({
      kind: "power_reference_design_evidence",
      application: "power.buck",
      reference: {
        referenceDesignId: "TPS54302EVM-716",
        assemblyId: "PWR716-003",
        documentId: "SLVUAP9B",
      },
      requestAssessment: {
        identityState: "asserted_reference_identity_unattested",
        referenceObservationIdsAtRequestedConditions: [
          "power.reference.tps54302evm716.tested-operating-envelope",
          "power.reference.tps54302evm716.load-regulation",
        ],
        strictClosedRuleIds: [],
      },
      candidateAssessment: {
        identityState: "reference_identity_not_asserted",
        referenceObservationIdsAtRequestedConditions: [],
        strictClosedRuleIds: [],
      },
      bomComparison: {
        matchesInstalledCandidate: false,
        referenceDesign: {
          regulator: { manufacturerPartNumber: "TPS54302DDC" },
          inductor: { manufacturerPartNumber: "7447714100", nominalValue: "10uH" },
        },
        installedCandidate: {
          regulator: { manufacturerPartNumber: "TPS54302DDCR" },
          inductor: { manufacturerPartNumber: "F1F2-0804-100M", nominalValue: "10uH" },
        },
      },
      boundaries: {
        strictConstraintAuthority: false,
        physicalAssemblyQualificationAuthority: false,
        applicationAuthority: false,
        candidateEligibilityAuthority: false,
        externalNetworkLinkIncluded: false,
      },
    });
    expect(strict.referenceDesignEvidence?.requestAssessment.blockedRuleIds).toHaveLength(13);
    expect(JSON.stringify(strict.result)).not.toContain("power_reference_design_evidence");
    expect(JSON.stringify(strict.result)).not.toContain("TPS54302EVM-716");
    const strictReferenceHtml = renderPowerReferenceEvidence(strict.referenceDesignEvidence);
    expect(strictReferenceHtml).toContain("REFERENCE ONLY · NOT CANDIDATE EVIDENCE");
    expect(strictReferenceHtml).not.toMatch(/<a\b|href=|https?:\/\//u);
    expect(strict.execution.counts).toEqual({
      recipes: 4,
      supportedRecipes: 3,
      enumerated: 1,
      solved: 1,
      matchOutcomes: 1,
      matched: 1,
      checked: 1,
      estimated: 0,
      deduped: 0,
      pareto: 0,
      materialized: 0,
      coverageValidated: 0,
      rejected: 1,
    });
    expect(strict.execution.rejections).toEqual([
      expect.objectContaining({
        candidateId: "candidate:v2:sha256:88b7d52b012cd7edfda6ba8f5ef0611c7d2ffeff870614ccf9d0dea6f1ca679d",
        recipeId: "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified",
        stage: "check",
        reasonCode: "unknown_constraint_disallowed",
        constraints: expect.arrayContaining([
          expect.objectContaining({ ruleId: "power.regulator.current-limit", status: "unknown" }),
          expect.objectContaining({ ruleId: "power.inductor.saturation-current", status: "unknown" }),
          expect.objectContaining({ ruleId: "power.inductor.rms-current", status: "unknown" }),
        ]),
      }),
    ]);
    expect(strict.execution.rejections[0]!.constraints?.some((constraint) => constraint.status === "fail")).toBe(false);
    expect(verifiedProductionGeneration(strict, power)).toBe(strict);
    expect(isAuthorizedStrictPowerInspectionSource(strict, power)).toBe(true);
    const strictImported = {
      result: strict.result,
      trust: "production_context_verified" as const,
      execution: strict.execution,
      contextManifestContentHash: strict.contextManifestContentHash,
    };
    const strictHtml = renderImportedResult(strictImported, undefined);
    expect(strictHtml).toContain("Strict generation excluded the one exact-BOM Power option");
    expect(strictHtml).toContain("policy-ineligible structural observation");
    expect(strictHtml).toContain("no eligibility, selected-part simulation, provider, or sourcing authority");
    expect(strictHtml).toContain("unknown_constraint_disallowed");
    expect(strictHtml).not.toContain("Hard electrical failure");
    expect(strictHtml).not.toContain("data-production-export=");
    expect(strictHtml).not.toContain("data-production-schematic-preview");
    expect(strictHtml).not.toContain("data-power-evidence-inspection");
    const strictHtmlWithAuthorizedAction = renderImportedResult(
      strictImported,
      undefined,
      undefined,
      undefined,
      undefined,
      false,
      undefined,
      new Set(),
      "",
      false,
      false,
      "",
      "",
      true,
    );
    expect(strictHtmlWithAuthorizedAction).toContain("data-power-evidence-inspection");
    expect(strictHtmlWithAuthorizedAction).toContain("Inspect 1 evidence-limited design — unknown ≠ pass.");

    const estimatesBlockedRequest = structuredClone(request);
    estimatesBlockedRequest.constraints.allowUnknownHardConstraints = true;
    estimatesBlockedRequest.constraints.allowEstimatedValues = false;
    const estimatesBlocked = await power.generate(estimatesBlockedRequest);
    if (!("kind" in estimatesBlocked)) throw new Error("Expected an evidence-gated Power generation");
    if (estimatesBlocked.kind !== "production_constraint_observation") {
      throw new Error("Expected an evidence-gated Power constraint observation");
    }
    expect(estimatesBlocked.result.candidates).toEqual([]);
    expect(estimatesBlocked.execution.rejections).toEqual([
      expect.objectContaining({ reasonCode: "estimated_values_disallowed", stage: "estimate" }),
    ]);
    expect(isAuthorizedStrictPowerInspectionSource(estimatesBlocked, power)).toBe(true);
    const estimatesBlockedHtml = renderImportedResult(
      {
        result: estimatesBlocked.result,
        trust: "production_constraint_observation",
        execution: estimatesBlocked.execution,
        contextManifestContentHash: estimatesBlocked.contextManifestContentHash,
        constraintDecision: estimatesBlocked.constraintDecision,
      },
      undefined,
      undefined,
      undefined,
      undefined,
      false,
      undefined,
      new Set(),
      "",
      false,
      false,
      "",
      "",
      true,
    );
    expect(estimatesBlockedHtml).toContain("data-power-evidence-inspection");
    expect(estimatesBlockedHtml).toContain("Show reference solution");

    const permissive = structuredClone(request);
    permissive.constraints.allowUnknownHardConstraints = true;
    const first = await power.generate(permissive);
    const second = await power.generate(structuredClone(permissive));
    expect(first).toEqual(second);
    if (!("kind" in first) || first.kind !== "production_constraint_observation") {
      throw new Error("Expected an installed-policy Power observation");
    }
    expect(isAuthorizedStrictPowerInspectionSource(first, power)).toBe(false);
    expect(first.contextManifestContentHash).toBe("sha256:7ef5a9f9f7e1724e253e81850adc64673154fcfd9668b9b476d4d15125dfcbd3");
    expect(first.result.requestHash).toBe("sha256:f21a643aba1a3c8cb75d42ff2e69b4f12a25168becdb68fbf54f720649821cd4");
    expect(first.result.contentHash).toBe("sha256:8c95de1232f9bab1a133712379287b322f76f199461581a358eecf0666dd386a");
    expect(first.result.libraryVersion).toBe("2026-08-27.2");
    expect(first.referenceDesignEvidence).toEqual(strict.referenceDesignEvidence);
    expect(JSON.stringify(first.result)).not.toContain("power_reference_design_evidence");
    expect(JSON.stringify(first.constraintDecision)).not.toContain("power_reference_design_evidence");
    expect(first.constraintDecision.contentHash).toBe("sha256:91bc09b720b1bf152c69fa53fd015494ed6cd6d7430fcd909fb72734bd5d5a37");
    expect(first.constraintDecision.eligibleCandidateIds).toEqual([]);
    expect(first.constraintDecision.policy.contentHash).toBe(POWER_CONSTRAINT_POLICY_V3_PRODUCTION_STATUS.contentHash);
    expect(first.execution.counts).toEqual({
      recipes: 4,
      supportedRecipes: 3,
      enumerated: 1,
      solved: 1,
      matchOutcomes: 1,
      matched: 1,
      checked: 1,
      estimated: 1,
      deduped: 1,
      pareto: 1,
      materialized: 1,
      coverageValidated: 1,
      rejected: 0,
    });
    expect(first.execution.rejections).toEqual([]);
    expect(first.result.candidates).toHaveLength(1);
    const candidate = first.result.candidates[0]!;
    expect(candidate).toMatchObject({
      id: "candidate:v2:sha256:e6a4681fa38e5b47f8f59963924e9cd99b749932ba8052f68e34d96cef68035a",
      recipeId: "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified",
    });
    expect(candidate.components).toHaveLength(7);
    expect(candidate.components.find((component) => component.id === "power-inductor")).toMatchObject({
      part: { manufacturerId: "bel-fuse", manufacturerPartNumber: "F1F2-0804-100M" },
      profileId: "packages/design-library/parts/power.power-inductor/bel-fuse/F1F2-0804-100M.json",
      quantityPerAssembly: 1,
      value: { value: 0.00001, unit: "H" },
    });
    expect(candidate.components.find((component) => component.id === "output-capacitor")).toMatchObject({
      part: { manufacturerId: "murata-manufacturing", manufacturerPartNumber: "GRM32ER71E226KE15L" },
      profileId: "packages/design-library/parts/shared.mlcc-capacitor/murata-manufacturing/GRM32ER71E226KE15L.json",
      quantityPerAssembly: 2,
      value: { value: 0.000022, unit: "F" },
    });
    for (const circuitId of ["assembly", "ideal_pwm_output_stage"] as const) {
      const circuit = candidate.circuit.circuits.find((entry) => entry.id === circuitId);
      expect(circuit?.components.filter((component) => component.id.startsWith("output-capacitor-"))).toEqual([
        expect.objectContaining({ id: "output-capacitor-1", type: "capacitor", value: 0.000022, mpn: "GRM32ER71E226KE15L" }),
        expect.objectContaining({ id: "output-capacitor-2", type: "capacitor", value: 0.000022, mpn: "GRM32ER71E226KE15L" }),
      ]);
    }
    expect(candidate.circuitInstanceClassifications.filter((entry) => (
      "selectedComponentId" in entry && entry.selectedComponentId === "output-capacitor"
    ))).toEqual([
      expect.objectContaining({ circuitId: "assembly", componentId: "output-capacitor-1", representedQuantityPerAssembly: 1 }),
      expect.objectContaining({ circuitId: "assembly", componentId: "output-capacitor-2", representedQuantityPerAssembly: 1 }),
      expect.objectContaining({ circuitId: "ideal_pwm_output_stage", componentId: "output-capacitor-1", representedQuantityPerAssembly: 1 }),
      expect.objectContaining({ circuitId: "ideal_pwm_output_stage", componentId: "output-capacitor-2", representedQuantityPerAssembly: 1 }),
    ]);
    expect(candidate.metrics.values).toContainEqual(expect.objectContaining({
      id: "power.native.component-count",
      state: "calculated",
      value: { value: 8, unit: "count", displayUnit: "count" },
    }));
    expect(candidate.constraints.some((constraint) => constraint.status === "fail")).toBe(false);
    expect(candidate.constraints).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: "power.feedback.output-voltage", status: "pass" }),
      expect.objectContaining({ ruleId: "power.regulator.output-current", status: "unknown" }),
      expect.objectContaining({
        ruleId: "power.inductor.selected-value",
        status: "unknown",
        actual: { value: 0.00001, unit: "H", displayUnit: "H" },
        explanation: expect.stringContaining("nominal, typical/reference, or condition-mismatched"),
      }),
      expect.objectContaining({ ruleId: "power.inductor.saturation-current", status: "unknown" }),
      expect.objectContaining({ ruleId: "power.inductor.rms-current", status: "unknown" }),
      expect.objectContaining({
        ruleId: "power.passive.resistor-power-voltage",
        status: "pass",
        actual: { value: 4.5628739394, unit: "V", displayUnit: "V" },
        limit: { value: 75, unit: "V", displayUnit: "V" },
      }),
      expect.objectContaining({
        ruleId: "power.regulator.current-limit",
        status: "unknown",
        explanation: expect.stringContaining("1.00574712643 A peak-to-peak ripple"),
      }),
      expect.objectContaining({
        ruleId: "power.passive.capacitor-effective-capacitance",
        status: "unknown",
        explanation: expect.stringContaining("aggregate for 2 exact parallel BOM part(s)"),
      }),
      expect.objectContaining({ ruleId: "power.passive.bootstrap-effective-capacitance", status: "unknown" }),
      expect.objectContaining({ ruleId: "power.regulator.minimum-on-time", status: "unknown" }),
      expect.objectContaining({ ruleId: "power.regulator.minimum-off-time", status: "unknown" }),
      expect.objectContaining({ ruleId: "power.control.loop-stability", status: "unknown" }),
      expect.objectContaining({ ruleId: "power.request.output-ripple", status: "unknown" }),
      expect.objectContaining({ ruleId: "power.thermal.loss-model", status: "unknown" }),
      expect.objectContaining({ ruleId: "power.thermal.maximum-junction", status: "unknown" }),
    ]));
    expect(candidate.constraints.some((constraint) => constraint.ruleId === "power.request.load-transient")).toBe(false);
    expect(first.constraintDecision.candidates).toEqual([
      expect.objectContaining({
        candidateId: candidate.id,
        recipeId: candidate.recipeId,
        recipeContentHash: "sha256:c36cdcd96b25808fb913f152e211a6c08ac7f0bf675274f393bd00b31b2d3b1c",
        eligible: false,
        rules: expect.arrayContaining([
          expect.objectContaining({ ruleId: "power.regulator.current-limit", disposition: "blocked_unknown" }),
          expect.objectContaining({ ruleId: "power.inductor.saturation-current", disposition: "blocked_unknown" }),
          expect.objectContaining({ ruleId: "power.control.loop-stability", disposition: "blocked_unknown" }),
        ]),
      }),
    ]);
    const observedHtml = renderImportedResult({
      result: first.result,
      trust: "production_constraint_observation",
      execution: first.execution,
      contextManifestContentHash: first.contextManifestContentHash,
      constraintDecision: first.constraintDecision,
    }, candidate.id, undefined, undefined, undefined, true, {
      status: "ready",
      url: "blob:https://schemagic.test/ineligible-power-svg",
      filename: "ineligible-power.svg",
    }, new Set([candidate.id]), "", false, false, "", "", false, false, true);
    expect(observedHtml).toContain("1 structural observation");
    expect(observedHtml).toContain("Ineligible");
    expect(observedHtml).toContain("F1F2-0804-100M");
    expect(observedHtml).toContain("GRM32ER71E226KE15L");
    expect(observedHtml).toContain("data-production-export=");
    expect(observedHtml).toContain('data-production-export="physical_handoff_json"');
    expect(observedHtml).toContain("eight structural instances");
    expect(observedHtml).toContain("candidate-eligibility authority unavailable");
    expect(observedHtml).toContain("data-production-schematic-preview");
    expect(observedHtml).toContain("Simulation CSV");
    expect(observedHtml).toContain("Commercial export");
    expect(observedHtml).toContain("Open in Simulator");
    expect(observedHtml).not.toContain("Hard electrical failure");
    expect(observedHtml).not.toContain("hard_constraint_failed");

    if (!power.exportProductionArtifact) throw new Error("Expected a production export adapter");
    if (!power.primaryPartCustomization) throw new Error("Expected a Power customization adapter");
    expect(await power.primaryPartCustomization.listTargets(first, candidate.id)).toEqual([]);
    expect(power.primaryPartCustomization.authorizesCustomizedResult(candidate, first)).toBe(false);
    const staleHash = first.constraintDecision.policy.contentHash;
    const staleInstruction = createPrimaryPartCustomizationSidecarV1({
      format: "schemagic-designer-primary-part-customization",
      schemaVersion: 1,
      application: "power.buck",
      requestHash: first.result.requestHash,
      requestByteContentHash: designSha256ContentHash(
        canonicalElectricalDesignRequestV2Payload(first.result.request),
      ),
      sourceResultContentHash: first.result.contentHash,
      sourceCandidateId: candidate.id,
      context: {
        libraryVersion: first.result.libraryVersion,
        contextManifestContentHash: first.contextManifestContentHash as `sha256:${string}`,
        catalog: {
          version: first.result.libraryVersion,
          contentHash: staleHash,
          sourceReleaseContentHash: staleHash,
        },
        recipe: { id: candidate.recipeId, version: "3.4.5", contentHash: staleHash },
        constraintPolicy: { id: "production_strict_v1", contentHash: staleHash },
      },
      substitution: {
        role: "primary",
        sourceProfile: {
          profileId: "packages/design-library/parts/power.integrated-synchronous-buck-regulator/texas-instruments/TPS54302DDCR.json",
          contentHash: staleHash,
        },
        targetProfile: {
          profileId: "packages/design-library/parts/power.integrated-synchronous-buck-regulator/vendor/FORGED.json",
          contentHash: staleHash,
        },
      },
    });
    await expect(power.primaryPartCustomization.generate(first, staleInstruction)).rejects.toBeInstanceOf(Error);
    await expect(power.primaryPartCustomization.exportArtifact(
      first,
      candidate as never,
      "customized_target_electrical_bom_csv",
    )).rejects.toThrow("exact authorized customized result and source");
    const artifact = await power.exportProductionArtifact({
      result: first.result,
      candidateId: candidate.id,
      kind: "electrical_bom_csv",
      constraintDecision: first.constraintDecision,
    });
    expect(artifact.content).toContain("F1F2-0804-100M");
    expect(artifact.content).toContain("output-capacitor,output-capacitor,murata-manufacturing,GRM32ER71E226KE15L,packages/design-library/parts/shared.mlcc-capacitor/murata-manufacturing/GRM32ER71E226KE15L.json,2");
    expect(artifact.content).toContain("sha256:c36cdcd96b25808fb913f152e211a6c08ac7f0bf675274f393bd00b31b2d3b1c");
    expect(artifact.content).toContain(first.constraintDecision.contentHash);
    expect(artifact.content).toContain("ineligible");
    const physicalHandoff = await power.exportProductionArtifact({
      result: first.result,
      candidateId: candidate.id,
      kind: "physical_handoff_json",
    });
    expect(physicalHandoff).toMatchObject({
      kind: "physical_handoff_json",
      mimeType: "application/json;charset=utf-8",
    });
    expect(physicalHandoff.filename).toMatch(
      /^schemagic-power-buck-[0-9a-f]{12}-physical-implementation-handoff-v2\.json$/u,
    );
    expect(JSON.parse(physicalHandoff.content)).toMatchObject({
      format: "schemagic-power-physical-implementation-handoff",
      schemaVersion: 2,
      artifactKind: "physical_implementation_handoff",
      scope: {
        application: "power.buck",
        attestation: "none",
        physicalFidelityClaim: "none",
        candidateEligibilityAuthority: "none",
        simulationFidelityClaim: "none",
        manufacturingOutputClaim: "none",
      },
      provenance: {
        designResult: { contentHash: first.result.contentHash },
        candidate: {
          id: candidate.id,
          recipeId: candidate.recipeId,
          recipeVersion: "3.4.6",
        },
        selectedBom: { lineCount: 7, physicalInstanceCount: 8 },
      },
      implementation: {
        state: "unavailable",
        footprintAssignedKicadSchematic: { state: "not_emitted", contentHash: null },
        placement: {
          state: "not_emitted",
          routing: "unrouted",
          verification: "unverified",
          contentHash: null,
        },
      },
      contentHash: "sha256:1cde50595ebed875cb5f77e8c7a449bd3e1be2355a9dcbc150dbe6e972d28af8",
    });
  }, 60_000);
});
