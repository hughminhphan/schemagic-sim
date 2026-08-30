import { contentHash } from "@opencircuit/design-engine";
import { syntheticProfileEvidence } from "./evidence";
import type {
  CapacitorProfile,
  GateDriverProfile,
  IntegratedBridgeProfile,
  MosfetProfile,
  MotorComponentProfile,
  MotorFixtureCatalog,
  ResistorProfile,
  ShuntProfile,
} from "./profile";

const state = "synthetic_test_fixture" as const;

function part(manufacturerId: string, manufacturerPartNumber: string) {
  return { manufacturerId, manufacturerPartNumber };
}

function integrated(profile: Omit<IntegratedBridgeProfile, "evidence" | "kind" | "state">): IntegratedBridgeProfile {
  return { ...profile, kind: "integrated_bridge", state, evidence: syntheticProfileEvidence(profile.id) };
}

function gateDriver(profile: Omit<GateDriverProfile, "evidence" | "kind" | "state">): GateDriverProfile {
  return { ...profile, kind: "gate_driver", state, evidence: syntheticProfileEvidence(profile.id) };
}

function mosfet(profile: Omit<MosfetProfile, "evidence" | "kind" | "state">): MosfetProfile {
  return { ...profile, kind: "mosfet", state, evidence: syntheticProfileEvidence(profile.id) };
}

function capacitor(profile: Omit<CapacitorProfile, "evidence" | "kind" | "state">): CapacitorProfile {
  return { ...profile, kind: "capacitor", state, evidence: syntheticProfileEvidence(profile.id) };
}

function resistor(profile: Omit<ResistorProfile, "evidence" | "kind" | "state">): ResistorProfile {
  return { ...profile, kind: "resistor", state, evidence: syntheticProfileEvidence(profile.id) };
}

function shunt(profile: Omit<ShuntProfile, "evidence" | "kind" | "state">): ShuntProfile {
  return { ...profile, kind: "shunt", state, evidence: syntheticProfileEvidence(profile.id) };
}

export const MOTOR_LIBRARY_VERSION = "designer-v1-reference.1";

