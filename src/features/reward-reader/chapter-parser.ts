import type { RewardReaderChapterIndexEntry } from './types';

export type RewardReaderChapterDetectionMode =
	| 'none'
	| 'markdown-heading'
	| 'plain-chapter-heading'
	| 'numeric-colon';

export type RewardReaderChapterParseStatus = 'ok' | 'none' | 'ambiguous';

export interface RewardReaderChapterParseBlockingIssueCandidate {
	heading: string;
	lineIndex: number;
	startOffset: number;
}

export interface RewardReaderChapterParseBlockingIssue {
	code: 'ambiguous-duplicate-chapter-number';
	detectionMode: 'numeric-colon';
	chapterNumber: number;
	candidateCount: number;
	candidates: RewardReaderChapterParseBlockingIssueCandidate[];
	message: string;
}

export interface RewardReaderChapterParseResult {
	status: RewardReaderChapterParseStatus;
	chapters: RewardReaderChapterIndexEntry[];
	sourceTextLength: number;
	detectedHeadingCount: number;
	ignoredPrefixLength: number;
	detectionMode: RewardReaderChapterDetectionMode;
	warnings: string[];
	blockingIssues: RewardReaderChapterParseBlockingIssue[];
}

interface RewardReaderSourceLine {
	rawText: string;
	matchableText: string;
	startOffset: number;
	lineIndex: number;
}

interface RewardReaderDetectedChapterHeading {
	title: string;
	startOffset: number;
	lineIndex: number;
	kind: 'strong' | 'special';
}

interface RewardReaderSpecialChapterHeading
	extends RewardReaderDetectedChapterHeading {
	kind: 'special';
	role: 'preface' | 'interlude' | 'ending';
}

interface RewardReaderNumericColonCandidate {
	title: string;
	startOffset: number;
	chapterNumber: number;
	rawDigits: string;
	digitWidth: number;
	hasLeadingZero: boolean;
	delimiter: ':' | '：';
	lineIndex: number;
}

interface RewardReaderValidatedNumericColonRun {
	candidates: RewardReaderNumericColonCandidate[];
	observedGap: boolean;
	totalBodyEvidenceLength: number;
}

interface RewardReaderNumericColonEvidenceContext {
	bodyEvidencePrefix: readonly number[];
}

interface RewardReaderNumericColonCanonicalCandidateScore {
	anchoredSideCount: number;
	supportedSideCount: number;
	bodyEvidenceFloorSatisfied: boolean;
	minimumAdjacentBodyEvidence: number;
	totalAdjacentBodyEvidence: number;
	styleMismatchCount: number;
	extremeIntervalCount: number;
	combinedOffsetDeviation: number;
	combinedLineDeviation: number;
	intervalImbalance: number;
	titleContinuityScore: number;
}

interface RewardReaderScoredNumericColonCanonicalCandidate {
	candidate: RewardReaderNumericColonCandidate;
	score: RewardReaderNumericColonCanonicalCandidateScore;
}

interface RewardReaderNumericColonSpacingModel {
	expectedOffsetDistancePerChapter: number | null;
	expectedLineDistancePerChapter: number | null;
}

interface RewardReaderNumericColonRunState {
	length: number;
	styleScore: number;
	totalBodyEvidenceLength: number;
	totalGapPenalty: number;
	maxGapPenalty: number;
	gapTransitionCount: number;
	totalSkippedCandidates: number;
	candidateIndexSum: number;
	observedGap: boolean;
	firstLineIndex: number;
	lastLineIndex: number;
	firstChapterNumber: number;
	lastChapterNumber: number;
	previousCandidateIndex: number | null;
}

const UTF8_BOM = '\uFEFF';
const IDEOGRAPHIC_SPACE = '\u3000';
const FULLWIDTH_COLON = '\uFF1A';
const EN_DASH = '\u2013';
const EM_DASH = '\u2014';
const IDEOGRAPHIC_COMMA = '\u3001';
const IDEOGRAPHIC_PERIOD = '\u3002';
const CHINESE_HEADING_MARKER = '\u7B2C';
const CHINESE_UNIT_CHAPTER = '\u7AE0';
const CHINESE_UNIT_HUI = '\u56DE';
const CHINESE_UNIT_SECTION = '\u8282';
const CHINESE_UNIT_VOLUME = '\u5377';
const CHINESE_UNIT_PART = '\u90E8';
const CHINESE_UNIT_PIAN = '\u7BC7';
const FULLWIDTH_DIGIT_RANGE = '\uFF10-\uFF19';
const CHINESE_NUMERAL_TEXT =
	'\u96F6\u3007\u4E00\u4E8C\u4E24\u4E09\u56DB\u4E94\u516D\u4E03\u516B\u4E5D\u5341\u767E\u5343\u4E07';
const HORIZONTAL_WHITESPACE_CLASS = `[ \\t${IDEOGRAPHIC_SPACE}]`;
const HORIZONTAL_WHITESPACE_ZERO_OR_MORE = `${HORIZONTAL_WHITESPACE_CLASS}*`;
const HORIZONTAL_WHITESPACE_ONE_OR_MORE = `${HORIZONTAL_WHITESPACE_CLASS}+`;
const TITLE_SEPARATOR_PUNCTUATION_CLASS = `:${FULLWIDTH_COLON}\\-${EN_DASH}${EM_DASH}.${IDEOGRAPHIC_COMMA}${IDEOGRAPHIC_PERIOD}`;
const STRONG_CHINESE_HEADING_MAX_LENGTH = 160;
const SPECIAL_CHAPTER_HEADING_MAX_LENGTH = 120;
const STRONG_DIRECT_TITLE_MAX_LENGTH = 60;
const MIN_SPECIAL_STANDALONE_HEADING_COUNT = 2;
const MIN_SPECIAL_HEADING_BODY_EVIDENCE_LENGTH = 6;
const MIN_NUMERIC_COLON_BODY_EVIDENCE_LENGTH = 12;
const MAX_NUMERIC_COLON_CHAPTER_GAP = 1000;
const MAX_NUMERIC_COLON_LOOKBACK_CANDIDATES = 48;
const MAX_NUMERIC_COLON_DUPLICATE_GROUP_CANDIDATES = 12;
const MAX_NUMERIC_COLON_AMBIGUITY_PREVIEW_CANDIDATES = 6;
const NUMERIC_COLON_EXTREME_INTERVAL_DEVIATION_THRESHOLD = 0.75;
const NUMERIC_COLON_DECISIVE_DEVIATION_MARGIN = 0.35;
const NUMERIC_COLON_DECISIVE_LINE_DEVIATION_MARGIN = 1.5;
const NUMERIC_COLON_DECISIVE_IMBALANCE_MARGIN = 0.5;
const CHINESE_NUMBER_TOKEN_PATTERN = `(?:[0-9${FULLWIDTH_DIGIT_RANGE}]{1,6}|[${CHINESE_NUMERAL_TEXT}]+)`;
const CHINESE_MAIN_HEADING_UNITS = [
	CHINESE_UNIT_CHAPTER,
	CHINESE_UNIT_HUI,
	CHINESE_UNIT_SECTION,
	CHINESE_UNIT_VOLUME,
	CHINESE_UNIT_PART,
	CHINESE_UNIT_PIAN,
].join('');
const CHINESE_GROUP_HEADING_UNITS = [
	CHINESE_UNIT_VOLUME,
	CHINESE_UNIT_PART,
	CHINESE_UNIT_PIAN,
].join('');
const STRONG_CHINESE_HEADING_PREFIX_REGEX = new RegExp(
	[
		'^',
		HORIZONTAL_WHITESPACE_ZERO_OR_MORE,
		'(?:(?:',
		CHINESE_HEADING_MARKER,
		HORIZONTAL_WHITESPACE_ZERO_OR_MORE,
		`(${CHINESE_NUMBER_TOKEN_PATTERN})`,
		HORIZONTAL_WHITESPACE_ZERO_OR_MORE,
		`([${CHINESE_GROUP_HEADING_UNITS}])`,
		'|',
		'VIP',
		CHINESE_UNIT_VOLUME,
		'|',
		'\u6B63\u6587',
		CHINESE_UNIT_VOLUME,
		'|',
		'\u4F5C\u54C1\u76F8\u5173',
		')',
		HORIZONTAL_WHITESPACE_ONE_OR_MORE,
		')?',
		CHINESE_HEADING_MARKER,
		HORIZONTAL_WHITESPACE_ZERO_OR_MORE,
		`(${CHINESE_NUMBER_TOKEN_PATTERN})`,
		HORIZONTAL_WHITESPACE_ZERO_OR_MORE,
		`([${CHINESE_MAIN_HEADING_UNITS}])`,
		'(.*)',
		'$',
	].join(''),
	'u',
);
const ENGLISH_CHAPTER_HEADING_PREFIX_REGEX = new RegExp(
	[
		'^',
		HORIZONTAL_WHITESPACE_ZERO_OR_MORE,
		'chapter',
		HORIZONTAL_WHITESPACE_ONE_OR_MORE,
		`([0-9${FULLWIDTH_DIGIT_RANGE}]{1,6}|[IVXLCDM]{1,10})`,
		'(.*)',
		'$',
	].join(''),
	'iu',
);
const MARKDOWN_HEADING_PREFIX_REGEX = /^[ \t]*#{1,6}[ \t]+/u;
const NUMERIC_COLON_HEADING_REGEX = new RegExp(
	[
		'^',
		HORIZONTAL_WHITESPACE_ZERO_OR_MORE,
		`([0-9${FULLWIDTH_DIGIT_RANGE}]{1,6})`,
		HORIZONTAL_WHITESPACE_ZERO_OR_MORE,
		`([:${FULLWIDTH_COLON}])`,
		HORIZONTAL_WHITESPACE_ZERO_OR_MORE,
		'(\\S.{0,120})',
		HORIZONTAL_WHITESPACE_ZERO_OR_MORE,
		'$',
	].join(''),
	'u',
);
const SPECIAL_FANWAI_HEADING_REGEX = new RegExp(
	[
		'^',
		'\u756A\u5916',
		`(?:[${CHINESE_NUMERAL_TEXT}0-9${FULLWIDTH_DIGIT_RANGE}]+|\u7BC7)?`,
		'(?:',
		HORIZONTAL_WHITESPACE_ONE_OR_MORE,
		CHINESE_HEADING_MARKER,
		HORIZONTAL_WHITESPACE_ZERO_OR_MORE,
		`${CHINESE_NUMBER_TOKEN_PATTERN}`,
		HORIZONTAL_WHITESPACE_ZERO_OR_MORE,
		`[${CHINESE_MAIN_HEADING_UNITS}]`,
		')?',
		'(?:',
		`(?:${HORIZONTAL_WHITESPACE_ZERO_OR_MORE}[${TITLE_SEPARATOR_PUNCTUATION_CLASS}]${HORIZONTAL_WHITESPACE_ZERO_OR_MORE}|${HORIZONTAL_WHITESPACE_ONE_OR_MORE})`,
		'.+',
		')?',
		'$',
	].join(''),
	'u',
);
const SPECIAL_TEBIE_HEADING_REGEX = new RegExp(
	[
		'^',
		'\u7279\u522B\u7BC7',
		'(?:',
		`(?:${HORIZONTAL_WHITESPACE_ZERO_OR_MORE}[${TITLE_SEPARATOR_PUNCTUATION_CLASS}]${HORIZONTAL_WHITESPACE_ZERO_OR_MORE}|${HORIZONTAL_WHITESPACE_ONE_OR_MORE})`,
		'.+',
		')?',
		'$',
	].join(''),
	'u',
);
const SPECIAL_EXTRA_CHAPTER_HEADING_REGEX = new RegExp(
	[
		'^',
		'extra',
		HORIZONTAL_WHITESPACE_ONE_OR_MORE,
		'chapter',
		'(?:',
		`(?:${HORIZONTAL_WHITESPACE_ZERO_OR_MORE}[${TITLE_SEPARATOR_PUNCTUATION_CLASS}]${HORIZONTAL_WHITESPACE_ZERO_OR_MORE}|${HORIZONTAL_WHITESPACE_ONE_OR_MORE})`,
		'.+',
		')?',
		'$',
	].join(''),
	'iu',
);
const CHINESE_DIRECT_TITLE_FORBIDDEN_STARTS = new Set<string>([
	CHINESE_UNIT_CHAPTER,
	CHINESE_UNIT_HUI,
	CHINESE_UNIT_SECTION,
	CHINESE_UNIT_VOLUME,
	CHINESE_UNIT_PART,
	CHINESE_UNIT_PIAN,
]);
const CHINESE_DIRECT_TITLE_FORBIDDEN_PREFIXES = [
	'\u6B63\u6587',
	'\u5185\u5BB9',
	'\u672C\u7AE0',
	'\u672C\u8282',
	'\u8FD9\u91CC',
	'\u8FD9\u4E00',
	'\u6B64\u5904',
];
const SENTENCE_LIKE_DIRECT_TITLE_PUNCTUATION_REGEX = /[,.!?;，。！？；]/u;
const PREFACE_SPECIAL_HEADINGS = new Set<string>([
	'\u5E8F\u7AE0',
	'\u5E8F\u8A00',
	'\u524D\u8A00',
	'\u6954\u5B50',
	'\u5F15\u5B50',
]);
const ENDING_SPECIAL_HEADINGS = new Set<string>([
	'\u7EC8\u7AE0',
	'\u5C3E\u58F0',
	'\u540E\u8BB0',
	'\u5B8C\u7ED3\u611F\u8A00',
]);
const INTERLUDE_SPECIAL_HEADINGS = new Set<string>([
	'\u756A\u5916',
	'\u7279\u522B\u7BC7',
]);
const PREFACE_SPECIAL_HEADINGS_ENGLISH = new Set<string>(['prologue']);
const ENDING_SPECIAL_HEADINGS_ENGLISH = new Set<string>([
	'epilogue',
	'afterword',
]);
const INTERLUDE_SPECIAL_HEADINGS_ENGLISH = new Set<string>([
	'interlude',
	'side story',
	'extra chapter',
]);
const SPECIAL_TITLED_HEADING_SUFFIX_PATTERN = [
	'(?:',
	`${HORIZONTAL_WHITESPACE_ZERO_OR_MORE}[${TITLE_SEPARATOR_PUNCTUATION_CLASS}]${HORIZONTAL_WHITESPACE_ZERO_OR_MORE}`,
	'|',
	HORIZONTAL_WHITESPACE_ONE_OR_MORE,
	')',
	'.+',
].join('');

