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

Confirmed Phase 2C1 read-only storage decisions:

- Phase 2C1 adds only a detached read-only storage adapter and still does not add write persistence, import runtime, import modal, file picker, directory creation, or `.nestkit` creation
- State reads target `.nestkit/reward-reader/state.json` through an explicit Obsidian `DataAdapter`
- Chapter cache reads target exactly one `.nestkit/reward-reader/indexes/<novel-id>.json` path derived by the existing cache path helper after the requested novel id passes the existing safe-id rule
- Missing state is a normal state: it returns a fresh default store, `status = missing`, and `shouldPersist = false` without creating a file
- Missing chapter cache is a normal state: it returns `cache = null`, `status = missing`, and `shouldPersist = false` without rebuilding or reading the novel source file
- Invalid JSON and invalid root structures are separate failures and do not return default state or placeholder cache data
- Future store or cache schemas are failures for this read boundary, even when normalization can recognize some fields, so mutation or persistence flows cannot continue with newer data
- Safe current-schema normalization may return `status = normalized` plus `shouldPersist = true`, but Phase 2C1 only reports the recommendation and does not write it back
- Each read function calls `exists` at most once, `read` at most once, parses JSON at most once, and calls the matching normalization at most once
- The adapter never returns raw JSON, original exceptions, stacks, physical paths, write plans, rollback plans, or adapter references
- The adapter does not call write operations, list directories, scan indexes, register commands, attach listeners, or enter startup

Confirmed Phase 2C2 minimal write-only storage decisions:

- Phase 2C2 adds only a detached write-only storage adapter and still does not add import persistence orchestration, import runtime, import modal, file picker, reader UI, exchange logic, or startup hydration
- The writer accepts only canonical current-schema state/cache data; data that normalization would repair is rejected instead of silently normalized and written
- Future state and chapter-cache schemas are rejected and must not be overwritten by older code
- Input validation and serialization must complete before any `adapter.exists(...)`, `adapter.mkdir(...)`, or `adapter.write(...)` call
- Parent directories are derived from the final target file path instead of being introduced as new exported path constants
- State writes prepare `.nestkit` and `.nestkit/reward-reader`; cache writes prepare `.nestkit`, `.nestkit/reward-reader`, and `.nestkit/reward-reader/indexes`
- Each successful state or cache write performs exactly one target-file `adapter.write(...)`
- The writer does not read existing target files, does not check target file existence, does not inspect on-disk schema, and does not scan the indexes folder
- The writer may create or overwrite one target file; Phase 2C3 must provide the read-before-write context before runtime code calls it
- Directory and write failures return sanitized structured failures, do not retry, and do not roll back already-created parent directories
- This phase does not provide crash atomicity, temporary files, backup files, atomic rename, lock files, rollback, or a two-file state/cache transaction
- State and cache write functions stay independent and do not call each other

Confirmed Phase 2C3 import persistence orchestration decisions:

- Phase 2C3 adds only a detached import persistence orchestrator and still does not add an import command, import modal, Vault file picker, reader UI, exchange logic, listeners, or startup hydration
- Persistence always reads the latest on-disk Reward Reader state through the read adapter before applying the prepared import
- The orchestrator re-runs `applyPreparedRewardReaderImport(...)` against that latest state and does not accept an external precomputed `nextStore`
- Cache persistence is cache-first and state-second so state does not point to a cache that has not been confirmed
- An existing ready cache that is completely identical to the prepared cache is reused without another cache write
- An existing safe-normalized cache that becomes identical to the prepared cache is rewritten through the canonical cache writer before state is written
- Existing different, damaged, unreadable, or future-schema caches block import persistence and are not overwritten, deleted, or rebuilt
- Cache write failure blocks state write and reports cache persistence as `write-outcome-unknown`
- State write failure after cache write or reuse reports state persistence as `write-outcome-unknown` and leaves any already-written cache in place
- Retry after cache-only partial success can reuse the identical orphan cache and attempt the state write again
- Warnings are aggregated in first-seen order with duplicates removed
- This phase still does not provide rollback, orphan-cache cleanup, crash atomicity, compare-and-swap, lock files, revision fields, automatic retry, or index scanning

Confirmed Phase 2D1 detached minimal import runtime decisions:

- Phase 2D1 adds only a detached callable import runtime flow and still does not add an import command, import modal, Vault file picker, notices, reader UI, exchange logic, listeners, status bar, sidebar, or startup hydration
- Runtime callers must explicitly provide `novelId`, `sourcePath`, `title`, `operationAt`, and `makePrimary`; the runtime flow does not generate ids, infer titles, coerce booleans, or read the current time
- Request validation runs before any Vault or DataAdapter IO and rejects malformed roots, unsafe novel ids, blank or NUL source paths, invalid single-line titles, invalid timestamps, and non-boolean primary flags
- The runtime flow first reads Reward Reader state to establish the preparation baseline, then inspects exactly one Vault-local TXT/Markdown source, then prepares the import payload
- The prepared import is passed directly to Phase 2C3, which intentionally reads the latest state again and reapplies the prepared import before cache-first persistence
- The two state reads are intentional: the first supports preparation, while the second protects the final write from stale-state overwrite
- Source inspection remains the only source-text read boundary; runtime results do not include source text, raw JSON, adapter instances, Vault instances, physical filesystem paths, or internal write plans
- Runtime failure results preserve sanitized stage, cause, persistence stage, cache persistence, state persistence, and warnings so a future UI can display partial-success and retry guidance without reinterpreting lower layers
- The runtime flow does not directly call `adapter.exists(...)`, `adapter.read(...)`, `adapter.mkdir(...)`, `adapter.write(...)`, `adapter.list(...)`, or cache/state writers, and it does not scan indexes or accept an external `nextStore`
- Structured Phase 2C3 failures remain distinct from runtime-level unexpected throws: normal persistence failures keep their original code, internal persistence stage, message, and cache/state persistence statuses
- If Phase 2C3 unexpectedly throws, runtime returns `persistence-runtime-failed` instead of pretending the failure is `state-write-blocked`
- In that unexpected-throw case both cache and state persistence are reported as `write-outcome-unknown`, and callers must reread state before deciding whether to show success, retry, or recovery guidance

Confirmed Phase 2D2 import command and minimal modal decisions:

- Phase 2D2 adds only the first user-triggered desktop import entry above the detached runtime flow and still does not add reader UI, unlock or exchange logic, status bar, sidebar, background listeners, or startup hydration
- The import command is registered lazily only after Reward Reader is enabled at least once and is still unavailable while Reward Reader is disabled
- Command availability is gated dynamically by current `enableRewardReader`, desktop-only runtime, and whether an import call is already in flight
- Command registration and command checking perform zero Vault or `DataAdapter` IO, do not create a modal, and do not read Reward Reader state or novel source text
- The modal may prefill from `app.workspace.getActiveFile()` only when the active file is a Vault TXT or Markdown `TFile`; that metadata read does not read file body text
- The modal opens without reading Reward Reader state, without reading novel source text, and without enumerating Vault files
- Vault file enumeration is allowed only after the user explicitly clicks `Choose file` or `Change file`, and that picker lists only Vault-local TXT and Markdown `TFile` metadata sorted by Vault-relative path
- The source picker is a child surface owned by one import modal, so one import modal may keep at most one active source picker at a time
- Repeated picker clicks while that picker is already open must not create another picker and must not trigger another `vault.getFiles()` call
- Closing the import modal, disabling Reward Reader, or unloading the plugin must also close any active source picker without performing Vault or persistence cleanup work
- Late picker callbacks after the parent modal has already closed must become no-ops instead of mutating parent state or re-rendering closed UI
- The UI boundary generates exactly one safe `novelId` plus one `operationAt` timestamp per new submit attempt, validates both before runtime call, and does not use fallback identity strategies such as `Math.random`, path hashing, or user-entered ids
- The modal keeps at most one active instance at a time, blocks duplicate runtime submissions while busy, and does not queue a second import call
- Title behavior is basename-prefill plus `titleDirty` protection: reselecting a file updates the title only until the user manually edits or clears it
- Import execution still delegates only to `runRewardReaderImport(vault, vault.adapter, request)`; the modal does not call `vault.read(...)`, does not call adapter IO directly, and does not bypass the detached runtime boundary
- Partial-persistence or outcome-unknown failures lock the form into exact-retry mode and preserve the full immutable request snapshot, including the same `novelId`, `operationAt`, `sourcePath`, `title`, and `makePrimary`
- Clear pre-persistence failures do not keep the old identity; they unlock the form for edits and require the next submit to create a fresh request snapshot
- Unexpected throws at the UI boundary are sanitized, surface only a generic retry notice, and also enter exact-retry mode without exposing raw errors, paths, JSON, or stack traces
- Success shows only a localized Notice with safe summary fields such as title, chapter count, and optional warning count, then closes the modal without opening the reader automatically

Confirmed Phase 3A pure study-minute exchange decisions:

- Phase 3A adds only one detached pure study-minute exchange engine and still does not add study runtime wiring, reader UI, sidebar, status bar, reading-progress commands, timers, listeners, or startup hydration
- Imported novels remain fully locked after import: `unlockedThroughChapterIndex = null`, `studyMinuteBalance = 0`, `totalStudyMinutes = 0`, `todayUnlockDate = null`, and `todayUnlockedChapters = 0`
- The current product-default exchange baseline is now recorded as `DEFAULT_REWARD_READER_MINUTES_PER_CHAPTER = 30`, meaning `30` minutes unlock `1` chapter, but the engine still requires the caller to pass an explicit full policy on every call
- The pure calculation path accepts only one canonical progress object plus explicit `chapterCount`, `studyMinutes`, `occurredAt`, and policy; it does not read store state, does not create records, and does not generate ids or timestamps
- Both public engine exports are intended to be no-throw boundaries that future runtime/UI code can call safely even if malformed getters, Proxies, or unexpected internal regressions throw
- `occurredAt` must already be a canonical UTC ISO instant and the UTC daily boundary comes only from `occurredAt.slice(0, 10)`
- Study-minute credit is additive: `studyMinuteBalance + studyMinutes` becomes available minutes, and any remainder below the next conversion threshold stays in `studyMinuteBalance`
- `totalStudyMinutes` is cumulative only; unlocking chapters spends minutes from balance but never subtracts from lifetime total study minutes
- Per-study cap, UTC daily cap, and the novel-end boundary can reduce unlock count, but they never discard credited minutes; blocked minutes remain available for later explicit study operations
- If a lowered daily cap is already below the existing same-day unlocked count, the engine treats the remaining daily allowance as `0` for the new operation and does not retroactively reduce old daily counts
- Stale study operations are rejected if `occurredAt` is earlier than `progress.updatedAt` or if the derived UTC date is earlier than `progress.todayUnlockDate`
- Unlock indexes are always continuous and begin at the next locked chapter: first unlock starts at chapter `0`, later unlocks continue from `unlockedThroughChapterIndex + 1`, and no skipped indexes are generated
- Complete novels still accept credited study minutes: successful no-unlock operations keep growing `studyMinuteBalance` and `totalStudyMinutes`
- The apply path accepts one canonical current-schema Reward Reader store plus explicit `studyRecordId` and `unlockRecordId`, validates those ids across `studyRecords`, `unlockRecords`, and `readingRecords`, and never generates ids itself
- Successful apply always creates one study record, even when `unlockedChapterCount = 0`
- Successful apply creates an unlock record only when chapters were actually unlocked; it never appends an empty unlock record
- Study content is caller-provided text only: the engine normalizes `CRLF/CR` to `LF`, trims outer whitespace, allows an empty final string, and rejects NUL
- The apply result returns one immutable `nextStore` with shallow structural sharing: `novels` and `readingRecords` keep their references, non-target progress entries keep their references, and history stays append-only
- Normal structured business errors must stay precise, but a truly unexpected calculate exception falls back only to the stable `invalid-progress` result and a truly unexpected apply exception falls back only to the stable `invalid-store` result
- Generic unexpected failure must stay sanitized: it must not pretend to be a more specific cap/timestamp/persistence error and must not expose raw exception text
- Phase 3B should be the first layer that reads the latest Reward Reader state plus one explicit chapter cache, supplies explicit ids and timestamps, applies the pure Phase 3A engine, and persists the result

Confirmed Phase 3C3A import-completion pure foundation decisions:

- Phase 3C3A adds only two detached pure no-IO modules and still does not modify the existing import modal, import runtime, persistence orchestration, reader UI, or any schema
- `import-progress-initializer.ts` accepts exactly one positive safe-integer `chapterCount` plus one explicit `readThroughChapterIndex` selection and returns one deterministic initialization plan instead of mutating store state directly
- Invalid `chapterCount` must return `invalid-chapter-count`; missing, `undefined`, negative, non-integer, unsafe, or `>= chapterCount` read-through values must return `invalid-read-through-index`, while only literal `null` means no historical reading progress
- A no-history plan uses the detached navigation sentinel contract `unlockedThroughChapterIndex = -1` plus `readThroughChapterIndex = -1`, starts at `currentChapterIndex = 0`, keeps `currentChapterScrollOffset = 0`, and derives `historicalReadChapterCount = 0` plus `nextUnreadIndex = 0`
- A valid historical read-through plan keeps `unlockedThroughChapterIndex` and `readThroughChapterIndex` aligned to the last already-read chapter, derives `historicalReadChapterCount = readThroughChapterIndex + 1`, and points `currentChapterIndex` to the next unread chapter or clamps it to the final chapter when the novel is already fully read
- Historical progress initialization is intentionally zero-side-effect in this phase: it must not generate ids, must not read the current time, must not create study records, unlock records, or reading records, and must not change study-minute totals or daily unlock counters
- `markdown-risk-inspector.ts` accepts only one normalized source string plus optional bounded preview options and returns five stable warning codes for per-event unbalanced unescaped `**`, `__`, `~~`, inline backticks, and fenced-code openings together with deterministic line-aware sampled metadata and per-code counts
- Markdown risk inspection is warning-only foundation data: it must not auto-escape source text, must not delete characters, must not rewrite imported Markdown or TXT content, and must not alter parser detection or chapter offsets
- Fenced code blocks must isolate their inner content from `**` / `__` / `~~` warning detection, but unclosed inline code and unclosed fenced code blocks must surface as distinct stable warning codes
- Warning metadata must stay capped: issue counts and per-code counts track all detected events, but retained samples and excerpts are bounded by configurable `maxSamples` and `maxExcerptLength`, the original source string always remains unchanged, and preview samples follow first-N source order rather than warning-taxonomy order
- The public inspection result must not expose an unbounded complete risk-event array; the implementation should keep extra memory bounded to retained samples plus fixed code-count bookkeeping
- Both public exports must remain complete no-throw boundaries that sanitize malformed roots, throwing getters, Proxies, or other unexpected runtime failures into stable structured results instead of leaking exceptions

