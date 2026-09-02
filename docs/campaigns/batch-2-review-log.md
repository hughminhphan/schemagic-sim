# Batch 2 scale-campaign independent review log

Date: 2026-08-10

Reviewer: `gpt-5.6-sol independent reviewer (batch-2 scale campaign)`

Branch: `main`

Scope: exactly 61 unique packages under `tools/conveyor/data/staging/batch-2/packages`. This was one bounded independent review pass. Staging evidence remained unchanged. No model was refitted and no conveyor or factory source was changed.

## Final verdict

| Electrical family | Reviewed | Promoted F2 | Promoted F1 | Demoted | Rejected |
| --- | ---: | ---: | ---: | ---: | ---: |
| Diode | 25 | 3 | 22 | 0 | 0 |
| NMOS | 19 | 0 | 16 | 0 | 3 |
| BJT NPN | 10 | 5 | 0 | 0 | 5 |
| BJT PNP | 7 | 1 | 0 | 0 | 6 |
| **Total** | **61** | **9** | **38** | **0** | **14** |

Final reviewed-library count: **259 packages**, up from 212.

## Campaign accounting and routing

- Review started at `67fdad3 docs(conveyor): record batch-2 execution` on `main`.
- The prior reviewed library contained exactly 212 package directories.
- Staging contained exactly 61 unique package identities.
- `docs/campaigns/batch-2-selection.json` and `docs/campaigns/batch-2-execution.json` reconcile to 120 selected records, 61 staged packages, 30 duplicate fitted-vector skips, and 29 package-validation failures.
- All 30 duplicate-vector skips and all 29 package-validation failures have no staged package path and none was promoted.
- The only pre-existing untracked roots were `.claude/` and `tools/conveyor/data.pre-hardening/`. Neither root was added, removed, or modified by this review.

## Independent review method

1. Reconstructed the exact 61-package candidate set from the selection and execution records and checked campaign identity, manufacturer, ordering code, canonical path, aliases, and source mapping.
2. Read every package contract, source record, model card, fitted vector, bench, expectation record, validation result, and cached primary PDF evidence. Targeted rendered-page inspection resolved four identities that automatic PDF text matching did not resolve.
3. Reproduced all 61 primary-PDF SHA-256 values and checked that every parsed page and figure citation is within the corresponding PDF page range.
4. Independently reran all 61 staged packages in isolated scratch copies: 61 schema passes, 168 native ngspice-46 versus pinned-WASM bench passes, and 266 declared expectation passes. Every bench contains explicit `.temp 25`.
5. Adjudicated expectation honesty separately from pass status. Added review-only checks for omitted published maxima and defining Zener reverse behavior, then rejected packages that would require parameter refitting.
6. Recomputed all 10 F2 residual summaries against unchanged `tools/model-factory/lib/fit-gates.json`, checked physical-bound saturation, and audited exact curve scope, units, temperatures, and bias conditions.
7. Indexed canonical identities, ordering aliases, and complete numeric fitted vectors across the prior 212-package library and all 61 candidates. Complete-vector duplicates required explicit shared-die evidence.
8. Applied only evidence-backed metadata, alias, expectation, and F2-scope corrections in promoted copies. Staging originals were not edited.

## Source provenance and identity

- Cached primary PDF hash reproduction: 61 of 61 matched.
- Parsed page-range validation: 61 of 61 passed.
- Automatic exact-text identity detection: 57 of 61. Rendered primary pages resolved `AP2300`, `AP2302B`, `SI2302-HXY`, and `SI2302-2.3A-JSM`.
- `AP2300` and `AP2302B` are directly supported by their primary PDFs.
- The HXY PDF identifies `SI2302`, not `SI2302-HXY`. Canonicalization would collide with reviewed `vishay/SI2302`, so the candidate was rejected.
- The JSMSEMI PDF identifies `SI2302-2.3A`. The promoted package uses that canonical identity and retains `SI2302-2.3A-JSM` only as an ordering-code alias.
- Vendor SPICE model evidence used: none.

