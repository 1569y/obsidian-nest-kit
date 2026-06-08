# NestKit test plan

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
