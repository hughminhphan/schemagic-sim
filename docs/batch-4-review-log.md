# Batch 4 independent review log

- Review date: 2026-08-10
- Reviewer: gpt-5.6-sol independent reviewer (batch-4 scale campaign)
- Branch: `main`
- Tripwire HEAD: `24f3477 docs(conveyor): record batch-4 execution`
- Prior reviewed library: 359 packages
- Candidates reviewed: 93 packages
- Review mode: one bounded independent pass; no refitting and no factory or conveyor source edits

## Accounting

| Item | Count |
| --- | ---: |
| Staged candidates reviewed | 93 |
| Phase-A staged | 9 |
| Fresh staged | 84 |
| Promoted | 81 |
| Rejected | 12 |
| Demoted | 0 |
| Phase-A promoted / rejected | 4 / 5 |
| Fresh promoted / rejected | 77 / 7 |
| Final reviewed library | 440 |

Promoted tier and family totals:

| Tier | Family | Count |
| --- | --- | ---: |
| F1 | bjt_npn | 8 |
| F1 | bjt_pnp | 5 |
| F1 | diode | 24 |
| F1 | nmos | 20 |
| F1 | pmos | 13 |
| F2 | bjt_npn | 2 |
| F2 | bjt_pnp | 1 |
| F2 | diode | 6 |
| F2 | nmos | 1 |
| F2 | pmos | 1 |

Rejected tier and family totals:

| Tier | Family | Count |
| --- | --- | ---: |
| F1 | bjt_npn | 5 |
| F1 | bjt_pnp | 3 |
| F1 | diode | 2 |
| F1 | nmos | 1 |
| F2 | diode | 1 |

## Method and gates

1. Reconciled all 93 staged package paths to the execution record: 9 Phase-A salvages and 84 fresh packages.
2. Reproduced all 93 recorded primary-PDF SHA-256 values and reviewed identity, family-sheet selection, citations, units, polarity, temperature, bias, and typical versus bound semantics. The 3401 PDF received direct page-level inspection because of its known template contamination.
3. Re-ran all original package validators, native ngspice-46 benches, pinned-WASM comparisons, and expectations on scratch copies: 93 of 93 packages passed, 260 benches and 321 checks passed.
4. Verified explicit `.temp 25` in all 260 original 25 C comparison benches.
5. Added 266 scratch-only probes for omitted published DC minima and maxima. Twelve unchanged models failed defining bounds and were rejected. The 130 nonduplicate passing checks were copied only into promoted packages and are enumerated in the verdict table and manifest.
6. Recomputed all 12 F2 gate groups from the unchanged residual vectors. Point counts, SI axes, signs, 25 C conditions, held parameters, and physical-bound handling passed. RS2M passed fit gates but failed a published reverse-leakage maximum and was rejected.
7. Narrowed all 11 promoted F2 packages to exact selected 25 C DC curves, biases, and sampled ranges. Scalar hard bounds do not expand F2 curve fidelity.
8. Compared normalized canonical identities, aliases, and family-aware complete fitted vectors against the 359-package baseline and all 93 candidates. No promotion collision remained.
9. Promoted survivors only. Rejected packages remain unchanged in ignored staging.

## Published hard-bound rejections

| Package | Origin | Tier | Failed bound evidence |
| --- | --- | --- | --- |
| `foshan-blue-rocket-elec/S8550M-D` | fresh | F1 | vbe_sat_maximum_source_2: observed 1.35011627 V, published maximum 1.2 V (p. 2, Electrical Characteristics, VBE(sat)) |
| `high-diode/BC817` | fresh | F1 | vbe_sat_maximum_source_1: observed 1.3502047 V, published maximum 1.2 V (p. 1, Electrical Characteristics, VBE(sat)) |
| `hongjiacheng/B0540W` | phase-a | F1 | reverse_leakage_source_maximum: observed 3.70318194e-05 A, published maximum 2e-05 A (p. 2, Electrical Characteristics, maximum reverse current row at VR = 40 V) |
| `hongjiacheng/RS2M` | fresh | F2 | reverse_leakage_source_maximum: observed 9.36073794e-06 A, published maximum 5e-06 A (2) |
| `hongjiacheng/S3MB` | fresh | F1 | reverse_leakage_source_maximum: observed 1.53737471e-05 A, published maximum 2e-06 A (p. 2 electrical characteristics table) |
| `htcsemi/HT8050ARTZ` | fresh | F1 | vbe_sat_maximum_source_1: observed 1.67909652 V, published maximum 1.2 V (p. 1, Electrical Characteristics, Base-emitter saturation voltage) |
| `hxy-mosfet/AO3400-HXY` | phase-a | F1 | rdson_maximum_source_6: observed 0.032993511 ohm, published maximum 0.03 ohm (p. 2, Electrical Characteristics, RDS(ON), MAX column, third test-condition row) |
| `jiangsu-changjing-electronics-co-ltd/S9012-2T1-RANGE-200-350` | phase-a | F1 | vbe_sat_maximum_source_1: observed 1.3502885 V, published maximum 1.2 V (p. 1, Electrical Characteristics, Base-emitter saturation voltage) |
| `mcc-micro-commercial-components/MMS8050-H-TP` | fresh | F1 | vbe_sat_maximum_source_1: observed 1.3502885 V, published maximum 1.2 V (p. 2, Electrical Characteristics, Base-Emitter Saturation Voltage) |
| `nexperia/MJD44H11J` | phase-a | F1 | vce_sat_maximum_source_1: observed 1.31032873 V, published maximum 1 V (p. 4, Table 7, collector-emitter saturation voltage VCEsat); vbe_sat_maximum_source_1: observed 9.33382592 V, published maximum 1.5 V (p. 4, Table 7, base-emitter saturation voltage VBEsat) |
| `nexperia/PBSS4540X-135` | fresh | F1 | vce_sat_maximum_source_1: observed 0.199860993 V, published maximum 0.09 V (p. 6, Table 7); vce_sat_maximum_source_2: observed 0.275132871 V, published maximum 0.12 V (p. 6, Table 7); vce_sat_maximum_source_3: observed 0.374597281 V, published maximum 0.15 V (p. 6, Table 7); vce_sat_maximum_source_4: observed 0.690751349 V, published maximum 0.29 V (p. 6, Table 7); vbe_sat_maximum_source_4: observed 3.08441219 V, published maximum 1.1 V (p. 6, Table 7); vce_sat_maximum_source_5: observed 0.839689617 V, published maximum 0.355 V (p. 6, Table 7 (also p. 1, Table 1)); vbe_sat_maximum_source_5: observed 6.15741174 V, published maximum 1.2 V (p. 6, Table 7) |
| `onsemi/MJD45H11T4G` | phase-a | F1 | vce_sat_maximum_source_1: observed 1.31032873 V, published maximum 1 V (p. 2, electrical characteristics, Collector-Emitter Saturation Voltage); vbe_sat_maximum_source_1: observed 9.33382592 V, published maximum 1.5 V (p. 2, electrical characteristics, Base-Emitter Saturation Voltage) |