## Fresh execution evidence

- Staged population: 61 of 61 schema passes, 168 of 168 native-versus-WASM bench passes, and 266 of 266 declared expectation passes.
- Promoted population after reviewer corrections: 47 of 47 schema passes, 157 of 157 native-versus-WASM bench passes, and 247 of 247 expectation passes.
- Every staged and promoted bench explicitly contains `.temp 25`.

## F2 adjudication

All 10 staged F2 residual summaries recomputed exactly and satisfy the unchanged family gates. No diode parameter is saturated at a physical fit bound. Nine claims were promoted; the Guangdong Hottech `BC847B` claim was rejected only because its canonical identity collides with the stronger hongjiacheng `BC847B` evidence record.

| Manufacturer | MPN | Family | Points | Worst relative error | RMS relative error | Verdict |
| --- | --- | --- | ---: | ---: | ---: | --- |
| Guangdong Hottech | `BC847B` | bjt_npn | 7 | 0.0897552 | 0.0447233 | Reject: canonical identity collision |
| hongjiacheng | `2SC1623` | bjt_npn | 5 | 0.101085 | 0.066758 | Promote F2 |
| hongjiacheng | `B0540WS` | diode | 8 | 0.0122283 | 0.00724656 | Promote F2 |
| hongjiacheng | `BC847B` | bjt_npn | 8 | 0.0454976 | 0.0303754 | Promote F2 |
| hongjiacheng | `BCX56-10` | bjt_npn | 5 | 0.0437423 | 0.0313736 | Promote F2 |
| hongjiacheng | `DSK36` | diode | 9 | 0.0240158 | 0.00979645 | Promote F2 |
| hongjiacheng | `MMBTA56` | bjt_pnp | 5 | 0.124765 | 0.0823962 | Promote F2 |
| hongjiacheng | `SS24` | diode | 8 | 0.0218676 | 0.0145729 | Promote F2 |
| LRC | `LMBT2222ALT1G` | bjt_npn | 4 | 0.0424458 | 0.0278387 | Promote F2 |
| MDD Microdiode | `MMBT3904-E` | bjt_npn | 7 | 0.0917013 | 0.0630681 | Promote F2 |

Promoted F2 scope corrections:

- Six BJT packages now limit F2 fidelity to the cited 25 degC hFE curve at its one fixed VCE. Published VBE, output, and saturation curves are excluded from fitted fidelity. Saturation maxima remain separate hard-bound checks.
- False held-default wording that claimed no VBE curve existed was replaced with the honest basis: an hFE-only fit does not independently constrain IS, and published VBE curves are outside the fitted claim. Packages that derived IS from one cited VBE point retain that narrower derivation statement.
- `B0540WS` F2 curve scope is 0.01 through 0.8 A. Its separate 1 A maximum check does not expand fitted-curve fidelity.
- `DSK36` and `SS24` explicitly identify their high-current F2 spans as pulsed instantaneous forward-characteristic evidence, not continuous-current ratings or safe-operating-area claims.

## F1 maximum and defining-behavior semantics

- Added five inclusive RDS(on) maximum checks to `HL2302` and `HL2312`. All five passed without changing either model vector.
- Added Zener-voltage inclusive bounds and reverse-leakage maximum checks to 13 Zener or TVS packages. All 26 added checks passed at explicit `.temp 25` bias points without parameter changes. Supported scope is now limited to those exact reverse points plus the existing cited forward bound.
- Ten F1 BJT packages omitted published hFE maxima. All ten unchanged models exceeded the relevant inclusive maximum when tested. Each was rejected because compliance would require refitting, even where the excess was numerically small.

## Collision and duplicate-vector adjudication

