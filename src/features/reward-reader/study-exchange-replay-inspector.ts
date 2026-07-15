import { isSafeRewardReaderId, normalizeRewardReaderStore } from './store';
import {
	calculateRewardReaderStudyExchange,
	type RewardReaderStudyExchangeCalculation,
	type RewardReaderStudyExchangePolicy,
} from './study-exchange-engine';
import type { RewardReaderStudyExchangeRuntimeRequest } from './study-exchange-runtime';
import type {
	RewardReaderNovelProgress,
	RewardReaderStore,
	RewardReaderStudyRecord,
	RewardReaderUnlockRecord,
} from './types';

export interface InspectRewardReaderStudyExchangeReplayInput {
	store: RewardReaderStore;
	chapterCount: number;
	request: RewardReaderStudyExchangeRuntimeRequest;
}

export type RewardReaderStudyExchangeReplayInspectionErrorCode =
	| 'invalid-replay-inspection-input'
	| 'invalid-store'
	| 'unsupported-store-schema'
	| 'invalid-chapter-count'
	| 'replay-partial-observed'
	| 'replay-identity-conflict'
	| 'replay-history-conflict'
	| 'replay-outcome-conflict'
	| 'replay-inspection-runtime-failed';

export interface InspectRewardReaderStudyExchangeReplayConfirmed {
	ok: true;
	status: 'replay-confirmed';
	calculation: RewardReaderStudyExchangeCalculation;
	progress: RewardReaderNovelProgress;
	studyRecord: RewardReaderStudyRecord;
	unlockRecord: RewardReaderUnlockRecord | null;
}

export interface InspectRewardReaderStudyExchangeReplayNotObserved {
	ok: true;
	status: 'not-observed';
}

export interface InspectRewardReaderStudyExchangeReplayFailure {
	ok: false;
	code: RewardReaderStudyExchangeReplayInspectionErrorCode;
	message: string;
}

export type InspectRewardReaderStudyExchangeReplayResult =
	| InspectRewardReaderStudyExchangeReplayConfirmed
	| InspectRewardReaderStudyExchangeReplayNotObserved
	| InspectRewardReaderStudyExchangeReplayFailure;

type RewardReaderRecord = Record<string, unknown>;
type RewardReaderHistoryType = 'study' | 'unlock' | 'reading';

interface RewardReaderStudyExchangeReplayRequestSnapshot {
	novelId: string;
	studyRecordId: string;
	unlockRecordId: string;
	content: string;
	normalizedContent: string;
	studyMinutes: number;
	occurredAt: string;
	policy: RewardReaderStudyExchangePolicy;
}

interface InspectRewardReaderStudyExchangeReplaySnapshot {
	store: unknown;
	chapterCount: number;
	request: RewardReaderStudyExchangeReplayRequestSnapshot;
}

interface RewardReaderHistoryNamespaceEntry {
	studyCount: number;
	unlockCount: number;
	readingCount: number;
}

interface RewardReaderHistoryNamespaceScan {
	studyById: Map<string, RewardReaderStudyRecord>;
	studyArrayIndexById: Map<string, number>;
	unlockById: Map<string, RewardReaderUnlockRecord>;
	linkedUnlocksByStudyId: Map<string, RewardReaderUnlockRecord[]>;
	namespaceById: Map<string, RewardReaderHistoryNamespaceEntry>;
	hasNonRequestedGlobalDuplicateId: boolean;
}

interface RewardReaderTargetStudyHistory {
	targetStudyArrayIndex: number;
	totalStudyMinutesBefore: number;
	studyMinuteBalanceBefore: number;
	dailyUnlockedChapterCountBefore: number;
	allStudyMinutesTotal: number;
	finalStudyBalance: number;
	latestStudyUtcDate: string;
	latestStudyDateUnlockedCount: number;
	latestStudyTimestamp: string;
}

interface RewardReaderTargetUnlockHistory {
	unlockedThroughChapterIndexBefore: number | null;
	targetUnlockedThroughChapterIndexAfter: number | null;
	finalUnlockedThroughChapterIndex: number | null;
}

const INSPECTION_ERROR_MESSAGES: Record<
	RewardReaderStudyExchangeReplayInspectionErrorCode,
	string
