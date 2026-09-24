# Changelog

## 0.2.0

- Added English/Traditional Chinese interface switching: a language segmented control in the popup and Options page persists the preference in synced settings and re-renders both surfaces immediately. Product terms (Gmail, Strict Mask, Blur, Mosaic, URL, locator) stay in English in both languages.
- New installs default to English; existing installs migrate in place to English without a schema version bump, and the language preference is included in configuration import/export.

## Unreleased

- Removed Mosaic masks. Existing and imported Mosaic rules migrate to Black, and configuration schema v2 drops Mosaic size fields.
- Added local generic masking, resilient locators, document-start privacy gate, temporary reveal/relock, print protection, and strict masking.
- Added Gmail thread/message/list masking with synthetic fixture coverage and fail-closed compatibility guard.
- Added rule management, import/export, edit mode, context menu actions, keyboard commands, hold-to-reveal, and badge status.
- Added Phase 6 hostile-page self-healing, stress regressions, Gmail structural diagnostics, and release documentation.
- Fixed Privacy Gate re-entry during mutation reconciliation, preventing stale locators from causing recurring full-page black flashes.
- Fixed Gmail split-pane protection to identify the active conversation by rendered thread ID rather than the reused inbox URL, and expanded protection to message metadata plus matching list senders.

No release version is assigned yet.
