# Batch 3 independent review log

Review date: 2026-08-10

Reviewer: gpt-5.6-sol independent reviewer (batch-3 scale campaign)

Branch: `main`

## Verdict

- Reviewed: 107 staged packages, comprising 22 Phase-A salvages and 85 fresh candidates.
- Promoted: 100, comprising 19 Phase-A and 81 fresh packages.
- Rejected: 7. No staged tier was demoted.
- Final reviewed library: 359 packages, from the 259-package baseline plus 100 promotions.
- Promotion by tier: 79 F1 and 21 F2.
- Promotion by family: 15 BJT NPN, 6 BJT PNP, 29 diode, 21 NMOS, and 29 PMOS.

## Independent method

1. Reconciled all selection and execution records with the exact 107 staged package directories. The 42 non-staged outcomes remain non-reviewed execution outcomes, not library packages.
2. Reproduced all 107 primary PDF SHA-256 values, verified cited page ranges, and inspected primary identity evidence.
3. Audited canonical identities, ordering and marking aliases, manufacturers, package paths, catalog targets, and primary PDF identities against the 259-package baseline and across all candidates.
4. Compared complete fitted parameter vectors across the baseline and candidates. No promoted complete-vector duplicate remains.
5. Audited every contract, source record, fact record, fitted vector, SPICE model, expectation, bench, validation result, model card, supported scope, and review marker.
6. Reran all 107 staged validators on unchanged scratch copies. All 354 original benches and 631 original declared checks passed native ngspice-46 and pinned WASM comparison.
7. Independently tested omitted defining hard bounds against unchanged models. Passing checks were added only to promoted copies. Three packages failed published VBE(sat) maxima and were rejected without refitting.
8. Recomputed and inspected all 22 staged F2 residual claims against unchanged `fit-gates.json`, including point counts, SI axes, polarity, 25 C bias, one-sided maximum handling, held parameters, and physical-bound saturation. Twenty-one survived; one was rejected only for canonical collision.
9. Audited the 22 Phase-A salvages against the documented pre-repair defects and commit `9699838`. Nineteen survived. B772 was rejected because its narrowed F1 contract still fails the original published VBE(sat) maximum. Two AO3401 salvages were rejected by the candidate identity gate.
10. Removed pending-review markers and installed established independent-review metadata only in promoted copies. Staging was not modified.

## Hard-bound and scope corrections

- Added 12 published BJT hFE maximum checks to unchanged passing models.
- Added 53 published BJT saturation-voltage minimum or maximum checks to unchanged passing models.
- Added 9 previously absent diode reverse-leakage maximum checks.
- Added 5 Zener voltage minimum and maximum checks at the cited test current.
- Canonicalized `BFP650`, `2N3904S`, and `JSM2301S-2A`, retaining the staged ordering codes as aliases.
- Narrowed all 21 promoted F2 packages to their exact fitted 25 C DC curve evidence. BJT scalar saturation and gain limits, and diode reverse leakage limits, do not extend curve-fit fidelity.
- Corrected four held-IS explanations where VBE evidence exists but was not included in the hFE-only fit. No parameter value was changed.
- No model parameter was refitted and no factory or conveyor code was changed.

## Collision decisions

- `AO3401`: retained `fosan/AO3401`; rejected Guangdong Hottech and TWGMC counterparts. The retained record has the strongest five-page primary evidence and six complete hard checks.
- `BC856B`: retained `umw-youtai-co-ltd/BC856B`; rejected Guangdong Hottech. The retained record has six fitted points and eleven checks.
- `15N10`: retained `umw-youtai-co-ltd/15N10`; rejected HL. The retained record has the newer dated ten-page primary PDF.
- No promoted canonical identity, alias, or complete fitted vector collides with the prior library or another promotion.

## Rejections

| Staged package | Origin | Tier | Class | Evidence |
| --- | --- | --- | --- | --- |
| `fosan/PXT8050` | fresh | F1 | published-hard-bound-failure | Unchanged model produces VBE(sat) 1.678697 V against the published inclusive 1.2 V maximum at IC=0.8 A and IB=0.08 A. |
| `fosan/SS8550S` | fresh | F1 | published-hard-bound-failure | Unchanged model produces VBE(sat) 1.679041 V against the published inclusive 1.2 V maximum at IC=0.5 A and IB=0.05 A. |
| `jiangsu-changjing-electronics-co-ltd/B772-RANGE-160-320` | phase-a | F1 | phase-a-salvage-hard-bound-failure | The repaired gain check passes, but unchanged model VBE(sat) is 2.968558 V against the published inclusive 1.5 V maximum at IC=1 A and IB=0.1 A. The salvage narrowed away the original material defect. |
| `guangdong-hottech/AO3401` | phase-a | F1 | candidate-canonical-identity-collision | Canonical AO3401 collision. Retained FOSAN AO3401 because its five-page primary PDF and six checks provide the strongest complete evidence record. |
| `twgmc/AO3401` | phase-a | F1 | candidate-canonical-identity-collision | Canonical AO3401 collision. Retained FOSAN AO3401 because its five-page primary PDF and six checks provide the strongest complete evidence record. |
| `guangdong-hottech/BC856B` | fresh | F2 | candidate-canonical-identity-collision | Canonical BC856B collision. Retained UMW BC856B because it has six fitted 25 C hFE points and eleven declared checks versus five points and ten checks. |
| `hl/15N10` | fresh | F1 | candidate-canonical-identity-collision | Canonical 15N10 collision. Retained UMW 15N10 because its dated November 2024 ten-page primary PDF is newer and more extensive than the five-page counterpart. |

