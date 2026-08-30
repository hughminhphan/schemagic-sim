# ADR-0009: Motor integrated-H-bridge facts-V3.2 evidence roles

- Status: Accepted
- Date: 2026-08-24

## Context

The frozen `motor.integrated-h-bridge` facts-V2 contract requires configuration-independent reviewed values for current, timing, duty cycle, and capacitance. Common integrated bridges do not publish all of those facts with that meaning. A device may publish only a peak output limit, a board-specific continuous-current observation, a typical path resistance, or a pulse-width observation. Current regulation may depend on an external reference and sense element. Local and bulk capacitance may be a recommendation or application-dependent rather than a closed guaranteed minimum.

Promoting those observations to hard operating limits would manufacture evidence. Changing facts-V2 in place would also change frozen profile bytes, codecs, admission behavior, and recipe identities.

## Decision

Add exact facts schema `3.2.0` only for `motor.integrated-h-bridge`.

The outer profile envelope remains `schemaVersion: "1.0.0"`. Facts `3.2.0` does not accept the gate-driver, MOSFET, or supply-TVS classes served by facts `3.1.0` and facts `3.0.0`. V1, facts-V2, facts `3.0.0`, and facts `3.1.0` remain frozen. Dispatch always binds the exact `(partClass, factsSchemaVersion)` tuple and never guesses from field shape or falls back to another version.

This first integrated-bridge contract is deliberately small. It reuses the legacy `ProfileFact` and `OperatingRange` evidence/condition vocabulary and the facts-V2 mounted-geometry structure. It does not add tokenized configuration conditions, configurable-equation evaluation, or a component-value solver.

### Architecture and operating facts

The closed facts record carries reviewed architecture facts for:

- full-bridge topology and an integrated FET power stage;
- single-full-bridge or dual-full-bridge-parallel-capable output architecture;
- N-channel charge-pump or P-channel-direct high-side drive;
- optional continuous high-side-on support; and
- a current-regulation interface classified as absent, external-reference-and-sense, integrated-current-mirror-output, or protection-only.

Required reviewed operating facts include supply operating minimum, supply operating maximum, supply absolute maximum, logic-high threshold maximum, path resistance with its evidence role, maximum junction temperature, local-supply decoupling requirement, bulk-capacitance requirement, package name, and mounted geometry. The supply ordering is strict:

`operating minimum < operating maximum <= absolute maximum`

Continuous output current, peak output current, PWM maximum, minimum input pulse width, switching transition time, active supply current, junction-to-ambient thermal resistance, local decoupling capacitance, and bulk capacitance may remain exact unknown where the manufacturer does not publish a source-backed value with representable conditions. Admission requires at least one reviewed continuous- or peak-output-current quantity; admission alone does not turn either quantity into a guaranteed operating limit.

### Role, state, evidence, and condition coupling

Each optional quantity-and-role pair is coupled:

- an unknown quantity requires an exact-unknown role;
- a reviewed quantity requires a reviewed role;
- the quantity and role retain the same canonical evidence set and `validFor` conditions; and
- a recipe must separately verify applicability of both the quantity and its role to the request and selected configuration.

Continuous and peak current use the roles `guaranteed_operating_limit`, `typical_observation`, `board_specific_observation`, `absolute_rating`, and `protection_threshold`. Only `guaranteed_operating_limit` may produce a hard current-feasibility pass. All other roles remain useful source data but are non-guaranteeing.

PWM maximum and minimum input pulse width use `guaranteed_bound` or `typical_observation`. Only a condition-covering `guaranteed_bound` may produce a hard timing pass. A typical observation cannot certify a request.

Path resistance, switching-transition time, and active-supply current retain `guaranteed_maximum` or `typical_observation` roles. A typical value is never promoted to a hard guarantee. Path resistance is retained for evidence and future loss work; this first recipe does not use it to certify loss or thermal feasibility.

Local and bulk capacitance requirements distinguish `required_minimum`, `recommended_value`, `typical_observation`, `application_dependent`, and `not_specified`:

- `application_dependent` and `not_specified` require an exact-unknown capacitance quantity;
- `required_minimum`, `recommended_value`, and `typical_observation` require a reviewed quantity; and
- only a condition-covering `required_minimum` may produce a hard capacitance pass. Recommendations and typical observations remain unknown for hard feasibility.

Reviewed facts keep canonical evidence and conditions. Exact unknowns have null value, no evidence, no conditions, and an explanation. Mounted board area remains the only calculated admission surface and is checked using the existing deterministic manufacturer-land-pattern geometry rules.

### Deferred configured-current semantics

`currentRegulationInterface` records architecture only. It does not define a configured current-limit value.

Reference-voltage equations, sense-resistor selection, tolerance stacks, current-mirror transfer functions, configuration-pin states, and their BOM bindings are deferred to a later additive contract. Therefore the facts-V3.2 recipe must report configured current-limit feasibility as unknown. It must not derive or certify a current limit from the interface discriminator alone.

