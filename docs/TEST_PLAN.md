# NestKit test plan

## Spaced Review Phase 1 core focus

1. Confirm there are exactly 3 built-in review presets.
2. Confirm the default preset id is `standard-review`.
3. Confirm all built-in preset intervals pass `validateReviewIntervals(...)`.
4. Confirm `getBuiltInReviewPresets()` returns copies that do not mutate internal preset constants.
5. Confirm `[1, 3, 7]` is a valid cumulative interval list.
6. Confirm `[0, 1]` is invalid.
7. Confirm `[-1, 1]` is invalid.
8. Confirm `[1, 1, 3]` is invalid.
9. Confirm `[3, 1, 7]` is invalid and is not auto-sorted.
10. Confirm more than 32 intervals is invalid.
11. Confirm an interval value above `3650` is invalid.
12. Confirm `parseReviewIntervalsInput('1, 3, 7')` is valid.
13. Confirm `parseReviewIntervalsInput('1 3 7')` is valid.
14. Confirm `parseReviewIntervalsInput('1, x, 7')` is invalid.
15. Confirm `isIsoDateString('2026-06-14')` is true.
16. Confirm `isIsoDateString('2026-6-14')` is false.
17. Confirm `isIsoDateString('2026-02-30')` is false.
18. Confirm `addCalendarDays('2026-06-14', 1)` returns `2026-06-15`.
19. Confirm `addCalendarDays('2026-12-31', 1)` returns `2027-01-01`.
20. Confirm `compareIsoDates(...)` orders ISO dates correctly.
21. Confirm fixed timeline with `startDate = 2026-06-14` and `[1, 3, 7]` plans `2026-06-15`, `2026-06-17`, and `2026-06-21`.
22. Confirm `2026-06-15` returns sequence `0` as pending.
23. Confirm `2026-06-16` with `carryOver` returns sequence `0` as overdue.
24. Confirm `2026-06-16` with `skip` does not return sequence `0`.
25. Confirm `2026-06-17` with `carryOver` still returns only sequence `0` by default, not sequence `0` plus sequence `1`.
26. Confirm rolling gaps convert `[1, 3, 7]` into `[1, 2, 4]`.
27. Confirm completing sequence `0` on `2026-06-16` in rolling mode updates `rollingAnchorDate` to `2026-06-16`.
28. Confirm sequence `1` in rolling mode is then planned for `2026-06-18`.
29. Confirm fixed-mode completion does not overwrite `rollingAnchorDate`.
30. Confirm `completeOccurrence(...)` does not mutate the original task object.
31. Confirm `completeOccurrence(...)` adds the completed sequence index.
32. Confirm `completeOccurrence(...)` removes that index from `skippedSequenceIndexes`.
33. Confirm `skipOccurrence(...)` adds the skipped sequence index.
34. Confirm `skipOccurrence(...)` removes that index from `completedSequenceIndexes`.
35. Confirm completed and skipped indexes are deduplicated and sorted.
36. Confirm `createDefaultSpacedReviewStore()` uses `schemaVersion = 1`.
37. Confirm reading a missing store returns the default store.
38. Confirm invalid store JSON returns the default store plus a warning.
39. Confirm invalid tasks are discarded during store normalization.
40. Confirm `upsertReviewTask(...)` adds a task when the id is new.
41. Confirm `upsertReviewTask(...)` replaces a task when the id already exists.
42. Confirm `removeReviewTask(...)` removes the matching task id.
43. Confirm `writeSpacedReviewStore(...)` calls `ensureFolder('.nestkit/spaced-review')`.
44. Confirm `writeSpacedReviewStore(...)` writes pretty JSON.
45. Confirm reading after writing through a memory adapter restores the same task data.
46. Confirm reading a missing store returns `shouldPersist = false`.
47. Confirm invalid store JSON returns `shouldPersist = false`.
48. Confirm a non-object store returns `shouldPersist = true`.
49. Confirm a missing or invalid `schemaVersion` returns `shouldPersist = true`.
50. Confirm a clean `schemaVersion = 1` store returns `shouldPersist = false`.
51. Confirm a `schemaVersion = 1` store with normalized fields returns `shouldPersist = true`.
52. Confirm a future `schemaVersion` returns `hasUnsupportedFutureVersion = true`.
53. Confirm a future `schemaVersion` returns `shouldPersist = false`.
54. Confirm a future `schemaVersion` still exposes valid known tasks in the runtime store.
55. Confirm invalid `completedSequenceIndexes` marks `didNormalize = true`.
56. Confirm duplicate `completedSequenceIndexes` marks `didNormalize = true`.
57. Confirm unsorted `completedSequenceIndexes` marks `didNormalize = true`.
58. Confirm invalid `skippedSequenceIndexes` marks `didNormalize = true`.
59. Confirm duplicate `skippedSequenceIndexes` marks `didNormalize = true`.
60. Confirm unsorted `skippedSequenceIndexes` marks `didNormalize = true`.
61. Confirm valid completed and skipped indexes leave `didNormalize = false`.
62. Confirm `writeSpacedReviewStore(...)` still calls `ensureFolder('.nestkit/spaced-review')`.
63. Confirm `writeSpacedReviewStore(...)` still writes pretty JSON.
64. Confirm reading after writing still restores the same task data.

