# Batch 5 independent review log

Date: 2026-08-11

Reviewer: `gpt-5.6-sol independent reviewer`

## Review contract and method

1. Verified the working directory was exactly `/Users/hughp/Documents/opencircuit` and the starting HEAD was `bc23fa95502e5928813b78ecc4ec95a3c5d481a9` before any write.
2. Confirmed the reviewed shipping library began at exactly 440 packages and the executor had not modified it.
3. Reconciled exactly 93 complete staged package trees with the Batch 5 execution record and staging manifest. The staged set contains 44 diodes, 47 MOSFETs, and 2 BJTs; 82 are F1 and 11 are F2.
4. Read every package contract, factual extraction, source record, fitted vector, model card, model, bench, expectation record, validation record, and cached primary PDF. No vendor SPICE model or vendor model pack was used.
5. Reproduced all 93 primary PDF SHA-256 values and checked every cited page number against the cached PDF page count. Image-only ALLPOWER PDFs were OCR-checked for AP4410, AP4606C, and AP9926 identity.
6. Independently reran all 93 staged package validators, 213 native ngspice-46 benches, 213 pinned WASM comparisons, and 213 staged expectations on scratch copies.
7. Generated 120 scratch-only, evidence-backed 25 C DC hard-bound probes across 71 packages. Published minima and maxima were treated as inclusive bounds. Staging originals were never modified.
8. Recomputed every F2 scalar residual from fresh native ngspice results against unchanged `tools/model-factory/lib/fit-gates.json`, inspected optimizer bounds, curve identity, temperature, axes, units, bias, and honest DC-only scope.
9. Canonicalized supported primary PDF identities, retained distributor or tape-and-reel ordering codes as aliases, and rejected one canonical identity collision with the baseline.
10. Compared normalized canonical identities, aliases, and complete family-aware fitted parameter vectors against the prior 440 packages and all Batch 5 candidates. No promoted collision was introduced.
11. Promoted survivors only, added passing nonduplicate hard-bound expectations, narrowed all promoted F2 claims to exact 25 C forward curves, and reran every promoted package through native ngspice and pinned WASM.

## Outcome

| Measure | Count |
| --- | ---: |
| Baseline reviewed packages | 440 |
| Reviewed staged packages | 93 |
| Promoted | 85 |
| Rejected | 8 |
| Final reviewed packages | 525 |
| Added nonduplicate promoted hard-bound checks | 96 |

### Counts by family and fidelity

| Set | Diode | NMOS | PMOS | BJT NPN | F1 | F2 | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Reviewed | 44 | 33 | 14 | 2 | 82 | 11 | 93 |
| Promoted | 40 | 33 | 12 | 0 | 78 | 7 | 85 |
| Rejected | 4 | 0 | 2 | 2 | 4 | 4 | 8 |

## Primary source audit

- 93 of 93 cached primary PDF SHA-256 values reproduced.
- 93 of 93 cited page ranges were within the cached PDF page count.
- Primary identity, manufacturer branding, polarity, SI conversion, table min/typ/max semantics, and figure axes were checked against PDF text or OCR, not extraction JSON alone.
- BAV99W V(BR)R = 75 V at IR = 100 uA is a minimum, not a maximum. The promoted facts record corrects that source semantic without changing electrical parameters.
- Staging aggregate SHA-256 remained `faff08ab596cc5cbee115b231906ba215e5559d05c62ae80ff401c82ebf0bd99` across 1,050 files, byte-identical to the initial snapshot.

## Staged validation

- Package validators: 93 of 93 passed.
- Native ngspice-46 benches: 213 of 213 passed.
- Pinned WASM comparisons: 213 of 213 passed.
- Staged expectations: 213 of 213 passed.
- Worst native/WASM relative delta: `2.7551608043197694e-10`.
- Worst native/WASM absolute delta: `7.973510740555412e-12`.
- Every staged bench contains an explicit `.temp 25`.

## Published hard-bound rejections

