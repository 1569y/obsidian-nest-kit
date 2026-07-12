import {
	REWARD_READER_CHAPTER_INDEX_CACHE_SCHEMA_VERSION,
	REWARD_READER_STORE_SCHEMA_VERSION,
	type RewardReaderChapterIndexCache,
	type RewardReaderChapterIndexEntry,
	type RewardReaderNovel,
	type RewardReaderNovelProgress,
	type RewardReaderReadingAction,
	type RewardReaderReadingRecord,
	type RewardReaderSourceKind,
	type RewardReaderStore,
	type RewardReaderStudyRecord,
	type RewardReaderUnlockRecord,
} from './types';

export const REWARD_READER_STORE_FOLDER = '.nestkit/reward-reader';
export const REWARD_READER_STORE_PATH =
	`${REWARD_READER_STORE_FOLDER}/state.json`;
export const REWARD_READER_INDEXES_FOLDER =
	`${REWARD_READER_STORE_FOLDER}/indexes`;

export interface RewardReaderStoreNormalizationResult {
	store: RewardReaderStore;
	didNormalize: boolean;
	shouldPersist: boolean;
	hasUnsupportedFutureVersion: boolean;
	warnings: string[];
}

export interface RewardReaderChapterIndexCacheNormalizationResult {
	cache: RewardReaderChapterIndexCache | null;
	didNormalize: boolean;
	shouldPersist: boolean;
	hasUnsupportedFutureVersion: boolean;
	warnings: string[];
}

type RewardReaderRecord = Record<string, unknown>;

const REWARD_READER_SOURCE_KINDS = new Set<RewardReaderSourceKind>([
	'vault-txt',
	'vault-markdown',
]);
const REWARD_READER_READING_ACTIONS = new Set<RewardReaderReadingAction>([
	'opened',
	'marked-read',
]);
const REWARD_READER_SAFE_ID_REGEX = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

function isPlainObject(value: unknown): value is RewardReaderRecord {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0;
}

export function isSafeRewardReaderId(value: string): boolean {
	return REWARD_READER_SAFE_ID_REGEX.test(value);
}

function readSafeRewardReaderId(value: unknown): string | undefined {
	return typeof value === 'string' && isSafeRewardReaderId(value)
		? value
		: undefined;
}

function isFiniteNonNegativeInteger(value: unknown): value is number {
	return (
		typeof value === 'number' &&
		Number.isFinite(value) &&
		Number.isInteger(value) &&
		value >= 0
	);
}

function isIsoDateString(value: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		return false;
	}

	const [yearText, monthText, dayText] = value.split('-');
	const year = Number(yearText);
	const month = Number(monthText);
	const day = Number(dayText);
	const date = new Date(Date.UTC(year, month - 1, day));

	return (
		date.getUTCFullYear() === year &&
		date.getUTCMonth() === month - 1 &&
		date.getUTCDate() === day
	);
}

export function isValidVaultRelativePath(value: unknown): value is string {
	if (typeof value !== 'string') {
		return false;
	}

	const normalizedValue = value.trim();
	if (normalizedValue.length === 0) {
		return false;
	}

	if (normalizedValue.includes('\0')) {
		return false;
	}

	if (normalizedValue.includes('\\')) {
		return false;
	}

	if (
		normalizedValue.startsWith('/') ||
		normalizedValue.startsWith('./') ||
		normalizedValue.startsWith('../')
	) {
		return false;
	}

	if (/^[A-Za-z]:\//.test(normalizedValue)) {
		return false;
	}

	if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(normalizedValue)) {
		return false;
	}

	return !normalizedValue.split('/').some(
		(segment) => segment.length === 0 || segment === '.' || segment === '..',
	);
}

function assertSafeRewardReaderId(value: string): string {
	if (!isSafeRewardReaderId(value)) {
		throw new Error(
			'Reward Reader novel id is invalid for chapter index cache path generation.',
		);
	}

	return value;
}

function normalizeIntegerList(
	input: unknown,
	allowEmpty = true,
): {
	values: number[];
	didNormalize: boolean;
} {
	if (!Array.isArray(input)) {
		return {
			values: [],
			didNormalize: true,
		};
	}

	const values: number[] = [];
	let didNormalize = false;

	for (const entry of input) {
		if (!isFiniteNonNegativeInteger(entry)) {
			didNormalize = true;
			continue;
		}

		values.push(entry);
	}

	const deduplicatedValues = [...new Set(values)].sort((left, right) => left - right);
	if (
		deduplicatedValues.length !== values.length ||
		deduplicatedValues.some((value, index) => value !== values[index])
	) {
		didNormalize = true;
	}

	if (!allowEmpty && deduplicatedValues.length === 0) {
		didNormalize = true;
	}

	return {
		values: deduplicatedValues,
		didNormalize,
	};
}

