# NestKit test plan

## Reward Reader Phase 1A foundation

1. Confirm Reward Reader is disabled by default in settings.
2. Confirm plugin `onload()` registers the `reward-reader` feature through the existing `FeatureRegistry` and `FeatureManager` path only.
3. Confirm enabling Reward Reader activates the feature shell without registering commands.
4. Confirm enabling Reward Reader activates the feature shell without registering a view.
5. Confirm enabling Reward Reader activates the feature shell without creating a status bar item.
6. Confirm enabling Reward Reader activates the feature shell without creating a ribbon button.
7. Confirm enabling Reward Reader activates the feature shell without creating a sidebar entry.
8. Confirm enabling Reward Reader does not add a Vault listener.
9. Confirm enabling Reward Reader does not add a layout-change listener.
10. Confirm enabling Reward Reader does not start a timer.
11. Confirm disabling Reward Reader leaves no runtime side effects behind.
12. Confirm plugin `onload()` does not scan the vault for Reward Reader while the feature remains disabled.
13. Confirm plugin `onload()` does not read any novel source file for Reward Reader.
14. Confirm plugin `onload()` does not create `.nestkit/reward-reader`.
15. Confirm plugin `onload()` does not create `.nestkit/reward-reader/state.json`.
16. Confirm plugin `onload()` does not create `.nestkit/reward-reader/indexes`.
17. Confirm the `General` / `常规` tab contains `Enable Reward Reader` alongside the other top-level feature toggles.
18. Confirm the dedicated `Reward Reader` / `小说解锁阅读` tab contains only the foundational settings from Phase 1A.
19. Confirm the Reward Reader tab does not expose novel file path, status bar, sidebar, quick-duration, undo, export, rebuild-index, or clear-progress controls yet.
20. Confirm missing Reward Reader settings fields migrate to defaults without bumping plugin settings schema `1`.
21. Confirm `rewardReaderMinutesPerUnit` defaults to `30`.
22. Confirm `rewardReaderChaptersPerUnit` defaults to `1`.
23. Confirm `rewardReaderCarryOverMinutes` defaults to `true`.
24. Confirm `rewardReaderDailyUnlockCap` defaults to `4`.
25. Confirm `rewardReaderUnreadInventoryCap` defaults to `3`.
26. Confirm `rewardReaderRequireStudyContent` defaults to `true`.
27. Confirm `rewardReaderDefaultReadingMode` defaults to `continuous`.
28. Confirm invalid Reward Reader booleans fall back to defaults during settings migration.
29. Confirm `NaN`, `Infinity`, negative values, and out-of-range Reward Reader numeric settings fall back to defaults during settings migration.
30. Confirm `rewardReaderDailyUnlockCap = 0` is accepted as a valid unlimited setting value.
31. Confirm `rewardReaderUnreadInventoryCap = 0` is accepted as a valid unlimited setting value.
32. Confirm an invalid `rewardReaderDefaultReadingMode` falls back to `continuous`.
33. Confirm Reward Reader store schema helpers use `schemaVersion = 1`.
34. Confirm Reward Reader chapter-index cache helpers use `schemaVersion = 1`.
35. Confirm `normalizeRewardReaderStore(undefined)` or another invalid raw input returns the default store shape without auto-persisting a replacement.
36. Confirm a valid schema-`1` Reward Reader store round-trips without forced future-version protection.
37. Confirm a future Reward Reader store schema returns `hasUnsupportedFutureVersion = true`.
38. Confirm a future Reward Reader store schema returns `shouldPersist = false`.
39. Confirm duplicate Reward Reader novel ids are handled deterministically instead of overwriting unpredictably.
40. Confirm a dangling `primaryNovelId` normalizes to `null`.
41. Confirm progress entries for unknown novels are discarded during Reward Reader store normalization.
42. Confirm invalid study, unlock, and reading history records are filtered out during Reward Reader store normalization.
43. Confirm external absolute paths do not pass Reward Reader source-path normalization.
44. Confirm only Vault-relative `.txt` and `.md` source paths remain valid in the current Reward Reader source model.
45. Confirm chapter-index cache entries normalize into ascending, continuous `chapterIndex` order starting at `0`.
46. Confirm invalid chapter-index offsets are filtered or cause the cache to normalize safely.
47. Confirm this phase still does not implement a Reward Reader storage adapter, file IO, chapter parser, exchange engine, or reader view.

## Reward Reader Phase 1A hardening

1. Confirm UUID-style safe ids such as `550e8400-e29b-41d4-a716-446655440000` pass Reward Reader id validation.
2. Confirm a novel id such as `../../x` is rejected.
3. Confirm a novel id such as `a/b` is rejected.
4. Confirm `getRewardReaderChapterIndexCachePath(...)` throws instead of generating a path for an invalid novel id.
5. Confirm `rewardReaderMinutesPerUnit = 30.5` falls back to the default value during settings migration.
6. Confirm `rewardReaderChaptersPerUnit = 1.5` falls back to the default value during settings migration.
7. Confirm `rewardReaderDailyUnlockCap = 0` remains valid.
8. Confirm `rewardReaderUnreadInventoryCap = 0` remains valid.
9. Confirm a completely invalid raw chapter-index cache returns `cache = null`.
10. Confirm a cache with an invalid `sourcePath` returns `cache = null`.
11. Confirm a future chapter-index cache keeps `shouldPersist = false`.
12. Confirm duplicate or overlapping chapter offsets make the cache unusable.
13. Confirm a chapter `endOffset` beyond the text-offset upper bound makes the cache unusable.
14. Confirm a valid non-overlapping chapter cache still passes normalization.
15. Confirm `unlockedThroughChapterIndex = null` together with non-null read progress discards the progress entry.
16. Confirm `currentChapterIndex` beyond the unlock boundary discards the progress entry.
17. Confirm `studyMinuteBalance > totalStudyMinutes` discards the progress entry.
18. Confirm `todayUnlockDate = null` together with `todayUnlockedChapters > 0` discards the progress entry.
19. Confirm duplicate study-record ids keep only the first retained record.
20. Confirm unlock records with dangling `studyRecordId` references are discarded.
21. Confirm unlock records whose referenced study record belongs to another novel are discarded.
22. Confirm a future Reward Reader store still keeps `shouldPersist = false`.

## Reward Reader Phase 1A final boundary cleanup

1. Confirm `sourceSize` may be larger than `sourceTextLength` for multibyte source text without invalidating an otherwise valid cache.
2. Confirm a Chinese sample text proves `Buffer.byteLength(text, 'utf8') !== text.length`.
3. Confirm valid chapter offsets now validate against `sourceTextLength`, not against `sourceSize`.
4. Confirm `endOffset <= sourceTextLength` passes normalization.
5. Confirm `endOffset > sourceTextLength` makes the cache unusable.
6. Confirm `endOffset > sourceTextLength` still fails even when `endOffset < sourceSize`.
7. Confirm `sourceTextLength = 0` with non-empty `chapters` makes the cache unusable.
8. Confirm `sourceTextLength > 0` with `chapters = []` remains a valid normalized cache state.
9. Confirm missing `chapters` makes the cache unusable.
10. Confirm non-array `chapters` makes the cache unusable.
11. Confirm any invalid single chapter entry makes the whole cache unusable instead of preserving a partial chapter list.
12. Confirm a complete but unordered chapter list can still be sorted by `chapterIndex` and retained.
13. Confirm an invalid raw Reward Reader root store returns the default runtime store.
14. Confirm an invalid raw Reward Reader root store keeps `shouldPersist = false`.
15. Confirm a future Reward Reader store still keeps `shouldPersist = false`.
16. Confirm a future Reward Reader chapter-index cache still keeps `shouldPersist = false`.
17. Confirm reading action `opened` remains valid.
18. Confirm reading action `marked-read` remains valid.
19. Confirm reading action `position-updated` is rejected.
20. Confirm normalized reading records no longer retain `scrollOffset`.
21. Confirm a `progressByNovelId` key mismatch with the internal `novelId` discards that progress entry immediately.
22. Confirm the earlier Phase 1A foundation and hardening assertions still pass after this final boundary cleanup.

## Reward Reader Phase 2A pure chapter parser

1. Confirm `parseRewardReaderChapters(sourceText)` stays detached pure logic and can be exercised without `Vault`, a storage adapter, or feature startup wiring.
2. Confirm an empty source string returns `chapters = []`, `sourceTextLength = 0`, `detectedHeadingCount = 0`, `ignoredPrefixLength = 0`, and one warning instead of throwing.
3. Confirm a non-empty source with no detected chapter heading returns `chapters = []`, `detectedHeadingCount = 0`, `ignoredPrefixLength = sourceText.length`, and one warning instead of auto-wrapping the full text as a chapter.
4. Confirm Chinese Arabic-number headings such as `第1章`, `第 1 章`, `第001章`, `第 001 章`, and `第１章` are detected.
5. Confirm Chinese numeral headings such as `第一章`, `第二十三章`, `第一百零二章`, and `第一千章` are detected.
6. Confirm English headings such as `Chapter 1`, `chapter 1`, `CHAPTER 1`, `Chapter 001`, and `Chapter 1: Introduction` are detected.
7. Confirm built-in separators also accept title forms such as `第1章 初见`, `第 1 章：初见`, `第一章、初见`, and `Chapter 1 Introduction`.
8. Confirm Markdown heading forms such as `# 第一章`, `## 第2章 离开`, and `### Chapter 3 Return` are detected, while `#第一章` without a separating space is not.
9. Confirm headings may be indented with leading spaces or tabs, but `startOffset` still points to the real raw line start including that indent and any Markdown marker.
10. Confirm `title` normalization removes a leading BOM, leading indent, Markdown heading prefix, and outer whitespace, while preserving the original chapter wording and punctuation.
11. Confirm `sourceTextLength` always equals the original `sourceText.length` in JavaScript UTF-16 code units and that offsets are not recomputed from byte length or a normalized copy.
12. Confirm `LF`, `CRLF`, standalone `CR`, a final line without newline, and a final line with trailing newline all keep valid `startOffset` / `endOffset` behavior.
13. Confirm `sourceText.slice(startOffset, endOffset)` returns the original raw chapter slice, including original Markdown markers and indentation when present.
14. Confirm `ignoredPrefixLength` equals the exact raw prefix length before the first detected heading and that preface content does not create a synthetic chapter `0`.
15. Confirm ordinary body-text mentions such as `我读到了第一章`, `查看第3章内容`, and `The phrase Chapter 2 appears in this paragraph.` do not produce headings.
16. Confirm false-positive forms such as `第1章节`, `第一章鱼`, and `Chapterhouse 1` do not produce headings.
17. Confirm duplicate visible chapter numbers and chapter-number gaps still produce sequential internal `chapterIndex` values starting at `0`, in textual appearance order only.
18. Confirm a large synthetic novel with roughly `1000` to `3000` chapters parses successfully, returns the expected chapter count, keeps the final chapter `endOffset = sourceText.length`, and does not copy chapter bodies into the parse result.

## Reward Reader Phase 2B1 Vault source boundary

1. Confirm the pure chapter-cache builder can assemble an in-memory `RewardReaderChapterIndexCache` from a valid TXT source string plus explicit metadata without importing Obsidian.
2. Confirm the pure chapter-cache builder can assemble an in-memory `RewardReaderChapterIndexCache` from a valid Markdown source string plus explicit metadata.
3. Confirm the pure chapter-cache builder keeps `sourceTextLength = sourceText.length`.
4. Confirm the pure chapter-cache builder keeps `sourceSize` equal to the caller-provided file byte size rather than recomputing it from `sourceText.length`.
5. Confirm the pure chapter-cache builder reuses parser chapter entries rather than creating a second chapter-body copy.
6. Confirm the pure chapter-cache builder result does not include `sourceText`.
7. Confirm the pure chapter-cache builder trims `generatedAt` before writing it into the assembled cache.
8. Confirm an invalid `generatedAt` causes the pure chapter-cache builder to return `cache = null` and `parseResult = null`.
9. Confirm an invalid novel id causes the pure chapter-cache builder to return `cache = null` and `parseResult = null` without creating a synthetic cache.
10. Confirm an invalid normalized `sourcePath` causes the pure chapter-cache builder to return `cache = null` and `parseResult = null`.
11. Confirm invalid `sourceMtime` and invalid `sourceSize` each cause the pure chapter-cache builder to return `cache = null` and `parseResult = null`.
12. Confirm a no-chapter parse result causes the pure chapter-cache builder to return `cache = null` while preserving a real non-null parser result and parser warnings.
13. Confirm preface text before the first heading still allows cache creation and preserves the ignored-prefix warning.
14. Confirm a builder-created cache still passes the existing chapter-cache normalization boundary.
15. Confirm the builder trims `sourcePath` before writing it into the assembled cache.
16. Confirm a large invalid-metadata input returns quickly without requiring a full parse and still returns `parseResult = null`.
17. Confirm Vault-relative path validation accepts paths such as `Books/novel.txt`, `小说/长篇小说.txt`, `novel.TXT`, and `novel.MD`.
18. Confirm Vault-relative path validation rejects empty strings, leading `/`, Windows absolute paths, traversal forms such as `../novel.txt`, URLs, `file://` paths, and NUL-containing strings before Vault lookup.
19. Confirm a Vault-relative backslash path such as `Books\\novel.txt` follows the implemented `normalizePath(...)` rule and is handled consistently.
20. Confirm the post-normalization path cannot contain traversal segments before Vault lookup.
21. Confirm a supported TXT source maps to `sourceKind = vault-txt`.
22. Confirm a supported Markdown source maps to `sourceKind = vault-markdown`.
23. Confirm unsupported extensions such as `.pdf`, `.epub`, or no-extension files fail before Vault lookup and before `vault.read`.
24. Confirm a folder path returns `source-not-file`.
25. Confirm a missing file returns `source-not-found`.
26. Confirm a thrown `vault.read(...)` error returns `source-read-failed` with the stable generic read-failure message.
27. Confirm the stable read-failure message and warnings do not leak raw adapter text such as absolute paths, usernames, or `ENOENT`.
28. Confirm one successful inspection call uses `vault.read(...)` exactly once.
29. Confirm the inspection path never calls `cachedRead(...)`.
30. Confirm the inspection path never calls `adapter.read(...)`.
31. Confirm unsupported source types perform zero Vault lookup and zero `vault.read(...)` calls.
32. Confirm invalid source paths perform zero Vault lookup and zero `vault.read(...)` calls.
33. Confirm a file with no detected chapters returns `ok = false` and `code = no-chapters-detected`.
34. Confirm a cache-assembly failure after a successful read returns `ok = false` and `code = chapter-index-build-failed`.
35. Confirm a cache-assembly failure no longer reuses `source-read-failed`.
36. Confirm a successful inspection result does not include `sourceText`.
37. Confirm a successful inspection result includes correct `sourceMtime`, `sourceSize`, `sourceTextLength`, `chapterCount`, and `ignoredPrefixLength`.
38. Confirm a successful inspection result returns an assembled cache without chapter-body copies.
39. Confirm a 5 MB scale mock Vault source with at least `5000` chapters succeeds, uses one `vault.read(...)` call, returns the expected chapter count, keeps `cache.sourceTextLength`, keeps `cache.sourceSize`, keeps `last endOffset = sourceText.length`, and still does not return `sourceText`.