export const REWARD_READER_NUMERIC_COLON_GAP_WARNING =
	'Reward Reader numeric-colon detection observed chapter-number gaps and kept the ordered headings as-is.';
export const REWARD_READER_IGNORED_PREFACE_WARNING =
	'Reward Reader chapter parser ignored leading preface text before the first detected chapter heading.';
export const REWARD_READER_DUPLICATE_NUMBER_AMBIGUITY_WARNING =
	'Reward Reader blocked numeric-colon import because duplicate chapter numbers could not be resolved safely.';

function escapeRegexLiteral(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildAnchoredSpecialHeadingVariantRegexes(
	headings: ReadonlySet<string>,
	flags: string,
): RegExp[] {
	return Array.from(headings, (heading) =>
		new RegExp(
			[
				'^',
				escapeRegexLiteral(heading),
				SPECIAL_TITLED_HEADING_SUFFIX_PATTERN,
				'$',
			].join(''),
			flags,
		),
	);
}

const PREFACE_SPECIAL_HEADING_VARIANT_REGEXES =
	buildAnchoredSpecialHeadingVariantRegexes(PREFACE_SPECIAL_HEADINGS, 'u');
const ENDING_SPECIAL_HEADING_VARIANT_REGEXES =
	buildAnchoredSpecialHeadingVariantRegexes(ENDING_SPECIAL_HEADINGS, 'u');
const INTERLUDE_SPECIAL_HEADING_VARIANT_REGEXES =
	buildAnchoredSpecialHeadingVariantRegexes(INTERLUDE_SPECIAL_HEADINGS, 'u');
const PREFACE_SPECIAL_HEADING_VARIANT_REGEXES_ENGLISH =
	buildAnchoredSpecialHeadingVariantRegexes(
		PREFACE_SPECIAL_HEADINGS_ENGLISH,
		'iu',
	);
const ENDING_SPECIAL_HEADING_VARIANT_REGEXES_ENGLISH =
	buildAnchoredSpecialHeadingVariantRegexes(
		ENDING_SPECIAL_HEADINGS_ENGLISH,
		'iu',
	);
const INTERLUDE_SPECIAL_HEADING_VARIANT_REGEXES_ENGLISH =
	buildAnchoredSpecialHeadingVariantRegexes(
		INTERLUDE_SPECIAL_HEADINGS_ENGLISH,
		'iu',
	);

function getLineEndOffset(
	sourceText: string,
	lineStart: number,
): {
	lineEnd: number;
	nextLineStart: number;
} {
	let lineEnd = lineStart;
	while (lineEnd < sourceText.length) {
		const character = sourceText.charCodeAt(lineEnd);
		if (character === 10 || character === 13) {
			break;
		}
		lineEnd += 1;
	}

	let nextLineStart = lineEnd;
	if (nextLineStart < sourceText.length) {
		const lineBreakCharacter = sourceText.charCodeAt(nextLineStart);
		if (
			lineBreakCharacter === 13 &&
			nextLineStart + 1 < sourceText.length &&
			sourceText.charCodeAt(nextLineStart + 1) === 10
		) {
			nextLineStart += 2;
		} else {
			nextLineStart += 1;
		}
	}

	return {
		lineEnd,
		nextLineStart,
	};
}

function stripLeadingBom(lineText: string, lineStart: number): string {
	if (lineStart === 0 && lineText.startsWith(UTF8_BOM)) {
		return lineText.slice(UTF8_BOM.length);
	}

	return lineText;
}

function normalizeDetectedChapterTitle(matchableLineText: string): string {
	const withoutIndent = matchableLineText.replace(
		new RegExp(`^${HORIZONTAL_WHITESPACE_ONE_OR_MORE}`, 'u'),
		'',
	);
	const withoutMarkdownHeading = withoutIndent.replace(
		MARKDOWN_HEADING_PREFIX_REGEX,
		'',
	);

	return withoutMarkdownHeading.trim();
}

function matchesSpecialHeadingVariant(
	lineText: string,
	regexes: readonly RegExp[],
): boolean {
	return regexes.some((regex) => regex.test(lineText));
}

function normalizeAsciiDigits(value: string): string {
	return value.replace(/[\uFF10-\uFF19]/gu, (digit) =>
		String.fromCharCode(digit.charCodeAt(0) - 0xff10 + 0x30),
	);
}

function parseNumericChapterNumber(value: string): number | null {
	const normalizedDigits = normalizeAsciiDigits(value);
	if (!/^[0-9]{1,6}$/u.test(normalizedDigits)) {
		return null;
	}

	const chapterNumber = Number.parseInt(normalizedDigits, 10);
	return Number.isSafeInteger(chapterNumber) ? chapterNumber : null;
}

function scanRewardReaderSourceLines(
	sourceText: string,
): RewardReaderSourceLine[] {
	const lines: RewardReaderSourceLine[] = [];
	let lineStart = 0;
	let lineIndex = 0;

	while (lineStart < sourceText.length) {
		const { lineEnd, nextLineStart } = getLineEndOffset(sourceText, lineStart);
		const rawText = sourceText.slice(lineStart, lineEnd);
		lines.push({
			rawText,
			matchableText: stripLeadingBom(rawText, lineStart),
			startOffset: lineStart,
			lineIndex,
		});
		lineStart = nextLineStart;
		lineIndex += 1;
	}

	return lines;
}

function isTitleSeparatorPunctuation(character: string): boolean {
	return TITLE_SEPARATOR_PUNCTUATION_CLASS.includes(character);
}

function getFirstCharacter(value: string): string | null {
	return Array.from(value)[0] ?? null;
}

function parseRomanChapterNumber(value: string): number | null {
	const uppercaseValue = value.trim().toUpperCase();
	if (!/^[IVXLCDM]{1,10}$/u.test(uppercaseValue)) {
		return null;
	}

	const romanValues: Record<string, number> = {
		I: 1,
		V: 5,
		X: 10,
		L: 50,
		C: 100,
		D: 500,
		M: 1000,
	};

	let total = 0;
	for (let index = 0; index < uppercaseValue.length; index += 1) {
		const currentValue = romanValues[uppercaseValue[index] ?? ''];
		const nextValue = romanValues[uppercaseValue[index + 1] ?? ''];
		if (!currentValue) {
			return null;
		}

		if (nextValue && nextValue > currentValue) {
			total -= currentValue;
		} else {
			total += currentValue;
		}
	}

	if (total <= 0 || total > 3999) {
		return null;
	}

	const canonicalDigits: Array<[number, string]> = [
		[1000, 'M'],
		[900, 'CM'],
		[500, 'D'],
		[400, 'CD'],
		[100, 'C'],
		[90, 'XC'],
		[50, 'L'],
		[40, 'XL'],
		[10, 'X'],
		[9, 'IX'],
		[5, 'V'],
		[4, 'IV'],
		[1, 'I'],
	];

	let remaining = total;
	let canonicalValue = '';
	for (const [digitValue, romanToken] of canonicalDigits) {
		while (remaining >= digitValue) {
			canonicalValue += romanToken;
			remaining -= digitValue;
		}
	}

	return canonicalValue === uppercaseValue ? total : null;
}

function trimRewardReaderHorizontalWhitespace(value: string): string {
	return value
		.replace(
			new RegExp(`^${HORIZONTAL_WHITESPACE_ONE_OR_MORE}`, 'u'),
			'',
		)
		.replace(
			new RegExp(`${HORIZONTAL_WHITESPACE_ONE_OR_MORE}$`, 'u'),
			'',
		);
}

function startsWithAnyPrefix(
	value: string,
	prefixes: readonly string[],
): boolean {
	return prefixes.some((prefix) => value.startsWith(prefix));
}

function isValidStrongHeadingSuffix(
	suffix: string,
	options: {
		allowDirectTitle: boolean;
		forbiddenDirectTitleStarts?: ReadonlySet<string>;
	},
): boolean {
	if (suffix.length === 0) {
		return true;
	}

	const withoutLeadingWhitespace = suffix.replace(
		new RegExp(`^${HORIZONTAL_WHITESPACE_ONE_OR_MORE}`, 'u'),
		'',
	);
	if (withoutLeadingWhitespace.length === 0) {
		return true;
	}

	const firstCharacter = getFirstCharacter(withoutLeadingWhitespace);
	if (!firstCharacter) {
		return true;
	}

	if (isTitleSeparatorPunctuation(firstCharacter)) {
		const remainder = trimRewardReaderHorizontalWhitespace(
			withoutLeadingWhitespace.slice(firstCharacter.length),
		);
		return remainder.length > 0;
	}

	if (withoutLeadingWhitespace.length !== suffix.length) {
		return true;
	}

	if (!options.allowDirectTitle) {
		return false;
	}

	if (options.forbiddenDirectTitleStarts?.has(firstCharacter)) {
		return false;
	}

	if (withoutLeadingWhitespace.length > STRONG_DIRECT_TITLE_MAX_LENGTH) {
		return false;
	}

	if (
		SENTENCE_LIKE_DIRECT_TITLE_PUNCTUATION_REGEX.test(
			withoutLeadingWhitespace,
		)
	) {
		return false;
	}

	return !startsWithAnyPrefix(
		withoutLeadingWhitespace,
		CHINESE_DIRECT_TITLE_FORBIDDEN_PREFIXES,
	);
}

function detectStrongChineseChapterHeading(
	line: RewardReaderSourceLine,
	lineText: string,
): RewardReaderDetectedChapterHeading | null {
	if (lineText.length === 0 || lineText.length > STRONG_CHINESE_HEADING_MAX_LENGTH) {
		return null;
	}

	const match = lineText.match(STRONG_CHINESE_HEADING_PREFIX_REGEX);
	if (!match) {
		return null;
	}

	const suffix = match[5] ?? '';
	if (
		!isValidStrongHeadingSuffix(suffix, {
			allowDirectTitle: true,
			forbiddenDirectTitleStarts: CHINESE_DIRECT_TITLE_FORBIDDEN_STARTS,
		})
	) {
		return null;
	}

	return {
		title: normalizeDetectedChapterTitle(line.matchableText),
		startOffset: line.startOffset,
		lineIndex: line.lineIndex,
		kind: 'strong',
	};
}

function detectEnglishChapterHeading(
	line: RewardReaderSourceLine,
	lineText: string,
): RewardReaderDetectedChapterHeading | null {
	if (lineText.length === 0 || lineText.length > STRONG_CHINESE_HEADING_MAX_LENGTH) {
		return null;
	}

	const match = lineText.match(ENGLISH_CHAPTER_HEADING_PREFIX_REGEX);
	if (!match) {
		return null;
	}

	const numberToken = match[1] ?? '';
	const normalizedDigits = parseNumericChapterNumber(numberToken);
	const romanNumber =
		normalizedDigits === null ? parseRomanChapterNumber(numberToken) : normalizedDigits;
	if (romanNumber === null) {
		return null;
	}

	const suffix = match[2] ?? '';
	if (!isValidStrongHeadingSuffix(suffix, { allowDirectTitle: false })) {
		return null;
	}

	return {
		title: normalizeDetectedChapterTitle(line.matchableText),
		startOffset: line.startOffset,
		lineIndex: line.lineIndex,
		kind: 'strong',
	};
}

function detectSpecialChapterHeading(
	line: RewardReaderSourceLine,
	lineText: string,
): RewardReaderSpecialChapterHeading | null {
	const trimmedLineText = trimRewardReaderHorizontalWhitespace(lineText);
	if (
		trimmedLineText.length === 0 ||
		trimmedLineText.length > SPECIAL_CHAPTER_HEADING_MAX_LENGTH
	) {
		return null;
	}

	if (PREFACE_SPECIAL_HEADINGS.has(trimmedLineText)) {
		return {
			title: normalizeDetectedChapterTitle(line.matchableText),
			startOffset: line.startOffset,
			lineIndex: line.lineIndex,
			kind: 'special',
			role: 'preface',
		};
	}

	if (
		matchesSpecialHeadingVariant(
			trimmedLineText,
			PREFACE_SPECIAL_HEADING_VARIANT_REGEXES,
		)
	) {
		return {
			title: normalizeDetectedChapterTitle(line.matchableText),
			startOffset: line.startOffset,
			lineIndex: line.lineIndex,
			kind: 'special',
			role: 'preface',
		};
	}

	if (ENDING_SPECIAL_HEADINGS.has(trimmedLineText)) {
		return {
			title: normalizeDetectedChapterTitle(line.matchableText),
			startOffset: line.startOffset,
			lineIndex: line.lineIndex,
			kind: 'special',
			role: 'ending',
		};
	}

	if (
		matchesSpecialHeadingVariant(
			trimmedLineText,
			ENDING_SPECIAL_HEADING_VARIANT_REGEXES,
		)
	) {
		return {
			title: normalizeDetectedChapterTitle(line.matchableText),
			startOffset: line.startOffset,
			lineIndex: line.lineIndex,
			kind: 'special',
			role: 'ending',
		};
	}

	const lowercaseLineText = trimmedLineText.toLowerCase();
	if (PREFACE_SPECIAL_HEADINGS_ENGLISH.has(lowercaseLineText)) {
		return {
			title: normalizeDetectedChapterTitle(line.matchableText),
			startOffset: line.startOffset,
			lineIndex: line.lineIndex,
			kind: 'special',
			role: 'preface',
		};
	}

	if (
		matchesSpecialHeadingVariant(
			lowercaseLineText,
			PREFACE_SPECIAL_HEADING_VARIANT_REGEXES_ENGLISH,
		)
	) {
		return {
			title: normalizeDetectedChapterTitle(line.matchableText),
			startOffset: line.startOffset,
			lineIndex: line.lineIndex,
			kind: 'special',
			role: 'preface',
		};
	}

	if (ENDING_SPECIAL_HEADINGS_ENGLISH.has(lowercaseLineText)) {
		return {
			title: normalizeDetectedChapterTitle(line.matchableText),
			startOffset: line.startOffset,
			lineIndex: line.lineIndex,
			kind: 'special',
			role: 'ending',
		};
	}

	if (
		matchesSpecialHeadingVariant(
			lowercaseLineText,
			ENDING_SPECIAL_HEADING_VARIANT_REGEXES_ENGLISH,
		)
	) {
		return {
			title: normalizeDetectedChapterTitle(line.matchableText),
			startOffset: line.startOffset,
			lineIndex: line.lineIndex,
			kind: 'special',
			role: 'ending',
		};
	}

	if (
		INTERLUDE_SPECIAL_HEADINGS.has(trimmedLineText) ||
		INTERLUDE_SPECIAL_HEADINGS_ENGLISH.has(lowercaseLineText) ||
		matchesSpecialHeadingVariant(
			trimmedLineText,
			INTERLUDE_SPECIAL_HEADING_VARIANT_REGEXES,
		) ||
		matchesSpecialHeadingVariant(
			lowercaseLineText,
			INTERLUDE_SPECIAL_HEADING_VARIANT_REGEXES_ENGLISH,
		) ||
		SPECIAL_FANWAI_HEADING_REGEX.test(trimmedLineText) ||
		SPECIAL_TEBIE_HEADING_REGEX.test(trimmedLineText) ||
		SPECIAL_EXTRA_CHAPTER_HEADING_REGEX.test(trimmedLineText)
	) {
		return {
			title: normalizeDetectedChapterTitle(line.matchableText),
			startOffset: line.startOffset,
			lineIndex: line.lineIndex,
			kind: 'special',
			role: 'interlude',
		};
	}

	return null;
}

function detectStructuredPlainHeading(
	line: RewardReaderSourceLine,
): RewardReaderDetectedChapterHeading | null {
	const normalizedLineText = trimRewardReaderHorizontalWhitespace(
		line.matchableText,
	);
	return (
		detectStrongChineseChapterHeading(line, normalizedLineText) ??
		detectEnglishChapterHeading(line, normalizedLineText) ??
		detectSpecialChapterHeading(line, normalizedLineText)
	);
}

function isSpecialChapterHeading(
	heading: RewardReaderDetectedChapterHeading,
): heading is RewardReaderSpecialChapterHeading {
	return heading.kind === 'special';
}

function detectMarkdownChapterHeading(
	line: RewardReaderSourceLine,
): RewardReaderDetectedChapterHeading | null {
	if (!MARKDOWN_HEADING_PREFIX_REGEX.test(line.matchableText)) {
		return null;
	}

	const withoutMarkdownPrefix = line.matchableText.replace(
		MARKDOWN_HEADING_PREFIX_REGEX,
		'',
	);
	const normalizedLineText = trimRewardReaderHorizontalWhitespace(
		withoutMarkdownPrefix,
	);
	const structuredHeading =
		detectStrongChineseChapterHeading(line, normalizedLineText) ??
		detectEnglishChapterHeading(line, normalizedLineText) ??
		detectSpecialChapterHeading(line, normalizedLineText);
	if (!structuredHeading) {
		return null;
	}

	return {
		...structuredHeading,
		title: normalizeDetectedChapterTitle(line.matchableText),
	};
}

function detectNumericColonCandidate(
	line: RewardReaderSourceLine,
): RewardReaderNumericColonCandidate | null {
	const match = line.matchableText.match(NUMERIC_COLON_HEADING_REGEX);
	if (!match) {
		return null;
	}

	const rawDigits = match[1] ?? '';
	const chapterNumber = parseNumericChapterNumber(rawDigits);
	if (chapterNumber === null) {
		return null;
	}

	const delimiter = (match[2] ?? ':') as ':' | typeof FULLWIDTH_COLON;
	const title = normalizeDetectedChapterTitle(line.matchableText);
	if (title.length === 0) {
		return null;
	}

	const normalizedDigits = normalizeAsciiDigits(rawDigits);
	return {
		title,
		startOffset: line.startOffset,
		chapterNumber,
		rawDigits,
		digitWidth: Array.from(rawDigits).length,
		hasLeadingZero:
			normalizedDigits.length > 1 && normalizedDigits.startsWith('0'),
		delimiter,
		lineIndex: line.lineIndex,
	};
}

function buildRewardReaderChapterEntries(
	sourceTextLength: number,
	headings: RewardReaderDetectedChapterHeading[],
): RewardReaderChapterIndexEntry[] {
	return headings.map((heading, index) => ({
		chapterIndex: index,
		title: heading.title,
		startOffset: heading.startOffset,
		endOffset:
			index + 1 < headings.length
				? headings[index + 1]!.startOffset
				: sourceTextLength,
	}));
}

function collectSpecialCandidatesByRole(
	specialCandidates: readonly RewardReaderSpecialChapterHeading[],
	role: RewardReaderSpecialChapterHeading['role'],
): RewardReaderSpecialChapterHeading[] {
	return specialCandidates.filter((candidate) => candidate.role === role);
}

function getBodyEvidenceLength(
	sourceLines: readonly RewardReaderSourceLine[],
	startLineIndex: number,
	endLineIndex: number,
	excludedLineIndexes?: ReadonlySet<number>,
	minimumBodyEvidenceLength = MIN_NUMERIC_COLON_BODY_EVIDENCE_LENGTH,
): number {
	let bodyEvidenceLength = 0;

	for (let lineIndex = startLineIndex; lineIndex < endLineIndex; lineIndex += 1) {
		if (excludedLineIndexes?.has(lineIndex)) {
			continue;
		}

		const line = sourceLines[lineIndex];
		if (!line) {
			continue;
		}

		const trimmedLineText = trimRewardReaderHorizontalWhitespace(
			line.matchableText,
		);
		if (trimmedLineText.length === 0) {
			continue;
		}

		bodyEvidenceLength += trimmedLineText.length;
		if (bodyEvidenceLength >= minimumBodyEvidenceLength) {
			return bodyEvidenceLength;
		}
	}

	return bodyEvidenceLength;
}

function selectSpecialCandidatesInRegion(
	candidates: readonly RewardReaderSpecialChapterHeading[],
	sourceLines: readonly RewardReaderSourceLine[],
	excludedLineIndexes: ReadonlySet<number>,
	leadingAnchorLineIndex: number | null,
	trailingAnchorLineIndex: number | null,
): RewardReaderSpecialChapterHeading[] {
	const selectedCandidates: RewardReaderSpecialChapterHeading[] = [];

	for (const candidate of candidates) {
		if (selectedCandidates.length === 0) {
			if (
				leadingAnchorLineIndex !== null &&
				getBodyEvidenceLength(
					sourceLines,
					leadingAnchorLineIndex + 1,
					candidate.lineIndex,
					excludedLineIndexes,
					MIN_SPECIAL_HEADING_BODY_EVIDENCE_LENGTH,
				) < MIN_SPECIAL_HEADING_BODY_EVIDENCE_LENGTH
			) {
				continue;
			}

			selectedCandidates.push(candidate);
			continue;
		}

		if (
			getBodyEvidenceLength(
				sourceLines,
				selectedCandidates[selectedCandidates.length - 1]!.lineIndex + 1,
				candidate.lineIndex,
				excludedLineIndexes,
				MIN_SPECIAL_HEADING_BODY_EVIDENCE_LENGTH,
			) < MIN_SPECIAL_HEADING_BODY_EVIDENCE_LENGTH
		) {
			continue;
		}

		selectedCandidates.push(candidate);
	}

	if (trailingAnchorLineIndex !== null) {
		while (selectedCandidates.length > 0) {
			const lastCandidate = selectedCandidates[selectedCandidates.length - 1]!;
			if (
				getBodyEvidenceLength(
					sourceLines,
					lastCandidate.lineIndex + 1,
					trailingAnchorLineIndex,
					excludedLineIndexes,
					MIN_SPECIAL_HEADING_BODY_EVIDENCE_LENGTH,
				) >= MIN_SPECIAL_HEADING_BODY_EVIDENCE_LENGTH
			) {
				break;
			}

			selectedCandidates.pop();
		}
	}

	return selectedCandidates;
}

function mergeStrongAndSpecialHeadings(
	strongHeadings: readonly RewardReaderDetectedChapterHeading[],
	specialHeadings: readonly RewardReaderSpecialChapterHeading[],
	sourceLines: readonly RewardReaderSourceLine[],
): RewardReaderDetectedChapterHeading[] {
	if (strongHeadings.length === 0) {
		return [];
	}

	const specialLineIndexes = new Set<number>(
		specialHeadings.map((candidate) => candidate.lineIndex),
	);
	const selectedSpecialHeadings: RewardReaderSpecialChapterHeading[] = [];

	const firstStrongHeading = strongHeadings[0]!;
	const leadingSpecialHeadings = selectSpecialCandidatesInRegion(
		collectSpecialCandidatesByRole(specialHeadings, 'preface').concat(
			collectSpecialCandidatesByRole(specialHeadings, 'interlude'),
		)
			.filter((candidate) => candidate.lineIndex < firstStrongHeading.lineIndex)
			.sort((left, right) => left.lineIndex - right.lineIndex),
		sourceLines,
		specialLineIndexes,
		null,
		firstStrongHeading.lineIndex,
	);
	selectedSpecialHeadings.push(...leadingSpecialHeadings);

	for (let index = 0; index + 1 < strongHeadings.length; index += 1) {
		const currentStrongHeading = strongHeadings[index]!;
		const nextStrongHeading = strongHeadings[index + 1]!;
		const interludeSpecialHeadings = selectSpecialCandidatesInRegion(
			collectSpecialCandidatesByRole(specialHeadings, 'interlude')
				.filter(
					(candidate) =>
						candidate.lineIndex > currentStrongHeading.lineIndex &&
						candidate.lineIndex < nextStrongHeading.lineIndex,
				)
				.sort((left, right) => left.lineIndex - right.lineIndex),
			sourceLines,
			specialLineIndexes,
			currentStrongHeading.lineIndex,
			nextStrongHeading.lineIndex,
		);
		selectedSpecialHeadings.push(...interludeSpecialHeadings);
	}

	const lastStrongHeading = strongHeadings[strongHeadings.length - 1]!;
	const trailingSpecialHeadings = selectSpecialCandidatesInRegion(
		collectSpecialCandidatesByRole(specialHeadings, 'interlude')
			.concat(collectSpecialCandidatesByRole(specialHeadings, 'ending'))
			.filter((candidate) => candidate.lineIndex > lastStrongHeading.lineIndex)
			.sort((left, right) => left.lineIndex - right.lineIndex),
		sourceLines,
		specialLineIndexes,
		lastStrongHeading.lineIndex,
		null,
	);
	selectedSpecialHeadings.push(...trailingSpecialHeadings);

	return strongHeadings
		.concat(selectedSpecialHeadings)
		.sort((left, right) => left.lineIndex - right.lineIndex);
}

function detectPlainStructuredHeadings(
	sourceLines: readonly RewardReaderSourceLine[],
): RewardReaderDetectedChapterHeading[] {
	const strongHeadings: RewardReaderDetectedChapterHeading[] = [];
	const specialHeadings: RewardReaderSpecialChapterHeading[] = [];

	for (const line of sourceLines) {
		if (MARKDOWN_HEADING_PREFIX_REGEX.test(line.matchableText)) {
			continue;
		}

		const structuredHeading = detectStructuredPlainHeading(line);
		if (!structuredHeading) {
			continue;
		}

		if (isSpecialChapterHeading(structuredHeading)) {
			specialHeadings.push(structuredHeading);
		} else {
			strongHeadings.push(structuredHeading);
		}
	}

	if (strongHeadings.length > 0) {
		return mergeStrongAndSpecialHeadings(
			strongHeadings,
			specialHeadings,
			sourceLines,
		);
	}

	if (specialHeadings.length < MIN_SPECIAL_STANDALONE_HEADING_COUNT) {
		return [];
	}

	const specialLineIndexes = new Set<number>(
		specialHeadings.map((candidate) => candidate.lineIndex),
	);
	const standaloneSpecialHeadings = selectSpecialCandidatesInRegion(
		specialHeadings.slice().sort((left, right) => left.lineIndex - right.lineIndex),
		sourceLines,
		specialLineIndexes,
		null,
		null,
	);

	return standaloneSpecialHeadings.length >= MIN_SPECIAL_STANDALONE_HEADING_COUNT
		? standaloneSpecialHeadings
		: [];
}

function buildNumericColonEvidenceContext(
	sourceLines: readonly RewardReaderSourceLine[],
): RewardReaderNumericColonEvidenceContext {
	const bodyEvidencePrefix = new Array<number>(sourceLines.length + 1).fill(0);

	for (let lineIndex = 0; lineIndex < sourceLines.length; lineIndex += 1) {
		let lineEvidenceLength = 0;
		const line = sourceLines[lineIndex];
		if (line) {
			const trimmedLineText = trimRewardReaderHorizontalWhitespace(
				line.matchableText,
			);
			lineEvidenceLength = trimmedLineText.length;
		}

		bodyEvidencePrefix[lineIndex + 1] =
			bodyEvidencePrefix[lineIndex]! + lineEvidenceLength;
	}

	return {
		bodyEvidencePrefix,
	};
}

function getNumericColonBodyEvidenceLength(
	evidenceContext: RewardReaderNumericColonEvidenceContext,
	startLineIndex: number,
	endLineIndex: number,
): number {
	const boundedStartLineIndex = Math.max(0, startLineIndex);
	const boundedEndLineIndex = Math.min(
		evidenceContext.bodyEvidencePrefix.length - 1,
		endLineIndex,
	);
	if (boundedEndLineIndex <= boundedStartLineIndex) {
		return 0;
	}

	return (
		evidenceContext.bodyEvidencePrefix[boundedEndLineIndex]! -
		evidenceContext.bodyEvidencePrefix[boundedStartLineIndex]!
	);
}

function normalizeNumericColonTitleTailForContinuity(title: string): string {
	return normalizeAsciiDigits(
		title.replace(
			/^\s*[0-9０-９]+\s*[:：]\s*/u,
			'',
		),
	)
		.trim()
		.toLowerCase()
		.replace(/\s+/gu, ' ')
		.replace(/[0-9]+/gu, '#');
}

function getCommonPrefixLength(leftText: string, rightText: string): number {
	const maxLength = Math.min(leftText.length, rightText.length);

	for (let index = 0; index < maxLength; index += 1) {
		if (leftText[index] !== rightText[index]) {
			return index;
		}
	}

	return maxLength;
}

function scoreNumericColonTitleContinuity(
	candidate: RewardReaderNumericColonCandidate,
	neighbor: RewardReaderNumericColonCandidate | null,
): number {
	if (!neighbor) {
		return 0;
	}

	const normalizedCandidateTail =
		normalizeNumericColonTitleTailForContinuity(candidate.title);
	const normalizedNeighborTail =
		normalizeNumericColonTitleTailForContinuity(neighbor.title);
	if (
		normalizedCandidateTail.length === 0 ||
		normalizedNeighborTail.length === 0
	) {
		return 0;
	}

	let score =
		getCommonPrefixLength(
			normalizedCandidateTail,
			normalizedNeighborTail,
		) * 4;
	if (normalizedCandidateTail === normalizedNeighborTail) {
		score += 16;
	}
	if (normalizedCandidateTail[0] === normalizedNeighborTail[0]) {
		score += 2;
	}

	return score;
}

function getMedianNumber(values: readonly number[]): number | null {
	if (values.length === 0) {
		return null;
	}

	const sortedValues = [...values].sort((left, right) => left - right);
	const middleIndex = Math.floor(sortedValues.length / 2);
	if (sortedValues.length % 2 === 1) {
		return sortedValues[middleIndex] ?? null;
	}

	const leftValue = sortedValues[middleIndex - 1];
	const rightValue = sortedValues[middleIndex];
	return leftValue !== undefined && rightValue !== undefined
		? (leftValue + rightValue) / 2
		: null;
}

function buildNumericColonSpacingModel(
	selectedCandidates: readonly RewardReaderNumericColonCandidate[],
): RewardReaderNumericColonSpacingModel {
	const normalizedOffsetDistances: number[] = [];
	const normalizedLineDistances: number[] = [];

	for (
		let candidateIndex = 0;
		candidateIndex + 1 < selectedCandidates.length;
		candidateIndex += 1
	) {
		const leftCandidate = selectedCandidates[candidateIndex]!;
		const rightCandidate = selectedCandidates[candidateIndex + 1]!;
		const chapterDelta =
			rightCandidate.chapterNumber - leftCandidate.chapterNumber;
		if (chapterDelta <= 0) {
			continue;
		}

		normalizedOffsetDistances.push(
			(rightCandidate.startOffset - leftCandidate.startOffset) / chapterDelta,
		);
		normalizedLineDistances.push(
			(rightCandidate.lineIndex - leftCandidate.lineIndex) / chapterDelta,
		);
	}

	return {
		expectedOffsetDistancePerChapter: getMedianNumber(
			normalizedOffsetDistances,
		),
		expectedLineDistancePerChapter: getMedianNumber(normalizedLineDistances),
	};
}

function getNumericColonExpectedIntervalDeviation(
	actualDistance: number | null,
	expectedDistance: number | null,
): number | null {
	if (
		actualDistance === null ||
		expectedDistance === null ||
		!Number.isFinite(actualDistance) ||
		!Number.isFinite(expectedDistance) ||
		expectedDistance <= 0
	) {
		return null;
	}

	return Math.abs(actualDistance - expectedDistance) / expectedDistance;
}

function countNumericColonStyleMismatches(
	candidate: RewardReaderNumericColonCandidate,
	neighbor: RewardReaderNumericColonCandidate | null,
): number {
	if (!neighbor) {
		return 0;
	}

	let mismatchCount = 0;
	if (candidate.digitWidth !== neighbor.digitWidth) {
		mismatchCount += 1;
	}
	if (candidate.hasLeadingZero !== neighbor.hasLeadingZero) {
		mismatchCount += 1;
	}
	if (candidate.delimiter !== neighbor.delimiter) {
		mismatchCount += 1;
	}

	return mismatchCount;
}

function compareNumericColonCanonicalCandidateScores(
	leftScore: RewardReaderNumericColonCanonicalCandidateScore,
	rightScore: RewardReaderNumericColonCanonicalCandidateScore,
): number {
	if (leftScore.extremeIntervalCount !== rightScore.extremeIntervalCount) {
		return rightScore.extremeIntervalCount - leftScore.extremeIntervalCount;
	}
	if (leftScore.anchoredSideCount !== rightScore.anchoredSideCount) {
		return leftScore.anchoredSideCount - rightScore.anchoredSideCount;
	}
	if (leftScore.supportedSideCount !== rightScore.supportedSideCount) {
		return leftScore.supportedSideCount - rightScore.supportedSideCount;
	}
	if (
		leftScore.bodyEvidenceFloorSatisfied !==
		rightScore.bodyEvidenceFloorSatisfied
	) {
		return Number(leftScore.bodyEvidenceFloorSatisfied) -
			Number(rightScore.bodyEvidenceFloorSatisfied);
	}
	if (leftScore.styleMismatchCount !== rightScore.styleMismatchCount) {
		return rightScore.styleMismatchCount - leftScore.styleMismatchCount;
	}
	if (
		leftScore.combinedOffsetDeviation !== rightScore.combinedOffsetDeviation
	) {
		return (
			rightScore.combinedOffsetDeviation - leftScore.combinedOffsetDeviation
		);
	}
	if (
		leftScore.combinedLineDeviation !== rightScore.combinedLineDeviation
	) {
		return (
			rightScore.combinedLineDeviation - leftScore.combinedLineDeviation
		);
	}
	if (leftScore.intervalImbalance !== rightScore.intervalImbalance) {
		return (
			rightScore.intervalImbalance - leftScore.intervalImbalance
		);
	}
	if (
		leftScore.minimumAdjacentBodyEvidence !==
		rightScore.minimumAdjacentBodyEvidence
	) {
		return (
			leftScore.minimumAdjacentBodyEvidence -
			rightScore.minimumAdjacentBodyEvidence
		);
	}
	if (
		leftScore.totalAdjacentBodyEvidence !==
		rightScore.totalAdjacentBodyEvidence
	) {
		return (
			leftScore.totalAdjacentBodyEvidence - rightScore.totalAdjacentBodyEvidence
		);
	}

	return 0;
}

function hasClearNumericColonCanonicalWinner(
	bestScore: RewardReaderNumericColonCanonicalCandidateScore,
	secondScore: RewardReaderNumericColonCanonicalCandidateScore,
): boolean {
	if (
		bestScore.extremeIntervalCount < secondScore.extremeIntervalCount
	) {
		return true;
	}
	if (
		bestScore.anchoredSideCount >= 2 &&
		secondScore.anchoredSideCount >= 2 &&
		(bestScore.supportedSideCount > secondScore.supportedSideCount ||
			(bestScore.bodyEvidenceFloorSatisfied &&
				!secondScore.bodyEvidenceFloorSatisfied))
	) {
		return true;
	}
	if (bestScore.styleMismatchCount < secondScore.styleMismatchCount) {
		return true;
	}
	if (
		secondScore.combinedOffsetDeviation -
			bestScore.combinedOffsetDeviation >=
		NUMERIC_COLON_DECISIVE_DEVIATION_MARGIN
	) {
		return true;
	}
	if (
		secondScore.combinedLineDeviation - bestScore.combinedLineDeviation >=
		NUMERIC_COLON_DECISIVE_LINE_DEVIATION_MARGIN
	) {
		return true;
	}
	if (
		secondScore.intervalImbalance - bestScore.intervalImbalance >=
		NUMERIC_COLON_DECISIVE_IMBALANCE_MARGIN
	) {
		return true;
	}

	return false;
}

function hasClearNumericColonInsertionWinner(
	bestScore: RewardReaderNumericColonCanonicalCandidateScore,
	secondScore: RewardReaderNumericColonCanonicalCandidateScore,
): boolean {
	const offsetAdvantage =
		secondScore.combinedOffsetDeviation -
			bestScore.combinedOffsetDeviation >=
		NUMERIC_COLON_DECISIVE_DEVIATION_MARGIN;
	const lineAdvantage =
		secondScore.combinedLineDeviation - bestScore.combinedLineDeviation >=
		NUMERIC_COLON_DECISIVE_LINE_DEVIATION_MARGIN;
	const imbalanceAdvantage =
		secondScore.intervalImbalance - bestScore.intervalImbalance >=
		NUMERIC_COLON_DECISIVE_IMBALANCE_MARGIN;
	if (
		bestScore.extremeIntervalCount < secondScore.extremeIntervalCount &&
		(offsetAdvantage || lineAdvantage || imbalanceAdvantage)
	) {
		return true;
	}

	return (
		Number(offsetAdvantage) +
			Number(lineAdvantage) +
			Number(imbalanceAdvantage) >=
		2
	);
}

function scoreNumericColonCanonicalCandidate(
	evidenceContext: RewardReaderNumericColonEvidenceContext,
	spacingModel: RewardReaderNumericColonSpacingModel,
	candidate: RewardReaderNumericColonCandidate,
	previousCandidate: RewardReaderNumericColonCandidate | null,
	nextCandidate: RewardReaderNumericColonCandidate | null,
	previousCompetingCandidate: RewardReaderNumericColonCandidate | null,
	nextCompetingCandidate: RewardReaderNumericColonCandidate | null,
	sourceLineCount: number,
): RewardReaderNumericColonCanonicalCandidateScore {
	const leftEvidenceLength =
		previousCompetingCandidate !== null
			? getNumericColonBodyEvidenceLength(
					evidenceContext,
					previousCompetingCandidate.lineIndex + 1,
					candidate.lineIndex,
				)
			: previousCandidate === null
			? getNumericColonBodyEvidenceLength(
					evidenceContext,
					0,
					candidate.lineIndex,
				)
			: getNumericColonBodyEvidenceLength(
					evidenceContext,
					previousCandidate.lineIndex + 1,
					candidate.lineIndex,
				);
	const rightEvidenceLength =
		nextCompetingCandidate !== null
			? getNumericColonBodyEvidenceLength(
					evidenceContext,
					candidate.lineIndex + 1,
					nextCompetingCandidate.lineIndex,
				)
			: nextCandidate === null
			? getNumericColonBodyEvidenceLength(
					evidenceContext,
					candidate.lineIndex + 1,
					sourceLineCount,
				)
			: getNumericColonBodyEvidenceLength(
					evidenceContext,
					candidate.lineIndex + 1,
					nextCandidate.lineIndex,
				);
	const anchoredSideCount =
		(previousCandidate === null ? 0 : 1) + (nextCandidate === null ? 0 : 1);
	const supportedSideCount =
		(previousCandidate !== null &&
		previousCompetingCandidate === null &&
		leftEvidenceLength >= MIN_NUMERIC_COLON_BODY_EVIDENCE_LENGTH
			? 1
			: 0) +
		(nextCandidate !== null &&
		nextCompetingCandidate === null &&
		rightEvidenceLength >= MIN_NUMERIC_COLON_BODY_EVIDENCE_LENGTH
			? 1
			: 0);
	const leftChapterDelta =
		previousCandidate === null
			? null
			: candidate.chapterNumber - previousCandidate.chapterNumber;
	const rightChapterDelta =
		nextCandidate === null
			? null
			: nextCandidate.chapterNumber - candidate.chapterNumber;
	const normalizedLeftOffsetDistance =
		previousCandidate !== null &&
		leftChapterDelta !== null &&
		leftChapterDelta > 0
			? (candidate.startOffset - previousCandidate.startOffset) /
				leftChapterDelta
			: null;
	const normalizedRightOffsetDistance =
		nextCandidate !== null && rightChapterDelta !== null && rightChapterDelta > 0
			? (nextCandidate.startOffset - candidate.startOffset) / rightChapterDelta
			: null;
	const normalizedLeftLineDistance =
		previousCandidate !== null &&
		leftChapterDelta !== null &&
		leftChapterDelta > 0
			? (candidate.lineIndex - previousCandidate.lineIndex) / leftChapterDelta
			: null;
	const normalizedRightLineDistance =
		nextCandidate !== null && rightChapterDelta !== null && rightChapterDelta > 0
			? (nextCandidate.lineIndex - candidate.lineIndex) / rightChapterDelta
			: null;
	const leftOffsetDeviation = getNumericColonExpectedIntervalDeviation(
		normalizedLeftOffsetDistance,
		spacingModel.expectedOffsetDistancePerChapter,
	);
	const rightOffsetDeviation = getNumericColonExpectedIntervalDeviation(
		normalizedRightOffsetDistance,
		spacingModel.expectedOffsetDistancePerChapter,
	);
	const leftLineDeviation = getNumericColonExpectedIntervalDeviation(
		normalizedLeftLineDistance,
		spacingModel.expectedLineDistancePerChapter,
	);
	const rightLineDeviation = getNumericColonExpectedIntervalDeviation(
		normalizedRightLineDistance,
		spacingModel.expectedLineDistancePerChapter,
	);
	const combinedOffsetDeviation = getMedianNumber(
		[leftOffsetDeviation, rightOffsetDeviation].filter(
			(value): value is number => value !== null,
		),
	) ?? 0;
	const combinedLineDeviation = getMedianNumber(
		[leftLineDeviation, rightLineDeviation].filter(
			(value): value is number => value !== null,
		),
	) ?? 0;
	const intervalImbalance =
		leftOffsetDeviation !== null && rightOffsetDeviation !== null
			? Math.abs(leftOffsetDeviation - rightOffsetDeviation)
			: 0;
	const styleMismatchCount =
		countNumericColonStyleMismatches(candidate, previousCandidate) +
		countNumericColonStyleMismatches(candidate, nextCandidate);
	const extremeIntervalCount =
		(leftOffsetDeviation !== null &&
		leftOffsetDeviation >= NUMERIC_COLON_EXTREME_INTERVAL_DEVIATION_THRESHOLD
			? 1
			: 0) +
		(rightOffsetDeviation !== null &&
		rightOffsetDeviation >= NUMERIC_COLON_EXTREME_INTERVAL_DEVIATION_THRESHOLD
			? 1
			: 0);

	return {
		anchoredSideCount,
		supportedSideCount,
		bodyEvidenceFloorSatisfied:
			supportedSideCount >= Math.min(anchoredSideCount, 2),
		minimumAdjacentBodyEvidence: Math.min(
			leftEvidenceLength,
			rightEvidenceLength,
		),
		totalAdjacentBodyEvidence: leftEvidenceLength + rightEvidenceLength,
		styleMismatchCount,
		extremeIntervalCount,
		combinedOffsetDeviation,
		combinedLineDeviation,
		intervalImbalance,
		titleContinuityScore:
			scoreNumericColonTitleContinuity(candidate, previousCandidate) +
			scoreNumericColonTitleContinuity(candidate, nextCandidate),
	};
}

function createDuplicateNumberAmbiguityIssue(
	chapterNumber: number,
	competingCandidates: readonly RewardReaderNumericColonCandidate[],
): RewardReaderChapterParseBlockingIssue {
	return {
		code: 'ambiguous-duplicate-chapter-number',
		detectionMode: 'numeric-colon',
		chapterNumber,
		candidateCount: competingCandidates.length,
		candidates: competingCandidates
			.slice(0, MAX_NUMERIC_COLON_AMBIGUITY_PREVIEW_CANDIDATES)
			.map((candidate) => ({
				heading: candidate.title,
				lineIndex: candidate.lineIndex,
				startOffset: candidate.startOffset,
			})),
		message: `Reward Reader found multiple unresolved chapter-heading candidates for chapter ${chapterNumber}.`,
	};
}

function buildNumericColonCandidateGroupsByChapterNumber(
	candidates: readonly RewardReaderNumericColonCandidate[],
): Map<number, RewardReaderNumericColonCandidate[]> {
	const candidateGroups = new Map<
		number,
		RewardReaderNumericColonCandidate[]
	>();

	for (const candidate of candidates) {
		const existingGroup = candidateGroups.get(candidate.chapterNumber);
		if (existingGroup) {
			existingGroup.push(candidate);
			continue;
		}

		candidateGroups.set(candidate.chapterNumber, [candidate]);
	}

	return candidateGroups;
}

function getNumericColonCandidatesWithinLineBounds(
	candidates: readonly RewardReaderNumericColonCandidate[],
	lowerExclusiveLineIndex: number,
	upperExclusiveLineIndex: number,
): RewardReaderNumericColonCandidate[] {
	return candidates.filter(
		(candidate) =>
			candidate.lineIndex > lowerExclusiveLineIndex &&
			candidate.lineIndex < upperExclusiveLineIndex,
	);
}

function resolveNumericColonCanonicalCandidates(
	competingCandidates: readonly RewardReaderNumericColonCandidate[],
	evidenceContext: RewardReaderNumericColonEvidenceContext,
	spacingModel: RewardReaderNumericColonSpacingModel,
	previousCandidate: RewardReaderNumericColonCandidate | null,
	nextCandidate: RewardReaderNumericColonCandidate | null,
	sourceLineCount: number,
	requireInsertionMargin: boolean,
): RewardReaderNumericColonCandidate | null {
	if (competingCandidates.length === 0) {
		return null;
	}

	if (competingCandidates.length === 1) {
		return competingCandidates[0] ?? null;
	}

	const scoredCandidates: RewardReaderScoredNumericColonCanonicalCandidate[] =
		competingCandidates.map((candidate, candidateIndex) => ({
			candidate,
			score: scoreNumericColonCanonicalCandidate(
				evidenceContext,
				spacingModel,
				candidate,
				previousCandidate,
				nextCandidate,
				candidateIndex > 0
					? competingCandidates[candidateIndex - 1]!
					: null,
				candidateIndex + 1 < competingCandidates.length
					? competingCandidates[candidateIndex + 1]!
					: null,
				sourceLineCount,
			),
		}));
	scoredCandidates.sort((left, right) => {
		const comparison = compareNumericColonCanonicalCandidateScores(
			right.score,
			left.score,
		);
		if (comparison !== 0) {
			return comparison;
		}

		return 0;
	});

	const bestCandidate = scoredCandidates[0];
	const secondBestCandidate = scoredCandidates[1] ?? null;
	if (
		!bestCandidate ||
		!secondBestCandidate ||
		compareNumericColonCanonicalCandidateScores(
			bestCandidate.score,
			secondBestCandidate.score,
		) <= 0 ||
		!hasClearNumericColonCanonicalWinner(
			bestCandidate.score,
			secondBestCandidate.score,
		)
	) {
		return null;
	}
	if (
		requireInsertionMargin &&
		!hasClearNumericColonInsertionWinner(
			bestCandidate.score,
			secondBestCandidate.score,
		)
	) {
		return null;
	}

	for (
		let candidateIndex = 1;
		candidateIndex < scoredCandidates.length;
		candidateIndex += 1
	) {
		const competingScoredCandidate = scoredCandidates[candidateIndex]!;
		if (
			compareNumericColonCanonicalCandidateScores(
				bestCandidate.score,
				competingScoredCandidate.score,
			) <= 0 ||
			!hasClearNumericColonCanonicalWinner(
				bestCandidate.score,
				competingScoredCandidate.score,
			)
		) {
			return null;
		}
		if (
			requireInsertionMargin &&
			!hasClearNumericColonInsertionWinner(
				bestCandidate.score,
				competingScoredCandidate.score,
			)
		) {
			return null;
		}
	}

	return bestCandidate.candidate;
}

function canonicalizeNumericColonRunCandidates(
	selectedCandidates: readonly RewardReaderNumericColonCandidate[],
	allCandidates: readonly RewardReaderNumericColonCandidate[],
	sourceLines: readonly RewardReaderSourceLine[],
):
	| {
			ok: true;
			candidates: RewardReaderNumericColonCandidate[];
	  }
	| {
			ok: false;
			issues: RewardReaderChapterParseBlockingIssue[];
	  } {
	if (selectedCandidates.length === 0) {
		return {
			ok: true,
			candidates: [],
		};
	}

	const evidenceContext = buildNumericColonEvidenceContext(sourceLines);
	const spacingModel = buildNumericColonSpacingModel(selectedCandidates);
	const candidateGroupsByChapterNumber =
		buildNumericColonCandidateGroupsByChapterNumber(allCandidates);
	const canonicalCandidates: RewardReaderNumericColonCandidate[] = [];
	const ambiguityIssues: RewardReaderChapterParseBlockingIssue[] = [];
	const firstSelectedCandidate = selectedCandidates[0]!;
	const lastSelectedCandidate =
		selectedCandidates[selectedCandidates.length - 1]!;
	let previousCanonicalCandidate: RewardReaderNumericColonCandidate | null = null;
	let selectedCandidateIndex = 0;

	for (
		let chapterNumber = firstSelectedCandidate.chapterNumber;
		chapterNumber <= lastSelectedCandidate.chapterNumber;
		chapterNumber += 1
	) {
		const currentSelectedCandidate =
			selectedCandidateIndex < selectedCandidates.length &&
			selectedCandidates[selectedCandidateIndex]!.chapterNumber ===
				chapterNumber
				? selectedCandidates[selectedCandidateIndex]!
				: null;
		const nextSelectedCandidate =
			currentSelectedCandidate !== null
				? selectedCandidateIndex + 1 < selectedCandidates.length
					? selectedCandidates[selectedCandidateIndex + 1]!
					: null
				: selectedCandidateIndex < selectedCandidates.length
					? selectedCandidates[selectedCandidateIndex]!
					: null;
		const lowerLineIndex = previousCanonicalCandidate?.lineIndex ?? -1;
		const upperLineIndex = nextSelectedCandidate?.lineIndex ?? sourceLines.length;
		const chapterNumberCandidates =
			candidateGroupsByChapterNumber.get(chapterNumber) ?? [];
		const competingCandidates = getNumericColonCandidatesWithinLineBounds(
			chapterNumberCandidates,
			lowerLineIndex,
			upperLineIndex,
		);
		const shouldResolveCompetingCandidates =
			currentSelectedCandidate !== null || competingCandidates.length > 1;
		if (!shouldResolveCompetingCandidates) {
			if (currentSelectedCandidate !== null) {
				canonicalCandidates.push(currentSelectedCandidate);
				previousCanonicalCandidate = currentSelectedCandidate;
				selectedCandidateIndex += 1;
			}
			continue;
		}
		if (
			competingCandidates.length > MAX_NUMERIC_COLON_DUPLICATE_GROUP_CANDIDATES
		) {
			ambiguityIssues.push(
				createDuplicateNumberAmbiguityIssue(
					chapterNumber,
					competingCandidates,
				),
			);
			if (currentSelectedCandidate !== null) {
				selectedCandidateIndex += 1;
			}
			continue;
		}

		const canonicalCandidate = resolveNumericColonCanonicalCandidates(
			competingCandidates,
			evidenceContext,
			spacingModel,
			previousCanonicalCandidate,
			nextSelectedCandidate,
			sourceLines.length,
			currentSelectedCandidate === null,
		);
		if (!canonicalCandidate) {
			ambiguityIssues.push(
				createDuplicateNumberAmbiguityIssue(
					chapterNumber,
					competingCandidates,
				),
			);
			if (currentSelectedCandidate !== null) {
				selectedCandidateIndex += 1;
			}
			continue;
		}

		canonicalCandidates.push(canonicalCandidate);
		previousCanonicalCandidate = canonicalCandidate;
		if (currentSelectedCandidate !== null) {
			selectedCandidateIndex += 1;
		}
	}

	if (ambiguityIssues.length > 0) {
		return {
			ok: false,
			issues: ambiguityIssues,
		};
	}

	return {
		ok: true,
		candidates: canonicalCandidates,
	};
}

function scoreNumericColonStyleTransition(
	leftCandidate: RewardReaderNumericColonCandidate,
	rightCandidate: RewardReaderNumericColonCandidate,
): number {
	let styleScore = 0;
	if (leftCandidate.digitWidth === rightCandidate.digitWidth) {
		styleScore += 4;
	}
	if (leftCandidate.hasLeadingZero === rightCandidate.hasLeadingZero) {
		styleScore += 3;
	}
	if (leftCandidate.delimiter === rightCandidate.delimiter) {
		styleScore += 2;
	}
	if (
		normalizeAsciiDigits(leftCandidate.rawDigits).length ===
		normalizeAsciiDigits(rightCandidate.rawDigits).length
	) {
		styleScore += 1;
	}

	return styleScore;
}

function compareNumericColonRunStates(
	leftState: RewardReaderNumericColonRunState,
	rightState: RewardReaderNumericColonRunState,
): number {
	const leftGapSeverity =
		leftState.maxGapPenalty > 8 || leftState.totalGapPenalty > 12
			? 2
			: leftState.maxGapPenalty > 2 || leftState.totalGapPenalty > 3
				? 1
				: 0;
	const rightGapSeverity =
		rightState.maxGapPenalty > 8 || rightState.totalGapPenalty > 12
			? 2
			: rightState.maxGapPenalty > 2 || rightState.totalGapPenalty > 3
				? 1
				: 0;
	if (leftGapSeverity !== rightGapSeverity) {
		return rightGapSeverity - leftGapSeverity;
	}

	const leftContinuousTransitions =
		leftState.length - 1 - leftState.gapTransitionCount;
	const rightContinuousTransitions =
		rightState.length - 1 - rightState.gapTransitionCount;
	if (leftContinuousTransitions !== rightContinuousTransitions) {
		return leftContinuousTransitions - rightContinuousTransitions;
	}

	if (leftState.length !== rightState.length) {
		return leftState.length - rightState.length;
	}

	const leftChapterSpan =
		leftState.lastChapterNumber - leftState.firstChapterNumber + 1;
	const rightChapterSpan =
		rightState.lastChapterNumber - rightState.firstChapterNumber + 1;
	const densityComparison =
		leftState.length * rightChapterSpan - rightState.length * leftChapterSpan;
	if (densityComparison !== 0) {
		return densityComparison;
	}

	if (leftState.maxGapPenalty !== rightState.maxGapPenalty) {
		return rightState.maxGapPenalty - leftState.maxGapPenalty;
	}
	if (leftState.totalGapPenalty !== rightState.totalGapPenalty) {
		return rightState.totalGapPenalty - leftState.totalGapPenalty;
	}
	if (leftState.totalSkippedCandidates !== rightState.totalSkippedCandidates) {
		return rightState.totalSkippedCandidates - leftState.totalSkippedCandidates;
	}
	if (leftState.styleScore !== rightState.styleScore) {
		return leftState.styleScore - rightState.styleScore;
	}
	if (leftState.totalBodyEvidenceLength !== rightState.totalBodyEvidenceLength) {
		return leftState.totalBodyEvidenceLength - rightState.totalBodyEvidenceLength;
	}
	const leftCoverageSpan = leftState.lastLineIndex - leftState.firstLineIndex;
	const rightCoverageSpan = rightState.lastLineIndex - rightState.firstLineIndex;
	if (leftCoverageSpan !== rightCoverageSpan) {
		return leftCoverageSpan - rightCoverageSpan;
	}
	if (leftState.firstLineIndex !== rightState.firstLineIndex) {
		return rightState.firstLineIndex - leftState.firstLineIndex;
	}
	if (leftState.candidateIndexSum !== rightState.candidateIndexSum) {
		return rightState.candidateIndexSum - leftState.candidateIndexSum;
	}

	return 0;
}

function rebuildNumericColonRunCandidates(
	candidates: readonly RewardReaderNumericColonCandidate[],
	states: readonly RewardReaderNumericColonRunState[],
	lastCandidateIndex: number,
): RewardReaderNumericColonCandidate[] {
	const selectedCandidates: RewardReaderNumericColonCandidate[] = [];
	let currentCandidateIndex: number | null = lastCandidateIndex;

	while (currentCandidateIndex !== null) {
		selectedCandidates.push(candidates[currentCandidateIndex]!);
		currentCandidateIndex = states[currentCandidateIndex]!.previousCandidateIndex;
	}

	return selectedCandidates.reverse();
}

function findBestNumericColonCandidateRun(
	candidates: readonly RewardReaderNumericColonCandidate[],
	sourceLines: readonly RewardReaderSourceLine[],
): RewardReaderValidatedNumericColonRun | null {
	if (candidates.length < 3) {
		return null;
	}

	const evidenceContext = buildNumericColonEvidenceContext(sourceLines);
	const states: RewardReaderNumericColonRunState[] = candidates.map(
		(candidate, candidateIndex) => ({
			length: 1,
			styleScore: 0,
			totalBodyEvidenceLength: 0,
			totalGapPenalty: 0,
			maxGapPenalty: 0,
			gapTransitionCount: 0,
			totalSkippedCandidates: 0,
			candidateIndexSum: candidateIndex,
			observedGap: false,
			firstLineIndex: candidate.lineIndex,
			lastLineIndex: candidate.lineIndex,
			firstChapterNumber: candidate.chapterNumber,
			lastChapterNumber: candidate.chapterNumber,
			previousCandidateIndex: null,
		}),
	);

	for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
		const currentCandidate = candidates[candidateIndex]!;
		const firstLookbackIndex = Math.max(
			0,
			candidateIndex - MAX_NUMERIC_COLON_LOOKBACK_CANDIDATES,
		);

		for (
			let previousCandidateIndex = firstLookbackIndex;
			previousCandidateIndex < candidateIndex;
			previousCandidateIndex += 1
		) {
			const previousCandidate = candidates[previousCandidateIndex]!;
			const chapterGap =
				currentCandidate.chapterNumber - previousCandidate.chapterNumber;
			if (
				chapterGap <= 0 ||
				chapterGap > MAX_NUMERIC_COLON_CHAPTER_GAP
			) {
				continue;
			}

			const bodyEvidenceLength = getNumericColonBodyEvidenceLength(
				evidenceContext,
				previousCandidate.lineIndex + 1,
				currentCandidate.lineIndex,
			);
			if (bodyEvidenceLength < MIN_NUMERIC_COLON_BODY_EVIDENCE_LENGTH) {
				continue;
			}

			const skippedCandidates =
				candidateIndex - previousCandidateIndex - 1;
			const candidateState = states[previousCandidateIndex]!;
			const nextState: RewardReaderNumericColonRunState = {
				length: candidateState.length + 1,
				styleScore:
					candidateState.styleScore +
					scoreNumericColonStyleTransition(
						previousCandidate,
						currentCandidate,
					),
				totalBodyEvidenceLength:
					candidateState.totalBodyEvidenceLength + bodyEvidenceLength,
				totalGapPenalty:
					candidateState.totalGapPenalty + (chapterGap - 1),
				maxGapPenalty: Math.max(
					candidateState.maxGapPenalty,
					chapterGap - 1,
				),
				gapTransitionCount:
					candidateState.gapTransitionCount + (chapterGap > 1 ? 1 : 0),
				totalSkippedCandidates:
					candidateState.totalSkippedCandidates + skippedCandidates,
				candidateIndexSum:
					candidateState.candidateIndexSum + candidateIndex,
				observedGap:
					candidateState.observedGap || chapterGap > 1,
				firstLineIndex: candidateState.firstLineIndex,
				lastLineIndex: currentCandidate.lineIndex,
				firstChapterNumber: candidateState.firstChapterNumber,
				lastChapterNumber: currentCandidate.chapterNumber,
				previousCandidateIndex,
			};

			if (
				compareNumericColonRunStates(
					nextState,
					states[candidateIndex]!,
				) > 0
			) {
				states[candidateIndex] = nextState;
			}
		}
	}

	let bestRun: RewardReaderValidatedNumericColonRun | null = null;
	let bestTerminalState: RewardReaderNumericColonRunState | null = null;

	for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
		const state = states[candidateIndex]!;
		if (state.length < 3) {
			continue;
		}

		const lastCandidate = candidates[candidateIndex]!;
		const trailingBodyEvidenceLength = getNumericColonBodyEvidenceLength(
			evidenceContext,
			lastCandidate.lineIndex + 1,
			sourceLines.length,
		);
		if (trailingBodyEvidenceLength < MIN_NUMERIC_COLON_BODY_EVIDENCE_LENGTH) {
			continue;
		}

		const terminalState: RewardReaderNumericColonRunState = {
			...state,
			totalBodyEvidenceLength:
				state.totalBodyEvidenceLength + trailingBodyEvidenceLength,
		};
		if (
			bestTerminalState &&
			compareNumericColonRunStates(terminalState, bestTerminalState) <= 0
		) {
			continue;
		}

		bestTerminalState = terminalState;
		bestRun = {
			candidates: rebuildNumericColonRunCandidates(
				candidates,
				states,
				candidateIndex,
			),
			observedGap: terminalState.observedGap,
			totalBodyEvidenceLength: terminalState.totalBodyEvidenceLength,
		};
	}

	return bestRun;
}

