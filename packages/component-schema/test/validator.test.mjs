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
  directEvidenceIntersectionErrors,
  directEvidenceUnionErrors,
  identityHash,
  pointEvidenceMaterial,
  scalarEvidenceMaterial,
  summarizeMosfetResiduals
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
    const errors = validatePackage(root, { requireEvidenceContract: true }).errors;
    assert.ok(errors.some((error) => error.includes("facts.json")), errors.join("\n"));
    assert.ok(errors.some((error) => error.includes("fitted.json")), errors.join("\n"));
    assert.deepEqual(validatePackage(source).errors, []);
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
    schema_version: "1.0.0", evidence_contract_version: "1.0.0", canonical_mpn: "FIXTURE", manufacturer: "Fixture", description: "Contract fixture", electrical_family: "nmos",
    symbol_pins: [{ name: "G", number: "1", role: "gate" }, { name: "D", number: "2", role: "drain" }, { name: "S", number: "3", role: "source" }],
    spice_pin_mapping: [{ symbol_pin_number: "2", subckt_node: "drain", order: 1 }, { symbol_pin_number: "1", subckt_node: "gate", order: 2 }, { symbol_pin_number: "3", subckt_node: "source", order: 3 }],
    package_variants: [{ name: "TO-220", standard: "JEDEC", pin_count: 3, pin_map: [{ package_pin: "1", symbol_pin_number: "1" }, { package_pin: "2", symbol_pin_number: "2" }, { package_pin: "3", symbol_pin_number: "3" }] }],
    ordering_code_aliases: [], datasheet: { url: "https://example.com/fixture.pdf", revision: "1" }, model_type: "dot_model", fidelity_tier: "F2",
    domain_coverage: { dc: "fitted", ac: "none", transient: "none", noise: "none", thermal: "none", digital: "none" }, supported_analyses: ["operating_point"],
    supported_operating_region: { contract_version: "1.0.0", summary: "Direct cited evidence only", numeric_bounds: [bound] }, known_omissions: ["Fixture"],
    licence: { spdx_id: "MIT", provenance_basis: "original_from_facts" }, generator: { tool_or_agent: "opencircuit-model-factory-v0.1.0 bulk-adapter evidence-contract-1.0.0", date: "2026-08-13" }, reviewer: { tool_or_agent: "fixture-reviewer", date: "2026-08-13" },
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
  const calibrationRecord = { quantity: "transfer current", gate_quantity: "drain_current", datasheet_value: 5, unit: "A", evidence_role: "typical_observation", ...linked };
  const relativeError = Math.abs(5.1 - 5) / 5;
  const fitted = { evidence_contract_version: "1.0.0", fidelity_tier: "F2", parameters: { VTO: 2 }, calibration: { observations: [calibrationRecord], constraints: [], residual_target_count: 1 }, residuals: [{ ...calibrationRecord, fitted_value: 5.1, relative_error: relativeError }], rms_relative_error: relativeError, worst_relative_error: { value: relativeError, quantity: "transfer current" }, f2_gate_pass: true };
  return { component, facts: { evidence_contract_version: "1.0.0", source: { kind: "datasheet", url: "https://example.com/fixture.pdf", revision: "1", sha256: "a".repeat(64), accessed_date: "2026-08-13", pages_referenced: ["3"], placeholder: false }, threshold: { typical: thresholdTypical }, curves: [curve] }, fitted, expectations };
}

