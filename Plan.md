# U Cant See Me — Complete ChatGPT Code Development Prompts

A privacy-focused Chromium browser extension for Chrome, Brave, and Microsoft Edge.

The extension allows users to permanently or temporarily mask sensitive DOM elements on webpages using black, white, blur, or opaque mosaic masks.

The extension must prioritize privacy, resilience, low latency, and persistence.

---

# PHASE 0 — Project Foundation and Architecture

You are building a production-quality Chromium browser extension named:

**U Cant See Me**

Target browsers:

- Google Chrome
- Brave
- Microsoft Edge

Use:

- Manifest V3
- TypeScript
- Vite
- native `chrome.*` extension APIs
- `@types/chrome`
- Vitest for unit testing
- Playwright for E2E testing

Do not use React unless there is a clear reason. Prefer simple HTML/CSS/TypeScript for the popup and options UI initially.

The product is a persistent visual privacy masking extension.

Users will eventually be able to select DOM elements and permanently mask them. Masks must survive reloads, SPA navigation, tab closing, browser restarts, and DOM recreation.

Future phases will add:

- sophisticated locator recovery
- anti-flash Privacy Gate
- temporary reveal
- Gmail-specific masking
- keyboard shortcuts
- rule management
- production hardening

Your task in this phase is ONLY to establish the project foundation and architecture.

## Requirements

Create the project structure:

```text
u-cant-see-me/
├── manifest.json
├── package.json
├── tsconfig.json
├── vite.config.ts
│
├── src/
│   ├── background/
│   │   ├── service-worker.ts
│   │   ├── permissions.ts
│   │   ├── script-registration.ts
│   │   └── messaging.ts
│   │
│   ├── content/
│   │   ├── bootstrap.ts
│   │   ├── route-observer.ts
│   │   ├── mutation-engine.ts
│   │   ├── mask-manager.ts
│   │   │
│   │   ├── locator/
│   │   │   ├── locator-engine.ts
│   │   │   ├── selector-generator.ts
│   │   │   ├── fingerprint.ts
│   │   │   └── confidence.ts
│   │   │
│   │   └── renderer/
│   │       ├── renderer.ts
│   │       ├── pseudo-renderer.ts
│   │       ├── filter-renderer.ts
│   │       └── portal-renderer.ts
│   │
│   ├── adapters/
│   │   ├── site-adapter.ts
│   │   ├── generic/
│   │   │   └── generic-adapter.ts
│   │   └── gmail/
│   │       └── gmail-adapter.ts
│   │
│   ├── storage/
│   │   ├── rule-store.ts
│   │   ├── settings-store.ts
│   │   └── migrations.ts
│   │
│   ├── shared/
│   │   ├── types.ts
│   │   ├── constants.ts
│   │   ├── messages.ts
│   │   └── utils.ts
│   │
│   └── ui/
│       ├── popup/
│       │   ├── popup.html
│       │   ├── popup.ts
│       │   └── popup.css
│       └── options/
│           ├── options.html
│           ├── options.ts
│           └── options.css
│
├── tests/
│   ├── unit/
│   ├── e2e/
│   └── fixtures/
│
├── README.md
├── ARCHITECTURE.md
└── DEVELOPMENT.md
```

## Core type definitions

Create strongly typed interfaces for at least:

```ts
MaskType
MaskStyle
MaskRule
LocatorStrategy
ElementFingerprint
SiteScope
SiteAdapter
ActiveMask
TemporaryRevealState
ExtensionSettings
StoredSchema
```

Every stored object must support schema migration.

Include:

```ts
schemaVersion: number
```

at the storage root.

Do not store DOM `innerText`, email bodies, subject text, passwords, or other sensitive content as part of locator fingerprints.

## Manifest

Use Manifest V3.

Start with minimal permissions:

```json
[
  "storage",
  "scripting",
  "activeTab",
  "contextMenus"
]
```

Use:

```json
"optional_host_permissions": [
  "http://*/*",
  "https://*/*"
]
```

Do not request `<all_urls>` as a permanent permission.

## Messaging

Define typed extension message contracts.

Examples:

```text
START_SELECTION
STOP_SELECTION
SAVE_RULE
REMOVE_RULE
GET_RULES
REVEAL_RULE
REMASK_RULE
RULES_CHANGED
GET_PAGE_STATUS
```

Do not use loosely typed string messages scattered throughout the codebase.

## Storage

Implement storage abstraction around:

```text
chrome.storage.local
chrome.storage.sync
chrome.storage.session
```

Initial policy:

```text
Mask rules
→ storage.local

Non-sensitive user preferences
→ storage.sync

Temporary runtime state
→ storage.session when useful
```

Do not sync page-specific rules by default.

## SiteAdapter

Create:

```ts
interface SiteAdapter
```

with architecture supporting:

```text
GenericAdapter
GmailAdapter
future adapters
```

The Gmail adapter is only a stub in this phase.

## Documentation

Create `ARCHITECTURE.md` explaining:

- background/service worker responsibilities
- content script responsibilities
- renderer abstraction
- locator abstraction
- storage architecture
- SiteAdapter concept
- future anti-flash strategy
- future Gmail strategy
- extension security/privacy model

## Constraints

Do NOT implement all product functionality yet.

Do NOT put everything in one file.

Do NOT add a backend.

Do NOT transmit browsing data externally.

Do NOT introduce analytics.

At the end:

1. verify TypeScript compiles
2. verify Vite builds
3. verify extension can be loaded unpacked in Chromium
4. run existing tests
5. summarize created architecture
6. list known TODOs for Phase 1

---

# PHASE 1 — Generic Element Selection and Persistent Masks

Continue working on the existing **U Cant See Me** project.

First inspect the current repository and existing architecture.

Do NOT recreate the project.

Do NOT replace working abstractions unless necessary.

The goal of this phase is to implement the first usable version of generic webpage masking.

## Required behavior

A user must be able to:

1. open the extension popup
2. click "Select elements"
3. hover DOM elements
4. visually highlight the currently hovered element
5. click an element to select it
6. Shift+Click additional elements
7. press Escape to cancel
8. press Enter to confirm
9. choose a mask style
10. save the masks
11. reload the webpage
12. see the masks automatically restored

## Selection Mode

Implement a dedicated selection controller.

Selection mode must:

- capture pointer movement
- identify the intended DOM element
- ignore extension-owned selection UI
- highlight hovered element
- show selected targets distinctly
- support multi-selection
- cleanly remove temporary UI when selection ends

Keyboard behavior:

```text
Click
→ select target

Shift + Click
→ add target

Alt + Click
→ remove selected target

Enter
→ confirm

Escape
→ cancel
```

Avoid blocking normal page interaction when selection mode is not active.

## Mask types

Implement:

```text
black
white
blur
mosaic
```

### Black

Fully opaque black shield.

### White

Fully opaque white shield.

### Blur

Use a sufficiently strong blur.

Default:

```text
14px
```

Users must be able to configure blur strength later.

### Mosaic

Do NOT pixelate or sample underlying content.

Implement an opaque decorative mosaic/block pattern.

The pattern must reveal zero information from the underlying content.

## Mask Renderer architecture

Use the existing renderer abstraction.

Implement renderer priority:

```text
1. DOM-attached / pseudo-layer renderer
2. safe CSS/filter renderer
3. portal overlay renderer
```

Do NOT use continuous `getBoundingClientRect()` polling as the default implementation.

The preferred renderer should move naturally with the DOM element during:

- scrolling
- reflow
- resize
- layout changes

## Portal renderer

For elements that cannot safely use the normal renderer, implement an overlay fallback.

Use event-driven updates:

- scroll
- resize
- ResizeObserver
- requestAnimationFrame batching when needed

