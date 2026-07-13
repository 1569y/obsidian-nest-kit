import type { DataAdapter } from 'obsidian';
import type { PrepareRewardReaderImportSuccess } from './import-assembly';
import {
	readRewardReaderChapterIndexCache,
	type RewardReaderChapterCacheReadErrorCode,
	readRewardReaderStateStore,
	type RewardReaderStateReadErrorCode,
} from './read-only-storage-adapter';
import {
	applyPreparedRewardReaderImport,
	type RewardReaderStorePatchErrorCode,
} from './store-patch-application';
import type {
	RewardReaderChapterIndexCache,
	RewardReaderStore,
} from './types';
import {
	writeRewardReaderChapterIndexCache,
	type RewardReaderChapterCacheWriteErrorCode,
	writeRewardReaderStateStore,
	type RewardReaderStateWriteErrorCode,
} from './write-only-storage-adapter';

export type RewardReaderImportCachePersistenceStatus =
	| 'not-checked'
	| 'reused'
	| 'written'
	| 'write-outcome-unknown';

export type RewardReaderImportStatePersistenceStatus =
	| 'not-attempted'
	| 'written'
	| 'write-outcome-unknown';

export type RewardReaderImportPersistenceErrorCode =
	| 'state-read-blocked'
	| 'store-application-blocked'
	| 'chapter-cache-read-blocked'
	| 'chapter-cache-conflict'
	| 'chapter-cache-write-blocked'
	| 'state-write-blocked';

export type RewardReaderImportPersistenceStage =
	| 'state-read'
	| 'store-application'
	| 'chapter-cache-read'
	| 'chapter-cache-write'
	| 'state-write';

export interface PersistPreparedRewardReaderImportSuccess {
	ok: true;
	status: 'persisted';
	store: RewardReaderStore;
	cache: RewardReaderChapterIndexCache;
	cachePersistence: 'reused' | 'written';
	statePersistence: 'written';
	warnings: string[];
}

type RewardReaderImportPersistenceCauseCode =
	| RewardReaderStateReadErrorCode
	| RewardReaderStorePatchErrorCode
	| RewardReaderChapterCacheReadErrorCode
	| RewardReaderChapterCacheWriteErrorCode
	| RewardReaderStateWriteErrorCode
	| null;

export interface PersistPreparedRewardReaderImportFailure {
	ok: false;
	code: RewardReaderImportPersistenceErrorCode;
	stage: RewardReaderImportPersistenceStage;
	causeCode: RewardReaderImportPersistenceCauseCode;
	message: string;
	cachePersistence: RewardReaderImportCachePersistenceStatus;
	statePersistence: RewardReaderImportStatePersistenceStatus;
	warnings: string[];
}

export type PersistPreparedRewardReaderImportResult =
	| PersistPreparedRewardReaderImportSuccess
	| PersistPreparedRewardReaderImportFailure;

type RewardReaderRecord = Record<string, unknown>;

const STATE_READ_BLOCKED_MESSAGE =
	'Reward Reader could not establish a safe state baseline for this import.';
const STORE_APPLICATION_BLOCKED_MESSAGE =
	'Reward Reader could not apply this prepared import to the current state.';
const CHAPTER_CACHE_READ_BLOCKED_MESSAGE =
	'Reward Reader could not safely inspect the target chapter cache.';
const CHAPTER_CACHE_CONFLICT_MESSAGE =
	'A different chapter cache already exists for this novel id.';
const CHAPTER_CACHE_WRITE_BLOCKED_MESSAGE =
	'Reward Reader could not confirm the chapter cache write, so the state was not written.';
const STATE_WRITE_BLOCKED_MESSAGE =
	'Reward Reader prepared the chapter cache but could not confirm the state write.';

