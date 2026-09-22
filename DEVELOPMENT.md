# Development guide

## Canonical checks

Run these checks from the repository root:

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e
```

`npm run build` writes the unpacked extension to `dist/`. The build emits `manifest.json`, `service-worker.js`, `content.js`, `popup.html`, and `options.html` with their bundled assets.

## Manual loading

1. Run `npm run build`.
2. Open the target Chromium browser's extensions page.
3. Enable Developer mode.
4. Choose **Load unpacked** and select this repository's `dist/` directory.
5. Open the extension popup and options page.

The Phase 0 popup intentionally reports that element selection is a Phase 1 feature. A successful load check confirms the manifest, service worker, extension UI pages, and content-script bundle can coexist; it does not claim that visual masking is complete.

## Test data policy

Fixtures are synthetic. Do not add real emails, passwords, page bodies, screenshots containing private data, or exported user rules to the repository. Tests should assert structural behavior and sanitized status, not persist or print page content.

## Phase 1 handoff

The next implementation milestone is a dedicated selection controller, with hover highlighting and keyboard controls, followed by a real renderer handle that can apply and remove opaque visual masks without changing the underlying page text.
