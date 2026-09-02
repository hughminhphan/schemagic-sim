# Batch 22 Terra MOSFET extraction-quality recovery

Date: 2026-08-23

## Scope

This record narrows Batch 22 execution after the contract correction in `docs/campaigns/batch-22-terra-mosfet-contract-recovery.md`. It changes extraction scheduling and source-inspection instructions only. The frozen denominator, topology parks, evidence semantics, one-repair ceiling, prefit thresholds, physics rules, and single-pass fit rule are unchanged.

## Observed stop

The first post-contract lane packed seven untouched MOSFETs into one Terra turn after four earlier untouched calls in the same lane. All 11 returned schema-valid safe fallbacks with null threshold fields, empty RDS(on) points, no curves, and an assertion that no non-invented evidence was extracted. Direct local inspection then confirmed that at least one of those PDFs contains a plainly extractable Electrical Characteristics table with a two-sided gate-threshold row and RDS(on) data. The 11 outputs therefore measure an extraction-throughput failure, not source-evidence attrition.

The other lane's attempted 12-target turn was interrupted before any model invocation began. Those 12 initial opportunities remain untouched. No focused repair was dispatched for any of the 11 empty initial outputs.

## Authorized quality recovery

- Preserve all 11 empty initial responses, hashes, modes, and audit rows. Never repeat their initial call.
- Each of those 11 targets may receive its sole focused repair through a new immutable job bound to the exact initial response, PDF, schema, context pack, adapter, and both Batch 22 recovery records.
- Preserve the 12 remaining original jobs as zero-call inputs. Replace them with immutable recovery jobs bound to the same exact contract inputs before their one initial call.
- A Terra agent turn may inspect and extract exactly one target. Two lanes may run concurrently, but no lane turn may batch multiple PDFs.
- Every prompt must require actual local PDF inspection with `pdftotext -layout`; page rendering is additionally required when table or plot semantics cannot be resolved from extracted text. The response must transcribe source-supported threshold min/typ/max, RDS(on) points, exact locators, temperature, electrical coordinates, and test mode before claiming no evidence.
- First dispatch only the focused repair for order 1033 / C2647 as the quality probe. Resume other targets only if that immutable response passes strict schema ingestion and pure factory preflight as direct or genuine-interval evidence.
- If the probe returns another empty fallback or fails for an orchestration reason, stop again before dispatching the other 22 opportunities.

No prompt may supply a value as a claim for the model to echo. The model must verify every value and locator against the bound PDF. No missing fact, second bound, temperature, relation, test mode, or source hash may be invented.

## Gate accounting

Orders 1000 and 1023 have consumed their sole repair allowances as initiated-without-output calls during the earlier audit stop and remain terminal failures. Repairs 1002, 1003, 1004, 1024, 1025, and 1027 were completed and remain terminal evidence failures. After the 11 empty initials and 12 untouched initials, 23 call opportunities remain. Fitting is still prohibited unless the fixed Batch 22 denominator reaches at least 20 validator-accepted candidates and at least 10 direct or genuine-interval candidates.
