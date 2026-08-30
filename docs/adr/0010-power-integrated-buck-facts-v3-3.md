# ADR-0010: Power integrated synchronous buck facts-V3.3 evidence roles

- Status: Accepted
- Date: 2026-08-24

## Context

The frozen `power.integrated-synchronous-buck-regulator` facts-V2 contract requires a complete set of configuration-independent reviewed production claims. Real integrated buck regulators commonly publish a different evidence shape: a fixed-oscillator production spread rather than a configurable recommended frequency, a continuous-current capability statement whose practical limit depends on the inductor, board, and thermal solution, a protection current threshold, typical switch resistance, characteristic thermal metrics, and typical or not-production-tested timing. Application-specific input/output capacitance, ripple, loop stability, losses, and transient behavior cannot be established from a regulator-only profile.

Promoting those observations into guaranteed operating limits would manufacture evidence. Weakening facts-V2 in place would change frozen schemas, codecs, profile bytes, admission behavior, and recipe identities. Requiring every device to populate facts it does not publish would continue to block honest reviewed profiles without improving design truth.

## Decision

Add exact facts schema `3.3.0` only for `power.integrated-synchronous-buck-regulator`.

The outer profile envelope remains `schemaVersion: "1.0.0"`. Facts `3.3.0` does not accept the external-controller or any Motor/shared class. V1, facts-V2, facts `3.0.0`, facts `3.1.0`, and facts `3.2.0` remain frozen. Dispatch must bind the exact `(partClass, factsSchemaVersion)` tuple and must not infer a version from field shape or fall back to another codec.

This first integrated-buck contract deliberately reuses the legacy `ProfileFact` and `OperatingRange` evidence vocabulary and the facts-V2 mounted-geometry structure. It is a regulator evidence contract, not a complete converter solver or simulation model.

### Required architecture and envelope facts

Admission requires reviewed evidence for:

- synchronous-buck topology and an integrated-FET power stage;
- internal, external, or application-dependent compensation architecture;
- input operating minimum, input operating maximum, and input absolute maximum;
- output operating minimum and output operating maximum;
- one output-current quantity and its evidence role;
- switching-frequency architecture and its evidence role;
- feedback-reference typical value and its evidence role;
- maximum junction temperature;
- bootstrap-capacitance requirement classification;
- package identity; and
- mounted board-area geometry and maximum height.

The deterministic ordering rules are:

`input operating minimum < input operating maximum <= input absolute maximum`

`output operating minimum < output operating maximum`

Known frequency, feedback-reference, and current-limit endpoints must also remain monotonically ordered.

Input absolute maximum is a damage boundary, not an operating recommendation. Maximum junction temperature is likewise an absolute-rating ceiling; it does not prove actual junction temperature.

### Output-current evidence roles

`outputCurrentRole` is one of:

- `guaranteed_operating_limit`;
- `continuous_capability_statement`;
- `typical_observation`;
- `board_specific_observation`;
- `absolute_rating`; or
- `protection_threshold`.

Only a condition-covering `guaranteed_operating_limit` may support a hard regulator-current feasibility pass. A continuous-capability headline remains useful evidence but does not prove that an arbitrary selected inductor, PCB, ambient, switching condition, or thermal solution supports that current. Absolute ratings and protection thresholds are never normal operating limits.

### Frequency and feedback groups

The frequency architecture distinguishes fixed oscillators, resistor-programmed oscillators, external synchronization, and fixed-or-synchronized devices. Frequency evidence retains optional minimum, nominal, and maximum quantities plus one role:

- `production_spread` requires reviewed minimum, nominal, and maximum values;
- `guaranteed_adjustment_range` requires reviewed minimum and maximum values;
- `recommended_setting` requires a reviewed nominal value; and
- `typical_observation` requires a reviewed nominal value.

A fixed-oscillator typical or production-spread value is not relabeled as a configurable recommendation. A recipe must separately decide whether the request accepts a fixed frequency, an adjustment range, or synchronization.

Feedback-reference evidence retains optional minimum, typical, and maximum quantities. `production_spread` requires all three values; `typical_observation` requires only the typical value. Only a condition-covering production spread may support worst-case divider-corner proof. A typical reference may be displayed or used in an explicitly non-guaranteeing estimate, but it cannot certify output-voltage accuracy.

### Current limit, timing, resistance, current, and thermal roles

Current-limit evidence is separately classified as `protection_threshold`, `guaranteed_operating_limit`, or `typical_observation`. A protection threshold is not output-current capability. No current-limit pass exists until a recipe combines the exact threshold semantics with inductor ripple/peak current and every selected component condition.

Minimum on-time and off-time use `guaranteed_bound` or `typical_observation`. Typical and not-production-tested timing cannot produce a hard duty-cycle pass.

High-side and low-side on-resistance and non-switching supply current use `guaranteed_maximum` or `typical_observation`. Junction-to-ambient thermal resistance additionally distinguishes `test_characteristic` and `board_specific_observation`. Only a condition-covering guaranteed maximum can serve as a hard bound, and this first contract does not claim a complete loss or thermal calculation.

### Bootstrap capacitance

Bootstrap capacitance is classified as `required_nominal_value`, `recommended_value`, `typical_observation`, `application_dependent`, or `not_specified`.

