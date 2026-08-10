# MMFTN3019E model card

## Identity

- Manufacturer: ST Semtech
- Description: 1 N-channel 1.5V 100mA 13pF 150mW 30V 4pF 8Ω@4V 9pF N-Channel SOT-523-3 MOSFETs ROHS
- Electrical family: nmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-5 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8586177149288263680
- Revision: Rev. 02, dated 09/12/2011
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `a7a4b3b3520b6c5db6bfadc404268369246fca77536c5d0fc7365ac5adc31407`
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
| VTO | 1.50000000e+0 | fitted or derived |
| KP | 2.77777778e-1 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 3.96000000e+0 | fitted or derived |
| RS | 1.44000000e+0 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 9.00000000e-12 | fitted or derived |
| CGDMAX | 4.00000000e-12 | fitted or derived |
| CGDMIN | 4.00000000e-12 | fitted or derived |
| CJO | 5.00000000e-12 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 1.44000000e+0 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 2 benches passed. Worst reported relative delta was 1.933e-16 and worst absolute delta was 1.735e-18.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: mosfet F2 gate failed: drain_current worst relative error 0.6348 exceeds gate 0.2; drain_current RMS relative error 0.2339 exceeds gate 0.12
- No capacitance-versus-VDS curve, body-diode forward/recovery data, gate-charge data, or thermal-resistance table is published; curve extraction is limited to the typical output and transfer plots.
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
