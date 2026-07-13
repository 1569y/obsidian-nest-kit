import type { DataAdapter } from 'obsidian';
import {
	getRewardReaderChapterIndexCachePath,
	isSafeRewardReaderId,
	normalizeRewardReaderChapterIndexCache,
	normalizeRewardReaderStore,
	REWARD_READER_STORE_PATH,
} from './store';
import {
	REWARD_READER_CHAPTER_INDEX_CACHE_SCHEMA_VERSION,
	REWARD_READER_STORE_SCHEMA_VERSION,
	type RewardReaderChapterIndexCache,
	type RewardReaderStore,
} from './types';

export type RewardReaderStateWriteErrorCode =
	| 'state-invalid-data'
	| 'state-unsupported-version'
	| 'state-serialization-failed'
	| 'state-directory-create-failed'
	| 'state-write-failed';

export interface WriteRewardReaderStateStoreSuccess {
	ok: true;
	status: 'written';
	warnings: string[];
}

export interface WriteRewardReaderStateStoreFailure {
	ok: false;
	code: RewardReaderStateWriteErrorCode;
	message: string;
	warnings: string[];
}

export type WriteRewardReaderStateStoreResult =
	| WriteRewardReaderStateStoreSuccess
	| WriteRewardReaderStateStoreFailure;

export type RewardReaderChapterCacheWriteErrorCode =
	| 'invalid-novel-id'
	| 'chapter-cache-invalid-data'
	| 'chapter-cache-unsupported-version'
	| 'chapter-cache-serialization-failed'
	| 'chapter-cache-directory-create-failed'
	| 'chapter-cache-write-failed';

export interface WriteRewardReaderChapterIndexCacheSuccess {
	ok: true;
	status: 'written';
	warnings: string[];
}

export interface WriteRewardReaderChapterIndexCacheFailure {
	ok: false;
	code: RewardReaderChapterCacheWriteErrorCode;
	message: string;
	warnings: string[];
}

export type WriteRewardReaderChapterIndexCacheResult =
	| WriteRewardReaderChapterIndexCacheSuccess
	| WriteRewardReaderChapterIndexCacheFailure;

type RewardReaderRecord = Record<string, unknown>;

const STATE_INVALID_DATA_MESSAGE =
	'Reward Reader cannot write an invalid state store.';
const STATE_UNSUPPORTED_VERSION_MESSAGE =
	'Reward Reader cannot overwrite state from a newer unsupported schema version.';
const STATE_SERIALIZATION_FAILED_MESSAGE =
	'Reward Reader could not serialize its state store.';
const STATE_DIRECTORY_CREATE_FAILED_MESSAGE =
	'Reward Reader could not prepare its state directory.';
const STATE_WRITE_FAILED_MESSAGE =
	'Reward Reader could not write its state file.';

const INVALID_NOVEL_ID_MESSAGE =
	'Reward Reader requires a valid novel id to write a chapter cache.';
const CHAPTER_CACHE_INVALID_DATA_MESSAGE =
	'Reward Reader cannot write an invalid chapter cache.';
const CHAPTER_CACHE_UNSUPPORTED_VERSION_MESSAGE =
	'Reward Reader cannot overwrite a chapter cache from a newer unsupported schema version.';
const CHAPTER_CACHE_SERIALIZATION_FAILED_MESSAGE =
	'Reward Reader could not serialize the chapter cache.';
const CHAPTER_CACHE_DIRECTORY_CREATE_FAILED_MESSAGE =
	'Reward Reader could not prepare the chapter cache directory.';
const CHAPTER_CACHE_WRITE_FAILED_MESSAGE =
	'Reward Reader could not write the chapter cache.';

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

function getParentDirectoryPaths(targetPath: string): string[] {
	const segments = targetPath.split('/');
	const directories: string[] = [];
	const seenDirectories = new Set<string>();
	let currentPath = '';

	for (let index = 0; index < segments.length - 1; index += 1) {
		const segment = segments[index];
		if (!segment) {
			continue;
		}

		currentPath =
			currentPath.length > 0 ? `${currentPath}/${segment}` : segment;
		if (seenDirectories.has(currentPath)) {
			continue;
		}

		seenDirectories.add(currentPath);
		directories.push(currentPath);
	}

	return directories;
}

async function ensureParentDirectories(
	adapter: DataAdapter,
	targetPath: string,
): Promise<boolean> {
	for (const directoryPath of getParentDirectoryPaths(targetPath)) {
		if (await adapter.exists(directoryPath)) {
			continue;
		}

		await adapter.mkdir(directoryPath);
	}

	return true;
}

function serializeJson(value: unknown): string | null {
	try {
		const serialized = JSON.stringify(value, null, 2);
		return typeof serialized === 'string' ? `${serialized}\n` : null;
	} catch {
		return null;
	}
}