function validateNumericColonCandidates(
	candidates: RewardReaderNumericColonCandidate[],
	sourceLines: readonly RewardReaderSourceLine[],
): {
	ok: true;
	headings: RewardReaderDetectedChapterHeading[];
	warnings: string[];
	blockingIssues: RewardReaderChapterParseBlockingIssue[];
} | {
	ok: false;
	warnings?: string[];
	blockingIssues?: RewardReaderChapterParseBlockingIssue[];
} {
	if (candidates.length < 3) {
		return { ok: false };
	}

	const validatedRun = findBestNumericColonCandidateRun(candidates, sourceLines);
	if (!validatedRun || validatedRun.candidates.length < 3) {
		return { ok: false };
	}

	const warnings: string[] = [];
	if (validatedRun.observedGap) {
		warnings.push(REWARD_READER_NUMERIC_COLON_GAP_WARNING);
	}
	const canonicalCandidates = canonicalizeNumericColonRunCandidates(
		validatedRun.candidates,
		candidates,
		sourceLines,
	);
	if (!canonicalCandidates.ok) {
		return {
			ok: false,
			warnings: [
				...warnings,
				REWARD_READER_DUPLICATE_NUMBER_AMBIGUITY_WARNING,
			],
			blockingIssues: canonicalCandidates.issues,
		};
	}

	return {
		ok: true,
		headings: canonicalCandidates.candidates.map((candidate) => ({
			title: candidate.title,
			startOffset: candidate.startOffset,
			lineIndex: candidate.lineIndex,
			kind: 'strong',
		})),
		warnings,
		blockingIssues: [],
	};
}