function normalizeRewardReaderNovel(
	raw: unknown,
	index: number,
): {
	novel?: RewardReaderNovel;
	didNormalize: boolean;
	warnings: string[];
} {
	if (!isPlainObject(raw)) {
		return {
			didNormalize: true,
			warnings: [
				`Reward Reader novel at index ${index} is invalid and was discarded.`,
			],
		};
	}

	const id = readSafeRewardReaderId(raw.id);
	const title = isNonEmptyString(raw.title) ? raw.title.trim() : undefined;
	const sourcePath = isValidVaultRelativePath(raw.sourcePath)
		? raw.sourcePath.trim()
		: undefined;
	const sourceKind =
		typeof raw.sourceKind === 'string' &&
		REWARD_READER_SOURCE_KINDS.has(raw.sourceKind as RewardReaderSourceKind)
			? (raw.sourceKind as RewardReaderSourceKind)
			: undefined;
	const sourceMtime = isFiniteNonNegativeInteger(raw.sourceMtime)
		? raw.sourceMtime
		: undefined;
	const sourceSize = isFiniteNonNegativeInteger(raw.sourceSize)
		? raw.sourceSize
		: undefined;
	const createdAt = isNonEmptyString(raw.createdAt)
		? raw.createdAt.trim()
		: undefined;
	const updatedAt = isNonEmptyString(raw.updatedAt)
		? raw.updatedAt.trim()
		: undefined;

	if (
		!id ||
		!title ||
		!sourcePath ||
		!sourceKind ||
		sourceMtime === undefined ||
		sourceSize === undefined ||
		!createdAt ||
		!updatedAt
	) {
		return {
			didNormalize: true,
			warnings: [
				`Reward Reader novel at index ${index} is invalid and was discarded.`,
			],
		};
	}

	const pathMatchesKind =
		(sourceKind === 'vault-markdown' && /\.md$/i.test(sourcePath)) ||
		(sourceKind === 'vault-txt' && /\.txt$/i.test(sourcePath));
	if (!pathMatchesKind) {
		return {
			didNormalize: true,
			warnings: [
				`Reward Reader novel "${id}" has a sourceKind and sourcePath extension mismatch; it was discarded.`,
			],
		};
	}

	return {
		novel: {
			id,
			title,
			sourcePath,
			sourceKind,
			sourceMtime,
			sourceSize,
			createdAt,
			updatedAt,
		},
		didNormalize: false,
		warnings: [],
	};
}