## Spaced Review Phase 2 create-task focus

1. Confirm Spaced Review is disabled by default in settings.
2. Confirm the command palette contains `NestKit: Create spaced review task`.
3. Confirm running the command while Spaced Review is disabled shows an enable notice.
4. Confirm the disabled command path does not create `.nestkit/spaced-review/tasks.json`.
5. Confirm enabling Spaced Review in settings immediately activates the feature through `FeatureManager.sync(...)`.
6. Confirm running the command while enabled opens the create-task modal.
7. Confirm the modal includes title, start date, preset, and custom intervals fields.
8. Confirm the modal defaults `startDate` to today.
9. Confirm the modal defaults the preset to the configured default preset setting.
10. Confirm saving with an empty title is rejected.
11. Confirm saving with an invalid `YYYY-MM-DD` date is rejected.
12. Confirm saving with invalid custom intervals is rejected.
13. Confirm saving with a built-in preset creates `.nestkit/spaced-review/tasks.json`.
14. Confirm the saved task uses the entered title, start date, preset id, and preset interval snapshot.
15. Confirm saving with custom intervals overrides the preset interval snapshot.
16. Confirm new tasks start with `status = active`.
17. Confirm new tasks start with empty completed and skipped index arrays.
18. Confirm new tasks do not set `rollingAnchorDate` initially.
19. Confirm disabling Spaced Review after creating tasks does not delete `tasks.json`.
20. Confirm **Restore all defaults** resets Spaced Review settings but does not delete `tasks.json`.
21. Confirm the existing right-sidebar drawer behavior remains unchanged after enabling, disabling, and using Spaced Review.
22. Confirm `DEFAULT_SETTINGS.spacedReviewManagedBlockHeading` equals `\u4eca\u65e5\u590d\u4e60` at runtime and does not contain mojibake text.
23. Confirm the command palette does not show a duplicate `NestKit:` prefix.
24. Confirm creating a second task after `.nestkit/spaced-review` already exists still succeeds.
25. Confirm `ensureFolder('.nestkit/spaced-review')` is idempotent.
26. Confirm `.nestkit` hidden folders do not need to be visible through the Vault file tree for store read/write to succeed.
27. Confirm the vault storage adapter uses path-based `DataAdapter` read, write, exists, and mkdir calls for the store path.
28. Confirm creating a second task in real DevVault after `.nestkit/spaced-review` already exists still succeeds.
29. Confirm `Folder already exists` does not surface when parent folders already exist.
30. Confirm create-task failures show a Notice, log the error, and do not leave an unhandled promise rejection.
31. Confirm the custom intervals UI recommends space-separated input such as `1 3 7`.
32. Confirm the parser still accepts comma-separated input for compatibility.
33. Confirm the parser accepts full-width comma input such as `1\uFF0C3\uFF0C7`.

## Phase 3 settings-migration focus