function createEmptyParseResult(
	sourceTextLength: number,
	warnings: string[],
	blockingIssues: RewardReaderChapterParseBlockingIssue[] = [],
	detectionMode: RewardReaderChapterDetectionMode = 'none',
): RewardReaderChapterParseResult {
	return {
		status: blockingIssues.length > 0 ? 'ambiguous' : 'none',
		chapters: [],
		sourceTextLength,
		detectedHeadingCount: 0,
		ignoredPrefixLength: sourceTextLength,
		detectionMode,
		warnings,
		blockingIssues,
	};
}

function finalizeParseResult(
	sourceTextLength: number,
	detectionMode: Exclude<RewardReaderChapterDetectionMode, 'none'>,
	headings: RewardReaderDetectedChapterHeading[],
	warnings: string[],
): RewardReaderChapterParseResult {
	const chapters = buildRewardReaderChapterEntries(sourceTextLength, headings);
	const ignoredPrefixLength = chapters[0]?.startOffset ?? sourceTextLength;
	if (ignoredPrefixLength > 0) {
		warnings.push(REWARD_READER_IGNORED_PREFACE_WARNING);
	}

	return {
		status: 'ok',
		chapters,
		sourceTextLength,
		detectedHeadingCount: headings.length,
		ignoredPrefixLength,
		detectionMode,
		warnings,
		blockingIssues: [],
	};
}

