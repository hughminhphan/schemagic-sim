import {
  PRODUCTION_STRICT_CONSTRAINT_POLICY_V3,
  type ConstraintPolicyRuleV3,
} from "@opencircuit/design-schema";
import {
  PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3_SCOPE_BOUNDARY,
  createProductionConstraintPolicyCatalogV3,
  productionConstraintPolicyRuleV3 as rule,
} from "./production-constraint-policy-v3-common";
import { MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31_TVS_VOLTAGE_QUALIFIED } from "./motor-external-v2";
import { MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_COMPANION_NETWORK_GATED } from "./motor-integrated-v32-companion-network-gated";

const MOTOR_EXTERNAL_V31_RULES: ConstraintPolicyRuleV3[] = [
  rule("motor.external.assembly.allowed-packages", "requirement", "conditional", "A specified package allowlist is a retained-candidate requirement when present."),
  rule("motor.external.assembly.board-area", "requirement", "conditional", "A specified board-area limit is a retained-candidate fit requirement when present."),
  rule("motor.external.assembly.component-height", "requirement", "conditional", "A specified component-height limit is a retained-candidate fit requirement when present."),
  rule("motor.external.bootstrap-capacitance", "safety", "required", "Unproved bootstrap charge and refresh margin can cause unsafe high-side switching."),
  rule("motor.external.bootstrap-capacitance-nominal", "safety", "required", "Each selected bootstrap MLCC must clear the exact driver's documented nominal floor before deeper adequacy is evaluated."),
  rule("motor.external.bulk-capacitance", "safety", "required", "Unproved bulk energy and transient support can expose the bridge to unsafe bus excursions."),
  rule("motor.external.bulk-voltage-rating", "safety", "required", "Bulk-capacitor voltage rating is an electrical overstress boundary."),
  rule("motor.external.capacitor-placement", "safety", "required", "Unproved bootstrap and local-decoupling placement or interconnect can invalidate driver-supply behavior."),
  rule("motor.external.current-sense-threshold", "safety", "required", "The implemented current threshold must be proved before protection can be relied upon."),
  rule("motor.external.driver-bias-source", "requirement", "required", "The selected architecture requires a compatible implemented driver-bias source."),
  rule("motor.external.driver-logic-threshold", "requirement", "required", "The logic rail must meet the driver's input threshold requirement."),
  rule("motor.external.driver-pulse-off-time", "requirement", "required", "Requested PWM off-time must satisfy the driver's timing requirement."),
  rule("motor.external.driver-pulse-on-time", "requirement", "required", "Requested PWM on-time must satisfy the driver's timing requirement."),
  rule("motor.external.driver-pwm-frequency", "requirement", "required", "Requested PWM frequency must remain within the driver's supported range."),
  rule("motor.external.driver-switch-node-absolute-maximum", "safety", "required", "The topology's nominal switch-node upper bound must remain below the driver's reviewed absolute maximum; transient stress is covered separately."),
  rule("motor.external.driver-switch-node-operating-maximum", "requirement", "required", "The topology's nominal switch-node upper bound must stay within the driver's reviewed operating range."),
  rule("motor.external.driver-switch-node-operating-minimum", "requirement", "required", "The topology's nominal switch-node lower bound must stay within the driver's reviewed operating range."),
  rule("motor.external.gate-network", "safety", "required", "Unproved gate control can permit shoot-through, excess dv/dt, or unintended turn-on."),
  rule("motor.external.high-side-duty", "requirement", "required", "The requested duty point must preserve the driver's high-side refresh requirement."),
  rule("motor.external.local-capacitance-effective", "safety", "required", "Effective VDD-local capacitance under implemented bias and temperature must be proved."),
  rule("motor.external.local-capacitance-nominal", "safety", "required", "Local driver-bias support must be sufficient to avoid unsafe switching behavior."),
  rule("motor.external.local-voltage-rating", "safety", "required", "Local-capacitor voltage rating is an electrical overstress boundary."),
  rule("motor.external.mosfet-continuous-current", "safety", "required", "Continuous-current capability is a semiconductor electrical and thermal safety boundary."),
  rule("motor.external.mosfet-pulsed-soa", "safety", "required", "Pulsed safe-operating-area coverage is required before stall transients can be safe."),
  rule("motor.external.mosfet-vds", "safety", "required", "MOSFET drain-source rating is an electrical overstress boundary."),
  rule("motor.external.passive-derating", "safety", "required", "Passive derating is required to bound heating, ripple, pulse stress, and lifetime."),
  rule("motor.external.request.motor-dynamics", "requirement", "required", "The requested motor operating behavior needs a bound dynamic model."),
  rule("motor.external.switching-and-loss", "safety", "required", "Switching and conduction losses must be bounded to prevent electrical and thermal overstress."),
  rule("motor.external.thermal", "safety", "required", "Actual junction temperatures must be proved below safe limits."),
  rule("motor.external.tvs-coordination", "safety", "required", "The suppression network and semiconductor stress limits must cover a common transient."),
  rule("motor.external.tvs-published-clamp-driver-switch-node-limit", "safety", "required", "The exact TVS's source-conditioned published clamp must remain below the gate driver's reviewed switch-node absolute limit."),
  rule("motor.external.tvs-published-clamp-mosfet-limit", "safety", "required", "The exact TVS's source-conditioned published clamp must remain below the MOSFET drain-source rating."),
  rule("motor.external.tvs-stand-off", "safety", "required", "TVS stand-off voltage must not conduct destructively during normal bus operation."),
];

