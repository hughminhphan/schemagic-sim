# P4 independent review log

## 2026-08-07: batch B2-bjt-small2

Reviewer: `sol independent reviewer (batch B2-bjt-small2)`

All six parts fail review because the author lane produced no package artifacts. The factory resolution claim reproduces exactly: each MPN returns `Unsupported MPN`, and the registry lists only `1N4148, WP7113ID, 2N3904, IRLZ44N, TL072` as supported.

| MPN | Verdict | Package files | Benches | Validator result | Decisive evidence |
| --- | --- | ---: | ---: | --- | --- |
| 2N5551 | FAIL | 0 | 0 | FAIL, 7 missing-package errors | No `component.json`, model, source record, validation result, or supported region exists. |
| MPSA42 | FAIL | 0 | 0 | FAIL, 7 missing-package errors | No `component.json`, model, source record, validation result, or supported region exists. |
| MMBT3904 | FAIL | 0 | 0 | FAIL, 7 missing-package errors | No `component.json`, model, source record, validation result, or supported region exists. |
| MMBT3906 | FAIL | 0 | 0 | FAIL, 7 missing-package errors | No `component.json`, model, source record, validation result, or supported region exists. |
| SS8050 | FAIL | 0 | 0 | FAIL, 7 missing-package errors | No `component.json`, model, source record, validation result, or supported region exists. |
| BC846B | FAIL | 0 | 0 | FAIL, 7 missing-package errors | No `component.json`, model, source record, validation result, or supported region exists. |

`validate-package.mjs` was run independently for every target. Each run reports the same seven blockers: missing `component.json`, `model.cir`, `sources.json`, `MODEL_CARD.md`, `LICENSE`, `tests/expectations.json`, and `tests/` directory. Required-file inventory is 0 of 8 for every part, including 0 `validation-results.json` files, so there are no recorded numbers to reproduce.

Native ngspice-46 is installed. The model library contains 0 target benches for every part. Two `compare.mjs` attempts per part therefore terminate with `ENOENT` before simulation, and 0 of the required 2 benches per part can run. There is also no model or declared supported operating region, so 0 operating-point probes can be constructed inside a claimed region.

Provenance cannot pass: every target has 0 `sources.json` records and 0 factual page references, leaving no cited source to fetch and no material facts to confirm. The target package scan finds 0 PDFs and 0 vendor SPICE files, but that vacuous result does not compensate for the absent packages. Fidelity cannot be assessed or labeled F2 because there are 0 expectations, 0 fit metrics, 0 known-omission records, and 0 archetype-threshold results.

No reviewer field was changed because no target has a `component.json`; all failures remain unstamped.

## 2026-08-07: batch X1-misc

Reviewer: `sol independent reviewer (batch X1-misc)`

All three F1 packages pass independent review. `validate-package.mjs` passed before stamping, and passed again after the reviewer fields were updated.

| MPN | Verdict | Independent bench reproduction | Out-of-bench in-region probe | Fidelity and provenance |
| --- | --- | --- | --- | --- |
| PC817 | PASS | `forward.cir`: 1.2079117338313525 V and native/WASM relative delta 8.830962165392644e-12. `junction_capacitance.cir`: 2.996076469295636e-11 F. Both exactly reproduce `validation-results.json`. | 2.5 mA at 25 degC produced 1.179429 V, below the validated 5 mA point and physically monotonic. | Honest F1 input-IRED-only scope with one-point-fit and omitted-output limitations stated. |
| 4N35 | PASS | `forward.cir`: 1.3079123206317036 V and native/WASM relative delta 5.531454367042839e-12. `reverse_leakage.cir`: 6.000152167961492e-12 A. Both exactly reproduce `validation-results.json`. | 5 mA at 25 degC produced 1.279418 V, below the validated 10 mA point and physically monotonic. | Honest F1 input-LED-only scope with one-point-fit and omitted-output limitations stated. |
| LL4148 | PASS | `forward_02.cir`: 0.5023013479369861 V. `reverse_recovery.cir`: 1.4250000000000111e-9 s, with worst selected-bench native/WASM absolute delta 3.0109248427834245e-13. Both exactly reproduce `validation-results.json`. | 5 mA at 25 degC produced 0.6699553 V, between the validated 1 mA and 10 mA forward points. | Honest F1 alias-family fit. The missing LL4148-specific source, SOD-80 parasitic omission, and 0.8959012489455156% worst fitted residual are recorded. |

