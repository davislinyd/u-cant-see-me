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

The E2E fixture is synthetic and includes nested content, an input, flex and grid layouts, and a scroll container. E2E creates a temporary copy of `dist/` and adds host access only to that copy, so production `manifest.json` keeps host access optional.

## Phase 2 handoff

The next implementation milestone is resilient locator recovery for recreated and reordered DOM nodes, including SPA route transitions and efficient mutation-driven re-resolution. The current generic adapter intentionally does not recover across cross-origin frames or closed shadow roots, and Phase 1 does not provide anti-flash Privacy Gate behavior.
