import { parseReviewIntervalsInput } from './intervals';
import { isIsoDateString } from './dates';
import {
	getBuiltInReviewPreset,
	parseCustomReviewPresets,
	withTodayAsFirstReview,
} from './presets';
import type { ReviewTask } from './types';

export class DuplicateReviewTaskTitleError extends Error {
	constructor() {
		super('A review task with this name already exists in this group.');
		this.name = 'DuplicateReviewTaskTitleError';
	}
}

export interface CreateReviewTaskInput {
	title: string;
	groupPath?: string[];
	note?: string;
	targetLink?: string;
	startDate: string;
	presetId: string;
	customIntervalsText?: string;
	customPresetsText?: string;
	includeTodayAsFirstReview?: boolean;
}

export interface UpdateReviewTaskDetailsInput {
	title: string;
	groupPath?: string[];
	note?: string;
	targetLink?: string;
}

export interface CreateReviewTaskResult {
	task: ReviewTask;
	title: string;
}

export function normalizeReviewTaskText(value: string): string {
	return value.trim().replace(/\s+/g, ' ');
}

export function normalizeReviewTaskNote(
	note: string | undefined,
): string | undefined {
	if (typeof note !== 'string') {
		return undefined;
	}

	const normalizedNote = note.replace(/\r\n?/g, '\n').trim();
	return normalizedNote.length > 0 ? normalizedNote : undefined;
}

export function normalizeReviewTaskTargetLink(
	targetLink: string | undefined,
): string | undefined {
	if (typeof targetLink !== 'string') {
		return undefined;
	}

	const normalizedTargetLink = targetLink.trim();
	return normalizedTargetLink.length > 0 ? normalizedTargetLink : undefined;
}

export function normalizeReviewTaskTitle(title: string): string {
	return normalizeReviewTaskText(title).toLocaleLowerCase();
}

export function normalizeReviewTaskGroupPath(
	groupPath: readonly unknown[] | undefined,
): string[] | undefined {
	if (!Array.isArray(groupPath)) {
		return undefined;
	}

	const groupSegment =
		typeof groupPath[0] === 'string'
			? normalizeReviewTaskText(groupPath[0])
			: '';
	const subgroupSegment =
		typeof groupPath[1] === 'string'
			? normalizeReviewTaskText(groupPath[1])
			: '';

	if (groupSegment.length === 0) {
		return undefined;
	}

	return subgroupSegment.length > 0
		? [groupSegment, subgroupSegment]
		: [groupSegment];
}

function getReviewTaskGroupPathKey(
	groupPath: readonly unknown[] | undefined,
): string {
	return (normalizeReviewTaskGroupPath(groupPath) ?? [])
		.map((segment) => segment.toLocaleLowerCase())
		.join('\u0000');
}

export function hasDuplicateReviewTaskTitle(
	tasks: ReviewTask[],
	title: string,
	groupPath?: readonly unknown[],
	ignoreTaskId?: string,
): boolean {
	const normalizedCandidate = normalizeReviewTaskTitle(title);
	const normalizedGroupPath = getReviewTaskGroupPathKey(groupPath);

	if (normalizedCandidate.length === 0) {
		return false;
	}

	return tasks.some(
		(task) =>
			task.id !== ignoreTaskId &&
			task.status !== 'archived' &&
			normalizeReviewTaskTitle(task.title) === normalizedCandidate &&
			getReviewTaskGroupPathKey(task.groupPath) === normalizedGroupPath,
	);
}

export function createReviewTask(
	input: CreateReviewTaskInput,
): CreateReviewTaskResult {
	const title = normalizeReviewTaskText(input.title);

	if (title.length === 0) {
		throw new Error('Task title is required.');
	}

	if (!isIsoDateString(input.startDate)) {
		throw new Error('Task startDate must be a valid ISO date string.');
	}

	const preset = getBuiltInReviewPreset(input.presetId);
	const customPreset = input.customPresetsText
		? parseCustomReviewPresets(input.customPresetsText).presets.find(
				(entry) => entry.id === input.presetId,
			)
		: undefined;
	if (!preset && !customPreset) {
		throw new Error(`Unsupported preset id: ${input.presetId}`);
	}

	const customIntervalsText = input.customIntervalsText?.trim() ?? '';
	const parsedManualIntervals =
		customIntervalsText.length > 0
			? parseReviewIntervalsInput(customIntervalsText)
			: undefined;
	const intervalSource =
		parsedManualIntervals
			? {
					intervals: withTodayAsFirstReview(
						parsedManualIntervals.intervals,
						input.includeTodayAsFirstReview ?? false,
					),
					warnings: parsedManualIntervals.warnings,
				}
			: {
					intervals: withTodayAsFirstReview(
						customPreset?.intervals ?? preset?.intervals ?? [],
						input.includeTodayAsFirstReview ?? false,
					),
					warnings: [],
				};

	if (intervalSource.intervals.length === 0) {
		throw new Error(
			intervalSource.warnings[0] ?? 'Task intervals are invalid.',
		);
	}

	const timestamp = new Date().toISOString();
	const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
	const groupPath = normalizeReviewTaskGroupPath(input.groupPath);
	const note = normalizeReviewTaskNote(input.note);
	const targetLink = normalizeReviewTaskTargetLink(input.targetLink);

	return {
		title,
		task: {
			id,
			title,
			createdAt: timestamp,
			updatedAt: timestamp,
			groupPath,
			note,
			targetLink,
			startDate: input.startDate,
			presetId: customPreset?.id ?? preset?.id ?? input.presetId,
			intervalsSnapshot: [...intervalSource.intervals],
			status: 'active',
			completedSequenceIndexes: [],
			skippedSequenceIndexes: [],
		},
	};
}
