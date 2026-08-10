# Batch 6 independent review log

Date: 2026-08-11

Reviewer: `gpt-5.6-sol independent reviewer`

## Review contract and method

1. Verified the working directory was exactly `/Users/hughp/Documents/opencircuit` and the starting HEAD was `146f18025ac6719bd21f05ff4dc4f9eae55f368e` before any tracked write.
2. Confirmed the reviewed shipping library began at exactly 525 packages and the only pre-existing untracked roots were `.claude/` and `tools/conveyor/data.pre-hardening/`.
3. Reconciled exactly 99 complete staged package trees with the Batch 6 selection, execution record, and staging manifest. The staged set contains 41 diodes, 35 NMOS devices, and 23 PMOS devices; 86 are F1 and 13 are F2.
4. Read every package contract, factual extraction, source record, fitted vector, model card, model, bench, expectation record, validation record, and cached primary PDF. No vendor SPICE model or vendor model pack was used.
5. Reproduced all 99 primary PDF SHA-256 values and checked every cited page number against the cached PDF page count. Image-only or suffix-sensitive identities were adjudicated by rendered-page inspection and OCR where needed.
6. Independently reran all 99 staged package validators, 182 native ngspice-46 benches, 182 pinned WASM comparisons using `eecircuit-engine@1.7.0`, and 187 staged expectations on scratch copies.
7. Generated 133 evidence-backed 25 C DC hard-bound probes across 79 packages. Published minima and maxima were treated as inclusive bounds. All 133 probes passed and staging originals were never modified.
8. Recomputed every F2 residual from fresh native ngspice results against unchanged fit gates, inspected optimizer bounds, curve identity, temperature, axes, units, bias, sign semantics, and honest DC-only scope.
9. Canonicalized supported primary PDF identities, retained ordering codes as aliases, and rejected two normalized canonical identity collisions.
10. Compared normalized canonical identities, aliases, and complete family-aware fitted parameter vectors against the prior 525 packages and all Batch 6 candidates. No promoted collision was introduced.
11. Promoted survivors only, added passing nonduplicate hard-bound expectations, persisted every MOSFET F2 transfer point, narrowed all promoted F2 claims to exact 25 C curves, and reran every promoted package through native ngspice and pinned WASM.

## Outcome

| Measure | Count |
| --- | ---: |
| Baseline reviewed packages | 525 |
| Reviewed staged packages | 99 |
| Promoted | 97 |
| Rejected | 2 |
| Final reviewed packages | 622 |
| Added nonduplicate promoted hard-bound checks | 101 |
| Added MOSFET F2 transfer-point checks | 12 |

### Counts by family and fidelity

| Set | Diode F1 | Diode F2 | NMOS F1 | NMOS F2 | PMOS F1 | PMOS F2 | F1 | F2 | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Reviewed | 30 | 11 | 35 | 0 | 21 | 2 | 86 | 13 | 99 |
| Promoted | 30 | 11 | 33 | 0 | 21 | 2 | 84 | 13 | 97 |
| Rejected | 0 | 0 | 2 | 0 | 0 | 0 | 2 | 0 | 2 |

## Primary source audit

- 99 of 99 cached primary PDF SHA-256 values reproduced.
- 99 of 99 cited page ranges were within the cached PDF page count.
- Primary identity, manufacturer branding, polarity, SI conversion, table min/typ/max semantics, figure axes, and supported operating regions were checked against the PDFs, not extraction JSON alone.
- `hongjiacheng/1SS226` V(BR) = 80 V at IR = 100 uA is an inclusive minimum guarantee, not a typical value. The promoted facts record corrects that source semantic without changing electrical parameters.
- The `hongjiacheng/1SMA4746A` figure caption says Typical Zener Breakdown Characteristics, but the displayed axes are forward voltage and forward current. The F2 claim is limited to the actual forward curve.
- The whole staging tree remained byte-identical across 2,101 files with aggregate SHA-256 `69c6c80a7da710550f45d4a83d12129d30f3e0318fe459ccee176298b80da706`.

## Staged validation

- Package validators: 99 of 99 passed.
- Native ngspice-46 benches: 182 of 182 passed.
- Pinned WASM comparisons: 182 of 182 passed.
- Staged expectations: 187 of 187 passed.
- Worst native/WASM relative delta: `0.00044408920985006256`.
- Worst native/WASM absolute delta: `3.1004951384083768e-09`.
- Every staged bench contains an explicit `.temp 25`.

## Published hard-bound audit

- Independent probes: 133 across 79 applicable packages.
- RDS(on) bounds: 69 of 69 passed.
- Reverse-leakage bounds: 41 of 41 passed.
- Breakdown or zener-voltage bounds: 23 of 23 passed.
- Added 101 nonduplicate passing probes to promoted copies and skipped 29 semantically equivalent existing checks.
- No candidate was rejected for a hard-bound failure. No electrical parameter was changed and no model was refitted.

## F2 claim adjudication

All 13 F2 candidates pass unchanged family gates. The 11 diode fits use selected 25 C forward DC curves with worst relative error <= 0.05 and RMS relative error <= 0.03. The two PMOS fits use selected 25 C transfer DC curves with worst drain-current relative error <= 0.20 and RMS relative error <= 0.12. No candidate has an unexcused optimizer-bound saturation.

