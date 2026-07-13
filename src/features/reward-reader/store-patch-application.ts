import { isSafeRewardReaderId, isValidVaultRelativePath } from './store';
import {
	REWARD_READER_CHAPTER_INDEX_CACHE_SCHEMA_VERSION,
	REWARD_READER_STORE_SCHEMA_VERSION,
	type RewardReaderChapterIndexCache,
	type RewardReaderNovel,
	type RewardReaderNovelProgress,
	type RewardReaderSourceKind,
	type RewardReaderStore,
} from './types';
import type {
	PreparedRewardReaderImportPayload,
	PrepareRewardReaderImportSuccess,
} from './import-assembly';

export interface ApplyPreparedRewardReaderImportInput {
	existingStore: RewardReaderStore;
	preparedImport: PrepareRewardReaderImportSuccess;
}

export type RewardReaderStorePatchErrorCode =
	| 'unsupported-store-schema'
	| 'invalid-existing-store'
	| 'invalid-prepared-import'
	| 'duplicate-novel-id'
	| 'duplicate-source-path'
	| 'conflicting-existing-progress'
	| 'invalid-primary-after-import';

export interface ApplyPreparedRewardReaderImportSuccess {
	ok: true;
	nextStore: RewardReaderStore;
	cache: RewardReaderChapterIndexCache;
	warnings: string[];
}

export interface ApplyPreparedRewardReaderImportFailure {
	ok: false;
	code: RewardReaderStorePatchErrorCode;
	message: string;
	warnings: string[];
}

export type ApplyPreparedRewardReaderImportResult =
	| ApplyPreparedRewardReaderImportSuccess
	| ApplyPreparedRewardReaderImportFailure;

type RewardReaderRecord = Record<string, unknown>;

interface ValidatedExistingStore {
	novelCount: number;
	primaryNovelId: string | null;
	existingNovelIds: Set<string>;
	existingSourcePaths: Set<string>;
	progressByNovelId: RewardReaderRecord;
}

interface ValidatedPayload {
	novel: RewardReaderNovel;
	progress: RewardReaderNovelProgress;
	cache: RewardReaderChapterIndexCache;
	primaryNovelIdAfterImport: string | null;
}

const REWARD_READER_SOURCE_KINDS = new Set<RewardReaderSourceKind>([
	'vault-txt',
	'vault-markdown',
]);

const ERROR_MESSAGES: Record<RewardReaderStorePatchErrorCode, string> = {
	'unsupported-store-schema':
		'Reward Reader cannot apply an import to an unsupported store version.',
	'invalid-existing-store':
		'Reward Reader cannot apply an import to an invalid store.',
	'invalid-prepared-import':
		'Reward Reader received an invalid prepared import.',
	'duplicate-novel-id':
		'A Reward Reader novel with this id already exists.',
	'duplicate-source-path':
		'This Vault source file is already registered in Reward Reader.',
	'conflicting-existing-progress':
		'Reward Reader progress already exists for this novel id.',
	'invalid-primary-after-import':
		'Reward Reader received an invalid primary novel result.',
};