## Reward Reader Phase 2B2 pure import assembly

1. Confirm a valid inspection result plus an empty normalized store can prepare an import payload successfully.
2. Confirm the success result returns `ok = true`.
3. Confirm `payload.novel.id` comes from `inspection.cache.novelId`.
4. Confirm `payload.novel.title` uses `title.trim()`.
5. Confirm `payload.novel.sourcePath` comes from the inspection result.
6. Confirm `payload.novel.sourceKind` comes from the inspection result.
7. Confirm `payload.novel.sourceMtime` comes from the inspection result.
8. Confirm `payload.novel.sourceSize` comes from the inspection result.
9. Confirm `payload.novel.createdAt` uses `preparedAt.trim()`.
10. Confirm `payload.novel.updatedAt` initially matches `createdAt`.
11. Confirm `payload.progress.novelId` matches the prepared novel id.
12. Confirm `payload.progress.unlockedThroughChapterIndex = null`.
13. Confirm `payload.progress.readThroughChapterIndex = null`.
14. Confirm `payload.progress.currentChapterIndex = null`.
15. Confirm `payload.progress.currentChapterScrollOffset = 0`.
16. Confirm `payload.progress.studyMinuteBalance = 0`.
17. Confirm `payload.progress.totalStudyMinutes = 0`.
18. Confirm `payload.progress.todayUnlockDate = null`.
19. Confirm `payload.progress.todayUnlockedChapters = 0`.
20. Confirm `payload.progress.updatedAt` uses the normalized `preparedAt`.
21. Confirm import preparation does not create any study record.
22. Confirm import preparation does not create any unlock record.
23. Confirm import preparation does not create any reading record.
24. Confirm an empty store plus `makePrimary = false` still makes the first imported novel primary.
25. Confirm an empty store plus `makePrimary = true` also makes the first imported novel primary.
26. Confirm a non-empty store plus `makePrimary = true` makes the new novel primary.
27. Confirm a non-empty store plus `makePrimary = false` preserves the existing primary novel id.
28. Confirm a non-empty store with `primaryNovelId = null` plus `makePrimary = false` still preserves `null`.
29. Confirm title outer whitespace is trimmed before writing the prepared novel.
30. Confirm an empty title returns `invalid-title`.
31. Confirm an all-whitespace title returns `invalid-title`.
32. Confirm a title containing NUL returns `invalid-title`.
33. Confirm a title containing LF returns `invalid-title`.
34. Confirm a title containing CR returns `invalid-title`.
35. Confirm `preparedAt` outer whitespace is trimmed before writing the prepared payload.
36. Confirm an empty `preparedAt` returns `invalid-prepared-at`.
37. Confirm an invalid `preparedAt` returns `invalid-prepared-at`.
38. Confirm the import-preparation function does not call current-time APIs internally.
39. Confirm a non-current Reward Reader store schema returns `unsupported-store-schema`.
40. Confirm a `primaryNovelId` that points to no existing novel returns `invalid-existing-store`.
41. Confirm duplicate existing novel ids return `invalid-existing-store`.
42. Confirm a non-array `novels` field returns `invalid-existing-store`.
43. Confirm a non-object `progressByNovelId` field returns `invalid-existing-store`.
44. Confirm non-array history fields return `invalid-existing-store`.
45. Confirm an existing novel with the same id as the prepared import returns `duplicate-novel-id`.
46. Confirm a conflicting orphan `progressByNovelId[novelId]` entry returns `conflicting-existing-progress`.
47. Confirm an existing novel with the same `sourcePath` returns `duplicate-source-path`.
48. Confirm a different `sourcePath` can still import successfully.
49. Confirm `sourcePath` comparison stays exact and does not lowercase paths automatically.
50. Confirm conflict failures do not return a partial payload.
51. Confirm mismatched `inspection.chapterCount` versus `cache.chapters.length` returns `inconsistent-inspection`.
52. Confirm mismatched `inspection.sourcePath` versus `cache.sourcePath` returns `inconsistent-inspection`.
53. Confirm mismatched `sourceMtime` returns `inconsistent-inspection`.
54. Confirm mismatched `sourceSize` returns `inconsistent-inspection`.
55. Confirm mismatched `sourceTextLength` returns `inconsistent-inspection`.
56. Confirm mismatched `sourceKind` versus source-path extension returns `inconsistent-inspection`.
57. Confirm a cache with no chapters returns `inconsistent-inspection`.
58. Confirm an invalid cache novel id returns `inconsistent-inspection`.
59. Confirm an unexpected cache schemaVersion returns `inconsistent-inspection`.
60. Confirm `ignoredPrefixLength > sourceTextLength` returns `inconsistent-inspection`.
61. Confirm an invalid `cache.generatedAt` returns `inconsistent-inspection`.
62. Confirm any other failed inspection self-consistency boundary returns `inconsistent-inspection`.
63. Confirm `existingStore` is unchanged after import preparation.
64. Confirm `existingStore.novels` contents are unchanged after import preparation.
65. Confirm `existingStore.progressByNovelId` is unchanged after import preparation.
66. Confirm `existingStore.studyRecords` is unchanged after import preparation.
67. Confirm `existingStore.unlockRecords` is unchanged after import preparation.
68. Confirm `existingStore.readingRecords` is unchanged after import preparation.
69. Confirm the inspection object is unchanged after import preparation.
70. Confirm `inspection.cache` is unchanged after import preparation.
71. Confirm `inspection.warnings` is unchanged after import preparation.
72. Confirm chapter entries inside `inspection.cache.chapters` are unchanged after import preparation.
73. Confirm `payload.cache === inspection.cache`.
74. Confirm `payload.cache.chapters === inspection.cache.chapters`.
75. Confirm import preparation does not duplicate chapter entries.
76. Confirm the prepared payload does not include `sourceText`.
77. Confirm the prepared novel does not include `sourceText`.
78. Confirm the prepared progress does not include `sourceText`.
79. Confirm the prepared payload still does not include chapter body text.
80. Confirm the output scale does not grow with unavailable novel body text because import preparation never receives `sourceText`.
81. Confirm success results preserve inspection warnings.
82. Confirm the original `inspection.warnings` array remains unchanged.
83. Confirm success results return a distinct warnings array instance.
84. Confirm exact duplicate warnings can be removed while preserving stable order.
85. Confirm warnings never include `sourceText`.
86. Confirm `inspection = null` does not throw and returns `inconsistent-inspection`.
87. Confirm `inspection = undefined` does not throw and returns `inconsistent-inspection`.
88. Confirm an empty-object inspection does not throw and returns `inconsistent-inspection`.
89. Confirm `inspection.ok = false` returns `inconsistent-inspection`.
90. Confirm missing `inspection.warnings` returns `inconsistent-inspection`.
91. Confirm non-array `inspection.warnings` returns `inconsistent-inspection`.
92. Confirm non-string entries inside `inspection.warnings` return `inconsistent-inspection`.
93. Confirm `makePrimary = true` is accepted.
94. Confirm `makePrimary = false` is accepted.
95. Confirm string `makePrimary` values such as `"false"` return `invalid-make-primary`.
96. Confirm numeric `makePrimary` values such as `0` or `1` return `invalid-make-primary`.
97. Confirm `makePrimary = null` or `undefined` returns `invalid-make-primary`.
98. Confirm invalid `makePrimary` does not return a payload.
99. Confirm the first chapter must use `chapterIndex = 0`.
100. Confirm the first chapter `startOffset` must equal `ignoredPrefixLength`.
101. Confirm the first chapter fails when `startOffset` is not a non-negative integer.
102. Confirm the first chapter fails when `endOffset <= startOffset`.
103. Confirm the first chapter title must stay non-empty after `trim()`.
104. Confirm the last chapter must use `chapterIndex = chapters.length - 1`.
105. Confirm the last chapter `endOffset` must equal `sourceTextLength`.
106. Confirm the last chapter fails when `endOffset` is not a non-negative integer.
107. Confirm the last chapter fails when `endOffset <= startOffset`.
108. Confirm the last chapter title must stay non-empty after `trim()`.
109. Confirm non-empty chapters plus `sourceTextLength = 0` return `inconsistent-inspection`.
110. Confirm the hardened large-cache path still succeeds with `5000` chapters.
111. Confirm the hardened large-cache path still preserves `payload.cache === inspection.cache`.
112. Confirm the hardened large-cache path still preserves `payload.cache.chapters === inspection.cache.chapters`.
113. Confirm the hardened large-cache path still does not duplicate chapter entries.
114. Confirm the hardened large-cache path still does not return `sourceText`.
115. Confirm the hardened path still does not return a full copied `nextStore`.
116. Confirm empty-store import still succeeds after the hardening pass.
117. Confirm duplicate novel id failure still works after the hardening pass.
118. Confirm duplicate source-path failure still works after the hardening pass.
119. Confirm conflicting progress failure still works after the hardening pass.
120. Confirm the first imported novel still becomes primary automatically after the hardening pass.
121. Confirm existing primary is still preserved when `makePrimary = false`.
122. Confirm `existingStore` remains unchanged after the hardening pass.
123. Confirm the inspection object remains unchanged after the hardening pass.
124. Confirm the original warnings array remains unchanged after the hardening pass.
125. Confirm success warnings still use a distinct array instance after the hardening pass.

## Reward Reader Phase 2B3 pure store patch application

1. Confirm a valid existing store plus valid prepared import success applies successfully.
2. Confirm the success result returns a new `nextStore` root object.
3. Confirm `nextStore.schemaVersion` stays at the current Reward Reader store schema.
4. Confirm `nextStore.primaryNovelId` uses the validated prepared primary result.
5. Confirm `nextStore.novels` adds exactly one novel.
6. Confirm `nextStore.progressByNovelId` adds exactly one progress entry for the new novel id.
7. Confirm `result.cache === preparedImport.payload.cache`.
8. Confirm `result.cache.chapters === preparedImport.payload.cache.chapters`.
9. Confirm success warnings preserve legal prepared warnings in a distinct array.
10. Confirm the new novel object is a shallow copy and not the same object as `payload.novel`.
11. Confirm the new progress object is a shallow copy and not the same object as `payload.progress`.
12. Confirm existing novel object references are preserved.
13. Confirm existing progress entry references are preserved.
14. Confirm `studyRecords`, `unlockRecords`, and `readingRecords` keep the same array references.
15. Confirm `existingStore`, `preparedImport`, payload objects, cache, chapters, and original warnings are not mutated.
16. Confirm `existingStore = null` and `existingStore = undefined` do not throw.
17. Confirm unsupported store schema returns `unsupported-store-schema`.
18. Confirm malformed existing store roots, arrays, progress map, history arrays, primary id, novels, duplicate novel ids, and duplicate source paths return `invalid-existing-store`.
19. Confirm `preparedImport = null` and `preparedImport = undefined` do not throw.
20. Confirm malformed prepared import roots, missing payload, missing warnings, non-array warnings, or non-string warning entries return `invalid-prepared-import` without a partial `nextStore`.
21. Confirm invalid novel id, title, source path, source kind, source metadata, or created/updated timestamps return `invalid-prepared-import`.
22. Confirm invalid initial progress values, mismatched `progress.novelId`, or mismatched `progress.updatedAt` return `invalid-prepared-import`.
23. Confirm invalid cache schema, identity fields, text length, generated timestamp, empty chapters, first chapter boundary, or last chapter boundary return `invalid-prepared-import`.
24. Confirm duplicate current novel id is rechecked and returns `duplicate-novel-id`.
25. Confirm duplicate current source path is rechecked with exact string comparison and returns `duplicate-source-path`.
26. Confirm an orphan current progress entry for the new novel id is rechecked and returns `conflicting-existing-progress`.
27. Confirm stale or invalid `primaryNovelIdAfterImport` returns `invalid-primary-after-import`.
28. Confirm the first novel must become primary.
29. Confirm an existing non-null primary may stay unchanged or switch to the new novel only.
30. Confirm an existing `null` primary may stay `null` or switch to the new novel only.
31. Confirm applying the same prepared import to the first success `nextStore` fails with `duplicate-novel-id` and does not add a second novel.
32. Confirm a large cache with `5000` chapters preserves cache and chapters identity without cloning chapter entries.
33. Confirm large existing history arrays preserve identity, do not gain records, and are not copied.
34. Confirm the result and `nextStore` do not include `sourceText` or chapter body text.
35. Confirm the `nextStore` does not include the chapter-index cache.
36. Confirm store patch application does not create `.nestkit`, write state or cache files, register runtime surfaces, or enter startup.

