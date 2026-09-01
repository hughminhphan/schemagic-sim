import type { EvidenceRef } from "@opencircuit/design-schema";
import type {
  ReviewedFact,
  ReviewedGateDriverProfile,
  ReviewedIntegratedBridgeProfile,
  ReviewedRealMotorCatalog,
} from "./types";
import { REVIEWED_REAL_MANUFACTURER_ALLOWLIST } from "./manufacturer-allowlist";

export const REVIEWED_REAL_RETRIEVED_AT = "2026-08-23T00:00:00+10:00";
export const REVIEWED_REAL_LICENSE_NOTE =
  "Manufacturer-published factual data referenced by URL; source document is not redistributed and no vendor model is copied.";

const TI_DRV8876_DATASHEET = "https://ti.com/lit/gpn/drv8876";
const TI_DRV8876_PRODUCT = "https://www.ti.com/product/DRV8876";
const TI_DRV8262_DATASHEET = "https://www.ti.com/lit/ds/symlink/drv8262.pdf";
const TI_DRV8262_PRODUCT = "https://www.ti.com/product/DRV8262/part-details/DRV8262DDVR";
const ST_STSPIN840_DATASHEET = "https://st.com/resource/en/datasheet/stspin840.pdf";
const ST_STSPIN840_PRODUCT = "https://st.com/en/motor-drivers/stspin840.html";
const TOSHIBA_TB67H450_DATASHEET = "https://toshiba.semicon-storage.com/info/docget.jsp?did=70454&prodName=TB67H450AFNG";
const TOSHIBA_TB67H450_PRODUCT = "https://toshiba.semicon-storage.com/us/semiconductor/product/motor-driver-ics/brushed-dc-motor-driver-ics/detail.TB67H450AFNG.html";
const TI_DRV8701_DATASHEET = "https://ti.com/lit/gpn/DRV8701";
const TI_DRV8701_PRODUCT = "https://www.ti.com/product/DRV8701";
const ALLEGRO_A3941_DATASHEET = "https://allegromicro.com/-/media/files/datasheets/a3941-datasheet.pdf";
const ALLEGRO_A3941_PRODUCT = "https://www.allegromicro.com/en/products/motor-drivers/brush-dc-motor-drivers/a3941";
const RENESAS_HIP4081A_DATASHEET = "https://renesas.com/en/document/dst/hip4081a-datasheet";
const RENESAS_HIP4081A_PRODUCT = "https://www.renesas.com/en/products/hip4081a/part-details/hip4081aibz";

const HASHES = {
  drv8876: "sha256:b3deb54e918251d4583c0f12f96b780a7f4f4818fd213c65b6cbacac3e2bc032",
  drv8876Product: "sha256:091aa8369100e0d25bcdd257ae41aafa347bede408f3e7f682655b3384592385",
  drv8262: "sha256:f07b6126ffab94c7b13a46ce0b758c85e6fa58068bf407480f7a0b954ddc32a7",
  drv8262Product: "sha256:a5f93a944c2f8f2537476863b1c5d62539146edc3b97e7c641fa8f79d3c8a460",
  stspin840: "sha256:d2e0f820b7faf997987de18df0fe89bf83b7dc8c35a6a18856a961f8682e06ef",
  stspin840Product: "sha256:a5f3c0d2a4f85da62370b2b8aff698312e9d104f8bd09a0611d239542d5e91f7",
  tb67h450: "sha256:c9de0164daa21afcc598331e91ef33f661238bbde9bfd53a48cba9a796474d98",
  tb67h450Product: "sha256:d246dcf24e9718f480f2f19bdd381c8e5a49044b461ec23266901dc98fe0f5e3",
  drv8701: "sha256:8f211bc6b6a0ae77fb7956a0a809644aa502a7095ab228425cc63fe4e5ffba3c",
  drv8701Product: "sha256:bcdb32694a97221ce40ba1c157550e35efcd521ec04f10a150a3772c90912439",
  a3941: "sha256:86adffc26c22cd8a2ecea15ea1ce65bc617327c5d3bac7c669be2168c535cbe6",
  a3941Product: "sha256:95a90198d75e9082c6e5051a532ab653ebcc863ca4d1679fa6bd39c7ca547dfb",
  hip4081a: "sha256:9712192314428f328145659674cafe4b8a58cbce7ca93da50d2ff27e74d685b5",
  hip4081aProduct: "sha256:ee1bc323fdf9c25222d0434b04bef0e4780a256778aa5cc4a82755ef8b44924e",
} as const;

function source(sourceId: string, locator: string, contentHash?: string, retrievedAt = REVIEWED_REAL_RETRIEVED_AT): EvidenceRef {
  return {
    sourceId,
    locator,
    retrievedAt,
    ...(contentHash === undefined ? {} : { contentHash }),
    licenseNote: REVIEWED_REAL_LICENSE_NOTE,
  };
}

function reviewed<T extends number | string>(value: T, explanation: string, ...evidence: EvidenceRef[]): ReviewedFact<T> {
  return { value, state: "reviewed", evidence, explanation };
}

function unknown<T extends number | string = number | string>(explanation: string): ReviewedFact<T> {
  return { value: null, state: "unknown", evidence: [], explanation };
}