Grouped totals: 4 candidate canonical-identity collisions and 3 published hard-bound failures.

## Per-package verdicts

| Staged package | Origin | Original tier | Final canonical MPN | Family | Verdict | Corrections |
| --- | --- | --- | --- | --- | --- | --- |
| `allpower-shenzhen-quan-li/AP2003` | fresh | F1 | `AP2003` | nmos | Promote F1 | review metadata only |
| `allpower-shenzhen-quan-li/AP40P05` | fresh | F1 | `AP40P05` | pmos | Promote F1 | review metadata only |
| `allpower-shenzhen-quan-li/AP4435C` | fresh | F1 | `AP4435C` | pmos | Promote F1 | review metadata only |
| `alpha-omega-semicon/AO3402` | fresh | F1 | `AO3402` | nmos | Promote F1 | review metadata only |
| `alpha-omega-semicon/AOD409` | fresh | F1 | `AOD409` | pmos | Promote F1 | review metadata only |
| `bl-shanghai-belling/BLM3401` | fresh | F1 | `BLM3401` | pmos | Promote F1 | review metadata only |
| `diodes/DMG1012T-7` | fresh | F1 | `DMG1012T-7` | nmos | Promote F1 | review metadata only |
| `doingter/DO2301E-Q` | fresh | F1 | `DO2301E-Q` | pmos | Promote F1 | review metadata only |
| `elecsuper/SI2300` | fresh | F1 | `SI2300` | nmos | Promote F1 | review metadata only |
| `fosan/AO3401` | phase-a | F1 | `AO3401` | pmos | Promote F1 | review metadata only |
| `fosan/PXT8050` | fresh | F1 | None | bjt_npn | Reject | published-hard-bound-failure |
| `fosan/SS8550S` | fresh | F1 | None | bjt_pnp | Reject | published-hard-bound-failure |
| `goodwork/AO3415` | fresh | F1 | `AO3415` | pmos | Promote F1 | review metadata only |
| `guangdong-hottech/2SC3356` | fresh | F2 | `2SC3356` | bjt_npn | Promote F2 | Narrowed F2 supported scope to the exact fitted 25 C curve, bias, and range; scalar hard bounds do not extend curve fidelity. |
| `guangdong-hottech/AO3401` | phase-a | F1 | None | pmos | Reject | candidate-canonical-identity-collision |
| `guangdong-hottech/AO3407` | phase-a | F1 | `AO3407` | pmos | Promote F1 | review metadata only |
| `guangdong-hottech/BC856B` | fresh | F2 | None | bjt_pnp | Reject | candidate-canonical-identity-collision |
| `guangdong-hottech/SI2305` | phase-a | F1 | `SI2305` | pmos | Promote F1 | review metadata only |
| `hl/15N10` | fresh | F1 | None | nmos | Reject | candidate-canonical-identity-collision |
| `hl/3400` | fresh | F1 | `3400` | nmos | Promote F1 | review metadata only |
| `hl/40N06D` | fresh | F1 | `40N06D` | nmos | Promote F1 | review metadata only |
| `hongjiacheng/1SMA4733A` | fresh | F1 | `1SMA4733A` | diode | Promote F1 | Added and passed unchanged-model published hard-bound checks: reverse_leakage_maximum, zener_voltage_at_test_current. |
| `hongjiacheng/1SMA4743A` | fresh | F1 | `1SMA4743A` | diode | Promote F1 | Added and passed unchanged-model published hard-bound checks: reverse_leakage_maximum. |
| `hongjiacheng/2SC2383` | fresh | F1 | `2SC2383` | bjt_npn | Promote F1 | Added and passed unchanged-model published hard-bound checks: hfe_maximum_at_0.2_a, vce_sat_maximum_1. |
| `hongjiacheng/B0530WS` | fresh | F2 | `B0530WS` | diode | Promote F2 | Narrowed F2 supported scope to the exact fitted 25 C curve, bias, and range; scalar hard bounds do not extend curve fidelity. |
| `hongjiacheng/B5818WS` | fresh | F2 | `B5818WS` | diode | Promote F2 | Narrowed F2 supported scope to the exact fitted 25 C curve, bias, and range; scalar hard bounds do not extend curve fidelity. |
| `hongjiacheng/BAS40-04` | fresh | F1 | `BAS40-04` | diode | Promote F1 | Added and passed unchanged-model published hard-bound checks: reverse_leakage_maximum. |
| `hongjiacheng/BAW56` | fresh | F2 | `BAW56` | diode | Promote F2 | Narrowed F2 supported scope to the exact fitted 25 C curve, bias, and range; scalar hard bounds do not extend curve fidelity. |
| `hongjiacheng/BZT52C12S` | fresh | F1 | `BZT52C12S` | diode | Promote F1 | Added and passed unchanged-model published hard-bound checks: reverse_leakage_maximum, zener_voltage_at_test_current. |
| `hongjiacheng/BZT52C33` | fresh | F1 | `BZT52C33` | diode | Promote F1 | Added and passed unchanged-model published hard-bound checks: reverse_leakage_maximum, zener_voltage_at_test_current. |
| `hongjiacheng/BZT52C3V0S` | fresh | F1 | `BZT52C3V0S` | diode | Promote F1 | Added and passed unchanged-model published hard-bound checks: reverse_leakage_maximum, zener_voltage_at_test_current. |
| `hongjiacheng/BZX584C2V4` | fresh | F1 | `BZX584C2V4` | diode | Promote F1 | Added and passed unchanged-model published hard-bound checks: reverse_leakage_maximum, zener_voltage_at_test_current. |
| `hongjiacheng/DSK16` | phase-a | F1 | `DSK16` | diode | Promote F1 | review metadata only |
| `hongjiacheng/DSK22` | phase-a | F1 | `DSK22` | diode | Promote F1 | review metadata only |
| `hongjiacheng/DSK220` | fresh | F2 | `DSK220` | diode | Promote F2 | Narrowed F2 supported scope to the exact fitted 25 C curve, bias, and range; scalar hard bounds do not extend curve fidelity. |
| `hongjiacheng/ES1DW` | fresh | F1 | `ES1DW` | diode | Promote F1 | review metadata only |
| `hongjiacheng/ES2JF` | fresh | F1 | `ES2JF` | diode | Promote F1 | review metadata only |
| `hongjiacheng/ES3JB` | fresh | F2 | `ES3JB` | diode | Promote F2 | Narrowed F2 supported scope to the exact fitted 25 C curve, bias, and range; scalar hard bounds do not extend curve fidelity. |
| `hongjiacheng/FR107W` | phase-a | F1 | `FR107W` | diode | Promote F1 | review metadata only |
| `hongjiacheng/HL2303` | phase-a | F1 | `HL2303` | pmos | Promote F1 | review metadata only |
| `hongjiacheng/HL2305` | phase-a | F1 | `HL2305` | pmos | Promote F1 | review metadata only |
| `hongjiacheng/HL3415A` | phase-a | F1 | `HL3415A` | pmos | Promote F1 | review metadata only |
| `hongjiacheng/M4` | fresh | F2 | `M4` | diode | Promote F2 | Narrowed F2 supported scope to the exact fitted 25 C curve, bias, and range; scalar hard bounds do not extend curve fidelity. |
| `hongjiacheng/MM1Z2V7` | fresh | F1 | `MM1Z2V7` | diode | Promote F1 | Added and passed unchanged-model published hard-bound checks: reverse_leakage_maximum. |
| `hongjiacheng/RB521S-30` | fresh | F2 | `RB521S-30` | diode | Promote F2 | Narrowed F2 supported scope to the exact fitted 25 C curve, bias, and range; scalar hard bounds do not extend curve fidelity. |
| `hongjiacheng/RS3MF` | fresh | F1 | `RS3MF` | diode | Promote F1 | review metadata only |
| `hongjiacheng/S2MB` | fresh | F2 | `S2MB` | diode | Promote F2 | Narrowed F2 supported scope to the exact fitted 25 C curve, bias, and range; scalar hard bounds do not extend curve fidelity. |
| `hongjiacheng/S5MB` | fresh | F1 | `S5MB` | diode | Promote F1 | review metadata only |
| `hongjiacheng/SMBJ5339B` | fresh | F1 | `SMBJ5339B` | diode | Promote F1 | Added and passed unchanged-model published hard-bound checks: reverse_leakage_maximum. |
| `hongjiacheng/SS210` | fresh | F2 | `SS210` | diode | Promote F2 | Narrowed F2 supported scope to the exact fitted 25 C curve, bias, and range; scalar hard bounds do not extend curve fidelity. |
| `hongjiacheng/SS320F` | fresh | F2 | `SS320F` | diode | Promote F2 | Narrowed F2 supported scope to the exact fitted 25 C curve, bias, and range; scalar hard bounds do not extend curve fidelity. |
| `hongjiacheng/SS510B` | phase-a | F1 | `SS510B` | diode | Promote F1 | review metadata only |
| `hongjiacheng/SS58` | fresh | F1 | `SS58` | diode | Promote F1 | review metadata only |
| `hongjiacheng/US1M` | fresh | F2 | `US1M` | diode | Promote F2 | Narrowed F2 supported scope to the exact fitted 25 C curve, bias, and range; scalar hard bounds do not extend curve fidelity. |
| `hxy-mosfet/AO3400-ED` | fresh | F1 | `AO3400-ED` | nmos | Promote F1 | review metadata only |
| `hxy-mosfet/AO3401-ED` | phase-a | F1 | `AO3401-ED` | pmos | Promote F1 | review metadata only |
| `hxy-mosfet/SI2301-ZE` | phase-a | F1 | `SI2301-ZE` | pmos | Promote F1 | review metadata only |
| `infineon/BFP650H6327` | fresh | F1 | `BFP650` | bjt_npn | Promote F1 | Canonicalized primary PDF identity to BFP650 and retained BFP650H6327 as an ordering-code alias.; Added and passed unchanged-model published hard-bound checks: hfe_maximum_at_0.07_a. |
| `infineon/IRF640NPBF` | fresh | F1 | `IRF640NPBF` | nmos | Promote F1 | review metadata only |
| `jiangsu-changjing-electronics-co-ltd/B772-RANGE-160-320` | phase-a | F1 | None | bjt_pnp | Reject | phase-a-salvage-hard-bound-failure |
| `jiangsu-changjing-electronics-co-ltd/BCX53-16-RANGE-100-250` | fresh | F2 | `BCX53-16` | bjt_pnp | Promote F2 | Added and passed unchanged-model published hard-bound checks: vce_sat_maximum_1.; Narrowed F2 supported scope to the exact fitted 25 C curve, bias, and range; scalar hard bounds do not extend curve fidelity. |
| `jiangsu-changjing-electronics-co-ltd/CJ2310` | fresh | F1 | `CJ2310` | nmos | Promote F1 | review metadata only |
| `jiangsu-changjing-electronics-co-ltd/CJ3401` | phase-a | F1 | `CJ3401` | pmos | Promote F1 | review metadata only |
| `jsmsemi/JSM2301S` | fresh | F1 | `JSM2301S-2A` | pmos | Promote F1 | Canonicalized primary PDF identity to JSM2301S-2A and retained JSM2301S as an ordering-code alias. |
| `jsmsemi/SI2301-A1SHB` | phase-a | F1 | `SI2301-A1SHB` | pmos | Promote F1 | review metadata only |
| `kec-semicon/2N3904S-RTK-PS` | fresh | F2 | `2N3904S` | bjt_npn | Promote F2 | Canonicalized primary PDF identity to 2N3904S and retained 2N3904S-RTK/PS as an ordering-code alias.; Added and passed unchanged-model published hard-bound checks: vce_sat_maximum_1, vbe_sat_minimum_1, vce_sat_maximum_2, vbe_sat_maximum_2, vce_sat_maximum_3, vbe_sat_maximum_3.; Narrowed F2 supported scope to the exact fitted 25 C curve, bias, and range; scalar hard bounds do not extend curve fidelity. |
| `kexin/IRLML6401` | fresh | F1 | `IRLML6401` | pmos | Promote F1 | review metadata only |
| `lrc/LH8050QLT1G` | fresh | F2 | `LH8050QLT1G` | bjt_npn | Promote F2 | Added and passed unchanged-model published hard-bound checks: vce_sat_maximum_1.; Narrowed F2 supported scope to the exact fitted 25 C curve, bias, and range; scalar hard bounds do not extend curve fidelity.; Corrected held-IS wording because VBE evidence exists but was not included in the hFE-only fit. |
| `lrc/LH8550QLT1G` | fresh | F2 | `LH8550QLT1G` | bjt_pnp | Promote F2 | Added and passed unchanged-model published hard-bound checks: vce_sat_maximum_1.; Narrowed F2 supported scope to the exact fitted 25 C curve, bias, and range; scalar hard bounds do not extend curve fidelity.; Corrected held-IS wording because VBE evidence exists but was not included in the hFE-only fit. |
| `lrc/LMBT3906LT1G` | fresh | F1 | `LMBT3906LT1G` | bjt_pnp | Promote F1 | Added and passed unchanged-model published hard-bound checks: hfe_maximum_at_0.01_a, vce_sat_maximum_1, vbe_sat_minimum_1, vce_sat_maximum_2, vbe_sat_maximum_2, vce_sat_maximum_3, vbe_sat_maximum_3. |
| `lrc/LMBT3946DW1T1G` | fresh | F2 | `LMBT3946DW1T1G` | bjt_npn | Promote F2 | Added and passed unchanged-model published hard-bound checks: vce_sat_maximum_1, vbe_sat_maximum_1, vce_sat_maximum_2, vbe_sat_maximum_2.; Narrowed F2 supported scope to the exact fitted 25 C curve, bias, and range; scalar hard bounds do not extend curve fidelity. |
| `mdd-microdiode/BSS123` | fresh | F1 | `BSS123` | nmos | Promote F1 | review metadata only |
| `mdd-microdiode/MDD3415` | phase-a | F1 | `MDD3415` | pmos | Promote F1 | review metadata only |
| `mdd-microdiode/MDD50N03D` | fresh | F1 | `MDD50N03D` | nmos | Promote F1 | review metadata only |
| `mdd-microdiode/MMBT5551-E` | fresh | F2 | `MMBT5551-E` | bjt_npn | Promote F2 | Added and passed unchanged-model published hard-bound checks: vce_sat_maximum_1, vbe_sat_maximum_1, vce_sat_maximum_2, vbe_sat_maximum_2.; Narrowed F2 supported scope to the exact fitted 25 C curve, bias, and range; scalar hard bounds do not extend curve fidelity.; Corrected held-IS wording because VBE evidence exists but was not included in the hFE-only fit. |
| `mdd-microdiode/S9013-E` | fresh | F1 | `S9013-E` | bjt_npn | Promote F1 | Added and passed unchanged-model published hard-bound checks: hfe_maximum_at_0.05_a, vce_sat_maximum_1, vbe_sat_maximum_1. |
| `msksemi/AO3401CI-MS` | phase-a | F1 | `AO3401CI-MS` | pmos | Promote F1 | review metadata only |
| `nexperia/2N7002BK-215` | fresh | F1 | `2N7002BK` | nmos | Promote F1 | review metadata only |
| `nexperia/2N7002P-215` | fresh | F2 | `2N7002P` | nmos | Promote F2 | Narrowed F2 supported scope to the exact fitted 25 C curve, bias, and range; scalar hard bounds do not extend curve fidelity. |
| `nexperia/BC817-16-215` | fresh | F1 | `BC817-16` | bjt_npn | Promote F1 | Added and passed unchanged-model published hard-bound checks: hfe_maximum_at_0.1_a, vce_sat_maximum_5. |
| `nexperia/BC846-215` | fresh | F1 | `BC846` | bjt_npn | Promote F1 | Added and passed unchanged-model published hard-bound checks: hfe_maximum_at_0.002_a, vce_sat_maximum_2, vce_sat_maximum_4. |
| `nexperia/BC847A-215` | fresh | F1 | `BC847A` | bjt_npn | Promote F1 | Added and passed unchanged-model published hard-bound checks: hfe_maximum_at_0.002_a, vce_sat_maximum_2, vce_sat_maximum_4. |
| `nexperia/BC847BW-115` | fresh | F1 | `BC847BW` | bjt_npn | Promote F1 | Added and passed unchanged-model published hard-bound checks: hfe_maximum_at_0.002_a, vce_sat_maximum_2, vce_sat_maximum_4. |
| `nexperia/PMBT3904-215` | fresh | F1 | `PMBT3904` | bjt_npn | Promote F1 | Added and passed unchanged-model published hard-bound checks: hfe_maximum_at_0.01_a, vce_sat_maximum_1, vbe_sat_minimum_1, vce_sat_maximum_2, vbe_sat_maximum_2, vce_sat_maximum_3, vbe_sat_maximum_3. |
| `onsemi/2N7002WT1G` | fresh | F1 | `2N7002WT1G` | nmos | Promote F1 | review metadata only |
| `onsemi/BC847CLT1G` | fresh | F1 | `BC847CLT1G` | bjt_npn | Promote F1 | Added and passed unchanged-model published hard-bound checks: hfe_maximum_at_0.002_a, vce_sat_maximum_1, vce_sat_maximum_2. |
| `onsemi/MMBT5401LT1G` | fresh | F2 | `MMBT5401LT1G` | bjt_pnp | Promote F2 | Added and passed unchanged-model published hard-bound checks: vce_sat_maximum_1, vbe_sat_maximum_1, vce_sat_maximum_2, vbe_sat_maximum_2.; Narrowed F2 supported scope to the exact fitted 25 C curve, bias, and range; scalar hard bounds do not extend curve fidelity. |
| `onsemi/MMBT5551LT1G` | fresh | F1 | `MMBT5551LT1G` | bjt_npn | Promote F1 | Added and passed unchanged-model published hard-bound checks: hfe_maximum_at_0.01_a, vce_sat_maximum_1, vbe_sat_maximum_1, vce_sat_maximum_2, vbe_sat_maximum_2. |
| `shikues/SK2301AAT` | fresh | F1 | `SK2301AAT` | pmos | Promote F1 | review metadata only |
| `slkor-slkormicro-elec/BC857B` | fresh | F1 | `BC857B` | bjt_pnp | Promote F1 | Added and passed unchanged-model published hard-bound checks: hfe_maximum_at_0.002_a, vce_sat_maximum_1, vbe_sat_maximum_1. |
| `stanson-tech/ST3422A` | fresh | F1 | `ST3422A` | nmos | Promote F1 | review metadata only |
| `tech-public/2N7002T` | fresh | F1 | `2N7002T` | nmos | Promote F1 | review metadata only |
| `tech-public/DMG1012T` | fresh | F1 | `DMG1012T` | nmos | Promote F1 | review metadata only |
| `tech-public/FS8205A` | fresh | F1 | `FS8205A` | nmos | Promote F1 | review metadata only |
| `twgmc/AO3401` | phase-a | F1 | None | pmos | Reject | candidate-canonical-identity-collision |
| `umw-youtai-co-ltd/15N10` | fresh | F1 | `15N10` | nmos | Promote F1 | review metadata only |
| `umw-youtai-co-ltd/30N06` | fresh | F1 | `30N06` | nmos | Promote F1 | review metadata only |
| `umw-youtai-co-ltd/AO3407A` | phase-a | F1 | `AO3407A` | pmos | Promote F1 | review metadata only |
| `umw-youtai-co-ltd/AO3415A` | fresh | F1 | `AO3415A` | pmos | Promote F1 | review metadata only |
| `umw-youtai-co-ltd/AO4407A` | fresh | F1 | `AO4407A` | pmos | Promote F1 | review metadata only |
| `umw-youtai-co-ltd/AO4435` | fresh | F1 | `AO4435` | pmos | Promote F1 | review metadata only |
| `umw-youtai-co-ltd/BC856B` | fresh | F2 | `BC856B` | bjt_pnp | Promote F2 | Added and passed unchanged-model published hard-bound checks: vce_sat_maximum_1, vbe_sat_maximum_1.; Narrowed F2 supported scope to the exact fitted 25 C curve, bias, and range; scalar hard bounds do not extend curve fidelity.; Corrected held-IS wording because VBE evidence exists but was not included in the hFE-only fit. |
| `umw-youtai-co-ltd/SI2301A` | phase-a | F1 | `SI2301A` | pmos | Promote F1 | review metadata only |
| `umw-youtai-co-ltd/SI2309A` | fresh | F1 | `SI2309A` | pmos | Promote F1 | review metadata only |
| `vishay-intertech/SI2309CDS-T1-GE3` | fresh | F1 | `SI2309CDS-T1-GE3` | pmos | Promote F1 | review metadata only |
| `yangzhou-yangjie-elec-tech/YJQ40G10A` | fresh | F1 | `YJQ40G10A` | nmos | Promote F1 | review metadata only |
| `yongyutai/SI2301` | phase-a | F1 | `SI2301` | pmos | Promote F1 | review metadata only |

