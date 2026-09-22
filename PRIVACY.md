# Privacy policy

U Cant See Me provides local visual privacy protection for browser-rendered content.

## What stays local

- Mask rules, page URL/origin scope, structural DOM locator metadata, and Gmail rendered/route IDs are stored in browser extension storage.
- Preferences are stored in browser sync storage when the browser enables sync.
- Temporary reveal state is runtime-only and is not exported or synchronized.

The extension does not transmit browsing history, URLs, page text, email subjects, snippets, message bodies, passwords, form values, or Gmail content to a backend. It has no backend, analytics, advertising, tracking, Gmail API access, OAuth flow, remote code, or Gmail.js dependency.

## Permissions

`storage` stores local rules and settings. `activeTab` and `scripting` enable selection on the current page. `contextMenus` provides local page actions. Host access is optional and requested per origin only when needed to restore saved masks at document start. The extension does not request permanent `<all_urls>` access.

## Important limitation

Masking is visual and reversible. It does not encrypt, delete, or remove the underlying DOM content, and it is not DRM or enterprise DLP. Browser scheduling means document-start protection reduces exposure risk but cannot prove a mathematically zero-frame guarantee.
