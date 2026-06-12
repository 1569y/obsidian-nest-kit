# NestKit architecture

## Overview

NestKit is evolving from a single-purpose right sidebar customization into a modular Obsidian toolbox. The current phase keeps the published `0.2.0` drawer behavior unchanged while introducing the smallest possible toolbox core: a `FeatureRegistry`, a `FeatureManager`, and a stable feature id for the existing workspace panel behavior.

## Modules

- `src/main.ts`: plugin lifecycle, settings loading, settings persistence, remember-pinned handling, feature registration, and feature-state synchronization
- `src/settings.ts`: `NestKitSettings`, defaults, classic `PluginSettingTab` UI, grouped sliders, per-slider reset buttons, restore-all-defaults, and the language dropdown
- `src/i18n/index.ts` and `src/i18n/locales/*`: lightweight local TypeScript dictionaries for Simplified Chinese and English
- `src/core/feature-module.ts`: shared module lifecycle contract and registration shape
- `src/core/feature-registry.ts`: lightweight feature registration store with duplicate-id protection and stable ordering
- `src/core/feature-manager.ts`: lazy feature instantiation, settings-driven enable or disable, instance lookup, and unload cleanup
- `src/features/right-sidebar-drawer/index.ts`: feature lifecycle, workspace refresh logic, CSS variable application and cleanup, observer setup, and teardown
- `src/features/right-sidebar-drawer/pin-button.ts`: pin button creation, icon updates, aria state, and click behavior
- `src/features/right-sidebar-drawer/selectors.ts`: central selector and class constants for the feature

## Current registration

- Stable feature id: `workspace-panel-system`
- Current source directory: `src/features/right-sidebar-drawer/`
- Current runtime implementation class: `RightSidebarDrawerFeature`
- Current enable selector: `settings.rightSidebarDrawerEnabled`

The stable feature id is now future-facing and already reflects the intended top-level toolbox concept, even though the source folder remains `right-sidebar-drawer` during this phase.

## Runtime behavior

1. The plugin loads persisted settings and merges them with defaults.
2. `main.ts` registers the workspace panel feature with the `FeatureRegistry` through the stable id `workspace-panel-system`.
3. `FeatureManager.sync(settings)` creates a feature instance only when its settings selector first evaluates to enabled.
4. On first enable, `RightSidebarDrawerFeature` is created once, enabled, and then reused for later toggles during the same plugin session.
5. Disabling the feature calls `disable()` and removes UI side effects, but the created instance is intentionally retained for later reuse.
6. Settings updates save immediately and then re-sync feature state so CSS variables, pin labels, and DOM state update without reloading the plugin.
7. Layout changes trigger a debounced refresh.
8. A scoped `MutationObserver` watches the right split subtree only when the feature is active.
9. Runtime pinned state is driven only by the workspace class `nest-kit-sidebar-pinned`, so the pin button can always keep the drawer open for the current session even when persistence is off.
10. Persistent pinned restore uses the dedicated `rightSidebarPinned` setting and only applies when **Remember pinned state** is enabled and the right sidebar is opened again.
11. Ordinary refresh work such as slider updates, language changes, tooltip updates, or CSS variable sync must not overwrite the current runtime pinned state.
12. Disabling the feature or unloading the plugin removes the body class, pin button, observer, timer state, runtime pinned class, and NestKit-owned CSS variables without erasing the stored pinned preference.
13. Turning off **Remember pinned state**, hiding the pin button, or restoring all defaults clears the stored pinned preference and immediately removes the runtime pinned state.

## Transition constraints

- This phase introduces no user-visible behavior changes.
- This phase introduces no settings schema changes.
- The manager intentionally performs lazy first-use instantiation so disabled features do not create instances at plugin startup.
- Already-created instances are intentionally kept alive after disable to avoid duplicate listener registration from the current constructor-based listener setup.
- The remaining guarded listener lifetime inside `RightSidebarDrawerFeature` is a known technical debt for the next phase; this phase does not attempt a component-scope rewrite.

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
