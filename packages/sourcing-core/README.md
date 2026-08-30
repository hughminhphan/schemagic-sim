# scheMAGIC Sourcing core

Deterministic, provider-neutral BOM evaluation for scheMAGIC Sourcing. The
package applies a frozen `SourcingPolicy` to validated `OfferSnapshot` objects
and returns frozen-schema `CandidateSourcingMetrics` plus explicit policy
decisions.

Known policy violations fail. Missing, partial, stale, or provider-error data is
`unknown`, never a pass and never zero. The design-engine-compatible adapter
keeps unknown candidates electrically available while rejecting known sourcing
failures. Sourcing cannot substitute a component or change an electrical fact.

```ts
import { evaluateCandidateSourcing } from "@opencircuit/sourcing-core";

context.evaluateSourcing = evaluateCandidateSourcing;
```

The package also owns versioned DigiKey and Mouser provider-policy manifests.
Both manifests are deliberately disabled until credentials, rate limits, and
the intended display/cache/export behavior have written provider approval.
There is no LCSC adapter or live-data policy.
