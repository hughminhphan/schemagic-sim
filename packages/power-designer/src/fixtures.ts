import type { DesignGeneration } from "@opencircuit/design-engine";
import type { BuckDesignRequest } from "@opencircuit/design-schema";
import { generateBuckDesign } from "./generate";

export function createP1CompactRequest(): BuckDesignRequest {
  return {
    format: "schemagic-design-request",
    schemaVersion: 1,
    application: "power.buck",
    requirements: {
      inputVoltage: {
        minimum: { value: 9, unit: "V", displayUnit: "V" },
        nominal: { value: 12, unit: "V", displayUnit: "V" },
        maximum: { value: 16, unit: "V", displayUnit: "V" },
      },
      outputVoltage: { value: 5, unit: "V", displayUnit: "V" },
      maximumOutputCurrent: { value: 3, unit: "A", displayUnit: "A" },
      ambientTemperature: { value: 313.15, unit: "K", displayUnit: "°C" },
      switchingFrequency: {
        selection: "automatic",
        minimum: { value: 300_000, unit: "Hz", displayUnit: "kHz" },
        preferred: null,
        maximum: { value: 1_500_000, unit: "Hz", displayUnit: "MHz" },
      },
      maximumOutputRipple: { value: 0.03, unit: "V", displayUnit: "mV" },
      loadTransientTarget: null,
    },
    objective: "area",
    constraints: {
      allowedTopologyFamilies: ["power.buck.integrated-synchronous"],
      maximumJunctionTemperature: { value: 398.15, unit: "K", displayUnit: "°C" },
      allowedPackages: [],
      maximumComponentHeight: null,
      maximumBoardArea: null,
      allowEstimatedValues: true,
      allowUnknownWarnings: true,
      allowUnknownHardConstraints: false,
    },
    assumptions: [
      {
        id: "p1.automatic-frequency-range",
        description: "The fixture permits automatic switching-frequency selection from 300 kHz through 1.5 MHz and declares no hidden preferred value.",
        source: "fixture",
        affects: ["requirements.switchingFrequency"],
      },
      {
        id: "p1.no-transient-target",
        description: "No numeric load-transient target is imposed; device-supported transient simulations may still be reported without a pass claim.",
        source: "fixture",
        affects: ["requirements.loadTransientTarget", "load_step"],
      },
      {
        id: "p1.thermal-ceiling",
        description: "The reference fixture uses a 125 °C maximum estimated junction temperature.",
        source: "fixture",
        affects: ["constraints.maximumJunctionTemperature"],
      },
      {
        id: "p1.no-mechanical-limits",
        description: "Package, component-height, and board-area filters are deliberately unrestricted for this electrical reference.",
        source: "fixture",
        affects: ["constraints.allowedPackages", "constraints.maximumComponentHeight", "constraints.maximumBoardArea"],
      },
      {
        id: "p1.no-sourcing-policy",
        description: "This electrical reference request deliberately omits live sourcing; sourcing behavior is covered by separate synthetic fixtures.",
        source: "fixture",
        affects: ["sourcing"],
      },
    ],
    libraryVersion: "designer-v1-reference.1",
  };
}

export function createP2HighVoltageRequest(): BuckDesignRequest {
  return {
    format: "schemagic-design-request",
    schemaVersion: 1,
    application: "power.buck",
    requirements: {
      inputVoltage: {
        minimum: { value: 36, unit: "V", displayUnit: "V" },
        nominal: { value: 48, unit: "V", displayUnit: "V" },
        maximum: { value: 52, unit: "V", displayUnit: "V" },
      },
      outputVoltage: { value: 12, unit: "V", displayUnit: "V" },
      maximumOutputCurrent: { value: 5, unit: "A", displayUnit: "A" },
      ambientTemperature: { value: 323.15, unit: "K", displayUnit: "°C" },
      switchingFrequency: {
        selection: "automatic",
        minimum: { value: 100_000, unit: "Hz", displayUnit: "kHz" },
        preferred: null,
        maximum: { value: 600_000, unit: "Hz", displayUnit: "kHz" },
      },
      maximumOutputRipple: { value: 0.1, unit: "V", displayUnit: "mV" },
      loadTransientTarget: null,
    },
    objective: "efficiency",
    constraints: {
      allowedTopologyFamilies: ["power.buck.controller-external-nmos"],
      maximumJunctionTemperature: { value: 398.15, unit: "K", displayUnit: "°C" },
      allowedPackages: [],
      maximumComponentHeight: null,
      maximumBoardArea: null,
      allowEstimatedValues: true,
      allowUnknownWarnings: true,
      allowUnknownHardConstraints: false,
    },
    assumptions: [
      {
        id: "p2.automatic-frequency-range",
        description: "The fixture permits automatic switching-frequency selection from 100 kHz through 600 kHz and declares no hidden preferred value.",
        source: "fixture",
        affects: ["requirements.switchingFrequency"],
      },
      {
        id: "p2.no-transient-target",
        description: "No numeric load-transient target is imposed; device-supported transient simulations may still be reported without a pass claim.",
        source: "fixture",
        affects: ["requirements.loadTransientTarget", "load_step"],
      },
      {
        id: "p2.thermal-ceiling",
        description: "The reference fixture uses a 125 °C maximum estimated junction temperature.",
        source: "fixture",
        affects: ["constraints.maximumJunctionTemperature"],
      },
      {
        id: "p2.no-mechanical-limits",
        description: "Package, component-height, and board-area filters are deliberately unrestricted for this electrical reference.",
        source: "fixture",
        affects: ["constraints.allowedPackages", "constraints.maximumComponentHeight", "constraints.maximumBoardArea"],
      },
      {
        id: "p2.no-sourcing-policy",
        description: "This electrical reference request deliberately omits live sourcing; sourcing behavior is covered by separate synthetic fixtures.",
        source: "fixture",
        affects: ["sourcing"],
      },
    ],
    libraryVersion: "designer-v1-reference.1",
  };
}

export function generateP1CompactFixture(): DesignGeneration {
  return generateBuckDesign(createP1CompactRequest());
}

export function generateP2HighVoltageFixture(): DesignGeneration {
  return generateBuckDesign(createP2HighVoltageRequest());
}
