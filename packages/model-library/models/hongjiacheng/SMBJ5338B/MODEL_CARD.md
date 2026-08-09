# SMBJ5338B model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-2 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8564879084837756928
- Revision: Rev. 1.0
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5
- SHA-256: `64aade9d6c8bcc630328e7b0e3a958d2e8a83c0e2e2b23ab0c7cb96acffbf112`
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
| IS | 2.22844933e-12 | fitted or derived |
| N | 1.80000000e+0 | fitted or derived |
| RS | 1.00000000e-4 | fitted or derived |
| BV | 5.10000000e+0 | fitted or derived |
| IBV | 2.40000000e-1 | fitted or derived |
| NBV | 1.00000000e+0 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 3 benches passed. Worst reported relative delta was 6.385e-14 and worst absolute delta was 7.483e-14.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: No usable diode electrical curve is provided. The only plotted characteristics are thermal, power, temperature-coefficient, and thermal-response curves, so no forward-I-V, zener-V-I, capacitance, or reverse-recovery points were digitized.
- No usable diode electrical curve is provided. The only plotted characteristics are thermal, power, temperature-coefficient, and thermal-response curves, so no forward-I-V, zener-V-I, capacitance, or reverse-recovery points were digitized.
- Reverse-bias leakage is not covered by this F1 package because the approximation is supported only over cited forward-bias targets.

- Reverse behavior is validated only at the cited 25 degC Zener test-current and leakage-bias points; operation outside those points is not claimed.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
