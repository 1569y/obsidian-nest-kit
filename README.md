# NestKit

NestKit is a desktop-only Obsidian community plugin for modular workspace enhancements. The current development branch extends the `0.1.0` right sidebar drawer with live customization controls for drawer behaviour and positioning.

## Desktop only

NestKit currently targets desktop Obsidian only. The right sidebar drawer depends on desktop window chrome behavior and Windows titlebar click handling, so `isDesktopOnly` is set to `true`.

## Current module

- Right sidebar hover drawer with a scoped stylesheet namespace
- Optional pin button inside the right sidebar header
- Windows titlebar click fix for the top header spacer and root header container
- Settings tab for enabling the drawer, tuning drawer behaviour, and adjusting sidebar positioning
- Lightweight bilingual UI support for Simplified Chinese and English
- Top control offset selector scoped to `.workspace-split.mod-root > .workspace-tabs.mod-top`, without assuming `.mod-top-left-space`, with a default offset of `110px`
- Pinned state keeps the same `pin` icon and uses color only for the active visual state
- Pin button always supports temporary pinning during the current session
- Live CSS variable updates for drawer behaviour and positioning sliders, including a new `Drawer height` control
- Persistent pinned-state restore only when **Remember pinned state** is enabled
- Per-slider reset buttons for restoring each numeric setting to its own default value
- Restore all defaults action for resetting the NestKit language, toggles, pinned state, and positioning values

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

The current customization work does not include background images, solid backgrounds, or gradient background themes. Those can be considered later in a separate appearance-focused module.

NestKit now ships with a local TypeScript dictionary for `zh-CN` and `en`. The default UI language is Simplified Chinese, the settings tab refreshes immediately after language changes, and pin button tooltip plus `aria-label` text switch with the selected language. Automatic language detection from Obsidian is not included in the current branch.

Pinned state persistence is now implemented through a dedicated `rightSidebarPinned` setting. The runtime workspace class and the persisted setting intentionally serve different roles: the pin button can always create a temporary pinned state for the current session, while **Remember pinned state** only controls whether that state is restored after restarting Obsidian, re-enabling the plugin, or reopening the right sidebar. Disabling the drawer or unloading the plugin only clears the runtime class, while turning off **Remember pinned state**, hiding the pin button, or clicking **Restore all defaults** also clears the stored preference. Each numeric slider also includes its own reset icon so users can restore one setting at a time without affecting language, toggles, or other slider values. The Positioning section now also includes `Drawer height`, which defaults to `100%`, syncs to CSS as `vh`, and caps the real drawer height with `min()` so it never exceeds the available space defined by the top offset and bottom gap. Existing `data.json` values are not auto-migrated to the new `110px` top control default; if a vault was already tuned against the old `125px` default, use a single-setting reset or click **Restore all defaults** once to adopt the new baseline.

When manually testing the plugin, disable the old CSS snippet first so the snippet and plugin stylesheet are not loaded at the same time.

## BRAT release plan

NestKit is currently prepared for local development and manual validation. A later release can package the same artifacts for BRAT testing after the manual migration checklist, architecture review, and release checklist are complete.

## Additional docs

- `docs/ARCHITECTURE.md`
- `docs/TEST_PLAN.md`
- `docs/RELEASE_CHECKLIST.md`
- `docs/MIGRATION_NOTES.md`
