# P2 screenshot and browser notes

Captured at 1440 x 900 on Chromium after `ENGINE READY` was visible and an `oklch(...)` wire style had painted:

- `default-bench.png`
- `editor-mid-wire.png`
- `shortcut-help.png`
- `bode-waveform-viewer.png`
- `import-models.png`

## Browser matrix

Run on 2026-08-06 with no browser project conditionally skipped in `playwright.config.ts`:

| Browser | Result | Evidence |
| --- | --- | --- |
| Chromium | PASS | 5 of 5 Playwright tests passed in 25.6 s. |
| Firefox | LOCAL BROWSER FAILURE | All 5 launch attempts aborted before test code ran. Playwright Firefox Nightly could not load `@rpath/libmozglue.dylib`; the file was missing from `/Users/hughp/Library/Caches/ms-playwright/firefox-1490/firefox/Nightly.app/Contents/MacOS/`. |
| WebKit | LOCAL BROWSER FAILURE | All 5 launch attempts aborted before test code ran. `/Users/hughp/Library/Caches/ms-playwright/webkit-2203/pw_run.sh` was not installed. |

A repair install for Firefox and WebKit could not start because another Playwright installation held `/Users/hughp/Library/Caches/ms-playwright/__dirlock`. These are local browser installation failures, not WASM skips or application test failures.

## Measurements

Measured from the production Vite preview in headless Chromium:

- ngspice engine initialization: 2,151.6 ms
- Initial operating-point solve after initialization: 10.5 ms
- Warm operating-point solve: 1.0 ms
- Measured rawfile payload: 501 bytes
- Raw WASM asset: 6,244,155 bytes
- Brotli WASM response: 1,580,992 bytes with `Content-Encoding: br`
- Vite gzip report: 2,054.49 kB
- Long tasks observed during measured boot: 1

`window.__ocMetrics.wasmTransferSize` reports `0` because ngspice is fetched inside the simulation worker and the main window performance timeline cannot observe that worker resource entry. The transfer figure above was therefore measured from the actual preview response body and headers with Brotli accepted.

## Workspace verification

- Root `npm test`: PASS
- Root `npm run build`: PASS
- Production build emits `ngspice-BKHZAIfU.wasm` as a separate asset.
- Vite still warns that Emscripten's `node:module` import is externalized for browser compatibility. Chromium execution is green despite the warning.

## Final polish verification, 2026-08-07

The default bench was recaptured at 1440 x 900 after the parts-rail fix. A separate full-rail inspection rendered all 17 IEC tool symbols in their 30 x 22 px boxes. Each mark computed to a 1.4 px non-scaling stroke and was visually recognizable at 1x.

| Browser | Result | Evidence |
| --- | --- | --- |
| Chromium | PASS | 8 of 8 Playwright tests passed in 45.5 s. |
| Firefox | PASS | 2 tests passed and 6 were skipped by design. |
| WebKit | PASS | 2 tests passed and 6 were skipped by design. |

The Firefox and WebKit skips are the four Chromium-only editor visual/screenshot tests plus the two P6 acceptance/screenshot tests. The cross-browser MVP workflow and reduced-motion static-encoding test passed in both browsers. Combined cross-browser command result: 4 passed, 12 skipped in 2.3 min.

Final workspace checks:

- Root `npm test`: PASS, 3 of 3 tests.
- Root `npm run build`: PASS.
- Scope scale labels render as unsigned magnitudes: `1.25 V/div` and `1.00 ms/div` on the default bench.