function writeContractPackage(root, fixture = contractFixture()) {
  fs.mkdirSync(path.join(root, "tests"), { recursive: true });
  fs.writeFileSync(path.join(root, "component.json"), JSON.stringify(fixture.component));
  fs.writeFileSync(path.join(root, "facts.json"), JSON.stringify(fixture.facts));
  fs.writeFileSync(path.join(root, "fitted.json"), JSON.stringify(fixture.fitted));
  fs.writeFileSync(path.join(root, "tests", "expectations.json"), JSON.stringify(fixture.expectations));
  fs.writeFileSync(path.join(root, "tests", "transfer.cir"), "Fixture test\n.model DUT VDMOS(VTO=2)\n.temp 75\nMT1 d g 0 DUT\nVd d 0 DC 10\nVg g 0 DC 2.5\n.op\n.end\n");
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
    return validatePackage(root, { requireEvidenceContract: true }).errors;
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("correct canonical evidence-contract package validates", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "component-hash-contract-valid-"));
  try {
    writeContractPackage(root);
    assert.deepEqual(validatePackage(root, { requireEvidenceContract: true }).errors, []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("model provenance reads one legacy or scheMAGIC factory header and rejects ambiguous lookalikes", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "component-factory-brand-"));
  try {
    writeContractPackage(root);
    const modelPath = path.join(root, "model.cir");
    const body = "* Original work\n* Public factual specifications\n.model DUT VDMOS(VTO=2)\n";

    fs.writeFileSync(modelPath, `* scheMAGIC Model Factory v0.1.0\n${body}`);
    assert.deepEqual(validatePackage(root, { requireEvidenceContract: true }).errors, []);

    for (const header of [
      "* Unrelated Model Factory",
      "* scheMAGIC Model Factoryish",
      "* scheMAGIC Model Factory\n* OpenCircuit Model Factory",
    ]) {
      fs.writeFileSync(modelPath, `${header}\n${body}`);
      const errors = validatePackage(root, { requireEvidenceContract: true }).errors;
      assert.ok(
        errors.some((error) => error.includes("exactly one recognized factory provenance line")),
        `${header}: ${errors.join("\n")}`,
      );
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("contract detection fails closed when any authoritative marker or linkage set is removed or downgraded", () => {
  const cases = [
    ["component marker removal", (f) => { delete f.component.evidence_contract_version; }, "component evidence_contract_version"],
    ["component marker downgrade", (f) => { f.component.evidence_contract_version = "0.9.0"; }, "component evidence_contract_version"],
    ["facts marker removal", (f) => { delete f.facts.evidence_contract_version; }, "facts evidence_contract_version"],
    ["facts marker downgrade", (f) => { f.facts.evidence_contract_version = "0.9.0"; }, "facts evidence_contract_version"],
    ["fitted marker removal", (f) => { delete f.fitted.evidence_contract_version; }, "fitted evidence_contract_version"],
    ["fitted marker downgrade", (f) => { f.fitted.evidence_contract_version = "0.9.0"; }, "fitted evidence_contract_version"],
    ["expectations marker removal", (f) => { delete f.expectations.evidence_contract_version; }, "expectations evidence_contract_version"],
    ["expectations marker downgrade", (f) => { f.expectations.evidence_contract_version = "0.9.0"; }, "expectations evidence_contract_version"],
    ["expectations cohort removal", (f) => { delete f.expectations.evidence_cohorts; }, "evidence_cohorts"],
    ["region marker removal", (f) => { delete f.component.supported_operating_region.contract_version; }, "contract_version"],
    ["region marker downgrade", (f) => { f.component.supported_operating_region.contract_version = "0.9.0"; }, "contract_version"],
    ["component evidence refs removal", (f) => { delete f.component.supported_operating_region.numeric_bounds[0].evidence_refs; }, "evidence_refs"]
  ];
  for (const [name, mutate, fragment] of cases) {
    const errors = mutateContractFixture(mutate);
    assert.ok(errors.some((error) => error.includes(fragment)), `${name}: ${errors.join("\n")}`);
  }
});

test("caller-required contract survives simultaneous package-local marker and generator mutation", () => {
  const errors = mutateContractFixture((fixture) => {
    fixture.component.generator.tool_or_agent = "legacy bulk adapter with mutated package text";
    delete fixture.component.evidence_contract_version;
    delete fixture.facts.evidence_contract_version;
    delete fixture.fitted.evidence_contract_version;
    delete fixture.expectations.evidence_contract_version;
    delete fixture.expectations.evidence_cohorts;
    for (const test of fixture.expectations.tests) for (const check of [...test.scalar_checks, ...test.hard_bounds_checks]) {
      for (const field of ["evidence_id", "condition_id", "citation_id", "cohort_id", "bench_condition_id", "evidence_role", "citation_locator", "evidence_qualification", "bench_qualification"]) delete check[field];
    }
    delete fixture.component.supported_operating_region.contract_version;
    for (const bound of fixture.component.supported_operating_region.numeric_bounds) {
      for (const field of ["bound_id", "evidence_refs", "condition_ids", "citation_ids", "derivation"]) delete bound[field];
    }
  });
  assert.ok(errors.some((error) => error.includes("component evidence_contract_version")), errors.join("\n"));
  assert.ok(errors.some((error) => error.includes("facts evidence_contract_version")), errors.join("\n"));
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

test("redundant nested curve-point identities must match the raw point and enclosing curve before hash validation", () => {
  const cases = [
    [(f) => { f.facts.curves[0].points[0].evidence_identity.point_index = 99; }, "evidence_identity.point_index disagrees with raw point"],
    [(f) => { f.facts.curves[0].points[0].evidence_identity.curve_id = `sha256:${"f".repeat(64)}`; }, "evidence_identity.curve_id disagrees with enclosing curve"],
    [(f) => { f.facts.curves[0].points[0].evidence_identity.condition_id = f.facts.threshold.typical.condition_identity.condition_id; }, "evidence_identity.condition_id disagrees with enclosing curve"],
    [(f) => { f.facts.curves[0].points[0].evidence_identity.citation_id = f.facts.threshold.typical.citation_identity.citation_id; }, "evidence_identity.citation_id disagrees with enclosing curve"],
    [(f) => { f.facts.curves[0].points[0].evidence_identity.cohort_id = `sha256:${"f".repeat(64)}`; }, "evidence_identity.cohort_id does not match canonical content"],
    [(f) => { f.facts.curves[0].points[0].evidence_identity.role = "typical"; }, "evidence_identity.role must be digitized_typical_curve for a curve point"]
  ];
  for (const [mutate, fragment] of cases) {
    const errors = mutateContractFixture(mutate);
    assert.ok(errors.some((error) => error.includes(fragment)), `${fragment}: ${errors.join("\n")}`);
  }
});

test("PMOS and NMOS emitted VTO signs must match the channel with the fitted magnitude", () => {
  const fittedNegativeNmos = mutateContractFixture((fixture) => { fixture.fitted.parameters.VTO = -2; });
  assert.ok(fittedNegativeNmos.some((error) => error.includes("fitted.json NMOS VTO must be positive")), fittedNegativeNmos.join("\n"));

  const positivePmos = mutateContractFixture((fixture) => { fixture.component.electrical_family = "pmos"; });
  assert.ok(positivePmos.some((error) => error.includes("must declare pchan") || error.includes("PMOS VTO must be negative")), positivePmos.join("\n"));

  const negativeNmos = mutateContractFixture(() => {});
  const nmosRoot = fs.mkdtempSync(path.join(os.tmpdir(), "component-nmos-negative-vto-"));
  try {
    writeContractPackage(nmosRoot);
    fs.writeFileSync(path.join(nmosRoot, "model.cir"), "* OpenCircuit Model Factory\n* Original work\n* Public factual specifications\n.model DUT VDMOS(VTO=-2)\n");
    fs.writeFileSync(path.join(nmosRoot, "tests", "transfer.cir"), "Fixture test\n.model DUT VDMOS(VTO=-2)\n.temp 75\nMT1 d g 0 DUT\nVd d 0 DC 10\nVg g 0 DC 2.5\n.op\n.end\n");
    const errors = validatePackage(nmosRoot, { requireEvidenceContract: true }).errors;
    assert.ok(errors.some((error) => error.includes("NMOS VTO must be positive")), errors.join("\n"));
  } finally { fs.rmSync(nmosRoot, { recursive: true, force: true }); }
  assert.deepEqual(negativeNmos, []);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "component-pmos-native-"));
  try {
    const fixture = contractFixture();
    fixture.component.electrical_family = "pmos";
    writeContractPackage(root, fixture);
    fs.writeFileSync(path.join(root, "model.cir"), "* OpenCircuit Model Factory\n* Original work\n* Public factual specifications\n.model DUT VDMOS(pchan VTO=-2)\n");
    fs.writeFileSync(path.join(root, "tests", "transfer.cir"), "Fixture test\n.model DUT VDMOS(pchan VTO=-2)\n.temp 75\nMT1 d g 0 DUT\nVd d 0 DC -10\nVg g 0 DC -2.5\n.op\n.end\n");
    assert.deepEqual(validatePackage(root, { requireEvidenceContract: true }).errors, []);
    fs.writeFileSync(path.join(root, "model.cir"), "* OpenCircuit Model Factory\n* Original work\n* Public factual specifications\n.model DUT VDMOS(pchan VTO=-2.2)\n");
    assert.ok(validatePackage(root, { requireEvidenceContract: true }).errors.some((error) => error.includes("VTO magnitude disagrees")));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("contract sources must resolve citation hashes and component datasheet metadata exactly once", () => {
  for (const [mutate, fragment] of [
    [(f) => { f.facts.curves[0].citation_identity.source_sha256 = "b".repeat(64); f.facts.curves[0].citation_identity.citation_id = identityHash({ source_sha256: "b".repeat(64), page: 3, figure: "3", curve: "75 C typical" }); }, "same datasheet source"],
    [(f) => { f.component.datasheet.url = "https://example.com/unrelated.pdf"; }, "datasheet.url"],
    [(f) => { f.component.datasheet.revision = "2"; }, "datasheet.revision"],
    [(f) => { f.facts.source.url = "https://example.com/unrelated.pdf"; }, "facts.source URL"],
    [(f) => { f.facts.source.sha256 = "b".repeat(64); }, "facts.source URL"],
    [(f) => { f.facts.source.revision = "2"; }, "facts.source URL"]
  ]) {
    const errors = mutateContractFixture(mutate);
    assert.ok(errors.some((error) => error.includes(fragment)), `${fragment}: ${errors.join("\n")}`);
  }
});

test("duplicate selected datasheet SHA is rejected even when the selected URL remains unique", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "component-source-duplicate-sha-"));
  try {
    writeContractPackage(root);
    const sourcesPath = path.join(root, "sources.json");
    const sources = JSON.parse(fs.readFileSync(sourcesPath, "utf8"));
    sources.push({ ...sources[0], url: "https://example.com/duplicate-record.pdf" });
    fs.writeFileSync(sourcesPath, JSON.stringify(sources));
    const errors = validatePackage(root, { requireEvidenceContract: true }).errors;
    assert.ok(errors.some((error) => error.includes("selected datasheet SHA-256 must resolve exactly once")), errors.join("\n"));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("linked operating benches reject temperature, analysis, VDS, and VGS mutations", () => {
  const model = ".model DUT VDMOS(VTO=2)\n";
  const cases = [
    [`Fixture test\n${model}.temp 25\nMT1 d g 0 DUT\nVd d 0 DC 10\nVg g 0 DC 2.5\n.op\n.end\n`, ".temp disagrees"],
    [`Fixture test\n${model}.temp 75\nMT1 d g 0 DUT\nVd d 0 DC 10\nVg g 0 DC 2.5\n.dc Vg 0 4 1\n.end\n`, "contains unsupported statement"],
    [`Fixture test\n${model}.temp 75\nMT1 d g 0 DUT\nVd d 0 DC 11\nVg g 0 DC 2.5\n.op\n.end\n`, "drain-source bias disagrees"],
    [`Fixture test\n${model}.temp 75\nMT1 d g 0 DUT\nVd d 0 DC 10\nVg g 0 DC 3\n.op\n.end\n`, "voltage bias"]
  ];
  for (const [bench, fragment] of cases) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "component-bench-contract-"));
    try {
      writeContractPackage(root);
      fs.writeFileSync(path.join(root, "tests", "transfer.cir"), bench);
      const errors = validatePackage(root, { requireEvidenceContract: true }).errors;
      assert.ok(errors.some((error) => error.includes(fragment)), `${fragment}: ${errors.join("\n")}`);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  }
});

test("linked NMOS and PMOS benches must instantiate the active model.cir DUT card", () => {
  for (const family of ["nmos", "pmos"]) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), `component-${family}-wrong-model-`));
    try {
      const fixture = contractFixture();
      fixture.component.electrical_family = family;
      writeContractPackage(root, fixture);
      const pmos = family === "pmos";
      fs.writeFileSync(path.join(root, "model.cir"), `* OpenCircuit Model Factory\n* Original work\n* Public factual specifications\n.model DUT VDMOS(${pmos ? "pchan VTO=-2" : "VTO=2"})\n.model WRONG VDMOS(${pmos ? "pchan VTO=-2" : "VTO=2"})\n* MT1 d g 0 WRONG\n`);
      fs.writeFileSync(path.join(root, "tests", "transfer.cir"), `Fixture test\n.model DUT VDMOS(${pmos ? "pchan VTO=-2" : "VTO=2"})\n.temp 75\nMT1 d g 0 WRONG\nVd d 0 DC ${pmos ? -10 : 10}\nVg g 0 DC ${pmos ? -2.5 : 2.5}\n.op\n.end\n`);
      const errors = validatePackage(root, { requireEvidenceContract: true }).errors;
      assert.ok(errors.some((error) => error.includes("generated DUT instance must use active model DUT")), `${family}: ${errors.join("\n")}`);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  }
});

test("linked MOSFET benches reject local active-model card substitution", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "component-bench-model-shadow-"));
  try {
    writeContractPackage(root);
    fs.writeFileSync(path.join(root, "tests", "transfer.cir"), "Fixture test\n.model DUT VDMOS(VTO=9)\n.temp 75\nMT1 d g 0 DUT\nVd d 0 DC 10\nVg g 0 DC 2.5\n.op\n.end\n");
    const errors = validatePackage(root, { requireEvidenceContract: true }).errors;
    assert.ok(errors.some((error) => error.includes("must exactly match model.cir")), errors.join("\n"));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("linked MOSFET benches reject every statement outside the generated allowlist", () => {
  for (const directive of [
    ".include shadow.cir",
    ".lib shadow.lib corner",
    ".control\naltermod @DUT[VTO]=9\nop\n.endc",
    ".control\nop\n.endc",
    ".source shadow.cir",
    "altermod @DUT[VTO]=9",
    "RHELP d 0 1k"
  ]) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "component-bench-unsupported-statement-"));
    try {
      writeContractPackage(root);
      fs.writeFileSync(path.join(root, "tests", "transfer.cir"), `Fixture test\n${directive}\n.model DUT VDMOS(VTO=2)\n.temp 75\nMT1 d g 0 DUT\nVd d 0 DC 10\nVg g 0 DC 2.5\n.op\n.end\n`);
      const errors = validatePackage(root, { requireEvidenceContract: true }).errors;
      assert.ok(errors.some((error) => error.includes("contains unsupported statement")), `${directive}: ${errors.join("\n")}`);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  }
});

