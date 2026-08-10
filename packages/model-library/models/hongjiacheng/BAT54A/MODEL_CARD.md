# BAT54A model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-5 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8603005890978979840
- Revision: Rev:1.0
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `04f3a75598f2fc1b803901e59250664e81925ae286610c64b6a6c6581fb773bb`
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
| IS | 2.35880167e-8 | fitted or derived |
| N | 1.02505862e+0 | fitted or derived |
| RS | 1.07275100e+0 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.0003057 A | 2.500000e-1 | 2.513985e-1 | V | 0.559% | p. 2 Fig. 1 |
| forward voltage at 0.001977 A | 3.000000e-1 | 3.026825e-1 | V | 0.894% | p. 2 Fig. 1 |
| forward voltage at 0.009613 A | 3.500000e-1 | 3.528051e-1 | V | 0.801% | p. 2 Fig. 1 |
| forward voltage at 0.02759 A | 4.000000e-1 | 4.000436e-1 | V | 0.011% | p. 2 Fig. 1 |
| forward voltage at 0.05957 A | 4.500000e-1 | 4.547572e-1 | V | 1.057% | p. 2 Fig. 1 |
| forward voltage at 0.09265 A | 5.000000e-1 | 5.019540e-1 | V | 0.391% | p. 2 Fig. 1 |

Worst fitting error: 1.057% for forward voltage at 0.05957 A.

Native and WASM agreement: all 12 benches passed. Worst reported relative delta was 2.313e-14 and worst absolute delta was 5.274e-15.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curve, bias, axes, and sampled range named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, capacitance, switching, thermal, and temperature-dependence fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
