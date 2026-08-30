import type { CircuitComponent, CircuitDocument, CircuitWire, Point } from "@opencircuit/circuit-schema";
import type { CandidateForMaterialization } from "@opencircuit/design-engine";
import type { BrushedDcMotorDesignRequest, SelectedComponent } from "@opencircuit/design-schema";
import { motorProfileById } from "./catalog";
import { deriveBehavioralMotorLoad } from "./motor-load";
import type { CapacitorProfile, ShuntProfile } from "./profile";

export type MotorTopology = "external-nmos" | "integrated";

function selected(candidate: Readonly<CandidateForMaterialization>, role: string): SelectedComponent {
  const component = candidate.components.find((entry) => entry.role === role);
  if (!component) throw new Error(`Motor candidate is missing the ${role} component`);
  return component;
}

function capacitor(candidate: Readonly<CandidateForMaterialization>, role: string): {
  component: SelectedComponent;
  profile: CapacitorProfile;
} {
  const component = selected(candidate, role);
  const profile = motorProfileById(component.profileId);
  if (profile.kind !== "capacitor") throw new Error(`${component.profileId} is not a capacitor profile`);
  return { component, profile };
}

function label(text: string, offset: Point = [0, -3]) {
  return { text, offset };
}

function behavioralSwitch(
  id: string,
  pos: Point,
  closed: boolean,
  topology: MotorTopology,
  driver: SelectedComponent,
  switchBinding: SelectedComponent,
  text: string,
): CircuitComponent {
  return {
    id,
    type: "switch_spst",
    pos,
    rot: 90,
    mirror: false,
    ...(topology === "external-nmos"
      ? { mpn: switchBinding.part.manufacturerPartNumber }
      : {}),
    params: {
      closed,
      behavioralRole: topology === "integrated" ? "integrated-bridge-internal-switch" : "external-nmos-static-switch",
      switchBindingId: switchBinding.id,
      switchBindingProfileId: switchBinding.profileId,
      driverId: driver.id,
      driverProfileId: driver.profileId,
      representedQuantityPerAssembly: switchBinding.quantityPerAssembly,
      evidenceState: "synthetic_test_fixture",
      limitation: "Static 1 mΩ/1 GΩ operating-point switch; no gate-controlled PWM behavior",
      omittedControlBomRoles: topology === "external-nmos"
        ? ["h-bridge-driver", "gate-resistor", "gate-source-pulldown", "bootstrap-capacitor"]
        : [],
    },
    label: label(text, [3, 0]),
  };
}

function wire(id: string, points: Point[]): CircuitWire {
  return { id, points };
}