### Recipe and release boundary

The additive recipe identity is `motor.native.integrated-h-bridge.facts-v3-2@3.2.0`. It binds the integrated bridge at exact facts `3.2.0` and the existing bulk-capacitor and MLCC classes at exact facts `2.0.0`.

The recipe remains uninstalled until at least one exact facts-V3.2 integrated-H-bridge profile has been independently reviewed and admitted. Adding the contract and testing the isolated recipe does not switch the required Motor production topology, make Motor production-ready, or change the bundled reviewed catalog.

## Compatibility locks

Compatibility requires tests proving that:

- all V1, facts-V2, facts `3.0.0`, and facts `3.1.0` schemas, canonical bytes, codecs, and admission behavior remain unchanged;
- existing recipe IDs, versions, content hashes, and installed-recipe membership remain unchanged;
- facts `3.2.0` accepts only `motor.integrated-h-bridge`;
- integrated H bridge plus `3.1.0`, gate driver plus `3.2.0`, MOSFET or TVS plus `3.2.0`, and any forged class/version tuple are rejected even when the surrounding catalog hash is recomputed; and
- mixed-version catalogs select exact codecs deterministically and return detached, deeply frozen profiles.

### First installed consumer (2026-08-26; retained history)

The exported `motor.native.integrated-h-bridge.facts-v3-2@3.2.2` predecessor remains byte-frozen at `sha256:26eb9e820053a9fb4924962fccde309076f7d29cec0e334b5f09f2bd34b9c328`. The immutable successor installed at that point was `3.2.3`, content hash `sha256:86d3e6fed563d7e663d74f692286a2287b2932afea198fe76dc86eab07c50ece`.

The successor delegates every predecessor behavior except `motor.integrated.operating-modes` for the exact reviewed DRV8876 profile `sha256:1786e77a459d8efbc83693b2c79770a3673d6b28e093b3f4f655468156850ef5`. Exact Texas Instruments source `ti-drv8876-slvsds7b` (`sha256:b3deb54e918251d4583c0f12f96b780a7f4f4818fd213c65b6cbacac3e2bc032`) supports PWM mode only when PMODE is sampled logic high at device power-up. Under that latched condition, inputs `00`, `01`, `10`, and `11` map to coast, reverse, forward, and low-side slow-decay brake. STSPIN840, a tampered profile, or any unbound identity retains the predecessor's unknown result.

This is a logical request-mode coverage result only. It does not establish physical pin wiring, configuration timing beyond the cited power-up latch, current-regulation interaction, braking-energy handling, thermal or suppression adequacy, fast-decay behavior, scenario coverage, selected-part simulation fidelity, eligibility, or release suitability.

At that historical installation, Motor policy was `sha256:9c72afd852d72a7f89c6cfac74b9a2162157a0943cedc4353bcc35ce4246862e` under context `sha256:e6e194548dcb9f8a275b3f5cdff1e99647a4105b75204eb5a27ee0b366e8683b`. The then-current exact browser strict request `sha256:7f383fb27d470ce00e801d73249a2e03202846909a26f9999505d8176b43dbc7` produced result `sha256:4fa1e0a1f6daf2b6bf052cab42ed3df411116210925205d3c63b76c096c29e7d` with 16 rejected combinations and no retained candidate. Explicit-inspection request `sha256:3664543dd122fedf5f3d5121c65a57e81d06a6c544a8ead27d5a348b41880bcc` produced result `sha256:0894a40ae0c23f23886beaaa871a6482774fca9eb06f5d0afc3d1d1da55c09f8`, retaining the STSPIN840 observation `candidate:v2:sha256:64b83d0fdf573d1ee1f6cf8588426ba88f39fb840b29514f99148fc5e7a7f5d0`; decision `sha256:99ec87d1595c53b6e5c32de8bcbcccb84d82a157b1a9e872fc982221a4574545` marked it ineligible. These retained identities document predecessor history, not the current release chain.

### Exact local nominal-recommendation successor (2026-08-26)

The immutable `3.2.5` predecessor is content-addressed at `sha256:75e1ea8fa6c3c4fadd44187b9134a2e61840d2ad5b0123d0bbaff17a910dce1a`. It delegates to the byte-frozen `3.2.4` predecessor `sha256:b33804be0fd68ac15bde76ce46db501325dac5030c5b13f7916cd8362c853d84` and changes only `motor.integrated.local-capacitance-nominal` for one exact physical BOM pairing:

- Texas Instruments `DRV8876PWPR`, facts `3.2.0`, profile `sha256:841b83d16c78bdeacf8239cc861df91c52d6fcb9a7890b6bafd1ab3d3d28c85b`;
- TDK `C1608X7R1H104K080AA`, facts `2.0.0`, profile `sha256:6681c71a337c93467eacbb7058dd5afaace3d1198c47a9fcc3b30005cdd826d6`, selected as the one physical `local-decoupling-capacitor` with a reviewed 100 nF nameplate value; and
- exact TI datasheet source `sha256:b3deb54e918251d4583c0f12f96b780a7f4f4818fd213c65b6cbacac3e2bc032` plus exact TDK product source `sha256:3e0a984b0dffd02e9e5c4aea085588df4491bc1dd74e85b5b32502acdc790c12`.

TI Table 1 describes CVM1 as a **recommended** 0.1 uF low-ESR ceramic rated for VM. The successor therefore performs exact nominal equality, not an at-least comparison: the selected C1608's reviewed 100 nF nameplate value exactly matches the nominal-value element of TI's recommendation. Its passing constraint deliberately has no `actual`, `limit`, or `margin` fields and explicitly says that TI did not publish a required minimum.

This exact-pair result is recommendation conformance, not the generic hard capacitance-feasibility pass discussed above. The generic predecessor continues to require a condition-covering `required_minimum`; every other bridge/capacitor identity, profile hash, evidence role, selected role, and physical BOM binding retains the predecessor result. A byte-changed DRV8876 or C1608, another nominally equal capacitor, a larger capacitor, STSPIN840, or a swapped/mutated local component cannot acquire the new pass.

The pass does not prove a capacitance-tolerance floor, effective capacitance under DC bias or temperature, low ESR, VM-voltage suitability, physical placement or interconnect, ripple or transient support, switching safety, or selected-part simulation fidelity. `motor.integrated.capacitor-derating` and the other unresolved safety and requirement rules remain unknown, strict generation remains empty, and the current production policy `sha256:6a1ca0c0b1476163daff6e52724605461b5185a10ffe36dd06642caf59ac45f0` cannot mark an integrated candidate eligible from this nominal match alone.

### Exact DRV8262 companion-network gate (2026-08-27)

Catalog `2026-08-27.2` separately admits the independently reviewed Texas Instruments `DRV8262DDVR` profile `sha256:a6239ab49665a69a9e54c0f4ecd103f7fdcfdf5f6cf29685baf03a1dc4c41a4a`. Admission preserves its conditioned 20 A RMS DDV operating limit, keeps 32 A as a protection threshold rather than a normal peak/stall guarantee, leaves hard PWM evidence unknown, and binds its Most/Density-A TOP-copper geometry to exact TI WEBENCH BXL bytes. Admission does not prove that an installed recipe can represent the part.

The current installed immutable successor is `motor.native.integrated-h-bridge.facts-v3-2@3.2.6` (`sha256:1ffaf03fc1778cb1b287e3f48c6d0fc82eb91b2d6f28b76f2fc500941acb2d07`). It delegates every non-DRV8262 option to `3.2.5` and exact-binds DRV8262's official datasheet bytes `sha256:f07b6126ffab94c7b13a46ce0b758c85e6fa58068bf407480f7a0b954ddc32a7`. The cited Table 6-1 structure requires distinct `CVM1` and `CVM2` VM-bypass positions plus separate charge-pump and regulator capacitor networks. Because the installed materializer has one undifferentiated local-decoupling role and no charge-pump/regulator roles, all ten exact DRV8262 combinations are rejected in match before component materialization, Pareto retention, or customization-witness creation. Changed profile/source bindings remain fail-closed rather than entering the predecessor materializer.

The current Motor context is `sha256:06a4ef8b8141852bf9506c6f4f632a7b349b0947c449f85172313380dc195d38`. Its integrated production observation remains one ineligible STSPIN840 structure: result `sha256:5d3073a4e68e71f60f2d9eeaabb2ca90da213a3794c6a6779ad83eeefd703044`, candidate `candidate:v2:sha256:3f9953a5582e56cd999070367f1b3c4830bfad4d4e9df55e2ce91891fb5cb16e`, and decision `sha256:27aabbc0fc3d812752e803d3ce15d40457572b2faa1f81def3a8f52ff6d05276`. The DRV8262 gate is a representation-safety rejection, not a claim that the part is electrically unsuitable.

## Consequences

- Integrated bridges can retain primary-source current, timing, resistance, supply-current, capacitance, architecture, thermal, and geometry facts without converting observations into guarantees.
- Admission proves only that exact source-backed profile bytes satisfy this contract. Request feasibility remains a separate recipe decision.
- Missing, typical, board-specific, absolute-rating, protection-threshold, recommended, application-dependent, and condition-mismatched claims remain unknown for hard feasibility.
- Configured current-limit equations and BOM selection remain unavailable until a later explicit contract implements them.
- No selected-part simulation model, electrical fidelity, layout adequacy, thermal solution, transient behavior, protection coordination, EMC, functional safety, or production suitability is implied.
- DigiKey, Mouser, and every other sourcing provider remain disabled unless separately approved under the existing sourcing policy boundary.
