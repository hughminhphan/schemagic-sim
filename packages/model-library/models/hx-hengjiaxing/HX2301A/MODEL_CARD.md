# HX2301A model card

## Identity

- Manufacturer: HX hengjiaxing
- Description: -55℃~+150℃ 1 P-Channel 112mΩ@4.5V、140mΩ@2.5V 1W 2.3A 20V 3.2nC@4.5V 325pF 37pF 63pF 700mV P-Channel SOT-23 MOSFETs ROHS
- Electrical family: pmos
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-6 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588904401713180672
- Revision: Revision not stated in supplied datasheet
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5
- SHA-256: `fa06fb3bff0ff3e051cb949f4018be84089a404b77971847969ace0011e6e66f`
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
| KP | 1.78571429e+1 | fitted or derived |
| THETA | 0.00000000e+0 | fitted or derived |
| LAMBDA | 3.00000000e-3 | fitted or derived |
| RD | 6.16000000e-2 | fitted or derived |
| RS | 2.24000000e-2 | fitted or derived |
| RG | 1.00000000e-4 | fitted or derived |
| CGS | 2.88000000e-10 | fitted or derived |
| CGDMAX | 3.70000000e-11 | fitted or derived |
| CGDMIN | 3.70000000e-11 | fitted or derived |
| CJO | 2.60000000e-11 | fitted or derived |
| IS | 1.00000000e-12 | fitted or derived |
| N | 1.50000000e+0 | fitted or derived |
| RB | 2.24000000e-2 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| No F2 residual claim | n/a | n/a | n/a | n/a | See cited package expectations |

F1 parameters are transcribed or derived from cited headline targets; no multi-point F2 residual claim is made.

Native and WASM agreement: all 3 benches passed. Worst reported relative delta was 3.121e-16 and worst absolute delta was 5.551e-17.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: mosfet F2 gate failed: THETA saturated its bound at 1; the residual is a constraint artefact; drain_current worst relative error 0.3181 exceeds gate 0.2
- The strict extraction schema has no dedicated fields for IDSS, gate leakage, transconductance, switching times, gate-charge components, or thermal resistance; those published values are preserved in extraction notes.
- Gate-threshold behavior is not covered by this F1 package; the supported region is limited to cited nominal-temperature RDS(on) targets.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
