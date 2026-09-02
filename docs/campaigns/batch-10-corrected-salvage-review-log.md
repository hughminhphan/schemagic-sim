# Batch 10 corrected salvage final review log

Date: 2026-08-11

Reviewer: `gpt-5.6-sol independent reviewer`

## Final verdict

**BLOCK**

Batch 10 salvage is permanently closed after this pass. No package was promoted. All 19 corrected staged F1 packages are rejected by the global material code block, and the shipping model library remains exactly 703 reviewed packages.

| Set | BJT NPN | BJT PNP | F1 | Total |
| --- | ---: | ---: | ---: | ---: |
| Corrected staged packages adjudicated | 13 | 6 | 19 | 19 |
| Promoted | 0 | 0 | 0 | 0 |
| Rejected | 13 | 6 | 19 | 19 |
| Final shipping library |  |  |  | 703 |

The mandatory code gate failed before package-level source and electrical review could begin. Under the review contract, any remaining material code defect blocks every promotion. The corrected execution record's source, collision, hard-bound, expectation, and parity results were therefore not adopted as this reviewer's independent package evidence.

## Starting tripwire

- Working directory: exact required repository root verified
- Branch: `main`
- Starting HEAD: `db734629b9ef10ffc279f249ffcbe59a0e197319`
- Required short HEAD: `db73462`
- Shipping baseline: 703 reviewed packages
- Corrected staging: `tools/conveyor/data/staging/batch-10-salvage`
- Preserved blocked history: `tools/conveyor/data/staging/batch-10-salvage-blocked-history`

The tripwire passed before any write.

## Records and commits reviewed

Reviewed commits:

- `a8f41c791700402b7401acd4e228d4a09c374ca1`, canonical native BJT F1 correction
- `98679384cc1aea4033f455cdd1623b1f3b3a5b72`, partial BJT saturation-bound preservation
- `d79aedbcc72ab4dc58160221a1a373ee284cc7df`, nullable independent saturation schema
- `db734629b9ef10ffc279f249ffcbe59a0e197319`, corrected selection and execution records

Preserved records and hashes:

| Record | SHA-256 |
| --- | --- |
| `docs/campaigns/batch-10-salvage-review-log.md` | `4a79d5bf62441ba887eeb1d7dcace46bcb98e0810f80e3adf4570f3d55511ea2` |
| `docs/campaigns/batch-10-salvage-promotion-manifest.json` | `c2c4ee02d6c3b4d61714ca747d1d079e42d8d290df035419a085e7b919d744f5` |
| `docs/campaigns/batch-10-corrected-salvage-selection.json` | `ef709afffdf3d130adfc612dba4b5d4e763680ee1b20b34e548cd773071bd757` |
| `docs/campaigns/batch-10-corrected-salvage-execution.json` | `bd2318bdd505abe56e825ea6bebea2caa069a591b50f8253ef6ad212dbb99910` |

The original BLOCK records and blocked-history tree remain untouched.

## Code adjudication

| Prior material requirement | Verdict | Evidence |
| --- | --- | --- |
| Voltage-deembedded capacitance | Fixed | `voltage_deembedded_capacitances` independently de-embeds Cobo and Cibo at their cited reverse biases. |
| Capacitance and resistance delay-corrected TF | Fixed | `delay_corrected_tf` subtracts junction-capacitance and collector/emitter resistance delay before assigning TF. |
| Condition-specific hFE constraints | Fixed | Every minimum, typical, and maximum row retains collector current and VCE, is evaluated by native ngspice, and produces a condition-labelled residual. |
| Saturation maxima used only as optimizer seeds and hard bounds | **Not fixed** | The conveyor F1 voltage stage still converts maxima to synthetic equality targets at 80 percent of each limit and directly accepts that fitted vector. |
| Real native-ngspice tests rather than mocked formulas | Fixed | The new BJT regressions call the canonical Python fitter and native ngspice-46. |
| Nullable independent saturation schema | Fixed | Both `vce_sat` and `vbe_sat` are independently nullable while collector and base current remain required. |
| Sound polarity, package, source, collision, bound, and retry guards | Preserved | No weakening was found in the reviewed correction commits. Existing reviewed packages were not changed. |

### Material remaining defect

`tools/model-factory/python/fit_bjt.py:16-21` defines a maximum fit target as `0.8 * maximum`. `tools/model-factory/python/fit_bjt.py:215-230` then minimizes equality residuals against those synthetic values for VCE(sat) and VBE(sat). For `fit_mode = conveyor_f1`, `tools/model-factory/python/fit_bjt.py:328-330` accepts that voltage-stage vector directly and skips the later one-sided joint residual.

As a result, published maximum limits still determine final `RB`, `RC`, and `RE` through arbitrary equality targets. They are not used only as optimizer seeds and inclusive hard bounds. The metadata claim that cited saturation slopes were seed-only does not describe the complete optimization behavior.

