# LM13700 model card

## Identity

- Manufacturer: Texas Instruments
- Description: Dual operational transconductance amplifier with linearizing diodes and buffers
- Electrical family: other
- Fidelity tier: F2, datasheet-constrained
- Independent reviewer: gpt-5.6-sol independent reviewer (P5)

## Provenance

- Datasheet: https://www.ti.com/lit/ds/symlink/lm13700.pdf
- Revision: SNOSBW2F, November 1999, revised November 2015
- Accessed: 2026-08-09
- Referenced pages: p. 1, p. 3, p. 4, p. 5, p. 6, p. 7, p. 9, p. 10
- SHA-256: `5268be6e17dc7ac797c966980ac593a336a0998a6874851645b4612298347c46`
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | fitted |
| ac | fitted |
| transient | approx |
| noise | none |
| thermal | none |
| digital | none |

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| GM_SCALE | 9.90071297e-1 | native fitted to manually digitized Figure 8 transconductance curve |
| VT | 2.60000000e-2 | direct equation constant from datasheet section 7.3.1 at 25 degC |
| POLE_HZ | 2.00000000e+6 | direct typical transcription |
| VBIAS0 | 1.28231172e+0 | native fitted to manually digitized Figure 10 amplifier-bias voltage curve |
| RABC | 2.73331611e+2 | native fitted to manually digitized Figure 10 amplifier-bias voltage curve |
| RIN | 2.60000000e+4 | direct typical transcription |
| ROUT | 2.00000000e+6 | held compact output-resistance approximation |
| IQ | 2.60000000e-3 | direct typical transcription |
| VBUF_DROP | 1.20000000e+0 | derived Darlington buffer drop approximation |
| RBUF | 2.50000000e+1 | held compact buffer output resistance |
| ILIM_BUF | 2.00000000e-2 | direct absolute-maximum transcription |
| IBUF | 5.00000000e-7 | direct typical transcription |

## Held defaults

| Parameter | Value | Unit | Status |
| --- | ---: | --- | --- |
| ROUT | 2.00000000e+6 | ohm | held compact OTA output-resistance approximation |
| RBUF | 2.50000000e+1 | ohm | held compact Darlington-buffer resistance |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| transconductance at 1e-06 A IABC | 1.900000e-5 | 1.903983e-5 | S | 0.210% | p. 7 fig. 8 |
| transconductance at 1e-05 A IABC | 1.900000e-4 | 1.903983e-4 | S | 0.210% | p. 7 fig. 8 |
| transconductance at 0.0001 A IABC | 1.900000e-3 | 1.903983e-3 | S | 0.210% | p. 7 fig. 8 |
| transconductance at 0.0005 A IABC | 9.600000e-3 | 9.519916e-3 | S | 0.834% | p. 7 fig. 8 |
| transconductance at 0.001 A IABC | 1.900000e-2 | 1.903983e-2 | S | 0.210% | p. 7 fig. 8 |
| amplifier-bias pin voltage at 1e-06 A | 1.220000e+0 | 1.282585e+0 | V | 5.130% | p. 7 fig. 10 |
| amplifier-bias pin voltage at 1e-05 A | 1.280000e+0 | 1.285045e+0 | V | 0.394% | p. 7 fig. 10 |
| amplifier-bias pin voltage at 0.0001 A | 1.380000e+0 | 1.309645e+0 | V | 5.098% | p. 7 fig. 10 |
| amplifier-bias pin voltage at 0.0005 A | 1.470000e+0 | 1.418978e+0 | V | 3.471% | p. 7 fig. 10 |
| amplifier-bias pin voltage at 0.001 A | 1.520000e+0 | 1.555643e+0 | V | 2.345% | p. 7 fig. 10 |

Worst fitting error: 5.130% for amplifier-bias pin voltage at 1e-06 A.

Native and WASM agreement: all 7 benches passed. Worst reported relative delta was 1.957e-10 and worst absolute delta was 9.179e-11.

## Known omissions

- Both OTA channels, linearizing-diode pins, bias-current pins, and Darlington buffers are present. Channel matching, crosstalk, shared-supply modulation, package parasitics, and process spread are omitted.
- The OTA uses the cited differential-pair equation with a fitted scale factor. Linearizing diodes are represented as junctions, but externally biased diode linearization, distortion reduction, and the full large-signal transistor transfer are not curve-fitted.
- The amplifier-bias input uses a fitted compact voltage-plus-resistance law rather than an internal current mirror. Output resistance and buffer output resistance are held compact defaults; the buffer has a first-order Darlington drop and smooth 20 mA limit.
- Slew rate, output noise, input capacitance, output capacitance, leakage, temperature curves, overload recovery, supply failure, self-heating, and production spread are omitted or metadata-only. P5 independent review passed F2: seven native and WASM benches and an independent 50 uA bias probe passed; bias-pin checks were tightened to an 80 mV absolute tolerance so rail-referenced values cannot mask physical error.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
