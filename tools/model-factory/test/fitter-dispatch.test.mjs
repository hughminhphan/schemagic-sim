import assert from "node:assert/strict";
import test from "node:test";

import { FITTER_SCRIPTS, UNFITTABLE_PIPELINES, UnmappedArchetypeError, fitterScriptFor } from "../factory.mjs";
import { PARTS } from "../lib/parts.mjs";

function caught(pipeline) {
  try {
    fitterScriptFor(pipeline);
  } catch (error) {
    return error;
  }
  throw new assert.AssertionError({ message: `fitterScriptFor(${JSON.stringify(pipeline)}) did not throw` });
}

// The dispatch used to end in `?? "fit_diode.py"`. BF256B declares pipeline "njf", so the
// only JFET in the registry could silently reach a diode model. The explicit NJF route is
// the regression boundary: it must never equal or alias the diode fitter.
test("a JFET job routes to the NJF fitter and never reaches the diode fitter", () => {
  assert.equal(fitterScriptFor("njf"), "fit_jfet.py");
  assert.notEqual(fitterScriptFor("njf"), fitterScriptFor("diode"));
  assert.equal(PARTS.BF256B.pipeline, "njf");
});

test("an entirely unknown archetype names the archetypes that do have fitters", () => {
  const error = caught("bicmos_unicorn");
  assert.ok(error instanceof UnmappedArchetypeError);
  assert.equal(error.unfittable, false);
  assert.match(error.message, /Mapped archetypes: bjt, darlington, diode/);
});

test("an absent archetype is an error, not a silent diode", () => {
  for (const missing of [undefined, null, ""]) {
    assert.ok(caught(missing) instanceof UnmappedArchetypeError);
  }
});

test("the diode archetype is now spelled out rather than reached by falling through", () => {
  assert.equal(fitterScriptFor("diode"), "fit_diode.py");
  const diodes = Object.entries(PARTS).filter(([, part]) => part.pipeline === "diode").map(([mpn]) => mpn);
  assert.deepEqual(diodes.sort(), ["1N4148", "1N5822", "BAT85", "BZX84C5V1", "SS14", "WP7113ID"]);
});

test("every registered archetype either maps to a fitter or is a written unfittable decision", () => {
  // "sibling_alias" never reaches the fitter: stageFit copies the documented die fit.
  const handledElsewhere = new Set(["sibling_alias"]);
  for (const [mpn, part] of Object.entries(PARTS)) {
    assert.ok(part.pipeline, `${mpn} has no declared archetype`);
    if (handledElsewhere.has(part.pipeline)) continue;
    const mapped = Object.hasOwn(FITTER_SCRIPTS, part.pipeline);
    const declaredUnfittable = Object.hasOwn(UNFITTABLE_PIPELINES, part.pipeline);
    assert.ok(mapped || declaredUnfittable, `${mpn} archetype "${part.pipeline}" is neither mapped nor declared unfittable`);
  }
});

test("each unfittable archetype records why, not just that", () => {
  for (const [pipeline, reason] of Object.entries(UNFITTABLE_PIPELINES)) {
    assert.ok(reason.length > 120, `${pipeline} needs a written reason a reviewer can act on`);
    assert.ok(!Object.hasOwn(FITTER_SCRIPTS, pipeline), `${pipeline} cannot be both mapped and unfittable`);
  }
});
