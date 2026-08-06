# P2 screenshot and browser notes

Captured at 1440 x 900 on Chromium:

- `default-bench.png`
- `editor-mid-wire.png`
- `shortcut-help.png`

Browser gate status on 2026-08-06:

- Chromium: all 3 Playwright tests passed.
- Firefox: configured, but the Playwright browser installation was incomplete on this machine. Launch aborted because `libmozglue.dylib` was missing from the downloaded Nightly bundle. This is a local browser installation failure, not a WASM skip.
- WebKit: configured, but its Playwright executable was not installed. The combined Firefox and WebKit download stalled after 10 minutes and was stopped. This is a local browser installation failure, not a WASM skip.

No browser is conditionally skipped in the Playwright configuration.