## Non-staged execution reconciliation

These 42 outcomes were audited against selection and execution records and have no staged package path or promoted library representation.

| Origin | Status | LCSC ID | MPN | Family | Reason |
| --- | --- | --- | --- | --- | --- |
| phase-a | failed | C18221467 | `S8050-J3Y` | bjt | F2 failed: Validation failed for S8050-J3Y. See validation-results.json; failed package checks: vbe_sat_1_maximum observed 1.3696959144015224 (maximum 1.2); F1 failed: Validation failed for S8050-J3Y. See validation-results.json; failed package checks: hfe_minimum_at_0.05_a observed 118.27012221823097 (minimum 120) |
| phase-a | failed | C7420364 | `SS310` | diode | F2 failed: diode F2 gate failed: forward_voltage worst relative error 0.0585 exceeds gate 0.05; F1 failed: Validation failed for SS310. See validation-results.json; failed package checks: forward_voltage_at_0.0371_a observed 0.7094325299510689 (allowed error 0.13999999999999999) |
| phase-a | failed | C7502714 | `B5819WT` | diode | F2 failed: diode F2 gate failed: N saturated its physical bound at 0.9; the true optimum lies outside the physical range, so the residual is a constraint artefact; F1 failed: Validation failed for B5819WT. See validation-results.json; failed package checks: forward_voltage_at_0.0917105_a observed 0.4113084207300977 (allowed error 0.0875) |
| phase-a | failed | C7420363 | `SS26` | diode | F2 failed: diode F2 gate failed: forward_voltage worst relative error 0.0583 exceeds gate 0.05; forward_voltage RMS relative error 0.0336 exceeds gate 0.03; F1 failed: Validation failed for SS26. See validation-results.json; failed package checks: forward_voltage_at_0.033983_a observed 0.5730088912966007 (allowed error 0.105) |
| phase-a | failed | C18199176 | `SS16` | diode | F2 failed: diode F2 gate failed: forward_voltage worst relative error 0.0532 exceeds gate 0.05; forward_voltage RMS relative error 0.0307 exceeds gate 0.03; F1 failed: Validation failed for SS16. See validation-results.json; failed package checks: forward_voltage_at_0.0353014_a observed 0.5937714279383806 (allowed error 0.13999999999999999) |
| phase-a | skipped | C20628872 | `SI2302S` | mosfet | library identity collision: si2302s already represented by goodwork/SI2302S |
| phase-a | skipped | C8547 | `CJ2301 S1` | mosfet | duplicate fitted die vector already represented by jsmsemi/SI2301-A1SHB; no independent parameterization or shared-die evidence was supplied |
| fresh | skipped | C24280 | `BCX56(RANGE:100-250)` | bjt | duplicate fitted die vector already represented by hongjiacheng/MMBT4401; no independent parameterization or shared-die evidence was supplied |
| fresh | failed | C8543 | `S9012 2T1(RANGE:200-350)` | bjt | F2 failed: node packages/component-schema/validate-package.mjs tools/conveyor/data/staging/batch-3/packages/jiangsu-changjing-electronics-co-ltd/S9012-2T1-RANGE-200-350.building-93112-1786326486146 failed

