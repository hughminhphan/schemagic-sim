# Library campaign protocol v2

Status: active. Owner: Hugh. Date: 2026-09-02.

Supersedes every per-batch authorization document in `docs/` (batch 1 through batch 23, the
scale-2k campaign authorization, and their recovery and continuation records) and the
evidence-isolation protocol those documents carried. Those files stay in the repository as
the campaign's history; none of them authorizes work any more.

The model library is now a **nightly, unattended token sink**. It runs on subscription LLM
sessions (Claude Code and Codex CLI in print or exec mode), never on API keys. It asks for
nothing from a human between one evening and the next morning, and the only human action in
the loop is merging a pull request.

## 1. Why v2 exists

The v1 campaign was a sequence of authored batch authorizations. Each batch needed a
document, a fixed denominator, an isolation regime, and a person to write and approve it.
That worked while the yield was high and collapsed when it was not.

| Period | Selection | Yield |
| --- | --- | --- |
| Batches 1 to 9 | catalog rank, `preferred DESC, stock DESC` | roughly 230 promotable models a day |
| Batches 10 to 16 | same, deeper into the same ordering | falling, with whole batches producing no fit |
| Batches 22 and 23 | frozen scale-2k MOSFET slices | roughly 3 a day, and batch 22 reached a terminal no-fit |

Two things caused the collapse, and neither was the gates.

**Selection.** LCSC's `preferred` flag ranks assembly-house popularity. The head of that
ordering is also what a hobbyist uses, so the first nine batches got both relevance and
volume for free. Past the head the ordering keeps returning stocked parts that nobody
simulates, and whose datasheets are thinner, so cost per promoted model rose while the
value of each promoted model fell.

**Ceremony.** By batch 22 the protocol cost more human attention per part than the
extraction cost in tokens: a per-batch authorization, a frozen denominator, an isolation
regime, a recovery document when a batch failed. A pipeline that needs a document per
40 parts cannot run while its owner is asleep.

v2 changes the selection and deletes the ceremony. It changes no gate.

## 2. The nightly loop

One tranche, one worker per session, one pull request per night.

```text
claim  ->  fetch  ->  extract  ->  fit  ->  stage  ->  rubric review  ->  one PR
```

| Step | Command | Notes |
| --- | --- | --- |
| select (once per tranche) | `conveyor select --relevance-list tools/conveyor/relevance/top-300.txt --name <tranche>` | curated relevance, not catalog rank |
| claim | `conveyor claim <manifest> --worker <id> --n <k> --ttl <s>` | atomic lease; expired leases are reclaimable |
| fetch | `conveyor fetch <manifest>` | a gated datasheet with no manual drop is a skip with a reason, never a stall |
| extract | `conveyor extract <manifest> --worker <id> --concurrency 4 --invoke-cmd <template>` | claims what it needs, resumes idempotently |
| fit and stage | `conveyor fit <manifest>` | unchanged F2-first fitter, unchanged family breaker |
| review | rubric in `docs/model-review-rubric-v1.md` | run by a different model lane than the one that extracted |
| report | `conveyor status <manifest> --costs` | the night's numbers, posted with the PR |
| merge | a human | the only human step |

Leases make the loop restartable. A session that dies holding parts loses nothing: its
leases expire and the next session reclaims them. Nothing waits for a person.

The extraction invoker contract, the two shipped subscription-CLI templates, and the
`--dry-run` that prints the exact command lines are documented in
`tools/conveyor/invokers/README.md`.

### Review by a different lane

The lane that extracted a part never reviews it. The reviewing lane runs a different model
and reads only the staged package, the extraction JSON, and the datasheet. Its rubric is
`docs/model-review-rubric-v1.md`, written and owned by the review lane, not by this
document. A package that fails the rubric does not enter the PR.

### One PR a night

Everything the night staged and the review lane passed goes into a single pull request
against `main`, with the cost report in the description. Nightly runs never push to `main`
and never promote into `packages/model-library/models` on their own.

## 3. Stop conditions

The loop stops itself. It never asks.

1. **Three consecutive terminal failures in one family** park that family for the rest of
   the night. Terminal means a part that ends in a `failed_*` state having exhausted its
   attempt ceiling, or a skip. The family's remaining parts stay claimable tomorrow; the
   parking is per night, not permanent.
2. **All three families parked** ends the night. The loop writes its report and exits.
3. **The attempt ceiling.** A part with three recorded attempts is never leased again. This
   is enforced in `StateStore.claim`, so it holds no matter what calls it.
4. **Deliberate skips are terminal.** A reason beginning `skipped:` or `selection skipped:`
   is never re-leased. Gated datasheets and staging-guard rejections cost tokens once.
5. **The fit-stage family breaker is unchanged.** Two consecutive F2 gate failures in a
   family that has never produced an F2 park that family inside `conveyor fit`. A single F2
   anywhere in the family clears it. This is a different and narrower mechanism from
   condition 1 and both remain in force.