const status = {
  provenanceState: "authored_from_primary_sources",
  catalogAdmission: "pending_independent_review",
  ownerTrack: "motor",
  authoredAt: REVIEWED_REAL_RETRIEVED_AT,
  note: "Track A authored this transcription from primary sources; exact-MPN ownership is reserved and exact source hashes are captured, while normalized profile authoring, independent evidence review, and catalog admission remain pending.",
} as const;

const drv8876Data = (locator: string) => source(TI_DRV8876_DATASHEET, `DRV8876 datasheet SLVSDS7B, ${locator}`, HASHES.drv8876);
const drv8876Product = (locator: string) => source(TI_DRV8876_PRODUCT, locator, HASHES.drv8876Product, "2026-08-24T11:12:26+10:00");
const drv8262Data = (locator: string) => source(TI_DRV8262_DATASHEET, `DRV8262 datasheet SLVSFV5C, ${locator}`, HASHES.drv8262, "2026-08-25T20:30:52Z");
const drv8262Product = (locator: string) => source(TI_DRV8262_PRODUCT, locator, HASHES.drv8262Product, "2026-08-25T20:30:52Z");
const stspin840Data = (locator: string) => source(ST_STSPIN840_DATASHEET, `STSPIN840 datasheet DocID031835 Rev 1, ${locator}`, HASHES.stspin840, "2026-08-24T02:35:30.683Z");
const stspin840Product = (locator: string) => source(ST_STSPIN840_PRODUCT, locator, HASHES.stspin840Product, "2026-08-24T02:35:30.683Z");
const tb67h450Data = (locator: string) => source(TOSHIBA_TB67H450_DATASHEET, `TB67H450AFNG datasheet Rev 2.0.A, ${locator}`, HASHES.tb67h450);
const tb67h450Product = (locator: string) => source(TOSHIBA_TB67H450_PRODUCT, locator, HASHES.tb67h450Product, "2026-08-24T11:14:15+10:00");
const drv8701Data = (locator: string) => source(TI_DRV8701_DATASHEET, `DRV8701 datasheet SLVSCX5B, ${locator}`, HASHES.drv8701);
const drv8701Product = (locator: string) => source(TI_DRV8701_PRODUCT, locator, HASHES.drv8701Product, "2026-08-24T11:12:52+10:00");
const a3941Data = (locator: string) => source(ALLEGRO_A3941_DATASHEET, `A3941 datasheet 3941-DS Rev 8, ${locator}`, HASHES.a3941);
const a3941Product = (locator: string) => source(ALLEGRO_A3941_PRODUCT, locator, HASHES.a3941Product, "2026-08-24T11:14:47+10:00");
const hip4081aData = (locator: string) => source(RENESAS_HIP4081A_DATASHEET, `HIP4081A datasheet FN3659 Rev 8, ${locator}`, HASHES.hip4081a);
const hip4081aProduct = (locator: string) => source(RENESAS_HIP4081A_PRODUCT, locator, HASHES.hip4081aProduct, "2026-08-24T11:15:09+10:00");