The Sharp PC817 datasheet was independently fetched from the cited URL. Its SHA-256 reproduced as `7cfdb59e0f75bb9c92581f95e55cdb02a377aa6e4a33a45371ae4d3c71935c1f`. Page 4 confirms typical forward voltage 1.2 V at 5 mA and maximum reverse current 10 uA at 4 V; it also confirms typical terminal capacitance 30 pF at 0 V and 1 kHz. Every `sources.json` record in the batch contains URL, revision, SHA-256, access date, and page references. A package scan found no PDF, vendor SPICE card, or vendor SPICE source file in any reviewed package.

Recorded fitting residuals are consistent with each `fitted.json`: 0 for the PC817 and 4N35 closed-form calibration points, and 0.008959012489455156 for LL4148. The nonzero PC817 and 4N35 validation deviations are reproduced and remain within their F1 expectation thresholds; their TNOM and temperature-scaling limitations are explicitly listed in `known_omissions`.

## 2026-08-07: batch B1-bjt-small

Reviewer: `sol independent reviewer (batch B1-bjt-small)`

All six packages fail fidelity review. Package-schema validation passed for every package, and all 36 benches independently passed native ngspice versus WASM comparison. Recomputed expectation values and global engine deltas exactly reproduce every number in `validation-results.json`, but the recorded checks do not establish honest claimed-region fidelity for these packages.

| MPN | Verdict | Decisive independent evidence |
| --- | --- | --- |
| 2N3906 | FAIL | Native hFE is 83.27322786937394 against 110 at 0.1 mA. Its log residual is 0.27835326240294256, above the BJT convergence limit of 0.223. The F2 gain citation says p. 7 fig. 13 and saturation says p. 8 fig. 2, but Figure 13 and the relevant on-voltage Figure 15 are on p. 6. PDF pages 7 and 8 are the TO-92 mechanical outline, and `sources.json` omits p. 6. |
| PN2222A | FAIL | At the published 0.5 A, 50 mA base-current saturation point, native VBE(sat) is 1.418342187637947 V against the datasheet maximum 1.05 V, an excess of 0.368342187637947 V or 35.080208%. The only accepted scalar check is a tautological 5 V collector-source value, and `known_omissions` does not disclose the maximum-voltage violation. |
| BC547B | FAIL | At the claimed 0.1 mA lower boundary, native hFE is 510.0681451176217 against the cited typical 100, a 410.068145% error. DC coverage remains labeled `fitted`, but all material gain and saturation checks were withheld and the only accepted scalar check is collector voltage. |
| BC557B | FAIL | At the claimed 0.1 mA lower boundary, native hFE is 493.83691741385553 against the cited typical 100, a 393.836917% error. DC coverage remains labeled `fitted`, with no accepted material gain or saturation check and no omission disclosing this magnitude of low-current error. |
| BC337-40 | FAIL | At 0.5 A and 50 mA base current, native VBE(sat) is 1.5531226951383639 V against 0.86 V, an 80.595662% error. `facts.json` also admits a complementary-family curve proxy, and the shipped NPN model has the same 20 numeric model parameters as BC327-40 apart from polarity, contrary to the no-borrowed-parameters contract. |
| BC327-40 | FAIL | At 0.5 A and 50 mA base current, native VBE(sat) is 1.5531226951381565 V against 0.86 V, an 80.595662% error. This material supported-boundary saturation error is recorded in fit tables but not reflected in `known_omissions`; the only accepted scalar check is collector voltage. |

