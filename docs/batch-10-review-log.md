# Batch 10 independent package review log

Date: 2026-08-12

Reviewer: `gpt-5.6-sol independent reviewer`

## Review contract and outcome

Verdict: **PASS**.

1. Verified the repository tripwire at `/Users/hughp/Documents/opencircuit` with starting HEAD `ed2023283880f8e0e1aaf17f5096b4a64b45db50`.
2. Reviewed exactly the 49 entries with `outcome: "staged"` in `docs/batch-10-execution.json`, comprising 32 F1 and 17 F2 candidates.
3. Approved 7 candidates for promotion eligibility and rejected 42. No candidate was promoted or copied into the reviewed library.
4. The reviewed library remained exactly 703 packages. Its authoritative aggregate fingerprint remained `72bd954cddef81138d996859a4596808b5a1d017e0b84a55f7388c761eae44ac` before and after review.
5. No numerical fitted parameter, fit gate, hard bound, collision rule, provenance rule, code, schema, conveyor state, feeder data, or reviewed-library package was changed.

| Set | F1 | F2 | Total |
| --- | ---: | ---: | ---: |
| Reviewed | 32 | 17 | 49 |
| Approved | 1 | 6 | 7 |
| Rejected | 31 | 11 | 42 |

No fidelity tier changed. All original and final fidelities are recorded per candidate in the promotion manifest.

## Systemic F1 diode finding

All 31 staged F1 diode candidates were rejected. The model-factory fallback computes each non-default `IS` from a synthetic equality target at 95% of the published maximum-current condition and 97% of the published maximum forward voltage. A published inclusive maximum is not a typical equality target. Because correcting this defect requires changing numerical fitted parameters, and numerical changes were prohibited, none of the 31 F1 diode candidates could be approved.

The sole approved F1 candidate is `hongjiacheng/PXT8050`. Its published 25 C current-gain bounds are supported, its included checks pass, and only BF is identified as evidence-derived. Saturation, breakdown, AC, transient, noise, thermal, and package-parasitic behavior remain outside scope.

## F2 residual and source-curve adjudication

Every complete F2 residual population was independently rerun through native ngspice-46 with explicit `.temp 25`. The unchanged diode gates are at least 4 points, RMS relative voltage error at most 3%, worst relative voltage error at most 5%, `IS` from `1e-20` through `1e-3`, `N` from `0.9` through `4.0`, `RS` from `0` through `50`, and optimizer-bound saturation tolerance `1e-6`.

All 17 numerical residual populations pass the unchanged numerical gates. Eleven are nevertheless rejected because the staged points do not represent the cited source curve, family trace, temperature, or axis unit. Passing a fit against unsupported points does not establish F2 fidelity.

| Order | Package | Points | Fresh RMS | Fresh worst | Source verdict | Disposition |
| ---: | --- | ---: | ---: | ---: | --- | --- |
| 534 | `yangzhou-yangjie-elec-tech/M7` | 7 | 0.009909589 | 0.018879431 | supported | approved |
| 536 | `mdd-microdiode/SS110` | 8 | 0.013244763 | 0.019779393 | unsupported | rejected |
| 539 | `twgmc/DSK34` | 6 | 0.018336214 | 0.033383467 | supported | approved |
| 543 | `shikues/1N4007F` | 6 | 0.010963577 | 0.018723355 | unsupported | rejected |
| 544 | `nexperia/BAS16H-115` | 6 | 0.016021893 | 0.029411964 | unsupported | rejected |
| 563 | `lrc/LMDL914T1G` | 5 | 0.015234641 | 0.024970947 | unsupported | rejected |
| 565 | `mdd-microdiode/1N4007G` | 9 | 0.013139858 | 0.029309512 | supported | approved |
| 566 | `onsemi/BAS20LT1G` | 5 | 0.012837523 | 0.020444939 | unsupported | rejected |
| 567 | `guangdong-hottech/1N4007L` | 4 | 0.010939047 | 0.014916736 | unsupported | rejected |
| 604 | `born/DSS210` | 9 | 0.017507602 | 0.034039779 | supported | approved |
| 609 | `mdd-microdiode/MBRX160` | 11 | 0.022304075 | 0.043987355 | unsupported | rejected |
| 610 | `mdd-microdiode/SS1200` | 6 | 0.012801982 | 0.018915834 | unsupported | rejected |
| 615 | `onsemi/BAT54HT1G` | 10 | 0.028003125 | 0.042855503 | supported | approved |
| 618 | `twgmc/1N4004` | 7 | 0.013284416 | 0.018820457 | unsupported | rejected |
| 628 | `goodwork/K14` | 8 | 0.023229663 | 0.037374182 | supported | approved |
| 633 | `goodwork/1N4148WL` | 7 | 0.018582064 | 0.033405362 | unsupported | rejected |
| 634 | `onsemi/MRA4007T3G` | 6 | 0.012905826 | 0.019211123 | unsupported | rejected |

