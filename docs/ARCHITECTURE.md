# NestKit architecture

## Overview

NestKit keeps the plugin entry point small and routes the right sidebar hover drawer into a dedicated feature module. The current customization branch adds live CSS variable synchronization so drawer behaviour and positioning changes apply without reloading the plugin.

## Modules

- `src/main.ts`: plugin lifecycle, settings loading, settings persistence, remember-pinned handling, and feature enable or disable
- `src/settings.ts`: `NestKitSettings`, defaults, classic `PluginSettingTab` UI, grouped sliders, per-slider reset buttons, restore-all-defaults, and the language dropdown
- `src/i18n/index.ts` and `src/i18n/locales/*`: lightweight local TypeScript dictionaries for Simplified Chinese and English
- `src/core/feature-module.ts`: shared module lifecycle contract
- `src/features/right-sidebar-drawer/index.ts`: feature lifecycle, workspace refresh logic, CSS variable application and cleanup, observer setup, and teardown
- `src/features/right-sidebar-drawer/pin-button.ts`: pin button creation, icon updates, aria state, and click behavior
- `src/features/right-sidebar-drawer/selectors.ts`: central selector and class constants for the feature

## Runtime behavior

1. The plugin loads persisted settings and merges them with defaults.
2. `RightSidebarDrawerFeature` is created once during `onload`.
3. Enabling the drawer adds the namespacing body class, applies NestKit-owned CSS variables to `document.body`, and refreshes the feature against the current workspace layout.
4. Settings updates save immediately and then call `feature.refresh()` so CSS variables, pin labels, and DOM state update without reloading the plugin.
5. Layout changes trigger a debounced refresh.
6. A scoped `MutationObserver` watches the right split subtree only when the feature is active.
7. Runtime pinned state is driven only by the workspace class `nest-kit-sidebar-pinned`, so the pin button can always keep the drawer open for the current session even when persistence is off.
8. Persistent pinned restore uses the dedicated `rightSidebarPinned` setting and only applies when **Remember pinned state** is enabled and the right sidebar is opened again.
9. Ordinary refresh work such as slider updates, language changes, tooltip updates, or CSS variable sync must not overwrite the current runtime pinned state.
10. Disabling the feature or unloading the plugin removes the body class, pin button, observer, timer state, runtime pinned class, and NestKit-owned CSS variables without erasing the stored pinned preference.
11. Turning off **Remember pinned state**, hiding the pin button, or restoring all defaults clears the stored pinned preference and immediately removes the runtime pinned state.

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
