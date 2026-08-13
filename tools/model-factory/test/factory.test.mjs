import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { assertCardParameterTable, assertEmittedParametersMatchFitted, assertFiniteNumbers, assertMosfetConditionIdentityContract, expressionValue, identityHash, normalizeMosfetConditionIdentity, normalizeMosfetCurve, renderParameterTable, stageTestgen } from "../factory.mjs";
import { PARTS, getPart } from "../lib/parts.mjs";

function assertQuantityReferences(value) {
  if (Array.isArray(value)) return value.forEach(assertQuantityReferences);
  if (!value || typeof value !== "object") return;
  if (Object.hasOwn(value, "value")) {
    for (const field of ["unit", "conditions", "page_reference", "source_kind"]) {
      assert.equal(typeof value[field], "string");
      assert.ok(value[field].length > 0);
    }
  }
  Object.values(value).forEach(assertQuantityReferences);
}

test("registry resolves supported MPNs case-insensitively", () => {
  assert.equal(getPart("1n4148"), PARTS["1N4148"]);
  assert.equal(getPart("wp7113id"), PARTS.WP7113ID);
  assert.equal(getPart("2n3904"), PARTS["2N3904"]);
  assert.equal(getPart("irlz44n"), PARTS.IRLZ44N);
  assert.equal(getPart("tl072"), PARTS.TL072);
  assert.equal(getPart("lm35"), PARTS.LM35);
  assert.equal(getPart("ntcle100e3103jb0"), PARTS.NTCLE100E3103JB0);
  assert.equal(getPart("gl5528"), PARTS.GL5528);
});

test("advanced golds select their required native fitting pipelines", () => {
  assert.equal(PARTS["2N3904"].pipeline, "bjt");
  assert.equal(PARTS.IRLZ44N.pipeline, "vdmos");
  assert.equal(PARTS.TL072.pipeline, "opamp");
  assert.equal(PARTS.LM35.pipeline, "sensor_behavioral");
  assert.equal(PARTS.NTCLE100E3103JB0.pipeline, "sensor_behavioral");
  assert.equal(PARTS.GL5528.pipeline, "sensor_behavioral");
});

test("all factual quantities carry units, conditions, source kind, and page references", () => {
  for (const part of Object.values(PARTS)) assertQuantityReferences(part.facts);
});

test("registry contains only official HTTPS datasheet or specification URLs", () => {
  for (const part of Object.values(PARTS)) {
    const url = new URL(part.source.url);
    assert.equal(url.protocol, "https:");
    assert.doesNotMatch(url.pathname, /\.(lib|cir)$/i);
    const isPdf = /\.pdf$/i.test(url.pathname);
    const isDisclosedHtmlFallback = part.component.fidelity_tier === "F1"
      && /html specification|specification page|spec page/i.test(part.facts.extraction_method ?? "");
    assert.ok(isPdf || isDisclosedHtmlFallback, `${part.slug} must use a datasheet PDF or disclosed F1 HTML specification fallback`);
  }
});

test("generate postcondition accepts emitted fitted parameters", () => {
  assert.doesNotThrow(() => assertEmittedParametersMatchFitted(
    ".model DUT NPN(IS=1.0000000000e-14 BF=2.1765731916e2 TF=5.3449580951e-10)\n",
    { parameters: { IS: 1e-14, BF: 217.6573191599617, TF: 5.344958095051651e-10 } }
  ));
});

test("generate postcondition enforces negative PMOS VTO magnitude and preserves NMOS equality", () => {
  assert.doesNotThrow(() => assertEmittedParametersMatchFitted(
    ".model DUT VDMOS(pchan VTO=-2.1 KP=1)\n",
    { parameters: { VTO: 2.1, KP: 1 } },
    "pmos"
  ));
  assert.throws(() => assertEmittedParametersMatchFitted(
    ".model DUT VDMOS(pchan VTO=2.1 KP=1)\n",
    { parameters: { VTO: 2.1, KP: 1 } },
    "pmos"
  ), /expected a negative threshold/);
  assert.throws(() => assertEmittedParametersMatchFitted(
    ".model DUT VDMOS(pchan VTO=-2.2 KP=1)\n",
    { parameters: { VTO: 2.1, KP: 1 } },
    "pmos"
  ), /emitted magnitude 2.2, fitted 2.1/);
  assert.doesNotThrow(() => assertEmittedParametersMatchFitted(
    ".model DUT VDMOS(VTO=2.1 KP=1)\n",
    { parameters: { VTO: 2.1, KP: 1 } },
    "nmos"
  ));
});