test("linked MOSFET benches cannot hide a live statement in the title slot", () => {
  for (const prefix of ["* comment\n", "\n"]) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "component-bench-title-slot-"));
    try {
      writeContractPackage(root);
      fs.writeFileSync(path.join(root, "tests", "transfer.cir"), `${prefix}RSHUNT d 0 1\n.model DUT VDMOS(VTO=2)\n.temp 75\nMT1 d g 0 DUT\nVd d 0 DC 10\nVg g 0 DC 2.5\n.op\n.end\n`);
      const errors = validatePackage(root, { requireEvidenceContract: true }).errors;
      assert.ok(errors.some((error) => error.includes("must begin with one physical title line")), `${JSON.stringify(prefix)}: ${errors.join("\n")}`);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  }
});

test("linked MOSFET benches reject auxiliary models, devices, and sources", () => {
  for (const extra of [
    ".model AUX VDMOS(VTO=0.1)",
    "MX1 d g 0 DUT",
    "IINJECT 0 d DC 5"
  ]) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "component-bench-extra-topology-"));
    try {
      writeContractPackage(root);
      fs.writeFileSync(path.join(root, "tests", "transfer.cir"), `Fixture test\n.model DUT VDMOS(VTO=2)\n.temp 75\nMT1 d g 0 DUT\nVd d 0 DC 10\nVg g 0 DC 2.5\n${extra}\n.op\n.end\n`);
      const errors = validatePackage(root, { requireEvidenceContract: true }).errors;
      assert.ok(errors.some((error) => error.includes("no auxiliary model cards") || error.includes("not consumed by linked evidence checks")), `${extra}: ${errors.join("\n")}`);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  }
});

