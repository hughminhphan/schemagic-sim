# LM317T model card

## Identity

- Manufacturer: STMicroelectronics
- Description: Positive adjustable linear voltage regulator
- Electrical family: vreg_linear
- Fidelity tier: F1, official manufacturer HTML fallback
- Independent reviewer: pending-review

## Provenance

- Official specification page: https://estore.st.com/en/lm317t-dg-cpn.html
- Revision: Live ST eStore product page snapshot, accessed 2026-08-07
- Accessed: 2026-08-07
- Referenced sections: Parameters, Description, Key features
- HTML SHA-256: `f31f0b2aadaa657365a7b733446587a38423cbc8717cc76bd9b138f18c2defae`
- Vendor SPICE models used: none

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| VREF | 1.2 | datasheet_typical_or_derived |
| VDROP | 3 | held_default |
| ILIM | 3 | held_default |
| LOADREG | 0.012 | held_default |
| DILOAD | 1.5 | held_default |
| IADJ | 5e-05 | held_default |
| RNEG | 1 | held_default |
| EPS | 1e-08 | held_default |

## Fitted versus official product-page endpoints

| Quantity | Product page | Model | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| nominal/reference endpoint | 1.2 | 1.1999512 | V | 0.004% | Official ST eStore active product heading and Key features |
| output at 1.5 A boundary | 1.2 | 1.1868168 | V | 1.099% | Official ST eStore Key features output-current capability |

Worst fitting error: 1.099% for output at 1.5 A boundary.

Native and WASM agreement: all 3 benches passed. Worst relative engine delta was 1.791e-14; worst absolute delta was 9.415e-14.

## Known omissions

- Thermal shutdown is not modelled. The regulator does not shut down or fold back when it overheats; it will dissipate arbitrary power indefinitely.
- Safe-operating-area foldback is not modelled. The current limit is a constant, whereas a real regulator reduces it at high input-to-output differential.
- No self-heating and no temperature coefficients. Output voltage drift, dropout increase, and quiescent-current change with temperature are not modelled.
- Reverse current from OUT to IN is not modelled beyond a protective clamp. Discharging the output through the regulator does not reproduce the real part behavior.
- AC behaviour is not modelled: there is no control-loop pole, no output impedance versus frequency, and no ripple rejection. PSRR and transient load-step response are absent.
- Loop stability is not modelled. This model regulates with any output capacitor or none.
- Start-up behaviour, soft-start and inrush are not modelled.
- Noise is not modelled.
- Output or reference voltage is set to the official product-page nominal endpoint; a real part has production spread.
- The official ST datasheet PDF and main product pages were unreachable after repeated attempts. Provenance falls back to the official ST eStore specification page, so fidelity is capped at F1.
- The eStore page does not publish dropout, quiescent or adjustment current, peak current limit, or line/load regulation measurement ranges. Those parameters are held defaults and are not claimed as fitted facts.
- RNEG = 1 ohm, EPS = 1e-8 V^2, RSER = 1e7 ohm, and RER = 1 megohm are held archetype constants.
- The adjustment-pin current is a held constant because the eStore page does not publish it.
- Line/load regulation percentages were not fitted because the eStore page omits their measurement ranges.

## Licence

MIT. See `LICENSE`. Reviewer remains pending-review.
