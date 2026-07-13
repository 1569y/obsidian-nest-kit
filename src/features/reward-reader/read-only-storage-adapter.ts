import type { DataAdapter } from 'obsidian';
import {
	createDefaultRewardReaderStore,
	getRewardReaderChapterIndexCachePath,
	isSafeRewardReaderId,
	normalizeRewardReaderChapterIndexCache,
	normalizeRewardReaderStore,
	REWARD_READER_STORE_PATH,
} from './store';
import type {
	RewardReaderChapterIndexCache,
	RewardReaderStore,
} from './types';

export type RewardReaderStateReadErrorCode =
	| 'state-read-failed'
	| 'state-invalid-json'
	| 'state-invalid-data'
	| 'state-unsupported-version';

export type RewardReaderStateReadStatus =
	| 'missing'
	| 'ready'
	| 'normalized';

export interface ReadRewardReaderStateStoreSuccess {
	ok: true;
	status: RewardReaderStateReadStatus;
	store: RewardReaderStore;
	shouldPersist: boolean;
	warnings: string[];
}

export interface ReadRewardReaderStateStoreFailure {
	ok: false;
	code: RewardReaderStateReadErrorCode;
	message: string;
	warnings: string[];
}

export type ReadRewardReaderStateStoreResult =
	| ReadRewardReaderStateStoreSuccess
	| ReadRewardReaderStateStoreFailure;

export type RewardReaderChapterCacheReadErrorCode =
	| 'invalid-novel-id'
	| 'chapter-cache-read-failed'
	| 'chapter-cache-invalid-json'
	| 'chapter-cache-invalid-data'
	| 'chapter-cache-unsupported-version';

export type RewardReaderChapterCacheReadStatus =
	| 'missing'
	| 'ready'
	| 'normalized';

export interface ReadRewardReaderChapterIndexCacheSuccess {
	ok: true;
	status: RewardReaderChapterCacheReadStatus;
	cache: RewardReaderChapterIndexCache | null;
	shouldPersist: boolean;
	warnings: string[];
}

export interface ReadRewardReaderChapterIndexCacheFailure {
	ok: false;
	code: RewardReaderChapterCacheReadErrorCode;
	message: string;
	warnings: string[];
}

export type ReadRewardReaderChapterIndexCacheResult =
	| ReadRewardReaderChapterIndexCacheSuccess
	| ReadRewardReaderChapterIndexCacheFailure;

type RewardReaderRecord = Record<string, unknown>;

const STATE_READ_FAILED_MESSAGE =
	'Reward Reader could not read its state file.';
const STATE_INVALID_JSON_MESSAGE =
	'Reward Reader state contains invalid JSON.';
const STATE_INVALID_ROOT_MESSAGE =
	'Reward Reader state has an invalid root structure.';
const STATE_UNSUPPORTED_VERSION_MESSAGE =
	'Reward Reader state was created by a newer unsupported schema version.';

const INVALID_NOVEL_ID_MESSAGE =
	'Reward Reader requires a valid novel id to read a chapter cache.';
const CHAPTER_CACHE_READ_FAILED_MESSAGE =
	'Reward Reader could not read the requested chapter cache.';
const CHAPTER_CACHE_INVALID_JSON_MESSAGE =
	'Reward Reader chapter cache contains invalid JSON.';
const CHAPTER_CACHE_INVALID_ROOT_MESSAGE =
	'Reward Reader chapter cache has an invalid root structure.';
const CHAPTER_CACHE_INVALID_DATA_MESSAGE =
	'Reward Reader chapter cache is invalid and must not be used.';
const CHAPTER_CACHE_UNSUPPORTED_VERSION_MESSAGE =
	'Reward Reader chapter cache was created by a newer unsupported schema version.';
const CHAPTER_CACHE_NOVEL_MISMATCH_MESSAGE =
	'Reward Reader chapter cache does not match the requested novel.';

