# NestKit architecture

## Overview

NestKit is evolving from a single-purpose right sidebar customization into a modular Obsidian toolbox. The current phase keeps the published `0.2.0` drawer behavior unchanged while adding the first safe settings-migration layer: a top-level `schemaVersion`, schema-aware normalization, and a future-proof boundary for later multi-feature settings work.

## Modules

- `src/main.ts`: plugin lifecycle, settings loading, settings persistence, remember-pinned handling, feature registration, and feature-state synchronization
- `src/settings.ts`: `NestKitSettings`, `CURRENT_SETTINGS_SCHEMA_VERSION`, defaults, shared numeric slider limits, tabbed `PluginSettingTab` UI, top-right actions, grouped sliders, per-slider reset buttons, restore-all-defaults, and the language switch
- `src/i18n/*`: lightweight local TypeScript dictionaries and lookup helpers for Simplified Chinese and English
- `src/core/feature-module.ts`: shared module lifecycle contract and registration shape
- `src/core/feature-registry.ts`: lightweight feature registration store with duplicate-id protection and stable ordering
- `src/core/feature-manager.ts`: lazy feature instantiation, settings-driven enable or disable, instance lookup, and unload cleanup
- `src/core/settings-migration.ts`: settings schema parsing, field-by-field normalization, legacy schema `0` migration, and future-schema protection
- `src/features/right-sidebar-drawer/index.ts`: feature lifecycle, workspace refresh logic, CSS variable application and cleanup, observer setup, and teardown
- `src/features/right-sidebar-drawer/pin-button.ts`: pin button creation, icon updates, aria state, and click behavior
- `src/features/right-sidebar-drawer/selectors.ts`: central selector and class constants for the feature
- `src/features/spaced-review/types.ts`: Spaced Review Phase 1 core data model and store schema types
- `src/features/spaced-review/presets.ts`: built-in review presets and default preset lookup
- `src/features/spaced-review/intervals.ts`: interval parsing and validation for cumulative review offsets
- `src/features/spaced-review/dates.ts`: strict `YYYY-MM-DD` date-only helpers
- `src/features/spaced-review/schedule.ts`: fixed-timeline, rolling-timeline, carry-over, skip, and task completion scheduling logic
- `src/features/spaced-review/store.ts`: storage adapter boundary plus store normalization, read, write, and task upsert or removal helpers
- `src/features/spaced-review/index.ts`: Phase 2 feature module, enable state, and task-creation entrypoint
- `src/features/spaced-review/commands.ts`: command registration and enabled or disabled command flow
- `src/features/spaced-review/create-task-modal.ts`: create-task modal UI and validation flow
- `src/features/spaced-review/overview-model.ts`: pure read-only overview derivation from the normalized store
- `src/features/spaced-review/overview-modal.ts`: read-only overview modal UI and refresh flow
- `src/features/spaced-review/vault-storage-adapter.ts`: Obsidian Vault adapter for the Spaced Review store boundary
- `src/features/spaced-review/task-factory.ts`: pure task creation and interval selection helpers

## Planned feature modules

### Heading Progress

- Planned stable feature id: `heading-progress`
- Planned source directory: `src/features/heading-progress/`
- Planned responsibility: show the user's current progress inside the active Markdown editor's current top-level heading block through a compact bottom-right status bar item
- Planned first display form: compact status bar text such as `H2 43%` plus a small progress bar
- Planned first tooltip fields: current heading title, heading level, line range, progress source, and exact percentage

Heading Progress is planned as an independent feature module. It does not belong to `right-sidebar-drawer`, does not belong to `spaced-review`, and should not depend on the right sidebar, Daily Note sync, or any vault-wide task or review data.

The planned data boundary is intentionally narrow:

- Read only the current active Markdown editor
- Derive heading structure from the current file content already open in that editor
- Do not scan the whole vault
- Do not read unrelated Markdown files
- Hide the status bar item when the active file has no headings

The planned top-level heading rule is content-driven rather than fixed to `H1`:

- If the file contains `H1`, then `H1` is the top-level heading level
- If the file has no `H1` but contains `H2`, then `H2` is the top-level heading level
- If the file has no `H1` or `H2` but contains `H3`, then `H3` is the top-level heading level
- The same fallback pattern continues to the highest heading level that actually exists in the current file
- The current main block starts at the nearest top-level heading above the current reading or editing position
- The current main block ends before the next heading of that same top-level level
- Lower-level subheadings remain part of that same main block

The planned MVP calculation is line-based only. Documentation for this phase must not imply pixel-based progress is already implemented. Future extensions may add pixel-based or character-based progress later, but they are out of scope for the first implementation target.

The planned progress source is settings-driven:

- `viewport-center`
- `cursor-position`

The recommended default is `viewport-center`.

When this feature is implemented later, it should register through the existing feature registry and remain lifecycle-isolated from the released modules. This planning round documents that intended boundary only; it does not implement registration, settings, or runtime hooks.

## Current registration

- Stable feature id: `workspace-panel-system`
- Current source directory: `src/features/right-sidebar-drawer/`
- Current runtime implementation class: `RightSidebarDrawerFeature`
- Current enable selector: `settings.rightSidebarDrawerEnabled`

The stable feature id is now future-facing and already reflects the intended top-level toolbox concept, even though the source folder remains `right-sidebar-drawer` during this phase.

## Runtime behavior

1. The plugin loads raw persisted settings through `migrateSettings(...)` instead of trusting `loadData()` output directly.
2. `main.ts` registers the workspace panel feature with the `FeatureRegistry` through the stable id `workspace-panel-system`.
3. `FeatureManager.sync(settings)` creates a feature instance only when its settings selector first evaluates to enabled.
4. On first enable, `RightSidebarDrawerFeature` is created once, enabled, and then reused for later toggles during the same plugin session.
5. Phase 2 moves runtime listener scope out of the feature constructor and into `enable()` / `disable()`, so disabled features keep only an inert cached instance.
6. Disabling the feature calls `disable()`, unregisters the activation-scoped `layout-change` `EventRef` through `workspace.offref(...)`, and removes UI side effects while still retaining the created instance for later reuse.
7. `onLayoutReady(...)` still has no cancellation handle, so the feature now guards that callback with an activation generation token before allowing a delayed `refresh()`.
8. The `FeatureManager` cache model remains unchanged: first enable creates the instance lazily, later toggles reuse it, and the manager does not destroy cached feature instances in this phase.
9. Settings updates save immediately and then re-sync feature state so CSS variables, pin labels, and DOM state update without reloading the plugin.
10. Layout changes trigger a debounced refresh only while the feature is active.
11. A scoped `MutationObserver` watches the right split subtree only when the feature is active.
12. Runtime pinned state is driven only by the workspace class `nest-kit-sidebar-pinned`, so the pin button can always keep the drawer open for the current session even when persistence is off.
13. Persistent pinned restore uses the dedicated `rightSidebarPinned` setting and only applies when **Remember pinned state** is enabled and the right sidebar is opened again.
14. Ordinary refresh work such as slider updates, language changes, tooltip updates, or CSS variable sync must not overwrite the current runtime pinned state.
15. Disabling the feature or unloading the plugin removes the body class, pin button, observer, timer state, runtime pinned class, and NestKit-owned CSS variables without erasing the stored pinned preference.
16. Turning off **Remember pinned state**, hiding the pin button, or restoring all defaults clears the stored pinned preference and immediately removes the runtime pinned state.

## Settings schema

- Legacy `0.2.0` settings without `schemaVersion` are treated as schema `0`.
- The current schema is `1`, stored in `settings.schemaVersion`.
- Schema `1` intentionally keeps the existing flat settings keys so runtime logic, settings UI, and feature registration selectors do not need to change in this phase.
- `src/core/settings-migration.ts` validates every known field by type and, for numeric slider-backed settings, by the same `min` / `max` ranges used by the current settings UI.
- Missing fields are filled from `DEFAULT_SETTINGS`.
- Invalid booleans, unknown languages, `NaN`, `Infinity`, and out-of-range numeric values fall back to defaults.
- Unknown fields are dropped from the normalized runtime settings object.
- Unsupported future schema versions are never overwritten by this branch: the plugin reads recognized fields for safe runtime use, logs warnings, keeps `shouldPersist = false`, and enables a session-level settings persistence lock for all later save paths.
- While that persistence lock is active, settings UI changes, pin persistence updates, and **Restore all defaults** still affect the current session runtime state but do not write back to `data.json`.
- A future nested feature namespace remains deferred to schema `2` or later.
- Spaced Review is planned as a separate feature module, but this phase intentionally adds no Spaced Review settings keys or placeholder namespaces.

## Spaced Review Phase 1

