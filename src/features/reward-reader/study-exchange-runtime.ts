import type { DataAdapter } from 'obsidian';
import {
	readRewardReaderChapterIndexCache,
	readRewardReaderStateStore,
} from './read-only-storage-adapter';
import { isSafeRewardReaderId } from './store';
import {
	applyRewardReaderStudyExchange,
	type ApplyRewardReaderStudyExchangeErrorCode,
	type ApplyRewardReaderStudyExchangeResult,
	type RewardReaderStudyExchangeCalculation,
	type RewardReaderStudyExchangePolicy,
} from './study-exchange-engine';
import type {
	RewardReaderChapterIndexCache,
	RewardReaderNovel,
	RewardReaderNovelProgress,
	RewardReaderStore,
	RewardReaderStudyRecord,
	RewardReaderUnlockRecord,
} from './types';
import {
	writeRewardReaderStateStore,
	type RewardReaderStateWriteErrorCode,
} from './write-only-storage-adapter';

export interface RewardReaderStudyExchangeRuntimeRequest {
	novelId: string;
	studyRecordId: string;
	unlockRecordId: string;
	content: string;
	studyMinutes: number;
	occurredAt: string;
	policy: RewardReaderStudyExchangePolicy;
}

export type RewardReaderStudyExchangeReadStatus =
	| 'not-attempted'
	| 'read-confirmed'
	| 'read-blocked';

export type RewardReaderStudyExchangePersistenceStatus =
	| 'not-attempted'
	| 'write-confirmed'
	| 'write-blocked'
	| 'write-outcome-unknown';

export type RewardReaderStudyExchangeRuntimeStage =
	| 'request-validation'
	| 'initial-state-read'
	| 'chapter-cache-read'
	| 'latest-state-read'
	| 'target-revalidation'
	| 'study-exchange'
	| 'state-persistence';

export type RewardReaderStudyExchangeRuntimeErrorCode =
	| 'invalid-study-exchange-runtime-request'
	| 'state-read-blocked'
	| 'state-read-runtime-failed'
	| 'target-novel-not-found'
	| 'chapter-cache-read-blocked'
	| 'chapter-cache-runtime-failed'
	| 'chapter-cache-identity-conflict'
	| 'study-target-changed'
	| 'study-exchange-runtime-failed'
	| 'state-write-blocked'
	| 'state-persistence-runtime-failed'
	| ApplyRewardReaderStudyExchangeErrorCode;

export interface RunRewardReaderStudyExchangeSuccess {
	ok: true;
	status: 'persisted';
	calculation: RewardReaderStudyExchangeCalculation;
	progressAfter: RewardReaderNovelProgress;
	studyRecord: RewardReaderStudyRecord;
	unlockRecord: RewardReaderUnlockRecord | null;
	warnings: string[];
	initialStateRead: 'read-confirmed';
	chapterCacheRead: 'read-confirmed';
	latestStateRead: 'read-confirmed';
	statePersistence: 'write-confirmed';
}

export interface RunRewardReaderStudyExchangeFailure {
	ok: false;
	code: RewardReaderStudyExchangeRuntimeErrorCode;
	stage: RewardReaderStudyExchangeRuntimeStage;
	causeCode: string | null;
	message: string;
	warnings: string[];
	initialStateRead: RewardReaderStudyExchangeReadStatus;
	chapterCacheRead: RewardReaderStudyExchangeReadStatus;
	latestStateRead: RewardReaderStudyExchangeReadStatus;
	statePersistence: RewardReaderStudyExchangePersistenceStatus;
}

export type RunRewardReaderStudyExchangeResult =
	| RunRewardReaderStudyExchangeSuccess
	| RunRewardReaderStudyExchangeFailure;

type RewardReaderRecord = Record<string, unknown>;

type ValidatedRewardReaderStudyExchangeRuntimeRequest =
	RewardReaderStudyExchangeRuntimeRequest;

interface RewardReaderNovelCacheIdentity {
	novelId: string;
	sourcePath: string;
	sourceMtime: number;
	sourceSize: number;
}

interface RewardReaderStudyExchangeRuntimeContext {
	currentStage: RewardReaderStudyExchangeRuntimeStage;
	warnings: string[];
	initialStateRead: RewardReaderStudyExchangeReadStatus;
	chapterCacheRead: RewardReaderStudyExchangeReadStatus;
	latestStateRead: RewardReaderStudyExchangeReadStatus;
	statePersistence: RewardReaderStudyExchangePersistenceStatus;
	writerStarted: boolean;
}

