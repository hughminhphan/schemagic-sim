import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { assertCardParameterTable, assertEmittedParametersMatchFitted, assertFiniteNumbers, expressionValue, renderParameterTable, stageTestgen } from "../factory.mjs";
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

test("VDMOS threshold test generation has no silent 250 uA or temperature fallback", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "factory-threshold-evidence-test-"));
  try {
    fs.mkdirSync(path.join(root, "tests"));
    fs.writeFileSync(path.join(root, "model.cir"), ".model DUT VDMOS(VTO=1 KP=1)\n");
    fs.writeFileSync(path.join(root, "facts.json"), JSON.stringify({
      rdson_points: [],
      threshold: {
        minimum: { value: 1, unit: "V", conditions: "VDS = VGS, ID = 500 uA", page_reference: "p. 2", source_kind: "minimum" },
        typical: null,
        maximum: { value: 2, unit: "V", conditions: "VDS = VGS, ID = 500 uA", page_reference: "p. 2", source_kind: "maximum" },
      },
      transfer_points: [],
      output_points: [],
    }));
    const ctx = {
      packageDir: root,
      part: {
        slug: "NO-FALLBACK",
        pipeline: "vdmos",
        identity: { electrical_family: "nmos" },
        component: { modelName: "DUT", test_tolerances: { threshold: 0.35 } },
      },
    };
    assert.throws(() => stageTestgen(ctx), /requires an exact cited positive test_current in amperes/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
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