| Package | Selected curve and bias | Points | Sampled x range | Sampled y range | Fresh RMS | Fresh worst | Verdict |
| --- | --- | ---: | --- | --- | ---: | ---: | --- |
| `hongjiacheng/1SMA4746A` | Typical forward characteristic, 1SMA4728A-1SMA4764A family (p. 3, Fig. 3 Typical Zener Breakdown Characteristics); forward-current operating points; no independent voltage bias | 5 | 0.7 to 1.4 V | 0.01 to 10 A | 0.023722946 | 0.036352162 | Promote F2 |
| `hongjiacheng/1SS226` | Typical instantaneous forward characteristics, Ta=25 degC (p. 2 Fig. 1, 25 degC curve); forward-current operating points; no independent voltage bias | 5 | 0.4 to 0.88 V | 1e-05 to 0.1 A | 0.021694025 | 0.037674171 | Promote F2 |
| `hongjiacheng/MM3Z3V0` | Typical forward voltage at Ta = 25 degC (p. 3 Fig. 3, Typical Forward Voltage); forward-current operating points; no independent voltage bias | 7 | 0.65 to 1.15 V | 0.001 to 0.5 A | 0.010826562 | 0.018026374 | Promote F2 |
| `hongjiacheng/MM3Z3V6` | Typical forward voltage at Ta = 25 degC (p. 3 Fig. 3, Typical Forward Voltage); forward-current operating points; no independent voltage bias | 7 | 0.65 to 1.15 V | 0.001 to 0.5 A | 0.010826562 | 0.018026374 | Promote F2 |
| `hongjiacheng/MMBD4148` | typical_forward_characteristics_Ta_25C (p. 2 Fig. 1, Ta = 25 degC trace); forward-current operating points; no independent voltage bias | 6 | 0.5 to 1 V | 0.0003 to 0.19 A | 0.011978275 | 0.016875628 | Promote F2 |
| `hongjiacheng/MMBD4148SE` | Forward instantaneous characteristics, Ta = 25 degC (p. 2 Fig. 1); forward-current operating points; no independent voltage bias | 7 | 0.5 to 1.1 V | 0.0002 to 0.25 A | 0.013541162 | 0.025224656 | Promote F2 |
| `hongjiacheng/RB501V-40` | Typical instantaneous forward characteristics, Ta=25 degC (p. 2, Fig. 1 Typical Instantaneous Forward Characteristics, Ta=25 degC curve); forward-current operating points; no independent voltage bias | 6 | 0.2469 to 0.4155 V | 0.001 to 0.1 A | 0.027146136 | 0.039243139 | Promote F2 |
| `hongjiacheng/US1J` | Typical forward voltage, US1J-US1M family (p. 2 Fig. 3); forward-current operating points; no independent voltage bias | 5 | 0.9 to 1.7 V | 0.01 to 10 A | 0.009959283 | 0.017587696 | Promote F2 |
| `hongjiacheng/US2M` | Typical forward voltage, US2J-US2M curve (p. 2, Fig. 3 Typical Forward Voltage); forward-current operating points; no independent voltage bias | 6 | 1.1 to 1.6 V | 0.02 to 9 A | 0.006154012 | 0.008199422 | Promote F2 |
| `hongjiacheng/US3MC` | typical_forward_voltage_US3JC_to_US3MC (p. 2 Fig. 3); forward-current operating points; no independent voltage bias | 8 | 0.96 to 1.65 V | 0.01 to 20 A | 0.019166953 | 0.033877547 | Promote F2 |
| `hongjiacheng/US5MC` | Typical forward voltage, US5JC-US5MC curve family (p. 2 Fig. 3); forward-current operating points; no independent voltage bias | 5 | 0.9 to 1.6 V | 0.01 to 13 A | 0.021423427 | 0.042308573 | Promote F2 |
| `jiangsu-changjing-electronics-co-ltd/CJ3139K` | Typical transfer characteristics, TA = 25 degC (p. 3, Typical Characteristics, Transfer Characteristics, TA = 25 degC trace); VDS magnitude = 3 V, pulsed, TA = 25 degC, P-channel values plotted as magnitudes | 7 | 0.8 to 3 V | 0.05 to 2.5 A | 0.118677934 | 0.185265280 | Promote F2 |
| `lrc/LP2305DSLT1G` | P-channel transfer characteristics, 25 degC (p. 3, Fig. 1 Transfer Characteristics); VDS magnitude = 5 V, TJ = 25 degC; plotted P-channel magnitudes | 5 | 1 to 2 V | 0.3 to 15.5 A | 0.029076635 | 0.058482506 | Promote F2 |

- `jiangsu-changjing-electronics-co-ltd/CJ3139K` declares lower-bound RD as held because no separable drain resistance is resolvable at the selected bias points.
- `lrc/LP2305DSLT1G` declares its strong-inversion VTO extrapolation and lower-bound THETA and LAMBDA defaults. The stated reasons match effects not resolvable from the selected curve set.
- The promoted F2 supported regions name only the exact selected 25 C curve, its axes, bias, sign convention, and sampled range. Scalar hard bounds do not extend F2 curve fidelity.

## Identity and collision adjudication