test("generate postcondition rejects stale parameter cards", () => {
  assert.throws(() => assertEmittedParametersMatchFitted(
    ".model DUT NPN(IS=1e-14 BF=2000)\n",
    { parameters: { IS: 1e-14, BF: 217.6573191599617 } }
  ), /BF: emitted 2000, fitted 217\.6573191599617/);
});

test("card rendering includes every fitted parameter", () => {
  const fitted = {
    parameters: { IS: 1e-14, BF: 217.6573191599617 },
    parameter_metadata: { IS: { status: "fitted" }, BF: { status: "fitted" } }
  };
  const table = renderParameterTable(fitted);
  assert.match(table, /\| IS \|/);
  assert.match(table, /\| BF \|/);
  assert.doesNotThrow(() => assertCardParameterTable(`\n## Model parameters\n\n| Parameter | Value | Status |\n| --- | ---: | --- |\n${table}\n\n## Known omissions\n`, fitted));
  assert.throws(() => assertCardParameterTable("\n## Known omissions\n", fitted), /missing the model-parameter table/);
});

test("JSON outputs reject non-finite validation numbers", () => {
  assert.doesNotThrow(() => assertFiniteNumbers({ checks: [{ value: 1.2, minimum: null }] }));
  assert.throws(
    () => assertFiniteNumbers({ benches: [{ checks: [{ value: -Infinity }] }] }),
    /Non-finite number at root\.benches\[0\]\.checks\[0\]\.value: -Infinity/
  );
});

test("scale_abs:last evaluates MOSFET voltage and current vectors", () => {
  const nativeResult = { vectors: [
    { name: "v(d1)", type: "voltage", values: [0, -0.125] },
    { name: "i(vd1)", type: "current", values: [0, -2e-6] },
  ] };
  assert.equal(expressionValue(nativeResult, "scale_abs:last(v(d1),8)"), 1);
  assert.equal(expressionValue(nativeResult, "scale_abs:last(i(vd1),1000000)"), 2);
});

test("timer edge extraction computes frequency, duty cycle, and pulse width", () => {
  const time = Array.from({ length: 17 }, (_, index) => index);
  const output = time.map((value) => Math.floor(value / 2) % 2 === 0 ? 0 : 5);
  const nativeResult = { vectors: [
    { name: "time", type: "time", values: time },
    { name: "v(out)", type: "voltage", values: output }
  ] };
  assert.equal(expressionValue(nativeResult, "frequency_from_edges(v(out),2.5,rising,1,4)"), 0.25);
  assert.equal(expressionValue(nativeResult, "duty_cycle_from_edges(v(out),2.5,rising,1,falling,1,rising,2)"), 0.5);
  assert.equal(expressionValue(nativeResult, "pulse_width(v(out),2.5,rising,1,falling,1)"), 2);
  assert.equal(expressionValue(nativeResult, "at(v(out),0)"), 0);
  assert.equal(expressionValue(nativeResult, "max_after(v(out),4)"), 5);
});

function withId(value, field) {
  return { ...value, [field]: identityHash(value) };
}

function mosfetIdentity(characteristic, overrides = {}) {
  return withId({
    schema_version: "1.0.0",
    characteristic,
    polarity: "n",
    magnitude_convention: "absolute",
    temperature: { kind: "junction", value_c: 75 },
    electrical: {
      vgs: { kind: "fixed", value_v: characteristic === "gate_threshold" ? 2 : 10 },
      vds: characteristic === "gate_threshold" ? { kind: "relation", relation: "vds_equals_vgs" } : { kind: "fixed", value_v: 10 },
      id: { kind: "fixed", value_a: characteristic === "gate_threshold" ? 500e-6 : 6 }
    },
    test_mode: { kind: "dc" },
    qualifiers: [],
    ...overrides
  }, "condition_id");
}

function citationIdentity(overrides = {}) {
  return withId({ source_sha256: "a".repeat(64), page: 3, figure: "3", curve: "25 C typical", ...overrides }, "citation_id");
}

