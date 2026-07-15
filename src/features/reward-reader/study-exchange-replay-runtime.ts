import type { DataAdapter } from 'obsidian';
import {
	readRewardReaderChapterIndexCache,
	readRewardReaderStateStore,
} from './read-only-storage-adapter';
import {
	inspectRewardReaderStudyExchangeReplay,
	type InspectRewardReaderStudyExchangeReplayInput,
	type InspectRewardReaderStudyExchangeReplayResult,
	type RewardReaderStudyExchangeReplayInspectionErrorCode,
} from './study-exchange-replay-inspector';
import type {
	RewardReaderStudyExchangeCalculation,
	RewardReaderStudyExchangePolicy,
} from './study-exchange-engine';
import type { RewardReaderStudyExchangeRuntimeRequest } from './study-exchange-runtime';
import { isSafeRewardReaderId } from './store';
import type {
	RewardReaderNovelProgress,
	RewardReaderStudyRecord,
	RewardReaderUnlockRecord,
} from './types';

export type RewardReaderStudyReplayReadStatus =
	| 'not-attempted'
	| 'read-confirmed'
	| 'read-blocked';

export type RewardReaderStudyReplayRuntimeStage =
	| 'request-validation'
	| 'initial-state-read'
	| 'chapter-cache-read'
	| 'latest-state-read'
	| 'target-revalidation'
	| 'replay-inspection';

export type RewardReaderStudyReplayRuntimeErrorCode =
	| 'invalid-study-replay-runtime-request'
	| 'state-read-blocked'
	| 'state-read-runtime-failed'
	| 'target-novel-not-found'
	| 'target-novel-conflict'
	| 'chapter-cache-read-blocked'
	| 'chapter-cache-runtime-failed'
	| 'chapter-cache-identity-conflict'
	| 'replay-target-changed'
	| 'replay-inspection-runtime-failed'
	| RewardReaderStudyExchangeReplayInspectionErrorCode;

export interface RunRewardReaderStudyReplayConfirmed {
	ok: true;
	status: 'replay-confirmed';
	calculation: RewardReaderStudyExchangeCalculation;
	progress: RewardReaderNovelProgress;
	studyRecord: RewardReaderStudyRecord;
	unlockRecord: RewardReaderUnlockRecord | null;
	warnings: string[];
	initialStateRead: 'read-confirmed';
	chapterCacheRead: 'read-confirmed';
	latestStateRead: 'read-confirmed';
}

export interface RunRewardReaderStudyReplayNotObserved {
	ok: true;
	status: 'not-observed';
	warnings: string[];
	initialStateRead: 'read-confirmed';
	chapterCacheRead: 'read-confirmed';
	latestStateRead: 'read-confirmed';
}

export interface RunRewardReaderStudyReplayFailure {
	ok: false;
	code: RewardReaderStudyReplayRuntimeErrorCode;
	stage: RewardReaderStudyReplayRuntimeStage;
	causeCode: string | null;
	message: string;
	warnings: string[];
	initialStateRead: RewardReaderStudyReplayReadStatus;
	chapterCacheRead: RewardReaderStudyReplayReadStatus;
	latestStateRead: RewardReaderStudyReplayReadStatus;
}

export type RunRewardReaderStudyReplayResult =
	| RunRewardReaderStudyReplayConfirmed
	| RunRewardReaderStudyReplayNotObserved
	| RunRewardReaderStudyReplayFailure;

type RewardReaderRecord = Record<string, unknown>;
type RewardReaderStore = InspectRewardReaderStudyExchangeReplayInput['store'];

interface RewardReaderStudyReplayRuntimeRequestSnapshot {
	novelId: string;
	studyRecordId: string;
	unlockRecordId: string;
	content: string;
	studyMinutes: number;
	occurredAt: string;
	policy: RewardReaderStudyExchangePolicy;
}

interface RewardReaderNovelCacheIdentity {
	novelId: string;
	sourcePath: string;
	sourceMtime: number;
	sourceSize: number;
}

