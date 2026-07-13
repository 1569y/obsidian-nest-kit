# Reward Reader plan

`Reward Reader` (`小说解锁阅读`) is a future optional NestKit module for turning study time into controlled novel-reading access. The goal is not DRM or hard anti-bypass protection. The goal is a self-managed reading boundary that makes it easier to stop after the currently unlocked content has been consumed.

This document records the current feature idea, the intended module boundaries, a phased delivery plan, and the technical questions that still need confirmation before implementation begins.

## Goal

- Let the user record completed study sessions and study duration.
- Convert accumulated study minutes into unlocked novel chapters by a user-defined exchange rule.
- Keep unread but unlocked inventory explicit, instead of allowing endless passive scrolling.
- Preserve a clean separation between reading progress and unlock progress.
- Keep the module optional, default-off, and independent from existing NestKit features.

Default exchange rule:

- `30` study minutes unlock `1` chapter.
- Partial time that does not yet complete a conversion stays in balance and carries forward.

User-configurable examples:

- `20` minutes unlock `1` chapter
- `30` minutes unlock `1` chapter
- `60` minutes unlock `2` chapters

## Module position inside NestKit

Reward Reader should be implemented as an internal NestKit feature module, not as a separate plugin.

Confirmed Phase 1A decisions:

- Stable feature id: `reward-reader`
- Source directory: `src/features/reward-reader/`
- Enable selector: `settings.enableRewardReader`
- Default state: disabled
- Runtime rule: register commands, views, status-bar UI, and listeners only when the feature is enabled
- Startup rule: avoid vault-wide scans and avoid continuously rescanning novel files during plugin startup
- Integration rule: keep the first version independent, but leave future room for links to timers, DailyNest, and Daily Note workflows
- Phase 1A scope: add only the feature shell, foundational settings, pure data types, and pure store normalization
- Phase 1A persistence rule: do not create `.nestkit/reward-reader`, do not write `state.json`, and do not write chapter-index cache files yet

Confirmed Phase 1A hardening decisions:

- Novel ids and record ids must stay within a conservative safe-id boundary: ASCII letters, digits, `_`, and `-`, with no spaces, dots, slashes, or path separators
- `getRewardReaderChapterIndexCachePath(...)` must validate ids defensively instead of assuming earlier normalization already succeeded
- Invalid or incomplete chapter-index caches now normalize to `null` and require a rebuild, instead of returning a placeholder cache with empty identity fields
- Chapter indexes must keep non-overlapping offsets, continuous `chapterIndex` values starting at `0`, and a shared text-offset unit
- Reward Reader numeric exchange and cap settings remain in the same ranges as Phase 1A foundation, but must now also be integers during settings migration
- Progress normalization now rejects contradictory cross-field states instead of guessing repairs
- Unlock records must reference a retained study record for the same novel before they are kept

Confirmed Phase 1A final-boundary decisions:

- `sourceSize` remains the source-file byte size only, intended for future cache invalidation and change detection
- Chapter cache metadata now also includes `sourceTextLength`, meaning JavaScript `sourceText.length` in UTF-16 code units
- `startOffset` and `endOffset` use the same UTF-16 code-unit unit as `String.slice(...)`
- Chapter-offset upper bounds now validate against `sourceTextLength`, not against `sourceSize`
- `sourceTextLength = 0` allows only an empty `chapters` list, while `sourceTextLength > 0` still allows `chapters = []`
- Missing `chapters`, non-array `chapters`, or any invalid chapter entry makes the whole cache rebuild-required instead of keeping a partial cache
- A damaged root Reward Reader store now falls back to an empty runtime default with `shouldPersist = false`, so older code does not auto-overwrite an unreadable source file
- Reading history is now intentionally low-frequency only: MVP reading records keep `opened` and `marked-read`, while scroll position lives only in mutable progress state

Confirmed Phase 2A parser decisions:

- Phase 2A adds only a detached pure chapter parser and does not add Vault file reading, import UI, cache persistence, exchange logic, or reader UI
- Parser input is one complete source string already in memory
- Parser output is a `RewardReaderChapterIndexEntry[]` plus lightweight parse metadata and warnings
- Parser offsets must stay in the original JavaScript UTF-16 string coordinate space and must work directly with `sourceText.slice(...)`
- Parser ignores leading preface text before the first detected chapter instead of inventing a synthetic chapter `0`
- Parser uses built-in heading rules only in this phase; custom regex configuration stays deferred
- Parser does not validate whether chapter numbers are continuous, unique, or semantically correct; internal `chapterIndex` is always reassigned from textual appearance order

Confirmed Phase 2B1 Vault source boundary decisions:

- Phase 2B1 adds only a detached Vault-local source inspection boundary plus a pure in-memory chapter-cache builder
- Vault-local inspection supports only one explicit TXT or Markdown file path per call and does not scan the vault
- Source inspection uses `vault.read(file)` exactly once per successful read path and does not use `cachedRead`
- Unsupported extensions are rejected from the normalized Vault-relative path before any Vault lookup or `vault.read`
- Inspection results do not return `sourceText` and do not keep chapter body copies
- Phase 2B1 still does not create `RewardReaderNovel`, does not register imported novels into state, does not write chapter-index cache files, and does not create `.nestkit`
- The pure builder validates cheap metadata first; invalid metadata returns `cache = null` and `parseResult = null` without scanning the full source text
- Files with no detected chapters fail inspection instead of being wrapped into an empty or synthetic cache
- `vault.read(...)` failures now return one stable generic user-facing message instead of surfacing raw adapter or path details
- Chapter-index assembly failures now stay separate from source-read failures so later import UI can react to them differently
- Leading preface content still only produces warnings and does not become part of the first chapter in this phase
- MB-scale Vault-local novels should be accepted as long as one explicit read plus one linear parse can complete; no low hard size cap is introduced in this phase

Confirmed Phase 2B2 import-assembly decisions:

- Phase 2B2 adds only a detached pure import-preparation layer and still does not add import action runtime, import modal, file picker, state persistence, or chapter-index persistence
- Input is a normalized existing Reward Reader store, one successful source-inspection result, an explicit title, an explicit `preparedAt` timestamp, and a `makePrimary` flag
- Output is only one prepared payload containing one `RewardReaderNovel`, one initial `RewardReaderNovelProgress`, the existing in-memory chapter-cache reference, and `primaryNovelIdAfterImport`
- Phase 2B2 must not return `sourceText`, must not return chapter body copies, and must not return a full copied `nextStore`
- The prepared payload reuses `inspection.cache` directly instead of deep-cloning the cache or the chapters array
- The first imported novel becomes primary automatically even when `makePrimary = false`
- Import preparation starts every novel with fully locked progress: no free first chapter, no reading history, no unlock history, and no study history
- Duplicate novel ids, duplicate registered source paths, and orphan conflicting progress entries all block preparation before any payload is returned
- Phase 2B2 validates that the successful source-inspection result is still self-consistent before trusting it for payload assembly
- Malformed runtime `inspection` input must return structured `inconsistent-inspection` failure instead of throwing before validation completes
- `makePrimary` must stay an explicit runtime boolean and must not use truthy coercion such as `Boolean(...)`, `0/1`, or string forms
- Phase 2B2 keeps inspection consistency lightweight by checking that the first chapter starts at `ignoredPrefixLength` and the last chapter ends exactly at `sourceTextLength`
- Phase 2B2 does not call `new Date()`, `Date.now()`, Vault APIs, storage adapters, or any runtime UI surface

Confirmed Phase 2B3 store-patch application decisions:

- Phase 2B3 adds only a detached pure in-memory store application layer and still does not add import action runtime, import modal, file picker, state persistence, chapter-index persistence, or `.nestkit` creation
- Input is the current Reward Reader store plus a successful prepared import result from Phase 2B2
- The application layer defensively validates the current store, validates the prepared payload, and rechecks duplicate novel id, duplicate source path, and conflicting progress against the current store before applying anything
- The prepared `primaryNovelIdAfterImport` must still be valid for the current store state: the first novel must become primary, an existing non-null primary may only stay unchanged or switch to the new novel, and a current `null` primary may only stay `null` or switch to the new novel
- The success result returns a new in-memory `nextStore`, the same chapter-index cache reference, and a copied warnings array
- `nextStore` uses a new root object, a new `novels` array, and a new `progressByNovelId` object
- The new novel and new progress objects are shallow-copied before entering `nextStore`
- Existing novel objects, existing progress entries, `studyRecords`, `unlockRecords`, and `readingRecords` preserve their references
- The cache object and `cache.chapters` array preserve their references and are not placed inside `nextStore`
- Phase 2B3 must not mutate `existingStore`, mutate `preparedImport`, return `sourceText`, copy chapter body text, call Vault APIs, call current-time APIs, or write any files

This follows the current NestKit architecture direction where independent features are lazily created and enabled through the shared `FeatureRegistry` and `FeatureManager`, rather than being always-on during `onload()`.

## Reading source model

The first version assumes one Vault-local novel per large `TXT` or Markdown file, with multiple chapters stored inside that single file.

Planned import behavior:

- Import a single `TXT` or Markdown novel file
- Parse chapter headings on first import
- Build and persist a chapter index
- Rebuild the index only when the underlying file meaningfully changes

Planned chapter index fields:

- Chapter number
- Chapter title
- Chapter start offset
- Chapter end offset

Planned offset semantics:

- `startOffset` and `endOffset` are JavaScript UTF-16 code-unit offsets
- They are intended to work directly with `sourceText.slice(startOffset, endOffset)`
- `sourceSize` stays a file byte-size field and is not used as the chapter-offset upper bound
- `sourceTextLength` is the corresponding `sourceText.length` upper-bound field stored beside the cache

Initial chapter-title matching should support common formats such as:

- `第一章`
- `第1章`
- `第 1 章`
- `第001章`
- `Chapter 1`

Phase 1 should ship with built-in automatic matching rules only. Advanced per-book custom chapter regex support should stay deferred until later.

Phase 2A parser scope is intentionally narrower than full import:

- Parse one complete source string only
- Detect chapter-title lines and generate UTF-16 offsets only
- Do not read from Vault
- Do not write chapter-index cache files
- Do not derive `sourceSize`, `sourceMtime`, or other file metadata
- Do not keep chapter body copies inside the parse result

Phase 2B1 Vault source boundary scope stays intentionally narrower than full import:

- Validate one Vault-local source path only when the future user-driven import flow explicitly asks for it
- Support only `.txt` and `.md` source files in this phase
- Use `vault.read` rather than `cachedRead`
- Read the source file at most once per inspection call
- Return structured success or failure results plus an in-memory chapter cache only
- Do not return `sourceText`
- Do not create `RewardReaderNovel`
- Do not persist state or chapter-index cache files

Phase 2B2 pure import-assembly scope stays intentionally narrower than import runtime:

- Prepare one detached payload only after a successful Phase 2B1 source inspection already exists
- Validate title, `preparedAt`, store schema compatibility, and basic conflict boundaries only
- Validate malformed inspection shape and explicit boolean `makePrimary` without broadening into a full runtime schema framework
- Reuse the inspection cache by reference instead of rebuilding or cloning it
- Keep chapter-boundary validation O(1) by checking only the first and last chapter entries plus lightweight metadata
- Return one new novel object plus one initial progress object only
- Return the recommended `primaryNovelIdAfterImport` only, not a fully copied next store
- Do not read from Vault
- Do not write state or cache files
- Do not register imported novels into the real store yet
- Do not add import modal, file picker, or command wiring

Built-in heading formats now targeted by Phase 2A:

- Chinese Arabic-number headings such as `第1章`, `第 1 章`, `第01章`, and `第１章`
- Chinese numeral headings such as `第一章`, `第二十三章`, `第一百零二章`, and `第一千章`
- English headings such as `Chapter 1`, `chapter 1`, `CHAPTER 1`, and `Chapter 1: Introduction`
- Optional Markdown heading prefixes such as `# 第一章` or `### Chapter 3`