| Staged package | Final canonical MPN | Retained ordering-code alias |
| --- | --- | --- |
| `diodes/DMG2302UK-7` | `DMG2302UK` | `DMG2302UK-7` |
| `diodes/DMN6075S-7` | `DMN6075S` | `DMN6075S-7` |
| `infineon/BSS84PH6327` | `BSS84P` | `BSS84PH6327` |
| `infineon/IRF9Z24NPBF` | `IRF9Z24N` | `IRF9Z24NPBF` |
| `infineon/IRFR120NTRPBF` | `IRFR120N` | `IRFR120NTRPBF` |
| `infineon/IRFR9024NTRPBF` | `IRFR9024NPbF` | `IRFR9024NTRPBF` |
| `infineon/IRLML6344TRPBF` | `IRLML6344` | `IRLML6344TRPBF` |
| `infineon/IRLR8726TRPBF` | `IRLR8726PbF` | `IRLR8726TRPBF` |
| `rohm-semicon/RUM002N02T2L` | `RUM002N02` | `RUM002N02T2L` |
| `vishay-intertech/IRF830PbF` | `IRF830` | `IRF830PbF` |
| `vishay-intertech/IRFL9014TRPBF` | `IRFL9014` | `IRFL9014TRPBF` |
| `vishay-intertech/SI2305CDS-T1-GE3` | `Si2305CDS` | `SI2305CDS-T1-GE3` |
| `vishay-intertech/SI9407BDY-T1-GE3` | `Si9407BDY` | `SI9407BDY-T1-GE3` |
| `vishay-intertech/Si2302CDS-T1-GE3` | `Si2302CDS` | `Si2302CDS-T1-GE3` |

- Rejected `diodes/2N7002T-7-F`: its primary PDF electrical identity canonicalizes to `2N7002T`, already present as `tech-public/2N7002T`.
- Rejected `guangdong-hottech/IRLML6344`: normalized identity `IRLML6344` collides within Batch 6 with the primary Infineon candidate. The Infineon package was retained.
- Promotion-introduced normalized canonical or alias collisions: 0.
- Promotion-introduced complete family-aware fitted-vector collisions: 0.
- No shared-die exception was required because no promoted complete-vector duplicate exists.

## Package dispositions

