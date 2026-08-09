# MMBTA42LT1G model card

## Identity

- Manufacturer: onsemi
- Description: -55℃~+150℃ 1 NPN 100nA 225mW 25 300V 500mA 500mV 50MHz 6V NPN SOT-23 Bipolar (BJT) ROHS
- Electrical family: bjt_npn
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent re-reviewer (P6 proving-50 final)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8586178752703844352
- Revision: Rev. 13, October 2016
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5
- SHA-256: `e268853e09e9c4a352dbe5a45903914ff8e3033ccf53d2b2282e4341afb10bbb`
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
| IS | 1.00000000e-14 | fitted or derived |
| BF | 9.50000000e+1 | fitted or derived |
| VAF | 1.00000000e+2 | fitted or derived |
| IKF | 1.00000000e+3 | fitted or derived |
| RB | 1.00000000e+1 | fitted or derived |
| RC | 1.00000000e-1 | fitted or derived |
| RE | 5.00000000e-2 | fitted or derived |
| CJE | 1.00000000e-12 | fitted or derived |
| CJC | 1.00000000e-12 | fitted or derived |
| TF | 1.00000000e-9 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 3 benches passed. Worst reported relative delta was 1.948e-10 and worst absolute delta was 9.048e-14.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: Validation failed for MMBTA42LT1G. See validation-results.json; failed package checks: vce_sat_2 observed 0.09862923013498126 (allowed error 0.07600000000000001)
- Minimum honest F2 extraction from the supplied datasheet and bundled BJT context. The datasheet has no output-characteristics figure for VAF, no reverse-active characterization, no Cibo table row, and no data sufficient to fit thermal, noise, package-parasitic, or detailed temperature-dependent model parameters.
- Saturation-voltage behavior is not covered by this F1 package; the supported region is limited to cited DC current-gain evidence.

- The repaired F2 attempt derived nominal IS = 3.2034708367413186e-14 A from the cited 25 degC VBE(on) curve at IC = 0.01 A and VBE = 0.68 V, not from the 150 degC trace. The second VCE(sat) expectation still failed, so this promoted F1 fallback holds IS = 1e-14 A and excludes saturation-voltage behavior.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