Built-in false-positive boundaries now targeted by Phase 2A:

- Chapter headings must occupy a whole logical line
- Ordinary body text mentioning `第一章`, `第3章`, or `Chapter 2` inside a paragraph must not be treated as a chapter heading
- Chinese matches stop at `章`, so forms such as `第1章节` or `第一章鱼` must not match
- English matches require the standalone word `Chapter`, so forms such as `Chapterhouse 1` must not match

Index invalidation should initially be lightweight:

- Track source file modification time
- Track source file size
- Rebuild the index only when those signals indicate the source file changed

Current cache-hardening rules for the Phase 1A foundation layer:

- Novel ids that participate in cache file names must satisfy the safe-id rule
- A cache with invalid identity fields returns `null` and is treated as rebuild-required
- A cache with overlapping offsets, `endOffset > sourceTextLength`, invalid or missing `chapters`, invalid chapter entries, or non-continuous chapter indexes also returns `null`
- A complete but unordered chapter list may be sorted by `chapterIndex` and retained
- A future schema cache may still be read for runtime inspection if its known fields form a complete safe cache, but it must not be persisted back by older code
- The foundation layer still does not perform real persistence; these rules only define the normalization boundary for later storage-adapter work

## Reading boundary and reader behavior

Reward Reader must not rely on CSS-only hiding for locked content.

The reading surface should be a dedicated NestKit novel reader that:

- Renders only unlocked chapters
- Keeps locked chapters out of the current DOM
- Stops scrolling at the current unlocked boundary
- Shows a lock card at the end of the unlocked content

The lock card should show:

- The next chapter is still locked
- Current study-minute balance
- Remaining minutes needed for the next unlock
- A `Record study` action
- A `View unlock progress` action

Planned reading modes:

1. Continuous reading mode
2. Single-chapter reading mode

Default mode:

- Continuous reading mode

First-version read completion should stay manual-first:

- Each chapter can expose a `Mark chapter as read` action
- The module should auto-save current chapter and scroll position
- Auto-marking by scroll-to-bottom stays deferred

## Core progress model

Reward Reader must keep two separate progress concepts:

- Reading progress: what the user has actually read or marked as read
- Unlock progress: the furthest chapter the user is currently allowed to read

Example:

- Reading progress: chapter `12`
- Unlock progress: chapter `15`
- Readable inventory: `3` chapters

The module will likely also need to persist, per novel:

- Current novel
- Current chapter
- Scroll position inside the current chapter
- Study-minute balance
- Total accumulated study minutes
- Total unlocked chapters
- Today unlocked chapters
- Study records
- Unlock records
- Reading records

Current boundary note for MVP history shape:

- Scroll position belongs to mutable per-novel progress only
- Reading history should stay reserved for lower-frequency semantic events such as `opened` and `marked-read`
- High-frequency scroll updates should not create one reading-history record per position change

The first release should reserve space for multiple novels, but use a `current primary novel` workflow:

- One novel is marked as the current primary novel
- Study records default to unlocking that novel
- The record modal can switch the target novel before submission

Shared global balance and free cross-novel exchange should stay out of MVP scope.

## Study-to-unlock flow

The study-record modal should collect:

- Study content
- Study minutes
- Target novel

Planned quick-duration buttons:

- `15` minutes
- `30` minutes
- `45` minutes
- `60` minutes

The modal should also allow a custom minute input.

Before submission, the UI should preview:

- How many chapters this record can unlock
- How many minutes remain after conversion

Conversion rules:

- Minutes accumulate as integers
- Partial time carries forward automatically when carryover is enabled
- Time must never be silently lost because of integer division or rounding
- If a daily unlock cap is hit, extra time should remain in balance rather than being discarded

## Settings scope

Planned NestKit settings group: `Reward Reader`

Suggested settings areas:

- Basics
- Exchange rules
- Study records
- Reading controls
- Data management

Minimum settings currently expected:

- Enable Reward Reader
- Default reading mode
- Show or hide status bar item
- Register or hide the right sidebar entry
- Minutes per exchange unit
- Chapters per exchange unit
- Carry over unused balance
- Daily unlock cap
- Maximum unlocked-but-unread inventory
- Require study content
- Quick duration list
- Allow custom duration
- Allow undo for mistaken records
- Undo time window
- Use NestKit reader by default
- Show lock card
- Show remaining minutes to next chapter
- Auto-save scroll position
- Novel file location
- Rebuild chapter index
- Export study and reading history
- Clear progress for one selected novel

## MVP scope

Phase 1 MVP should include only the following end-user capabilities:

1. Optional independent module structure
2. `TXT` and Markdown novel import
3. Automatic chapter recognition and indexing
4. Custom `minutes -> chapters` exchange rules
5. Minute balance accumulation and carryover
6. Manual study-content and duration recording
7. Daily unlock cap
8. Separate reading progress and unlock progress
9. Dedicated NestKit novel reader
10. Continuous reading up to the current unlock boundary
11. Lock card
12. Right sidebar control panel
13. Compact status bar summary
14. Automatic current-chapter and scroll-position persistence
15. Study, unlock, and reading history records

## Deferred after MVP

The following should stay out of the first implementation phase:

- Automatic exchange from a future NestKit focus or timer module
- DailyNest integration
- Automatic Daily Note logging
- Shared public study balance across novels
- Cross-novel free exchange
- Reading statistics dashboards
- Automatic chapter-read detection
- Reader themes and typography presets
- Enhanced cloud-sync conflict handling

## Phased delivery plan

### Phase 0: requirements document and architecture confirmation

- Confirm module boundaries against the current NestKit feature registration pattern
- Confirm storage boundaries between plugin settings and feature-owned persisted data
- Confirm the detailed leaf-placement and interaction design for the future leaf-backed `ItemView`
- Confirm vault-file constraints before deciding how novels are selected and stored
- Confirm desktop-only assumptions and how much, if any, mobile compatibility should remain a design goal

### Phase 1: module skeleton, settings model, and data model

- Add the default-off feature registration shell
- Add the first settings keys and settings-tab grouping
- Define feature-owned types for novels, chapter index entries, reading progress, unlock progress, and record history
- Define migration expectations for older plugin settings
- Keep the mixed model now confirmed:
  - plugin `data.json` for settings only
  - `.nestkit/reward-reader/state.json` for future feature state
  - `.nestkit/reward-reader/indexes/<novel-id>.json` for future chapter-index caches

### Phase 2: novel import and chapter indexing

- Add the novel import flow
- Read supported source files
- Detect chapter boundaries with built-in rules
- Persist chapter-index metadata
- Add lightweight index rebuild checks based on file-change signals

Phase 2A status inside Phase 2:

- Implemented now: detached pure chapter parser only
- Deferred to later Phase 2 work: Vault file reading, import flow assembly, chapter-index persistence, and file-change-based invalidation checks

Phase 2B1 status inside Phase 2:

- Implemented now: detached Vault-local source inspection plus pure in-memory chapter-cache assembly
- Deferred to later Phase 2 work: explicit import UI, novel registration, chapter-index persistence, state persistence, and file-change-based invalidation checks

Phase 2B2 status inside Phase 2:

- Implemented now: detached pure import-payload preparation from normalized existing store plus successful source inspection
- Deferred to later Phase 2 work: explicit import action runtime, import modal, file picker, novel registration into real state, chapter-index persistence, state persistence, and file-change-based invalidation checks

Phase 2B3 status inside Phase 2:

- Implemented now: detached pure in-memory store application from a prepared import success result plus the current store
- Deferred to later Phase 2 work: explicit import action runtime, import modal, file picker, storage write transaction, state persistence, chapter-index persistence, `.nestkit` creation, and file-change-based invalidation checks

### Phase 3: study records and exchange engine

- Add the study-record modal
- Implement configurable conversion rules
- Implement carryover balance handling
- Enforce daily unlock caps
- Separate unlock progress from reading progress in persistence and UI