function normalizeRewardReaderNovelProgress(
	raw: unknown,
	novelIdKey: string,
): {
	progress?: RewardReaderNovelProgress;
	didNormalize: boolean;
	warnings: string[];
} {
	if (!isPlainObject(raw)) {
		return {
			didNormalize: true,
			warnings: [
				`Reward Reader progress for novel "${novelIdKey}" is invalid and was discarded.`,
			],
		};
	}

	if (!isSafeRewardReaderId(novelIdKey)) {
		return {
			didNormalize: true,
			warnings: [
				`Reward Reader progress key "${novelIdKey}" is invalid and was discarded.`,
			],
		};
	}

	const novelId = readSafeRewardReaderId(raw.novelId);
	const unlockedThroughChapterIndex =
		raw.unlockedThroughChapterIndex === null
			? null
			: isFiniteNonNegativeInteger(raw.unlockedThroughChapterIndex)
				? raw.unlockedThroughChapterIndex
				: undefined;
	const readThroughChapterIndex =
		raw.readThroughChapterIndex === null
			? null
			: isFiniteNonNegativeInteger(raw.readThroughChapterIndex)
				? raw.readThroughChapterIndex
				: undefined;
	const currentChapterIndex =
		raw.currentChapterIndex === null
			? null
			: isFiniteNonNegativeInteger(raw.currentChapterIndex)
				? raw.currentChapterIndex
				: undefined;
	const currentChapterScrollOffset = isFiniteNonNegativeInteger(
		raw.currentChapterScrollOffset,
	)
		? raw.currentChapterScrollOffset
		: undefined;
	const studyMinuteBalance = isFiniteNonNegativeInteger(raw.studyMinuteBalance)
		? raw.studyMinuteBalance
		: undefined;
	const totalStudyMinutes = isFiniteNonNegativeInteger(raw.totalStudyMinutes)
		? raw.totalStudyMinutes
		: undefined;
	const todayUnlockDate =
		raw.todayUnlockDate === null
			? null
			: typeof raw.todayUnlockDate === 'string' &&
					isIsoDateString(raw.todayUnlockDate)
				? raw.todayUnlockDate
				: undefined;
	const todayUnlockedChapters = isFiniteNonNegativeInteger(
		raw.todayUnlockedChapters,
	)
		? raw.todayUnlockedChapters
		: undefined;
	const updatedAt = isNonEmptyString(raw.updatedAt)
		? raw.updatedAt.trim()
		: undefined;

	if (
		!novelId ||
		unlockedThroughChapterIndex === undefined ||
		readThroughChapterIndex === undefined ||
		currentChapterIndex === undefined ||
		currentChapterScrollOffset === undefined ||
		studyMinuteBalance === undefined ||
		totalStudyMinutes === undefined ||
		todayUnlockDate === undefined ||
		todayUnlockedChapters === undefined ||
		!updatedAt
	) {
		return {
			didNormalize: true,
			warnings: [
				`Reward Reader progress for novel "${novelIdKey}" is invalid and was discarded.`,
			],
		};
	}

	if (
		(unlockedThroughChapterIndex === null &&
			(readThroughChapterIndex !== null || currentChapterIndex !== null)) ||
		(unlockedThroughChapterIndex !== null &&
			((readThroughChapterIndex !== null &&
				readThroughChapterIndex > unlockedThroughChapterIndex) ||
				(currentChapterIndex !== null &&
					currentChapterIndex > unlockedThroughChapterIndex))) ||
		studyMinuteBalance > totalStudyMinutes ||
		(todayUnlockDate === null && todayUnlockedChapters !== 0)
	) {
		return {
			didNormalize: true,
			warnings: [
				`Reward Reader progress for novel "${novelIdKey}" violated progress consistency rules and was discarded.`,
			],
		};
	}

	if (novelId !== novelIdKey) {
		return {
			didNormalize: true,
			warnings: [
				`Reward Reader progress key "${novelIdKey}" did not match its internal novelId "${novelId}" and was discarded.`,
			],
		};
	}

	return {
		progress: {
			novelId,
			unlockedThroughChapterIndex,
			readThroughChapterIndex,
			currentChapterIndex,
			currentChapterScrollOffset,
			studyMinuteBalance,
			totalStudyMinutes,
			todayUnlockDate,
			todayUnlockedChapters,
			updatedAt,
		},
		didNormalize: false,
		warnings: [],
	};
}

function normalizeRewardReaderStudyRecord(
	raw: unknown,
	index: number,
): {
	record?: RewardReaderStudyRecord;
	didNormalize: boolean;
	warnings: string[];
} {
	if (!isPlainObject(raw)) {
		return {
			didNormalize: true,
			warnings: [
				`Reward Reader study record at index ${index} is invalid and was discarded.`,
			],
		};
	}

	const id = readSafeRewardReaderId(raw.id);
	const novelId = readSafeRewardReaderId(raw.novelId);
	const content =
		typeof raw.content === 'string'
			? raw.content.replace(/\r\n?/g, '\n').trim()
			: undefined;
	const minutes =
		isFiniteNonNegativeInteger(raw.minutes) && raw.minutes > 0
			? raw.minutes
			: undefined;
	const createdAt = isNonEmptyString(raw.createdAt)
		? raw.createdAt.trim()
		: undefined;
	const balanceBefore = isFiniteNonNegativeInteger(raw.balanceBefore)
		? raw.balanceBefore
		: undefined;
	const balanceAfter = isFiniteNonNegativeInteger(raw.balanceAfter)
		? raw.balanceAfter
		: undefined;
	const unlockedChapterCount = isFiniteNonNegativeInteger(
		raw.unlockedChapterCount,
	)
		? raw.unlockedChapterCount
		: undefined;

	if (
		!id ||
		!novelId ||
		content === undefined ||
		minutes === undefined ||
		!createdAt ||
		balanceBefore === undefined ||
		balanceAfter === undefined ||
		unlockedChapterCount === undefined
	) {
		return {
			didNormalize: true,
			warnings: [
				`Reward Reader study record at index ${index} is invalid and was discarded.`,
			],
		};
	}

	return {
		record: {
			id,
			novelId,
			content,
			minutes,
			createdAt,
			balanceBefore,
			balanceAfter,
			unlockedChapterCount,
		},
		didNormalize: content !== raw.content,
		warnings:
			content !== raw.content
				? [
						`Reward Reader study record "${id}" normalized its content text.`,
					]
				: [],
	};
}