const drv8876: ReviewedIntegratedBridgeProfile = {
  id: "motor.real.integrated.ti-drv8876pwpr",
  kind: "integrated_bridge",
  part: { manufacturerId: "texas-instruments", manufacturerPartNumber: "DRV8876PWPR" },
  identityEvidence: [drv8876Product("DRV8876PWPR official product page, package and orderable-part identity")],
  package: {
    name: reviewed("HTSSOP-16 PowerPAD (PWP)", "Exact orderable package.", drv8876Product("DRV8876PWPR official product page, package PWP and 16 pins")),
    bodyAreaM2: reviewed(32e-6, "Nominal 5 mm by 6.4 mm package body area.", drv8876Product("DRV8876PWPR official product page, package size 5 mm x 6.4 mm")),
  },
  authorship: status,
  facts: {
    bridgeTopology: reviewed("full_bridge", "Single brushed-DC full H-bridge.", drv8876Data("page 1, Features")),
    powerStage: reviewed("integrated_fet", "Four integrated N-channel MOSFETs.", drv8876Data("page 1, Features")),
    supplyMinimumV: reviewed(4.5, "Recommended motor-supply minimum.", drv8876Data("page 4, Table 6-3 Recommended Operating Conditions")),
    supplyMaximumV: reviewed(37, "Recommended motor-supply maximum.", drv8876Data("page 4, Table 6-3 Recommended Operating Conditions")),
    absoluteMaximumV: reviewed(40, "Absolute VM maximum; not an operating rating.", drv8876Data("page 4, Table 6-1 Absolute Maximum Ratings")),
    continuousCurrentA: unknown("No package-independent continuous motor-current rating was established; thermal design controls it."),
    peakCurrentA: reviewed(3.5, "Recommended peak output current.", drv8876Data("page 4, Table 6-3 Recommended Operating Conditions")),
    currentLimitMinimumA: unknown("The usable current-limit range depends on configuration and external sensing; no closed catalog limit is admitted."),
    currentLimitMaximumA: unknown("The usable current-limit range depends on configuration and external sensing; no closed catalog limit is admitted."),
    logicHighThresholdMaximumV: reviewed(1.5, "Guaranteed maximum input-high threshold.", drv8876Data("page 5, Table 6-5 Electrical Characteristics")),
    pwmMaximumHz: reviewed(100_000, "Recommended input PWM maximum.", drv8876Data("page 4, Table 6-3 Recommended Operating Conditions")),
    minimumPulseWidthS: unknown("No guaranteed minimum input pulse width was established."),
    pathResistanceOhm: reviewed(0.7, "Typical high-side plus low-side on-resistance at the stated test conditions.", drv8876Data("page 6, Table 6-5 Electrical Characteristics, 350 mOhm typical high-side and 350 mOhm typical low-side")),
    switchingTransitionTimeS: reviewed(150e-9, "Typical output rise/fall transition time used as a reviewed typical, not a guaranteed maximum.", drv8876Data("page 6, Table 6-5 Electrical Characteristics, output rise and fall time")),
    quiescentCurrentA: reviewed(0.007, "Maximum active VM operating current.", drv8876Data("page 5, Table 6-5 Electrical Characteristics, VM operating supply current")),
    thetaJaKPerW: reviewed(44.3, "JEDEC board-dependent PWP package thermal resistance.", drv8876Data("page 5, Table 6-4 Thermal Information, RthetaJA")),
    maximumJunctionTemperatureK: reviewed(423.15, "Maximum recommended junction temperature converted from 150 C.", drv8876Data("page 4, Table 6-3 Recommended Operating Conditions")),
    operatingAmbientMinimumK: reviewed(233.15, "Recommended ambient minimum converted from -40 C.", drv8876Data("page 4, Table 6-3 Recommended Operating Conditions")),
    operatingAmbientMaximumK: reviewed(398.15, "Recommended ambient maximum converted from 125 C.", drv8876Data("page 4, Table 6-3 Recommended Operating Conditions")),
    highSideSupply: reviewed("charge_pump", "Integrated charge pump supports high-side drive.", drv8876Data("page 1, Features")),
    maximumHighSideDutyCycle: reviewed(1, "Charge pump permits 100% PWM duty-cycle operation.", drv8876Data("page 1, Features")),
    localDecouplingMinimumF: reviewed(0.1e-6, "Minimum local ceramic VM bypass named by the pin/application guidance.", drv8876Data("page 3, Pin Functions table, VM bypass capacitor")),
    bulkCapacitanceMinimumF: unknown("The source calls for sufficient bulk capacitance but does not establish a universal minimum."),
  },
};

const stspin840: ReviewedIntegratedBridgeProfile = {
  id: "motor.real.integrated.st-stspin840",
  kind: "integrated_bridge",
  part: { manufacturerId: "stmicroelectronics", manufacturerPartNumber: "STSPIN840" },
  identityEvidence: [stspin840Product("STSPIN840 official product page, orderable product and TFQFPN package identity")],
  package: {
    name: reviewed("TFQFPN-24 4 mm x 4 mm", "Official package identity.", stspin840Product("STSPIN840 official product page, TFQFPN 4 mm x 4 mm package")),
    bodyAreaM2: reviewed(16e-6, "Nominal 4 mm by 4 mm package body area.", stspin840Product("STSPIN840 official product page, 4 mm x 4 mm package dimensions")),
  },
  authorship: status,
  facts: {
    bridgeTopology: reviewed("full_bridge", "Two bridges in parallel mode form one brushed-DC full bridge.", stspin840Data("page 1, Features, PARALLEL mode")),
    powerStage: reviewed("integrated_fet", "Integrated dual full-bridge power MOSFET stage.", stspin840Data("page 1, Features")),
    supplyMinimumV: reviewed(7, "Recommended motor-supply minimum.", stspin840Data("page 6, Table 2 Recommended Operating Conditions")),
    supplyMaximumV: reviewed(45, "Recommended motor-supply maximum.", stspin840Data("page 6, Table 2 Recommended Operating Conditions")),
    absoluteMaximumV: reviewed(48, "Absolute supply maximum; not an operating rating.", stspin840Data("page 6, Table 1 Absolute Maximum Ratings")),
    continuousCurrentA: reviewed(3, "Combined RMS current in explicitly documented parallel mode.", stspin840Data("page 1, Features, PARALLEL mode 3 Arms")),
    peakCurrentA: unknown("The overcurrent-protection threshold is not treated as a normal peak-current rating."),
    currentLimitMinimumA: unknown("No user-programmable current-limit range was established for this profile."),
    currentLimitMaximumA: unknown("No user-programmable current-limit range was established for this profile."),
    logicHighThresholdMaximumV: reviewed(2, "Guaranteed maximum input-high threshold.", stspin840Data("page 8, Table 5 Electrical Characteristics, logic inputs")),
    pwmMaximumHz: unknown("No guaranteed maximum PWM frequency was established."),
    minimumPulseWidthS: unknown("No guaranteed minimum PWM pulse width was established."),
    pathResistanceOhm: reviewed(0.5, "Typical parallel-mode path resistance from two 1 Ohm bridge paths in parallel.", stspin840Data("page 1, Features, PARALLEL mode 500 mOhm typical")),
    switchingTransitionTimeS: reviewed(120e-9, "Larger of the typical 120 ns rise and 60 ns fall transition times.", stspin840Data("page 8, Table 5 Electrical Characteristics, output rise and fall time")),
    quiescentCurrentA: unknown("Only standby current was established; it cannot substitute for active operating current."),
    thetaJaKPerW: reviewed(36.5, "Board-dependent junction-to-ambient thermal resistance.", stspin840Data("page 7, Table 3 Thermal Data, RthJA")),
    maximumJunctionTemperatureK: reviewed(423.15, "Maximum junction temperature converted from 150 C.", stspin840Data("page 6, Table 1 Absolute Maximum Ratings")),
    operatingAmbientMinimumK: unknown("No catalog-operating ambient minimum was established from the reviewed source."),
    operatingAmbientMaximumK: unknown("No catalog-operating ambient maximum was established from the reviewed source."),
    highSideSupply: unknown("The reviewed source pass did not establish a closed high-side refresh classification suitable for deterministic matching."),
    maximumHighSideDutyCycle: unknown("No guaranteed maximum high-side duty cycle was established."),
    localDecouplingMinimumF: unknown("No universal local-decoupling minimum was admitted from the application-dependent guidance."),
    bulkCapacitanceMinimumF: unknown("No universal bulk-capacitance minimum was admitted from the application-dependent guidance."),
  },
};

