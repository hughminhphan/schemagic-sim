# Robonyx SPICE Model Importer

Safe ingestion for untrusted SPICE model libraries. The implementation remains
available through the internal `@opencircuit/model-import` compatibility import.

## Public API

- `parseSpiceLibrary(text, options)` parses model cards, subcircuits, parameters, continuations, comments, library sections, and caller-supplied virtual includes.
- `sanitize(library)` applies a whitelist and emits model-only text suitable for ngspice WASM MEMFS.
- `derivePinMappingSpec(subckt)` suggests symbol data and an initial pin mapping.
- `validatePinMapping(spec)` checks that a mapping is complete and bijective.
- `emitNamespacedLibrary(library, prefix)` sanitizes, then renames model and subcircuit definitions and their common device references.

Defaults enforce a 1 MiB aggregate input cap, virtual include depth 16, and subcircuit nesting depth 32.

## Supported syntax

The parser is case-insensitive for cards and supports `+` continuations, full-line `*` comments, inline `;` and `//` comments, `.model`, `.subckt`, `.ends`, `.param`, nested subcircuits, local models, `.lib NAME` sections, `.endl`, `.include`, `.inc`, and `.lib file [section]` through a virtual file map. Common LTspice and PSpice parameter spelling such as `PARAMS:` is accepted.

The sanitizer preserves a deliberately small set: model and subcircuit cards, parameters, functions, conditional cards, and standard SPICE device lines inside subcircuits. Top-level circuit instances and analysis commands are removed.

## Honest gaps

This is not a complete SPICE grammar. It does not expand preprocessor macros, evaluate expressions, validate device arity, preserve exact formatting, or guarantee correct rewriting for uncommon proprietary device syntaxes. XSPICE A devices, OSDI, code models, encrypted or protected vendor blocks, simulator-specific scripting, and binary model formats are not supported. Nested subcircuits are parsed and bounded, but acceptance still depends on the target ngspice build. Name rewriting covers ordinary D, J, M, Q, S, W, and X references. Unusual indirect model references may require user review.

Virtual include paths must be relative, traversal-free keys supplied by the caller. No host path or network resolution is attempted.