## Reward Reader Phase 2C1 read-only storage adapter

1. Confirm missing state returns `ok = true`, `status = missing`, a fresh default store, `shouldPersist = false`, and no warnings.
2. Confirm missing state calls `adapter.exists(...)` once and does not call `adapter.read(...)`.
3. Confirm a valid state JSON returns `status = ready`, preserves normalized store fields, uses one read, and keeps warnings as a distinct array.
4. Confirm a safely normalizable current-schema state returns `status = normalized`, `shouldPersist = true`, and does not write the normalized data.
5. Confirm invalid state JSON returns `state-invalid-json` without returning a store or raw JSON.
6. Confirm state roots such as `null`, arrays, strings, and numbers return `state-invalid-data` without falling back to a successful default store.
7. Confirm a future state schema returns `state-unsupported-version`, preserves sanitized normalization warnings, and does not expose a writable store.
8. Confirm state `exists` and `read` failures return `state-read-failed` with stable messages that do not include original paths, stacks, or raw adapter errors.
9. Confirm invalid cache novel ids are rejected before any adapter IO.
10. Confirm missing chapter cache returns `ok = true`, `status = missing`, `cache = null`, `shouldPersist = false`, and no warnings.
11. Confirm missing chapter cache calls `adapter.exists(...)` once and does not call `adapter.read(...)`.
12. Confirm a valid chapter cache JSON returns `status = ready`, preserves source metadata and chapters, uses one read, and does not write.
13. Confirm a safely normalizable current-schema chapter cache returns `status = normalized`, `shouldPersist = true`, and does not write the normalized data.
14. Confirm invalid cache JSON returns `chapter-cache-invalid-json` without returning raw JSON.
15. Confirm cache roots such as `null`, arrays, and strings return `chapter-cache-invalid-data`.
16. Confirm unusable normalized cache data such as missing chapters, non-array chapters, overlapping chapters, out-of-bounds offsets, or `sourceTextLength = 0` with chapters returns `chapter-cache-invalid-data`.
17. Confirm a future chapter-cache schema returns `chapter-cache-unsupported-version` and does not expose a cache for mutation or persistence.
18. Confirm a chapter cache whose internal `novelId` does not match the requested novel id returns `chapter-cache-invalid-data` without repairing the id.
19. Confirm chapter cache `exists` and `read` failures return `chapter-cache-read-failed` with stable messages that do not include original paths, stacks, or raw adapter errors.
20. Confirm each state read calls `exists` at most once and `read` at most once.
21. Confirm each cache read calls `exists` at most once and `read` at most once.
22. Confirm the adapter never calls `adapter.list(...)` or write operations.
23. Confirm the adapter does not scan the indexes folder or read all caches after loading state.
24. Confirm large state JSON with thousands of study, unlock, and reading records reads successfully without write calls.
25. Confirm a `5000` chapter cache reads successfully without list, write, stack overflow, or loop failure.
26. Confirm the module stays detached from startup, feature enablement, commands, listeners, views, and settings UI.

## Heading Progress Phase 1A status bar MVP

1. Confirm Heading Progress is disabled by default in settings.
2. Confirm enabling Heading Progress creates a compact bottom-right status bar item only for the active Markdown editor path.
3. Confirm disabling Heading Progress removes its status bar item immediately.
4. Confirm disabling Heading Progress also removes feature-owned workspace listeners, editor DOM listeners, and pending debounce timers.
5. Confirm plugin `onload()` does not parse headings or Markdown files for Heading Progress while the feature remains disabled.
6. Confirm a file with `H1` headings treats `H1` as the top-level heading level.
7. Confirm a file with no `H1` and only `H2` headings treats `H2` as the top-level heading level.
8. Confirm a file with no `H1` or `H2` and only `H3` headings treats `H3` as the top-level heading level.
9. Confirm a file with `H2` sections containing `H3` and `H4` content still keeps the whole nested content inside the current `H2` main block.
10. Confirm the current main block starts from the nearest top-level heading above the current position.
11. Confirm the current main block ends before the next heading of the same top-level level.
12. Confirm lower-level subheadings do not split the current main block when they are below the file's detected top-level level.
13. Confirm `viewport-center` mode uses the editor viewport center as the progress source.
14. Confirm `cursor-position` mode uses the active cursor line as the progress source.
15. Confirm the default progress source is `viewport-center`.
16. Confirm the default display mode is `bar-and-percent`.
17. Confirm `percent-only` shows the heading label plus percentage without the mini bar.
18. Confirm `bar-only` shows the heading label plus mini bar without the percentage text.
19. Confirm `bar-and-percent` shows the heading label, percentage, and mini bar together.
20. Confirm a file with no headings hides the status bar item when `hideHeadingProgressWhenNoHeading` is enabled.
21. Confirm a file with no active top-level heading position above the first heading also hides the status bar item when the hide setting is enabled.
22. Confirm switching the active file updates the status bar item to the new file's current main block or hides it when appropriate.
23. Confirm scroll-driven updates are debounced so rapid scrolling does not trigger excessive recalculation.
24. Confirm cursor movement updates the progress display in `cursor-position` mode.
25. Confirm editor content changes update heading boundaries and progress results for the current file.
26. Confirm active-editor content changes still trigger a reparse when the `editor-change` event arrives through a `MarkdownFileInfo` path that matches the current active Markdown file.
27. Confirm switching `headingProgressSource` while Heading Progress is enabled refreshes the status bar item immediately.
28. Confirm switching `headingProgressDisplayMode` while Heading Progress is enabled refreshes the status bar item immediately.
29. Confirm switching `hideHeadingProgressWhenNoHeading` while Heading Progress is enabled refreshes the status bar item immediately.
30. Confirm layout changes rebind the active editor safely without leaving duplicate listeners behind.
31. Confirm the feature reads only the active Markdown editor and does not perform any vault-wide scan.
32. Confirm the first implementation keeps progress line-based and does not claim pixel-based progress.
33. Confirm the status bar item stays in the bottom-right status bar area.
34. Confirm the compact status bar display can show a heading level label, percentage, and small progress bar without expanding into a large panel.
35. Confirm the tooltip can expose the current main heading title, heading level, line range, progress source, and exact percentage.
36. Confirm the `General` / `常规` tab contains the top-level feature toggles, including `Enable Heading Progress`.
37. Confirm the dedicated `Heading Progress` / `标题内进度` tab contains only progress source, display mode, and hide-when-no-active-heading controls.
38. Confirm the Heading Progress tab no longer repeats the long intro paragraph or the enable toggle.
39. Confirm the About tab summary reflects the released modules and the current-branch Heading Progress Phase 1A status.
40. Confirm the About page and **What's New** modal show the same changelog items.

## Spaced Review Phase 1 core focus

1. Confirm there are exactly 3 built-in review presets.
2. Confirm the default preset id is `standard-review`.
3. Confirm all built-in preset intervals pass `validateReviewIntervals(...)`.
4. Confirm `getBuiltInReviewPresets()` returns copies that do not mutate internal preset constants.
5. Confirm `[1, 3, 7]` is a valid cumulative interval list.
6. Confirm `[0, 1]` is invalid.
7. Confirm `[-1, 1]` is invalid.
8. Confirm `[1, 1, 3]` is invalid.
9. Confirm `[3, 1, 7]` is invalid and is not auto-sorted.
10. Confirm more than 32 intervals is invalid.
11. Confirm an interval value above `3650` is invalid.
12. Confirm `parseReviewIntervalsInput('1, 3, 7')` is valid.
13. Confirm `parseReviewIntervalsInput('1 3 7')` is valid.
14. Confirm `parseReviewIntervalsInput('1, x, 7')` is invalid.
15. Confirm `isIsoDateString('2026-06-14')` is true.
16. Confirm `isIsoDateString('2026-6-14')` is false.
17. Confirm `isIsoDateString('2026-02-30')` is false.
18. Confirm `addCalendarDays('2026-06-14', 1)` returns `2026-06-15`.
19. Confirm `addCalendarDays('2026-12-31', 1)` returns `2027-01-01`.
20. Confirm `compareIsoDates(...)` orders ISO dates correctly.
21. Confirm fixed timeline with `startDate = 2026-06-14` and `[1, 3, 7]` plans `2026-06-15`, `2026-06-17`, and `2026-06-21`.
22. Confirm `2026-06-15` returns sequence `0` as pending.
23. Confirm `2026-06-16` with `carryOver` returns sequence `0` as overdue.
24. Confirm `2026-06-16` with `skip` does not return sequence `0`.
25. Confirm `2026-06-17` with `carryOver` still returns only sequence `0` by default, not sequence `0` plus sequence `1`.
26. Confirm rolling gaps convert `[1, 3, 7]` into `[1, 2, 4]`.
27. Confirm completing sequence `0` on `2026-06-16` in rolling mode updates `rollingAnchorDate` to `2026-06-16`.
28. Confirm sequence `1` in rolling mode is then planned for `2026-06-18`.
29. Confirm fixed-mode completion does not overwrite `rollingAnchorDate`.
30. Confirm `completeOccurrence(...)` does not mutate the original task object.
31. Confirm `completeOccurrence(...)` adds the completed sequence index.
32. Confirm `completeOccurrence(...)` removes that index from `skippedSequenceIndexes`.
33. Confirm `skipOccurrence(...)` adds the skipped sequence index.
34. Confirm `skipOccurrence(...)` removes that index from `completedSequenceIndexes`.
35. Confirm completed and skipped indexes are deduplicated and sorted.
36. Confirm `createDefaultSpacedReviewStore()` uses `schemaVersion = 4`.
37. Confirm reading a missing store returns the default store.
38. Confirm invalid store JSON returns the default store plus a warning.
39. Confirm invalid tasks are discarded during store normalization.
40. Confirm `upsertReviewTask(...)` adds a task when the id is new.
41. Confirm `upsertReviewTask(...)` replaces a task when the id already exists.
42. Confirm `removeReviewTask(...)` removes the matching task id.
43. Confirm `writeSpacedReviewStore(...)` calls `ensureFolder('.nestkit/spaced-review')`.
44. Confirm `writeSpacedReviewStore(...)` writes pretty JSON.
45. Confirm reading after writing through a memory adapter restores the same task data.
46. Confirm reading a missing store returns `shouldPersist = false`.
47. Confirm invalid store JSON returns `shouldPersist = false`.
48. Confirm a non-object store returns `shouldPersist = true`.
49. Confirm a missing or invalid `schemaVersion` returns `shouldPersist = true`.
50. Confirm a clean `schemaVersion = 4` store returns `shouldPersist = false`.
51. Confirm a `schemaVersion = 4` store with normalized fields returns `shouldPersist = true`.
52. Confirm a future `schemaVersion` returns `hasUnsupportedFutureVersion = true`.
53. Confirm a future `schemaVersion` returns `shouldPersist = false`.
54. Confirm a future `schemaVersion` still exposes valid known tasks in the runtime store.
55. Confirm invalid `completedSequenceIndexes` marks `didNormalize = true`.
56. Confirm duplicate `completedSequenceIndexes` marks `didNormalize = true`.
57. Confirm unsorted `completedSequenceIndexes` marks `didNormalize = true`.
58. Confirm invalid `skippedSequenceIndexes` marks `didNormalize = true`.
59. Confirm duplicate `skippedSequenceIndexes` marks `didNormalize = true`.
60. Confirm unsorted `skippedSequenceIndexes` marks `didNormalize = true`.
61. Confirm valid completed and skipped indexes leave `didNormalize = false`.
62. Confirm `writeSpacedReviewStore(...)` still calls `ensureFolder('.nestkit/spaced-review')`.
63. Confirm `writeSpacedReviewStore(...)` still writes pretty JSON.
64. Confirm reading after writing still restores the same task data.

