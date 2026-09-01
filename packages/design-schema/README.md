# scheMAGIC Designer schema

Versioned, runtime-validated contracts shared by scheMAGIC Motor Designer, scheMAGIC Power Designer, and the generic design engine.

All physical values use canonical SI units in `Quantity.value` and `Quantity.unit`; `displayUnit` is presentation metadata only. Requests declare assumptions explicitly and are serialized canonically for reproducible hashing. Persisted request objects are closed: unknown fields are rejected rather than silently retained through migration.

The primary-part customization V1 sidecar is a separate, strict 16 KiB transfer contract for one same-class `primary` substitution. It binds the semantic and exact-byte request identities, exact regenerated source result/candidate, installed library/catalog/recipe/policy context, and source/target profile content hashes. It is untrusted instruction data only: parsing does not admit a profile, run a recipe, create a replacement candidate, evaluate policy eligibility, add model fidelity, or grant commercial or simulation authority.

Motor requests include an explicit `operatingPoint` with PWM duty cycle, load current, current basis, and load profile so loss and efficiency calculations never rely on a hidden operating condition.

Power requests may add an absolute `dcOutputVoltageRegulation` minimum/maximum envelope. Older request bytes remain valid when the field is absent; absence means recipes must keep DC regulation proof unknown.

The design schema depends one way on `@opencircuit/sourcing-schema`: a request may contain `sourcing?: SourcingPolicy`, selected components use the shared `ManufacturerPartIdentity`, and a candidate may contain `sourcing?: CandidateSourcingMetrics`. The sourcing package never imports design types.

Reference requests are pinned under `test/fixtures/requests/`:

- `m1-compact.design-request.json`
- `m2-power.design-request.json`
- `p1-compact.design-request.json`
- `p2-high-voltage.design-request.json`

Run `npm test --workspace=@opencircuit/design-schema` and `npm run typecheck --workspace=@opencircuit/design-schema` from the repository root.
