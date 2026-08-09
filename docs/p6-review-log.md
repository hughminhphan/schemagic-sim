# P6 independent model review log

Date: 2026-08-09

Reviewer: `gpt-5.6-sol independent reviewer (P6 proving-50)`

Branch: `worktree-agent-a47318d33c4582e44`

Scope: exactly one independent review pass over the restored Vishay `NTCLE100E3103JB0` package and the 50 conveyor proving-tranche packages staged at `/Users/hughp/Documents/opencircuit/tools/conveyor/data/staging/proving-50/`.

## Review method

1. Read the P4 and P5 review logs, R1 through R7 evidence rules, package contribution contract, component schemas, package validator, diode, BJT, VDMOS, and sensor archetypes, the conveyor diagnosis, and the unchanged family fit gates.
2. Copied the 50 staged packages into `.review-scratch/proving-50/packages/` before review. The external conveyor staging source remained read-only and unchanged.
3. Ran the canonical package validator independently against every staged package.
4. Downloaded all 50 distinct staged datasheet URLs, reproduced all 50 recorded SHA-256 values, and inspected the cited source pages used by every proposed F2 fit.
5. Compared every staged numeric model parameter with its `fitted.json` counterpart. All 50 model vectors matched their fit records within serialization precision.
6. Recomputed every proposed F2 residual gate summary from its individual rows and `fit-gates.json`. Audited all 137 F2 residual points against the selected extraction curves and their source-page citations.
7. Spot-checked every F1 package for provenance, parameter limits, bench evidence, and the recorded F2-demotion or fallback reason.
8. Deep-reviewed one diode F2 pattern, one BJT F2 pattern, and one MOSFET F1 pattern for stale parameters, saturation, sign, unit-prefix, wrong-figure, and supported-region defects.
9. Re-fetched the Vishay NTC datasheet, reproduced its source hash, checked the cited values and region, validated the package, and ran all three benches through native ngspice-46 and the pinned WASM comparison harness.
10. Applied one-pass adjudication only. No staged electrical model, test, fact extraction, factory source, or conveyor source was rewritten.

## Source provenance audit

- Staged tranche: 50 of 50 distinct source URLs resolved, and 50 of 50 fresh SHA-256 values matched the package records.
- Every proposed F2 curve page was inspected in the downloaded source. The claimed figure exists on the cited page for 21 packages.
- `MMBT2222ALT1G` uses bare citation `3` rather than an explicit page-and-figure citation. PDF page 3 does contain Figure 3, DC Current Gain, but the package evidence does not meet the explicit citation convention.
- NTC source: `https://www.vishay.com/docs/29049/ntcle100.pdf`, revision 07-May-2025, SHA-256 `7a6b1228e4464d61dd4e2774db871c44cefb5b2353c1b1179330004c4562af69`. Page 2 confirms R25 = 10,000 ohm and B25/85 = 3977 K. Page 10 confirms 10,000 ohm at 25 degC, 2,989 ohm at 55 degC, and 1,070 ohm at 85 degC.

## Conveyor package-contract result

All 50 staged packages fail the mandatory package validator and are rejected from promotion in this pass.

Common blockers across all 50:

- `tests/` contains zero `.cir` benches.
- `tests/expectations.json` contains an empty `tests` array.
- `model.cir` lacks the three exact required provenance phrases: `opencircuit model factory`, `original work`, and `public factual specifications`.
- The supported operating region contains only a 25 degC nominal-temperature point. Its summary says electrical bounds remain pending independent review, so the claimed operating region is not established.

Additional blockers:

- All 22 proposed F2 packages have no cited test check and no package native-versus-WASM evidence. Their `test_results.status` is `pending` while a non-null worst fitting error is recorded, which also fails schema validation.
- All 17 Nexperia packages use a comma-containing `canonical_mpn` and fail the component schema pattern.
- `MMBT2222ALT1G` has malformed F2 residual citations as described above.
- `MMBTA42LT1G` derives its held IS value from the 150 degC base-emitter curve at IC = 0.01 A and VBE = 0.43 V, then clips it to 1e-10 A for the nominal bulk model. That temperature basis is not valid evidence for a nominal 25 degC F2 model.
- `PMST3904-115` and `MMBT3904LT1G` have identical complete numeric model vectors without package evidence establishing legitimate shared-die inheritance.

Adding provenance comments alone would be a metadata repair. Creating 50 missing bench suites, expectation records, bias assertions, and supported-region checks would be model-package authoring. Under this lane's one-pass constraints, these packages are rejected rather than rewritten or silently demoted.

## F2 fit adjudication

The staged split reproduces exactly: 22 proposed F2 packages and 28 proposed F1 packages.

- Diodes: 12 F2 and 6 F1.
- BJTs: 10 F2 and 6 F1.
- MOSFETs: 0 F2 and 16 F1.

For the 22 proposed F2 packages:

- All 137 stored residual targets correspond to points in the selected extraction curves.
- All 22 recomputed family summaries remain within the stored `fit-gates.json` residual limits.
- Every shipped parameter with a `fitted.json` counterpart matches its fit record.
- Reapplying the canonical span-relative saturation test, including logarithmic bounds for diode IS, found no undeclared F2 optimizer-bound saturation.
- Twenty-one packages have explicit curve page references that resolve to the claimed figure. `MMBT2222ALT1G` has the malformed bare `3` citation.
- `MMBTA42LT1G` additionally uses the wrong temperature curve to derive nominal IS.
- Zero of the 22 packages contains a runnable package bench, so zero native results and zero native-versus-WASM results exist to support the proposed tier.
- No applicable electrical hard bound is represented by a cited expectation or bias-asserted bench.

