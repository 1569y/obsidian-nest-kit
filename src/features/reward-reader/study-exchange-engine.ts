import { isSafeRewardReaderId, normalizeRewardReaderStore } from './store';
import {
	REWARD_READER_STORE_SCHEMA_VERSION,
	type RewardReaderNovelProgress,
	type RewardReaderStore,
	type RewardReaderStudyRecord,
	type RewardReaderUnlockRecord,
} from './types';

export const DEFAULT_REWARD_READER_MINUTES_PER_CHAPTER = 30;

export interface RewardReaderStudyExchangePolicy {
	minutesPerChapter: number;
	maxChaptersPerStudyRecord: number | null;
	maxChaptersPerUtcDate: number | null;
}

export interface CalculateRewardReaderStudyExchangeInput {
	progress: RewardReaderNovelProgress;
	chapterCount: number;
	studyMinutes: number;
	occurredAt: string;
	policy: RewardReaderStudyExchangePolicy;
}

export interface RewardReaderStudyExchangeCalculation {
	operationUtcDate: string;

	balanceBefore: number;
	creditedStudyMinutes: number;
	availableMinutes: number;
	minutesSpent: number;
	balanceAfter: number;

	totalStudyMinutesBefore: number;
	totalStudyMinutesAfter: number;

	unlockedThroughChapterIndexBefore: number | null;
	unlockedThroughChapterIndexAfter: number | null;

	remainingLockedChapterCountBefore: number;
	affordableChapterCount: number;

	dailyUnlockedChapterCountBefore: number;
	dailyUnlockedChapterCountAfter: number;
	dailyRemainingAllowanceBefore: number | null;

	perStudyRemainingAllowance: number | null;

	unlockedChapterIndexes: number[];
	unlockedChapterCount: number;
}

export type RewardReaderStudyExchangeCalculationErrorCode =
	| 'invalid-progress'
	| 'invalid-chapter-count'
	| 'invalid-study-minutes'
	| 'invalid-occurred-at'
	| 'invalid-exchange-policy'
	| 'stale-study-operation'
	| 'chapter-count-conflict'
	| 'arithmetic-overflow';

export interface CalculateRewardReaderStudyExchangeSuccess {
	ok: true;
	status: 'calculated';
	calculation: RewardReaderStudyExchangeCalculation;
}

export interface CalculateRewardReaderStudyExchangeFailure {
	ok: false;
	code: RewardReaderStudyExchangeCalculationErrorCode;
	message: string;
}

export type CalculateRewardReaderStudyExchangeResult =
	| CalculateRewardReaderStudyExchangeSuccess
	| CalculateRewardReaderStudyExchangeFailure;

export interface ApplyRewardReaderStudyExchangeInput {
	store: RewardReaderStore;
	novelId: string;
	chapterCount: number;
	studyRecordId: string;
	unlockRecordId: string;
	content: string;
	studyMinutes: number;
	occurredAt: string;
	policy: RewardReaderStudyExchangePolicy;
}

export type ApplyRewardReaderStudyExchangeErrorCode =
	| RewardReaderStudyExchangeCalculationErrorCode
	| 'invalid-store'
	| 'unsupported-store-schema'
	| 'invalid-novel-id'
	| 'novel-not-found'
	| 'progress-not-found'
	| 'invalid-record-id'
	| 'record-id-conflict'
	| 'duplicate-record-id'
	| 'invalid-study-content';

export interface ApplyRewardReaderStudyExchangeSuccess {
	ok: true;
	status: 'applied';
	nextStore: RewardReaderStore;
	progressBefore: RewardReaderNovelProgress;
	progressAfter: RewardReaderNovelProgress;
	studyRecord: RewardReaderStudyRecord;
	unlockRecord: RewardReaderUnlockRecord | null;
	calculation: RewardReaderStudyExchangeCalculation;
}

export interface ApplyRewardReaderStudyExchangeFailure {
	ok: false;
	code: ApplyRewardReaderStudyExchangeErrorCode;
	message: string;
}

export type ApplyRewardReaderStudyExchangeResult =
	| ApplyRewardReaderStudyExchangeSuccess
	| ApplyRewardReaderStudyExchangeFailure;

type RewardReaderRecord = Record<string, unknown>;