| Staged package | Origin | Tier | Family | Final canonical | Verdict | Corrections or rejection |
| --- | --- | --- | --- | --- | --- | --- |
| `allpower-shenzhen-quan-li/AP3003` | new-scale-1k-tail | F1 | nmos | `AP3003` | Promote F1 | Promoted unchanged after source, validation, hard-bound, and collision review. |
| `allpower-shenzhen-quan-li/AP3010` | new-scale-1k-tail | F1 | nmos | `AP3010` | Promote F1 | Promoted unchanged after source, validation, hard-bound, and collision review. |
| `allpower-shenzhen-quan-li/AP3404S` | new-scale-1k-tail | F1 | nmos | `AP3404S` | Promote F1 | Promoted unchanged after source, validation, hard-bound, and collision review. |
| `allpower-shenzhen-quan-li/APG077N01G` | new-scale-1k-tail | F1 | nmos | `APG077N01G` | Promote F1 | Promoted unchanged after source, validation, hard-bound, and collision review. |
| `alpha-omega-semicon/AO3403` | new-scale-1k-tail | F1 | pmos | `AO3403` | Promote F1 | Promoted unchanged after source, validation, hard-bound, and collision review. |
| `alpha-omega-semicon/AO3481C` | inherited-batch-5-order-103-through-160 | F1 | pmos | `AO3481C` | Promote F1 | Promoted unchanged after source, validation, hard-bound, and collision review. |
| `alpha-omega-semicon/AO4459` | new-scale-1k-tail | F1 | pmos | `AO4459` | Promote F1 | Promoted unchanged after source, validation, hard-bound, and collision review. |
| `alpha-omega-semicon/AO4468` | new-scale-1k-tail | F1 | nmos | `AO4468` | Promote F1 | Promoted unchanged after source, validation, hard-bound, and collision review. |
| `apec-advanced-power-elec/AP2310GN-HF` | new-scale-1k-tail | F1 | nmos | `AP2310GN-HF` | Promote F1 | Promoted unchanged after source, validation, hard-bound, and collision review. |
| `born/BMSN3139` | inherited-batch-5-order-103-through-160 | F1 | pmos | `BMSN3139` | Promote F1 | Added passing unchanged-model hard-bound expectations: rdson_maximum_2. |
| `diodes/2N7002T-7-F` | inherited-batch-5-order-103-through-160 | F1 | nmos | None | Reject | Primary PDF electrical identity canonicalizes to 2N7002T, which collides with the reviewed baseline package tech-public/2N7002T. |
| `diodes/DMG2302UK-7` | inherited-batch-5-order-103-through-160 | F1 | nmos | `DMG2302UK` | Promote F1 | Canonicalized primary PDF identity from DMG2302UK-7 to DMG2302UK and retained DMG2302UK-7 as an ordering-code alias. Added passing unchanged-model hard-bound expectations: rdson_maximum_1, rdson_maximum_2. |
| `diodes/DMN6075S-7` | inherited-batch-5-order-103-through-160 | F1 | nmos | `DMN6075S` | Promote F1 | Canonicalized primary PDF identity from DMN6075S-7 to DMN6075S and retained DMN6075S-7 as an ordering-code alias. |
| `elecsuper/2N7002ET1G-ES` | new-scale-1k-tail | F1 | nmos | `2N7002ET1G-ES` | Promote F1 | Added passing unchanged-model hard-bound expectations: rdson_maximum_1, rdson_maximum_2. |
| `fosan/FSS2305` | new-scale-1k-tail | F1 | pmos | `FSS2305` | Promote F1 | Promoted unchanged after source, validation, hard-bound, and collision review. |
| `guangdong-hottech/IRLML6344` | inherited-batch-5-order-103-through-160 | F1 | nmos | None | Reject | Normalized canonical identity IRLML6344 collides within Batch 6 with the primary Infineon IRLML6344 candidate. The Infineon package was retained and this unsupported duplicate identity was rejected. |
| `hl/4882` | new-scale-1k-tail | F1 | nmos | `4882` | Promote F1 | Promoted unchanged after source, validation, hard-bound, and collision review. |
| `hongjiacheng/1SMA4729A` | new-scale-1k-tail | F1 | diode | `1SMA4729A` | Promote F1 | Added passing unchanged-model hard-bound expectations: reverse_leakage_source_maximum, breakdown_voltage_source_bound. |
| `hongjiacheng/1SMA4734A` | new-scale-1k-tail | F1 | diode | `1SMA4734A` | Promote F1 | Added passing unchanged-model hard-bound expectations: reverse_leakage_source_maximum, breakdown_voltage_source_bound. |
| `hongjiacheng/1SMA4737A` | inherited-batch-5-order-103-through-160 | F1 | diode | `1SMA4737A` | Promote F1 | Added passing unchanged-model hard-bound expectations: reverse_leakage_source_maximum, breakdown_voltage_source_bound. |
| `hongjiacheng/1SMA4746A` | new-scale-1k-tail | F2 | diode | `1SMA4746A` | Promote F2 | Narrowed F2 supported scope to the exact selected 25 C DC curve, bias, axes, and sampled range; separate scalar hard bounds do not extend curve fidelity. Added passing unchanged-model hard-bound expectations: breakdown_voltage_source_bound. |
| `hongjiacheng/1SS181` | inherited-batch-5-order-103-through-160 | F1 | diode | `1SS181` | Promote F1 | Added passing unchanged-model hard-bound expectations: reverse_leakage_source_maximum. |
| `hongjiacheng/1SS226` | inherited-batch-5-order-103-through-160 | F2 | diode | `1SS226` | Promote F2 | Corrected the published 80 V reverse-breakdown rating from a typical-value transcription to an inclusive minimum guarantee. Narrowed F2 supported scope to the exact selected 25 C DC curve, bias, axes, and sampled range; separate scalar hard bounds do not extend curve fidelity. Added passing unchanged-model hard-bound expectations: breakdown_voltage_source_bound. |
| `hongjiacheng/1SS357` | new-scale-1k-tail | F1 | diode | `1SS357` | Promote F1 | Added passing unchanged-model hard-bound expectations: reverse_leakage_source_maximum. |
| `hongjiacheng/1SS400` | new-scale-1k-tail | F1 | diode | `1SS400` | Promote F1 | Added passing unchanged-model hard-bound expectations: reverse_leakage_source_maximum, breakdown_voltage_source_bound. |
| `hongjiacheng/B16W` | inherited-batch-5-order-103-through-160 | F1 | diode | `B16W` | Promote F1 | Added passing unchanged-model hard-bound expectations: reverse_leakage_source_maximum. |
| `hongjiacheng/BAT42W` | inherited-batch-5-order-103-through-160 | F1 | diode | `BAT42W` | Promote F1 | Added passing unchanged-model hard-bound expectations: reverse_leakage_source_maximum. |
| `hongjiacheng/BZT52B13` | inherited-batch-5-order-103-through-160 | F1 | diode | `BZT52B13` | Promote F1 | Added passing unchanged-model hard-bound expectations: reverse_leakage_source_maximum, breakdown_voltage_source_bound. |
| `hongjiacheng/BZT52C27S` | inherited-batch-5-order-103-through-160 | F1 | diode | `BZT52C27S` | Promote F1 | Added passing unchanged-model hard-bound expectations: reverse_leakage_source_maximum, breakdown_voltage_source_bound. |
| `hongjiacheng/BZT52C4V3` | new-scale-1k-tail | F1 | diode | `BZT52C4V3` | Promote F1 | Added passing unchanged-model hard-bound expectations: reverse_leakage_source_maximum, breakdown_voltage_source_bound. |
| `hongjiacheng/BZT52C7V5S` | new-scale-1k-tail | F1 | diode | `BZT52C7V5S` | Promote F1 | Added passing unchanged-model hard-bound expectations: reverse_leakage_source_maximum, breakdown_voltage_source_bound. |
| `hongjiacheng/ES2JW` | new-scale-1k-tail | F1 | diode | `ES2JW` | Promote F1 | Added passing unchanged-model hard-bound expectations: reverse_leakage_source_maximum. |
| `hongjiacheng/MM1W24` | new-scale-1k-tail | F1 | diode | `MM1W24` | Promote F1 | Added passing unchanged-model hard-bound expectations: reverse_leakage_source_maximum, breakdown_voltage_source_bound. |
| `hongjiacheng/MM3Z3V0` | inherited-batch-5-order-103-through-160 | F2 | diode | `MM3Z3V0` | Promote F2 | Narrowed F2 supported scope to the exact selected 25 C DC curve, bias, axes, and sampled range; separate scalar hard bounds do not extend curve fidelity. Added passing unchanged-model hard-bound expectations: breakdown_voltage_source_bound. |
| `hongjiacheng/MM3Z3V6` | new-scale-1k-tail | F2 | diode | `MM3Z3V6` | Promote F2 | Narrowed F2 supported scope to the exact selected 25 C DC curve, bias, axes, and sampled range; separate scalar hard bounds do not extend curve fidelity. Added passing unchanged-model hard-bound expectations: breakdown_voltage_source_bound. |
| `hongjiacheng/MMBD4148` | inherited-batch-5-order-103-through-160 | F2 | diode | `MMBD4148` | Promote F2 | Narrowed F2 supported scope to the exact selected 25 C DC curve, bias, axes, and sampled range; separate scalar hard bounds do not extend curve fidelity. Added passing unchanged-model hard-bound expectations: breakdown_voltage_source_bound. |
| `hongjiacheng/MMBD4148SE` | inherited-batch-5-order-103-through-160 | F2 | diode | `MMBD4148SE` | Promote F2 | Narrowed F2 supported scope to the exact selected 25 C DC curve, bias, axes, and sampled range; separate scalar hard bounds do not extend curve fidelity. |
| `hongjiacheng/MMSZ4685` | new-scale-1k-tail | F1 | diode | `MMSZ4685` | Promote F1 | Added passing unchanged-model hard-bound expectations: reverse_leakage_source_maximum, breakdown_voltage_source_bound. |
| `hongjiacheng/MMSZ4688` | inherited-batch-5-order-103-through-160 | F1 | diode | `MMSZ4688` | Promote F1 | Added passing unchanged-model hard-bound expectations: reverse_leakage_source_maximum, breakdown_voltage_source_bound. |
| `hongjiacheng/MMSZ4699` | new-scale-1k-tail | F1 | diode | `MMSZ4699` | Promote F1 | Added passing unchanged-model hard-bound expectations: reverse_leakage_source_maximum, breakdown_voltage_source_bound. |
| `hongjiacheng/MMSZ5225B` | new-scale-1k-tail | F1 | diode | `MMSZ5225B` | Promote F1 | Added passing unchanged-model hard-bound expectations: reverse_leakage_source_maximum, breakdown_voltage_source_bound. |
| `hongjiacheng/MMSZ5228B` | new-scale-1k-tail | F1 | diode | `MMSZ5228B` | Promote F1 | Added passing unchanged-model hard-bound expectations: reverse_leakage_source_maximum, breakdown_voltage_source_bound. |
| `hongjiacheng/MMSZ5230B` | new-scale-1k-tail | F1 | diode | `MMSZ5230B` | Promote F1 | Added passing unchanged-model hard-bound expectations: reverse_leakage_source_maximum, breakdown_voltage_source_bound. |
| `hongjiacheng/MMSZ5243B` | new-scale-1k-tail | F1 | diode | `MMSZ5243B` | Promote F1 | Added passing unchanged-model hard-bound expectations: reverse_leakage_source_maximum, breakdown_voltage_source_bound. |
| `hongjiacheng/MMSZ5252B` | new-scale-1k-tail | F1 | diode | `MMSZ5252B` | Promote F1 | Added passing unchanged-model hard-bound expectations: reverse_leakage_source_maximum, breakdown_voltage_source_bound. |
| `hongjiacheng/MMSZ5259B` | new-scale-1k-tail | F1 | diode | `MMSZ5259B` | Promote F1 | Added passing unchanged-model hard-bound expectations: reverse_leakage_source_maximum, breakdown_voltage_source_bound. |
| `hongjiacheng/RB501V-40` | inherited-batch-5-order-103-through-160 | F2 | diode | `RB501V-40` | Promote F2 | Narrowed F2 supported scope to the exact selected 25 C DC curve, bias, axes, and sampled range; separate scalar hard bounds do not extend curve fidelity. |
| `hongjiacheng/RS3MB` | new-scale-1k-tail | F1 | diode | `RS3MB` | Promote F1 | Added passing unchanged-model hard-bound expectations: reverse_leakage_source_maximum. |
| `hongjiacheng/S2M` | inherited-batch-5-order-103-through-160 | F1 | diode | `S2M` | Promote F1 | Added passing unchanged-model hard-bound expectations: reverse_leakage_source_maximum. |
| `hongjiacheng/SK86C` | new-scale-1k-tail | F1 | diode | `SK86C` | Promote F1 | Added passing unchanged-model hard-bound expectations: reverse_leakage_source_maximum. |
| `hongjiacheng/SS220` | inherited-batch-5-order-103-through-160 | F1 | diode | `SS220` | Promote F1 | Added passing unchanged-model hard-bound expectations: reverse_leakage_source_maximum. |
| `hongjiacheng/SS320` | new-scale-1k-tail | F1 | diode | `SS320` | Promote F1 | Added passing unchanged-model hard-bound expectations: reverse_leakage_source_maximum. |
| `hongjiacheng/SS54F` | inherited-batch-5-order-103-through-160 | F1 | diode | `SS54F` | Promote F1 | Added passing unchanged-model hard-bound expectations: reverse_leakage_source_maximum. |
| `hongjiacheng/US1J` | new-scale-1k-tail | F2 | diode | `US1J` | Promote F2 | Narrowed F2 supported scope to the exact selected 25 C DC curve, bias, axes, and sampled range; separate scalar hard bounds do not extend curve fidelity. Added passing unchanged-model hard-bound expectations: reverse_leakage_source_maximum. |
| `hongjiacheng/US2M` | inherited-batch-5-order-103-through-160 | F2 | diode | `US2M` | Promote F2 | Narrowed F2 supported scope to the exact selected 25 C DC curve, bias, axes, and sampled range; separate scalar hard bounds do not extend curve fidelity. Added passing unchanged-model hard-bound expectations: reverse_leakage_source_maximum. |
| `hongjiacheng/US3MBF` | new-scale-1k-tail | F1 | diode | `US3MBF` | Promote F1 | Added passing unchanged-model hard-bound expectations: reverse_leakage_source_maximum. |
| `hongjiacheng/US3MC` | new-scale-1k-tail | F2 | diode | `US3MC` | Promote F2 | Narrowed F2 supported scope to the exact selected 25 C DC curve, bias, axes, and sampled range; separate scalar hard bounds do not extend curve fidelity. Added passing unchanged-model hard-bound expectations: reverse_leakage_source_maximum. |
| `hongjiacheng/US5MC` | inherited-batch-5-order-103-through-160 | F2 | diode | `US5MC` | Promote F2 | Narrowed F2 supported scope to the exact selected 25 C DC curve, bias, axes, and sampled range; separate scalar hard bounds do not extend curve fidelity. Added passing unchanged-model hard-bound expectations: reverse_leakage_source_maximum. |
| `hx-hengjiaxing/HX2301A` | new-scale-1k-tail | F1 | pmos | `HX2301A` | Promote F1 | Added passing unchanged-model hard-bound expectations: rdson_maximum_1, rdson_maximum_2. |
| `hxy-mosfet/SI2319` | inherited-batch-5-order-103-through-160 | F1 | pmos | `SI2319` | Promote F1 | Added passing unchanged-model hard-bound expectations: rdson_maximum_2. |
| `infineon/BSS84PH6327` | new-scale-1k-tail | F1 | pmos | `BSS84P` | Promote F1 | Canonicalized primary PDF identity from BSS84PH6327 to BSS84P and retained BSS84PH6327 as an ordering-code alias. Added passing unchanged-model hard-bound expectations: rdson_maximum_1, rdson_maximum_2. |
| `infineon/IRF3710PBF` | new-scale-1k-tail | F1 | nmos | `IRF3710PBF` | Promote F1 | Promoted unchanged after source, validation, hard-bound, and collision review. |
| `infineon/IRF9Z24NPBF` | inherited-batch-5-order-103-through-160 | F1 | pmos | `IRF9Z24N` | Promote F1 | Canonicalized primary PDF identity from IRF9Z24NPBF to IRF9Z24N and retained IRF9Z24NPBF as an ordering-code alias. |
| `infineon/IRFP064NPBF` | inherited-batch-5-order-103-through-160 | F1 | nmos | `IRFP064NPBF` | Promote F1 | Promoted unchanged after source, validation, hard-bound, and collision review. |
| `infineon/IRFP260MPBF` | new-scale-1k-tail | F1 | nmos | `IRFP260MPBF` | Promote F1 | Promoted unchanged after source, validation, hard-bound, and collision review. |
| `infineon/IRFR120NTRPBF` | new-scale-1k-tail | F1 | nmos | `IRFR120N` | Promote F1 | Canonicalized primary PDF identity from IRFR120NTRPBF to IRFR120N and retained IRFR120NTRPBF as an ordering-code alias. |
| `infineon/IRFR9024NTRPBF` | new-scale-1k-tail | F1 | pmos | `IRFR9024NPbF` | Promote F1 | Canonicalized primary PDF identity from IRFR9024NTRPBF to IRFR9024NPbF and retained IRFR9024NTRPBF as an ordering-code alias. |
| `infineon/IRLML2030TRPBF` | new-scale-1k-tail | F1 | nmos | `IRLML2030TRPBF` | Promote F1 | Added passing unchanged-model hard-bound expectations: rdson_maximum_1, rdson_maximum_2. |
| `infineon/IRLML6344TRPBF` | inherited-batch-5-order-103-through-160 | F1 | nmos | `IRLML6344` | Promote F1 | Canonicalized primary PDF identity from IRLML6344TRPBF to IRLML6344 and retained IRLML6344TRPBF as an ordering-code alias. |
| `infineon/IRLR8726TRPBF` | new-scale-1k-tail | F1 | nmos | `IRLR8726PbF` | Promote F1 | Canonicalized primary PDF identity from IRLR8726TRPBF to IRLR8726PbF and retained IRLR8726TRPBF as an ordering-code alias. Added passing unchanged-model hard-bound expectations: rdson_maximum_1, rdson_maximum_2. |
| `jiangsu-changjing-electronics-co-ltd/CJ3139K` | new-scale-1k-tail | F2 | pmos | `CJ3139K` | Promote F2 | Narrowed F2 supported scope to the exact selected 25 C DC curve, bias, axes, and sampled range; separate scalar hard bounds do not extend curve fidelity. Added 7 fresh native/WASM transfer-point expectations covering every selected F2 curve point. |
| `jiangsu-changjing-electronics-co-ltd/CJBA3139K` | inherited-batch-5-order-103-through-160 | F1 | pmos | `CJBA3139K` | Promote F1 | Added passing unchanged-model hard-bound expectations: rdson_maximum_1. |
| `jsmsemi/AOD407` | inherited-batch-5-order-103-through-160 | F1 | pmos | `AOD407` | Promote F1 | Added passing unchanged-model hard-bound expectations: rdson_maximum_2. |
| `jsmsemi/JSM2302A-A2SHB` | new-scale-1k-tail | F1 | nmos | `JSM2302A-A2SHB` | Promote F1 | Added passing unchanged-model hard-bound expectations: rdson_maximum_2. |
| `jsmsemi/JSM80N03D` | inherited-batch-5-order-103-through-160 | F1 | nmos | `JSM80N03D` | Promote F1 | Added passing unchanged-model hard-bound expectations: rdson_maximum_2. |
| `jtd/JTD2302` | new-scale-1k-tail | F1 | nmos | `JTD2302` | Promote F1 | Promoted unchanged after source, validation, hard-bound, and collision review. |
| `kuu/KM3139K` | inherited-batch-5-order-103-through-160 | F1 | pmos | `KM3139K` | Promote F1 | Added passing unchanged-model hard-bound expectations: rdson_maximum_1, rdson_maximum_2. |
| `lrc/LP2301BLT1G` | new-scale-1k-tail | F1 | pmos | `LP2301BLT1G` | Promote F1 | Added passing unchanged-model hard-bound expectations: rdson_maximum_1, rdson_maximum_2. |
| `lrc/LP2305DSLT1G` | new-scale-1k-tail | F2 | pmos | `LP2305DSLT1G` | Promote F2 | Narrowed F2 supported scope to the exact selected 25 C DC curve, bias, axes, and sampled range; separate scalar hard bounds do not extend curve fidelity. Added 5 fresh native/WASM transfer-point expectations covering every selected F2 curve point. |
| `lrc/LSI1012N3T5G` | new-scale-1k-tail | F1 | nmos | `LSI1012N3T5G` | Promote F1 | Promoted unchanged after source, validation, hard-bound, and collision review. |
| `msksemi/MS50N06` | inherited-batch-5-order-103-through-160 | F1 | nmos | `MS50N06` | Promote F1 | Added passing unchanged-model hard-bound expectations: rdson_maximum_2. |
| `onsemi/NTJD4001NT1G` | new-scale-1k-tail | F1 | nmos | `NTJD4001NT1G` | Promote F1 | Promoted unchanged after source, validation, hard-bound, and collision review. |
| `onsemi/NTMFS5C430NLT1G` | inherited-batch-5-order-103-through-160 | F1 | nmos | `NTMFS5C430NLT1G` | Promote F1 | Added passing unchanged-model hard-bound expectations: rdson_maximum_1, rdson_maximum_2. |
| `rohm-semicon/RUM002N02T2L` | inherited-batch-5-order-103-through-160 | F1 | nmos | `RUM002N02` | Promote F1 | Canonicalized primary PDF identity from RUM002N02T2L to RUM002N02 and retained RUM002N02T2L as an ordering-code alias. Added passing unchanged-model hard-bound expectations: rdson_maximum_1, rdson_maximum_2, rdson_maximum_3, rdson_maximum_4. |
| `tech-public/2N7002BKS` | inherited-batch-5-order-103-through-160 | F1 | nmos | `2N7002BKS` | Promote F1 | Added passing unchanged-model hard-bound expectations: rdson_maximum_2. |
| `tech-public/AO4882` | new-scale-1k-tail | F1 | nmos | `AO4882` | Promote F1 | Added passing unchanged-model hard-bound expectations: rdson_maximum_2. |
| `tech-public/PMV48XP` | inherited-batch-5-order-103-through-160 | F1 | pmos | `PMV48XP` | Promote F1 | Added passing unchanged-model hard-bound expectations: rdson_maximum_2. |
| `tech-public/TPM7002DFN3` | new-scale-1k-tail | F1 | nmos | `TPM7002DFN3` | Promote F1 | Added passing unchanged-model hard-bound expectations: rdson_maximum_2. |
| `tech-public/TPZXMP3A13FTA` | inherited-batch-5-order-103-through-160 | F1 | pmos | `TPZXMP3A13FTA` | Promote F1 | Added passing unchanged-model hard-bound expectations: rdson_maximum_1, rdson_maximum_2. |
| `tritech-mos/TM15N06SI` | new-scale-1k-tail | F1 | nmos | `TM15N06SI` | Promote F1 | Promoted unchanged after source, validation, hard-bound, and collision review. |
| `umw-youtai-co-ltd/20N06` | new-scale-1k-tail | F1 | nmos | `20N06` | Promote F1 | Added passing unchanged-model hard-bound expectations: rdson_maximum_2. |
| `vishay-intertech/IRF830PbF` | new-scale-1k-tail | F1 | nmos | `IRF830` | Promote F1 | Canonicalized primary PDF identity from IRF830PbF to IRF830 and retained IRF830PbF as an ordering-code alias. |
| `vishay-intertech/IRFL9014TRPBF` | inherited-batch-5-order-103-through-160 | F1 | pmos | `IRFL9014` | Promote F1 | Canonicalized primary PDF identity from IRFL9014TRPBF to IRFL9014 and retained IRFL9014TRPBF as an ordering-code alias. |
| `vishay-intertech/SI2305CDS-T1-GE3` | new-scale-1k-tail | F1 | pmos | `Si2305CDS` | Promote F1 | Canonicalized primary PDF identity from SI2305CDS-T1-GE3 to Si2305CDS and retained SI2305CDS-T1-GE3 as an ordering-code alias. Added passing unchanged-model hard-bound expectations: rdson_maximum_1, rdson_maximum_2, rdson_maximum_3. |
| `vishay-intertech/SI9407BDY-T1-GE3` | new-scale-1k-tail | F1 | pmos | `Si9407BDY` | Promote F1 | Canonicalized primary PDF identity from SI9407BDY-T1-GE3 to Si9407BDY and retained SI9407BDY-T1-GE3 as an ordering-code alias. Added passing unchanged-model hard-bound expectations: rdson_maximum_1, rdson_maximum_2. |
| `vishay-intertech/Si2302CDS-T1-GE3` | inherited-batch-5-order-103-through-160 | F1 | nmos | `Si2302CDS` | Promote F1 | Canonicalized primary PDF identity from Si2302CDS-T1-GE3 to Si2302CDS and retained Si2302CDS-T1-GE3 as an ordering-code alias. |
| `winsok-semicon/WSP4606` | new-scale-1k-tail | F1 | nmos | `WSP4606` | Promote F1 | Promoted unchanged after source, validation, hard-bound, and collision review. |
| `wuxi-nce-power/NCE3407` | new-scale-1k-tail | F1 | pmos | `NCE3407` | Promote F1 | Added passing unchanged-model hard-bound expectations: rdson_maximum_1, rdson_maximum_2. |
| `wuxi-nce-power/NCE40P05Y` | inherited-batch-5-order-103-through-160 | F1 | pmos | `NCE40P05Y` | Promote F1 | Added passing unchanged-model hard-bound expectations: rdson_maximum_1. |

