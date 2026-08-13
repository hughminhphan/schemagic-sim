import assert from "node:assert/strict";
import test from "node:test";
import { PARTS, VDMOS_EVIDENCE_POLICY } from "../lib/parts.mjs";

const CRITICAL_GROUPS = ["threshold", "rdson_points", "transfer_points", "output_points"];
const VALID_ROLES = new Set([
  "inclusive_lower_physical_constraint",
  "inclusive_upper_physical_constraint",
  "typical_observation",
  "declared_curve_derived_held_default"
]);
const DEFAULT_MARKERS = /placeholder|default condition|nominal threshold characterization|same (?:condition|test)|tbd|unknown/i;

function valuesOf(group) {
  if (Array.isArray(group)) return group.flatMap((entry) => Object.values(entry));
  return Object.values(group ?? {});
}

function assertQuantity(quantity, label) {
  assert.equal(typeof quantity.value, "number", `${label} must have a numeric value`);
  assert.equal(typeof quantity.unit, "string", `${label} must have a unit`);
  assert.ok(quantity.unit.length > 0, `${label} unit must be non-empty`);
  for (const key of ["evidence_id", "evidence_role", "condition_id", "citation_id"]) {
    assert.equal(typeof quantity[key], "string", `${label} must have ${key}`);
    assert.ok(quantity[key].length > 0, `${label} ${key} must be non-empty`);
  }
  assert.ok(VALID_ROLES.has(quantity.evidence_role), `${label} has invalid evidence role ${quantity.evidence_role}`);
  assert.doesNotMatch(quantity.conditions, DEFAULT_MARKERS, `${label} has a default condition marker`);
  assert.doesNotMatch(quantity.page_reference, DEFAULT_MARKERS, `${label} has a default citation marker`);
}

test("curated VDMOS evidence uses the canonical threshold policy", () => {
  assert.deepEqual(VDMOS_EVIDENCE_POLICY, {
    identity_version: "vdmos-critical-evidence-v1",
    threshold_bounds: "published_minimum_and_maximum_are_inclusive_physical_constraints",
    threshold_typical: "observation_and_seed_only",
    threshold_extrapolation: "forbidden_outside_published_interval",
    threshold_absent_fallback: "declared_curve_derived_held_default_only_without_threshold_bound_support",
    pulse_dc_equivalence: "forbidden_without_explicit_datasheet_evidence"
  });
});

test("every curated VDMOS critical datum resolves complete shared condition, citation, and evidence identities", () => {
  const vdmosParts = Object.values(PARTS).filter((part) => part.pipeline === "vdmos");
  assert.deepEqual(vdmosParts.map((part) => part.slug).sort(), ["IRF3205", "IRFZ44N", "IRLZ44N"]);

  for (const part of vdmosParts) {
    const catalog = part.facts.critical_evidence;
    assert.equal(catalog.policy, VDMOS_EVIDENCE_POLICY, `${part.slug} must use the shared policy identity`);

    const conditions = new Map(Object.values(catalog.conditions).map((condition) => [condition.id, condition]));
    const citations = new Map(Object.values(catalog.citations).map((citation) => [citation.id, citation]));
    const identities = new Map(Object.values(catalog.identities).map((identity) => [identity.id, identity]));

    for (const [name, condition] of Object.entries(catalog.conditions)) {
      assert.equal(condition.temperature.kind, "junction", `${part.slug}.${name} must type temperature as junction`);
      assert.equal(condition.temperature.value, 25, `${part.slug}.${name} must preserve the 25 degC datum`);
      assert.equal(condition.temperature.unit, "degC", `${part.slug}.${name} must type the temperature unit`);
      assert.equal(condition.measurement.mode, "pulse_limited", `${part.slug}.${name} must preserve the pulse qualifier`);
      assert.equal(condition.measurement.maximum_pulse_width.value, 300e-6, `${part.slug}.${name} pulse width changed`);
      assert.equal(condition.measurement.maximum_duty_cycle.value, 0.02, `${part.slug}.${name} duty cycle changed`);
      assert.ok(Array.isArray(condition.swept_coordinates) && condition.swept_coordinates.length > 0, `${part.slug}.${name} must identify swept coordinates`);
      assert.doesNotMatch(condition.display, DEFAULT_MARKERS, `${part.slug}.${name} has a default condition marker`);
    }

    assert.equal(catalog.conditions.transfer_vds25.fixed_biases.drain_source_voltage.value, 25, `${part.slug} transfer VDS must be actual 25 V`);
    assert.equal(catalog.conditions.transfer_vds25.fixed_biases.drain_source_voltage.unit, "V");

    for (const [name, citation] of Object.entries(catalog.citations)) {
      assert.ok(["table_row", "figure"].includes(citation.locator.kind), `${part.slug}.${name} must use a table or figure locator`);
      assert.ok(citation.locator.label.length > 0, `${part.slug}.${name} locator must be named`);
      assert.doesNotMatch(citation.page_reference, DEFAULT_MARKERS, `${part.slug}.${name} has a default citation marker`);
    }

    for (const groupName of CRITICAL_GROUPS) {
      for (const [index, quantity] of valuesOf(part.facts[groupName]).entries()) {
        const label = `${part.slug}.${groupName}[${index}]`;
        assertQuantity(quantity, label);
        const evidence = identities.get(quantity.evidence_id);
        assert.ok(evidence, `${label} evidence identity must resolve`);
        assert.equal(quantity.evidence_role, evidence.role, `${label} role must match its evidence identity`);
        assert.equal(quantity.condition_id, evidence.condition_id, `${label} condition must match its evidence identity`);
        assert.equal(quantity.citation_id, evidence.citation_id, `${label} citation must match its evidence identity`);
        assert.ok(conditions.has(quantity.condition_id), `${label} condition identity must resolve`);
        assert.ok(citations.has(quantity.citation_id), `${label} citation identity must resolve`);
      }
    }

    assert.equal(part.facts.threshold.minimum.evidence_role, "inclusive_lower_physical_constraint");
    assert.equal(part.facts.threshold.maximum.evidence_role, "inclusive_upper_physical_constraint");
    assert.equal(part.facts.threshold.minimum.condition_id, part.facts.threshold.maximum.condition_id, `${part.slug} threshold bounds must share one condition`);
    assert.equal(part.facts.threshold.minimum.citation_id, part.facts.threshold.maximum.citation_id, `${part.slug} threshold bounds must share one citation`);
  }
});