### Phase 4: novel reader view and unlock boundary

- Build the dedicated reader surface
- Render unlocked content only
- Stop rendering at the current unlock boundary
- Add the lock card and manual `mark as read` flow
- Persist current chapter and scroll position

### Phase 5: right sidebar, status bar, and interaction surfaces

- Add the right sidebar control panel
- Add the compact status bar summary
- Add the `continue reading` and `record study and unlock` entry points
- Finalize continuous versus single-chapter reading mode behavior

### Phase 6: history, edge cases, and test coverage

- Persist and inspect study, unlock, and reading history
- Add undo behavior if that remains in scope
- Handle source-file changes, invalid indexes, and missing files
- Add manual test coverage for large files, daily cap behavior, balance carryover, and sync-safe persistence

### Phase 7: docs, version update, and release preparation

- Update user-facing docs after implementation stabilizes
- Add migration notes for newly introduced settings and storage
- Revisit feature status and release notes
- Bump versions only when the implementation branch is actually ready to ship

## Pre-implementation technical questions

### Reader surface and UI ownership

- NestKit currently has no existing `ItemView` or `registerView(...)` implementation. Reward Reader is now expected to introduce the plugin's first custom workspace reading view, but that work stays deferred beyond Phase 1A.
- The future reader surface is confirmed as a leaf-backed `ItemView`, but the exact leaf placement and navigation flow still need confirmation.
- The plugin already has one independent status bar module (`heading-progress`), but no shared status-bar manager. Reward Reader can still ship later with feature-owned status-bar UI first unless overlapping status-bar behavior creates a stronger need for a shared abstraction.

### Storage model and persistence

- Plugin settings persist through `data.json`, while Reward Reader state is now planned as a dedicated feature store under `.nestkit/reward-reader/state.json`.
- Chapter indexes are now intentionally split from user progress data and are planned under `.nestkit/reward-reader/indexes/<novel-id>.json`.
- Reward Reader store schema versioning still needs exact long-term migration rules beyond the initial schema `1` foundation.
- Multi-device sync conflict handling remains a later design task.

### Novel source files and vault boundaries

- MVP is now confirmed as Vault-local only for novel files.
- External absolute paths are intentionally out of scope for MVP because they fit the current NestKit and Obsidian policy direction much less well.
- The exact future read path for Vault-local `TXT` files still needs confirmation against the practical Obsidian Vault API boundary on desktop.
- If the source file is moved or renamed, the future tracking strategy still needs confirmation.

### Performance and large-file handling

- What is the safe first-version strategy for large `TXT` files: full in-memory read, chunked read, cached slice map, or another bounded approach?
- Should the first reader render chapter-sized slices only, even in continuous mode, instead of keeping the full unlocked text in memory?
- What invalidation strategy is sufficient for the chapter index cache without introducing background watchers or startup scans?

### Mobile and platform expectations

- NestKit is currently desktop-only overall because of the released workspace drawer behavior. Should Reward Reader still avoid unnecessary desktop-only assumptions where the implementation cost is low?
- If the feature ever needs external file paths, what happens on mobile where external path access may not be available or consistent?

## Architecture fit notes from the current repo

- The current feature system is already compatible with a default-off Reward Reader module. `main.ts` registers independent features through `FeatureRegistry` and enables them lazily through `FeatureManager`.
- The current settings UI uses a `General` enable-toggle pattern plus dedicated per-feature tabs for larger modules. Reward Reader now follows that same structure in Phase 1A.
- NestKit currently does not have a reusable custom-reader surface. Reward Reader is still expected to be the first feature that needs a true leaf-backed reading view rather than only a modal, ribbon, or status-bar surface.
- NestKit currently has no shared status-bar management layer. Reward Reader can likely ship with feature-owned status-bar UI first, similar to Heading Progress, unless multiple status-bar modules begin to overlap.
- The strongest current policy tension is source-file location. A Vault-local novel workflow is now the confirmed MVP boundary and aligns much better with current NestKit and Obsidian plugin guidance than unrestricted external absolute paths.