Avoid permanent 60 FPS polling.

## Persistence

Save every target as a persistent MaskRule.

After reload:

```text
load rules
→ determine applicable rules
→ resolve elements
→ reapply masks
```

Masks must survive:

- reload
- tab close/reopen
- browser restart

## Initial Locator Engine

Implement locator generation.

Preference order should roughly favor:

```text
stable unique IDs
stable data-* attributes
data-testid
aria attributes
role
name
type
stable parent relationships
stable class combinations
nth-of-type
absolute structural path
```

Do not assume CSS classes are stable.

Do not store sensitive text.

## Fingerprinting

Store safe structural metadata such as:

```text
tag name
role
element type
stable attributes
selected class tokens
parent tag structure
child count range
```

Do not store:

```text
innerText
textContent
email contents
input values
password values
```

## Multi-element masks

Store each selected element as its own MaskRule.

UI may group rules by creation session, but persistence should not require one giant combined selector.

## Popup

Implement useful initial popup UI:

```text
U Cant See Me

Protection: ON

[ Select elements ]

Masks on this page: N

[ Temporarily reveal ]

[ Manage masks ]
```

## E2E fixture

Create a local test fixture containing:

- normal paragraph
- nested div
- image
- input
- flex layout
- grid layout
- scrollable container
- dynamically resizing element

Write Playwright tests covering selection, save, reload, and persistent reapplication.

## Acceptance criteria

Phase is complete only if:

- selecting a target works
- selecting multiple targets works
- all four mask styles work
- masks follow scroll/reflow
- saved masks reappear after reload
- saved masks reappear after browser restart simulation where feasible
- the page's real text/content is not modified
- TypeScript passes
- tests pass

At the end, summarize implementation changes and identify issues to address in Phase 2.

---

# PHASE 2 — Resilient Locator Engine, SPA Support, and Self-Healing

Continue the existing **U Cant See Me** project.

Do not rewrite the working masking implementation.

This phase focuses on making saved masks resilient against modern dynamic websites.

The extension must reliably recover masks when DOM elements are recreated, reordered, or rendered by SPA frameworks.

## Locator architecture

Improve the locator model so each rule supports:

```ts
primary
fallbacks[]
fingerprint
confidenceThreshold
```

Example conceptual structure:

```ts
interface ElementLocator {
  primary: LocatorStrategy;
  fallbacks: LocatorStrategy[];
  fingerprint: ElementFingerprint;
  confidenceThreshold: number;
}
```

## Confidence scoring

Implement confidence scoring.

Example signals:

```text
exact stable ID match
stable data attribute match
tag match
role match
name match
parent structure match
class token similarity
child structure similarity
```

Do not use sensitive text comparison.

Example concept:

```text
95+ = strong match
80-94 = acceptable match
60-79 = fallback / uncertain
below threshold = unresolved
```

The exact scoring implementation is your responsibility.

Write unit tests covering false positives.

## MutationObserver

Implement an efficient Mutation Engine.

Requirements:

- observe relevant DOM mutation events
- inspect newly added subtrees
- re-resolve unresolved rules
- detect removed protected targets
- restore masks when equivalent targets appear again

Never perform:

```ts
document.querySelectorAll("*")
```

on every mutation.

Batch mutation processing using microtasks or `requestAnimationFrame` where appropriate.

## Self-healing

If a protected DOM node is removed:

```text
rule remains active
target becomes unresolved
mutation engine continues watching
matching replacement appears
mask automatically reapplied
```

If the page removes extension-added mask attributes or wrapper state, restore them.

Maintain an ActiveMask registry.

Example:

```ts
Map<RuleId, ActiveMask>
```

## RouteObserver

Implement robust SPA navigation detection.

Handle:

```text
popstate
hashchange
history.pushState
history.replaceState
```

Do not break the website's History API.

When route changes:

```text
determine applicable rules
remove stale active masks
resolve new matching rules
apply masks
```

