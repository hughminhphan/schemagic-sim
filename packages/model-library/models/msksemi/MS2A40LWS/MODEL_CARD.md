# MS2A40LWS model card

## Identity

- Manufacturer: MSKSEMI
- Description: diode from MSKSEMI
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-terra independent package reviewer

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8603058276666404864
- Revision: Not stated
- Accessed: 2026-08-23
- Referenced pages: PDF p. 1, PDF p. 2, PDF p. 3, PDF p. 4, PDF p. 5, PDF p. 6
- SHA-256: `eb1d56e2826581be35a6e1bec5cd1e4ca7e5f5010bf61fda88b4aa0c40d2fd0a`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | fitted |
| ac | none |
| transient | none |
| noise | none |
| thermal | none |
| digital | none |

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| IS | 3.75548605e-6 | evidence-derived (curve-fitted) |
| N | 9.36303779e-1 | evidence-derived (curve-fitted) |
| RS | 5.10446433e-2 | evidence-derived (curve-fitted) |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.1 A | 2.500000e-1 | 2.581409e-1 | V | 3.256% | PDF p. 4, Fig. 3 Typical Instantaneous Forward Characteristics |
| forward voltage at 0.4 A | 3.000000e-1 | 3.068025e-1 | V | 2.268% | PDF p. 4, Fig. 3 Typical Instantaneous Forward Characteristics |
| forward voltage at 1 A | 3.500000e-1 | 3.594716e-1 | V | 2.706% | PDF p. 4, Fig. 3 Typical Instantaneous Forward Characteristics |
| forward voltage at 2 A | 4.200000e-1 | 4.271905e-1 | V | 1.712% | PDF p. 4, Fig. 3 Typical Instantaneous Forward Characteristics |

Worst fitting error: 3.256% for forward voltage at 0.1 A.

Native and WASM agreement: all 7 benches passed. Worst reported relative delta was 4.301e-16 and worst absolute delta was 1.110e-16.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; each electrical claim is limited to its exact cited bench temperature.
- Catalog parametrics may be recorded only as optimizer seeds; they are not evidence, constraints, residual targets, or datasheet citations.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
