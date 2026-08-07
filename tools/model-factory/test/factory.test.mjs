import assert from "node:assert/strict";
import test from "node:test";
import { assertEmittedParametersMatchFitted, assertFiniteNumbers } from "../factory.mjs";
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
});

test("advanced golds select their required native fitting pipelines", () => {
  assert.equal(PARTS["2N3904"].pipeline, "bjt");
  assert.equal(PARTS.IRLZ44N.pipeline, "vdmos");
  assert.equal(PARTS.TL072.pipeline, "opamp");
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

test("JSON outputs reject non-finite validation numbers", () => {
  assert.doesNotThrow(() => assertFiniteNumbers({ checks: [{ value: 1.2, minimum: null }] }));
  assert.throws(
    () => assertFiniteNumbers({ benches: [{ checks: [{ value: -Infinity }] }] }),
    /Non-finite number at root\.benches\[0\]\.checks\[0\]\.value: -Infinity/
  );
});