## URL scopes

Support:

```text
exact-url
path-pattern
origin/domain
```

Examples:

```text
https://example.com/customer/123
https://example.com/customer/*
https://example.com/*
```

Design matching carefully.

Avoid interpreting user URL patterns as unsafe executable regular expressions.

## Dynamic page test fixture

Add SPA fixtures that simulate:

- React-style node replacement
- route transitions
- delayed rendering
- list reorder
- virtualized list behavior
- class name changes
- parent wrapper insertion

Tests must confirm masks recover.

## Performance

Add instrumentation available in development builds.

Track:

```text
rules resolved
rules unresolved
mutation batches
resolver execution count
portal renderer updates
```

Do not send telemetry externally.

## Acceptance criteria

A saved mask must survive:

- target DOM node replacement
- parent container replacement
- delayed DOM insertion
- SPA navigation away and back
- route changes without reload
- minor class changes
- target resizing

False-positive masking must be minimized.

If confidence is too low, keep the rule unresolved instead of masking a random element.

End the phase by documenting locator behavior in `ARCHITECTURE.md`.

---

# PHASE 3 — Privacy Gate, Anti-Flash Protection, Temporary Reveal, and Security Hardening

Continue the current **U Cant See Me** project.

This phase introduces the privacy-critical architecture.

The most important requirement is:

**A previously protected element must not briefly become visible before the extension reapplies the mask.**

We consider plaintext exposure for even one rendered frame an undesirable privacy failure.

## Document-start architecture

Implement dynamic persistent content-script registration using:

```ts
chrome.scripting.registerContentScripts()
```

For origins that contain saved mask rules.

Use:

```text
runAt: document_start
persistAcrossSessions: true
```

Register scripts only after the user has granted the necessary host permission.

When the last rule for an origin is deleted, unregister document-start protection for that origin when appropriate.

## Privacy Gate

Implement a Privacy Gate.

For origins with protected content:

```text
document_start
→ install privacy initialization guard
→ load relevant rules
→ initialize observers
→ apply/recover masks
→ remove initialization guard
```

Maximum Privacy mode may temporarily hide the page or a protected region.

The requirement is:

```text
blank/guarded
→ masked
```

NOT:

```text
plaintext
→ masked
```

## Modes

Support settings:

```text
Maximum Privacy
Balanced
Performance
```

### Maximum Privacy

Prioritize anti-flash behavior.

Page may remain temporarily visually guarded while rules initialize.

### Balanced

Use targeted guarding where possible.

### Performance

Skip aggressive page guarding.

Default should be:

```text
Maximum Privacy
```

for sites with persistent rules.

## Fail-closed behavior

For a rule that was previously known to protect sensitive content:

If rule recovery is temporarily uncertain:

- do not immediately expose content
- keep relevant protection guard where possible
- indicate unresolved state

Do not permanently freeze an entire unrelated site because one generic selector is missing.

Gmail-specific fail-closed logic will be implemented later.

## Temporary Reveal

Implement temporary reveal durations:

```text
5 seconds
10 seconds
30 seconds
60 seconds
```

Permanent MaskRule must remain unchanged.

Temporary state must exist only in runtime/session state.

Use:

```text
chrome.storage.session
```

or safe content-script runtime memory.

## Automatic relock

Implement settings that can automatically re-mask on:

```text
timer expiration
navigation
window blur
tab change
```

Default:

```text
timer expiration = ON
navigation = ON
window blur = ON
tab change = ON
```

Do not accidentally persist a reveal into a new browser session.

## Hold-to-reveal architecture

Prepare support for a future keyboard shortcut allowing:

```text
press and hold
→ temporarily reveal

release
→ immediately remask
```

If straightforward, implement it now behind a setting.

Ensure browser/OS reserved shortcuts are avoided.

## Printing

Protected content must remain protected during:

```text
Ctrl+P
print preview
Save as PDF
```

Add print styles and tests.

