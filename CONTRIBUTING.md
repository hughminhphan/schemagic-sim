# Contributing to Robonyx Simulator

Thank you for contributing. This project accepts code, documentation, tests, numerical discrepancy reports, and component model packages.

By participating, you agree to follow the [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) and the Developer Certificate of Origin process described below.

## Development quickstart

Requirements:

- Node.js 22 or newer
- npm, as bundled with Node.js
- Git

```sh
git clone https://github.com/hughminhphan/schemagic-sim.git
cd schemagic-sim
npm install
npm test
npm run build
```

Use `npm ci` instead of `npm install` when you want a clean install exactly matching `package-lock.json`.

## Repository map

- `apps/web`: Vite browser application, service worker, static notices, and Playwright end-to-end tests.
- `packages/circuit-schema`: canonical circuit document types, migration, validation, component definitions, and netlist generation.
- `packages/component-schema`: JSON Schemas and command-line validation for model packages.
- `packages/model-import`: parser, sanitizer, pin mapping, and namespaced emission for imported SPICE libraries.
- `packages/model-library`: reviewed component model packages generated from public factual specifications.
- `packages/schematic-editor`: SVG schematic editing interface and interaction state.
- `packages/sim-engine`: Web Worker client, ngspice WebAssembly adapter, rawfile parsing, and diagnostics.
- `packages/waveform-viewer`: operating-point, transient, and AC plotting components.
- `tools/model-factory`: deterministic pipeline from datasheet facts to fitted, tested model packages.
- `tools/native-ngspice-reference`: native-versus-WebAssembly numerical comparison harness.
- `tools/ngspice-wasm-build`: pinned ngspice-46 WebAssembly build, patch, notices, source instructions, and smoke tests.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the runtime data flow and trust boundaries.

## Before opening a pull request

Run the hard local gates:

```sh
npm test
npm run build
```

Keep changes focused. Add or update tests for behavior changes. Do not commit generated caches, local virtual environments, downloaded datasheets, browser reports, or dependency directories.

## Adding a component model

### Directory contract

Create a package at:

```text
packages/model-library/models/<manufacturer-slug>/<MPN>/
├── component.json
├── model.cir
├── sources.json
├── MODEL_CARD.md
├── LICENSE
└── tests/
    ├── expectations.json
    └── one-or-more-bench.cir
```

The required files have these roles:

- `component.json`: identity, pins, package mappings, fidelity tier, supported domains, omissions, generator, reviewer, and validation result metadata.
- `model.cir`: the original generated `.model` or `.subckt` implementation.
- `sources.json`: source URL, revision, access date, SHA-256, and exact pages used.
- `MODEL_CARD.md`: readable provenance, fitted behavior, operating region, test summary, and known omissions.
- `LICENSE`: the package licence. Current original generated models use MIT.
- `tests/expectations.json`: datasheet-cited scalar targets and hard bounds.
- `tests/*.cir`: minimal native ngspice test benches for every claimed behavior domain.

A package may also contain deterministic intermediate facts, fitted parameters, and validation result JSON. Those files do not replace the required contract above.

Validate one package from the repository root:

```sh
node packages/component-schema/validate-package.mjs packages/model-library/models/<manufacturer-slug>/<MPN>
```

The command must print `PASS` before a model pull request is ready.

### The two validators, and which one you need

The repository has two validators with similar names. They check different things and neither one replaces the other.

| Validator | Validates | Run it when |
| --- | --- | --- |
| `node packages/component-schema/validate-package.mjs <package-dir>` | One simulation model package under `packages/model-library/models/`: its `component.json`, `sources.json`, `tests/expectations.json`, `model.cir` provenance header, licence file, and internal consistency. Takes a directory argument and prints `PASS <dir>` or `FAIL <dir>` with a reason list. | You added or edited a manufacturer **simulation model** package: anything with a `model.cir`. |
| `node packages/model-library/validate-library.mjs` | The whole library as a set. It validates `admission-policy.json`, checks that every directory under `models/` is a real registered package, then runs the per-package validator above across every registered package with the strictness that package's admission entry demands. Takes no arguments and prints `PASS: validated N registered model packages`. | You added, removed, renamed, or re-tiered any model package, or edited `packages/model-library/admission-policy.json`. Run it after the per-package validator passes on your own package. |

There is a third validator that model contributors do not normally touch: `node packages/design-library/validate-library.mjs` checks the Designer's **engineering profile** library under `packages/design-library/parts/`, which holds datasheet-derived design profiles rather than SPICE models. Run that one only when changing a design profile, a manufacturer registry entry, or a catalog release.