const CALCULATION_ERROR_MESSAGES: Record<
	RewardReaderStudyExchangeCalculationErrorCode,
	string
> = {
	'invalid-progress':
		'Reward Reader study exchange requires a canonical novel progress state.',
	'invalid-chapter-count':
		'Reward Reader study exchange requires a positive safe integer chapter count.',
	'invalid-study-minutes':
		'Reward Reader study exchange requires a positive safe integer study-minute value.',
	'invalid-occurred-at':
		'Reward Reader study exchange requires a canonical UTC timestamp.',
	'invalid-exchange-policy':
		'Reward Reader study exchange requires a valid explicit exchange policy.',
	'stale-study-operation':
		'Reward Reader cannot apply a study operation older than the current progress state.',
	'chapter-count-conflict':
		'Reward Reader progress exceeds the provided chapter count.',
	'arithmetic-overflow':
		'Reward Reader study exchange exceeded safe integer limits.',
};

const APPLY_ERROR_MESSAGES: Record<
	Exclude<
		ApplyRewardReaderStudyExchangeErrorCode,
		RewardReaderStudyExchangeCalculationErrorCode
	>,
	string
> = {
	'invalid-store':
		'Reward Reader cannot apply a study exchange to a non-canonical store.',
	'unsupported-store-schema':
		'Reward Reader cannot apply a study exchange to an unsupported store schema.',
	'invalid-novel-id':
		'Reward Reader study exchange requires a valid novel id.',
	'novel-not-found':
		'Reward Reader could not find the target novel in the current store.',
	'progress-not-found':
		'Reward Reader could not find progress for the target novel.',
	'invalid-record-id':
		'Reward Reader study exchange requires valid explicit record ids.',
	'record-id-conflict':
		'Reward Reader study exchange requires distinct study and unlock record ids.',
	'duplicate-record-id':
		'Reward Reader record ids must be unique across Reward Reader history.',
	'invalid-study-content':
		'Reward Reader study exchange requires valid study content text.',
};

function isPlainObject(value: unknown): value is RewardReaderRecord {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSafeNonNegativeInteger(value: unknown): value is number {
	return (
		typeof value === 'number' &&
		Number.isSafeInteger(value) &&
		value >= 0
	);
}

function isSafePositiveInteger(value: unknown): value is number {
	return isSafeNonNegativeInteger(value) && value > 0;
}

function isCanonicalUtcIsoTimestamp(value: unknown): value is string {
	if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) {
		return false;
	}

	const parsed = Date.parse(value);
	return !Number.isNaN(parsed) && new Date(parsed).toISOString() === value;
}

