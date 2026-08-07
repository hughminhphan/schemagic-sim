# BF256B model card

## Identity

- Manufacturer: Nexperia
- Electrical family: N-channel JFET
- Fidelity tier: F1
- Independent reviewer: pending-review

## Provenance

- Specification page: https://www.nexperia.com/product/BF256B
- Revision: Official Nexperia HTML product/specification table; accessed 2026-08-07
- Accessed: 2026-08-07
- Source SHA-256: `2ac2a29d67800d5de2828c2124e6767efea31e7217365e6d45b7417236581813`
- Vendor SPICE models used: none

## Fit and semantics

The BF256B IDSS and VGS(off) values are bin limits, not typical targets. VTO and BETA place the model inside the published B-bin window. Ciss and Crss are single-point derived. The 1 kHz noise figure is metadata only and is not fitted.

## Validation

Pending factory validation. Benches cover IDSS bounds, cutoff-window boundary, capacitance, and the VDS=15 V supported-region edge.

## Known omissions

- Nexperia PDF and direct product page are challenge-gated; official HTML specification-table fallback is used and fidelity is capped at F1.
- IDSS and VGS(off) are published as a bin window, not a typical target. The model is centered inside the window and does not represent production spread.
- LAMBDA and B are held family defaults because no accessible output or transfer curve was available.
- RD and RS are at the numerical floor because no on-resistance is published.
- CGS and CGD are derived from single Ciss and Crss points with PB and M held defaults; capacitance versus bias is approximate.
- Noise is not fitted from the single 1 kHz noise-voltage point; KF and AF remain defaults.
- No self-heating, temperature coefficients, breakdown, or package parasitics are modelled.
- Reviewer remains pending-review.

## Licence

MIT. See `LICENSE`.