## Copy and selection

Add optional Strict Mask mode.

Possible settings:

```text
block pointer interaction
disable text selection
prevent copy when selection originates from protected region
```

Do NOT modify actual page data.

Do NOT erase page text.

Visual masking must remain reversible.

## Permission UX

When saving the first persistent rule for a domain:

```text
request optional host permission
```

Explain inside the extension UI that permission is required to restore masks automatically before page content appears.

Do not request all-site access unless explicitly chosen by the user.

## Security review

Audit code for:

- unsafe `innerHTML`
- eval
- remote script loading
- unnecessary permissions
- accidental content logging
- saved text content
- unsafe selector injection

Ensure Content Security Policy compatibility.

## Anti-flash tests

Create automated tests or visual frame tests where practical.

Required conceptual sequence:

```text
protected page reload

Frame 1: guarded
Frame 2: masked
Frame 3: masked
```

Never intentionally show:

```text
Frame 1: plaintext
Frame 2: masked
```

Document limitations where Chromium extension timing cannot guarantee mathematically perfect secrecy.

## Acceptance criteria

Before Phase 4:

- persistent document-start protection works
- Privacy Gate works
- temporary reveal works
- automatic re-lock works
- print remains masked
- host permission lifecycle works
- anti-flash behavior is covered by tests
- no page content is transmitted externally

---

# PHASE 4 — GmailAdapter and Per-Message Privacy Protection

Continue the existing **U Cant See Me** extension.

This phase implements specialized Gmail support.

Do NOT implement Gmail behavior by scattering Gmail selectors through generic code.

All Gmail-specific logic must live under:

```text
src/adapters/gmail/
```

The generic engine should interact only through the SiteAdapter abstraction.

## Goal

A user should be able to protect a specific Gmail conversation and optionally a specific message.

The extension should support masking:

```text
conversation/thread subject
selected message body
collapsed message preview
inbox/search subject
inbox/search snippet
```

## Privacy requirement

When the user revisits a previously protected Gmail thread:

The thread must NOT render sensitive plaintext before masking is applied.

Use a Gmail-specific privacy guard.

Conceptual sequence:

```text
Gmail route changes
→ detect protected thread candidate
→ Gmail guard ON
→ resolve thread/message identity
→ resolve subject/body surfaces
→ apply masks
→ Gmail guard OFF
```

Prefer temporary over-masking to under-masking.

## Gmail architecture

Create modules such as:

```text
src/adapters/gmail/
├── gmail-adapter.ts
├── gmail-identifiers.ts
├── gmail-selectors.ts
├── gmail-route.ts
├── gmail-thread-resolver.ts
├── gmail-message-resolver.ts
├── gmail-list-resolver.ts
└── gmail-guard.ts
```

Keep selectors centralized in:

```text
gmail-selectors.ts
```

Document every selector or DOM assumption.

## Gmail IDs

Use stable message/thread identifiers where available from the rendered Gmail DOM.

Potentially useful signals include attributes such as:

```text
data-message-id
data-legacy-message-id
```

and thread identifiers exposed through Gmail's DOM/routing behavior.

Treat Gmail DOM identifiers as implementation details, NOT guaranteed APIs.

The adapter must tolerate their absence.

Do not store email text merely to identify a protected email.

## Rule type

Extend the rule model for Gmail.

Conceptually:

```ts
interface GmailMaskTarget {
  threadId: string;
  messageId?: string;

  maskThreadSubject: boolean;
  maskMessageBody: boolean;
  maskCollapsedPreview: boolean;
  maskListSubject: boolean;
  maskListSnippet: boolean;
}
```

The exact model can differ if architecture requires it.

## Gmail subject semantics

Understand that Gmail conversation view often exposes a thread-level subject.

Therefore:

```text
threadId
→ thread/conversation subject

messageId
→ individual message content
```

Do not incorrectly assume every individual Gmail message has a separately rendered subject.