- Canonical `AO3400` collision: retained `goodwork/AO3400`; rejected FOSAN and Guangdong Hottech counterparts. GOODWORK has the strongest dated revision evidence and explicit 25 degC pulsed curve conditions.
- Canonical `BC847B` collision: retained `hongjiacheng/BC847B`; rejected Guangdong Hottech. The retained Rev:1.0 family record has the target code map, eight-point fitted hFE curve, and earlier fixed campaign order.
- Primary identity collision: rejected HXY `SI2302-HXY` because its PDF identity is `SI2302`, already represented in the reviewed library.
- Reviewed-library vector duplicates without shared-die evidence: `BC857C`, `BC807-40`, and `MMBTA55`. All three also failed newly enforced published hFE maxima.
- Candidate vector duplicates without shared-die evidence: `2SA1213` versus `2SC2873`, and `BCP53-16` versus `BCX56-16`. Every member of both pairs also failed its published hFE maximum, so none was promoted.
- No promoted canonical identity, alias, or complete numeric fitted vector collides with the prior 212-package library or another promoted batch-2 package.

## Corrections applied only to promoted copies

- Added independent reviewer metadata and removed every pending-review marker from all 47 promoted packages.
- Added 26 Zener reverse-behavior benches and checks across 13 packages, with matching supported-scope and model-card corrections.
- Added five RDS(on) maximum hard-bound checks across `HL2302` and `HL2312`.
- Corrected F2 scope on six BJT packages and three diode packages. No residual, fit gate, or model parameter changed.
- Canonicalized JSMSEMI `SI2302-2.3A` and retained `SI2302-2.3A-JSM` as an alias.
- Demotions: **0**.

## Rejections by reason class

| MPN | Claimed tier | Family | Reason class | Decision evidence |
| --- | --- | --- | --- | --- |
| `AO3400` | F1 | nmos | candidate-canonical-identity-collision | Three candidates claimed AO3400. GOODWORK was retained because its primary PDF has the strongest dated revision evidence, explicit 25 degC pulsed curve conditions, and complete maximum-bound coverage. |
| `AO3400` | F1 | nmos | candidate-canonical-identity-collision | Three candidates claimed AO3400. GOODWORK was retained because its primary PDF has the strongest dated revision evidence, explicit 25 degC pulsed curve conditions, and complete maximum-bound coverage. |
| `BC847B` | F2 | bjt_npn | candidate-canonical-identity-collision | Two candidates claimed BC847B. The hongjiacheng package was retained because its Rev:1.0 family PDF, target code map, eight-point 25 degC hFE curve, and earlier fixed campaign order provide the stronger evidence record. |
| `SI2302-HXY` | F1 | nmos | primary-pdf-identity-and-reviewed-library-collision | The primary PDF identifies SI2302, not SI2302-HXY. Canonicalizing it would collide with the reviewed Vishay SI2302 package, so the invented suffix was not promoted. |
| `2SA1213` | F1 | bjt_pnp | published-gain-maximum-failure | The published hFE maximum is 240 at 0.5 A. Fresh native ngspice measured 241.723914, above the inclusive maximum. The vector also duplicates candidate 2SC2873 without shared-die evidence. |
| `2SC2873` | F1 | bjt_npn | published-gain-maximum-failure | The published hFE maximum is 240 at 0.5 A. Fresh native ngspice measured 241.723914, above the inclusive maximum. The vector also duplicates candidate 2SA1213 without shared-die evidence. |
| `2SC2884` | F1 | bjt_npn | published-gain-maximum-failure | The published hFE maximum is 320 at 0.1 A. Fresh native ngspice measured 320.361608, above the inclusive maximum. |
| `2SC4672` | F1 | bjt_npn | published-gain-maximum-failure | The published hFE maximum is 390 at 0.5 A. Fresh native ngspice measured 392.122060, above the inclusive maximum. |
| `BC807-40` | F1 | bjt_pnp | published-gain-maximum-failure | The published hFE maximum is 600 at 0.1 A. Fresh native ngspice measured 600.842551, above the inclusive maximum. Its complete vector also duplicates reviewed-library vectors without shared-die evidence. |
| `BC857C` | F1 | bjt_pnp | published-gain-maximum-failure | The published hFE maximum is 800 at 0.002 A. Fresh native ngspice measured 834.448339, above the inclusive maximum. Its complete vector also duplicates reviewed nexperia/BC847 without shared-die evidence. |
| `BCP53-16` | F1 | bjt_pnp | published-gain-maximum-failure | The published hFE maximum is 250 at 0.15 A. Fresh native ngspice measured 252.735553, above the inclusive maximum. The vector also duplicates candidate BCX56-16 without shared-die evidence. |
| `BCX56-16` | F1 | bjt_npn | published-gain-maximum-failure | The published hFE maximum is 250 at 0.15 A. Fresh native ngspice measured 252.566917, above the inclusive maximum. The vector also duplicates candidate BCP53-16 without shared-die evidence. |
| `MMBTA55` | F1 | bjt_pnp | published-gain-maximum-failure | The published hFE maximum is 400 at 0.01 A. Fresh native ngspice measured 400.946117, above the inclusive maximum. Its complete vector also duplicates reviewed nexperia/PBSS4160T without shared-die evidence. |
| `S9015` | F1 | bjt_pnp | published-gain-maximum-failure | The published hFE maximum is 1000 at 0.001 A. Fresh native ngspice measured 1042.987418, above the inclusive maximum. |