export async function writeRewardReaderStateStore(
	adapter: DataAdapter,
	store: RewardReaderStore,
): Promise<WriteRewardReaderStateStoreResult> {
	if (!isPlainObject(store)) {
		return {
			ok: false,
			code: 'state-invalid-data',
			message: STATE_INVALID_DATA_MESSAGE,
			warnings: [],
		};
	}

	const schemaVersion = store.schemaVersion;
	if (
		typeof schemaVersion === 'number' &&
		Number.isInteger(schemaVersion) &&
		schemaVersion > REWARD_READER_STORE_SCHEMA_VERSION
	) {
		return {
			ok: false,
			code: 'state-unsupported-version',
			message: STATE_UNSUPPORTED_VERSION_MESSAGE,
			warnings: [],
		};
	}

	if (schemaVersion !== REWARD_READER_STORE_SCHEMA_VERSION) {
		return {
			ok: false,
			code: 'state-invalid-data',
			message: STATE_INVALID_DATA_MESSAGE,
			warnings: [],
		};
	}

	const normalization = normalizeRewardReaderStore(store);
	const warnings = copyWarnings(normalization.warnings);
	if (normalization.hasUnsupportedFutureVersion) {
		return {
			ok: false,
			code: 'state-unsupported-version',
			message: STATE_UNSUPPORTED_VERSION_MESSAGE,
			warnings,
		};
	}

	if (
		normalization.didNormalize ||
		normalization.shouldPersist ||
		!isCanonicalValue(store, normalization.store)
	) {
		return {
			ok: false,
			code: 'state-invalid-data',
			message: STATE_INVALID_DATA_MESSAGE,
			warnings,
		};
	}

	const serializedState = serializeJson(normalization.store);
	if (!serializedState) {
		return {
			ok: false,
			code: 'state-serialization-failed',
			message: STATE_SERIALIZATION_FAILED_MESSAGE,
			warnings,
		};
	}

	try {
		await ensureParentDirectories(adapter, REWARD_READER_STORE_PATH);
	} catch {
		return {
			ok: false,
			code: 'state-directory-create-failed',
			message: STATE_DIRECTORY_CREATE_FAILED_MESSAGE,
			warnings,
		};
	}

	try {
		await adapter.write(REWARD_READER_STORE_PATH, serializedState);
	} catch {
		return {
			ok: false,
			code: 'state-write-failed',
			message: STATE_WRITE_FAILED_MESSAGE,
			warnings,
		};
	}

	return {
		ok: true,
		status: 'written',
		warnings,
	};
}

export async function writeRewardReaderChapterIndexCache(
	adapter: DataAdapter,
	cache: RewardReaderChapterIndexCache,
): Promise<WriteRewardReaderChapterIndexCacheResult> {
	if (!isPlainObject(cache)) {
		return {
			ok: false,
			code: 'chapter-cache-invalid-data',
			message: CHAPTER_CACHE_INVALID_DATA_MESSAGE,
			warnings: [],
		};
	}

	const novelId = cache.novelId;
	if (typeof novelId !== 'string' || !isSafeRewardReaderId(novelId)) {
		return {
			ok: false,
			code: 'invalid-novel-id',
			message: INVALID_NOVEL_ID_MESSAGE,
			warnings: [],
		};
	}

	const schemaVersion = cache.schemaVersion;
	if (
		typeof schemaVersion === 'number' &&
		Number.isInteger(schemaVersion) &&
		schemaVersion > REWARD_READER_CHAPTER_INDEX_CACHE_SCHEMA_VERSION
	) {
		return {
			ok: false,
			code: 'chapter-cache-unsupported-version',
			message: CHAPTER_CACHE_UNSUPPORTED_VERSION_MESSAGE,
			warnings: [],
		};
	}

	if (schemaVersion !== REWARD_READER_CHAPTER_INDEX_CACHE_SCHEMA_VERSION) {
		return {
			ok: false,
			code: 'chapter-cache-invalid-data',
			message: CHAPTER_CACHE_INVALID_DATA_MESSAGE,
			warnings: [],
		};
	}

	const normalization = normalizeRewardReaderChapterIndexCache(cache);
	const warnings = copyWarnings(normalization.warnings);
	if (normalization.hasUnsupportedFutureVersion) {
		return {
			ok: false,
			code: 'chapter-cache-unsupported-version',
			message: CHAPTER_CACHE_UNSUPPORTED_VERSION_MESSAGE,
			warnings,
		};
	}

	if (
		!normalization.cache ||
		normalization.didNormalize ||
		normalization.shouldPersist ||
		normalization.cache.chapters.length === 0 ||
		!isCanonicalValue(cache, normalization.cache)
	) {
		return {
			ok: false,
			code: 'chapter-cache-invalid-data',
			message: CHAPTER_CACHE_INVALID_DATA_MESSAGE,
			warnings,
		};
	}

	const cachePath = getRewardReaderChapterIndexCachePath(
		normalization.cache.novelId,
	);
	const serializedCache = serializeJson(normalization.cache);
	if (!serializedCache) {
		return {
			ok: false,
			code: 'chapter-cache-serialization-failed',
			message: CHAPTER_CACHE_SERIALIZATION_FAILED_MESSAGE,
			warnings,
		};
	}

	try {
		await ensureParentDirectories(adapter, cachePath);
	} catch {
		return {
			ok: false,
			code: 'chapter-cache-directory-create-failed',
			message: CHAPTER_CACHE_DIRECTORY_CREATE_FAILED_MESSAGE,
			warnings,
		};
	}

	try {
		await adapter.write(cachePath, serializedCache);
	} catch {
		return {
			ok: false,
			code: 'chapter-cache-write-failed',
			message: CHAPTER_CACHE_WRITE_FAILED_MESSAGE,
			warnings,
		};
	}

	return {
		ok: true,
		status: 'written',
		warnings,
	};
}
