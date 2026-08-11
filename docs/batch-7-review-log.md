# Batch 7 independent review log

Date: 2026-08-11

Reviewer: `gpt-5.6-sol independent reviewer`

## Review contract and method

1. Verified the working directory was exactly `/Users/hughp/Documents/opencircuit` and the starting HEAD was `5cf982e94b71e4cf27010ce67020bbaeca861137` before any tracked write.
2. Confirmed the reviewed shipping library began at exactly 622 packages and the only pre-existing untracked roots were `.claude/` and `tools/conveyor/data.pre-hardening/`.
3. Reconciled exactly 76 complete staged package trees with the Batch 7 selection, execution record, and staging manifest: 75 diodes and 1 NMOS; 41 F1 and 35 F2.
4. Read 1010 package files totaling 1781856 bytes, plus all 76 cached primary PDFs. No vendor SPICE model or vendor model pack was used.
5. Reproduced all 76 source SHA-256 values, checked every citation against cached page counts, inspected all 35 F2 figure pages, and rendered the three OCR-sensitive identity pages.
6. Reran all 76 validators, 326 native ngspice-46 benches, 326 pinned WASM comparisons, and 326 staged expectations on scratch copies without writing staging originals.
7. Generated 186 exact-condition 25 C reviewer probes across all 76 packages. All 186 native/WASM comparisons passed; 183 hard bounds passed and 3 failed.
8. Recomputed all 35 F2 residuals from fresh native outputs against unchanged diode gates, and audited optimizer-space bounds, curve identity, condition, axes, units, sampled points, and DC-only scope.
9. Compared normalized canonical identities, aliases, and complete family-aware fitted vectors against the 622-package baseline and within Batch 7. No survivor collision or shared-die exception exists.
10. Promoted only 70 survivors, preserved every electrical model and fitted vector byte-for-byte, finalized review metadata, narrowed all promoted F2 scopes, and reran all 457 promoted benches and expectations.

## Outcome

| Measure | Count |
| --- | ---: |
| Baseline reviewed packages | 622 |
| Reviewed staged packages | 76 |
| Promoted | 70 |
| Rejected | 6 |
| Final reviewed packages | 692 |
| Independent hard-bound probes | 186 |
| Promoted reviewer probes | 164 |

### Counts by family and fidelity

| Set | Diode F1 | Diode F2 | NMOS F1 | NMOS F2 | F1 | F2 | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Reviewed | 40 | 35 | 1 | 0 | 41 | 35 | 76 |
| Promoted | 38 | 32 | 0 | 0 | 38 | 32 | 70 |
| Rejected | 2 | 3 | 1 | 0 | 3 | 3 | 6 |

## Primary source audit

- 76 of 76 cached primary PDF SHA-256 values reproduced.
- Staging contained one invalid citation: `hongjiacheng/BAS70W-05` cited p. 4 although its primary PDF has 3 pages. The promoted copy removes p. 4 from `sources.json` and `MODEL_CARD.md`; staging remains unchanged.
- `guangdong-hottech/1N4148W-T4`: the primary PDF electrical title is `1N4148W`; `T4` is the printed device marking. The package was rejected independently for unsupported F2 temperature evidence.
- `msksemi/SS34-MS`: the primary title `SS32-MS THRU SS310-MS` explicitly includes `SS34-MS`.
- `jsmsemi/NRVB130T1G`: the rendered title explicitly identifies `NRVB130T1G` and JSMSEMI branding.
- Primary identity, manufacturer, polarity, table min/typ/max semantics, SI conversion, signs, figure axes, and supported regions were checked against PDF text and rendered source pages, not extraction JSON alone.

## Staged validation

- Package validators: 76 of 76 passed.
- Native ngspice-46 benches and pinned WASM comparisons: 326 of 326 passed.
- Staged expectations: 326 of 326 passed.
- Worst native/WASM relative delta: `7.809135705305403e-12`.
- Worst native/WASM absolute delta: `6.879163905182395e-12`.
- Every staged bench contains explicit `.temp 25`.

## Published hard-bound audit

| Kind | Probes | Passed | Failed |
| --- | ---: | ---: | ---: |
| Forward-voltage maxima | 99 | 97 | 2 |
| Forward-voltage minima | 1 | 1 | 0 |
| Reverse-leakage maxima | 75 | 75 | 0 |
| Breakdown-voltage minima | 6 | 6 | 0 |
| RDS(on) maxima | 2 | 2 | 0 |
| Threshold-voltage minima | 1 | 1 | 0 |
| Threshold-voltage maxima | 1 | 1 | 0 |
| Body-diode voltage maxima | 1 | 0 | 1 |