## Gmail protection UI

When the extension detects Gmail, provide a simplified Gmail-specific action.

Example:

```text
Protect this email

[x] Conversation subject
[x] Message body
[x] Collapsed preview
[x] Inbox/search subject
[x] Inbox/search snippet

Mask style:
● Black
○ White
○ Blur
○ Mosaic

[ Protect ]
```

Users should not need to manually select Gmail DOM internals for the standard email-protection flow.

Keep generic element selection available as an advanced option.

## Gmail conversation handling

Support threads with multiple messages.

Example:

```text
Thread ABC

Message A
Message B
Message C
```

If only Message B is protected:

- protect the shared thread subject if configured
- protect Message B body
- do not unnecessarily hide Message A/C bodies

## Collapsed messages

A protected message body may not exist in the DOM while collapsed.

The rule must remain pending.

When the message expands:

```text
MutationObserver
→ detect newly inserted message DOM
→ match message ID
→ apply protection immediately
```

Mask the collapsed preview when configured.

## Gmail list view

When a protected thread appears in:

```text
Inbox
Search
Sent
Archive
Labels
```

mask configured surfaces:

```text
subject
snippet
```

Do not depend solely on exact URL location.

## Gmail SPA navigation

Handle Gmail transitions without page reload.

Examples:

```text
Inbox → thread
thread → another thread
thread → search
search → thread
back/forward navigation
```

Integrate Gmail route observation with the generic RouteObserver where possible.

Do not add constant polling.

## Gmail fail-closed behavior

If current route strongly indicates that a protected Gmail thread is being opened but the adapter cannot resolve the expected DOM:

```text
keep Gmail privacy guard enabled
show small extension-owned warning
do not expose the thread content
```

Example warning:

```text
U Cant See Me

Protected Gmail content is hidden because Gmail's page structure could not be verified.

[ Retry ]
[ Temporarily reveal ]
```

Do not silently disable protection.

## Gmail selectors versioning

Create a Gmail DOM compatibility/version abstraction.

Example:

```ts
gmailDomProfileVersion
```

Tests should make it possible to support multiple Gmail DOM structures.

## Gmail fixtures

Create fully synthetic fixtures.

Never include real emails.

Fixtures should cover:

```text
gmail-thread-expanded.html
gmail-thread-collapsed.html
gmail-multi-message-thread.html
gmail-inbox.html
gmail-search.html
gmail-delayed-body.html
gmail-layout-variant.html
```

## Testing

Test:

- protect a Gmail thread
- reload
- revisit
- protect one message inside multi-message thread
- collapsed to expanded
- inbox list masking
- search result masking
- route navigation
- DOM replacement
- Gmail unresolved fail-closed behavior

## Important restrictions

Do NOT request Gmail API OAuth.

Do NOT use Gmail API.

Do NOT send Gmail content anywhere.

Do NOT store email body text.

Do NOT store subject text if it can be avoided.

Do NOT make Gmail.js a required runtime dependency unless absolutely necessary.

Use local DOM inspection only.

## Acceptance criteria

A protected Gmail message/thread should remain protected after:

```text
reload
navigate away/back
browser restart
collapse/expand
SPA transitions
Gmail rerender
```

No unprotected frame should intentionally appear during known protected-thread navigation.

---

# PHASE 5 — Rule Management, UX, Shortcuts, Context Menu, and Advanced Controls

Continue the existing **U Cant See Me** project.

This phase focuses on making the extension practical for everyday use.

Do not weaken any existing privacy behavior.

## Popup redesign

Create a clear popup:

```text
U Cant See Me

Protection
● ON

Current site
3 active masks
1 unresolved

[ Select elements ]
[ Temporarily reveal all ]

────────────

Gmail
Protected thread

[ Manage this page ]
[ Settings ]
```

Show status states:

```text
Protected
Partially protected
Unresolved
Protection failure
No masks
```

## Rule manager

