import admission from "../admission.json";
import catalogRelease from "../catalog-release.json";
import manufacturerRegistry from "../manufacturers.json";
import microchipMic46062ymlT5 from "../parts/motor.full-bridge-gate-driver/microchip-technology/MIC4606-2YML-T5.json";
import stStspin840 from "../parts/motor.integrated-h-bridge/stmicroelectronics/STSPIN840.json";
import tiDrv8262ddvr from "../parts/motor.integrated-h-bridge/texas-instruments/DRV8262DDVR.json";
import tiDrv8876pwpr from "../parts/motor.integrated-h-bridge/texas-instruments/DRV8876PWPR.json";
import onsemiNcp1599mntwg from "../parts/power.integrated-synchronous-buck-regulator/onsemi/NCP1599MNTWG.json";
import tiTps54302ddcr from "../parts/power.integrated-synchronous-buck-regulator/texas-instruments/TPS54302DDCR.json";
import belFuseF1f20804100m from "../parts/power.power-inductor/bel-fuse/F1F2-0804-100M.json";
import belFuseF1f208042r2m from "../parts/power.power-inductor/bel-fuse/F1F2-0804-2R2M.json";
import coilcraftXal7030472mec from "../parts/power.power-inductor/coilcraft/XAL7030-472MEC.json";
import murataLqm18pn2r2mghd from "../parts/power.power-inductor/murata-manufacturing/LQM18PN2R2MGHD.json";
import nichiconUcm1v331mns1gs from "../parts/shared.bulk-capacitor/nichicon/UCM1V331MNS1GS.json";
import bournsCra2512FzR020elf from "../parts/shared.current-sense-resistor/bourns/CRA2512-FZ-R020ELF.json";
import panasonicErj3ekf1003v from "../parts/shared.general-purpose-resistor/panasonic-industry/ERJ3EKF1003V.json";
import bournsCr0603Fx1003elf from "../parts/shared.general-purpose-resistor/bourns/CR0603-FX-1003ELF.json";
import vishayCrcw0603100kfkea from "../parts/shared.general-purpose-resistor/vishay-intertechnology/CRCW0603100KFKEA.json";
import vishayCrcw0603732kfkea from "../parts/shared.general-purpose-resistor/vishay-intertechnology/CRCW0603732KFKEA.json";
import murataGrm31cr61h106ka12l from "../parts/shared.mlcc-capacitor/murata-manufacturing/GRM31CR61H106KA12L.json";
import murataGrm32er71e226ke15l from "../parts/shared.mlcc-capacitor/murata-manufacturing/GRM32ER71E226KE15L.json";
import samsungCl31a106kbhhnnne from "../parts/shared.mlcc-capacitor/samsung-electro-mechanics/CL31A106KBHNNNE.json";
import tdkC1608x7r1h104k080aa from "../parts/shared.mlcc-capacitor/tdk-corporation/C1608X7R1H104K080AA.json";
import tdkC3216x7r1h106k160ac from "../parts/shared.mlcc-capacitor/tdk-corporation/C3216X7R1H106K160AC.json";
import panasonicEehzs1v331v from "../parts/shared.bulk-capacitor/panasonic-industry/EEHZS1V331V.json";
import diodes1N4148w7f from "../parts/shared.switching-diode/diodes-incorporated/1N4148W-7-F.json";
import vishay1N4148Tap from "../parts/shared.switching-diode/vishay-intertechnology/1N4148-TAP.json";
import bournsPtvs10058cSh from "../parts/motor.supply-tvs-diode/bourns/PTVS10-058C-SH.json";
import diodes30Smcj33caq from "../parts/motor.supply-tvs-diode/diodes-incorporated/3%2E0SMCJ33CAQ.json";
import tiCsd18540q5b from "../parts/shared.n-channel-power-mosfet/texas-instruments/CSD18540Q5B.json";
import { deepFreeze, detachedJsonSnapshot } from "./canonical";
import type { DesignLibraryDocuments } from "./types";

