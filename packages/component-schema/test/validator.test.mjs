import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { validateComponentFiles, validatePackage } from "../lib.mjs";
import {
  citationCohortMaterial,
  curveCohortMaterial,
  curveIdentityMaterial,
  identityHash,
  pointEvidenceMaterial,
  scalarEvidenceMaterial
} from "../evidence-identity.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");

test("promoted validator accepts the historical complete examples", () => {
  const diode = path.join(repoRoot, "spikes/component-schema/models-example/generic-example/vishay/1N4148/component.json");
  const bjt = path.join(repoRoot, "spikes/component-schema/models-example/onsemi/2N3904/component.json");
  assert.deepEqual(validateComponentFiles(diode).errors, []);
  assert.deepEqual(validateComponentFiles(bjt).errors, []);
});

test("promoted validator rejects the historical broken fixture", () => {
  const broken = path.join(repoRoot, "spikes/component-schema/fixtures/broken-component.json");
  assert.ok(validateComponentFiles(broken).errors.length > 0);
});

test("validate-package accepts all generated F2 gold packages", () => {
  for (const relative of ["vishay/1N4148", "kingbright/WP7113ID", "onsemi/2N3904", "infineon/IRLZ44N", "ti/TL072"]) {
    const directory = path.join(repoRoot, "packages/model-library/models", relative);
    assert.deepEqual(validatePackage(directory).errors, []);
  }
});

test("validate-package reports a missing directory contract", () => {
  const missing = path.join(repoRoot, "packages/model-library/models/not-a-real-package");
  assert.ok(validatePackage(missing).errors.some((error) => error.includes("missing required package file")));
});

