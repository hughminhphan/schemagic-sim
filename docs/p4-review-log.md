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
