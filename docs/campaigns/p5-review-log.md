# P5 independent model review log

Date: 2026-08-09

Reviewer: `gpt-5.6-sol independent reviewer (P5)`

Branch: `worktree-agent-a7ee56b544b96b50b`

Scope: exactly the 20 P5 packages in `docs/MPN-TARGETS.md` plus `docs/model-archetypes/archetype-sensor-behavioral.md`.

## Review method

1. Read the P4 review log, gold review, contribution contract, shared archetype contract, VDMOS archetype, sensor behavioral archetype, package validator, model-factory validation stage, and native comparison harness.
2. Downloaded every distinct source URL that allowed automated retrieval, reproduced SHA-256, extracted cited pages, and compared representative typed facts with the cited tables or figures.
3. For onsemi URLs that returned HTTP 403, confirmed the official publication URL and publication identity, then corroborated representative facts against searchable copies or mirrors. Exact recorded SHA-256 could not be independently reproduced for those blocked assets.
4. Re-ran model-factory validation for all 20 packages.
5. Re-ran every P5 bench through native ngspice-46 and the pinned WASM comparison harness.
6. Compared every shipped numeric model parameter that has a direct `fitted.json` counterpart. All matched within serialization precision.
7. Ran one independent in-region native ngspice probe per package at a point not used by the authored expectation set.
8. Deep-checked all four proposed F2 packages against source semantics, fitted residuals, hard bounds, and archetype limits.
9. Verified the MMBT2222A electrical vector against PN2222A and audited package-specific identity, pin mapping, alias, provenance, and SOT-23 metadata.
10. Executed the sensor archetype example on `/opt/homebrew/bin/ngspice` and compared all three sensor packages against the archetype contract.

## Source provenance audit

| MPN | Source result | Citation spot-check |
| --- | --- | --- |
| LM386 | TI PDF fetched; SHA-256 reproduced | p. 4 supply range, p. 5 gain and bandwidth, p. 6 Figures 6-3 and 6-4 confirmed |
| TL084 | TI PDF fetched; SHA-256 reproduced | cited operating range, open-loop gain, and 5.25 MHz GBW rows confirmed |
| NE5534 | TI PDF fetched; SHA-256 reproduced | cited supply, open-loop, bandwidth, and output rows plausible and present |
| LM833 | TI PDF fetched; SHA-256 reproduced | cited supply, output swing, 7 V/us slew, and 16 MHz GBW rows confirmed |
| LM13700 | TI PDF fetched; SHA-256 reproduced | p. 5 limits and p. 7 Figures 8 and 10 confirmed |
| BD139 | Official onsemi URL returned 403; exact hash not reproduced | publication and representative hFE, saturation, current, and voltage rows corroborated |
| BD140 | Same shared onsemi source as BD139; exact hash not reproduced | complementary part rows and limits corroborated |
| TIP41C | Official onsemi URL returned 403; exact hash not reproduced | representative hFE, forced-beta saturation, 6 A, and 100 V rows corroborated |
| TIP42C | Same shared onsemi source as TIP41C; exact hash not reproduced | complementary part rows and limits corroborated |
| 2N5088 | Official onsemi URL returned 403; exact hash not reproduced | publication and p. 2 gain, capacitance, and fT facts corroborated with a readable family-datasheet mirror |
| IRFZ44N | Infineon PDF fetched; SHA-256 reproduced | threshold, 17.5 mohm, capacitance, gate-charge, and curve citations confirmed |
| IRF3205 | Infineon PDF fetched; SHA-256 reproduced | threshold, 8 mohm, capacitance, gate-charge, and curve citations confirmed |
| SS14 | Archived onsemi PDF mirror fetched; SHA-256 reproduced | maximum forward voltage, reverse-current, and capacitance figures confirmed |
| 1N5822 | Official onsemi URL returned 403; exact hash not reproduced | publication and representative forward-voltage and rating facts corroborated |
| BZX84C5V1 | Official onsemi URL returned 403; exact hash not reproduced | part-specific Zener windows and family forward rows corroborated |
| BAT85 | Archived Vishay PDF mirror fetched; SHA-256 reproduced | p. 2 forward voltage and 10 pF capacitance facts confirmed |
| MMBT2222A | Official onsemi URL returned 403; exact hash not reproduced | publication, SOT-23 pinout, gain, saturation, capacitance, and fT facts corroborated |
| LM35 | TI PDF fetched; SHA-256 reproduced | 10 mV/degC law, 4 V to 30 V range, and cited metadata confirmed |
| NTCLE100E3103JB0 | Vishay PDF fetched; SHA-256 reproduced | 10 kohm R25, 3977 K B25/85, tolerances, and resistance-table citations confirmed |
| GL5528 | SparkFun mirror of manufacturer source sheet fetched; SHA-256 reproduced | 8 kohm to 20 kohm at 10 lux, gamma 0.7, dark resistance, voltage, and power rows confirmed by source-sheet inspection |

