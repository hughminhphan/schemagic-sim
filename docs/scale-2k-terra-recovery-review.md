# scale-2k Terra recovery correction review

Date: 2026-08-23.

Authority: `docs/scale-2k-terra-recovery-authorization.md`.

## Reviewed change

The reviewed correction is the exact commit range `ea4a082..3dea0d1` on `mosfet-cycle4-finish`:

- `260b738` — direct typed MOSFET scalar conditions, structured curve magnitude semantics, family-wide pure evidence preflight, and honest diode evidence routes;
- `5946ccd` — mandatory preflight at the real fit and manifest entrypoints, typed/source contradiction checks, exact structured axes, signed P-channel bias parity, and exact diode maximum constraints; and
- `3dea0d1` — family-specific direct and maximum-bound-only diode fitter provenance labels.

No Python fit physics, numerical error gate, hard bound, package admission rule, collision rule, reviewed package, deployment surface, or publishing surface changed.

## Adversarial review

A fresh Terra reviewer initially returned BLOCK and reproduced five bypass or provenance defects:

1. the exported pure preflight was not enforced by `fitBulkPart` or `runBulkManifest`;
2. parseable fixed threshold and RDS(on) source conditions could contradict typed electrical relations;
3. signed P-channel fixed curve bias disagreed between producer and consumer;
4. descriptive structured MOSFET axes bypassed the exact-alias contract; and
5. diode maximum constraints could be dropped or relabelled as synthetic/catalog fallback evidence.

All five were remediated and replayed. The final independent decision for exact commit `3dea0d1` is **APPROVE**. The reviewer verified that:

- preflight rejection is terminal before fitter invocation or F1 demotion;
- raw parseable threshold/RDS contradictions fail;
- producer and consumer agree on signed P-channel bias;
- structured current curves require exact `VGS`/`V_GS`, `VDS`/`V_DS`, and `ID`/`I_D` aliases;
- direct-plus-maximum diode evidence retains every maximum as an inclusive constraint at the exact cited coordinate;
- maximum-only diode evidence has zero observations and residual targets; and
- staged diode fitter labels distinguish direct typical evidence from a cited-maximum interior-feasibility projection.

## Verification

The correction tree at `5946ccd` passed:

- conveyor: 32/32 tests;
- model-factory: 111/111 tests;
- workspace tests, including validation of all 710 reviewed packages;
- workspace typechecks; and
- workspace production build.

The label-only follow-up at exact reviewed commit `3dea0d1` then passed the full
model-factory suite again: 111/111 tests. The follow-up changed only the two
diode fitter labels and their direct assertions.

Candidate acquisition and Terra extraction may proceed only under the fixed tranche, prefit gate, one-fit-pass rule, and release controls in the authorization.