The cited 2N3906 PDF was independently fetched. Its SHA-256 exactly matches `103dbe9825c9aac50352bbe2d3cde611f6b9ae76967ca55548fccd5c6afdfc39`; p. 2 confirms fT = 250 MHz and Cobo = 4.5 pF at the recorded conditions. Every batch source record has a URL, revision, SHA-256, and page reference. No PDF, vendor model file, or vendor SPICE text is present in any package.

Independent operating points outside the authored benches were numerically sane and produced no additional blocker: 2N3906 at 4.7251836 mA gave hFE 189.007 and VBE 0.690922 V; PN2222A at 47.514492 mA gave hFE 95.028 and VBE 0.731137 V; BC547B at 56.307724 mA gave hFE 225.231 and VBE 0.748523 V; BC557B at 56.083342 mA gave hFE 224.333 and VBE 0.757864 V; BC337-40 and BC327-40 at 203.590138 mA each gave hFE 339.317 and VBE 0.757193 V.

All reviewer fields remain `pending-review`; no component validation date was changed.

## 2026-08-07: batch B3-bjt-power

Reviewer: `sol independent reviewer (batch B3-bjt-power)`

All five parts fail review because the author lane produced no package artifacts. The factory resolution claim reproduces exactly: every MPN returns `Unsupported MPN`. The current registry lists `1N4148, WP7113ID, 2N3904, IRLZ44N, TL072, MPSA42, SS8050, BC846B, MMBT3906, MMBT3904` as supported, with none of the five review targets present.

| MPN | Verdict | Package files | Benches reproduced | Validator result | Decisive evidence |
| --- | --- | ---: | ---: | --- | --- |
| TIP31C | FAIL | 0 of 8 | 0 of 2 | FAIL, 7 missing-package errors | No `component.json`, model, source record, validation result, or supported region exists. |
| TIP32C | FAIL | 0 of 8 | 0 of 2 | FAIL, 7 missing-package errors | No `component.json`, model, source record, validation result, or supported region exists. |
| TIP120 | FAIL | 0 of 8 | 0 of 2 | FAIL, 7 missing-package errors | No `component.json`, model, source record, validation result, or supported region exists. |
| TIP125 | FAIL | 0 of 8 | 0 of 2 | FAIL, 7 missing-package errors | No `component.json`, model, source record, validation result, or supported region exists. |
| BF256B | FAIL | 0 of 8 | 0 of 2 | FAIL, 7 missing-package errors | No `component.json`, model, source record, validation result, or supported region exists. |

`validate-package.mjs` was run independently for every target. Each run reports the same seven blockers: missing `component.json`, `model.cir`, `sources.json`, `MODEL_CARD.md`, `LICENSE`, `tests/expectations.json`, and `tests/` directory. Required-file inventory is 0 of 8 for every part, including 0 `validation-results.json` files, so there are 0 stored validation numbers to reproduce.

Native comparison attempts were made twice per part. `dc_gain.cir` and `saturation.cir` were attempted for TIP31C, TIP32C, TIP120, and TIP125; `idss.cir` and `transfer_curve.cir` were attempted for BF256B. All 10 `compare.mjs` runs terminate with `ENOENT` before simulation because the bench files do not exist. Thus 0 of 2 required benches reproduce for each part. There is also no model or declared supported operating region, so 0 outside-bench operating-point probes can be constructed inside a claimed region.

Provenance cannot pass: every target has 0 `sources.json` records and 0 factual page references, leaving no cited source to fetch and 0 material facts to confirm. Fidelity cannot be assessed or labeled F2 because there are 0 expectations, 0 fit metrics, 0 known-omission records, and 0 archetype-threshold results.

No reviewer field or validation date was changed because no target has a `component.json`; all failures remain unstamped.

## 2026-08-07: batch M1-mosfet-small

Reviewer: `luna independent reviewer (batch M1-mosfet-small)`

All five F1 packages pass independent review. `validate-package.mjs` passed before stamping and passed again after reviewer fields were updated. The selected native ngspice benches passed native/WASM comparison for every part, and every selected expectation value reproduced exactly from a fresh native run.

