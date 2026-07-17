import {
	normalizePath,
	TFile,
	TFolder,
	type Vault,
} from 'obsidian';
import {
	parseRewardReaderChapters,
	type RewardReaderChapterDetectionMode,
	type RewardReaderChapterParseBlockingIssue,
	type RewardReaderChapterParseStatus,
} from './chapter-parser';
import {
	decodeRewardReaderExternalText,
	type DecodeRewardReaderExternalTextFailure,
	type RewardReaderExternalTextEncoding,
} from './external-text-decoder';

export type RewardReaderExternalEncodingPreference =
	| 'auto'
	| 'utf-8'
	| 'gb18030'
	| 'utf-16le'
	| 'utf-16be';

export interface ReadRewardReaderExternalFileBytesSuccess {
	ok: true;
	fileName: string;
	bytes: Uint8Array;
}

export interface ReadRewardReaderExternalFileBytesFailure {
	ok: false;
	code:
		| 'invalid-external-file'
		| 'unsupported-extension'
		| 'external-file-read-failed';
	message: string;
}

export type ReadRewardReaderExternalFileBytesResult =
	| ReadRewardReaderExternalFileBytesSuccess
	| ReadRewardReaderExternalFileBytesFailure;

interface RewardReaderExternalPreviewBase {
	fileName: string;
	parseStatus: RewardReaderChapterParseStatus;
	detectedEncoding: RewardReaderExternalTextEncoding | null;
	hadBom: boolean;
	detectionMode: RewardReaderChapterDetectionMode;
	chapterCount: number;
	chapterTitlePreview: string[];
	warnings: string[];
	blockingIssues: RewardReaderChapterParseBlockingIssue[];
}

export interface InspectRewardReaderExternalSourceSuccess
	extends RewardReaderExternalPreviewBase {
	ok: true;
	normalizedText: string;
}

export interface InspectRewardReaderExternalSourceFailure
	extends RewardReaderExternalPreviewBase {
	ok: false;
	code:
		| 'unsupported-extension'
		| DecodeRewardReaderExternalTextFailure['code']
		| 'no-chapters-detected'
		| 'chapter-heading-ambiguity';
	message: string;
}

export type InspectRewardReaderExternalSourceResult =
	| InspectRewardReaderExternalSourceSuccess
	| InspectRewardReaderExternalSourceFailure;

export interface PrepareRewardReaderExternalSourceSuccess {
	ok: true;
	sourcePath: string;
	fileName: string;
	sourceMtime: number;
	sourceSize: number;
}

export interface PrepareRewardReaderExternalSourceFailure {
	ok: false;
	code:
		| 'invalid-external-source'
		| 'vault-folder-create-failed'
		| 'vault-path-conflict'
		| 'vault-write-failed'
		| 'vault-copy-metadata-unavailable';
	message: string;
}

export type PrepareRewardReaderExternalSourceResult =
	| PrepareRewardReaderExternalSourceSuccess
	| PrepareRewardReaderExternalSourceFailure;