- Planned stable feature id: `spaced-review`
- Phase 1 intentionally implements only pure core modules and does not register the feature yet.
- Phase 2 registers the stable feature id `spaced-review` after `workspace-panel-system`, but still keeps the feature separate from the workspace panel system.
- Phase 1 does not modify `main.ts`, `FeatureRegistry`, `FeatureManager`, settings UI, i18n, or the existing workspace panel system.
- Phase 2 adds a settings-controlled feature module, a command, a modal, and Vault-backed store writes for task creation only.
- Phase 3A adds a separate read-only overview command and modal that read the store only when the user actively opens the overview.
- Phase 3B adds minimal complete and skip write actions for actionable `Today` cards only, routed through feature-level overview write entrypoints instead of changing the scheduling or store schema layers.
- This semantic-fix round keeps `presetId` and `intervalsSnapshot` unchanged, and derives custom overview labels by comparing `intervalsSnapshot` with the selected built-in preset intervals.
- When the snapshot differs from the selected built-in preset, the overview displays a localized custom label such as `Custom: 1 \u00b7 3 \u00b7 7` instead of a misleading built-in preset name.
- Duplicate review-task titles are blocked at the feature layer for all non-archived tasks; modal validation is only a UI convenience layer.
- Phase 3D scopes that duplicate-title rule to normalized `groupPath` rather than enforcing one global title namespace across every active or paused task.
- Phase 2 still does not add Daily Note sync, managed block writes, checkbox sync, context-menu creation, or workspace panel shortcuts.
- Phase 3A still does not write Daily Notes, managed blocks, checkbox state, context menus, or workspace panel task cards.
- Phase 3B still does not write Daily Notes, managed blocks, checkbox state, context menus, or workspace panel task cards.
- The Phase 3A overview modal now prefers a compact habit-style card layout plus a fixed 7-day week strip so the same information density can later be reused in narrower surfaces such as a right sidebar.
- Spaced Review tasks are designed to stay independent from the workspace panel system, even if a later workspace panel card links into review data.
- The planned store root is `.nestkit/spaced-review/tasks.json`.
- The Spaced Review store has its own `schemaVersion = 4`, separate from the plugin settings schema.
- Reading a missing `.nestkit/spaced-review/tasks.json` returns a default runtime store without immediately creating the file.
- Invalid Spaced Review store JSON falls back to a default runtime store but must not be auto-overwritten by older code paths.
- The store read result now exposes `didNormalize`, `shouldPersist`, and `hasUnsupportedFutureVersion` so a later integration layer can decide whether it is safe to write back.
- Older plugin versions may read known fields from a future Spaced Review store schema for runtime safety, but they must not persist that downgraded view when `shouldPersist = false`.
- Future integration code must respect `shouldPersist` before calling the explicit `writeSpacedReviewStore(...)` API.
- Phase 2 respects that same protection before creating tasks, so command-driven writes must stop when the current plugin version would otherwise overwrite a newer store schema or a damaged JSON file.
- Phase 3B overview actions reuse the same store safety guard before writing, then apply the existing pure `completeOccurrence(...)` or `skipOccurrence(...)` helpers and persist through `upsertReviewTask(...)` plus `writeSpacedReviewStore(...)`.
- Phase 3D adds an optional `ReviewTask.groupPath?: string[]` field for lightweight task grouping.
- `groupPath[0]` is the top-level group and `groupPath[1]` is the optional subgroup; this first version keeps at most two levels.
- Store normalization trims group labels, collapses internal spaces, removes empty levels, ignores subgroup-only input when no top-level group exists, and drops extra levels beyond the first two.
- `Today` remains action-focused and intentionally ungrouped, while `All tasks` becomes management-focused and groups cards by top-level group plus subgroup.
- `All tasks` sorts tasks inside each subgroup by `createdAt desc`, sorts subgroups by newest contained task, sorts named top-level groups by newest contained task, and keeps the top-level `Ungrouped` section last for stable scanning.
- The `All tasks` group layout is UI-only and does not change scheduling semantics, due or overdue calculations, complete or skip behavior, preset selection, or `intervalsSnapshot`.
- `groupPath` required the store schema bump to `3`, because schema-`2` writers would otherwise normalize unknown fields away and silently drop persisted grouping data.
- Phase 3E adds optional `ReviewTask.note?: string` and optional `ReviewTask.targetLink?: string` as lightweight task-management metadata.
- `note` is normalized as trimmed plain text with normalized `\n` line endings, remains optional in storage, and is rendered as a one-line preview plus modal-local expand or collapse state in `All tasks` and `Archived`.
- `targetLink` is normalized as an optional trimmed Obsidian linktext string, stays plain string storage without a heavy picker or validator, and opens through `app.workspace.openLinkText(...)`.
- The polished create-task modal is now a single continuous form instead of splitting `Note` and `Target link` into a separate heavy advanced card.
- The create-task field order is title, group, subgroup, start date, preset, custom intervals, note, and target link.
- Group and subgroup now use a compact `existing option dropdown + custom add input` pattern. Existing values come from the normalized store, subgroup suggestions depend on the currently selected group, empty subgroup remains allowed, and this round still caps grouping to two levels only.
- Group and subgroup now keep the custom text input hidden until the user explicitly chooses `Add group...` or `Add subgroup...`, so the default create and edit form stays dropdown-first and compact.
- The modal reuses Obsidian `AbstractInputSuggest` for `targetLink` v1, sourcing `app.vault.getMarkdownFiles()` and filling `file.path` through the suggest selection callback only. Heading and block fragments remain manual suffixes so this round avoids a heavier multi-step picker.
- The same modal file now also exposes a minimal edit mode that only changes title, group, subgroup, note, and target link.
- The simplified rollback pass keeps the same field order but further narrows the create modal, removes the initial title autofocus ring, and favors one consistent compact form rhythm over section-like row separation.
- Group and subgroup now use `existing dropdown + optional new name input` rather than a separate add-mode toggle; when the typed value normalizes to an existing option, persistence merges back to that canonical stored label.
- Phase 3E reuses the existing `archived` status as a manual management state rather than introducing a new lifecycle enum or auto-archive rule.
- Archiving and restoring update only task-local metadata such as `status` and `updatedAt`; they do not change scheduling algorithms, interval semantics, `completedSequenceIndexes`, `skippedSequenceIndexes`, or the persisted action-date maps.
- `Today` remains intentionally action-focused and lightweight, so it keeps only title, occurrence metadata, optional open, and complete or skip actions when applicable. It intentionally does not expose edit, archive, or note management.
- `All tasks` and `Archived` are the management surfaces: they show grouping, lightweight open/edit/archive or restore text actions, note preview plus plain-text expansion, manual archive or restore action, compact progress, and the review track.
- The simplification rollback keeps `Today` actions as small pill-style buttons, while `All tasks` and `Archived` keep lightweight text actions.
- The simplification rollback also removes note expansion again, so notes return to one-line preview-only content between the meta row and the review track.
- The follow-up layout pass keeps the same store shape but removes the duplicate managed-card top-right `Next xx` label, so next or current timing is expressed only through the review-track chips.
- Managed `All tasks` and `Archived` cards now use a `left content + fixed right action rail` layout, where the action rail always reserves four vertical slots in the order `Open`, `Edit`, `Expand` or `Collapse`, and `Archive` or `Restore`.
- In create mode, the group dropdown now intentionally starts empty instead of auto-selecting the first existing group, and subgroup controls stay disabled until a valid effective group exists from either the dropdown or the custom group input.
- The compact action rail now favors very narrow fixed-width text actions with an accent underline for enabled states, while disabled states stay visible but faint and un-underlined.
- Disabled action slots stay visible but muted, use explanatory `title` text, and are removed from tab order instead of collapsing the rail height.
- The action rail must not use `1fr` row tracks, because equal-height grid rows stretch the four actions across the whole card height and visually break compact management rhythm.
- The current compact layout instead uses a narrow fixed-width flex column rail on the right and keeps the task body in `minmax(0, 1fr)` on the left so note preview and review-track wrapping stay driven by content rather than by rail stretching.
- Managed rail actions now use a dedicated `rail-action` class instead of reusing the older managed-button classes, so the right rail can avoid pill-button inheritance and theme button chrome.
- The managed-card DOM now keeps a dedicated `task-action-rail > action-slot > rail-action` structure inside the right rail, so slot sizing and button reset stay isolated from older button selectors.
- The overview modal scope hard-resets managed rail actions for computed `margin`, `padding`, `min-height`, border, background, and box-shadow, keeping `Today` pill actions untouched.
- The follow-up spacing-balance polish keeps that same structure but relaxes the managed rail rhythm one more small step with another narrow gap increase, while preserving the same width, grid, and text-action reset.
- Note expansion is restored only for longer notes, using modal-session-local state; short notes and missing notes keep the preview row only and leave the expand slot disabled.
- Group and subgroup headers now rely more on text hierarchy and spacing than pill-like chrome, while the top group-jump chips remain lighter than the main section headers.
- Phase 3E adds an `Archived` top-level overview tab for archived tasks and keeps archived tasks hidden from both `Today` and the default active-task `All tasks` surface.
- Phase 3E also adds lightweight top-level group jump chips in `All tasks`; they reuse the existing grouped overview model and scroll to matching top-group sections without introducing a side outline system or persisted collapsed state.
- The archived view now also shows one short explanatory hint at the top, instead of repeating archive semantics inside each card.
- Later roadmap only: auto-archive rules, richer target-link pickers, multiple related links, side outline navigation, and right-sidebar narrow-view reuse remain deferred.
- `ReviewTask.startDate` means the learning-complete date or task baseline date, not the first review date.
- `ReviewTask.intervalsSnapshot` stores cumulative offsets from `startDate` and is the canonical schedule source for each task.
- Built-in presets are only templates for new tasks; existing tasks must continue to use their own stored `intervalsSnapshot`.
- Fixed timeline preview uses `startDate + cumulative interval offset` directly for each sequence.
- Rolling timeline may derive per-step gaps from those cumulative offsets, but preview dates must accumulate those gaps sequentially from the current rolling anchor.
- Rolling preview must not apply each derived gap independently to the same anchor, or later dates can drift earlier than the cumulative schedule implies.
- Scheduling uses strict date-only `YYYY-MM-DD` strings and calendar-day math instead of millisecond deltas or `moment`.
- `ReviewOccurrence` remains a runtime-derived object in Phase 1 and is not persisted as a full list in the store.
- Phase 2 task creation uses a built-in preset by default, or validated custom cumulative intervals when the modal input is not empty.
- The Phase 2 feature constructor remains side-effect free; enabling the feature does not create `.nestkit`, does not create `tasks.json`, and does not write Daily Notes.

