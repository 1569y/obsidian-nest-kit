export interface RewardReaderImportProgressPlanInput {
	chapterCount: number;
	readThroughChapterIndex: number | null;
}

export interface RewardReaderImportProgressPlan {
	progress: {
		readThroughChapterIndex: number;
		unlockedThroughChapterIndex: number;
		currentChapterIndex: number;
		currentChapterScrollOffset: 0;
	};
	historicalReadChapterCount: number;
	nextUnreadIndex: number | null;
	studyEffects: {
		studyMinuteBalanceDelta: 0;
		totalStudyMinutesDelta: 0;
		todayUnlockedChaptersDelta: 0;
		createsStudyRecord: false;
	};
}

export type RewardReaderImportProgressPlanResult =
	| {
			ok: true;
			plan: RewardReaderImportProgressPlan;
	  }
	| {
			ok: false;
			errorCode: 'invalid-chapter-count' | 'invalid-read-through-index';
	  };

type RewardReaderRecord = Record<string, unknown>;

const REWARD_READER_NO_HISTORY_INDEX = -1;

function isPlainObject(value: unknown): value is RewardReaderRecord {
	try {
		return (
			typeof value === 'object' &&
			value !== null &&
			!Array.isArray(value)
		);
	} catch {
		return false;
	}
}

function isSafePositiveInteger(value: unknown): value is number {
	return (
		typeof value === 'number' &&
		Number.isSafeInteger(value) &&
		value > 0
	);
}

function isSafeNonNegativeInteger(value: unknown): value is number {
	return (
		typeof value === 'number' &&
		Number.isSafeInteger(value) &&
		value >= 0
	);
}

function createFailure(
	errorCode: 'invalid-chapter-count' | 'invalid-read-through-index',
): RewardReaderImportProgressPlanResult {
	return {
		ok: false,
		errorCode,
	};
}

function normalizeReadThroughChapterIndex(
	readThroughChapterIndex: number | null,
): number {
	return readThroughChapterIndex === null
		? REWARD_READER_NO_HISTORY_INDEX
		: readThroughChapterIndex;
}

function createRewardReaderImportProgressPlanInternal(
	input: RewardReaderImportProgressPlanInput,
): RewardReaderImportProgressPlanResult {
	if (!isSafePositiveInteger(input.chapterCount)) {
		return createFailure('invalid-chapter-count');
	}

	if (
		input.readThroughChapterIndex !== null &&
		(!isSafeNonNegativeInteger(input.readThroughChapterIndex) ||
			input.readThroughChapterIndex >= input.chapterCount)
	) {
		return createFailure('invalid-read-through-index');
	}

	const readThroughChapterIndex = normalizeReadThroughChapterIndex(
		input.readThroughChapterIndex,
	);
	const historicalReadChapterCount = readThroughChapterIndex + 1;
	const nextUnreadIndex =
		historicalReadChapterCount >= input.chapterCount
			? null
			: historicalReadChapterCount;
	const currentChapterIndex =
		nextUnreadIndex === null ? input.chapterCount - 1 : nextUnreadIndex;

	return {
		ok: true,
		plan: {
			progress: {
				readThroughChapterIndex,
				unlockedThroughChapterIndex: readThroughChapterIndex,
				currentChapterIndex,
				currentChapterScrollOffset: 0,
			},
			historicalReadChapterCount,
			nextUnreadIndex,
			studyEffects: {
				studyMinuteBalanceDelta: 0,
				totalStudyMinutesDelta: 0,
				todayUnlockedChaptersDelta: 0,
				createsStudyRecord: false,
			},
		},
	};
}

export function createRewardReaderImportProgressPlan(
	input: unknown,
): RewardReaderImportProgressPlanResult {
	if (!isPlainObject(input)) {
		return createFailure('invalid-chapter-count');
	}

	let chapterCount: unknown;
	try {
		chapterCount = input.chapterCount;
	} catch {
		return createFailure('invalid-chapter-count');
	}

	let readThroughChapterIndex: unknown;
	try {
		readThroughChapterIndex = input.readThroughChapterIndex;
	} catch {
		return createFailure('invalid-read-through-index');
	}

	if (readThroughChapterIndex === undefined) {
		return createFailure('invalid-read-through-index');
	}

	if (
		readThroughChapterIndex !== null &&
		!isSafeNonNegativeInteger(readThroughChapterIndex)
	) {
		return createFailure('invalid-read-through-index');
	}

	try {
		return createRewardReaderImportProgressPlanInternal({
			chapterCount:
				typeof chapterCount === 'number' ? chapterCount : Number.NaN,
			readThroughChapterIndex,
		});
	} catch {
		return createFailure('invalid-chapter-count');
	}
}