Confirmed Phase 3B1 study-exchange persistence runtime decisions:

- Phase 3B1 adds only one detached async study-exchange runtime and still does not add a study-record command or modal, reader UI, sidebar, status bar, timers, listeners, or startup hydration
- The runtime request must explicitly provide `novelId`, `studyRecordId`, `unlockRecordId`, `content`, `studyMinutes`, `occurredAt`, and the full study-exchange policy; the runtime does not generate ids, infer target novels, coerce policy values, or read the current time
- Request validation must finish before any adapter IO, must reject malformed roots, unsafe ids, same new ids, NUL content, non-positive study minutes, non-canonical UTC timestamps, and malformed policy objects, and must build one detached request snapshot plus one detached policy snapshot before the first await
- Once that zero-IO snapshot exists, later caller-side mutations to the original request or policy must not affect cache reads, target revalidation, engine input, or persistence for the in-flight operation
- The first state read is used only to find the exact target novel and its persisted cache identity tuple from the real current store fields: `novel.id`, `novel.sourcePath`, `novel.sourceMtime`, and `novel.sourceSize`
- Chapter-cache reads stay explicit and narrow: Phase 3B1 reads exactly one cache through the existing Phase 2C1 read adapter and does not read source TXT or Markdown text, does not rebuild cache data, and does not write cache files
- Cache validation stays lightweight on top of the existing canonical read-only adapter: Phase 3B1 only confirms the requested novel id, the persisted identity tuple, and a positive safe-integer `cache.chapters.length` before using that length as `chapterCount`
- The runtime then rereads the latest Reward Reader state exactly once more, refinds the same target novel, and aborts with `study-target-changed` if that target disappears or if its persisted cache identity differs from the first read
- The second state read is the only store passed into `applyRewardReaderStudyExchange(...)`; Phase 3B1 must never apply against the first-read baseline store
- Successful study exchange attempts write state exactly once through the existing Phase 2C2 writer and do not read back state after writing
- Structured read failures remain `state-read-blocked` or `chapter-cache-read-blocked`, preserve the lower-layer `causeCode`, and stop the flow before later steps
- Structured Phase 3A failures remain precise at stage `study-exchange`: the runtime preserves their original codes and stable Phase 3A messages instead of collapsing them into one generic runtime error
- Structured writer failures remain distinct from unexpected throws: writer `state-invalid-data`, `state-unsupported-version`, `state-serialization-failed`, and `state-directory-create-failed` map to `state-write-blocked` plus `statePersistence = write-blocked`, while `state-write-failed` maps to `state-write-blocked` plus `statePersistence = write-outcome-unknown`
- Unexpected throws around state reads map to `state-read-runtime-failed`, unexpected throws around chapter-cache reads map to `chapter-cache-runtime-failed`, unexpected throws around engine application map to `study-exchange-runtime-failed`, and unexpected throws around the writer map to `state-persistence-runtime-failed`
- The public runtime export must be a full no-throw boundary even for malformed getters or result-object processing failures, and once writer invocation has started any later unclassifiable exception must stay conservatively classified as `statePersistence = write-outcome-unknown`
- Warning aggregation must keep first-seen order, trim outer whitespace, remove duplicates, and never surface raw exception text, raw JSON, physical paths, or stack traces
- The runtime result must return only future UI-relevant fields: calculation, `progressAfter`, `studyRecord`, `unlockRecord`, warnings, stage, status, and sanitized `causeCode`
- The runtime must not return raw state, raw cache, `nextStore`, write plans, adapter instances, or exception objects
- Phase 3B1 does not add automatic retry, idempotent replay recovery, read-back verification, rollback, lock files, CAS, transactions, or cross-device conflict resolution; a concurrency window still remains between the latest reread and the final state write

