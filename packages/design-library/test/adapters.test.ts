import { describe, expect, it } from "vitest";
import {
  adaptMotorCapacitor,
  adaptMotorGateDriver,
  adaptMotorIntegratedBridge,
  adaptMotorMosfet,
  adaptMotorResistor,
  adaptMotorShunt,
  adaptPowerCapacitor,
  adaptPowerExternalController,
  adaptPowerInductor,
  adaptPowerIntegratedRegulator,
  adaptPowerMosfet,
  adaptPowerResistor,
  validateDesignProfile,
  validateProfileAdmissionRules,
  type MotorCapacitorStagedProfile,
  type MotorGateDriverStagedProfile,
  type MotorIntegratedBridgeStagedProfile,
  type MotorMosfetStagedProfile,
  type MotorResistorStagedProfile,
  type MotorShuntStagedProfile,
  type PowerCapacitorStagedProfile,
  type PowerExternalControllerStagedProfile,
  type PowerInductorStagedProfile,
  type PowerIntegratedRegulatorStagedProfile,
  type PowerMosfetStagedProfile,
  type PowerResistorStagedProfile,
} from "../src";
import { SYNTHETIC_MANUFACTURER_REGISTRY } from "../src/fixtures";

const stagedEvidence = [{
  sourceId: "schemagic.synthetic.adapter-fixture",
  locator: "design-library staged adapter regression",
  licenseNote: "Synthetic test data; not a real part claim.",
}];

const motorMosfet: MotorMosfetStagedProfile = {
  id: "motor.fixture.mosfet.synthetic",
  kind: "mosfet",
  state: "synthetic_test_fixture",
  evidence: stagedEvidence,
  part: { manufacturerId: "schemagic-synthetic-components", manufacturerPartNumber: "SYN-MOSFET" },
  packageName: "SYN-QFN",
  boardAreaM2: 20e-6,
  drainSourceMaximumV: 80,
  continuousCurrentA: 20,
  pulsedCurrentA: 60,
  rdsOnOhm: 0.01,
  rdsOnGateVoltageV: 10,
  rdsOnTestCurrentA: 5,
  totalGateChargeC: 30e-9,
  thetaJaKPerW: 40,
  maximumJunctionTemperatureK: 423.15,
};

const motorCapacitor: MotorCapacitorStagedProfile = {
  id: "motor.fixture.capacitor.synthetic",
  kind: "capacitor",
  state: "synthetic_test_fixture",
  evidence: stagedEvidence,
  role: "bulk",
  part: { manufacturerId: "schemagic-synthetic-components", manufacturerPartNumber: "SYN-CAP" },
  packageName: "SYN-RADIAL",
  boardAreaM2: 50e-6,
  nominalCapacitanceF: 470e-6,
  effectiveCapacitanceF: 400e-6,
  ratedVoltageV: 50,
};

const powerCapacitor: PowerCapacitorStagedProfile = {
  profileId: "power.fixture.capacitor.synthetic",
  profileKind: "synthetic_test_fixture",
  evidence: stagedEvidence,
  displayName: "Synthetic input capacitor",
  role: "input",
  part: { manufacturerId: "schemagic-synthetic-components", manufacturerPartNumber: "SYN-POWER-CAP" },
  areaM2: 10e-6,
  nominalCapacitanceF: 10e-6,
  effectiveCapacitanceF: 5e-6,
  estimatedBiasDeratingRatio: 0.5,
  voltageRatingV: 25,
  esrOhm: 0.01,
  rippleCurrentA: 2,
};

