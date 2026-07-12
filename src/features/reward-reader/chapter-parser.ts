import type { RewardReaderChapterIndexEntry } from './types';

export interface RewardReaderChapterParseResult {
	chapters: RewardReaderChapterIndexEntry[];
	sourceTextLength: number;
	detectedHeadingCount: number;
	ignoredPrefixLength: number;
	warnings: string[];
}

const UTF8_BOM = '\uFEFF';

const CHINESE_ARABIC_CHAPTER_PATTERN =
	'第[ \\t]*[0-9\\uFF10-\\uFF19]+[ \\t]*章';
const CHINESE_NUMERAL_CHAPTER_PATTERN =
	'第[ \\t]*[零〇一二两三四五六七八九十百千万]+[ \\t]*章';
const ENGLISH_CHAPTER_PATTERN = 'chapter[ \\t]+[0-9\\uFF10-\\uFF19]+';
const CHAPTER_TITLE_SEPARATOR_PATTERN =
	'(?:[ \\t]+|[：:\\-—–\\.。、][：:\\-—–\\.。、 \\t]*)';

const REWARD_READER_CHAPTER_HEADING_LINE_REGEX = new RegExp(
	`^[ \\t]*(?:#{1,6}[ \\t]+)?(?:${CHINESE_ARABIC_CHAPTER_PATTERN}|${CHINESE_NUMERAL_CHAPTER_PATTERN}|${ENGLISH_CHAPTER_PATTERN})(?:${CHAPTER_TITLE_SEPARATOR_PATTERN}.*)?[ \\t]*$`,
	'iu',
);

interface RewardReaderDetectedChapterHeading {
	title: string;
	startOffset: number;
}

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

function getMatchableLineText(
	lineText: string,
	lineStart: number,
): string {
	if (lineStart === 0 && lineText.startsWith(UTF8_BOM)) {
		return lineText.slice(UTF8_BOM.length);
	}

	return lineText;
}

function normalizeDetectedChapterTitle(matchableLineText: string): string {
	const withoutBom = matchableLineText.startsWith(UTF8_BOM)
		? matchableLineText.slice(UTF8_BOM.length)
		: matchableLineText;
	const withoutIndent = withoutBom.replace(/^[ \t]+/u, '');
	const withoutMarkdownHeading = withoutIndent.replace(
		/^#{1,6}[ \t]+/u,
		'',
	);

	return withoutMarkdownHeading.trim();
}

function detectRewardReaderChapterHeading(
	lineText: string,
	lineStart: number,
): RewardReaderDetectedChapterHeading | null {
	const matchableLineText = getMatchableLineText(lineText, lineStart);
	if (!REWARD_READER_CHAPTER_HEADING_LINE_REGEX.test(matchableLineText)) {
		return null;
	}

	return {
		title: normalizeDetectedChapterTitle(matchableLineText),
		startOffset: lineStart,
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

export function parseRewardReaderChapters(
	sourceText: string,
): RewardReaderChapterParseResult {
	if (sourceText.length === 0) {
		return {
			chapters: [],
			sourceTextLength: 0,
			detectedHeadingCount: 0,
			ignoredPrefixLength: 0,
			warnings: ['Reward Reader chapter parser received empty source text.'],
		};
	}

	const detectedHeadings: RewardReaderDetectedChapterHeading[] = [];
	let lineStart = 0;

	while (lineStart < sourceText.length) {
		const { lineEnd, nextLineStart } = getLineEndOffset(sourceText, lineStart);
		const lineText = sourceText.slice(lineStart, lineEnd);
		const detectedHeading = detectRewardReaderChapterHeading(lineText, lineStart);
		if (detectedHeading) {
			detectedHeadings.push(detectedHeading);
		}
		lineStart = nextLineStart;
	}

	if (detectedHeadings.length === 0) {
		return {
			chapters: [],
			sourceTextLength: sourceText.length,
			detectedHeadingCount: 0,
			ignoredPrefixLength: sourceText.length,
			warnings: [
				'Reward Reader chapter parser did not detect any chapter headings.',
			],
		};
	}

	const chapters = buildRewardReaderChapterEntries(
		sourceText.length,
		detectedHeadings,
	);
	const ignoredPrefixLength = chapters[0]!.startOffset;
	const warnings: string[] = [];

	if (ignoredPrefixLength > 0) {
		warnings.push(
			'Reward Reader chapter parser ignored leading preface text before the first detected chapter heading.',
		);
	}

	return {
		chapters,
		sourceTextLength: sourceText.length,
		detectedHeadingCount: detectedHeadings.length,
		ignoredPrefixLength,
		warnings,
	};
}
