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

`SiteAdapter` separates site-specific matching and resolution from the generic engine. `GenericAdapter` delegates to the structural locator engine. `GmailAdapter` resolves a rule into one or more page elements, allowing conversation subjects, selected message bodies, collapsed previews, and list/search surfaces to be masked without Gmail selectors entering the generic engine. Its versioned rendered-DOM selector profile, ID readers, route parser, thread/message/list resolvers, and fail-closed guard all live under `src/adapters/gmail/`.

Gmail rules store opaque rendered IDs (`threadId`, optional route ID, and optional `messageId`) plus booleans for each visual surface. They never store subject, snippet, preview, or body text. When a route identifies a protected thread but required DOM identities/surfaces cannot be resolved, `GmailPrivacyGuard` owns an extension Shadow DOM full-page guard with Retry and runtime-only temporary reveal. It is released only when the protected Gmail rule resolves; generic unresolved-rule release behavior is not used as a Gmail fallback.

## Locator model

Rules contain a primary strategy, fallbacks, a confidence threshold, and a structural fingerprint. The fingerprint contains tag/role/type, selected stable attributes, class tokens, parent tag structure, and a child-count range. It deliberately excludes `innerText`, `textContent`, email content, password values, and other page data.

The locator engine tries the primary strategy and safe fallbacks in order, scores every candidate against the fingerprint, and accepts only a unique highest-scoring candidate at or above the rule threshold. Stable attributes, class similarity, parent-tag subsequences, and child structure let it recover from an ID change, minor class change, or wrapper insertion. Tied candidates remain unresolved instead of masking an arbitrary element.

URL scopes are represented as exact URL, origin, or escaped wildcard path patterns. User-provided patterns are never evaluated as arbitrary regular expressions.

## Renderer abstraction

The Phase 1 renderer chain is ordered as:

1. DOM-attached/pseudo-layer renderer.
2. Safe CSS/filter renderer.
3. Event-driven portal renderer.

The contract is isolated in `src/content/renderer/`. The pseudo renderer covers suitable non-static, non-inline HTML elements, the filter renderer applies blur directly to the target element, and the portal renderer places opaque black, white, blur, or decorative mosaic shields in the extension-owned Shadow DOM. Portal positioning is driven by scroll/resize/`ResizeObserver` events with frame batching, not a permanent 60 FPS loop. The renderer is visual only; it does not remove or encrypt page content.

## Route and mutation observation

`RouteObserver` wraps `pushState` and `replaceState` while preserving the original calls, and listens to `popstate`/`hashchange`. A route change clears stale masks and re-resolves rules for the new URL scope.

`MutationEngine` batches relevant child-list and structural-attribute mutations with `requestAnimationFrame`. `MaskManager` refreshes healthy active handles, disposes handles whose target or renderer state disappeared, and resolves generic rules against mutation targets and added subtrees. Multi-target adapters re-resolve their bounded, adapter-owned targets from the current document so an expanded Gmail message is added without losing siblings. It never performs `document.querySelectorAll("*")` on each mutation. Development builds expose local-only counters at `window.__U_CANT_SEE_ME_DEV_METRICS__` for resolved/unresolved rules, mutation batches, resolver executions, and portal updates; nothing is transmitted externally.

## Privacy model and future Privacy Gate

For an origin with saved rules and granted host access, the service worker registers `content.js` persistently at `document_start`. Before storage reads begin, the content script installs the Privacy Gate. Maximum Privacy is the default opaque guard, Balanced is a dim guard, and Performance releases aggressive guarding. The gate follows `guarded → masked → released` when all applicable rules resolve. For an unresolved generic rule it remains through DOM readiness plus a short recovery window, then releases so one stale locator cannot permanently freeze an unrelated page. Chromium scheduling limits mean this is anti-flash risk reduction, not mathematical zero-frame secrecy.

Temporary reveal state stays in content-script runtime memory and never mutates `MaskRule` or survives navigation/session restart. Supported durations are 5, 10, 30, and 60 seconds. The controller remasks on expiry and honors navigation, window-blur, and tab-deactivation relock settings. `PrintProtectionController` applies temporary inline opacity during `beforeprint` and restores it after printing. `StrictMaskController` optionally blocks pointer and copy events whose source is inside an active masked target.

## Security model

The extension uses a restrictive MV3 extension-page CSP, no `eval`, no remote scripts, no backend, no analytics, and no Gmail API. Optional host permissions are requested per origin. Imported configuration must be schema-validated and treated as data. Generic Phase 1 access remains subject to browser-restricted pages, cross-origin iframe boundaries, and closed shadow roots. Masking is visual and reversible; it is not encryption, DRM, or enterprise DLP.
