# scheMAGIC Designer examples

This package is the deterministic, content-addressed gallery contract for the four
frozen Designer reference fixtures:

- `m1-compact`: synthetic integrated brushed-DC bridge
- `m2-power`: synthetic external-NMOS brushed-DC bridge
- `p1-compact`: synthetic integrated synchronous buck
- `p2-high-voltage`: synthetic external-NMOS synchronous buck

`artifacts/manifest.json` binds every checked-in document by exact UTF-8 byte
length and SHA-256 hash. Each document also binds the request, result, library,
recipe, fixture export, and generator export identities used to create it. The
documents are pretty-printed canonical JSON so they remain directly inspectable.

These are synthetic test/UI examples only. They contain zero production profiles,
no admitted-profile claim, no provider access, no commercial data, and no
simulation-fidelity claim. Their behavioral circuits and analytic values must not
be presented as selected-part evidence, orderability, regulation, stability, or
native/browser simulator parity.

Browser consumers can import `DESIGNER_EXAMPLE_GALLERY_MANIFEST`,
`DESIGNER_EXAMPLE_GALLERY`, or `getDesignerExample` from
`@opencircuit/designer-examples`. Narrow JSON subpath exports are available for
code-split consumers. Regenerate only from the installed fixture generators:

```sh
npm run regenerate --workspace @opencircuit/designer-examples
npm test --workspace @opencircuit/designer-examples
```
