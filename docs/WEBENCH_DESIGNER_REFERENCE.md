# TI WEBENCH Power Designer — functional reference

Checked 27 August 2026 in the public WEBENCH Power Designer using a real browser. This is a functional and visual reference for Robonyx Designer, not a cloning specification. It does not reproduce TI code, artwork or circuit assets.

## Evidence key and access boundary

- **Observed live** — visible in the current public application at desktop and narrow viewport sizes.
- **Official supporting evidence** — TI help, articles, videos or training used only where the live path required a myTI login. Some support pages describe older interfaces; contradictions with the live application are called out.
- **Robonyx recommendation** — an implementation inference from those observations, not a claim about TI's current product.

The current public journey was directly observable from entry through generated solutions and side-by-side comparison. Opening a selected design's `Customize Design` action redirected to myTI authentication, so the selected-design, simulation and export workspace below is reconstructed from official TI material and is not presented as a live 2026 observation.

## The pattern in one screenful

WEBENCH keeps each stage focused on one decision:

1. Pick a design family from two large cards.
2. Enter the minimum electrical requirements, revealing advanced settings only if needed.
3. Generate many complete designs and narrow them with filters, sorting, table/card views and comparison.
4. Select one design, then customise, simulate and export in a persistent engineering workspace.

The visual hierarchy is action-first. Legal notice and advanced parameters are subordinate; generated circuit information is dense and comparative. The current public labels reinforce the sequence: `Select • Customize • Simulate • Export`.

## Current information architecture

| Level | Current visible terminology | Main job |
| --- | --- | --- |
| Entry | `WEBENCH® POWER DESIGNER`; `Select • Customize • Simulate • Export`; `DC/DC Power Designs`; `AC/DC Power Designs`; `START DESIGN` | Make the first branch unmistakable. |
| Requirements | `Create a new DC/DC power design`; `Part Number`; `Input`; `Output`; `Design Consideration`; `Advanced`; `Design Parameters`; `View Designs` | Capture the operating point and one optimisation intent. |
| Solutions | `Select a Design`; `SELECT`; `CUSTOMIZE`; `SIMULATE`; `EXPORT`; `matching designs`; `TABLE VIEW`; `Compare`; `Customize`; `Simulate`; `Export` | Scan, filter, sort and compare complete solutions. |
| Comparison | `Comparing 2 of ... Designs you have selected`; `VIEW OPTIONS:`; `Basic`; `Advanced`; `Customize Design` | Compare up to several complete designs on aligned attributes. |
| Selected design | Official supporting evidence uses `Customize`, `Schematic`, `PCB Layout`, `Bill of Materials`, `Operating Values`, `Charts`, `Simulate` and `Export` | Inspect and modify one complete design, analyse it, then hand it off. |

The official help hierarchy is `Select` → `Design` → `Analyze` → `Export`. Under `Design` it lists `BOM`, `Charts`, `OpVals`, `Optimizer Knob` and `Schematic`; under `Analyze`, electrical/thermal simulation, recompensation and schematic editing; under `Export`, documentation, PCB, schematic and simulation export, sharing and BuildIt. This tree is useful as a capability map, but not all terminology is current: the live requirements page uses `Design Consideration`, and TI's HTML5 redesign article says the former optimiser knob was removed.

## Journey and layout

### 1. Entry: one obvious branch, one obvious action

**Observed live.** At 1440 × 1000, a compact global header contains the hamburger control, `WEBENCH® POWER DESIGNER` and `Login`. Below it, the sequence statement is centred above two equal, prominent cards:

- `DC/DC Power Designs` → `START DESIGN`
- `AC/DC Power Designs` → `START DESIGN`

There is no explanatory wall before the choice. Legal links sit in the footer. At 756 px wide the two cards still fit side by side.

**Robonyx recommendation.** Map this decisiveness to two equal first-class cards, `Power Designer` and `Motor Designer`, with a short concrete descriptor and a primary `Start Power design` / `Start Motor design` action. Capability, evidence and policy detail should be behind a small secondary disclosure, not interleaved with the first decision.

### 2. Requirements: basics first, optimisation second, details on demand

**Observed live.** `Create a new DC/DC power design` begins with a full-width `Part Number` lookup, then a balanced two-column `Input` / `Output` form.