Confirmed Phase 3B2A pure replay-inspection decisions:

- Phase 3B2A adds only one detached pure replay-inspection engine and still does not add recovery runtime wiring, study-record command or modal, reader UI, sidebar, status bar, timers, listeners, or startup hydration
- Input is only one supplied store, one supplied positive `chapterCount`, and the exact same explicit study request preserved from an earlier Phase 3B1 write attempt
- The public replay export must validate one plain-object request root, build one detached request snapshot plus one detached policy snapshot, and then read only those snapshots
- The replay inspector is canonical-only: it calls `normalizeRewardReaderStore(...)` once, rejects future schemas, and rejects raw stores that normalization would repair instead of continuing with repaired history
- Replay classification is evidence-only: `replay-confirmed` requires one unique request identity, one complete record pair, reconstructable target history, exact Phase 3A recalculation agreement, and current study-related progress consistency
- `not-observed` means only that the supplied store does not currently show the requested identity; it does not prove write failure and does not authorize automatic retry with a new identity
- Partial or conflict results must block automatic success and automatic retry; later runtime code may decide how to present or recover from them, but Phase 3B2A itself performs no recovery action
- Identity inspection scans `studyRecords`, `unlockRecords`, and `readingRecords` once under one global id namespace, blocks wrong-history requested ids, and keeps unrelated duplicate ids as history conflict
- Requested study content must be normalized with the same `CRLF/CR -> LF` plus outer-trim rule as Phase 3A before exact comparison
- When the target study unlocked no chapters, no unlock record may exist anywhere for that study; when the target study unlocked chapters, exactly one matching unlock record must exist and no second unlock may reference the same study id
- The inspector reconstructs target-novel study balance, accumulated minutes, same-day unlocked count, and unlock boundaries in append order without allocating arrays sized to `chapterCount`
- The synthetic pre-target progress object is internal only, uses the reconstructed study-related fields plus `updatedAt = occurredAt`, and exists only to drive the existing Phase 3A calculate path safely
- Current progress validation is intentionally study-focused: it requires the final total study minutes, minute balance, unlock boundary, and today counter to match full target history, while later reading-position changes remain allowed
- Phase 3B2A performs no state read, no cache read, no state write, no retry, no read-back verification, no rollback, no id generation, and no current-time read
- Phase 3B2B will be the next layer that rereads latest state and cache after a Phase 3B1 write-outcome-unknown result and delegates replay evidence classification to the pure Phase 3B2A inspector

Confirmed Phase 3C2B real-world TXT import decisions:

- The existing Vault TXT/Markdown import path remains supported and unchanged as the primary canonical runtime path
- The import modal now exposes two user-triggered source entries: choose one Vault file or choose one external TXT/Markdown file from the computer
- External file selection must stay modal-owned and use standard browser `input[type="file"]` plus `File.arrayBuffer()`; do not add Node `fs`, Node `path`, Electron remote APIs, or persisted absolute OS paths
- External file reads are byte-first only; do not treat `File.text()` as the single canonical read path because non-UTF-8 TXT input must stay decodable
- `external-text-decoder.ts` is the pure decode boundary: it accepts raw `Uint8Array` bytes plus an optional explicit encoding override, performs no IO, mutates no input, and exposes only stable no-throw success or failure results
- Supported external decode labels are `utf-8`, `utf-8-bom`, `utf-16le`, `utf-16be`, and `gb18030`
- Decode order in auto mode is BOM-backed decode first, then strict UTF-8, then no-BOM UTF-16 zero-pattern detection, then GB18030 fallback
- BOM must never survive into the returned normalized text, and newline normalization must collapse `CRLF` plus bare `CR` into `LF`
- Binary-like decoded output must be rejected after decoding instead of being passed into parser/import preparation
- The import modal must allow an explicit re-decode of the same in-memory bytes through `auto`, `UTF-8`, `GB18030 / GBK`, `UTF-16 LE`, and `UTF-16 BE` without reopening the external file picker
- External TXT conversion is a text normalization step only; do not rewrite chapter lines into Markdown headings and do not pretend extension rename alone is an encoding conversion
- Parser priority for imported external text is whole-file and non-mixed: Markdown headings first, built-in plain chapter headings second, numeric-colon TXT headings last
- `plain-chapter-heading` remains the persisted umbrella for stronger plain-text chapter detection: strong Chinese headings, English `Chapter N` headings, combined `卷 + 章` headings, and constrained special headings still reuse the existing `plain-chapter-heading` mode instead of introducing new schema values
- Allowed mixing stays narrow: coherent strong numbered headings may include constrained special headings such as `序章`, `番外`, `尾声`, `Prologue`, `Extra Chapter`, or `Afterword`, but Markdown headings still win over plain headings and weak numeric-colon lines still must not backfill a Markdown or strong-heading file
- Direct-title Chinese headings such as `第3章外挂上线` remain supported, but sentence-like body lines such as `第一章正文……` should be rejected so the parser does not promote normal prose to chapter headings
- Numeric-colon TXT detection is intentionally weak-mode only and must require repeated ordered evidence rather than a single matching line
- Numeric-colon detection must require at least three ordered unique numeric candidates, coherent body-text evidence between headings, reject duplicate or decreasing numbers, allow reasonable gaps with warnings, and skip intermediate noise such as chat numbering, short numbered lists, or isolated/extreme outlier lines like `2026: ...`
- Same-style numeric-colon body noise such as `100: ...` between real `001 / 002 / 003 / 004` headings must remain inside chapter body text and must not win solely because it can form a longer but gap-heavy alternate run
- Titled special headings such as `序章：`, `尾声：`, `Prologue: ...`, and `Afterword - ...` must stay supported inside the existing constrained special-heading rules
- If duplicate numeric candidates still remain near-tied after structural comparison, the parser must return a blocking ambiguity and the import modal must disable import instead of guessing
- Duplicate ambiguity detection must also cover duplicate chapter numbers that the initial DP run skipped; an unresolved duplicate inside the selected numeric span cannot be downgraded to a normal gap
- Automatic duplicate resolution must not use title wording as decisive evidence. Shared prefixes or similar chapter names may help diagnostics, but safe automatic import still requires observable structural margins
- Numeric-colon body evidence should be precomputed once per parse so transition checks stay O(source lines + candidates * bounded lookback) instead of rebuilding candidate lookup state per transition
- Automatic import now prioritizes correctness over forced chapter selection: structurally indistinguishable duplicate headings stay blocked for user review, and a future UX may optionally allow manual candidate selection without modifying the original source or prepared Vault copy
- The public parser boundary must stay no-throw and return a sanitized `none` result for invalid input or unexpected failures
- Chapter offsets for external imports must still refer to the normalized Unicode text that becomes the UTF-8 Vault Markdown copy, not to original byte offsets
- Preview for external files stays lightweight and safe: basename, detected encoding, chapter format, chapter count, first chapter titles, and sanitized warnings or failure text only
- External import cannot proceed when decode fails or when no supported chapter structure is detected, but the user must still be able to change encoding and retry preview
- `prepareRewardReaderExternalSource(...)` is the only Vault-write boundary for external imports: it ensures `Reward Reader/Imported`, creates one unique `.md` target name, writes the normalized UTF-8 text, and returns only the created Vault-relative source identity
- Filename conflict resolution for external imports is deterministic and bounded: keep the sanitized basename, then append `-2`, `-3`, and so on until a free Vault path is found or the safe attempt cap is reached
- External import must never overwrite the original external file and must never silently overwrite an existing Vault import copy
- Once the modal has one prepared Vault copy for the current external file, later identity failures, definite import failures, and exact retries must reuse that same copy instead of creating another suffixed duplicate
- After the UTF-8 Vault Markdown copy exists, external import must rejoin the existing import runtime and persistence boundaries instead of creating a second state/cache write pipeline
- If the Vault copy succeeds but later Reward Reader persistence fails, the copy is intentionally left in the Vault for later manual retry; there is no automatic rollback or cleanup of that copy
- This round still does not add new state fields, new cache fields, configurable import destination, arbitrary legacy-encoding support beyond the explicit decoder set, reader UI, reading-progress UI, sidebar/status surfaces, or study runtime changes

Confirmed Phase 3B2B detached replay-recovery-runtime decisions:

- Phase 3B2B adds only one detached async read-only replay recovery runtime above the existing Phase 3B2A pure inspector and still does not add study-record command or modal wiring, reader UI, sidebar UI, status-bar UI, timers, listeners, or startup hydration
- Input is exactly the original caller-preserved Phase 3B1 study request; the runtime must not generate new ids, must not generate time values, and must not create a second public request schema
- The public runtime export must validate one plain-object request root before any IO, build one detached request snapshot plus one detached policy snapshot, and then read only those snapshots for the rest of the async flow
- Successful recovery orchestration performs exactly two state reads and exactly one chapter-cache read: initial state fixes target cache identity, one cache read provides `chapterCount`, latest state becomes the only store passed into the Phase 3B2A inspector
- The runtime reads at most one explicit chapter-index cache, never rereads cache after target changes, never reads source TXT or Markdown text, and never clones or maps the `chapters` array
- Initial target lookup is strict: missing target novel returns `target-novel-not-found`, duplicate or malformed target identity returns `target-novel-conflict`, and there is no fallback to `primaryNovelId`, title matching, or cache-directory scanning
- Cache validation is identity-first: the canonical cache must match `novelId`, `sourcePath`, `sourceMtime`, and `sourceSize` from the first state read, and `cache.chapters.length` must be a positive safe integer
- Latest target revalidation is also strict: if the target disappears, duplicates, or changes identity between reads, the runtime aborts with `replay-target-changed`, does not reread cache, and does not call the pure inspector
- Replay inspection always uses the second state read plus cache-derived `chapterCount`; the runtime keeps `replay-confirmed`, `not-observed`, and all structured Phase 3B2A failure codes and messages intact instead of collapsing them into one generic recovery failure
- `replay-confirmed` must come only from an explicit inspector `ok = true`, `status = replay-confirmed` variant whose `calculation`, `progress`, and `studyRecord` fields are all readable non-null objects and whose `unlockRecord` is either `null` or a readable non-null object
- `not-observed` must come only from an explicit inspector `ok = true`, `status = not-observed` variant; unknown success statuses, invalid discriminants, missing confirmed payload fields, unknown failure codes, invalid failure messages, and throwing result getters do not count as any success evidence
- Unknown or malformed inspector results are sanitized to `replay-inspection-runtime-failed`; they do not propagate raw values upward, do not become fallback `replay-confirmed`, and do not authorize automatic retry or a fresh Phase 3B1 call
- `not-observed` means only that the latest canonical store snapshot still does not show the exact supplied request identity; it does not prove that the original write failed and does not authorize automatic retry, new ids, cleanup, or a replacement write
- Structured read failures keep adapter `causeCode`, invocation throws around the state or cache readers keep dedicated runtime-failed codes, and any later getter or result-assembly exception is sanitized by the public no-throw boundary into `replay-inspection-runtime-failed`
- Warning aggregation must keep first-seen order, trim outer whitespace, remove duplicates, and never surface raw exception text, raw JSON, physical paths, stack traces, or inspector messages
- Phase 3B2B performs no state write, no cache write, no Phase 3B1 call, no retry, no read-back verification, no rollback, no id generation, and no current-time read

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

Current stronger real-world examples include:

- `第一章`
- `第1章`
- `第 1 章`
- `第001章`
- `第3章外挂上线`
- `第一卷 第3章 外挂上线`
- `VIP卷 第3章 外挂上线`
- `作品相关 第3章 说明`
- `Chapter 1`
- `CHAPTER 013`
- `Chapter XIII The Beginning`
- `序章`
- `番外：某人的故事`

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

Phase 2C1 status inside Phase 2:

- Implemented now: detached read-only storage adapter for the Reward Reader state store and one explicit chapter-index cache
- Deferred to later Phase 2 work: write persistence, directory creation, atomic write transaction, rollback, explicit import action runtime, import modal, file picker, cache rebuild decisions, and startup hydration

Phase 2C2 status inside Phase 2:

- Implemented now: detached minimal write-only storage adapter for canonical Reward Reader state and one explicit chapter-index cache
- Deferred to later Phase 2 work: import persistence orchestration, cache/state write ordering, read-before-write checks, partial-success handling, rollback, explicit import action runtime, import modal, file picker, cache rebuild decisions, and startup hydration

Phase 2C3 status inside Phase 2:

- Implemented now: detached cache-first import persistence orchestration that reads the latest state, reapplies a prepared import, safely handles existing target caches, writes or reuses cache first, and writes state second
- Deferred to later Phase 2 work: explicit import action runtime, import command, import modal, Vault file picker, user-facing partial-success and retry copy, cache rebuild decisions, startup hydration, orphan-cache cleanup, rollback, and stronger concurrency protection

Phase 2D1 status inside Phase 2:

- Implemented now: detached minimal end-to-end import runtime flow that validates an explicit request, reads an initial state baseline, inspects one Vault source, prepares the import payload, and delegates final latest-state cache-first persistence to Phase 2C3
- Deferred to later Phase 2 work: command registration, import modal, Vault file picker, novel id generation, user-facing Notices, retry copy, cache rebuild decisions, startup hydration, orphan-cache cleanup, rollback, and stronger concurrency protection

Phase 2D2 status inside Phase 2:

- Implemented now: lazy desktop-only import command, minimal import modal, on-demand Vault TXT or Markdown metadata picker, UI-side `novelId` plus `operationAt` generation, busy duplicate blocking, localized Notices, and exact-same-request retry preservation above the existing detached runtime flow
- The same Phase 2D2 branch now also hardens source-picker lifecycle ownership so each import modal keeps only one picker, modal close cascades picker close, and late picker callbacks become safe no-ops
- Deferred to later Phase 2 work: reader auto-open, reader UI, sidebar or status-bar surfaces, richer import management UI, delete or reimport controls, cache rebuild tools, startup hydration, orphan-cache cleanup, rollback, and stronger concurrency protection

### Phase 3: study records and exchange engine

- Add the study-record modal
- Implement configurable conversion rules
- Implement carryover balance handling
- Enforce daily unlock caps
- Separate unlock progress from reading progress in persistence and UI

Phase 3A status inside Phase 3:

- Implemented now: detached pure study-minute exchange engine with calculation preview plus immutable store application only
- Deferred to later Phase 3 work: latest-state reads, chapter-cache reads, persistence orchestration for study exchange, study-record UI, reader UI, sidebar/status-bar surfaces, timers, and reading-progress interactions

Phase 3B1 status inside Phase 3:

- Implemented now: detached study-exchange persistence runtime that validates explicit study requests before IO, reads current state once to resolve target cache identity, reads one explicit chapter cache, rereads the latest state, aborts on target changes, applies the Phase 3A engine against that latest store, and attempts one state write
- Deferred to later Phase 3 work: study-record command or modal entry, caller-owned retry UX for outcome-unknown writes, read-back verification, rollback, locking or CAS, reader UI, sidebar/status-bar surfaces, timers, and reading-progress interactions

Phase 3B2A status inside Phase 3:

- Implemented now: detached pure replay-inspection engine that validates and snapshots an explicit request, requires a canonical current-schema store, classifies replay evidence, reconstructs target study/unlock history, recalculates expected outcome through Phase 3A, and checks current study-related progress consistency
- Deferred to later Phase 3 work: latest-state plus cache reread orchestration for recovery, caller-owned retry UX, read-back verification, rollback, locking or CAS, study-record command or modal entry, reader UI, sidebar/status-bar surfaces, timers, and reading-progress interactions

Phase 3B2B status inside Phase 3:

- Implemented now: detached read-only replay recovery runtime that validates and snapshots the exact original request before IO, reads current state once to lock target cache identity, reads one canonical chapter-index cache, rereads the latest state, revalidates target identity, and delegates final evidence classification to the Phase 3B2A pure inspector
- Deferred to later Phase 3 work: read-back verification, rollback, locking or CAS, reader UI, sidebar/status-bar surfaces, timers, and reading-progress interactions

Phase 3C1 status inside Phase 3:

- Implemented now: a lazily reachable desktop `reward-reader-record-study` command and a minimal study-record modal above the existing detached Phase 3B1 and Phase 3B2B runtime layers
- Implemented now: on-demand imported-novel dropdown loading through the existing read-only adapter, strict positive-minute validation, optional note input, fixed local `30 / null / null` policy display, and one-time UI-side study id plus unlock id plus timestamp generation on the first valid submit only
- Implemented now: one in-memory pending same-request recovery snapshot per enabled feature session, one active study modal at a time, explicit Phase 3B2B saved-result checks, evidence-only `not-observed`, explicit exact-request retry only after `not-observed`, blocked replay states for conflicting evidence, and two-step local discard of pending recovery state
- Implemented now: UI-side strict runtime-result classification so only a fully valid persisted or replay-confirmed payload can clear pending state, malformed study results stay unresolved as `needs-check`, malformed replay results stay blocked, and success summaries are extracted before pending is cleared
- Implemented now: unified async `finally` release for submit, replay check, and exact retry so busy state is always released even if runtime invocation, result getters, success-summary construction, notice creation, pending replacement, or late render paths throw unexpectedly
- Implemented now: the exact same request identity must be acknowledged into memory-only pending storage before the first Phase 3B1 submit begins; if local pending preservation fails, no study write is attempted
- Implemented now: exact retry pre-transitions the stored request back to `needs-check` and waits for that local transition to be acknowledged before Phase 3B1 is invoked again, while preserving the same request identity, timestamp, policy, minutes, content, and novel id
- Implemented now: successful persistence does not imply that local pending clear also succeeded; if local clear or state-update acknowledgement fails, the modal stays on a conservative recovery surface instead of pretending a fresh form or discard transition already happened
- Implemented now: feature-disable and plugin-unload cleanup that closes the modal, invalidates the current UI session, and clears the in-memory pending recovery snapshot without persisting it
- Deferred to later Phase 3 work: configurable exchange settings, quick-duration shortcuts, persistent pending recovery across reload, richer study history inspection UI, reader UI, sidebar/status-bar surfaces, timers, and reading-progress interactions

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