| MPN | Verdict | Independent bench reproduction | Out-of-bench in-region probe | Fidelity and provenance |
| --- | --- | --- | --- | --- |
| 2N7000 | PASS | `rdson.cir`: 4.415238028752658 ohm and 5.7701576880814835 ohm; `boundary.cir`: 5.7701576880814835 ohm. All exact; native/WASM compare PASS. | 0.1 A at VGS = 7 V produced VDS = 0.47497191943742406 V. | Honest F1 guaranteed-bound-only model; worst fitting error 0. Datasheet source record has full metadata and no embedded PDF or vendor model file. |
| BS250P | PASS | `rdson.cir`: 11.903167682221948 ohm; `boundary.cir`: 11.903167682221948 ohm. Both exact; native/WASM compare PASS. | 1 A at VGS = -10 V produced VDS = -13.24460447585196 V. | Honest F1 table-only model; worst fitting error 0. Datasheet source record has full metadata and no embedded PDF or vendor model file. |
| AO3400A | PASS | `rdson.cir`: 0.01779207094117625, 0.01930737716713231, and 0.023879210526790793 ohm; `boundary.cir`: 0.0238792104596203 ohm. All exact; native/WASM compare PASS. | 2 A at VGS = 3.3 V produced VDS = 0.041603776390179543 V. | Honest F1 typical-RDS(on)-table fit; worst fitting error 1.617774563754667%, and parser disagreement plus unclaimed curve-family scope are disclosed in `known_omissions`. |
| AO3401A | PASS | `rdson.cir`: 0.0410000011494544, 0.046999998198177476, and 0.060000000670682764 ohm; `boundary.cir`: 0.060000000670682764 ohm. All exact; native/WASM compare PASS. | 1.5 A at VGS = -3.3 V produced VDS = -0.0776536926141915 V. | Honest F1 typical-RDS(on)-table fit; worst fitting error 0.000003833325884849025%. Curve-family and approximate capacitance limitations are disclosed. |
| SI2302 | PASS | `rdson.cir`: 0.03875000117058375 and 0.0559999985714801 ohm; `boundary.cir`: 0.0559999985714801 ohm. All exact; native/WASM compare PASS. | 1.5 A at VGS = 3.3 V produced VDS = 0.06790318846823837 V. | Honest F1 typical-RDS(on)-table fit; worst fitting error 0.0000033955849397680914%. Curve-family and capacitance limitations are disclosed. |

The onsemi 2N7000 PDF was independently fetched from its cited URL. SHA-256 reproduced as `b9cfecc7be11b19ac817e3160d6c862494f28cae0bdc3e826ab83ab15749c228`. Extracted p. 1 identifies the part as 60 V and shows the 5 ohm RDS(on) headline; p. 2 lists IDSS and Ciss = 60 pF maximum. Every batch `sources.json` record contains URL, revision, SHA-256, access date, and page references. A package scan found no PDF, `.sp`, `.lib`, or `.mod` vendor model files.

All reviewer fields were stamped with the batch reviewer identity and validation date. No model, test, fact, source, or stored validation result was edited.

## 2026-08-07: batch J1-jfets

Reviewer: `luna independent reviewer (batch J1-jfets)`

Three packages pass independent review. BF256B fails because no package exists, so it remains unstamped.