No rejected model was refitted. Each failure would require electrical parameter changes.

## Phase-A salvage adjudication

| Package | Batch 4 decision | Ruling |
| --- | --- | --- |
| `hongjiacheng/B0540W` | Reject | Rejected: repaired staging still fails a defining published hard bound; narrowing did not cure the electrical defect. |
| `hongjiacheng/BAS21S` | Promote | Promoted: original defect was repaired or conservatively demoted to F1, and all independent hard-bound probes passed. |
| `hongjiacheng/DSK26` | Promote | Promoted: original defect was repaired or conservatively demoted to F1, and all independent hard-bound probes passed. |
| `hongjiacheng/SS54B` | Promote | Promoted: original defect was repaired or conservatively demoted to F1, and all independent hard-bound probes passed. |
| `hxy-mosfet/AO3400-HXY` | Reject | Rejected: repaired staging still fails a defining published hard bound; narrowing did not cure the electrical defect. |
| `jiangsu-changjing-electronics-co-ltd/S9012-2T1-RANGE-200-350` | Reject | Rejected: repaired staging still fails a defining published hard bound; narrowing did not cure the electrical defect. |
| `lrc/LBSS138LT1G` | Promote | Promoted: original defect was repaired or conservatively demoted to F1, and all independent hard-bound probes passed. |
| `nexperia/MJD44H11J` | Reject | Rejected: repaired staging still fails a defining published hard bound; narrowing did not cure the electrical defect. |
| `onsemi/MJD45H11T4G` | Reject | Rejected: repaired staging still fails a defining published hard bound; narrowing did not cure the electrical defect. |

The two additional Phase-A inputs, `AO3402` and `2SC1623(L6)`, were correctly skipped before staging because the reviewed library already represented their normalized identities.

## F2 adjudication

| Package | Verdict | Curves | RMS relative error | Worst relative error | Scope ruling |
| --- | --- | ---: | ---: | ---: | --- |
| `diodes/MMBT3904Q-7-F` | Promote | 1 | 0.0241548 | 0.0447127 | Exact selected 25 C DC curve, bias, and sampled range only; no AC, switching, capacitance, thermal, SOA, or continuous-current implication. |
| `hongjiacheng/B0520WS` | Promote | 1 | 0.00717742 | 0.0123283 | Exact selected 25 C DC curve, bias, and sampled range only; no AC, switching, capacitance, thermal, SOA, or continuous-current implication. |
| `hongjiacheng/BAS70-06` | Promote | 1 | 0.0274145 | 0.0389157 | Exact selected 25 C DC curve, bias, and sampled range only; no AC, switching, capacitance, thermal, SOA, or continuous-current implication. |
| `hongjiacheng/BAT54SW` | Promote | 1 | 0.0178953 | 0.0274506 | Exact selected 25 C DC curve, bias, and sampled range only; no AC, switching, capacitance, thermal, SOA, or continuous-current implication. |
| `hongjiacheng/ES1JW` | Promote | 1 | 0.00731912 | 0.0118933 | Exact selected 25 C DC curve, bias, and sampled range only; no AC, switching, capacitance, thermal, SOA, or continuous-current implication. |
| `hongjiacheng/ES5JBF` | Promote | 1 | 0.00751933 | 0.0100909 | Exact selected 25 C DC curve, bias, and sampled range only; no AC, switching, capacitance, thermal, SOA, or continuous-current implication. |
| `hongjiacheng/RB551V-30` | Promote | 1 | 0.00906086 | 0.0162311 | Exact selected 25 C DC curve, bias, and sampled range only; no AC, switching, capacitance, thermal, SOA, or continuous-current implication. |
| `hongjiacheng/RS2M` | Reject | 1 | 0.0267364 | 0.0425126 | RS2M passed unchanged F2 residual gates but failed reverse leakage maximum. |
| `infineon/BSS83PH6327` | Promote | 5 | 0.0781561 | 0.171307 | Exact selected 25 C DC curve, bias, and sampled range only; no AC, switching, capacitance, thermal, SOA, or continuous-current implication. |
| `lrc/S-LMBT3904LT1G` | Promote | 2 | 0.0712243 | 0.127209 | Exact selected 25 C DC curve, bias, and sampled range only; no AC, switching, capacitance, thermal, SOA, or continuous-current implication. |
| `nexperia/BSS138PS-115` | Promote | 7 | 0.0376729 | 0.0874316 | Exact selected 25 C DC curve, bias, and sampled range only; no AC, switching, capacitance, thermal, SOA, or continuous-current implication. |
| `nexperia/PMBT3906-215` | Promote | 2 | 0.00303857 | 0.00431583 | Exact selected 25 C DC curve, bias, and sampled range only; no AC, switching, capacitance, thermal, SOA, or continuous-current implication. |

No inappropriate upper physical-bound saturation was accepted. Lower-bound or near-zero held parameters were retained only where the selected evidence could not identify that behavior, with the held reason preserved.

## Identity corrections

| Staged package | Canonical identity | Retained alias |
| --- | --- | --- |
| `infineon/BSS83PH6327` | `BSS83P` | `BSS83PH6327` |
| `infineon/IRFR024NTRPBF` | `IRFR024NPbF` | `IRFR024NTRPBF` |
| `kec-semicon/2N5551S-RTK-P` | `2N5551S` | `2N5551S-RTK/P` |
| `nexperia/BC817-40-QR` | `BC817-40-Q` | `BC817-40-QR` |
| `nexperia/PMV65XPEAR` | `PMV65XPEA` | `PMV65XPEAR` |
| `rohm-semicon/2SA1037AKT146R` | `2SA1037AK` | `2SA1037AKT146R` |
| `rohm-semicon/2SC2412KT146R` | `2SC2412K` | `2SC2412KT146R` |
| `rohm-semicon/2SK3541T2L` | `2SK3541` | `2SK3541T2L` |