export const SYNTHETIC_MOTOR_CATALOG: MotorFixtureCatalog = {
  version: MOTOR_LIBRARY_VERSION,
  integratedBridges: [
    integrated({
      id: "motor.fixture.integrated.alpha",
      part: part("schemagic-synthetic-alpha", "SYNTHETIC-ALPHA-INTEGRATED-A"),
      packageName: "SYN-QFN-24",
      boardAreaM2: 45e-6,
      supplyMinimumV: 4.5,
      supplyMaximumV: 18,
      absoluteMaximumV: 24,
      continuousCurrentA: 2.5,
      peakCurrentA: 6.5,
      currentLimitMinimumA: 0.5,
      currentLimitMaximumA: 6,
      logicHighMaximumV: 2,
      pwmMaximumHz: 60_000,
      minimumPulseWidthS: 0.5e-6,
      pathResistanceOhm: 0.16,
      switchingTransitionTimeS: 100e-9,
      quiescentCurrentA: 0.003,
      thetaJaKPerW: 42,
      maximumJunctionTemperatureK: 423.15,
      highSideSupply: "charge_pump",
      maximumHighSideDutyCycle: 0.95,
      localDecouplingMinimumF: 1e-6,
      bulkCapacitanceMinimumF: 220e-6,
    }),
    integrated({
      id: "motor.fixture.integrated.beta",
      part: part("schemagic-synthetic-beta", "SYNTHETIC-BETA-INTEGRATED-B"),
      packageName: "SYN-QFN-20",
      boardAreaM2: 30e-6,
      supplyMinimumV: 6,
      supplyMaximumV: 20,
      absoluteMaximumV: 28,
      continuousCurrentA: 2.2,
      peakCurrentA: 7,
      currentLimitMinimumA: 0.8,
      currentLimitMaximumA: 6.5,
      logicHighMaximumV: 2.2,
      pwmMaximumHz: 50_000,
      minimumPulseWidthS: 0.75e-6,
      pathResistanceOhm: 0.22,
      switchingTransitionTimeS: 70e-9,
      quiescentCurrentA: 0.002,
      thetaJaKPerW: 38,
      maximumJunctionTemperatureK: 423.15,
      highSideSupply: "charge_pump",
      maximumHighSideDutyCycle: 0.94,
      localDecouplingMinimumF: 1e-6,
      bulkCapacitanceMinimumF: 220e-6,
    }),
    integrated({
      id: "motor.fixture.integrated.rejected-low-voltage",
      part: part("schemagic-synthetic-gamma", "SYNTHETIC-GAMMA-INTEGRATED-REJECT"),
      packageName: "SYN-QFN-16",
      boardAreaM2: 24e-6,
      supplyMinimumV: 4.5,
      supplyMaximumV: 14,
      absoluteMaximumV: 16,
      continuousCurrentA: 1.2,
      peakCurrentA: 3,
      currentLimitMinimumA: 0.3,
      currentLimitMaximumA: 2.5,
      logicHighMaximumV: 2,
      pwmMaximumHz: 30_000,
      minimumPulseWidthS: 1e-6,
      pathResistanceOhm: 0.25,
      switchingTransitionTimeS: 120e-9,
      quiescentCurrentA: 0.002,
      thetaJaKPerW: 48,
      maximumJunctionTemperatureK: 398.15,
      highSideSupply: "charge_pump",
      maximumHighSideDutyCycle: 0.9,
      localDecouplingMinimumF: 1e-6,
      bulkCapacitanceMinimumF: 220e-6,
    }),
  ],
  gateDrivers: [
    gateDriver({
      id: "motor.fixture.gate-driver.delta",
      part: part("schemagic-synthetic-delta", "SYNTHETIC-DELTA-GATE-DRIVER-A"),
      packageName: "SYN-QFN-32",
      boardAreaM2: 36e-6,
      supplyMinimumV: 8,
      supplyMaximumV: 35,
      absoluteMaximumV: 42,
      logicHighMaximumV: 2,
      pwmMaximumHz: 100_000,
      minimumPulseWidthS: 0.25e-6,
      sourceCurrentA: 1.5,
      sinkCurrentA: 2,
      gateVoltageV: 10,
      deadTimeS: 100e-9,
      bootstrapMaximumDutyCycle: 0.95,
      bootstrapAllowedRippleV: 0.2,
      bootstrapOverheadChargeC: 5e-9,
      quiescentCurrentA: 0.004,
      thetaJaKPerW: 60,
      maximumJunctionTemperatureK: 423.15,
      senseMaximumVoltageV: 0.25,
      localDecouplingMinimumF: 1e-6,
    }),
    gateDriver({
      id: "motor.fixture.gate-driver.epsilon",
      part: part("schemagic-synthetic-epsilon", "SYNTHETIC-EPSILON-GATE-DRIVER-B"),
      packageName: "SYN-TSSOP-28",
      boardAreaM2: 24e-6,
      supplyMinimumV: 10,
      supplyMaximumV: 40,
      absoluteMaximumV: 48,
      logicHighMaximumV: 2.2,
      pwmMaximumHz: 80_000,
      minimumPulseWidthS: 0.35e-6,
      sourceCurrentA: 1,
      sinkCurrentA: 1.5,
      gateVoltageV: 10,
      deadTimeS: 150e-9,
      bootstrapMaximumDutyCycle: 0.94,
      bootstrapAllowedRippleV: 0.25,
      bootstrapOverheadChargeC: 7e-9,
      quiescentCurrentA: 0.0025,
      thetaJaKPerW: 55,
      maximumJunctionTemperatureK: 423.15,
      senseMaximumVoltageV: 0.25,
      localDecouplingMinimumF: 1e-6,
    }),
    gateDriver({
      id: "motor.fixture.gate-driver.rejected-unknown-bootstrap",
      part: part("schemagic-synthetic-zeta", "SYNTHETIC-ZETA-GATE-DRIVER-REJECT"),
      packageName: "SYN-QFN-24",
      boardAreaM2: 22e-6,
      supplyMinimumV: 8,
      supplyMaximumV: 28,
      absoluteMaximumV: 32,
      logicHighMaximumV: null,
      pwmMaximumHz: 40_000,
      minimumPulseWidthS: 1e-6,
      sourceCurrentA: 0.5,
      sinkCurrentA: 0.5,
      gateVoltageV: 10,
      deadTimeS: 200e-9,
      bootstrapMaximumDutyCycle: 0.85,
      bootstrapAllowedRippleV: null,
      bootstrapOverheadChargeC: 10e-9,
      quiescentCurrentA: 0.003,
      thetaJaKPerW: 65,
      maximumJunctionTemperatureK: 398.15,
      senseMaximumVoltageV: 0.1,
      localDecouplingMinimumF: 1e-6,
    }),
  ],
  mosfets: [
    mosfet({
      id: "motor.fixture.mosfet.eta",
      part: part("schemagic-synthetic-eta", "SYNTHETIC-ETA-NMOS-60V"),
      packageName: "SYN-POWER-QFN-8",
      boardAreaM2: 70e-6,
      drainSourceMaximumV: 60,
      continuousCurrentA: 35,
      pulsedCurrentA: 90,
      rdsOnOhm: 0.01,
      rdsOnGateVoltageV: 10,
      totalGateChargeC: 55e-9,
      thetaJaKPerW: 50,
      maximumJunctionTemperatureK: 423.15,
    }),
    mosfet({
      id: "motor.fixture.mosfet.theta",
      part: part("schemagic-synthetic-theta", "SYNTHETIC-THETA-NMOS-80V"),
      packageName: "SYN-DFN-8",
      boardAreaM2: 45e-6,
      drainSourceMaximumV: 80,
      continuousCurrentA: 30,
      pulsedCurrentA: 75,
      rdsOnOhm: 0.014,
      rdsOnGateVoltageV: 10,
      totalGateChargeC: 32e-9,
      thetaJaKPerW: 55,
      maximumJunctionTemperatureK: 423.15,
    }),
    mosfet({
      id: "motor.fixture.mosfet.rejected-low-voltage",
      part: part("schemagic-synthetic-iota", "SYNTHETIC-IOTA-NMOS-25V-REJECT"),
      packageName: "SYN-SO-8",
      boardAreaM2: 35e-6,
      drainSourceMaximumV: 25,
      continuousCurrentA: 10,
      pulsedCurrentA: 15,
      rdsOnOhm: 0.008,
      rdsOnGateVoltageV: 10,
      totalGateChargeC: 25e-9,
      thetaJaKPerW: 60,
      maximumJunctionTemperatureK: 398.15,
    }),
  ],
  capacitors: [
    capacitor({
      id: "motor.fixture.capacitor.bootstrap-220nf",
      part: part("schemagic-synthetic-passive", "SYNTHETIC-BOOTSTRAP-220NF-25V"),
      packageName: "SYN-0805",
      boardAreaM2: 4e-6,
      role: "bootstrap",
      nominalCapacitanceF: 270e-9,
      effectiveCapacitanceF: 220e-9,
      ratedVoltageV: 25,
    }),
    capacitor({
      id: "motor.fixture.capacitor.bootstrap-330nf",
      part: part("schemagic-synthetic-passive", "SYNTHETIC-BOOTSTRAP-330NF-25V"),
      packageName: "SYN-1206",
      boardAreaM2: 6e-6,
      role: "bootstrap",
      nominalCapacitanceF: 390e-9,
      effectiveCapacitanceF: 330e-9,
      ratedVoltageV: 25,
    }),
    capacitor({
      id: "motor.fixture.capacitor.decoupling-1uf-25v",
      part: part("schemagic-synthetic-passive", "SYNTHETIC-DECOUPLING-1UF-25V"),
      packageName: "SYN-0805",
      boardAreaM2: 4e-6,
      role: "decoupling",
      nominalCapacitanceF: 1.5e-6,
      effectiveCapacitanceF: 1e-6,
      ratedVoltageV: 25,
    }),
    capacitor({
      id: "motor.fixture.capacitor.decoupling-1uf-50v",
      part: part("schemagic-synthetic-passive", "SYNTHETIC-DECOUPLING-1UF-50V"),
      packageName: "SYN-1206",
      boardAreaM2: 6e-6,
      role: "decoupling",
      nominalCapacitanceF: 1.5e-6,
      effectiveCapacitanceF: 1e-6,
      ratedVoltageV: 50,
    }),
    capacitor({
      id: "motor.fixture.capacitor.bulk-470uf-25v",
      part: part("schemagic-synthetic-passive", "SYNTHETIC-BULK-470UF-25V"),
      packageName: "SYN-RADIAL-8MM",
      boardAreaM2: 80e-6,
      role: "bulk",
      nominalCapacitanceF: 470e-6,
      effectiveCapacitanceF: 470e-6,
      ratedVoltageV: 25,
    }),
    capacitor({
      id: "motor.fixture.capacitor.bulk-1000uf-50v",
      part: part("schemagic-synthetic-passive", "SYNTHETIC-BULK-1000UF-50V"),
      packageName: "SYN-RADIAL-12MM",
      boardAreaM2: 150e-6,
      role: "bulk",
      nominalCapacitanceF: 1e-3,
      effectiveCapacitanceF: 1e-3,
      ratedVoltageV: 50,
    }),
  ],
  resistors: [
    resistor({
      id: "motor.fixture.resistor.gate-10ohm",
      part: part("schemagic-synthetic-passive", "SYNTHETIC-GATE-10R"),
      packageName: "SYN-0603",
      boardAreaM2: 2e-6,
      role: "gate",
      resistanceOhm: 10,
      ratedPowerW: 0.1,
    }),
    resistor({
      id: "motor.fixture.resistor.gate-pulldown-100k",
      part: part("schemagic-synthetic-passive", "SYNTHETIC-GATE-PULLDOWN-100K"),
      packageName: "SYN-0603",
      boardAreaM2: 2e-6,
      role: "gate_pulldown",
      resistanceOhm: 100_000,
      ratedPowerW: 0.1,
    }),
  ],
  shunts: [
    shunt({
      id: "motor.fixture.shunt.10mohm",
      part: part("schemagic-synthetic-passive", "SYNTHETIC-SHUNT-10M-3W"),
      packageName: "SYN-2512-KELVIN",
      boardAreaM2: 18e-6,
      resistanceOhm: 0.01,
      continuousPowerW: 3,
      pulsePowerW: 10,
    }),
  ],
};