The basic input controls are:

- `Supply type is` with `DC` / `AC`
- required `Vin Min` and `Vin Max`
- required `Vout` and `Iout Max`
- `Isolated Output`

Each column has an `Advanced` disclosure. Revealed fields include `Vin Nominal`, `Add an Input EMI Filter`, `Iout Nominal` and `Vout Max Ripple`.

Below the electrical fields, `Design Consideration` asks `I want my design to be` and offers four radios: `Balanced`, `Low Cost`, `High Efficiency` and `Small Footprint`. A separate `Design Parameters` disclosure contains thermal, size, timing, frequency, component and topology constraints. The primary action is `View Designs`.

A single inline consent checkbox immediately above that action links to the WEBENCH Notice, site terms and privacy policy. It is a gate, but not a warning page. Advanced engineering constraints and legal detail remain subordinate to the form.

**Robonyx recommendation.** Present operating-point inputs before selection policy. Put advanced constraints, sourcing policy, assumptions and strict/reference behaviour in collapsed sections. Keep one short validity/status line next to a high-contrast `Generate design` action. On desktop the basic inputs and Generate action should be available in the first working viewport; on narrow screens the action should remain reachable in a fixed or sticky bottom bar.

### 3. Solutions: dense narrowing of complete designs

**Observed live.** Generating the default DC/DC example produced `429 matching designs out of 429 total designs` in this session. A persistent context header showed:

- `Select a Design`
- `Input: DC 14 V - 22 V`
- `Output: 3.3 V at 2 A`
- `Temp: 30 °C`
- `Change`
- stage tabs `SELECT`, `CUSTOMIZE`, `SIMULATE`, `EXPORT`

The desktop workspace has a 320 px filter rail and a broad two-column result area. The filter rail contains `Filter by Part Number`, `Regulator Type`, `Topology`, `IC Package`, `IC Features` and histogram/range controls for `Efficiency (%)`, `BOM Cost ($)`, `Footprint (mm²)`, `Switching Frequency (kHz)`, `Output Ripple (mV)`, `Inductor Ripple Current (A)`, `Crossover Frequency (kHz)`, `Phase Margin (°)` and `BOM Count`.

The result toolbar provides sorting by `Default`, `Highest Efficiency`, `Smallest Footprint`, `Lowest BOM Cost`, `Lowest BOM Count`, `Output Ripple` and `Switching Frequency`, plus a `TABLE VIEW` / `CARD VIEW` switch.

Card view leads with the generated schematic, not a generic product image. Each card then exposes the part/title and the decision metrics `Efficiency`, `BOM Cost`, `Footprint`, `BOM Count`, `Topology`, `Frequency` and `IC Cost`, followed by `Customize`, `Simulate` and `Export`. Capability is local: a design that cannot be simulated shows that action disabled rather than adding a page-level warning.

Table view is denser and adds `Select Additional Columns`. Its visible columns included `Compare`, `Part Number`, `Schematic Image`, `Iout(Max) (A)`, `Efficiency (%)`, `BOM Area (mm²)`, `BOM Cost($ | 1ku)`, `BOM Count`, `Description` and `Customize`. This is the stronger model for a professional Robonyx default; card view can remain an alternate inspection mode.

### 4. Comparison: aligned facts, then selection

**Observed live.** Selecting two results opened a bottom selection bar with `2 Designs Selected` and `COMPARE`. The comparison modal kept one design per column with its title, description, schematic and `Customize Design` action. `VIEW OPTIONS:` toggled `Basic` and `Advanced`.

Basic comparison aligned `Design Considerations`, `BOM Area`, `BOM Cost`, `BOM Count`, `Efficiency`, `Frequency` and `Topology`. Advanced added operating and loop data such as `IC Operating Temp`, `Vout peak-to-peak`, `Crossover Frequency`, `Phase Margin`, `Vin Min` and `Vin Max`. The structure makes differences scannable because the metric labels form shared rows rather than independent prose cards.

**Robonyx recommendation.** Preserve pinned comparison for two or three candidates. Align Power/Motor metrics in shared rows and keep evidence state concise but visible. `Select design` should be the dominant action in each column.

### 5. Selected design workspace: complete design at the centre

**Official supporting evidence; live access was gated.** TI's HTML5 redesign article, training material and help describe a persistent selected-design workspace rather than a long report:

- `Customize` places a design summary/configuration column at left and the design surface at right.
- The principal inspection tabs are `Schematic`, `PCB Layout` and `Bill of Materials`.
- `Operating Values` and `Charts` sit with the calculated performance area below/alongside the design surface and recalculate after relevant changes.
- `Simulate` is its own workflow stage. The electrical simulation screen places the waveform viewer beside the schematic and supports Bode, startup, steady-state, input-transient and load-transient analyses.
- `Export` is a terminal stage with direct routes to CAD, schematic, simulation and documentation outputs, plus related product material where available.

The help documentation adds useful functional detail:

- The BOM is a sortable device list with manufacturer part number, quantity, 1,000-unit price, attributes and footprint; alternate components can be selected in context and the table can be exported.
- Operating values expose calculated currents, voltages, dissipation, efficiency, duty cycle and stability data, with Vin/Iout recalculation for corner checks.
- Charts visualise those values across input voltage and output current; named examples include efficiency, duty cycle and loop response.
- The schematic supports component-level alternate selection and is a route into CAD or simulation actions.
- A complete report can include design inputs, schematic, BOM, performance charts and operating values.

**Robonyx recommendation.** The current semantic tabs — `Schematic`, `Operating results`, `BOM / parts`, `Optimize`, `Export` — are a sound base. Make them a compact cockpit:

- narrow persistent left column: requirements summary, configuration and constraints;
- dominant centre: schematic by default, with pan/zoom and direct component selection where supported;
- adjacent or lower tab region: operating results and charts/simulation;
- a compact status strip: feasibility, evidence and affected caveats;
- top-level terminal `Export`, containing only genuinely available hand-offs.

Do not use a literal five-position `Optimizer Knob`: it is legacy documentation, contradicted by TI's later HTML5 design. A compact Priority control or visible metric sort/filter is the current pattern. Any control must change transparent objective weighting, not imply that estimated performance became verified.

## Progressive disclosure and caveats

The live experience uses three useful levels:

1. Required operating inputs and the next action are always visible.
2. Engineering options are grouped under `Advanced` or `Design Parameters`.
3. Terms and full notices are linked separately; unsupported capability is indicated beside the affected action.

For Robonyx, evidence integrity should follow the same hierarchy:

- one short status chip/line on the result or selected design;
- contextual explanation beside the affected metric or unavailable action;
- full provenance, assumptions and evidence policy in `Evidence & caveats` or a details drawer;
- no repetition of `reference`, `ineligible`, `fail closed`, hashes or `unknown ≠ pass` before the user has even chosen Power or Motor.

Dense does not mean more prose. It means more circuit state, comparable values and decision controls in the same viewport.

## Responsive behaviour

**Observed live.** The landing remains clean at 756 px. The working application is desktop-first and does not reflow safely at phone width: at 390 × 844 the requirements form retained an approximately 823 px working width, and the solution filter rail plus result content extended horizontally beyond the viewport. Header controls also overflowed.

**Robonyx recommendation.** Treat that as a behaviour to improve, not copy:

- at or below tablet width, stack application cards and requirement sections;
- move solution filters into a drawer and allow the results table itself to scroll without creating page-level horizontal overflow;
- keep `Generate design` as a full-width bottom action;
- make workspace tabs horizontally scrollable and the schematic independently pannable/zoomable;
- hide secondary IDs/hashes behind details on phones.

## Actionable Robonyx parity checklist

### P0 — pass the current acceptance failures

- [ ] The initial viewport contains two equal, unmistakable choices: `Power Designer` and `Motor Designer`.
- [ ] Each application card has one dominant start action; capability/evidence details are secondary and collapsed.
- [ ] The requirements page puts basic operating inputs before strict/reference, sourcing or evidence policy controls.
- [ ] `Generate design` is high contrast, unambiguous and visible/reachable without opening any disclosure.
- [ ] No disclaimer, evidence-policy paragraph or hash/status block separates the user from the primary application choice or Generate action.
- [ ] There is at most one short caveat/status line near a primary action; the full explanation lives on demand.
- [ ] At 1440 × 900, a selected design shows summary/configuration, a dominant schematic and core result navigation simultaneously; there is no marketing hero inside the workspace.
- [ ] Vertical whitespace and card height are reduced enough that several electrical values or candidate rows are visible at once.