## Spaced Review Phase 2 create-task focus

1. Confirm Spaced Review is disabled by default in settings.
2. Confirm the command palette contains `NestKit: Create spaced review task`.
3. Confirm running the command while Spaced Review is disabled shows an enable notice.
4. Confirm the disabled command path does not create `.nestkit/spaced-review/tasks.json`.
5. Confirm enabling Spaced Review in settings immediately activates the feature through `FeatureManager.sync(...)`.
6. Confirm running the command while enabled opens the create-task modal.
7. Confirm the modal includes title, group, subgroup, start date, preset, and custom intervals fields.
8. Confirm the modal defaults `startDate` to today.
9. Confirm the modal defaults the preset to the configured default preset setting.
10. Confirm saving with an empty title is rejected.
11. Confirm saving with an invalid `YYYY-MM-DD` date is rejected.
12. Confirm saving with invalid custom intervals is rejected.
13. Confirm saving with a built-in preset creates `.nestkit/spaced-review/tasks.json`.
14. Confirm the saved task uses the entered title, start date, preset id, and preset interval snapshot.
15. Confirm saving with custom intervals overrides the preset interval snapshot.
16. Confirm new tasks start with `status = active`.
17. Confirm new tasks start with empty completed and skipped index arrays.
18. Confirm new tasks do not set `rollingAnchorDate` initially.
19. Confirm disabling Spaced Review after creating tasks does not delete `tasks.json`.
20. Confirm **Restore all defaults** resets Spaced Review settings but does not delete `tasks.json`.
21. Confirm the existing right-sidebar drawer behavior remains unchanged after enabling, disabling, and using Spaced Review.
22. Confirm `DEFAULT_SETTINGS.spacedReviewManagedBlockHeading` equals `\u4eca\u65e5\u590d\u4e60` at runtime and does not contain mojibake text.
23. Confirm the command palette does not show a duplicate `NestKit:` prefix.
24. Confirm creating a second task after `.nestkit/spaced-review` already exists still succeeds.
25. Confirm `ensureFolder('.nestkit/spaced-review')` is idempotent.
26. Confirm `.nestkit` hidden folders do not need to be visible through the Vault file tree for store read/write to succeed.
27. Confirm the vault storage adapter uses path-based `DataAdapter` read, write, exists, and mkdir calls for the store path.
28. Confirm creating a second task in real DevVault after `.nestkit/spaced-review` already exists still succeeds.
29. Confirm `Folder already exists` does not surface when parent folders already exist.
30. Confirm create-task failures show a Notice, log the error, and do not leave an unhandled promise rejection.
31. Confirm the custom intervals UI recommends space-separated input such as `1 3 7`.
32. Confirm the parser still accepts comma-separated input for compatibility.
33. Confirm the parser accepts full-width comma input such as `1\uFF0C3\uFF0C7`.

## Phase 3 settings-migration focus

1. Confirm `undefined` raw settings return `DEFAULT_SETTINGS` without warnings and without forcing an immediate save.
2. Confirm `null` raw settings return `DEFAULT_SETTINGS` without warnings and without forcing an immediate save.
3. Confirm an empty object is treated as legacy schema `0`, migrates to schema `1`, fills missing fields from defaults, and marks `shouldPersist = true`.
4. Confirm primitive raw values such as a string or number fall back to `DEFAULT_SETTINGS`, log a warning, and mark `shouldPersist = true`.
5. Confirm an array raw value falls back to `DEFAULT_SETTINGS`, log a warning, and mark `shouldPersist = true`.
6. Confirm a complete legacy `0.2.0` flat settings object is preserved, upgraded to schema `1`, and marked `shouldPersist = true`.
7. Confirm a partial legacy settings object preserves valid known fields and fills missing fields from defaults.
8. Confirm legacy unknown fields are ignored by the normalized settings object.
9. Confirm a valid schema `1` settings object round-trips without normalization and without forced persistence.
10. Confirm a schema `1` settings object with missing fields is normalized and marked `shouldPersist = true`.
11. Confirm a future schema version is recognized as unsupported, logs a warning, and keeps `shouldPersist = false`.
12. Confirm an invalid `schemaVersion` such as a string, `NaN`, `Infinity`, a negative number, or a decimal normalizes safely to schema `1`.
13. Confirm invalid boolean fields fall back to defaults.
14. Confirm invalid numeric field types fall back to defaults.
15. Confirm `NaN` and `Infinity` in numeric fields fall back to defaults.
16. Confirm out-of-range numeric settings fall back to defaults using the same ranges as the current slider UI.
17. Confirm an unknown `uiLanguage` falls back to `zh-CN`.
18. Confirm `rightSidebarDrawerEnabled = true` survives migration.
19. Confirm `rememberPinnedState = true` together with `rightSidebarPinned = true` survives migration.
20. Confirm `rememberPinnedState = false` together with `rightSidebarPinned = true` is preserved as stored preference and still relies on existing runtime logic to decide whether pinned state is restored.
21. Confirm `migrateSettings(migrateSettings(raw).settings)` is idempotent.
22. Confirm **Restore all defaults** still resets the full settings object to `DEFAULT_SETTINGS`, including `schemaVersion = 1`.
23. Confirm plugin reload after a migrated save does not trigger a second migration rewrite for already normalized schema `1` data.
24. Confirm a future schema load does not call `saveData()` during `loadSettings()`.
25. Confirm a future schema session blocks `updateSetting()` from calling `saveData()`.
26. Confirm a future schema session blocks `updateRememberPinnedState()` from calling `saveData()`.
27. Confirm a future schema session blocks `syncPersistentPinnedState()` from calling `saveData()`.
28. Confirm a future schema session blocks `clearPinnedState()` from calling `saveData()`.
29. Confirm a future schema session blocks `restoreAllDefaults()` from calling `saveData()`.
30. Confirm the blocked-persistence warning is emitted at most once per future-schema session.
31. Confirm schema `0` and schema `1` still allow ordinary `saveData()` writes after successful migration or user settings changes.
32. Confirm `migrateSettings(undefined).settings !== DEFAULT_SETTINGS`.
33. Confirm `migrateSettings(null).settings !== DEFAULT_SETTINGS`.
34. Confirm mutating a default object returned by migration does not mutate `DEFAULT_SETTINGS`.

## Phase 2 listener-scope focus

1. Enable the plugin but keep **Enable right sidebar hover drawer** off, then confirm the drawer stays inactive and the default Obsidian right sidebar behavior is unchanged.
2. Turn the drawer on for the first time in the session and confirm hover-open behavior activates normally.
3. Turn the drawer off and confirm the native right sidebar behavior returns immediately.
4. Turn the drawer on again in the same session and confirm the drawer still behaves correctly after listener re-registration.
5. Repeat the drawer on or off cycle several times and confirm there is still only one pin button, one refresh path, and no obvious duplicated listener behavior.
6. With **Remember pinned state** off, pin the drawer temporarily and confirm pointer-leave collapse stays disabled for the current session only.
7. With **Remember pinned state** on, pin the drawer, close and reopen the right sidebar, and confirm the pinned state is restored.
8. Move Behaviour, Positioning, and Advanced sliders while the drawer is enabled and confirm updates still apply immediately.
9. Switch between Simplified Chinese and English and confirm the settings tab and pin button labels still refresh correctly.
10. Click **Restore all defaults** and confirm the drawer disables, runtime pinned state clears, and defaults are restored.
11. On Windows, confirm minimize, maximize, and close remain clickable while the right sidebar is logically open.
12. Disable the plugin and confirm all NestKit UI side effects are removed and the native right sidebar behavior is restored.

## Phase 2.5 settings tabs and performance guardrails

1. Confirm the settings page has `General`, `Workspace Panel`, `Spaced Review`, and `About` tabs.
2. Confirm the default active tab is `General`.
3. Confirm the top-right actions include **What's New**, **Language**, and **Restore defaults**.
4. Confirm only the active tab content renders at a time.
5. Confirm the top active tab title is not duplicated above the tabs.
6. Confirm the Workspace Panel tab contains the existing drawer controls and sliders.
7. Confirm the Spaced Review tab contains the existing review settings.
8. Confirm the About tab shows local static version and phase 2.5 text.
9. Confirm **What's New** opens local static content and does not call `fetch()`.
10. Confirm **Language** reuses the existing plugin language setting and does not add a new schema field.
11. Confirm **Restore defaults** resets settings only and does not delete `tasks.json`.
12. Confirm opening settings does not read `.nestkit/spaced-review/tasks.json`.
13. Confirm opening settings does not create `.nestkit`.
14. Confirm opening settings does not create `.nestkit/spaced-review`.
15. Confirm top actions and tabs are visually separated.
16. Confirm General tab does not show duplicate status bullets or internal performance wording.
17. Confirm no Daily Note write path is invoked.
18. Confirm no checkbox listener is added.
19. Confirm no network request is made.
20. Confirm settings schema version remains unchanged.
21. Confirm store schema version remains unchanged.
22. Confirm the Spaced Review tab does not expose internal task-store wording.
23. Confirm task overview remains intentionally deferred to Phase 3A.
24. Confirm tab content does not duplicate the active tab title.
25. Confirm General tab does not render an extra General heading inside content.
26. Confirm Workspace Panel tab does not render an extra Workspace Panel heading inside content.
27. Confirm Spaced Review tab does not render an extra Spaced Review heading inside content.
28. Confirm About tab does not render an extra About heading inside content.
29. Confirm tab descriptions align visually with the setting cards below them.
30. Confirm per-tab restore defaults remains intentionally deferred and only one global **Restore defaults** action is shown.

## Spaced Review Phase 3A read-only overview

