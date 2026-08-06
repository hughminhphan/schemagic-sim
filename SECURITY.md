# Security policy

## Supported versions

Security fixes are made on the current default branch and included in the next deployment. Historical commits, forks, and privately modified deployments are not maintained by this project.

## Reporting a vulnerability

Do not open a public issue for a vulnerability that could put users or deployments at risk.

Use GitHub's private vulnerability reporting form:

<https://github.com/hughminhphan/schemagic-sim/security/advisories/new>

Include:

- the affected commit, deployment URL, or version;
- the affected browser and operating system, if relevant;
- clear reproduction steps or a minimal proof of concept;
- the expected and observed security boundary;
- the likely impact;
- any suggested mitigation, if known.

For non-sensitive hardening suggestions, open a regular GitHub issue.

You should receive an acknowledgement within seven days. Triage, remediation, disclosure timing, and credit will be coordinated through the private advisory. Please allow a reasonable remediation period before public disclosure.

## Imported SPICE security boundary

Imported SPICE is treated as untrusted input.

Before execution, scheMAGIC Simulator parses and sanitizes imported library content. The import path:

- rejects `.control` blocks and command-like content;
- rejects shell, process, network, host-path, and file I/O references;
- rejects unresolved includes and XSPICE code-model loading;
- permits only a narrow set of model directives and device statements;
- expands only files supplied through the caller's in-memory virtual file map;
- removes top-level circuit elements from imported model-library content;
- namespaces emitted model and subcircuit definitions;
- applies parser and import resource limits before the model reaches the simulation worker.

Simulation runs in the browser through the pinned ngspice WebAssembly engine, not by launching a native process on the user's machine. The worker boundary and sanitizer reduce exposure, but they are not a claim that arbitrary SPICE input is harmless. Parser denial of service, excessive memory or CPU consumption, unexpected ngspice behavior, browser sandbox escapes, and sanitizer bypasses are in scope for security reports.

Do not use imported models from an untrusted source if their licence or provenance is unclear. Sanitization does not grant redistribution rights or establish electrical correctness.

## Scope

Security reports may cover, among other issues:

- sanitizer or parser bypasses;
- arbitrary file, network, process, or command access;
- cross-site scripting or unsafe rendered content;
- browser storage or share-link data exposure;
- service worker cache poisoning;
- dependency or build-chain compromise;
- denial of service with a practical impact on users;
- discrepancies that cross a documented security boundary.

Pure numerical fidelity errors without a security impact should use the numerical discrepancy issue template.

## No bug bounty

This project does not currently operate a paid bug bounty program. Submitting a report does not create an entitlement to payment. Good-faith reporters may be credited in the advisory or release notes if they want attribution.
