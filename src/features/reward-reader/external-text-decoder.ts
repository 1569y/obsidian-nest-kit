export type RewardReaderExternalTextEncoding =
	| 'utf-8'
	| 'utf-8-bom'
	| 'utf-16le'
	| 'utf-16be'
	| 'gb18030';

export interface DecodeRewardReaderExternalTextSuccess {
	ok: true;
	text: string;
	encoding: RewardReaderExternalTextEncoding;
	hadBom: boolean;
}

export interface DecodeRewardReaderExternalTextFailure {
	ok: false;
	code:
		| 'invalid-external-text-input'
		| 'unsupported-text-encoding'
		| 'binary-file-detected'
		| 'external-text-decode-failed';
	message: string;
}

export type DecodeRewardReaderExternalTextResult =
	| DecodeRewardReaderExternalTextSuccess
	| DecodeRewardReaderExternalTextFailure;

interface RewardReaderDecodedTextCandidate {
	text: string;
	encoding: RewardReaderExternalTextEncoding;
	hadBom: boolean;
}

const UTF8_BOM_BYTES = [0xef, 0xbb, 0xbf] as const;
const UTF16_LE_BOM_BYTES = [0xff, 0xfe] as const;
const UTF16_BE_BOM_BYTES = [0xfe, 0xff] as const;
const REWARD_READER_EXTERNAL_TEXT_ENCODING_ALLOWLIST = new Set<
	RewardReaderExternalTextEncoding
>(['utf-8', 'utf-8-bom', 'utf-16le', 'utf-16be', 'gb18030']);

function createFailure(
	code: DecodeRewardReaderExternalTextFailure['code'],
	message: string,
): DecodeRewardReaderExternalTextFailure {
	return {
		ok: false,
		code,
		message,
	};
}

function hasBomPrefix(
	bytes: Uint8Array,
	prefix: readonly number[],
): boolean {
	return (
		bytes.length >= prefix.length &&
		prefix.every((value, index) => bytes[index] === value)
	);
}

function stripLeadingBomCharacter(value: string): string {
	return value.startsWith('\uFEFF') ? value.slice(1) : value;
}

function normalizeDecodedText(value: string): string {
	return stripLeadingBomCharacter(value).replace(/\r\n?/gu, '\n');
}

function countCharacters(
	value: string,
	needle: (character: string) => boolean,
): number {
	let count = 0;
	for (const character of value) {
		if (needle(character)) {
			count += 1;
		}
	}

	return count;
}

function isBinaryLikeDecodedText(value: string): boolean {
	if (value.length === 0) {
		return false;
	}

	const nulCount = countCharacters(value, (character) => character === '\0');
	if (nulCount >= 4 && nulCount * 100 >= value.length * 5) {
		return true;
	}

	const suspiciousControlCount = countCharacters(
		value,
		(character) => {
			const codePoint = character.charCodeAt(0);
			if (codePoint === 9 || codePoint === 10) {
				return false;
			}

			return codePoint < 32;
		},
	);
	return suspiciousControlCount * 100 >= value.length * 20;
}

function mapEncodingToTextDecoderLabel(
	encoding: RewardReaderExternalTextEncoding,
): string {
	switch (encoding) {
		case 'utf-8':
		case 'utf-8-bom':
			return 'utf-8';
		case 'utf-16le':
			return 'utf-16le';
		case 'utf-16be':
			return 'utf-16be';
		case 'gb18030':
			return 'gb18030';
	}
}

function decodeWithEncoding(
	bytes: Uint8Array,
	encoding: RewardReaderExternalTextEncoding,
): RewardReaderDecodedTextCandidate | DecodeRewardReaderExternalTextFailure {
	let decoder: TextDecoder;
	try {
		decoder = new TextDecoder(mapEncodingToTextDecoderLabel(encoding), {
			fatal: true,
		});
	} catch {
		return createFailure(
			'unsupported-text-encoding',
			'Reward Reader could not access the requested text decoder.',
		);
	}

	let decodedText: string;
	try {
		decodedText = decoder.decode(bytes);
	} catch {
		return createFailure(
			'external-text-decode-failed',
			'Reward Reader could not decode the selected text file.',
		);
	}

	return {
		text: normalizeDecodedText(decodedText),
		encoding,
		hadBom:
			encoding === 'utf-8-bom' ||
			hasBomPrefix(bytes, UTF16_LE_BOM_BYTES) ||
			hasBomPrefix(bytes, UTF16_BE_BOM_BYTES),
	};
}

