# SS14 model card

## Identity

- Manufacturer: onsemi
- Description: 1 A, 40 V surface-mount Schottky rectifier
- Electrical family: diode
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://components101.com/sites/default/files/component_datasheet/SS14%20Schottky%20Diode.PDF
- Revision: SS12/D Rev. 3, July 2005; archived onsemi PDF mirror
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 2, p. 3
- SHA-256: `80c2f252a4510960ed63b96167faa39257f6ead66cc5677f6d0712466b3122db`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | approx |
| ac | approx |
| transient | none |
| noise | none |
| thermal | none |
| digital | none |

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| IS | 1.73220996e-7 | derived_from_single_bound |
| N | 1.10000000e+0 | held_default |
| RS | 3.00000000e-2 | held_default |
| CJO | 1.80000000e-10 | derived_or_held_default |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| N | 1.10000000e+0 | 1 | Held physical default because the source supplies only one forward-voltage bound. |
| RS | 3.00000000e-2 | ohm | Held physical default because the source supplies only one forward-voltage bound. |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| forward voltage at 1.000e+0 A | 4.700000e-1 | 4.700000e-1 | V | 0.000% | p. 2 maximum instantaneous forward voltage |

Worst fitting error: 0.000% for forward voltage at 1 A.

Native and WASM agreement: all 3 benches passed. Worst reported relative delta was 1.194e-16 and worst absolute delta was 5.551e-17.

## Known omissions

- The source supplies one forward-voltage maximum and no complete numeric typical curve table, so N and RS are held physical defaults and fidelity is capped at F1.
- Reverse leakage and zero-bias capacitance are maximum or digitized values; reverse breakdown and temperature dependence are omitted.
- Self-heating, process spread, package parasitics, ageing, and failure outside ratings are not modelled.
- Independent review remains pending-review.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
