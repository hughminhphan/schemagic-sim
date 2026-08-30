# scheMAGIC Designer engine

The application-neutral deterministic compiler shared by scheMAGIC Motor Designer and scheMAGIC Power Designer.

The engine owns the fixed pipeline:

`normalize → enumerate → solve → match → check → estimate → materialize → coverage validation → dedupe → Pareto prune → stable rank`

Application equations, device predicates, component data, and circuit templates enter through `DesignRecipe`; the engine contains no Motor or Power branches. Recipes receive an `ElectricalDesignRequest` with sourcing removed. It performs no network calls. Optional sourcing consumes validated, immutable offer snapshots through a supplied evaluator after electrical checks and before ranking; without a snapshot, candidates remain electrically valid and report sourcing as unavailable.

Candidate identity is computed before sourcing. Circuit materialization receives only electrical constraints, while the final `DesignResult` may expose combined electrical and sourcing constraints. Missing evidence remains unknown, hard failures cannot be ranked or materialized, and complete results use deterministic ordering and explicit tie-breaking.

The engine-internal `evaluatePrimaryPartCustomizationV1` primitive handles the observation layer for one exact primary-part substitution. Public Motor and Power runtime leaves expose installed-policy wrappers that bind it to their code-owned V3 catalogs; callers cannot authorize a policy by supplying a matching hash. The evaluator regenerates and byte-compares the ordinary V2 result and execution report, verifies the request/context/policy/profile bindings, and may recover one checked, estimated, materialized, parsed same-recipe target from the deduplicated pre-Pareto drafts only when every non-primary component is byte-identical. It never mutates the ordinary result. The returned observation explicitly leaves V3 policy eligibility unevaluated and adds no selected-part model; browser UI, sharing, export, and adapter-authorized customized generation remain separate work.