const tb67h450: ReviewedIntegratedBridgeProfile = {
  id: "motor.real.integrated.toshiba-tb67h450afng",
  kind: "integrated_bridge",
  part: { manufacturerId: "toshiba-semiconductor-storage", manufacturerPartNumber: "TB67H450AFNG(O,EL)" },
  identityEvidence: [tb67h450Product("TB67H450AFNG official product page, ordering MPN TB67H450AFNG(O,EL) and package identity")],
  package: {
    name: reviewed("P-HSOP8-0405-1.27-002", "Exact package name from the official product page.", tb67h450Product("TB67H450AFNG official product page, package P-HSOP8-0405-1.27-002")),
    bodyAreaM2: unknown<number>("A stable nominal body-area figure was not transcribed from the reviewed official sources."),
  },
  authorship: status,
  facts: {
    bridgeTopology: reviewed("full_bridge", "Single PWM brushed-DC full bridge.", tb67h450Data("page 1, Features")),
    powerStage: reviewed("integrated_fet", "Integrated output power MOSFET bridge.", tb67h450Data("page 1, Features")),
    supplyMinimumV: reviewed(4.5, "Operating motor-supply minimum.", tb67h450Data("page 13, Table 12 Operating Ranges")),
    supplyMaximumV: reviewed(44, "Active operating motor-supply maximum.", tb67h450Data("page 13, Table 12 Operating Ranges")),
    absoluteMaximumV: reviewed(50, "Absolute/non-active output-supply maximum; not an active operating rating.", tb67h450Data("page 12, Table 11 Absolute Maximum Ratings")),
    continuousCurrentA: unknown("The official table gives 1.5 A as a typical operating point, not a guaranteed continuous-current limit; it is not admitted as a hard rating."),
    peakCurrentA: reviewed(3, "Maximum output current in the operating-range table, below the 3.5 A absolute maximum.", tb67h450Data("page 13, Table 12 Operating Ranges")),
    currentLimitMinimumA: unknown("Current limiting depends on external VREF and sense resistance; no closed universal minimum is admitted."),
    currentLimitMaximumA: unknown("Current limiting depends on external VREF and sense resistance; no closed universal maximum is admitted."),
    logicHighThresholdMaximumV: reviewed(2, "Guaranteed maximum input-high threshold.", tb67h450Data("page 14, Table 13.1 Electrical Characteristics")),
    pwmMaximumHz: reviewed(400_000, "Maximum input logic frequency in the operating-range table.", tb67h450Data("page 13, Table 12 Operating Ranges")),
    minimumPulseWidthS: unknown("No guaranteed minimum PWM pulse width was established."),
    pathResistanceOhm: reviewed(0.6, "Typical total output on-resistance at the stated 1.5 A test condition.", tb67h450Data("page 14, Table 13.1 Electrical Characteristics")),
    switchingTransitionTimeS: unknown("No closed switching-transition value was established in this evidence pass."),
    quiescentCurrentA: reviewed(0.005, "Maximum active PWM motor-supply current.", tb67h450Data("page 14, Table 13.1 Electrical Characteristics")),
    thetaJaKPerW: unknown("No board-assumption-compatible junction-to-ambient value was established."),
    maximumJunctionTemperatureK: reviewed(423.15, "Maximum junction temperature converted from 150 C.", tb67h450Data("page 12, Table 11 Absolute Maximum Ratings")),
    operatingAmbientMinimumK: reviewed(233.15, "Operating ambient minimum converted from -40 C.", tb67h450Data("page 13, Table 12 Operating Ranges")),
    operatingAmbientMaximumK: reviewed(358.15, "Operating ambient maximum converted from 85 C.", tb67h450Data("page 13, Table 12 Operating Ranges")),
    highSideSupply: reviewed("charge_pump", "Integrated charge-pump block supplies high-side drive.", tb67h450Data("page 2, Block Diagram, charge pump circuit")),
    maximumHighSideDutyCycle: unknown("No guaranteed maximum high-side duty cycle was established."),
    localDecouplingMinimumF: unknown("No universal local-decoupling minimum was admitted."),
    bulkCapacitanceMinimumF: unknown("No universal bulk-capacitance minimum was admitted."),
  },
};

