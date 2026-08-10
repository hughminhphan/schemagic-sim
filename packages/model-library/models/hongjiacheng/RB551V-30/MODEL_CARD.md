# RB551V-30 model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-4 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8602990826671136768
- Revision: Rev:1.0
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `b751fff652aa32e328fb0666fc371b18fc9215574e17829ba435ed4533d12ab4`
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
| IS | 9.62177812e-7 | fitted or derived |
| N | 1.07302584e+0 | fitted or derived |
| RS | 1.77765979e-1 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 0.0002 A | 1.490000e-1 | 1.482868e-1 | V | 0.479% | p. 2, Fig. 1, Typical Instaneous Forward Characteristics |
| forward voltage at 0.0005 A | 1.720000e-1 | 1.736908e-1 | V | 0.983% | p. 2, Fig. 1, Typical Instaneous Forward Characteristics |
| forward voltage at 0.001 A | 1.900000e-1 | 1.929905e-1 | V | 1.574% | p. 2, Fig. 1, Typical Instaneous Forward Characteristics |
| forward voltage at 0.002 A | 2.090000e-1 | 2.123923e-1 | V | 1.623% | p. 2, Fig. 1, Typical Instaneous Forward Characteristics |
| forward voltage at 0.005 A | 2.360000e-1 | 2.383481e-1 | V | 0.995% | p. 2, Fig. 1, Typical Instaneous Forward Characteristics |
| forward voltage at 0.01 A | 2.570000e-1 | 2.584716e-1 | V | 0.573% | p. 2, Fig. 1, Typical Instaneous Forward Characteristics |
| forward voltage at 0.02 A | 2.790000e-1 | 2.794854e-1 | V | 0.174% | p. 2, Fig. 1, Typical Instaneous Forward Characteristics |
| forward voltage at 0.05 A | 3.100000e-1 | 3.102480e-1 | V | 0.080% | p. 2, Fig. 1, Typical Instaneous Forward Characteristics |
| forward voltage at 0.1 A | 3.380000e-1 | 3.383735e-1 | V | 0.111% | p. 2, Fig. 1, Typical Instaneous Forward Characteristics |
| forward voltage at 0.2 A | 3.740000e-1 | 3.753874e-1 | V | 0.371% | p. 2, Fig. 1, Typical Instaneous Forward Characteristics |
| forward voltage at 0.3 A | 4.000000e-1 | 4.044171e-1 | V | 1.104% | p. 2, Fig. 1, Typical Instaneous Forward Characteristics |

Worst fitting error: 1.623% for forward voltage at 0.002 A.

Native and WASM agreement: all 17 benches passed. Worst reported relative delta was 1.427e-13 and worst absolute delta was 2.215e-14.


F2 curve-fit fidelity is supported only for the selected 25 degC forward DC curve over 0.0002 to 0.3 A: Typical instantaneous forward characteristics, Ta = 25 degC (p. 2, Fig. 1, Typical Instaneous Forward Characteristics). Separate scalar hard bounds do not extend curve fidelity.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- The datasheet publishes no reverse-recovery time and no reverse-breakdown characterization; reverse_recovery, breakdown_voltage, and breakdown_current remain null.
- F2 curve-fit fidelity is limited to the exact selected 25 degC DC curves, biases, and sampled ranges named in supported_operating_region; separate scalar hard bounds do not extend the fitted claim.
- Reverse-bias, breakdown, capacitance, recovery, switching, thermal, surge, and continuous-current fidelity are outside the F2 curve-fit claim unless separately enforced as a scalar hard bound.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
