# NestKit release checklist

1. Confirm `manifest.json` and `versions.json` both use the intended release version.
2. Run `npm install`, `npm run lint`, and `npm run build`.
3. Verify `main.js`, `manifest.json`, and `styles.css` are present in the plugin root.
4. Manually validate the right sidebar drawer using `docs/TEST_PLAN.md`.
5. Confirm `right-sidebar-hover.css` and `right-sidebar-hover.backup.css` are still present and unchanged.
6. Confirm `README.md` and `docs/MIGRATION_NOTES.md` still describe the legacy snippet migration accurately.
7. Confirm behaviour, positioning, and advanced sidebar settings still apply through CSS variables without reloading the plugin.
8. Confirm the `no-drag` fix and strict root selector remain intact after any customization changes.
9. Confirm Simplified Chinese is the default interface language and English switching works without changing slider values.
10. Confirm pin tooltip and `aria-label` text switch with the selected language.
11. Confirm the pin button still supports temporary pinning when **Remember pinned state** is off.
12. Confirm **Remember pinned state** restores the expected sidebar state after restart, plugin re-enable, and right sidebar reopen.
13. Confirm every numeric slider has a compact reset icon that restores only that setting.
14. Confirm `Drawer height` defaults to `100%`, syncs through `vh`, and stays capped by the available space defined by the top offset and bottom gap.
15. Confirm **Restore all defaults** resets the full NestKit settings object, including language, toggles, pinned state, `Drawer height = 100%`, and the `110px` top control offset default.
16. Remind testers with older vault settings to use a single-setting reset or click **Restore all defaults** once if they need to adopt the new `110px` top control default.
17. Tag the release with the exact plugin version number without a leading `v`.
18. Attach `main.js`, `manifest.json`, and `styles.css` as release assets when publishing.