1. Confirm `undefined` raw settings return `DEFAULT_SETTINGS` without warnings and without forcing an immediate save.
2. Confirm `null` raw settings return `DEFAULT_SETTINGS` without warnings and without forcing an immediate save.
3. Confirm an empty object is treated as legacy schema `0`, migrates to schema `1`, fills missing fields from defaults, and marks `shouldPersist = true`.
4. Confirm primitive raw values such as a string or number fall back to `DEFAULT_SETTINGS`, log a warning, and mark `shouldPersist = true`.
5. Confirm an array raw value falls back to `DEFAULT_SETTINGS`, log a warning, and mark `shouldPersist = true`.
6. Confirm a complete legacy `0.2.0` flat settings object is preserved, upgraded to schema `1`, and marked `shouldPersist = true`.
7. Confirm a partial legacy settings object preserves valid known fields and fills missing fields from defaults.
8. Confirm legacy unknown fields are ignored by the normalized settings object.
9. Confirm a valid schema `1` settings object round-trips without normalization and without forced persistence.
10. Confirm a schema `1` settings object with missing fields is normalized and marked `shouldPersist = true`.
11. Confirm a future schema version is recognized as unsupported, logs a warning, and keeps `shouldPersist = false`.
12. Confirm an invalid `schemaVersion` such as a string, `NaN`, `Infinity`, a negative number, or a decimal normalizes safely to schema `1`.
13. Confirm invalid boolean fields fall back to defaults.
14. Confirm invalid numeric field types fall back to defaults.
15. Confirm `NaN` and `Infinity` in numeric fields fall back to defaults.
16. Confirm out-of-range numeric settings fall back to defaults using the same ranges as the current slider UI.
17. Confirm an unknown `uiLanguage` falls back to `zh-CN`.
18. Confirm `rightSidebarDrawerEnabled = true` survives migration.
19. Confirm `rememberPinnedState = true` together with `rightSidebarPinned = true` survives migration.
20. Confirm `rememberPinnedState = false` together with `rightSidebarPinned = true` is preserved as stored preference and still relies on existing runtime logic to decide whether pinned state is restored.
21. Confirm `migrateSettings(migrateSettings(raw).settings)` is idempotent.
22. Confirm **Restore all defaults** still resets the full settings object to `DEFAULT_SETTINGS`, including `schemaVersion = 1`.
23. Confirm plugin reload after a migrated save does not trigger a second migration rewrite for already normalized schema `1` data.
24. Confirm a future schema load does not call `saveData()` during `loadSettings()`.
25. Confirm a future schema session blocks `updateSetting()` from calling `saveData()`.
26. Confirm a future schema session blocks `updateRememberPinnedState()` from calling `saveData()`.
27. Confirm a future schema session blocks `syncPersistentPinnedState()` from calling `saveData()`.
28. Confirm a future schema session blocks `clearPinnedState()` from calling `saveData()`.
29. Confirm a future schema session blocks `restoreAllDefaults()` from calling `saveData()`.
30. Confirm the blocked-persistence warning is emitted at most once per future-schema session.
31. Confirm schema `0` and schema `1` still allow ordinary `saveData()` writes after successful migration or user settings changes.
32. Confirm `migrateSettings(undefined).settings !== DEFAULT_SETTINGS`.
33. Confirm `migrateSettings(null).settings !== DEFAULT_SETTINGS`.
34. Confirm mutating a default object returned by migration does not mutate `DEFAULT_SETTINGS`.

## Phase 2 listener-scope focus

1. Enable the plugin but keep **Enable right sidebar hover drawer** off, then confirm the drawer stays inactive and the default Obsidian right sidebar behavior is unchanged.
2. Turn the drawer on for the first time in the session and confirm hover-open behavior activates normally.
3. Turn the drawer off and confirm the native right sidebar behavior returns immediately.
4. Turn the drawer on again in the same session and confirm the drawer still behaves correctly after listener re-registration.
5. Repeat the drawer on or off cycle several times and confirm there is still only one pin button, one refresh path, and no obvious duplicated listener behavior.
6. With **Remember pinned state** off, pin the drawer temporarily and confirm pointer-leave collapse stays disabled for the current session only.
7. With **Remember pinned state** on, pin the drawer, close and reopen the right sidebar, and confirm the pinned state is restored.
8. Move Behaviour, Positioning, and Advanced sliders while the drawer is enabled and confirm updates still apply immediately.
9. Switch between Simplified Chinese and English and confirm the settings tab and pin button labels still refresh correctly.
10. Click **Restore all defaults** and confirm the drawer disables, runtime pinned state clears, and defaults are restored.
11. On Windows, confirm minimize, maximize, and close remain clickable while the right sidebar is logically open.
12. Disable the plugin and confirm all NestKit UI side effects are removed and the native right sidebar behavior is restored.

