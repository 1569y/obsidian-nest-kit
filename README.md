# NestKit

NestKit is a desktop-only Obsidian community plugin for modular workspace enhancements. Version `0.1.0` focuses on a right sidebar hover drawer that migrates an existing validated CSS snippet into a plugin-managed feature.

## Desktop only

NestKit currently targets desktop Obsidian only. The right sidebar drawer depends on desktop window chrome behavior and Windows titlebar click handling, so `isDesktopOnly` is set to `true`.

## Current module

- Right sidebar hover drawer with a scoped stylesheet namespace
- Optional pin button inside the right sidebar header
- Windows titlebar click fix for the top header spacer and root header container
- Settings tab for enabling the drawer and showing the pin button
- Top control offset selector scoped to `.workspace-split.mod-root > .workspace-tabs.mod-top`, without assuming `.mod-top-left-space`
- Pinned state keeps the same `pin` icon and uses color only for the active visual state

## Local development

```bash
npm install
npm run lint
npm run build
npm run dev
```

`npm run dev` is available for local watch builds, but the current migration flow validates with `npm run lint` and `npm run build`.

## Enable in Obsidian

1. Build the plugin so `main.js`, `manifest.json`, and `styles.css` exist in the plugin root.
2. Open Obsidian and go to **Settings → Community plugins**.
3. Refresh community plugins if needed, then enable **NestKit**.
4. Open **Settings → NestKit** and turn on **Enable right sidebar hover drawer**.

## Migration note for the legacy snippet

Do not delete the legacy `right-sidebar-hover.css` snippet until plugin testing is complete. The repository keeps:

- `right-sidebar-hover.css` as the validated reference source
- `right-sidebar-hover.backup.css` as the untouched backup
- `styles.css` as the actual plugin-loaded stylesheet

The current Obsidian DOM does not guarantee `.mod-top-left-space` on the root `.workspace-tabs`, so the top control offset rule is intentionally scoped to `.workspace-split.mod-root > .workspace-tabs.mod-top` with direct-child selectors. The offset must stay transform-based; do not switch to `margin-right`, and do not remove the validated spacer plus root header `no-drag` fix.

When manually testing the plugin, disable the old CSS snippet first so the snippet and plugin stylesheet are not loaded at the same time.

## BRAT release plan

NestKit is currently prepared for local development and manual validation. A later release can package the same artifacts for BRAT testing after the manual migration checklist, architecture review, and release checklist are complete.

## Additional docs

- `docs/ARCHITECTURE.md`
- `docs/TEST_PLAN.md`
- `docs/RELEASE_CHECKLIST.md`
- `docs/MIGRATION_NOTES.md`
