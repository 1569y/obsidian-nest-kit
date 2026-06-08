# NestKit release checklist

1. Confirm `manifest.json` and `versions.json` both use the intended release version.
2. Run `npm install`, `npm run lint`, and `npm run build`.
3. Verify `main.js`, `manifest.json`, and `styles.css` are present in the plugin root.
4. Manually validate the right sidebar drawer using `docs/TEST_PLAN.md`.
5. Confirm `right-sidebar-hover.css` and `right-sidebar-hover.backup.css` are still present and unchanged.
6. Confirm `README.md` and `docs/MIGRATION_NOTES.md` still describe the legacy snippet migration accurately.
7. Tag the release with the exact plugin version number without a leading `v`.
8. Attach `main.js`, `manifest.json`, and `styles.css` as release assets when publishing.
