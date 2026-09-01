# Application golden verification

The reproducible four-topology application golden is defined by
`tools/native-ngspice-reference/application-golden/contract.json` and linked back to the installed
synthetic Motor M1 and Power P1 Designer contexts by
`test/application-golden.test.ts`.

The workspace test proves deterministic candidate, recipe, topology representation, graph,
scenario, serialization, and netlist identity for Motor integrated, Motor external-NMOS, Power
integrated, and Power external-FET recipes. The native-reference runner then executes those exact
netlist bytes with native ngspice-46 and the shipped ngspice-46 browser-WASM artifact. It checks only
the vectors and numeric windows named in the contract, repeats the browser solve, and applies the
existing execution-receipt creator and verifier to the real browser result.

Every case also carries one required, fail-closed analytic relation whose numeric inputs are bound
to that exact request and generated behavioral circuit:

- Motor M1/M2: the authored back-EMF closure establishes the requested load current before the
  explicitly represented closed-switch and optional shunt resistance. Native and browser-WASM
  winding current must remain positive, remain below that authored current, and agree with
  `I = (Vbridge(avg) - Eback) / (Rwinding + Nclosed Rclosed + Rshunt)` within the declared bound.
- Power P1/P2: over a required non-zero post-enable output span, feedback voltage and resistive-load
  current must both increase with output voltage. Their native and browser-WASM slopes and
  pointwise relations must agree with `Rlower / (Rupper + Rlower)` and `1 / Rload`, respectively.

These are selected behavioral circuit relations, not a comparison between candidate scores or a
claim that the Power stages reach their analytically requested outputs.

The evidence boundary is intentionally narrow:

- model tier: `behavioral`;
- receipt attestation: `none`;
- inputs: installed synthetic test contexts, never production profiles;
- Motor observations: averaged operating-point current closure, plus the M2 winding/shunt series
  relation and shunt voltage/current relation;
- Power observations: pre-enable quiescence and passive startup rise, not requested-output
  regulation for either P1 or P2;
- analytic-to-simulation scope: only the declared Motor DC closure and Power passive-connectivity
  slopes over non-vacuous observations;
- unavailable Motor and Power scenarios remain unavailable.

This can support a deterministic application-golden regression gate and a narrowly scoped
analytic-to-simulation relation gate for these four behavioral fixtures. It cannot clear production
profile admission, selected-part model coverage, full native/WASM waveform equivalence, broad
analytic-estimate or ranking validation, regulation/control-loop fidelity, clean-checkout
reproducibility, or the overall Designer release gate.

## Current-production ineligible selected-passive artifact

`tools/native-ngspice-reference/selected-passive-application-golden/contract.json` is a separate
current-production identity artifact, not a fifth behavioral application golden. It binds the exact
integrated-Power preset, reviewed Bel Fuse 10 uH inductor identity, and two distinct physical
instances of the reviewed Murata 22 uF output-capacitor identity. Contract V2 requires two parallel
per-part 22 uF ideal primitives and rejects the old V1 or collapsed single-44 uF shape. It retains
both capacitor currents as separate selected vectors and verifies their sum in the ideal output-node
KCL relation, with `currentProductionIdentity: true`. Strict generation retains zero
candidates with one `unknown_constraint_disallowed` rejection; explicit unknown-evidence inspection
retains one structural observation that the installed policy keeps ineligible.

The canonical unattested execution report is 11,674 bytes at
`sha256:556176f71e09dc5dfdd24ae62ec446bc17cccc6060ed51fcf9a0dd1b292e493c`.
Its native/browser-WASM numerical pass proves only the persisted fixture's selected-vector
relations, exact current observation/profile identity, and ideal nominal primitive wiring outside
reviewed operating conditions. The observed ideal branch currents establish no passive-current or
current-sharing authority. Switching, effective capacitance, ESR, ripple/current, loss,
physical-passive and full-BOM models, selected-semiconductor fidelity, eligibility, ranking, safety,
provider authority, and release readiness all remain unavailable; attestation remains `none`.

## Ideal reviewed-RDS(on) projection

`tools/native-ngspice-reference/selected-semiconductor-rdson-projection/contract.json` is a
separate, narrower current-production projection contract at
`sha256:cfa78576f707a62126c38648428c75e7e3b6ec3d78d516e13818a56449dca7ae`.
It binds the exact external-Motor permissive request, result, installed V3 decision, first
ineligible candidate, 3.1.7 recipe, context, catalog release, reviewed CSD18540Q5B profile, and
manufacturer-datasheet evidence identities. It does not reference or consume an unapproved device
package.

The exact operating-point fixture contains four independent ideal 2.2 mOhm resistors and four
28 A DC injections. The resistance value is the reviewed maximum at the exact 25 C, VGS 10 V,
ID 28 A table condition; the ideal relation therefore expects 61.6 mV per resistor. Native
ngspice-46 and browser-WASM each produce `[0.0616, 0.0616, 0.0616, 0.0616]` V with zero selected-
vector or cross-engine difference in the canonical 6,743-byte unattested report at
`sha256:789996602667d3d28bdfbec0ecfad25e48ba80ea32f4087390aa59c7a920b3f2`.

This pass covers only deterministic current identity, reviewed resistance evidence, ideal-resistor
wiring, the `V = I R` operating-point result, receipt integrity, and native/browser-WASM parity.
It is not transistor-equation or physical selected-part fidelity and proves no production-request,
switching, transient, gate-charge, Miller, recovery, body-diode, avalanche, SOA, thermal, package,
parasitic, full-BOM, eligibility, ranking, safety, provider, commercial, or release behavior. It
retires only the broad coverage-level reviewed-semiconductor golden blocker. The dedicated
production selected-semiconductor DC contract, clean-checkout reproducibility, and attestation
gates remain unchanged and blocked or unverified.
