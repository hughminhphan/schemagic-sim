# 1N5819 model card

## Identity

- Manufacturer: onsemi
- Description: 1 A Schottky barrier rectifier diode
- Electrical family: diode, Schottky variant K
- Fidelity tier: F2, datasheet-fitted
- Independent reviewer: pending-review

## Provenance

- Primary datasheet: https://www.onsemi.com/download/data-sheet/pdf/1n5817-d.pdf
- Revision: August 2021, Rev. 11
- Accessed: 2026-08-08
- SHA-256: `b2ebdf63715a4ff42da7d257c8fa503b6fef0178b8942d166da37ac52acea0a5`
- Legacy dedicated PDF cross-check: https://www.onsemi.com/download/data-sheet/pdf/1n5819-d.pdf, SHA-256 `16f59e39d50f9cd20b3bd074283b666514ab51c29be987a01f5861461d70dca5`
- Vendor SPICE models used: none

## Fit and validation

The reverse-dominated branch was fitted first, then frozen while IS, N, and RS were fitted to the 25 degC typical forward curve with native ngspice-46 in the optimization loop. CJO, VJ, and M were fitted to seven points from the 1 MHz typical capacitance curve. The deterministic solver used `diff_step=1e-4`. The worst forward absolute log-current residual is 0.097, below the 0.223 archetype threshold. The worst capacitance residual is 15.65 percent, below the 20 percent threshold.

| IF (A) | Datasheet VF (V) | Model VF (V) | Absolute log-current residual |
| ---: | ---: | ---: | ---: |
| 0.02 | 0.230 | 0.2282 | 0.040 |
| 0.05 | 0.270 | 0.2695 | 0.010 |
| 0.1 | 0.300 | 0.3009 | 0.019 |
| 0.3 | 0.350 | 0.3535 | 0.067 |
| 1 | 0.430 | 0.4273 | 0.035 |
| 3 | 0.560 | 0.5448 | 0.097 |
| 10 | 0.820 | 0.8545 | 0.086 |

## Known omissions

- Reverse breakdown is not modelled. BV is absent, so operation above the rated 40 V envelope is unsupported.
- Schottky majority-carrier device: no minority-carrier storage, TT is zero by construction.
- Temperature scaling beyond the 25 degC fit is not validated.
- Package parasitics, self-heating, noise, process spread, and ageing are omitted.

## Licence

MIT. See `LICENSE`. The model is original work generated from public factual specifications and is not copied or adapted from a vendor SPICE model.
