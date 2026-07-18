export type RewardReaderMarkdownRiskCode =
	| 'unbalanced-strong-asterisk'
	| 'unbalanced-strong-underscore'
	| 'unbalanced-strikethrough'
	| 'unclosed-inline-code'
	| 'unclosed-fenced-code-block';

export type RewardReaderMarkdownRiskMarker = '**' | '__' | '~~' | '`';

export interface RewardReaderMarkdownRiskInspectorInput {
	sourceText: string;
}

export interface RewardReaderMarkdownRiskInspectorOptions {
	maxSamples?: number;
	maxExcerptLength?: number;
}

export interface RewardReaderMarkdownRisk {
	code: RewardReaderMarkdownRiskCode;
	marker: RewardReaderMarkdownRiskMarker;
	occurrenceCount: 1;
	lineNumber: number;
	columnNumber: number;
	excerpt: string;
}

export interface RewardReaderMarkdownRiskCodeCounts {
	'unbalanced-strong-asterisk': number;
	'unbalanced-strong-underscore': number;
	'unbalanced-strikethrough': number;
	'unclosed-inline-code': number;
	'unclosed-fenced-code-block': number;
}

export type RewardReaderMarkdownRiskInspectionResult =
	| {
			ok: true;
			hasRisks: boolean;
			issueCount: number;
			warningCodes: RewardReaderMarkdownRiskCode[];
			countsByCode: RewardReaderMarkdownRiskCodeCounts;
			samples: RewardReaderMarkdownRisk[];
			maxSamples: number;
			sampleLimitReached: boolean;
			maxExcerptLength: number;
	  }
	| {
			ok: false;
			errorCode: 'invalid-source-text';
	  };

type RewardReaderRecord = Record<string, unknown>;

interface PendingRiskEvent {
	code: RewardReaderMarkdownRiskCode;
	marker: RewardReaderMarkdownRiskMarker;
	index: number;
	lineNumber: number;
	lineStart: number;
}

interface ActiveInlineBacktick {
	delimiterLength: number;
	event: PendingRiskEvent;
}

interface ActiveFencedBacktick {
	delimiterLength: number;
	event: PendingRiskEvent;
}

interface RewardReaderMarkdownRiskAccumulator {
	issueCount: number;
	countsByCode: RewardReaderMarkdownRiskCodeCounts;
	samples: RewardReaderMarkdownRisk[];
	maxSamples: number;
	maxExcerptLength: number;
	sampleLimitReached: boolean;
}

type LinePendingRiskEvents = Record<'**' | '__' | '~~', PendingRiskEvent[]>;

const MARKDOWN_PAIR_RULES: ReadonlyArray<{
	code:
		| 'unbalanced-strong-asterisk'
		| 'unbalanced-strong-underscore'
		| 'unbalanced-strikethrough';
	marker: '**' | '__' | '~~';
}> = [
	{
		code: 'unbalanced-strong-asterisk',
		marker: '**',
	},
	{
		code: 'unbalanced-strong-underscore',
		marker: '__',
	},
	{
		code: 'unbalanced-strikethrough',
		marker: '~~',
	},
];

const WARNING_CODE_ORDER: readonly RewardReaderMarkdownRiskCode[] = [
	'unbalanced-strong-asterisk',
	'unbalanced-strong-underscore',
	'unbalanced-strikethrough',
	'unclosed-inline-code',
	'unclosed-fenced-code-block',
];

const DEFAULT_MAX_SAMPLES = 20;
const DEFAULT_MAX_EXCERPT_LENGTH = 120;

function isPlainObject(value: unknown): value is RewardReaderRecord {
	try {
		return (
			typeof value === 'object' &&
			value !== null &&
			!Array.isArray(value)
		);
	} catch {
		return false;
	}
}

function isSafePositiveInteger(value: unknown): value is number {
	return (
		typeof value === 'number' &&
		Number.isSafeInteger(value) &&
		value > 0
	);
}

function isSafeNonNegativeInteger(value: unknown): value is number {
	return (
		typeof value === 'number' &&
		Number.isSafeInteger(value) &&
		value >= 0
	);
}

function createEmptyRiskCodeCounts(): RewardReaderMarkdownRiskCodeCounts {
	return {
		'unbalanced-strong-asterisk': 0,
		'unbalanced-strong-underscore': 0,
		'unbalanced-strikethrough': 0,
		'unclosed-inline-code': 0,
		'unclosed-fenced-code-block': 0,
	};
}

function createEmptyLinePendingRiskEvents(): LinePendingRiskEvents {
	return {
		'**': [],
		'__': [],
		'~~': [],
	};
}

function countRepeatedCharacter(
	sourceText: string,
	index: number,
	character: string,
): number {
	let count = 0;

	while (sourceText[index + count] === character) {
		count += 1;
	}

	return count;
}

