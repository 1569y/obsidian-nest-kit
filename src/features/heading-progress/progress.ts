import type { Editor } from 'obsidian';

export interface ParsedHeading {
	line: number;
	level: number;
	title: string;
}

export interface HeadingSectionProgress {
	heading: ParsedHeading;
	topLevelHeadingLevel: number;
	startLine: number;
	endLineExclusive: number;
	totalLineCount: number;
	currentLine: number;
	currentLineOffset: number;
	percentage: number;
}

const HEADING_REGEX =
	/^\s{0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*#*[ \t]*$/;
const FENCE_REGEX = /^\s*(`{3,}|~{3,})/;

export function parseHeadings(editor: Editor): ParsedHeading[] {
	const headings: ParsedHeading[] = [];
	let activeFence: {
		marker: '`' | '~';
		length: number;
	} | null = null;

	for (let line = 0; line < editor.lineCount(); line += 1) {
		const lineText = editor.getLine(line);
		const fenceMatch = lineText.match(FENCE_REGEX);
		if (fenceMatch) {
			const fenceText = fenceMatch[1] ?? '';
			if (!fenceText) {
				continue;
			}
			const marker = fenceText[0] as '`' | '~';
			const length = fenceText.length;

			if (
				activeFence &&
				activeFence.marker === marker &&
				length >= activeFence.length
			) {
				activeFence = null;
				continue;
			}

			if (!activeFence) {
				activeFence = {
					marker,
					length,
				};
				continue;
			}
		}

		if (activeFence) {
			continue;
		}

		const headingMatch = lineText.match(HEADING_REGEX);
		if (!headingMatch) {
			continue;
		}

		const hashes = headingMatch[1] ?? '';
		if (!hashes) {
			continue;
		}
		headings.push({
			line,
			level: hashes.length,
			title: normalizeHeadingTitle(headingMatch[2] ?? ''),
		});
	}

	return headings;
}

export function resolveHeadingSectionProgress(input: {
	headings: ParsedHeading[];
	lineCount: number;
	currentLine: number;
}): HeadingSectionProgress | null {
	const { headings, lineCount } = input;
	if (headings.length === 0 || lineCount <= 0) {
		return null;
	}

	const topLevelHeadingLevel = Math.min(
		...headings.map((heading) => heading.level),
	);
	const currentLine = clampLine(input.currentLine, lineCount);
	const topLevelHeadings = headings.filter(
		(heading) => heading.level === topLevelHeadingLevel,
	);
	const currentHeading = findCurrentTopLevelHeading(topLevelHeadings, currentLine);
	if (!currentHeading) {
		return null;
	}

	const currentHeadingIndex = topLevelHeadings.findIndex(
		(heading) => heading.line === currentHeading.line,
	);
	const nextTopLevelHeading = topLevelHeadings[currentHeadingIndex + 1];
	const endLineExclusive = nextTopLevelHeading?.line ?? lineCount;
	const totalLineCount = Math.max(endLineExclusive - currentHeading.line, 1);
	const currentLineOffset = clamp(
		currentLine - currentHeading.line,
		0,
		Math.max(totalLineCount - 1, 0),
	);
	const percentage =
		totalLineCount <= 1
			? 100
			: clamp(
					(currentLineOffset / Math.max(totalLineCount - 1, 1)) * 100,
					0,
					100,
			  );

	return {
		heading: currentHeading,
		topLevelHeadingLevel,
		startLine: currentHeading.line,
		endLineExclusive,
		totalLineCount,
		currentLine,
		currentLineOffset,
		percentage,
	};
}

function findCurrentTopLevelHeading(
	headings: ParsedHeading[],
	currentLine: number,
): ParsedHeading | null {
	let currentHeading: ParsedHeading | null = null;
	for (const heading of headings) {
		if (heading.line > currentLine) {
			break;
		}

		currentHeading = heading;
	}

	return currentHeading;
}

function normalizeHeadingTitle(rawTitle: string): string {
	return rawTitle.trim();
}

function clampLine(line: number, lineCount: number): number {
	return clamp(line, 0, Math.max(lineCount - 1, 0));
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}
