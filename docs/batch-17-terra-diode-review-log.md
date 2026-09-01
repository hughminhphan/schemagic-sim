# Batch 17 Terra diode independent review log

Date: 2026-08-23

Reviewer: `gpt-5.6-terra independent package reviewer`

## Outcome

**APPROVE.** The repaired Terra recovery tranche has 40 of 40 sealed execution outcomes. Twenty-eight packages passed the original source, identity, transcription, fit, collision, and native/WASM review. The strict evidence-contract release gate then admitted 27 packages and rejected `mdd-microdiode/SS5150C` because its fitted Fig. 3 forward curve does not state an exact temperature. The reviewed library therefore increases from 710 to 737 packages. No refit or electrical parameter change was made during release hardening.

The reviewer initially blocked the fit result because BAS85 had a terminal failure in the state database and retained validation artifacts but no serialized factory-result entry. No fit retry or electrical change was made. The final supplement binds state transition 161 to the exact five-bench validation artifact, records four published-maximum failures, and closes logical factory accounting at 35 of 35 fit inputs. Re-review approved the supplement and preserved all 28 electrical package approvals. A later strict release review found the 27 corrected packages and code sound, and blocked only because two release records still described the superseded 28-package set. Final record-only re-review approved the corrected 27-package manifest, all declared hashes and file vectors, the 737-package count, and the SS5150C exclusion.

## Execution and scale gates

- Frozen denominator: 40 contiguous diode orders 690 through 729; zero substitutions.
- Topology parks: 4.
- Conveyor accepted: 36; pure factory preflight accepted 35 and rejected 1.
- Exactly one fit pass; zero retries.
- Staged: 28, exceeding the minimum 14.
- Strong evidence: 16 (10 curve-fitted F2 plus 6 direct typical-point F1), exceeding the minimum 10.
- Bound-constrained F1: 12. These packages use exact cited maximum inequalities, zero residual observations, and the honest `cited-maximum diode F1 interior-feasibility projection` label.
- Fidelity: 10 F2 and 18 F1.

## Independent verification

- All 40 downloaded PDF hashes and byte counts matched the acquisition ledger.
- All 28 originally staged packages passed the original identity, provenance, numerical transcription, supported-region, omission, and package review. Twenty-seven also pass the stricter evidence-contract release gate.
- Fresh read-only replay passed 176 of 176 native/WASM benches and 176 of 176 package expectations.
- Worst native/WASM relative delta: `5.698891226053609e-9`; worst absolute delta: `2.6095849925411585e-9`.
- No normalized canonical/alias collision or complete family-aware fitted-vector collision exists against the 710-package baseline or among the 27 released candidates.
- Every released `model.cir` is byte-identical to the original fit output, and every released `fitted.parameters` vector is identical to the original fit output. Evidence-contract linkage, generated validation benches, reviewer metadata, and model-card wording were regenerated without invoking the optimizer or changing the electrical model.
- Strict bench review found 39 source-exact transient `PULSE` checks. It also found 21 `pulsed_limit` and 47 `not_stated` checks that explicitly declare the narrow isothermal diode-forward projection used by the continuous-DC model; no source-mode mismatch remained.

## Integrity records

| Record | SHA-256 |
| --- | --- |
| Fit execution | `9c4a2941eb33529e7ed82da6d8934291d88a360edc7e51540d8c518721809d0b` |
| BAS85 terminal supplement | `d8d757394842d5126d52a539bb84130e6a719a5a778961f31012e59c5dd3e6ae` |
| Integrity after fit | `0813c673a8187815732c0d79d172fa1cb41e8104c5428d3f6d930a3a50c9b2e2` |
| Fresh native/WASM replay | `b17723b69f84e386df80952f0107377ee7444286fbe95f12e19f976e588f6c76` |
| Staged package file vector | `c190787ad02adc5b0b6862052b0dc886db947eeb59a1dd0b9905f3ec9b2d1973` |

## Approved package dispositions

