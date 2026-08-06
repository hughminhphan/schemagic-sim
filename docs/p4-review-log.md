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
