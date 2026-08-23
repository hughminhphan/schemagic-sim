import assert from "node:assert/strict";
import test from "node:test";
import { validateExpectationsDocument } from "../lib.mjs";

const id = (character) => `sha256:${character.repeat(64)}`;
const IDS = {
  evidence: id("a"),
  condition: id("b"),
  citation: id("c"),
  cohort: id("d")
};

function linkedCheck(overrides = {}) {
  return {
    name: "rdson_curve_point",
    expression_source: {
      kind: "raw_variable",
      expression: "scale:last(v(d),0.04)"
    },
    expected_value: 0.022,
    unit: "ohm",
    tolerance: { absolute: 0, relative: 0.15 },
    datasheet_citation: "Infineon IRLZ44N datasheet, page 3, Figure 4, VGS = 5 V trace",
    placeholder: false,
    evidence_id: IDS.evidence,
    condition_id: IDS.condition,
    citation_id: IDS.citation,
    cohort_id: IDS.cohort,
    bench_condition_id: IDS.condition,
    evidence_role: "curve_point",
    citation_locator: { page: 3, figure: "4", trace: "VGS = 5 V" },
    evidence_qualification: { test_mode: "continuous_dc" },
    bench_qualification: { test_mode: "continuous_dc" },
    ...overrides
  };
}

function documentWith(check = linkedCheck(), overrides = {}) {
  return {
    schema_version: "1.0.0",
    evidence_contract_version: "1.0.0",
    evidence_cohorts: [
      { cohort_id: IDS.cohort, fidelity_tier: "F2", evidence_ids: [IDS.evidence] }
    ],
    tests: [
      {
        test_netlist: "rdson.cir",
        analysis_type: "operating_point",
        scalar_checks: [check],
        hard_bounds_checks: []
      }
    ],
    ...overrides
  };
}

function errorsFor(document) {
  return validateExpectationsDocument(structuredClone(document));
}

function assertRejected(document, fragment) {
  const errors = errorsFor(document);
  assert.ok(errors.some((error) => error.includes(fragment)), `expected ${JSON.stringify(errors)} to include ${fragment}`);
}

test("structured evidence contract accepts complete table and figure linkages", () => {
  assert.deepEqual(errorsFor(documentWith()), []);
  assert.deepEqual(errorsFor(documentWith(linkedCheck({
    evidence_role: "inclusive_maximum",
    citation_locator: { page: 2, table: "Electrical Characteristics", row: "RDS(on)" }
  }))), []);
});

test("legacy expectations remain valid without evidence contract linkage", () => {
  const legacy = documentWith(linkedCheck());
  delete legacy.evidence_contract_version;
  delete legacy.evidence_cohorts;
  for (const field of [
    "evidence_id",
    "condition_id",
    "citation_id",
    "cohort_id",
    "bench_condition_id",
    "evidence_role",
    "citation_locator",
    "evidence_qualification",
    "bench_qualification"
  ]) delete legacy.tests[0].scalar_checks[0][field];
  assert.deepEqual(errorsFor(legacy), []);
});

test("new evidence linkage requires its complete linkage set and contract marker", () => {
  for (const field of [
    "evidence_id",
    "condition_id",
    "citation_id",
    "cohort_id",
    "bench_condition_id",
    "evidence_role",
    "citation_locator",
    "evidence_qualification",
    "bench_qualification"
  ]) {
    const incomplete = documentWith();
    delete incomplete.tests[0].scalar_checks[0][field];
    assertRejected(incomplete, field);
  }

  const unmarked = documentWith();
  delete unmarked.evidence_contract_version;
  delete unmarked.evidence_cohorts;
  assertRejected(unmarked, "evidence_contract_version 1.0.0 is required");
});

test("content-addressed linkage IDs reject malformed sha256 values", () => {
  for (const [field, value] of [
    ["evidence_id", "sha256:abc"],
    ["condition_id", `sha256:${"g".repeat(64)}`],
    ["citation_id", "not-a-hash"],
    ["cohort_id", id("e").slice(0, -1)],
    ["bench_condition_id", `SHA256:${"f".repeat(64)}`]
  ]) assertRejected(documentWith(linkedCheck({ [field]: value })), "must match pattern");
});

