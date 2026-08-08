# Architecture

scheMAGIC Simulator is a browser-first circuit editor and simulator. It is an npm-workspaces monorepo built with TypeScript, Vite, Vitest, and Playwright. The deployed application is a static Cloudflare Pages site at `schemagic.pages.dev`, with `sim.schemagic.design` planned as the public domain.

## System overview

```text
User interaction
      |
      v
apps/web
      |
      +--> packages/schematic-editor
      |          |
      |          v
      +--> packages/circuit-schema --> deterministic SPICE netlist
      |                                      |
      |                                      v
      +--> packages/sim-engine --> Web Worker --> ngspice-46 WASM
      |                                      |
      |                                      v
      +--> packages/waveform-viewer <-- parsed rawfile vectors
      |
      +--> packages/model-import --> sanitized, namespaced imported models

packages/model-library --> reviewed model packages
      ^
      |
tools/model-factory --> package validation and native/WASM comparison
      |                                      ^
      v                                      |
tools/native-ngspice-reference --------------+

Pinned engine build:
tools/ngspice-wasm-build --> ngspice.mjs + ngspice.wasm + notices
```

## Runtime layers

### Web application

`apps/web` composes the editor, simulator, waveform viewer, workspace persistence, share links, model import flow, and static licence notices. Vite produces a static `apps/web/dist` directory suitable for Cloudflare Pages.

Circuit workspaces are browser-side data. Sharing serializes a circuit into a URL. The application does not require a server-side simulation API for its normal solve path.

### Circuit document and netlist generation

`packages/circuit-schema` owns the canonical circuit document, migrations, validation, component definitions, stable serialization, and deterministic netlist generation. The editor and simulator exchange this typed representation instead of passing arbitrary DOM state.

Deterministic serialization supports reproducible tests, stable share links, and meaningful comparisons between native and WebAssembly simulation paths.

### Schematic editor

`packages/schematic-editor` renders and edits the circuit as SVG. It owns selection, placement, wiring, transforms, undo and redo history, and editor interaction events. Electrical interpretation remains in `packages/circuit-schema`.

### Simulation engine

`packages/sim-engine` owns the browser simulation boundary. The main thread sends generated netlists to a Web Worker. The worker runs the pinned ngspice-46 WebAssembly module, reads binary rawfile output from the engine's in-memory filesystem, parses vectors, and returns typed results and diagnostics.

The pinned engine artifact is built under `tools/ngspice-wasm-build`. The browser application does not fetch a moving simulator build from a CDN.

### Waveform viewer

`packages/waveform-viewer` renders operating-point sweeps, DC sweep curve families, transient data, AC data, and log-frequency noise spectral density. It owns axis generation, decimation, cursor snapping, engineering formatting, Bode conversion, legends, and CSV export. It consumes simulation vectors without owning circuit or solver state.

### Model import

`packages/model-import` treats imported SPICE libraries as untrusted. It parses logical statements, resolves only caller-supplied virtual files, removes unsupported top-level circuit content, rejects command and I/O surfaces, validates pin mappings, and emits namespaced model definitions.

Imported models remain visually marked as unverified. Sanitization is a security boundary, not an electrical validation or licensing decision.

## Component model system

`packages/model-library` stores one directory per manufacturer and MPN. Each package contains machine-readable identity and provenance, original SPICE model text, cited tests, a model card, and its own licence.

`packages/component-schema` defines and validates the package contract. Validation checks file presence, JSON Schema conformance, provenance rules, pin consistency, test citations, and model text constraints.

`tools/model-factory` is the deterministic authoring pipeline. It resolves a registered part, acquires a datasheet into an ignored local workspace, extracts factual targets, fits parameters, generates model and test files, compares native and WebAssembly results, and writes the model card.

A model package is accepted on evidence, not appearance. The native ngspice reference and pinned WebAssembly engine must agree for every included bench, and the bench results must satisfy the separately recorded datasheet or measurement expectations.

## Native reference and WebAssembly agreement

`tools/native-ngspice-reference` runs the same netlist through a native ngspice executable and the WebAssembly engine. It normalizes vector names, aligns transient time bases, compares AC magnitude and wrapped phase, and applies analysis-specific tolerances.

The release reference is ngspice 46 with KLU. Distribution CI may only have access to a different Ubuntu package version. CI therefore keeps package validation, unit tests, and the TypeScript build as deterministic hard gates, while clearly identifying comparisons made against a non-46 native package as informational. A native 46 comparison is a hard numerical gate.

## Engine build and licensing boundary

`tools/ngspice-wasm-build` pins ngspice-46 and Emscripten 5.0.7, verifies the upstream source hash, applies the committed patch set, builds the static engine, links the WebAssembly artifact, and runs a smoke test.

The directory also carries the authoritative third-party notice bundle, corresponding-source pointer, and relink instructions. The engine combines permissive ngspice and SPARSE code with LGPL KLU and numparam components, so it is distributed as a separate licensing layer from the Apache-2.0 application code.

## Trust boundaries

### Untrusted imported SPICE

Imported text is parsed and sanitized before it reaches netlist generation. Control blocks, shell and process access, network references, host paths, unresolved includes, file I/O, and XSPICE code-model loading are rejected. Resource limits and the browser worker boundary reduce denial-of-service exposure.

### WebAssembly engine

The simulation engine executes in the browser's WebAssembly and Worker sandboxes. Its virtual filesystem is in memory. It does not intentionally expose host filesystem, process, or network APIs to a netlist.

### Persistence and sharing

Workspaces are stored in the browser. Share links may contain the serialized circuit and should be treated as data that the recipient can read. Sensitive or proprietary circuit data should not be placed in a public URL.

### Service worker and static hosting

Cloudflare Pages serves static build output. The service worker may cache application assets for repeat use. Release integrity therefore depends on the repository build, dependency lockfile, Cloudflare deployment controls, and correct cache invalidation.

## Test layers

- Vitest and Node test suites cover deterministic package behavior.
- `validate-package.mjs` validates every component model package.
- The native reference suite checks numerical agreement with ngspice.
- Playwright covers browser-level user flows.
- The Vite production build verifies workspace integration and produces the deployable static artifact.

The root `npm test` and `npm run build` commands are the standard local gates. Model contributors must also run the package validator and native-versus-WebAssembly validation described in [`CONTRIBUTING.md`](../CONTRIBUTING.md).