Source adjudication for approved F2 candidates:

- `yangzhou-yangjie-elec-tech/M7`: Figure 3 supports the extracted 25 C pulsed curve. Scope is limited to 300 us pulse width and 1% duty cycle.
- `twgmc/DSK34`: the extracted points follow the cited DSK32/DSK34 family trace.
- `mdd-microdiode/1N4007G`: the extracted points follow the single 25 C pulsed trace. Scope is limited to 300 us pulse width and 1% duty cycle.
- `born/DSS210`: the extracted points are consistent with the DSS27 through DSS210 family trace. Scope is limited to 300 us pulse width and 1% duty cycle.
- `onsemi/BAT54HT1G`: the 25 C figure agrees with the table typical values, and all five separately published forward-voltage maxima are now encoded as inclusive checks.
- `goodwork/K14`: the extracted points follow the K12 through K14 solid trace. Scope is limited to 300 us pulse width and 1% duty cycle.

## Permitted staging corrections

- All 7 approved candidates received finalized reviewer metadata and model-card language that records promotion eligibility while explicitly recording that no promotion occurred.
- `hongjiacheng/PXT8050`: added the omitted hFE maximum of 400 at 100 mA and 1 V; added the corresponding expectation; recorded all non-BF parameters as generic held F1 defaults; narrowed claims to cited 25 C current gain at VCE = 1 V; retained saturation, breakdown, AC, and transient omissions.
- `yangzhou-yangjie-elec-tech/M7`: corrected malformed current evidence from 1.1 V to 1.0 A; added an exact 1.0 A bench for the published 1.1 V maximum; preserved the pre-existing numerical 1.1 A check; narrowed scope to the source pulse condition.
- `onsemi/BAT54HT1G`: added inclusive maxima of 0.24 V at 0.1 mA, 0.32 V at 1 mA, 0.40 V at 10 mA, 0.50 V at 30 mA, and 0.80 V at 100 mA, with five corresponding hard-bound checks.
- `mdd-microdiode/1N4007G`, `born/DSS210`, and `goodwork/K14`: narrowed scope to the source pulse condition of 300 us pulse width and 1% duty cycle.
- No candidate was demoted. No numerical model parameter or existing hard bound was changed.

## Source, package, and provenance audit

- Reproduced all 49 cached primary PDF SHA-256 values.
- All 49 `facts.json`, `sources.json`, and `component.json` source URLs agree.
- All 49 source records contain page citations. The cited F2 pages and figures were visually adjudicated for curve identity, axes, units, bias, range, family trace, temperature, and pulse condition.
- Verified canonical MPNs, ordering aliases, manufacturers, electrical families, polarity, package variants, pin roles, and source conditions.
- Greek `mu` variants are normalized by the fitter. SI prefixes, signs, PNP magnitudes, and P-channel magnitude semantics were checked; this candidate set contains no PNP or P-channel candidate.
- No DIAC, trigger topology, Zener, array, common-terminal, or multi-die candidate is present among the 49 staged packages. No unsupported fitter-supplied CJO, TT, reverse-recovery, AC, or transient claim was admitted.
- The reviewed package trees contain no vendor SPICE model claim. DC-only limitations remain explicit where applicable.

## Identity, alias, and fitted-vector collisions

- Case-insensitive canonical and ordering-alias collisions against all 703 reviewed packages: 0.
- Complete family, polarity, and fitted-parameter vector collisions against all 703 reviewed packages: 0.
- Case-insensitive canonical and ordering-alias collisions within the 49 candidates: 0.
- Complete family, polarity, and fitted-parameter vector collisions within the 49 candidates: 0.
- No shared-die exception or collision-rule change was used.

## Validation, benches, and tests

- Package schema validation: 49 of 49 passed.
- Native ngspice-46 benches: 195 of 195 executed successfully.
- Pinned native/WASM parity: 195 of 195 passed.
- Expectations: 201 of 201 passed, comprising 127 scalar checks and 74 inclusive hard-bound checks.
- Explicit `.temp 25`: 195 of 195 benches.
- Approved subset: 62 benches and 68 checks passed, comprising 49 scalar checks and 19 inclusive hard-bound checks.
- Conveyor tests: 16 passed. Conveyor Python compile/typecheck: passed.
- Model-factory tests: 46 passed.
- Reviewed-library test: all 703 reviewed packages passed component-schema validation.

