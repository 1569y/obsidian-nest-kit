import { normalizePath, TFile, type Vault } from 'obsidian';
import {
	buildRewardReaderChapterIndexCache,
	type BuildRewardReaderChapterIndexCacheInput,
} from './chapter-cache-builder';
import { isSafeRewardReaderId, isValidVaultRelativePath } from './store';
import type {
	RewardReaderChapterIndexCache,
	RewardReaderSourceKind,
} from './types';

export interface InspectRewardReaderVaultSourceInput {
	novelId: string;
	sourcePath: string;
	generatedAt: string;
}

export type RewardReaderVaultSourceErrorCode =
	| 'invalid-novel-id'
	| 'invalid-source-path'
	| 'invalid-generated-at'
	| 'source-not-found'
	| 'source-not-file'
	| 'unsupported-source-type'
	| 'source-read-failed'
	| 'no-chapters-detected'
	| 'chapter-index-build-failed';

export interface RewardReaderVaultSourceInspectionSuccess {
	ok: true;
	sourcePath: string;
	sourceKind: RewardReaderSourceKind;
	sourceMtime: number;
	sourceSize: number;
	sourceTextLength: number;
	chapterCount: number;
	ignoredPrefixLength: number;
	cache: RewardReaderChapterIndexCache;
	warnings: string[];
}

export interface RewardReaderVaultSourceInspectionFailure {
	ok: false;
	code: RewardReaderVaultSourceErrorCode;
	message: string;
	warnings: string[];
}

export type RewardReaderVaultSourceInspectionResult =
	| RewardReaderVaultSourceInspectionSuccess
	| RewardReaderVaultSourceInspectionFailure;

function isValidIsoDateTimeString(value: unknown): value is string {
	return (
		typeof value === 'string' &&
		value.trim().length > 0 &&
		/^\d{4}-\d{2}-\d{2}T/.test(value) &&
		!Number.isNaN(Date.parse(value))
	);
}

function getSourceReadFailureMessage(): string {
	return 'Reward Reader could not read the selected Vault source file.';
}

function detectRewardReaderSourceKind(
	normalizedSourcePath: string,
): RewardReaderSourceKind | null {
	if (/\.txt$/iu.test(normalizedSourcePath)) {
		return 'vault-txt';
	}

	if (/\.md$/iu.test(normalizedSourcePath)) {
		return 'vault-markdown';
	}

	return null;
}

function normalizeRewardReaderInspectionPath(
	sourcePath: string,
): string | null {
	const trimmedSourcePath = sourcePath.trim();
	if (trimmedSourcePath.length === 0) {
		return null;
	}

	if (trimmedSourcePath.includes('\0')) {
		return null;
	}

	if (
		trimmedSourcePath.startsWith('/') ||
		trimmedSourcePath.startsWith('\\') ||
		trimmedSourcePath.startsWith('./') ||
		trimmedSourcePath.startsWith('.\\') ||
		trimmedSourcePath.startsWith('../') ||
		trimmedSourcePath.startsWith('..\\')
	) {
		return null;
	}

	if (/^[A-Za-z]:[\\/]/u.test(trimmedSourcePath)) {
		return null;
	}

	if (/^[A-Za-z][A-Za-z0-9+.-]*:/u.test(trimmedSourcePath)) {
		return null;
	}

	const normalizedSourcePath = normalizePath(trimmedSourcePath);
	return isValidVaultRelativePath(normalizedSourcePath)
		? normalizedSourcePath
		: null;
}

function createFailureResult(
	code: RewardReaderVaultSourceErrorCode,
	message: string,
	warnings: string[] = [],
): RewardReaderVaultSourceInspectionFailure {
	return {
		ok: false,
		code,
		message,
		warnings,
	};
}

export async function inspectRewardReaderVaultSource(
	vault: Vault,
	input: InspectRewardReaderVaultSourceInput,
): Promise<RewardReaderVaultSourceInspectionResult> {
	if (!isSafeRewardReaderId(input.novelId)) {
		return createFailureResult(
			'invalid-novel-id',
			'Reward Reader rejected the requested novel id.',
		);
	}

	const normalizedSourcePath = normalizeRewardReaderInspectionPath(input.sourcePath);
	if (!normalizedSourcePath) {
		return createFailureResult(
			'invalid-source-path',
			'Reward Reader rejected the requested Vault source path.',
		);
	}

	if (!isValidIsoDateTimeString(input.generatedAt)) {
		return createFailureResult(
			'invalid-generated-at',
			'Reward Reader rejected the requested generatedAt timestamp.',
		);
	}

	const sourceKind = detectRewardReaderSourceKind(normalizedSourcePath);
	if (!sourceKind) {
		return createFailureResult(
			'unsupported-source-type',
			'Reward Reader currently supports only Vault TXT and Markdown source files.',
		);
	}

	const abstractFile = vault.getAbstractFileByPath(normalizedSourcePath);
	if (!abstractFile) {
		return createFailureResult(
			'source-not-found',
			'Reward Reader could not find the requested Vault source file.',
		);
	}

	if (!(abstractFile instanceof TFile)) {
		return createFailureResult(
			'source-not-file',
			'Reward Reader source path must point to a Vault file.',
		);
	}

	let sourceText: string;
	try {
		sourceText = await vault.read(abstractFile);
	} catch {
		return createFailureResult(
			'source-read-failed',
			getSourceReadFailureMessage(),
		);
	}

	const buildInput: BuildRewardReaderChapterIndexCacheInput = {
		novelId: input.novelId,
		sourcePath: normalizedSourcePath,
		sourceMtime: abstractFile.stat.mtime,
		sourceSize: abstractFile.stat.size,
		sourceText,
		generatedAt: input.generatedAt,
	};
	const buildResult = buildRewardReaderChapterIndexCache(buildInput);

	if (!buildResult.cache || !buildResult.parseResult) {
		if (
			buildResult.parseResult &&
			buildResult.parseResult.chapters.length === 0
		) {
			return createFailureResult(
				'no-chapters-detected',
				'Reward Reader could not detect any supported chapter headings in the selected source file.',
				buildResult.warnings,
			);
		}

		return createFailureResult(
			'chapter-index-build-failed',
			'Reward Reader could not assemble a chapter index for the selected source file.',
			buildResult.warnings,
		);
	}

	return {
		ok: true,
		sourcePath: normalizedSourcePath,
		sourceKind,
		sourceMtime: abstractFile.stat.mtime,
		sourceSize: abstractFile.stat.size,
		sourceTextLength: buildResult.cache.sourceTextLength,
		chapterCount: buildResult.cache.chapters.length,
		ignoredPrefixLength: buildResult.parseResult.ignoredPrefixLength,
		cache: buildResult.cache,
		warnings: buildResult.warnings,
	};
}
