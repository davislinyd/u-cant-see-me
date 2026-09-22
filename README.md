# U Cant See Me

U Cant See Me is a Manifest V3 Chromium extension for local visual privacy protection. It is designed for Chrome, Brave, and Microsoft Edge and does not send browsing data to a backend.

The repository implements the Phase 3 privacy-critical masking flow from `Plan.md`: typed storage and messaging contracts, generic selection, persistent rules with SPA recovery, document-start Privacy Gate protection, temporary reveal, relock controls, and print concealment.

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

For permitted origins with saved rules, the document-start content script installs a Privacy Gate before loading rules. Maximum Privacy is the default and uses an opaque page guard; Balanced uses a dim guard; Performance skips aggressive guarding. The guard releases after all applicable rules are masked. If a generic locator remains unresolved, it is released after DOM readiness plus a short recovery window so one stale rule cannot freeze an unrelated site. Chromium scheduling means this reduces anti-flash exposure but cannot promise mathematical zero-frame secrecy.

Temporary reveal is runtime-only and supports 5, 10, 30, or 60 seconds. It is re-masked on expiry and, by default, on navigation, window blur, or tab deactivation. Print events conceal active protected elements without modifying stored rules or page text. Strict Mask is optional and blocks pointer interaction and copy events originating in active masked targets.

## Scope and roadmap

- Phase 0: architecture and build foundation — implemented.
- Phase 1: generic element selection and persistent masks — implemented.
- Phase 2: resilient locator recovery and SPA support — implemented.
- Phase 3: privacy gate, anti-flash protection, and temporary reveal — implemented.
- Phase 4: Gmail adapter and per-message privacy protection — next.
- Phase 5+: management UX and release hardening — tracked in `Plan.md`.
