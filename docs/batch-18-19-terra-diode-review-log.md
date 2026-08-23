# Batch 18–19 Terra diode aggregate independent review log

Date: 2026-08-23

Reviewer: `gpt-5.6-terra independent package reviewer`

## Outcome

**APPROVE.** Adjacent frozen diode orders 730 through 809 were reviewed as one content-addressed 80-row aggregate after both isolated 40-row windows stopped before fitting. The aggregate preserved every original row, response hash, topology park, evidence rejection, and repair count. It made no additional model calls and ran exactly one `--no-park` fit pass with zero retries.

Thirty-four packages staged and all 11 strong-source candidates staged, passing the scaled 28-of-80 throughput floor and the unchanged absolute 10-strong route-coverage floor. All 34 staged packages passed strict evidence-contract, source linkage, supported-region, collision, native/WASM, expectation, and independent package review. The reviewed library increases from 737 to 771 packages.

## Why the aggregation corrected the plan

Batch 18 contained 37 validator-accepted candidates but only 7 strong candidates. Batch 19 contained 32 validator-accepted candidates but only 4 strong candidates. Fitting cannot upgrade a maximum-only inequality into direct or curve evidence, so each arbitrary 40-row window correctly stopped under the earlier prefit rule.

The adjacent aggregate contains 69 validator-accepted candidates and 11 strong candidates. Its staged-yield floor scales exactly from 14 of 40 to 28 of 80, while every per-package evidence gate remains unchanged. Independent Terra review found no duplicate response, source-hash mismatch, reclassification, hidden retry, or gate bypass.

## Execution and release gates

- Frozen denominator: 80 contiguous diode orders 730 through 809; zero substitutions.
- Fresh Terra extraction calls: 75 initial calls across the two sealed cohorts; five topology parks received zero calls.
- Focused repairs: 34 total, no more than one per failed target.
- Pure evidence preflight: 69 accepted, 6 rejected, 5 topology parked.
- Accepted evidence: 11 direct typical and 58 maximum-bound-only.
- Fit: exactly one pass, zero retries, no family parking.
- Staged: 34, exceeding the scaled minimum 28.
- Strong staged: 11 direct typical-point F1 packages, exceeding the minimum 10.
- Bound-constrained staged: 23 F1 packages. Their published maxima remain inequality constraints with zero residual observations.
- Selection or fitted-vector duplicates: 32 terminal rejections.
- Fit failures: 3 terminal rejections.
- Strict release: 34 of 34 staged packages approved and promoted.

## Independent verification

- All 34 staged packages passed strict evidence-contract validation.
- Fresh read-only replay passed 34 of 34 native/WASM benches and 34 of 34 package expectations.
- Worst native/WASM relative delta: `1.7215968695943386e-6`; worst absolute delta: `1.2687653964116308e-6`.
- No normalized canonical/alias collision or complete family-aware fitted-vector collision exists against the 737-package baseline or among candidates.
- All 11 strong candidates staged and passed release review.
- Every promoted `model.cir` and `fitted.json` is byte-identical to the fit output; every promoted fitted-parameter vector is identical to the fit output.
- Release finalization changed only independent-review metadata and model-card wording. It invoked no optimizer and changed no electrical value.
- The full 771-package reviewed library validates. Model-library tests pass 7 of 7; component-schema tests pass 45 of 45; workspace tests, typechecks, and builds pass.

## Integrity records

| Record | SHA-256 |
| --- | --- |
| Aggregate source ledger | `766e592f44908c392f278d9350647da4e9323f4034e12f5fafa1e6ccbb286d58` |
| Integrity before fit | `36d0dcb5981dc6dcee0ad384c22e6c056d2d8d18905d3b69b3e896e652970278` |
| Fit execution | `5138c0e45ec5fca33c0e75e793372faf614bbe9d0eec89469e004202555385d0` |
| Integrity after fit | `5fe5cd9624081bc6ffad7ee0a0169b11aa63cb70fadab742558c754117dea297` |
| Fresh native/WASM replay | `174468ccb78d0fc429e06fd0e44cc123f8a04ba8ba21774c7c6b8636690ae26e` |
| Release metadata ledger | `59a13ae500ed541981b211c734a73aaf35bfbca00c7def33e3f9db1bfd2e32b0` |
| Promoted package file vector | `c130ace117d913561c73df63f0ba16aeb29d80449322a449df4612ef16445e09` |
| Promotion manifest | `48f914d2a323e64eda18afdc956b6b999c5b18939d2ec0bc9961e13ccf64120b` |

## Strong-source approvals

| Order | LCSC | MPN |
| ---: | --- | --- |
| 731 | C72264 | `B540C-13-F` |
| 735 | C509976 | `RFU02VSM6STR` |
| 740 | C455014 | `BZX585-B15,115` |
| 741 | C2927415 | `MSS1P6-M3/89A` |
| 742 | C509936 | `RB168MM-40TR` |
| 746 | C131297 | `STTH112A` |
| 759 | C114696 | `BAT46WJ,115` |
| 772 | C193342 | `PMEG4010CEH,115` |
| 779 | C5260346 | `PMEG10030ELPX` |
| 782 | C126484 | `MBR130` |
| 788 | C345957 | `MSK4005` |

## Non-promotion accounting

- Topology parks: orders 752, 774, 796, 803, and 806.
- Evidence preflight rejections: orders 750, 758, 787, 800, 804, and 808.
- Fit failures: order 738 (`1SV305(TPH3,F)`, canonical-MPN character gate), order 794 (`1N60PW`, source temperature not exact), and order 807 (`ES1JLWS`, source temperature not exact).
- The remaining 32 non-promotions are terminal normalized-identity or complete fitted-vector duplicate rejections recorded in the fit execution ledger.

Promotion is survivor-only. No failed, duplicate, preflight-rejected, or topology-parked candidate entered the reviewed library. No source PDF, extraction response, job, SQLite database, or scratch artifact entered the reviewed library. Repository push and deployment were not performed.
