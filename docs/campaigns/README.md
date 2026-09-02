# Model-library campaign records

Every selection, execution, review log, authorization and promotion manifest produced by the model-library conveyor campaigns, from the P4 proving pass through Batch 23. These are immutable historical records: they are kept for provenance and are never edited to reflect later decisions.

These files were moved here from `docs/` on 2026-09-02. Repo-root-relative paths inside the moved Markdown records were updated to `docs/campaigns/...`. The JSON records were left byte-identical, because their recorded paths are part of the historical evidence rather than navigation.

- Roadmap and current work: [../ROADMAP.md](../ROADMAP.md), [../BACKLOG.md](../BACKLOG.md)
- Model package contract: [../CONTRACTS.md](../CONTRACTS.md)
- Documents that stayed in `docs/`: [../README.md](../README.md)

## Index

One line per file, oldest first. Outcome is summarised from the record itself.

| Date | Batch | File | Outcome |
| --- | --- | --- | --- |
| 2026-08-07 | Proving P4 | [p4-review-log.md](p4-review-log.md) | All six parts fail review because the author lane produced no package artifacts. The factory resolution claim reproduces exactly: each MPN returns... |
| 2026-08-09 | Batch 1 | [batch-1-execution.json](batch-1-execution.json) | 70 extracted, 9 staged |
| 2026-08-09 | Batch 1 | [batch-1-fresh-selection.json](batch-1-fresh-selection.json) | scheMAGIC 1k library batch 1 fresh selection |
| 2026-08-09 | Batch 1 | [batch-1-regeneration.json](batch-1-regeneration.json) | batch-1 temperature regeneration |
| 2026-08-09 | Proving P5 | [p5-review-log.md](p5-review-log.md) | Twelve distinct downloadable PDFs reproduced the recorded SHA-256 exactly. Six distinct onsemi URLs covering eight packages blocked automated retrieval with... |
| 2026-08-09 | Proving P6 | [p6-review-log.md](p6-review-log.md) | Staged tranche: 50 of 50 distinct source URLs resolved, and 50 of 50 fresh SHA-256 values matched the package records. |
| 2026-08-10 | Batch 1 | [batch-1-review-log.md](batch-1-review-log.md) | Final reviewed-library count: 212 packages, up from 134. |
| 2026-08-10 | Batch 2 | [batch-2-execution.json](batch-2-execution.json) | 61 staged |
| 2026-08-10 | Batch 2 | [batch-2-promotion-manifest.json](batch-2-promotion-manifest.json) | 47 promoted, 14 rejected |
| 2026-08-10 | Batch 2 | [batch-2-review-log.md](batch-2-review-log.md) | Final reviewed-library count: 259 packages, up from 212. |
| 2026-08-10 | Batch 2 | [batch-2-selection.json](batch-2-selection.json) | scheMAGIC scale campaign batch 2 selection |
| 2026-08-10 | Batch 3 | [batch-3-execution.json](batch-3-execution.json) | 22 staged |
| 2026-08-10 | Batch 3 | [batch-3-promotion-manifest.json](batch-3-promotion-manifest.json) | 100 promoted, 7 rejected |
| 2026-08-10 | Batch 3 | [batch-3-review-log.md](batch-3-review-log.md) | Reviewed: 107 staged packages, comprising 22 Phase-A salvages and 85 fresh candidates. |
| 2026-08-10 | Batch 3 | [batch-3-selection.json](batch-3-selection.json) | 120 parts selected, 22 salvage candidates |
| 2026-08-10 | Batch 4 | [batch-4-execution.json](batch-4-execution.json) | 9 staged |
| 2026-08-10 | Batch 4 | [batch-4-promotion-manifest.json](batch-4-promotion-manifest.json) | 81 promoted, 12 rejected |
| 2026-08-10 | Batch 4 | [batch-4-review-log.md](batch-4-review-log.md) | Promoted tier and family totals: |
| 2026-08-10 | Batch 4 | [batch-4-selection.json](batch-4-selection.json) | scheMAGIC scale campaign batch 4 deterministic selection |
| 2026-08-10 | Batch 5 | [batch-5-selection.json](batch-5-selection.json) | scheMAGIC scale campaign batch 5 deterministic selection |
| 2026-08-10 | Aggregate | [promotion-manifest.json](promotion-manifest.json) | 78 promoted, 4 rejected |
| 2026-08-11 | Batch 10 | [batch-10-corrected-salvage-execution.json](batch-10-corrected-salvage-execution.json) | scheMAGIC Batch 10 final corrected Batch 9 execution-failure salvage execution |
| 2026-08-11 | Batch 10 | [batch-10-corrected-salvage-promotion-manifest.json](batch-10-corrected-salvage-promotion-manifest.json) | 0 promoted |
| 2026-08-11 | Batch 10 | [batch-10-corrected-salvage-review-log.md](batch-10-corrected-salvage-review-log.md) | Batch 10 salvage is permanently closed after this pass. No package was promoted. All 19 corrected staged F1 packages are rejected by the global material... |
| 2026-08-11 | Batch 10 | [batch-10-corrected-salvage-selection.json](batch-10-corrected-salvage-selection.json) | scheMAGIC Batch 10 final corrected Batch 9 execution-failure salvage selection |
| 2026-08-11 | Batch 10 | [batch-10-salvage-execution.json](batch-10-salvage-execution.json) | 50 extracted |
| 2026-08-11 | Batch 10 | [batch-10-salvage-promotion-manifest.json](batch-10-salvage-promotion-manifest.json) | 0 promoted, library 703 |
| 2026-08-11 | Batch 10 | [batch-10-salvage-review-log.md](batch-10-salvage-review-log.md) | Rejection classes: five require source-correct refitting, one has an unsupported F2 claim, and three otherwise viable F1 packages are withheld by the... |
| 2026-08-11 | Batch 10 | [batch-10-salvage-selection.json](batch-10-salvage-selection.json) | scheMAGIC Batch 10 bounded Batch 9 execution-failure salvage selection |
| 2026-08-11 | Batch 5 | [batch-5-execution.json](batch-5-execution.json) | 7 staged |
| 2026-08-11 | Batch 5 | [batch-5-promotion-manifest.json](batch-5-promotion-manifest.json) | promotion adjudication |
| 2026-08-11 | Batch 5 | [batch-5-review-log.md](batch-5-review-log.md) | BAV99W V(BR)R = 75 V at IR = 100 uA is a minimum, not a maximum. The promoted facts record corrects that source semantic without changing electrical parameters. |
| 2026-08-11 | Batch 6 | [batch-6-execution.json](batch-6-execution.json) | scheMAGIC scale campaign batch 6 staging execution |
| 2026-08-11 | Batch 6 | [batch-6-promotion-manifest.json](batch-6-promotion-manifest.json) | promotion adjudication |
| 2026-08-11 | Batch 6 | [batch-6-review-log.md](batch-6-review-log.md) | hongjiacheng/1SS226 V(BR) = 80 V at IR = 100 uA is an inclusive minimum guarantee, not a typical value. The promoted facts record corrects that source... |
| 2026-08-11 | Batch 6 | [batch-6-selection.json](batch-6-selection.json) | scheMAGIC scale campaign batch 6 deterministic selection |
| 2026-08-11 | Batch 7 | [batch-7-execution.json](batch-7-execution.json) | 13 staged |
| 2026-08-11 | Batch 7 | [batch-7-promotion-manifest.json](batch-7-promotion-manifest.json) | promotion adjudication |
| 2026-08-11 | Batch 7 | [batch-7-review-log.md](batch-7-review-log.md) | Staging contained one invalid citation: hongjiacheng/BAS70W-05 cited p. 4 although its primary PDF has 3 pages. The promoted copy removes p. 4 from... |
| 2026-08-11 | Batch 7 | [batch-7-selection.json](batch-7-selection.json) | scheMAGIC scale campaign batch 7 deterministic selection |
| 2026-08-11 | Batch 8 | [batch-8-execution.json](batch-8-execution.json) | scheMAGIC scale campaign batch 8 hardening and execution |
| 2026-08-11 | Batch 8 | [batch-8-selection.json](batch-8-selection.json) | scheMAGIC scale campaign batch 8 deterministic selection |
| 2026-08-11 | Batch 9 | [batch-9-execution.json](batch-9-execution.json) | scheMAGIC scale-2k campaign batch 9 staging execution |
| 2026-08-11 | Batch 9 | [batch-9-promotion-manifest.json](batch-9-promotion-manifest.json) | library 703 |
| 2026-08-11 | Batch 9 | [batch-9-review-log.md](batch-9-review-log.md) | Rejection classes: 11 refit required, 4 unsupported physical package contracts, 2 polarity or electrical changes required, and 2 unsupported F2 claims. |
| 2026-08-11 | Batch 9 | [batch-9-selection.json](batch-9-selection.json) | scheMAGIC scale campaign batch 9 deterministic selection |
| 2026-08-11 | Scale-2k | [scale-2k-freeze.json](scale-2k-freeze.json) | campaign manifest freeze |
| 2026-08-12 | Batch 10 | [batch-10-early-gate-execution.json](batch-10-early-gate-execution.json) | scheMAGIC scale-2k Batch 10 early-yield gate execution |
| 2026-08-12 | Batch 10 | [batch-10-execution.json](batch-10-execution.json) | 49 staged |
| 2026-08-12 | Batch 10 | [batch-10-promotion-manifest.json](batch-10-promotion-manifest.json) | 7 promoted, library 710 |
| 2026-08-12 | Batch 10 | [batch-10-review-log.md](batch-10-review-log.md) | No fidelity tier changed. All original and final fidelities are recorded per candidate in the promotion manifest. |
| 2026-08-12 | Batch 10 | [batch-10-selection.json](batch-10-selection.json) | scheMAGIC scale-2k Batch 10 full deterministic selection |
| 2026-08-12 | Batch 11 | [batch-11-early-gate-execution.json](batch-11-early-gate-execution.json) | scheMAGIC scale-2k Batch 11 MOSFET early-yield gate blocked execution |
| 2026-08-12 | Batch 11 | [batch-11-early-gate-recovery-execution.json](batch-11-early-gate-recovery-execution.json) | 0 staged |
| 2026-08-12 | Batch 11 | [batch-11-selection.json](batch-11-selection.json) | scheMAGIC scale-2k Batch 11 diode deferral and MOSFET early-yield gate selection |
| 2026-08-12 | Batch 12 | [batch-12-early-gate-execution.json](batch-12-early-gate-execution.json) | scheMAGIC scale-2k Batch 12 MOSFET early gate execution |
| 2026-08-12 | Batch 12 | [batch-12-selection.json](batch-12-selection.json) | scheMAGIC scale-2k Batch 12 MOSFET early gate selection |
| 2026-08-12 | Batch 13 | [batch-13-proving-execution.json](batch-13-proving-execution.json) | scheMAGIC scale-2k Batch 13 MOSFET F1 constraint proving execution |
| 2026-08-12 | Batch 13 | [batch-13-proving-selection.json](batch-13-proving-selection.json) | scheMAGIC scale-2k Batch 13 MOSFET F1 constraint proving selection |
| 2026-08-12 | Batch 14 | [batch-14-proving-execution.json](batch-14-proving-execution.json) | 0 staged |
| 2026-08-12 | Batch 14 | [batch-14-proving-selection.json](batch-14-proving-selection.json) | scheMAGIC scale-2k Batch 14 MOSFET F1 constraint proving selection |
| 2026-08-12 | Batch 15 | [batch-15-proving-selection.json](batch-15-proving-selection.json) | scheMAGIC scale-2k Batch 15 MOSFET F1 constraint proving selection |
| 2026-08-12 | Scale-2k | [scale-2k-campaign-authorization.md](scale-2k-campaign-authorization.md) | Exhaustion short of 1,000 is a valid campaign terminal. It closes with a final Fable campaign audit and report to Hugh. |
| 2026-08-13 | MOSFET hardening | [mosfet-hardening-cycle-2-authorization.md](mosfet-hardening-cycle-2-authorization.md) | Every field in a threshold or RDS(on) group must independently resolve to the same condition identity. Unknown, unmatched, or conflicting qualifier tokens... |
| 2026-08-13 | MOSFET hardening | [mosfet-hardening-cycle-2-review.md](mosfet-hardening-cycle-2-review.md) | docs/campaigns/mosfet-hardening-cycle-2-authorization.md authorized one integrated implementation, one bounded remediation, and one independent re-review... |
| 2026-08-13 | MOSFET hardening | [mosfet-hardening-cycle-3-authorization.md](mosfet-hardening-cycle-3-authorization.md) | Hugh explicitly authorized continuation after the terminal cycle 2 report by saying “yes go”. This opens one narrow cycle to fix the remaining... |
| 2026-08-13 | MOSFET hardening | [mosfet-hardening-standing-authorization.md](mosfet-hardening-standing-authorization.md) | The reviewed library remains unchanged until candidate packages pass independent package review. |
| 2026-08-13 | Scheduler | [scheduler-cycle-2-review.md](scheduler-cycle-2-review.md) | Preserved branch: scheduler-blocked-8550163 |
| 2026-08-14 | Batch 15 | [batch-15-proving-execution.json](batch-15-proving-execution.json) | 0 staged |
| 2026-08-14 | Batch 15 | [batch-15-recovery-authorization.md](batch-15-recovery-authorization.md) | If Batch 15R passes, candidates receive independent package review, collision audit, deterministic promotion, and final Fable release audit before any... |
| 2026-08-14 | Batch 15 | [batch-15-recovery-continuation.md](batch-15-recovery-continuation.md) | After the typed evidence-interface recovery stopped on its second independent review block, Hugh said: "why do you keep stoppig mate". |
| 2026-08-14 | MOSFET hardening | [mosfet-hardening-cycle-4-review.md](mosfet-hardening-cycle-4-review.md) | Batch 15 PASS still requires at least 6 provenance-clean staged packages of 10 and at least 3 staged packages in interval-constrained mode. Failure stops... |
| 2026-08-23 | Batch 15r | [batch-15r-proving-execution.json](batch-15r-proving-execution.json) | scheMAGIC scale-2k Batch 15R typed-evidence recovery proving execution |
| 2026-08-23 | Batch 16 | [batch-16-proving-authorization.md](batch-16-proving-authorization.md) | After Batch 15R reached its tracked terminal proving failure, Hugh directly instructed: “okay lets keep going then”. This is the new post-failure direction... |
| 2026-08-23 | Batch 16 | [batch-16-proving-execution.json](batch-16-proving-execution.json) | 10 extracted, 0 staged |
| 2026-08-23 | Batch 16 | [batch-16-proving-selection.json](batch-16-proving-selection.json) | scheMAGIC Batch 16 fresh extraction proving selection |
| 2026-08-23 | Batch 17 | [batch-17-terra-diode-promotion-manifest.json](batch-17-terra-diode-promotion-manifest.json) | promotion adjudication |
| 2026-08-23 | Batch 17 | [batch-17-terra-diode-review-log.md](batch-17-terra-diode-review-log.md) | APPROVE. The repaired Terra recovery tranche has 40 of 40 sealed execution outcomes. Twenty-eight packages passed the original source, identity,... |
| 2026-08-23 | Batch 17 | [batch-17-terra-diode-selection.json](batch-17-terra-diode-selection.json) | 40 parts selected |
| 2026-08-23 | Batch 18-19 | [batch-18-19-terra-diode-aggregate-selection.json](batch-18-19-terra-diode-aggregate-selection.json) | 80 parts selected |
| 2026-08-23 | Batch 18-19 | [batch-18-19-terra-diode-promotion-manifest.json](batch-18-19-terra-diode-promotion-manifest.json) | promotion adjudication |
| 2026-08-23 | Batch 18-19 | [batch-18-19-terra-diode-review-log.md](batch-18-19-terra-diode-review-log.md) | APPROVE. Adjacent frozen diode orders 730 through 809 were reviewed as one content-addressed 80-row aggregate after both isolated 40-row windows stopped... |
| 2026-08-23 | Batch 18 | [batch-18-terra-diode-prefit-execution.json](batch-18-terra-diode-prefit-execution.json) | 37 extracted |
| 2026-08-23 | Batch 18 | [batch-18-terra-diode-selection.json](batch-18-terra-diode-selection.json) | 40 parts selected |
| 2026-08-23 | Batch 19 | [batch-19-terra-diode-prefit-execution.json](batch-19-terra-diode-prefit-execution.json) | 32 extracted |
| 2026-08-23 | Batch 19 | [batch-19-terra-diode-selection.json](batch-19-terra-diode-selection.json) | 40 parts selected |
| 2026-08-23 | Batch 20-21 | [batch-20-21-terra-diode-aggregate-authorization.md](batch-20-21-terra-diode-aggregate-authorization.md) | Hugh directed the campaign to switch semantic extraction to Terra, correct the failing plan, and keep going toward 1,000 reviewed packages. Batch 20 is a... |
| 2026-08-23 | Batch 20-21 | [batch-20-21-terra-diode-aggregate-execution.json](batch-20-21-terra-diode-aggregate-execution.json) | 65 extracted |
| 2026-08-23 | Batch 20 | [batch-20-terra-diode-prefit-execution.json](batch-20-terra-diode-prefit-execution.json) | 39 extracted |
| 2026-08-23 | Batch 20 | [batch-20-terra-diode-selection.json](batch-20-terra-diode-selection.json) | 40 parts selected |
| 2026-08-23 | Batch 21 | [batch-21-terra-diode-prefit-execution.json](batch-21-terra-diode-prefit-execution.json) | 26 extracted |
| 2026-08-23 | Batch 21 | [batch-21-terra-diode-selection.json](batch-21-terra-diode-selection.json) | 30 parts selected |
| 2026-08-23 | Batch 22 | [batch-22-terra-mosfet-contract-recovery.md](batch-22-terra-mosfet-contract-recovery.md) | This record applies the producer/consumer evidence-boundary repair already authorized by docs/campaigns/scale-2k-terra-recovery-authorization.md to Batch... |
| 2026-08-23 | Batch 22 | [batch-22-terra-mosfet-evidence-envelope-recovery.md](batch-22-terra-mosfet-evidence-envelope-recovery.md) | This record replaces whole-document MOSFET extraction serialization for the remaining Batch 22 opportunities. It does not change source-evidence... |
| 2026-08-23 | Batch 22 | [batch-22-terra-mosfet-extraction-quality-recovery.md](batch-22-terra-mosfet-extraction-quality-recovery.md) | This record narrows Batch 22 execution after the contract correction in docs/campaigns/batch-22-terra-mosfet-contract-recovery.md. It changes extraction... |
| 2026-08-23 | Batch 22 | [batch-22-terra-mosfet-pulsed-rdson-recovery.md](batch-22-terra-mosfet-pulsed-rdson-recovery.md) | The pure factory validator rejected the scalar table value as pulsed evidence. This exposed an implementation rule broader than... |
| 2026-08-23 | Batch 22 | [batch-22-terra-mosfet-scaffold-recovery.md](batch-22-terra-mosfet-scaffold-recovery.md) | The order 1012 / C501507 Terra turn inspected the source and attempted to construct an extraction by mutating the production fixture with an ad hoc script.... |
| 2026-08-23 | Batch 22 | [batch-22-terra-mosfet-selection.json](batch-22-terra-mosfet-selection.json) | 40 parts selected |
| 2026-08-23 | Batch 22 | [batch-22-terra-mosfet-structural-validation-recovery.md](batch-22-terra-mosfet-structural-validation-recovery.md) | This record narrows the source-inspection recovery in docs/campaigns/batch-22-terra-mosfet-extraction-quality-recovery.md. It adds a structural exemplar and... |
| 2026-08-23 | Batch 23 | [batch-23-terra-mosfet-continuation-authorization.md](batch-23-terra-mosfet-continuation-authorization.md) | Hugh directed: “so keep going - why is it failing all the time - maybe we can step up to terra instead of luna? maybe there is some issue with he plan -... |
| 2026-08-23 | Scale-2k | [scale-2k-terra-prefit-cohort-aggregation-addendum.md](scale-2k-terra-prefit-cohort-aggregation-addendum.md) | Hugh directed the campaign to diagnose the repeated failures, switch new semantic extraction to Terra, correct the plan, and keep going toward 1,000... |
| 2026-08-23 | Scale-2k | [scale-2k-terra-prefit-strong-gate-addendum.md](scale-2k-terra-prefit-strong-gate-addendum.md) | Hugh directed the campaign to review the failing plan, switch new semantic extraction to Terra, and keep going toward 1,000 reviewed packages. This addendum... |
| 2026-08-23 | Scale-2k | [scale-2k-terra-recovery-authorization.md](scale-2k-terra-recovery-authorization.md) | After Batch 16 failed its unchanged proving gate, Hugh directed: “so keep going - why is it failing all the time - maybe we can step up to terra instead of... |
| 2026-08-23 | Scale-2k | [scale-2k-terra-recovery-review.md](scale-2k-terra-recovery-review.md) | A fresh Terra reviewer initially returned BLOCK and reproduced five bypass or provenance defects: |

## Record types

| Suffix | What it records |
| --- | --- |
| `-selection.json` | The frozen deterministic candidate list for a batch, with the manifest window it was drawn from. |
| `-execution.json` | What the conveyor actually did: extraction, fit, staging counts, and the environment it ran in. |
| `-review-log.md` | The independent reviewer pass over staged candidates, with the verdict. |
| `-promotion-manifest.json` | The machine-readable promote, demote and reject adjudication for a reviewed batch. |
| `-authorization.md` | A recorded human authorization that opened or amended a bounded campaign cycle. |
| `-recovery.md`, `-addendum.md` | A narrowed correction to an in-flight campaign after a blocking failure. |

Total: 104 records.