FAIL tools/conveyor/data/staging/batch-3/packages/jiangsu-changjing-electronics-co-ltd/S9012-2T1-RANGE-200-350.building-93112-1786326486146
  - component/canonical_mpn must match pattern "^[A-Za-z0-9][A-Za-z0-9._+/-]*$"; F1 failed: node packages/component-schema/validate-package.mjs tools/conveyor/data/staging/batch-3/packages/jiangsu-changjing-electronics-co-ltd/S9012-2T1-RANGE-200-350.building-93112-1786326486376 failed

FAIL tools/conveyor/data/staging/batch-3/packages/jiangsu-changjing-electronics-co-ltd/S9012-2T1-RANGE-200-350.building-93112-1786326486376
  - component/canonical_mpn must match pattern "^[A-Za-z0-9][A-Za-z0-9._+/-]*$" |
| fresh | skipped | C30587305 | `MMBT3904T-JSM` | bjt | duplicate fitted die vector already represented by hongjiacheng/MMBT4401; no independent parameterization or shared-die evidence was supplied |
| fresh | skipped | C22466370 | `BAS40X` | diode | duplicate fitted die vector already represented by hongjiacheng/BAS40-04; no independent parameterization or shared-die evidence was supplied |
| fresh | skipped | C22466367 | `BAT46X` | diode | duplicate fitted die vector already represented by hongjiacheng/BAT46WS; no independent parameterization or shared-die evidence was supplied |
| fresh | skipped | C22379466 | `MM1Z18` | diode | duplicate fitted die vector already represented by hongjiacheng/BZT52C18; no independent parameterization or shared-die evidence was supplied |
| fresh | failed | C7502726 | `BAS21S` | diode | F2 failed: diode F2 gate failed: forward_voltage worst relative error 0.1034 exceeds gate 0.05; forward_voltage RMS relative error 0.0715 exceeds gate 0.03; F1 failed: Validation failed for BAS21S. See validation-results.json; failed package checks: forward_voltage_at_0.00001_a observed 0.5543285413778412 (allowed error 0.13776) |
| fresh | failed | C7420325 | `B0540W` | diode | F2 failed: Validation failed for B0540W. See validation-results.json; failed package checks: forward_voltage_at_0.0239011_a observed 0.2539270708655663 (allowed error 0.02), forward_voltage_at_0.0488887_a observed 0.2765073281888469 (allowed error 0.02), forward_voltage_at_0.0986835_a observed 0.3007604821514943 (allowed error 0.02), forward_voltage_at_0.146861_a observed 0.3161435576037196 (allowed error 0.02); F1 failed: Validation failed for B0540W. See validation-results.json; failed package checks: forward_voltage_at_0.0239011_a observed 0.41808071425919535 (allowed error 0.06124999999999999) |
| fresh | skipped | C2891810 | `MMBT2222` | bjt | duplicate fitted die vector already represented by hongjiacheng/MMBT4401; no independent parameterization or shared-die evidence was supplied |
| fresh | skipped | C42441445 | `SS8050 Y1` | bjt | duplicate fitted die vector already represented by hongjiacheng/S9013; no independent parameterization or shared-die evidence was supplied |
| fresh | skipped | C8512 | `MMBT2222A 1P` | bjt | duplicate fitted die vector already represented by hongjiacheng/MMBT4401; no independent parameterization or shared-die evidence was supplied |
| fresh | skipped | C78591 | `LMBT4401LT1G` | bjt | duplicate fitted die vector already represented by hongjiacheng/MMBT4401; no independent parameterization or shared-die evidence was supplied |
| fresh | skipped | C22395569 | `BZT52B12` | diode | duplicate fitted die vector already represented by hongjiacheng/BZT52C12S; no independent parameterization or shared-die evidence was supplied |
| fresh | failed | C7502712 | `DSK26` | diode | F2 failed: diode F2 gate failed: IS saturated its physical bound at 0.001; the true optimum lies outside the physical range, so the residual is a constraint artefact; F1 failed: Validation failed for DSK26. See validation-results.json; failed package checks: forward_voltage_at_0.68714307_a observed 0.6580460267021118 (allowed error 0.13999999999999999) |
| fresh | skipped | C7420332 | `BAT46W` | diode | duplicate fitted die vector already represented by hongjiacheng/BAT46WS; no independent parameterization or shared-die evidence was supplied |
| fresh | skipped | C19077450 | `BZT52C18S` | diode | duplicate fitted die vector already represented by hongjiacheng/BZT52C18; no independent parameterization or shared-die evidence was supplied |
| fresh | failed | C18199181 | `SS54B` | diode | F2 failed: diode F2 gate failed: forward_voltage worst relative error 0.1415 exceeds gate 0.05; forward_voltage RMS relative error 0.0875 exceeds gate 0.03; F1 failed: Validation failed for SS54B. See validation-results.json; failed package checks: forward_voltage_at_0.01_a observed 0.36675096037739646 (allowed error 0.0455) |
| fresh | skipped | C19077406 | `BZT52C8V2` | diode | duplicate fitted die vector already represented by hongjiacheng/BZT52C8V2S; no independent parameterization or shared-die evidence was supplied |
| fresh | failed | C8490 | `LBSS138LT1G` | mosfet | F2 failed: mosfet F2 gate failed: rds_on worst relative error 0.4816 exceeds gate 0.2; rds_on RMS relative error 0.2781 exceeds gate 0.12; F1 failed: Validation failed for LBSS138LT1G. See validation-results.json; failed package checks: rdson_maximum_1 observed 5.068770637238354 (maximum 3.5) |
| fresh | failed | C2938369 | `AO3402` | mosfet | F2 failed: mosfet F2 gate failed: drain_current worst relative error 0.4382 exceeds gate 0.2; drain_current RMS relative error 0.2332 exceeds gate 0.12; F1 failed: Validation failed for AO3402. See validation-results.json; failed package checks: rdson_3 observed 0.032804965387240065 (allowed error 0.035) |
| fresh | failed | C4748804 | `AO3400-HXY` | mosfet | F2 failed: mosfet F2 gate failed: drain_current worst relative error 1.2779 exceeds gate 0.2; drain_current RMS relative error 0.4306 exceeds gate 0.12; rds_on worst relative error 0.3425 exceeds gate 0.2; rds_on RMS relative error 0.1837 exceeds gate 0.12; F1 failed: Validation failed for AO3400-HXY. See validation-results.json; failed package checks: rdson_maximum_6 observed 0.03299351098409765 (maximum 0.03) |
| fresh | skipped | C127273 | `BSS84AK,215` | mosfet | duplicate fitted die vector already represented by nexperia/BSS84AKM; no independent parameterization or shared-die evidence was supplied |
| fresh | skipped | C5300004 | `2N3906S-RTK/PS` | bjt | duplicate fitted die vector already represented by lrc/LMBT3906LT1G; no independent parameterization or shared-die evidence was supplied |
| fresh | failed | C181167 | `2SC1623（L6）` | bjt | F2 failed: node packages/component-schema/validate-package.mjs tools/conveyor/data/staging/batch-3/packages/guangdong-hottech/2SC1623-L6.building-53601-1786339560066 failed