function isFenceLinePrefix(
	sourceText: string,
	lineStart: number,
	index: number,
): boolean {
	if (index < lineStart || index - lineStart > 3) {
		return false;
	}

	for (let cursor = lineStart; cursor < index; cursor += 1) {
		const character = sourceText[cursor];
		if (character !== ' ' && character !== '\t') {
			return false;
		}
	}

	return true;
}

function findLineEnd(sourceText: string, lineStart: number): number {
	let cursor = lineStart;
	while (cursor < sourceText.length) {
		const character = sourceText[cursor];
		if (character === '\r' || character === '\n') {
			break;
		}

		cursor += 1;
	}

	return cursor;
}

function createExcerpt(
	sourceText: string,
	lineStart: number,
	lineEnd: number,
	maxExcerptLength: number,
): string {
	const lineText = sourceText.slice(lineStart, lineEnd);
	if (lineText.length <= maxExcerptLength) {
		return lineText;
	}

	if (maxExcerptLength <= 3) {
		return lineText.slice(0, maxExcerptLength);
	}

	return lineText.slice(0, maxExcerptLength - 3) + '...';
}

function createSampleFromEvent(
	sourceText: string,
	event: PendingRiskEvent,
	maxExcerptLength: number,
): RewardReaderMarkdownRisk {
	const lineEnd = findLineEnd(sourceText, event.lineStart);

	return {
		code: event.code,
		marker: event.marker,
		occurrenceCount: 1,
		lineNumber: event.lineNumber,
		columnNumber: event.index - event.lineStart + 1,
		excerpt: createExcerpt(
			sourceText,
			event.lineStart,
			lineEnd,
			maxExcerptLength,
		),
	};
}

function recordRiskEvent(
	sourceText: string,
	accumulator: RewardReaderMarkdownRiskAccumulator,
	event: PendingRiskEvent,
): void {
	accumulator.issueCount += 1;
	accumulator.countsByCode[event.code] += 1;
	if (accumulator.issueCount > accumulator.maxSamples) {
		accumulator.sampleLimitReached = true;
	}

	if (accumulator.samples.length >= accumulator.maxSamples) {
		return;
	}

	accumulator.samples.push(
		createSampleFromEvent(
			sourceText,
			event,
			accumulator.maxExcerptLength,
		),
	);
}

function flushLinePendingRiskEvents(
	sourceText: string,
	accumulator: RewardReaderMarkdownRiskAccumulator,
	linePendingRiskEvents: LinePendingRiskEvents,
	activeInlineBacktick: ActiveInlineBacktick | null,
): ActiveInlineBacktick | null {
	const orderedLineEvents: PendingRiskEvent[] = [];

	for (const marker of ['**', '__', '~~'] as const) {
		for (const event of linePendingRiskEvents[marker]) {
			orderedLineEvents.push(event);
		}
		linePendingRiskEvents[marker] = [];
	}

	if (activeInlineBacktick) {
		orderedLineEvents.push(activeInlineBacktick.event);
	}

	orderedLineEvents.sort((left, right) => left.index - right.index);

	for (const event of orderedLineEvents) {
		recordRiskEvent(sourceText, accumulator, event);
	}

	return null;
}

function normalizeOptions(
	options: unknown,
): Required<RewardReaderMarkdownRiskInspectorOptions> {
	let maxSamples = DEFAULT_MAX_SAMPLES;
	let maxExcerptLength = DEFAULT_MAX_EXCERPT_LENGTH;

	if (!isPlainObject(options)) {
		return {
			maxSamples,
			maxExcerptLength,
		};
	}

	try {
		const candidate = options.maxSamples;
		if (isSafeNonNegativeInteger(candidate)) {
			maxSamples = candidate;
		}
	} catch {
		maxSamples = DEFAULT_MAX_SAMPLES;
	}

	try {
		const candidate = options.maxExcerptLength;
		if (isSafePositiveInteger(candidate)) {
			maxExcerptLength = candidate;
		}
	} catch {
		maxExcerptLength = DEFAULT_MAX_EXCERPT_LENGTH;
	}

	return {
		maxSamples,
		maxExcerptLength,
	};
}