function normalizeRewardReaderUnlockRecord(
	raw: unknown,
	index: number,
): {
	record?: RewardReaderUnlockRecord;
	didNormalize: boolean;
	warnings: string[];
} {
	if (!isPlainObject(raw)) {
		return {
			didNormalize: true,
			warnings: [
				`Reward Reader unlock record at index ${index} is invalid and was discarded.`,
			],
		};
	}

	const id = readSafeRewardReaderId(raw.id);
	const novelId = readSafeRewardReaderId(raw.novelId);
	const studyRecordId = readSafeRewardReaderId(raw.studyRecordId);
	const unlockedChapterIndexesResult = normalizeIntegerList(
		raw.unlockedChapterIndexes,
		false,
	);
	const createdAt = isNonEmptyString(raw.createdAt)
		? raw.createdAt.trim()
		: undefined;

	if (
		!id ||
		!novelId ||
		!studyRecordId ||
		unlockedChapterIndexesResult.values.length === 0 ||
		!createdAt
	) {
		return {
			didNormalize: true,
			warnings: [
				`Reward Reader unlock record at index ${index} is invalid and was discarded.`,
			],
		};
	}

	return {
		record: {
			id,
			novelId,
			studyRecordId,
			unlockedChapterIndexes: unlockedChapterIndexesResult.values,
			createdAt,
		},
		didNormalize: unlockedChapterIndexesResult.didNormalize,
		warnings: unlockedChapterIndexesResult.didNormalize
			? [
					`Reward Reader unlock record "${id}" normalized unlocked chapter indexes.`,
				]
			: [],
	};
}

function normalizeRewardReaderReadingRecord(
	raw: unknown,
	index: number,
): {
	record?: RewardReaderReadingRecord;
	didNormalize: boolean;
	warnings: string[];
} {
	if (!isPlainObject(raw)) {
		return {
			didNormalize: true,
			warnings: [
				`Reward Reader reading record at index ${index} is invalid and was discarded.`,
			],
		};
	}

	const id = readSafeRewardReaderId(raw.id);
	const novelId = readSafeRewardReaderId(raw.novelId);
	const chapterIndex = isFiniteNonNegativeInteger(raw.chapterIndex)
		? raw.chapterIndex
		: undefined;
	const action =
		typeof raw.action === 'string' &&
		REWARD_READER_READING_ACTIONS.has(raw.action as RewardReaderReadingAction)
			? (raw.action as RewardReaderReadingAction)
			: undefined;
	const createdAt = isNonEmptyString(raw.createdAt)
		? raw.createdAt.trim()
		: undefined;

	if (
		!id ||
		!novelId ||
		chapterIndex === undefined ||
		!action ||
		!createdAt
	) {
		return {
			didNormalize: true,
			warnings: [
				`Reward Reader reading record at index ${index} is invalid and was discarded.`,
			],
		};
	}

	return {
		record: {
			id,
			novelId,
			chapterIndex,
			action,
			createdAt,
		},
		didNormalize: raw.scrollOffset !== undefined,
		warnings:
			raw.scrollOffset !== undefined
				? [
						`Reward Reader reading record "${id}" removed unsupported scrollOffset history data.`,
					]
				: [],
	};
}

function normalizeRewardReaderChapterIndexEntry(
	raw: unknown,
	index: number,
): {
	entry?: RewardReaderChapterIndexEntry;
	didNormalize: boolean;
	warnings: string[];
} {
	if (!isPlainObject(raw)) {
		return {
			didNormalize: true,
			warnings: [
				`Reward Reader chapter index entry at index ${index} is invalid and was discarded.`,
			],
		};
	}

	const chapterIndex = isFiniteNonNegativeInteger(raw.chapterIndex)
		? raw.chapterIndex
		: undefined;
	const title = isNonEmptyString(raw.title) ? raw.title.trim() : undefined;
	const startOffset = isFiniteNonNegativeInteger(raw.startOffset)
		? raw.startOffset
		: undefined;
	const endOffset = isFiniteNonNegativeInteger(raw.endOffset)
		? raw.endOffset
		: undefined;

	if (
		chapterIndex === undefined ||
		!title ||
		startOffset === undefined ||
		endOffset === undefined ||
		endOffset <= startOffset
	) {
		return {
			didNormalize: true,
			warnings: [
				`Reward Reader chapter index entry at index ${index} is invalid and was discarded.`,
			],
		};
	}

	return {
		entry: {
			chapterIndex,
			title,
			startOffset,
			endOffset,
		},
		didNormalize: false,
		warnings: [],
	};
}