test("bench condition identity must equal evidence condition identity", () => {
  assertRejected(documentWith(linkedCheck({ bench_condition_id: id("e") })), "bench_condition_id must equal condition_id");
});

test("structured citation locator requires page plus table row or figure curve trace", () => {
  assertRejected(documentWith(linkedCheck({ citation_locator: { page: 3, table: "Electrical Characteristics" } })), "must have required property 'row'");
  assertRejected(documentWith(linkedCheck({ citation_locator: { page: 3, figure: "4" } })), "must match exactly one schema in oneOf");
  assertRejected(documentWith(linkedCheck({ citation_locator: { figure: "4", curve: "25 C" } })), "must have required property 'page'");
});

test("placeholder and generic citations are rejected for linked expectations", () => {
  for (const citation of ["TBD", "datasheet", "see datasheet", "electrical characteristics", "Figure"]) {
    assertRejected(documentWith(linkedCheck({ datasheet_citation: citation })), "must identify a specific primary citation");
  }
  assertRejected(documentWith(linkedCheck({
    citation_locator: { page: 3, figure: "4", trace: "TBD" }
  })), "citation_locator must identify a specific table row or figure curve/trace");
});

test("pulse-qualified new-contract claims require exactly matching bench qualification", () => {
  for (const pulse of [
    { test_mode: "pulsed", pulse_width_s: 0.0003, duty_cycle: 0.02 },
    { test_mode: "single_pulse", pulse_width_s: 0.0003 },
  ]) {
    assert.deepEqual(errorsFor(documentWith(linkedCheck({ evidence_qualification: pulse, bench_qualification: pulse }))), []);
    assertRejected(documentWith(linkedCheck({
      evidence_qualification: pulse,
      bench_qualification: { test_mode: "continuous_dc" }
    })), "bench qualification must match evidence qualification");
  }
});

test("F1 evidence cohorts are valid for strict bound and typical-point packages", () => {
  const document = documentWith();
  document.evidence_cohorts[0].fidelity_tier = "F1";
  assert.deepEqual(errorsFor(document), []);
});

test("isothermal diode projection records unresolved source timing instead of inventing DC", () => {
  for (const sourceQualification of [
    { test_mode: "not_stated" },
    { test_mode: "pulsed_limit", maximum_pulse_width_s: 0.0003, maximum_duty_cycle: 0.02 },
  ]) {
    const projected = linkedCheck({
      evidence_qualification: sourceQualification,
      bench_qualification: { test_mode: "continuous_dc" },
      bench_equivalence_policy: "isothermal_diode_forward_projection",
    });
    assert.deepEqual(errorsFor(documentWith(projected)), []);
    assertRejected(documentWith(linkedCheck({
      evidence_qualification: sourceQualification,
      bench_qualification: { test_mode: "continuous_dc" },
    })), "bench qualification must match evidence qualification");
  }
  assertRejected(documentWith(linkedCheck({
    evidence_qualification: { test_mode: "pulsed", pulse_width_s: 0.0003, duty_cycle: 0.01 },
    bench_qualification: { test_mode: "continuous_dc" },
    bench_equivalence_policy: "isothermal_diode_forward_projection",
  })), "requires not-stated or pulse-limited source mode");
});

test("new F2 cohorts require a member expectation and declared evidence membership", () => {
  const unlinked = documentWith(undefined, {
    tests: [{
      test_netlist: "rdson.cir",
      analysis_type: "operating_point",
      scalar_checks: [],
      hard_bounds_checks: []
    }]
  });
  assertRejected(unlinked, "must have at least one linked expectation");

  const wrongEvidence = documentWith();
  wrongEvidence.evidence_cohorts[0].evidence_ids = [id("e")];
  assertRejected(wrongEvidence, "evidence_id is not a member of cohort");

  const wrongCohort = documentWith(linkedCheck({ cohort_id: id("e") }));
  assertRejected(wrongCohort, "references undeclared evidence cohort");
});