test("linked MOSFET benches reject ngspice ground aliases and non-decimal numeric tokens", () => {
  for (const mutate of [
    (bench) => bench.replace("MT1 d g 0 DUT", "MT1 gnd g 0 DUT").replace("Vd d 0 DC 10", "Vd gnd 0 DC 10"),
    (bench) => bench.replace("Vd d 0 DC 10", "Vd d 0 DC 0xA"),
    (bench) => bench.replace("Vg g 0 DC 2.5", "Vg g 0 DC 0b10"),
    (bench) => bench.replace(".temp 75", ".temp 0x4b")
  ]) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "component-bench-ngspice-token-"));
    try {
      writeContractPackage(root);
      const bench = "Fixture test\n.model DUT VDMOS(VTO=2)\n.temp 75\nMT1 d g 0 DUT\nVd d 0 DC 10\nVg g 0 DC 2.5\n.op\n.end\n";
      fs.writeFileSync(path.join(root, "tests", "transfer.cir"), mutate(bench));
      const errors = validatePackage(root, { requireEvidenceContract: true }).errors;
      assert.ok(errors.some((error) => error.includes("gnd alias") || error.includes("non-decimal") || error.includes("unsupported .temp")), errors.join("\n"));
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  }
});

test("linked MOSFET benches require exactly one final end directive", () => {
  for (const ending of ["", ".end\n.end", ".end\nVextra x 0 DC 0"]) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "component-bench-end-grammar-"));
    try {
      writeContractPackage(root);
      fs.writeFileSync(path.join(root, "tests", "transfer.cir"), `Fixture test\n.model DUT VDMOS(VTO=2)\n.temp 75\nMT1 d g 0 DUT\nVd d 0 DC 10\nVg g 0 DC 2.5\n.op\n${ending}\n`);
      const errors = validatePackage(root, { requireEvidenceContract: true }).errors;
      assert.ok(errors.some((error) => error.includes("must terminate with exactly one .end")), `${ending}: ${errors.join("\n")}`);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  }
});

