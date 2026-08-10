# 2SA1037AK model card

## Identity

- Manufacturer: ROHM Semicon
- Description: -55℃~+150℃ 1 PNP 100nA 120 140MHz 150mA 200mW 500mV 50V 6V PNP TO-236-3(SOT-23-3) Bipolar (BJT) ROHS
- Electrical family: bjt_pnp
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (batch-4 scale campaign)

## Provenance

- Datasheet: https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8586202896555233280
- Revision: 20150909 - Rev.003
- Accessed: 2026-08-10
- Referenced pages: p. 1, p. 2, p. 3, p. 4, p. 5, p. 6
- SHA-256: `75992ed8cd31995956ad8de4ce5437130f531407fbecd7e8a85168134b4cde4a`
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
| BF | 2.36000000e+2 | fitted or derived |
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

Native and WASM agreement: all 5 benches passed. Worst reported relative delta was 4.001e-12 and worst absolute delta was 3.275e-14.


## Known omissions

- AC, transient, noise, thermal, and package-parasitic behavior are outside this DC-only conveyor package.
- Temperature dependence and self-heating are not modelled; the electrical region is limited to the cited nominal-temperature data.
- Catalog parametrics were used only as initial guesses or F1 fallback constraints and are not datasheet citations.
- F2 evidence did not qualify; staged as F1: Validation failed for 2SA1037AKT146R. See validation-results.json; failed package checks: vce_sat_2 observed 0.0780232052176301 (allowed error 0.0206), upper_current_boundary_voltage observed 6.4840923507035395 (maximum 6)
- The strict schema has no fields for V(BR)CBO, V(BR)CEO, V(BR)EBO breakdown rows, ICBO and IEBO cut-off currents, VCBO and VEBO absolute maximum ratings, collector-current and power limits (IC -150 mA, ICP -200 mA, PD 200 mW), thermal ratings (Tj, Tstg), hFE rank classification bins, the non-25 degC temperature-family curves of Figs. 1, 3, 5 and 7, the VCE = -1 V and -2 V gain curves of Fig. 4, the IC/IB = 20 and 50 saturation curves of Fig. 6, or the safe-operating-area curves of Figs. 10-15.
- Saturation-voltage behavior is not covered by this F1 package; the supported region is limited to cited DC current-gain evidence.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
