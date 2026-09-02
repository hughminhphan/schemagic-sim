## Summary

Describe the problem and the focused change made to address it.

## Task and branch rules

Name the `agent-ready` BACKLOG task and confirm it was not already in flight when started. Branch from `main`, use one task per branch and one pull request per branch, write only the task's **Files owned**, and stop and explain the need instead of widening the diff. Put the task id in the pull request title. Commits must not contain `Co-Authored-By`, `Generated-by`, or any other AI attribution trailer.

## Validation

Run the single pre-PR command and list its final result:

```sh
npm run verify
```

Native ngspice is required; set `NGSPICE_BIN` to its executable or install the Homebrew formula with `brew install ngspice`.

## Planned branch protection

Branch protection is planned and will be enabled by the maintainer; it is not claimed as active here: `main` will be protected and pull-request-only, with these four required check names:

1. `Tests, models, and build`
2. `Simulator, Measurement, and Designer browser integration`
3. `Native versus WASM comparison`
4. `Designer Chromium runtime and retained heap`

The protection settings and check names are read-only for contributors.

## Checklist

- [ ] My commits include a DCO `Signed-off-by` line created with `git commit -s`.
- [ ] My commits contain no AI attribution trailer.
- [ ] I have read and followed `CONTRIBUTING.md` and the task's **Files owned** contract in `docs/BACKLOG.md`.
- [ ] I branched from `main`, used one task for this branch, and put the task id in the pull request title.
- [ ] I ran `npm run verify` and it passed.
- [ ] I added or updated tests for behavior changes.
- [ ] I updated documentation and notices when public behavior, dependencies, or licensing changed.
- [ ] I did not commit secrets, downloaded datasheet PDFs, vendor SPICE models, dependency directories, or local build caches.
- [ ] I checked that the change contains no manufacturer endorsement or unsupported fidelity claim.

## Model package checklist

Complete this section for changes under `packages/model-library/models/`. Otherwise, mark it not applicable. Focused package validators are useful while authoring, but `npm run verify` remains the only required pre-PR command and includes whole-library validation.

- [ ] I registered new packages under `strict_evidence_contract_packages` in `packages/model-library/admission-policy.json`.
- [ ] The package contains `component.json`, `model.cir`, `sources.json`, `MODEL_CARD.md`, `LICENSE`, and `tests/`.
- [ ] Every expectation has a page-level or measurement citation and complete operating conditions.
- [ ] No datasheet PDF or vendor-authored SPICE model is included.
- [ ] Minimum, typical, and maximum values retain their original semantics.
- [ ] The reviewer is independent of the model generator.
- [ ] Every claimed bench passes native ngspice-46 and pinned WebAssembly agreement.
- [ ] Known omissions and the lowest justified F0 to F4 fidelity tier are documented.
