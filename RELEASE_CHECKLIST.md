# Release checklist

## Required evidence

- [ ] `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:e2e` pass on the release commit.
- [ ] Load `dist/` as an unpacked extension in latest stable Chrome.
- [ ] Verify the same build manually in latest stable Brave and Microsoft Edge.
- [ ] Recheck optional host permission request/revocation and browser restart persistence.
- [ ] Verify popup, Options keyboard navigation, context menu, commands, badge text, print protection, and hold-to-reveal.
- [ ] Run only synthetic Gmail fixtures; do not use a real mailbox for release validation.
- [ ] Review `PRIVACY.md`, `SECURITY.md`, this checklist, store description, and permission explanation.
- [ ] Prepare screenshots using synthetic data only.

## Packaging

`dist/` is the unpacked build output. A packaged archive or store upload is intentionally not generated until the target browser matrix above has been completed. Confirm the release version and changelog before creating an archive.