All 186 reviewer probes passed native ngspice/WASM parity. Three inclusive bounds failed:
- `hongjiacheng/RB521S-40`: 0.300360940 V at 10 mA exceeded the 0.300000000 V maximum.
- `jsmsemi/NRVB130T1G`: 0.412746329 V at 0.1 A exceeded the 0.370000000 V maximum.
- `wuxi-nce-power/NCE6020AK`: 1.209517213 V at 10 A exceeded the 1.200000000 V body-diode maximum.
No electrical parameter, fitter, fit gate, or model-factory code was changed.

## F2 claim adjudication

The unchanged diode gates are RMS relative voltage error <= 0.03 and worst relative voltage error <= 0.05. Fresh native residuals, not stored fit summaries, control disposition. No F2 candidate has an optimizer-space bound saturation or held default.

| Package | Selected source curve and condition | Points | Sampled axes | Fresh RMS | Fresh worst | Verdict |
| --- | --- | ---: | --- | ---: | ---: | --- |
| `hongjiacheng/SS26B` | Typical forward voltage (Fig.3), curve labeled SS26B (p. 2 Fig.3); Tj = 25 degC, pulse width = 300 us, 1% duty cycle; legend curve SS26B (legend groups: SS22B-SS24B, SS26B, SS28B-SS210B, SS215B-SS220B) | 14 | 0.34 to 0.762 V linear x; 0.1 to 10 A log y | 0.019641228 | 0.032667874 | Promote F2 |
| `hongjiacheng/BAS16` | Fig.1 Typical Instaneous Forward Characteristics, Ta=25 degC (p. 2 Fig.1); Ta = 25 degC | 6 | 0.472 to 1.128 V linear x; 0.01 to 300 mA log y | 0.026461580 | 0.040512609 | Promote F2 |
| `hongjiacheng/MM3Z6V8` | Typical forward voltage (Fig.3), Ta = 25 degC curve (p. 3 Fig.3); Ta = 25 degC curve of the four-temperature family figure (curves at 0, 25, 75, 150 degC); family-typical forward characteristic for the MM3Z series, not specific to MM3Z6V8 | 10 | 0.72 to 0.978 V linear x; 5 to 200 mA log y | 0.009656624 | 0.011568473 | Promote F2 |
| `hongjiacheng/SS54BF` | Typical forward voltage, SS52BF-SS545BF trace, Tj = 25 degC pulsed (p. 2 Fig. 3 Typical Forward Voltage, SS52BF-SS545BF trace); Tj = 25 degC, pulse width = 300 us, 1% duty cycle | 8 | 0.23 to 0.57 V linear x; 0.05 to 10 A log y | 0.033550905 | 0.071354755 | Reject: unsupported F2: fresh native RMS 0.033550905 and worst 0.071354755 exceed unchanged 0.03/0.05 gates |
| `hongjiacheng/MM3Z5V6` | Typical forward voltage, Ta = 25 degC trace (family-common curve) (p. 3 Fig. 3 Typical Forward Voltage, Ta = 25 degC trace); Ta = 25 degC | 5 | 0.72 to 0.9 V linear x; 0.005 to 0.1 A log y | 0.010285431 | 0.013059949 | Promote F2 |
| `hongjiacheng/SS520B` | Fig.3 Typical Forward Voltage, SS515B-SS520B curve (p. 2 Fig.3); Tj = 25 degC, pulse width = 300 us, 1% duty cycle; legend curve SS515B-SS520B | 7 | 0.45 to 1.01 V linear x; 0.01 to 10 A log y | 0.028159389 | 0.049796940 | Promote F2 |
| `hongjiacheng/M1F` | typical_forward_voltage (p. 2, Fig. 3 Typical Forward Voltage); Tj = 25 degC, pulse width = 300 us, 1% duty cycle; typical family curve digitized from Fig. 3. | 5 | 0.6232 to 1.3789 V linear x; 0.010005 to 9.48008 A log y | 0.024258563 | 0.044537623 | Promote F2 |
| `hongjiacheng/SS315` | Typical forward voltage, SS315-SS320 group (p. 2 fig. 3, SS315-SS320 dotted curve); Tj = 25 degC, pulse width = 300 us, 1% duty cycle | 5 | 0.45 to 1.05 V linear x; 0.01 to 50 A log y | 0.013562106 | 0.020991328 | Promote F2 |
| `hongjiacheng/M6` | Fig.3 Typical Forward Voltage, M1-M7 curve (p. 2 Fig.3); Tj = 25 degC, pulse width = 300 us, 1% duty cycle | 8 | 0.6 to 1.23 V linear x; 0.01 to 10 A log y | 0.017045203 | 0.029164433 | Promote F2 |
| `zhuhai-hongjiacheng-co.-ltd/ES1M` | Typical forward voltage for ES1M group (p. 2, Fig. 3 Typical Forward Voltage); Tj = 25 degC; pulse width = 300 us; 1% duty cycle; ES1H-ES1M dotted curve | 5 | 1.2 to 1.85 V linear x; 0.01 to 20 A log y | 0.012990234 | 0.025059080 | Promote F2 |
| `hongjiacheng/S2MF` | Fig.3 Typical Forward Voltage, S2AF-S2MF curve (p. 2 Fig.3); Tj = 25 degC, pulse width = 300 us, 1% duty cycle | 8 | 0.58 to 1.21 V linear x; 0.01 to 10 A log y | 0.013212923 | 0.021367395 | Promote F2 |
| `hongjiacheng/ES8JC` | Typical forward voltage, ES8JC curve (p. 2, Fig. 3); Tj = 25 degC; pulse width = 300 us; 1% duty cycle | 5 | 0.85 to 1.42 V linear x; 0.01 to 20 A log y | 0.018471230 | 0.034161482 | Promote F2 |
| `hongjiacheng/MM3Z9V1` | Typical forward voltage, Ta = 25 degC curve (p. 3 Fig. 3); Ta = 25 degC curve of the four-temperature family figure; family-typical MM3Z-series forward characteristic, not specific to MM3Z9V1 | 5 | 0.72 to 0.978 V linear x; 0.005 to 0.2 A log y | 0.009656624 | 0.011568473 | Promote F2 |
| `hongjiacheng/SS515B` | Typical forward voltage, SS515B-SS520B curve (p. 2, Fig. 3); Tj = 25 degC; pulse width = 300 us; 1% duty cycle | 5 | 0.53 to 1.2 V linear x; 0.01 to 40 A log y | 0.013723290 | 0.023591046 | Promote F2 |
| `hongjiacheng/BAS70W-05` | Fig.1 Typical Instantaneous Forward Characteristics, Ta=25 degC (p. 2 Fig.1); Ta = 25 degC | 7 | 0.2 to 0.74 V linear x; 0.01 to 60 mA log y | 0.027584399 | 0.035787884 | Promote F2 |
| `hongjiacheng/SS34F` | Typical forward voltage, SS32F-SS34F curve (p. 2, Fig. 3); Tj = 25 degC; pulse width = 300 us; 1% duty cycle | 5 | 0.18 to 0.64 V linear x; 0.01 to 40 A log y | 0.031484544 | 0.056503816 | Reject: unsupported F2: fresh native RMS 0.031484544 and worst 0.056503816 exceed unchanged 0.03/0.05 gates |
| `hongjiacheng/SS515C` | Typical forward voltage, SS515C-SS520C curve (p. 2, Fig. 3 Typical Forward Voltage); Tj=25 degC, pulse width=300 us, 1% duty cycle; dotted SS515C-SS520C curve. | 5 | 0.4 to 0.96 V linear x; 0.01 to 30 A log y | 0.014795604 | 0.025747639 | Promote F2 |
| `hongjiacheng/ES2A` | Typical forward voltage (ES2A-ES2D curve) (p. 2, Fig. 3); TA = 25 degC, pulse width = 300 us, 1% duty cycle | 6 | 0.4 to 1.35 V linear x; 0.001 to 10 A log y | 0.027011145 | 0.039394071 | Promote F2 |
| `hongjiacheng/US1A` | Typical forward voltage for US1A-US1D curve group (p. 2, Fig. 3 Typical Forward Voltage); Tj = 25 degC, pulse width = 300 us, 1% duty cycle; US1A-US1D solid curve group | 5 | 0.6 to 0.9 V linear x; 0.01 to 10 A log y | 0.013361748 | 0.019467505 | Promote F2 |
| `hongjiacheng/SS215` | Typical forward voltage, family curve SS215-SS220 (p. 2 Fig. 3); Tj = 25 degC, pulse width = 300 us, 1% duty cycle; family curve labeled SS215-SS220 | 5 | 0.58 to 1.12 V linear x; 0.01 to 50 A log y | 0.018816321 | 0.036243160 | Promote F2 |
| `hongjiacheng/SK84C` | Typical forward voltage (SK82C-SK84C curve) (p. 2, Fig. 3); TA = 25 degC, pulse width = 300 us, 1% duty cycle | 5 | 0.3 to 0.86 V linear x; 0.1 to 300 A log y | 0.019091938 | 0.031132100 | Promote F2 |
| `hongjiacheng/ES1G` | Typical forward voltage, family curve ES1F-ES1G (p. 2 Fig. 3); Tj = 25 degC, pulse width = 300 us, 1% duty cycle; family curve labeled ES1F-ES1G | 5 | 0.82 to 1.4 V linear x; 0.01 to 20 A log y | 0.011696242 | 0.021842600 | Promote F2 |
| `hongjiacheng/SS33` | Typical forward voltage, family curve SS32-SS34 (p. 2 Fig. 3); Tj = 25 degC, pulse width = 300 us, 1% duty cycle; family curve labeled SS32-SS34 | 5 | 0.28 to 0.67 V linear x; 0.01 to 50 A log y | 0.020963978 | 0.032569334 | Promote F2 |
| `hongjiacheng/DSK320` | Typical forward voltage for DSK315-DSK320 curve group (p. 2, Fig. 3 Typical Forward Voltage); Tj = 25 degC, pulse width = 300 us, 1% duty cycle; DSK315-DSK320 dash-dot curve group | 6 | 0.48 to 0.98 V linear x; 0.1 to 20 A log y | 0.013420322 | 0.019507131 | Promote F2 |
| `hongjiacheng/MURS160` | Typical forward voltage, MURS140-160 trace (p. 2, Fig. 3); Tj = 25 degC; pulse width = 300 us; 1% duty cycle; MURS140-160 dashed trace | 6 | 0.95 to 1.45 V linear x; 0.01 to 12 A log y | 0.011823356 | 0.021853162 | Promote F2 |
| `hongjiacheng/SS120` | Typical forward voltage, SS115-SS120 curve (p. 2, Fig. 3); TA = 25 degC, Tj = 25 degC, pulse width = 300 us, 1% duty cycle; dashed SS115-SS120 family curve | 7 | 0.6 to 1.4 V linear x; 0.01 to 30 A log y | 0.014021267 | 0.028693130 | Promote F2 |
| `mdd-microdiode/SM4007PL` | Typical forward characteristic, TJ = 25 degC (p. 2, Fig. 3, Typical Forward Characteristic); Typical characteristic at TJ = 25 degC; family curve for SM4001PL through SM4007PL | 4 | 0.8 to 0.93 V linear x; 0.1 to 1 A log y | 0.009215280 | 0.010323695 | Promote F2 |
| `guangdong-hottech/1N5819WS` | Typical Forward Characteristics, Ta = 25 degC (p. 2 Typical Characteristics); Ta = 25 degC, typical characteristics; 1N5817WS-1N5819WS family | 7 | 0.22 to 0.57 V linear x; 0.01 to 2 A log y | 0.026312111 | 0.047460588 | Promote F2 |
| `goodwork/A7` | Typical forward characteristics, A1-A7 family curve (p. 2, Fig. 2); TA = 25 degC, pulse width 300 us, 1% duty cycle; family curve labelled A1-A7 sheet | 7 | 0.7 to 1.3 V linear x; 0.01 to 11 A log y | 0.015095539 | 0.026785616 | Promote F2 |
| `mdd-microdiode/1N4007WS` | Typical forward characteristic, TJ = 25 degC (p. 2, Fig. 3, Typical Forward Characteristic); Typical characteristic at TJ = 25 degC; family curve for 1N4001WS through 1N4007WS | 4 | 0.8 to 0.94 V linear x; 0.1 to 1 A log y | 0.009310429 | 0.010947036 | Promote F2 |
| `mdd-microdiode/BAV21W` | Forward Characteristics, Ta = 25 degC (p. 2 Typical Characteristics); Pulsed, Ta = 25 degC; BAV19W-BAV21W family | 7 | 0.7 to 1.14 V linear x; 0.001 to 0.4 A log y | 0.012168122 | 0.025055937 | Promote F2 |
| `mdd-microdiode/1N4148W-E` | Typical forward characteristic at Ta = 25 degC (p. 2, Forward Characteristics); Ta = 25 degC; typical curve | 5 | 0.6 to 1 V linear x; 0.0001 to 0.22 A log y | 0.011439006 | 0.017126312 | Promote F2 |
| `st-semtech/LL4148PF` | Forward characteristics, Ta = 25 degC (p. 3, Fig. 1, Forward Characteristics); Ta = 25 degC; forward-characteristics plot | 4 | 0.84 to 1.05 V linear x; 50 to 300 mA linear y | 0.008541141 | 0.009826719 | Promote F2 |
| `mdd-microdiode/1N4148WS-E` | Forward Characteristics, Ta = 25 degC (p. 2 Typical Characteristics); Pulsed, Ta = 25 degC; 1N4148WS-E family characteristic | 7 | 0.42 to 0.98 V linear x; 1e-05 to 0.2 A log y | 0.014207016 | 0.021059660 | Promote F2 |
| `guangdong-hottech/1N4148W-T4` | Typical forward characteristics (p. 2, Fig. 1); Typical characteristics; no temperature condition is printed on Fig. 1 | 9 | 0.4 to 1.2 V linear x; 1e-05 to 0.52 A log y | 0.015275360 | 0.022647934 | Reject: unsupported F2: selected primary-PDF curve has no stated 25 degC condition |

