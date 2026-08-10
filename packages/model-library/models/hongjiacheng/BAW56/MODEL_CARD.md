# BAW56 model card

## Identity

- Manufacturer: hongjiacheng
- Description: diode from hongjiacheng
- Electrical family: diode
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-3 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8603005810385969152
- Revision: Rev:1.0
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `a2914f785169191d77b758bf843a5a607ff5986edc5e4c333eec1516086fb77e`
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
| IS | 2.57604672e-9 | fitted or derived |
| N | 1.79149737e+0 | fitted or derived |
| RS | 7.90943565e-1 | fitted or derived |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 3e-05 A | 4.391360e-1 | 4.338657e-1 | V | 1.200% | p. 2, Fig. 1, Ta = 25 degC curve |
| forward voltage at 0.0001 A | 4.838630e-1 | 4.897071e-1 | V | 1.208% | p. 2, Fig. 1, Ta = 25 degC curve |
| forward voltage at 0.0003 A | 5.316390e-1 | 5.407710e-1 | V | 1.718% | p. 2, Fig. 1, Ta = 25 degC curve |
| forward voltage at 0.001 A | 5.844980e-1 | 5.971128e-1 | V | 2.158% | p. 2, Fig. 1, Ta = 25 degC curve |
| forward voltage at 0.003 A | 6.383740e-1 | 6.496009e-1 | V | 1.759% | p. 2, Fig. 1, Ta = 25 degC curve |
| forward voltage at 0.01 A | 7.054640e-1 | 7.109259e-1 | V | 0.774% | p. 2, Fig. 1, Ta = 25 degC curve |
| forward voltage at 0.03 A | 7.817030e-1 | 7.776511e-1 | V | 0.518% | p. 2, Fig. 1, Ta = 25 degC curve |
| forward voltage at 0.1 A | 9.016520e-1 | 8.888056e-1 | V | 1.425% | p. 2, Fig. 1, Ta = 25 degC curve |
| forward voltage at 0.5 A | 1.265565e+0 | 1.279759e+0 | V | 1.122% | p. 2, Fig. 1, Ta = 25 degC curve |

Worst fitting error: 2.158% for forward voltage at 0.001 A.

Native and WASM agreement: all 14 benches passed. Worst reported relative delta was 1.133e-13 and worst absolute delta was 4.974e-14.

F2 fidelity is limited to the cited 25 degC forward-voltage curve. Reverse scalar checks do not imply reverse-bias curve fidelity.

## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