No promotion introduced a normalized canonical or alias collision or a family-aware complete fitted-vector collision. The final 440-package audit also identified one pre-existing baseline identity overlap, `vishay/1N4148` versus the `1N4148` alias on `vishay/LL4148`, and seven pre-existing baseline complete-vector groups. None involves a batch-4 promotion; the exact groups are recorded in the manifest.

## SI retry rulings

- `born/SI2309`: promoted F1. Ciss 310 pF became 3.1e-10 F, Coss 22 pF became 2.2e-11 F, and Crss 15 pF became 1.5e-11 F exactly once. Original pF values and citations remain. `curves_used` is empty and AC coverage remains `none`.
- `doingter/DO2302E-Q`: promoted F1. Ciss 180 pF became 1.8e-10 F, Coss 35 pF became 3.5e-11 F, and Crss 25 pF became 2.5e-11 F exactly once. Original pF values and citations remain. `curves_used` is empty and AC coverage remains `none`.

## HL 3401 ruling

Promote F1. Direct PDF inspection found the HL logo, `3401` part designation, P-channel symbol, -30 V and -4 A product summary, negative-polarity electrical table, and P-channel curves. The mixed `20V`, `N-Ch`, and `20N02` text is template boilerplate contamination. Device-specific identity and polarity evidence is independently strong enough for promotion. Three exact published RDS(on) maximum checks passed the unchanged model.

## Process-control audit

- Execution outcomes: 128 total, comprising 93 staged and 35 non-staged outcomes.
- Non-staged outcomes: 2 Phase-A identity skips, 23 fresh duplicate skips, and 10 fresh failures. None has a staged package path or a promotion entry.
- Unlaunched selection: waves 4 and 5 contain 26 and 17 selected targets, respectively. All 43 remained unprocessed and have no execution outcome or package path.
- Six terminal extraction failures were reconciled: BC846BW, LBC847CLT1G, BZT52C3V6, SI2305A, 2N7002DW, and AP9926. None is staged or promoted.
- The possible brief five-lane overlap in wave 2 is preserved as a process deviation. It did not alter package identity, source hashes, package paths, or review accounting. Subsequent scheduling used four or fewer live lanes.
- No evidence cross-contamination was found between skipped, failed, unlaunched, and staged targets.

### All non-staged outcomes