interface RewardReaderTargetNovelMatch {
	status: 'found' | 'not-found' | 'conflict';
	identity: RewardReaderNovelCacheIdentity | null;
}

interface RewardReaderStudyReplayRuntimeContext {
	currentStage: RewardReaderStudyReplayRuntimeStage;
	warnings: string[];
	initialStateRead: RewardReaderStudyReplayReadStatus;
	chapterCacheRead: RewardReaderStudyReplayReadStatus;
	latestStateRead: RewardReaderStudyReplayReadStatus;
}

type RewardReaderReplayInspectionResultSnapshot =
	| {
			kind: 'replay-confirmed';
			calculation: RewardReaderStudyExchangeCalculation;
			progress: RewardReaderNovelProgress;
			studyRecord: RewardReaderStudyRecord;
			unlockRecord: RewardReaderUnlockRecord | null;
	  }
	| {
			kind: 'not-observed';
	  }
	| {
			kind: 'failure';
			code: RewardReaderStudyExchangeReplayInspectionErrorCode;
			message: string;
	  }
	| {
			kind: 'malformed';
	  };

const INVALID_REQUEST_MESSAGE =
	'Reward Reader received an invalid study replay recovery request.';
const STATE_READ_BLOCKED_MESSAGE =
	'Reward Reader could not safely read the current replay state.';
const STATE_READ_RUNTIME_FAILED_MESSAGE =
	'Reward Reader could not complete the replay state read.';
const TARGET_NOVEL_NOT_FOUND_MESSAGE =
	'Reward Reader could not find the target novel for replay inspection.';
const TARGET_NOVEL_CONFLICT_MESSAGE =
	'Reward Reader found conflicting target novel identity for replay inspection.';
const CHAPTER_CACHE_READ_BLOCKED_MESSAGE =
	'Reward Reader could not safely read the replay chapter index.';
const CHAPTER_CACHE_RUNTIME_FAILED_MESSAGE =
	'Reward Reader could not complete the replay chapter-index read.';
const CHAPTER_CACHE_IDENTITY_CONFLICT_MESSAGE =
	'Reward Reader found inconsistent chapter-index identity for replay inspection.';
const REPLAY_TARGET_CHANGED_MESSAGE =
	'Reward Reader detected that the replay target changed during inspection.';
const REPLAY_INSPECTION_RUNTIME_FAILED_MESSAGE =
	'Reward Reader could not safely complete replay inspection.';
const REPLAY_INSPECTION_ERROR_CODES = new Set<
	RewardReaderStudyExchangeReplayInspectionErrorCode
>([
	'invalid-replay-inspection-input',
	'invalid-store',
	'unsupported-store-schema',
	'invalid-chapter-count',
	'replay-partial-observed',
	'replay-identity-conflict',
	'replay-history-conflict',
	'replay-outcome-conflict',
	'replay-inspection-runtime-failed',
]);

function isPlainObject(value: unknown): value is RewardReaderRecord {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return false;
	}

	try {
		const prototype: unknown = Reflect.getPrototypeOf(value);
		return prototype === Object.prototype || prototype === null;
	} catch {
		return false;
	}
}