const drv8262: ReviewedIntegratedBridgeProfile = {
  id: "motor.real.integrated.ti-drv8262ddvr",
  kind: "integrated_bridge",
  part: { manufacturerId: "texas-instruments", manufacturerPartNumber: "DRV8262DDVR" },
  identityEvidence: [drv8262Product("DRV8262DDVR official product page, active orderable-part and DDV package identity")],
  package: {
    name: reviewed("HTSSOP-44 PowerPAD (DDV), top thermal pad", "Exact DDV orderable package with top thermal pad.", drv8262Data("page 1, Device Information, exact DRV8262DDVR row")),
    bodyAreaM2: reviewed(85.4e-6, "Nominal 14 mm by 6.1 mm package body area; this is not mounted land-pattern area.", drv8262Data("page 1, Device Information, nominal package body size 14 mm x 6.1 mm")),
  },
  authorship: {
    ...status,
    authoredAt: "2026-08-25T20:51:57Z",
    note: "Track A authored the exact facts-V3.2 profile from pinned primary-source bytes. Independent evidence review and reviewed catalog admission remain pending; the profile is not exposed to generation.",
  },
  facts: {
    bridgeTopology: reviewed("full_bridge", "The exact staged profile represents the two full bridges paralleled as one brushed-DC full bridge.", drv8262Data("page 15 and pages 19-20, sections 6.1 and 6.4, single-H-bridge mode")),
    powerStage: reviewed("integrated_fet", "Two integrated H-bridge power stages.", drv8262Data("page 15, section 6.1 Overview")),
    supplyMinimumV: reviewed(4.5, "Recommended normal-DC motor-supply minimum.", drv8262Data("page 8, section 5.3 Recommended Operating Conditions")),
    supplyMaximumV: reviewed(60, "Recommended normal-DC motor-supply maximum; the simplified schematic's 65 V label is not promoted.", drv8262Data("page 1, simplified schematic 4.5 V to 65 V, and page 8, section 5.3 Recommended Operating Conditions VVM maximum 60 V")),
    absoluteMaximumV: reviewed(70, "Absolute VM maximum; not an operating rating.", drv8262Data("page 7, section 5.1 Absolute Maximum Ratings")),
    continuousCurrentA: reviewed(20, "Recommended RMS operating ceiling only for the DDV package in paralleled single-H-bridge mode; actual continuous delivery remains thermal-system dependent.", drv8262Data("page 8 and page 15, IRMS,SINGLE,DDV maximum and current-delivery thermal caveat")),
    peakCurrentA: unknown("The 32 A figure is a DDV single-H-bridge overcurrent-protection threshold and a 24 V, 25 C headline without pulse duration or SOA; it is non-promotable as a normal peak or stall-current fact."),
    currentLimitMinimumA: unknown("Configured current regulation depends on VREF, RIPROPI, mirror gain, tolerances, and exact pin configuration; no closed universal minimum is admitted."),
    currentLimitMaximumA: unknown("The 32 A OCP threshold is protection, not a user-configured current-limit maximum; no closed universal maximum is admitted."),
    logicHighThresholdMaximumV: reviewed(1.5, "Guaranteed input-high threshold requirement.", drv8262Data("page 9, section 5.5 Electrical Characteristics, VIH minimum")),
    pwmMaximumHz: unknown("The 200 kHz statement is application guidance with an explicit switching-loss and thermal warning, not a guaranteed PWM bound; it is non-promotable into facts V2."),
    minimumPulseWidthS: unknown("No guaranteed ordinary INx PWM pulse-width minimum was established; nSLEEP reset timing and propagation delay are different quantities."),
    pathResistanceOhm: reviewed(0.104, "Conservative maximum single-H-bridge path resistance at TJ = 150 C and |IO| = 5 A: 54 mOhm high-side plus 50 mOhm low-side.", drv8262Data("page 10, section 5.5 Electrical Characteristics, hot single-H-bridge RDS(ON) maxima")),
    switchingTransitionTimeS: reviewed(110e-9, "Typical 10%-to-90% output rise/fall time at IO = 5 A, not a guaranteed maximum.", drv8262Data("page 10, section 5.5 Electrical Characteristics, tRF")),
    quiescentCurrentA: reviewed(0.013, "Maximum active VM operating current with nSLEEP high, no motor load, and VCC = DVDD.", drv8262Data("page 9, section 5.5 Electrical Characteristics, IVM")),
    thetaJaKPerW: reviewed(44.2, "DDV junction-to-ambient test metric; the 0.7 C/W top-case path, TIM, and heat sink govern high-current application closure.", drv8262Data("page 8, section 5.4 Thermal Information")),
    maximumJunctionTemperatureK: reviewed(423.15, "Maximum recommended junction temperature converted from 150 C.", drv8262Data("page 8, section 5.3 Recommended Operating Conditions")),
    operatingAmbientMinimumK: reviewed(233.15, "Recommended ambient minimum converted from -40 C.", drv8262Data("page 8, section 5.3 Recommended Operating Conditions")),
    operatingAmbientMaximumK: reviewed(398.15, "Recommended ambient maximum converted from 125 C.", drv8262Data("page 8, section 5.3 Recommended Operating Conditions")),
    highSideSupply: reviewed("charge_pump", "Integrated charge pump supplies the high-side N-channel MOSFET drive.", drv8262Data("page 15 and page 26, sections 6.1 and 6.6")),
    maximumHighSideDutyCycle: reviewed(1, "The charge pump supports static 100% drive; this is not a thermal-current guarantee.", drv8262Data("page 15 and page 19, sections 6.1 and 6.4")),
    localDecouplingMinimumF: unknown("TI recommends two separate 10 nF VM bypass capacitors and additional charge-pump/regulator capacitors. A one-scalar V2 minimum would erase requirement role and multiplicity, so it remains non-promotable."),
    bulkCapacitanceMinimumF: unknown("A VM bulk capacitor is required, but its numeric value is application-dependent and must be established by system testing."),
  },
};

