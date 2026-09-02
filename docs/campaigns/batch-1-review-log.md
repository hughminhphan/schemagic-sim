# Batch 1 scale-campaign independent review log

Date: 2026-08-10

Reviewer: `gpt-5.6-sol independent reviewer (batch-1 scale campaign)`

Branch: `main`

Scope: exactly 82 packages, comprising 31 staged outcomes selected from `docs/campaigns/batch-1-regeneration.json` and all 51 packages in the fresh batch-1 tranche. This was one bounded independent review pass. Staging evidence remained unchanged. No model was refitted and no fitter or conveyor source was changed.

## Final verdict

| Electrical family | Reviewed | Promoted F2 | Promoted F1 | Demoted | Rejected |
| --- | ---: | ---: | ---: | ---: | ---: |
| Diode | 36 | 10 | 26 | 0 | 0 |
| NMOS | 22 | 0 | 21 | 0 | 1 |
| PMOS | 15 | 0 | 15 | 0 | 0 |
| BJT NPN | 5 | 1 | 3 | 0 | 1 |
| BJT PNP | 4 | 2 | 0 | 0 | 2 |
| **Total** | **82** | **13** | **65** | **0** | **4** |

Final reviewed-library count: **212 packages**, up from 134.

## Independent review method

1. Reconstructed the exact candidate set from machine-readable campaign records and confirmed 82 unique package paths.
2. Read every package contract, source record, bench, expectation record, fitted vector, and cached primary PDF. Source review used the PDFs themselves, including direct page text and targeted rendered-page inspection for figure semantics, rather than relying on extraction JSON or execution summaries.
3. Reproduced all 82 recorded PDF SHA-256 values and verified every cited page reference is in range.
4. Independently validated all 82 staged packages, reran all 218 staged benches through native ngspice-46 and `eecircuit-engine@1.7.0`, and independently evaluated all 321 staged checks. All declared staged checks passed, but declaration honesty was adjudicated separately.
5. Recomputed all 13 F2 residual summaries against the unchanged fit gates and checked optimizer-bound saturation, units, polarity, temperature, bias, figure, table, and sign semantics.
6. Indexed canonical MPNs and ordering aliases across the prior 134-package library and all candidates. Compared complete numeric vectors and required explicit shared-die evidence for duplicates.
7. Applied only evidence-backed metadata and expectation corrections in promoted copies. Staging originals were not edited. No electrical parameter was changed.

## Source provenance and identity

- Cached primary PDF hash reproduction: 82 of 82 matched.
- Cited page-range validation: 82 of 82 passed.
- Automatic exact-text identity detection: 79 of 82. The three family or ordering-code cases were resolved manually from the primary PDFs:
  - `S1M-13-F`: the PDF identifies the `S1A/B - S1M/B` family and defines ordering code `S1x-13-F`, where `x` is the device type. Alias `S1M` was recorded.
  - `PMEG4010ESBYL`: the PDF type number is `PMEG4010ESB`; alias `PMEG4010ESB` was recorded for the distributor ordering code.
  - `SS36-E3/57T`: the PDF identifies the `SS32` through `SS36` family and defines the base-P/N `-E3` ordering convention plus `57T` reel code. Alias `SS36` was recorded.
- Vendor SPICE evidence used: none.

## Fresh execution evidence

- Staged population: 82 of 82 schema passes, 218 of 218 native-versus-WASM bench passes, and 321 of 321 declared expectation passes.
- Promoted population after reviewer corrections: 78 of 78 schema passes, 208 of 208 native-versus-WASM bench passes, and 348 of 348 expectation passes.
- Every relevant bench explicitly contains `.temp 25`.

## F2 adjudication

All 13 F2 claims were retained. Each has multiple cited 25 degC typical targets, residuals within the unchanged family gates, applicable hard-bound coverage, fresh native-versus-WASM agreement, no undeclared optimizer-bound saturation, and explicit DC-only limits.