function parseRewardReaderChaptersInternal(
	sourceText: string,
): RewardReaderChapterParseResult {
	if (sourceText.length === 0) {
		return {
			status: 'none',
			chapters: [],
			sourceTextLength: 0,
			detectedHeadingCount: 0,
			ignoredPrefixLength: 0,
			detectionMode: 'none',
			warnings: ['Reward Reader chapter parser received empty source text.'],
			blockingIssues: [],
		};
	}

	const sourceLines = scanRewardReaderSourceLines(sourceText);
	const markdownHeadings = sourceLines
		.map((line) => detectMarkdownChapterHeading(line))
		.filter(
			(heading): heading is RewardReaderDetectedChapterHeading => heading !== null,
		);
	if (markdownHeadings.length > 0) {
		return finalizeParseResult(
			sourceText.length,
			'markdown-heading',
			markdownHeadings,
			[],
		);
	}

	const plainHeadings = detectPlainStructuredHeadings(sourceLines);
	if (plainHeadings.length > 0) {
		return finalizeParseResult(
			sourceText.length,
			'plain-chapter-heading',
			plainHeadings,
			[],
		);
	}

	const numericCandidates = sourceLines
		.map((line) => detectNumericColonCandidate(line))
		.filter(
			(candidate): candidate is RewardReaderNumericColonCandidate =>
				candidate !== null,
		);
	const numericValidation = validateNumericColonCandidates(
		numericCandidates,
		sourceLines,
	);
	if (numericValidation.ok) {
		return finalizeParseResult(
			sourceText.length,
			'numeric-colon',
			numericValidation.headings,
			[...numericValidation.warnings],
		);
	}
	if (numericValidation.blockingIssues?.length) {
		return createEmptyParseResult(
			sourceText.length,
			[
				...(numericValidation.warnings ?? []),
				'Reward Reader blocked import because duplicate chapter-number headings could not be resolved safely.',
			],
			[...numericValidation.blockingIssues],
			'numeric-colon',
		);
	}

	return createEmptyParseResult(sourceText.length, [
		'Reward Reader chapter parser did not detect any chapter headings.',
	]);
}

export function parseRewardReaderChapters(
	sourceText: string,
): RewardReaderChapterParseResult {
	if (typeof sourceText !== 'string') {
		return createEmptyParseResult(0, [
			'Reward Reader chapter parser received invalid source text input.',
		]);
	}

	try {
		return parseRewardReaderChaptersInternal(sourceText);
	} catch {
		return createEmptyParseResult(sourceText.length, [
			'Reward Reader chapter parser failed unexpectedly.',
		]);
	}
}