const drv8701: ReviewedGateDriverProfile = {
  id: "motor.real.gate-driver.ti-drv8701erger",
  kind: "gate_driver",
  part: { manufacturerId: "texas-instruments", manufacturerPartNumber: "DRV8701ERGER" },
  identityEvidence: [drv8701Product("DRV8701ERGER official product page, package and orderable-part identity")],
  package: {
    name: reviewed("VQFN-24 (RGE)", "Exact orderable package.", drv8701Product("DRV8701ERGER official product page, package RGE and 24 pins")),
    bodyAreaM2: reviewed(16e-6, "Nominal 4 mm by 4 mm package body area.", drv8701Product("DRV8701ERGER official product page, package size 4 mm x 4 mm")),
  },
  authorship: status,
  facts: {
    bridgeTopology: reviewed("full_bridge", "Single full-bridge predriver for four external N-channel MOSFETs.", drv8701Data("page 1, Features")),
    powerStage: reviewed("external_n_channel_mosfet", "Drives four external N-channel MOSFETs.", drv8701Data("page 1, Features")),
    supplyMinimumV: reviewed(5.9, "Recommended VM minimum.", drv8701Data("page 5, Table 6-3 Recommended Operating Conditions")),
    supplyMaximumV: reviewed(45, "Recommended VM maximum.", drv8701Data("page 5, Table 6-3 Recommended Operating Conditions")),
    absoluteMaximumV: reviewed(47, "Absolute VM maximum; not an operating rating.", drv8701Data("page 5, Table 6-1 Absolute Maximum Ratings")),
    driverBiasMinimumV: unknown("This integrated predriver does not expose a separate externally rated gate-driver bias range in the admitted profile."),
    driverBiasMaximumV: unknown("This integrated predriver does not expose a separate externally rated gate-driver bias range in the admitted profile."),
    logicHighThresholdMaximumV: reviewed(1.5, "Guaranteed maximum input-high threshold.", drv8701Data("page 7, Table 6-5 Electrical Characteristics")),
    pwmMaximumHz: reviewed(100_000, "Recommended input PWM maximum.", drv8701Data("page 5, Table 6-3 Recommended Operating Conditions")),
    minimumPulseWidthS: unknown("No guaranteed minimum PWM pulse width was established."),
    sourceCurrentA: reviewed(0.15, "Maximum selectable peak source-current setting.", drv8701Data("page 7, Table 6-5 Electrical Characteristics, source current")),
    sinkCurrentA: reviewed(0.3, "Maximum selectable peak sink-current setting.", drv8701Data("page 8, Table 6-5 Electrical Characteristics, sink current")),
    gateVoltageV: reviewed(9.5, "Typical regulated gate-drive voltage for VM above 12 V.", drv8701Data("page 7, Table 6-5 Electrical Characteristics")),
    deadTimeS: reviewed(380e-9, "Typical internal dead time.", drv8701Data("page 7, Table 6-5 Electrical Characteristics")),
    highSideSupply: reviewed("charge_pump", "Integrated charge pump supports high-side drive.", drv8701Data("page 1, Features")),
    bootstrapMaximumDutyCycle: reviewed(1, "Charge pump supports 100% PWM duty cycle.", drv8701Data("page 1, Features")),
    bootstrapAllowedRippleV: unknown("No bootstrap-ripple design allowance applies as a universal admitted value."),
    bootstrapOverheadChargeC: unknown("No universal bootstrap overhead-charge value was established."),
    quiescentCurrentA: reviewed(
      0.0095,
      "Maximum active VM operating supply current at VM = 24 V with nSLEEP high, over the operating free-air temperature range.",
      drv8701Data("page 7, Table 6-5 Electrical Characteristics, IVM VM operating supply current, VM = 24 V and nSLEEP high, 9.5 mA maximum over operating free-air temperature range"),
    ),
    thetaJaKPerW: reviewed(34.8, "JEDEC board-dependent RGE package thermal resistance.", drv8701Data("page 6, Table 6-4 Thermal Information, RthetaJA")),
    maximumJunctionTemperatureK: reviewed(423.15, "Maximum junction temperature converted from 150 C.", drv8701Data("page 8, Table 6-5 Electrical Characteristics")),
    operatingAmbientMinimumK: reviewed(233.15, "Recommended ambient minimum converted from -40 C.", drv8701Data("page 5, Table 6-3 Recommended Operating Conditions")),
    operatingAmbientMaximumK: reviewed(398.15, "Recommended ambient maximum converted from 125 C.", drv8701Data("page 5, Table 6-3 Recommended Operating Conditions")),
    senseMaximumVoltageV: reviewed(1, "Maximum continuous SP/SN current-sense input voltage.", drv8701Data("page 8, Table 6-5 Electrical Characteristics")),
    localDecouplingMinimumF: reviewed(0.1e-6, "Minimum local VM ceramic bypass named in the external-components table.", drv8701Data("page 4, External Components table, CVM1")),
  },
};