| MPN | Family | Points | Worst relative error | RMS relative error | Verdict |
| --- | --- | ---: | ---: | ---: | --- |
| `1N4148WS-7-F` | Diode | 5 | 0.011335 | 0.007488 | Promote F2 |
| `S1M-13-F` | Diode | 11 | 0.026142 | 0.014996 | Promote F2 |
| `BAS316` | Diode | 5 | 0.028627 | 0.015342 | Promote F2 |
| `BAS321` | Diode | 7 | 0.006758 | 0.005776 | Promote F2 |
| `BAT54L` | Diode | 5 | 0.025255 | 0.013193 | Promote F2 |
| `BAV70` | Diode | 7 | 0.014019 | 0.008553 | Promote F2 |
| `BAT54SLT1G` | Diode | 4 | 0.010340 | 0.006872 | Promote F2 |
| `BAV70LT1G` | Diode | 5 | 0.012747 | 0.008752 | Promote F2 |
| `MMBD7000LT1G` | Diode | 5 | 0.021631 | 0.012890 | Promote F2 |
| `SS36-E3/57T` | Diode | 7 | 0.018428 | 0.009059 | Promote F2 |
| `MMBT5401` | BJT PNP | 6 | 0.128600 | 0.080345 | Promote F2 |
| `MMBT5551` | BJT NPN | 5 | 0.183089 | 0.111429 | Promote F2 |
| `MMBTA92` | BJT PNP | 7 | 0.133774 | 0.076656 | Promote F2 |

The three fresh BJT F2 records (`MMBT5401`, `MMBT5551`, and `MMBTA92`) falsely said no VBE(on) curve existed. Their primary PDFs do contain VBE curves. The promoted copies now state the honest basis: IS is held because the fit used only the cited 25 degC current-gain curve, which does not independently constrain IS. Their supported scope and model cards now exclude VBE transfer, output-curve, and saturation-curve fitting. Tabulated saturation maxima remain hard-bound checks. No parameter was refitted.

## F1 maximum and unit semantics

- Eighteen promoted MOSFET packages had cited typical RDS(on) checks at bias points where the primary table also published maxima. Added 39 inclusive maximum hard-bound checks. Every added check passed without changing a model vector.
- `BAV99LT1G` had one `mAdc` conversion defect. The staged bench used 142.5 A for a 142.5 mA point. The promoted copy uses 0.1425 A, narrows the supported region accordingly, and passes at 0.628409 V against the 1.25 V maximum.
- `BSS138LT1G` was not repairable as metadata. The source value 3.5 ohm is a maximum, not a typical value, and fresh native ngspice measures 5.06877 ohm at the cited bias. It was rejected because compliance requires parameter refitting.

## Collision and duplicate-vector adjudication

- Candidate canonical identity collision: two packages claim `S8050`. The MDD Microdiode package was retained; the hongjiacheng package was rejected.
- Reviewed-library vector duplicate: `hongjiacheng/S8550` duplicates `nexperia/PBSS4160T` and has no shared-die evidence. Rejected.
- Candidate vector duplicate: `hongjiacheng/SS8550` duplicates `hongjiacheng/S9013` and has no shared-die evidence. `S9013` was retained as the earlier canonical candidate in the fixed review order; `SS8550` was rejected.
- No promoted package introduces a new canonical or alias collision with the prior reviewed library. No promoted complete numeric vector duplicates another reviewed package.

## Rejections by reason class