function everyProfile(catalog: MotorFixtureCatalog): MotorComponentProfile[] {
  return [
    ...catalog.integratedBridges,
    ...catalog.gateDrivers,
    ...catalog.mosfets,
    ...catalog.capacitors,
    ...catalog.resistors,
    ...catalog.shunts,
  ];
}

function positive(profile: MotorComponentProfile, name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${profile.id}.${name} must be positive and finite`);
}

export function validateMotorFixtureCatalog(catalog: MotorFixtureCatalog): void {
  if (catalog.version !== MOTOR_LIBRARY_VERSION) throw new Error(`Unexpected motor fixture catalog version ${catalog.version}`);
  const ids = new Set<string>();
  const parts = new Set<string>();
  for (const profile of everyProfile(catalog)) {
    if (ids.has(profile.id)) throw new Error(`Duplicate motor fixture profile ID ${profile.id}`);
    ids.add(profile.id);
    const partKey = `${profile.part.manufacturerId}\u0000${profile.part.manufacturerPartNumber}`;
    if (parts.has(partKey)) throw new Error(`Duplicate synthetic manufacturer/MPN pair ${partKey}`);
    parts.add(partKey);
    if (profile.state !== "synthetic_test_fixture") throw new Error(`${profile.id} must remain synthetic_test_fixture`);
    if (!profile.part.manufacturerId.startsWith("schemagic-synthetic-")) throw new Error(`${profile.id} has a non-synthetic manufacturer ID`);
    if (!profile.part.manufacturerPartNumber.startsWith("SYNTHETIC-")) throw new Error(`${profile.id} has a non-synthetic MPN`);
    if (profile.evidence.length === 0 || profile.evidence.some((entry) => !entry.sourceId.startsWith("synthetic:"))) {
      throw new Error(`${profile.id} must have explicit synthetic evidence`);
    }
    positive(profile, "boardAreaM2", profile.boardAreaM2);
    if (profile.kind === "integrated_bridge" || profile.kind === "gate_driver") {
      positive(profile, "supplyMinimumV", profile.supplyMinimumV);
      positive(profile, "supplyMaximumV", profile.supplyMaximumV);
      positive(profile, "absoluteMaximumV", profile.absoluteMaximumV);
      if (!(profile.supplyMinimumV < profile.supplyMaximumV && profile.supplyMaximumV < profile.absoluteMaximumV)) {
        throw new Error(`${profile.id} has an inconsistent supply range`);
      }
    }
    if (profile.kind === "integrated_bridge") {
      positive(profile, "currentLimitMinimumA", profile.currentLimitMinimumA);
      positive(profile, "currentLimitMaximumA", profile.currentLimitMaximumA);
      if (profile.currentLimitMinimumA > profile.currentLimitMaximumA || profile.currentLimitMaximumA > profile.peakCurrentA) {
        throw new Error(`${profile.id} has an inconsistent current-limit range`);
      }
    }
    if (profile.kind === "mosfet") {
      positive(profile, "drainSourceMaximumV", profile.drainSourceMaximumV);
      positive(profile, "continuousCurrentA", profile.continuousCurrentA);
      positive(profile, "pulsedCurrentA", profile.pulsedCurrentA);
      if (profile.pulsedCurrentA < profile.continuousCurrentA) throw new Error(`${profile.id} pulsed current is below continuous current`);
      positive(profile, "rdsOnOhm", profile.rdsOnOhm);
      positive(profile, "totalGateChargeC", profile.totalGateChargeC);
    }
    if (profile.kind === "capacitor") {
      positive(profile, "nominalCapacitanceF", profile.nominalCapacitanceF);
      positive(profile, "effectiveCapacitanceF", profile.effectiveCapacitanceF);
      if (profile.effectiveCapacitanceF > profile.nominalCapacitanceF) throw new Error(`${profile.id} effective capacitance exceeds nominal`);
      positive(profile, "ratedVoltageV", profile.ratedVoltageV);
    }
    if (profile.kind === "resistor" || profile.kind === "shunt") positive(profile, "resistanceOhm", profile.resistanceOhm);
  }
}

validateMotorFixtureCatalog(SYNTHETIC_MOTOR_CATALOG);

export const MOTOR_CATALOG_CONTENT_HASH = contentHash(SYNTHETIC_MOTOR_CATALOG);

export function motorProfileById(id: string): MotorComponentProfile {
  const profile = everyProfile(SYNTHETIC_MOTOR_CATALOG).find((entry) => entry.id === id);
  if (!profile) throw new Error(`Unknown motor fixture profile ${id}`);
  return profile;
}
