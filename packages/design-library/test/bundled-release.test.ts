import { describe, expect, it } from "vitest";
import {
  getBundledDesignLibraryDocuments,
  loadReviewedDesignLibraryEnvelope,
  parseDesignCatalogRelease,
  parseDesignProfileAdmission,
} from "../src";
import { getBundledReviewedReleaseDocuments } from "../src/bundled-reviewed-release";

function expectDeepFrozen(value: unknown): void {
  if (!value || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value as Record<string, unknown>)) expectDeepFrozen(child);
}

describe("bundled design-library release", () => {
  it("loads the checked-in mixed-version release with only independently reviewed profiles", () => {
    const first = getBundledDesignLibraryDocuments();
    const second = getBundledDesignLibraryDocuments();
    const reviewed = loadReviewedDesignLibraryEnvelope(first);
    expect(reviewed.version).toBe("2026-08-27.2");
    expect(reviewed.profiles.map((profile) => profile.part.manufacturerPartNumber)).toEqual([
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
    expect(Object.keys(first.profiles)).toEqual([
      "packages/design-library/parts/motor.full-bridge-gate-driver/microchip-technology/MIC4606-2YML-T5.json",
      "packages/design-library/parts/motor.integrated-h-bridge/stmicroelectronics/STSPIN840.json",
      "packages/design-library/parts/motor.integrated-h-bridge/texas-instruments/DRV8262DDVR.json",
      "packages/design-library/parts/motor.integrated-h-bridge/texas-instruments/DRV8876PWPR.json",
      "packages/design-library/parts/motor.supply-tvs-diode/bourns/PTVS10-058C-SH.json",
      "packages/design-library/parts/motor.supply-tvs-diode/diodes-incorporated/3%2E0SMCJ33CAQ.json",
      "packages/design-library/parts/power.integrated-synchronous-buck-regulator/onsemi/NCP1599MNTWG.json",
      "packages/design-library/parts/power.integrated-synchronous-buck-regulator/texas-instruments/TPS54302DDCR.json",
      "packages/design-library/parts/power.power-inductor/bel-fuse/F1F2-0804-100M.json",
      "packages/design-library/parts/power.power-inductor/bel-fuse/F1F2-0804-2R2M.json",
      "packages/design-library/parts/power.power-inductor/coilcraft/XAL7030-472MEC.json",
      "packages/design-library/parts/power.power-inductor/murata-manufacturing/LQM18PN2R2MGHD.json",
      "packages/design-library/parts/shared.bulk-capacitor/nichicon/UCM1V331MNS1GS.json",
      "packages/design-library/parts/shared.bulk-capacitor/panasonic-industry/EEHZS1V331V.json",
      "packages/design-library/parts/shared.current-sense-resistor/bourns/CRA2512-FZ-R020ELF.json",
      "packages/design-library/parts/shared.general-purpose-resistor/bourns/CR0603-FX-1003ELF.json",
      "packages/design-library/parts/shared.general-purpose-resistor/panasonic-industry/ERJ3EKF1003V.json",
      "packages/design-library/parts/shared.general-purpose-resistor/vishay-intertechnology/CRCW0603100KFKEA.json",
      "packages/design-library/parts/shared.general-purpose-resistor/vishay-intertechnology/CRCW0603732KFKEA.json",
      "packages/design-library/parts/shared.mlcc-capacitor/murata-manufacturing/GRM31CR61H106KA12L.json",
      "packages/design-library/parts/shared.mlcc-capacitor/murata-manufacturing/GRM32ER71E226KE15L.json",
      "packages/design-library/parts/shared.mlcc-capacitor/samsung-electro-mechanics/CL31A106KBHNNNE.json",
      "packages/design-library/parts/shared.mlcc-capacitor/tdk-corporation/C1608X7R1H104K080AA.json",
      "packages/design-library/parts/shared.mlcc-capacitor/tdk-corporation/C3216X7R1H106K160AC.json",
      "packages/design-library/parts/shared.n-channel-power-mosfet/texas-instruments/CSD18540Q5B.json",
      "packages/design-library/parts/shared.switching-diode/diodes-incorporated/1N4148W-7-F.json",
      "packages/design-library/parts/shared.switching-diode/vishay-intertechnology/1N4148-TAP.json",
    ]);
    expect(reviewed.diagnostics).toContain("Excluded authored profile packages/design-library/parts/power.integrated-synchronous-buck-regulator/onsemi/NCP1599MNTWG.json");
    expect(reviewed.diagnostics).toContain("Excluded authored profile packages/design-library/parts/power.power-inductor/coilcraft/XAL7030-472MEC.json");
    expect(reviewed.diagnostics).toContain("Excluded authored profile packages/design-library/parts/shared.switching-diode/vishay-intertechnology/1N4148-TAP.json");
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expectDeepFrozen(first);
    expect(() => { (first.profiles as Record<string, unknown>).forged = {}; }).toThrow();
    expect(getBundledDesignLibraryDocuments()).toEqual(second);
  });

  it("exposes a browser-safe bundle with exactly the released profile paths", () => {
    const documents = getBundledReviewedReleaseDocuments();
    const fullAdmission = parseDesignProfileAdmission(getBundledDesignLibraryDocuments().admission);
    const release = parseDesignCatalogRelease(documents.catalogRelease);
    const admission = parseDesignProfileAdmission(documents.admission);
    const releasePaths = release.profiles.map((profile) => profile.profilePath);
    expect(Object.keys(documents.profiles)).toEqual(releasePaths);
    expect(admission.entries.every((entry) => entry.state === "reviewed")).toBe(true);
    expect(admission.entries).toEqual(fullAdmission.entries.filter((entry) => entry.state === "reviewed"));
    expect(loadReviewedDesignLibraryEnvelope(documents).profiles).toHaveLength(releasePaths.length);
  });
});
