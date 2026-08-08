# Component library targets (frozen by orchestrator for P3/P4)

Selection bias: current production, widely stocked, pedagogically canonical. Fidelity per component-schema tiers. Digital note: our WASM build excludes XSPICE, so all logic/timer models are ANALOG behavioral subckts (VTC, tpd, output impedance, rail clamps) and must say so in known_omissions.

## Five gold components (P3 gate, one per archetype)
| MPN | Family | Archetype to prove |
|---|---|---|
| 1N4148 (Vishay) | diode | .model D fitted to datasheet IV/capacitance (IS, N, RS, CJO, TT) |
| WP7113ID (Kingbright, 5 mm red LED) | led | D model fitted to Vf@If curve + honest optical note (UI maps brightness to current) |
| 2N3904 (onsemi) | bjt_npn | Gummel-Poon fitted: IS, BF vs IC, VAF, IKF, RB, CJE/CJC, TF from fT |
| IRLZ44N (Infineon) | nmos (power, logic-level) | VDMOS model fitted: Vth, transfer + output curves, RDS(on), Ciss/Coss/Crss, body diode |
| TL072 (TI) | opamp | Boyle-class macromodel fitted: Aol, GBW, slew, input bias/offset, Zout, output swing, supply limits |

## Target list (~112 MPNs; P4 delivers at least 100, at least 25 at F2+)

F2+ priority parts are marked *.

Diodes and zeners (13): 1N4148*, 1N4001*, 1N4007, 1N5408, 1N5817*, 1N5819*, BAT54, BAV99, BAT41, 1N4728A (3.3 V zener)*, 1N4733A (5.1 V)*, 1N4742A (12 V), BZX79C5V1.
LEDs (8): WP7113ID (red)*, WP7113GD (green)*, WP7113SBC (blue), WP7113PWC (white), WP7113YD (yellow), LTST-C170KRKT (0603 red), LTST-C170KGKT (0603 green), IR333A (940 nm IR).
BJTs (13): 2N3904*, 2N3906*, PN2222A*, BC547B*, BC557B*, BC337-40, BC327-40, 2N5551, MPSA42, TIP31C*, TIP32C, TIP120*, TIP125.
MOSFETs (10): 2N7000*, BS250P, AO3400A*, AO3401A, IRLZ44N*, IRLB8721PBF*, IRF540N*, IRF9540N, FQP30N06L, SI2302.
JFETs (4): MMBF5457*, MMBFJ201, J113, BF256B.
Op-amps (15): TL071*, TL072*, TL074, TL081, LM358*, LM324*, LM741 (heritage, F1 ok), NE5532*, LM4562, OPA2134, MCP6002*, MCP6004, TLV9062, LMV358, OP07C.
Comparators (5): LM393*, LM339*, LM311, TLV3702, MCP6561.
Regulators and references (9): LM7805*, LM7812, LM317T*, LM337, AMS1117-3.3*, LM1117-5.0, MCP1700-3302E, TL431* (shunt ref), LM4040A25.
74HC logic (14): 74HC00*, 74HC02, 74HC04*, 74HC08*, 74HC14*, 74HC32, 74HC74*, 74HC86, 74HC138, 74HC164, 74HC165, 74HC595*, 74HC123, 74HC4017.
Timers and oscillators (4): NE555*, TLC555*, LMC555, ICM7555.
Optocouplers and misc (7): PC817*, 4N35, LL4148 (SMD alias family demo), BC846B (SMD BC547 sibling), MMBT3904*, MMBT3906, SS8050.

Alias/package policy: SMD siblings (MMBT3904 vs 2N3904) are separate component.json entries that may share a fitted die model with distinct package metadata; ordering-code aliases go in the alias field, they do not inflate the MPN count dishonestly (count = distinct component.json entries with real datasheet provenance).

## Per-family archetypes (P3 factory must implement + document each)
- diode/zener/LED: single .model D card; fit IV (3+ points), reverse leakage, CJO/TT where datasheet gives them; zeners fit BV/IBV.
- bjt: Gummel-Poon .model; fit from hFE vs IC table, VCE(sat), fT, Cob.
- mosfet: VDMOS .model (ngspice native); fit Vth window, transfer curve, RDS(on) at stated VGS, capacitances, body diode.
- jfet: NJF/PJF .model; fit IDSS, VP, gm.
- opamp/comparator: subckt macromodel; comparator adds tpd and open-collector output stage where applicable.
- vreg_linear: behavioral subckt: reference + error amp + pass element + dropout + current limit; validate line/load regulation points.
- logic_74hc: per-gate analog behavioral subckt; validate VTC thresholds (VIH/VIL/VOH/VOL at rated VCC) and tpd into stated CL.
- timer_555: internal-architecture subckt (comparators + latch + discharge switch); validate astable and monostable periods against datasheet formulas within stated tolerance.

Every archetype has a written spec in docs/model-archetypes/ (authored and ngspice-46-verified 2026-08-06; P3 exit requirement met).

## P5 tranche (frozen 2026-08-09)

P5 contains exactly these 20 manufacturer MPNs. F2 priority marks a review target, not a guaranteed fidelity outcome. A package may claim F2 only when its cited datasheet curves were actually fitted through native ngspice-46.

| MPN | Family | P5 intent |
|---|---|---|
| LM386* | audio and analog IC | Audio power amplifier; F2 priority |
| TL084 | audio and analog IC | Quad JFET-input op-amp |
| NE5534 | audio and analog IC | Low-noise single op-amp |
| LM833 | audio and analog IC | Dual low-noise op-amp |
| LM13700* | audio and analog IC | Dual operational transconductance amplifier; F2 priority |
| BD139* | BJT | NPN power transistor; F2 priority |
| BD140 | BJT | PNP power transistor |
| TIP41C | BJT | NPN power transistor |
| TIP42C | BJT | PNP power transistor |
| 2N5088 | BJT | Low-noise NPN transistor |
| IRFZ44N* | MOSFET | N-channel VDMOS; F2 priority |
| IRF3205 | MOSFET | N-channel VDMOS |
| SS14* | diode | SMD Schottky rectifier; F2 priority |
| 1N5822 | diode | 3 A Schottky rectifier |
| BZX84C5V1 | diode | SMD 5.1 V zener |
| BAT85 | diode | Small-signal Schottky diode |
| MMBT2222A | SMD sibling | Separate package and provenance; may share the fitted PN2222A die model only under the alias/package policy |
| LM35* | sensor | 10 mV/degC behavioral temperature sensor; F2 priority |
| NTCLE100E3103JB0 | sensor | 10 kohm NTC using a B-parameter model |
| GL5528 | sensor | Behavioral LDR using an illuminance parameter |

P5 adds the `sensor_behavioral` archetype. It uses portable analog SPICE behavioral sources, controlled sources, behavioral resistors, and passive elements only. XSPICE remains unavailable and prohibited.
