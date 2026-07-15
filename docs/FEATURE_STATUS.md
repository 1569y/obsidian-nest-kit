# NestKit feature status

This document is the quickest status snapshot for NestKit feature work. It records what is already released, what is being documented for future feature work, and what remains future architecture direction.

## Snapshot

| Feature | Status | Version / phase | Summary | Next step |
| --- | --- | --- | --- | --- |
| `right-sidebar-drawer` | released | released module on the current `0.4.0` line | Desktop-only right sidebar hover drawer with settings, pinning, positioning, live CSS updates, and bilingual UI support | Keep stable while later independent modules are added around it |
| `spaced-review` | released | released module on the current `0.4.0` line | Review task creation, overview, lightweight management, Daily Note sync, and related workflow polish are already shipped | Continue with incremental polish and keep it decoupled from unrelated future modules |
| `heading-progress` | released | released in `0.4.0` as Phase 1A status bar MVP | Independent status bar module for showing line-based progress inside the current top-level heading block of the active Markdown editor, with default-off startup behavior, dual source modes, multiple display modes, and no vault-wide scan | Keep the released MVP stable, validate startup impact in real use, and decide later whether to widen presentation or release scope |
| `reward-reader` | in development | Phase 3B1 detached study-exchange persistence runtime on the current branch | Optional study-to-unlock novel reading module with a default-off feature shell, detached import pipeline, a pure study-minute exchange engine, and now a detached async runtime that validates explicit study requests, rereads current state safely, and persists one study exchange attempt | Add study-record UI and later reader-facing surfaces on top of the detached runtime without broadening startup work |
| `workspace-panel-system` | future | future architecture | Stable registry-facing umbrella concept for broader toolbox surfaces beyond the currently released modules | Define when a real shared panel system is needed instead of keeping features independent |
| `dock-router` | future | future architecture | Placeholder concept for routing future docked surfaces without coupling them to the current right sidebar drawer | Clarify actual navigation and placement needs before designing APIs or settings |
| `floating-drawer` | future | future architecture | Placeholder concept for a future floating surface separate from the released right sidebar drawer | Re-evaluate only after clearer workspace-surface requirements exist |

## Released modules

### right-sidebar-drawer

- Status: released
- Version / phase: released module on the current `0.4.0` line
- Summary: This is the original NestKit surface and remains the active workspace customization module. It provides the desktop right sidebar hover drawer, pinning behavior, positioning controls, and related settings polish.
- Next step: Maintain stability and avoid unnecessary behavior churn while other planned modules mature independently.

### spaced-review

- Status: released
- Version / phase: released module on the current `0.4.0` line
- Summary: Spaced Review is already a shipped independent feature area. The current docs and architecture notes cover task creation, overview flows, lightweight management actions, Daily Note sync, and follow-up polish around those surfaces.
- Next step: Continue small, scoped improvements without turning it into a dependency for unrelated modules such as Heading Progress or future workspace-surface work.

## Released in 0.4.0

### heading-progress

- Status: released
- Version / phase: released in `0.4.0` as Phase 1A status bar MVP
- Summary: Heading Progress is now a released independent module. It stays separate from Spaced Review and the right sidebar drawer, remains disabled by default, shows progress inside the current top-level heading section, supports `viewport-center` and `cursor-position` source modes, supports `bar + percent`, `percent only`, and `bar only` display modes, reads only the active Markdown editor, and does not perform any vault-wide scan.
- Next step: Keep the released MVP stable, validate startup impact in real vault use, and if more reading or editor-assist features arrive later, decide whether to keep extending the dedicated tab or regroup those tools under a broader `Reading aids` or `Editor aids` area.

## Planned future feature modules

### reward-reader

- Status: in development
- Version / phase: Phase 3B1 detached study-exchange persistence runtime on the current branch
- Summary: Reward Reader now includes the earlier Phase 1A foundation, Phase 2A parser, Phase 2B1 Vault source inspection/cache assembly, Phase 2B2 import preparation, Phase 2B3 in-memory store application, Phase 2C1 read-only adapter, Phase 2C2 single-file writer, Phase 2C3 cache-first persistence orchestration, Phase 2D1 detached import runtime, Phase 2D2 minimal import command and modal, the detached Phase 3A study-minute exchange engine, and now a detached Phase 3B1 study-exchange persistence runtime. Imported novels still begin with zero unlocked chapters. The new runtime accepts only one explicit study request with caller-owned ids, timestamp, content, minute credit, and policy; validates that request before any IO; reads current state once to resolve the target novel and its persisted cache identity; reads exactly one target chapter cache; rereads the latest state before applying the Phase 3A engine; aborts if the target novel changed between reads; attempts exactly one state write; preserves structured read and write statuses; and keeps unexpected failures sanitized behind a no-throw runtime boundary. It still does not add a study-record command or modal, does not generate ids or timestamps, does not read source text, does not write chapter caches, does not retry, does not read back state after write, does not roll back, does not add locking or CAS, does not open the reader, does not add the sidebar or status bar, does not add automatic timers, does not update reading progress, and does not provide cache repair or cross-device conflict handling.
- Next step: Add the first study-record command or modal above the detached runtime, then keep the same persistence boundary while later reader UI and interaction work are layered on separately. Detailed planning now lives in `docs/REWARD_READER_PLAN.md`.

## Future architecture directions

### workspace-panel-system

- Status: future
- Version / phase: future architecture
- Summary: This is the broader toolbox direction behind NestKit's feature registry naming. It represents a possible shared system for future workspace surfaces, not a released end-user feature today.
- Next step: Keep this as architecture vocabulary until a concrete cross-feature panel need justifies implementation.

### dock-router

- Status: future
- Version / phase: future architecture
- Summary: Dock Router is a placeholder concept for future placement and routing logic across docked UI surfaces. It is not implemented and should not be mistaken for a current user-facing module.
- Next step: Revisit only if multiple docked surfaces need a common routing layer.

### floating-drawer

- Status: future
- Version / phase: future architecture
- Summary: Floating Drawer is a placeholder idea for a future floating workspace surface separate from the current released right sidebar drawer.
- Next step: Leave this in roadmap status until real usage requirements make it more concrete than a naming placeholder.
