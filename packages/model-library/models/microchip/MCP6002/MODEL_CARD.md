# MCP6002 model card

## Identity

- Manufacturer: Microchip Technology
- Description: Dual rail-to-rail low-power 1 MHz CMOS operational amplifier
- Electrical family: opamp
- Fidelity tier: F2, datasheet-anchored
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://ww1.microchip.com/downloads/aemDocuments/documents/MSLD/ProductDocuments/DataSheets/MCP6001-1R-1U-2-4-Low-Power-1-MHz-Op-Amp-Family-Data-Sheet-DS20001733.pdf
- Revision: DS20001733L, 2020
- Accessed: 2026-08-07
- Referenced pages: p. 1, p. 3, p. 4, p. 8, p. 9
- SHA-256: `4f879ab31115ecfa149dfea62073c9efdbc4beccbdfc3a8d7e10281f3877f8fb`
- Acquisition: official ww1.microchip.com PDF cached after browser-UA retries; PDF signature, title, revision, MPN, and SHA-256 verified
- Basis: original model generated from public factual specifications
- Vendor SPICE models used: none

## Domain coverage

| Domain | Coverage |
| --- | --- |
| dc | fitted |
| ac | fitted |
| transient | fitted |
| noise | fitted |
| thermal | none |
| digital | none |

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| AOL | 3.98107171e+05 | direct TYP transcription |
| GBW | 1.03340875e+06 | native calibrated to TYP |
| SR | 6.20109648e+05 | native calibrated to TYP |
| IBIAS | 1.00000000e-12 | direct TYP transcription |
| IOS | 1.00000000e-12 | direct TYP transcription |
| VOS | 0.00000000e+00 | held at zero because no TYP is published |
| ROUT | 1.08695652e+00 | derived from published output boundary and TYP short-circuit current |
| ILIM | 2.30000000e-02 | direct TYP transcription |
| VDRP_H | 2.47037905e-02 | native fitted to guaranteed output boundary; no TYP published |
| VDRP_L | 2.47037905e-02 | native fitted to guaranteed output boundary; no TYP published |
| FP2 | 1.03340875e+08 | held at 100 times calibrated GBW to represent the published 90 degree TYP phase margin without a zero-frequency pole |
| CMRR | 6.30957344e+03 | derived from direct TYP dB value |
| PSRR | 1.99526231e+04 | derived from direct TYP dB value |
| VSUP_NOM | 5.50000000e+00 | datasheet test supply |
| IQ | 1.00000000e-04 | direct TYP transcription |
| EN | 2.80000000e-08 | direct TYP transcription |

## Held defaults

| Parameter | Value | Unit | Reason |
| --- | ---: | --- | --- |
| VOS | 0.00000000e+00 | V | no TYP offset is published; production limits are retained |
| CC | 3.00000000e-11 | F | held internal archetype scale |
| CDIF | 1.00000000e-12 | F | held floating-input convergence capacitance |
| RE | 1.00000000e+06 | ohm | held internal DC path |
| CP2 | 1.00000000e-12 | F | held second-pole scale |
| RQ | 1.00000000e+06 | ohm | held clamp-node DC path |
| phase_margin_pole_ratio | 1.00000000e+02 | 1 | finite numerical representation of the published 90 degree TYP phase margin |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| open-loop gain | 3.981072e+05 | 3.980897e+05 | V/V | 0.004% | p. 3 DC electrical specifications, TYP column |
| unity-gain bandwidth | 1.000000e+06 | 9.999934e+05 | Hz | 0.001% | p. 4 AC electrical specifications, TYP column |
| slew rate | 6.000000e+05 | 6.000000e+05 | V/s | 0.000% | p. 4 AC electrical specifications, TYP column |
| high output boundary | 5.475000e+00 | 5.475000e+00 | V | 0.000% | p. 3 maximum output voltage swing row, MAX boundary |
| low output boundary | 2.500000e-02 | 2.500000e-02 | V | 0.000% | p. 3 maximum output voltage swing row, MIN boundary |

Worst fitting error: 0.004% for open-loop gain.

Native and WASM agreement: all 7 supported comparison benches passed. 1 noise bench was checked natively because the repository compare CLI does not accept noise analysis. Worst cross-engine relative delta was 7.735e-02.

## Known omissions

- Output-stage distortion, crossover distortion, slew-induced distortion, and overload recovery are not modelled.
- Input common-mode range is not enforced. The rail-to-rail input boundary is metadata only.
- PSRR and CMRR are frequency-independent constants.
- The frequency response is a two-pole approximation. Higher-order poles and zeros are not modelled.
- Only broadband input voltage noise is modelled. Flicker noise and input current noise are not.
- No self-heating or temperature coefficients are modelled. All benches set .temp 25.
- Quiescent current is constant and does not vary with supply, temperature, output loading, or channel activity.
- No TYP input offset is published, so nominal VOS is held at zero while the +/-4.5 mV production limits remain metadata.
- No TYP output swing is published. Rail drop is fitted conservatively to the guaranteed 25 mV boundary at 5.5 V and is pessimistic versus a typical device.
- ROUT is derived from the output boundary and TYP short-circuit current because no open-loop output impedance is published.
- The published 90 degree TYP phase margin is represented with FP2 at 100 times GBW to avoid an invalid zero-frequency pole.
- Input protection diodes and ESD structures are not modelled.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