test("linked expectation and fitted residual evidence semantics fail exact mutations", () => {
  const cases = [
    [(f) => { f.expectations.tests[0].scalar_checks[0].expected_value = 6; }, "expected_value disagrees"],
    [(f) => { f.expectations.tests[0].scalar_checks[0].unit = "V"; }, "unit disagrees"],
    [(f) => { f.expectations.tests[0].scalar_checks[0].expression_source.expression = "last(v(d))"; }, "expression quantity disagrees"],
    [(f) => { f.fitted.residuals[0].datasheet_value = 6; }, "datasheet_value disagrees"],
    [(f) => { f.fitted.residuals[0].unit = "V"; }, "unit disagrees"],
    [(f) => { f.fitted.residuals[0].gate_quantity = "gate_threshold"; }, "gate_quantity disagrees"],
    [(f) => { f.fitted.residuals[0].quantity = "output current"; }, "quantity disagrees"]
  ];
  for (const [mutate, fragment] of cases) {
    const errors = mutateContractFixture(mutate);
    assert.ok(errors.some((error) => error.includes(fragment)), `${fragment}: ${errors.join("\n")}`);
  }
});

test("F2 expectations may deliberately sample fitted residual evidence while facts and fitted preserve every residual", () => {
  const errors = mutateContractFixture((fixture) => {
    const curve = fixture.facts.curves[0];
    const secondEvidence = curve.points[1].evidence_identity;
    fixture.fitted.calibration.observations.push({
      ...structuredClone(fixture.fitted.calibration.observations[0]),
      datasheet_value: curve.points[1].y_si,
      condition_identity: curve.condition_identity,
      citation_identity: curve.citation_identity,
      evidence_identity: secondEvidence
    });
    fixture.fitted.residuals.push({
      ...structuredClone(fixture.fitted.residuals[0]),
      datasheet_value: curve.points[1].y_si,
      fitted_value: curve.points[1].y_si,
      relative_error: 0,
      condition_identity: curve.condition_identity,
      citation_identity: curve.citation_identity,
      evidence_identity: secondEvidence
    });
    fixture.fitted.calibration.residual_target_count = fixture.fitted.calibration.observations.length;
    const relativeErrors = fixture.fitted.residuals.map((row) => row.relative_error);
    fixture.fitted.rms_relative_error = Math.sqrt(relativeErrors.reduce((sum, value) => sum + value ** 2, 0) / relativeErrors.length);
  });
  assert.deepEqual(errors, []);
});