function inspectRewardReaderMarkdownRisksInternal(
	input: RewardReaderMarkdownRiskInspectorInput,
	options: Required<RewardReaderMarkdownRiskInspectorOptions>,
): RewardReaderMarkdownRiskInspectionResult {
	const sourceText = input.sourceText;
	const linePendingRiskEvents = createEmptyLinePendingRiskEvents();
	const accumulator: RewardReaderMarkdownRiskAccumulator = {
		issueCount: 0,
		countsByCode: createEmptyRiskCodeCounts(),
		samples: [],
		maxSamples: options.maxSamples,
		maxExcerptLength: options.maxExcerptLength,
		sampleLimitReached: false,
	};

	let lineNumber = 1;
	let lineStart = 0;
	let activeInlineBacktick: ActiveInlineBacktick | null = null;
	let activeFencedBacktick: ActiveFencedBacktick | null = null;

	for (let index = 0; index < sourceText.length; ) {
		const character = sourceText[index];

		if (character === '\r' || character === '\n') {
			if (!activeFencedBacktick) {
				activeInlineBacktick = flushLinePendingRiskEvents(
					sourceText,
					accumulator,
					linePendingRiskEvents,
					activeInlineBacktick,
				);
			}

			if (character === '\r' && sourceText[index + 1] === '\n') {
				index += 2;
			} else {
				index += 1;
			}

			lineNumber += 1;
			lineStart = index;
			continue;
		}

		if (activeFencedBacktick) {
			if (character === '`') {
				const delimiterLength = countRepeatedCharacter(sourceText, index, '`');
				if (
					delimiterLength >= activeFencedBacktick.delimiterLength &&
					isFenceLinePrefix(sourceText, lineStart, index)
				) {
					activeFencedBacktick = null;
				}
				index += delimiterLength;
				continue;
			}

			index += 1;
			continue;
		}

		if (character === '\\') {
			if (
				index + 1 < sourceText.length &&
				sourceText[index + 1] !== '\r' &&
				sourceText[index + 1] !== '\n'
			) {
				index += 2;
				continue;
			}

			index += 1;
			continue;
		}

		if (character === '`') {
			const delimiterLength = countRepeatedCharacter(sourceText, index, '`');
			const event: PendingRiskEvent = {
				code: 'unclosed-inline-code',
				marker: '`',
				index,
				lineNumber,
				lineStart,
			};

			if (
				delimiterLength >= 3 &&
				isFenceLinePrefix(sourceText, lineStart, index)
			) {
				activeFencedBacktick = {
					delimiterLength,
					event: {
						...event,
						code: 'unclosed-fenced-code-block',
					},
				};
				index += delimiterLength;
				continue;
			}

			if (
				activeInlineBacktick &&
				activeInlineBacktick.delimiterLength === delimiterLength
			) {
				activeInlineBacktick = null;
			} else if (!activeInlineBacktick) {
				activeInlineBacktick = {
					delimiterLength,
					event,
				};
			}

			index += delimiterLength;
			continue;
		}

		if (activeInlineBacktick) {
			index += 1;
			continue;
		}

		let matchedMarker = false;
		for (const rule of MARKDOWN_PAIR_RULES) {
			const marker = rule.marker;
			if (!sourceText.startsWith(marker, index)) {
				continue;
			}

			const pendingEvents = linePendingRiskEvents[marker];
			if (pendingEvents.length > 0) {
				pendingEvents.pop();
			} else {
				pendingEvents.push({
					code: rule.code,
					marker,
					index,
					lineNumber,
					lineStart,
				});
			}

			index += marker.length;
			matchedMarker = true;
			break;
		}

		if (matchedMarker) {
			continue;
		}

		index += 1;
	}

	if (activeFencedBacktick) {
		recordRiskEvent(sourceText, accumulator, activeFencedBacktick.event);
	} else {
		flushLinePendingRiskEvents(
			sourceText,
			accumulator,
			linePendingRiskEvents,
			activeInlineBacktick,
		);
	}

	const warningCodes = WARNING_CODE_ORDER.filter(
		(code) => accumulator.countsByCode[code] > 0,
	);

	return {
		ok: true,
		hasRisks: accumulator.issueCount > 0,
		issueCount: accumulator.issueCount,
		warningCodes,
		countsByCode: accumulator.countsByCode,
		samples: accumulator.samples,
		maxSamples: accumulator.maxSamples,
		sampleLimitReached: accumulator.sampleLimitReached,
		maxExcerptLength: accumulator.maxExcerptLength,
	};
}

export function inspectRewardReaderMarkdownRisks(
	input: unknown,
	options?: unknown,
): RewardReaderMarkdownRiskInspectionResult {
	try {
		if (!isPlainObject(input)) {
			return {
				ok: false,
				errorCode: 'invalid-source-text',
			};
		}

		let sourceText: unknown;
		try {
			sourceText = input.sourceText;
		} catch {
			return {
				ok: false,
				errorCode: 'invalid-source-text',
			};
		}

		if (typeof sourceText !== 'string') {
			return {
				ok: false,
				errorCode: 'invalid-source-text',
			};
		}

		return inspectRewardReaderMarkdownRisksInternal({
			sourceText,
		}, normalizeOptions(options));
	} catch {
		return {
			ok: false,
			errorCode: 'invalid-source-text',
		};
	}
}