## Phase 2.5 settings tabs and performance guardrails

1. Confirm the settings page has `General`, `Workspace Panel`, `Spaced Review`, and `About` tabs.
2. Confirm the default active tab is `General`.
3. Confirm the top-right actions include **What's New**, **Language**, and **Restore defaults**.
4. Confirm only the active tab content renders at a time.
5. Confirm the top active tab title is not duplicated above the tabs.
6. Confirm the Workspace Panel tab contains the existing drawer controls and sliders.
7. Confirm the Spaced Review tab contains the existing review settings.
8. Confirm the About tab shows local static version and phase 2.5 text.
9. Confirm **What's New** opens local static content and does not call `fetch()`.
10. Confirm **Language** reuses the existing plugin language setting and does not add a new schema field.
11. Confirm **Restore defaults** resets settings only and does not delete `tasks.json`.
12. Confirm opening settings does not read `.nestkit/spaced-review/tasks.json`.
13. Confirm opening settings does not create `.nestkit`.
14. Confirm opening settings does not create `.nestkit/spaced-review`.
15. Confirm top actions and tabs are visually separated.
16. Confirm General tab does not show duplicate status bullets or internal performance wording.
17. Confirm no Daily Note write path is invoked.
18. Confirm no checkbox listener is added.
19. Confirm no network request is made.
20. Confirm settings schema version remains unchanged.
21. Confirm store schema version remains unchanged.
22. Confirm the Spaced Review tab does not expose internal task-store wording.
23. Confirm task overview remains intentionally deferred to Phase 3A.
24. Confirm tab content does not duplicate the active tab title.
25. Confirm General tab does not render an extra General heading inside content.
26. Confirm Workspace Panel tab does not render an extra Workspace Panel heading inside content.
27. Confirm Spaced Review tab does not render an extra Spaced Review heading inside content.
28. Confirm About tab does not render an extra About heading inside content.
29. Confirm tab descriptions align visually with the setting cards below them.
30. Confirm per-tab restore defaults remains intentionally deferred and only one global **Restore defaults** action is shown.

## Phase 1 toolbox-core focus

1. Enable the plugin but keep **Enable right sidebar hover drawer** off, then confirm the feature behaves exactly like the published `0.2.0` release.
2. Turn the drawer on for the first time in the session and confirm the right sidebar drawer activates normally.
3. Turn the drawer off and confirm all UI side effects are removed immediately.
4. Turn the drawer on again in the same session and confirm the behavior is still correct, with no duplicated pin button and no duplicated refresh effects.
5. Disable the plugin and confirm the default Obsidian right sidebar behavior is fully restored.
6. Re-enable the plugin and confirm the drawer remains off by default unless the saved setting enables it.
7. Confirm this phase introduces no settings-schema prompts, no migration UI, and no new user-facing settings sections.