function isStrictUtcDateString(value: unknown): value is string {
	if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
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

function safeAdd(left: number, right: number): number | null {
	const result = left + right;
	return Number.isSafeInteger(result) ? result : null;
}

function safeMultiply(left: number, right: number): number | null {
	const result = left * right;
	return Number.isSafeInteger(result) ? result : null;
}

function isCanonicalValue(left: unknown, right: unknown): boolean {
	if (Object.is(left, right)) {
		return true;
	}

	if (Array.isArray(left) || Array.isArray(right)) {
		if (!Array.isArray(left) || !Array.isArray(right)) {
			return false;
		}

		return (
			left.length === right.length &&
			left.every((entry, index) => isCanonicalValue(entry, right[index]))
		);
	}

	if (!isPlainObject(left) || !isPlainObject(right)) {
		return false;
	}

	const leftKeys = Object.keys(left);
	const rightKeys = Object.keys(right);
	if (leftKeys.length !== rightKeys.length) {
		return false;
	}

	for (const key of leftKeys) {
		if (
			!Object.prototype.hasOwnProperty.call(right, key) ||
			!isCanonicalValue(left[key], right[key])
		) {
			return false;
		}
	}

	return true;
}

function createCalculationFailure(
	code: RewardReaderStudyExchangeCalculationErrorCode,
): CalculateRewardReaderStudyExchangeFailure {
	return {
		ok: false,
		code,
		message: CALCULATION_ERROR_MESSAGES[code],
	};
}

function createApplyFailure(
	code: ApplyRewardReaderStudyExchangeErrorCode,
): ApplyRewardReaderStudyExchangeFailure {
	return {
		ok: false,
		code,
		message:
			code in CALCULATION_ERROR_MESSAGES
				? CALCULATION_ERROR_MESSAGES[
						code as RewardReaderStudyExchangeCalculationErrorCode
					]
				: APPLY_ERROR_MESSAGES[
						code as Exclude<
							ApplyRewardReaderStudyExchangeErrorCode,
							RewardReaderStudyExchangeCalculationErrorCode
						>
					],
	};
}

function isApplyFailure(
	value: unknown,
): value is ApplyRewardReaderStudyExchangeFailure {
	return isPlainObject(value) && value.ok === false;
}

function validatePolicy(
	policy: unknown,
): RewardReaderStudyExchangePolicy | null {
	if (!isPlainObject(policy)) {
		return null;
	}

	const minutesPerChapter = policy.minutesPerChapter;
	const maxChaptersPerStudyRecord = policy.maxChaptersPerStudyRecord;
	const maxChaptersPerUtcDate = policy.maxChaptersPerUtcDate;

	if (
		!isSafePositiveInteger(minutesPerChapter) ||
		!(
			maxChaptersPerStudyRecord === null ||
			isSafeNonNegativeInteger(maxChaptersPerStudyRecord)
		) ||
		!(
			maxChaptersPerUtcDate === null ||
			isSafeNonNegativeInteger(maxChaptersPerUtcDate)
		)
	) {
		return null;
	}

	return {
		minutesPerChapter,
		maxChaptersPerStudyRecord,
		maxChaptersPerUtcDate,
	};
}

function validateProgress(
	progress: unknown,
): RewardReaderNovelProgress | null {
	if (!isPlainObject(progress)) {
		return null;
	}

	const novelId =
		typeof progress.novelId === 'string' && isSafeRewardReaderId(progress.novelId)
			? progress.novelId
			: null;
	const unlockedThroughChapterIndex =
		progress.unlockedThroughChapterIndex === null
			? null
			: isSafeNonNegativeInteger(progress.unlockedThroughChapterIndex)
				? progress.unlockedThroughChapterIndex
				: undefined;
	const readThroughChapterIndex =
		progress.readThroughChapterIndex === null
			? null
			: isSafeNonNegativeInteger(progress.readThroughChapterIndex)
				? progress.readThroughChapterIndex
				: undefined;
	const currentChapterIndex =
		progress.currentChapterIndex === null
			? null
			: isSafeNonNegativeInteger(progress.currentChapterIndex)
				? progress.currentChapterIndex
				: undefined;
	const currentChapterScrollOffset = isSafeNonNegativeInteger(
		progress.currentChapterScrollOffset,
	)
		? progress.currentChapterScrollOffset
		: undefined;
	const studyMinuteBalance = isSafeNonNegativeInteger(progress.studyMinuteBalance)
		? progress.studyMinuteBalance
		: undefined;
	const totalStudyMinutes = isSafeNonNegativeInteger(progress.totalStudyMinutes)
		? progress.totalStudyMinutes
		: undefined;
	const todayUnlockDate =
		progress.todayUnlockDate === null
			? null
			: isStrictUtcDateString(progress.todayUnlockDate)
				? progress.todayUnlockDate
				: undefined;
	const todayUnlockedChapters = isSafeNonNegativeInteger(
		progress.todayUnlockedChapters,
	)
		? progress.todayUnlockedChapters
		: undefined;
	const updatedAt = isCanonicalUtcIsoTimestamp(progress.updatedAt)
		? progress.updatedAt
		: null;

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
		return null;
	}

	const unlockedChapterCount =
		unlockedThroughChapterIndex === null ? 0 : unlockedThroughChapterIndex + 1;
	if (
		studyMinuteBalance > totalStudyMinutes ||
		(unlockedThroughChapterIndex === null &&
			(readThroughChapterIndex !== null || currentChapterIndex !== null)) ||
		(readThroughChapterIndex !== null &&
			(unlockedThroughChapterIndex === null ||
				readThroughChapterIndex > unlockedThroughChapterIndex)) ||
		(currentChapterIndex !== null &&
			(unlockedThroughChapterIndex === null ||
				currentChapterIndex > unlockedThroughChapterIndex)) ||
		(todayUnlockDate === null && todayUnlockedChapters !== 0) ||
		todayUnlockedChapters > unlockedChapterCount
	) {
		return null;
	}

	return {
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
	};
}

