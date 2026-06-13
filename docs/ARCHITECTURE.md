# NestKit architecture

## Overview

NestKit is evolving from a single-purpose right sidebar customization into a modular Obsidian toolbox. The current phase keeps the published `0.2.0` drawer behavior unchanged while adding the first safe settings-migration layer: a top-level `schemaVersion`, schema-aware normalization, and a future-proof boundary for later multi-feature settings work.

## Modules

- `src/main.ts`: plugin lifecycle, settings loading, settings persistence, remember-pinned handling, feature registration, and feature-state synchronization
- `src/settings.ts`: `NestKitSettings`, `CURRENT_SETTINGS_SCHEMA_VERSION`, defaults, shared numeric slider limits, classic `PluginSettingTab` UI, grouped sliders, per-slider reset buttons, restore-all-defaults, and the language dropdown
- `src/i18n/index.ts` and `src/i18n/locales/*`: lightweight local TypeScript dictionaries for Simplified Chinese and English
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
- Phase 1 does not modify `main.ts`, `FeatureRegistry`, `FeatureManager`, settings UI, i18n, or the existing workspace panel system.
- Phase 1 does not register commands, modals, Vault listeners, Daily Note sync, checkbox sync, or any plugin startup behavior.
- Spaced Review tasks are designed to stay independent from the workspace panel system, even if a later workspace panel card links into review data.
- The planned store root is `.nestkit/spaced-review/tasks.json`.
- The Spaced Review store has its own `schemaVersion = 1`, separate from the plugin settings schema.
- Reading a missing `.nestkit/spaced-review/tasks.json` returns a default runtime store without immediately creating the file.
- Invalid Spaced Review store JSON falls back to a default runtime store but must not be auto-overwritten by older code paths.
- The store read result now exposes `didNormalize`, `shouldPersist`, and `hasUnsupportedFutureVersion` so a later integration layer can decide whether it is safe to write back.
- Older plugin versions may read known fields from a future Spaced Review store schema for runtime safety, but they must not persist that downgraded view when `shouldPersist = false`.
- Future integration code must respect `shouldPersist` before calling the explicit `writeSpacedReviewStore(...)` API.
- `ReviewTask.startDate` means the learning-complete date or task baseline date, not the first review date.
- `ReviewTask.intervalsSnapshot` stores cumulative offsets from `startDate` and is the canonical schedule source for each task.
- Built-in presets are only templates for new tasks; existing tasks must continue to use their own stored `intervalsSnapshot`.
- Scheduling uses strict date-only `YYYY-MM-DD` strings and calendar-day math instead of millisecond deltas or `moment`.
- `ReviewOccurrence` remains a runtime-derived object in Phase 1 and is not persisted as a full list in the store.

## Transition constraints

- This phase introduces no user-visible behavior changes.
- This phase introduces the first settings schema change, but keeps the current flat keys and settings UI unchanged.
- The manager intentionally performs lazy first-use instantiation so disabled features do not create instances at plugin startup.
- Already-created instances are intentionally kept alive after disable, but disabled instances now remain inert instead of keeping an always-registered guarded `layout-change` listener alive for the rest of the session.
- The feature now owns its activation-scoped listener lifecycle directly and invalidates stale `onLayoutReady(...)` callbacks with an activation generation guard instead of trying to cancel them.
- Future multi-feature settings namespaces are intentionally postponed until a later dedicated migration phase.

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