export function materializeBehavioralMotorCircuit(
  candidate: Readonly<CandidateForMaterialization>,
  request: Readonly<BrushedDcMotorDesignRequest>,
  topology: MotorTopology,
): CircuitDocument {
  const driver = selected(candidate, "h-bridge-driver");
  const switchBinding = topology === "external-nmos" ? selected(candidate, "bridge-nmos") : driver;
  const local = capacitor(candidate, "local-decoupling");
  const bulk = capacitor(candidate, "supply-bulk-capacitance");
  const motorLoad = deriveBehavioralMotorLoad(request);
  const operatingBackEmf = motorLoad.operatingPointBackEmf.value;
  if (!motorLoad.scenarioEligibility.pwmLoadedSteadyState || operatingBackEmf === null) {
    throw new Error("The declared operating point cannot be materialized as a non-negative averaged back-EMF load");
  }

  const averageBridgeVoltageV = request.requirements.supplyVoltage.nominal.value
    * request.requirements.operatingPoint.dutyCycle.value;
  const components: CircuitComponent[] = [
    {
      id: "v-bridge-average",
      type: "vsource",
      value: averageBridgeVoltageV,
      pos: [0, 10],
      rot: 0,
      mirror: false,
      params: {
        behavioralRole: "averaged-pwm-bridge-rail",
        nominalSupplyV: request.requirements.supplyVoltage.nominal.value,
        dutyCycle: request.requirements.operatingPoint.dutyCycle.value,
        equationId: "motor.behavioral.average-bridge-voltage.v1",
        limitation: "Independent DC source represents nominal supply multiplied by duty; switching edges are not simulated",
      },
      label: label("VBRIDGE(avg)", [-8, 0]),
    },
    { id: "gnd", type: "ground", pos: [0, 20], rot: 0, mirror: false },
    behavioralSwitch("s-high-left", [12, 4], true, topology, driver, switchBinding, "HIGH-L (on)"),
    behavioralSwitch("s-low-left", [12, 16], false, topology, driver, switchBinding, "LOW-L (off)"),
    behavioralSwitch("s-high-right", [36, 4], false, topology, driver, switchBinding, "HIGH-R (off)"),
    behavioralSwitch("s-low-right", [36, 16], true, topology, driver, switchBinding, "LOW-R (on)"),
    {
      id: "r-motor-winding",
      type: "resistor",
      value: request.requirements.motorModel.windingResistance.value,
      pos: [18, 10],
      rot: 0,
      mirror: false,
      params: {
        behavioralRole: "motor-winding-resistance",
        evidenceState: motorLoad.windingResistance.state,
        source: request.requirements.motorModel.windingResistanceSource,
      },
      label: label("MOTOR Rw"),
    },
    {
      id: "v-motor-back-emf",
      type: "vsource",
      value: operatingBackEmf.value,
      pos: [32, 10],
      rot: 270,
      mirror: false,
      params: {
        behavioralRole: "motor-operating-point-back-emf",
        evidenceState: motorLoad.operatingPointBackEmf.state,
        equationId: motorLoad.operatingPointBackEmf.state === "estimated"
          ? "motor.behavioral.operating-point-closure.v1"
          : "motor.model.target-back-emf.v1",
        limitation: motorLoad.operatingPointBackEmf.explanation,
      },
      label: label("MOTOR back-EMF(op)"),
    },
    {
      id: "c-local",
      type: "capacitor",
      mpn: local.component.part.manufacturerPartNumber,
      value: local.profile.effectiveCapacitanceF,
      pos: [44, 10],
      rot: 90,
      mirror: false,
      params: {
        behavioralRole: "local-decoupling",
        designProfileId: local.component.profileId,
        nominalCapacitanceF: local.profile.nominalCapacitanceF,
        evidenceState: "synthetic_test_fixture",
      },
      label: label("CLOCAL(effective)", [4, 0]),
    },
    {
      id: "c-bulk",
      type: "capacitor",
      mpn: bulk.component.part.manufacturerPartNumber,
      value: bulk.profile.effectiveCapacitanceF,
      pos: [50, 10],
      rot: 90,
      mirror: false,
      params: {
        behavioralRole: "supply-bulk-capacitance",
        designProfileId: bulk.component.profileId,
        nominalCapacitanceF: bulk.profile.nominalCapacitanceF,
        evidenceState: "synthetic_test_fixture",
      },
      label: label("CBULK(effective)", [4, 0]),
    },
  ];

  const windingInductance = request.requirements.motorModel.windingInductance;
  if (windingInductance !== null) {
    components.push({
      id: "l-motor-winding",
      type: "inductor",
      value: windingInductance.value,
      pos: [25, 10],
      rot: 0,
      mirror: false,
      params: { behavioralRole: "motor-winding-inductance", evidenceState: "calculated" },
      label: label("MOTOR Lw"),
    });
  }

  const wires: CircuitWire[] = [
    wire("w-source-negative", [[0, 12], [0, 20]]),
    wire("w-top-rail", [[0, 8], [0, 0], [12, 0], [36, 0], [44, 0], [50, 0]]),
    wire("w-high-left-rail", [[12, 0], [12, 2]]),
    wire("w-high-left-output", [[12, 6], [12, 10]]),
    wire("w-low-left-output", [[12, 10], [12, 14]]),
    wire("w-high-right-rail", [[36, 0], [36, 2]]),
    wire("w-high-right-output", [[36, 6], [36, 10]]),
    wire("w-low-right-output", [[36, 10], [36, 14]]),
    wire("w-motor-left", [[12, 10], [16, 10]]),
    wire("w-motor-emf-right", [[34, 10], [36, 10]]),
    wire("w-local-positive", [[44, 8], [44, 0]]),
    wire("w-local-negative", [[44, 12], [44, 20]]),
    wire("w-bulk-positive", [[50, 8], [50, 0]]),
    wire("w-bulk-negative", [[50, 12], [50, 20]]),
  ];

  if (windingInductance === null) {
    wires.push(wire("w-motor-r-to-emf", [[20, 10], [30, 10]]));
  } else {
    wires.push(
      wire("w-motor-r-to-l", [[20, 10], [23, 10]]),
      wire("w-motor-l-to-emf", [[27, 10], [30, 10]]),
    );
  }

  if (topology === "external-nmos") {
    const shuntComponent = selected(candidate, "current-sense-shunt");
    const shuntProfile = motorProfileById(shuntComponent.profileId);
    if (shuntProfile.kind !== "shunt") throw new Error(`${shuntComponent.profileId} is not a shunt profile`);
    const typedShunt: ShuntProfile = shuntProfile;
    components.push({
      id: "r-current-shunt",
      type: "resistor",
      mpn: shuntComponent.part.manufacturerPartNumber,
      value: typedShunt.resistanceOhm,
      pos: [6, 20],
      rot: 0,
      mirror: false,
      params: {
        behavioralRole: "current-sense-shunt",
        designProfileId: shuntComponent.profileId,
        evidenceState: "synthetic_test_fixture",
      },
      label: label("RSHUNT"),
    });
    wires.push(
      wire("w-ground-to-shunt", [[0, 20], [4, 20]]),
      wire("w-bottom-rail", [[8, 20], [12, 20], [36, 20], [44, 20], [50, 20]]),
    );
  } else {
    wires.push(wire("w-bottom-rail", [[0, 20], [12, 20], [36, 20], [44, 20], [50, 20]]));
  }
  wires.push(
    wire("w-low-left-rail", [[12, 18], [12, 20]]),
    wire("w-low-right-rail", [[36, 18], [36, 20]]),
  );

  return {
    format: "opencircuit-circuit",
    version: 1,
    meta: {
      title: `scheMAGIC Motor Designer behavioral ${topology === "integrated" ? "integrated" : "external-NMOS"} H-bridge — ${driver.part.manufacturerPartNumber}`,
      description: "Editable averaged operating-point model: static ideal bridge switches, effective capacitors, winding R/L where supplied, and an explicit operating-point back-EMF source. It does not model PWM edges, selected-part silicon, speed/torque dynamics, protection, thermal behavior, or PCB parasitics. Gate-driver control, gate resistors, pull-downs, and bootstrap parts remain in the candidate BOM but are not representable on these static two-terminal switches.",
    },
    components,
    wires,
    probes: [
      { id: "probe-bridge-output", kind: "voltage", target: { componentPin: ["r-motor-winding", 0] }, color: "#1B9350" },
      { id: "probe-motor-return", kind: "voltage", target: { componentPin: ["v-motor-back-emf", 1] }, color: "#EA8C2A" },
      { id: "probe-motor-current", kind: "current", target: { componentPin: ["r-motor-winding", 0] }, color: "#2457D6" },
      { id: "probe-supply-current", kind: "current", target: { componentPin: ["v-bridge-average", 0] }, color: "#A43EBB" },
    ],
    sim: { mode: "op" },
    view: { pan: [4, 2], zoom: 1 },
  };
}
