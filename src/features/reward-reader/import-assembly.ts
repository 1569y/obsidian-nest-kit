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
import type { RewardReaderVaultSourceInspectionSuccess } from './vault-source-reader';

export interface PrepareRewardReaderImportInput {
	existingStore: RewardReaderStore;
	inspection: RewardReaderVaultSourceInspectionSuccess;
	title: string;
	preparedAt: string;
	makePrimary: boolean;
}

export interface PreparedRewardReaderImportPayload {
	novel: RewardReaderNovel;
	progress: RewardReaderNovelProgress;
	cache: RewardReaderChapterIndexCache;
	primaryNovelIdAfterImport: string | null;
}

export type RewardReaderImportPreparationErrorCode =
	| 'invalid-title'
	| 'invalid-prepared-at'
	| 'invalid-make-primary'
	| 'unsupported-store-schema'
	| 'invalid-existing-store'
	| 'duplicate-novel-id'
	| 'duplicate-source-path'
	| 'conflicting-existing-progress'
	| 'inconsistent-inspection';

export interface PrepareRewardReaderImportSuccess {
	ok: true;
	payload: PreparedRewardReaderImportPayload;
	warnings: string[];
}

export interface PrepareRewardReaderImportFailure {
	ok: false;
	code: RewardReaderImportPreparationErrorCode;
	message: string;
	warnings: string[];
}

export type PrepareRewardReaderImportResult =
	| PrepareRewardReaderImportSuccess
	| PrepareRewardReaderImportFailure;

type RewardReaderRecord = Record<string, unknown>;

interface ValidatedExistingStore {
	novelCount: number;
	primaryNovelId: string | null;
	existingNovelIds: Set<string>;
	existingSourcePaths: Set<string>;
	progressByNovelId: RewardReaderRecord;
}

interface ValidatedInspection {
	novelId: string;
	sourcePath: string;
	sourceKind: RewardReaderSourceKind;
	sourceMtime: number;
	sourceSize: number;
	cache: RewardReaderChapterIndexCache;
	warnings: string[];
}

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

function isValidIsoDateTimeString(value: unknown): value is string {
	return (
		typeof value === 'string' &&
		value.trim().length > 0 &&
		/^\d{4}-\d{2}-\d{2}T/.test(value) &&
		!Number.isNaN(Date.parse(value))
	);
}

function isNormalizedVaultRelativePath(value: unknown): value is string {
	return typeof value === 'string' && value === value.trim()
		? isValidVaultRelativePath(value)
		: false;
}

