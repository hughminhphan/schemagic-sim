# Governance

## Current model

Robonyx Simulator currently uses a single-maintainer, BDFL-for-now governance model. Hugh Phan is the project lead and final decision maker.

This structure is intended for the project's early stage, when a small decision surface and clear accountability are more useful than a formal voting body. It is not intended to prevent contributors from gaining responsibility.

## Roles

### Project lead

The project lead:

- sets project direction and release priorities;
- decides which changes are accepted;
- appoints and removes maintainers;
- manages releases, security response, and repository administration;
- resolves decisions that do not reach consensus;
- may delegate any of these responsibilities.

### Maintainers

Maintainers are trusted contributors with responsibility for defined areas. Depending on access and scope, they may triage issues, review pull requests, merge changes, maintain packages, coordinate releases, or handle security reports.

### Contributors

Anyone who submits issues, documentation, tests, designs, model packages, or code is a contributor. Contributors do not need commit access to participate in technical decisions.

## Decision process

1. Routine changes are proposed through a GitHub issue or pull request.
2. Relevant maintainers and contributors discuss technical trade-offs in the open when practical.
3. The preferred outcome is rough consensus supported by tests, evidence, and the project's stated contracts.
4. The project lead or a delegated maintainer records the decision by merging, closing, or documenting a follow-up.
5. If consensus does not emerge, the project lead makes the final decision and should explain the reasoning.

Decisions involving security reports, private personal information, embargoed vulnerabilities, or legal concerns may be handled privately. Their non-sensitive outcome should be documented when disclosure is safe.

Large or difficult-to-reverse changes should begin with an issue that describes the problem, constraints, alternatives, migration impact, and validation plan before implementation starts.

## Releases and compatibility

The project lead controls release timing and deployment. A merged change is not a promise of immediate release. Compatibility commitments will be documented with the relevant public interface as the project matures.

Component model acceptance depends on provenance, schema validation, engineering evidence, and native-versus-WebAssembly agreement. Popular demand does not override these gates.

## Path to additional maintainers

A contributor may be invited to become a maintainer after demonstrating, over time:

- sustained, constructive participation;
- sound technical or domain judgment in a defined area;
- reliable reviews and follow-through;
- respect for provenance, licensing, security, and numerical honesty;
- adherence to the Code of Conduct;
- willingness to help with maintenance work, not only feature work.

The project lead may grant access gradually, such as issue triage, review authority for a package area, or merge access. Maintainer scope should be recorded in this document or repository settings when additional maintainers are appointed.

As the maintainer group grows, the project may adopt a steering group, scoped ownership, or a documented voting process. Any governance transition will be proposed publicly and will preserve clear responsibility for security and releases.

## Changes to governance

The project lead may amend this document through a pull request. Material governance changes should remain open long enough for active contributors to comment unless an urgent security or legal issue requires faster action.
