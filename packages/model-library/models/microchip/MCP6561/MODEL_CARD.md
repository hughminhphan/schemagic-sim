# MCP6561 model card

## Identity

- Manufacturer: Microchip Technology
- Description: Single low-power 1.8 V push-pull output comparator with internal hysteresis
- Electrical family: comparator
- Fidelity tier: F1, datasheet-anchored
- Independent reviewer: pending-review

## Provenance

- Datasheet: https://ww1.microchip.com/downloads/en/DeviceDoc/22139C.pdf
- Revision: DS22139C, 2013
- Accessed: 2026-08-07
- Referenced pages: p. 1, p. 3, p. 4
- SHA-256: `322684ee33f81cbdcf48f5b60da284add534fb32c3f2b0834b9a7b57535377b3`
- Acquisition: official ww1.microchip.com PDF cached after browser-UA retries; PDF signature, title, revision, MPN, and SHA-256 verified
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
| AOL | 1.00000000e+05 | held behavioral default; not published |
| VOS | 3.00000000e-03 | direct TYP magnitude; nominal sign arbitrary |
| IBIAS | 1.00000000e-12 | direct TYP transcription |
| IOS | 1.00000000e-12 | direct TYP transcription |
| TPD | 3.87399189e-08 | native calibrated to average of the two 100 mV overdrive TYP edges at 5.5 V |
| ROUT | 7.00000000e+01 | derived and calibrated against loaded output boundaries |
| ILIM | 3.00000000e-02 | direct TYP short-circuit current |
| VDRP_H | 1.26129108e-01 | native fitted to loaded guaranteed boundary; no TYP level published |
| VDRP_L | 2.61291083e-02 | native fitted to loaded guaranteed boundary; no TYP level published |
| VHYST | 1.50000000e-03 | half of held midpoint of published MIN/MAX window; no TYP published |
| IQ | 1.00000000e-04 | direct TYP transcription |

## Held defaults

| Parameter | Value | Unit | Reason |
| --- | ---: | --- | --- |
| AOL | 1.00000000e+05 | V/V | datasheet publishes no large-signal gain |
| VHYST_total | 3.00000000e-03 | V | midpoint of 1 mV MIN and 5 mV MAX because no TYP is published |
| VCLAMP | 1.00000000e+00 | V | held internal bounded-gain scale |
| KSW | 2.00000000e+01 | 1 | held smoothing sharpness |
| CD | 1.00000000e-11 | F | held internal delay scale |
| CDIF | 1.00000000e-12 | F | held convergence capacitance |
| RQ | 1.00000000e+06 | ohm | held internal-node DC path |

## Fitted versus datasheet

| Quantity | Datasheet | Fitted | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| propagation delay low-to-high | 4.700000e-08 | 4.046809e-08 | s | 13.898% | p. 4 propagation delay row, TYP column |
| propagation delay high-to-low | 3.400000e-08 | 4.053219e-08 | s | 19.212% | p. 4 propagation delay row, TYP column |
| loaded high-level output boundary | 4.800000e+00 | 4.800000e+00 | V | 0.000% | p. 3 high-level output voltage row, MIN column |
| loaded low-level output boundary | 6.000000e-01 | 6.000000e-01 | V | 0.000% | p. 3 low-level output voltage row, MAX column |

Worst fitting error: 19.212% for propagation delay high-to-low.

Native and WASM agreement: all 6 supported comparison benches passed. 0 noise bench was checked natively because the repository compare CLI does not accept noise analysis. Worst cross-engine relative delta was 2.814e-11.

## Known omissions

- Propagation delay is one fitted constant taken from the 100 mV overdrive rows at 5.5 V. Delay variation with overdrive, supply, and edge direction is approximate.
- The datasheet publishes no large-signal gain, so AOL is a disclosed held behavioral default.
- The datasheet publishes only a 1 mV MIN and 5 mV MAX hysteresis window, so the nominal 3 mV window is a disclosed midpoint, not a TYP value.
- Output high and low behavior is fitted conservatively to loaded guaranteed boundaries because no TYP output levels are published.
- Input common-mode range is not enforced. VICR is metadata only.
- No self-heating or temperature coefficients are modelled. All benches set .temp 25.
- Quiescent current is constant and noise is not modelled.
- Input protection diodes and ESD structures are not modelled.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