## Settings UI

- The settings page is split into `General`, `Workspace Panel`, `Spaced Review`, and `About` tabs.
- The top-right action group contains **What's New**, **Language**, and **Restore defaults**.
- Only the active tab is rendered; inactive tab content is not created until selected.
- The General tab keeps user-facing Workspace Panel and Spaced Review enable toggles without exposing internal performance wording.
- The Workspace Panel tab keeps the drawer controls and slider groups.
- The Spaced Review tab keeps review settings only and intentionally avoids reading `.nestkit/spaced-review/tasks.json` when the settings page opens.
- The About tab shows local static version and phase 2.5 text without any network requests.
- Opening settings does not create `.nestkit` and does not scan the vault.

## Transition constraints

- This phase introduces no settings schema change.
- This phase updates the settings UI to a tabbed layout while keeping the current flat keys unchanged.
- The manager intentionally performs lazy first-use instantiation so disabled features do not create instances at plugin startup.
- Already-created instances are intentionally kept alive after disable, but disabled instances now remain inert instead of keeping an always-registered guarded `layout-change` listener alive for the rest of the session.
- The feature now owns its activation-scoped listener lifecycle directly and invalidates stale `onLayoutReady(...)` callbacks with an activation generation guard instead of trying to cancel them.
- Future multi-feature settings namespaces are intentionally postponed until a later dedicated migration phase.

