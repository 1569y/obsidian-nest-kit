import {
	addCalendarDays,
	isAfterDate,
	isBeforeDate,
	isIsoDateString,
	isSameDate,
} from './dates';
import type {
	OverduePolicy,
	ReviewOccurrence,
	ReviewTask,
	ScheduleMode,
} from './types';

interface DueOccurrencesOptions {
	scheduleMode: ScheduleMode;
	overduePolicy: OverduePolicy;
	maxOccurrencesPerTask?: number;
}

function sortUniqueIndexes(indexes: number[]): number[] {
	return [...new Set(indexes)].sort((left, right) => left - right);
}

function withoutSequenceIndex(
	dateMap: Record<string, string> | undefined,
	sequenceIndex: number,
): Record<string, string> | undefined {
	if (!dateMap) {
		return undefined;
	}

	const key = String(sequenceIndex);
	if (!(key in dateMap)) {
		return { ...dateMap };
	}

	const nextMap = { ...dateMap };
	delete nextMap[key];
	return Object.keys(nextMap).length > 0 ? nextMap : undefined;
}

function getUpdatedAtTimestamp(): string {
	return new Date().toISOString();
}

function isSequenceCompleted(task: ReviewTask, sequenceIndex: number): boolean {
	return task.completedSequenceIndexes.includes(sequenceIndex);
}

function isSequenceSkipped(task: ReviewTask, sequenceIndex: number): boolean {
	return task.skippedSequenceIndexes.includes(sequenceIndex);
}

function getRollingAnchorDate(task: ReviewTask): string {
	return task.rollingAnchorDate ?? task.startDate;
}

function getIntervalAt(task: ReviewTask, sequenceIndex: number): number {
	const interval = task.intervalsSnapshot[sequenceIndex];
	if (interval === undefined) {
		throw new Error(
			`Missing interval at sequence index ${sequenceIndex} for task ${task.id}`,
		);
	}

	return interval;
}

export function getOccurrenceId(taskId: string, sequenceIndex: number): string {
	return `${taskId}:${sequenceIndex}`;
}

export function getFixedPlannedDate(
	task: ReviewTask,
	sequenceIndex: number,
): string {
	return addCalendarDays(task.startDate, getIntervalAt(task, sequenceIndex));
}

export function getRollingGapDays(
	intervals: number[],
	sequenceIndex: number,
): number {
	const current = intervals[sequenceIndex];
	if (current === undefined) {
		throw new Error(`Missing rolling interval at sequence index ${sequenceIndex}`);
	}

	if (sequenceIndex === 0) {
		return current;
	}

	const previous = intervals[sequenceIndex - 1];
	if (previous === undefined) {
		throw new Error(
			`Missing previous rolling interval at sequence index ${sequenceIndex - 1}`,
		);
	}

	return current - previous;
}

function getLatestRollingCompletedSequenceIndex(task: ReviewTask): number {
	return task.completedSequenceIndexes.reduce(
		(latestIndex, index) => (index > latestIndex ? index : latestIndex),
		-1,
	);
}

function getRollingAnchorSequenceIndex(task: ReviewTask): number {
	if (task.rollingAnchorDate === undefined) {
		return -1;
	}

	return getLatestRollingCompletedSequenceIndex(task);
}

export function getRollingPlannedDate(
	task: ReviewTask,
	sequenceIndex: number,
): string {
	const anchorDate = getRollingAnchorDate(task);
	const anchorSequenceIndex = getRollingAnchorSequenceIndex(task);

	if (sequenceIndex <= anchorSequenceIndex) {
		return addCalendarDays(
			anchorDate,
			getRollingGapDays(task.intervalsSnapshot, sequenceIndex),
		);
	}

	let plannedDate = anchorDate;
	for (
		let currentSequenceIndex = anchorSequenceIndex + 1;
		currentSequenceIndex <= sequenceIndex;
		currentSequenceIndex += 1
	) {
		plannedDate = addCalendarDays(
			plannedDate,
			getRollingGapDays(task.intervalsSnapshot, currentSequenceIndex),
		);
	}

	return plannedDate;
}

