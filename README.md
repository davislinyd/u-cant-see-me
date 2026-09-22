# U Cant See Me

U Cant See Me is a Manifest V3 Chromium extension for local visual privacy protection. It is designed for Chrome, Brave, and Microsoft Edge and does not send browsing data to a backend.

This repository currently implements the Phase 0 foundation from `Plan.md`: typed storage and messaging contracts, adapter/locator/renderer boundaries, a minimal MV3 UI, and test fixtures. Generic selection and visual mask behavior are intentionally the next phase.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Load the generated `dist/` directory as an unpacked extension from `chrome://extensions`, `brave://extensions`, or `edge://extensions` with Developer mode enabled.

## Privacy boundary

The foundation stores only schema-versioned rules, URLs/scopes, and structural locator metadata. It does not persist `innerText`, `textContent`, input values, passwords, email bodies, or subjects. There is no backend, analytics, Gmail API integration, remote code, or third-party tracking.

The optional host permissions are deliberately not granted by default. Automatic document-start protection will request the smallest origin permission needed when that behavior is implemented.

## Scope and roadmap

- Phase 0: architecture and build foundation — implemented.
- Phase 1: generic element selection and persistent masks — next.
- Phase 2+: resilient recovery, privacy gate, Gmail adapter, management UX, and release hardening — tracked in `Plan.md`.