test("versioned package chain requires facts and fitted while legacy packages stay compatible", () => {
  const source = path.join(repoRoot, "packages/model-library/models/infineon/IRLZ44N");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "component-contract-chain-"));
  try {
    fs.cpSync(source, root, { recursive: true });
    const expectationsPath = path.join(root, "tests", "expectations.json");
    const expectations = JSON.parse(fs.readFileSync(expectationsPath, "utf8"));
    expectations.evidence_contract_version = "1.0.0";
    expectations.evidence_cohorts = [{ cohort_id: `sha256:${"a".repeat(64)}`, fidelity_tier: "F2", evidence_ids: [`sha256:${"b".repeat(64)}`] }];
    fs.writeFileSync(expectationsPath, JSON.stringify(expectations));
    fs.rmSync(path.join(root, "facts.json"));
    fs.rmSync(path.join(root, "fitted.json"));
    const errors = validatePackage(root).errors;
    assert.ok(errors.some((error) => error.includes("facts.json")), errors.join("\n"));
    assert.ok(errors.some((error) => error.includes("fitted.json")), errors.join("\n"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function contractFixture() {
  const conditionMaterial = {
    schema_version: "1.0.0",
    characteristic: "transfer_current",
    polarity: "n",
    magnitude_convention: "absolute",
    temperature: { kind: "junction", value_c: 75 },
    electrical: {
      vgs: { kind: "range", lower_v: 2.5, upper_v: 3 },
      vds: { kind: "fixed", value_v: 10 },
      id: { kind: "range", lower_a: 5, upper_a: 20 }
    },
    test_mode: { kind: "dc" },
    qualifiers: [{ key: "condition_source", value: "figure_heading" }]
  };
  const condition = { ...conditionMaterial, condition_id: identityHash(conditionMaterial) };
  const citationMaterial = { source_sha256: "a".repeat(64), page: 3, figure: "3", curve: "75 C typical" };
  const citation = { ...citationMaterial, citation_id: identityHash(citationMaterial) };
  const rawPoints = [{ point_index: 0, x_si: 2.5, y_si: 5 }, { point_index: 1, x_si: 3, y_si: 20 }];
  const curve = {
    characteristic: "transfer_current",
    x_axis: { quantity: "vgs", unit: "V" },
    y_axis: { quantity: "id", unit: "A" },
    condition_identity: condition,
    citation_identity: citation,
    points: rawPoints.map((point) => ({ ...point }))
  };
  curve.curve_id = identityHash(curveIdentityMaterial(curve, condition.condition_id, citation.citation_id));
  const cohortId = identityHash(curveCohortMaterial(curve.characteristic, condition.condition_id, citation.citation_id, curve.curve_id));
  curve.points = rawPoints.map((point) => {
    const evidence = { role: "digitized_typical_curve", condition_id: condition.condition_id, citation_id: citation.citation_id, cohort_id: cohortId, curve_id: curve.curve_id, point_index: point.point_index };
    return { ...point, evidence_identity: { ...evidence, evidence_id: identityHash(pointEvidenceMaterial(curve.characteristic, point, evidence)) } };
  });
  const firstEvidence = curve.points[0].evidence_identity;
  const refs = [{ evidence_id: firstEvidence.evidence_id, condition_id: condition.condition_id, citation_id: citation.citation_id, cohort_id: cohortId }];
  const boundMaterial = { quantity: "vds", kind: "range", minimum: 10, maximum: 10, unit: "V", evidence_refs: refs, condition_ids: [condition.condition_id], citation_ids: [citation.citation_id], derivation: "direct_evidence_union" };
  const bound = { bound_id: identityHash(boundMaterial), ...boundMaterial, conditions: "Direct cited evidence", placeholder: false };
  const component = {
    schema_version: "1.0.0", canonical_mpn: "FIXTURE", manufacturer: "Fixture", description: "Contract fixture", electrical_family: "nmos",
    symbol_pins: [{ name: "G", number: "1", role: "gate" }, { name: "D", number: "2", role: "drain" }, { name: "S", number: "3", role: "source" }],
    spice_pin_mapping: [{ symbol_pin_number: "2", subckt_node: "drain", order: 1 }, { symbol_pin_number: "1", subckt_node: "gate", order: 2 }, { symbol_pin_number: "3", subckt_node: "source", order: 3 }],
    package_variants: [{ name: "TO-220", standard: "JEDEC", pin_count: 3, pin_map: [{ package_pin: "1", symbol_pin_number: "1" }, { package_pin: "2", symbol_pin_number: "2" }, { package_pin: "3", symbol_pin_number: "3" }] }],
    ordering_code_aliases: [], datasheet: { url: "https://example.com/fixture.pdf", revision: "1" }, model_type: "dot_model", fidelity_tier: "F2",
    domain_coverage: { dc: "fitted", ac: "none", transient: "none", noise: "none", thermal: "none", digital: "none" }, supported_analyses: ["operating_point"],
    supported_operating_region: { contract_version: "1.0.0", summary: "Direct cited evidence only", numeric_bounds: [bound] }, known_omissions: ["Fixture"],
    licence: { spdx_id: "MIT", provenance_basis: "original_from_facts" }, generator: { tool_or_agent: "fixture-generator", date: "2026-08-13" }, reviewer: { tool_or_agent: "fixture-reviewer", date: "2026-08-13" },
    test_results: { status: "pending", pass_count: 0, fail_count: 0, total_count: 0, worst_observed_relative_fitting_error: null }, validation_date: null
  };
  const qualification = { test_mode: "continuous_dc" };
  const locator = { page: citation.page, figure: citation.figure, curve: citation.curve };
  const check = { name: "curve_point", expression_source: { kind: "raw_variable", expression: "abs:last(i(vd))" }, expected_value: 5, unit: "A", tolerance: { absolute: 0, relative: 0.12 }, datasheet_citation: "Fixture datasheet, page 3, Figure 3, 75 C typical", placeholder: false,
    evidence_id: firstEvidence.evidence_id, condition_id: condition.condition_id, citation_id: citation.citation_id, cohort_id: cohortId, bench_condition_id: condition.condition_id, evidence_role: "curve_point", citation_locator: locator, evidence_qualification: qualification, bench_qualification: qualification };
  const expectations = { schema_version: "1.0.0", evidence_contract_version: "1.0.0", evidence_cohorts: [{ cohort_id: cohortId, fidelity_tier: "F2", evidence_ids: [firstEvidence.evidence_id] }], tests: [{ test_netlist: "transfer.cir", analysis_type: "operating_point", scalar_checks: [check], hard_bounds_checks: [] }] };
  const scalarConditionMaterial = { ...conditionMaterial, characteristic: "gate_threshold", electrical: { vgs: { kind: "relation", relation: "vds_equals_vgs" }, vds: { kind: "relation", relation: "vds_equals_vgs" }, id: { kind: "fixed", value_a: 250e-6 } } };
  const scalarCondition = { ...scalarConditionMaterial, condition_id: identityHash(scalarConditionMaterial) };
  const scalarCitationMaterial = { source_sha256: "a".repeat(64), page: 2, table: "Electrical characteristics", row: "Gate threshold voltage" };
  const scalarCitation = { ...scalarCitationMaterial, citation_id: identityHash(scalarCitationMaterial) };
  const scalarCohortId = identityHash(citationCohortMaterial("gate_threshold", scalarCondition.condition_id, scalarCitation));
  const scalarEvidenceBase = { role: "typical", condition_id: scalarCondition.condition_id, citation_id: scalarCitation.citation_id, cohort_id: scalarCohortId };
  const scalarEvidence = { ...scalarEvidenceBase, evidence_id: identityHash(scalarEvidenceMaterial("gate_threshold", scalarEvidenceBase, "threshold_typical", 2, "V")) };
  const thresholdTypical = { quantity: "threshold_typical", value: 2, unit: "V", conditions: "VDS = VGS, ID = 250 uA, TJ = 75 C, DC", page_reference: "p. 2 electrical characteristics, Gate threshold voltage", source_kind: "typical", condition_identity: scalarCondition, citation_identity: scalarCitation, evidence_identity: scalarEvidence };
  const linked = { condition_identity: condition, citation_identity: citation, evidence_identity: firstEvidence };
  const fitted = { evidence_contract_version: "1.0.0", parameters: { VTO: 2 }, calibration: { observations: [{ quantity: "transfer current", ...linked }], constraints: [] }, residuals: [{ quantity: "transfer current", ...linked }] };
  return { component, facts: { evidence_contract_version: "1.0.0", threshold: { typical: thresholdTypical }, curves: [curve] }, fitted, expectations };
}

function writeContractPackage(root, fixture = contractFixture()) {
  fs.mkdirSync(path.join(root, "tests"), { recursive: true });
  fs.writeFileSync(path.join(root, "component.json"), JSON.stringify(fixture.component));
  fs.writeFileSync(path.join(root, "facts.json"), JSON.stringify(fixture.facts));
  fs.writeFileSync(path.join(root, "fitted.json"), JSON.stringify(fixture.fitted));
  fs.writeFileSync(path.join(root, "tests", "expectations.json"), JSON.stringify(fixture.expectations));
  fs.writeFileSync(path.join(root, "tests", "transfer.cir"), "Fixture test\nVd d 0 10\nR1 d 0 1k\n.op\n.end\n");
  fs.writeFileSync(path.join(root, "model.cir"), "* OpenCircuit Model Factory\n* Original work\n* Public factual specifications\n.model DUT VDMOS(VTO=2)\n");
  fs.writeFileSync(path.join(root, "sources.json"), JSON.stringify([{ kind: "datasheet", url: "https://example.com/fixture.pdf", revision: "1", sha256: "a".repeat(64), accessed_date: "2026-08-13", pages_referenced: ["3"], placeholder: false }]));
  fs.writeFileSync(path.join(root, "MODEL_CARD.md"), "Fixture\n");
  fs.writeFileSync(path.join(root, "LICENSE"), "MIT\n");
}

function mutateContractFixture(mutator) {
  const fixture = contractFixture();
  mutator(fixture);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "component-hash-contract-"));
  try {
    writeContractPackage(root, fixture);
    return validatePackage(root).errors;
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("correct canonical evidence-contract package validates", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "component-hash-contract-valid-"));
  try {
    writeContractPackage(root);
    assert.deepEqual(validatePackage(root).errors, []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("stale citation locator hashes fail for page, table, and figure mutations", () => {
  for (const mutate of [
    (f) => { f.facts.curves[0].citation_identity.page = 99; },
    (f) => { f.facts.curves[0].citation_identity.figure = "4"; },
    (f) => { const c = f.facts.curves[0].citation_identity; delete c.figure; delete c.curve; c.table = "Electrical characteristics"; c.row = "Transfer current"; }
  ]) assert.ok(mutateContractFixture(mutate).some((error) => error.includes("citation_id does not match canonical content")));
});

test("stale condition hashes fail for electrical bias, temperature, test mode, and qualifier mutations", () => {
  for (const mutate of [
    (f) => { f.facts.curves[0].condition_identity.electrical.vds.value_v = 11; },
    (f) => { f.facts.curves[0].condition_identity.temperature.value_c = 25; },
    (f) => { f.facts.curves[0].condition_identity.test_mode.kind = "continuous"; },
    (f) => { f.facts.curves[0].condition_identity.qualifiers[0].value = "other_heading"; }
  ]) assert.ok(mutateContractFixture(mutate).some((error) => error.includes("condition_id does not match canonical content")));
});

test("stale curve, cohort, point evidence, expectation linkage, and bound hashes fail closed", () => {
  const cases = [
    [(f) => { f.facts.curves[0].x_axis.quantity = "vds"; }, "curve_id does not match canonical content"],
    [(f) => { f.facts.curves[0].points.reverse(); }, "curve_id does not match canonical content"],
    [(f) => { f.facts.curves[0].points[0].y_si = 6; }, "curve_id does not match canonical content"],
    [(f) => { f.facts.curves[0].points[0].evidence_identity.role = "typical"; }, "evidence_id does not match canonical content"],
    [(f) => { f.facts.threshold.typical.value = 2.1; }, "evidence_id does not match canonical content"],
    [(f) => { f.facts.threshold.typical.evidence_identity.role = "maximum"; }, "evidence_id does not match canonical content"],
    [(f) => { f.facts.curves[0].points[0].evidence_identity.cohort_id = `sha256:${"f".repeat(64)}`; }, "cohort_id does not match canonical content"],
    [(f) => { f.expectations.evidence_cohorts[0].evidence_ids.push(`sha256:${"e".repeat(64)}`); }, "membership must exactly match linked expectations"],
    [(f) => { f.expectations.tests[0].scalar_checks[0].evidence_role = "inclusive_maximum"; }, "evidence_role disagrees with facts evidence"],
    [(f) => { f.component.supported_operating_region.numeric_bounds[0].maximum = 11; }, "bound_id does not match canonical content"],
    [(f) => { f.component.supported_operating_region.numeric_bounds[0].evidence_refs[0].citation_id = `sha256:${"d".repeat(64)}`; }, "bound_id does not match canonical content"]
  ];
  for (const [mutate, fragment] of cases) {
    const errors = mutateContractFixture(mutate);
    assert.ok(errors.some((error) => error.includes(fragment)), `${fragment}: ${errors.join("\n")}`);
  }
});