const BUNDLED_DOCUMENTS = deepFreeze(detachedJsonSnapshot({
  manufacturerRegistry,
  admission,
  catalogRelease,
  profiles: {
    "packages/design-library/parts/motor.full-bridge-gate-driver/microchip-technology/MIC4606-2YML-T5.json": microchipMic46062ymlT5,
    "packages/design-library/parts/motor.integrated-h-bridge/stmicroelectronics/STSPIN840.json": stStspin840,
    "packages/design-library/parts/motor.integrated-h-bridge/texas-instruments/DRV8262DDVR.json": tiDrv8262ddvr,
    "packages/design-library/parts/motor.integrated-h-bridge/texas-instruments/DRV8876PWPR.json": tiDrv8876pwpr,
    "packages/design-library/parts/power.integrated-synchronous-buck-regulator/onsemi/NCP1599MNTWG.json": onsemiNcp1599mntwg,
    "packages/design-library/parts/power.integrated-synchronous-buck-regulator/texas-instruments/TPS54302DDCR.json": tiTps54302ddcr,
    "packages/design-library/parts/power.power-inductor/bel-fuse/F1F2-0804-100M.json": belFuseF1f20804100m,
    "packages/design-library/parts/power.power-inductor/bel-fuse/F1F2-0804-2R2M.json": belFuseF1f208042r2m,
    "packages/design-library/parts/power.power-inductor/coilcraft/XAL7030-472MEC.json": coilcraftXal7030472mec,
    "packages/design-library/parts/power.power-inductor/murata-manufacturing/LQM18PN2R2MGHD.json": murataLqm18pn2r2mghd,
    "packages/design-library/parts/motor.supply-tvs-diode/bourns/PTVS10-058C-SH.json": bournsPtvs10058cSh,
    "packages/design-library/parts/motor.supply-tvs-diode/diodes-incorporated/3%2E0SMCJ33CAQ.json": diodes30Smcj33caq,
    "packages/design-library/parts/shared.bulk-capacitor/nichicon/UCM1V331MNS1GS.json": nichiconUcm1v331mns1gs,
    "packages/design-library/parts/shared.bulk-capacitor/panasonic-industry/EEHZS1V331V.json": panasonicEehzs1v331v,
    "packages/design-library/parts/shared.current-sense-resistor/bourns/CRA2512-FZ-R020ELF.json": bournsCra2512FzR020elf,
    "packages/design-library/parts/shared.general-purpose-resistor/bourns/CR0603-FX-1003ELF.json": bournsCr0603Fx1003elf,
    "packages/design-library/parts/shared.general-purpose-resistor/panasonic-industry/ERJ3EKF1003V.json": panasonicErj3ekf1003v,
    "packages/design-library/parts/shared.general-purpose-resistor/vishay-intertechnology/CRCW0603100KFKEA.json": vishayCrcw0603100kfkea,
    "packages/design-library/parts/shared.general-purpose-resistor/vishay-intertechnology/CRCW0603732KFKEA.json": vishayCrcw0603732kfkea,
    "packages/design-library/parts/shared.mlcc-capacitor/murata-manufacturing/GRM31CR61H106KA12L.json": murataGrm31cr61h106ka12l,
    "packages/design-library/parts/shared.mlcc-capacitor/murata-manufacturing/GRM32ER71E226KE15L.json": murataGrm32er71e226ke15l,
    "packages/design-library/parts/shared.mlcc-capacitor/samsung-electro-mechanics/CL31A106KBHNNNE.json": samsungCl31a106kbhhnnne,
    "packages/design-library/parts/shared.mlcc-capacitor/tdk-corporation/C1608X7R1H104K080AA.json": tdkC1608x7r1h104k080aa,
    "packages/design-library/parts/shared.mlcc-capacitor/tdk-corporation/C3216X7R1H106K160AC.json": tdkC3216x7r1h106k160ac,
    "packages/design-library/parts/shared.n-channel-power-mosfet/texas-instruments/CSD18540Q5B.json": tiCsd18540q5b,
    "packages/design-library/parts/shared.switching-diode/diodes-incorporated/1N4148W-7-F.json": diodes1N4148w7f,
    "packages/design-library/parts/shared.switching-diode/vishay-intertechnology/1N4148-TAP.json": vishay1N4148Tap,
  },
})) as Readonly<DesignLibraryDocuments>;

/**
 * Returns the checked-in release documents as a detached immutable snapshot.
 * Includes authored profile documents for admission validation. The reviewed
 * loader still exposes only profiles pinned by catalog-release.json.
 */
export function getBundledDesignLibraryDocuments(): Readonly<DesignLibraryDocuments> {
  return deepFreeze(detachedJsonSnapshot(BUNDLED_DOCUMENTS)) as Readonly<DesignLibraryDocuments>;
}