| Package | Tier | Reason |
| --- | --- | --- |
| `guangdong-hottech/BC846BW` | F1 | Published VBE(sat) maximum failed at IC = 10 mA and IB = 0.5 mA: 0.7254940624983918 V observed, 0.7 V inclusive maximum. |
| `hongjiacheng/1N4002W` | F2 | Published reverse-leakage maximum failed at VR = 100 V and 25 C: 4.481614704026135e-6 A observed, 2e-6 A inclusive maximum. |
| `hongjiacheng/DSK12` | F2 | Published reverse-leakage maximum failed at VR = 20 V and 25 C: 3.77533916425565e-4 A observed, 2e-4 A inclusive maximum. |
| `hongjiacheng/M7F` | F2 | Published reverse-leakage maximum failed at VR = 1000 V and 25 C: 5.212569241213564e-6 A observed, 2e-6 A inclusive maximum. |
| `hongjiacheng/SS520` | F2 | Published reverse-leakage maximum failed at VR = 200 V and 25 C: 4.920742414871412e-4 A observed, 5e-5 A inclusive maximum. |
| `st-semtech/MMBT8050D-J3Y` | F1 | Published VBE(sat) maximum failed at IC = 0.8 A and IB = 0.08 A: 1.3503936972498065 V observed, 1.2 V inclusive maximum. |
| `vishay-intertech/TP0610K-T1-GE3` | F1 | Published RDS(on) maximum failed at VGS = -4.5 V and ID = -0.05 A: 7.502742255259634 ohm observed, 6 ohm inclusive maximum. |

No electrical parameter was changed and no failed model was refitted.

## F2 claim adjudication

All 11 F2 candidates used one selected 25 C forward DC curve. Each selected curve had explicit linear-voltage and logarithmic-current axes in SI units, an identified family or part trace, and a declared sampled current range. The unchanged diode gates were worst relative error <= 0.05 and RMS relative error <= 0.03. No F2 optimizer parameter saturated a physical bound.

| Package | Selected curve | Points | Current range A | Fresh RMS | Fresh worst | Gate result | Final verdict |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| `hongjiacheng/1N4002W` | digitized_typical_forward_characteristics_Tj_25degC (p. 2 Fig. 3) | 9 | 0.0186 to 8.83 | 0.025125 | 0.044612 | Pass | Reject for separate published hard-bound failure |
| `hongjiacheng/BAT54A` | digitized_typical_forward_characteristics_TA_25degC (p. 2 Fig. 1) | 6 | 0.0003057 to 0.09265 | 0.023199 | 0.030550 | Pass | Promote F2 |
| `hongjiacheng/BAV99W` | Fig. 1 Typical Instaneous Forward Characteristics, Ta = 25 degC (p. 2, Fig. 1) | 7 | 3.2e-05 to 0.19 | 0.015216 | 0.024589 | Pass | Promote F2 |
| `hongjiacheng/DSK12` | Typical forward voltage, DSK12-DSK14 solid curve (Zhuhai Hongjiacheng Technology Co., Ltd., DSK12 THRU DSK120, Rev. 1.0, p. 2, Fig. 3 Typical Forward Voltage) | 6 | 0.346 to 10.9 | 0.023484 | 0.045739 | Pass | Reject for separate published hard-bound failure |
| `hongjiacheng/DSK38` | Typical forward voltage, DSK38-DSK310 curve (p. 2, Fig. 3) | 5 | 0.924 to 20.4 | 0.013151 | 0.019376 | Pass | Promote F2 |
| `hongjiacheng/M7F` | typical_forward_voltage_current (p. 2, Fig. 3) | 9 | 0.0218 to 8.36 | 0.016970 | 0.030449 | Pass | Reject for separate published hard-bound failure |
| `hongjiacheng/SS34B` | Typical forward voltage, SS32B-SS34B solid curve (p. 2, Fig. 3) | 6 | 0.479 to 6.065 | 0.018487 | 0.024004 | Pass | Promote F2 |
| `hongjiacheng/SS520` | Typical forward voltage (SS515-SS520 group, includes SS520; digitized typical curve) (PDF p. 2, Fig. 3 Typical Forward Voltage, SS515-SS520 trace) | 10 | 0.1 to 40 | 0.021727 | 0.044376 | Pass | Reject for separate published hard-bound failure |
| `hongjiacheng/US1K` | Typical forward voltage, US1J-US1M curve (p. 2, Fig. 3) | 6 | 0.1 to 10 | 0.006040 | 0.009741 | Pass | Promote F2 |
| `hongjiacheng/US1MW` | Typical forward voltage, US1JW-US1MW curve (p. 2, Fig. 3) | 6 | 0.1 to 10 | 0.006504 | 0.012080 | Pass | Promote F2 |
| `hongjiacheng/US2MB` | Fig. 3 Typical Forward Voltage, US2JB-US2MB curve (p. 2, Fig. 3) | 6 | 0.1 to 15 | 0.007935 | 0.014036 | Pass | Promote F2 |