- `application_dependent` and `not_specified` require an exact-unknown capacitance quantity.
- The other roles require a reviewed quantity with the same canonical evidence and conditions as the role.
- `required_nominal_value` means the source directs the application to use that nominal value; it is not converted into a minimum-capacitance claim.
- A recipe must separately verify the selected capacitor nominal value, tolerance/effective capacitance applicability, rated voltage, and requested operating conditions.

Input and output capacitor sizing are intentionally absent from the regulator-only contract. They remain application decisions tied to ripple, transient, ESR, bias, tolerance, and stability analysis.

### State, evidence, and condition coupling

Every quantity-and-role pair is coupled:

- an unknown quantity requires an exact-unknown role;
- a reviewed quantity requires a reviewed role;
- reviewed quantity and role facts retain byte-identical canonical `validFor` arrays and identical canonical evidence sets; and
- grouped frequency, feedback, and current-limit facts apply the same coupling to every reviewed member.

Optional electrical facts must be reviewed or exact unknown at admission. Estimated or calculated electrical observations cannot enter the reviewed release. Mounted board area remains the sole calculated admission surface and is validated using the existing deterministic manufacturer-land-pattern geometry contract.

## Recipe and release boundary

The additive recipe identity is `power.native.integrated-synchronous-buck.facts-v3-3@3.3.0`. It binds the integrated regulator at exact facts `3.3.0` and existing power-inductor, general-purpose-resistor, and MLCC profiles at exact facts `2.0.0`.

The recipe must remain uninstalled until at least one exact facts-V3.3 regulator profile is independently reviewed and admitted. Catalog release `2026-08-24.14` satisfies that prerequisite with Texas Instruments `TPS54302DDCR`; its admission is independently hash-bound and is not established merely by naming it in this ADR.

Adding this contract alone does not make Power production-ready. The installed recipe preserves unknown ripple, transient, stability, loss, thermal, inductor-sizing, capacitor-effective-value, and selected-part simulation results. Known passive limits still reject incompatible selections. A permissive unknown-policy request may retain explicit unknown hard constraints; it may not override a known failed constraint.

The later `power.native.integrated-synchronous-buck.facts-v3-4-inductor-qualified@3.4.2` predecessor (`sha256:86d679c665cd46d355eddfdaa3bda2f80e8f6c7d97b31f7f6e6ce88dc619968a`) first bound the same exact facts-V3.3 regulator to the separately admitted Bel Fuse facts-V3.4 inductor and remains byte-frozen. Immutable `3.4.3` (`sha256:b39032f3fe4ab1b40a12ac7128bf09db18c31e369a96ead925dd3e1b06710a84`), `3.4.4` (`sha256:e39f5e67c0fd52d44170f0222455eade876385ba0771d6e78c420d02aa60999c`), and `3.4.5` (`sha256:5215038a5a4fbb221d1b8889d7a5cbad629ff2cc386425c97add508a0f031cee`) are retained predecessors. The current installed successor is `3.4.6` (`sha256:c36cdcd96b25808fb913f152e211a6c08ac7f0bf675274f393bd00b31b2d3b1c`), selecting one reviewed Bel `F1F2-0804-100M` 10 µH inductor and a quantity-two Murata `GRM32ER71E226KE15L` 22 µF output-capacitor line. Under the current browser request it produces no hard failure: strict generation excludes one option because unknown hard constraints are disallowed, while explicit inspection retains one exact-BOM observation with zero rejections. Installed policy `sha256:fdef96d5e34b8acea673b9df199430c5be56d64c5cb5e58481a20d89d4df57f6` keeps that observation ineligible at 9 pass, 13 unknown, 0 fail. Four ideal-equation passive-current values are exposed only as estimates and cannot change those constraints. The source-bounded divider-resistor rule passes at the exact 25 °C point, and the calculated VFB/resistor corners fit the explicitly requested 4.7 V to 5.3 V DC-regulation envelope; the null load-transient target emits no rule, while a numeric target would emit a blocking unknown. This later installation consequence does not change facts `3.3.0` or confer passive-current, physical, selected-part/full-BOM simulation, provider, sourcing, eligibility, or release authority.

## Compatibility locks

Compatibility requires tests proving that:

- all existing V1, facts-V2, facts `3.0.0`, facts `3.1.0`, and facts `3.2.0` schema bytes remain unchanged;
- facts `3.3.0` accepts only `power.integrated-synchronous-buck-regulator`;
- any external-controller, Motor, shared-class, or forged version tuple is rejected;
- every reviewed quantity/role pair preserves canonical evidence and condition equality;
- frequency and feedback role groups cannot omit values their role requires;
- application-dependent or unspecified bootstrap capacitance cannot carry an invented value; and
- adding the isolated contract does not install a recipe, admit a profile, or change the catalog release.

## Consequences

- Real integrated regulators can preserve exact fixed-frequency, current, feedback, timing, resistance, thermal, and bootstrap evidence without converting observations into guarantees.
- Admission proves only that exact source-backed profile bytes satisfy this contract. Request feasibility remains a separate recipe decision.
- Compensation architecture does not establish loop crossover, phase margin, or stability.
- No selected-part executable model, simulation fidelity, regulation accuracy, ripple, transient response, loss, junction temperature, layout adequacy, EMC, protection coordination, orderability, or production suitability is implied.
- External-FET controller support remains on a separate contract and recipe path.
- DigiKey, Mouser, and every other sourcing provider remain disabled unless separately approved under the existing provider-policy boundary.
