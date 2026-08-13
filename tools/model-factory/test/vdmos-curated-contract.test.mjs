import assert from "node:assert/strict";
import test from "node:test";
import { PARTS } from "../lib/parts.mjs";

const VD_MOS_MPNS = ["IRLZ44N", "IRFZ44N", "IRF3205"];
const CURVE_KEYS = ["curve_id", "characteristic", "x_axis", "y_axis", "condition_identity", "citation_identity", "points"];
const POINT_KEYS = ["x_si", "y_si", "point_index", "evidence_identity"];
const PLACEHOLDER = /placeholder|unknown|tbd|default condition|nominal threshold characterization/i;

function assertCitation(citation, label) {
  assert.equal(typeof citation.page_reference, "string", `${label} page_reference`);
  assert.doesNotMatch(citation.page_reference, PLACEHOLDER);
  assert.ok(["table_row", "figure"].includes(citation.locator.kind), `${label} locator kind`);
  assert.ok(citation.locator.label.length > 0, `${label} locator label`);
}

function assertIdentity(identity, label) {
  assert.equal(identity.temperature.kind, "junction", `${label} temperature kind`);
  assert.equal(identity.temperature.value, 25, `${label} temperature value`);
  assert.equal(identity.temperature.unit, "degC", `${label} temperature unit`);
  assert.equal(typeof identity.evidence_role, "string", `${label} evidence role`);
  assert.ok(Array.isArray(identity.qualifiers.tokens) && identity.qualifiers.tokens.length > 0, `${label} qualifier tokens`);
  assertCitation(identity.citation, `${label}.citation`);
  assert.ok(identity.gate_source_voltage, `${label} VGS identity`);
  assert.ok(identity.drain_current, `${label} ID identity`);
  assert.ok(identity.drain_source_voltage, `${label} VDS identity`);
}

function assertDatum(datum, label) {
  assert.equal(typeof datum.value, "number", `${label} value`);
  assert.equal(typeof datum.unit, "string", `${label} unit`);
  assert.equal(typeof datum.conditions, "string", `${label} conditions`);
  assert.equal(typeof datum.page_reference, "string", `${label} page_reference`);
  assert.equal(typeof datum.source_kind, "string", `${label} source_kind`);
  assert.doesNotMatch(datum.conditions, PLACEHOLDER);
  assert.doesNotMatch(datum.page_reference, PLACEHOLDER);
  assertIdentity(datum.identity, `${label}.identity`);
}

function assertCurve(curve, characteristic, label) {
  assert.deepEqual(Object.keys(curve), CURVE_KEYS, `${label} exact canonical keys`);
  assert.equal(curve.characteristic, characteristic);
  assert.deepEqual(curve.x_axis, { quantity: characteristic === "transfer" ? "vgs" : "vds", unit: "V" });
  assert.deepEqual(curve.y_axis, { quantity: "id", unit: "A" });
  assertIdentity(curve.condition_identity, `${label}.condition_identity`);
  assertCitation(curve.citation_identity, `${label}.citation_identity`);
  assert.ok(curve.points.length > 0, `${label} points`);
  curve.points.forEach((point, pointIndex) => {
    assert.deepEqual(Object.keys(point), POINT_KEYS, `${label}.points[${pointIndex}] exact canonical keys`);
    assert.equal(typeof point.x_si, "number");
    assert.equal(typeof point.y_si, "number");
    assert.equal(point.point_index, pointIndex);
    assert.equal(point.evidence_identity.curve_id, curve.curve_id);
    assert.equal(point.evidence_identity.evidence_role, "curve_point");
    assert.equal(point.evidence_identity.source_kind, "digitized_typical_curve");
    assertIdentity(point.evidence_identity.condition_identity, `${label}.points[${pointIndex}].condition_identity`);
    assertCitation(point.evidence_identity.citation_identity, `${label}.points[${pointIndex}].citation_identity`);
  });
}

test("curated VDMOS facts implement frozen evidence contract 1.0.0", () => {
  const curated = Object.values(PARTS).filter((part) => part.pipeline === "vdmos");
  assert.deepEqual(curated.map((part) => part.slug).sort(), [...VD_MOS_MPNS].sort());
  for (const part of curated) {
    const facts = part.facts;
    assert.equal(facts.evidence_contract_version, "1.0.0", part.slug);
    assert.ok(!Object.hasOwn(facts, "transfer_points"), `${part.slug} flat transfer_points prohibited`);
    assert.ok(!Object.hasOwn(facts, "output_points"), `${part.slug} flat output_points prohibited`);
    assert.ok(!Object.hasOwn(facts, "critical_evidence"), `${part.slug} out-of-band identity catalog prohibited`);
    assert.ok(!Object.hasOwn(facts.threshold, "typical"), `${part.slug} unpublished threshold typical must be omitted`);
    assertDatum(facts.threshold.minimum, `${part.slug}.threshold.minimum`);
    assertDatum(facts.threshold.maximum, `${part.slug}.threshold.maximum`);
    assert.equal(facts.threshold.minimum.identity.evidence_role, "inclusive_minimum");
    assert.equal(facts.threshold.maximum.identity.evidence_role, "inclusive_maximum");
    assert.equal(facts.threshold.minimum.identity.qualifiers.test_mode, "electrical_characteristic");
    assert.ok(!Object.hasOwn(facts.threshold.minimum.identity.qualifiers, "pulse_width_maximum"));
    facts.rdson_points.forEach((point, index) => {
      assertDatum(point.resistance, `${part.slug}.rdson[${index}].resistance`);
      assertDatum(point.vgs, `${part.slug}.rdson[${index}].vgs`);
      assertDatum(point.current, `${part.slug}.rdson[${index}].current`);
      assert.deepEqual(point.resistance.identity, point.vgs.identity);
      assert.deepEqual(point.resistance.identity, point.current.identity);
      assert.equal(point.resistance.identity.qualifiers.test_mode, "pulse");
      assert.equal(point.resistance.identity.qualifiers.duty_cycle_maximum.value, 0.02);
    });
    facts.transfer_curves.forEach((curve, index) => assertCurve(curve, "transfer", `${part.slug}.transfer_curves[${index}]`));
    facts.output_curves.forEach((curve, index) => assertCurve(curve, "output", `${part.slug}.output_curves[${index}]`));
    for (const curve of [...facts.transfer_curves, ...facts.output_curves]) {
      assert.equal(curve.condition_identity.qualifiers.pulse_width_maximum.value, 20e-6, `${part.slug} curve pulse width`);
      assert.ok(!Object.hasOwn(curve.condition_identity.qualifiers, "duty_cycle_maximum"), `${part.slug} curves have no cited duty-cycle limit`);
    }
  }
});

test("per-part RDS pulse limits follow the exact table footnotes", () => {
  for (const point of PARTS.IRLZ44N.facts.rdson_points) assert.equal(point.resistance.identity.qualifiers.pulse_width_maximum.value, 300e-6);
  assert.equal(PARTS.IRFZ44N.facts.rdson_points[0].resistance.identity.qualifiers.pulse_width_maximum.value, 400e-6);
  assert.equal(PARTS.IRF3205.facts.rdson_points[0].resistance.identity.qualifiers.pulse_width_maximum.value, 400e-6);
});