The promoted F2 supported regions name only the exact selected 25 C forward curve, its axes, bias, and sampled current range. Reverse leakage and other scalar checks do not extend F2 curve fidelity.

## Identity and collision adjudication

| Staged package | Final canonical MPN | Retained ordering-code alias |
| --- | --- | --- |
| `diodes/DMN2056U-7` | `DMN2056U` | `DMN2056U-7` |
| `diodes/DMN6140LQ-7` | `DMN6140LQ` | `DMN6140LQ-7` |
| `nexperia/NX3008NBK-215` | `NX3008NBK` | `NX3008NBK,215` |
| `onsemi/2N7002ET1G` | `2N7002E` | `2N7002ET1G` |
| `rohm-semicon/RK7002BMT116` | `RK7002BM` | `RK7002BMT116` |
| `rohm-semicon/RZM002P02T2L` | `RZM002P02` | `RZM002P02T2L` |
| `toshiba/T2N7002BK-LM` | `T2N7002BK` | `T2N7002BK,LM` |
| `umw-youtai-co-ltd/IRLML6402TR-UMW` | `IRLML6402` | `IRLML6402TR(UMW)` |
| `umw-youtai-co-ltd/IRLR7843TR-UMW` | `IRLR7843` | `IRLR7843TR(UMW)` |
| `umw-youtai-co.-ltd/FDN304P-UMW` | `FDN304P` | `FDN304P(UMW)` |
| `umw-youtai-co.-ltd/NDC7002N-UMW` | `NDC7002N` | `NDC7002N(UMW)` |
| `vishay-intertech/SI2306BDS-T1-E3` | `SI2306BDS` | `SI2306BDS-T1-E3` |
| `vishay-intertech/SI2343CDS-T1-GE3` | `Si2343DS` | `SI2343CDS-T1-GE3` |

- Rejected `umw-youtai-co-ltd/IRLML6401TR-UMW`: its primary PDF identity canonicalizes to `IRLML6401`, already present as `kexin/IRLML6401`.
- Promotion-introduced normalized canonical or alias collisions: 0.
- Promotion-introduced complete family-aware fitted-vector collisions: 0.
- Final library pre-existing overlap groups: 1 normalized identity group and 8 complete-vector groups. None involves a Batch 5 promotion.

## Package dispositions

