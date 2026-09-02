# scheMAGIC Native ngspice Reference Harness

This package compares scheMAGIC Simulator's WebAssembly engine with the pinned native reference at `/opt/homebrew/bin/ngspice`. The native executable reports ngspice 46; a solver identity is claimed only where a contract observes it. The interim WebAssembly engine is `eecircuit-engine@1.7.0`.

## Install and test

```sh
cd tools/native-ngspice-reference
npm ci
npm test
```

`npm test` runs parser tests, then compares every circuit in `fixtures/` with both engines.
It also builds the simulation provenance module and runs the Motor + Power application golden
against native ngspice-46 and the exact browser artifact at
`tools/ngspice-wasm-build/dist-loader/index.mjs`.

## Motor + Power application golden

```sh
cd tools/native-ngspice-reference
npm run test:application-golden
```

The closed contract at `application-golden/contract.json` binds all four installed synthetic
Designer topology contexts to exact candidate, recipe, scenario, serialization, and netlist
identities:

- Motor M1 `pwm_loaded_steady_state`: an averaged operating-point current regression.
- Motor M2 external-NMOS `pwm_loaded_steady_state`: the same bounded current closure plus exact
  winding/shunt series-current and shunt-voltage relations.
- Power P1 `startup`: pre-enable quiescence, passive output rise, feedback-divider connectivity,
  and resistive-load connectivity.
- Power P2 external-FET `startup`: the same bounded startup/connectivity observations at its own
  authored timing and passive values.

Each case also requires one narrow analytic-to-simulation relation. The Motor cases compare the
positive observed winding current with the exact DC loop current obtained from the authored
back-EMF closure plus the represented closed-switch and shunt resistance. The Power cases require
a non-zero post-enable output span, then verify that feedback voltage and load current have positive
slopes matching the exact generated divider and load resistances. Both relations are evaluated for
native and browser-WASM results and fail closed if the analytic contract is absent.

For each case the runner executes native ngspice-46 and the shipped ngspice-46 browser-WASM build,
checks only the declared observation vectors and numeric windows, repeats the browser execution,
and creates and verifies the existing simulation execution receipt over the exact browser samples.
Receipts remain `attestation: none`.

This is deliberately a behavioral regression contract. It uses no production profile and does not
prove selected-part fidelity, requested-output regulation, control-loop stability, switching loss,
protection, thermal or PCB behavior, broad analytic-estimate correctness, analytic ranking,
provider approval, component admission, or release readiness. Both Power traces intentionally
remain far below their requested outputs and therefore prove only passive connectivity over the
authored startup trace, not regulation. Adaptive-step switching vectors that are not named by the
contract are reported but are not silently promoted into a full-vector equivalence claim. A
full-vector pass, when observed for a particular topology, remains non-gating.

## Current-production ineligible selected-passive nominal projection

```sh
cd tools/native-ngspice-reference
npm run test:selected-passive-application-golden
```

The separate closed contract at `selected-passive-application-golden/contract.json` binds the exact
current integrated-Power preset and its reviewed Bel Fuse `F1F2-0804-100M` 10 uH inductor plus one
quantity-two Murata `GRM32ER71E226KE15L` 22 uF BOM line. Contract V2 binds the two Murata physical
instances separately and requires two parallel 22 uF ideal nominal primitives; it rejects both the
old V1 shape and any collapsed single-44 uF representation. It records
`currentProductionIdentity: true` without granting production constraint eligibility. Strict
generation retains zero candidates with one `unknown_constraint_disallowed` rejection; the explicit
unknown-evidence inspection retains one structural observation that the installed policy keeps
ineligible.

The command first checks that exact current production identity and fail-closed policy result. It
then runs the fixture's native/browser-WASM selected-vector and ideal output-node KCL/load
relations, including both capacitor branch-current vectors separately and their sum, repeats and
verifies the unattested WASM receipt, and reports the
native engine result without claiming a native execution receipt. The canonical persisted local
report at `selected-passive-application-golden/execution-report.json` is 11,674 bytes with content
hash `sha256:556176f71e09dc5dfdd24ae62ec446bc17cccc6060ed51fcf9a0dd1b292e493c`.
The command strictly parses that report, validates its contract bounds and current identities,
reruns both engines, and requires the fresh invariant identities and browser sample/receipt hashes
to match. Native floating-point measurements are revalidated against the closed numeric contract
rather than mislabeled as cross-platform byte-deterministic output.
Engine labels are limited to the configured module path and self-reported versions. The selected-
passive contract records the native solver identity as `unverified`; only the browser-WASM engine
self-reports KLU. Neither the loader/WASM bytes nor the native executable bytes are hash-bound or
independently attested.

This is intentionally a mathematical projection outside reviewed operating conditions. The
persisted report records roughly 10.9113 A through the ideal inductor and 5.35814 A through each
identical ideal capacitor primitive. Those are bounded regression outputs, not passive-current or
physical current-sharing authority. The capacitor profile establishes neither effective
capacitance under bias nor ESR or ripple-current capability. Passing therefore proves exact current
observation/profile identity and reviewed-nominal primitive wiring only. Every switching,
effective-capacitance, ESR, ripple/current, loss, physical-passive, full-BOM,
selected-semiconductor, eligibility, ranking, and safety authority remains unavailable; receipt
attestation remains `none`.