export function createOccurrence(
	task: ReviewTask,
	sequenceIndex: number,
	today: string,
	options: {
		scheduleMode: ScheduleMode;
		overduePolicy: OverduePolicy;
	},
): ReviewOccurrence {
	if (!isIsoDateString(today)) {
		throw new Error(`Invalid today ISO date string: ${String(today)}`);
	}

	const plannedDate =
		options.scheduleMode === 'rollingTimeline'
			? getRollingPlannedDate(task, sequenceIndex)
			: getFixedPlannedDate(task, sequenceIndex);

	if (isSequenceCompleted(task, sequenceIndex)) {
		return {
			occurrenceId: getOccurrenceId(task.id, sequenceIndex),
			taskId: task.id,
			sequenceIndex,
			plannedDate,
			effectiveDate: plannedDate,
			status: 'completed',
			sourceIntervalDays: getIntervalAt(task, sequenceIndex),
			isOverdue: false,
			dailyNoteDate: plannedDate,
			completedAt:
				task.completedDatesBySequenceIndex?.[String(sequenceIndex)],
		};
	}

	if (isSequenceSkipped(task, sequenceIndex)) {
		return {
			occurrenceId: getOccurrenceId(task.id, sequenceIndex),
			taskId: task.id,
			sequenceIndex,
			plannedDate,
			effectiveDate: plannedDate,
			status: 'skipped',
			sourceIntervalDays: getIntervalAt(task, sequenceIndex),
			isOverdue: false,
			dailyNoteDate: plannedDate,
			skippedAt:
				task.skippedDatesBySequenceIndex?.[String(sequenceIndex)],
		};
	}

	if (isBeforeDate(plannedDate, today)) {
		return {
			occurrenceId: getOccurrenceId(task.id, sequenceIndex),
			taskId: task.id,
			sequenceIndex,
			plannedDate,
			effectiveDate: today,
			status: 'overdue',
			sourceIntervalDays: getIntervalAt(task, sequenceIndex),
			isOverdue: true,
			dailyNoteDate: today,
		};
	}

	if (isSameDate(plannedDate, today)) {
		return {
			occurrenceId: getOccurrenceId(task.id, sequenceIndex),
			taskId: task.id,
			sequenceIndex,
			plannedDate,
			effectiveDate: today,
			status: 'pending',
			sourceIntervalDays: getIntervalAt(task, sequenceIndex),
			isOverdue: false,
			dailyNoteDate: today,
		};
	}

	return {
		occurrenceId: getOccurrenceId(task.id, sequenceIndex),
		taskId: task.id,
		sequenceIndex,
		plannedDate,
		effectiveDate: plannedDate,
		status: 'pending',
		sourceIntervalDays: getIntervalAt(task, sequenceIndex),
		isOverdue: false,
		dailyNoteDate: plannedDate,
	};
}

export function getDueOccurrencesForTask(
	task: ReviewTask,
	today: string,
	options: DueOccurrencesOptions,
): ReviewOccurrence[] {
	if (!isIsoDateString(today) || task.status !== 'active') {
		return [];
	}

	const maxOccurrencesPerTask = Math.max(options.maxOccurrencesPerTask ?? 1, 1);
	const occurrences: ReviewOccurrence[] = [];

	for (
		let sequenceIndex = 0;
		sequenceIndex < task.intervalsSnapshot.length;
		sequenceIndex += 1
	) {
		const occurrence = createOccurrence(task, sequenceIndex, today, options);

		if (
			occurrence.status === 'completed' ||
			occurrence.status === 'skipped' ||
			isAfterDate(occurrence.plannedDate, today)
		) {
			continue;
		}

		if (
			occurrence.status === 'overdue' &&
			options.overduePolicy === 'skip'
		) {
			continue;
		}

		occurrences.push(occurrence);

		if (occurrences.length >= maxOccurrencesPerTask) {
			break;
		}
	}

	return occurrences;
}

export function getDueOccurrences(
	tasks: ReviewTask[],
	today: string,
	options: DueOccurrencesOptions,
): ReviewOccurrence[] {
	return tasks.flatMap((task) => getDueOccurrencesForTask(task, today, options));
}

export function completeOccurrence(
	task: ReviewTask,
	occurrence: ReviewOccurrence,
	completedDate: string,
	scheduleMode: ScheduleMode,
): ReviewTask {
	if (!isIsoDateString(completedDate)) {
		throw new Error(`Invalid completion date: ${String(completedDate)}`);
	}

	const completedSequenceIndexes = sortUniqueIndexes([
		...task.completedSequenceIndexes,
		occurrence.sequenceIndex,
	]);

	const skippedSequenceIndexes = task.skippedSequenceIndexes.filter(
		(index) => index !== occurrence.sequenceIndex,
	);
	const completedDatesBySequenceIndex = {
		...(task.completedDatesBySequenceIndex ?? {}),
		[String(occurrence.sequenceIndex)]: completedDate,
	};
	const skippedDatesBySequenceIndex = withoutSequenceIndex(
		task.skippedDatesBySequenceIndex,
		occurrence.sequenceIndex,
	);

	return {
		...task,
		completedSequenceIndexes,
		skippedSequenceIndexes,
		completedDatesBySequenceIndex,
		skippedDatesBySequenceIndex,
		rollingAnchorDate:
			scheduleMode === 'rollingTimeline'
				? completedDate
				: task.rollingAnchorDate,
		updatedAt: getUpdatedAtTimestamp(),
	};
}

export function skipOccurrence(
	task: ReviewTask,
	occurrence: ReviewOccurrence,
	skippedDate: string,
): ReviewTask {
	if (!isIsoDateString(skippedDate)) {
		throw new Error(`Invalid skipped date: ${String(skippedDate)}`);
	}

	const skippedSequenceIndexes = sortUniqueIndexes([
		...task.skippedSequenceIndexes,
		occurrence.sequenceIndex,
	]);

	const completedSequenceIndexes = task.completedSequenceIndexes.filter(
		(index) => index !== occurrence.sequenceIndex,
	);
	const skippedDatesBySequenceIndex = {
		...(task.skippedDatesBySequenceIndex ?? {}),
		[String(occurrence.sequenceIndex)]: skippedDate,
	};
	const completedDatesBySequenceIndex = withoutSequenceIndex(
		task.completedDatesBySequenceIndex,
		occurrence.sequenceIndex,
	);

	return {
		...task,
		completedSequenceIndexes,
		skippedSequenceIndexes,
		completedDatesBySequenceIndex,
		skippedDatesBySequenceIndex,
		updatedAt: getUpdatedAtTimestamp(),
	};
}