| Staged package | Origin | Tier | Family | Final canonical | Verdict | Corrections or rejection |
| --- | --- | --- | --- | --- | --- | --- |
| `allpower-shenzhen-quan-li/AP4410` | fresh | F1 | nmos | `AP4410` | Promote F1 | Added and passed unchanged-model hard bounds: rdson_maximum_1, rdson_maximum_2. |
| `allpower-shenzhen-quan-li/AP4606C` | fresh | F1 | nmos | `AP4606C` | Promote F1 | Promoted unchanged after source, validation, and collision review. |
| `allpower-shenzhen-quan-li/AP9926` | phase-a-repair | F1 | nmos | `AP9926` | Promote F1 | Promoted unchanged after source, validation, and collision review. |
| `alpha-omega-semicon/AO3416` | fresh | F1 | nmos | `AO3416` | Promote F1 | Added and passed unchanged-model hard bounds: rdson_maximum_1, rdson_maximum_2, rdson_maximum_3. |
| `alpha-omega-semicon/AOD4184A` | fresh | F1 | nmos | `AOD4184A` | Promote F1 | Added and passed unchanged-model hard bounds: rdson_maximum_1, rdson_maximum_2. |
| `alpha-omega-semicon/AON7400A` | fresh | F1 | nmos | `AON7400A` | Promote F1 | Promoted unchanged after source, validation, and collision review. |
| `crmicro/CR4N65A4K` | fresh | F1 | nmos | `CR4N65A4K` | Promote F1 | Promoted unchanged after source, validation, and collision review. |
| `crmicro/CRSS052N08N` | fresh | F1 | nmos | `CRSS052N08N` | Promote F1 | Added and passed unchanged-model hard bounds: rdson_maximum_1. |
| `diodes/DMN2056U-7` | fresh | F1 | nmos | `DMN2056U` | Promote F1 | Canonicalized primary PDF identity to DMN2056U and retained DMN2056U-7 as an ordering-code alias. |
| `diodes/DMN6140LQ-7` | fresh | F1 | nmos | `DMN6140LQ` | Promote F1 | Canonicalized primary PDF identity to DMN6140LQ and retained DMN6140LQ-7 as an ordering-code alias. |
| `doingter/DOD20N06` | fresh | F1 | nmos | `DOD20N06` | Promote F1 | Promoted unchanged after source, validation, and collision review. |
| `doingter/DOZ30N03` | fresh | F1 | nmos | `DOZ30N03` | Promote F1 | Added and passed unchanged-model hard bounds: rdson_maximum_1, rdson_maximum_2. |
| `elecsuper/AO4407` | fresh | F1 | pmos | `AO4407` | Promote F1 | Added and passed unchanged-model hard bounds: rdson_maximum_1, rdson_maximum_2. |
| `elecsuper/APM4953` | fresh | F1 | pmos | `APM4953` | Promote F1 | Promoted unchanged after source, validation, and collision review. |
| `goodwork/5N10` | fresh | F1 | nmos | `5N10` | Promote F1 | Promoted unchanged after source, validation, and collision review. |
| `goodwork/SI2310` | fresh | F1 | nmos | `SI2310` | Promote F1 | Added and passed unchanged-model hard bounds: rdson_maximum_1, rdson_maximum_2. |
| `guangdong-hottech/2N7002DW` | phase-a-repair | F1 | nmos | `2N7002DW` | Promote F1 | Added and passed unchanged-model hard bounds: rdson_maximum_1, rdson_maximum_2. |
| `guangdong-hottech/BC846BW` | phase-a-repair | F1 | bjt_npn | None | Reject | Published VBE(sat) maximum failed at IC = 10 mA and IB = 0.5 mA: 0.7254940624983918 V observed, 0.7 V inclusive maximum. |
| `hl/40P30` | fresh | F1 | pmos | `40P30` | Promote F1 | Promoted unchanged after source, validation, and collision review. |
| `hl/50N03` | fresh | F1 | nmos | `50N03` | Promote F1 | Promoted unchanged after source, validation, and collision review. |
| `hl/9926A` | fresh | F1 | nmos | `9926A` | Promote F1 | Promoted unchanged after source, validation, and collision review. |
| `hongjiacheng/1N4002W` | fresh | F2 | diode | None | Reject | Published reverse-leakage maximum failed at VR = 100 V and 25 C: 4.481614704026135e-6 A observed, 2e-6 A inclusive maximum. |
| `hongjiacheng/1SMA4728A` | fresh | F1 | diode | `1SMA4728A` | Promote F1 | Added and passed unchanged-model hard bounds: reverse_leakage_source_maximum, breakdown_voltage_source_bound. |
| `hongjiacheng/1SMA4744A` | fresh | F1 | diode | `1SMA4744A` | Promote F1 | Added and passed unchanged-model hard bounds: reverse_leakage_source_maximum, breakdown_voltage_source_bound. |
| `hongjiacheng/1SMA5918A` | fresh | F1 | diode | `1SMA5918A` | Promote F1 | Added and passed unchanged-model hard bounds: reverse_leakage_source_maximum, breakdown_voltage_source_bound. |
| `hongjiacheng/1SMA5919A` | fresh | F1 | diode | `1SMA5919A` | Promote F1 | Added and passed unchanged-model hard bounds: reverse_leakage_source_maximum, breakdown_voltage_source_bound. |
| `hongjiacheng/1SMA5927A` | fresh | F1 | diode | `1SMA5927A` | Promote F1 | Added and passed unchanged-model hard bounds: reverse_leakage_source_maximum, breakdown_voltage_source_bound. |
| `hongjiacheng/1SS355` | fresh | F1 | diode | `1SS355` | Promote F1 | Added and passed unchanged-model hard bounds: reverse_leakage_source_maximum, breakdown_voltage_source_bound. |
| `hongjiacheng/B0520W` | fresh | F1 | diode | `B0520W` | Promote F1 | Added and passed unchanged-model hard bounds: reverse_leakage_source_maximum. |
| `hongjiacheng/B1040WS` | fresh | F1 | diode | `B1040WS` | Promote F1 | Added and passed unchanged-model hard bounds: reverse_leakage_source_maximum. |
| `hongjiacheng/B5818W` | fresh | F1 | diode | `B5818W` | Promote F1 | Added and passed unchanged-model hard bounds: reverse_leakage_source_maximum. |
| `hongjiacheng/BAT43WS` | fresh | F1 | diode | `BAT43WS` | Promote F1 | Added and passed unchanged-model hard bounds: reverse_leakage_source_maximum. |
| `hongjiacheng/BAT54A` | fresh | F2 | diode | `BAT54A` | Promote F2 | Narrowed F2 supported scope to the exact selected 25 C forward curve, axes, bias, and sampled range; scalar hard bounds do not extend curve fidelity. |
| `hongjiacheng/BAT54TW` | fresh | F1 | diode | `BAT54TW` | Promote F1 | Added and passed unchanged-model hard bounds: reverse_leakage_source_maximum, breakdown_voltage_source_bound. |
| `hongjiacheng/BAV99W` | fresh | F2 | diode | `BAV99W` | Promote F2 | Corrected the source semantics for V(BR)R = 75 V at IR = 100 uA from maximum to minimum. Narrowed F2 supported scope to the exact selected 25 C forward curve, axes, bias, and sampled range; scalar hard bounds do not extend curve fidelity. |
| `hongjiacheng/BZT52C11` | fresh | F1 | diode | `BZT52C11` | Promote F1 | Added and passed unchanged-model hard bounds: reverse_leakage_source_maximum, breakdown_voltage_source_bound. |
| `hongjiacheng/BZT52C20` | fresh | F1 | diode | `BZT52C20` | Promote F1 | Added and passed unchanged-model hard bounds: reverse_leakage_source_maximum, breakdown_voltage_source_bound. |
| `hongjiacheng/BZT52C24S` | fresh | F1 | diode | `BZT52C24S` | Promote F1 | Added and passed unchanged-model hard bounds: reverse_leakage_source_maximum, breakdown_voltage_source_bound. |
| `hongjiacheng/BZT52C3V6` | phase-a-repair | F1 | diode | `BZT52C3V6` | Promote F1 | Added and passed unchanged-model hard bounds: reverse_leakage_source_maximum, breakdown_voltage_source_bound. |
| `hongjiacheng/DSK12` | fresh | F2 | diode | None | Reject | Published reverse-leakage maximum failed at VR = 20 V and 25 C: 3.77533916425565e-4 A observed, 2e-4 A inclusive maximum. |
| `hongjiacheng/DSK38` | fresh | F2 | diode | `DSK38` | Promote F2 | Narrowed F2 supported scope to the exact selected 25 C forward curve, axes, bias, and sampled range; scalar hard bounds do not extend curve fidelity. Added and passed unchanged-model hard bounds: reverse_leakage_source_maximum. |
| `hongjiacheng/ES2G` | fresh | F1 | diode | `ES2G` | Promote F1 | Added and passed unchanged-model hard bounds: reverse_leakage_source_maximum. |
| `hongjiacheng/ES3DB` | fresh | F1 | diode | `ES3DB` | Promote F1 | Added and passed unchanged-model hard bounds: reverse_leakage_source_maximum. |
| `hongjiacheng/M7F` | fresh | F2 | diode | None | Reject | Published reverse-leakage maximum failed at VR = 1000 V and 25 C: 5.212569241213564e-6 A observed, 2e-6 A inclusive maximum. |
| `hongjiacheng/MM1W18` | fresh | F1 | diode | `MM1W18` | Promote F1 | Added and passed unchanged-model hard bounds: reverse_leakage_source_maximum, breakdown_voltage_source_bound. |
| `hongjiacheng/MM1W30` | fresh | F1 | diode | `MM1W30` | Promote F1 | Added and passed unchanged-model hard bounds: reverse_leakage_source_maximum, breakdown_voltage_source_bound. |
| `hongjiacheng/MM1W3V9` | fresh | F1 | diode | `MM1W3V9` | Promote F1 | Added and passed unchanged-model hard bounds: reverse_leakage_source_maximum, breakdown_voltage_source_bound. |
| `hongjiacheng/MMBD4148CC` | fresh | F1 | diode | `MMBD4148CC` | Promote F1 | Added and passed unchanged-model hard bounds: reverse_leakage_source_maximum, breakdown_voltage_source_bound. |
| `hongjiacheng/MMSZ5231B` | fresh | F1 | diode | `MMSZ5231B` | Promote F1 | Added and passed unchanged-model hard bounds: reverse_leakage_source_maximum, breakdown_voltage_source_bound. |
| `hongjiacheng/MMSZ5232B` | fresh | F1 | diode | `MMSZ5232B` | Promote F1 | Added and passed unchanged-model hard bounds: reverse_leakage_source_maximum, breakdown_voltage_source_bound. |
| `hongjiacheng/MMSZ5239B` | fresh | F1 | diode | `MMSZ5239B` | Promote F1 | Added and passed unchanged-model hard bounds: reverse_leakage_source_maximum, breakdown_voltage_source_bound. |
| `hongjiacheng/MMSZ5250B` | fresh | F1 | diode | `MMSZ5250B` | Promote F1 | Added and passed unchanged-model hard bounds: reverse_leakage_source_maximum, breakdown_voltage_source_bound. |
| `hongjiacheng/S10MC` | fresh | F1 | diode | `S10MC` | Promote F1 | Added and passed unchanged-model hard bounds: reverse_leakage_source_maximum. |
| `hongjiacheng/SD103AW` | fresh | F1 | diode | `SD103AW` | Promote F1 | Added and passed unchanged-model hard bounds: reverse_leakage_source_maximum. |
| `hongjiacheng/SS18` | fresh | F1 | diode | `SS18` | Promote F1 | Added and passed unchanged-model hard bounds: reverse_leakage_source_maximum. |
| `hongjiacheng/SS28` | fresh | F1 | diode | `SS28` | Promote F1 | Added and passed unchanged-model hard bounds: reverse_leakage_source_maximum. |
| `hongjiacheng/SS310B` | fresh | F1 | diode | `SS310B` | Promote F1 | Added and passed unchanged-model hard bounds: reverse_leakage_source_maximum. |
| `hongjiacheng/SS34B` | fresh | F2 | diode | `SS34B` | Promote F2 | Narrowed F2 supported scope to the exact selected 25 C forward curve, axes, bias, and sampled range; scalar hard bounds do not extend curve fidelity. Added and passed unchanged-model hard bounds: reverse_leakage_source_maximum. |
| `hongjiacheng/SS520` | fresh | F2 | diode | None | Reject | Published reverse-leakage maximum failed at VR = 200 V and 25 C: 4.920742414871412e-4 A observed, 5e-5 A inclusive maximum. |
| `hongjiacheng/SS56B` | fresh | F1 | diode | `SS56B` | Promote F1 | Added and passed unchanged-model hard bounds: reverse_leakage_source_maximum. |
| `hongjiacheng/SS56C` | fresh | F1 | diode | `SS56C` | Promote F1 | Added and passed unchanged-model hard bounds: reverse_leakage_source_maximum. |
| `hongjiacheng/US1G` | fresh | F1 | diode | `US1G` | Promote F1 | Added and passed unchanged-model hard bounds: reverse_leakage_source_maximum. |
| `hongjiacheng/US1K` | fresh | F2 | diode | `US1K` | Promote F2 | Narrowed F2 supported scope to the exact selected 25 C forward curve, axes, bias, and sampled range; scalar hard bounds do not extend curve fidelity. Added and passed unchanged-model hard bounds: reverse_leakage_source_maximum. |
| `hongjiacheng/US1MW` | fresh | F2 | diode | `US1MW` | Promote F2 | Narrowed F2 supported scope to the exact selected 25 C forward curve, axes, bias, and sampled range; scalar hard bounds do not extend curve fidelity. Added and passed unchanged-model hard bounds: reverse_leakage_source_maximum. |
| `hongjiacheng/US2MB` | fresh | F2 | diode | `US2MB` | Promote F2 | Narrowed F2 supported scope to the exact selected 25 C forward curve, axes, bias, and sampled range; scalar hard bounds do not extend curve fidelity. Added and passed unchanged-model hard bounds: reverse_leakage_source_maximum. |
| `hxy-mosfet/8205A` | fresh | F1 | nmos | `8205A` | Promote F1 | Promoted unchanged after source, validation, and collision review. |
| `infineon/IPT015N10N5` | fresh | F1 | nmos | `IPT015N10N5` | Promote F1 | Added and passed unchanged-model hard bounds: rdson_maximum_1. |
| `infineon/IRF530NPBF` | fresh | F1 | nmos | `IRF530NPBF` | Promote F1 | Promoted unchanged after source, validation, and collision review. |
| `infineon/IRF630NPBF` | fresh | F1 | nmos | `IRF630NPBF` | Promote F1 | Promoted unchanged after source, validation, and collision review. |
| `infineon/IRLML0030TRPBF` | fresh | F1 | nmos | `IRLML0030TRPBF` | Promote F1 | Added and passed unchanged-model hard bounds: rdson_maximum_1, rdson_maximum_2. |
| `nexperia/NX3008NBK-215` | fresh | F1 | nmos | `NX3008NBK` | Promote F1 | Canonicalized primary PDF identity to NX3008NBK and retained NX3008NBK,215 as an ordering-code alias. Added and passed unchanged-model hard bounds: rdson_maximum_1, rdson_maximum_2, rdson_maximum_3. |
| `onsemi/2N7002ET1G` | fresh | F1 | nmos | `2N7002E` | Promote F1 | Canonicalized primary PDF identity to 2N7002E and retained 2N7002ET1G as an ordering-code alias. Added and passed unchanged-model hard bounds: rdson_maximum_1, rdson_maximum_2. |
| `onsemi/FDN5618P` | fresh | F1 | pmos | `FDN5618P` | Promote F1 | Promoted unchanged after source, validation, and collision review. |
| `onsemi/FDV303N` | fresh | F1 | nmos | `FDV303N` | Promote F1 | Added and passed unchanged-model hard bounds: rdson_minimum_1, rdson_minimum_2. |
| `onsemi/MMBF170LT1G` | fresh | F1 | nmos | `MMBF170LT1G` | Promote F1 | Promoted unchanged after source, validation, and collision review. |
| `realchip/RC3415P` | fresh | F1 | pmos | `RC3415P` | Promote F1 | Added and passed unchanged-model hard bounds: rdson_maximum_2, rdson_maximum_3. |
| `rohm-semicon/RK7002BMT116` | fresh | F1 | nmos | `RK7002BM` | Promote F1 | Canonicalized primary PDF identity to RK7002BM and retained RK7002BMT116 as an ordering-code alias. |
| `rohm-semicon/RZM002P02T2L` | fresh | F1 | pmos | `RZM002P02` | Promote F1 | Canonicalized primary PDF identity to RZM002P02 and retained RZM002P02T2L as an ordering-code alias. |
| `st-semtech/MMBT8050D-J3Y` | phase-a-repair | F1 | bjt_npn | None | Reject | Published VBE(sat) maximum failed at IC = 0.8 A and IB = 0.08 A: 1.3503936972498065 V observed, 1.2 V inclusive maximum. |
| `st-semtech/MMFTN3019E` | fresh | F1 | nmos | `MMFTN3019E` | Promote F1 | Added and passed unchanged-model hard bounds: rdson_maximum_2. |
| `toshiba/T2N7002BK-LM` | fresh | F1 | nmos | `T2N7002BK` | Promote F1 | Canonicalized primary PDF identity to T2N7002BK and retained T2N7002BK,LM as an ordering-code alias. |
| `umw-youtai-co-ltd/AO4406A` | fresh | F1 | nmos | `AO4406A` | Promote F1 | Added and passed unchanged-model hard bounds: rdson_maximum_1, rdson_maximum_2. |
| `umw-youtai-co-ltd/IRLML6401TR-UMW` | phase-a-repair | F1 | pmos | None | Reject | Primary PDF electrical identity canonicalizes to IRLML6401, which collides with the reviewed baseline package kexin/IRLML6401. |
| `umw-youtai-co-ltd/IRLML6402TR-UMW` | fresh | F1 | pmos | `IRLML6402` | Promote F1 | Canonicalized primary PDF identity to IRLML6402 and retained IRLML6402TR(UMW) as an ordering-code alias. |
| `umw-youtai-co-ltd/IRLR7843TR-UMW` | fresh | F1 | nmos | `IRLR7843` | Promote F1 | Canonicalized primary PDF identity to IRLR7843 and retained IRLR7843TR(UMW) as an ordering-code alias. |
| `umw-youtai-co-ltd/SI2307A` | fresh | F1 | pmos | `SI2307A` | Promote F1 | Added and passed unchanged-model hard bounds: rdson_maximum_2. |
| `umw-youtai-co-ltd/SI2319A` | fresh | F1 | pmos | `SI2319A` | Promote F1 | Added and passed unchanged-model hard bounds: rdson_maximum_2. |
| `umw-youtai-co.-ltd/FDN304P-UMW` | phase-a-repair | F1 | pmos | `FDN304P` | Promote F1 | Canonicalized primary PDF identity to FDN304P and retained FDN304P(UMW) as an ordering-code alias. |
| `umw-youtai-co.-ltd/NDC7002N-UMW` | fresh | F1 | nmos | `NDC7002N` | Promote F1 | Canonicalized primary PDF identity to NDC7002N and retained NDC7002N(UMW) as an ordering-code alias. Added and passed unchanged-model hard bounds: rdson_maximum_1, rdson_maximum_2. |
| `vishay-intertech/SI2306BDS-T1-E3` | fresh | F1 | nmos | `SI2306BDS` | Promote F1 | Canonicalized primary PDF identity to SI2306BDS and retained SI2306BDS-T1-E3 as an ordering-code alias. Added and passed unchanged-model hard bounds: rdson_maximum_1, rdson_maximum_2. |
| `vishay-intertech/SI2343CDS-T1-GE3` | fresh | F1 | pmos | `Si2343DS` | Promote F1 | Canonicalized primary PDF identity to Si2343DS and retained SI2343CDS-T1-GE3 as an ordering-code alias. Added and passed unchanged-model hard bounds: rdson_maximum_1, rdson_maximum_2. |
| `vishay-intertech/TP0610K-T1-GE3` | fresh | F1 | pmos | None | Reject | Published RDS(on) maximum failed at VGS = -4.5 V and ID = -0.05 A: 7.502742255259634 ohm observed, 6 ohm inclusive maximum. |
| `wuxi-nce-power/NCE3401` | fresh | F1 | pmos | `NCE3401` | Promote F1 | Promoted unchanged after source, validation, and collision review. |