function normalizeRewardReaderChapterEntries(
	input: unknown,
	sourceTextLength: number,
): {
	chapters: RewardReaderChapterIndexEntry[];
	didNormalize: boolean;
	warnings: string[];
	isUsable: boolean;
} {
	const warnings: string[] = [];
	let didNormalize = false;

	if (!Array.isArray(input)) {
		return {
			chapters: [],
			didNormalize: true,
			warnings: [
				'Reward Reader chapter index cache chapters is missing or invalid and the cache must be rebuilt.',
			],
			isUsable: false,
		};
	}

	const chapters: RewardReaderChapterIndexEntry[] = [];

	for (let index = 0; index < input.length; index += 1) {
		const normalizedEntry = normalizeRewardReaderChapterIndexEntry(
			input[index],
			index,
		);
		if (normalizedEntry.didNormalize) {
			didNormalize = true;
		}
		warnings.push(...normalizedEntry.warnings);
		if (!normalizedEntry.entry) {
			return {
				chapters: [],
				didNormalize: true,
				warnings: [
					...warnings,
					'Reward Reader chapter index cache contains invalid chapter entries and must be rebuilt.',
				],
				isUsable: false,
			};
		}

		chapters.push(normalizedEntry.entry);
	}

	const sortedChapters = [...chapters].sort(
		(left, right) => left.chapterIndex - right.chapterIndex,
	);
	if (
		sortedChapters.length !== chapters.length ||
		sortedChapters.some(
			(entry, index) => entry.chapterIndex !== chapters[index]!.chapterIndex,
		)
	) {
		didNormalize = true;
	}

	for (let index = 0; index < sortedChapters.length; index += 1) {
		const chapter = sortedChapters[index];
		if (!chapter || chapter.chapterIndex !== index) {
			return {
				didNormalize: true,
				warnings: [
					...warnings,
					'Reward Reader chapter index cache chapters must use continuous chapterIndex values starting at 0.',
				],
				chapters: [],
				isUsable: false,
			};
		}
	}

	if (sourceTextLength === 0 && sortedChapters.length > 0) {
		return {
			chapters: [],
			didNormalize: true,
			warnings: [
				...warnings,
				'Reward Reader chapter index cache cannot contain chapters when sourceTextLength is 0.',
			],
			isUsable: false,
		};
	}

	let previousChapter: RewardReaderChapterIndexEntry | null = null;
	for (const chapter of sortedChapters) {
		if (chapter.endOffset > sourceTextLength) {
			return {
				chapters: [],
				didNormalize: true,
				warnings: [
					...warnings,
					'Reward Reader chapter index cache contains chapter offsets beyond sourceTextLength.',
				],
				isUsable: false,
			};
		}

		if (
			previousChapter &&
			chapter.startOffset < previousChapter.endOffset
		) {
			return {
				chapters: [],
				didNormalize: true,
				warnings: [
					...warnings,
					'Reward Reader chapter index cache contains overlapping chapter offsets.',
				],
				isUsable: false,
			};
		}

		previousChapter = chapter;
	}

	return {
		chapters: sortedChapters,
		didNormalize,
		warnings,
		isUsable: true,
	};
}

export function createDefaultRewardReaderStore(): RewardReaderStore {
	return {
		schemaVersion: REWARD_READER_STORE_SCHEMA_VERSION,
		primaryNovelId: null,
		novels: [],
		progressByNovelId: {},
		studyRecords: [],
		unlockRecords: [],
		readingRecords: [],
	};
}

export function getRewardReaderChapterIndexCachePath(novelId: string): string {
	return `${REWARD_READER_INDEXES_FOLDER}/${assertSafeRewardReaderId(novelId)}.json`;
}

