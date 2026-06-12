# NestKit test plan

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