function detectUtf16EncodingWithoutBom(
	bytes: Uint8Array,
): RewardReaderExternalTextEncoding | null {
	if (bytes.length < 8 || bytes.length % 2 !== 0) {
		return null;
	}

	const sampleLength = Math.min(bytes.length, 256);
	let evenZeroCount = 0;
	let oddZeroCount = 0;
	let pairCount = 0;

	for (let index = 0; index + 1 < sampleLength; index += 2) {
		if (bytes[index] === 0) {
			evenZeroCount += 1;
		}

		if (bytes[index + 1] === 0) {
			oddZeroCount += 1;
		}

		pairCount += 1;
	}

	if (pairCount < 4) {
		return null;
	}

	if (oddZeroCount * 10 >= pairCount * 3 && evenZeroCount * 10 <= pairCount) {
		return 'utf-16le';
	}

	if (evenZeroCount * 10 >= pairCount * 3 && oddZeroCount * 10 <= pairCount) {
		return 'utf-16be';
	}

	return null;
}

function finalizeDecodedCandidate(
	candidate: RewardReaderDecodedTextCandidate | DecodeRewardReaderExternalTextFailure,
): DecodeRewardReaderExternalTextResult {
	if (isDecodeFailure(candidate)) {
		return candidate;
	}

	if (candidate.text.length === 0) {
		return createFailure(
			'invalid-external-text-input',
			'Reward Reader cannot import an empty text file.',
		);
	}

	if (isBinaryLikeDecodedText(candidate.text)) {
		return createFailure(
			'binary-file-detected',
			'Reward Reader rejected the selected file because it looks binary after decoding.',
		);
	}

	return {
		ok: true,
		text: candidate.text,
		encoding: candidate.encoding,
		hadBom: candidate.hadBom,
	};
}

function isDecodeFailure(
	value: RewardReaderDecodedTextCandidate | DecodeRewardReaderExternalTextFailure,
): value is DecodeRewardReaderExternalTextFailure {
	return (value as { ok?: boolean }).ok === false;
}

function decodeRewardReaderExternalTextImpl(
	bytes: Uint8Array,
	preferredEncoding?: RewardReaderExternalTextEncoding | null,
): DecodeRewardReaderExternalTextResult {
	if (!(bytes instanceof Uint8Array) || bytes.length === 0) {
		return createFailure(
			'invalid-external-text-input',
			'Reward Reader requires non-empty text bytes before decoding.',
		);
	}

	if (
		preferredEncoding !== undefined &&
		preferredEncoding !== null &&
		!REWARD_READER_EXTERNAL_TEXT_ENCODING_ALLOWLIST.has(preferredEncoding)
	) {
		return createFailure(
			'invalid-external-text-input',
			'Reward Reader requires a supported text encoding before decoding.',
		);
	}

	if (preferredEncoding) {
		return finalizeDecodedCandidate(decodeWithEncoding(bytes, preferredEncoding));
	}

	if (hasBomPrefix(bytes, UTF8_BOM_BYTES)) {
		return finalizeDecodedCandidate(decodeWithEncoding(bytes, 'utf-8-bom'));
	}

	if (hasBomPrefix(bytes, UTF16_LE_BOM_BYTES)) {
		return finalizeDecodedCandidate(decodeWithEncoding(bytes, 'utf-16le'));
	}

	if (hasBomPrefix(bytes, UTF16_BE_BOM_BYTES)) {
		return finalizeDecodedCandidate(decodeWithEncoding(bytes, 'utf-16be'));
	}

	const utf16Encoding = detectUtf16EncodingWithoutBom(bytes);
	const utf8Result = finalizeDecodedCandidate(decodeWithEncoding(bytes, 'utf-8'));
	if (
		utf8Result.ok ||
		(utf8Result.code !== 'binary-file-detected' &&
			utf8Result.code !== 'external-text-decode-failed')
	) {
		return utf8Result;
	}

	if (utf16Encoding) {
		const utf16Result = finalizeDecodedCandidate(
			decodeWithEncoding(bytes, utf16Encoding),
		);
		if (utf16Result.ok) {
			return utf16Result;
		}
	}

	const gb18030Result = decodeWithEncoding(bytes, 'gb18030');
	if (!isDecodeFailure(gb18030Result)) {
		return finalizeDecodedCandidate(gb18030Result);
	}

	if (gb18030Result.code === 'unsupported-text-encoding') {
		return gb18030Result;
	}

	return createFailure(
		'external-text-decode-failed',
		'Reward Reader could not decode the selected text file with a supported encoding.',
	);
}

export function decodeRewardReaderExternalText(
	bytes: Uint8Array,
	preferredEncoding?: RewardReaderExternalTextEncoding | null,
): DecodeRewardReaderExternalTextResult {
	try {
		return decodeRewardReaderExternalTextImpl(bytes, preferredEncoding);
	} catch {
		return createFailure(
			'external-text-decode-failed',
			'Reward Reader could not decode the selected text file.',
		);
	}
}