1. Confirm the command palette contains `NestKit: Open spaced review overview`.
2. Confirm the command name itself does not duplicate the `NestKit` prefix.
3. Confirm running the overview command while Spaced Review is disabled shows an enable-first notice.
4. Confirm the disabled overview command path does not read `.nestkit/spaced-review/tasks.json`.
5. Confirm plugin `onload()` does not read `.nestkit/spaced-review/tasks.json`.
6. Confirm opening the settings page does not read `.nestkit/spaced-review/tasks.json`.
7. Confirm opening the overview command while enabled reads the store only after the user runs the command.
8. Confirm a missing `tasks.json` renders the empty overview state and does not create the file.
9. Confirm an empty store renders the empty overview state.
10. Confirm the empty state still clearly directs the user to create a task first.
11. Confirm active tasks render under `All tasks`.
12. Confirm paused tasks are excluded from `All tasks`.
13. Confirm archived tasks are excluded from `All tasks`.
14. Confirm due-today, overdue, or selected-date planned occurrences render as compact review cards under `Today`.
15. Confirm overdue review cards appear before due-today or planned review cards in the selected-date list.
16. Confirm the modal shows task title plus concise review lines instead of raw `startDate`, `presetId`, `intervalsSnapshot`, or `status` field dumps.
17. Confirm active task cards emphasize compact next review, compact progress, a localized preset label, and a read-only review track when a next occurrence is available.
18. Confirm the refresh action re-reads the store.
19. Confirm the refresh action does not write the store.
20. Confirm the overview modal does not create `.nestkit`.
21. Confirm the overview modal does not create `tasks.json`.
22. Confirm the overview modal does not expose complete, skip, delete, or edit actions.
23. Confirm the overview modal does not expose an insert-into-Daily-Note action.
24. Confirm the overview modal does not expose an insert-at-cursor action.
25. Confirm the overview path does not write Daily Notes.
26. Confirm the overview path does not add checkbox listeners.
27. Confirm the overview path does not add right-click menus.
28. Confirm the overview path does not add Workspace Panel task cards.
29. Confirm settings schema version remains unchanged.
30. Confirm store schema version remains unchanged.
31. Confirm the overview uses a card layout rather than a raw field dump.
32. Confirm the default overview tab is `Today`.
33. Confirm the overview also exposes an `All tasks` tab for active task cards.
34. Confirm summary counts for today, overdue, and active tasks are visible.
35. Confirm the `Today` tab shows overdue cards first and selected-date due or planned cards second.
36. Confirm the `All tasks` tab shows active task cards rather than long bullet lists.
37. Confirm the card layout remains read-only.
38. Confirm a full calendar view remains intentionally deferred.
39. Confirm Daily Note insertion remains intentionally deferred.
40. Confirm right-sidebar task-card reuse remains intentionally deferred.
41. Confirm the overview renders a fixed 7-day week strip from `weekStart` through `weekStart + 6 days`.
42. Confirm `selectedDate` defaults to today when the modal first opens.
43. Confirm clicking a date chip changes only modal-local `selectedDate`.
44. Confirm date chips expose due detail through tooltip text rather than inline badges.
45. Confirm date chips expose overdue detail through tooltip text rather than inline badges.
46. Confirm the `Today` tab follows the current `selectedDate` rather than a hard-coded today-only list.
47. Confirm non-today selected dates can still render planned review cards.
48. Confirm overview cards do not render raw `plannedDate: value` or similar key/value dumps.
49. Confirm `All tasks` cards emphasize compact next review, compact progress, localized preset labels, and read-only review-track chips.
50. Confirm refresh preserves the current `selectedDate` and internal tab.
51. Confirm the overview shows previous-week and next-week controls rather than a full calendar month view.
52. Confirm previous-week and next-week controls move the selected week by exactly 7 days.
53. Confirm each task contributes at most one actionable review card to a selected-date list.
54. Confirm review cards use a compact habit-style card hierarchy without reintroducing a per-card mini-week strip.
55. Confirm overview source files use `\u00b7` escapes for middle-dot separators instead of literal middle-dot source text.
56. Confirm exported `source-snapshot.md` does not contain broken separator mojibake from prior exports.
57. Confirm the top stats row still shows today, overdue, and active counts beside the tabs.
58. Confirm per-card mini week does not reuse aggregate due or overdue counts from the global week strip.
59. Confirm per-card mini week reflects only the card task's actionable occurrence state.
60. Confirm the overview does not repeat `selectedDate` as a duplicate top text line above the week strip.
61. Confirm the active week chip alone represents the current `selectedDate`.
62. Confirm the week strip no longer relies on inline numeric count boxes inside each chip.
63. Confirm the overview header includes a local static Help or legend toggle next to Refresh.
64. Confirm opening Help or legend only shows local explanatory UI and does not fetch or write data.
65. Confirm clicking a `Today` card can switch to `All tasks` and highlight the matching task card.
66. Confirm built-in preset ids render through localized labels in the overview instead of showing raw preset ids.
67. Confirm `Today` cards no longer render a per-card mini week.
68. Confirm `Today` cards no longer render a review-track strip.
69. Confirm the full date-navigation area is framed as one light calendar panel with a soft border and compact radius.
70. Confirm the year, month, week, and calendar-icon controls look like one grouped positioning cluster but still do not open real pickers.
71. Confirm the week-range label uses a light pill treatment and stays on one line between the previous-week and next-week arrows.
72. Confirm each day chip shows only day number plus weekday inside the same button.
73. Confirm day chips do not show `06-14` style month-day text.
74. Confirm day chips do not show a `Today` text label.
75. Confirm day chips do not show inline due or overdue number badges.
76. Confirm a today-only chip uses a light accent background without an added outline.
77. Confirm the selected chip uses a deeper accent background than the today-only chip.
78. Confirm when today is also selected, the selected style wins without adding an extra today ring.
79. Confirm switching between different day chips does not change chip width, chip height, calendar-panel width, tab-row alignment, or task-card area alignment.
80. Confirm the gap between the calendar panel and the `Today` / `All tasks` row is slightly increased while staying compact.
81. Confirm the `Today` card grid stays two columns after changing selected dates.
82. Confirm the Help popover no longer explains old blue or red date numbers, old inline chip counts, or a `Today` text label inside chips.
83. Confirm the Help popover explains `Date`, `Stats`, and built-in `Presets`.
84. Confirm Help states that full year, month, and week selectors remain deferred to a later task.
85. Confirm `Today` cards keep only title, badge, primary line, and secondary line.
86. Confirm overdue, due, and planned `Today` primary lines do not repeat badge wording.
87. Confirm `All tasks` headers show task title plus a compact next-review label instead of an active-status badge.
88. Confirm `All tasks` summaries show preset label plus compact progress on one line.
89. Confirm review-track chips keep review number and date inside the same chip.
90. Confirm review-track chips wrap naturally across lines without creating a separate number row.
91. Confirm the legend is split into `Date`, `Stats`, and `Presets` sections.
92. Confirm the legend includes built-in preset interval lists for fast review, standard review, and long-term memory.
93. Confirm the legend does not repeat redundant today wording.
94. Confirm clicking a `Today` card scrolls the matching `All tasks` card into view after tab switch.
95. Confirm the top toolbar does not render a `Today: YYYY-MM-DD` text line.
96. Confirm the top toolbar does not render a duplicate selected-date text line.
97. Confirm Help and Refresh render in the title row while the calendar panel and then the tabs-plus-summary row appear beneath it in that order.
98. Confirm clicking a day chip changes only `selectedDate` and does not recenter the visible week.
99. Confirm week chips no longer show inline due count text or badges.
100. Confirm week chips no longer show inline overdue count text or badges.
101. Confirm the legend explains current date, selected date, the calendar controls, and the semantic difference between real-today counts and selected-date overdue counts.
102. Confirm `Today` cards hide preset and carried-to-today wording while keeping only title, badge, review line, and planned or original date line.
103. Confirm `Today` cards use a stable two-column grid in the modal.
104. Confirm `All tasks` progress uses completed count over total count and skipped reviews do not increase the completed progress count.
105. Confirm review-track chips keep a bold review number with the date inline on the same chip row.
106. Confirm the overview content uses an internal scroll region so large task lists do not make the whole modal jump in height.
107. Confirm the title row is left-aligned with the summary badges, week navigation, week strip, tabs, and card content.
108. Confirm the overview uses the native modal title row for title plus Help and Refresh without duplicate title controls.
109. Confirm the title row adjusts its own left axis to align with calendar controls, the date selector, tabs, summary, and cards without changing the content frame width.
110. Confirm the title action group keeps Help and Refresh visually separated from the title text without using close-reserve or native-close styling logic.
111. Confirm the overview hides the native close button only within this modal and keeps a stable two-column title row for title plus Help and Refresh actions.
112. Confirm clicking outside the modal or on the blurred backdrop closes the Spaced Review Overview.
113. Confirm pressing `Esc` closes the Spaced Review Overview.
114. Confirm Help, Refresh, and optional `Sync note` remain visually clean in the title row while the native close button stays hidden by design.
115. Confirm the Create task modal is not affected by the Overview-only native-close hiding rule.
116. Confirm Help stays circular at about 32px, Refresh stays a lighter 32px-high compact pill around 58-64px wide with readable hover, focus, active, and disabled states, and neither action covers the title text.
117. Confirm the date selector uses single-button day chips with day number above weekday text, without `Today` text or inline count badges.
118. Confirm each date chip tooltip includes the date plus due and overdue counts for that chip date.
119. Confirm `Today` card metadata is compressed onto one line, such as `\u7b2c 1 \u6b21 \u00b7 \u8ba1\u5212 06-16` or `Review #1 \u00b7 Planned 06-16`.
120. Confirm this compact-polish round keeps the `All tasks` review-track rendering and state logic unchanged apart from shared frame spacing.
121. Confirm the overdue badge in the tabs-plus-summary row follows the selected date instead of the global real-today overdue count.
122. Confirm the today badge in the tabs-plus-summary row remains based on the real current day.
123. Confirm the active badge in the tabs-plus-summary row remains based on active task count.
124. Confirm the today chip uses a light-blue fill and the selected chip uses a stronger blue fill, without size changes between states.
125. Confirm week-navigation arrow icons appear visually larger while the circular buttons stay compact.
126. Confirm Help and Refresh both use a neutral light button style rather than accent-filled hover or resting states.
127. Confirm switching between day chips does not cause the modal body to shrink, expand, or shift horizontally.
128. Confirm a configurable `week starts on Sunday / Monday` setting is still deferred and is not implemented in this round.
129. Confirm the date-navigation area is framed as one light calendar panel with shared background, border, and radius.
130. Confirm year, month, week, and calendar-icon controls remain grouped positioning affordances only and do not open real pickers in this round.
131. Confirm Help renders as a popover or overlay anchored near the help button instead of inside the task-content flow.
132. Confirm opening Help does not change modal content height, card width, tabs-plus-summary alignment, or calendar-panel position.
133. Confirm Help content is limited to short `Date`, `Stats`, and `Presets` sections without large visual button examples.
134. Confirm Today and All tasks keep the same visible outer content width when switching tabs.
135. Confirm the visible right-edge mismatch between `Today` and `All tasks` is gone because the overview's own scroll container hides its scrollbar visual while still allowing mouse-wheel scrolling.
136. Confirm the scrollbar hiding is scoped to the overview panel only and does not hide unrelated Obsidian scrollbars.
137. Confirm Help no longer shows `CAL`, large sample year/month/week rows, or oversized sample stat badges.
138. Confirm the calendar toolbar reads as two groups: locator controls on the left and week controls on the right.
139. Confirm the gap between the calendar icon and the previous-week arrow is visibly larger than before.
140. Confirm year, month, and week locator controls still behave as passive placeholders with tooltip and aria guidance only.
141. Confirm the `Date`, `Stats`, and `Presets` section titles inside Help use the theme accent color.
142. Confirm the actual scrollbar owner inside the overview modal is covered by a scoped selector on `.nest-kit-spaced-review-overview-modal .modal-content` or the equivalent real scroll container, rather than only the inner overview panel.
143. Confirm the overview modal itself is slightly wider and the frame keeps a stable right-side safety space so any remaining scrollbar trace sits outside the main calendar or card content edge.

## Spaced Review Phase 3B minimal overview actions

1. Confirm actionable `Today` cards show `Complete` and `Skip` buttons.
2. Confirm `All tasks` cards still do not show action buttons.
3. Confirm clicking `Complete` on a due-today card removes the current actionable card from `Today`.
4. Confirm clicking `Complete` increases progress from values such as `0/7` to `1/7`.
5. Confirm clicking `Complete` removes the same index from `skippedSequenceIndexes` if it was previously skipped.
6. Confirm clicking `Skip` removes the current actionable card from `Today`.
7. Confirm clicking `Skip` does not increase completed progress.
8. Confirm clicking `Skip` removes the same index from `completedSequenceIndexes` if it was previously completed.
9. Confirm an overdue carry-over card can show the same action buttons and disappears from the actionable list after completion or skip.
10. Confirm future planned cards on non-today selected dates still do not show action buttons.
11. Confirm rolling-timeline completion updates the next review date based on the completion day.
12. Confirm fixed-timeline completion does not move later planned dates based on the completion day.
13. Confirm writing failure shows a Notice and does not leave a fake successful UI state behind.
14. Confirm a future-schema store refusal shows a blocking Notice and does not write.
15. Confirm closing and reopening the overview keeps completed or skipped state persisted from the store.
16. Confirm the `Complete` / `Skip` buttons sit on the same row as `Review # / Planned` or `第 x 次 / 原计划` metadata in `Today` cards.
17. Confirm clicking `Complete` does not leave a strong blue mouse-focus ring on the button, while keyboard `focus-visible` still shows a light accessibility hint.
18. Confirm completed review-track pills in `All tasks` no longer show recomputed dates such as `06-18`.
19. Confirm completed review-track pills show `✓ 06-17` when a real persisted action date exists.
20. Confirm skipped review-track pills show `> 06-17` when a real persisted action date exists.
21. Confirm pending, current, future, and overdue review-track pills still show planned dates.
22. Confirm `All tasks` track no longer shows visible sequence numbers such as `1 / 2 / 3`.
23. Confirm completed pills show `✓` plus the real action date when available, otherwise only `✓`.
24. Confirm skipped pills show `>` plus the real action date when available, otherwise only `>`.
25. Confirm overdue pills show `!` plus the date.
26. Confirm current pills show `●` plus the date.
27. Confirm pending or future pills show `○` plus the date.
28. Confirm progress still uses the compact `1/5`-style summary instead of the track row.
29. Confirm the `Complete` button no longer keeps an obvious outer focus frame after mouse click.
30. Confirm Help includes a compact `Track` legend section for these symbols.

## Spaced Review Phase 3B semantic fixes

1. Confirm creating custom intervals `1 3 7` persists `intervalsSnapshot = [1, 3, 7]`.
2. Confirm Overview shows `Custom: 1 · 3 · 7` in English or `自定义：1 · 3 · 7` in Simplified Chinese instead of a built-in preset label when the snapshot differs from the selected preset.
3. Confirm Overview still shows the localized built-in preset label when `intervalsSnapshot` exactly matches the selected built-in preset intervals.
4. Confirm the custom-label fix does not change fixed-timeline planned dates.
5. Confirm the custom-label fix does not change rolling-timeline planned dates.
6. Confirm creating a duplicate title against an active task is blocked.
7. Confirm creating a duplicate title against a paused task is blocked.
8. Confirm creating a duplicate title against an archived task is allowed.
9. Confirm duplicate-title comparison uses `trim`, internal whitespace collapse, and case-insensitive matching.
10. Confirm values such as `Test`, ` test `, and `TeSt` are treated as duplicates.
11. Confirm a duplicate-title submission shows the localized duplicate-title error and does not write the store.
12. Confirm a non-duplicate title can still be created normally.

## Spaced Review Phase 3B rolling track date calculation fix

1. Confirm rolling timeline with `startDate = 2026-06-17` and `intervalsSnapshot = [1, 3, 7]` shows `06-18 / 06-20 / 06-24`.
2. Confirm rolling timeline with `startDate = 2026-06-17` and `intervalsSnapshot = [1, 5, 6]` shows `06-18 / 06-22 / 06-23`.
3. Confirm rolling timeline no longer shows `06-18 / 06-19 / 06-21` for custom `[1, 3, 7]`.
4. Confirm rolling timeline no longer shows `06-18 / 06-21 / 06-18` for custom `[1, 5, 6]`.
5. Confirm with rolling mode, `startDate = 2026-06-15`, `intervalsSnapshot = [1, 3, 7]`, `completedSequenceIndexes = [0]`, and `rollingAnchorDate = 2026-06-17`, the remaining dates are `06-19` and `06-23`.
6. Confirm fixed timeline with `startDate = 2026-06-17` and `intervalsSnapshot = [1, 3, 7]` still shows `06-18 / 06-20 / 06-24`.
7. Confirm for increasing `intervalsSnapshot` values, visible pending, current, and future rolling track dates do not decrease.

