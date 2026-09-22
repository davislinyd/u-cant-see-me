# U Cant See Me

U Cant See Me is a Manifest V3 Chromium extension for local visual privacy protection. It is designed for Chrome, Brave, and Microsoft Edge and does not send browsing data to a backend.

The repository implements the Phase 1 generic masking flow from `Plan.md`: typed storage and messaging contracts, generic element selection, four visual mask styles, structural locators, persistent rules, and a reload-tested MV3 UI. Phase 2 will improve locator recovery and SPA resilience.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Load the generated `dist/` directory as an unpacked extension from `chrome://extensions`, `brave://extensions`, or `edge://extensions` with Developer mode enabled. The build emits a classic `content.js` IIFE for Chromium content-script injection in addition to the service worker and extension pages.

## Privacy boundary

The foundation stores only schema-versioned rules, URLs/scopes, and structural locator metadata. It does not persist `innerText`, `textContent`, input values, passwords, email bodies, or subjects. There is no backend, analytics, Gmail API integration, remote code, or third-party tracking.

The production manifest does not grant host permissions by default. Selecting on the current page uses `activeTab`; the popup then requests the smallest origin permission needed for automatic restore. When that permission is granted, saving a rule registers the content script persistently at `document_start` for that origin. If access is denied, the rule remains local but automatic restore on a later page load is unavailable.

Masking is visual and reversible. The underlying DOM, text, input values, and page accessibility tree are not encrypted or removed. The generic Phase 1 adapter also cannot cross browser-restricted pages, cross-origin iframes, or closed shadow roots.

The renderer chain prefers a DOM pseudo-layer for suitable non-static block elements, applies CSS `filter: blur(...)` for blur masks, and falls back to an event-driven Shadow DOM portal overlay for other connected elements. Portal geometry is refreshed from scroll, resize, and `ResizeObserver` events with `requestAnimationFrame` batching; it does not run a permanent 60 FPS polling loop.

## Scope and roadmap

- Phase 0: architecture and build foundation — implemented.
- Phase 1: generic element selection and persistent masks — implemented.
- Phase 2: resilient locator recovery and SPA support — next.
- Phase 3+: privacy gate, Gmail adapter, management UX, and release hardening — tracked in `Plan.md`.