function evidenceIdentity(condition, citation, role, overrides = {}) {
  const { quantity, value_si, unit_si, x_si, y_si, ...identityOverrides } = overrides;
  const cohortId = overrides.curve_id
    ? identityHash({ characteristic: condition.characteristic, condition_id: condition.condition_id, citation_id: citation.citation_id, curve_id: overrides.curve_id })
    : identityHash({ characteristic: condition.characteristic, condition_id: condition.condition_id, source_sha256: citation.source_sha256, page: citation.page, ...(citation.table ? { table: citation.table, row: citation.row } : { figure: citation.figure, ...(citation.curve ? { curve: citation.curve } : { trace: citation.trace }) }) });
  const content = { cohort_id: overrides.cohort_id ?? cohortId, role, condition_id: condition.condition_id, citation_id: citation.citation_id, ...identityOverrides };
  const material = overrides.curve_id
    ? { characteristic: condition.characteristic, role, point_index: overrides.point_index, x_si, y_si, condition_id: condition.condition_id, citation_id: citation.citation_id, cohort_id: content.cohort_id, curve_id: overrides.curve_id }
    : { characteristic: condition.characteristic, role, quantity, value_si, unit_si, condition_id: condition.condition_id, citation_id: citation.citation_id };
  return { ...content, evidence_id: identityHash(material) };
}

function quantity(label, value, unit, sourceKind, condition, citation, evidence) {
  return { quantity: label, value, unit, conditions: "typed condition identity", page_reference: "p. 3 Figure 3 curve 25 C typical", source_kind: sourceKind, condition_identity: condition, citation_identity: citation, evidence_identity: evidence };
}

function curveIdentity(characteristic, conditionOverrides = {}) {
  const condition = mosfetIdentity(characteristic, conditionOverrides);
  const citation = citationIdentity();
  const axis = characteristic === "transfer_current" ? "vgs" : "vds";
  const rawPoints = [{ x_si: 2.5, y_si: 5, point_index: 0 }, { x_si: 3, y_si: 20, point_index: 1 }];
  const curveId = identityHash({ schema_version: "1.0.0", characteristic, x_axis: { quantity: axis, unit: "V" }, y_axis: { quantity: "id", unit: "A" }, condition_id: condition.condition_id, citation_id: citation.citation_id, points: rawPoints });
  return {
    curve_id: curveId,
    characteristic,
    x_axis: { quantity: axis, unit: "V" },
    y_axis: { quantity: "id", unit: "A" },
    condition_identity: condition,
    citation_identity: citation,
    points: rawPoints.map((point) => ({ ...point, evidence_identity: evidenceIdentity(condition, citation, "digitized_typical_curve", { curve_id: curveId, point_index: point.point_index, x_si: point.x_si, y_si: point.y_si }) }))
  };
}

function regionBound(quantityName, values, evidenceRows, extra = {}) {
  const refs = evidenceRows.map(({ condition, citation, evidence }) => ({ evidence_id: evidence.evidence_id, condition_id: condition.condition_id, citation_id: citation.citation_id, cohort_id: evidence.cohort_id }));
  const content = {
    quantity: quantityName,
    kind: "enumerated",
    unit: quantityName === "id" ? "A" : quantityName === "temperature" ? "degC" : "V",
    values,
    ...(quantityName === "temperature" ? { temperature_kind: "junction" } : {}),
    evidence_refs: refs,
    condition_ids: [...new Set(refs.map((ref) => ref.condition_id))].sort(),
    citation_ids: [...new Set(refs.map((ref) => ref.citation_id))].sort(),
    derivation: "direct_evidence_union",
    ...extra
  };
  return { bound_id: identityHash(content), ...content };
}

test("canonical MOSFET condition identities reject missing temperature and malformed IDs", () => {
  const valid = mosfetIdentity("gate_threshold");
  assert.deepEqual(normalizeMosfetConditionIdentity(valid), valid);
  const missing = structuredClone(valid);
  delete missing.temperature;
  assert.throws(() => normalizeMosfetConditionIdentity(missing), /temperature is required/);
  assert.throws(() => normalizeMosfetConditionIdentity({ ...valid, condition_id: `sha256:${"f".repeat(64)}` }), /does not match canonical content/);
});

test("canonical MOSFET curves preserve typed VDS, temperature, curve IDs, and ordered point evidence", () => {
  const curve = curveIdentity("transfer_current");
  assert.deepEqual(normalizeMosfetCurve(curve), curve);
  const hybrid = structuredClone(curve);
  hybrid.points[0].evidence_identity.condition_id = `sha256:${"c".repeat(64)}`;
  assert.throws(() => normalizeMosfetCurve(hybrid), /does not match canonical content|hybrid condition or citation IDs/);
  for (const mutate of [
    (candidate) => { candidate.points[0].evidence_identity.point_index = 99; },
    (candidate) => { candidate.points[0].evidence_identity.curve_id = `sha256:${"f".repeat(64)}`; },
    (candidate) => { candidate.points[0].evidence_identity.role = "typical"; }
  ]) {
    const candidate = structuredClone(curve);
    mutate(candidate);
    assert.throws(() => normalizeMosfetCurve(candidate), /hybrid curve identity|role must be digitized_typical_curve/);
  }
  const placeholder = structuredClone(curve);
  placeholder.citation_identity = citationIdentity({ figure: "placeholder" });
  assert.throws(() => normalizeMosfetCurve(placeholder), /figure is invalid/);
});