| Origin | Status | LCSC | MPN | Reason |
| --- | --- | --- | --- | --- |
| phase-a | skipped | C2938369 | `AO3402` | library identity collision: ao3402 already represented by alpha-omega-semicon/AO3402 |
| phase-a | skipped | C181167 | `2SC1623（L6）` | library identity collision: 2sc1623 already represented by hongjiacheng/2SC1623 |
| wave-1 | skipped | C551530 | `MJD45H11J` | duplicate fitted die vector already represented by onsemi/MJD45H11T4G; no independent parameterization or shared-die evidence was supplied |
| wave-1 | failed | C17300 | `MMBT8050D(J3Y)` | F2 failed: node packages/component-schema/validate-package.mjs tools/conveyor/data/staging/batch-4/packages/st-semtech/MMBT8050D-J3Y.building-59318-1786353415049 failed  FAIL tools/conveyor/data/staging/batch-4/packages/st-semtech/MMBT8050D-J3Y.building-59318-1786353415049   - component/canonical_mpn must match pattern "^[A-Za-z0-9][A-Za-z0-9._+/-]*$"; F1 failed: node packages/component-schema/validate-package.mjs tools/conveyor/data/staging/batch-4/packages/st-semtech/MMBT8050D-J3Y.building-59318-1786353415166 failed  FAIL tools/conveyor/data/staging/batch-4/packages/st-semtech/MMBT8050D-J3Y.building-59318-1786353415166   - component/canonical_mpn must match pattern "^[A-Za-z0-9][A-Za-z0-9._+/-]*$" |
| wave-1 | skipped | C181154 | `C945` | duplicate fitted die vector already represented by nexperia/PBSS4160T; no independent parameterization or shared-die evidence was supplied |
| wave-1 | skipped | C94393 | `BC847BLT1G` | duplicate fitted die vector already represented by nexperia/BC847BW; no independent parameterization or shared-die evidence was supplied |
| wave-1 | skipped | C19077434 | `BZT52B5V1S` | duplicate fitted die vector already represented by hongjiacheng/BZX584C5V1; no independent parameterization or shared-die evidence was supplied |
| wave-1 | skipped | C19077398 | `BZT52C3V9` | duplicate fitted die vector already represented by hongjiacheng/BZT52C3V9S; no independent parameterization or shared-die evidence was supplied |
| wave-2 | skipped | C82477 | `BC846BLT1G` | duplicate fitted die vector already represented by diodes-inc/MMBT3904-7-F; no independent parameterization or shared-die evidence was supplied |
| wave-2 | failed | C5364246 | `BC846BW` | initial Luna stream stalled without output; original transcript was unavailable; one operational retry ended with API connection closed mid-response and produced no output |
| wave-2 | skipped | C2828443 | `MMBT3904T` | duplicate fitted die vector already represented by high-diode/BC817; no independent parameterization or shared-die evidence was supplied |
| wave-2 | skipped | C305456 | `8550M-D` | duplicate fitted die vector already represented by foshan-blue-rocket-elec/S8550M-D; no independent parameterization or shared-die evidence was supplied |
| wave-2 | failed | C12749 | `LBC847CLT1G` | extraction rejected after its one focused retry: bjt.dc_current_gain: catalog '110' disagrees with extracted [520, 420, 800]; closest ratio 3.82x |
| wave-2 | skipped | C22395581 | `BZX584C18` | duplicate fitted die vector already represented by hongjiacheng/BZT52C18; no independent parameterization or shared-die evidence was supplied |
| wave-2 | skipped | C22395539 | `MM1Z5V6` | duplicate fitted die vector already represented by hongjiacheng/BZT52C5V6S; no independent parameterization or shared-die evidence was supplied |
| wave-2 | skipped | C7502711 | `DSK14` | duplicate fitted die vector matches same-batch candidate DSK14; no independent parameterization or shared-die evidence was supplied |
| wave-2 | skipped | C19077462 | `BZX584C3V3` | duplicate fitted die vector already represented by hongjiacheng/BZT52B3V3; no independent parameterization or shared-die evidence was supplied |
| wave-2 | skipped | C7502709 | `DSK34` | duplicate fitted die vector matches same-batch candidate DSK14; no independent parameterization or shared-die evidence was supplied |
| wave-2 | failed | C347509 | `FDN304P(UMW)` | F2 failed: mosfet extraction cannot support an F2 fit: no usable 25 degC transfer curve (drain current versus gate-source voltage); F1 failed: node packages/component-schema/validate-package.mjs tools/conveyor/data/staging/batch-4/packages/umw-youtai-co.-ltd/FDN304P-UMW.building-64069-1786362619765 failed  FAIL tools/conveyor/data/staging/batch-4/packages/umw-youtai-co.-ltd/FDN304P-UMW.building-64069-1786362619765   - component/canonical_mpn must match pattern "^[A-Za-z0-9][A-Za-z0-9._+/-]*$" |
| wave-3 | skipped | C5336792 | `BC847C-QR` | duplicate fitted die vector already represented by onsemi/BC847CLT1G; no independent parameterization or shared-die evidence was supplied |
| wave-3 | skipped | C151597 | `MMBTA06-7-F` | duplicate fitted die vector already represented by high-diode/BC817; no independent parameterization or shared-die evidence was supplied |
| wave-3 | skipped | C90281 | `BC846A,215` | duplicate fitted die vector already represented by lrc/LBC817-16LT1G; no independent parameterization or shared-die evidence was supplied |
| wave-3 | skipped | C125315 | `KTN2222AS-RTK/PS` | duplicate fitted die vector already represented by high-diode/BC817; no independent parameterization or shared-die evidence was supplied |
| wave-3 | skipped | C163723 | `BC846ALT1G` | duplicate fitted die vector already represented by lrc/LBC817-16LT1G; no independent parameterization or shared-die evidence was supplied |
| wave-3 | skipped | C426787 | `BCP56-16TX` | duplicate fitted die vector already represented by high-diode/BC817; no independent parameterization or shared-die evidence was supplied |
| wave-3 | skipped | C686648 | `FMMT593` | duplicate fitted die vector already represented by tdsemic/MMBT2907-2F; no independent parameterization or shared-die evidence was supplied |
| wave-3 | failed | C18199087 | `1N4004W` | F2 failed: diode F2 gate failed: N saturated its physical bound at 4; the true optimum lies outside the physical range, so the residual is a constraint artefact; forward_voltage worst relative error 0.3702 exceeds gate 0.05; forward_voltage RMS relative error 0.2496 exceeds gate 0.03; F1 failed: Validation failed for 1N4004W. See validation-results.json; failed package checks: forward_voltage_maximum_at_0.95_a observed 1.037639975018159 (maximum 1) |
| wave-3 | skipped | C22392482 | `BAT54CW` | duplicate fitted die vector already represented by hongjiacheng/BAT54WS; no independent parameterization or shared-die evidence was supplied |
| wave-3 | skipped | C19077465 | `BZX584C9V1` | duplicate fitted die vector already represented by hongjiacheng/BZT52C9V1S; no independent parameterization or shared-die evidence was supplied |
| wave-3 | failed | C19077397 | `BZT52C3V6` | extraction rejected after its one focused retry: $.curves[2].points has too few items |
| wave-3 | failed | C347488 | `SI2305A` | extraction rejected after its one focused retry: $ missing required keys: curves, datasheet_identity, extraction_notes, family, manufacturer, mpn, omission_reason, schema_version, specs, usable_curves |
| wave-3 | failed | C5190214 | `2N7002DW` | extraction rejected after its one focused retry: $.specs.ciss does not match any allowed shape: $.specs.ciss has unknown keys: conversion_note; $.specs.ciss must be null |
| wave-3 | failed | C353066 | `AP9926` | extraction rejected after its one focused retry: vdmos.rds_on: catalog '27mΩ@4.5V,6.5A' disagrees with extracted [21.5, 30.5, 26.5]; closest ratio 796x; vdmos.ciss: catalog '700pF@10V' disagrees with extracted [700.0]; closest ratio 1e+12x; vdmos.coss: catalog '175pF' disagrees with extracted [175.0]; closest ratio 1e+12x; vdmos.crss: catalog '85pF' disagrees with extracted [85.0]; closest ratio 1e+12x |
| wave-3 | skipped | C2936839 | `FS3401M` | duplicate fitted die vector already represented by hongjiacheng/HL3401; no independent parameterization or shared-die evidence was supplied |
| wave-3 | failed | C347501 | `IRLML6401TR(UMW)` | F2 failed: mosfet F2 gate failed: drain_current worst relative error 60.7440 exceeds gate 0.2; drain_current RMS relative error 25.6640 exceeds gate 0.12; rds_on worst relative error 2.3741 exceeds gate 0.2; rds_on RMS relative error 2.0204 exceeds gate 0.12; F1 failed: node packages/component-schema/validate-package.mjs tools/conveyor/data/staging/batch-4/packages/umw-youtai-co-ltd/IRLML6401TR-UMW.building-93072-1786365263689 failed  FAIL tools/conveyor/data/staging/batch-4/packages/umw-youtai-co-ltd/IRLML6401TR-UMW.building-93072-1786365263689   - component/canonical_mpn must match pattern "^[A-Za-z0-9][A-Za-z0-9._+/-]*$" |

## Per-package verdicts

