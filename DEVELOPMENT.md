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

The Phase 1 popup starts selection on the active tab. The selection controller supports hover feedback, click selection, Shift+Click multi-selection, Alt+Click removal, Enter confirmation, and Escape cancellation. Rules are saved one per element and are re-applied after a page reload when the origin permission is available.

## Test data policy

Fixtures are synthetic. Do not add real emails, passwords, page bodies, screenshots containing private data, or exported user rules to the repository. Tests should assert structural behavior and sanitized status, not persist or print page content.

The E2E fixtures are synthetic. `basic.html` covers generic selection; `spa.html` covers target and parent replacement, delayed rendering, virtualized-list reorder, resize, and History API route transitions; `gate.html` verifies the document-start `guarded → masked` sequence, temporary reveal/relock, and print concealment. E2E creates a temporary copy of `dist/` and adds host access only to that copy, so production `manifest.json` keeps host access optional.

## Phase 4 handoff

The next implementation milestone is GmailAdapter and per-message privacy protection. The generic adapter intentionally does not recover across cross-origin frames or closed shadow roots. Privacy Gate timing is best-effort within Chromium document-start limits and must not be described as a proof of zero-frame secrecy.
