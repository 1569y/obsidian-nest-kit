import { validateReviewIntervals } from './intervals';
import {
	SPACED_REVIEW_STORE_SCHEMA_VERSION,
	type ReviewPreset,
} from './types';

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