Create an Options page where users can inspect all rules.

Allow filtering by:

```text
domain
URL
adapter
mask style
enabled/disabled
resolved/unresolved status
```

Actions:

```text
enable
disable
edit mask style
change scope
delete
duplicate
test locator
```

Do not display stored sensitive page content because none should exist.

## Page management

Allow:

```text
Reveal all masks temporarily
Disable masks for this page
Disable protection for this site
Remove all masks on this page
```

Distinguish temporary state from persistent configuration.

## Context menu

Add:

```text
U Cant See Me
├─ Mask this element
├─ Reveal this element
├─ Remove this mask
└─ Protect this Gmail message
```

Only show relevant actions when appropriate.

## Keyboard shortcuts

Implement commands where possible.

Example candidates:

```text
Start element selection
Toggle temporary reveal
Immediately remask everything
```

Avoid common browser/OS shortcuts.

Allow users to customize shortcuts through Chromium's extension command UI.

## Hold-to-reveal

Implement a secure hold-to-reveal mechanism if not already completed.

Behavior:

```text
key held
→ reveal

key released
→ remask immediately
```

On:

```text
window blur
tab switch
navigation
```

always remask.

## Mask editing

Allow clicking an existing mask while extension edit mode is active.

Actions:

```text
change Black → Blur
change blur amount
change Mosaic size
change scope
disable
delete
```

## Mask visual indicators

Normal operation:

```text
no border
no extension branding inside mask
```

Edit mode:

show subtle rule boundaries and identifiers.

## Status badge

Implement extension badge status.

Possible states:

```text
green
all applicable rules resolved

yellow
one or more rules unresolved

red
privacy protection error

gray
no rules for current page
```

Do not rely on color alone.

Popup must show textual state.

## Import/export

Implement local export/import of configuration.

Export should include:

```text
settings
rules
schemaVersion
```

Warn users that rules may contain URLs, element attributes, Gmail thread/message identifiers, or other metadata.

Do not include temporary reveal state.

Allow encrypted export only if straightforward; otherwise document this as a future feature.

## Backup safety

Validate imported JSON strictly.

Never execute imported values as code.

Never dynamically evaluate imported selectors.

## Acceptance criteria

The product should now be usable without developer tools.

Users can:

- create rules
- edit rules
- temporarily reveal
- delete rules
- inspect broken rules
- import/export configuration
- manage Gmail rules
- understand protection status

---

# PHASE 6 — Production Hardening, Cross-Browser Validation, Performance, and Release Readiness

Continue the current **U Cant See Me** codebase.

This is the production hardening phase.

Do not introduce major architecture changes unless testing demonstrates a real need.

## Browser targets

Test:

```text
latest stable Chrome
latest stable Brave
latest stable Microsoft Edge
```

Use the same core extension build whenever possible.

Document any browser-specific differences.

## Performance testing

Stress test:

```text
100 active masks
large DOM
1000 mutation events/sec
virtualized lists
frequent resize events
fast scroll
SPA navigation
```

Goals:

- no visible lag in normal browsing
- no whole-document rescans per mutation
- no permanent requestAnimationFrame loops when idle
- no large memory leaks
- no unbounded MutationObserver work

## Memory lifecycle

Audit:

```text
event listeners
MutationObservers
ResizeObservers
timers
overlay DOM
route observers
message listeners
```

Ensure cleanup occurs on:

```text
route changes
rule deletion
mask deletion
content script teardown
target disappearance
```

## Renderer stress tests

Verify:

```text
position: fixed
position: sticky
overflow containers
transform
zoom
CSS animation
flex
grid
tables
SVG
images
inputs
video
canvas
```

Document unsupported cases rather than silently pretending they are protected.

## iframe policy

Define and document behavior for:

```text
same-origin iframe
cross-origin iframe
sandboxed iframe
```

If feasible, support same-origin frames.

Do not request unnecessarily broad permissions just to support rare iframe scenarios.

