# Architecture

## Runtime boundaries

The extension has four runtime surfaces:

1. The MV3 service worker owns extension lifecycle, context-menu registration, storage coordination, typed message forwarding, and per-origin persistent content-script registration after host access is granted.
2. The content script owns page-local observation. It is loaded only after host access is available and contains the route observer, mutation engine, adapter selection, locator resolution, and mask manager.
3. The popup is a small action surface for the active tab. It does not read page content directly; it requests typed status messages from the content script or service worker.
4. The options page reads the local rule store and renders metadata only. DOM text is never used as a stored locator fingerprint.

## Storage

`chrome.storage.local` is reserved for page-specific mask rules. `chrome.storage.sync` is reserved for non-sensitive preferences. Temporary runtime state will use `chrome.storage.session` or in-memory state when temporary reveal is implemented. Every envelope carries `schemaVersion`, and `src/storage/migrations.ts` normalizes old or malformed data without executing imported values.

## Message contracts

`src/shared/messages.ts` is the single definition point for extension messages. Runtime validation rejects unknown message types and malformed identifiers before a message reaches a handler. New flows should extend this union rather than passing ad-hoc strings between surfaces.

## Site adapters

`SiteAdapter` separates site-specific matching and resolution from the generic engine. `GenericAdapter` currently delegates to the structural locator engine. `GmailAdapter` is an explicit stub so Gmail selectors and privacy behavior can be added under `src/adapters/gmail/` without scattering special cases through generic code.

## Locator model

Rules contain a primary strategy, fallbacks, a confidence threshold, and a structural fingerprint. The fingerprint contains tag/role/type, selected stable attributes, class tokens, parent tag structure, and a child-count range. It deliberately excludes `innerText`, `textContent`, email content, password values, and other page data.

URL scopes are represented as exact URL, origin, or escaped wildcard path patterns. User-provided patterns are never evaluated as arbitrary regular expressions.

## Renderer abstraction

The Phase 1 renderer chain is ordered as:

1. DOM-attached/pseudo-layer renderer.
2. Safe CSS/filter renderer.
3. Event-driven portal renderer.

The contract is isolated in `src/content/renderer/`. The pseudo renderer covers suitable non-static, non-inline HTML elements, the filter renderer applies blur directly to the target element, and the portal renderer places opaque black, white, blur, or decorative mosaic shields in the extension-owned Shadow DOM. Portal positioning is driven by scroll/resize/`ResizeObserver` events with frame batching, not a permanent 60 FPS loop. The renderer is visual only; it does not remove or encrypt page content.

## Route and mutation observation

`RouteObserver` wraps `pushState` and `replaceState` while preserving the original calls, and listens to `popstate`/`hashchange`. `MutationEngine` batches relevant mutations with `requestAnimationFrame` and passes only the batch to the manager. Future recovery work must inspect added subtrees and unresolved rule candidates instead of rescanning `document.querySelectorAll("*")` for every mutation.

## Privacy model and future Privacy Gate

Phase 1 dynamically registers `content.js` at `document_start` for origins with persistent rules after the user grants the origin permission, but it does not claim anti-flash protection. Phase 3 will add a Privacy Gate before resolving protected targets. Maximum Privacy mode should keep the page or protected region guarded until recovery is complete; Balanced and Performance modes can reduce guarding after their trade-offs are explicit in the UI. Chromium timing limits must be documented rather than described as mathematical secrecy.

## Security model

The extension uses a restrictive MV3 extension-page CSP, no `eval`, no remote scripts, no backend, no analytics, and no Gmail API. Optional host permissions are requested per origin. Imported configuration must be schema-validated and treated as data. Generic Phase 1 access remains subject to browser-restricted pages, cross-origin iframe boundaries, and closed shadow roots. Masking is visual and reversible; it is not encryption, DRM, or enterprise DLP.
