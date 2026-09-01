import {
  PRODUCTION_STRICT_CONSTRAINT_POLICY_V3,
  type ConstraintPolicyRuleV3,
} from "@opencircuit/design-schema";
import {
  PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3_SCOPE_BOUNDARY,
  createProductionConstraintPolicyCatalogV3,
  productionConstraintPolicyRuleV3 as rule,
} from "./production-constraint-policy-v3-common";

const POWER_INTEGRATED_V33_RULES: ConstraintPolicyRuleV3[] = [
  rule("power.assembly.allowed-packages", "requirement", "conditional", "A specified package allowlist is a retained-candidate requirement when present."),
  rule("power.assembly.board-area", "requirement", "conditional", "A specified board-area limit is a retained-candidate fit requirement when present."),
  rule("power.assembly.component-height", "requirement", "conditional", "A specified component-height limit is a retained-candidate fit requirement when present."),
  rule("power.control.loop-stability", "safety", "required", "Closed-loop stability must be proved to prevent unsafe output excursions."),
  rule("power.feedback.output-voltage", "requirement", "required", "The feedback network must satisfy the requested output-voltage behavior."),
  rule("power.inductor.rms-current", "safety", "required", "Inductor RMS-current capability is a winding-heating safety boundary."),
  rule("power.inductor.saturation-current", "safety", "required", "Inductor saturation margin is required to prevent uncontrolled peak current."),
  rule("power.inductor.selected-value", "safety", "required", "Inductance must be sized to bound ripple and peak current safely."),
  rule("power.passive.bootstrap-effective-capacitance", "safety", "required", "Effective bootstrap capacitance must sustain safe high-side switching."),
  rule("power.passive.capacitor-effective-capacitance", "safety", "required", "Effective capacitance, ripple, and ESR must be bounded for safe converter operation."),
  rule("power.passive.resistor-power-voltage", "safety", "required", "Resistor dissipation and working-voltage limits are electrical safety boundaries."),
  rule("power.regulator.absolute-maximum-junction", "safety", "required", "The requested junction ceiling must not exceed the regulator's damage boundary."),
  rule("power.regulator.current-limit", "safety", "required", "Protection threshold and peak-current behavior must be coordinated for safe operation."),
  rule("power.regulator.input-maximum", "safety", "required", "Maximum input voltage must remain within the regulator's safe operating boundary."),
  rule("power.regulator.input-minimum", "requirement", "required", "Minimum input voltage must remain within the regulator's declared operating range."),
  rule("power.regulator.minimum-off-time", "requirement", "required", "The operating point must satisfy the regulator's minimum off-time requirement."),
  rule("power.regulator.minimum-on-time", "requirement", "required", "The operating point must satisfy the regulator's minimum on-time requirement."),
  rule("power.regulator.output-current", "safety", "required", "Output-current capability is an electrical and thermal safety boundary."),
  rule("power.regulator.output-maximum", "requirement", "required", "Requested output voltage must remain within the regulator's declared range."),
  rule("power.regulator.output-minimum", "requirement", "required", "Requested output voltage must remain within the regulator's declared range."),
  rule("power.regulator.switching-spread-maximum", "requirement", "required", "Production oscillator spread must remain within the requested frequency interval."),
  rule("power.regulator.switching-spread-minimum", "requirement", "required", "Production oscillator spread must remain within the requested frequency interval."),
  rule("power.request.load-transient", "requirement", "conditional", "When the request supplies a numeric load-transient target, the selected design must satisfy it; no rule is emitted when no target is requested."),
  rule("power.request.output-ripple", "requirement", "required", "The selected design must satisfy the requested output-ripple behavior."),
  rule("power.thermal.loss-model", "safety", "required", "A bounded loss model is required before converter thermal safety can be claimed."),
  rule("power.thermal.maximum-junction", "safety", "required", "Actual junction temperature must be proved below safe limits."),
];

export { PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3_SCOPE_BOUNDARY };

export const POWER_PRODUCTION_CONSTRAINT_POLICY_CATALOG_V3 = createProductionConstraintPolicyCatalogV3({
  format: "schemagic-constraint-policy-catalog",
  schemaVersion: 3,
  constraintPolicy: PRODUCTION_STRICT_CONSTRAINT_POLICY_V3,
  application: "power.buck",
  recipePolicies: [{
    recipeId: "power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified",
    recipeContentHash: "sha256:c36cdcd96b25808fb913f152e211a6c08ac7f0bf675274f393bd00b31b2d3b1c",
    rules: POWER_INTEGRATED_V33_RULES,
  }],
});
