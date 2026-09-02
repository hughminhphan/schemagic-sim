# Licensing

Robonyx Simulator has three licensing layers. The layer matters because the application code, generated component models, and simulation engine come from different sources and carry different obligations.

This document is a practical overview, not legal advice. The licence texts and notices control if this summary conflicts with them.

## 1. Application and repository code: Apache-2.0

Unless a file or package says otherwise, the source code and documentation in this repository are licensed under the Apache License 2.0 in the root [`LICENSE`](../LICENSE).

Apache-2.0 permits commercial and non-commercial use, modification, distribution, sublicensing, and private use. It includes an express patent grant from contributors, subject to the licence terms. Redistributors must provide the licence, preserve applicable notices, mark modified files, and carry the root [`NOTICE`](../NOTICE) content where required.

## 2. Component model packages: MIT

Each model under `packages/model-library/models/<manufacturer>/<MPN>/` is an independently licensed package and carries its own `LICENSE` file. Current model packages use the MIT licence.

These models are original works generated from public factual specifications. Their provenance is recorded in `sources.json`, including the public source URL, revision, access date, referenced pages, and source hash. Datasheet PDFs and vendor SPICE libraries are not redistributed as part of a model package.

The MIT licence permits use, modification, redistribution, sublicensing, sale, and embedding, subject to preserving its copyright and permission notice.

## 3. ngspice WebAssembly engine: upstream terms

The pinned simulation artifact is ngspice-46 compiled to WebAssembly with Emscripten 5.0.7. The artifact includes code under several upstream licences:

- the ngspice analog core and device models under a modified BSD licence;
- SPARSE under its permissive upstream terms;
- KLU and associated SuiteSparse portions under LGPL-2.1-or-later where identified upstream;
- numparam under LGPL-2.1-or-later;
- Emscripten runtime support under MIT and University of Illinois/NCSA terms.

See [`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md) for the distribution-level summary. The authoritative engine notice bundle, complete ngspice `COPYING` file, LGPL text, corresponding-source information, local patch, and rebuild instructions are under `tools/ngspice-wasm-build/notices/`, `tools/ngspice-wasm-build/patches/`, and `tools/ngspice-wasm-build/build.sh`.

The engine terms do not replace the Apache-2.0 licence for Robonyx Simulator's original application code. Distributors of the engine artifact must also satisfy the applicable upstream terms, including the LGPL notice, source, modification, reverse-engineering, and relinking requirements.

## What you may do

Subject to the applicable terms for each layer, you may:

- use Robonyx Simulator privately or publicly;
- fork and modify the code and models;
- sell a product or service that includes the simulator;
- embed the simulator or its model packages in another application;
- redistribute source or compiled versions;
- build a modified ngspice WebAssembly artifact using the supplied source and relink path.

A commercial product is allowed. Commercial use does not remove attribution, notice, source, or relinking obligations that apply to the material you distribute.

## Boundaries and non-endorsement

- Manufacturer names and MPNs identify compatibility targets. They do not imply manufacturer sponsorship, approval, affiliation, or endorsement.
- Public factual specifications may be used to generate original models. Manufacturer datasheets remain the property of their respective owners and are not redistributed by this project.
- A fidelity tier is an engineering estimate of model coverage and validation depth. It is not a certification, safety approval, conformance mark, or guarantee that a simulated part matches every physical unit.
- Simulation results must not be treated as a substitute for prototype testing, component qualification, or safety review.
- Imported third-party SPICE content remains subject to its own licence. The import feature does not grant redistribution rights.

## Production npm dependency audit

Audit basis: `package-lock.json`, `npm ls --omit=dev --all`, and installed package metadata, reviewed on 2026-08-06. Internal `@opencircuit/*` links are workspace code, not third-party npm distributions. That scope is a frozen internal namespace and not the product name, which is Robonyx; see the naming section in the [root README](../README.md).

| Package | Version | Relationship | Licence | Shipped surface |
| --- | ---: | --- | --- | --- |
| `fflate` | 0.8.2 | Direct dependency of `@opencircuit/web` | MIT | Browser application bundle |
| `ajv` | 8.20.0 | Direct dependency of `@opencircuit/component-schema` | MIT | Package validation tooling |
| `ajv-formats` | 3.0.1 | Direct dependency of `@opencircuit/component-schema` | MIT | Package validation tooling |
| `fast-deep-equal` | 3.1.3 | Transitive dependency of `ajv` | MIT | Package validation tooling |
| `fast-uri` | 3.1.5 | Transitive dependency of `ajv` | BSD-3-Clause | Package validation tooling |
| `json-schema-traverse` | 1.0.0 | Transitive dependency of `ajv` | MIT | Package validation tooling |
| `require-from-string` | 2.0.2 | Transitive dependency of `ajv` | MIT | Package validation tooling |

### Bundled font audit

The web distribution also contains locally hosted font files. They are build inputs rather than production dependencies in the npm manifest, so they are listed separately.

| Font package | Version | Licence | Bundled use |
| --- | ---: | --- | --- |
| `@fontsource-variable/archivo` | 5.2.8 | OFL-1.1 | Archivo wordmark subset |
| `@fontsource/ibm-plex-sans` | 5.2.7 | OFL-1.1 | Interface text |
| `@fontsource/ibm-plex-mono` | 5.2.7 | OFL-1.1 | Numeric and technical text |

## Audit verdict

No GPL, AGPL, SSPL, source-available, or other copyleft-incompatible npm dependency was found in the production dependency tree. The application bundle's external JavaScript production dependency is MIT licensed. The bundled fonts are OFL-1.1 licensed.

The ngspice WebAssembly artifact intentionally includes LGPL components. They are not npm dependencies and are handled as a separate engine distribution layer with corresponding-source and relinking information. Their inclusion is compatible with distribution of the surrounding Apache-2.0 application when the applicable LGPL obligations are met.

When dependencies change, update this table and [`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md), then review the generated application bundle before release.
