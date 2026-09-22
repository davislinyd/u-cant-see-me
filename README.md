# U Cant See Me

U Cant See Me is a Manifest V3 Chromium extension for local visual privacy protection. It is designed for Chrome, Brave, and Microsoft Edge and does not send browsing data to a backend.

The repository implements the Phase 6 privacy-critical masking flow from `Plan.md`: typed storage and messaging contracts, generic selection, persistent rules with SPA recovery, document-start Privacy Gate protection, temporary reveal, relock controls, print concealment, Gmail-specific per-message masking, rule management, and production-hardening regressions.

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

The extension stores only schema-versioned rules, URLs/scopes, structural locator metadata, and Gmail rendered-DOM/route IDs. It does not persist `innerText`, `textContent`, input values, passwords, email bodies, snippets, or subjects. There is no backend, analytics, Gmail API integration, OAuth, remote code, or third-party tracking.

The production manifest does not grant host permissions by default. Selecting on the current page uses `activeTab`; the popup then requests the smallest origin permission needed for automatic restore. When that permission is granted, saving a rule registers the content script persistently at `document_start` for that origin. If access is denied, the rule remains local but automatic restore on a later page load is unavailable.

Masking is visual and reversible. The underlying DOM, text, input values, and page accessibility tree are not encrypted or removed. The generic Phase 1 adapter also cannot cross browser-restricted pages, cross-origin iframes, or closed shadow roots.

The renderer chain prefers a DOM pseudo-layer for suitable non-static block elements, applies CSS `filter: blur(...)` for blur masks, and falls back to an event-driven Shadow DOM portal overlay for other connected elements. Portal geometry is refreshed from scroll, resize, and `ResizeObserver` events with `requestAnimationFrame` batching; it does not run a permanent 60 FPS polling loop.

For permitted origins with saved rules, the document-start content script installs a Privacy Gate before loading rules. Maximum Privacy is the default and uses an opaque page guard; Balanced uses a dim guard; Performance skips aggressive guarding. The gate is an initialization-only transition: it releases after all applicable rules are masked, or after DOM readiness plus a short recovery window when a generic locator remains unresolved. It is not reopened by later mutation reconciliation, so one stale locator cannot cause recurring full-page black flashes. Chromium scheduling means this reduces anti-flash exposure but cannot promise mathematical zero-frame secrecy.

Temporary reveal is runtime-only and supports 5, 10, 30, or 60 seconds. It is re-masked on expiry and, by default, on navigation, window blur, or tab deactivation. Print events conceal active protected elements without modifying stored rules or page text. Strict Mask is optional and blocks pointer interaction and copy events originating in active masked targets.

On Gmail, the popup offers a local **Protect this email** action. It derives only the rendered thread ID and can mask the conversation subject, message bodies, collapsed previews, and matching inbox/search subjects and snippets. A rule can additionally include a message ID, so sibling message bodies remain visible. Gmail selectors, route parsing, resolvers, and the Gmail-only fail-closed guard are isolated under `src/adapters/gmail/`. If a protected Gmail route cannot be structurally verified, the guard remains visible with Retry and a runtime-only temporary-reveal option; it never silently falls back to plaintext.

The Options page supports safe rule filtering, enable/disable, style and scope editing, duplication, deletion, current-page locator testing, and JSON import/export. Exports include only settings and rule metadata; imports are schema-validated as data and never execute selectors or configuration. The popup can temporarily reveal, open edit mode, disable rules for the current page/site, or remove page rules. Chromium commands use Alt+Shift+S (selection), Alt+Shift+V (temporary reveal), and Alt+Shift+L (remask); holding Alt+Shift+H reveals only while held. Command shortcuts can be changed in Chromium's extension shortcut UI.

Phase 6 adds synthetic hostile-page and 100-mask mutation-storm regression coverage. If a page removes an extension style or portal root, the renderer is recreated through bounded recovery. The Options diagnostic view exposes Gmail DOM profile, rendered IDs, surface availability, and guard state only—never visible content. See [PRIVACY.md](PRIVACY.md), [SECURITY.md](SECURITY.md), [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md), and [the architecture diagram](docs/ARCHITECTURE-DIAGRAM.md).

## Scope and roadmap

- Phase 0: architecture and build foundation — implemented.
- Phase 1: generic element selection and persistent masks — implemented.
- Phase 2: resilient locator recovery and SPA support — implemented.
- Phase 3: privacy gate, anti-flash protection, and temporary reveal — implemented.
- Phase 4: Gmail adapter and per-message privacy protection — implemented.
- Phase 5: management UX, keyboard shortcuts, context menu, and advanced controls — implemented.
- Phase 6: production hardening and release-readiness documentation — implemented for the automated Chromium matrix and live Brave validation; Edge still requires release-environment confirmation.
