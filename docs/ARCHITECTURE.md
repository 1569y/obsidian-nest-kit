# NestKit architecture

## Overview

NestKit `0.1.0` keeps the plugin entry point small and routes the right sidebar hover drawer into a dedicated feature module.

## Modules

- `src/main.ts`: plugin lifecycle, settings loading, settings persistence, and feature enable or disable
- `src/settings.ts`: `NestKitSettings`, defaults, and the classic `PluginSettingTab` UI
- `src/core/feature-module.ts`: shared module lifecycle contract
- `src/features/right-sidebar-drawer/index.ts`: feature lifecycle, workspace refresh logic, observer setup, and cleanup
- `src/features/right-sidebar-drawer/pin-button.ts`: pin button creation, icon updates, aria state, and click behavior
- `src/features/right-sidebar-drawer/selectors.ts`: central selector and class constants for the feature

## Runtime behavior

1. The plugin loads persisted settings and merges them with defaults.
2. `RightSidebarDrawerFeature` is created once during `onload`.
3. Enabling the drawer adds the namespacing body class and refreshes the feature against the current workspace layout.
4. Layout changes trigger a debounced refresh.
5. A scoped `MutationObserver` watches the right split subtree only when the feature is active.
6. Disabling the feature removes the body class, pin button, observer, timer state, and pinned workspace class.

## Styling strategy

- `right-sidebar-hover.css` remains the audited reference source.
- `right-sidebar-hover.backup.css` remains the untouched backup copy.
- `styles.css` is the only stylesheet Obsidian loads for the plugin.
- All drawer rules are scoped behind `body.nest-kit-sidebar-drawer-enabled:not(.is-mobile)` so the default Obsidian layout is restored when the feature is off.