| Staged package | Origin | Tier | Family | Canonical target | Verdict | Corrections |
| --- | --- | --- | --- | --- | --- | --- |
| `allpower-shenzhen-quan-li/AP2301` | fresh | F1 | pmos | `allpower-shenzhen-quan-li/AP2301` | Promote | Added and passed unchanged-model published hard-bound checks: rdson_maximum_source_2, rdson_maximum_source_4. |
| `allpower-shenzhen-quan-li/AP30P30Q` | fresh | F1 | pmos | `allpower-shenzhen-quan-li/AP30P30Q` | Promote | Added and passed unchanged-model published hard-bound checks: rdson_maximum_source_3. |
| `allpower-shenzhen-quan-li/AP5N10S` | fresh | F1 | nmos | `allpower-shenzhen-quan-li/AP5N10S` | Promote | Added and passed unchanged-model published hard-bound checks: rdson_maximum_source_2. |
| `alpha-omega-semicon/AO4407C` | fresh | F1 | pmos | `alpha-omega-semicon/AO4407C` | Promote | Added and passed unchanged-model published hard-bound checks: rdson_maximum_source_2, rdson_maximum_source_5. |
| `alpha-omega-semicon/AON7264E` | fresh | F1 | nmos | `alpha-omega-semicon/AON7264E` | Promote | Added and passed unchanged-model published hard-bound checks: rdson_maximum_source_2, rdson_maximum_source_4. |
| `born/SI2309` | fresh | F1 | pmos | `born/SI2309` | Promote | Review metadata installed; no electrical or identity correction required. |
| `diodes/DMC2400UV-7` | fresh | F1 | nmos | `diodes/DMC2400UV-7` | Promote | Review metadata installed; no electrical or identity correction required. |
| `diodes/MMBT3904Q-7-F` | fresh | F2 | bjt_npn | `diodes/MMBT3904Q-7-F` | Promote | Added and passed unchanged-model published hard-bound checks: hfe_maximum_source_4. Narrowed F2 supported scope to the exact selected 25 C curves, biases, and sampled ranges; scalar hard bounds do not extend curve fidelity. |
| `doingter/DO2302E-Q` | fresh | F1 | nmos | `doingter/DO2302E-Q` | Promote | Added and passed unchanged-model published hard-bound checks: rdson_maximum_source_2, rdson_maximum_source_4. |
| `foshan-blue-rocket-elec/BR2N7002K2` | fresh | F1 | nmos | `foshan-blue-rocket-elec/BR2N7002K2` | Promote | Added and passed unchanged-model published hard-bound checks: rdson_maximum_source_1, rdson_maximum_source_3. |
| `foshan-blue-rocket-elec/S8550M-D` | fresh | F1 | bjt_pnp | none | Reject | Defining published hard-bound failure; unchanged staging retained. |
| `fuxinsemi/BC847BS` | fresh | F1 | bjt_npn | `fuxinsemi/BC847BS` | Promote | Added and passed unchanged-model published hard-bound checks: hfe_maximum_source_2, vce_sat_maximum_source_1, vce_sat_maximum_source_2. |
| `guangdong-hottech/4953` | fresh | F1 | pmos | `guangdong-hottech/4953` | Promote | Added and passed unchanged-model published hard-bound checks: rdson_maximum_source_2, rdson_maximum_source_4. |
| `high-diode/BC817` | fresh | F1 | bjt_npn | none | Reject | Defining published hard-bound failure; unchanged staging retained. |
| `hl/20N03` | fresh | F1 | nmos | `hl/20N03` | Promote | Added and passed unchanged-model published hard-bound checks: rdson_maximum_source_2, rdson_maximum_source_4. |
| `hl/30P06` | fresh | F1 | pmos | `hl/30P06` | Promote | Added and passed unchanged-model published hard-bound checks: rdson_maximum_source_2, rdson_maximum_source_4. |
| `hl/3401` | fresh | F1 | pmos | `hl/3401` | Promote | Added and passed unchanged-model published hard-bound checks: rdson_maximum_source_2, rdson_maximum_source_4, rdson_maximum_source_6. |
| `hl/50N06` | fresh | F1 | nmos | `hl/50N06` | Promote | Added and passed unchanged-model published hard-bound checks: rdson_maximum_source_2, rdson_maximum_source_4. |
| `hongjiacheng/1SMA4740A` | fresh | F1 | diode | `hongjiacheng/1SMA4740A` | Promote | Added and passed unchanged-model published hard-bound checks: reverse_leakage_source_maximum, zener_voltage_source_bound. |
| `hongjiacheng/1SMA4742A` | fresh | F1 | diode | `hongjiacheng/1SMA4742A` | Promote | Added and passed unchanged-model published hard-bound checks: forward_voltage_maximum_source_1, reverse_leakage_source_maximum. |
| `hongjiacheng/1SMA5928A` | fresh | F1 | diode | `hongjiacheng/1SMA5928A` | Promote | Added and passed unchanged-model published hard-bound checks: reverse_leakage_source_maximum, zener_voltage_source_bound. |
| `hongjiacheng/1SS389` | fresh | F1 | diode | `hongjiacheng/1SS389` | Promote | Added and passed unchanged-model published hard-bound checks: forward_voltage_maximum_source_2, reverse_leakage_source_maximum, zener_voltage_source_bound. |
| `hongjiacheng/B0520WS` | fresh | F2 | diode | `hongjiacheng/B0520WS` | Promote | Added and passed unchanged-model published hard-bound checks: forward_voltage_maximum_source_1, forward_voltage_maximum_source_2, reverse_leakage_source_maximum. Narrowed F2 supported scope to the exact selected 25 C curves, biases, and sampled ranges; scalar hard bounds do not extend curve fidelity. |
| `hongjiacheng/B0540W` | phase-a | F1 | diode | none | Reject | Defining published hard-bound failure; unchanged staging retained. |
| `hongjiacheng/BAS21S` | phase-a | F1 | diode | `hongjiacheng/BAS21S` | Promote | Added and passed unchanged-model published hard-bound checks: forward_voltage_maximum_source_1, reverse_leakage_source_maximum. |
| `hongjiacheng/BAS70-06` | fresh | F2 | diode | `hongjiacheng/BAS70-06` | Promote | Narrowed F2 supported scope to the exact selected 25 C curves, biases, and sampled ranges; scalar hard bounds do not extend curve fidelity. |
| `hongjiacheng/BAT54SW` | fresh | F2 | diode | `hongjiacheng/BAT54SW` | Promote | Narrowed F2 supported scope to the exact selected 25 C curves, biases, and sampled ranges; scalar hard bounds do not extend curve fidelity. |
| `hongjiacheng/BZT52C36` | fresh | F1 | diode | `hongjiacheng/BZT52C36` | Promote | Added and passed unchanged-model published hard-bound checks: reverse_leakage_source_maximum, zener_voltage_source_bound. |
| `hongjiacheng/BZT52C4V7S` | fresh | F1 | diode | `hongjiacheng/BZT52C4V7S` | Promote | Added and passed unchanged-model published hard-bound checks: reverse_leakage_source_maximum, zener_voltage_source_bound. |
| `hongjiacheng/BZT52C6V2` | fresh | F1 | diode | `hongjiacheng/BZT52C6V2` | Promote | Added and passed unchanged-model published hard-bound checks: reverse_leakage_source_maximum, zener_voltage_source_bound. |
| `hongjiacheng/BZX584C5V6` | fresh | F1 | diode | `hongjiacheng/BZX584C5V6` | Promote | Review metadata installed; no electrical or identity correction required. |
| `hongjiacheng/CXT5551` | fresh | F1 | bjt_npn | `hongjiacheng/CXT5551` | Promote | Added and passed unchanged-model published hard-bound checks: hfe_maximum_source_3, vce_sat_maximum_source_1, vbe_sat_maximum_source_1. |
| `hongjiacheng/DSK210` | fresh | F1 | diode | `hongjiacheng/DSK210` | Promote | Added and passed unchanged-model published hard-bound checks: reverse_leakage_source_maximum. |
| `hongjiacheng/DSK26` | phase-a | F1 | diode | `hongjiacheng/DSK26` | Promote | Added and passed unchanged-model published hard-bound checks: reverse_leakage_source_maximum. |
| `hongjiacheng/ES1D` | fresh | F1 | diode | `hongjiacheng/ES1D` | Promote | Added and passed unchanged-model published hard-bound checks: forward_voltage_maximum_source_1, reverse_leakage_source_maximum. |
| `hongjiacheng/ES1JW` | fresh | F2 | diode | `hongjiacheng/ES1JW` | Promote | Added and passed unchanged-model published hard-bound checks: forward_voltage_maximum_source_1, reverse_leakage_source_maximum. Narrowed F2 supported scope to the exact selected 25 C curves, biases, and sampled ranges; scalar hard bounds do not extend curve fidelity. |
| `hongjiacheng/ES5JB` | fresh | F1 | diode | `hongjiacheng/ES5JB` | Promote | Added and passed unchanged-model published hard-bound checks: forward_voltage_maximum_source_1. |
| `hongjiacheng/ES5JBF` | fresh | F2 | diode | `hongjiacheng/ES5JBF` | Promote | Added and passed unchanged-model published hard-bound checks: forward_voltage_maximum_source_1, reverse_leakage_source_maximum. Narrowed F2 supported scope to the exact selected 25 C curves, biases, and sampled ranges; scalar hard bounds do not extend curve fidelity. |
| `hongjiacheng/MM1W3V6` | fresh | F1 | diode | `hongjiacheng/MM1W3V6` | Promote | Added and passed unchanged-model published hard-bound checks: forward_voltage_maximum_source_1, reverse_leakage_source_maximum, zener_voltage_source_bound. |
| `hongjiacheng/MMSZ5242B` | fresh | F1 | diode | `hongjiacheng/MMSZ5242B` | Promote | Added and passed unchanged-model published hard-bound checks: forward_voltage_maximum_source_1, reverse_leakage_source_maximum. |
| `hongjiacheng/MMSZ5245B` | fresh | F1 | diode | `hongjiacheng/MMSZ5245B` | Promote | Added and passed unchanged-model published hard-bound checks: reverse_leakage_source_maximum, zener_voltage_source_bound. |
| `hongjiacheng/MMSZ5248B` | fresh | F1 | diode | `hongjiacheng/MMSZ5248B` | Promote | Added and passed unchanged-model published hard-bound checks: reverse_leakage_source_maximum. |
| `hongjiacheng/RB160M-30` | fresh | F1 | diode | `hongjiacheng/RB160M-30` | Promote | Added and passed unchanged-model published hard-bound checks: forward_voltage_maximum_source_1, reverse_leakage_source_maximum. |
| `hongjiacheng/RB551V-30` | fresh | F2 | diode | `hongjiacheng/RB551V-30` | Promote | Narrowed F2 supported scope to the exact selected 25 C curves, biases, and sampled ranges; scalar hard bounds do not extend curve fidelity. |
| `hongjiacheng/RB551V-40` | fresh | F1 | diode | `hongjiacheng/RB551V-40` | Promote | Added and passed unchanged-model published hard-bound checks: reverse_leakage_source_maximum. |
| `hongjiacheng/RS2M` | fresh | F2 | diode | none | Reject | Defining published hard-bound failure; unchanged staging retained. |
| `hongjiacheng/S3MB` | fresh | F1 | diode | none | Reject | Defining published hard-bound failure; unchanged staging retained. |
| `hongjiacheng/S3MF` | fresh | F1 | diode | `hongjiacheng/S3MF` | Promote | Added and passed unchanged-model published hard-bound checks: forward_voltage_maximum_source_1, reverse_leakage_source_maximum. |
| `hongjiacheng/SK106C` | fresh | F1 | diode | `hongjiacheng/SK106C` | Promote | Added and passed unchanged-model published hard-bound checks: forward_voltage_maximum_source_1, reverse_leakage_source_maximum. |
| `hongjiacheng/SS510` | fresh | F1 | diode | `hongjiacheng/SS510` | Promote | Added and passed unchanged-model published hard-bound checks: forward_voltage_maximum_source_1, reverse_leakage_source_maximum. |
| `hongjiacheng/SS54B` | phase-a | F1 | diode | `hongjiacheng/SS54B` | Promote | Added and passed unchanged-model published hard-bound checks: reverse_leakage_source_maximum. |
| `hongjiacheng/SS56` | fresh | F1 | diode | `hongjiacheng/SS56` | Promote | Added and passed unchanged-model published hard-bound checks: reverse_leakage_source_maximum. |
| `htcsemi/HT8050ARTZ` | fresh | F1 | bjt_npn | none | Reject | Defining published hard-bound failure; unchanged staging retained. |
| `hxy-mosfet/2N7002-HXY` | fresh | F1 | nmos | `hxy-mosfet/2N7002-HXY` | Promote | Review metadata installed; no electrical or identity correction required. |
| `hxy-mosfet/AO3400-HXY` | phase-a | F1 | nmos | none | Reject | Defining published hard-bound failure; unchanged staging retained. |
| `infineon/BSS83PH6327` | fresh | F2 | pmos | `infineon/BSS83P` | Promote | Canonicalized primary PDF identity to BSS83P and retained BSS83PH6327 as an ordering-code alias. Narrowed F2 supported scope to the exact selected 25 C curves, biases, and sampled ranges; scalar hard bounds do not extend curve fidelity. |
| `infineon/IRFB4227PBF` | fresh | F1 | nmos | `infineon/IRFB4227PBF` | Promote | Review metadata installed; no electrical or identity correction required. |
| `infineon/IRFR024NTRPBF` | fresh | F1 | nmos | `infineon/IRFR024NPbF` | Promote | Canonicalized primary PDF identity to IRFR024NPbF and retained IRFR024NTRPBF as an ordering-code alias. Added and passed unchanged-model published hard-bound checks: rdson_maximum_source_1. |
| `jiangsu-changjing-electronics-co-ltd/BCP56-RANGE-100-250` | fresh | F1 | bjt_npn | `jiangsu-changjing-electronics-co-ltd/BCP56` | Promote | Added and passed unchanged-model published hard-bound checks: hfe_maximum_source_3, vce_sat_maximum_source_1. |
| `jiangsu-changjing-electronics-co-ltd/CJ2309A` | fresh | F1 | pmos | `jiangsu-changjing-electronics-co-ltd/CJ2309A` | Promote | Added and passed unchanged-model published hard-bound checks: rdson_maximum_source_2, rdson_maximum_source_4. |
| `jiangsu-changjing-electronics-co-ltd/S9012-2T1-RANGE-200-350` | phase-a | F1 | bjt_pnp | none | Reject | Defining published hard-bound failure; unchanged staging retained. |
| `kec-semicon/2N5551S-RTK-P` | fresh | F1 | bjt_npn | `kec-semicon/2N5551S` | Promote | Canonicalized primary PDF identity to 2N5551S and retained 2N5551S-RTK/P as an ordering-code alias. Added and passed unchanged-model published hard-bound checks: hfe_maximum_source_3, vce_sat_maximum_source_1, vbe_sat_maximum_source_1, vce_sat_maximum_source_2. |
| `lrc/LBC817-16LT1G` | fresh | F1 | bjt_npn | `lrc/LBC817-16LT1G` | Promote | Added and passed unchanged-model published hard-bound checks: hfe_maximum_source_4, vce_sat_maximum_source_3. |
| `lrc/LBSS138LT1G` | phase-a | F1 | nmos | `lrc/LBSS138LT1G` | Promote | Added and passed unchanged-model published hard-bound checks: rdson_maximum_source_2. |
| `lrc/S-LMBT3904LT1G` | fresh | F2 | bjt_npn | `lrc/S-LMBT3904LT1G` | Promote | Added and passed unchanged-model published hard-bound checks: hfe_maximum_source_4. Narrowed F2 supported scope to the exact selected 25 C curves, biases, and sampled ranges; scalar hard bounds do not extend curve fidelity. |
| `mcc-micro-commercial-components/MMS8050-H-TP` | fresh | F1 | bjt_npn | none | Reject | Defining published hard-bound failure; unchanged staging retained. |
| `nexperia/BC807-25-215` | fresh | F1 | bjt_pnp | `nexperia/BC807-25` | Promote | Added and passed unchanged-model published hard-bound checks: hfe_minimum_source_1, hfe_maximum_source_2, hfe_minimum_source_3. |
| `nexperia/BC807DS-115` | fresh | F1 | bjt_pnp | `nexperia/BC807DS` | Promote | Added and passed unchanged-model published hard-bound checks: hfe_maximum_source_2, vce_sat_maximum_source_1. |
| `nexperia/BC817-40-QR` | fresh | F1 | bjt_npn | `nexperia/BC817-40-Q` | Promote | Canonicalized primary PDF identity to BC817-40-Q and retained BC817-40-QR as an ordering-code alias. Added and passed unchanged-model published hard-bound checks: hfe_maximum_source_2, vce_sat_maximum_source_1. |
| `nexperia/BC859C-215` | fresh | F1 | bjt_pnp | `nexperia/BC859C` | Promote | Added and passed unchanged-model published hard-bound checks: hfe_minimum_source_1, hfe_maximum_source_2. |
| `nexperia/BSS138BK-215` | fresh | F1 | nmos | `nexperia/BSS138BK` | Promote | Review metadata installed; no electrical or identity correction required. |
| `nexperia/BSS138PS-115` | fresh | F2 | nmos | `nexperia/BSS138PS` | Promote | Added and passed unchanged-model published hard-bound checks: rdson_maximum_source_2, rdson_maximum_source_4. Narrowed F2 supported scope to the exact selected 25 C curves, biases, and sampled ranges; scalar hard bounds do not extend curve fidelity. |
| `nexperia/MJD44H11J` | phase-a | F1 | bjt_npn | none | Reject | Defining published hard-bound failure; unchanged staging retained. |
| `nexperia/NX7002AK-215` | fresh | F1 | nmos | `nexperia/NX7002AK` | Promote | Added and passed unchanged-model published hard-bound checks: rdson_maximum_source_2, rdson_maximum_source_4, rdson_maximum_source_6. |
| `nexperia/PBSS4540X-135` | fresh | F1 | bjt_npn | none | Reject | Defining published hard-bound failure; unchanged staging retained. |
| `nexperia/PMBT3906-215` | fresh | F2 | bjt_pnp | `nexperia/PMBT3906` | Promote | Added and passed unchanged-model published hard-bound checks: hfe_maximum_source_4. Narrowed F2 supported scope to the exact selected 25 C curves, biases, and sampled ranges; scalar hard bounds do not extend curve fidelity. |
| `nexperia/PMV65XPEAR` | fresh | F1 | pmos | `nexperia/PMV65XPEA` | Promote | Canonicalized primary PDF identity to PMV65XPEA and retained PMV65XPEAR as an ordering-code alias. |
| `onsemi/MJD45H11T4G` | phase-a | F1 | bjt_pnp | none | Reject | Defining published hard-bound failure; unchanged staging retained. |
| `onsemi/NTZD3154NT1G` | fresh | F1 | nmos | `onsemi/NTZD3154NT1G` | Promote | Added and passed unchanged-model published hard-bound checks: rdson_maximum_source_2, rdson_maximum_source_4, rdson_maximum_source_6. |
| `realchip/RC3134KM3` | fresh | F1 | nmos | `realchip/RC3134KM3` | Promote | Review metadata installed; no electrical or identity correction required. |
| `rohm-semicon/2SA1037AKT146R` | fresh | F1 | bjt_pnp | `rohm-semicon/2SA1037AK` | Promote | Canonicalized primary PDF identity to 2SA1037AK and retained 2SA1037AKT146R as an ordering-code alias. Added and passed unchanged-model published hard-bound checks: hfe_maximum_source_2, vce_sat_maximum_source_1. |
| `rohm-semicon/2SC2412KT146R` | fresh | F1 | bjt_npn | `rohm-semicon/2SC2412K` | Promote | Canonicalized primary PDF identity to 2SC2412K and retained 2SC2412KT146R as an ordering-code alias. Added and passed unchanged-model published hard-bound checks: hfe_maximum_source_11, vce_sat_maximum_source_1. |
| `rohm-semicon/2SK3541T2L` | fresh | F1 | nmos | `rohm-semicon/2SK3541` | Promote | Canonicalized primary PDF identity to 2SK3541 and retained 2SK3541T2L as an ordering-code alias. Added and passed unchanged-model published hard-bound checks: rdson_maximum_source_2. |
| `shikues/SK2301AA` | fresh | F1 | pmos | `shikues/SK2301AA` | Promote | Added and passed unchanged-model published hard-bound checks: rdson_maximum_source_2. |
| `st-semtech/MMBT9014C` | fresh | F1 | bjt_npn | `st-semtech/MMBT9014C` | Promote | Added and passed unchanged-model published hard-bound checks: hfe_minimum_source_1, hfe_maximum_source_2, vce_sat_maximum_source_1, vbe_sat_maximum_source_1. |
| `tdsemic/MMBT2907-2F` | fresh | F1 | bjt_pnp | `tdsemic/MMBT2907` | Promote | Added and passed unchanged-model published hard-bound checks: hfe_maximum_source_2, vce_sat_maximum_source_1, vbe_sat_maximum_source_1. |
| `tech-public/SI2323DS` | fresh | F1 | pmos | `tech-public/SI2323DS` | Promote | Added and passed unchanged-model published hard-bound checks: rdson_maximum_source_2, rdson_maximum_source_4. |
| `umw-youtai-co-ltd/AO3416A` | fresh | F1 | nmos | `umw-youtai-co-ltd/AO3416A` | Promote | Added and passed unchanged-model published hard-bound checks: rdson_maximum_source_1, rdson_maximum_source_2, rdson_maximum_source_3. |
| `umw-youtai-co-ltd/SI2310A` | fresh | F1 | nmos | `umw-youtai-co-ltd/SI2310A` | Promote | Review metadata installed; no electrical or identity correction required. |
| `umw-youtai-co-ltd/SI2318A` | fresh | F1 | nmos | `umw-youtai-co-ltd/SI2318A` | Promote | Added and passed unchanged-model published hard-bound checks: rdson_maximum_source_2. |
| `winsok-semicon/WSP4882` | fresh | F1 | nmos | `winsok-semicon/WSP4882` | Promote | Added and passed unchanged-model published hard-bound checks: rdson_maximum_source_2. |
| `winsok-semicon/WST4041` | fresh | F1 | pmos | `winsok-semicon/WST4041` | Promote | Review metadata installed; no electrical or identity correction required. |
| `wuxi-nce-power/NCE2309` | fresh | F1 | pmos | `wuxi-nce-power/NCE2309` | Promote | Added and passed unchanged-model published hard-bound checks: rdson_maximum_source_2. |