> = {
	'invalid-replay-inspection-input':
		'Reward Reader received invalid study replay inspection input.',
	'invalid-store':
		'Reward Reader requires a canonical current-schema store for replay inspection.',
	'unsupported-store-schema':
		'Reward Reader cannot inspect replay evidence in a newer unsupported store schema.',
	'invalid-chapter-count':
		'Reward Reader requires a positive chapter count for replay inspection.',
	'replay-partial-observed':
		'Reward Reader found only part of the requested study exchange record.',
	'replay-identity-conflict':
		'Reward Reader found conflicting history record identity for the requested study exchange.',
	'replay-history-conflict':
		'Reward Reader found inconsistent study history while inspecting the requested exchange.',
	'replay-outcome-conflict':
		'Reward Reader found a persisted study outcome that does not match the requested exchange.',
	'replay-inspection-runtime-failed':
		'Reward Reader could not safely inspect the requested study exchange replay.',
};

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

function safeAdd(left: number, right: number): number | null {
	const result = left + right;
	return Number.isSafeInteger(result) ? result : null;
}

function createFailure(
	code: RewardReaderStudyExchangeReplayInspectionErrorCode,
): InspectRewardReaderStudyExchangeReplayFailure {
	return {
		ok: false,
		code,
		message: INSPECTION_ERROR_MESSAGES[code],
	};
}

function isFailureResult(
	value: unknown,
): value is InspectRewardReaderStudyExchangeReplayFailure {
	return (
		isPlainObject(value) &&
		value.ok === false &&
		typeof value.code === 'string' &&
		typeof value.message === 'string'
	);
}