Stored residual quality does not substitute for shipping-engine evidence. All 22 F2 claims therefore fail.

### DC-only F2 semantics ruling

DC-only scope does not inherently disqualify F2. The library definition does not require multiple behavior domains. A DC-only package can honestly be F2 when it has multiple cited typical targets, checks every applicable hard bound, asserts the bench bias conditions, passes every included bench in native ngspice and WASM, and explicitly labels AC and transient coverage as `none`.

The conveyor packages fail independently of that ruling. They have no package benches, no cited checks, no native-versus-WASM evidence, no established electrical supported region, and no hard-bound validation. Relabeling them F1 would not cure those contract failures because F1 still requires checked headline behavior in a valid package.

## Representative family deep reviews

### Diode: BAS316-115

- The shipped IS, N, and RS values exactly match `fitted.json`.
- Five p. 4 Figure 1 curve points reproduce a 2.8627 percent worst stored residual and 1.5342 percent RMS residual, within the diode gate.
- Source page 4 confirms Figure 1 curve (3) is the 25 degC typical forward curve.
- The package nevertheless has zero expectations and zero benches, an invalid comma-containing canonical MPN, incomplete provenance header text, pending-state schema failure, and no hard-bound engine checks. Verdict: reject.

### BJT: MMBT4401LT1G

- The shipped Gummel-Poon vector exactly matches `fitted.json`.
- Eight cited p. 5 Figure 13 gain targets reproduce a 10.5231 percent worst residual and 6.8225 percent RMS residual, within the BJT gate. The held IS basis cites p. 6 Figure 18.
- Both figures exist on the cited pages and use the stated nominal temperature.
- The package nevertheless has zero expectations and zero benches, incomplete provenance header text, pending-state schema failure, and no hard-bound engine checks. Verdict: reject.

### MOSFET: 2N7002LT1G

- The F1 fallback is honestly recorded: the proposed MOSFET F2 fit had 31.25 percent worst drain-current error against a 20 percent gate and 14.42 percent RMS error against a 12 percent gate.
- The shipped fallback parameter vector matches `fitted.json`.
- The package has zero expectations and zero benches, incomplete provenance header text, and no electrical supported-region limits beyond nominal temperature. Verdict: reject, not promote as F1.

## Restored NTC adjudication

`NTCLE100E3103JB0` passes as F1 after the transcription refit.

- `R0 = 10000` ohm is directly transcribed from the cited 10 kohm R25.
- `T0_C = 25` degC is directly transcribed from the R25 reference condition.
- `BETA = 3977` K is directly transcribed from the cited B25/85 value.
- The claimed region is limited to 25 degC through 85 degC.
- The three authored resistance checks match the p. 10 table basis. Worst fitting error is 1.175 percent at 55 degC.
- `transfer_01.cir`, `transfer_02.cir`, and `transfer_03.cir` all pass native ngspice-46 versus WASM comparison with zero reported engine delta.
- The original P5 rejection and the 2026-08-09 refit response remain recorded in both component metadata and the model card.

This is an in-place review approval of the already restored package, not an additional package copied from staging.

## Final verdicts by family

| Family | Reviewed | Promoted F2 | Promoted F1 | Demoted then promoted | Rejected |
| --- | ---: | ---: | ---: | ---: | ---: |
| Diode | 18 | 0 | 0 | 0 | 18 |
| BJT | 16 | 0 | 0 | 0 | 16 |
| MOSFET | 16 | 0 | 0 | 0 | 16 |
| Sensor/other NTC | 1 | 0 | 1 | 0 | 0 |
| **Total** | **51** | **0** | **1** | **0** | **50** |

The machine-readable adjudication is in `docs/promotion-manifest.json`.

## Triaged survivors

- All 50 rejected conveyor packages remain in the external staging source and in the review scratch copy. None was copied into `packages/model-library/models/`.
- The 28 staged F1 records preserve honest demotion or fallback reasons, but they are not valid library packages until a future authoring pass adds runnable tests, expectations, bias assertions, electrical supported-region limits, and complete provenance headers.
- The 22 staged F2 numerical fits preserve useful curve-fit evidence, but future work must not infer approval from their residuals. Each requires package benches and hard-bound checks. `MMBT2222ALT1G` also needs an explicit page-and-figure citation, and `MMBTA42LT1G` needs a nominal-temperature IS basis.
- `PMST3904-115` and `MMBT3904LT1G` require shared-die inheritance evidence or independent parameterization before future promotion.
- No fix-to-reverify spiral was started. Electrical rewrites and missing test-suite authoring were triaged to a future author lane.

## Final tests

- Staged package validation: 0 of 50 passed, with the rejection blockers recorded above.
- NTC package validation: passed the canonical package validator in the final rerun.
- NTC native versus WASM comparison: 3 of 3 passed in the final rerun, with zero reported engine delta.
- Model parameter consistency: 50 of 50 staged model vectors match `fitted.json` within serialization precision.
- Source reproduction: 50 of 50 staged URLs resolved and 50 of 50 source hashes matched.
- Aggregate model-library gate: `npm test --workspace=@opencircuit/model-library` passed, validating all 122 packages.
- Final library package count: 122. No staged package was added, and the NTC approval does not change the count.