Grouped totals: 3 candidate canonical-identity collisions, 1 primary-PDF identity plus reviewed-library collision, and 10 published-gain-maximum failures.

## Package-by-package disposition

| Manufacturer directory | Staged MPN | Final canonical MPN | Tier | Family | Verdict | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `allpower-shenzhen-quan-li` | `AP2300` | `AP2300` | F1 | nmos | Promote F1 | No electrical correction |
| `allpower-shenzhen-quan-li` | `AP2302B` | `AP2302B` | F1 | nmos | Promote F1 | No electrical correction |
| `alpha-omega-semicon` | `AON7544` | `AON7544` | F1 | nmos | Promote F1 | No electrical correction |
| `elecsuper` | `BSS138K` | `BSS138K` | F1 | nmos | Promote F1 | No electrical correction |
| `fosan` | `AO3400` | `None` | F1 | nmos | Reject | candidate-canonical-identity-collision |
| `goodwork` | `AO3400` | `AO3400` | F1 | nmos | Promote F1 | No electrical correction |
| `goodwork` | `SI2302S` | `SI2302S` | F1 | nmos | Promote F1 | No electrical correction |
| `guangdong-hottech` | `AO3400` | `None` | F1 | nmos | Reject | candidate-canonical-identity-collision |
| `guangdong-hottech` | `BC847B` | `None` | F2 | bjt_npn | Reject | candidate-canonical-identity-collision |
| `hongjiacheng` | `2SA1213` | `None` | F1 | bjt_pnp | Reject | published-gain-maximum-failure |
| `hongjiacheng` | `2SC1623` | `2SC1623` | F2 | bjt_npn | Promote F2 | F2 BJT scope correction |
| `hongjiacheng` | `2SC2873` | `None` | F1 | bjt_npn | Reject | published-gain-maximum-failure |
| `hongjiacheng` | `2SC2884` | `None` | F1 | bjt_npn | Reject | published-gain-maximum-failure |
| `hongjiacheng` | `2SC4672` | `None` | F1 | bjt_npn | Reject | published-gain-maximum-failure |
| `hongjiacheng` | `B0540WS` | `B0540WS` | F2 | diode | Promote F2 | F2 diode scope correction |
| `hongjiacheng` | `B16WS` | `B16WS` | F1 | diode | Promote F1 | No electrical correction |
| `hongjiacheng` | `B5817W` | `B5817W` | F1 | diode | Promote F1 | No electrical correction |
| `hongjiacheng` | `BAS416` | `BAS416` | F1 | diode | Promote F1 | No electrical correction |
| `hongjiacheng` | `BAS70` | `BAS70` | F1 | diode | Promote F1 | No electrical correction |
| `hongjiacheng` | `BAT46WS` | `BAT46WS` | F1 | diode | Promote F1 | No electrical correction |
| `hongjiacheng` | `BAT54WS` | `BAT54WS` | F1 | diode | Promote F1 | No electrical correction |
| `hongjiacheng` | `BC807-40` | `None` | F1 | bjt_pnp | Reject | published-gain-maximum-failure |
| `hongjiacheng` | `BC847B` | `BC847B` | F2 | bjt_npn | Promote F2 | F2 BJT scope correction |
| `hongjiacheng` | `BC857C` | `None` | F1 | bjt_pnp | Reject | published-gain-maximum-failure |
| `hongjiacheng` | `BCP53-16` | `None` | F1 | bjt_pnp | Reject | published-gain-maximum-failure |
| `hongjiacheng` | `BCX56-10` | `BCX56-10` | F2 | bjt_npn | Promote F2 | F2 BJT scope correction |
| `hongjiacheng` | `BCX56-16` | `None` | F1 | bjt_npn | Reject | published-gain-maximum-failure |
| `hongjiacheng` | `BZT52B3V3` | `BZT52B3V3` | F1 | diode | Promote F1 | Zener reverse checks and scope |
| `hongjiacheng` | `BZT52C10S` | `BZT52C10S` | F1 | diode | Promote F1 | Zener reverse checks and scope |
| `hongjiacheng` | `BZT52C15` | `BZT52C15` | F1 | diode | Promote F1 | Zener reverse checks and scope |
| `hongjiacheng` | `BZT52C16` | `BZT52C16` | F1 | diode | Promote F1 | Zener reverse checks and scope |
| `hongjiacheng` | `BZT52C18` | `BZT52C18` | F1 | diode | Promote F1 | Zener reverse checks and scope |
| `hongjiacheng` | `BZT52C30` | `BZT52C30` | F1 | diode | Promote F1 | Zener reverse checks and scope |
| `hongjiacheng` | `BZT52C3V9S` | `BZT52C3V9S` | F1 | diode | Promote F1 | Zener reverse checks and scope |
| `hongjiacheng` | `BZT52C5V6S` | `BZT52C5V6S` | F1 | diode | Promote F1 | Zener reverse checks and scope |
| `hongjiacheng` | `BZT52C6V8` | `BZT52C6V8` | F1 | diode | Promote F1 | Zener reverse checks and scope |
| `hongjiacheng` | `BZT52C8V2S` | `BZT52C8V2S` | F1 | diode | Promote F1 | Zener reverse checks and scope |
| `hongjiacheng` | `BZT52C9V1S` | `BZT52C9V1S` | F1 | diode | Promote F1 | Zener reverse checks and scope |
| `hongjiacheng` | `BZX584C5V1` | `BZX584C5V1` | F1 | diode | Promote F1 | Zener reverse checks and scope |
| `hongjiacheng` | `DSK36` | `DSK36` | F2 | diode | Promote F2 | F2 diode scope correction |
| `hongjiacheng` | `ES1J` | `ES1J` | F1 | diode | Promote F1 | No electrical correction |
| `hongjiacheng` | `ES2J` | `ES2J` | F1 | diode | Promote F1 | No electrical correction |
| `hongjiacheng` | `HL2302` | `HL2302` | F1 | nmos | Promote F1 | RDS maximum checks |
| `hongjiacheng` | `HL2312` | `HL2312` | F1 | nmos | Promote F1 | RDS maximum checks |
| `hongjiacheng` | `MMBTA55` | `None` | F1 | bjt_pnp | Reject | published-gain-maximum-failure |
| `hongjiacheng` | `MMBTA56` | `MMBTA56` | F2 | bjt_pnp | Promote F2 | F2 BJT scope correction |
| `hongjiacheng` | `S9015` | `None` | F1 | bjt_pnp | Reject | published-gain-maximum-failure |
| `hongjiacheng` | `SD103AWS` | `SD103AWS` | F1 | diode | Promote F1 | No electrical correction |
| `hongjiacheng` | `SMBJ5338B` | `SMBJ5338B` | F1 | diode | Promote F1 | Zener reverse checks and scope |
| `hongjiacheng` | `SS24` | `SS24` | F2 | diode | Promote F2 | F2 diode scope correction |
| `hxy-mosfet` | `SI2302-HXY` | `None` | F1 | nmos | Reject | primary-pdf-identity-and-reviewed-library-collision |
| `jiangsu-changjing-electronics-co-ltd` | `CJE3134K` | `CJE3134K` | F1 | nmos | Promote F1 | No electrical correction |
| `jsmsemi` | `SI2302-2.3A-JSM` | `SI2302-2.3A` | F1 | nmos | Promote F1 | canonical identity and alias correction |
| `lrc` | `L2N7002LT1G` | `L2N7002LT1G` | F1 | nmos | Promote F1 | No electrical correction |
| `lrc` | `L2N7002SLLT1G` | `L2N7002SLLT1G` | F1 | nmos | Promote F1 | No electrical correction |
| `lrc` | `LMBT2222ALT1G` | `LMBT2222ALT1G` | F2 | bjt_npn | Promote F2 | F2 BJT scope correction |
| `mdd-microdiode` | `MMBT3904-E` | `MMBT3904-E` | F2 | bjt_npn | Promote F2 | F2 BJT scope correction |
| `msksemi` | `5N10-MS` | `5N10-MS` | F1 | nmos | Promote F1 | No electrical correction |
| `shenzhen-jingyang` | `2N7002KX` | `2N7002KX` | F1 | nmos | Promote F1 | No electrical correction |
| `umw-youtai-co-ltd` | `SI2302A` | `SI2302A` | F1 | nmos | Promote F1 | No electrical correction |
| `umw-youtai-co-ltd` | `SI2308A` | `SI2308A` | F1 | nmos | Promote F1 | No electrical correction |