The first four extraction lanes used `subagent_type luna` with explicit `model: fable`; all later extraction lanes omitted the model override. This is recorded as process evidence only, not quality evidence.

## Identity, alias, and vector collision audit

- Promotion-introduced normalized canonical or alias collision groups: 0.
- Promotion-introduced complete family-aware fitted-vector collision groups: 0.
- Shared-die adjudications required: 0. No survivor duplicate vector exists.

## Package dispositions

| Staged package | Origin | Tier | Family | Verdict | Corrections or rejection |
| --- | --- | --- | --- | --- | --- |
| `hongjiacheng/SS26B` | inherited-batch-6-unlaunched-order-239-through-262 | F2 | diode | Promote F2 | Narrowed F2 scope to exact selected 25 C curve, axes, condition, and sampled range. Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/BAS516` | inherited-batch-6-unlaunched-order-239-through-262 | F1 | diode | Promote F1 | Added 5 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/BAS16` | inherited-batch-6-unlaunched-order-239-through-262 | F2 | diode | Promote F2 | Narrowed F2 scope to exact selected 25 C curve, axes, condition, and sampled range. Added 6 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/MM1W12` | inherited-batch-6-unlaunched-order-239-through-262 | F1 | diode | Promote F1 | Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/MMSZ5254B` | inherited-batch-6-unlaunched-order-239-through-262 | F1 | diode | Promote F1 | Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/SS38` | inherited-batch-6-unlaunched-order-239-through-262 | F1 | diode | Promote F1 | Added 2 exact passing hard-bound reviewer probe(s). |
| `wuxi-nce-power/NCE6020AK` | inherited-batch-6-unlaunched-order-239-through-262 | F1 | nmos | Reject | inclusive hard-bound failure: 1.209517213 V body-diode drop at 10 A exceeds 1.200000000 V maximum |
| `hongjiacheng/FR102W` | inherited-batch-6-unlaunched-order-239-through-262 | F1 | diode | Promote F1 | Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/MM1W5V6` | inherited-batch-6-unlaunched-order-239-through-262 | F1 | diode | Promote F1 | Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/MM3Z6V8` | inherited-batch-6-unlaunched-order-239-through-262 | F2 | diode | Promote F2 | Narrowed F2 scope to exact selected 25 C curve, axes, condition, and sampled range. Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/SS54BF` | inherited-batch-6-unlaunched-order-239-through-262 | F2 | diode | Reject | unsupported F2: fresh native RMS 0.033550905 and worst 0.071354755 exceed unchanged 0.03/0.05 gates |
| `hongjiacheng/MM1W15` | inherited-batch-6-unlaunched-order-239-through-262 | F1 | diode | Promote F1 | Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/MM3Z5V6` | inherited-batch-6-unlaunched-order-239-through-262 | F2 | diode | Promote F2 | Narrowed F2 scope to exact selected 25 C curve, axes, condition, and sampled range. Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/SS520B` | new-scale-1k-tail | F2 | diode | Promote F2 | Narrowed F2 scope to exact selected 25 C curve, axes, condition, and sampled range. Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/MMSZ5227B` | new-scale-1k-tail | F1 | diode | Promote F1 | Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/MMSZ5237B` | new-scale-1k-tail | F1 | diode | Promote F1 | Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/SSL54F` | new-scale-1k-tail | F1 | diode | Promote F1 | Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/M1F` | new-scale-1k-tail | F2 | diode | Promote F2 | Narrowed F2 scope to exact selected 25 C curve, axes, condition, and sampled range. Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/BZX584C39` | new-scale-1k-tail | F1 | diode | Promote F1 | Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/SK1045C` | new-scale-1k-tail | F1 | diode | Promote F1 | Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/MM1W6V2` | new-scale-1k-tail | F1 | diode | Promote F1 | Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/SS315` | new-scale-1k-tail | F2 | diode | Promote F2 | Narrowed F2 scope to exact selected 25 C curve, axes, condition, and sampled range. Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/M6` | new-scale-1k-tail | F2 | diode | Promote F2 | Narrowed F2 scope to exact selected 25 C curve, axes, condition, and sampled range. Added 2 exact passing hard-bound reviewer probe(s). |
| `zhuhai-hongjiacheng-co.-ltd/ES1M` | new-scale-1k-tail | F2 | diode | Promote F2 | Narrowed F2 scope to exact selected 25 C curve, axes, condition, and sampled range. Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/S2MF` | new-scale-1k-tail | F2 | diode | Promote F2 | Narrowed F2 scope to exact selected 25 C curve, axes, condition, and sampled range. Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/B0530W` | new-scale-1k-tail | F1 | diode | Promote F1 | Added 3 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/MM1W75` | new-scale-1k-tail | F1 | diode | Promote F1 | Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/MM1Z30B` | new-scale-1k-tail | F1 | diode | Promote F1 | Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/MM1W36` | new-scale-1k-tail | F1 | diode | Promote F1 | Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/ES8JC` | new-scale-1k-tail | F2 | diode | Promote F2 | Narrowed F2 scope to exact selected 25 C curve, axes, condition, and sampled range. Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/SSL34F` | new-scale-1k-tail | F1 | diode | Promote F1 | Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/MM3Z51` | new-scale-1k-tail | F1 | diode | Promote F1 | Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/MM3Z9V1` | new-scale-1k-tail | F2 | diode | Promote F2 | Narrowed F2 scope to exact selected 25 C curve, axes, condition, and sampled range. Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/1SMA5913A` | new-scale-1k-tail | F1 | diode | Promote F1 | Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/1SMA5929A` | new-scale-1k-tail | F1 | diode | Promote F1 | Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/BAT43W` | new-scale-1k-tail | F1 | diode | Promote F1 | Added 5 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/SS515B` | new-scale-1k-tail | F2 | diode | Promote F2 | Narrowed F2 scope to exact selected 25 C curve, axes, condition, and sampled range. Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/MM1Z47B` | new-scale-1k-tail | F1 | diode | Promote F1 | Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/BAS70W-05` | new-scale-1k-tail | F2 | diode | Promote F2 | Removed unsupported p. 4 citation in promoted copy only. Narrowed F2 scope to exact selected 25 C curve, axes, condition, and sampled range. Added 4 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/SS34F` | new-scale-1k-tail | F2 | diode | Reject | unsupported F2: fresh native RMS 0.031484544 and worst 0.056503816 exceed unchanged 0.03/0.05 gates |
| `hongjiacheng/MMSZ4691` | new-scale-1k-tail | F1 | diode | Promote F1 | Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/MM1W7V5` | new-scale-1k-tail | F1 | diode | Promote F1 | Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/SS515C` | new-scale-1k-tail | F2 | diode | Promote F2 | Narrowed F2 scope to exact selected 25 C curve, axes, condition, and sampled range. Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/BZT52C75` | new-scale-1k-tail | F1 | diode | Promote F1 | Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/ES2A` | new-scale-1k-tail | F2 | diode | Promote F2 | Narrowed F2 scope to exact selected 25 C curve, axes, condition, and sampled range. Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/US1A` | new-scale-1k-tail | F2 | diode | Promote F2 | Narrowed F2 scope to exact selected 25 C curve, axes, condition, and sampled range. Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/SS215` | new-scale-1k-tail | F2 | diode | Promote F2 | Narrowed F2 scope to exact selected 25 C curve, axes, condition, and sampled range. Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/SK84C` | new-scale-1k-tail | F2 | diode | Promote F2 | Narrowed F2 scope to exact selected 25 C curve, axes, condition, and sampled range. Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/DSL34` | new-scale-1k-tail | F1 | diode | Promote F1 | Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/MMSZ5241B` | new-scale-1k-tail | F1 | diode | Promote F1 | Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/MM1W11` | new-scale-1k-tail | F1 | diode | Promote F1 | Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/ES1G` | new-scale-1k-tail | F2 | diode | Promote F2 | Narrowed F2 scope to exact selected 25 C curve, axes, condition, and sampled range. Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/S8MC` | new-scale-1k-tail | F1 | diode | Promote F1 | Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/SS33` | new-scale-1k-tail | F2 | diode | Promote F2 | Narrowed F2 scope to exact selected 25 C curve, axes, condition, and sampled range. Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/MMSZ5246BS` | new-scale-1k-tail | F1 | diode | Promote F1 | Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/DSK320` | new-scale-1k-tail | F2 | diode | Promote F2 | Narrowed F2 scope to exact selected 25 C curve, axes, condition, and sampled range. Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/MM1Z3V6` | new-scale-1k-tail | F1 | diode | Promote F1 | Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/BZT52C22` | new-scale-1k-tail | F1 | diode | Promote F1 | Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/MURS160` | new-scale-1k-tail | F2 | diode | Promote F2 | Narrowed F2 scope to exact selected 25 C curve, axes, condition, and sampled range. Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/RS1MF` | new-scale-1k-tail | F1 | diode | Promote F1 | Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/SSL36` | new-scale-1k-tail | F1 | diode | Promote F1 | Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/S5MC` | new-scale-1k-tail | F1 | diode | Promote F1 | Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/MMSZ5229B` | new-scale-1k-tail | F1 | diode | Promote F1 | Added 2 exact passing hard-bound reviewer probe(s). |
| `hongjiacheng/RB521S-40` | new-scale-1k-tail | F1 | diode | Reject | inclusive hard-bound failure: 0.300360940 V at 10 mA exceeds 0.300000000 V maximum |
| `hongjiacheng/SS120` | new-scale-1k-tail | F2 | diode | Promote F2 | Narrowed F2 scope to exact selected 25 C curve, axes, condition, and sampled range. Added 2 exact passing hard-bound reviewer probe(s). |
| `mdd-microdiode/SM4007PL` | new-scale-1k-tail | F2 | diode | Promote F2 | Narrowed F2 scope to exact selected 25 C curve, axes, condition, and sampled range. Added 2 exact passing hard-bound reviewer probe(s). |
| `guangdong-hottech/1N5819WS` | new-scale-1k-tail | F2 | diode | Promote F2 | Narrowed F2 scope to exact selected 25 C curve, axes, condition, and sampled range. Added 3 exact passing hard-bound reviewer probe(s). |
| `goodwork/A7` | new-scale-1k-tail | F2 | diode | Promote F2 | Narrowed F2 scope to exact selected 25 C curve, axes, condition, and sampled range. Added 2 exact passing hard-bound reviewer probe(s). |
| `mdd-microdiode/1N4007WS` | new-scale-1k-tail | F2 | diode | Promote F2 | Narrowed F2 scope to exact selected 25 C curve, axes, condition, and sampled range. Added 2 exact passing hard-bound reviewer probe(s). |
| `mdd-microdiode/BAV21W` | new-scale-1k-tail | F2 | diode | Promote F2 | Narrowed F2 scope to exact selected 25 C curve, axes, condition, and sampled range. Added 3 exact passing hard-bound reviewer probe(s). |
| `mdd-microdiode/1N4148W-E` | new-scale-1k-tail | F2 | diode | Promote F2 | Narrowed F2 scope to exact selected 25 C curve, axes, condition, and sampled range. Added 6 exact passing hard-bound reviewer probe(s). |
| `st-semtech/LL4148PF` | new-scale-1k-tail | F2 | diode | Promote F2 | Narrowed F2 scope to exact selected 25 C curve, axes, condition, and sampled range. Added 3 exact passing hard-bound reviewer probe(s). |
| `mdd-microdiode/1N4148WS-E` | new-scale-1k-tail | F2 | diode | Promote F2 | Narrowed F2 scope to exact selected 25 C curve, axes, condition, and sampled range. Added 6 exact passing hard-bound reviewer probe(s). |
| `guangdong-hottech/1N4148W-T4` | new-scale-1k-tail | F2 | diode | Reject | unsupported F2: selected primary-PDF curve has no stated 25 degC condition |
| `msksemi/SS34-MS` | new-scale-1k-tail | F1 | diode | Promote F1 | Added 2 exact passing hard-bound reviewer probe(s). |
| `jsmsemi/NRVB130T1G` | new-scale-1k-tail | F1 | diode | Reject | inclusive hard-bound failure: 0.412746329 V at 0.1 A exceeds 0.370000000 V maximum |

## Promoted validation

- Package validators: 70 of 70 passed.
- Native ngspice-46 benches and pinned WASM comparisons: 457 of 457 passed.
- Promoted expectations: 457 of 457 passed.
- Worst native/WASM relative delta: `6.721624320152927e-11`.
- Worst native/WASM absolute delta: `4.7309045569932096e-11`.
- All 457 promoted benches contain explicit `.temp 25`.

## Final verification commands and results

- `npm test --workspace=@opencircuit/model-library`
  - PASS: 1 test passed; component-schema validated all 692 packages.
- `npm test`
  - PASS: all workspace suites passed, including 4 web, 21 circuit-schema, 4 component-schema, 38 model-import, 692-package library validation, 10 sim-engine, and 21 waveform-viewer tests.
- `npm test --prefix tools/model-factory`
  - PASS: 45 tests passed, 0 failed.
- `npm test --prefix tools/conveyor`
  - PASS: 16 tests passed, 0 failed.
- `npm run typecheck --prefix tools/conveyor`
  - PASS: Python compileall completed with no error.
- `npm run typecheck`
  - PASS: all 6 workspace TypeScript typechecks completed with no error.
- `independent stageValidate pass over 70 promoted package directories`
  - PASS: 70 validators, 457 native/WASM benches, and 457 expectations passed.
- `explicit .temp 25 audit over promoted tests/*.cir`
  - PASS: 457 of 457 promoted benches contain explicit .temp 25.
- `normalized canonical, alias, and complete family-vector collision audit`
  - PASS: 0 promotion-introduced identity or vector collisions.
- `promoted model.cir and fitted.json immutability audit`
  - PASS: 70 of 70 promoted electrical models and vectors are byte-identical to staging.
- `whole-staging aggregate SHA-256 recomputation`
  - PASS: 2,310 files reproduced 27790d1c9b5d1d9b8e9e81b5f554d2deb4c2e94f41cc07165fc4911a868796fa.
- `promotion-state, vendor SPICE, absolute staging/scratch path, and prohibited tracked-data audits`
  - PASS: 0 pending markers, positive vendor SPICE claims, absolute staging or scratch paths, PDFs, archives, vendor model packs, SQLite databases, extraction responses, or staging files in promoted additions.
- `git diff --cached --check`
  - PASS: no whitespace errors.
- Whole-staging aggregate SHA-256 recomputation
  - PASS: 2,310 files reproduced `27790d1c9b5d1d9b8e9e81b5f554d2deb4c2e94f41cc07165fc4911a868796fa`; staging package aggregate remained 1,010 files at `74a9c8c89a8ec6798f34c296e4a06f7fdbfa2d82c7650e827718029916ad8c41`.
- Promotion-state, vendor SPICE, absolute staging-path, and prohibited tracked-data audits
  - PASS: no pending markers, vendor SPICE claims, absolute staging or scratch paths, PDFs, archives, SQLite databases, extraction responses, or vendor model packs were added.
- `git diff --cached --check`
  - PASS: no whitespace errors.

## Deviations

- All 25 extraction Agent invocations used `subagent_type: luna`; the first four also supplied explicit `model: fable`. This was treated only as process evidence and supplied no quality credit.
- No staging original, electrical parameter, fit gate, fitter, conveyor implementation, or model-factory implementation was modified.
- No prior independent-review rejection was retried.
- No push, deploy, publish, GitHub comment, or Vault update was performed.