const a3941: ReviewedGateDriverProfile = {
  id: "motor.real.gate-driver.allegro-a3941klptr-t",
  kind: "gate_driver",
  part: { manufacturerId: "allegro-microsystems", manufacturerPartNumber: "A3941KLPTR-T" },
  identityEvidence: [a3941Product("A3941 official product page linked to manufacturer datasheet and full-bridge MOSFET driver identity"), a3941Data("page 2, Selection Guide, A3941KLPTR-T ordering MPN")],
  package: {
    name: reviewed("28-pin TSSOP with exposed thermal pad (LP)", "Exact package from the selection guide.", a3941Data("page 2, Selection Guide, package LP")),
    bodyAreaM2: unknown<number>("A nominal package body area was not transcribed in this tranche."),
  },
  authorship: status,
  facts: {
    bridgeTopology: reviewed("full_bridge", "Full-bridge controller for brush DC motors.", a3941Data("page 1, Features and Description")),
    powerStage: reviewed("external_n_channel_mosfet", "Drives four external N-channel MOSFETs.", a3941Data("page 1, Features and Description")),
    supplyMinimumV: reviewed(5.5, "Functional bridge-supply minimum.", a3941Data("page 4, Electrical Characteristics, supply functional range")),
    supplyMaximumV: reviewed(50, "Functional bridge-supply maximum.", a3941Data("page 4, Electrical Characteristics, supply functional range")),
    absoluteMaximumV: reviewed(50, "Absolute VBB maximum; no operating headroom is inferred.", a3941Data("page 2, Absolute Maximum Ratings")),
    driverBiasMinimumV: unknown("No separate external gate-driver bias range is admitted; the device generates VREG internally."),
    driverBiasMaximumV: unknown("No separate external gate-driver bias range is admitted; the device generates VREG internally."),
    logicHighThresholdMaximumV: reviewed(3.5, "Guaranteed maximum input-high threshold.", a3941Data("page 5, Electrical Characteristics, logic inputs")),
    pwmMaximumHz: unknown("No guaranteed maximum PWM frequency was established."),
    minimumPulseWidthS: unknown("No guaranteed minimum PWM pulse width was established."),
    sourceCurrentA: unknown("No guaranteed peak gate-source current value was established."),
    sinkCurrentA: unknown("No guaranteed peak gate-sink current value was established."),
    gateVoltageV: reviewed(13, "Typical internal VREG gate-drive supply voltage.", a3941Data("page 7, Electrical Characteristics, VREG")),
    deadTimeS: unknown("Dead time is externally programmable; the source's example value is not a universal device value."),
    highSideSupply: reviewed("bootstrap_with_top_off_charge_pump", "Bootstrap drive includes a top-off charge pump for static high-side operation.", a3941Data("page 1, Features; page 7, Charge Pump Regulator")),
    bootstrapMaximumDutyCycle: reviewed(1, "Top-off charge pump permits 100% PWM duty-cycle operation.", a3941Data("page 1, Features")),
    bootstrapAllowedRippleV: unknown("No universal bootstrap-ripple allowance was established."),
    bootstrapOverheadChargeC: unknown("No universal bootstrap overhead charge was established."),
    quiescentCurrentA: reviewed(0.014, "Maximum operating supply current at the stated 12 V condition.", a3941Data("page 4, Electrical Characteristics, quiescent supply current")),
    thetaJaKPerW: reviewed(28, "Four-layer-board junction-to-ambient thermal resistance.", a3941Data("page 2, Thermal Characteristics, RthetaJA")),
    maximumJunctionTemperatureK: reviewed(423.15, "Maximum junction temperature converted from 150 C.", a3941Data("page 2, Absolute Maximum Ratings")),
    operatingAmbientMinimumK: reviewed(233.15, "K temperature-range minimum converted from -40 C.", a3941Data("page 2, Absolute Maximum Ratings, Range K")),
    operatingAmbientMaximumK: reviewed(423.15, "K temperature-range maximum converted from 150 C.", a3941Data("page 2, Absolute Maximum Ratings, Range K")),
    senseMaximumVoltageV: unknown("No closed current-sense input maximum was admitted."),
    localDecouplingMinimumF: unknown("The reviewed evidence did not establish a universal local-decoupling minimum."),
  },
};