function isReplayInspectionErrorCode(
	value: unknown,
): value is RewardReaderStudyExchangeReplayInspectionErrorCode {
	return (
		typeof value === 'string' &&
		REPLAY_INSPECTION_ERROR_CODES.has(
			value as RewardReaderStudyExchangeReplayInspectionErrorCode,
		)
	);
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

function validatePolicySnapshot(
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

function snapshotStudyReplayRuntimeRequest(
	request: unknown,
): RewardReaderStudyReplayRuntimeRequestSnapshot | null {
	try {
		if (!isPlainObject(request)) {
			return null;
		}

		const novelId = request.novelId;
		const studyRecordId = request.studyRecordId;
		const unlockRecordId = request.unlockRecordId;
		const content = request.content;
		const studyMinutes = request.studyMinutes;
		const occurredAt = request.occurredAt;
		const policySnapshot = validatePolicySnapshot(request.policy);

		if (
			typeof novelId !== 'string' ||
			novelId !== novelId.trim() ||
			!isSafeRewardReaderId(novelId) ||
			typeof studyRecordId !== 'string' ||
			studyRecordId !== studyRecordId.trim() ||
			!isSafeRewardReaderId(studyRecordId) ||
			typeof unlockRecordId !== 'string' ||
			unlockRecordId !== unlockRecordId.trim() ||
			!isSafeRewardReaderId(unlockRecordId) ||
			studyRecordId === unlockRecordId ||
			typeof content !== 'string' ||
			content.includes('\0') ||
			!isSafePositiveInteger(studyMinutes) ||
			!isCanonicalUtcIsoTimestamp(occurredAt) ||
			!policySnapshot
		) {
			return null;
		}

		return {
			novelId,
			studyRecordId,
			unlockRecordId,
			content,
			studyMinutes,
			occurredAt,
			policy: policySnapshot,
		};
	} catch {
		return null;
	}
}

function readWarningsSnapshot(warnings: unknown): string[] {
	if (!Array.isArray(warnings)) {
		return [];
	}

	const normalizedWarnings: string[] = [];
	const seenWarnings = new Set<string>();

	for (const warning of warnings) {
		const normalizedWarning =
			typeof warning === 'string' ? warning.trim() : '';
		if (normalizedWarning.length === 0 || seenWarnings.has(normalizedWarning)) {
			continue;
		}

		seenWarnings.add(normalizedWarning);
		normalizedWarnings.push(normalizedWarning);
	}

	return normalizedWarnings;
}

function mergeWarnings(...warningGroups: string[][]): string[] {
	const mergedWarnings: string[] = [];
	const seenWarnings = new Set<string>();

	for (const group of warningGroups) {
		for (const warning of group) {
			const normalizedWarning =
				typeof warning === 'string' ? warning.trim() : '';
			if (normalizedWarning.length === 0 || seenWarnings.has(normalizedWarning)) {
				continue;
			}

			seenWarnings.add(normalizedWarning);
			mergedWarnings.push(normalizedWarning);
		}
	}

	return mergedWarnings;
}

function createRuntimeContext(): RewardReaderStudyReplayRuntimeContext {
	return {
		currentStage: 'request-validation',
		warnings: [],
		initialStateRead: 'not-attempted',
		chapterCacheRead: 'not-attempted',
		latestStateRead: 'not-attempted',
	};
}

function withMergedWarnings(
	context: RewardReaderStudyReplayRuntimeContext,
	warnings: unknown,
): void {
	context.warnings = mergeWarnings(
		context.warnings,
		readWarningsSnapshot(warnings),
	);
}

function createFailure(
	code: RewardReaderStudyReplayRuntimeErrorCode,
	stage: RewardReaderStudyReplayRuntimeStage,
	causeCode: string | null,
	message: string,
	context: RewardReaderStudyReplayRuntimeContext,
): RunRewardReaderStudyReplayFailure {
	return {
		ok: false,
		code,
		stage,
		causeCode,
		message,
		warnings: context.warnings,
		initialStateRead: context.initialStateRead,
		chapterCacheRead: context.chapterCacheRead,
		latestStateRead: context.latestStateRead,
	};
}

function createUnexpectedRuntimeFailure(
	context: RewardReaderStudyReplayRuntimeContext,
): RunRewardReaderStudyReplayFailure {
	return createFailure(
		'replay-inspection-runtime-failed',
		context.currentStage,
		null,
		REPLAY_INSPECTION_RUNTIME_FAILED_MESSAGE,
		context,
	);
}

function getNovelCacheIdentity(
	novel: RewardReaderRecord,
): RewardReaderNovelCacheIdentity | null {
	const novelId = novel.id;
	const sourcePath = novel.sourcePath;
	const sourceMtime = novel.sourceMtime;
	const sourceSize = novel.sourceSize;

	if (
		typeof novelId !== 'string' ||
		typeof sourcePath !== 'string' ||
		!isSafeNonNegativeInteger(sourceMtime) ||
		!isSafeNonNegativeInteger(sourceSize)
	) {
		return null;
	}

	return {
		novelId,
		sourcePath,
		sourceMtime,
		sourceSize,
	};
}

function findTargetNovelMatch(
	store: RewardReaderStore,
	novelId: string,
): RewardReaderTargetNovelMatch {
	let matchedIdentity: RewardReaderNovelCacheIdentity | null = null;
	let matchedCount = 0;

	for (const novel of store.novels) {
		if (!novel || novel.id !== novelId) {
			continue;
		}

		matchedCount += 1;
		if (matchedCount > 1) {
			return {
				status: 'conflict',
				identity: null,
			};
		}

		matchedIdentity = getNovelCacheIdentity(novel as unknown as RewardReaderRecord);
		if (matchedIdentity === null) {
			return {
				status: 'conflict',
				identity: null,
			};
		}
	}

	if (matchedCount === 0 || matchedIdentity === null) {
		return {
			status: 'not-found',
			identity: null,
		};
	}

	return {
		status: 'found',
		identity: matchedIdentity,
	};
}

function cacheIdentityMatches(
	cache: RewardReaderRecord,
	identity: RewardReaderNovelCacheIdentity,
): boolean {
	return (
		cache.novelId === identity.novelId &&
		cache.sourcePath === identity.sourcePath &&
		cache.sourceMtime === identity.sourceMtime &&
		cache.sourceSize === identity.sourceSize
	);
}

function identitiesMatch(
	left: RewardReaderNovelCacheIdentity,
	right: RewardReaderNovelCacheIdentity,
): boolean {
	return (
		left.novelId === right.novelId &&
		left.sourcePath === right.sourcePath &&
		left.sourceMtime === right.sourceMtime &&
		left.sourceSize === right.sourceSize
	);
}

function getChapterCountFromCache(cache: RewardReaderRecord): number | null {
	const chapters = cache.chapters;
	if (!Array.isArray(chapters)) {
		return null;
	}

	const chapterCount = chapters.length;
	return isSafePositiveInteger(chapterCount) ? chapterCount : null;
}

function classifyReplayInspectionResult(
	result: unknown,
): RewardReaderReplayInspectionResultSnapshot {
	try {
		if (!isPlainObject(result)) {
			return {
				kind: 'malformed',
			};
		}

		const ok = result.ok;
		if (ok === false) {
			const code = result.code;
			const message = result.message;
			if (
				isReplayInspectionErrorCode(code) &&
				typeof message === 'string' &&
				message.length > 0
			) {
				return {
					kind: 'failure',
					code,
					message,
				};
			}

			return {
				kind: 'malformed',
			};
		}

		if (ok !== true) {
			return {
				kind: 'malformed',
			};
		}

		const status = result.status;
		if (status === 'not-observed') {
			return {
				kind: 'not-observed',
			};
		}

		if (status !== 'replay-confirmed') {
			return {
				kind: 'malformed',
			};
		}

		const calculation = result.calculation;
		const progress = result.progress;
		const studyRecord = result.studyRecord;
		const unlockRecord = result.unlockRecord;
		if (
			!isPlainObject(calculation) ||
			!isPlainObject(progress) ||
			!isPlainObject(studyRecord) ||
			!(unlockRecord === null || isPlainObject(unlockRecord))
		) {
			return {
				kind: 'malformed',
			};
		}

		return {
			kind: 'replay-confirmed',
			calculation:
				calculation as unknown as RewardReaderStudyExchangeCalculation,
			progress: progress as unknown as RewardReaderNovelProgress,
			studyRecord: studyRecord as unknown as RewardReaderStudyRecord,
			unlockRecord:
				unlockRecord as unknown as RewardReaderUnlockRecord | null,
		};
	} catch {
		return {
			kind: 'malformed',
		};
	}
}

async function runRewardReaderStudyReplayRecoveryInternal(
	adapter: DataAdapter,
	request: RewardReaderStudyReplayRuntimeRequestSnapshot,
	context: RewardReaderStudyReplayRuntimeContext,
): Promise<RunRewardReaderStudyReplayResult> {
	context.currentStage = 'initial-state-read';

	let initialStateReadResult: Awaited<
		ReturnType<typeof readRewardReaderStateStore>
	>;
	try {
		initialStateReadResult = await readRewardReaderStateStore(adapter);
	} catch {
		context.initialStateRead = 'read-blocked';
		return createFailure(
			'state-read-runtime-failed',
			'initial-state-read',
			null,
			STATE_READ_RUNTIME_FAILED_MESSAGE,
			context,
		);
	}

	if (!initialStateReadResult.ok) {
		context.initialStateRead = 'read-blocked';
		withMergedWarnings(context, initialStateReadResult.warnings);
		return createFailure(
			'state-read-blocked',
			'initial-state-read',
			initialStateReadResult.code,
			STATE_READ_BLOCKED_MESSAGE,
			context,
		);
	}

	context.initialStateRead = 'read-confirmed';
	withMergedWarnings(context, initialStateReadResult.warnings);

	const initialTargetMatch = findTargetNovelMatch(
		initialStateReadResult.store,
		request.novelId,
	);
	if (initialTargetMatch.status === 'not-found') {
		return createFailure(
			'target-novel-not-found',
			'initial-state-read',
			null,
			TARGET_NOVEL_NOT_FOUND_MESSAGE,
			context,
		);
	}

	if (initialTargetMatch.status === 'conflict' || !initialTargetMatch.identity) {
		return createFailure(
			'target-novel-conflict',
			'initial-state-read',
			null,
			TARGET_NOVEL_CONFLICT_MESSAGE,
			context,
		);
	}

	const initialIdentity = initialTargetMatch.identity;

	context.currentStage = 'chapter-cache-read';

	let chapterCacheReadResult: Awaited<
		ReturnType<typeof readRewardReaderChapterIndexCache>
	>;
	try {
		chapterCacheReadResult = await readRewardReaderChapterIndexCache(
			adapter,
			request.novelId,
		);
	} catch {
		context.chapterCacheRead = 'read-blocked';
		return createFailure(
			'chapter-cache-runtime-failed',
			'chapter-cache-read',
			null,
			CHAPTER_CACHE_RUNTIME_FAILED_MESSAGE,
			context,
		);
	}

	if (!chapterCacheReadResult.ok) {
		context.chapterCacheRead = 'read-blocked';
		withMergedWarnings(context, chapterCacheReadResult.warnings);
		return createFailure(
			'chapter-cache-read-blocked',
			'chapter-cache-read',
			chapterCacheReadResult.code,
			CHAPTER_CACHE_READ_BLOCKED_MESSAGE,
			context,
		);
	}

	context.chapterCacheRead = 'read-confirmed';
	withMergedWarnings(context, chapterCacheReadResult.warnings);

	const chapterCache = chapterCacheReadResult.cache;
	if (
		chapterCache === null ||
		!isPlainObject(chapterCache) ||
		!cacheIdentityMatches(chapterCache, initialIdentity)
	) {
		return createFailure(
			'chapter-cache-identity-conflict',
			'chapter-cache-read',
			null,
			CHAPTER_CACHE_IDENTITY_CONFLICT_MESSAGE,
			context,
		);
	}

	const chapterCount = getChapterCountFromCache(chapterCache);
	if (chapterCount === null) {
		return createFailure(
			'chapter-cache-identity-conflict',
			'chapter-cache-read',
			null,
			CHAPTER_CACHE_IDENTITY_CONFLICT_MESSAGE,
			context,
		);
	}

	context.currentStage = 'latest-state-read';

	let latestStateReadResult: Awaited<ReturnType<typeof readRewardReaderStateStore>>;
	try {
		latestStateReadResult = await readRewardReaderStateStore(adapter);
	} catch {
		context.latestStateRead = 'read-blocked';
		return createFailure(
			'state-read-runtime-failed',
			'latest-state-read',
			null,
			STATE_READ_RUNTIME_FAILED_MESSAGE,
			context,
		);
	}

	if (!latestStateReadResult.ok) {
		context.latestStateRead = 'read-blocked';
		withMergedWarnings(context, latestStateReadResult.warnings);
		return createFailure(
			'state-read-blocked',
			'latest-state-read',
			latestStateReadResult.code,
			STATE_READ_BLOCKED_MESSAGE,
			context,
		);
	}

	context.latestStateRead = 'read-confirmed';
	withMergedWarnings(context, latestStateReadResult.warnings);

	context.currentStage = 'target-revalidation';

	const latestTargetMatch = findTargetNovelMatch(
		latestStateReadResult.store,
		request.novelId,
	);
	if (
		latestTargetMatch.status !== 'found' ||
		!latestTargetMatch.identity ||
		!identitiesMatch(initialIdentity, latestTargetMatch.identity) ||
		!cacheIdentityMatches(chapterCache, latestTargetMatch.identity)
	) {
		return createFailure(
			'replay-target-changed',
			'target-revalidation',
			null,
			REPLAY_TARGET_CHANGED_MESSAGE,
			context,
		);
	}

	context.currentStage = 'replay-inspection';

	let inspectionResult: InspectRewardReaderStudyExchangeReplayResult;
	try {
		inspectionResult = inspectRewardReaderStudyExchangeReplay({
			store: latestStateReadResult.store,
			chapterCount,
			request,
		});
	} catch {
		return createFailure(
			'replay-inspection-runtime-failed',
			'replay-inspection',
			null,
			REPLAY_INSPECTION_RUNTIME_FAILED_MESSAGE,
			context,
		);
	}

	const inspectionResultSnapshot =
		classifyReplayInspectionResult(inspectionResult);
	if (inspectionResultSnapshot.kind === 'malformed') {
		return createFailure(
			'replay-inspection-runtime-failed',
			'replay-inspection',
			null,
			REPLAY_INSPECTION_RUNTIME_FAILED_MESSAGE,
			context,
		);
	}

	if (inspectionResultSnapshot.kind === 'failure') {
		return createFailure(
			inspectionResultSnapshot.code,
			'replay-inspection',
			null,
			inspectionResultSnapshot.message,
			context,
		);
	}

	if (inspectionResultSnapshot.kind === 'not-observed') {
		return {
			ok: true,
			status: 'not-observed',
			warnings: context.warnings,
			initialStateRead: 'read-confirmed',
			chapterCacheRead: 'read-confirmed',
			latestStateRead: 'read-confirmed',
		};
	}

	return {
		ok: true,
		status: 'replay-confirmed',
		calculation: inspectionResultSnapshot.calculation,
		progress: inspectionResultSnapshot.progress,
		studyRecord: inspectionResultSnapshot.studyRecord,
		unlockRecord: inspectionResultSnapshot.unlockRecord,
		warnings: context.warnings,
		initialStateRead: 'read-confirmed',
		chapterCacheRead: 'read-confirmed',
		latestStateRead: 'read-confirmed',
	};
}

export async function runRewardReaderStudyReplayRecovery(
	adapter: DataAdapter,
	request: RewardReaderStudyExchangeRuntimeRequest,
): Promise<RunRewardReaderStudyReplayResult> {
	const requestSnapshot = snapshotStudyReplayRuntimeRequest(request);
	if (!requestSnapshot) {
		return {
			ok: false,
			code: 'invalid-study-replay-runtime-request',
			stage: 'request-validation',
			causeCode: null,
			message: INVALID_REQUEST_MESSAGE,
			warnings: [],
			initialStateRead: 'not-attempted',
			chapterCacheRead: 'not-attempted',
			latestStateRead: 'not-attempted',
		};
	}

	const context = createRuntimeContext();
	try {
		return await runRewardReaderStudyReplayRecoveryInternal(
			adapter,
			requestSnapshot,
			context,
		);
	} catch {
		return createUnexpectedRuntimeFailure(context);
	}
}
