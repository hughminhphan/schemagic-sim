import assert from "node:assert/strict";
import test from "node:test";
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

test("registry contains only datasheet PDF acquisition URLs", () => {
  for (const part of Object.values(PARTS)) {
    const url = new URL(part.source.url);
    assert.equal(url.protocol, "https:");
    assert.match(url.pathname, /\.pdf$/i);
    assert.doesNotMatch(url.pathname, /\.(lib|cir)$/i);
  }
});