const hip4081a: ReviewedGateDriverProfile = {
  id: "motor.real.gate-driver.renesas-hip4081aibz",
  kind: "gate_driver",
  part: { manufacturerId: "renesas-electronics", manufacturerPartNumber: "HIP4081AIBZ" },
  identityEvidence: [hip4081aProduct("HIP4081AIBZ official product page, active orderable-part and package identity"), hip4081aData("page 1, Ordering Information, HIP4081AIBZ")],
  package: {
    name: reviewed("20-pin SOICW", "Exact package from official ordering information.", hip4081aData("page 1, Ordering Information, 20 Ld SOICW")),
    bodyAreaM2: reviewed(96.75e-6, "Nominal 12.9 mm by 7.5 mm package body area.", hip4081aProduct("HIP4081AIBZ official product page, package dimensions 12.9 mm x 7.5 mm")),
  },
  authorship: status,
  facts: {
    bridgeTopology: reviewed("full_bridge", "Full-bridge N-channel MOSFET driver.", hip4081aData("page 1, Features and Description")),
    powerStage: reviewed("external_n_channel_mosfet", "Drives four external N-channel MOSFETs.", hip4081aData("page 1, Description")),
    supplyMinimumV: unknown("No independent motor-bus minimum was established; only the driver-bias range is closed."),
    supplyMaximumV: unknown("Recommended Operating Conditions do not establish a bridge-bus operating maximum; the 80 V high-voltage value is retained only as an absolute maximum."),
    absoluteMaximumV: reviewed(80, "Absolute high-voltage bridge phase maximum; no operating headroom is inferred.", hip4081aData("page 4, Absolute Maximum Ratings")),
    driverBiasMinimumV: reviewed(9.5, "Operating VDD/VCC bias minimum.", hip4081aData("page 4, Recommended Operating Conditions")),
    driverBiasMaximumV: reviewed(15, "Operating VDD/VCC bias maximum.", hip4081aData("page 4, Recommended Operating Conditions")),
    logicHighThresholdMaximumV: reviewed(2.7, "Worst-case input-high threshold across the stated supply range.", hip4081aData("page 4, Electrical Specifications, input high voltage")),
    pwmMaximumHz: reviewed(1_000_000, "Manufacturer-stated high-frequency capability.", hip4081aData("page 1, Features, up to 1 MHz")),
    minimumPulseWidthS: reviewed(
      50e-9,
      "Conservative minimum input pulse width: the larger of the guaranteed 50 ns turn-on and 40 ns turn-off minima with RHDEL = RLDEL = 10 kOhm, retained across the stated junction-temperature ranges.",
      hip4081aData("page 5, Electrical Specifications, TPWIN-ON and TPWIN-OFF with RHDEL = RLDEL = 10 kOhm: 50 ns turn-on and 40 ns turn-off minimum at TJ = 25 C and across TJ = -40 C to 125 C"),
    ),
    sourceCurrentA: reviewed(2.6, "Typical peak gate-source current.", hip4081aData("page 5, Electrical Specifications, peak output source current")),
    sinkCurrentA: reviewed(2.4, "Typical peak gate-sink current.", hip4081aData("page 5, Electrical Specifications, peak output sink current")),
    gateVoltageV: reviewed(12.6, "Typical bootstrap high-side output voltage at the stated test condition.", hip4081aData("page 5, Electrical Specifications, bootstrap output voltage")),
    deadTimeS: unknown("Dead time is programmable; no universal configured value is admitted."),
    highSideSupply: reviewed("bootstrap_with_charge_pump", "Bootstrap high-side drive is supported by an internal charge pump.", hip4081aData("page 1, Features and Description")),
    bootstrapMaximumDutyCycle: unknown("No guaranteed maximum continuous high-side duty cycle was established."),
    bootstrapAllowedRippleV: unknown("No universal bootstrap-ripple allowance was established."),
    bootstrapOverheadChargeC: unknown("No universal bootstrap overhead charge was established."),
    quiescentCurrentA: reviewed(0.0145, "Maximum VDD quiescent supply current.", hip4081aData("page 4, Electrical Specifications")),
    thetaJaKPerW: reviewed(85, "SOIC package junction-to-ambient thermal resistance.", hip4081aData("page 4, Thermal Information, thetaJA")),
    maximumJunctionTemperatureK: reviewed(398.15, "Maximum junction temperature converted from 125 C.", hip4081aData("page 4, Absolute Maximum Ratings")),
    operatingAmbientMinimumK: reviewed(233.15, "Operating ambient minimum converted from -40 C.", hip4081aData("page 4, Recommended Operating Conditions")),
    operatingAmbientMaximumK: reviewed(358.15, "Operating ambient maximum converted from 85 C.", hip4081aData("page 4, Recommended Operating Conditions")),
    senseMaximumVoltageV: unknown("No closed current-sense input maximum was established."),
    localDecouplingMinimumF: unknown("No universal local-decoupling minimum was established."),
  },
};

export const REVIEWED_REAL_MOTOR_CATALOG: ReviewedRealMotorCatalog = {
  schemaVersion: "motor-primary-source-tranche.v1alpha2",
  catalogId: "schemagic-motor-a4-primary-tranche",
  provenanceState: "authored_from_primary_sources",
  catalogAdmission: "pending_independent_review",
  retrievedAt: REVIEWED_REAL_RETRIEVED_AT,
  manufacturers: REVIEWED_REAL_MANUFACTURER_ALLOWLIST,
  integratedBridges: [drv8876, stspin840, tb67h450, drv8262],
  gateDrivers: [drv8701, a3941, hip4081a],
};
