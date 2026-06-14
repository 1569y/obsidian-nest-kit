const MAX_INTERVAL_COUNT = 32;
const MAX_INTERVAL_DAYS = 3650;

export interface ReviewIntervalsValidationResult {
	intervals: number[];
	warnings: string[];
}

function cloneIntervals(intervals: number[]): number[] {
	return [...intervals];
}

export function validateReviewIntervals(
	input: unknown,
): ReviewIntervalsValidationResult {
	const warnings: string[] = [];

	if (!Array.isArray(input)) {
		return {
			intervals: [],
			warnings: ['Review intervals must be an array of positive integers.'],
		};
	}

	if (input.length === 0) {
		return {
			intervals: [],
			warnings: ['Review intervals cannot be empty.'],
		};
	}

	if (input.length > MAX_INTERVAL_COUNT) {
		return {
			intervals: [],
			warnings: [
				`Review intervals cannot contain more than ${MAX_INTERVAL_COUNT} entries.`,
			],
		};
	}

	const intervals: number[] = [];

	for (const value of input) {
		if (typeof value !== 'number' || !Number.isInteger(value)) {
			warnings.push('Review intervals must use integers only.');
			return {
				intervals: [],
				warnings,
			};
		}

		if (value <= 0) {
			warnings.push('Review intervals must contain positive integers only.');
			return {
				intervals: [],
				warnings,
			};
		}

		if (value > MAX_INTERVAL_DAYS) {
			warnings.push(
				`Review intervals cannot exceed ${MAX_INTERVAL_DAYS} days.`,
			);
			return {
				intervals: [],
				warnings,
			};
		}

		intervals.push(value);
	}

	for (let index = 1; index < intervals.length; index += 1) {
		const previous = intervals[index - 1]!;
		const current = intervals[index]!;

		if (current === previous) {
			return {
				intervals: [],
				warnings: ['Review intervals must not contain duplicate values.'],
			};
		}

		if (current < previous) {
			return {
				intervals: [],
				warnings: [
					'Review intervals must be strictly increasing and must not be auto-sorted.',
				],
			};
		}
	}

	return {
		intervals: cloneIntervals(intervals),
		warnings,
	};
}

export function parseReviewIntervalsInput(
	input: string,
): ReviewIntervalsValidationResult {
	const trimmed = input.trim();

	if (trimmed.length === 0) {
		return {
			intervals: [],
			warnings: ['Review intervals input cannot be empty.'],
		};
	}

	const tokens = trimmed
		.split(/[,\uFF0C\s]+/)
		.filter((token) => token.length > 0);

	if (tokens.length === 0) {
		return {
			intervals: [],
			warnings: ['Review intervals input cannot be empty.'],
		};
	}

	const parsed: number[] = [];

	for (const token of tokens) {
		if (!/^-?\d+$/.test(token)) {
			return {
				intervals: [],
				warnings: [
					`Review intervals input contains an invalid token: "${token}".`,
				],
			};
		}

		parsed.push(Number(token));
	}

	return validateReviewIntervals(parsed);
}