FAIL tools/conveyor/data/staging/batch-3/packages/guangdong-hottech/2SC1623-L6.building-53601-1786339560066
  - component/canonical_mpn must match pattern "^[A-Za-z0-9][A-Za-z0-9._+/-]*$"; F1 failed: node packages/component-schema/validate-package.mjs tools/conveyor/data/staging/batch-3/packages/guangdong-hottech/2SC1623-L6.building-53601-1786339560286 failed

FAIL tools/conveyor/data/staging/batch-3/packages/guangdong-hottech/2SC1623-L6.building-53601-1786339560286
  - component/canonical_mpn must match pattern "^[A-Za-z0-9][A-Za-z0-9._+/-]*$" |
| fresh | skipped | C5189252 | `SS8050W` | bjt | duplicate fitted die vector already represented by hongjiacheng/S9013; no independent parameterization or shared-die evidence was supplied |
| fresh | skipped | C126303 | `2SC5824T100Q` | bjt | duplicate fitted die vector already represented by hongjiacheng/S9013; no independent parameterization or shared-die evidence was supplied |
| fresh | failed | C551528 | `MJD44H11J` | bjt | F2 failed: bjt F2 gate failed: dc_current_gain worst relative error 0.2851 exceeds gate 0.2; dc_current_gain RMS relative error 0.1361 exceeds gate 0.12; F1 failed: Validation failed for MJD44H11J. See validation-results.json; failed package checks: hfe_minimum_at_2_a observed 59.78792797458487 (minimum 60) |
| fresh | failed | C47515 | `MJD45H11T4G` | bjt | F2 failed: bjt F2 gate failed: dc_current_gain worst relative error 0.2800 exceeds gate 0.2; F1 failed: Validation failed for MJD45H11T4G. See validation-results.json; failed package checks: hfe_minimum_at_2_a observed 59.78792797285581 (minimum 60) |
| fresh | skipped | C5278868 | `PMBT3904` | bjt | duplicate fitted die vector already represented by hongjiacheng/MMBT4401; no independent parameterization or shared-die evidence was supplied |
| fresh | skipped | C2844025 | `S8050M-D` | bjt | duplicate fitted die vector already represented by fosan/PXT8050; no independent parameterization or shared-die evidence was supplied |
| fresh | skipped | C13962 | `LMBT3906DW1T1G` | bjt | duplicate fitted die vector already represented by lrc/LMBT3906LT1G; no independent parameterization or shared-die evidence was supplied |
| fresh | skipped | C22375298 | `BZT52C2V7S` | diode | duplicate fitted die vector already represented by hongjiacheng/MM1Z2V7; no independent parameterization or shared-die evidence was supplied |
| fresh | skipped | C7502716 | `BAS70WS` | diode | duplicate fitted die vector already represented by hongjiacheng/BAS70; no independent parameterization or shared-die evidence was supplied |
| fresh | skipped | C19077473 | `BZX84C18` | diode | duplicate fitted die vector already represented by hongjiacheng/BZT52C18; no independent parameterization or shared-die evidence was supplied |
| fresh | skipped | C19077467 | `BZX84C3V3` | diode | duplicate fitted die vector already represented by hongjiacheng/BZT52B3V3; no independent parameterization or shared-die evidence was supplied |

