# ADR-0011: Power-inductor facts-V3.4 excitation conditions

- Status: Accepted
- Date: 2026-08-25

## Context

The frozen `power.power-inductor` facts-V2 contract requires every reviewed inductance value to carry both `testCurrent` and `switchingFrequency` conditions. Some manufacturer datasheets instead characterize inductance with an AC test voltage and frequency. Converting that published voltage into a test-current claim would invent evidence, while weakening facts-V2 in place would change frozen schemas, codecs, profile bytes, and admission behavior.

The distinction is about the manufacturer's measurement condition. Neither a published test current nor a published test voltage alone proves ripple current, saturation margin, temperature rise, core loss, or suitability in a requested converter.

## Decision

Add exact facts schema `3.4.0` only for `power.power-inductor`.

The outer profile envelope remains `schemaVersion: "1.0.0"`. Facts `3.4.0` does not accept any other Power, Motor, or shared class. V1, facts-V2, and facts `3.0.0` through `3.3.0` remain byte-frozen. Runtime and browser-safe catalog dispatch bind the exact `(partClass, factsSchemaVersion)` tuple and do not infer a version from field shape or fall back to another codec.

Facts `3.4.0` preserves the complete facts-V2 power-inductor field set, units, numeric domains, required-for-admission states, operating-range vocabulary, and mounted-geometry contract. Only the reviewed-inductance excitation condition changes:

- exactly one `switchingFrequency` condition is required;
- at least one of `testCurrent` or `testVoltage` is required;
- both excitation conditions are allowed when the source publishes both; and
- each named current or voltage condition may occur at most once.

An unknown inductance remains exact unknown and cannot carry a value, evidence, or operating conditions. Unknown condition parameters, empty ranges, wrong units, duplicate conditions, wrong classes, and wrong versions fail closed in both runtime validation and the generated JSON Schema.

## Evidence, admission, and recipe boundary

This contract records a manufacturer's published inductance test setup. It does not derive an AC current from voltage, reinterpret typical values as guarantees, or alter the meaning of DC resistance, saturation-current, temperature-rise/RMS-current, core-loss, or operating-temperature evidence.

Adding the contract and dispatch did not itself author or admit a profile, change the reviewed catalog, install a recipe, select a part, or change a generated design. Catalog release `2026-08-25.15` separately admitted the exact independently reviewed Bel Fuse `F1F2-0804-2R2M` facts `3.4.0` profile (`sha256:6eb4c18bb984319a5fa56d615f571c03e4fa7670e2782ff4754dbba13dbc89b6`). A later decision installed recipe `3.4.2` (`sha256:86d679c665cd46d355eddfdaa3bda2f80e8f6c7d97b31f7f6e6ce88dc619968a`); `3.4.3` (`sha256:b39032f3fe4ab1b40a12ac7128bf09db18c31e369a96ead925dd3e1b06710a84`), `3.4.4` (`sha256:e39f5e67c0fd52d44170f0222455eade876385ba0771d6e78c420d02aa60999c`), and `3.4.5` (`sha256:5215038a5a4fbb221d1b8889d7a5cbad629ff2cc386425c97add508a0f031cee`) remain immutable predecessors. Current catalog release `2026-08-27.2` (`sha256:a72bfec6700904360882893a96db5a9420efccfb46ad78f1e3826301abe1f29e`) admits Bel `F1F2-0804-100M` (`sha256:992fbb33e9d98f313c3d19fa3e7387e84651be786e44ed7b7e1e45edb9d7019b`), and runtime recipe `3.4.6` (`sha256:c36cdcd96b25808fb913f152e211a6c08ac7f0bf675274f393bd00b31b2d3b1c`) selects it at 10 µH together with a quantity-two Murata `GRM32ER71E226KE15L` 22 µF output-capacitor line. Neither admission nor installation grants candidate eligibility, effective capacitance, passive current sharing, stability, thermal, simulation, provider, sourcing, or release authority.

Under the current exact browser request, strict generation records one `unknown_constraint_disallowed` rejection and retains no candidate. Explicit unknown-evidence inspection records zero rejections and materializes one exact-BOM structural observation, but installed Power policy `sha256:fdef96d5e34b8acea673b9df199430c5be56d64c5cb5e58481a20d89d4df57f6` marks it ineligible. At the exact 25 °C request point, newly reviewed 0.10 W / 75 V divider-resistor evidence permits `power.passive.resistor-power-voltage` to pass. The already calculated 4.74970376238 V to 5.17387393939 V VFB/resistor corners also fit the request's explicit 4.7 V to 5.3 V DC-regulation envelope, permitting only `power.feedback.output-voltage` to close. Because the request has no load-transient target, `power.request.load-transient` is omitted; a numeric target would emit a blocking unknown. Thirteen other constraints remain unknown, including selected-value/current and passive effective-value, ripple, loss, stability, protection, and thermal boundaries. Recipe `3.4.6` emits ideal-equation inductor peak, peak-to-peak ripple and RMS current plus total capacitor-bank RMS current only as `estimated` observations; nominal/condition-mismatched inductance, control behavior, per-part current sharing, ripple rating, loss, and thermal suitability are not closed. The reviewed 12 A minimum saturation-current and 10 A minimum temperature-rise-current endpoints remain conditioned to the manufacturer's 25 °C reference, and the nominal inductance test conditions do not cover the calculated operating point. No hard-failure result has been manufactured into a pass.

In particular, a source that publishes DC resistance as a nominal value plus tolerance requires an explicit semantic review before any derived upper value is represented as an admission fact. The contract does not resolve that evidence decision.

## Compatibility locks

Compatibility requires tests proving that:

- every pre-`3.4.0` checked-in schema byte remains unchanged;
- facts `3.4.0` accepts only `power.power-inductor`;
- current-only, voltage-only, and source-published dual-excitation inductance conditions validate;
- missing frequency or excitation, duplicate conditions, unknown parameters, empty ranges, and unit mismatches are rejected identically by runtime and AJV;
- V1 and facts-V2 continue to reject voltage-only reviewed inductance; and
- mixed-library and browser-safe catalog dispatch select only the exact power-inductor facts `3.4.0` tuple.

## Consequences

- Manufacturer voltage-characterized inductance can be represented without fabricating a current condition.
- Existing profile and schema identities remain stable.
- The new evidence shape is available to independently reviewed profiles. Profile admission alone has no runtime design effect; the current effect is bound only through the separate exact-hash qualified recipe above.
- Converter ripple, saturation, loss, thermal, transient, stability, selected-part simulation, sourcing, and production-suitability claims remain outside this contract.