### P1 — match the decision workflow

- [ ] Generated solutions open in a dense, sortable table with part/topology, schematic preview, key performance, BOM/area and evidence state.
- [ ] A filter rail/drawer exposes application-relevant constraints and objective metrics.
- [ ] A card/table switch is optional; it must not hide the dense table behind oversized cards on desktop.
- [ ] Users can pin and compare two or three candidates in aligned rows, then select one directly.
- [ ] Persistent journey context reads approximately `Requirements` → `Solutions` → `Design`, with selected requirements available through `Change` or equivalent.
- [ ] Selected-design navigation keeps `Schematic`, `Operating results`, `BOM / parts`, analysis/optimisation and `Export` as compact neighbouring destinations.
- [ ] Unavailable simulation/export capability is indicated on the affected control, not explained repeatedly across the page.
- [ ] Export presents actual available artefacts first; absent artefact types are omitted or summarised once.

### P1 — responsive acceptance

- [ ] At 390 px, the document has no horizontal overflow.
- [ ] Application choice and requirements become one column; Generate remains directly reachable.
- [ ] Solution filters become a drawer; only the data table or schematic canvas may scroll/pan independently.
- [ ] Secondary evidence IDs and full caveats are disclosed on demand.

## Sources

All URLs were checked on 27 August 2026 unless noted otherwise.

- [WEBENCH Power Designer landing](https://webench.ti.com/power-designer/) — current entry hierarchy, exact family labels and CTA.
- [Current DC/DC requirements](https://webench.ti.com/power-designer/switching-regulator?powerSupply=0) — current basic/advanced fields, Design Consideration controls, consent and `View Designs` action.
- [Current generated-design selection](https://webench.ti.com/power-designer/switching-regulator/select) — current filters, card/table layouts, sorting, actions and comparison; generated results can depend on session state.
- [Power Designer help overview](https://webench.ti.com/help/PowerDesigner/Overview.htm) — official Select/Design/Analyze/Export capability map; some terminology is legacy.
- [BOM help](https://webench.ti.com/help/PowerDesigner/BOM/BOM.htm), [Charts help](https://webench.ti.com/help/PowerDesigner/Charts/Charts.htm), [Operating Values help](https://webench.ti.com/help/PowerDesigner/OpVals/OpVals.htm), [Schematic help](https://webench.ti.com/help/PowerDesigner/Schematic/Schematic.htm) — official selected-design panel behaviours.
- [Electrical Simulation help](https://webench.ti.com/help/PowerDesigner/Electrical_Simulation/Electrical_Simulation.htm) — official simulation layout, modes and waveform interactions.
- [Documentation help](https://webench.ti.com/help/PowerDesigner/Documentation/Documentation.htm), [PCB export help](https://webench.ti.com/help/PowerDesigner/PCB_Export/PCB_Export.htm), [Schematic export help](https://webench.ti.com/help/PowerDesigner/Schematic_Export/Schematic_Export.htm), [Simulation export help](https://webench.ti.com/help/PowerDesigner/Simulation_Export/Simulation_Export.htm) — official hand-off structure and capability limits.
- [WEBENCH HTML5 redesign article](https://www.ti.com/lit/ta/sszt719/sszt719.pdf) (2018) — official rationale for card/table selection, side-by-side compare, staged Customize/Simulate/Export and removal of the optimiser knob.
- [WEBENCH Power Designer training](https://www.ti.com/lit/ml/slyp708/slyp708.pdf) (2020) — official workspace screenshots and end-to-end capability evidence for the login-gated stages.
- [WEBENCH Power Designer video series](https://www.ti.com/video/series/webench-power-designer.html) (2018–2019) — official walkthroughs of the select/customise/simulate/export model.

## Access limits

- The public selected-design `Customize Design` action redirected to myTI login, so no claim above treats the post-selection interface as directly observed in 2026.
- Official help includes legacy labels and layouts. In particular, `Optimizer Knob`, `Visualizer` and some `Design`-stage wording should not be copied as current UI.
- Result counts, example parts, prices and availability are session- and time-dependent; they are observations, not parity targets.
- The narrow-viewport findings describe the current public pages tested, not a claim about every WEBENCH route or embedded experience.