const INVALID_REQUEST_MESSAGE =
	'Reward Reader received an invalid study exchange runtime request.';
const STATE_READ_BLOCKED_MESSAGE =
	'Reward Reader could not safely read the current study state.';
const STATE_READ_RUNTIME_FAILED_MESSAGE =
	'Reward Reader could not complete the study state read.';
const TARGET_NOVEL_NOT_FOUND_MESSAGE =
	'Reward Reader could not find the target novel for study exchange.';
const CHAPTER_CACHE_READ_BLOCKED_MESSAGE =
	'Reward Reader could not safely read the target chapter index.';
const CHAPTER_CACHE_RUNTIME_FAILED_MESSAGE =
	'Reward Reader could not complete the chapter-index read.';
const CHAPTER_CACHE_IDENTITY_CONFLICT_MESSAGE =
	'Reward Reader found inconsistent chapter-index identity for the target novel.';
const STUDY_TARGET_CHANGED_MESSAGE =
	'Reward Reader detected that the target novel changed during study exchange.';
const STUDY_EXCHANGE_RUNTIME_FAILED_MESSAGE =
	'Reward Reader could not safely calculate the study exchange.';
const STATE_WRITE_BLOCKED_MESSAGE =
	'Reward Reader could not persist the updated study state.';
const STATE_PERSISTENCE_RUNTIME_FAILED_MESSAGE =
	'Reward Reader could not confirm whether the updated study state was persisted.';

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
	const warnings: string[] = [];
	const seenWarnings = new Set<string>();

	for (const group of warningGroups) {
		for (const warning of group) {
			const normalizedWarning =
				typeof warning === 'string' ? warning.trim() : '';
			if (normalizedWarning.length === 0 || seenWarnings.has(normalizedWarning)) {
				continue;
			}

			seenWarnings.add(normalizedWarning);
			warnings.push(normalizedWarning);
		}
	}

	return warnings;
}

function createFailure(
	code: RunRewardReaderStudyExchangeFailure['code'],
	stage: RewardReaderStudyExchangeRuntimeStage,
	causeCode: string | null,
	message: string,
	warnings: string[],
	initialStateRead: RewardReaderStudyExchangeReadStatus,
	chapterCacheRead: RewardReaderStudyExchangeReadStatus,
	latestStateRead: RewardReaderStudyExchangeReadStatus,
	statePersistence: RewardReaderStudyExchangePersistenceStatus,
): RunRewardReaderStudyExchangeFailure {
	return {
		ok: false,
		code,
		stage,
		causeCode,
		message,
		warnings,
		initialStateRead,
		chapterCacheRead,
		latestStateRead,
		statePersistence,
	};
}

function createRuntimeContext(): RewardReaderStudyExchangeRuntimeContext {
	return {
		currentStage: 'request-validation',
		warnings: [],
		initialStateRead: 'not-attempted',
		chapterCacheRead: 'not-attempted',
		latestStateRead: 'not-attempted',
		statePersistence: 'not-attempted',
		writerStarted: false,
	};
}

function createUnexpectedRuntimeFailure(
	context: RewardReaderStudyExchangeRuntimeContext,
): RunRewardReaderStudyExchangeFailure {
	if (context.writerStarted) {
		return createFailure(
			'state-persistence-runtime-failed',
			'state-persistence',
			null,
			STATE_PERSISTENCE_RUNTIME_FAILED_MESSAGE,
			context.warnings,
			context.initialStateRead,
			context.chapterCacheRead,
			context.latestStateRead,
			'write-outcome-unknown',
		);
	}

	return createFailure(
		'study-exchange-runtime-failed',
		context.currentStage,
		null,
		STUDY_EXCHANGE_RUNTIME_FAILED_MESSAGE,
		context.warnings,
		context.initialStateRead,
		context.chapterCacheRead,
		context.latestStateRead,
		context.statePersistence,
	);
}