## Spaced Review Phase 3C calendar selectors and focus polish

1. Confirm opening the overview modal does not leave a strong blue focus ring on `?`, `Refresh`, calendar selectors, or action buttons.
2. Confirm clicking `Complete` or `Skip` with a mouse does not leave a strong outer focus ring behind.
3. Confirm keyboard `Tab` navigation still shows a lighter scoped `focus-visible` outline inside the overview modal.
4. Confirm the year button shows the current selected date year and opens a year selector popover.
5. Confirm the month button shows the current selected date month and opens a month selector popover.
6. Confirm the week button shows `Week N` in English or `第N周` in Simplified Chinese and opens a week selector popover.
7. Confirm only one year, month, or week selector popover can be open at a time.
8. Confirm clicking another selector button closes the previous selector popover before opening the next one.
9. Confirm clicking elsewhere inside the modal closes an open selector popover.
10. Confirm clicking `?` or `Refresh` closes any open selector popover.
11. Confirm the selector popover is rendered as an overlay and does not push the calendar panel, tabs row, or task cards downward.
12. Confirm selecting a year keeps the current month and day when valid, clamps when needed, and rebuilds the week label accordingly.
13. Confirm selecting a month keeps the current day when valid, clamps when needed, and rebuilds the week label accordingly.
14. Confirm selecting a week jumps to that week using the existing Sunday-based overview week logic instead of introducing ISO-week or Monday-week behavior.
15. Confirm previous-week, next-week, and the calendar-today button all keep year, month, and week labels synchronized.
16. Confirm crossing a month boundary through week navigation updates the month selector label automatically.
17. Confirm crossing a year boundary through week navigation updates the year selector label automatically.
18. Confirm completed and skipped review-track pills remain symbol-only when no real persisted action-date fields exist.
19. Confirm the overview does not show fake completed or skipped dates such as `[✓ 06-17]` or `[> 06-17]` when the persisted action-date field is missing.

## Spaced Review Phase 3D grouping system

1. Confirm the create-task modal includes manual `Group` and `Subgroup` text inputs.
2. Confirm group and subgroup inputs allow empty values.
3. Confirm group and subgroup inputs are trimmed and collapse internal spaces before persistence.
4. Confirm saving a task with both group and subgroup persists `groupPath = [group, subgroup]`.
5. Confirm saving a task with only group persists `groupPath = [group]`.
6. Confirm saving a task with no group persists no `groupPath` and later shows under `Ungrouped`.
7. Confirm entering only subgroup without group does not promote subgroup into the top-level group slot.
8. Confirm old tasks without `groupPath` still load normally.
9. Confirm old tasks without `groupPath` render under top-level `Ungrouped`.
10. Confirm `All tasks` groups active tasks by top-level group first and subgroup second.
11. Confirm `Today` remains an action list and does not switch to grouped rendering.
12. Confirm top-level group headings show a task count.
13. Confirm subgroup headings show a task count.
14. Confirm tasks without subgroup render under that group's `Ungrouped` subgroup.
15. Confirm root-level ungrouped tasks do not render a duplicate nested `Ungrouped` heading.
16. Confirm task cards inside each subgroup sort by `createdAt desc`.
17. Confirm top-level groups sort by the newest task `createdAt desc`, with top-level `Ungrouped` kept last for stability.
18. Confirm subgroups sort by the newest task `createdAt desc`.
19. Confirm the new grouping layout does not change `Today` sorting.
20. Confirm the new grouping layout does not change due or overdue calculations.
21. Confirm complete and skip actions still work exactly as before.
22. Confirm calendar selectors still work exactly as before.
23. Confirm track symbols and persisted action-date display still work exactly as before.
24. Confirm duplicate-title validation blocks non-archived tasks only within the same normalized `groupPath`.
25. Confirm duplicate-title validation remains case-insensitive and whitespace-normalized for both title and group path.
26. Confirm the same task title is allowed in different groups.
27. Confirm the same task title is blocked in the same group for `active` tasks.
28. Confirm the same task title is blocked in the same group for `paused` tasks.
29. Confirm archived tasks do not block a same-name task in the same group.
30. Confirm this phase does not add notes, Obsidian target links, archive UI, group chips, or outline navigation.

## Spaced Review Phase 3E task details, archive, and group jump

1. Confirm the create-task modal keeps `Note`, `Target link`, and custom intervals inside the collapsible **More settings** section.
2. Confirm saving a task with surrounding whitespace in `note` trims the outer whitespace and keeps meaningful internal newlines.
3. Confirm an empty `note` input persists as `undefined` and does not render a note affordance later.
4. Confirm saving a task with surrounding whitespace in `targetLink` trims only the outer whitespace and preserves heading or block fragments such as `#Day 1` or `#^block-id`.
5. Confirm `All tasks` shows a one-line note preview only when the task has a note.
6. Confirm clicking the note area expands to the full plain-text note and clicking again collapses back to the one-line preview.
7. Confirm note expanded or collapsed state is modal-local only and is not written to the store.
8. Confirm `Today` stays action-focused and does not render the note block.
9. Confirm tasks with `targetLink` show an `Open` action in `All tasks`.
10. Confirm actionable `Today` cards with `targetLink` also show an `Open` action without displacing `Complete` and `Skip`.
11. Confirm clicking `Open` can resolve a plain file link, a heading link, and a block link through the Obsidian workspace API.
12. Confirm a broken `targetLink` shows a Notice and does not block the rest of the overview.
13. Confirm `All tasks` active cards show `Archive`, while `Archived` cards show `Restore`.
14. Confirm archiving sets `status = archived`, updates `updatedAt`, and preserves `note`, `targetLink`, `groupPath`, completed dates, and skipped dates.
15. Confirm an archived task disappears from the default `All tasks` view immediately after a successful archive action.
16. Confirm an archived task does not appear in `Today`, even if it would otherwise be due or overdue.
17. Confirm the overview now includes a third top-level tab named `Archived`.
18. Confirm the `Archived` tab renders archived tasks only and shows a localized empty state when there are none.
19. Confirm restoring an archived task sets `status = active`, updates `updatedAt`, and returns the task to `All tasks`.
20. Confirm restoring an archived overdue task can make it visible in `Today` again.
21. Confirm `All tasks` renders top-level group chips only when there are at least two top-level groups.
22. Confirm each group chip shows the top-level group label plus task count.
23. Confirm clicking a group chip scrolls the matching top-level group section into view.
24. Confirm group chips appear in `All tasks` only and do not appear in `Today`.
25. Confirm archived tasks still render under their grouped sections inside `Archived`, but archived view does not add the top jump chips.
26. Confirm loading older tasks without `note` or `targetLink` continues to work without migration prompts or schedule changes.
27. Confirm the store schema bump to `4` does not change due or overdue calculations, fixed versus rolling schedule behavior, interval semantics, or complete versus skip semantics.
28. Confirm this round does not add auto-archive, multiple target links, a file picker, a side outline navigator, a right-sidebar narrow view, `.nestkit` side files, or manual `tasks.json` editing paths.
29. Confirm complete and skip behavior still matches the Phase 3B action semantics after these task-management additions.
30. Confirm calendar selectors, week navigation, custom interval labels, duplicate-title grouping, and review-track symbol display still behave exactly as in prior phases.

## Spaced Review Phase 3E UI/UX polish

1. Confirm the create-task modal no longer shows a separate large **More settings** card or collapsible block.
2. Confirm the create-task field order is title, group, subgroup, start date, preset, custom intervals, note, target link.
3. Confirm custom intervals stay directly below preset and still override the preset intervals when filled.
4. Confirm group uses a compact `existing option dropdown + custom input` row.
5. Confirm the group dropdown includes `Add group...` in English or `新增大组...` in Simplified Chinese.
6. Confirm selecting an existing group clears or disables the custom group input.
7. Confirm selecting `Add group...` enables the custom group input for a new value.
8. Confirm subgroup uses the same compact combo row pattern.
9. Confirm the subgroup dropdown depends on the current group and allows an empty subgroup.
10. Confirm the subgroup dropdown includes `Add subgroup...` in English or `新增小组...` in Simplified Chinese when a group is present.
11. Confirm target link offers Markdown file path suggestions from vault files, capped at 5 results.
12. Confirm choosing a target-link suggestion fills the file path only, still allowing manual `#Heading` or `#^block-id` suffixes.
13. Confirm note and target link save normally from both create and edit flows.
14. Confirm `All tasks` active cards show a lightweight `Edit` action.
15. Confirm `Today` cards do not show an `Edit` action.
16. Confirm archived cards may skip `Edit` and still keep `Restore`.
17. Confirm edit v1 changes only title, group, subgroup, note, and target link.
18. Confirm edit v1 does not change preset, custom intervals, start date, schedule policy, or completed/skipped records.
19. Confirm editing a task updates `updatedAt`.
20. Confirm duplicate-title validation also blocks edit save when another non-archived task in the same normalized group has the same title.
21. Confirm editing the same task without changing its own title does not self-trigger duplicate validation.
22. Confirm Today cards keep occurrence meta on the left and actions on the right in one row at normal modal width.
23. Confirm Today `Open` appears whenever `targetLink` exists, while `Complete` and `Skip` still appear only for actionable cards.
24. Confirm `All tasks` action rows stay compact and lightweight instead of stacking one oversized button per line.
25. Confirm `All tasks` action rows show only the relevant actions: `Open`, `Edit`, `Note`, `Archive`, or `Restore`.
26. Confirm note preview renders as text like `Note: xxx...` instead of a full-width large button.
27. Confirm note expansion uses a small lightweight control and expanded note text is shown as plain text.
28. Confirm Today cards still do not render note previews.
29. Confirm create modal and overview modal both suppress strong mouse-focus rings while preserving keyboard `focus-visible`.
30. Confirm Archived view shows the one-line archive explanation at the top and does not repeat it on every card.
31. Confirm group and subgroup rows show only the dropdown by default, without a persistently visible disabled custom input.
32. Confirm selecting `Add group...` is the only state that reveals the custom group input.
33. Confirm selecting `Add subgroup...` is the only state that reveals the custom subgroup input.
34. Confirm returning to an existing group or subgroup hides the corresponding custom input again.
35. Confirm clicking a `targetLink` suggestion fills the input with the selected Markdown `file.path`.
36. Confirm the `targetLink` input keeps the caret at the end after suggestion selection so the user can continue typing `#Heading` or `#^block-id`.
37. Confirm `All tasks` no longer shows a top `Note` action button.
38. Confirm short one-line notes render as plain preview text without an `Expand` link.
39. Confirm only longer notes, such as notes with line breaks or over about 40 characters, show lightweight `Expand` / `Collapse` text.
40. Confirm the note expand/collapse control is rendered as lightweight text rather than a pill button.
41. Confirm `All tasks` action rows now use lightweight text actions such as `Open · Edit · Archive`.
42. Confirm `Archived` action rows now use lightweight text actions such as `Open · Edit · Restore`.
43. Confirm clicking `Open` in `Today` or `All tasks` does not trigger card jump, note toggle, archive, or restore side effects.
44. Confirm mouse-clicking `Open`, `Edit`, `Archive`, `Restore`, `Complete`, `Skip`, `Help`, or `Refresh` no longer leaves a strong blue ring behind.
45. Confirm keyboard `Tab` focus still shows a scoped lighter `focus-visible` outline for those controls.

## Spaced Review Phase 3E UI simplification rollback

1. Confirm the create-task modal feels narrower and less fragmented than the prior polish pass.
2. Confirm create-task rows no longer read like many separate card sections divided by long horizontal rules.
3. Confirm group uses `existing dropdown + optional new name input`.
4. Confirm subgroup uses `existing dropdown + optional new name input`.
5. Confirm the group dropdown stays visually compact instead of expanding to full text-field width.
6. Confirm the subgroup dropdown stays visually compact instead of expanding to full text-field width.
7. Confirm when the custom group input is non-empty it takes priority over the dropdown selection.
8. Confirm when the custom subgroup input is non-empty it takes priority over the dropdown selection.
9. Confirm typing a normalized duplicate group name saves back to the canonical existing group label instead of creating a duplicate spelling variant.
10. Confirm typing a normalized duplicate subgroup name under the current group saves back to the canonical existing subgroup label.
11. Confirm the create-task modal does not leave an initial blue focus ring on the title field when it opens.
12. Confirm mouse-clicking into inputs still gives normal editable field focus afterward.
13. Confirm target-link suggestions remain clickable and still fill the selected Markdown `file.path`.
14. Confirm Today `Open`, `Complete`, and `Skip` share one consistent small-button style.
15. Confirm Today action buttons no longer look like broken text links or retain a strong blue ring after mouse click.
16. Confirm `All tasks` actions render as lightweight text actions such as `Open`, `Edit`, `Archive`, or `Restore`.
17. Confirm `All tasks` no longer shows a top `Note` action button.
18. Confirm task notes render as one-line preview text only in this rollback pass.
19. Confirm task notes do not show `Expand` or `Collapse` in this rollback pass.
20. Confirm tasks without notes still omit the note row entirely.
21. Confirm `Open` still uses the target link without triggering card jump, archive, or other side effects.
22. Confirm archive and restore still work and this pass does not change archive semantics.