test("F2 residual integrity recomputes rows, summaries, worst identity, and gate", () => {
  const cases = [
    [(f) => { f.fitted.residuals[0].relative_error = 0.5; }, "relative_error disagrees"],
    [(f) => { f.fitted.rms_relative_error = 0.5; }, "RMS relative error disagrees"],
    [(f) => { f.fitted.worst_relative_error.value = 0.5; }, "worst relative error"],
    [(f) => { f.fitted.worst_relative_error.quantity = "output current"; }, "worst relative error"],
    [(f) => { f.fitted.f2_gate_pass = false; }, "gate result disagrees"]
  ];
  for (const [mutate, fragment] of cases) {
    const errors = mutateContractFixture(mutate);
    assert.ok(errors.some((error) => error.includes(fragment)), `${fragment}: ${errors.join("\n")}`);
  }
  const nearZero = summarizeMosfetResiduals([{ quantity: "zero target", gate_quantity: "drain_current", datasheet_value: 0, fitted_value: 1e-13, unit: "A" }]);
  assert.equal(nearZero.rows[0].relativeError, 0.1);
  const maximum = summarizeMosfetResiduals([{ quantity: "maximum", gate_quantity: "rds_on", datasheet_value: 1, fitted_value: 0.5, unit: "ohm", evidence_role: "inequality_constraint", maximum: 1 }]);
  assert.equal(maximum.rows[0].relativeError, 0);
});

test("fitted residual must resolve exactly once to its declared calibration record", () => {
  const missing = mutateContractFixture((fixture) => { fixture.fitted.calibration.observations = []; });
  assert.ok(missing.some((error) => error.includes("resolve exactly once to a declared calibration record")), missing.join("\n"));

  const mismatched = mutateContractFixture((fixture) => { fixture.fitted.calibration.observations[0].datasheet_value = 6; });
  assert.ok(mismatched.some((error) => error.includes("datasheet_value disagrees with its declared calibration record")), mismatched.join("\n"));

  const duplicate = mutateContractFixture((fixture) => { fixture.fitted.calibration.observations.push(structuredClone(fixture.fitted.calibration.observations[0])); });
  assert.ok(duplicate.some((error) => error.includes("resolve exactly once to a declared calibration record")), duplicate.join("\n"));
});