Twelve distinct downloadable PDFs reproduced the recorded SHA-256 exactly. Six distinct onsemi URLs covering eight packages blocked automated retrieval with HTTP 403. No hash mismatch was observed on a retrievable cited asset.

## F2 tier adjudication

### LM386: pass F2

- Reproduced the Figure 6-4 gain-frequency fit and Figure 6-3 output-swing fit.
- Worst stored fit residual is 4.749 percent.
- All six native and WASM benches passed.
- Independent 7 V loaded probe produced 5.426588 V output and 4.23333 mA supply draw.
- Pins 1 and 8 do not infer an external gain-setting network. `GAIN_CL` is caller-selected. This limitation is explicit and prevents no claim beyond the tested compact behavior.

### LM13700: pass F2 after expectation correction

- Reproduced Figure 8 transconductance and Figure 10 bias-pin fits.
- Worst physical fit residual is 5.130 percent.
- The original bias checks used 5 percent relative tolerance on a roughly -13.7 V rail-referenced node, allowing about 0.68 V error for a 1.2 V to 1.5 V physical quantity.
- Corrected those five checks to an 80 mV absolute tolerance and zero relative tolerance. All pass, with actual errors from 5.0 mV to 70.4 mV.
- All seven native and WASM benches passed. The independent 50 uA probe produced a -13.704 V bias pin and 9.471386 mV output into 10 kohm.

### IRFZ44N: demoted F2 to F1

- DC transfer, output, and RDS(on) evidence is strong.
- The independent gate-charge result at VGS = 5 V is 7.330 nC against a cited 24 nC typical curve target, about 69.5 percent low.
- The VDMOS archetype states that gate-charge error beyond 30 percent means the capacitance stage is not F2 quality.
- Cited Crss curve residuals also reach 42.669 percent.
- No refit was attempted. AC coverage is now `approx` and package fidelity is F1.

### IRF3205: demoted F2 to F1

- DC transfer, output, and RDS(on) evidence is strong.
- Gate charge is acceptable at 39.615 nC against 52 nC, about 23.8 percent error.
- Crss curve residuals reach 44.185 percent, and the tabulated 25 V Crss result is about 33 percent high.
- The package uses a 35 percent Crss tolerance without a package-specific justification against the shared 20 percent capacitance default.
- No refit was attempted. AC coverage is now `approx` and package fidelity is F1.

## Sensor archetype review

- Corrected the linear-output core example so the clamp drives `ndrive`, followed by the output resistance to `OUT`. The earlier snippet placed an ideal behavioral voltage source directly on `OUT` and then connected `OUT` back to `nideal`, unlike the verified example and shipped LM35 form.
- Clarified that F1 bounds-only packages must not invent a nominal or third expectation solely to fill a fixed bench-name set.
- Re-ran the complete example on ngspice-46. Results: LM35 form 0.25 V, NTC form 1.0 V, LDR form 0.1995262 V.
- LM35 follows the linear form and passes F1. The independent 73 degC, 4.5 V probe produced 0.7299818 V.
- GL5528 follows the F1 bounds-only LDR form after correcting `LUX_FLOOR` from 0.001 lux to the lowest cited supported illuminance, 10 lux. The independent 30 lux probe produced 9.269261 kohm.
- NTCLE100E3103JB0 is rejected. Its shipped R0 = 9.5 kohm and BETA = 3947.1725 are fitted values, while the archetype requires direct transcription of the cited R25 = 10 kohm and B25/85 = 3977 K. The model remains numerically stable and all authored benches pass, but it does not conform to the approved archetype. The electrical model was not rewritten.