## Final verification

- Promoted-package independent validation: 47 of 47 schema passes, 157 of 157 native ngspice-46 versus pinned-WASM bench passes, and 247 of 247 expectation passes.
- `npm test --workspace=@opencircuit/model-library`: passed, validating all 259 reviewed packages.
- `npm --prefix tools/model-factory test`: passed, 38 of 38 tests.
- `npm --prefix tools/conveyor test`: passed, 13 of 13 tests.
- `npm --prefix tools/conveyor run typecheck`: passed.
- `npm run typecheck`: passed for every workspace that defines a typecheck script.
- Tracking audit: passed for PDFs, databases, extraction JSON, staging package paths, vendor packs, and archives. No prohibited evidence artifact is tracked.
- Absolute-path audit over changed shipping files: passed with zero matches.
- Pending-review marker audit over promoted packages: passed with zero matches.
- Canonical and alias audit: passed for the 47 promotions. No promotion introduces a collision with the prior 212-package library or another batch-2 promotion. One pre-existing `vishay/1N4148` versus `vishay/LL4148` alias overlap remains outside this batch.
- Complete fitted-vector audit: passed for the 47 promotions. No promotion introduces a duplicate vector. Seven pre-existing vector groups remain in the prior reviewed library and are outside this batch.
- `git diff --check`: passed.

## Residual concerns

- F1 remains intentionally narrow and is not a broad device-accuracy claim. The newly added Zener reverse coverage is point-bounded, not a reverse-knee curve fit.
- F2 diode spans from pulsed plots do not imply continuous-current safety. This is now explicit for `DSK36` and `SS24`.
- No vendor SPICE model was available or used. AC, switching, noise, thermal, self-heating, and package-parasitic fidelity remain outside these promoted claims unless a package explicitly says otherwise.

Nothing was pushed, deployed, published, or posted, and no GitHub issue or comment was changed.