test("F2 residual targets require bidirectional completeness", () => {
  const omitted = mutateContractFixture((fixture) => {
    fixture.fitted.residuals = [];
    fixture.fitted.rms_relative_error = null;
    fixture.fitted.worst_relative_error = null;
  });
  assert.ok(omitted.some((error) => error.includes("residual_target_count must equal the observation-linked residual row count")), omitted.join("\n"));
  assert.ok(omitted.some((error) => error.includes("must resolve exactly once to a residual row")), omitted.join("\n"));

  const staleCount = mutateContractFixture((fixture) => { fixture.fitted.calibration.residual_target_count = 2; });
  assert.ok(staleCount.some((error) => error.includes("residual_target_count must equal the declared calibration observation count")), staleCount.join("\n"));
});

test("component fidelity is authoritative and must match fitted fidelity", () => {
  for (const mutate of [
    (fixture) => { delete fixture.fitted.fidelity_tier; },
    (fixture) => { fixture.fitted.fidelity_tier = "F1"; }
  ]) {
    const errors = mutateContractFixture(mutate);
    assert.ok(errors.some((error) => error.includes("fitted.fidelity_tier must exactly equal component.fidelity_tier")), errors.join("\n"));
  }
});

test("F2 residual target count excludes valid inequality-constraint residual rows", () => {
  const errors = mutateContractFixture((fixture) => {
    const conditionMaterial = {
      schema_version: "1.0.0",
      characteristic: "rds_on",
      polarity: "n",
      magnitude_convention: "absolute",
      temperature: { kind: "junction", value_c: 75 },
      electrical: { vgs: { kind: "fixed", value_v: 10 }, vds: { kind: "derived", relation: "id_times_rds" }, id: { kind: "fixed", value_a: 5 } },
      test_mode: { kind: "dc" },
      qualifiers: []
    };
    const condition = { ...conditionMaterial, condition_id: identityHash(conditionMaterial) };
    const citationMaterial = { source_sha256: "a".repeat(64), page: 4, table: "Electrical characteristics", row: "Static drain-source on-resistance" };
    const citation = { ...citationMaterial, citation_id: identityHash(citationMaterial) };
    const cohortId = identityHash(citationCohortMaterial("rds_on", condition.condition_id, citation));
    const makeEvidence = (role, quantityName, value, unit) => {
      const base = { role, condition_id: condition.condition_id, citation_id: citation.citation_id, cohort_id: cohortId };
      return { ...base, evidence_id: identityHash(scalarEvidenceMaterial("rds_on", base, quantityName, value, unit)) };
    };
    const vgsEvidence = makeEvidence("condition", "vgs", 10, "V");
    const currentEvidence = makeEvidence("condition", "id", 5, "A");
    const evidence = makeEvidence("maximum", "resistance", 0.1, "ohm");
    fixture.facts.rdson_points = [{
      vgs: { quantity: "vgs", value: 10, unit: "V", conditions: "ID = 5 A, TJ = 75 C", page_reference: "p. 4", source_kind: "condition", condition_identity: condition, citation_identity: citation, evidence_identity: vgsEvidence },
      current: { quantity: "id", value: 5, unit: "A", conditions: "VGS = 10 V, TJ = 75 C", page_reference: "p. 4", source_kind: "condition", condition_identity: condition, citation_identity: citation, evidence_identity: currentEvidence },
      resistance: { quantity: "resistance", value: 0.1, unit: "ohm", conditions: "VGS = 10 V, ID = 5 A, TJ = 75 C", page_reference: "p. 4", source_kind: "maximum", condition_identity: condition, citation_identity: citation, evidence_identity: evidence }
    }];
    const constraint = { quantity: "rds_on maximum", gate_quantity: "rds_on", datasheet_value: 0.1, unit: "ohm", evidence_role: "inequality_constraint", condition_identity: condition, citation_identity: citation, evidence_identity: evidence };
    fixture.fitted.calibration.constraints.push(constraint);
    fixture.fitted.residuals.push({ ...constraint, fitted_value: 0.08, relative_error: 0, maximum: 0.1 });
    const relativeErrors = fixture.fitted.residuals.map((row) => row.relative_error);
    fixture.fitted.rms_relative_error = Math.sqrt(relativeErrors.reduce((sum, value) => sum + value ** 2, 0) / relativeErrors.length);
  });
  assert.deepEqual(errors, []);
});