## Exact rejection reasons

| Order | Package | Tier | Rejection class | Exact reason |
| ---: | --- | --- | --- | --- |
| 532 | `mdd-microdiode/SOD4007` | F1 | `unsupported-f1-numerical-evidence` | The unchanged non-default diode IS value was generated from an unsupported synthetic equality target at 95% of the published maximum-current condition and 97% of the published maximum forward voltage. The primary source supplies an inclusive maximum, not a typical equality point. Acceptance would require a numerical model-parameter change, which this review prohibited. |
| 536 | `mdd-microdiode/SS110` | F2 | `unsupported-f2-source-curve-and-hard-bound-evidence` | The fitted points follow the lower-voltage SS12 through SS14 family trace rather than the cited SS18 through SS1120 group containing SS110. The staged current evidence also records 0.85 V where the source condition is 1.0 A, so the encoded hard-bound current is not source-supported. |
| 543 | `shikues/1N4007F` | F2 | `unsupported-f2-source-curve` | The fitted points follow a hot-temperature trace rather than the cited 25 C trace. For example, the staged 0.66 V at 0.1 A point lies near the hot curve while the 25 C curve is substantially rightward. |
| 544 | `nexperia/BAS16H-115` | F2 | `unsupported-f2-source-curve` | The fitted points do not follow Figure 1 curve (3), the cited 25 C trace. They align with hotter temperature traces, so the passing numerical residuals are against the wrong source curve. |
| 546 | `elecsuper/SS26` | F1 | `unsupported-f1-numerical-evidence` | The unchanged non-default diode IS value was generated from an unsupported synthetic equality target at 95% of the published maximum-current condition and 97% of the published maximum forward voltage. The primary source supplies an inclusive maximum, not a typical equality point. Acceptance would require a numerical model-parameter change, which this review prohibited. |
| 549 | `vishay-intertech/1N4148W-HE3-08` | F1 | `unsupported-f1-numerical-evidence` | The unchanged non-default diode IS value was generated from an unsupported synthetic equality target at 95% of the published maximum-current condition and 97% of the published maximum forward voltage. The primary source supplies an inclusive maximum, not a typical equality point. Acceptance would require a numerical model-parameter change, which this review prohibited. |
| 553 | `diodes/1N4448HWS-7-F` | F1 | `unsupported-f1-numerical-evidence` | The unchanged non-default diode IS value was generated from an unsupported synthetic equality target at 95% of the published maximum-current condition and 97% of the published maximum forward voltage. The primary source supplies an inclusive maximum, not a typical equality point. Acceptance would require a numerical model-parameter change, which this review prohibited. |
| 555 | `mdd-microdiode/S3MB` | F1 | `unsupported-f1-numerical-evidence` | The unchanged non-default diode IS value was generated from an unsupported synthetic equality target at 95% of the published maximum-current condition and 97% of the published maximum forward voltage. The primary source supplies an inclusive maximum, not a typical equality point. Acceptance would require a numerical model-parameter change, which this review prohibited. |
| 557 | `nexperia/PMEG3005AESFYL` | F1 | `unsupported-f1-numerical-evidence` | The unchanged non-default diode IS value was generated from an unsupported synthetic equality target at 95% of the published maximum-current condition and 97% of the published maximum forward voltage. The primary source supplies an inclusive maximum, not a typical equality point. Acceptance would require a numerical model-parameter change, which this review prohibited. |
| 559 | `guangdong-hottech/1N5819W` | F1 | `unsupported-f1-numerical-evidence` | The unchanged non-default diode IS value was generated from an unsupported synthetic equality target at 95% of the published maximum-current condition and 97% of the published maximum forward voltage. The primary source supplies an inclusive maximum, not a typical equality point. Acceptance would require a numerical model-parameter change, which this review prohibited. |
| 560 | `vishay-intertech/ES1D-E3-61T` | F1 | `unsupported-f1-numerical-evidence` | The unchanged non-default diode IS value was generated from an unsupported synthetic equality target at 95% of the published maximum-current condition and 97% of the published maximum forward voltage. The primary source supplies an inclusive maximum, not a typical equality point. Acceptance would require a numerical model-parameter change, which this review prohibited. |
| 563 | `lrc/LMDL914T1G` | F2 | `unsupported-f2-source-curve` | The fitted voltages, especially near 0.1 A, align with hotter traces rather than the cited 25 C trace. |
| 566 | `onsemi/BAS20LT1G` | F2 | `unsupported-f2-source-curve` | The fitted points do not consistently follow the Figure 2 25 C forward-characteristic trace. |
| 567 | `guangdong-hottech/1N4007L` | F2 | `unsupported-f2-source-curve` | The fitted points follow a hotter trace rather than Figure 3 at 25 C. The staged 0.72 V at 0.1 A point is not on the cited 25 C trace. |
| 569 | `goodwork/S10M` | F1 | `unsupported-f1-numerical-evidence` | The unchanged non-default diode IS value was generated from an unsupported synthetic equality target at 95% of the published maximum-current condition and 97% of the published maximum forward voltage. The primary source supplies an inclusive maximum, not a typical equality point. Acceptance would require a numerical model-parameter change, which this review prohibited. |
| 571 | `lrc/LMBR140T1G` | F1 | `unsupported-f1-numerical-evidence` | The unchanged non-default diode IS value was generated from an unsupported synthetic equality target at 95% of the published maximum-current condition and 97% of the published maximum forward voltage. The primary source supplies an inclusive maximum, not a typical equality point. Acceptance would require a numerical model-parameter change, which this review prohibited. |
| 574 | `nexperia/BAS21-215` | F1 | `unsupported-f1-numerical-evidence` | The unchanged non-default diode IS value was generated from an unsupported synthetic equality target at 95% of the published maximum-current condition and 97% of the published maximum forward voltage. The primary source supplies an inclusive maximum, not a typical equality point. Acceptance would require a numerical model-parameter change, which this review prohibited. |
| 575 | `guangdong-hottech/SS34A` | F1 | `unsupported-f1-numerical-evidence` | The unchanged non-default diode IS value was generated from an unsupported synthetic equality target at 95% of the published maximum-current condition and 97% of the published maximum forward voltage. The primary source supplies an inclusive maximum, not a typical equality point. Acceptance would require a numerical model-parameter change, which this review prohibited. |
| 576 | `mdd-microdiode/FR207` | F1 | `unsupported-f1-numerical-evidence` | The unchanged non-default diode IS value was generated from an unsupported synthetic equality target at 95% of the published maximum-current condition and 97% of the published maximum forward voltage. The primary source supplies an inclusive maximum, not a typical equality point. Acceptance would require a numerical model-parameter change, which this review prohibited. |
| 577 | `diodes/B560C-13-F` | F1 | `unsupported-f1-numerical-evidence` | The unchanged non-default diode IS value was generated from an unsupported synthetic equality target at 95% of the published maximum-current condition and 97% of the published maximum forward voltage. The primary source supplies an inclusive maximum, not a typical equality point. Acceptance would require a numerical model-parameter change, which this review prohibited. |
| 581 | `onsemi/MBR0540T1G` | F1 | `unsupported-f1-numerical-evidence` | The unchanged non-default diode IS value was generated from an unsupported synthetic equality target at 95% of the published maximum-current condition and 97% of the published maximum forward voltage. The primary source supplies an inclusive maximum, not a typical equality point. Acceptance would require a numerical model-parameter change, which this review prohibited. |
| 583 | `mdd-microdiode/SS36B` | F1 | `unsupported-f1-numerical-evidence` | The unchanged non-default diode IS value was generated from an unsupported synthetic equality target at 95% of the published maximum-current condition and 97% of the published maximum forward voltage. The primary source supplies an inclusive maximum, not a typical equality point. Acceptance would require a numerical model-parameter change, which this review prohibited. |
| 598 | `nexperia/PMLL4148L-115` | F1 | `unsupported-f1-numerical-evidence` | The unchanged non-default diode IS value was generated from an unsupported synthetic equality target at 95% of the published maximum-current condition and 97% of the published maximum forward voltage. The primary source supplies an inclusive maximum, not a typical equality point. Acceptance would require a numerical model-parameter change, which this review prohibited. |
| 605 | `mdd-microdiode/SS24B` | F1 | `unsupported-f1-numerical-evidence` | The unchanged non-default diode IS value was generated from an unsupported synthetic equality target at 95% of the published maximum-current condition and 97% of the published maximum forward voltage. The primary source supplies an inclusive maximum, not a typical equality point. Acceptance would require a numerical model-parameter change, which this review prohibited. |
| 609 | `mdd-microdiode/MBRX160` | F2 | `f2-axis-unit-error` | Figure 3 uses mA on the forward-current axis, but the extraction declares A and creates points as high as 800 A. This is a 1000x axis-unit error and invalidates the fitted F2 evidence and claimed range. |
| 610 | `mdd-microdiode/SS1200` | F2 | `unsupported-f2-source-curve` | The fitted points follow the lower-voltage SS12 through SS14 trace rather than the cited SS1150 through SS1200 family trace containing SS1200. |
| 611 | `tech-public/RB160M-90` | F1 | `unsupported-f1-numerical-evidence` | The unchanged non-default diode IS value was generated from an unsupported synthetic equality target at 95% of the published maximum-current condition and 97% of the published maximum forward voltage. The primary source supplies an inclusive maximum, not a typical equality point. Acceptance would require a numerical model-parameter change, which this review prohibited. |
| 618 | `twgmc/1N4004` | F2 | `unsupported-f2-source-curve` | The fitted points follow the 125 C or another hot-temperature trace rather than the cited 25 C trace. |
| 633 | `goodwork/1N4148WL` | F2 | `unsupported-f2-source-curve` | The fitted points follow the 100 C trace rather than the cited 25 C trace. |
| 634 | `onsemi/MRA4007T3G` | F2 | `unsupported-f2-source-curve` | The fitted points follow the 150 C trace rather than the cited 25 C trace. The staged 0.6 V at 0.01 A point is characteristic of the hot trace. |
| 635 | `tech-public/TPPMEG3001EEFZ` | F1 | `unsupported-f1-numerical-evidence` | The unchanged non-default diode IS value was generated from an unsupported synthetic equality target at 95% of the published maximum-current condition and 97% of the published maximum forward voltage. The primary source supplies an inclusive maximum, not a typical equality point. Acceptance would require a numerical model-parameter change, which this review prohibited. |
| 636 | `goodwork/SB1045L` | F1 | `unsupported-f1-numerical-evidence` | The unchanged non-default diode IS value was generated from an unsupported synthetic equality target at 95% of the published maximum-current condition and 97% of the published maximum forward voltage. The primary source supplies an inclusive maximum, not a typical equality point. Acceptance would require a numerical model-parameter change, which this review prohibited. |
| 640 | `comchip/CDBQC0130L-HF` | F1 | `unsupported-f1-numerical-evidence` | The unchanged non-default diode IS value was generated from an unsupported synthetic equality target at 95% of the published maximum-current condition and 97% of the published maximum forward voltage. The primary source supplies an inclusive maximum, not a typical equality point. Acceptance would require a numerical model-parameter change, which this review prohibited. |
| 645 | `lrc/LMBR0540T1G` | F1 | `unsupported-f1-numerical-evidence` | The unchanged non-default diode IS value was generated from an unsupported synthetic equality target at 95% of the published maximum-current condition and 97% of the published maximum forward voltage. The primary source supplies an inclusive maximum, not a typical equality point. Acceptance would require a numerical model-parameter change, which this review prohibited. |
| 647 | `goodwork/SS10100-SMB` | F1 | `unsupported-f1-numerical-evidence` | The unchanged non-default diode IS value was generated from an unsupported synthetic equality target at 95% of the published maximum-current condition and 97% of the published maximum forward voltage. The primary source supplies an inclusive maximum, not a typical equality point. Acceptance would require a numerical model-parameter change, which this review prohibited. |
| 651 | `rohm-semicon/RBR1MM40ATR` | F1 | `unsupported-f1-numerical-evidence` | The unchanged non-default diode IS value was generated from an unsupported synthetic equality target at 95% of the published maximum-current condition and 97% of the published maximum forward voltage. The primary source supplies an inclusive maximum, not a typical equality point. Acceptance would require a numerical model-parameter change, which this review prohibited. |
| 658 | `onsemi/MBR0520LT1G` | F1 | `unsupported-f1-numerical-evidence` | The unchanged non-default diode IS value was generated from an unsupported synthetic equality target at 95% of the published maximum-current condition and 97% of the published maximum forward voltage. The primary source supplies an inclusive maximum, not a typical equality point. Acceptance would require a numerical model-parameter change, which this review prohibited. |
| 667 | `hxy-mosfet/1N5819WT` | F1 | `unsupported-f1-numerical-evidence` | The unchanged non-default diode IS value was generated from an unsupported synthetic equality target at 95% of the published maximum-current condition and 97% of the published maximum forward voltage. The primary source supplies an inclusive maximum, not a typical equality point. Acceptance would require a numerical model-parameter change, which this review prohibited. |
| 670 | `rohm-semicon/RF071MM2STR` | F1 | `unsupported-f1-numerical-evidence` | The unchanged non-default diode IS value was generated from an unsupported synthetic equality target at 95% of the published maximum-current condition and 97% of the published maximum forward voltage. The primary source supplies an inclusive maximum, not a typical equality point. Acceptance would require a numerical model-parameter change, which this review prohibited. |
| 680 | `tech-public/RB521CS-30` | F1 | `unsupported-f1-numerical-evidence` | The unchanged non-default diode IS value was generated from an unsupported synthetic equality target at 95% of the published maximum-current condition and 97% of the published maximum forward voltage. The primary source supplies an inclusive maximum, not a typical equality point. Acceptance would require a numerical model-parameter change, which this review prohibited. |
| 684 | `goodwork/ES1JF` | F1 | `unsupported-f1-numerical-evidence` | The unchanged non-default diode IS value was generated from an unsupported synthetic equality target at 95% of the published maximum-current condition and 97% of the published maximum forward voltage. The primary source supplies an inclusive maximum, not a typical equality point. Acceptance would require a numerical model-parameter change, which this review prohibited. |
| 689 | `goodwork/SD103AWL` | F1 | `unsupported-f1-numerical-evidence` | The unchanged non-default diode IS value was generated from an unsupported synthetic equality target at 95% of the published maximum-current condition and 97% of the published maximum forward voltage. The primary source supplies an inclusive maximum, not a typical equality point. Acceptance would require a numerical model-parameter change, which this review prohibited. |