| MPN | Claimed tier | Family | Reason class | Decision evidence |
| --- | --- | --- | --- | --- |
| `BSS138LT1G` | F1 | NMOS | published-maximum-semantics-and-failure | The primary PDF publishes 3.5 ohm as a maximum at VGS = 5 V and ID = 0.2 A, but the staged expectation treated it as a typical scalar target with 50% tolerance. Fresh native ngspice measured 5.06877 ohm, above the 3.5 ohm maximum. Repair would require parameter refitting. |
| `S8050` | F1 | BJT NPN | candidate-identity-collision | Canonical MPN S8050 collides with the separate MDD Microdiode S8050 candidate. Both packages passed execution checks, but the reviewed library cannot accept both identities. The MDD package was retained because its manufacturer-specific Rev:2024A2 primary PDF and four-page evidence record are stronger than the hongjiacheng Rev:1.1 record. |
| `S8550` | F1 | BJT PNP | reviewed-library-vector-duplicate | Its complete fitted numeric vector duplicates reviewed nexperia/PBSS4160T. No shared-die inheritance evidence is present. |
| `SS8550` | F1 | BJT PNP | candidate-vector-duplicate | Its complete fitted numeric vector duplicates candidate hongjiacheng/S9013. No shared-die inheritance evidence is present. S9013 was retained as the earlier canonical candidate in the independently fixed review order. |

Demotions: **0**.

## Package-by-package disposition

