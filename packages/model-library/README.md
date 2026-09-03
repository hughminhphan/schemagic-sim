# Robonyx Component Library

Production packages use `models/<manufacturer>/<mpn>/`. Each package contains metadata, original generated SPICE, source provenance, tests, expectations, a model card, and a licence. Datasheet PDFs are never stored here.

The public browser-safe `trustedSubcircuitRegistry` is a separate code-owned execution admission boundary. Its generated allowlist currently contains exactly 50 independently reviewed, stored-validation-all-pass `subckt` packages that reduce losslessly to one canonical top-level subcircuit under the fixed Circuit V2 sanitizer. Package validation or later inventory growth never admits an asset automatically. The 714 `.model` packages and seven multi-top-level logic packages remain unavailable through this registry until their respective executable-wrapper or asset-format gate is reviewed.

Model review supports only each package's declared fidelity tier, operating region, and omissions. It does not imply broader simulator fidelity. Registry generation revalidates each allowlisted package, pins the canonical bytes by SHA-256, and fails on any source, entrypoint, pin-order, hash, admission-policy, or sanitizer drift. Runtime resolution is an exact `(assetId, contentHash, entrypoint)` lookup over static bytes and performs no filesystem, network, or dynamic model discovery.