A fresh native-ngspice fixture reproduced the defect:

| Quantity | Published maximum | Fitted value | Synthetic 80 percent target |
| --- | ---: | ---: | ---: |
| VCE(sat), row 1 | 0.20 V | 0.1128631402 V | 0.16 V |
| VBE(sat), row 1 | 0.80 V | 0.6400099512 V | 0.64 V |
| VCE(sat), row 2 | 1.00 V | 0.8047136860 V | 0.80 V |
| VBE(sat), row 2 | 1.00 V | 0.7999990049 V | 0.80 V |

The optimizer reported `voltage_nfev = 14`, `joint_nfev = 0`, and `resistance_seed_only = true`. The fitted VBE(sat) values converge directly to the synthetic 80 percent equality targets despite the seed-only label.

The regression named `BJT saturation limits seed only a native fit and never become final resistances` proves only that final resistances differ from the closed-form slope seed. It does not prove that maximum evidence is one-sided or seed-only.

This is material because the final electrical vector is shaped by an unsupported invented target inside each published maximum. Promotion is blocked without changing code, vectors, gates, or bounds.

## Guard and baseline audit

- Fit gates weakened: no.
- Published inclusive hard bounds weakened: no.
- Parameter bounds weakened: no.
- Collision rules weakened: no.
- Source requirements weakened: no.
- Part-specific bypasses added: no.
- Existing reviewed-package changes: zero.
- Shipping package count before review: 703.
- Shipping package count after review: 703.
- Orders 530 or later selected: zero.
- LBC846BLT1G remains staged as honest F1 with zero usable curves and no F2 claim. It is still rejected by the global code block.

## Package dispositions and immutable vectors

All 19 corrected staged packages are rejected under `global-material-code-block`. Package-level source, identity, package-contract, bench, expectation, hard-bound, parity, and collision review was not entered after the mandatory code gate failed.

| Order | Package | Family | Tier | Immutable vector SHA-256 | Disposition |
| ---: | --- | --- | --- | --- | --- |
| 373 | `twgmc/2SC1815` | bjt_npn | F1 | `2d9c2fe803aec2e51e6f8b19e92a9d8bfc30f1e3c280ef6bed7634dd19989132` | rejected, global code block |
| 376 | `onsemi/BC848CLT1G` | bjt_npn | F1 | `588868d299cf4f7d6de64c65c0bb53fd8bae00dfa5c376f12707974318cb7d5d` | rejected, global code block |
| 392 | `diodes/BC817-40Q-7-F` | bjt_npn | F1 | `231c9b1c10bddf836d90b2325196a8f12d27f71b8311ccdc0acd08315fb15e1c` | rejected, global code block |
| 407 | `nexperia/PMST4403-115` | bjt_pnp | F1 | `3ce47c73ee81e69f6ba8b0a1063a3ce50360d73ed622b7a2cf3e1e35434cbc39` | rejected, global code block |
| 416 | `jiangsu-changjing-electronics-co-ltd/MMBT2222AT` | bjt_npn | F1 | `1db74f00b55b684a7284a382fe44334456f508de513ff1fa1ac2be1efad19635` | rejected, global code block |
| 420 | `born/MMST3906` | bjt_pnp | F1 | `8b2e859787b23ba5f1d89ee335453095ff949256f147dd52d707e9f1ee1432da` | rejected, global code block |
| 428 | `diodes/FMMT458TA` | bjt_npn | F1 | `b4a99c87c895021721163b134826e7f93df7f9b31c01482abfd9b55bb8761f8a` | rejected, global code block |
| 440 | `lrc/LBC846BLT1G` | bjt_npn | F1 | `e35ba71e023bd6dc717d1681d54fa7d1605ae61ce8ba92633f837e7503ef3a3b` | rejected, global code block |
| 442 | `foshan-blue-rocket-elec/MPSA94` | bjt_pnp | F1 | `57b0c058fbe7326fee48fc2a9333b492e48d840be42b59be17bc68a351ab26c9` | rejected, global code block |
| 453 | `jiangsu-changjing-electronics-co-ltd/C1815-RANGE-200-400` | bjt_npn | F1 | `d1b9103fdf5bb3925b52b42ef5a7252dc24cb636481c38923f867f34cd0a4ac1` | rejected, global code block |
| 462 | `lrc/LMBT3904WT1G` | bjt_npn | F1 | `808ee07dd870686b30ac7c215e5acda7af2efb7cc95f04384a75641844be03ec` | rejected, global code block |
| 466 | `nexperia/PMBT5551-215` | bjt_npn | F1 | `eba9559066f9cd4bf77959c7ffb581f1c358a738c8f2fbdc717e7cc5ac9b5179` | rejected, global code block |
| 475 | `slkor-slkormicro-elec/SL3904` | bjt_npn | F1 | `7af6c3c7ebed35a062d15a48ffd443ac96d942ff123c51e9c9895342516b3292` | rejected, global code block |
| 483 | `jiangsu-changjing-electronics-co-ltd/2SC5658` | bjt_npn | F1 | `27aa47fe3d2f35b640be3572c8c3b35ad8f138739cad43d4bcf3363f1b282616` | rejected, global code block |
| 495 | `onsemi/MJD31T4G` | bjt_npn | F1 | `6f1ad05de482593843aeee7407532dd5c6d11571ea97a26eb64fde16689d3a66` | rejected, global code block |
| 497 | `stmicroelectronics/MJD31CT4` | bjt_npn | F1 | `286621b7ca9de01f12e46cac4b28f30dfa9f1be9198fec16730dc1569205b9b3` | rejected, global code block |
| 504 | `lrc/LBC856BLT1G` | bjt_pnp | F1 | `e065fee010e604907aa859a98bd13bd1f402c6b4c355e94474a7a7a0eb54c992` | rejected, global code block |
| 512 | `shikues/FCX591` | bjt_pnp | F1 | `d51629d62be4803f68645c40d7f795c1c536f9bfe3d9f94bcc3d08c927a48e64` | rejected, global code block |
| 527 | `hxy-mosfet/MMBTA55` | bjt_pnp | F1 | `275f2a413fb1002e942f090b21ed5c6e1c1722788fa133adf8915d12b958aafb` | rejected, global code block |