function isPlainObject(value: unknown): value is RewardReaderRecord {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function areJsonLikeValuesEqual(left: unknown, right: unknown): boolean {
	if (Object.is(left, right)) {
		return true;
	}

	if (Array.isArray(left) || Array.isArray(right)) {
		if (!Array.isArray(left) || !Array.isArray(right)) {
			return false;
		}

		return (
			left.length === right.length &&
			left.every((entry, index) => areJsonLikeValuesEqual(entry, right[index]))
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
			!areJsonLikeValuesEqual(left[key], right[key])
		) {
			return false;
		}
	}

	return true;
}

function mergeWarnings(...warningGroups: string[][]): string[] {
	const warnings: string[] = [];
	const seenWarnings = new Set<string>();

	for (const group of warningGroups) {
		for (const warning of group) {
			if (seenWarnings.has(warning)) {
				continue;
			}

			seenWarnings.add(warning);
			warnings.push(warning);
		}
	}

	return warnings;
}

function createFailure(
	code: RewardReaderImportPersistenceErrorCode,
	stage: RewardReaderImportPersistenceStage,
	causeCode: RewardReaderImportPersistenceCauseCode,
	message: string,
	cachePersistence: RewardReaderImportCachePersistenceStatus,
	statePersistence: RewardReaderImportStatePersistenceStatus,
	warnings: string[],
): PersistPreparedRewardReaderImportFailure {
	return {
		ok: false,
		code,
		stage,
		causeCode,
		message,
		cachePersistence,
		statePersistence,
		warnings,
	};
}

export async function persistPreparedRewardReaderImport(
	adapter: DataAdapter,
	preparedImport: PrepareRewardReaderImportSuccess,
): Promise<PersistPreparedRewardReaderImportResult> {
	const stateRead = await readRewardReaderStateStore(adapter);
	if (!stateRead.ok) {
		return createFailure(
			'state-read-blocked',
			'state-read',
			stateRead.code,
			STATE_READ_BLOCKED_MESSAGE,
			'not-checked',
			'not-attempted',
			mergeWarnings(stateRead.warnings),
		);
	}

	const application = applyPreparedRewardReaderImport({
		existingStore: stateRead.store,
		preparedImport,
	});
	if (!application.ok) {
		return createFailure(
			'store-application-blocked',
			'store-application',
			application.code,
			STORE_APPLICATION_BLOCKED_MESSAGE,
			'not-checked',
			'not-attempted',
			mergeWarnings(stateRead.warnings, application.warnings),
		);
	}

	const cacheRead = await readRewardReaderChapterIndexCache(
		adapter,
		application.cache.novelId,
	);
	if (!cacheRead.ok) {
		return createFailure(
			'chapter-cache-read-blocked',
			'chapter-cache-read',
			cacheRead.code,
			CHAPTER_CACHE_READ_BLOCKED_MESSAGE,
			'not-checked',
			'not-attempted',
			mergeWarnings(
				stateRead.warnings,
				application.warnings,
				cacheRead.warnings,
			),
		);
	}

	let cachePersistence: 'reused' | 'written';
	let successfulCacheWriteWarnings: string[] = [];
	if (cacheRead.status === 'missing') {
		if (cacheRead.cache !== null) {
			return createFailure(
				'chapter-cache-read-blocked',
				'chapter-cache-read',
				null,
				CHAPTER_CACHE_READ_BLOCKED_MESSAGE,
				'not-checked',
				'not-attempted',
				mergeWarnings(
					stateRead.warnings,
					application.warnings,
					cacheRead.warnings,
				),
			);
		}

		const cacheWrite = await writeRewardReaderChapterIndexCache(
			adapter,
			application.cache,
		);
		if (!cacheWrite.ok) {
			return createFailure(
				'chapter-cache-write-blocked',
				'chapter-cache-write',
				cacheWrite.code,
				CHAPTER_CACHE_WRITE_BLOCKED_MESSAGE,
				'write-outcome-unknown',
				'not-attempted',
				mergeWarnings(
					stateRead.warnings,
					application.warnings,
					cacheRead.warnings,
					cacheWrite.warnings,
				),
			);
		}

		cachePersistence = 'written';
		successfulCacheWriteWarnings = cacheWrite.warnings;
	} else {
		if (cacheRead.cache === null) {
			return createFailure(
				'chapter-cache-read-blocked',
				'chapter-cache-read',
				null,
				CHAPTER_CACHE_READ_BLOCKED_MESSAGE,
				'not-checked',
				'not-attempted',
				mergeWarnings(
					stateRead.warnings,
					application.warnings,
					cacheRead.warnings,
				),
			);
		}

		if (!areJsonLikeValuesEqual(cacheRead.cache, application.cache)) {
			return createFailure(
				'chapter-cache-conflict',
				'chapter-cache-read',
				null,
				CHAPTER_CACHE_CONFLICT_MESSAGE,
				'not-checked',
				'not-attempted',
				mergeWarnings(
					stateRead.warnings,
					application.warnings,
					cacheRead.warnings,
				),
			);
		}

		if (cacheRead.status === 'ready') {
			cachePersistence = 'reused';
		} else {
			const cacheWrite = await writeRewardReaderChapterIndexCache(
				adapter,
				application.cache,
			);
			if (!cacheWrite.ok) {
				return createFailure(
					'chapter-cache-write-blocked',
					'chapter-cache-write',
					cacheWrite.code,
					CHAPTER_CACHE_WRITE_BLOCKED_MESSAGE,
					'write-outcome-unknown',
					'not-attempted',
					mergeWarnings(
						stateRead.warnings,
						application.warnings,
						cacheRead.warnings,
						cacheWrite.warnings,
					),
				);
			}

			cachePersistence = 'written';
			successfulCacheWriteWarnings = cacheWrite.warnings;
		}
	}

	const stateWrite = await writeRewardReaderStateStore(
		adapter,
		application.nextStore,
	);
	if (!stateWrite.ok) {
		return createFailure(
			'state-write-blocked',
			'state-write',
			stateWrite.code,
			STATE_WRITE_BLOCKED_MESSAGE,
			cachePersistence,
			'write-outcome-unknown',
			mergeWarnings(
				stateRead.warnings,
				application.warnings,
				cacheRead.warnings,
				successfulCacheWriteWarnings,
				stateWrite.warnings,
			),
		);
	}

	return {
		ok: true,
		status: 'persisted',
		store: application.nextStore,
		cache: application.cache,
		cachePersistence,
		statePersistence: 'written',
		warnings: mergeWarnings(
			stateRead.warnings,
			application.warnings,
			cacheRead.warnings,
			successfulCacheWriteWarnings,
			stateWrite.warnings,
		),
	};
}