## Promoted validation

- Package validators: 97 of 97 passed.
- Native ngspice-46 benches and pinned WASM comparisons: 293 of 293 passed.
- Promoted expectations: 298 of 298 passed.
- Worst native/WASM relative delta: `0.00044408920985006256`.
- Worst native/WASM absolute delta: `3.1004951384083768e-09`.
- All 293 promoted benches contain an explicit `.temp 25`.

## Final verification commands and results

- `npm test --workspace=@opencircuit/model-library`
  - PASS: 1 test passed; component-schema validated all 622 model packages.
- `npm test`
  - PASS: all workspace test suites completed with 0 failures, including model-library validation of all 622 packages.
- `npm test --prefix tools/model-factory`
  - PASS: 45 tests passed, 0 failed.
- `npm test --prefix tools/conveyor`
  - PASS: 16 tests passed, 0 failed.
- `npm run typecheck --prefix tools/conveyor`
  - PASS: Python compileall completed with no error.
- `npm run typecheck`
  - PASS: all 6 workspace typechecks completed with no error.
- `independent stageValidate pass over promoted package directories`
  - PASS: 97 of 97 validators, 293 of 293 native ngspice-46/WASM benches, and 298 of 298 expectations passed.
- `explicit .temp 25 audit over promoted tests/*.cir`
  - PASS: 293 of 293 promoted benches contain an explicit `.temp 25`.
- `normalized canonical, alias, and complete family-vector collision audit`
  - PASS: 0 promotion-introduced identity or vector collisions; 2 candidates rejected for canonical identity collisions.
- `promoted model and fitted-vector immutability audit`
  - PASS: all 97 promoted `model.cir` and `fitted.json` files are byte-identical to their staged source copies.
- `promotion-state, vendor SPICE, and absolute staging/scratch reference audit`
  - PASS: 0 unresolved promotion-state markers, 0 vendor SPICE claims, and 0 absolute staging or scratch references in promoted packages.
- `whole-staging aggregate SHA-256 recomputation`
  - PASS: 2,101 files reproduced `69c6c80a7da710550f45d4a83d12129d30f3e0318fe459ccee176298b80da706`.
- `tracked prohibited-data and archive audit`
  - PASS: 0 tracked PDFs, archives, vendor model packs, SQLite databases, extraction responses, or staging files were added.
- `git diff --cached --check`
  - PASS: no whitespace errors.

## Deviations

- None. Staging originals, electrical parameters, fit gates, fitters, conveyor implementation, and model-factory implementation were not modified.
- No push, deploy, publish, GitHub comment, or Vault update was performed.