function normalizeStudyContent(content: string): string {
	return content.replace(/\r\n?/g, '\n').trim();
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

function snapshotReplayInspectionInput(
	input: unknown,
): InspectRewardReaderStudyExchangeReplaySnapshot | InspectRewardReaderStudyExchangeReplayFailure {
	try {
		if (!isPlainObject(input)) {
			return createFailure('invalid-replay-inspection-input');
		}

		const store = input.store;
		const chapterCount = input.chapterCount;
		const request = input.request;
		if (!isPlainObject(request)) {
			return createFailure('invalid-replay-inspection-input');
		}

		if (!isSafePositiveInteger(chapterCount)) {
			return createFailure('invalid-chapter-count');
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
			return createFailure('invalid-replay-inspection-input');
		}

		return {
			store,
			chapterCount,
			request: {
				novelId,
				studyRecordId,
				unlockRecordId,
				content,
				normalizedContent: normalizeStudyContent(content),
				studyMinutes,
				occurredAt,
				policy: policySnapshot,
			},
		};
	} catch {
		return createFailure('invalid-replay-inspection-input');
	}
}

function validateCanonicalStore(
	store: unknown,
): RewardReaderStore | InspectRewardReaderStudyExchangeReplayFailure {
	const normalization = normalizeRewardReaderStore(store);
	const rawSchemaVersion =
		isPlainObject(store) && typeof store.schemaVersion === 'number'
			? store.schemaVersion
			: undefined;
	const currentSchemaVersion = normalization.store.schemaVersion;

	if (
		normalization.hasUnsupportedFutureVersion ||
		(typeof rawSchemaVersion === 'number' &&
			Number.isInteger(rawSchemaVersion) &&
			rawSchemaVersion > currentSchemaVersion)
	) {
		return createFailure('unsupported-store-schema');
	}

	if (
		!isPlainObject(store) ||
		rawSchemaVersion !== currentSchemaVersion ||
		normalization.didNormalize ||
		normalization.shouldPersist ||
		!isCanonicalValue(store, normalization.store)
	) {
		return createFailure('invalid-store');
	}

	return store as unknown as RewardReaderStore;
}

function registerHistoryId(
	namespaceById: Map<string, RewardReaderHistoryNamespaceEntry>,
	id: string,
	type: RewardReaderHistoryType,
	isRequestedId: boolean,
): boolean {
	const existing = namespaceById.get(id) ?? {
		studyCount: 0,
		unlockCount: 0,
		readingCount: 0,
	};

	if (type === 'study') {
		existing.studyCount += 1;
	} else if (type === 'unlock') {
		existing.unlockCount += 1;
	} else {
		existing.readingCount += 1;
	}

	namespaceById.set(id, existing);

	return (
		!isRequestedId &&
		existing.studyCount + existing.unlockCount + existing.readingCount > 1
	);
}

function scanHistoryNamespace(
	store: RewardReaderStore,
	request: RewardReaderStudyExchangeReplayRequestSnapshot,
): RewardReaderHistoryNamespaceScan {
	const namespaceById = new Map<string, RewardReaderHistoryNamespaceEntry>();
	const studyById = new Map<string, RewardReaderStudyRecord>();
	const studyArrayIndexById = new Map<string, number>();
	const unlockById = new Map<string, RewardReaderUnlockRecord>();
	const linkedUnlocksByStudyId = new Map<string, RewardReaderUnlockRecord[]>();
	let hasNonRequestedGlobalDuplicateId = false;

	for (let index = 0; index < store.studyRecords.length; index += 1) {
		const record = store.studyRecords[index];
		if (!record) {
			continue;
		}

		hasNonRequestedGlobalDuplicateId =
			registerHistoryId(
				namespaceById,
				record.id,
				'study',
				record.id === request.studyRecordId || record.id === request.unlockRecordId,
			) || hasNonRequestedGlobalDuplicateId;

		if (!studyById.has(record.id)) {
			studyById.set(record.id, record);
			studyArrayIndexById.set(record.id, index);
		}
	}

	for (const record of store.unlockRecords) {
		hasNonRequestedGlobalDuplicateId =
			registerHistoryId(
				namespaceById,
				record.id,
				'unlock',
				record.id === request.studyRecordId || record.id === request.unlockRecordId,
			) || hasNonRequestedGlobalDuplicateId;

		if (!unlockById.has(record.id)) {
			unlockById.set(record.id, record);
		}

		const linkedUnlocks = linkedUnlocksByStudyId.get(record.studyRecordId) ?? [];
		linkedUnlocks.push(record);
		linkedUnlocksByStudyId.set(record.studyRecordId, linkedUnlocks);
	}

	for (const record of store.readingRecords) {
		hasNonRequestedGlobalDuplicateId =
			registerHistoryId(
				namespaceById,
				record.id,
				'reading',
				record.id === request.studyRecordId || record.id === request.unlockRecordId,
			) || hasNonRequestedGlobalDuplicateId;
	}

	return {
		studyById,
		studyArrayIndexById,
		unlockById,
		linkedUnlocksByStudyId,
		namespaceById,
		hasNonRequestedGlobalDuplicateId,
	};
}

function getNamespaceEntry(
	namespaceById: Map<string, RewardReaderHistoryNamespaceEntry>,
	id: string,
): RewardReaderHistoryNamespaceEntry {
	return (
		namespaceById.get(id) ?? {
			studyCount: 0,
			unlockCount: 0,
			readingCount: 0,
		}
	);
}

function matchesRequestedStudyRecord(
	record: RewardReaderStudyRecord,
	request: RewardReaderStudyExchangeReplayRequestSnapshot,
): boolean {
	return (
		record.id === request.studyRecordId &&
		record.novelId === request.novelId &&
		record.content === request.normalizedContent &&
		record.minutes === request.studyMinutes &&
		record.createdAt === request.occurredAt
	);
}

function matchesRequestedUnlockIdentity(
	record: RewardReaderUnlockRecord,
	request: RewardReaderStudyExchangeReplayRequestSnapshot,
): boolean {
	return (
		record.id === request.unlockRecordId &&
		record.studyRecordId === request.studyRecordId &&
		record.novelId === request.novelId &&
		record.createdAt === request.occurredAt
	);
}

function countMatchingNovels(store: RewardReaderStore, novelId: string): number {
	let matchedNovelCount = 0;

	for (const novel of store.novels) {
		if (novel.id === novelId) {
			matchedNovelCount += 1;
		}
	}

	return matchedNovelCount;
}

function validateRequestedIdentityObservation(
	request: RewardReaderStudyExchangeReplayRequestSnapshot,
	scan: RewardReaderHistoryNamespaceScan,
): InspectRewardReaderStudyExchangeReplayResult | null {
	const requestedStudyEntry = getNamespaceEntry(
		scan.namespaceById,
		request.studyRecordId,
	);
	const requestedUnlockEntry = getNamespaceEntry(
		scan.namespaceById,
		request.unlockRecordId,
	);

	if (
		requestedStudyEntry.unlockCount > 0 ||
		requestedStudyEntry.readingCount > 0 ||
		requestedStudyEntry.studyCount > 1 ||
		requestedUnlockEntry.studyCount > 0 ||
		requestedUnlockEntry.readingCount > 0 ||
		requestedUnlockEntry.unlockCount > 1
	) {
		return createFailure('replay-identity-conflict');
	}

	if (scan.hasNonRequestedGlobalDuplicateId) {
		return createFailure('replay-history-conflict');
	}

	return null;
}

function classifyReplayObservation(
	request: RewardReaderStudyExchangeReplayRequestSnapshot,
	scan: RewardReaderHistoryNamespaceScan,
): {
	studyRecord: RewardReaderStudyRecord;
	unlockRecord: RewardReaderUnlockRecord | null;
} | InspectRewardReaderStudyExchangeReplayResult {
	const requestedStudyEntry = getNamespaceEntry(
		scan.namespaceById,
		request.studyRecordId,
	);
	const requestedUnlockEntry = getNamespaceEntry(
		scan.namespaceById,
		request.unlockRecordId,
	);
	const requestedStudyRecord =
		requestedStudyEntry.studyCount === 1
			? (scan.studyById.get(request.studyRecordId) ?? null)
			: null;
	const requestedUnlockRecord =
		requestedUnlockEntry.unlockCount === 1
			? (scan.unlockById.get(request.unlockRecordId) ?? null)
			: null;
	const linkedUnlocks =
		scan.linkedUnlocksByStudyId.get(request.studyRecordId) ?? [];

	if (
		requestedStudyRecord === null &&
		requestedUnlockRecord === null &&
		linkedUnlocks.length === 0
	) {
		return {
			ok: true,
			status: 'not-observed',
		};
	}

	if (requestedStudyRecord !== null) {
		if (!matchesRequestedStudyRecord(requestedStudyRecord, request)) {
			return createFailure('replay-identity-conflict');
		}

		if (requestedStudyRecord.unlockedChapterCount === 0) {
			if (requestedUnlockRecord !== null || linkedUnlocks.length > 0) {
				return createFailure('replay-identity-conflict');
			}

			return {
				studyRecord: requestedStudyRecord,
				unlockRecord: null,
			};
		}

		if (requestedUnlockRecord === null) {
			if (linkedUnlocks.length === 0) {
				return createFailure('replay-partial-observed');
			}

			return createFailure('replay-identity-conflict');
		}

		if (!matchesRequestedUnlockIdentity(requestedUnlockRecord, request)) {
			return createFailure('replay-identity-conflict');
		}

		if (linkedUnlocks.length !== 1 || linkedUnlocks[0] !== requestedUnlockRecord) {
			return createFailure('replay-identity-conflict');
		}

		return {
			studyRecord: requestedStudyRecord,
			unlockRecord: requestedUnlockRecord,
		};
	}

	if (requestedUnlockRecord !== null) {
		if (matchesRequestedUnlockIdentity(requestedUnlockRecord, request)) {
			return createFailure('replay-partial-observed');
		}

		return createFailure('replay-identity-conflict');
	}

	return createFailure('replay-identity-conflict');
}

function validateCompleteStudyUnlockLinkage(
	store: RewardReaderStore,
	scan: RewardReaderHistoryNamespaceScan,
): InspectRewardReaderStudyExchangeReplayResult | null {
	for (const unlockRecord of store.unlockRecords) {
		const linkedStudyRecord = scan.studyById.get(unlockRecord.studyRecordId);
		if (!linkedStudyRecord) {
			return createFailure('replay-history-conflict');
		}

		if (
			linkedStudyRecord.novelId !== unlockRecord.novelId ||
			linkedStudyRecord.createdAt !== unlockRecord.createdAt ||
			linkedStudyRecord.unlockedChapterCount === 0 ||
			unlockRecord.unlockedChapterIndexes.length !==
				linkedStudyRecord.unlockedChapterCount
		) {
			return createFailure('replay-history-conflict');
		}
	}

	for (const studyRecord of store.studyRecords) {
		const linkedUnlocks = scan.linkedUnlocksByStudyId.get(studyRecord.id) ?? [];
		if (
			(studyRecord.unlockedChapterCount === 0 && linkedUnlocks.length !== 0) ||
			(studyRecord.unlockedChapterCount > 0 && linkedUnlocks.length !== 1)
		) {
			return createFailure('replay-history-conflict');
		}
	}

	return null;
}

function reconstructTargetStudyHistory(
	store: RewardReaderStore,
	request: RewardReaderStudyExchangeReplayRequestSnapshot,
): RewardReaderTargetStudyHistory | InspectRewardReaderStudyExchangeReplayResult {
	let previousCreatedAt: string | null = null;
	let previousBalanceAfter: number | null = null;
	let totalStudyMinutes = 0;
	let currentStudyUtcDate: string | null = null;
	let currentStudyDateUnlockedCount = 0;
	let latestStudyUtcDate: string | null = null;
	let latestStudyDateUnlockedCount = 0;
	let latestStudyTimestamp: string | null = null;
	let totalStudyMinutesBefore = 0;
	let studyMinuteBalanceBefore = 0;
	let dailyUnlockedChapterCountBefore = 0;
	let targetStudyArrayIndex = -1;
	let targetSeen = false;

	for (let index = 0; index < store.studyRecords.length; index += 1) {
		const studyRecord = store.studyRecords[index];
		if (!studyRecord || studyRecord.novelId !== request.novelId) {
			continue;
		}

		if (
			!isCanonicalUtcIsoTimestamp(studyRecord.createdAt) ||
			!isSafePositiveInteger(studyRecord.minutes) ||
			!isSafeNonNegativeInteger(studyRecord.balanceBefore) ||
			!isSafeNonNegativeInteger(studyRecord.balanceAfter) ||
			!isSafeNonNegativeInteger(studyRecord.unlockedChapterCount)
		) {
			return createFailure('replay-history-conflict');
		}

		if (
			(previousCreatedAt !== null && studyRecord.createdAt < previousCreatedAt) ||
			(previousBalanceAfter === null && studyRecord.balanceBefore !== 0) ||
			(previousBalanceAfter !== null &&
				studyRecord.balanceBefore !== previousBalanceAfter)
		) {
			return createFailure('replay-history-conflict');
		}

		const studyUtcDate = studyRecord.createdAt.slice(0, 10);
		if (studyRecord.id === request.studyRecordId) {
			targetSeen = true;
			targetStudyArrayIndex = index;
			totalStudyMinutesBefore = totalStudyMinutes;
			studyMinuteBalanceBefore =
				previousBalanceAfter === null ? 0 : previousBalanceAfter;
			dailyUnlockedChapterCountBefore =
				currentStudyUtcDate === studyUtcDate ? currentStudyDateUnlockedCount : 0;
		}

		const nextTotalStudyMinutes = safeAdd(totalStudyMinutes, studyRecord.minutes);
		if (nextTotalStudyMinutes === null) {
			return createFailure('replay-history-conflict');
		}
		totalStudyMinutes = nextTotalStudyMinutes;

		if (currentStudyUtcDate === studyUtcDate) {
			const nextDailyCount = safeAdd(
				currentStudyDateUnlockedCount,
				studyRecord.unlockedChapterCount,
			);
			if (nextDailyCount === null) {
				return createFailure('replay-history-conflict');
			}
			currentStudyDateUnlockedCount = nextDailyCount;
		} else {
			currentStudyUtcDate = studyUtcDate;
			currentStudyDateUnlockedCount = studyRecord.unlockedChapterCount;
		}

		previousCreatedAt = studyRecord.createdAt;
		previousBalanceAfter = studyRecord.balanceAfter;
		latestStudyUtcDate = currentStudyUtcDate;
		latestStudyDateUnlockedCount = currentStudyDateUnlockedCount;
		latestStudyTimestamp = studyRecord.createdAt;
	}

	if (
		!targetSeen ||
		targetStudyArrayIndex < 0 ||
		previousBalanceAfter === null ||
		latestStudyUtcDate === null ||
		latestStudyTimestamp === null
	) {
		return createFailure('replay-history-conflict');
	}

	return {
		targetStudyArrayIndex,
		totalStudyMinutesBefore,
		studyMinuteBalanceBefore,
		dailyUnlockedChapterCountBefore,
		allStudyMinutesTotal: totalStudyMinutes,
		finalStudyBalance: previousBalanceAfter,
		latestStudyUtcDate,
		latestStudyDateUnlockedCount,
		latestStudyTimestamp,
	};
}

function reconstructTargetUnlockHistory(
	store: RewardReaderStore,
	scan: RewardReaderHistoryNamespaceScan,
	request: RewardReaderStudyExchangeReplayRequestSnapshot,
	chapterCount: number,
	targetStudyArrayIndex: number,
	targetStudyRecord: RewardReaderStudyRecord,
	targetUnlockRecord: RewardReaderUnlockRecord | null,
): RewardReaderTargetUnlockHistory | InspectRewardReaderStudyExchangeReplayResult {
	let previousLinkedStudyArrayIndex = -1;
	let nextExpectedChapterIndex = 0;
	let unlockedThroughChapterIndexBefore: number | null | undefined;

	for (const unlockRecord of store.unlockRecords) {
		const linkedStudyRecord = scan.studyById.get(unlockRecord.studyRecordId);
		const linkedStudyArrayIndex = scan.studyArrayIndexById.get(
			unlockRecord.studyRecordId,
		);

		if (
			!linkedStudyRecord ||
			linkedStudyArrayIndex === undefined ||
			linkedStudyRecord.novelId !== request.novelId
		) {
			continue;
		}

		if (unlockedThroughChapterIndexBefore === undefined) {
			if (linkedStudyArrayIndex >= targetStudyArrayIndex) {
				unlockedThroughChapterIndexBefore =
					nextExpectedChapterIndex === 0 ? null : nextExpectedChapterIndex - 1;
			}
		}

		if (linkedStudyArrayIndex <= previousLinkedStudyArrayIndex) {
			return createFailure('replay-history-conflict');
		}

		previousLinkedStudyArrayIndex = linkedStudyArrayIndex;

		const firstUnlockedIndex = unlockRecord.unlockedChapterIndexes[0];
		if (
			firstUnlockedIndex === undefined ||
			firstUnlockedIndex !== nextExpectedChapterIndex
		) {
			return createFailure('replay-history-conflict');
		}

		for (
			let chapterOffset = 0;
			chapterOffset < unlockRecord.unlockedChapterIndexes.length;
			chapterOffset += 1
		) {
			const unlockedChapterIndex = unlockRecord.unlockedChapterIndexes[chapterOffset];
			if (
				!isSafeNonNegativeInteger(unlockedChapterIndex) ||
				unlockedChapterIndex >= chapterCount ||
				unlockedChapterIndex !== firstUnlockedIndex + chapterOffset
			) {
				return createFailure('replay-history-conflict');
			}
		}

		const lastUnlockedIndex =
			unlockRecord.unlockedChapterIndexes[
				unlockRecord.unlockedChapterIndexes.length - 1
			];
		if (lastUnlockedIndex === undefined) {
			return createFailure('replay-history-conflict');
		}

		nextExpectedChapterIndex = lastUnlockedIndex + 1;
	}

	if (unlockedThroughChapterIndexBefore === undefined) {
		unlockedThroughChapterIndexBefore =
			nextExpectedChapterIndex === 0 ? null : nextExpectedChapterIndex - 1;
	}

	const targetUnlockedThroughChapterIndexAfter =
		targetStudyRecord.unlockedChapterCount === 0
			? unlockedThroughChapterIndexBefore
			: (targetUnlockRecord?.unlockedChapterIndexes[
					targetUnlockRecord.unlockedChapterIndexes.length - 1
				] ?? null);

	return {
		unlockedThroughChapterIndexBefore,
		targetUnlockedThroughChapterIndexAfter,
		finalUnlockedThroughChapterIndex:
			nextExpectedChapterIndex === 0 ? null : nextExpectedChapterIndex - 1,
	};
}

function createSyntheticProgress(
	request: RewardReaderStudyExchangeReplayRequestSnapshot,
	studyHistory: RewardReaderTargetStudyHistory,
	unlockHistory: RewardReaderTargetUnlockHistory,
	targetStudyRecord: RewardReaderStudyRecord,
): RewardReaderNovelProgress | InspectRewardReaderStudyExchangeReplayResult {
	if (targetStudyRecord.balanceBefore !== studyHistory.studyMinuteBalanceBefore) {
		return createFailure('replay-history-conflict');
	}

	return {
		novelId: request.novelId,
		unlockedThroughChapterIndex: unlockHistory.unlockedThroughChapterIndexBefore,
		readThroughChapterIndex: null,
		currentChapterIndex: null,
		currentChapterScrollOffset: 0,
		studyMinuteBalance: targetStudyRecord.balanceBefore,
		totalStudyMinutes: studyHistory.totalStudyMinutesBefore,
		todayUnlockDate: request.occurredAt.slice(0, 10),
		todayUnlockedChapters: studyHistory.dailyUnlockedChapterCountBefore,
		updatedAt: request.occurredAt,
	};
}

function matchesNumberArray(left: number[], right: number[]): boolean {
	return (
		left.length === right.length &&
		left.every((entry, index) => entry === right[index])
	);
}

function validateCalculationAgainstPersistedOutcome(
	calculation: RewardReaderStudyExchangeCalculation,
	studyHistory: RewardReaderTargetStudyHistory,
	unlockHistory: RewardReaderTargetUnlockHistory,
	studyRecord: RewardReaderStudyRecord,
	unlockRecord: RewardReaderUnlockRecord | null,
): InspectRewardReaderStudyExchangeReplayResult | null {
	if (
		studyRecord.balanceBefore !== calculation.balanceBefore ||
		studyRecord.balanceAfter !== calculation.balanceAfter ||
		studyRecord.unlockedChapterCount !== calculation.unlockedChapterCount ||
		calculation.unlockedThroughChapterIndexBefore !==
			unlockHistory.unlockedThroughChapterIndexBefore ||
		calculation.unlockedThroughChapterIndexAfter !==
			unlockHistory.targetUnlockedThroughChapterIndexAfter ||
		calculation.totalStudyMinutesBefore !== studyHistory.totalStudyMinutesBefore ||
		calculation.dailyUnlockedChapterCountBefore !==
			studyHistory.dailyUnlockedChapterCountBefore
	) {
		return createFailure('replay-outcome-conflict');
	}

	if (calculation.unlockedChapterCount === 0) {
		if (unlockRecord !== null) {
			return createFailure('replay-outcome-conflict');
		}

		return null;
	}

	if (
		unlockRecord === null ||
		unlockRecord.unlockedChapterIndexes.length !==
			calculation.unlockedChapterIndexes.length ||
		!matchesNumberArray(
			unlockRecord.unlockedChapterIndexes,
			calculation.unlockedChapterIndexes,
		)
	) {
		return createFailure('replay-outcome-conflict');
	}

	return null;
}

function validateCurrentProgressConsistency(
	store: RewardReaderStore,
	request: RewardReaderStudyExchangeReplayRequestSnapshot,
	studyHistory: RewardReaderTargetStudyHistory,
	unlockHistory: RewardReaderTargetUnlockHistory,
): RewardReaderNovelProgress | InspectRewardReaderStudyExchangeReplayResult {
	if (
		!Object.prototype.hasOwnProperty.call(store.progressByNovelId, request.novelId)
	) {
		return createFailure('replay-history-conflict');
	}

	const progress = store.progressByNovelId[request.novelId];
	if (
		!progress ||
		progress.novelId !== request.novelId ||
		progress.totalStudyMinutes !== studyHistory.allStudyMinutesTotal ||
		progress.studyMinuteBalance !== studyHistory.finalStudyBalance ||
		progress.unlockedThroughChapterIndex !==
			unlockHistory.finalUnlockedThroughChapterIndex ||
		progress.todayUnlockDate !== studyHistory.latestStudyUtcDate ||
		progress.todayUnlockedChapters !==
			studyHistory.latestStudyDateUnlockedCount ||
		!isCanonicalUtcIsoTimestamp(progress.updatedAt) ||
		Date.parse(progress.updatedAt) <
			Date.parse(studyHistory.latestStudyTimestamp)
	) {
		return createFailure('replay-history-conflict');
	}

	return progress;
}

function inspectRewardReaderStudyExchangeReplayInternal(
	input: InspectRewardReaderStudyExchangeReplayInput,
): InspectRewardReaderStudyExchangeReplayResult {
	const snapshot = snapshotReplayInspectionInput(input);
	if (isFailureResult(snapshot)) {
		return snapshot;
	}

	const store = validateCanonicalStore(snapshot.store);
	if (isFailureResult(store)) {
		return store;
	}

	const scan = scanHistoryNamespace(store, snapshot.request);
	const requestedIdentityValidation = validateRequestedIdentityObservation(
		snapshot.request,
		scan,
	);
	if (requestedIdentityValidation) {
		return requestedIdentityValidation;
	}

	const classifiedObservation = classifyReplayObservation(snapshot.request, scan);
	if ('status' in classifiedObservation) {
		return classifiedObservation;
	}
	if (!('studyRecord' in classifiedObservation)) {
		return classifiedObservation;
	}

	if (countMatchingNovels(store, snapshot.request.novelId) !== 1) {
		return createFailure('replay-history-conflict');
	}

	const linkageValidation = validateCompleteStudyUnlockLinkage(store, scan);
	if (linkageValidation) {
		return linkageValidation;
	}

	const studyHistory = reconstructTargetStudyHistory(store, snapshot.request);
	if (!('targetStudyArrayIndex' in studyHistory)) {
		return studyHistory;
	}

	const unlockHistory = reconstructTargetUnlockHistory(
		store,
		scan,
		snapshot.request,
		snapshot.chapterCount,
		studyHistory.targetStudyArrayIndex,
		classifiedObservation.studyRecord,
		classifiedObservation.unlockRecord,
	);
	if (!('unlockedThroughChapterIndexBefore' in unlockHistory)) {
		return unlockHistory;
	}

	const syntheticProgress = createSyntheticProgress(
		snapshot.request,
		studyHistory,
		unlockHistory,
		classifiedObservation.studyRecord,
	);
	if (!('updatedAt' in syntheticProgress)) {
		return syntheticProgress;
	}

	const calculationResult = calculateRewardReaderStudyExchange({
		progress: syntheticProgress,
		chapterCount: snapshot.chapterCount,
		studyMinutes: snapshot.request.studyMinutes,
		occurredAt: snapshot.request.occurredAt,
		policy: snapshot.request.policy,
	});
	if (!calculationResult.ok) {
		return createFailure('replay-outcome-conflict');
	}

	const outcomeValidation = validateCalculationAgainstPersistedOutcome(
		calculationResult.calculation,
		studyHistory,
		unlockHistory,
		classifiedObservation.studyRecord,
		classifiedObservation.unlockRecord,
	);
	if (outcomeValidation) {
		return outcomeValidation;
	}

	const progress = validateCurrentProgressConsistency(
		store,
		snapshot.request,
		studyHistory,
		unlockHistory,
	);
	if (!('novelId' in progress)) {
		return progress;
	}

	return {
		ok: true,
		status: 'replay-confirmed',
		calculation: calculationResult.calculation,
		progress,
		studyRecord: classifiedObservation.studyRecord,
		unlockRecord: classifiedObservation.unlockRecord,
	};
}

export function inspectRewardReaderStudyExchangeReplay(
	input: InspectRewardReaderStudyExchangeReplayInput,
): InspectRewardReaderStudyExchangeReplayResult {
	try {
		return inspectRewardReaderStudyExchangeReplayInternal(input);
	} catch {
		return createFailure('replay-inspection-runtime-failed');
	}
}
