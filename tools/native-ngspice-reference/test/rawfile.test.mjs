import assert from "node:assert/strict";
import test from "node:test";
import { canonicalVectorName, parseRawfile } from "../lib/rawfile.mjs";

function makeRaw({ flags = "real", variables, points }) {
  const complex = flags === "complex";
  const header = [
    "Title: parser test",
    "Date: today",
    "Plotname: Test Analysis",
    `Flags: ${flags}`,
    `No. Variables: ${variables.length}`,
    `No. Points: ${points.length}`,
    "Variables:",
    ...variables.map((variable, index) => `\t${index}\t${variable.name}\t${variable.type}`),
    "Binary:\n",
  ].join("\n");
  const payload = Buffer.alloc(points.length * variables.length * (complex ? 16 : 8));
  let offset = 0;
  for (const point of points) {
    for (const value of point) {
      if (complex) {
        payload.writeDoubleLE(value.real, offset);
        payload.writeDoubleLE(value.img, offset + 8);
        offset += 16;
      } else {
        payload.writeDoubleLE(value, offset);
        offset += 8;
      }
    }
  }
  return Buffer.concat([Buffer.from(header), payload]);
}

test("parses real binary vectors", () => {
  const parsed = parseRawfile(makeRaw({
    variables: [{ name: "time", type: "time" }, { name: "v(out)", type: "voltage" }],
    points: [[0, 1.25], [1e-3, 2.5]],
  }));
  assert.equal(parsed.dataType, "real");
  assert.deepEqual(parsed.data.get("time"), [0, 1e-3]);
  assert.deepEqual(parsed.data.get("v(out)"), [1.25, 2.5]);
});

test("parses complex binary vectors", () => {
  const parsed = parseRawfile(makeRaw({
    flags: "complex",
    variables: [{ name: "frequency", type: "frequency" }, { name: "v(out)", type: "voltage" }],
    points: [[{ real: 10, img: 0 }, { real: 0.5, img: -0.25 }]],
  }));
  assert.equal(parsed.dataType, "complex");
  assert.deepEqual(parsed.data.get("v(out)"), [{ real: 0.5, img: -0.25 }]);
});

test("rejects truncated binary payloads before allocating vectors", () => {
  const raw = makeRaw({
    variables: [{ name: "time", type: "time" }],
    points: [[0], [1]],
  });
  assert.throws(() => parseRawfile(raw.subarray(0, -1)), /truncated/);
});

test("rejects unsafe payload sizes before allocating vectors", () => {
  const raw = Buffer.from([
    "Title: huge",
    "Plotname: Test",
    "Flags: real",
    "No. Variables: 1",
    "No. Points: 10000000000",
    "Variables:",
    "\t0\ttime\ttime",
    "Binary:\n",
  ].join("\n"));
  assert.throws(() => parseRawfile(raw), /exceeds/);
});

test("normalizes voltage and branch-current vector names", () => {
  assert.equal(canonicalVectorName("OUT", "voltage"), "v(out)");
  assert.equal(canonicalVectorName("V(Out)", "voltage"), "v(out)");
  assert.equal(canonicalVectorName("V1#branch", "current"), "i(v1)");
  assert.equal(canonicalVectorName("I(V1)", "current"), "i(v1)");
});