export function normalizeRewardReaderStore(
	raw: unknown,
): RewardReaderStoreNormalizationResult {
	const defaultStore = createDefaultRewardReaderStore();
	const warnings: string[] = [];
	let didNormalize = false;
	let shouldPersist = false;
	let hasUnsupportedFutureVersion = false;

	const markNormalized = (): void => {
		didNormalize = true;
		if (!hasUnsupportedFutureVersion) {
			shouldPersist = true;
		}
	};

	if (!isPlainObject(raw)) {
		return {
			store: defaultStore,
			didNormalize: true,
			shouldPersist: false,
			hasUnsupportedFutureVersion: false,
			warnings: [
				'Reward Reader store is invalid or unusable; runtime will use an empty default store and must not auto-overwrite the source data.',
			],
		};
	}

	const rawSchemaVersion = raw.schemaVersion;
	if (
		typeof rawSchemaVersion === 'number' &&
		Number.isInteger(rawSchemaVersion) &&
		rawSchemaVersion > REWARD_READER_STORE_SCHEMA_VERSION
	) {
		hasUnsupportedFutureVersion = true;
		didNormalize = true;
		warnings.push('Reward Reader store schemaVersion was normalized to 1.');
		warnings.push(
			`Unsupported future Reward Reader store schemaVersion ${String(rawSchemaVersion)} was detected; runtime will read known fields without persisting changes.`,
		);
	} else if (rawSchemaVersion !== REWARD_READER_STORE_SCHEMA_VERSION) {
		markNormalized();
		warnings.push('Reward Reader store schemaVersion was normalized to 1.');
	}

	const novels: RewardReaderNovel[] = [];
	const rawNovels = Array.isArray(raw.novels) ? raw.novels : [];
	if (!Array.isArray(raw.novels)) {
		markNormalized();
		warnings.push('Reward Reader store novels was normalized to an empty list.');
	}

	const seenNovelIds = new Set<string>();
	for (let index = 0; index < rawNovels.length; index += 1) {
		const normalizedNovel = normalizeRewardReaderNovel(rawNovels[index], index);
		if (normalizedNovel.didNormalize) {
			markNormalized();
		}
		warnings.push(...normalizedNovel.warnings);
		if (!normalizedNovel.novel) {
			continue;
		}
		if (seenNovelIds.has(normalizedNovel.novel.id)) {
			markNormalized();
			warnings.push(
				`Reward Reader novel id "${normalizedNovel.novel.id}" was duplicated; later entries were discarded.`,
			);
			continue;
		}

		seenNovelIds.add(normalizedNovel.novel.id);
		novels.push(normalizedNovel.novel);
	}

	const progressByNovelId: Record<string, RewardReaderNovelProgress> = {};
	if (isPlainObject(raw.progressByNovelId)) {
		for (const [novelIdKey, value] of Object.entries(raw.progressByNovelId)) {
			const normalizedProgress = normalizeRewardReaderNovelProgress(
				value,
				novelIdKey,
			);
			if (normalizedProgress.didNormalize) {
				markNormalized();
			}
			warnings.push(...normalizedProgress.warnings);
			if (!normalizedProgress.progress) {
				continue;
			}
			if (normalizedProgress.progress.novelId !== novelIdKey) {
				continue;
			}
			if (!seenNovelIds.has(normalizedProgress.progress.novelId)) {
				markNormalized();
				warnings.push(
					`Reward Reader progress for unknown novel "${normalizedProgress.progress.novelId}" was discarded.`,
				);
				continue;
			}
			progressByNovelId[normalizedProgress.progress.novelId] =
				normalizedProgress.progress;
		}
	} else if (raw.progressByNovelId !== undefined) {
		markNormalized();
		warnings.push(
			'Reward Reader store progressByNovelId was normalized to an empty object.',
		);
	}

	const primaryNovelId =
		readSafeRewardReaderId(raw.primaryNovelId) &&
		seenNovelIds.has(raw.primaryNovelId as string)
			? (raw.primaryNovelId as string)
			: null;
	if (raw.primaryNovelId !== primaryNovelId) {
		markNormalized();
		if (raw.primaryNovelId !== undefined) {
			warnings.push(
				'Reward Reader primaryNovelId did not point to a known novel and was normalized to null.',
			);
		}
	}

	const studyRecords: RewardReaderStudyRecord[] = [];
	const retainedStudyRecordsById = new Map<string, RewardReaderStudyRecord>();
	const rawStudyRecords = Array.isArray(raw.studyRecords) ? raw.studyRecords : [];
	if (!Array.isArray(raw.studyRecords)) {
		markNormalized();
		warnings.push(
			'Reward Reader store studyRecords was normalized to an empty list.',
		);
	}
	for (let index = 0; index < rawStudyRecords.length; index += 1) {
		const normalizedRecord = normalizeRewardReaderStudyRecord(
			rawStudyRecords[index],
			index,
		);
		if (normalizedRecord.didNormalize) {
			markNormalized();
		}
		warnings.push(...normalizedRecord.warnings);
		if (!normalizedRecord.record) {
			continue;
		}
		if (!seenNovelIds.has(normalizedRecord.record.novelId)) {
			markNormalized();
			warnings.push(
				`Reward Reader study record "${normalizedRecord.record.id}" pointed to an unknown novel and was discarded.`,
			);
			continue;
		}
		if (retainedStudyRecordsById.has(normalizedRecord.record.id)) {
			markNormalized();
			warnings.push(
				`Reward Reader study record id "${normalizedRecord.record.id}" was duplicated; later entries were discarded.`,
			);
			continue;
		}
		retainedStudyRecordsById.set(
			normalizedRecord.record.id,
			normalizedRecord.record,
		);
		studyRecords.push(normalizedRecord.record);
	}

	const unlockRecords: RewardReaderUnlockRecord[] = [];
	const seenUnlockRecordIds = new Set<string>();
	const rawUnlockRecords = Array.isArray(raw.unlockRecords)
		? raw.unlockRecords
		: [];
	if (!Array.isArray(raw.unlockRecords)) {
		markNormalized();
		warnings.push(
			'Reward Reader store unlockRecords was normalized to an empty list.',
		);
	}
	for (let index = 0; index < rawUnlockRecords.length; index += 1) {
		const normalizedRecord = normalizeRewardReaderUnlockRecord(
			rawUnlockRecords[index],
			index,
		);
		if (normalizedRecord.didNormalize) {
			markNormalized();
		}
		warnings.push(...normalizedRecord.warnings);
		if (!normalizedRecord.record) {
			continue;
		}
		if (!seenNovelIds.has(normalizedRecord.record.novelId)) {
			markNormalized();
			warnings.push(
				`Reward Reader unlock record "${normalizedRecord.record.id}" pointed to an unknown novel and was discarded.`,
			);
			continue;
		}
		if (seenUnlockRecordIds.has(normalizedRecord.record.id)) {
			markNormalized();
			warnings.push(
				`Reward Reader unlock record id "${normalizedRecord.record.id}" was duplicated; later entries were discarded.`,
			);
			continue;
		}
		const studyRecord = retainedStudyRecordsById.get(
			normalizedRecord.record.studyRecordId,
		);
		if (!studyRecord) {
			markNormalized();
			warnings.push(
				`Reward Reader unlock record "${normalizedRecord.record.id}" pointed to a missing study record and was discarded.`,
			);
			continue;
		}
		if (studyRecord.novelId !== normalizedRecord.record.novelId) {
			markNormalized();
			warnings.push(
				`Reward Reader unlock record "${normalizedRecord.record.id}" did not match its referenced study record novel and was discarded.`,
			);
			continue;
		}
		seenUnlockRecordIds.add(normalizedRecord.record.id);
		unlockRecords.push(normalizedRecord.record);
	}

	const readingRecords: RewardReaderReadingRecord[] = [];
	const seenReadingRecordIds = new Set<string>();
	const rawReadingRecords = Array.isArray(raw.readingRecords)
		? raw.readingRecords
		: [];
	if (!Array.isArray(raw.readingRecords)) {
		markNormalized();
		warnings.push(
			'Reward Reader store readingRecords was normalized to an empty list.',
		);
	}
	for (let index = 0; index < rawReadingRecords.length; index += 1) {
		const normalizedRecord = normalizeRewardReaderReadingRecord(
			rawReadingRecords[index],
			index,
		);
		if (normalizedRecord.didNormalize) {
			markNormalized();
		}
		warnings.push(...normalizedRecord.warnings);
		if (!normalizedRecord.record) {
			continue;
		}
		if (!seenNovelIds.has(normalizedRecord.record.novelId)) {
			markNormalized();
			warnings.push(
				`Reward Reader reading record "${normalizedRecord.record.id}" pointed to an unknown novel and was discarded.`,
			);
			continue;
		}
		if (seenReadingRecordIds.has(normalizedRecord.record.id)) {
			markNormalized();
			warnings.push(
				`Reward Reader reading record id "${normalizedRecord.record.id}" was duplicated; later entries were discarded.`,
			);
			continue;
		}
		seenReadingRecordIds.add(normalizedRecord.record.id);
		readingRecords.push(normalizedRecord.record);
	}

	return {
		store: {
			schemaVersion: REWARD_READER_STORE_SCHEMA_VERSION,
			primaryNovelId,
			novels,
			progressByNovelId,
			studyRecords,
			unlockRecords,
			readingRecords,
		},
		didNormalize,
		shouldPersist,
		hasUnsupportedFutureVersion,
		warnings,
	};
}