1. Disable the plugin and confirm the default Obsidian right sidebar behavior is fully restored.
2. Enable the plugin but keep **Enable right sidebar hover drawer** off and confirm the default behavior is unchanged.
3. Turn the drawer setting on while the right sidebar is logically closed and confirm the top header remains normal.
4. Open the right sidebar, move the pointer to the right edge, and confirm the drawer slides out.
5. Move the pointer away and confirm the drawer collapses after the configured delay.
6. Click the pin button and confirm the drawer stays open.
7. Confirm pinned and unpinned states both show the same `pin` icon, with active color as the only pinned-state visual change.
8. Click the pin button again and confirm hover-based collapse returns.
9. On Windows, confirm minimize, maximize, and close are all clickable while the right sidebar is logically open.
10. Confirm the top root `.workspace-tabs` does not need `.mod-top-left-space` for the first control group offset to apply.
11. Confirm top tabs, the add button, dropdown controls, and native right sidebar controls remain clickable.
12. Confirm search inputs, tabs, and cards inside the right sidebar remain clickable.
13. Confirm the top control offset is still transform-based and not using `margin-right`.
14. Close and reopen the right sidebar and confirm the pin button is not duplicated.
15. Turn off **Show pin button** and confirm the button and pinned class are removed immediately.
16. Turn off **Enable right sidebar hover drawer** and confirm no residual button, class, observer-driven behavior, or timer-driven behavior remains.
17. Move each Behaviour slider and confirm the drawer updates immediately without reloading the plugin.
18. Move each Positioning slider and confirm the drawer position updates immediately without reloading the plugin.
19. Move each Advanced slider and confirm the pin button offset and top control offset update immediately.
20. Confirm settings persist after saving and restarting Obsidian.
21. Turn off the drawer setting and confirm NestKit-owned CSS variables are removed from `body`.
22. Disable the plugin and confirm NestKit-owned CSS variables are removed from `body`.
23. Confirm `Drawer height` defaults to `100%` and matches the current expected drawer layout.
24. Change `Drawer height` to `70%` and confirm the drawer visibly becomes shorter.
25. Confirm changing `Drawer height` does not change the configured top offset.
26. Confirm changing `Drawer height` does not change the configured bottom gap.
27. Click **Restore all defaults** and confirm the full NestKit settings object resets to defaults.
28. After restoring all defaults, confirm the top controls return to the expected default offset and Windows titlebar clicks still work.
29. Confirm the BRAT-installed `0.1.0` release in another vault is unaffected by this feature branch work.
30. Confirm the first load default language is Simplified Chinese.
31. Switch between Simplified Chinese and English and confirm the settings tab refreshes immediately.
32. Confirm slider values do not change when the interface language changes.
33. Confirm the drawer open or pinned state does not change when the interface language changes.
34. Confirm the pin button tooltip and `aria-label` switch to the selected language after refresh.
35. Restart Obsidian and confirm the chosen interface language persists.
36. Turn on **Remember pinned state**, pin the drawer, restart Obsidian, and confirm the pinned state is restored.
37. Turn on **Remember pinned state**, close the right sidebar, reopen it, and confirm the pinned state is restored.
38. Turn on **Remember pinned state**, disable the plugin, re-enable it, and confirm the pinned state is restored.
39. Turn off **Remember pinned state** and confirm the current pinned state is cleared immediately.
40. After turning off **Remember pinned state**, restart Obsidian and confirm the pinned state is not restored.
41. Leave **Remember pinned state** off, pin the drawer, and confirm the drawer stays temporarily pinned for the current session.
42. With **Remember pinned state** still off, move the pointer away and confirm the temporarily pinned drawer stays open.
43. With **Remember pinned state** still off, close the right sidebar, reopen it, and confirm the temporary pinned state is not restored.
44. With **Remember pinned state** still off, restart Obsidian and confirm the temporary pinned state is not restored.
45. Turn off **Show pin button** and confirm the current pinned state is cleared immediately.
46. Click each slider reset icon and confirm it restores only that setting to its default value.
47. Confirm a single-setting reset does not change language, toggles, pinned state, or any other slider value.
48. Confirm the `Drawer height` reset icon restores only `Drawer height` to `100%`.
49. Click **Restore all defaults** and confirm the interface language returns to Simplified Chinese.
50. Click **Restore all defaults** and confirm the drawer becomes disabled.
51. Click **Restore all defaults** and confirm the pin button toggle returns to enabled.
52. Click **Restore all defaults** and confirm **Remember pinned state** returns to disabled.
53. Click **Restore all defaults** and confirm `rightSidebarPinned` returns to false.
54. Click **Restore all defaults** and confirm `Drawer height` returns to `100%`.
55. Click **Restore all defaults** and confirm the top control offset returns to `110px`.
56. With the `110px` default applied, confirm the first top control group does not overlap the Windows titlebar buttons.
57. Confirm Windows minimize, maximize, and close remain clickable with the `110px` default.