function validateCanonicalStore(
	store: unknown,
): RewardReaderStore | ApplyRewardReaderStudyExchangeFailure {
	const normalization = normalizeRewardReaderStore(store);
	const rawSchemaVersion =
		isPlainObject(store) && typeof store.schemaVersion === 'number'
			? store.schemaVersion
			: undefined;

	if (
		normalization.hasUnsupportedFutureVersion ||
		(typeof rawSchemaVersion === 'number' &&
			Number.isInteger(rawSchemaVersion) &&
			rawSchemaVersion > REWARD_READER_STORE_SCHEMA_VERSION)
	) {
		return createApplyFailure('unsupported-store-schema');
	}

	if (
		!isPlainObject(store) ||
		rawSchemaVersion !== REWARD_READER_STORE_SCHEMA_VERSION ||
		normalization.didNormalize ||
		normalization.shouldPersist ||
		!isCanonicalValue(store, normalization.store)
	) {
		return createApplyFailure('invalid-store');
	}

	return store as unknown as RewardReaderStore;
}

function buildUnlockedChapterIndexes(
	startIndex: number,
	unlockCount: number,
): number[] | null {
	const unlockedChapterIndexes: number[] = [];

	for (let index = 0; index < unlockCount; index += 1) {
		const chapterIndex = safeAdd(startIndex, index);
		if (chapterIndex === null) {
			return null;
		}

		unlockedChapterIndexes.push(chapterIndex);
	}

	return unlockedChapterIndexes;
}

