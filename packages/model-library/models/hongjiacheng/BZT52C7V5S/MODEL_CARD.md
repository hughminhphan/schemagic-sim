# BZT52C7V5S model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-6 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8564879659008479232
- Revision: Rev:1.0
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3, p. 4
- SHA-256: `8d99c0b95ddbd62581320fd03378a72d97d914bc201c735536cd50e5f6753113`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | approx |
| ac | none |
| transient | none |
| noise | none |
| thermal | none |
| digital | none |

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| IS | 6.01915576e-11 | fitted or derived |
| N | 1.80000000e+0 | fitted or derived |
| RS | 1.00000000e-4 | fitted or derived |
| BV | 7.50000000e+0 | fitted or derived |
| IBV | 5.00000000e-3 | fitted or derived |
| NBV | 1.00000000e+0 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 3 benches passed. Worst reported relative delta was 7.809e-12 and worst absolute delta was 6.879e-12.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: diode F2 gate failed: IS saturated its physical bound at 1e-20; the true optimum lies outside the physical range, so the residual is a constraint artefact; N saturated its physical bound at 4; the true optimum lies outside the physical range, so the residual is a constraint artefact; RS saturated its physical bound at 50; the true optimum lies outside the physical range, so the residual is a constraint artefact; forward_voltage worst relative error 0.4281 exceeds gate 0.05; forward_voltage RMS relative error 0.3901 exceeds gate 0.03
- No capacitance or reverse-recovery data is published for this zener family; zener impedance and temperature-coefficient columns are preserved in extraction notes because the strict schema has no corresponding fields.
- Reverse-bias leakage is not covered by this F1 package because the approximation is supported only over cited forward-bias targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