## Spaced Review Phase 3E UI hierarchy and card layout polish

1. Confirm the create-task modal still opens without an initial title-field blue focus ring.
2. Confirm mouse-clicking or tabbing into create-task inputs still shows normal scoped focus afterward.
3. Confirm group and subgroup still use `existing dropdown + optional new input`, with duplicate normalized names merging back to existing canonical labels.
4. Confirm the group and subgroup controls stay visually compact and aligned with the rest of the form rows.
5. Confirm `All tasks` cards no longer show a duplicate top-right `Next xx` label.
6. Confirm the current or next review timing is now represented only by the review-track chips.
7. Confirm managed cards use a left-content body plus a fixed right-side action rail.
8. Confirm the action rail always shows four slots in this order: `Open`, `Edit`, `Expand` or `Collapse`, `Archive` or `Restore`.
9. Confirm tasks without `targetLink` still show the `Open` slot as disabled or muted instead of hiding it.
10. Confirm disabled `Open` actions do not trigger any link-opening behavior and include a tooltip explaining why they are unavailable.
11. Confirm short-note or no-note tasks still keep the `Expand` slot visible but disabled or muted.
12. Confirm disabled `Expand` actions do not toggle note UI and include a tooltip explaining why they are unavailable.
13. Confirm only longer notes, such as notes over about 40 characters or notes with line breaks, enable `Expand`.
14. Confirm expanding a long note reveals the full note content inline and changes the slot text to `Collapse`.
15. Confirm collapsing the same note restores the one-line preview and changes the slot text back to `Expand`.
16. Confirm `Today` cards still do not show edit, expand, archive, or restore actions.
17. Confirm `Today` `Open`, `Complete`, and `Skip` still keep the lightweight small-button styling without a strong lingering mouse blue ring.
18. Confirm `Archived` cards reuse the same fixed four-slot action rail while the last slot becomes `Restore`.
19. Confirm group headers read like text hierarchy instead of pill controls, and subgroup headers remain visually lighter than group headers.
20. Confirm top group-jump chips stay lighter than the main group headers and do not dominate the section hierarchy.
21. Confirm create mode group dropdown starts on an empty placeholder such as `Select group` or `未选择` instead of auto-selecting the first existing group.
22. Confirm create mode subgroup dropdown starts on an empty placeholder such as `None` or `无`.
23. Confirm subgroup dropdown and subgroup custom input remain disabled until an effective group exists from either the selected group or the typed custom group.
24. Confirm the managed-card action rail stays visually narrow, around the 48px to 60px range, and no longer over-compresses the title, note, or track chips.
25. Confirm enabled managed actions read like underlined text actions rather than button pills.
26. Confirm disabled managed actions keep their slot height but do not show the accent underline.

## Spaced Review Phase 3E compact action-rail layout fix

1. Confirm `All tasks` and `Archived` action rails no longer use `grid-template-rows: repeat(4, minmax(0, 1fr))`.
2. Confirm the right action rail no longer stretches its four slots to fill the full card height.
3. Confirm the four managed actions now sit in a compact vertical rhythm rather than being pulled far apart.
4. Confirm the action rail width is around `40px` to `48px`.
5. Confirm the gap between the left task body and the right action rail is around `6px` to `8px`.
6. Confirm the task title, note preview, and review-track chips keep more natural horizontal space after the rail compaction.
7. Confirm longer-note cards and shorter-note cards still keep the same compact right-rail rhythm.
8. Confirm enabled managed actions still show the accent underline treatment.
9. Confirm disabled managed actions still remove the accent underline, remain muted, and do not trigger clicks.
10. Confirm `Today` cards still keep the existing small pill action buttons and are unaffected by the managed action-rail CSS fix.
11. Confirm DevTools shows `.nest-kit-spaced-review-overview__task-management-actions` with computed `display: flex`, `flex-direction: column`, `justify-content: flex-start`, and a content-height rail rather than card-height stretching.
12. Confirm DevTools shows managed rail actions with computed `margin-top: 0`, `margin-bottom: 0`, `padding-top: 0`, `padding-bottom: 0`, `height: auto`, and `min-height: 0`.
13. Confirm managed rail actions no longer inherit the old pill-button chrome from `.nest-kit-spaced-review-overview__open-button`, `__edit-button`, `__note-button`, or `__archive-button`.
14. Confirm the computed rail-action border, background, and box-shadow all resolve to the scoped reset rather than theme button chrome.
15. Confirm DevTools shows `.nest-kit-spaced-review-overview__task-action-rail` and each `.nest-kit-spaced-review-overview__action-slot` with computed `margin: 0`, `padding: 0`, `min-height: 0`, and no row stretching.
16. Confirm disabled managed rail actions match either `:disabled` or `.is-disabled` styling, stay muted, remain out of tab order, and keep their explanatory `title`.
17. Confirm the managed rail vertical gap is slightly relaxed again to about `11px` to `12px`, rather than the tighter `3px` compact-fix rhythm.
18. Confirm the managed rail-action computed `line-height` stays about `1.25` and improves scan spacing without reintroducing button chrome or tall slot boxes.

## Spaced Review Phase 3B action-date persistence and track display

1. Confirm clicking `Complete` writes `completedDatesBySequenceIndex[String(sequenceIndex)]` with today’s date-only value.
2. Confirm clicking `Skip` writes `skippedDatesBySequenceIndex[String(sequenceIndex)]` with today’s date-only value.
3. Confirm completing an index removes the same index from `skippedDatesBySequenceIndex`.
4. Confirm skipping an index removes the same index from `completedDatesBySequenceIndex`.
5. Confirm completed track pills show `✓ 06-17` when a real persisted action date exists.
6. Confirm skipped track pills show `> 06-17` when a real persisted action date exists.
7. Confirm older tasks without action-date maps still fall back to symbol-only `✓` or `>`.
8. Confirm completed and skipped track dates never fall back to `plannedDate` or rolling preview dates.
9. Confirm current track pills show `●` plus the planned date.
10. Confirm pending and future track pills show `○` plus the planned date.
11. Confirm the Help popover `Track` section uses `✓ date` and `> date` wording while keeping `!`, `●`, and `○` short.
3. Confirm overdue track pills show `!` plus the planned date.
4. Confirm current track pills show `●` plus the planned date.
5. Confirm pending and future track pills show `○` plus the planned date.
6. Confirm completed and skipped track pills do not show visible dates.
7. Confirm completed and skipped track pills do not show visible sequence numbers.
8. Confirm the Help popover `Track` section uses the same symbols as the visible review track.

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

## Spaced Review Phase 3F lightweight audit, settings, and Daily Note sync

1. Confirm there is no obvious unused Spaced Review debug code or `console.log`.
2. Confirm there is no obvious global CSS pollution added by the Spaced Review overview styles.
3. Confirm `renderOverview()` does not perform redundant write paths during ordinary tab or date navigation.
4. Confirm target-link suggest no longer rescans vault Markdown files on every keypress within the same modal session.
5. Confirm the settings page shows a Spaced Review section with default preset, timeline mode, and missed-review policy.
6. Confirm the settings page shows Daily Note sync enable, folder, date format, section path, create-if-missing, and sync-mode controls.
7. Confirm the settings page shows group-jump-chip and archived-view visibility toggles.
8. Confirm settings persist after plugin reload through the normal plugin settings flow.
9. Confirm the command palette contains `NestKit: Sync today's reviews to Daily Note`.
10. Confirm the sync command writes only today's actionable review items.
11. Confirm archived tasks are not synced to Daily Note.
12. Confirm future-only tasks are not synced to Daily Note.
13. Confirm a task with `targetLink` is written as `[[targetLink|title]]`.
14. Confirm a task without `targetLink` is written as plain title text.
15. Confirm overdue items include the localized overdue label.
16. Confirm the Daily Note section uses heading-only output without START and END markers.
17. Confirm repeated sync replaces the managed section content without duplicating the section path headings.
18. Confirm user content outside the managed heading section is preserved.
19. Confirm when the note file is missing and create-if-missing is on, the file is created in the configured existing folder.
20. Confirm when the configured folder is missing, sync fails with a Notice instead of writing outside the vault.
21. Confirm overview `Sync note` appears only when Daily Note sync is enabled.
22. Confirm `onOverviewOpen` mode syncs at most once per modal open.
23. Confirm there is no checkbox listener, file watcher, or background polling loop added by Daily Note sync.
24. Confirm Daily Note output lines do not contain the previously reported mojibake separator or fallback-heading fragments.
25. Confirm Daily Note item lines use `\u2014` between title and metadata, and `\u00b7` between metadata segments.
26. Confirm an empty section-heading setting falls back to readable text and never writes mojibake.
27. Confirm the Chinese fallback heading renders as `\u95f4\u9694\u590d\u4e60`.
28. Confirm a configured date format containing `/` or `\\` falls back to `YYYY-MM-DD.md` instead of creating nested folders from the filename format.
29. Confirm folder management stays in the folder setting only; the date-format setting is treated as filename-only.
30. Confirm an existing managed heading section with identical content is not inserted again on the next sync.
31. Confirm an existing managed heading section with changed content updates only the final target heading body.
32. Confirm a file with the section path parent heading but no child heading inserts only the missing child heading under that parent and does not duplicate the parent heading.
33. Confirm a file with no matching section path appends one full section-path block at the end of the note.
34. Confirm repeated sync does not duplicate the same section-path headings.
35. Confirm user-written content after the next same-level or higher-level heading is preserved when the managed section is replaced.
36. Confirm checked `- [x]` items inside the final managed heading section are imported as completed on sync.
37. Confirm checked `- [X]` items inside the final managed heading section are also imported as completed on sync.
38. Confirm unchecked items are not imported.
39. Confirm checked items outside the marker block are not imported.
40. Confirm sync imports checked items first, then rebuilds the Daily Note section from refreshed Today overview items.
41. Confirm Overview `Refresh` imports checked Daily Note items once when Daily Note sync is enabled, but still does not live-watch checkboxes.

## Spaced Review Phase 3K Daily Note section path and checkbox import stability

1. Confirm the settings page exposes `Daily Note section path` as a multi-line input.
2. Confirm a single-line section path such as `今日复习` generates one managed `## 今日复习` heading.
3. Confirm a multi-line section path such as `Task` + `雅思` generates `# Task` and `## 雅思`.
4. Confirm an explicit Markdown path such as `# Task` + `## 雅思` preserves those explicit heading levels.
5. Confirm blank lines inside the section-path setting are ignored during parsing.
6. Confirm an empty section-path setting falls back to the legacy section heading or the default heading text.
7. Confirm legacy `spacedReviewDailyNoteSectionHeading` values migrate into the new single-line section-path setting.
8. Confirm a missing child heading is created inside an existing parent section instead of being appended at the file end.
9. Confirm a fully missing section path appends the complete nested heading path at the end of the note.
10. Confirm only the final heading in the section path is treated as the managed replace range.
11. Confirm content under later same-level or higher-level headings is preserved after sync.
12. Confirm repeated sync does not duplicate section-path headings.
13. Confirm the managed Daily Note output still contains no START marker.
14. Confirm the managed Daily Note output still contains no END marker.
15. Confirm the managed Daily Note output still contains no metadata block.
16. Confirm the managed Daily Note output still contains no inline identity marker.
17. Confirm checked checkbox import reads only task lines inside the final managed heading section.
18. Confirm checked checkbox import ignores checkboxes outside the managed heading section.
19. Confirm checked checkbox import normalizes `- [x]` and `- [X]` to unchecked text before matching.
20. Confirm checkbox import tries clean-line text matching before positional fallback.
21. Confirm checkbox import uses positional fallback only when text matching is not uniquely resolvable.
22. Confirm a successful text match imports the corresponding actionable Today item as completed.
23. Confirm a successful positional fallback also imports the corresponding actionable Today item as completed.
24. Confirm unchecked lines are never imported.
25. Confirm opening Overview imports checked Daily Note items before rendering when Daily Note sync is enabled.
26. Confirm `Sync today's reviews to Daily Note` imports checked items before rewriting the managed section.
27. Confirm the overview `Sync note` button imports checked items before rewriting the managed section.
28. Confirm the Daily Note sync ribbon button reuses the same import-before-rewrite flow.
29. Confirm the overview `Refresh` action imports checked items before re-reading the store.
30. Confirm when checked lines exist but no Today item can be matched, sync shows a warning and leaves the note unchanged.
31. Confirm the unmatched-checked warning preserves the user’s `[x]` lines instead of silently rewriting them back to `[ ]`.
32. Confirm there is still no live checkbox watcher, file watcher, or background polling loop.
33. Confirm checking an item in today's managed Daily Note section is imported after a short debounce without manually clicking `Refresh` or `Sync note`.
34. Confirm that near-real-time path reacts only when the modified file is exactly today's configured Daily Note path.
35. Confirm the near-real-time path does not rewrite the Daily Note and does not reintroduce START or END markers, metadata blocks, or inline identity markers.
36. Confirm if the Overview modal is already open, that same near-real-time import refreshes the existing modal in place instead of opening another one.

