# Migration notes

- `right-sidebar-hover.css` is the user-provided, validated reference source and should remain unchanged.
- `right-sidebar-hover.backup.css` is the untouched backup of the original reference file.
- `styles.css` is the stylesheet the plugin actually loads.
- The current root `.workspace-tabs` DOM does not guarantee `.mod-top-left-space`.
- The top control selector is intentionally widened to `.workspace-split.mod-root > .workspace-tabs.mod-top` while keeping the direct-child scope.
- Top control offset must remain transform-based and must not switch to `margin-right`.
- Pinned state now always uses the `pin` icon and relies on the active color state instead of `pin-off`.
- The Windows titlebar click fix was retained after A/B testing `spacerOnly` against `spacerPlusRootHeader`.
- `spacerOnly` was not sufficient on its own.
- The root header container no-drag rule must remain alongside the spacer fix.
- During manual plugin testing, disable the legacy CSS snippet so the snippet and plugin stylesheet are not loaded at the same time.