## MMBT2222A sibling inheritance

- The 20 electrical parameters in `fitted.json` match PN2222A exactly.
- The `.model` vectors match exactly apart from the model name and provenance comments.
- MMBT2222A has distinct canonical identity, SOT-23 CASE 318 metadata, base-emitter-collector symbol numbering, SPICE pin mapping, `MMBT2222ALT1G` alias, datasheet URL, revision, source hash, tests, and validation artifacts.
- All six native and WASM benches and the independent 50 mA-region probe passed.

## Final verdicts

| MPN | Final tier | Verdict | Principal finding |
| --- | --- | --- | --- |
| LM386 | F2 | Pass | Two cited typical curves, hard facts, six comparisons, and independent probe verified |
| TL084 | F1 | Pass | Table-constrained model and seven comparisons verified |
| NE5534 | F1 | Pass | Table-constrained model and seven comparisons verified; not starred in P5 table |
| LM833 | F1 | Pass | Table-constrained model and seven comparisons verified |
| LM13700 | F2 | Pass after metadata fix | Bias tolerance corrected; curve residuals and seven comparisons pass |
| BD139 | F1 | Pass | Starred omission honest; no independent typical curve family |
| BD140 | F1 | Pass | Guaranteed-bound family evidence only |
| TIP41C | F1 | Pass | Guaranteed gain and saturation bounds only |
| TIP42C | F1 | Pass | Guaranteed gain and saturation bounds only |
| 2N5088 | F1 | Pass | Minimum gain and frequency bounds, no typical curve claim |
| IRFZ44N | F1 | Demoted | Gate charge about 69.5 percent low; Crss residual 42.7 percent |
| IRF3205 | F1 | Demoted | Crss residual 44.2 percent exceeds F2 capacitance evidence |
| SS14 | F1 | Pass | Starred single-bound omission honest |
| 1N5822 | F1 | Pass | Maximum-bound forward fit only |
| BZX84C5V1 | F1 | Pass | Family forward curve plus part-specific Zener windows |
| BAT85 | F1 | Pass | Mixed typical and maximum table evidence |
| MMBT2222A | F1 | Pass | Exact PN2222A die vector with distinct package metadata and provenance |
| LM35 | F1 | Pass | Starred nominal transfer-only omission honest |
| NTCLE100E3103JB0 | F1 | Rejected | Shipped fitted R0 and BETA violate direct-transcription archetype requirement |
| GL5528 | F1 | Pass after model metadata fix | Numerical floor corrected to 10 lux; bounded-unit claim remains honest |

## Triaged survivors

- IRFZ44N and IRF3205 remain usable F1 DC-focused compact models. Their AC and switching behavior is approximate and must not be promoted without a new capacitance fit.
- NTCLE100E3103JB0 remains present and review-marked rejected. Its current benches are self-consistent, but archetype conformance requires a separately authorized model correction.
- Exact hash reproduction remains unavailable for eight onsemi packages because six official URLs returned HTTP 403. Publication identity and cited facts were corroborated; this is recorded as a source-retrieval limitation, not silently treated as exact verification.
- SS14, BAT85, and GL5528 use readable public mirrors of manufacturer documents or source sheets. Their mirror provenance and F1 ceilings remain explicit.
- BD139, SS14, and LM35 retain their starred F1 omissions. NE5534 was not starred in the actual P5 table and remains F1.

## Final tests

- Factory validation: 20 of 20 commands exited 0 after review changes.
- Native versus WASM comparison: 106 of 106 P5 benches passed.
- Independent native probes: 20 of 20 completed with finite, sign-correct, in-region results.
- Sensor archetype example: passed on `/opt/homebrew/bin/ngspice`, ngspice-46.
- Model parameter consistency: all direct `fitted.json` to `model.cir` parameter comparisons matched within serialization precision.
- Aggregate library gate: `npm test --workspace=@opencircuit/model-library` passed, validating all 122 packages.
