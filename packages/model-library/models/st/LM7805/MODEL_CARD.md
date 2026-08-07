# LM7805 model card

## Identity

- Manufacturer: STMicroelectronics
- Description: 5 V positive linear voltage regulator
- Electrical family: vreg_linear
- Fidelity tier: F1, official manufacturer HTML fallback
- Independent reviewer: pending-review

## Provenance

- Official specification page: https://estore.st.com/en/l7805cv-cpn.html
- Revision: Live ST eStore product page snapshot, accessed 2026-08-07
- Accessed: 2026-08-07
- Referenced sections: Parameters, Description, Key features
- HTML SHA-256: `dab64661ba0fd5c53e89a8168299a82e098d3ce8ac0ce05e28535545aae0ac04`
- Vendor SPICE models used: none

## Model parameters

| Parameter | Value | Status |
| --- | ---: | --- |
| VREF | 5 | datasheet_typical_or_derived |
| VDROP | 2 | held_default |
| ILIM | 3 | held_default |
| LOADREG | 0.05 | held_default |
| DILOAD | 1.5 | held_default |
| LINEREG | 0 | held_default |
| DVLINE | 1 | held_default |
| VNOM | 10 | held_default |
| IQ | 0.005 | held_default |
| RNEG | 1 | held_default |
| EPS | 1e-08 | held_default |

## Fitted versus official product-page endpoints

| Quantity | Product page | Model | Unit | Relative error | Citation |
| --- | ---: | ---: | --- | ---: | --- |
| nominal/reference endpoint | 5 | 4.9996741 | V | 0.007% | Official ST eStore active product heading and Key features |
| output at 1.5 A boundary | 5 | 4.9450694 | V | 1.099% | Official ST eStore Key features output-current capability |

Worst fitting error: 1.099% for output at 1.5 A boundary.

Native and WASM agreement: all 3 benches passed. Worst relative engine delta was 8.448e-16; worst absolute delta was 4.441e-15.

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

## Licence

MIT. See `LICENSE`. Reviewer remains pending-review.
