# LM35 model card

## Identity

- Manufacturer: Texas Instruments
- Description: Precision centigrade temperature sensor with 10 mV/degC analog output
- Electrical family: other
- Fidelity tier: F1, datasheet-constrained
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://www.ti.com/lit/ds/symlink/lm35.pdf
- Revision: SNIS159H, August 1999, revised December 2017
- Accessed: 2026-08-08
- Referenced pages: p. 1, p. 4, p. 5
- SHA-256: `beb5db9eea91a092c9315d5ac53ba6a7744ab518a76cc9cf53b424c74ed68625`
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
| SCALE | 1.00000000e-2 | native fitted |
| OFFSET | 0.00000000e+0 | native fitted |
| ROUT | 5.00000000e-1 | derived from cited load regulation |
| IQ | 5.60000000e-5 | direct typical transcription |
| VDROP | 2.50000000e+0 | derived from cited minimum supply and maximum output |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| output voltage at 2 degC | 2.000000e-2 | 2.000000e-2 | V | 0.000% | p. 1 linear 10-mV/degC scale factor; p. 5 sensor gain |
| output voltage at 25 degC | 2.500000e-1 | 2.500000e-1 | V | 0.000% | p. 1 linear 10-mV/degC scale factor; p. 5 sensor gain |
| output voltage at 150 degC | 1.500000e+0 | 1.500000e+0 | V | 0.000% | p. 1 linear 10-mV/degC scale factor; p. 5 sensor gain |

Worst fitting error: 0.000% for output voltage at 2 degC.

Native and WASM agreement: all 3 benches passed. Worst reported relative delta was 0.000e+0 and worst absolute delta was 0.000e+0.

## Known omissions

- TEMP_C is caller supplied; package heat flow and thermal gradients are not simulated.
- The 10 mV/degC nominal transfer is modelled, but the accuracy, nonlinearity, manufacturing spread, long-term drift, and temperature-dependent quiescent current are metadata only.
- Response time and output capacitance stability are not modelled.
- The basic positive-supply model is limited to 2 degC and above; the external resistor and negative supply required below 2 degC are not internalised.
- Independent review remains pending-review.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