## Promoted validation

- Package validators: 85 of 85 passed.
- Native ngspice-46 benches and pinned WASM comparisons: 254 of 254 passed.
- Promoted expectations: 254 of 254 passed.
- Worst native/WASM relative delta: `0.0009734435479913371`.
- Worst native/WASM absolute delta: `1.4901161193847656e-08`.

## Final verification commands and results

- `npm test --workspace=@opencircuit/model-library`
  - PASS: 1 test passed; component-schema validated all 525 model packages.
- `npm test`
  - PASS: all workspace test suites completed with 0 failures, including model-library validation of all 525 packages.
- `npm test --prefix tools/model-factory`
  - PASS: 45 tests passed, 0 failed.
- `npm test --prefix tools/conveyor`
  - PASS: 16 tests passed, 0 failed.
- `npm run typecheck --prefix tools/conveyor`
  - PASS: Python compileall completed with no error.
- `npm run typecheck`
  - PASS: all 6 workspace typechecks completed with no error.
- `independent stageValidate pass over promoted package directories`
  - PASS: 85 of 85 validators, 254 of 254 native ngspice-46/WASM benches, and 254 of 254 expectations passed.
- `explicit .temp 25 audit over promoted tests/*.cir`
  - PASS: 254 of 254 promoted benches contain an explicit .temp 25.
- `normalized canonical, alias, and complete family-vector collision audit`
  - PASS: 0 promotion-introduced identity or vector collisions; 1 candidate rejected for a baseline canonical collision.
- `tracked vendor PDF, archive, vendor model-pack, and vendor SPICE audit`
  - PASS: 0 PDF, archive, .lib, or vendor model-pack files were added.
- `promotion-state and absolute staging/scratch reference audit`
  - PASS: 0 unresolved promotion-state markers and 0 staging or scratch references in promoted packages and deliverables.
- `staging aggregate SHA-256 recomputation`
  - PASS: 1,050 files reproduced faff08ab596cc5cbee115b231906ba215e5559d05c62ae80ff401c82ebf0bd99.
- `git diff --cached --check`
  - PASS: no whitespace errors.

## Deviations

- None. Staging originals, electrical parameters, fit gates, fitters, conveyor implementation, and model-factory implementation were not modified.
- No push, deploy, publish, GitHub comment, or Vault update was performed.
