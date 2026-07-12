import { parseRewardReaderChapters, type RewardReaderChapterParseResult } from './chapter-parser';
import {
	isSafeRewardReaderId,
	isValidVaultRelativePath,
	normalizeRewardReaderChapterIndexCache,
} from './store';
import {
	REWARD_READER_CHAPTER_INDEX_CACHE_SCHEMA_VERSION,
	type RewardReaderChapterIndexCache,
} from './types';

export interface BuildRewardReaderChapterIndexCacheInput {
	novelId: string;
	sourcePath: string;
	sourceMtime: number;
	sourceSize: number;
	sourceText: string;
	generatedAt: string;
}

export interface BuildRewardReaderChapterIndexCacheResult {
	cache: RewardReaderChapterIndexCache | null;
	parseResult: RewardReaderChapterParseResult | null;
	warnings: string[];
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

export function buildRewardReaderChapterIndexCache(
	input: BuildRewardReaderChapterIndexCacheInput,
): BuildRewardReaderChapterIndexCacheResult {
	const warnings: string[] = [];

	if (!isSafeRewardReaderId(input.novelId)) {
		warnings.push(
			'Reward Reader chapter cache builder rejected an invalid novel id.',
		);
		return {
			cache: null,
			parseResult: null,
			warnings,
		};
	}

	const normalizedSourcePath = input.sourcePath.trim();
	if (!isValidVaultRelativePath(normalizedSourcePath)) {
		warnings.push(
			'Reward Reader chapter cache builder rejected an invalid Vault-relative source path.',
		);
		return {
			cache: null,
			parseResult: null,
			warnings,
		};
	}

	if (!isFiniteNonNegativeInteger(input.sourceMtime)) {
		warnings.push(
			'Reward Reader chapter cache builder rejected an invalid source mtime.',
		);
		return {
			cache: null,
			parseResult: null,
			warnings,
		};
	}

	if (!isFiniteNonNegativeInteger(input.sourceSize)) {
		warnings.push(
			'Reward Reader chapter cache builder rejected an invalid source size.',
		);
		return {
			cache: null,
			parseResult: null,
			warnings,
		};
	}

	const normalizedGeneratedAt = input.generatedAt.trim();
	if (!isValidIsoDateTimeString(normalizedGeneratedAt)) {
		warnings.push(
			'Reward Reader chapter cache builder rejected an invalid generatedAt timestamp.',
		);
		return {
			cache: null,
			parseResult: null,
			warnings,
		};
	}

	const parseResult = parseRewardReaderChapters(input.sourceText);
	warnings.push(...parseResult.warnings);

	if (parseResult.chapters.length === 0) {
		warnings.push(
			'Reward Reader chapter cache builder did not create a cache because no chapters were detected.',
		);
		return {
			cache: null,
			parseResult,
			warnings,
		};
	}

	const rawCache: RewardReaderChapterIndexCache = {
		schemaVersion: REWARD_READER_CHAPTER_INDEX_CACHE_SCHEMA_VERSION,
		novelId: input.novelId,
		sourcePath: normalizedSourcePath,
		sourceMtime: input.sourceMtime,
		sourceSize: input.sourceSize,
		sourceTextLength: input.sourceText.length,
		generatedAt: normalizedGeneratedAt,
		chapters: parseResult.chapters,
	};
	const normalizedCacheResult = normalizeRewardReaderChapterIndexCache(rawCache);
	warnings.push(...normalizedCacheResult.warnings);

	return {
		cache: normalizedCacheResult.cache,
		parseResult,
		warnings,
	};
}
