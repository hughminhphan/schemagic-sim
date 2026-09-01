## Summary

Describe the problem and the focused change made to address it.

## Validation

List the commands run and their results.

## Checklist

- [ ] My commits include a DCO `Signed-off-by` line created with `git commit -s`.
- [ ] I have read and followed `CONTRIBUTING.md`.
- [ ] I ran `npm test`.
- [ ] I ran `npm run build`.
- [ ] I added or updated tests for behavior changes.
- [ ] I updated documentation and notices when public behavior, dependencies, or licensing changed.
- [ ] I did not commit secrets, downloaded datasheet PDFs, vendor SPICE models, dependency directories, or local build caches.
- [ ] I checked that the change contains no manufacturer endorsement or unsupported fidelity claim.

## Model package checklist

Complete this section for changes under `packages/model-library/models/`. Otherwise, mark it not applicable.

- [ ] I registered new packages under `strict_evidence_contract_packages` in `packages/model-library/admission-policy.json`.
- [ ] I ran `node packages/model-library/validate-library.mjs` and it printed `PASS`.
- [ ] The package contains `component.json`, `model.cir`, `sources.json`, `MODEL_CARD.md`, `LICENSE`, and `tests/`.
- [ ] Every expectation has a page-level or measurement citation and complete operating conditions.
- [ ] No datasheet PDF or vendor-authored SPICE model is included.
- [ ] Minimum, typical, and maximum values retain their original semantics.
- [ ] The reviewer is independent of the model generator.
- [ ] Every claimed bench passes native ngspice-46 and pinned WebAssembly agreement.
- [ ] Known omissions and the lowest justified F0 to F4 fidelity tier are documented.