## Verification

- Promoted package validation: 81 of 81 validators passed; 344 benches and 400 expectation checks passed.
- Promoted native/WASM parity: 81 of 81 packages passed; worst relative delta 0.00044408920985; worst absolute delta 2.50851817096e-09.
- Original candidate rerun: 93 of 93 validators passed; 260 benches and 321 checks passed; all 260 benches pin `.temp 25`.
- Staging packages are byte-identical to the initial review snapshot; aggregate SHA-256 `c99355cd179a292a581700822f892d7d1e2f88bee88bd422c211fe0018944be9`.
- Final full-library, workspace, collision, marker, tracked-data, and git checks are recorded after the final suite below.

### Final suite

- Promoted revalidation: 81 of 81 packages passed, with 344 native ngspice-46 benches, 400 expectation checks, and 81 pinned-WASM comparisons.
- Full reviewed library: component schema validation passed all 440 packages; model-library test passed 1 of 1.
- Model factory: 44 of 44 tests passed.
- Conveyor: 13 of 13 tests passed; Python compile/typecheck passed.
- Workspace: all six TypeScript workspace typechecks passed.
- Primary PDF hashes: 93 of 93 reproduced.
- Temperature pins: all 260 original staged comparison benches and all 344 promoted benches contain explicit `.temp 25`.
- Promotion metadata: zero pending-review markers and zero reviewer-metadata failures.
- Collision audit: zero promotion-introduced normalized identity/alias collisions and zero promotion-introduced family-aware complete fitted-vector collisions. One identity group and seven complete-vector groups are pre-existing baseline conditions recorded in the manifest.
- Repository hygiene: zero tracked PDFs, SQLite/database files, extraction trees, staging/archive data, vendor model packs, or absolute scratch/worktree/staging paths in this change.
- Staging: all 93 package trees remain byte-identical to the initial snapshot.
- `git diff --check`: passed on the complete staged change.

## Residual concerns

- The `3401` primary PDF contains contradictory boilerplate. Promotion relies on the stronger device-specific P-channel tables, symbols, curves, and product summary; the caveat remains explicit.
- F1 and F2 models remain narrow datasheet-constrained DC approximations. Promotion does not imply AC, switching, capacitance, thermal, SOA, package-parasitic, or continuous-current fidelity unless a package explicitly says otherwise.
- The reported wave-2 five-lane overlap remains a campaign process deviation and is not retroactively represented as compliant.

No package was pushed, deployed, published, posted, or sent to GitHub during this review.