| Tranche | Manufacturer | Canonical MPN | Tier | Family | Verdict | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| recycled | Diodes Incorporated | `1N4148WS-7-F` | F2 | Diode | Promote F2 | No electrical correction |
| recycled | Diodes Incorporated | `1N5819HW-7-F` | F1 | Diode | Promote F1 | No electrical correction |
| recycled | Diodes Incorporated | `2N7002-7-F` | F1 | NMOS | Promote F1 | No electrical correction |
| recycled | Diodes Incorporated | `2N7002DW-7-F` | F1 | NMOS | Promote F1 | No electrical correction |
| recycled | Diodes Incorporated | `2N7002K-7` | F1 | NMOS | Promote F1 | +2 max bounds |
| recycled | Diodes Incorporated | `BSS84-7-F` | F1 | PMOS | Promote F1 | +1 max bounds |
| recycled | Diodes Incorporated | `DMP2035U-7` | F1 | PMOS | Promote F1 | +3 max bounds |
| recycled | Diodes Incorporated | `DMP3098L-7` | F1 | PMOS | Promote F1 | No electrical correction |
| recycled | Diodes Incorporated | `S1M-13-F` | F2 | Diode | Promote F2 | alias S1M |
| recycled | Nexperia | `2N7002` | F1 | NMOS | Promote F1 | No electrical correction |
| recycled | Nexperia | `BAS316` | F2 | Diode | Promote F2 | No electrical correction |
| recycled | Nexperia | `BAS321` | F2 | Diode | Promote F2 | No electrical correction |
| recycled | Nexperia | `BAT54C` | F1 | Diode | Promote F1 | No electrical correction |
| recycled | Nexperia | `BAT54L` | F2 | Diode | Promote F2 | No electrical correction |
| recycled | Nexperia | `BAV70` | F2 | Diode | Promote F2 | No electrical correction |
| recycled | Nexperia | `BSS84AKM` | F1 | PMOS | Promote F1 | +2 max bounds |
| recycled | Nexperia | `PMEG4010ESBYL` | F1 | Diode | Promote F1 | alias PMEG4010ESB |
| recycled | onsemi | `2N7002KT1G` | F1 | NMOS | Promote F1 | +2 max bounds |
| recycled | onsemi | `2N7002LT1G` | F1 | NMOS | Promote F1 | No electrical correction |
| recycled | onsemi | `BAT54SLT1G` | F2 | Diode | Promote F2 | No electrical correction |
| recycled | onsemi | `BAV70LT1G` | F2 | Diode | Promote F2 | No electrical correction |
| recycled | onsemi | `BAV99LT1G` | F1 | Diode | Promote F1 | mAdc correction |
| recycled | onsemi | `BSS123LT1G` | F1 | NMOS | Promote F1 | No electrical correction |
| recycled | onsemi | `BSS138LT1G` | F1 | NMOS | Reject | published-maximum-semantics-and-failure |
| recycled | onsemi | `FDV301N` | F1 | NMOS | Promote F1 | No electrical correction |
| recycled | onsemi | `MMBD7000LT1G` | F2 | Diode | Promote F2 | No electrical correction |
| recycled | STMicroelectronics | `STL90N10F7` | F1 | NMOS | Promote F1 | +1 max bounds |
| recycled | Vishay Intertech | `2N7002K-T1-GE3` | F1 | NMOS | Promote F1 | No electrical correction |
| recycled | Vishay Intertech | `LL4148-GS08` | F1 | Diode | Promote F1 | No electrical correction |
| recycled | Vishay Intertech | `SI2301CDS-T1-GE3` | F1 | PMOS | Promote F1 | +2 max bounds |
| recycled | Vishay Intertech | `SS36-E3/57T` | F2 | Diode | Promote F2 | alias SS36 |
| fresh | hongjiacheng | `1N4007W` | F1 | Diode | Promote F1 | No electrical correction |
| fresh | hongjiacheng | `1N4148WT` | F1 | Diode | Promote F1 | No electrical correction |
| fresh | hongjiacheng | `2N7002K` | F1 | NMOS | Promote F1 | No electrical correction |
| fresh | hongjiacheng | `2N7002W` | F1 | NMOS | Promote F1 | No electrical correction |
| fresh | hongjiacheng | `2SK3018W` | F1 | NMOS | Promote F1 | No electrical correction |
| fresh | hongjiacheng | `B5817WS` | F1 | Diode | Promote F1 | No electrical correction |
| fresh | hongjiacheng | `B5819WS` | F1 | Diode | Promote F1 | No electrical correction |
| fresh | hongjiacheng | `BAT60B` | F1 | Diode | Promote F1 | No electrical correction |
| fresh | hongjiacheng | `BAV21WS` | F1 | Diode | Promote F1 | No electrical correction |
| fresh | hongjiacheng | `BSS138` | F1 | NMOS | Promote F1 | No electrical correction |
| fresh | hongjiacheng | `BSS138W` | F1 | NMOS | Promote F1 | No electrical correction |
| fresh | hongjiacheng | `BZT52B5V1` | F1 | Diode | Promote F1 | No electrical correction |
| fresh | hongjiacheng | `BZT52C12` | F1 | Diode | Promote F1 | No electrical correction |
| fresh | hongjiacheng | `BZT52C15S` | F1 | Diode | Promote F1 | No electrical correction |
| fresh | hongjiacheng | `BZT52C2V7` | F1 | Diode | Promote F1 | No electrical correction |
| fresh | hongjiacheng | `BZT52C36S` | F1 | Diode | Promote F1 | No electrical correction |
| fresh | hongjiacheng | `BZT52C3V0` | F1 | Diode | Promote F1 | No electrical correction |
| fresh | hongjiacheng | `BZT52C3V3S` | F1 | Diode | Promote F1 | No electrical correction |
| fresh | hongjiacheng | `BZT52C4V3S` | F1 | Diode | Promote F1 | No electrical correction |
| fresh | hongjiacheng | `BZT52C4V7` | F1 | Diode | Promote F1 | No electrical correction |
| fresh | hongjiacheng | `DSK110` | F1 | Diode | Promote F1 | No electrical correction |
| fresh | hongjiacheng | `DSK24` | F1 | Diode | Promote F1 | No electrical correction |
| fresh | hongjiacheng | `HJ8205` | F1 | NMOS | Promote F1 | No electrical correction |
| fresh | hongjiacheng | `HL2300` | F1 | NMOS | Promote F1 | No electrical correction |
| fresh | hongjiacheng | `HL2301A` | F1 | PMOS | Promote F1 | +2 max bounds |
| fresh | hongjiacheng | `HL2307` | F1 | PMOS | Promote F1 | +2 max bounds |
| fresh | hongjiacheng | `HL2309` | F1 | PMOS | Promote F1 | +2 max bounds |
| fresh | hongjiacheng | `HL2310A` | F1 | NMOS | Promote F1 | +2 max bounds |
| fresh | hongjiacheng | `HL3400` | F1 | NMOS | Promote F1 | No electrical correction |
| fresh | hongjiacheng | `HL3400A` | F1 | NMOS | Promote F1 | No electrical correction |
| fresh | hongjiacheng | `HL3401` | F1 | PMOS | Promote F1 | +3 max bounds |
| fresh | hongjiacheng | `HL3401A` | F1 | PMOS | Promote F1 | +3 max bounds |
| fresh | hongjiacheng | `HL3407A` | F1 | PMOS | Promote F1 | No electrical correction |
| fresh | hongjiacheng | `HL6042` | F1 | PMOS | Promote F1 | +4 max bounds |
| fresh | hongjiacheng | `MMBT4401` | F1 | BJT NPN | Promote F1 | No electrical correction |
| fresh | hongjiacheng | `MMBT5401` | F2 | BJT PNP | Promote F2 | F2 scope correction |
| fresh | hongjiacheng | `MMBT5551` | F2 | BJT NPN | Promote F2 | F2 scope correction |
| fresh | hongjiacheng | `MMBTA92` | F2 | BJT PNP | Promote F2 | F2 scope correction |
| fresh | hongjiacheng | `RB751V-40` | F1 | Diode | Promote F1 | No electrical correction |
| fresh | hongjiacheng | `RS1M` | F1 | Diode | Promote F1 | No electrical correction |
| fresh | hongjiacheng | `S8050` | F1 | BJT NPN | Reject | candidate-identity-collision |
| fresh | hongjiacheng | `S8550` | F1 | BJT PNP | Reject | reviewed-library-vector-duplicate |
| fresh | hongjiacheng | `S9013` | F1 | BJT NPN | Promote F1 | No electrical correction |
| fresh | hongjiacheng | `SS34` | F1 | Diode | Promote F1 | No electrical correction |
| fresh | hongjiacheng | `SS54` | F1 | Diode | Promote F1 | No electrical correction |
| fresh | hongjiacheng | `SS8550` | F1 | BJT PNP | Reject | candidate-vector-duplicate |
| fresh | LRC | `LBSS84LT1G` | F1 | PMOS | Promote F1 | +1 max bounds |
| fresh | MDD Microdiode Semiconductor | `MDD2301` | F1 | PMOS | Promote F1 | +2 max bounds |
| fresh | MDD Microdiode Semiconductor | `MDD2302` | F1 | NMOS | Promote F1 | +2 max bounds |
| fresh | MDD Microdiode Semiconductor | `MDD3401` | F1 | PMOS | Promote F1 | +3 max bounds |
| fresh | MDD(Microdiode Semiconductor) | `S8050` | F1 | BJT NPN | Promote F1 | No electrical correction |

## Final verification

The final gate results and exact commands are recorded here after execution:

- Promoted-package independent validation: 78 of 78 schema passes, 208 of 208 native ngspice-46 versus pinned WASM bench passes, and 348 of 348 expectation passes.
- `npm test --workspace=@opencircuit/model-library`: passed, validating all 212 reviewed packages.
- `npm --prefix tools/model-factory test`: passed, 38 of 38 tests.
- `npm --prefix tools/conveyor test`: passed, 13 of 13 tests.
- `npm --prefix tools/conveyor run typecheck`: passed.
- `npm run typecheck`: passed for every workspace that defines a typecheck script.
- Vendor PDF and model-pack tracking audit: passed. No PDF, archive, or vendor model pack is tracked. The only tracked `.lib` file is the pre-existing self-authored `packages/model-import/test/fixtures/corners.lib` fixture.
- Absolute staging-path audit over changed shipping files: passed, with zero matches.
- `git diff --check`: passed.
