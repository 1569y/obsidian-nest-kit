import { parseReviewIntervalsInput } from './intervals';
import { isIsoDateString } from './dates';
import { getBuiltInReviewPreset } from './presets';
import type { ReviewTask } from './types';

export interface CreateReviewTaskInput {
	title: string;
	startDate: string;
	presetId: string;
	customIntervalsText?: string;
}

export interface CreateReviewTaskResult {
	task: ReviewTask;
	title: string;
}

export function createReviewTask(
	input: CreateReviewTaskInput,
): CreateReviewTaskResult {
	const title = input.title.trim();

	if (title.length === 0) {
		throw new Error('Task title is required.');
	}

	if (!isIsoDateString(input.startDate)) {
		throw new Error('Task startDate must be a valid ISO date string.');
	}

	const preset = getBuiltInReviewPreset(input.presetId);
	if (!preset) {
		throw new Error(`Unsupported preset id: ${input.presetId}`);
	}

	const customIntervalsText = input.customIntervalsText?.trim() ?? '';
	const intervalSource =
		customIntervalsText.length > 0
			? parseReviewIntervalsInput(customIntervalsText)
			: { intervals: preset.intervals, warnings: [] };

	if (intervalSource.intervals.length === 0) {
		throw new Error(
			intervalSource.warnings[0] ?? 'Task intervals are invalid.',
		);
	}

	const timestamp = new Date().toISOString();
	const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

	return {
		title,
		task: {
			id,
			title,
			createdAt: timestamp,
			updatedAt: timestamp,
			startDate: input.startDate,
			presetId: preset.id,
			intervalsSnapshot: [...intervalSource.intervals],
			status: 'active',
			completedSequenceIndexes: [],
			skippedSequenceIndexes: [],
		},
	};
}