export function normalizeRewardReaderChapterIndexCache(
	raw: unknown,
): RewardReaderChapterIndexCacheNormalizationResult {
	const warnings: string[] = [];
	let didNormalize = false;
	let hasUnsupportedFutureVersion = false;

	const markNormalized = (): void => {
		didNormalize = true;
	};

	if (!isPlainObject(raw)) {
		return {
			cache: null,
			didNormalize: true,
			shouldPersist: false,
			hasUnsupportedFutureVersion: false,
			warnings: [
				'Reward Reader chapter index cache is invalid and must be rebuilt.',
			],
		};
	}

	const rawSchemaVersion = raw.schemaVersion;
	if (
		typeof rawSchemaVersion === 'number' &&
		Number.isInteger(rawSchemaVersion) &&
		rawSchemaVersion > REWARD_READER_CHAPTER_INDEX_CACHE_SCHEMA_VERSION
	) {
		hasUnsupportedFutureVersion = true;
		didNormalize = true;
		warnings.push(
			'Reward Reader chapter index cache schemaVersion was normalized to 1.',
		);
		warnings.push(
			`Unsupported future Reward Reader chapter index cache schemaVersion ${String(rawSchemaVersion)} was detected; runtime will read known fields without persisting changes.`,
		);
	} else if (
		rawSchemaVersion !== REWARD_READER_CHAPTER_INDEX_CACHE_SCHEMA_VERSION
	) {
		markNormalized();
		warnings.push(
			'Reward Reader chapter index cache schemaVersion was normalized to 1.',
		);
	}

	const novelId = readSafeRewardReaderId(raw.novelId) ?? null;
	const sourcePath = isValidVaultRelativePath(raw.sourcePath)
		? raw.sourcePath.trim()
		: null;
	const sourceMtime = isFiniteNonNegativeInteger(raw.sourceMtime)
		? raw.sourceMtime
		: null;
	const sourceSize = isFiniteNonNegativeInteger(raw.sourceSize)
		? raw.sourceSize
		: null;
	const sourceTextLength = isFiniteNonNegativeInteger(raw.sourceTextLength)
		? raw.sourceTextLength
		: null;
	const generatedAt = isNonEmptyString(raw.generatedAt)
		? raw.generatedAt.trim()
		: null;

	if (!novelId) {
		warnings.push(
			'Reward Reader chapter index cache novelId is invalid and the cache must be rebuilt.',
		);
	}
	if (!sourcePath) {
		warnings.push(
			'Reward Reader chapter index cache sourcePath is invalid and the cache must be rebuilt.',
		);
	}
	if (sourceMtime === null) {
		warnings.push(
			'Reward Reader chapter index cache sourceMtime is invalid and the cache must be rebuilt.',
		);
	}
	if (sourceSize === null) {
		warnings.push(
			'Reward Reader chapter index cache sourceSize is invalid and the cache must be rebuilt.',
		);
	}
	if (sourceTextLength === null) {
		warnings.push(
			'Reward Reader chapter index cache sourceTextLength is invalid and the cache must be rebuilt.',
		);
	}
	if (!generatedAt) {
		warnings.push(
			'Reward Reader chapter index cache generatedAt is invalid and the cache must be rebuilt.',
		);
	}

	if (
		!novelId ||
		!sourcePath ||
		sourceMtime === null ||
		sourceSize === null ||
		sourceTextLength === null ||
		!generatedAt
	) {
		return {
			cache: null,
			didNormalize: true,
			shouldPersist: false,
			hasUnsupportedFutureVersion,
			warnings,
		};
	}

	const chapterNormalization = normalizeRewardReaderChapterEntries(
		raw.chapters,
		sourceTextLength,
	);
	if (chapterNormalization.didNormalize) {
		markNormalized();
	}
	warnings.push(...chapterNormalization.warnings);

	if (!chapterNormalization.isUsable) {
		return {
			cache: null,
			didNormalize: true,
			shouldPersist: false,
			hasUnsupportedFutureVersion,
			warnings: [
				...warnings,
				'Reward Reader chapter index cache is unusable and must be rebuilt.',
			],
		};
	}

	return {
		cache: {
			schemaVersion: REWARD_READER_CHAPTER_INDEX_CACHE_SCHEMA_VERSION,
			novelId,
			sourcePath,
			sourceMtime,
			sourceSize,
			sourceTextLength,
			generatedAt,
			chapters: chapterNormalization.chapters,
		},
		didNormalize,
		shouldPersist: didNormalize && !hasUnsupportedFutureVersion,
		hasUnsupportedFutureVersion,
		warnings,
	};
}