Add `--require-evidence-contract` to the per-package validator when the package is registered under `strict_evidence_contract_packages`:

```sh
node packages/component-schema/validate-package.mjs --require-evidence-contract packages/model-library/models/<manufacturer-slug>/<MPN>
```

The pull request template asks for the library-level run; this section is the reference for what each command covers.

### Provenance hard rules

Model contributions must follow all of these rules:

1. Do not commit datasheet PDFs. Record the public HTTPS URL, revision, access date, referenced pages, and SHA-256 in `sources.json`.
2. Do not copy, adapt, translate, or redistribute a vendor SPICE `.lib`, `.cir`, or encrypted model unless the package explicitly uses the `licensed_redistribution` provenance basis and includes terms that permit this repository to redistribute it. The normal contribution path is `original_from_facts`.
3. Derive model parameters from public factual specifications or contributor measurements. Every fitted target and hard bound must have conditions and a page-level or measurement citation.
4. Keep datasheet expectations separate from simulator outputs. Do not rewrite expected values to make a fit pass.
5. Treat `minimum` and `maximum` values as hard bounds only under the stated operating conditions. Treat `typical` values and curves as fitting targets, not production guarantees. Never invent a typical value by averaging minimum and maximum values.
6. Preserve test conditions such as temperature, supply voltage, bias, frequency, load, and pulse timing. A number without its conditions is not a usable provenance record.
7. The reviewer must be independent of the generator. A model is not complete when the same person or automated run both authors and approves it.
8. State known omissions plainly. Do not claim noise, temperature, process, breakdown, thermal, digital, or transient fidelity that the model and tests do not cover.

Datasheet copyright remains with the manufacturer. A factual citation does not grant permission to redistribute the datasheet or a vendor-authored model.

### Fidelity tiers

Fidelity tiers summarize evidence and coverage. They are not certifications.

| Tier | Definition |
| --- | --- |
| F0 | Structural placeholder. Pin mapping or syntax may be present, but electrical behavior is not validated for design use. |
| F1 | Nominal functional model. Basic topology and one or more headline values are checked, with limited operating-region coverage. |
| F2 | Datasheet-fitted model. Multiple cited typical targets and applicable hard bounds are tested, with native and WebAssembly agreement for every included bench. |
| F3 | Extended engineering model. Multiple behavior domains, operating conditions, and documented corners or temperature points are validated with explicit error summaries. |
| F4 | Measurement-calibrated model. Independent physical measurements across documented samples and conditions support quantified uncertainty and reproducibility. |

Choose the lowest tier whose complete evidence is present. A large number of parameters does not by itself justify a higher tier.

### Native and WebAssembly agreement

A model must pass both kinds of validation:

1. Datasheet or measurement expectations in `tests/expectations.json`.
2. Numerical agreement between the pinned native ngspice-46 reference and the pinned ngspice-46 WebAssembly engine for every model bench.

The model factory's `validate` stage runs both paths. CI also validates every package structure. Pull requests must not weaken tolerances to hide a systematic native-versus-WebAssembly difference. Any justified tolerance override must be narrow, recorded, and explained in the model card.

## Running the model factory locally

The factory currently supports registered model archetypes. From the repository root:

```sh
cd tools/model-factory
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
node factory.mjs all --mpn 1N4148
```

You may run stages individually:

```sh
node factory.mjs resolve --mpn 1N4148
node factory.mjs acquire --mpn 1N4148
node factory.mjs extract --mpn 1N4148
node factory.mjs fit --mpn 1N4148
node factory.mjs generate --mpn 1N4148
node factory.mjs testgen --mpn 1N4148
node factory.mjs validate --mpn 1N4148
node factory.mjs card --mpn 1N4148
```

Downloaded PDFs and extracted working files stay under the ignored `tools/model-factory/tmp/` directory. Adding a new MPN or electrical family may require a focused change to the factory registry, archetype instructions, fitting code, and tests.

## Pull requests and DCO sign-off

All commits in external contributions must include a Developer Certificate of Origin sign-off line:

```text
Signed-off-by: Your Name <your.email@example.com>
```

Create it automatically with:

```sh
git commit -s
```

The sign-off certifies that you have the right to submit the contribution under the project's licences. Use your real name and an email address you control. The DCO is not the same as GPG commit signing.

If you need to add a missing sign-off to your latest local commit, amend it before pushing:

```sh
git commit --amend --signoff
```

Do not sign off for another contributor.