## Compare one netlist

```sh
node compare.mjs path/to/circuit.cir --analysis op
node compare.mjs path/to/circuit.cir --analysis tran --rtol 5e-3 --atol 1e-10
node compare.mjs path/to/circuit.cir --analysis ac --json report.json
```

CLI syntax:

```text
node compare.mjs <netlist.cir> --analysis op|tran|ac \
  [--rtol 1e-3] [--atol 1e-9] [--phase-deg 1] \
  [--timeout-ms 30000] [--json out.json]
```

The command prints a compact per-vector table and exits with status 1 when a tolerance fails. Status 2 means the harness itself could not complete, for example because ngspice failed or timed out. JSON reports contain native and WebAssembly engine versions, simulation timings, captured diagnostics, tolerance settings, and per-vector metrics.

Vector matching is case-insensitive. `v(node)`, voltage vectors named as bare nodes, `i(source)`, and ngspice's `source#branch` notation are normalized before alignment. Transient WebAssembly results are linearly interpolated onto the native time base. AC values are compared by magnitude and wrapped phase difference.

## Run a suite directory

```sh
node suite.mjs
node suite.mjs path/to/netlists
node suite.mjs path/to/netlists --json suite-report.json
```

A directory can include `suite.json` with per-circuit analysis and tolerance overrides:

```json
{
  "circuits": {
    "example.cir": {
      "analysis": "tran",
      "rtol": 0.005,
      "atol": 1e-10
    }
  }
}
```

Without a manifest, the suite infers `op`, `tran`, or `ac` from the netlist control line.

## Tolerance philosophy

Defaults reflect the useful numerical meaning of each analysis rather than demanding byte-identical solver paths:

| Analysis | Default | Metric |
| --- | ---: | --- |
| Operating point | relative `1e-3`, absolute `1e-9` | Pointwise error against each native value |
| Transient | full-scale `1e-2`, absolute `1e-9` | Maximum absolute error divided by the native vector full scale |
| AC magnitude | relative `1e-2`, absolute `1e-9` | Pointwise magnitude error |
| AC phase | `1 degree` | Maximum wrapped phase difference where magnitude is meaningful |

Absolute tolerance protects comparisons near zero. A circuit may override defaults through CLI flags or its `suite.json` entry, but an override should document a known solver or model sensitivity. It must not hide a systematic implementation error.

## Reusable API

```js
import { parseRawfile, canonicalVectorName } from "@opencircuit/native-ngspice-reference/rawfile";
import { runNative } from "@opencircuit/native-ngspice-reference/run-native";
import { runWasm } from "@opencircuit/native-ngspice-reference/run-wasm";
```

- `parseRawfile(bytes)` validates and parses real or complex binary ngspice rawfiles.
- `runNative({ netlistPath, timeoutMs })` runs native batch mode in an isolated temporary output directory and returns parsed vectors, diagnostics, version, and timing.
- `runWasm({ netlistPath, timeoutMs })` reads `out.raw` from the engine's MEMFS and returns the same parsed representation.
- `compareNetlist(options)` is exported by `compare.mjs` for programmatic use.
- `runSuite(directory)` is exported by `suite.mjs`.

## Validation authority

This harness is the numerical reference for declared solver comparisons. The model factory calls
`compare.mjs`; a model is not accepted merely because it looks plausible in the browser. It must
satisfy its explicitly recorded native-ngspice comparison. Passing this harness does not by itself
establish evidence quality, application fidelity, ranking correctness, production admission, or a
release claim; those remain separate gates.

## Replay every reviewed package bench

From the repository root, run:

```sh
npm run replay:benches
```

The command discovers every reviewed package below `packages/model-library/models`, executes each supported native-versus-WASM bench from its source netlist, and writes:

- `tools/native-ngspice-reference/output/replay/replay-summary.json`
- `tools/native-ngspice-reference/output/replay/replay-summary.md`

The output directory is gitignored. Noise benches are reported as skipped because the comparison harness does not support noise rawfiles. A native-versus-WASM disagreement or comparison error is reported as a failure. The command exits nonzero if any bench fails or if the report is incomplete because any bench was skipped. Budget exhaustion is reported as skipped with a reason, so the command always stops within its declared bound. Advisory callers may pass `--allow-incomplete` to permit an incomplete report to exit zero, but failures still exit nonzero.

Defaults are 60 seconds per package, 30 seconds per bench engine run, and 90 minutes total. Override them when needed:

```sh
npm run replay:benches -- \
  --package-timeout-ms 60000 \
  --bench-timeout-ms 30000 \
  --total-timeout-ms 5400000 \
  --output-dir tools/native-ngspice-reference/output/replay
```

For the weekly advisory workflow, append `--allow-incomplete`; this changes only the exit status for skipped benches and never masks a failed comparison.