const MOTOR_INTEGRATED_V32_RULES: ConstraintPolicyRuleV3[] = [
  rule("motor.integrated.assembly.allowed-packages", "requirement", "conditional", "A specified package allowlist is a retained-candidate requirement when present."),
  rule("motor.integrated.assembly.board-area", "requirement", "conditional", "A specified board-area limit is a retained-candidate fit requirement when present."),
  rule("motor.integrated.assembly.component-height", "requirement", "conditional", "A specified component-height limit is a retained-candidate fit requirement when present."),
  rule("motor.integrated.bulk-capacitance-nominal", "safety", "required", "Bulk energy and transient support must meet the bridge's reviewed safety requirement."),
  rule("motor.integrated.bulk-voltage-rating", "safety", "required", "Bulk-capacitor voltage rating is an electrical overstress boundary."),
  rule("motor.integrated.capacitor-derating", "safety", "required", "Capacitor derating is required to bound bias, ripple, heating, and lifetime stress."),
  rule("motor.integrated.continuous-current", "safety", "required", "Continuous bridge current is an electrical and thermal safety boundary."),
  rule("motor.integrated.current-limit", "safety", "required", "Configured current protection must be proved before stall behavior can be safe."),
  rule("motor.integrated.high-side-duty", "requirement", "required", "The requested duty point must satisfy the bridge's high-side operating requirement."),
  rule("motor.integrated.local-capacitance-nominal", "safety", "required", "Production policy requires exact reviewed nominal-value conformance to the bridge's bound local-capacitor recommendation; this rule does not assert a manufacturer-required minimum or effective local-supply adequacy."),
  rule("motor.integrated.local-voltage-rating", "safety", "required", "Local-capacitor voltage rating is an electrical overstress boundary."),
  rule("motor.integrated.logic-threshold", "requirement", "required", "The logic rail must meet the bridge's input threshold requirement."),
  rule("motor.integrated.motor-dynamics", "requirement", "required", "The requested motor operating behavior needs a bound dynamic model."),
  rule("motor.integrated.operating-load", "safety", "required", "Operating-point losses must be bounded before electrical and thermal safety can be claimed."),
  rule("motor.integrated.operating-modes", "requirement", "required", "The bridge must support every requested forward, reverse, coast, and brake mode."),
  rule("motor.integrated.peak-current", "safety", "required", "Peak and stall current require time-bounded safe-operating-area and protection proof."),
  rule("motor.integrated.pulse-off-time", "requirement", "required", "Requested PWM off-time must satisfy the bridge's input timing requirement."),
  rule("motor.integrated.pulse-on-time", "requirement", "required", "Requested PWM on-time must satisfy the bridge's input timing requirement."),
  rule("motor.integrated.pwm-frequency", "requirement", "required", "Requested PWM frequency must remain within the bridge's supported range."),
  rule("motor.integrated.supply-absolute-maximum", "safety", "required", "The bridge absolute maximum is an electrical damage boundary."),
  rule("motor.integrated.supply-maximum", "requirement", "required", "The requested bus maximum must remain within the declared operating range."),
  rule("motor.integrated.supply-minimum", "requirement", "required", "The requested bus minimum must remain within the declared operating range."),
  rule("motor.integrated.thermal", "safety", "required", "Actual junction temperature must be proved below safe limits."),
  rule("motor.integrated.transient-margin", "safety", "required", "Bus overshoot and recirculation energy must remain within safe semiconductor stress limits."),
];

export { PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3_SCOPE_BOUNDARY };

export const MOTOR_PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3 = createProductionConstraintPolicyCatalogV3({
  format: "schemagic-constraint-policy-catalog",
  schemaVersion: 3,
  constraintPolicy: PRODUCTION_STRICT_CONSTRAINT_POLICY_V3,
  application: "motor.brushed-dc",
  recipePolicies: [
    {
      recipeId: "motor.native.external-nmos-h-bridge.facts-v3-1-role-qualified",
      recipeContentHash: MOTOR_NATIVE_EXTERNAL_NMOS_RECIPE_FACTS_V31_TVS_VOLTAGE_QUALIFIED.contentHash,
      rules: MOTOR_EXTERNAL_V31_RULES,
    },
    {
      recipeId: "motor.native.integrated-h-bridge.facts-v3-2",
      recipeContentHash: MOTOR_NATIVE_INTEGRATED_H_BRIDGE_RECIPE_FACTS_V32_COMPANION_NETWORK_GATED.contentHash,
      rules: MOTOR_INTEGRATED_V32_RULES,
    },
  ],
});