## Shadow DOM

Support open Shadow DOM where reasonably possible.

Document limitation for closed Shadow DOM.

Never claim full protection inside inaccessible closed component trees.

## Browser zoom

Test at:

```text
80%
90%
100%
110%
125%
150%
200%
```

Portal renderer must remain correctly aligned.

## Accessibility

Ensure extension UI:

- keyboard accessible
- clear focus states
- screen reader labels
- sufficient contrast
- does not rely only on color
- offers usable controls at browser zoom

## Localization architecture

Prepare UI strings for localization.

At minimum structure code so later language packs can support:

```text
English
Traditional Chinese
```

Implemented in 0.2.0: the popup and Options page ship in English and Traditional Chinese (Taiwan), switched by a persisted language control.

Use Traditional Chinese suitable for Taiwan.

## Privacy audit

Confirm:

```text
no remote backend
no analytics by default
no browsing data upload
no email content upload
no innerText persistence
no remote code execution
no eval
no third-party tracking
```

Review `manifest.json`.

Remove unused permissions.

## Chrome Web Store readiness

Prepare:

```text
privacy policy
store description
permission explanation
screenshots checklist
release build
versioning
changelog
```

The privacy policy should clearly explain:

- extension operates locally
- what is stored
- why host permissions are needed
- no Gmail API access
- no message contents are uploaded
- URLs and structural metadata may be stored locally for persistent masks

## Error logging

Local diagnostic logging only.

Provide:

```text
Off
Errors only
Verbose debugging
```

Default:

```text
Errors only
```

Avoid logging page text.

Provide an option to export sanitized diagnostics.

## Rule migration

Test migration across at least two artificial schema versions.

If migration fails:

- do not silently discard rules
- preserve backup
- notify user
- allow recovery/export

## Gmail compatibility testing

Run all Gmail fixtures.

Create a developer diagnostic view showing:

```text
thread ID detected
message IDs detected
subject surface found
body surface found
list surface found
guard state
```

Never show email contents in diagnostics.

## Security testing

Test hostile pages attempting to:

- remove mask elements
- overwrite mask CSS
- continuously rerender targets
- inject extreme z-index elements
- call history APIs frequently
- create massive mutation storms

Protection should self-heal where possible.

## Final acceptance checklist

The extension is release-ready only if all of these are true:

### Generic masking

- Black works
- White works
- Blur works
- Mosaic works
- multi-element selection works
- reload persistence works
- browser restart persistence works
- SPA support works
- DOM replacement recovery works

### Privacy

- document-start guard works
- anti-flash protection works as designed
- temporary reveal re-locks
- tab switch re-locks
- blur does not expose readable data
- mosaic is opaque
- printing stays masked

### Gmail

- thread subject masking works
- selected message body masking works
- collapsed message protection works
- inbox/search subject works
- inbox/search snippet works
- SPA navigation works
- Gmail DOM failure enters safe state

### Security

- no sensitive text stored
- no browsing data transmitted
- no Gmail API
- no remote scripts
- minimal permissions
- imported rules validated

### Quality

- unit tests pass
- E2E tests pass
- Chrome works
- Brave works
- Edge works
- lint passes
- TypeScript passes
- production build succeeds

## Deliverables

Update:

```text
README.md
ARCHITECTURE.md
DEVELOPMENT.md
PRIVACY.md
SECURITY.md
CHANGELOG.md
```

Create a final architecture diagram.

Create a release checklist.

Summarize:

```text
supported scenarios
known limitations
privacy guarantees
non-guarantees
future roadmap
```

Do not claim this extension is encryption, DRM, or enterprise DLP.

Describe it accurately as:

**local visual privacy protection for browser-rendered content.**

---

# Recommended Prefix for Every New Phase

Before coding, inspect the existing repository, run the current test suite, understand the architecture, and preserve backward compatibility. Do not rewrite working modules just to simplify your task.