Implementation status: conditions 3, 4 and 5 are enforced in code today
(`tools/conveyor/conveyorlib.py`). Conditions 1 and 2 are owned by the loop wrapper, which
reads them from `conveyor status`; the wrapper is not written yet and this section is its
specification.

## 4. What stays hard

Every gate below is unchanged from v1 and none of them is negotiable by a nightly run.

- **Electrical.** F2 is earned by an ngspice-measured residual inside the per-family
  tolerance in `tools/model-factory/lib/fit-gates.json`. A parameter parked on a bound
  fails the gate regardless of residual. A conveyor F2 remains a DC-only claim:
  `domain_coverage.ac` stays `none` and terminal capacitances are transcribed, never fitted.
- **Provenance.** Every fact carries value, unit, conditions, page reference, locator and
  source semantics. MOSFET critical evidence still fails closed without a stated
  temperature, magnitude convention, test mode and exact locator.
- **Content addressing and the source-hash rule.** Every datasheet, prompt, response and
  extraction is recorded by SHA-256 and a claim is traceable to the exact bytes it was read
  from. Retained from v1 without change, and now written automatically into the extraction
  ledger by `conveyor extract`.
- **Simulation.** Native ngspice and WebAssembly benches, operating bounds and expectation
  checks all still gate promotion.
- **Identity and collision.** Canonical MPN and ordering-code alias collision filtering
  against the reviewed library still runs at selection, and the collision audit still runs
  before promotion.
- **Honest fidelity.** An extraction without usable curves is F1 with a written reason. A
  cross-check discrepancy surviving its one retry is F1 with the discrepancy preserved in
  state. Nothing is promoted by silence.
- **No vendor SPICE.** `.lib`, `.cir`, vendor model packs and LTspice standard libraries
  remain prohibited input. scheMAGIC fits its own models from public facts.
- **Promotion is still reviewed.** Staged packages are `pending-review` and enter
  `packages/model-library/models` only through the independent review lanes.

## 5. What was retired, and why

**The per-batch authorization documents.** A fixed denominator, a frozen order range and a
written authorization per 40 parts made sense when a batch was a supervised event. An
unattended loop cannot wait for one to be written. The state machine already provides what
the denominators provided: every part's state, attempt count and reason are recorded and
append-only, so a night's scope is auditable after the fact instead of negotiated before it.

**The evidence-isolation protocol.** Batch 14 introduced it, batch 15 narrowed it and the
scale-2k authorization narrowed it again to a list of forbidden roots. It was written to
stop one worker's context leaking into another's extraction. In practice it produced
recovery documents rather than better extractions: batch 16 cycle 1 was abandoned with no
candidate state and no implementation diff because of a contamination finding, not because
of a bad model. Independence is now enforced structurally rather than by rule. Each
extraction is one process with one prompt on stdin, one datasheet and a read-only tool
allowlist, and it cannot see another part's work. Review independence is enforced by using
a different model lane, not by asking a lane to forget.

**Catalog-rank selection as the default.** Replaced by a curated relevance list. The draft
is `tools/conveyor/relevance/top-300-draft.txt` and is not authorized until Hugh signs it
off. SQL selection stays available for auditing and regeneration.

**Blocking on a manual datasheet drop.** `tmp/manual-d/<slug>.pdf` still works and is still
adopted when present, with its source recorded. Its absence is now a skip with a reason.

## 6. Cost metrics, reported every night

`conveyor status <manifest> --costs` prints, and the nightly PR description carries:

- tokens in, tokens out and wall seconds **per stage**, from the append-only `cost_events`
  table
- tokens and wall seconds **per staged part**, with the model that produced each one
- `tokens_per_staged_part` and `wall_seconds_per_staged_part`, the campaign's real unit
  cost, counting every part that consumed tokens including the ones that failed
- parts charged versus parts staged, which is the yield the v1 history above tracks
- state counts, fidelity counts and the top failure reasons

Tokens are recorded when the invoker reports them on its optional trailing usage line. Wall
time is measured by the conveyor regardless, so a template that reports no tokens still
produces a usable report. A night whose `tokens_per_staged_part` moves sharply is the
signal to look at selection, not at the gates.

## 7. The human touchpoint

Merge. That is the whole list.

Hugh signs off the relevance list once, and then reads one pull request each morning with
its cost report and its rubric results. He does not authorize batches, does not place
datasheets, does not unblock stalls, and does not arbitrate retries. If the loop needs a
decision it stops and says so in the report rather than waiting.

## 8. References

- `tools/conveyor/README.md`: commands, state machine, gates, staging layout
- `tools/conveyor/invokers/README.md`: the invoker contract and the shipped templates
- `tools/part-feeder/README.md`: selection, datasheet acquisition, prune
- `docs/model-review-rubric-v1.md`: the review rubric, owned by the review lane
- `tools/conveyor/DIAGNOSIS.md`: why the first proving run produced 0 of 50 F2 packages
