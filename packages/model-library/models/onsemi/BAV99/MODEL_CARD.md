# BAV99 model card

## Identity

- Manufacturer: onsemi
- Description: Single-junction approximation of the BAV99 dual series switching diode
- Fidelity tier: F1
- Independent reviewer: pending-review

## Provenance

- Manufacturer product page: https://www.onsemi.com/products/discrete-power-modules/diodes/BAV99
- Official PDF attempted: https://www.onsemi.com/pdf/datasheet/bav99lt1-d.pdf
- Revision: official product specification fallback; PDF and product page access blocked
- Accessed: 2026-08-07
- Source response SHA-256: `6efc43969ace3a525a8c9549654e33db019f54862c9d5f16ff8aecb117a4a076`
- Vendor SPICE models used: none

## Validation

This fallback model checks published maximum forward voltage and reverse leakage bounds at explicit 25 degC datasheet conditions. Native/WASM agreement and package-schema validation are recorded in `validation-results.json`.

## Known omissions

- Official manufacturer PDF and HTML product page were unreachable after repeated HTTPS attempts; this is a manufacturer spec-page fallback and is capped at F1.
- IS, N, and RS are held at conservative physical/default-fit values to remain below the published forward-voltage maximum; no typical forward-IV curve was fitted.
- ISR and NR are held at default; the reverse-leakage row is a maximum bound, not a typical target.
- IKF is held at default; high-injection roll-off is not modelled.
- CJO, VJ, and M are held at default because no verifiable capacitance curve was available.
- TT is held at default 0 s; reverse recovery is not modelled because no verified trr input was available.
- BV, IBV, and NBV are held at defaults; reverse breakdown is not modelled.
- EG, XTI, and TNOM are held at physical defaults; only 25 degC behavior is claimed.
- No self-heating: junction temperature is fixed at TNOM. Thermal derating is not modelled.
- Package parasitics (lead inductance and package capacitance) are not modelled.
- Flicker noise is not modelled: KF and AF are held at defaults.
- BAV99 is a dual-series device; this package models one junction as a two-terminal approximation and does not model the three-lead internal connection.