function isPlainObject(value: unknown): value is RewardReaderRecord {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function copyWarnings(warnings: string[]): string[] {
	const copiedWarnings: string[] = [];
	const seenWarnings = new Set<string>();

	for (const warning of warnings) {
		if (seenWarnings.has(warning)) {
			continue;
		}

		seenWarnings.add(warning);
		copiedWarnings.push(warning);
	}

	return copiedWarnings;
}

function parseJson(text: string): { ok: true; value: unknown } | { ok: false } {
	try {
		return {
			ok: true,
			value: JSON.parse(text) as unknown,
		};
	} catch {
		return {
			ok: false,
		};
	}
}

export async function readRewardReaderStateStore(
	adapter: DataAdapter,
): Promise<ReadRewardReaderStateStoreResult> {
	let exists: boolean;
	try {
		exists = await adapter.exists(REWARD_READER_STORE_PATH);
	} catch {
		return {
			ok: false,
			code: 'state-read-failed',
			message: STATE_READ_FAILED_MESSAGE,
			warnings: [],
		};
	}

	if (!exists) {
		return {
			ok: true,
			status: 'missing',
			store: createDefaultRewardReaderStore(),
			shouldPersist: false,
			warnings: [],
		};
	}

	let text: string;
	try {
		text = await adapter.read(REWARD_READER_STORE_PATH);
	} catch {
		return {
			ok: false,
			code: 'state-read-failed',
			message: STATE_READ_FAILED_MESSAGE,
			warnings: [],
		};
	}

	const parsed = parseJson(text);
	if (!parsed.ok) {
		return {
			ok: false,
			code: 'state-invalid-json',
			message: STATE_INVALID_JSON_MESSAGE,
			warnings: [],
		};
	}

	if (!isPlainObject(parsed.value)) {
		return {
			ok: false,
			code: 'state-invalid-data',
			message: STATE_INVALID_ROOT_MESSAGE,
			warnings: [],
		};
	}

	const normalization = normalizeRewardReaderStore(parsed.value);
	const warnings = copyWarnings(normalization.warnings);
	if (normalization.hasUnsupportedFutureVersion) {
		return {
			ok: false,
			code: 'state-unsupported-version',
			message: STATE_UNSUPPORTED_VERSION_MESSAGE,
			warnings,
		};
	}

	if (normalization.didNormalize && !normalization.shouldPersist) {
		return {
			ok: false,
			code: 'state-invalid-data',
			message: STATE_INVALID_ROOT_MESSAGE,
			warnings,
		};
	}

	return {
		ok: true,
		status: normalization.didNormalize ? 'normalized' : 'ready',
		store: normalization.store,
		shouldPersist: normalization.shouldPersist,
		warnings,
	};
}

export async function readRewardReaderChapterIndexCache(
	adapter: DataAdapter,
	novelId: string,
): Promise<ReadRewardReaderChapterIndexCacheResult> {
	if (!isSafeRewardReaderId(novelId)) {
		return {
			ok: false,
			code: 'invalid-novel-id',
			message: INVALID_NOVEL_ID_MESSAGE,
			warnings: [],
		};
	}

	const cachePath = getRewardReaderChapterIndexCachePath(novelId);
	let exists: boolean;
	try {
		exists = await adapter.exists(cachePath);
	} catch {
		return {
			ok: false,
			code: 'chapter-cache-read-failed',
			message: CHAPTER_CACHE_READ_FAILED_MESSAGE,
			warnings: [],
		};
	}

	if (!exists) {
		return {
			ok: true,
			status: 'missing',
			cache: null,
			shouldPersist: false,
			warnings: [],
		};
	}

	let text: string;
	try {
		text = await adapter.read(cachePath);
	} catch {
		return {
			ok: false,
			code: 'chapter-cache-read-failed',
			message: CHAPTER_CACHE_READ_FAILED_MESSAGE,
			warnings: [],
		};
	}

	const parsed = parseJson(text);
	if (!parsed.ok) {
		return {
			ok: false,
			code: 'chapter-cache-invalid-json',
			message: CHAPTER_CACHE_INVALID_JSON_MESSAGE,
			warnings: [],
		};
	}

	if (!isPlainObject(parsed.value)) {
		return {
			ok: false,
			code: 'chapter-cache-invalid-data',
			message: CHAPTER_CACHE_INVALID_ROOT_MESSAGE,
			warnings: [],
		};
	}

	const normalization = normalizeRewardReaderChapterIndexCache(parsed.value);
	const warnings = copyWarnings(normalization.warnings);
	if (normalization.hasUnsupportedFutureVersion) {
		return {
			ok: false,
			code: 'chapter-cache-unsupported-version',
			message: CHAPTER_CACHE_UNSUPPORTED_VERSION_MESSAGE,
			warnings,
		};
	}

	if (!normalization.cache) {
		return {
			ok: false,
			code: 'chapter-cache-invalid-data',
			message: CHAPTER_CACHE_INVALID_DATA_MESSAGE,
			warnings,
		};
	}

	if (normalization.cache.novelId !== novelId) {
		return {
			ok: false,
			code: 'chapter-cache-invalid-data',
			message: CHAPTER_CACHE_NOVEL_MISMATCH_MESSAGE,
			warnings,
		};
	}

	return {
		ok: true,
		status: normalization.didNormalize ? 'normalized' : 'ready',
		cache: normalization.cache,
		shouldPersist: normalization.shouldPersist,
		warnings,
	};
}