| Order | LCSC | Package | Tier | Evidence | Verdict |
| ---: | --- | --- | --- | --- | --- |
| 691 | C493190 | `smc-sangdest-microelectronicstronic-nanjing/1N4007FL` | F2 | curve-fitted | APPROVE |
| 692 | C550967 | `nexperia/BZX84J-B10-115` | F1 | bound-constrained | APPROVE |
| 693 | C466986 | `vishay-intertech/S1G-E3-61T` | F2 | curve-fitted | APPROVE |
| 694 | C511867 | `born/DSS26` | F2 | curve-fitted | APPROVE |
| 696 | C393516 | `yangzhou-yangjie-elec-tech/G1M` | F1 | bound-constrained | APPROVE |
| 697 | C5345988 | `hxy-mosfet/ZMM3V6` | F2 | curve-fitted | APPROVE |
| 699 | C82466 | `onsemi/BAS21HT1G` | F1 | bound-constrained | APPROVE |
| 700 | C28642302 | `tech-public/TPNSR05F40NXT5G` | F1 | bound-constrained | APPROVE |
| 701 | C2462 | `mdd-microdiode/10A10` | F2 | curve-fitted | APPROVE |
| 703 | C30584799 | `yongyutai/CD4148WSP` | F1 | typ-point | APPROVE |
| 704 | C22380728 | `born/F1M` | F2 | curve-fitted | APPROVE |
| 705 | C545360 | `lge/BZV55C12` | F1 | bound-constrained | APPROVE |
| 707 | C12889 | `diodes/B230A-13-F` | F1 | typ-point | APPROVE |
| 710 | C131664 | `nexperia/BZX84-C33-215` | F1 | bound-constrained | APPROVE |
| 711 | C78740 | `mcc-micro-commercial-components/1N4148WX-TP` | F1 | bound-constrained | APPROVE |
| 713 | C550550 | `nexperia/BZX384-B24-115` | F1 | bound-constrained | APPROVE |
| 714 | C179385 | `nexperia/BZX384-B12-115` | F1 | bound-constrained | APPROVE |
| 715 | C41410776 | `hongjiacheng/SSL510B` | F1 | typ-point | APPROVE |
| 718 | C3018522 | `fuxinsemi/DFLS2100` | F1 | typ-point | APPROVE |
| 720 | C7380001 | `msksemi/MS2A40LWS` | F2 | curve-fitted | APPROVE |
| 722 | C2827931 | `guangdong-hottech/SS24L` | F1 | bound-constrained | APPROVE |
| 723 | C2461 | `mdd-microdiode/6A10` | F2 | curve-fitted | APPROVE |
| 724 | C22358693 | `tech-public/TPMEG4020EPK` | F1 | bound-constrained | APPROVE |
| 725 | C2891756 | `yongyutai/ZMM16V` | F1 | typ-point | APPROVE |
| 727 | C2837790 | `rohm-semicon/RB161QS-40T18R` | F2 | curve-fitted | APPROVE |
| 728 | C64935 | `mdd-microdiode/DL4007` | F2 | curve-fitted | APPROVE |
| 729 | C131662 | `nexperia/BZX84-C2V7-215` | F1 | bound-constrained | APPROVE |

## Non-promotion dispositions

| Order | LCSC | MPN | Terminal disposition |
| ---: | --- | --- | --- |
| 690 | C2903947 | `SS1045-SMB` | duplicate-vector rejection |
| 695 | C12740 | `LBAV199LT1G` | topology park |
| 698 | C78729 | `LBAV70LT1G` | topology park |
| 702 | C12748 | `LBZT52C15T1G` | duplicate-vector rejection |
| 706 | C454956 | `BZX84-B10,215` | duplicate-vector rejection |
| 708 | C551358 | `1N4737A,113` | duplicate-vector rejection |
| 712 | C131659 | `BZX84-C11,215` | duplicate-vector rejection |
| 716 | C5157553 | `LLDB3` | topology park |
| 717 | C475619 | `BAS85` | published-bound validation failure |
| 719 | C146754 | `MM5Z5V1T1G` | duplicate-vector rejection |
| 721 | C181116 | `MMBD4148CA` | topology park |
| 726 | C135802 | `LRB521S-40T1G` | evidence preflight rejection |
| 709 | C65015 | `SS5150C` | strict evidence-contract rejection: fitted forward curve has no exact temperature |

## Promotion scope

Promotion is deterministic and survivor-only. The 27 packages named by `docs/batch-17-terra-diode-promotion-manifest.json` are the complete strict release set. `SS5150C` remains a recorded original fit-stage success but is excluded from the reviewed library. No failed, duplicate, preflight-rejected, strict-release-rejected, or topology-parked candidate was copied. No source PDF, extraction response, job, SQLite database, or scratch artifact entered the reviewed library.