| MPN | Verdict | Independent validation and native bench reproduction | Out-of-bench in-region probe | Fidelity and provenance |
| --- | --- | --- | --- | --- |
| MMBF5457 | PASS | `validate-package.mjs`: PASS. Native `idss.cir` reproduced ID 0.0030004710715729743 A and `transfer_curve.cir` reproduced 0.0030004710715729743, 0.0015494778635911644, 0.0005801179504487664, and 0.00007999801891855896 A. Native/WASM compare passed; selected transfer bench worst relative delta 1.878299e-8, matching `validation-results.json`. | At VDS=7.5 V, VGS=-0.75 V, 25 degC, native ID was 0.000980238 A and GM 0.00188925 S. The point is inside the declared 0 to 15 V and 0 to -1.8 V region and outside authored benches. | Honest F2. Datasheet-cited typical and hard-bound expectations pass, with 0.03367741935483736% worst fit error and material model limitations disclosed. Cited PDF SHA-256 reproduced as `f1f2e1ce3d56dce28ce664c1f2a1f8da149d5321ccbe92eda8cd609e46964713`; p.2 confirms IDSS 1.0/3.0/5.0 mA and Ciss 4.5 pF at the recorded conditions. No PDF or vendor SPICE source file is present. |
| MMBFJ201 | PASS | `validate-package.mjs`: PASS. Native `idss.cir` reproduced ID 0.00047620621626265347 A and `transfer_curve.cir` reproduced 0.00047620621626265347, 0.0002774671302177012, 0.00012655116734094918, and 0.00003142881905660033 A. Native/WASM comparison passed and the recorded selected-bench values and deltas reproduce. | At VDS=10 V, VGS=-0.3 V, 25 degC, native ID was 0.000169213 A and GM 0.000654443 S. The point is inside the declared 0 to 20 V and 0 to -0.8 V region and outside authored benches. | Honest F1 typical-curve approximation. The 15.632533333333335% worst fit error is recorded in the model card and the typical-versus-guaranteed limitation is disclosed in `known_omissions`. Source metadata includes URL, revision, SHA-256, access date, and pages. No PDF or vendor SPICE source file is present. |
| J113 | PASS | `validate-package.mjs`: PASS. Native `idss.cir` reproduced ID 0.014766685196771583 A and `transfer_curve.cir` reproduced 0.014766685196771583, 0.008861357346191704, 0.004142866346504413, and 0.000990852412100943 A. Native/WASM comparison passed and the recorded selected-bench values and deltas reproduce. | At VDS=7.5 V, VGS=-0.75 V, 25 degC, native ID was 0.00608687 A and GM 0.011873 S. The point is inside the declared 0 to 15 V and 0 to -1.5 V region and outside authored benches. | Honest F1 typical-curve approximation. The 3.57165% worst fit error and omitted capacitance and temperature behaviour are disclosed. Source metadata includes URL, revision, SHA-256, access date, and pages. No PDF or vendor SPICE source file is present. |
| BF256B | FAIL | `validate-package.mjs`: FAIL with all seven package blockers: missing `component.json`, `model.cir`, `sources.json`, `MODEL_CARD.md`, `LICENSE`, `tests/expectations.json`, and `tests/` directory. Two required native bench attempts for `tests/idss.cir` and `tests/transfer_curve.cir` both terminate with `ENOENT`, so no recorded validation numbers can reproduce. | No model or supported operating region exists, so no in-region operating-point probe is possible. | No provenance record, cited source, facts, fidelity label, or package files exist. No reviewer field was changed. |

All three passing reviewer fields were stamped with the batch reviewer identity. Their `validation_date` fields were already the review date and remain unchanged. No model, test, fact, source, or stored validation result was edited.

## 2026-08-07: batch B2R-bjt-small2

Reviewer: `sol independent reviewer (batch B2R-bjt-small2)`

One of six packages passes independent review. Package-schema validation passed for all six before review. Twelve selected benches, `dc_gain.cir` and `saturation.cir` for every part, passed native ngspice-46 versus WASM comparison. All 44 selected stored check values reproduced exactly with maximum absolute difference 0. Five packages remain `pending-review` because their evidence or F2 citations do not describe the shipped model.