function isNonEmptyTrimmedString(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0;
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

function createFailure(
	code: RewardReaderImportPreparationErrorCode,
	message: string,
	warnings: string[],
): PrepareRewardReaderImportFailure {
	return {
		ok: false,
		code,
		message,
		warnings,
	};
}

function isPreparationFailure(
	value: unknown,
): value is PrepareRewardReaderImportFailure {
	return isPlainObject(value) && value.ok === false;
}

function detectSourceKindFromPath(
	sourcePath: string,
): RewardReaderSourceKind | null {
	if (/\.txt$/iu.test(sourcePath)) {
		return 'vault-txt';
	}

	if (/\.md$/iu.test(sourcePath)) {
		return 'vault-markdown';
	}

	return null;
}

function validateTitle(
	title: string,
	inspectionWarnings: string[],
): { ok: true; normalizedTitle: string } | PrepareRewardReaderImportFailure {
	if (
		typeof title !== 'string' ||
		title.includes('\0') ||
		title.includes('\r') ||
		title.includes('\n')
	) {
		return createFailure(
			'invalid-title',
			'Reward Reader requires a non-empty single-line novel title.',
			inspectionWarnings,
		);
	}

	const normalizedTitle = title.trim();
	if (normalizedTitle.length === 0) {
		return createFailure(
			'invalid-title',
			'Reward Reader requires a non-empty single-line novel title.',
			inspectionWarnings,
		);
	}

	return {
		ok: true,
		normalizedTitle,
	};
}

function validatePreparedAt(
	preparedAt: string,
	inspectionWarnings: string[],
): { ok: true; normalizedPreparedAt: string } | PrepareRewardReaderImportFailure {
	if (typeof preparedAt !== 'string') {
		return createFailure(
			'invalid-prepared-at',
			'Reward Reader import preparation requires a valid timestamp.',
			inspectionWarnings,
		);
	}

	const normalizedPreparedAt = preparedAt.trim();
	if (!isValidIsoDateTimeString(normalizedPreparedAt)) {
		return createFailure(
			'invalid-prepared-at',
			'Reward Reader import preparation requires a valid timestamp.',
			inspectionWarnings,
		);
	}

	return {
		ok: true,
		normalizedPreparedAt,
	};
}

function validateMakePrimary(
	makePrimary: boolean,
	inspectionWarnings: string[],
): { ok: true; makePrimary: boolean } | PrepareRewardReaderImportFailure {
	if (typeof makePrimary !== 'boolean') {
		return createFailure(
			'invalid-make-primary',
			'Reward Reader import preparation requires an explicit primary selection.',
			inspectionWarnings,
		);
	}

	return {
		ok: true,
		makePrimary,
	};
}

function validateExistingStore(
	existingStore: RewardReaderStore,
	inspectionWarnings: string[],
): ValidatedExistingStore | PrepareRewardReaderImportFailure {
	if (!isPlainObject(existingStore)) {
		return createFailure(
			'invalid-existing-store',
			'Reward Reader import preparation requires a normalized existing store.',
			inspectionWarnings,
		);
	}

	if (existingStore.schemaVersion !== REWARD_READER_STORE_SCHEMA_VERSION) {
		return createFailure(
			'unsupported-store-schema',
			'Reward Reader import preparation does not support this store schema version.',
			inspectionWarnings,
		);
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
		return createFailure(
			'invalid-existing-store',
			'Reward Reader import preparation requires a normalized existing store.',
			inspectionWarnings,
		);
	}

	const existingNovelIds = new Set<string>();
	const existingSourcePaths = new Set<string>();

	for (const novel of existingStore.novels) {
		if (
			!isPlainObject(novel) ||
			!isSafeRewardReaderId(novel.id) ||
			!isNormalizedVaultRelativePath(novel.sourcePath)
		) {
			return createFailure(
				'invalid-existing-store',
				'Reward Reader import preparation requires a normalized existing store.',
				inspectionWarnings,
			);
		}

		if (existingNovelIds.has(novel.id)) {
			return createFailure(
				'invalid-existing-store',
				'Reward Reader import preparation requires a normalized existing store.',
				inspectionWarnings,
			);
		}

		existingNovelIds.add(novel.id);
		existingSourcePaths.add(novel.sourcePath);
	}

	const primaryNovelId =
		existingStore.primaryNovelId === null ? null : existingStore.primaryNovelId;
	if (
		primaryNovelId !== null &&
		(!isSafeRewardReaderId(primaryNovelId) ||
			!existingNovelIds.has(primaryNovelId))
	) {
		return createFailure(
			'invalid-existing-store',
			'Reward Reader import preparation requires a normalized existing store.',
			inspectionWarnings,
		);
	}

	return {
		novelCount: existingStore.novels.length,
		primaryNovelId,
		existingNovelIds,
		existingSourcePaths,
		progressByNovelId: existingStore.progressByNovelId,
	};
}

function validateInspection(
	inspection: unknown,
): ValidatedInspection | PrepareRewardReaderImportFailure {
	if (!isPlainObject(inspection) || inspection.ok !== true) {
		return createFailure(
			'inconsistent-inspection',
			'Reward Reader received an inconsistent source inspection result.',
			[],
		);
	}

	const inspectionRecord = inspection;
	const warnings = collectWarnings(inspectionRecord.warnings);
	if (!warnings) {
		return createFailure(
			'inconsistent-inspection',
			'Reward Reader received an inconsistent source inspection result.',
			[],
		);
	}

	const sourcePath = inspectionRecord.sourcePath;
	const sourceMtime = inspectionRecord.sourceMtime;
	const sourceSize = inspectionRecord.sourceSize;
	const sourceTextLength = inspectionRecord.sourceTextLength;
	const chapterCount = inspectionRecord.chapterCount;
	const ignoredPrefixLength = inspectionRecord.ignoredPrefixLength;
	if (
		!isNormalizedVaultRelativePath(sourcePath) ||
		!isFiniteNonNegativeInteger(sourceMtime) ||
		!isFiniteNonNegativeInteger(sourceSize) ||
		!isFiniteNonNegativeInteger(sourceTextLength) ||
		!isFiniteNonNegativeInteger(chapterCount) ||
		!isFiniteNonNegativeInteger(ignoredPrefixLength)
	) {
		return createFailure(
			'inconsistent-inspection',
			'Reward Reader received an inconsistent source inspection result.',
			warnings,
		);
	}

	if (ignoredPrefixLength > sourceTextLength || sourceTextLength === 0) {
		return createFailure(
			'inconsistent-inspection',
			'Reward Reader received an inconsistent source inspection result.',
			warnings,
		);
	}

	const cacheCandidate = inspectionRecord.cache;
	if (!isPlainObject(cacheCandidate)) {
		return createFailure(
			'inconsistent-inspection',
			'Reward Reader received an inconsistent source inspection result.',
			warnings,
		);
	}

	const cacheRecord = cacheCandidate;
	const cacheNovelId = cacheRecord.novelId;
	const cacheSourcePath = cacheRecord.sourcePath;
	const cacheSourceMtime = cacheRecord.sourceMtime;
	const cacheSourceSize = cacheRecord.sourceSize;
	const cacheSourceTextLength = cacheRecord.sourceTextLength;
	const cacheGeneratedAt = cacheRecord.generatedAt;
	const cacheChaptersValue = cacheRecord.chapters;
	if (
		cacheRecord.schemaVersion !==
			REWARD_READER_CHAPTER_INDEX_CACHE_SCHEMA_VERSION ||
		typeof cacheNovelId !== 'string' ||
		!isSafeRewardReaderId(cacheNovelId) ||
		!isNormalizedVaultRelativePath(cacheSourcePath) ||
		!isFiniteNonNegativeInteger(cacheSourceMtime) ||
		!isFiniteNonNegativeInteger(cacheSourceSize) ||
		!isFiniteNonNegativeInteger(cacheSourceTextLength) ||
		!isValidIsoDateTimeString(cacheGeneratedAt) ||
		cacheGeneratedAt !== cacheGeneratedAt.trim() ||
		!Array.isArray(cacheChaptersValue) ||
		cacheChaptersValue.length === 0
	) {
		return createFailure(
			'inconsistent-inspection',
			'Reward Reader received an inconsistent source inspection result.',
			warnings,
		);
	}

	const cacheChapters = cacheChaptersValue as unknown[];
	const normalizedSourcePath = sourcePath;
	const normalizedCacheNovelId = cacheNovelId;
	const expectedSourceKind = detectSourceKindFromPath(normalizedSourcePath);
	if (
		!expectedSourceKind ||
		expectedSourceKind !== inspectionRecord.sourceKind ||
		normalizedSourcePath !== cacheSourcePath ||
		sourceMtime !== cacheSourceMtime ||
		sourceSize !== cacheSourceSize ||
		sourceTextLength !== cacheSourceTextLength ||
		chapterCount !== cacheChapters.length
	) {
		return createFailure(
			'inconsistent-inspection',
			'Reward Reader received an inconsistent source inspection result.',
			warnings,
		);
	}

	const firstChapter: unknown = cacheChapters[0];
	const lastChapter: unknown = cacheChapters[cacheChapters.length - 1];
	if (
		!isPlainObject(firstChapter) ||
		!isFiniteNonNegativeInteger(firstChapter.chapterIndex) ||
		firstChapter.chapterIndex !== 0 ||
		!isFiniteNonNegativeInteger(firstChapter.startOffset) ||
		firstChapter.startOffset !== ignoredPrefixLength ||
		!isFiniteNonNegativeInteger(firstChapter.endOffset) ||
		firstChapter.endOffset <= firstChapter.startOffset ||
		!isNonEmptyTrimmedString(firstChapter.title) ||
		!isPlainObject(lastChapter) ||
		!isFiniteNonNegativeInteger(lastChapter.chapterIndex) ||
		lastChapter.chapterIndex !== cacheChapters.length - 1 ||
		!isFiniteNonNegativeInteger(lastChapter.startOffset) ||
		!isFiniteNonNegativeInteger(lastChapter.endOffset) ||
		lastChapter.endOffset <= lastChapter.startOffset ||
		lastChapter.endOffset !== cacheSourceTextLength ||
		!isNonEmptyTrimmedString(lastChapter.title)
	) {
		return createFailure(
			'inconsistent-inspection',
			'Reward Reader received an inconsistent source inspection result.',
			warnings,
		);
	}

	const cache = cacheCandidate as unknown as RewardReaderChapterIndexCache;

	return {
		novelId: normalizedCacheNovelId,
		sourcePath: normalizedSourcePath,
		sourceKind: expectedSourceKind,
		sourceMtime,
		sourceSize,
		cache,
		warnings,
	};
}

export function prepareRewardReaderImport(
	input: PrepareRewardReaderImportInput,
): PrepareRewardReaderImportResult {
	const validatedInspection = validateInspection(input.inspection);
	if (isPreparationFailure(validatedInspection)) {
		return validatedInspection;
	}

	const titleValidation = validateTitle(input.title, validatedInspection.warnings);
	if (isPreparationFailure(titleValidation)) {
		return titleValidation;
	}

	const preparedAtValidation = validatePreparedAt(
		input.preparedAt,
		validatedInspection.warnings,
	);
	if (isPreparationFailure(preparedAtValidation)) {
		return preparedAtValidation;
	}

	const makePrimaryValidation = validateMakePrimary(
		input.makePrimary,
		validatedInspection.warnings,
	);
	if (isPreparationFailure(makePrimaryValidation)) {
		return makePrimaryValidation;
	}

	const validatedExistingStore = validateExistingStore(
		input.existingStore,
		validatedInspection.warnings,
	);
	if (isPreparationFailure(validatedExistingStore)) {
		return validatedExistingStore;
	}

	if (validatedExistingStore.existingNovelIds.has(validatedInspection.novelId)) {
		return createFailure(
			'duplicate-novel-id',
			'A Reward Reader novel with this id already exists.',
			validatedInspection.warnings,
		);
	}

	if (
		Object.prototype.hasOwnProperty.call(
			validatedExistingStore.progressByNovelId,
			validatedInspection.novelId,
		)
	) {
		return createFailure(
			'conflicting-existing-progress',
			'Reward Reader progress already exists for this novel id.',
			validatedInspection.warnings,
		);
	}

	if (validatedExistingStore.existingSourcePaths.has(validatedInspection.sourcePath)) {
		return createFailure(
			'duplicate-source-path',
			'This Vault source file is already registered in Reward Reader.',
			validatedInspection.warnings,
		);
	}

	const novel: RewardReaderNovel = {
		id: validatedInspection.novelId,
		title: titleValidation.normalizedTitle,
		sourcePath: validatedInspection.sourcePath,
		sourceKind: validatedInspection.sourceKind,
		sourceMtime: validatedInspection.sourceMtime,
		sourceSize: validatedInspection.sourceSize,
		createdAt: preparedAtValidation.normalizedPreparedAt,
		updatedAt: preparedAtValidation.normalizedPreparedAt,
	};

	const progress: RewardReaderNovelProgress = {
		novelId: validatedInspection.novelId,
		unlockedThroughChapterIndex: null,
		readThroughChapterIndex: null,
		currentChapterIndex: null,
		currentChapterScrollOffset: 0,
		studyMinuteBalance: 0,
		totalStudyMinutes: 0,
		todayUnlockDate: null,
		todayUnlockedChapters: 0,
		updatedAt: preparedAtValidation.normalizedPreparedAt,
	};

	const primaryNovelIdAfterImport =
		validatedExistingStore.novelCount === 0 || makePrimaryValidation.makePrimary
			? validatedInspection.novelId
			: validatedExistingStore.primaryNovelId;

	return {
		ok: true,
		payload: {
			novel,
			progress,
			cache: validatedInspection.cache,
			primaryNovelIdAfterImport,
		},
		warnings: [...validatedInspection.warnings],
	};
}
