# 1N4007 model card

## Identity

- Manufacturer: onsemi
- Description: 1 A general-purpose silicon rectifier diode
- Electrical family: diode
- Fidelity tier: F2, datasheet-fitted
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.onsemi.com/pdf/datasheet/1n4001-d.pdf
- Revision: 1N4001/D, June 2024, Rev. 18
- Accessed: 2026-08-07
- Referenced pages: p. 2 electrical characteristics
- SHA-256: `10891e72549eacfb39e4439851d2efc9393c3791e0ac186310b8ce5f31e70ece`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | approx |
| ac | none |
| transient | approx |
| noise | none |
| thermal | none |
| digital | none |

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| IS | 1.00000000e-10 | held at conservative fallback value; not typical |
| N | 1.60000000e+0 | held at conservative fallback value; not typical |
| RS | 1.20000000e-1 | held at conservative fallback value; not typical |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| ISR | 1.00000000e-14 | A | undefined |
| NR | 2.00000000e+0 | 1 | undefined |
| IKF | 0.00000000e+0 | A | undefined |
| CJO | 0.00000000e+0 | F | undefined |
| VJ | 1.00000000e+0 | V | undefined |
| M | 5.00000000e-1 | 1 | undefined |
| FC | 5.00000000e-1 | 1 | undefined |
| TT | 0.00000000e+0 | s | undefined |
| BV | 1.00000000e+99 | V | undefined |
| IBV | 1.00000000e-10 | A | undefined |
| NBV | 1.00000000e+0 | 1 | undefined |
| EG | 1.11000000e+0 | eV | undefined |
| XTI | 3.00000000e+0 | 1 | undefined |
| TNOM | 2.70000000e+1 | degC | undefined |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |


Worst fitting error: 0.000% for one-sided-bound-only model.

Native and WASM agreement: all 4 benches passed. Worst reported relative delta was 8.914e-16 and worst absolute delta was 7.772e-16.

## Known omissions

- Official manufacturer PDF and HTML product page were unreachable after repeated HTTPS attempts; this is a manufacturer spec-page fallback and is capped at F1.
- IS, N, and RS are held at conservative physical/default-fit values to remain below the published forward-voltage maximum; no typical forward-IV curve was fitted.
- ISR and NR are held at default; the reverse-leakage row is a maximum bound, not a typical target.
- IKF is held at default; high-injection roll-off is not modelled.
- CJO, VJ, and M are held at default because no verifiable capacitance curve was available.
- TT is held at default 0 s; reverse recovery is not modelled because no verified trr input was available.
- FC is held at physical default 0.5.
- BV, IBV, and NBV are held at defaults; reverse breakdown is not modelled.
- EG, XTI, and TNOM are held at physical defaults; only 25 degC behavior is claimed.
- No self-heating: junction temperature is fixed at TNOM. Thermal derating is not modelled.
- Package parasitics (lead inductance and package capacitance) are not modelled.
- Flicker noise is not modelled: KF and AF are held at defaults.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