The vector hash is SHA-256 over the canonical sorted JSON representation of `fitted.json.parameters`. No staged electrical vector was changed.

## Staging and blocked-history integrity

| Tree | Files | Bytes | Aggregate SHA-256 |
| --- | ---: | ---: | --- |
| Corrected staging | 1,722 | 146,124,428 | `25bd4e47c275559375af4f1134dae96d80cadfa8bdcc8938bbf6f834687b28b2` |
| Corrected staged package trees | 271 | 751,877 | `02cc50abb805f48a76603ed4a7ef5e6d8f2aa46c03222d78ca67601d1db843ea` |
| Preserved blocked history | 1,741 | 146,146,484 | `09a0feb6c988639f5948233797fe71804b13fa4d09c7aa28e73b02b3618dc637` |

The aggregate algorithm hashes each sorted relative path, a NUL separator, file bytes, and a trailing NUL into one SHA-256 digest.

## Tests and typechecks

- `npm test --workspace=@opencircuit/model-library`: PASS, all 703 packages validated.
- `npm test --prefix tools/model-factory`: PASS, 57 tests.
- `npm test --prefix tools/conveyor`: PASS, 21 tests.
- `npm run typecheck --prefix tools/conveyor`: PASS.
- `npm test --prefix tools/part-feeder`: PASS, 9 discovered, 5 active passed, 4 skipped.
- `npm run typecheck --prefix tools/part-feeder`: PASS.
- `npm test`: PASS, 99 workspace tests.
- `npm run typecheck`: PASS, all six TypeScript workspace typechecks.
- Fresh native-ngspice saturation semantics probe: reproduced the material code defect.

The four part-feeder skips are expected: one live smoke test is opt-in and three freeze tests require ignored scale-2k inputs absent from this checkout.

## Package validation, source, collision, and parity status

Because the code verdict is BLOCK:

- Promoted package validators: not applicable, zero promotions.
- Promoted native ngspice-46 and pinned WASM parity: not applicable, zero promotions.
- Promoted expectations and hard bounds: not applicable, zero promotions.
- Independent primary-PDF, citation, identity, polarity, package-contract, source-hash, collision, and 162-expectation rerun: not entered after the mandatory code hard stop.
- The corrected execution record reports 19 staged validator passes, 122 explicit `.temp 25` benches, 162 expectation passes, 133 hard-bound probes, 52 condition-specific hFE probes, 39 saturation probes, and zero final collisions. These remain executor claims, not independent promotion evidence.

## Repository and prohibited-action audits

- No package was copied into `packages/model-library/models`.
- No existing reviewed package changed.
- No electrical vector, expectation, model, bench, source record, or model card changed.
- No pending-review cleanup was needed because no package was promoted.
- Prohibited promoted-data and vendor-model audit is vacuous because the promoted set is empty.
- Absolute-path and scratch-path audit applies to the two new review records and passed.
- Em dash audit applies to the two new review records and passed.
- Commit-trailer audit is required after commit and must show no trailers.
- Pre-existing untracked roots remain `.claude/` and `tools/conveyor/data.pre-hardening/`.
- No push, deploy, publication, GitHub comment, order 530 or later selection, or Vault update was performed.

## Permanent closure

This was the one-and-only corrected Batch 10 salvage review. The code gate failed, all 19 corrected staged packages are rejected, promotion count is zero, and the shipping count remains 703.

Batch 10 salvage is permanently closed. No further correction, salvage, restaging, source-repair, refit, or promotion loop is authorized by this review.