## Approved candidates

| Order | Package | Tier | Approval basis |
| ---: | --- | --- | --- |
| 530 | `hongjiacheng/PXT8050` | F1 | The PXT8050 identity, NPN polarity, SOT-89 package, pin mapping, and published 25 C current-gain bounds are source-supported. BF is conservatively tied to the published minimum, all included gain expectations pass, and unsupported saturation, breakdown, AC, and transient behavior remain excluded. |
| 534 | `yangzhou-yangjie-elec-tech/M7` | F2 | The F2 points follow the cited M7 25 C pulsed forward curve in Figure 3. Independent native ngspice residuals pass the unchanged diode F2 gates, and the published 1.1 V maximum at 1.0 A is now explicitly checked. |
| 539 | `twgmc/DSK34` | F2 | The F2 points follow the cited DSK32/DSK34 forward trace. Independent native ngspice residuals pass the unchanged diode F2 gates, with source identity, axes, units, family grouping, and range supported. |
| 565 | `mdd-microdiode/1N4007G` | F2 | The F2 points follow the datasheet single 25 C pulsed forward trace. Independent native ngspice residuals pass the unchanged diode F2 gates and the scope is limited to the source pulse condition. |
| 604 | `born/DSS210` | F2 | The F2 points are consistent with the DSS27 through DSS210 family trace containing DSS210. Independent native ngspice residuals pass the unchanged diode F2 gates and the scope is limited to the source pulse condition. |
| 615 | `onsemi/BAT54HT1G` | F2 | The 25 C forward curve agrees with the datasheet table typical values. Independent native ngspice residuals pass the unchanged diode F2 gates, and all five separately published forward-voltage maxima are now checked inclusively. |
| 628 | `goodwork/K14` | F2 | The F2 points follow the K12 through K14 solid trace containing K14. Independent native ngspice residuals pass the unchanged diode F2 gates and the scope is limited to the source pulse condition. |

## Reproducibility and no-promotion confirmation

- The manifest lists all 49 candidates exactly once with disposition, original and final fidelity, staging root, absolute package path, exact post-review package fingerprint, reasons, and modifications.
- Package fingerprint method: SHA-256 over each package file in lexicographic relative-path order, updating relative path, NUL, file bytes, NUL.
- Reviewed-library package count remained 703 before and after review.
- Reviewed-library authoritative aggregate fingerprint remained `72bd954cddef81138d996859a4596808b5a1d017e0b84a55f7388c761eae44ac` before and after review. The command is `find packages/model-library/models -type f -print0 | sort -z | xargs -0 shasum -a 256 | shasum -a 256`.
- Git showed no tracked code or reviewed-library modification before the two review records were created.
- No candidate was copied into `/Users/hughp/Documents/opencircuit/packages/model-library/models`.
- No promotion, push, deploy, publish, GitHub comment, or conveyor-state transition occurred.
