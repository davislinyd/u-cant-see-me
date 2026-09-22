# Security notes

## Boundaries

- Manifest V3 with an extension-page CSP that permits only packaged scripts.
- No `eval`, remote scripts, dynamic code execution, or network client.
- Imported configuration is parsed as JSON data, schema-validated, and never evaluated as CSS/JavaScript code.
- Gmail selectors are isolated under `src/adapters/gmail/`; Gmail rules carry IDs and booleans, never visible content.

## Defensive behavior

- Locator ties and low-confidence results remain unresolved rather than masking an arbitrary element.
- Known Gmail protected routes fail closed with an extension-owned guard if expected structure is not verified.
- Mutation reconciliation repairs replaced targets. If a hostile page removes an extension style or overlay root, unhealthy masks trigger a bounded document re-resolution and renderer recreation.
- Portal overlays are pointer-transparent and use the extension-owned Shadow DOM. A page can still interfere with any browser extension; this is local visual protection, not an adversarial isolation boundary.

## Supported and unsupported surfaces

Same-document rendered DOM is supported. Cross-origin frames, sandboxed frames, closed Shadow DOM, and browser-restricted pages are unsupported. Same-origin frames are not automatically selected or restored in this release because dynamic scripts intentionally do not use broad all-frame injection.

## Reporting

Do not include page content, emails, screenshots containing sensitive material, or exported rule files in an issue. Reproduce with a synthetic fixture and attach only sanitized diagnostic IDs where necessary.