## Spaced Review Phase 3H Daily Note clean display, ribbon, context menu, and card polish

1. Confirm generated Daily Note task lines no longer show inline `NESTKIT_SR taskId`, `sequenceIndex`, or `plannedDate` text at the end of each visible task line.
2. Confirm generated Daily Note task lines stay readable as title plus review number and planned date only.
3. Confirm generated Daily Note lines use `Review 1` in English and `第 1 次` in Chinese without exposing hidden identity text inline.
4. Confirm Live Preview no longer shows any `<!-- NESTKIT_SPACED_REVIEW_START -->` marker inside the managed Daily Note section.
5. Confirm Live Preview no longer shows any `<!-- NESTKIT_SPACED_REVIEW_END -->` marker inside the managed Daily Note section.
6. Confirm Live Preview no longer shows any `%% NESTKIT_SPACED_REVIEW_META` block inside the managed Daily Note section.
7. Confirm the managed Daily Note section now contains only the section heading plus checkbox task lines.
8. Confirm checked Daily Note items are imported by mapping checked task-line index inside the heading section to the current actionable Today item at the same index.
9. Confirm an old managed section that still contains START/END markers is rewritten cleanly on the next sync.
10. Confirm an old managed section that still contains a metadata block is rewritten cleanly on the next sync.
11. Confirm an old managed section that still contains inline identity markers is rewritten cleanly on the next sync.
12. Confirm repeated sync remains idempotent and does not duplicate the managed heading section.
13. Confirm when the configured heading already exists, sync replaces only that heading section body and preserves user content after the next same-level or higher-level heading.
14. Confirm when no configured heading exists, sync appends one managed `## heading` section at the end of the note.
15. Confirm when multiple same-name headings exist, sync updates only the first one and surfaces a warning notice.
16. Confirm there is still no live checkbox watcher, file watcher, or background polling loop.
17. Confirm enabling **Show overview ribbon button** adds a left-ribbon shortcut for opening the Spaced Review overview.
18. Confirm disabling **Show overview ribbon button** removes that ribbon shortcut without duplicating icons.
19. Confirm clicking the overview ribbon button opens the Spaced Review overview modal only.
20. Confirm enabling **Show Daily Note sync ribbon button** adds a left-ribbon shortcut for syncing today’s reviews to the Daily Note.
21. Confirm disabling **Show Daily Note sync ribbon button** removes that ribbon shortcut without duplicating icons.
22. Confirm clicking the Daily Note sync ribbon button runs the existing sync flow, including checked-item import before rewrite.
23. Confirm enabling **Show add-to-spaced-review item in editor context menu** adds one Markdown-editor context-menu item only.
24. Confirm disabling **Show add-to-spaced-review item in editor context menu** removes that context-menu item.
25. Confirm the context-menu item label is `Add to spaced review` in English and `加入复习任务` in Simplified Chinese.
26. Confirm the context-menu item does not appear in non-Markdown surfaces such as PDF, Canvas, or settings views.
27. Confirm when text is selected in a Markdown editor, the create-task modal prefills the title from the trimmed selection.
28. Confirm when no text is selected, the create-task modal prefills the title from the current file basename.
29. Confirm the create-task modal prefills `targetLink` from the current Markdown file path.
30. Confirm the context-menu action opens the create modal only and does not write into the editor body or Daily Note directly.
31. Confirm the context menu does not show a second near-duplicate create-task item beside `Add to spaced review`.
32. Confirm All tasks cards show `Note: None` when no note exists in English UI.
33. Confirm All tasks cards show `备注：无` when no note exists in Simplified Chinese UI.
34. Confirm Archived cards also show the same empty-note placeholder.
35. Confirm Today cards still do not render the note row.
36. Confirm cards with a real note still preserve the current preview plus expand behavior.
37. Confirm cards without a note keep the note action disabled or muted and do not gain an underline.
38. Confirm the All tasks action rail is offset downward by exactly 1px from the prior top alignment.
39. Confirm the managed action-rail gap, width, and line-height are otherwise unchanged from the previous compact computed-style fix.

## Spaced Review Phase 3L startup performance, presets, and target-link open mode

1. Confirm plugin `onload()` does not read `.nestkit/spaced-review/tasks.json`.
2. Confirm plugin `onload()` does not build the overview model.
3. Confirm plugin `onload()` does not scan vault Markdown files for target-link suggestions.
4. Confirm plugin `onload()` does not read or sync Daily Notes.
5. Confirm Spaced Review startup still registers commands, settings UI, ribbon toggles, and one editor-menu listener only.
6. Confirm target-link Markdown file suggestions are loaded only after the create or edit modal opens.
7. Confirm the target-link suggest list is reused within the same modal session and is not rebuilt on every keypress.
8. Confirm the settings page exposes `Target link` -> `Open mode`.
9. Confirm `Open mode` offers `Open in current pane` and `Open in new tab`.
10. Confirm `Open in new tab` is the default.
11. Confirm Today-card `Open` respects the target-link open-mode setting.
12. Confirm All-tasks `Open` respects the target-link open-mode setting.
13. Confirm the settings page exposes `Include today as the first review`.
14. Confirm the setting defaults to off.
15. Confirm built-in preset labels in settings show their interval days.
16. Confirm built-in preset labels in the create-task modal show their interval days.
17. Confirm `Quick review`, `Standard review`, and `Long-term memory` all appear in the create-task modal preset dropdown.
18. Confirm no built-in preset is missing from the create-task modal while it is still available in settings.
19. Confirm enabling include-today prepends `0` exactly once to built-in preset labels.
20. Confirm enabling include-today prepends `0` exactly once to custom preset labels.
21. Confirm enabling include-today does not duplicate an existing leading `0`.
22. Confirm new tasks created from a built-in preset persist the actual effective intervals in `intervalsSnapshot`.
23. Confirm new tasks created from a custom preset persist the actual effective intervals in `intervalsSnapshot`.
24. Confirm manual custom intervals also respect include-today for new task creation.
25. Confirm `0` is accepted only as the first interval value.
26. Confirm `0` is still rejected in any non-first interval position.
27. Confirm a first interval of `0` does not create duplicate actionable occurrences for one task on one date.
28. Confirm a first interval of `0` does not create a negative date or an infinite scheduling loop.
29. Confirm switching the create-task preset does not clear an existing-group dropdown selection.
30. Confirm switching the create-task preset does not clear a custom group input value.
31. Confirm switching the create-task preset does not clear an existing-subgroup dropdown selection.
32. Confirm switching the create-task preset does not clear a custom subgroup input value.
33. Confirm switching the create-task preset keeps the current title, start date, note, and target link values.
34. Confirm switching the create-task preset keeps the last manual custom-interval text available when the manual preset is revisited.
35. Confirm preset switching only changes preset-related UI and does not disable subgroup controls unless the group itself becomes empty.
36. Confirm Today-card `Open`, All-tasks `Open`, and Archived `Open` all share the same target-link open-mode behaviour.
37. Confirm target-link `Open in new tab` uses the plugin UI open buttons, while Daily Note review links still stay native unless the dedicated opt-in setting is enabled.
38. Confirm Daily Note wiki links still follow native Obsidian behaviour by default and can use Ctrl/Cmd-click for a new tab.
39. Confirm the plugin does not add an always-on global Daily Note link intercept when the dedicated opt-in setting is off.

## Spaced Review Phase 3N Daily Note review link open mode intercept

1. Confirm `spacedReviewDailyNoteLinksUseOpenMode` defaults to `false`.
2. Confirm when that setting is off, Daily Note wiki links keep Obsidian's native behaviour.
3. Confirm when that setting is on and target-link open mode is `newTab`, clicking a review link inside today's managed Daily Note section opens a new tab.
4. Confirm when that setting is on and target-link open mode is `current`, clicking a review link inside today's managed Daily Note section opens in the current pane.
5. Confirm Ctrl/Cmd-click is not intercepted by the plugin.
6. Confirm middle-click is not intercepted by the plugin.
7. Confirm non-today Daily Note files are not intercepted.
8. Confirm links outside today's managed Daily Note review section are not intercepted.
9. Confirm target links with headings still preserve the `#Heading` suffix when opened.
10. Confirm the Daily Note output stays clean and does not reintroduce START or END markers, metadata blocks, or inline identity markers.
11. Confirm plugin unload removes or disables the opt-in listener.

29. Confirm the settings page exposes a multi-line `Custom presets` textarea.
30. Confirm one custom preset line follows the format `Name = days`.
31. Confirm spaces, commas, full-width commas, and `、` are accepted as custom preset interval separators.
32. Confirm invalid custom preset lines are skipped instead of entering the dropdown.
33. Confirm valid custom presets appear in the create-task modal preset dropdown.
34. Confirm custom preset dropdown labels use a visible `Custom:` prefix plus interval days.
35. Confirm the create-task modal still offers a manual custom option separate from settings-defined custom presets.
36. Confirm deleting a custom preset from settings does not break existing tasks that already saved `intervalsSnapshot`.

## Spaced Review Phase 3O Daily Note Live Preview link intercept hit fix

1. Confirm when `spacedReviewDailyNoteLinksUseOpenMode` is on and target-link open mode is `newTab`, clicking a review link inside today's managed Daily Note section in Live Preview opens a new tab.
2. Confirm when `spacedReviewDailyNoteLinksUseOpenMode` is on and target-link open mode is `current`, clicking a review link inside today's managed Daily Note section in Live Preview opens in the current pane.
3. Confirm when that setting is off, the plugin does not intercept Daily Note wiki links.
4. Confirm Ctrl/Cmd-click is not intercepted by the plugin.
5. Confirm middle-click is not intercepted by the plugin.
6. Confirm non-today Daily Note files are not intercepted.
7. Confirm links outside today's managed Daily Note review section are not intercepted.
8. Confirm the Live Preview hit path can resolve candidate internal links from `[data-href]` ancestry instead of relying only on `a.internal-link`.
9. Confirm target links with headings still preserve the `#Heading` suffix when opened.
10. Confirm missing `data-href` and `href` values do not trigger interception and instead fall back to scoped debug logging.
11. Confirm the Daily Note output stays clean and does not reintroduce START or END markers, metadata blocks, or inline identity markers.

## Spaced Review Phase 3P Daily Note URI link open mode

1. Confirm when `spacedReviewDailyNoteLinksUseOpenMode` is off, Daily Note review links are generated as regular wiki links.
2. Confirm when `spacedReviewDailyNoteLinksUseOpenMode` is on and target-link open mode is `current`, Daily Note review links are generated as `obsidian://open` Markdown links without `paneType=tab`.
3. Confirm when `spacedReviewDailyNoteLinksUseOpenMode` is on and target-link open mode is `newTab`, Daily Note review links are generated as `obsidian://open` Markdown links with `paneType=tab`.
4. Confirm target links with headings encode `#` as `%23` inside the URI `file=` parameter.
5. Confirm clicking the URI link can still jump to the target heading.
6. Confirm `newTab` URI mode opens in a new tab without relying on a Daily Note click intercept.
7. Confirm `current` URI mode opens in the current pane without relying on a Daily Note click intercept.
8. Confirm checkbox import can still match older wiki-link lines after the setting is enabled later.
9. Confirm checkbox import can match newly generated URI-link lines.
10. Confirm there is no longer a Daily Note review-link click intercept registration in plugin runtime.
11. Confirm the Daily Note output stays clean and does not reintroduce START or END markers, metadata blocks, or inline identity markers.

## Spaced Review 0.3.1 hotfix edit modal delete and intervals

1. Create a task, open Edit, and confirm the `Delete task` button appears only in edit mode.
2. Click `Delete task`, then cancel the confirmation; confirm the task remains in All tasks.
3. Click `Delete task` again, confirm delete, and confirm the task is removed from All tasks.
4. Confirm a deleted actionable task also disappears from Today after the overview refresh.
5. Confirm deleting a task does not rewrite the Daily Note until the next manual or overview-driven sync.
6. Confirm deleting a task does not remove the target note itself.
7. Confirm the edit modal closes after a successful delete and shows the deleted notice.
8. Edit a task with no progress, switch to a built-in preset, save, and confirm the review track updates immediately.
9. Edit a task with no progress, switch to a settings custom preset, save, and confirm the review track updates immediately.
10. Edit a task with no progress, switch to manual custom intervals, save, and confirm the review track updates immediately.
11. Confirm edit mode initializes the interval UI from the task `intervalsSnapshot` instead of forcing the default preset.
12. Confirm switching preset in edit mode does not clear title, group, subgroup, note, target link, or manual custom interval text.
13. Edit a task with completed or skipped history, change intervals, and confirm the warning modal appears before save.
14. Confirm cancelling that warning leaves the task unchanged.
15. Confirm accepting that warning preserves valid completed/skipped sequence indexes within the new interval length.
16. Confirm completed/skipped sequence indexes beyond the new interval length are pruned.
17. Confirm completed/skipped date maps are pruned in the same way as their sequence indexes.
18. Confirm invalid manual intervals in edit mode do not save and keep the modal open.