| MPN | Verdict | Independent evidence |
| --- | --- | --- |
| 2N5551 | FAIL | The shipped `.model` differs from `fitted.json` and the model-card table in 11 of 20 recorded parameters. For example, shipped BF is 476.44306076 versus 222.16843063508657 recorded, and shipped CJE is 9.4689118679e-12 F versus 1.1836139834867325e-15 F recorded. Its full 20-parameter shipped card is numerically identical to MMBT3904, while the fresh gain checks are 161.45585311244955 and 65.13628593296464 versus fitted metadata values 15.84066592912747 and 15.153578217764863. The claimed 80.19916758859067% worst fit therefore does not characterize the shipped model. |
| MPSA42 | FAIL | The shipped model and validation benches use BF = 60, but `fitted.json` and `MODEL_CARD.md` record BF = 31.290051616126235. All other 19 recorded parameters match. Fresh native hFE is 65.53495115238114, 65.31371195078053, and 64.84198744556646, while the fitted evidence records 34.19197950804834, 34.12443005613548, and 33.990722957026684. The 36.767918032193364% fit claim is stale relative to the shipped card. |
| MMBT3904 | FAIL | The F2 numerical checks reproduce, but their required datasheet citations are wrong. The fetched nine-page onsemi PDF places Figure 15 on PDF/page footer 5 and Figure 17 on PDF/page footer 6. `facts.json`, `fitted.json`, and `tests/expectations.json` cite both as p. 7, and `sources.json` references p. 7 and p. 8 instead of the actual figure pages. The F2 expectations therefore lack accurate datasheet citations at the archetype thresholds. |
| MMBT3906 | FAIL | The shipped model differs from `fitted.json` and the model-card table in 10 of 20 recorded parameters. Shipped BF is 1999.9999986 versus 217.6573191599617 recorded, and shipped RE is 0.00010000005986 ohm versus 1.1748500370235004 ohm recorded. Fresh native hFE at 0.1 mA is 543.3532619346325, while fitted evidence records 1.9985183945211722. The 235.84335941267685% worst-fit claim does not characterize the shipped model. |
| SS8050 | PASS | Shipped model, `fitted.json`, and model-card parameters agree. Fresh native hFE values 51.177356061552004, 89.65797539588345, and 40.426308159459836 satisfy the cited hard minima 45, 85, and 40. Fresh saturation values 0.49939911596515657 V and 1.3417767131596126 V reproduce exactly, and the honest F1 cap records the single-condition and typical-curve limitations. |
| BC846B | FAIL | The shipped model differs from `fitted.json` and the model-card table in 11 of 20 recorded parameters. Shipped IS is 2.0666495739e-14 A versus 9.978183173928958e-11 A recorded, and shipped RC is 2.7191520669 ohm versus 0.0002287554448062291 ohm recorded. Its full 20-parameter shipped card is numerically identical to MMBT3904. Fresh native hFE at 10 uA is 20.663970610008985, while fitted evidence records 553.5291074920679. The 12888.824683472418% fit claim does not characterize the shipped model. |

Independent in-region operating-point probes outside the authored benches were numerically sane: 2N5551 at VCE = 10 V and IB = 0.15 mA produced IC = 0.024249433888713846 A, hFE = 161.66289259142565, and VBE = 0.7398445348821729 V; MPSA42 at 50 V and 0.2 mA produced 0.017859157042746144 A, 89.29578521373071, and 0.8300062408116093 V; MMBT3904 at 5 V and 0.2 mA produced 0.028495115813538162 A, 142.4755790676908, and 0.7484493481510462 V; MMBT3906 at -5 V and -0.1 mA produced magnitude 0.03235576724090784 A, hFE 323.5576724090784, and VBE -0.7359604751853099 V; SS8050 at 5 V and 5 mA produced 0.34600393068217317 A, 69.20078613643463, and 0.8985155371397354 V; BC846B at 5 V and 0.2 mA produced 0.028495115813538162 A, 142.4755790676908, and 0.7484493481510462 V.

The official onsemi MMBT3904 PDF was fetched once for the batch. Its SHA-256 reproduced exactly as `8c3a7966cfbd09066d906c4e0e3dfedb7e13abb9dc2cb34c600d1f05736bbdb4`. Page 2 confirms fT = 300 MHz minimum at IC = 10 mA, VCE = 20 V, f = 100 MHz, and Cobo = 4.0 pF maximum at VCB = 5 V, IE = 0, f = 1 MHz. Every batch source record contains URL, revision, SHA-256, access date, and page references. No PDF or vendor `.sp`, `.lib`, or `.mod` file is embedded in any reviewed package.

Only SS8050 was stamped with the batch reviewer identity and date. Its now-false pending-review omission was removed. The other five reviewer fields remain `pending-review`. No model, test, fact, source, fitted evidence, or stored validation result was edited.