describe("explicit staged adapters", () => {
  it("preserves staged values but can never imply reviewed admission", () => {
    const result = adaptMotorMosfet(motorMosfet);
    expect(result).toMatchObject({ admissionState: "authored", sourceKind: "synthetic_test_fixture" });
    expect(result.profile.facts.drainSourceVoltage.value?.value).toBe(80);
    expect(result.profile.facts.onResistance.value?.value).toBe(0.01);
    expect(result.profile.facts.onResistance.validFor.map((range) => range.parameterId)).toEqual(["gateVoltage", "drainCurrent"]);
    expect(result.profile.facts.totalGateCharge.value?.unit).toBe("C");
    expect(result.profile.facts.pulsedDrainCurrent.state).toBe("estimated");
    expect(result.profile.facts.riseTime.state).toBe("unknown");
    expect(result.profile.facts.drainSourceVoltage.evidence[0]).toMatchObject(stagedEvidence[0]!);
    expect(result.profile.facts.drainSourceVoltage.evidence[0]).toMatchObject({
      kind: "synthetic_fixture", retrievedAt: null, contentHash: null, url: null, revision: null, publicationBasis: null,
    });
    expect(JSON.stringify(result.profile)).not.toMatch(/example\.invalid|original_measurement/);
    expect(validateDesignProfile(result.profile, SYNTHETIC_MANUFACTURER_REGISTRY)).toEqual([]);
    expect(validateProfileAdmissionRules(result.profile).length).toBeGreaterThan(0);
  });

  it("rejects ambiguous capacitor role mapping instead of inferring a physical class", () => {
    expect(() => adaptMotorCapacitor(motorCapacitor)).toThrow(/ambiguous staged capacitor/i);
    expect(() => adaptPowerCapacitor(powerCapacitor)).toThrow(/ambiguous staged capacitor/i);
    expect(adaptMotorCapacitor(motorCapacitor, "shared.bulk-capacitor").profile.partClass).toBe("shared.bulk-capacitor");
    const adaptedPower = adaptPowerCapacitor(powerCapacitor, "shared.mlcc-capacitor").profile;
    expect(adaptedPower.partClass).toBe("shared.mlcc-capacitor");
    expect(adaptedPower.facts.biasDeratingRatio.value?.value).toBe(0.5);
    expect(adaptedPower.facts.biasDeratingRatio.evidence[0]).toMatchObject(stagedEvidence[0]!);
    expect((adaptedPower.facts as any).temperatureCharacteristic.state).toBe("unknown");
    expect((adaptedPower.facts as any).temperatureCharacteristic.value).toBeNull();
  });

  it("maps every staged source type to valid but non-reviewed profiles", () => {
    const part = { manufacturerId: "schemagic-synthetic-components", manufacturerPartNumber: "SYN-STAGED" };
    const motorBase = { id: "motor.fixture.all", state: "synthetic_test_fixture" as const, part, packageName: "SYN-QFN", boardAreaM2: 1e-6, evidence: stagedEvidence };
    const powerBase = { profileId: "power.fixture.all", profileKind: "synthetic_test_fixture" as const, displayName: "Synthetic staged source", part, areaM2: 1e-6, evidence: stagedEvidence };
    const integrated: MotorIntegratedBridgeStagedProfile = {
      ...motorBase, kind: "integrated_bridge", supplyMinimumV: 5, supplyMaximumV: 20, absoluteMaximumV: 24,
      continuousCurrentA: 2, peakCurrentA: 5, currentLimitMinimumA: 1, currentLimitMaximumA: 4,
      logicHighMaximumV: 2, pwmMaximumHz: 50_000, minimumPulseWidthS: 1e-6, pathResistanceOhm: 0.1,
      switchingTransitionTimeS: 1e-8, quiescentCurrentA: 1e-3, thetaJaKPerW: 40, maximumJunctionTemperatureK: 423,
      highSideSupply: "charge_pump", maximumHighSideDutyCycle: 0.95, localDecouplingMinimumF: 1e-6, bulkCapacitanceMinimumF: 100e-6,
    };
    const gateDriver: MotorGateDriverStagedProfile = {
      ...motorBase, kind: "gate_driver", supplyMinimumV: 5, supplyMaximumV: 20, absoluteMaximumV: 24, logicHighMaximumV: null,
      pwmMaximumHz: 50_000, minimumPulseWidthS: 1e-6, sourceCurrentA: 1, sinkCurrentA: 1, gateVoltageV: 10, deadTimeS: 1e-7,
      bootstrapMaximumDutyCycle: 0.9, bootstrapAllowedRippleV: null, bootstrapOverheadChargeC: 1e-9,
      quiescentCurrentA: 1e-3, thetaJaKPerW: 40, maximumJunctionTemperatureK: 423, senseMaximumVoltageV: 1, localDecouplingMinimumF: 1e-6,
    };
    const motorResistor: MotorResistorStagedProfile = { ...motorBase, kind: "resistor", role: "gate", resistanceOhm: 10, ratedPowerW: 0.25 };
    const motorShunt: MotorShuntStagedProfile = { ...motorBase, kind: "shunt", resistanceOhm: 0.01, continuousPowerW: 1, pulsePowerW: 5 };
    const primary = {
      ...powerBase, inputVoltageMinV: 5, inputVoltageMaxV: 24, outputVoltageMinV: 1, outputVoltageMaxV: 12,
      outputCurrentMaxA: 3, currentLimitA: 4, switchingFrequencyMinHz: 100_000, switchingFrequencyRecommendedHz: 500_000,
      switchingFrequencyMaxHz: 1_000_000, minimumOnTimeS: 1e-7, minimumOffTimeS: 1e-7, feedbackReferenceV: 0.8,
      quiescentCurrentA: 1e-3, thermalResistanceKPerW: 40, maximumJunctionTemperatureK: 423,
      controlEvidence: "synthetic_bounded_model" as const,
    };
    const regulator: PowerIntegratedRegulatorStagedProfile = { ...primary, topology: "integrated", highSideResistanceOhm: 0.05, lowSideResistanceOhm: 0.03, riseTimeS: 1e-8, fallTimeS: 1e-8 };
    const controller: PowerExternalControllerStagedProfile = { ...primary, topology: "external-controller", gateDriveVoltageV: 10, gateSourceCurrentA: 1, gateSinkCurrentA: 1, controllerLossW: 0.1, currentSenseThresholdTypicalV: 0.05 };
    const powerMosfet: PowerMosfetStagedProfile = { ...powerBase, drainSourceVoltageV: 40, continuousCurrentA: 10, resistanceOhm: 0.01, resistanceGateVoltageV: 10, resistanceTestCurrentA: 5, totalGateChargeC: 1e-8, riseTimeS: 1e-8, fallTimeS: 1e-8, thermalResistanceKPerW: 40, maximumJunctionTemperatureK: 423 };
    const inductor: PowerInductorStagedProfile = { ...powerBase, inductanceH: 1e-5, saturationCurrentA: 5, rmsCurrentA: 3, dcResistanceOhm: 0.01, coreLossWAtFixturePoint: null, inductanceTestCurrentA: 1, inductanceTestFrequencyHz: 100_000, dcResistanceTemperatureK: 298.15, currentRatingTemperatureK: 298.15 };
    const powerResistor: PowerResistorStagedProfile = { ...powerBase, resistanceOhm: 10_000, toleranceRatio: 0.01, voltageRatingV: 50, powerRatingW: 0.25 };
    const results = [
      adaptMotorIntegratedBridge(integrated), adaptMotorGateDriver(gateDriver), adaptMotorResistor(motorResistor), adaptMotorShunt(motorShunt),
      adaptPowerIntegratedRegulator(regulator), adaptPowerExternalController(controller), adaptPowerMosfet(powerMosfet), adaptPowerInductor(inductor), adaptPowerResistor(powerResistor),
    ];
    for (const result of results) {
      expect(validateDesignProfile(result.profile, SYNTHETIC_MANUFACTURER_REGISTRY), result.profile.partClass).toEqual([]);
      expect(result.admissionState).toBe("authored");
      expect(validateProfileAdmissionRules(result.profile).length, result.profile.partClass).toBeGreaterThan(0);
    }
    const adaptedController = adaptPowerExternalController(controller).profile;
    expect(adaptedController.facts).not.toHaveProperty("outputCurrentMaximum");
    expect(adaptedController.facts).not.toHaveProperty("currentLimit");
    expect(adaptedController.facts.currentSenseThresholdTypical.value?.value).toBe(0.05);
    const adaptedInductor = adaptPowerInductor(inductor).profile;
    expect(adaptedInductor.facts.inductance.validFor.map((range) => range.parameterId)).toEqual(["testCurrent", "switchingFrequency"]);
    expect(adaptedInductor.facts.dcResistance.validFor[0]?.parameterId).toBe("ambientTemperature");
  });

  it("preserves supplied staged provenance byte-for-byte without filling absent fields", () => {
    const supplied = {
      ...motorMosfet,
      evidence: [{
        ...stagedEvidence[0]!,
        retrievedAt: "2025-01-02T03:04:05Z",
        contentHash: `sha256:${"a".repeat(64)}`,
      }],
    };
    const evidence = adaptMotorMosfet(supplied).profile.facts.onResistance.evidence[0]!;
    expect(evidence).toMatchObject({
      sourceId: supplied.evidence[0]!.sourceId, locator: supplied.evidence[0]!.locator,
      licenseNote: supplied.evidence[0]!.licenseNote, retrievedAt: supplied.evidence[0]!.retrievedAt,
      contentHash: supplied.evidence[0]!.contentHash,
    });
    expect(evidence).toMatchObject({ kind: "synthetic_fixture", url: null, revision: null, publicationBasis: null });
    expect(() => adaptMotorMosfet({ ...motorMosfet, evidence: [{ ...stagedEvidence[0]!, retrievedAt: "not-a-time" }] })).toThrow(/retrievedAt/);
    expect(() => adaptMotorMosfet({ ...motorMosfet, evidence: [{ ...stagedEvidence[0]!, contentHash: "provider-hash" }] })).toThrow(/contentHash/);
  });
});
