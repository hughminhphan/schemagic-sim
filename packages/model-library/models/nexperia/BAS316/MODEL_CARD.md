# BAS316 model card

## Identity

- Manufacturer: Nexperia
- Description: 1.25V@150mA 100V 250mA 400mW 4A 4ns 500nA@80V Independent SOD-323 Switching Diodes ROHS
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-1 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588898867752001536
- Revision: BAS316 v7, 1 July 2022
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5, p. 6, p. 7, p. 8, p. 9, p. 10
- SHA-256: `a394a3ebda87022981f82bed5c312415f722a2bce0cad17e6cabb6eed469d038`
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
| IS | 6.46871602e-9 | fitted or derived |
| N | 1.99395887e+0 | fitted or derived |
| RS | 9.47405817e-1 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.0001 A | 5.000000e-1 | 4.975739e-1 | V | 0.485% | p. 4, Fig. 1, curve (3) |
| forward voltage at 0.001 A | 6.000000e-1 | 6.171763e-1 | V | 2.863% | p. 4, Fig. 1, curve (3) |
| forward voltage at 0.01 A | 7.400000e-1 | 7.444553e-1 | V | 0.602% | p. 4, Fig. 1, curve (3) |
| forward voltage at 0.1 A | 9.600000e-1 | 9.484743e-1 | V | 1.201% | p. 4, Fig. 1, curve (3) |
| forward voltage at 0.3 A | 1.180000e+0 | 1.194615e+0 | V | 1.239% | p. 4, Fig. 1, curve (3) |

Worst fitting error: 2.863% for forward voltage at 0.001 A.

Native and WASM agreement: all 10 benches passed. Worst reported relative delta was 5.262e-14 and worst absolute delta was 2.642e-14.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- Breakdown voltage and breakdown current are omitted because the supplied datasheet does not publish a breakdown characteristic pair; the 100 V reverse-voltage ratings are operating limits only.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