test("conveyor MOSFET package contract rejects hidden critical defaults and hybrid provenance", () => {
  const condition = mosfetIdentity("rds_on");
  const citation = citationIdentity();
  const vgsEvidence = evidenceIdentity(condition, citation, "typical", { quantity: "vgs", value_si: 10, unit_si: "V" });
  const currentEvidence = evidenceIdentity(condition, citation, "typical", { cohort_id: vgsEvidence.cohort_id, quantity: "drain_current", value_si: 6, unit_si: "A" });
  const resistanceEvidence = evidenceIdentity(condition, citation, "maximum", { cohort_id: vgsEvidence.cohort_id, quantity: "rds_on_maximum", value_si: 0.1, unit_si: "ohm" });
  const facts = {
    evidence_contract_version: "1.0.0",
    extraction: {},
    source: { sha256: "a".repeat(64), pages_referenced: ["p. 3"], placeholder: false },
    rdson_points: [{
      vgs: quantity("vgs", 10, "V", "typical", condition, citation, vgsEvidence),
      current: quantity("drain_current", 6, "A", "typical", condition, citation, currentEvidence),
      resistance: quantity("rds_on_maximum", 0.1, "ohm", "maximum", condition, citation, resistanceEvidence)
    }]
  };
  const evidenceRows = [vgsEvidence, currentEvidence, resistanceEvidence].map((evidence) => ({ condition, citation, evidence }));
  const ctx = { part: { slug: "fixture", pipeline: "vdmos", component: { supported_operating_region: { contract_version: "1.0.0", numeric_bounds: [
    regionBound("vgs", [10], evidenceRows), regionBound("vds", [10], evidenceRows), regionBound("id", [6], evidenceRows), regionBound("temperature", [75], evidenceRows)
  ] } } } };
  assert.doesNotThrow(() => assertMosfetConditionIdentityContract(ctx, facts, { parameters: {}, held_defaults: [] }));
  assert.throws(() => assertMosfetConditionIdentityContract(ctx, facts, { parameters: { VTO: 2 }, held_defaults: [{ parameter: "VTO", value: 2, unit: "V", reason: "physical constant" }] }), /critical MOSFET/);
  const hybrid = structuredClone(facts);
  hybrid.rdson_points[0].current.condition_identity = mosfetIdentity("rds_on", { electrical: { ...condition.electrical, id: { kind: "fixed", value_a: 5 } } });
  assert.throws(() => assertMosfetConditionIdentityContract(ctx, hybrid, { parameters: {}, held_defaults: [] }), /hybrid/);

  const missingRef = structuredClone(ctx);
  missingRef.part.component.supported_operating_region.numeric_bounds[0].evidence_refs = [];
  assert.throws(() => assertMosfetConditionIdentityContract(missingRef, facts, { parameters: {}, held_defaults: [] }), /evidence_refs must be non-empty/);

  const alteredRef = structuredClone(ctx);
  alteredRef.part.component.supported_operating_region.numeric_bounds[0].evidence_refs[0].evidence_id = `sha256:${"f".repeat(64)}`;
  assert.throws(() => assertMosfetConditionIdentityContract(alteredRef, facts, { parameters: {}, held_defaults: [] }), /does not resolve to package evidence/);

  const widened = structuredClone(ctx);
  const widenedBound = widened.part.component.supported_operating_region.numeric_bounds[0];
  widenedBound.values = [9, 10, 11];
  widenedBound.bound_id = identityHash(Object.fromEntries(Object.entries(widenedBound).filter(([key]) => key !== "bound_id")));
  assert.throws(() => assertMosfetConditionIdentityContract(widened, facts, { parameters: {}, held_defaults: [] }), /sorted unique referenced values/);
});