## Performance guardrails

- `onload()` still avoids reading `.nestkit/spaced-review/tasks.json`, scanning the vault, or opening modals.
- The Spaced Review store is only touched from user-driven task creation, the read-only overview command, or later review actions.
- The settings page only renders the active tab and does not pre-render the other tabs.
- The What's New action is local static copy only and does not fetch GitHub or any remote changelog.
- The Language action only flips the existing plugin-owned language setting; it does not add a new schema field.
- Restore defaults resets settings only and leaves `tasks.json` and other vault data alone.
- The read-only overview modal does not open during `onload()` or settings rendering, and its refresh action re-reads the store without writing it back.
- The overview keeps `selectedDate` as modal-local state only, so switching dates does not write settings or the review store.
- The previous-week and next-week controls only move the modal-local `selectedDate` by `-7` or `+7` days and then rebuild the same 7-day strip.
- Source-safe overview separators must stay written as `\u00b7` escapes so exported review bundles do not pick up mojibake from literal middle-dot characters.
- The `Today` tab now renders against the current `selectedDate`, keeping overdue items first and selected-date due or planned items second without repeating the selected date as a duplicate top text line.
- Selected-date rendering now uses at most one actionable occurrence per active task, avoiding duplicate cards for the same task on a single date.
- The overview header now keeps Help / Refresh in the title row, adds a lightweight calendar panel above the tabs-and-summary row, visually downgrades those actions, and avoids repeating top today or selected-date text lines.
- The overview title row, calendar controls, date selector, tabs, summary badges, and card content now share a single content-left axis instead of drifting between sections.
- The full date-navigation zone now renders inside one light calendar panel, so the year, month, week placeholders, today-position button, week range, arrows, and day chips read as one grouped control without changing modal width.
- The week strip is still fixed to one 7-day period, but it now renders inside that lightweight calendar panel where clicking a day only changes the modal-local `selectedDate` instead of recentering the visible week.
- Phase 3C upgrades the year, month, and week controls from passive pills into modal-local selector popovers while keeping the calendar button as a local return-to-today shortcut.
- The week navigation bar is intentionally lighter than the cards around it so the selected week range stays readable without dominating the hierarchy.
- The selector popovers are UI-only navigation overlays: they never change store schema, never write scheduling metadata, and close when the user clicks another selector, Help, Refresh, or another area inside the modal.
- The overview now keeps tabs plus summary badges together in one shared row, with `Today` still based on the real current day, `Active` still based on active task count, and `Overdue` now intentionally following the currently selected date.
- The week button label is now computed from the current selected date as `Week N` or `第N周`, using the same existing Sunday-based week-start rule as the overview strip.
- The date selector now uses fixed-size day chips that combine the day number and weekday inside one button, remove month-day text, `Today` text, and inline count badges, keep stable sizing across normal, today, and selected states, and expose due or overdue detail through tooltip text instead of inline count badges.
- The today-only chip state now uses a light accent wash without an added outline, while the selected state uses a deeper accent fill and higher weight; when today is also selected, the selected state wins without adding a second ring.
- The overview header keeps local static refresh and help actions only; the help toggle opens a legend panel and does not fetch or write anything.
- The help toggle now opens a compact popover anchored near the title-row help button instead of inserting explanatory content into the main task flow.
- The help popover is intentionally short and now keeps compact `Date`, `Stats`, and built-in `Presets` guidance, uses accent-colored section titles for quick scanning, avoids implementation-detail wording such as explaining the chip stack order, and no longer relies on large badge or button examples.
- The `Today` cards now stay action-focused, render in a stable two-column grid in the modal, and compress review-number plus planned or original date text onto one metadata line; they intentionally hide preset and carried-to-today wording and do not render a per-card mini week or review track.
- The `Today` cards can jump into `All tasks` with a temporary card highlight, and the modal then scrolls the matching task card into view without writing state back to the store.
- `Today` cards now use a stable two-column grid within the modal content frame, while narrow surfaces can still collapse to one column later.
- Phase 3B adds compact `Complete` and `Skip` buttons only to actionable `Today` cards that are due today or carried overdue; `All tasks` remains summary-only in this first write-enabled pass.
- Phase 3D keeps those `Today` actions unchanged and applies grouping only to the `All tasks` management surface.
- Phase 3B now persists optional `completedDatesBySequenceIndex` and `skippedDatesBySequenceIndex` maps on each `ReviewTask`, keyed by stringified `sequenceIndex` and storing real `YYYY-MM-DD` action dates.
- Completed and skipped track pills now read their visible dates only from those persisted action-date maps; they never fall back to `plannedDate` or rolling preview dates.
- The Phase 3B track now uses a symbol-first status display in visible UI, so the chip row reads as a compact state timeline instead of repeating sequence numbers that are already implied by order and the separate progress summary.
- The visible track glyphs are now normalized to `✓`, `>`, `!`, `●`, and `○` for completed, skipped, overdue, current, and pending or future states.
- `All tasks` shows each task's localized preset label, compact progress, compact next-review text, and a read-only per-task review-track chip row instead of reusing the current-week mini week.
- Review-track chips intentionally keep the review number and planned date inside the same compact chip, with the number emphasized and the date kept inline for narrow cards.
- Visible track chips no longer show sequence numbers, but the underlying `sequenceIndex` still exists as internal identity and remains available through accessibility text.
- In `All tasks`, the current actionable review track chip is intentionally more prominent while future chips stay visually muted, without adding any new write actions.
- This compact-polish round intentionally leaves the `All tasks` review-track rendering and status logic unchanged, except for shared outer spacing alignment.
- Phase 3D keeps the card internals and review-track semantics intact, but wraps those task cards inside lightweight group and subgroup sections for easier scanning at larger task counts.
- In Phase 3B v1, skipped occurrences do not increase progress, last-occurrence completion does not auto-archive the task, and the implementation intentionally avoids optimistic UI.
- The overview keeps a single internal scroll container for both `Today` and `All tasks`; its scrollbar visual is now hidden only within the overview scope so tab switches no longer change the visible right edge or squeeze the calendar panel.
- The top date strip keeps aggregate due and overdue counts, while the compact `Today` cards intentionally avoid extra per-card timeline chrome in this phase.
- A configurable week-start choice such as Sunday versus Monday remains intentionally deferred to a later dedicated settings task and is not part of this Phase 3A polish round.
- The year, month, and week selectors reuse the existing Sunday-based week-start logic directly; this round does not introduce an ISO-week rewrite or a new week-start setting.
- The overview modal neutralizes mouse or programmatic button focus with scoped styles and a non-`focus-visible` blur pass, while preserving keyboard-visible focus cues for accessibility.
- The Spaced Review Overview intentionally hides Obsidian's native modal close button only within the overview modal scope and must not affect the Create Task modal or other Obsidian modals.
- The Overview relies on standard Obsidian modal behavior such as backdrop or outside click and `Esc` to close, which keeps the custom title row, Help, Refresh, Sync note, and calendar controls visually clean without adding a second close control.
- Task-link opening in the overview continues to use `app.workspace.openLinkText(...)` and isolates link clicks from card-level behaviors with scoped `preventDefault()` plus `stopPropagation()` handling where needed.
- Spaced Review startup stays lazy-first: `onload()` only loads settings, registers features, commands, settings UI, ribbon entry points, and one editor-menu listener. It does not read the task store, build the overview model, scan vault Markdown files, or sync Daily Notes.
- Target-link file suggestions remain modal-local. `app.vault.getMarkdownFiles()` is only called when the create or edit modal opens, and the suggestion list is kept only for that modal session.
- Daily Note sync remains user-driven or overview-open-driven only. Plugin startup does not read or rewrite Daily Notes.
- Heading Progress is planned to stay editor-local as well: it should derive progress only from the active Markdown editor state and must not introduce vault-wide scanning, background indexing, or cross-file heading caches.
- Preset display labels now reflect the actual intervals that would be used for new tasks, including an optional leading `0` when the settings toggle enables review-on-creation-day behavior.
- Custom presets are stored only in plugin settings as a textarea string, parsed on demand, and compiled into modal dropdown options at runtime. They do not add a new task-store schema field.
- New tasks may persist a custom preset id such as `custom:...`, but scheduling still relies on the saved `intervalsSnapshot`, so later deleting that settings preset does not break existing tasks.
- The create-task modal initializes group and subgroup combo defaults once per modal session, then preserves in-progress title, group, subgroup, date, note, target-link, and manual-interval state across preset-triggered rerenders.
- The edit-task modal now reuses the same preset and manual-interval controls as create mode, initializing them from the persisted `intervalsSnapshot` instead of forcing the current default preset.
- Edit-mode interval changes update `intervalsSnapshot` immediately after save, while the scheduling algorithm itself remains unchanged and still reads the snapshot as the source of truth.
- If an edited task already has completed or skipped history, the modal shows a confirmation warning before saving interval changes.
- Interval-history reconciliation is bounded to index validity only: completed and skipped sequence indexes that remain within the new interval length are preserved, while out-of-range indexes and matching date-map entries are pruned.
- The edit-task modal now exposes a destructive hard-delete action with confirmation. Deleting a task removes it from the Spaced Review store only, refreshes the overview immediately, and leaves Daily Note content untouched until the next sync.
- Target-link open mode is scoped to plugin-rendered `Open` actions such as Today, All tasks, and Archived; those actions prefer the active Markdown file path as `sourcePath` and fall back to `''`.
- Earlier 3N and 3O experiments tried click interception for Daily Note review links, but that approach is no longer the current runtime behavior.
- The 3P follow-up replaced Daily Note click interception with generated link output: when `spacedReviewDailyNoteLinksUseOpenMode` is disabled, Daily Note review items emit regular Obsidian wiki links; when it is enabled, they emit Obsidian URI Markdown links.
- `paneType=tab` is added only for `newTab` mode, while `current` mode keeps the default `obsidian://open` pane behavior.
- The plugin no longer intercepts native Daily Note wiki-link clicks at runtime.
- Allowing `0` as the first interval is a validation boundary change only. It does not alter fixed-vs-rolling scheduling semantics, store schema, or task occurrence structure.
- Note expansion is intentionally conditional: short notes stay as plain preview text, while only longer notes render a lightweight `Expand` / `Collapse` affordance with modal-session-only state.
- The management action row is intentionally text-first instead of pill-first, so `Open`, `Edit`, `Archive`, and `Restore` remain compact even when they wrap on narrower widths.
- The current overview UI intentionally stops short of a full calendar view; calendar-style scheduling remains deferred to a later module or phase.