Accounting: Phase-A has 5 failed and 2 skipped outcomes. Fresh selection has 11 failed and 24 skipped outcomes.

## Final verification

- Promoted package validators: 100 of 100 passed.
- Complete library schema validation: all 359 packages passed.
- Promoted native/WASM audit: 371 benches and 679 checks passed.
- Model-library tests: 1 of 1 passed.
- Model-factory tests: 42 of 42 passed.
- Conveyor tests: 13 of 13 passed.
- Conveyor typecheck: passed.
- Workspace typechecks: passed.
- Explicit `.temp 25`: present in every promoted comparison bench.
- Pending-review markers: none in promoted packages.
- Prohibited PDFs, databases, extraction or staging artifacts, archives, and vendor model packs: none added.
- Absolute staging or scratch paths: none in promoted packages.
- Staging tree SHA-256 remained `a9cb69491abbe3b544424d15e89b4cb31dc8241431397b86a943db6950f22c10`.
- `git diff --check`: passed after final documentation and index review.

## Residual concerns

- F1 packages remain intentionally narrow DC approximations and do not claim curve-fit fidelity.
- F2 claims remain limited to the exact cited 25 C curves and biases recorded in each promoted contract.
- Rejected packages remain unchanged in gitignored staging and may only be reconsidered after a new independently reviewed model, not by weakening hard bounds.
- No content was pushed, deployed, published, posted, or sent to GitHub.