test("direct evidence intersection helper handles ranges, values, enumerations, and empty overlap exactly", () => {
  assert.deepEqual(directEvidenceIntersectionErrors({ derivation: "direct_evidence_intersection", kind: "range", minimum: 2, maximum: 4 }, [{ minimum: 1, maximum: 5 }, { minimum: 2, maximum: 4 }]), []);
  assert.deepEqual(directEvidenceIntersectionErrors({ derivation: "direct_evidence_intersection", kind: "enumerated", values: [3] }, [{ minimum: 3, maximum: 3 }]), []);
  assert.deepEqual(directEvidenceIntersectionErrors({ derivation: "direct_evidence_intersection", kind: "enumerated", values: [2, 4] }, [{ values: [1, 2, 4] }, { values: [2, 3, 4] }]), []);
  assert.ok(directEvidenceIntersectionErrors({ derivation: "direct_evidence_intersection", kind: "range", minimum: 1, maximum: 4 }, [{ minimum: 1, maximum: 2 }, { minimum: 3, maximum: 4 }])[0].includes("empty"));
  assert.ok(directEvidenceIntersectionErrors({ derivation: "direct_evidence_intersection", kind: "range", minimum: 1, maximum: 5 }, [{ minimum: 1, maximum: 5 }, { minimum: 2, maximum: 4 }])[0].includes("exactly equal"));
});

test("direct evidence union rejects every finite one-sided bound", () => {
  for (const values of [[10], [10, 10], [10, 20]]) {
    assert.ok(directEvidenceUnionErrors({ derivation: "direct_evidence_union", kind: "minimum", minimum: 10 }, values)[0].includes("one-sided minimum"));
    assert.ok(directEvidenceUnionErrors({ derivation: "direct_evidence_union", kind: "maximum", maximum: values.at(-1) }, values)[0].includes("one-sided maximum"));
  }
  assert.deepEqual(directEvidenceUnionErrors({ derivation: "direct_evidence_union", kind: "range", minimum: 10, maximum: 10 }, [10, 10]), []);
  assert.deepEqual(directEvidenceUnionErrors({ derivation: "direct_evidence_union", kind: "range", minimum: 10, maximum: 20 }, [10, 20]), []);
});

test("direct evidence intersections require the exact non-empty overlap", () => {
  const exact = mutateContractFixture((fixture) => {
    const bound = fixture.component.supported_operating_region.numeric_bounds[0];
    bound.derivation = "direct_evidence_intersection";
    bound.bound_id = identityHash(Object.fromEntries(Object.entries(bound).filter(([key]) => !["bound_id", "conditions", "placeholder"].includes(key))));
  });
  assert.deepEqual(exact, []);

  const widened = mutateContractFixture((fixture) => {
    const bound = fixture.component.supported_operating_region.numeric_bounds[0];
    bound.derivation = "direct_evidence_intersection";
    bound.minimum = 9;
    bound.maximum = 11;
    bound.bound_id = identityHash(Object.fromEntries(Object.entries(bound).filter(([key]) => !["bound_id", "conditions", "placeholder"].includes(key))));
  });
  assert.ok(widened.some((error) => error.includes("exactly equal")), widened.join("\n"));

  const empty = mutateContractFixture((fixture) => {
    const bound = fixture.component.supported_operating_region.numeric_bounds[0];
    bound.derivation = "direct_evidence_intersection";
    bound.evidence_refs.push({ ...bound.evidence_refs[0], evidence_id: fixture.facts.curves[0].points[1].evidence_identity.evidence_id });
    bound.minimum = 10;
    bound.maximum = 10;
    bound.bound_id = identityHash(Object.fromEntries(Object.entries(bound).filter(([key]) => !["bound_id", "conditions", "placeholder"].includes(key))));
  });
  assert.deepEqual(empty, []);
});

test("direct evidence union bounds require exact rehashed extrema and sorted unique enumerations", () => {
  const widened = mutateContractFixture((fixture) => {
    const bound = fixture.component.supported_operating_region.numeric_bounds[0];
    bound.minimum = 0;
    bound.maximum = 20;
    bound.bound_id = identityHash(Object.fromEntries(Object.entries(bound).filter(([key]) => !["bound_id", "conditions", "placeholder"].includes(key))));
  });
  assert.ok(widened.some((error) => error.includes("exactly equal the referenced extrema")), widened.join("\n"));

  const enumerated = mutateContractFixture((fixture) => {
    const bound = fixture.component.supported_operating_region.numeric_bounds[0];
    bound.kind = "enumerated";
    delete bound.minimum;
    delete bound.maximum;
    bound.values = [11, 10];
    bound.bound_id = identityHash(Object.fromEntries(Object.entries(bound).filter(([key]) => !["bound_id", "conditions", "placeholder"].includes(key))));
  });
  assert.ok(enumerated.some((error) => error.includes("sorted unique referenced values")), enumerated.join("\n"));
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
