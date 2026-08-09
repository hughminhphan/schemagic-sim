# AP2300 model card

## Identity

- Manufacturer: ALLPOWER ShenZhen Quan Li Semiconductor
- Description: -50℃~+150℃ 1 N-channel 1.25W 1.5V 150pF 20V 35mΩ@2.5V 4A 60nC 630pF N-Channel SOT-23 MOSFETs ROHS
- Electrical family: nmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-2 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588884093811089409
- Revision: v1.0
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `adbffab6ae6fc2b1fbcc63088b29e556cd1a4b647341373883b13f8639d3a497`
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
| VTO | 7.00000000e-1 | fitted or derived |
| KP | 8.00000000e+1 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 1.37500000e-2 | fitted or derived |
| RS | 5.00000000e-3 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 5.70000000e-10 | fitted or derived |
| CGDMAX | 6.00000000e-11 | fitted or derived |
| CGDMIN | 6.00000000e-11 | fitted or derived |
| CJO | 9.00000000e-11 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 5.00000000e-3 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 1 benches passed. Worst reported relative delta was 4.198e-16 and worst absolute delta was 5.551e-17.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: family parked after 2 consecutive F2 fit-gate failures with no F2 success; later parts staged F1 (mosfet extraction cannot support an F2 fit: no usable 25 degC transfer curve (drain current versus gate-source voltage))
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