## Styling strategy

- `right-sidebar-hover.css` remains the audited reference source.
- `right-sidebar-hover.backup.css` remains the untouched backup copy.
- `styles.css` is the only stylesheet Obsidian loads for the plugin.
- All drawer rules are scoped behind `body.nest-kit-sidebar-drawer-enabled:not(.is-mobile)` so the default Obsidian layout is restored when the feature is off.
- Behaviour, positioning, and advanced tuning values flow through CSS variables with runtime fallbacks that preserve the `0.1.0` defaults.
- The Positioning section includes `Drawer height`, which defaults to `100%`, syncs to CSS as `vh`, and resolves through `min()` so the real height never exceeds the space left by the top offset and bottom gap.
- Every numeric slider includes a compact `rotate-ccw` extra button that restores only that setting to its default value.
- The top control offset default is now `110px`; older vault data is not automatically rewritten, so manual reset is required if a vault still carries the previous `125px` value.
- The validated `no-drag` fix and the strict root selector for top control offset must remain in place.
- UI copy is driven by a local dictionary with `zh-CN` as the default language and `en` as the secondary language.
- Automatic Obsidian-language detection is intentionally not part of the current branch.

## Spaced Review Phase 3F

- Spaced Review settings now live in the existing `Spaced Review` settings tab and remain part of plugin settings, not the task store schema.
- Daily Note sync is command-driven and lightweight: it runs only from the manual command, the optional overview button, once per overview open when `onOverviewOpen` is enabled, or a scoped near-real-time checkbox import for today's Daily Note after a short debounce.
- Daily Note sync writes only inside the vault through the Obsidian `Vault` API and does not rely on the Daily Notes plugin internal API.
- Daily Note sync does not poll in the background, does not scan the vault, and does not listen to arbitrary checkbox state changes.
- The Daily Note path is derived from `spacedReviewDailyNoteFolder` plus `spacedReviewDailyNoteDateFormat`, with unsupported formats falling back to `YYYY-MM-DD`.
- The Daily Note filename format is filename-only; formats that still contain path separators fall back to `YYYY-MM-DD` instead of creating nested folders from the date format itself.
- The Daily Note target area is now configured as a section path rather than a single heading string.
- The section-path setting accepts multiple lines, trims each non-empty line, and maps them to nested headings.
- When the section-path input uses plain text lines, a single line becomes `## heading`, while multiple lines become `# parent`, `## child`, `### grandchild`, and so on.
- When the section-path input already uses explicit Markdown heading syntax such as `# Task` or `## IELTS`, those heading levels are preserved.
- The managed Daily Note section is now heading-only and idempotent, so Live Preview shows only the section heading plus visible checkbox task lines.
- Daily Note upsert now resolves the configured section path one heading level at a time, creates missing child headings inside the matched parent section, and treats the final heading in the path as the managed replace range.
- If no matching section path exists, sync appends one full managed section-path block at the end of the note.
- If multiple same-name headings exist at any resolved level, sync follows only the first matching path and warns the user instead of deleting later sections that may contain user-authored content.
- Daily Note content is sourced from the same actionable `Today` overview items, so archived and future-only tasks are not synced.
- When `spacedReviewDailyNoteLinksUseOpenMode` is disabled, `targetLink` is rendered as an Obsidian wiki link when present; otherwise the plain task title is used.
- When `spacedReviewDailyNoteLinksUseOpenMode` is enabled, the same `targetLink` is rendered as an Obsidian URI Markdown link, and `newTab` mode appends `paneType=tab` while `current` mode does not.
- Daily Note output must not contain mojibake literals; source-safe separators should stay written as `\u2014` and `\u00b7`, and the fallback heading should resolve to readable dictionary or default-settings text.
- Folder creation stays intentionally lightweight in v1: the note file may be created when allowed, but the configured Daily Note folder must already exist and is not auto-created.
- Checked Daily Note items are imported during sync and refresh flows only; they are not live-watched and do not rely on a vault-wide checkbox listener.
- The 0.3.2 hotfix adds one scoped Obsidian `vault.modify` listener through `registerEvent(...)`, but it only reacts when the modified file path is exactly today's configured Daily Note path.
- That near-real-time import path debounces repeated note edits, reuses the existing checked-checkbox import logic, does not call `syncTodayReviewsToDailyNote(...)`, and does not rewrite the Daily Note file.
- If the Spaced Review Overview modal is already open, the same auto-import path refreshes that modal in place through a feature-level callback instead of opening a new overview.
- Checkbox import reuses the existing complete-occurrence semantics through the feature layer instead of writing custom completion state directly.
- Daily Note output no longer generates START or END comment markers, metadata comment blocks, or hidden per-line identity markers.
- Checkbox import now normalizes checked task lines back to unchecked visible text, tries a unique clean-line text match against freshly rebuilt Today items first, and falls back to the same managed line index only when needed.
- If checked lines are present but none can be matched back to a current Today item, sync stops before rewrite and leaves the Daily Note unchanged so user-checked `[x]` lines are not silently overwritten.
- Because positional fallback still depends on managed line order, users should not manually reorder lines inside the managed Daily Note section.
- Spaced Review ribbon buttons are optional plugin-settings-driven entry points and are re-registered from plugin settings rather than hard-coded as always visible.
- The Markdown editor context-menu entry is optional, limited to Markdown editor surfaces, and exposes a single clearer `Add to spaced review` action that opens the existing create modal with lightweight prefilled values only.
- All tasks and Archived cards now keep a structurally present note row even when no note exists, while Today cards remain intentionally note-free.