function validateRequestSnapshot(
	request: unknown,
): ValidatedRewardReaderStudyExchangeRuntimeRequest | null {
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

function findTargetNovel(
	store: RewardReaderStore,
	novelId: string,
): RewardReaderNovel | null {
	let matchedNovel: RewardReaderNovel | null = null;

	for (const novel of store.novels) {
		if (novel.id !== novelId) {
			continue;
		}

		if (matchedNovel !== null) {
			return null;
		}

		matchedNovel = novel;
	}

	return matchedNovel;
}

function getNovelCacheIdentity(
	novel: RewardReaderNovel,
): RewardReaderNovelCacheIdentity {
	return {
		novelId: novel.id,
		sourcePath: novel.sourcePath,
		sourceMtime: novel.sourceMtime,
		sourceSize: novel.sourceSize,
	};
}

function cacheMatchesIdentity(
	cache: RewardReaderChapterIndexCache,
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

function getChapterCountFromCache(
	cache: RewardReaderChapterIndexCache,
): number | null {
	const chapterCount = cache.chapters.length;
	return isSafePositiveInteger(chapterCount) ? chapterCount : null;
}

function mapWriteFailureStatus(
	code: RewardReaderStateWriteErrorCode,
): RewardReaderStudyExchangePersistenceStatus {
	return code === 'state-write-failed'
		? 'write-outcome-unknown'
		: 'write-blocked';
}

function withMergedWarnings(
	context: RewardReaderStudyExchangeRuntimeContext,
	warnings: unknown,
): void {
	context.warnings = mergeWarnings(
		context.warnings,
		readWarningsSnapshot(warnings),
	);
}

async function runRewardReaderStudyExchangeInternal(
	adapter: DataAdapter,
	request: ValidatedRewardReaderStudyExchangeRuntimeRequest,
	context: RewardReaderStudyExchangeRuntimeContext,
): Promise<RunRewardReaderStudyExchangeResult> {
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
			context.warnings,
			context.initialStateRead,
			context.chapterCacheRead,
			context.latestStateRead,
			context.statePersistence,
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
			context.warnings,
			context.initialStateRead,
			context.chapterCacheRead,
			context.latestStateRead,
			context.statePersistence,
		);
	}

	context.initialStateRead = 'read-confirmed';
	withMergedWarnings(context, initialStateReadResult.warnings);

	const initialStore = initialStateReadResult.store;
	const initialNovel = findTargetNovel(initialStore, request.novelId);
	if (!initialNovel) {
		return createFailure(
			'target-novel-not-found',
			'initial-state-read',
			null,
			TARGET_NOVEL_NOT_FOUND_MESSAGE,
			context.warnings,
			context.initialStateRead,
			context.chapterCacheRead,
			context.latestStateRead,
			context.statePersistence,
		);
	}

	const initialIdentity = getNovelCacheIdentity(initialNovel);

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
			context.warnings,
			context.initialStateRead,
			context.chapterCacheRead,
			context.latestStateRead,
			context.statePersistence,
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
			context.warnings,
			context.initialStateRead,
			context.chapterCacheRead,
			context.latestStateRead,
			context.statePersistence,
		);
	}

	context.chapterCacheRead = 'read-confirmed';
	withMergedWarnings(context, chapterCacheReadResult.warnings);

	const chapterCache = chapterCacheReadResult.cache;
	if (chapterCache === null || !cacheMatchesIdentity(chapterCache, initialIdentity)) {
		return createFailure(
			'chapter-cache-identity-conflict',
			'chapter-cache-read',
			null,
			CHAPTER_CACHE_IDENTITY_CONFLICT_MESSAGE,
			context.warnings,
			context.initialStateRead,
			context.chapterCacheRead,
			context.latestStateRead,
			context.statePersistence,
		);
	}

	const chapterCount = getChapterCountFromCache(chapterCache);
	if (chapterCount === null) {
		return createFailure(
			'chapter-cache-identity-conflict',
			'chapter-cache-read',
			null,
			CHAPTER_CACHE_IDENTITY_CONFLICT_MESSAGE,
			context.warnings,
			context.initialStateRead,
			context.chapterCacheRead,
			context.latestStateRead,
			context.statePersistence,
		);
	}

	context.currentStage = 'latest-state-read';

	let latestStateReadResult: Awaited<
		ReturnType<typeof readRewardReaderStateStore>
	>;
	try {
		latestStateReadResult = await readRewardReaderStateStore(adapter);
	} catch {
		context.latestStateRead = 'read-blocked';
		return createFailure(
			'state-read-runtime-failed',
			'latest-state-read',
			null,
			STATE_READ_RUNTIME_FAILED_MESSAGE,
			context.warnings,
			context.initialStateRead,
			context.chapterCacheRead,
			context.latestStateRead,
			context.statePersistence,
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
			context.warnings,
			context.initialStateRead,
			context.chapterCacheRead,
			context.latestStateRead,
			context.statePersistence,
		);
	}

	context.latestStateRead = 'read-confirmed';
	withMergedWarnings(context, latestStateReadResult.warnings);

	const latestStore = latestStateReadResult.store;

	context.currentStage = 'target-revalidation';

	const latestNovel = findTargetNovel(latestStore, request.novelId);
	if (!latestNovel) {
		return createFailure(
			'study-target-changed',
			'target-revalidation',
			null,
			STUDY_TARGET_CHANGED_MESSAGE,
			context.warnings,
			context.initialStateRead,
			context.chapterCacheRead,
			context.latestStateRead,
			context.statePersistence,
		);
	}

	const latestIdentity = getNovelCacheIdentity(latestNovel);
	if (!identitiesMatch(initialIdentity, latestIdentity)) {
		return createFailure(
			'study-target-changed',
			'target-revalidation',
			null,
			STUDY_TARGET_CHANGED_MESSAGE,
			context.warnings,
			context.initialStateRead,
			context.chapterCacheRead,
			context.latestStateRead,
			context.statePersistence,
		);
	}

	context.currentStage = 'study-exchange';

	let exchangeResult: ApplyRewardReaderStudyExchangeResult;
	try {
		exchangeResult = applyRewardReaderStudyExchange({
			store: latestStore,
			novelId: request.novelId,
			chapterCount,
			studyRecordId: request.studyRecordId,
			unlockRecordId: request.unlockRecordId,
			content: request.content,
			studyMinutes: request.studyMinutes,
			occurredAt: request.occurredAt,
			policy: request.policy,
		});
	} catch {
		return createFailure(
			'study-exchange-runtime-failed',
			'study-exchange',
			null,
			STUDY_EXCHANGE_RUNTIME_FAILED_MESSAGE,
			context.warnings,
			context.initialStateRead,
			context.chapterCacheRead,
			context.latestStateRead,
			context.statePersistence,
		);
	}

	if (!exchangeResult.ok) {
		return createFailure(
			exchangeResult.code,
			'study-exchange',
			null,
			exchangeResult.message,
			context.warnings,
			context.initialStateRead,
			context.chapterCacheRead,
			context.latestStateRead,
			context.statePersistence,
		);
	}

	context.currentStage = 'state-persistence';
	context.writerStarted = true;

	let stateWriteResult: Awaited<ReturnType<typeof writeRewardReaderStateStore>>;
	try {
		stateWriteResult = await writeRewardReaderStateStore(
			adapter,
			exchangeResult.nextStore,
		);
	} catch {
		return createFailure(
			'state-persistence-runtime-failed',
			'state-persistence',
			null,
			STATE_PERSISTENCE_RUNTIME_FAILED_MESSAGE,
			context.warnings,
			context.initialStateRead,
			context.chapterCacheRead,
			context.latestStateRead,
			'write-outcome-unknown',
		);
	}

	if (!stateWriteResult.ok) {
		const statePersistence = mapWriteFailureStatus(stateWriteResult.code);
		withMergedWarnings(context, stateWriteResult.warnings);
		context.statePersistence = statePersistence;
		return createFailure(
			'state-write-blocked',
			'state-persistence',
			stateWriteResult.code,
			STATE_WRITE_BLOCKED_MESSAGE,
			context.warnings,
			context.initialStateRead,
			context.chapterCacheRead,
			context.latestStateRead,
			statePersistence,
		);
	}

	withMergedWarnings(context, stateWriteResult.warnings);
	context.statePersistence = 'write-confirmed';

	return {
		ok: true,
		status: 'persisted',
		calculation: exchangeResult.calculation,
		progressAfter: exchangeResult.progressAfter,
		studyRecord: exchangeResult.studyRecord,
		unlockRecord: exchangeResult.unlockRecord,
		warnings: context.warnings,
		initialStateRead: 'read-confirmed',
		chapterCacheRead: 'read-confirmed',
		latestStateRead: 'read-confirmed',
		statePersistence: 'write-confirmed',
	};
}

export async function runRewardReaderStudyExchange(
	adapter: DataAdapter,
	request: RewardReaderStudyExchangeRuntimeRequest,
): Promise<RunRewardReaderStudyExchangeResult> {
	const requestSnapshot = validateRequestSnapshot(request);
	if (!requestSnapshot) {
		return createFailure(
			'invalid-study-exchange-runtime-request',
			'request-validation',
			null,
			INVALID_REQUEST_MESSAGE,
			[],
			'not-attempted',
			'not-attempted',
			'not-attempted',
			'not-attempted',
		);
	}

	const context = createRuntimeContext();
	try {
		return await runRewardReaderStudyExchangeInternal(
			adapter,
			requestSnapshot,
			context,
		);
	} catch {
		return createUnexpectedRuntimeFailure(context);
	}
}