test("legacy reviewed MOSFET package generation remains backward-compatible", () => {
  const packageDir = path.resolve("../../packages/model-library/models/infineon/IRLZ44N");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "factory-mosfet-legacy-"));
  try {
    fs.cpSync(packageDir, root, { recursive: true });
    const ctx = { packageDir: root, part: { slug: "irlz44n", pipeline: "vdmos", identity: { electrical_family: "nmos" }, component: { modelName: "IRLZ44N_OC", test_tolerances: { rds_on: 0.15, drain_current: 0.33, threshold: 0.35 }, numeric_bounds: [] } } };
    assert.doesNotThrow(() => stageTestgen(ctx));
    const expectations = JSON.parse(fs.readFileSync(path.join(root, "tests", "expectations.json"), "utf8"));
    assert.ok(expectations.tests.some((entry) => entry.test_netlist === "transfer_curve.cir"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("legacy MOSFET benches fail missing threshold current, temperature, and transfer VDS instead of defaulting", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "factory-mosfet-defaults-"));
  try {
    const baseCtx = { packageDir: root, part: { slug: "fixture", pipeline: "vdmos", identity: { electrical_family: "nmos" }, component: { modelName: "DUT", test_tolerances: {}, numeric_bounds: [] } } };
    fs.mkdirSync(path.join(root, "tests"));
    fs.writeFileSync(path.join(root, "model.cir"), ".model DUT VDMOS(VTO=2 KP=1 RD=0.1 RS=0.1 RG=1e-4 CGS=1p CGDMAX=1p CGDMIN=1p A=1 CJO=1p IS=1e-12 N=1 RB=0.1 TT=1n BV=60 IBV=1u RTHJC=1 RTHCA=60)\n");
    fs.writeFileSync(path.join(root, "fitted.json"), JSON.stringify({ parameters: {} }));
    const cited = { value: 1, unit: "V", conditions: "VDS = VGS", page_reference: "p. 3 electrical characteristics", source_kind: "minimum" };
    fs.writeFileSync(path.join(root, "facts.json"), JSON.stringify({ threshold: { minimum: cited, maximum: { ...cited, value: 3 } } }));
    assert.throws(() => stageTestgen(baseCtx), /test current/);
    fs.writeFileSync(path.join(root, "facts.json"), JSON.stringify({ fit_conditions: { temperature: { value: 25, unit: "degC" } }, transfer_points: [{ vgs: { ...cited, value: 3 }, current: { ...cited, value: 2, unit: "A" } }] }));
    assert.throws(() => stageTestgen(baseCtx), /requires cited VDS/);
    fs.writeFileSync(path.join(root, "facts.json"), JSON.stringify({ rdson_points: [{ vgs: { ...cited, value: 10 }, current: { ...cited, value: 6, unit: "A" }, resistance: { ...cited, value: 0.1, unit: "ohm" } }] }));
    assert.throws(() => stageTestgen(baseCtx), /exact cited temperature/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("pulse-qualified MOSFET curve evidence is rejected from continuous operating-point benches", () => {
  const curve = curveIdentity("transfer_current", { test_mode: { kind: "pulsed", pulse_width_s: 10e-6, duty_cycle: 0.01 } });
  assert.equal(normalizeMosfetCurve(curve).condition_identity.test_mode.kind, "pulsed");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "factory-mosfet-pulse-"));
  try {
    const facts = { evidence_contract_version: "1.0.0", extraction: {}, source: { sha256: "a".repeat(64), pages_referenced: ["p. 3"], placeholder: false }, curves: [curve] };
    const evidenceRows = curve.points.map((point) => ({ condition: curve.condition_identity, citation: curve.citation_identity, evidence: point.evidence_identity }));
    const operating = { contract_version: "1.0.0", numeric_bounds: [regionBound("vgs", [curve.condition_identity.electrical.vgs.value_v], evidenceRows), regionBound("vds", [10], evidenceRows), regionBound("id", [curve.condition_identity.electrical.id.value_a], evidenceRows), regionBound("temperature", [75], evidenceRows)] };
    const ctx = { packageDir: root, part: { slug: "fixture", pipeline: "vdmos", identity: { electrical_family: "nmos" }, component: { modelName: "DUT", supported_operating_region: operating, test_tolerances: {} } } };
    fs.mkdirSync(path.join(root, "tests"));
    fs.writeFileSync(path.join(root, "model.cir"), ".model DUT VDMOS(VTO=2 KP=1 RD=0.1 RS=0.1 RG=1e-4 CGS=1p CGDMAX=1p CGDMIN=1p A=1 CJO=1p IS=1e-12 N=1 RB=0.1 TT=1n BV=60 IBV=1u RTHJC=1 RTHCA=60)\n");
    fs.writeFileSync(path.join(root, "facts.json"), JSON.stringify(facts));
    fs.writeFileSync(path.join(root, "fitted.json"), JSON.stringify({ parameters: {}, held_defaults: [] }));
    assert.throws(() => stageTestgen(ctx), /pulsed-qualified/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
