# Provider policy status

The executable manifests live in `src/provider-policies`. Each provider exports
its compatibility V1 manifest and a canonical, content-hash-pinned V2 policy
document. Both versions remain conservative operational policy, not a claim
about rights granted by a provider. An adapter cannot run until every blocker
below is replaced by written, account-specific configuration and the V2 policy
document is reviewed and re-hashed.

## DigiKey

- Official ProductDetails accepts one product number per request, so the
  application bound is one exact manufacturer identity per runtime lookup.
- OAuth application credentials have not been provisioned for this deployment.
- Issued request limits have not been recorded.
- Display attribution, cache lifetime, normalized-data persistence, export,
  public-hosted access, and self-host/BYOK behavior lack written approval.
- Runtime state, rate limiting, cache TTL, persistence, and both availability
  modes therefore remain disabled.

## Mouser

- Official Search API V2 documents at most ten pipe-separated part-number
  values, 3–40 characters each; the application additionally requires one
  provider-listed manufacturer name and the Exact option.
- An API key has not been issued for this deployment.
- Issued request limits have not been recorded.
- Display attribution, cache lifetime, normalized-data persistence, export,
  public-hosted access, and self-host/BYOK behavior lack written approval.
- Runtime state, rate limiting, cache TTL, persistence, and both availability
  modes therefore remain disabled.

No LCSC policy or adapter exists. LCSC remains an exact-MPN link-out until the
post-traction partnership gate is approved.

Field-level source links, conservative mappings, and unresolved API/terms
questions are recorded in
`apps/sourcing-service/src/providers/OFFICIAL_FIELD_MAPPING.md`.