function isPlainObject(value: unknown): value is RewardReaderRecord {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNonNegativeInteger(value: unknown): value is number {
	return (
		typeof value === 'number' &&
		Number.isFinite(value) &&
		Number.isInteger(value) &&
		value >= 0
	);
}

function isPositiveInteger(value: unknown): value is number {
	return isFiniteNonNegativeInteger(value) && value > 0;
}

function isValidIsoDateTimeString(value: unknown): value is string {
	return (
		typeof value === 'string' &&
		value.trim().length > 0 &&
		value === value.trim() &&
		/^\d{4}-\d{2}-\d{2}T/.test(value) &&
		!Number.isNaN(Date.parse(value))
	);
}

function isValidSingleLineTitle(value: unknown): value is string {
	return (
		typeof value === 'string' &&
		value.trim().length > 0 &&
		value === value.trim() &&
		!value.includes('\0') &&
		!value.includes('\r') &&
		!value.includes('\n')
	);
}

function isNormalizedVaultRelativePath(value: unknown): value is string {
	return typeof value === 'string' && value === value.trim()
		? isValidVaultRelativePath(value)
		: false;
}

function createFailure(
	code: RewardReaderStorePatchErrorCode,
	warnings: string[] = [],
): ApplyPreparedRewardReaderImportFailure {
	return {
		ok: false,
		code,
		message: ERROR_MESSAGES[code],
		warnings,
	};
}

function isApplicationFailure(
	value: unknown,
): value is ApplyPreparedRewardReaderImportFailure {
	return isPlainObject(value) && value.ok === false;
}

function collectWarnings(input: unknown): string[] | null {
	if (!Array.isArray(input)) {
		return null;
	}

	const warnings: string[] = [];
	const seenWarnings = new Set<string>();

	for (const entry of input) {
		if (typeof entry !== 'string') {
			return null;
		}

		if (seenWarnings.has(entry)) {
			continue;
		}

		seenWarnings.add(entry);
		warnings.push(entry);
	}

	return warnings;
}

function validateExistingStore(
	existingStore: unknown,
): ValidatedExistingStore | ApplyPreparedRewardReaderImportFailure {
	if (!isPlainObject(existingStore)) {
		return createFailure('invalid-existing-store');
	}

	if (existingStore.schemaVersion !== REWARD_READER_STORE_SCHEMA_VERSION) {
		return createFailure('unsupported-store-schema');
	}

	if (
		!Array.isArray(existingStore.novels) ||
		!isPlainObject(existingStore.progressByNovelId) ||
		!Array.isArray(existingStore.studyRecords) ||
		!Array.isArray(existingStore.unlockRecords) ||
		!Array.isArray(existingStore.readingRecords) ||
		!(
			existingStore.primaryNovelId === null ||
			typeof existingStore.primaryNovelId === 'string'
		)
	) {
		return createFailure('invalid-existing-store');
	}

	const existingNovelIds = new Set<string>();
	const existingSourcePaths = new Set<string>();

	for (const novel of existingStore.novels) {
		if (
			!isPlainObject(novel) ||
			typeof novel.id !== 'string' ||
			!isSafeRewardReaderId(novel.id) ||
			!isNormalizedVaultRelativePath(novel.sourcePath)
		) {
			return createFailure('invalid-existing-store');
		}

		if (
			existingNovelIds.has(novel.id) ||
			existingSourcePaths.has(novel.sourcePath)
		) {
			return createFailure('invalid-existing-store');
		}

		existingNovelIds.add(novel.id);
		existingSourcePaths.add(novel.sourcePath);
	}

	const primaryNovelId = existingStore.primaryNovelId;
	if (
		primaryNovelId !== null &&
		(!isSafeRewardReaderId(primaryNovelId) ||
			!existingNovelIds.has(primaryNovelId))
	) {
		return createFailure('invalid-existing-store');
	}

	return {
		novelCount: existingStore.novels.length,
		primaryNovelId,
		existingNovelIds,
		existingSourcePaths,
		progressByNovelId: existingStore.progressByNovelId,
	};
}

function validatePreparedImport(
	preparedImport: unknown,
): { payload: PreparedRewardReaderImportPayload; warnings: string[] }
	| ApplyPreparedRewardReaderImportFailure {
	if (!isPlainObject(preparedImport) || preparedImport.ok !== true) {
		return createFailure('invalid-prepared-import');
	}

	const warnings = collectWarnings(preparedImport.warnings);
	if (!warnings || !isPlainObject(preparedImport.payload)) {
		return createFailure('invalid-prepared-import');
	}

	return {
		payload: preparedImport.payload as unknown as PreparedRewardReaderImportPayload,
		warnings,
	};
}

function validateNovel(novel: unknown): RewardReaderNovel | null {
	if (!isPlainObject(novel)) {
		return null;
	}

	if (
		typeof novel.id !== 'string' ||
		!isSafeRewardReaderId(novel.id) ||
		!isValidSingleLineTitle(novel.title) ||
		!isNormalizedVaultRelativePath(novel.sourcePath) ||
		typeof novel.sourceKind !== 'string' ||
		!REWARD_READER_SOURCE_KINDS.has(novel.sourceKind as RewardReaderSourceKind) ||
		!isFiniteNonNegativeInteger(novel.sourceMtime) ||
		!isFiniteNonNegativeInteger(novel.sourceSize) ||
		!isValidIsoDateTimeString(novel.createdAt) ||
		!isValidIsoDateTimeString(novel.updatedAt) ||
		novel.createdAt !== novel.updatedAt
	) {
		return null;
	}

	return novel as unknown as RewardReaderNovel;
}

function validateProgress(
	progress: unknown,
	novel: RewardReaderNovel,
): RewardReaderNovelProgress | null {
	if (!isPlainObject(progress)) {
		return null;
	}

	if (
		progress.novelId !== novel.id ||
		progress.updatedAt !== novel.updatedAt ||
		progress.unlockedThroughChapterIndex !== null ||
		progress.readThroughChapterIndex !== null ||
		progress.currentChapterIndex !== null ||
		progress.currentChapterScrollOffset !== 0 ||
		progress.studyMinuteBalance !== 0 ||
		progress.totalStudyMinutes !== 0 ||
		progress.todayUnlockDate !== null ||
		progress.todayUnlockedChapters !== 0
	) {
		return null;
	}

	return progress as unknown as RewardReaderNovelProgress;
}

function validateCache(
	cache: unknown,
	novel: RewardReaderNovel,
): RewardReaderChapterIndexCache | null {
	if (!isPlainObject(cache)) {
		return null;
	}

	if (
		cache.schemaVersion !== REWARD_READER_CHAPTER_INDEX_CACHE_SCHEMA_VERSION ||
		cache.novelId !== novel.id ||
		cache.sourcePath !== novel.sourcePath ||
		cache.sourceMtime !== novel.sourceMtime ||
		cache.sourceSize !== novel.sourceSize ||
		!isPositiveInteger(cache.sourceTextLength) ||
		!isValidIsoDateTimeString(cache.generatedAt) ||
		!Array.isArray(cache.chapters) ||
		cache.chapters.length === 0
	) {
		return null;
	}

	const firstChapter = cache.chapters[0] as unknown;
	const lastChapter = cache.chapters[cache.chapters.length - 1] as unknown;
	if (
		!isPlainObject(firstChapter) ||
		firstChapter.chapterIndex !== 0 ||
		!isFiniteNonNegativeInteger(firstChapter.startOffset) ||
		!isFiniteNonNegativeInteger(firstChapter.endOffset) ||
		firstChapter.endOffset <= firstChapter.startOffset ||
		!isPlainObject(lastChapter) ||
		lastChapter.chapterIndex !== cache.chapters.length - 1 ||
		!isFiniteNonNegativeInteger(lastChapter.startOffset) ||
		!isFiniteNonNegativeInteger(lastChapter.endOffset) ||
		lastChapter.endOffset !== cache.sourceTextLength ||
		lastChapter.endOffset <= lastChapter.startOffset
	) {
		return null;
	}

	return cache as unknown as RewardReaderChapterIndexCache;
}

function validatePayload(
	payload: PreparedRewardReaderImportPayload,
): ValidatedPayload | ApplyPreparedRewardReaderImportFailure {
	if (!isPlainObject(payload)) {
		return createFailure('invalid-prepared-import');
	}

	const novel = validateNovel(payload.novel);
	if (!novel) {
		return createFailure('invalid-prepared-import');
	}

	const progress = validateProgress(payload.progress, novel);
	if (!progress) {
		return createFailure('invalid-prepared-import');
	}

	const cache = validateCache(payload.cache, novel);
	if (!cache) {
		return createFailure('invalid-prepared-import');
	}

	const primaryNovelIdAfterImport = payload.primaryNovelIdAfterImport;
	if (
		primaryNovelIdAfterImport !== null &&
		(typeof primaryNovelIdAfterImport !== 'string' ||
			!isSafeRewardReaderId(primaryNovelIdAfterImport))
	) {
		return createFailure('invalid-primary-after-import');
	}

	return {
		novel,
		progress,
		cache,
		primaryNovelIdAfterImport,
	};
}

function validatePrimaryNovelIdAfterImport(
	validatedExistingStore: ValidatedExistingStore,
	novelId: string,
	primaryNovelIdAfterImport: string | null,
	warnings: string[],
): ApplyPreparedRewardReaderImportFailure | null {
	if (validatedExistingStore.novelCount === 0) {
		return primaryNovelIdAfterImport === novelId
			? null
			: createFailure('invalid-primary-after-import', warnings);
	}

	if (validatedExistingStore.primaryNovelId !== null) {
		return primaryNovelIdAfterImport === novelId ||
			primaryNovelIdAfterImport === validatedExistingStore.primaryNovelId
			? null
			: createFailure('invalid-primary-after-import', warnings);
	}

	return primaryNovelIdAfterImport === novelId ||
		primaryNovelIdAfterImport === null
		? null
		: createFailure('invalid-primary-after-import', warnings);
}

export function applyPreparedRewardReaderImport(
	input: ApplyPreparedRewardReaderImportInput,
): ApplyPreparedRewardReaderImportResult {
	if (!isPlainObject(input)) {
		return createFailure('invalid-existing-store');
	}

	const existingStore = input.existingStore as unknown;
	const preparedImport = input.preparedImport as unknown;
	const validatedExistingStore = validateExistingStore(existingStore);
	if (isApplicationFailure(validatedExistingStore)) {
		return validatedExistingStore;
	}

	const validatedPreparedImport = validatePreparedImport(preparedImport);
	if (isApplicationFailure(validatedPreparedImport)) {
		return validatedPreparedImport;
	}

	const { payload, warnings } = validatedPreparedImport;
	const validatedPayload = validatePayload(payload);
	if (isApplicationFailure(validatedPayload)) {
		return {
			...validatedPayload,
			warnings,
		};
	}

	const novelId = validatedPayload.novel.id;
	if (validatedExistingStore.existingNovelIds.has(novelId)) {
		return createFailure('duplicate-novel-id', warnings);
	}

	if (validatedExistingStore.existingSourcePaths.has(validatedPayload.novel.sourcePath)) {
		return createFailure('duplicate-source-path', warnings);
	}

	if (
		Object.prototype.hasOwnProperty.call(
			validatedExistingStore.progressByNovelId,
			novelId,
		)
	) {
		return createFailure('conflicting-existing-progress', warnings);
	}

	const primaryValidationFailure = validatePrimaryNovelIdAfterImport(
		validatedExistingStore,
		novelId,
		validatedPayload.primaryNovelIdAfterImport,
		warnings,
	);
	if (primaryValidationFailure) {
		return primaryValidationFailure;
	}

	const existingRewardReaderStore = existingStore as RewardReaderStore;
	const copiedNovel: RewardReaderNovel = {
		...validatedPayload.novel,
	};
	const copiedProgress: RewardReaderNovelProgress = {
		...validatedPayload.progress,
	};

	return {
		ok: true,
		nextStore: {
			schemaVersion: existingRewardReaderStore.schemaVersion,
			primaryNovelId: validatedPayload.primaryNovelIdAfterImport,
			novels: [...existingRewardReaderStore.novels, copiedNovel],
			progressByNovelId: {
				...existingRewardReaderStore.progressByNovelId,
				[novelId]: copiedProgress,
			},
			studyRecords: existingRewardReaderStore.studyRecords,
			unlockRecords: existingRewardReaderStore.unlockRecords,
			readingRecords: existingRewardReaderStore.readingRecords,
		},
		cache: validatedPayload.cache,
		warnings: [...warnings],
	};
}