const REWARD_READER_IMPORTED_FOLDER = 'Reward Reader/Imported';
const MAX_REWARD_READER_IMPORTED_NAME_ATTEMPTS = 1000;
const REWARD_READER_IMPORTED_FILE_NAME_PUNCTUATION_REGEX =
	/[<>:"/\\|?*]+/gu;
const REWARD_READER_EXTERNAL_SOURCE_FALLBACK_FILE_NAME = 'selected-file';

function createReadFailure(
	code: ReadRewardReaderExternalFileBytesFailure['code'],
	message: string,
): ReadRewardReaderExternalFileBytesFailure {
	return {
		ok: false,
		code,
		message,
	};
}

function createInspectFailure(
	fileName: string,
	code: InspectRewardReaderExternalSourceFailure['code'],
	message: string,
	base?: Partial<RewardReaderExternalPreviewBase>,
): InspectRewardReaderExternalSourceFailure {
	return {
		ok: false,
		fileName,
		code,
		message,
		detectedEncoding: base?.detectedEncoding ?? null,
		hadBom: base?.hadBom ?? false,
		parseStatus: base?.parseStatus ?? 'none',
		detectionMode: base?.detectionMode ?? 'none',
		chapterCount: base?.chapterCount ?? 0,
		chapterTitlePreview: base?.chapterTitlePreview ?? [],
		warnings: base?.warnings ?? [],
		blockingIssues: base?.blockingIssues ?? [],
	};
}

function createPrepareFailure(
	code: PrepareRewardReaderExternalSourceFailure['code'],
	message: string,
): PrepareRewardReaderExternalSourceFailure {
	return {
		ok: false,
		code,
		message,
	};
}

function getRewardReaderExternalSourceExtension(
	fileName: string,
): 'txt' | 'md' | null {
	const match = fileName.trim().match(/\.([A-Za-z0-9]+)$/u);
	if (!match) {
		return null;
	}

	const extension = match[1]?.toLocaleLowerCase();
	return extension === 'txt' || extension === 'md' ? extension : null;
}

function stripRewardReaderExternalSourceExtension(fileName: string): string {
	const extensionMatch = fileName.trim().match(/^(.*?)(?:\.[^.]+)?$/u);
	return extensionMatch?.[1]?.trim() ?? '';
}

function sanitizeRewardReaderImportedFileBaseName(fileName: string): string {
	const withoutControlCharacters = Array.from(
		stripRewardReaderExternalSourceExtension(fileName),
		(character) => {
			const codePoint = character.codePointAt(0) ?? 0;
			return codePoint < 32 ? ' ' : character;
		},
	).join('');
	const strippedBaseName = withoutControlCharacters
		.replace(REWARD_READER_IMPORTED_FILE_NAME_PUNCTUATION_REGEX, ' ')
		.replace(/[. ]+$/gu, '')
		.replace(/\s+/gu, ' ')
		.trim();
	return strippedBaseName.length > 0 ? strippedBaseName : 'imported-novel';
}

function mapEncodingPreferenceToDecoderEncoding(
	preference: RewardReaderExternalEncodingPreference,
): RewardReaderExternalTextEncoding | null {
	switch (preference) {
		case 'auto':
			return null;
		case 'utf-8':
		case 'gb18030':
		case 'utf-16le':
		case 'utf-16be':
			return preference;
	}
}

function confirmRewardReaderPreparedVaultCopyMetadata(
	vault: Vault,
	createdFile: TFile,
): PrepareRewardReaderExternalSourceResult {
	let actualFile: TFile | null = null;
	try {
		const lookedUpFile = vault.getAbstractFileByPath(createdFile.path);
		actualFile = lookedUpFile instanceof TFile ? lookedUpFile : null;
	} catch {
		return createPrepareFailure(
			'vault-copy-metadata-unavailable',
			'Reward Reader created the imported Markdown copy but could not confirm its Vault metadata.',
		);
	}

	if (!actualFile) {
		return createPrepareFailure(
			'vault-copy-metadata-unavailable',
			'Reward Reader created the imported Markdown copy but could not confirm its Vault metadata.',
		);
	}

	try {
		return {
			ok: true,
			sourcePath: actualFile.path,
			fileName: actualFile.name,
			sourceMtime: actualFile.stat.mtime,
			sourceSize: actualFile.stat.size,
		};
	} catch {
		return createPrepareFailure(
			'vault-copy-metadata-unavailable',
			'Reward Reader created the imported Markdown copy but could not confirm its Vault metadata.',
		);
	}
}

function summarizePreviewTitles(titles: string[]): string[] {
	return titles.slice(0, 5);
}

function getSafeRewardReaderExternalFileName(value: unknown): string {
	try {
		if (
			value &&
			typeof value === 'object' &&
			'fileName' in value &&
			typeof value.fileName === 'string' &&
			value.fileName.trim().length > 0
		) {
			return value.fileName;
		}
	} catch {
		// Ignore and fall back to a stable placeholder.
	}

	try {
		if (
			value instanceof File &&
			typeof value.name === 'string' &&
			value.name.trim().length > 0
		) {
			return value.name;
		}
	} catch {
		// Ignore and fall back to a stable placeholder.
	}

	return REWARD_READER_EXTERNAL_SOURCE_FALLBACK_FILE_NAME;
}

async function ensureRewardReaderImportedFolder(
	vault: Vault,
): Promise<TFolder | null> {
	const normalizedFolderPath = normalizePath(REWARD_READER_IMPORTED_FOLDER);
	const segments = normalizedFolderPath.split('/');
	let currentPath = '';

	for (const segment of segments) {
		currentPath = currentPath.length > 0 ? `${currentPath}/${segment}` : segment;
		const existing = vault.getAbstractFileByPath(currentPath);
		if (existing instanceof TFile) {
			return null;
		}

		if (!existing) {
			await vault.createFolder(currentPath);
		}
	}

	const folder = vault.getAbstractFileByPath(normalizedFolderPath);
	return folder instanceof TFolder ? folder : null;
}

function buildRewardReaderImportedFilePath(
	baseName: string,
	attempt: number,
): string {
	const suffix = attempt <= 1 ? '' : `-${attempt}`;
	return normalizePath(
		`${REWARD_READER_IMPORTED_FOLDER}/${baseName}${suffix}.md`,
	);
}

async function readRewardReaderExternalFileBytesImpl(
	file: File,
): Promise<ReadRewardReaderExternalFileBytesResult> {
	if (!(file instanceof File) || typeof file.name !== 'string') {
		return createReadFailure(
			'invalid-external-file',
			'Reward Reader requires one selected TXT or Markdown file.',
		);
	}

	if (!getRewardReaderExternalSourceExtension(file.name)) {
		return createReadFailure(
			'unsupported-extension',
			'Reward Reader currently supports only TXT and Markdown external files.',
		);
	}

	let buffer: ArrayBuffer;
	try {
		buffer = await file.arrayBuffer();
	} catch {
		return createReadFailure(
			'external-file-read-failed',
			'Reward Reader could not read the selected external file.',
		);
	}

	return {
		ok: true,
		fileName: file.name,
		bytes: new Uint8Array(buffer),
	};
}

export async function readRewardReaderExternalFileBytes(
	file: File,
): Promise<ReadRewardReaderExternalFileBytesResult> {
	try {
		return await readRewardReaderExternalFileBytesImpl(file);
	} catch {
		return createReadFailure(
			'external-file-read-failed',
			'Reward Reader could not read the selected external file.',
		);
	}
}

function inspectRewardReaderExternalSourceImpl(input: {
	fileName: string;
	bytes: Uint8Array;
	preferredEncoding: RewardReaderExternalEncodingPreference;
}): InspectRewardReaderExternalSourceResult {
	const extension = getRewardReaderExternalSourceExtension(input.fileName);
	if (!extension) {
		return createInspectFailure(
			input.fileName,
			'unsupported-extension',
			'Reward Reader currently supports only TXT and Markdown external files.',
		);
	}

	const decodeResult = decodeRewardReaderExternalText(
		input.bytes,
		mapEncodingPreferenceToDecoderEncoding(input.preferredEncoding),
	);
	if (!decodeResult.ok) {
		return createInspectFailure(
			input.fileName,
			decodeResult.code,
			decodeResult.message,
		);
	}

	const parseResult = parseRewardReaderChapters(decodeResult.text);
	const chapterTitlePreview = summarizePreviewTitles(
		parseResult.chapters.map((chapter) => chapter.title),
	);
	const previewBase: RewardReaderExternalPreviewBase = {
		fileName: input.fileName,
		parseStatus: parseResult.status,
		detectedEncoding: decodeResult.encoding,
		hadBom: decodeResult.hadBom,
		detectionMode: parseResult.detectionMode,
		chapterCount: parseResult.chapters.length,
		chapterTitlePreview,
		warnings: [...parseResult.warnings],
		blockingIssues: [...parseResult.blockingIssues],
	};
	if (parseResult.status === 'ambiguous') {
		return createInspectFailure(
			input.fileName,
			'chapter-heading-ambiguity',
			'Duplicate chapter numbers were detected, and Reward Reader cannot reliably determine which line is the real chapter heading.',
			previewBase,
		);
	}

	if (parseResult.chapters.length === 0) {
		return createInspectFailure(
			input.fileName,
			'no-chapters-detected',
			'Reward Reader could not detect any supported chapter headings in the selected external file.',
			previewBase,
		);
	}

	return {
		ok: true,
		...previewBase,
		normalizedText: decodeResult.text,
	};
}

export function inspectRewardReaderExternalSource(input: {
	fileName: string;
	bytes: Uint8Array;
	preferredEncoding: RewardReaderExternalEncodingPreference;
}): InspectRewardReaderExternalSourceResult {
	try {
		return inspectRewardReaderExternalSourceImpl(input);
	} catch {
		return createInspectFailure(
			getSafeRewardReaderExternalFileName(input),
			'external-text-decode-failed',
			'Reward Reader could not inspect the selected external file.',
		);
	}
}

async function prepareRewardReaderExternalSourceImpl(
	vault: Vault,
	input: {
		fileName: string;
		normalizedText: string;
	},
): Promise<PrepareRewardReaderExternalSourceResult> {
	if (
		typeof input.fileName !== 'string' ||
		input.fileName.trim().length === 0 ||
		typeof input.normalizedText !== 'string' ||
		input.normalizedText.length === 0 ||
		input.normalizedText.includes('\0')
	) {
		return createPrepareFailure(
			'invalid-external-source',
			'Reward Reader external import requires a decoded text source before writing a Vault copy.',
		);
	}

	try {
		const folder = await ensureRewardReaderImportedFolder(vault);
		if (!folder) {
			return createPrepareFailure(
				'vault-folder-create-failed',
				'Reward Reader could not prepare the imported novel folder in the Vault.',
			);
		}
	} catch {
		return createPrepareFailure(
			'vault-folder-create-failed',
			'Reward Reader could not prepare the imported novel folder in the Vault.',
		);
	}

	const baseName = sanitizeRewardReaderImportedFileBaseName(input.fileName);
	let targetPath: string | null = null;
	for (
		let attempt = 1;
		attempt <= MAX_REWARD_READER_IMPORTED_NAME_ATTEMPTS;
		attempt += 1
	) {
		const candidatePath = buildRewardReaderImportedFilePath(baseName, attempt);
		if (!vault.getAbstractFileByPath(candidatePath)) {
			targetPath = candidatePath;
			break;
		}
	}

	if (!targetPath) {
		return createPrepareFailure(
			'vault-path-conflict',
			'Reward Reader could not create a unique imported novel file name in the Vault.',
		);
	}

	let createdFile: TFile;
	try {
		createdFile = await vault.create(targetPath, input.normalizedText);
	} catch {
		return createPrepareFailure(
			'vault-write-failed',
			'Reward Reader could not create the imported Markdown copy in the Vault.',
		);
	}

	return confirmRewardReaderPreparedVaultCopyMetadata(vault, createdFile);
}

export async function prepareRewardReaderExternalSource(
	vault: Vault,
	input: {
		fileName: string;
		normalizedText: string;
	},
): Promise<PrepareRewardReaderExternalSourceResult> {
	try {
		return await prepareRewardReaderExternalSourceImpl(vault, input);
	} catch {
		return createPrepareFailure(
			'vault-write-failed',
			'Reward Reader could not create the imported Markdown copy in the Vault.',
		);
	}
}