function calculateRewardReaderStudyExchangeInternal(
	input: CalculateRewardReaderStudyExchangeInput,
): CalculateRewardReaderStudyExchangeResult {
	const progress = validateProgress(input?.progress);
	if (!progress) {
		return createCalculationFailure('invalid-progress');
	}

	if (!isSafePositiveInteger(input?.chapterCount)) {
		return createCalculationFailure('invalid-chapter-count');
	}

	if (!isSafePositiveInteger(input?.studyMinutes)) {
		return createCalculationFailure('invalid-study-minutes');
	}

	if (!isCanonicalUtcIsoTimestamp(input?.occurredAt)) {
		return createCalculationFailure('invalid-occurred-at');
	}

	const policy = validatePolicy(input?.policy);
	if (!policy) {
		return createCalculationFailure('invalid-exchange-policy');
	}

	if (
		(progress.unlockedThroughChapterIndex !== null &&
			progress.unlockedThroughChapterIndex >= input.chapterCount) ||
		(progress.readThroughChapterIndex !== null &&
			progress.readThroughChapterIndex >= input.chapterCount) ||
		(progress.currentChapterIndex !== null &&
			progress.currentChapterIndex >= input.chapterCount)
	) {
		return createCalculationFailure('chapter-count-conflict');
	}

	const operationTimestamp = Date.parse(input.occurredAt);
	const progressTimestamp = Date.parse(progress.updatedAt);
	const operationUtcDate = input.occurredAt.slice(0, 10);
	if (
		operationTimestamp < progressTimestamp ||
		(progress.todayUnlockDate !== null &&
			operationUtcDate < progress.todayUnlockDate)
	) {
		return createCalculationFailure('stale-study-operation');
	}

	const unlockedBeforeCount =
		progress.unlockedThroughChapterIndex === null
			? 0
			: progress.unlockedThroughChapterIndex + 1;
	const remainingLockedChapterCountBefore =
		input.chapterCount - unlockedBeforeCount;
	const availableMinutes = safeAdd(
		progress.studyMinuteBalance,
		input.studyMinutes,
	);
	const totalStudyMinutesAfter = safeAdd(
		progress.totalStudyMinutes,
		input.studyMinutes,
	);
	if (availableMinutes === null || totalStudyMinutesAfter === null) {
		return createCalculationFailure('arithmetic-overflow');
	}

	const affordableChapterCount = Math.floor(
		availableMinutes / policy.minutesPerChapter,
	);
	const dailyUnlockedChapterCountBefore =
		progress.todayUnlockDate === operationUtcDate
			? progress.todayUnlockedChapters
			: 0;
	const dailyRemainingAllowanceBefore =
		policy.maxChaptersPerUtcDate === null
			? null
			: Math.max(
					0,
					policy.maxChaptersPerUtcDate - dailyUnlockedChapterCountBefore,
				);
	const perStudyRemainingAllowance = policy.maxChaptersPerStudyRecord;

	const capCandidates = [
		affordableChapterCount,
		remainingLockedChapterCountBefore,
	];
	if (perStudyRemainingAllowance !== null) {
		capCandidates.push(perStudyRemainingAllowance);
	}
	if (dailyRemainingAllowanceBefore !== null) {
		capCandidates.push(dailyRemainingAllowanceBefore);
	}

	const unlockedChapterCount = Math.min(...capCandidates);
	const minutesSpent = safeMultiply(
		unlockedChapterCount,
		policy.minutesPerChapter,
	);
	if (minutesSpent === null) {
		return createCalculationFailure('arithmetic-overflow');
	}

	const balanceAfter = availableMinutes - minutesSpent;
	const dailyUnlockedChapterCountAfter = safeAdd(
		dailyUnlockedChapterCountBefore,
		unlockedChapterCount,
	);
	if (
		!Number.isSafeInteger(balanceAfter) ||
		balanceAfter < 0 ||
		dailyUnlockedChapterCountAfter === null
	) {
		return createCalculationFailure('arithmetic-overflow');
	}

	const nextChapterIndex =
		progress.unlockedThroughChapterIndex === null
			? 0
			: progress.unlockedThroughChapterIndex + 1;
	const unlockedChapterIndexes = buildUnlockedChapterIndexes(
		nextChapterIndex,
		unlockedChapterCount,
	);
	if (!unlockedChapterIndexes) {
		return createCalculationFailure('arithmetic-overflow');
	}

	const unlockedThroughChapterIndexAfter =
		unlockedChapterCount === 0
			? progress.unlockedThroughChapterIndex
			: unlockedChapterIndexes[unlockedChapterIndexes.length - 1] ?? null;

	return {
		ok: true,
		status: 'calculated',
		calculation: {
			operationUtcDate,
			balanceBefore: progress.studyMinuteBalance,
			creditedStudyMinutes: input.studyMinutes,
			availableMinutes,
			minutesSpent,
			balanceAfter,
			totalStudyMinutesBefore: progress.totalStudyMinutes,
			totalStudyMinutesAfter,
			unlockedThroughChapterIndexBefore:
				progress.unlockedThroughChapterIndex,
			unlockedThroughChapterIndexAfter,
			remainingLockedChapterCountBefore,
			affordableChapterCount,
			dailyUnlockedChapterCountBefore,
			dailyUnlockedChapterCountAfter,
			dailyRemainingAllowanceBefore,
			perStudyRemainingAllowance,
			unlockedChapterIndexes,
			unlockedChapterCount,
		},
	};
}

export function calculateRewardReaderStudyExchange(
	input: CalculateRewardReaderStudyExchangeInput,
): CalculateRewardReaderStudyExchangeResult {
	try {
		return calculateRewardReaderStudyExchangeInternal(input);
	} catch {
		return createCalculationFailure('invalid-progress');
	}
}

