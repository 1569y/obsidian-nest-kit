import { validateReviewIntervals } from './intervals';
import {
	SPACED_REVIEW_STORE_SCHEMA_VERSION,
	type ReviewPreset,
} from './types';

const INTERVAL_LABEL_SEPARATOR = ' \u00b7 ';

export interface BuiltInPresetLabels {
	quickReview: string;
	standardReview: string;
	longTermMemory: string;
}

export interface CustomReviewPreset {
	id: string;
	name: string;
	intervals: number[];
}

export interface CustomReviewPresetParseResult {
	presets: CustomReviewPreset[];
	invalidLines: string[];
}

const BUILT_IN_REVIEW_PRESETS: ReviewPreset[] = [
	{
		id: 'fast-review',
		labelKey: 'spacedReview.presets.fastReview',
		intervals: [1, 2, 4, 7, 15],
		builtIn: true,
		editable: false,
		deletable: false,
		schemaVersion: SPACED_REVIEW_STORE_SCHEMA_VERSION,
	},
	{
		id: 'standard-review',
		labelKey: 'spacedReview.presets.standardReview',
		intervals: [1, 3, 7, 15, 30],
		builtIn: true,
		editable: false,
		deletable: false,
		schemaVersion: SPACED_REVIEW_STORE_SCHEMA_VERSION,
	},
	{
		id: 'long-term-memory',
		labelKey: 'spacedReview.presets.longTermMemory',
		intervals: [1, 3, 7, 15, 30, 60, 120],
		builtIn: true,
		editable: false,
		deletable: false,
		schemaVersion: SPACED_REVIEW_STORE_SCHEMA_VERSION,
	},
];

export const DEFAULT_REVIEW_PRESET_ID = 'standard-review';

function clonePreset(preset: ReviewPreset): ReviewPreset {
	return {
		...preset,
		intervals: [...preset.intervals],
	};
}

for (const preset of BUILT_IN_REVIEW_PRESETS) {
	const validation = validateReviewIntervals(preset.intervals);
	if (validation.intervals.length === 0 || validation.warnings.length > 0) {
		throw new Error(
			`Invalid built-in Spaced Review preset: ${preset.id} (${validation.warnings.join('; ')})`,
		);
	}
}

export function getBuiltInReviewPreset(id: string): ReviewPreset | undefined {
	const preset = BUILT_IN_REVIEW_PRESETS.find((entry) => entry.id === id);
	return preset ? clonePreset(preset) : undefined;
}

export function getBuiltInReviewPresets(): ReviewPreset[] {
	return BUILT_IN_REVIEW_PRESETS.map(clonePreset);
}

export function withTodayAsFirstReview(
	intervals: readonly number[],
	includeTodayAsFirstReview: boolean,
): number[] {
	if (!includeTodayAsFirstReview || intervals[0] === 0) {
		return [...intervals];
	}

	return [0, ...intervals];
}

export function formatReviewIntervalsLabel(
	intervals: readonly number[],
): string {
	return intervals.map(String).join(INTERVAL_LABEL_SEPARATOR);
}

export function getBuiltInReviewPresetName(
	presetId: string,
	labels: BuiltInPresetLabels,
): string {
	switch (presetId) {
		case 'fast-review':
			return labels.quickReview;
		case 'standard-review':
			return labels.standardReview;
		case 'long-term-memory':
			return labels.longTermMemory;
		default:
			return presetId;
	}
}

export function getPresetDisplayLabel(input: {
	name: string;
	intervals: readonly number[];
}): string {
	return `${input.name} (${formatReviewIntervalsLabel(input.intervals)})`;
}

export function parseCustomReviewPresets(
	input: string,
): CustomReviewPresetParseResult {
	const presets: CustomReviewPreset[] = [];
	const invalidLines: string[] = [];
	const lines = input.split(/\r?\n/);

	for (let index = 0; index < lines.length; index += 1) {
		const rawLine = lines[index] ?? '';
		const line = rawLine.trim();
		if (line.length === 0) {
			continue;
		}

		const separatorIndex = line.indexOf('=');
		if (separatorIndex <= 0) {
			invalidLines.push(String(index + 1));
			continue;
		}

		const name = line.slice(0, separatorIndex).trim();
		const intervalsText = line.slice(separatorIndex + 1).trim();
		if (name.length === 0 || intervalsText.length === 0) {
			invalidLines.push(String(index + 1));
			continue;
		}

		const tokens = intervalsText
			.split(/[,\uFF0C\u3001\s]+/)
			.map((token) => token.trim())
			.filter((token) => token.length > 0);

		if (tokens.length === 0 || tokens.some((token) => !/^\d+$/.test(token))) {
			invalidLines.push(String(index + 1));
			continue;
		}

		const parsedIntervals = tokens.map((token) => Number(token));
		const validation = validateReviewIntervals(parsedIntervals);
		if (validation.intervals.length === 0) {
			invalidLines.push(String(index + 1));
			continue;
		}

		presets.push({
			id: `custom:${index}:${slugifyPresetName(name)}`,
			name,
			intervals: validation.intervals,
		});
	}

	return {
		presets,
		invalidLines,
	};
}

function slugifyPresetName(name: string): string {
	const slug = name
		.trim()
		.toLocaleLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');

	return slug.length > 0 ? slug : 'preset';
}
