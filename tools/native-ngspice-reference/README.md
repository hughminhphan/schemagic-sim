# Native ngspice reference harness

This package compares OpenCircuit's WebAssembly simulator with the pinned native reference at `/opt/homebrew/bin/ngspice`. The native reference is ngspice 46 with KLU. The interim WebAssembly engine is `eecircuit-engine@1.7.0`.

## Install and test

```sh
cd tools/native-ngspice-reference
npm ci
npm test
```

`npm test` runs parser tests, then compares every circuit in `fixtures/` with both engines.

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

This harness is the arbiter for model validation in later OpenCircuit phases. Phase 3's model factory will call `compare.mjs`; a model is not accepted merely because it looks plausible in the browser. It must satisfy the native ngspice reference comparison, with any circuit-specific tolerance explicitly recorded.
