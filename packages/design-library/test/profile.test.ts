import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Quantity } from "@opencircuit/design-schema";
import { describe, expect, it } from "vitest";
import {
  PART_CLASS_IDS,
  PART_CLASS_SPECS,
  canonicalDesignProfile,
  decodeMpnPathToken,
  designProfileContentHash,
  designProfilePath,
  encodeMpnPathToken,
  migrateDesignProfile,
  validateCommercialDataBoundary,
  validateDesignProfile,
  validateDesignProfileAdmission,
  validateFactsForCodec,
  validateManufacturerRegistry,
  validateProfileAdmissionRules,
  type DesignProfileAdmissionLedgerV1,
  type ManufacturerRegistryV1,
  type ProfileQuantity,
} from "../src";
import { SYNTHETIC_MANUFACTURER_HOST, SYNTHETIC_MANUFACTURER_REGISTRY, createSyntheticReviewedProfile } from "../src/fixtures";

function json(path: string): unknown {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
}

describe("design profile contracts", () => {
  it("covers all twelve manifest classes with closed, valid synthetic profiles", () => {
    for (const [index, partClass] of PART_CLASS_IDS.entries()) {
      const profile = createSyntheticReviewedProfile(partClass, index + 1);
      expect(validateDesignProfile(profile, SYNTHETIC_MANUFACTURER_REGISTRY), partClass).toEqual([]);
      expect(migrateDesignProfile(profile, SYNTHETIC_MANUFACTURER_REGISTRY)).toEqual(profile);
      expect(migrateDesignProfile(profile, SYNTHETIC_MANUFACTURER_REGISTRY)).not.toBe(profile);
    }
    const future = structuredClone(createSyntheticReviewedProfile("shared.switching-diode")) as any;
    future.partClass = "shared.future-device";
    future.factsSchemaVersion = "2.0.0";
    expect(validateDesignProfile(future, SYNTHETIC_MANUFACTURER_REGISTRY).map((entry) => entry.code))
      .toEqual(expect.arrayContaining(["invalid_part_class", "invalid_facts_version"]));
    expect(() => migrateDesignProfile(future, SYNTHETIC_MANUFACTURER_REGISTRY)).toThrow();
  });

  it("uses browser-safe canonical SHA-256 and stable object-key ordering", () => {
    const profile = createSyntheticReviewedProfile("shared.n-channel-power-mosfet");
    const canonical = canonicalDesignProfile(profile);
    const nodeHash = `sha256:${createHash("sha256").update(canonical, "utf8").digest("hex")}`;
    expect(designProfileContentHash(profile)).toBe(nodeHash);
    const reordered = {
      facts: profile.facts,
      commonFacts: profile.commonFacts,
      factsSchemaVersion: profile.factsSchemaVersion,
      part: profile.part,
      partClass: profile.partClass,
      schemaVersion: profile.schemaVersion,
      format: profile.format,
    } as typeof profile;
    expect(designProfileContentHash(reordered)).toBe(designProfileContentHash(profile));
  });

  it("requires exact registered manufacturer hosts for manufacturer evidence", () => {
    const source = createSyntheticReviewedProfile("shared.n-channel-power-mosfet");
    const registry: ManufacturerRegistryV1 = {
      ...SYNTHETIC_MANUFACTURER_REGISTRY,
      manufacturers: [
        { manufacturerId: "other-manufacturer", displayName: "Other Synthetic", primaryEvidenceHosts: ["other.example.invalid"] },
        ...SYNTHETIC_MANUFACTURER_REGISTRY.manufacturers,
      ],
    };
    expect(validateManufacturerRegistry(registry)).toEqual([]);
    const evidence = source.facts.onResistance.evidence[0]!;
    if (evidence.kind === "synthetic_fixture") throw new Error("Reviewed fixture unexpectedly used synthetic adapter evidence");
    for (const host of ["www.digikey.com", "www.mouser.com", "www.lcsc.com", "www.arrow.com", "uk.farnell.com", "other.example.invalid", `docs.${SYNTHETIC_MANUFACTURER_HOST}`, `${SYNTHETIC_MANUFACTURER_HOST}.example.invalid`]) {
      const profile = structuredClone(source);
      profile.facts.onResistance.evidence[0] = { ...evidence, url: `https://${host}/document` };
      expect(validateDesignProfile(profile, registry).map((entry) => entry.code), host).toContain("non_manufacturer_host");
    }
    expect(validateDesignProfile(source, registry)).toEqual([]);
    const datasheet = structuredClone(source);
    datasheet.facts.onResistance.evidence[0]!.kind = "manufacturer_datasheet";
    expect(validateDesignProfile(datasheet, registry)).toEqual([]);

    const laundered = structuredClone(source);
    laundered.facts.onResistance.evidence[0] = {
      ...laundered.facts.onResistance.evidence[0]!, kind: "independent_measurement",
      publicationBasis: "original_measurement", url: "https://www.digikey.com/en/products/detail/fake",
    } as any;
    expect(validateDesignProfile(laundered, registry).map((entry) => entry.code)).toEqual(expect.arrayContaining(["commercial_evidence_host", "untrusted_independent_host"]));

    const trustedIndependent = structuredClone(source);
    trustedIndependent.facts.onResistance.evidence[0] = {
      ...trustedIndependent.facts.onResistance.evidence[0]!, kind: "independent_measurement",
      publicationBasis: "original_measurement", url: "https://zenodo.org/records/1234",
    } as any;
    expect(validateDesignProfile(trustedIndependent, registry)).toEqual([]);
  });

  it("rejects unknown and commercial/provider keys recursively without rejecting provenance", () => {
    const profile = structuredClone(createSyntheticReviewedProfile("shared.n-channel-power-mosfet")) as unknown as Record<string, any>;
    profile.offerSnapshot = { id: "forbidden" };
    profile.commonFacts.boardArea.value.currency = "USD";
    profile.facts.onResistance.rawProviderResponse = { value: "forbidden" };
    profile.facts.onResistance.evidence[0].apiKey = "forbidden";
    profile.facts.totalGateCharge.providerPolicy = { terms: true };
    const issues = validateDesignProfile(profile, SYNTHETIC_MANUFACTURER_REGISTRY);
    expect(issues.map((entry) => entry.path)).toEqual(expect.arrayContaining([
      "offerSnapshot",
      "commonFacts.boardArea.value.currency",
      "facts.onResistance.rawProviderResponse",
      "facts.onResistance.evidence.0.apiKey",
      "facts.totalGateCharge.providerPolicy",
    ]));
    const clean = createSyntheticReviewedProfile("shared.n-channel-power-mosfet");
    expect(validateCommercialDataBoundary(clean)).toEqual([]);
    expect(clean.facts.onResistance.evidence[0]).toMatchObject({ retrievedAt: expect.any(String), contentHash: expect.stringMatching(/^sha256:/), publicationBasis: "public_facts" });
    expect(() => migrateDesignProfile(profile, SYNTHETIC_MANUFACTURER_REGISTRY)).toThrow(/commercial|unknown/i);

    const forbiddenKeys = [
      "providerId", "distributor_sku", "currency", "lifecycleStatus", "leadTimeKind", "marketplace",
      "backorderAvailable", "snapshotExpiresAt", "snapshotErrors", "providerAttribution", "cacheTTL",
      "persistencePolicy", "exportAuthorization", "authorizationPolicy", "providerTerms", "credentials", "rawData",
      "supplierReference", "unit_price", "availableQuantity", "factoryLeadDays", "minimumOrderQuantity",
      "offer_snapshot_id", "snapshotExpiresOn", "dataCacheTtlSeconds", "termsOfService", "authorization_header",
      "raw_api_response", "providerResponsePayload", "providerSkuCode",
      "sellerId", "quoteId", "fulfillmentMode", "shipDays",
      "vendorId", "merchantId", "minOrderQty", "minimumPurchaseQuantity", "orderQtyMinimum",
      "deliveryEstimate", "supplyStatus", "supplyChainRisk", "eolStatus", "lastBuyDate",
      "factoryLeadWeeks", "retrievalFailure", "oauthToken", "oauthClientSecret",
      "minimum_order_qty", "orderMinimum", "minimumBuyQuantity", "retrievalFailed",
      "requestPayload", "apiResponse", "responseBody", "requestBody", "orderable",
      "availableQty", "quantityAvailable", "minimumQuantity", "buyNowUrl",
    ];
    for (const key of forbiddenKeys) {
      const nested = { permittedContainer: [{ deeper: { [key]: "forbidden" } }] };
      expect(validateCommercialDataBoundary(nested).map((entry) => entry.path), key)
        .toContain(`permittedContainer.0.deeper.${key}`);
    }

    const categorized = validateCommercialDataBoundary({
      distributorId: "d", unitPrice: 1, snapshotExpiresOn: "x", termsOfUse: "x", apiToken: "x", rawProviderPayload: {},
      evidence: clean.facts.onResistance.evidence,
    });
    expect(new Set(categorized.map((entry) => entry.category))).toEqual(new Set([
      "provider_identity", "offer_state", "snapshot_state", "policy_or_terms", "secret_or_authorization", "raw_provider_payload",
    ]));
    expect(categorized.map((entry) => entry.path)).not.toEqual(expect.arrayContaining(["evidence.0.retrievedAt", "evidence.0.contentHash"]));
    expect(validateCommercialDataBoundary({ supplyVoltage: 24, supplyMinimum: 5 })).toEqual([]);

    const codecFacts = structuredClone(clean.facts) as Record<string, any>;
    codecFacts.onResistance.providerId = "forbidden";
    expect(validateFactsForCodec(codecFacts, clean.partClass).map((entry) => entry.code))
      .toContain("commercial_boundary_violation");
  });

  it("rejects unknown keys at every persisted profile and admission depth without throwing", () => {
    const profile = structuredClone(createSyntheticReviewedProfile("shared.n-channel-power-mosfet")) as any;
    profile.extraRoot = true;
    profile.part.extraIdentity = true;
    profile.commonFacts.extraCommon = true;
    profile.facts.extraClassFact = true;
    profile.facts.onResistance.extraFactWrapper = true;
    profile.facts.onResistance.value.extraQuantity = true;
    profile.facts.onResistance.validFor = [{
      parameterId: "gateVoltage",
      minimum: { value: 5, unit: "V", displayUnit: "V", extraRangeQuantity: true },
      maximum: null,
      evidence: [{ ...profile.facts.onResistance.evidence[0], extraRangeEvidence: true }],
      extraRange: true,
    }];
    profile.facts.onResistance.evidence[0].extraEvidence = true;
    const paths = validateDesignProfile(profile, SYNTHETIC_MANUFACTURER_REGISTRY)
      .filter((entry) => entry.code === "unknown_key")
      .map((entry) => entry.path);
    expect(paths).toEqual(expect.arrayContaining([
      "extraRoot", "part.extraIdentity", "commonFacts.extraCommon", "facts.extraClassFact",
      "facts.onResistance.extraFactWrapper", "facts.onResistance.value.extraQuantity",
      "facts.onResistance.validFor.0.extraRange", "facts.onResistance.validFor.0.minimum.extraRangeQuantity",
      "facts.onResistance.validFor.0.evidence.0.extraRangeEvidence", "facts.onResistance.evidence.0.extraEvidence",
    ]));

    const admission = structuredClone(json("../admission.json")) as any;
    admission.entries[0].extraAdmission = true;
    admission.entries[0].checks = [{ checkId: "synthetic.check", status: "not_run", extraCheck: true }];
    expect(() => validateDesignProfileAdmission(admission)).not.toThrow();
    expect(validateDesignProfileAdmission(admission).filter((entry) => entry.code === "unknown_key").map((entry) => entry.path))
      .toEqual(expect.arrayContaining(["entries.0.extraAdmission", "entries.0.checks.0.extraCheck"]));

    admission.entries[0].part = null;
    admission.entries[0].profilePath = null;
    expect(() => validateDesignProfileAdmission(admission)).not.toThrow();
    expect(validateDesignProfileAdmission(admission).length).toBeGreaterThan(0);
  });

  it("validates exact units for values and operating ranges", () => {
    const profile = structuredClone(createSyntheticReviewedProfile("shared.n-channel-power-mosfet"));
    const evidence = profile.facts.onResistance.evidence;
    const gateRange = profile.facts.onResistance.validFor.find((range) => range.parameterId === "gateVoltage")!;
    gateRange.minimum = { value: 5, unit: "V", displayUnit: "V" };
    gateRange.maximum = { value: 10, unit: "V", displayUnit: "V" };
    gateRange.evidence = evidence;
    expect(validateDesignProfile(profile, SYNTHETIC_MANUFACTURER_REGISTRY)).toEqual([]);
    gateRange.minimum.unit = "A" as "V";
    expect(validateDesignProfile(profile, SYNTHETIC_MANUFACTURER_REGISTRY).map((entry) => entry.code)).toContain("unit_mismatch");
    (profile.facts.onResistance.value as ProfileQuantity).unit = "kg" as never;
    expect(validateDesignProfile(profile, SYNTHETIC_MANUFACTURER_REGISTRY).map((entry) => entry.code)).toContain("invalid_profile_unit");

    const profileOnlyCharge: ProfileQuantity<"C"> = { value: 1e-9, unit: "C", displayUnit: "nC" };
    // @ts-expect-error Profile-only units cannot enter design-schema quantities without an explicit conversion.
    const requestQuantity: Quantity = profileOnlyCharge;
    expect(requestQuantity.unit).toBe("C");
  });

  it("enforces per-fact physical domains while allowing signed TCR", () => {
    const ratio = createSyntheticReviewedProfile("shared.general-purpose-resistor");
    ratio.facts.tolerance.value!.value = 1.001;
    expect(validateDesignProfile(ratio, SYNTHETIC_MANUFACTURER_REGISTRY)).toContainEqual(expect.objectContaining({ code: "quantity_above_maximum" }));
    const rating = createSyntheticReviewedProfile("shared.switching-diode");
    rating.facts.reverseVoltage.value!.value = 0;
    expect(validateDesignProfile(rating, SYNTHETIC_MANUFACTURER_REGISTRY)).toContainEqual(expect.objectContaining({ code: "quantity_not_positive" }));
    const tcr = createSyntheticReviewedProfile("shared.current-sense-resistor");
    tcr.facts.temperatureCoefficient.value!.value = -0.0004;
    expect(validateDesignProfile(tcr, SYNTHETIC_MANUFACTURER_REGISTRY)).toEqual([]);
  });

  it("models external controllers as device capabilities with explicit alternative drive evidence", () => {
    const factIds = Object.keys(PART_CLASS_SPECS["power.external-fet-synchronous-buck-controller"].facts);
    expect(factIds).not.toEqual(expect.arrayContaining(["outputCurrentMaximum", "currentLimit"]));
    expect(factIds).toEqual(expect.arrayContaining([
      "currentSenseThresholdMinimum", "currentSenseThresholdTypical", "currentSenseThresholdMaximum",
      "gateSourceCurrent", "gateSinkCurrent", "gatePullupResistance", "gatePulldownResistance",
    ]));
    const controller = createSyntheticReviewedProfile("power.external-fet-synchronous-buck-controller");
    const controllerFacts = controller.facts as any;
    controllerFacts.gateSourceCurrent = { value: null, state: "unknown", evidence: [], validFor: [], explanation: "Current not specified; resistance is reviewed." };
    controllerFacts.gateSinkCurrent = { value: null, state: "unknown", evidence: [], validFor: [], explanation: "Current not specified; resistance is reviewed." };
    expect(validateProfileAdmissionRules(controller)).toEqual([]);
    controllerFacts.gatePullupResistance = { value: null, state: "unknown", evidence: [], validFor: [], explanation: "No source capability." };
    expect(validateProfileAdmissionRules(controller)).toContainEqual(expect.objectContaining({ code: "missing_gate_source_capability" }));
  });

  it("keeps missing facts explicit and never treats unsupported evidence states as values", () => {
    const missingEvidence = structuredClone(createSyntheticReviewedProfile("shared.general-purpose-resistor"));
    missingEvidence.facts.resistance.evidence = [];
    expect(validateDesignProfile(missingEvidence, SYNTHETIC_MANUFACTURER_REGISTRY)).toContainEqual(expect.objectContaining({
      path: "facts.resistance.evidence",
      code: "missing_evidence",
    }));

    const falseUnknown = structuredClone(createSyntheticReviewedProfile("shared.n-channel-power-mosfet"));
    falseUnknown.facts.onResistance.state = "unknown";
    expect(validateDesignProfile(falseUnknown, SYNTHETIC_MANUFACTURER_REGISTRY).map((entry) => entry.code))
      .toEqual(expect.arrayContaining(["unknown_has_value", "unknown_has_evidence", "unknown_has_range"]));
  });

  it("uses reversible exact-MPN paths and catches case-folded collisions", () => {
    const mpn = "ABC/é. 100%\\X";
    const token = encodeMpnPathToken(mpn);
    expect(token).not.toMatch(/[/. \\]/);
    expect(decodeMpnPathToken(token)).toBe(mpn);
    expect(designProfilePath("shared.general-purpose-resistor", { manufacturerId: "maker", manufacturerPartNumber: mpn })).toContain(token);
    const ledger = structuredClone(json("../admission.json")) as DesignProfileAdmissionLedgerV1;
    const first = ledger.entries[0]!;
    const upper = { ...structuredClone(first), part: { ...first.part, manufacturerPartNumber: "CASE" }, profilePath: designProfilePath(first.partClass, { ...first.part, manufacturerPartNumber: "CASE" }) };
    const lower = { ...structuredClone(first), part: { ...first.part, manufacturerPartNumber: "case" }, profilePath: designProfilePath(first.partClass, { ...first.part, manufacturerPartNumber: "case" }) };
    ledger.entries = [upper, lower];
    expect(validateDesignProfileAdmission(ledger).map((entry) => entry.code)).toContain("case_folded_path_collision");

    const sharedMpnA = { ...structuredClone(first), part: { manufacturerId: "maker-a", manufacturerPartNumber: "SHARED-MPN" } };
    sharedMpnA.profilePath = designProfilePath(sharedMpnA.partClass, sharedMpnA.part);
    const sharedMpnB = { ...structuredClone(first), part: { manufacturerId: "maker-b", manufacturerPartNumber: "SHARED-MPN" } };
    sharedMpnB.profilePath = designProfilePath(sharedMpnB.partClass, sharedMpnB.part);
    ledger.entries = [sharedMpnA, sharedMpnB].sort((left, right) => left.profilePath < right.profilePath ? -1 : 1);
    expect(validateDesignProfileAdmission(ledger)).toEqual([]);
  });

  it("tracks reviewed and independently reviewing shared profiles alongside real research ownership", () => {
    const registry = json("../manufacturers.json") as ManufacturerRegistryV1;
    const admission = json("../admission.json") as DesignProfileAdmissionLedgerV1;
    expect(validateManufacturerRegistry(registry)).toEqual([]);
    expect(validateDesignProfileAdmission(admission)).toEqual([]);
    expect(registry.manufacturers.some((entry) => entry.manufacturerId === "vishay-intertechnology")).toBe(true);
    expect(admission.entries.filter((entry) => entry.state === "reviewed").map((entry) => entry.part.manufacturerPartNumber)).toEqual([
      "MIC4606-2YML-T5",
      "STSPIN840",
      "DRV8262DDVR",
      "DRV8876PWPR",
      "PTVS10-058C-SH",
      "3.0SMCJ33CAQ",
      "TPS54302DDCR",
      "F1F2-0804-100M",
      "F1F2-0804-2R2M",
      "LQM18PN2R2MGHD",
      "UCM1V331MNS1GS",
      "EEHZS1V331V",
      "CRA2512-FZ-R020ELF",
      "CR0603-FX-1003ELF",
      "ERJ3EKF1003V",
      "CRCW0603100KFKEA",
      "CRCW0603732KFKEA",
      "GRM31CR61H106KA12L",
      "GRM32ER71E226KE15L",
      "CL31A106KBHNNNE",
      "C1608X7R1H104K080AA",
      "C3216X7R1H106K160AC",
      "CSD18540Q5B",
      "1N4148W-7-F",
    ]);
    expect(admission.entries.filter((entry) => entry.state === "authored").map((entry) => entry.part.manufacturerPartNumber)).toEqual([
      "NCP1599MNTWG",
      "XAL7030-472MEC",
      "1N4148-TAP",
    ]);
    expect(admission.entries.filter((entry) => entry.state === "in_independent_review")).toEqual([]);
    expect(admission.entries.filter((entry) => entry.state === "researching")).toHaveLength(9);
    expect(admission.entries.find((entry) => entry.part.manufacturerPartNumber === "LM70880RRXR")).toMatchObject({
      state: "researching",
      authoredBy: null,
      authoredAt: null,
      reviewedBy: null,
      reviewedAt: null,
      profileContentHash: null,
      checks: expect.arrayContaining([expect.objectContaining({ checkId: "review.independent", status: "not_run" })]),
    });
    expect(admission.entries.filter((entry) => entry.state === "researching" && entry.ownerTrack === "integration-data-review")
      .map((entry) => entry.part.manufacturerPartNumber)).toEqual([]);
  });

  it("keeps the authored 1N4148 profile hash-pinned but blocked on mounted geometry", () => {
    const registry = json("../manufacturers.json") as ManufacturerRegistryV1;
    const admission = json("../admission.json") as DesignProfileAdmissionLedgerV1;
    const profile = json("../parts/shared.switching-diode/vishay-intertechnology/1N4148-TAP.json") as any;
    const entry = admission.entries.find((candidate) => candidate.part.manufacturerPartNumber === "1N4148-TAP")!;
    expect(validateDesignProfile(profile, registry)).toEqual([]);
    expect(designProfileContentHash(profile)).toBe(entry.profileContentHash);
    expect(validateProfileAdmissionRules(profile)).toEqual([
      expect.objectContaining({ path: "commonFacts.boardArea.state", code: "not_reviewed" }),
      expect.objectContaining({ path: "commonFacts.maximumHeight.state", code: "not_reviewed" }),
    ]);
    expect(entry.state).toBe("authored");
  });
});