function applyRewardReaderStudyExchangeInternal(
	input: ApplyRewardReaderStudyExchangeInput,
): ApplyRewardReaderStudyExchangeResult {
	const store = validateCanonicalStore(input?.store);
	if (isApplyFailure(store)) {
		return store;
	}

	if (
		typeof input?.novelId !== 'string' ||
		!isSafeRewardReaderId(input.novelId)
	) {
		return createApplyFailure('invalid-novel-id');
	}

	let matchedNovelCount = 0;
	for (const novel of store.novels) {
		if (novel.id === input.novelId) {
			matchedNovelCount += 1;
		}
	}

	if (matchedNovelCount === 0) {
		return createApplyFailure('novel-not-found');
	}

	if (matchedNovelCount > 1) {
		return createApplyFailure('invalid-store');
	}

	if (
		!Object.prototype.hasOwnProperty.call(store.progressByNovelId, input.novelId)
	) {
		return createApplyFailure('progress-not-found');
	}

	const progressBefore = store.progressByNovelId[input.novelId];
	if (!progressBefore || progressBefore.novelId !== input.novelId) {
		return createApplyFailure('invalid-store');
	}

	if (
		typeof input.studyRecordId !== 'string' ||
		typeof input.unlockRecordId !== 'string' ||
		!isSafeRewardReaderId(input.studyRecordId) ||
		!isSafeRewardReaderId(input.unlockRecordId)
	) {
		return createApplyFailure('invalid-record-id');
	}

	if (input.studyRecordId === input.unlockRecordId) {
		return createApplyFailure('record-id-conflict');
	}

	const existingRecordIds = new Set<string>();
	for (const record of store.studyRecords) {
		existingRecordIds.add(record.id);
	}
	for (const record of store.unlockRecords) {
		existingRecordIds.add(record.id);
	}
	for (const record of store.readingRecords) {
		existingRecordIds.add(record.id);
	}
	if (
		existingRecordIds.has(input.studyRecordId) ||
		existingRecordIds.has(input.unlockRecordId)
	) {
		return createApplyFailure('duplicate-record-id');
	}

	if (
		typeof input.content !== 'string' ||
		input.content.includes('\0')
	) {
		return createApplyFailure('invalid-study-content');
	}

	const normalizedContent = input.content.replace(/\r\n?/g, '\n').trim();
	const calculationResult = calculateRewardReaderStudyExchange({
		progress: progressBefore,
		chapterCount: input.chapterCount,
		studyMinutes: input.studyMinutes,
		occurredAt: input.occurredAt,
		policy: input.policy,
	});
	if (!calculationResult.ok) {
		return createApplyFailure(calculationResult.code);
	}

	const calculation = calculationResult.calculation;
	const progressAfter: RewardReaderNovelProgress = {
		novelId: progressBefore.novelId,
		unlockedThroughChapterIndex:
			calculation.unlockedThroughChapterIndexAfter,
		readThroughChapterIndex: progressBefore.readThroughChapterIndex,
		currentChapterIndex: progressBefore.currentChapterIndex,
		currentChapterScrollOffset: progressBefore.currentChapterScrollOffset,
		studyMinuteBalance: calculation.balanceAfter,
		totalStudyMinutes: calculation.totalStudyMinutesAfter,
		todayUnlockDate: calculation.operationUtcDate,
		todayUnlockedChapters: calculation.dailyUnlockedChapterCountAfter,
		updatedAt: input.occurredAt,
	};

	const studyRecord: RewardReaderStudyRecord = {
		id: input.studyRecordId,
		novelId: input.novelId,
		content: normalizedContent,
		minutes: input.studyMinutes,
		createdAt: input.occurredAt,
		balanceBefore: calculation.balanceBefore,
		balanceAfter: calculation.balanceAfter,
		unlockedChapterCount: calculation.unlockedChapterCount,
	};

	const unlockRecord: RewardReaderUnlockRecord | null =
		calculation.unlockedChapterCount > 0
			? {
					id: input.unlockRecordId,
					novelId: input.novelId,
					studyRecordId: input.studyRecordId,
					unlockedChapterIndexes: [...calculation.unlockedChapterIndexes],
					createdAt: input.occurredAt,
				}
			: null;

	const nextStore: RewardReaderStore = {
		schemaVersion: store.schemaVersion,
		primaryNovelId: store.primaryNovelId,
		novels: store.novels,
		progressByNovelId: {
			...store.progressByNovelId,
			[input.novelId]: progressAfter,
		},
		studyRecords: [...store.studyRecords, studyRecord],
		unlockRecords:
			unlockRecord === null
				? store.unlockRecords
				: [...store.unlockRecords, unlockRecord],
		readingRecords: store.readingRecords,
	};

	return {
		ok: true,
		status: 'applied',
		nextStore,
		progressBefore,
		progressAfter,
		studyRecord,
		unlockRecord,
		calculation,
	};
}

export function applyRewardReaderStudyExchange(
	input: ApplyRewardReaderStudyExchangeInput,
): ApplyRewardReaderStudyExchangeResult {
	try {
		return applyRewardReaderStudyExchangeInternal(input);
	} catch {
		return createApplyFailure('invalid-store');
	}
}
