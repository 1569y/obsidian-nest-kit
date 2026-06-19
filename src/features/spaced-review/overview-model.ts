import { addCalendarDays, compareIsoDates, isBeforeDate, isSameDate } from './dates';
import { getBuiltInReviewPreset } from './presets';
import { createOccurrence } from './schedule';
import type {
	OverduePolicy,
	ReviewOccurrence,
	ReviewTask,
	ScheduleMode,
	SpacedReviewStore,
} from './types';

export const INLINE_SEPARATOR = ' \u00b7 ';

export interface SpacedReviewWeekDayItem {
	date: string;
	weekdayLabel: string;
	dayLabel: string;
	isToday: boolean;
	isSelected: boolean;
	dueCount: number;
	overdueCount: number;
	dueCountLabel: string;
	overdueCountLabel: string;
}

export interface SpacedReviewWeekNavigatorModel {
	weekStart: string;
	weekEnd: string;
	label: string;
	days: SpacedReviewWeekDayItem[];
}

export interface ReviewCardWeekState {
	date: string;
	label: string;
	state: 'none' | 'planned' | 'selected' | 'overdue' | 'today';
	countLabel?: string;
}

export type OverviewOccurrenceBadgeKind = 'overdue' | 'due' | 'future';

export interface SpacedReviewOverviewOccurrenceItem {
	task: ReviewTask;
	occurrence: ReviewOccurrence;
	badgeKind: OverviewOccurrenceBadgeKind;
	reviewNumber: number;
	intervalDays: number;
	title: string;
	badgeLabel: string;
	primaryLine: string;
	secondaryLine: string;
	weekStates: ReviewCardWeekState[];
}

export interface ReviewTaskOverviewItem {
	task: ReviewTask;
	title: string;
	notePreview: string;
	progressCompactLabel: string;
	presetLabel: string;
	reviewTrack: ReviewTrackItem[];
}

export interface ReviewTaskOverviewSubgroup {
	label: string;
	taskCount: number;
	isUngrouped: boolean;
	tasks: ReviewTaskOverviewItem[];
}

export interface ReviewTaskOverviewGroup {
	key: string;
	label: string;
	taskCount: number;
	isUngrouped: boolean;
	subgroups: ReviewTaskOverviewSubgroup[];
}

export type ReviewTrackItemState =
	| 'pending'
	| 'current'
	| 'overdue'
	| 'completed'
	| 'skipped'
	| 'future';

export interface ReviewTrackItem {
	sequenceIndex: number;
	reviewNumber: number;
	reviewNumberLabel: string;
	dateLabel: string;
	state: ReviewTrackItemState;
	compactLabel: string;
	accessibleLabel: string;
}

export interface SpacedReviewOverviewModel {
	today: string;
	selectedDate: string;
	totalActiveTasks: number;
	totalArchivedTasks: number;
	totalManagedTasks: number;
	dueTodayCount: number;
	overdueCount: number;
	weekNavigator: SpacedReviewWeekNavigatorModel;
	selectedDateDue: SpacedReviewOverviewOccurrenceItem[];
	selectedDateOverdue: SpacedReviewOverviewOccurrenceItem[];
	activeTaskGroups: ReviewTaskOverviewGroup[];
	archivedTaskGroups: ReviewTaskOverviewGroup[];
}

interface OverviewModelDictionary {
	spacedReview: {
		overview: {
			activeBadge: string;
			dueTodayBadge: string;
			overdueBadge: string;
			futureBadge: string;
			dateChipToday: string;
			contentSectionAriaLabel: string;
			dueCountCompact: (count: number) => string;
			overdueCountCompact: (count: number) => string;
			weekRange: (start: string, end: string) => string;
			dueTodayLine: (reviewNumber: number) => string;
			overdueLine: (reviewNumber: number) => string;
			futureLine: (reviewNumber: number) => string;
			carriedToToday: string;
			plannedDateShort: (date: string) => string;
			originalPlannedDate: (date: string) => string;
			noPendingReviews: string;
			progress: (current: number, total: number) => string;
			nextReviewCompact: (date: string) => string;
			progressCompact: (current: number, total: number) => string;
			help: string;
			legendTitle: string;
			legendSymbols: string;
			legendPresets: string;
			legendDueCount: string;
			legendOverdueCount: string;
			legendToday: string;
			legendSelectedDate: string;
			legendReadOnly: string;
			fastReview: string;
			standardReview: string;
			longTermMemory: string;
			customPreset: string;
			customPresetWithIntervals: (intervals: string) => string;
			reviewTrackItem: (reviewNumber: number) => string;
			current: string;
			future: string;
			completed: string;
			skipped: string;
			ungrouped: string;
		};
	};
}

function getEffectiveOverduePolicy(
	task: ReviewTask,
	overduePolicy: OverduePolicy,
): OverduePolicy {
	return task.overduePolicyOverride ?? overduePolicy;
}

function getEffectiveScheduleMode(
	task: ReviewTask,
	scheduleMode: ScheduleMode,
): ScheduleMode {
	return task.scheduleModeOverride ?? scheduleMode;
}

function formatShortDate(date: string): string {
	return date.slice(5);
}

function getActionDateLabel(
	dateMap: Record<string, string> | undefined,
	sequenceIndex: number,
): string {
	const date = dateMap?.[String(sequenceIndex)];
	return typeof date === 'string' ? formatShortDate(date) : '';
}

function getNotePreview(note: string | undefined): string {
	if (typeof note !== 'string') {
		return '';
	}

	return note.replace(/\s+/g, ' ').trim();
}

export function getOverviewWeekStart(date: string): string {
	const [yearText, monthText, dayText] = date.split('-');
	const dateValue = new Date(
		Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText)),
	);

	return addCalendarDays(date, -dateValue.getUTCDay());
}

function hasExactIntervalMatch(left: number[], right: number[]): boolean {
	if (left.length !== right.length) {
		return false;
	}

	return left.every((value, index) => value === right[index]);
}

function formatIntervalsLabel(intervals: number[]): string {
	return intervals.map(String).join(INLINE_SEPARATOR);
}

function getPresetLabel(
	task: ReviewTask,
	dictionary: OverviewModelDictionary,
): string {
	const overview = dictionary.spacedReview.overview;
	const preset = getBuiltInReviewPreset(task.presetId);

	if (!preset) {
		return overview.customPresetWithIntervals(
			formatIntervalsLabel(task.intervalsSnapshot),
		);
	}

	if (!hasExactIntervalMatch(task.intervalsSnapshot, preset.intervals)) {
		return overview.customPresetWithIntervals(
			formatIntervalsLabel(task.intervalsSnapshot),
		);
	}

	switch (preset.id) {
		case 'fast-review':
			return overview.fastReview;
		case 'standard-review':
			return overview.standardReview;
		case 'long-term-memory':
			return overview.longTermMemory;
		default:
			return overview.customPreset;
	}
}

function getWeekdayLabel(date: string): string {
	const [yearText, monthText, dayText] = date.split('-');
	const dateValue = new Date(
		Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText)),
	);
	const weekdayIndex = dateValue.getUTCDay();
	return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][weekdayIndex] ?? '';
}

function getPendingOccurrences(
	task: ReviewTask,
	today: string,
	overduePolicy: OverduePolicy,
	scheduleMode: ScheduleMode,
): ReviewOccurrence[] {
	const effectiveOverduePolicy = getEffectiveOverduePolicy(task, overduePolicy);
	const effectiveScheduleMode = getEffectiveScheduleMode(task, scheduleMode);
	const occurrences: ReviewOccurrence[] = [];

	for (
		let sequenceIndex = 0;
		sequenceIndex < task.intervalsSnapshot.length;
		sequenceIndex += 1
	) {
		const occurrence = createOccurrence(task, sequenceIndex, today, {
			overduePolicy: effectiveOverduePolicy,
			scheduleMode: effectiveScheduleMode,
		});

		if (
			occurrence.status === 'completed' ||
			occurrence.status === 'skipped'
		) {
			continue;
		}

		occurrences.push(occurrence);
	}

	return occurrences;
}

function getAllOccurrences(
	task: ReviewTask,
	today: string,
	overduePolicy: OverduePolicy,
	scheduleMode: ScheduleMode,
): ReviewOccurrence[] {
	const effectiveOverduePolicy = getEffectiveOverduePolicy(task, overduePolicy);
	const effectiveScheduleMode = getEffectiveScheduleMode(task, scheduleMode);

	return task.intervalsSnapshot.map((_, sequenceIndex) =>
		createOccurrence(task, sequenceIndex, today, {
			overduePolicy: effectiveOverduePolicy,
			scheduleMode: effectiveScheduleMode,
		}),
	);
}

export function getActionableOccurrenceForTask(
	task: ReviewTask,
	today: string,
	overduePolicy: OverduePolicy,
	scheduleMode: ScheduleMode,
): ReviewOccurrence | undefined {
	return getPendingOccurrences(task, today, overduePolicy, scheduleMode)[0];
}

function buildMiniWeekStates(input: {
	selectedDate: string;
	today: string;
	actionableOccurrence?: ReviewOccurrence;
	weekDays: SpacedReviewWeekDayItem[];
}): ReviewCardWeekState[] {
	return input.weekDays.map((day) => {
		let state: ReviewCardWeekState['state'] = 'none';

		if (day.isToday) {
			state = 'today';
		}

		if (day.isSelected) {
			state = 'selected';
		}

		if (input.actionableOccurrence) {
			if (
				input.actionableOccurrence.isOverdue &&
				isSameDate(input.actionableOccurrence.plannedDate, day.date)
			) {
				state = 'overdue';
			} else if (
				isSameDate(input.actionableOccurrence.plannedDate, day.date)
			) {
				state = 'planned';
			}
		}

		const countLabel =
			state === 'overdue'
				? '!'
				: state === 'planned'
					? '\u2022'
					: undefined;

		return {
			date: day.date,
			label: day.dayLabel,
			state,
			countLabel,
		};
	});
}

function buildOccurrenceItem(input: {
	task: ReviewTask;
	occurrence: ReviewOccurrence;
	today: string;
	selectedDate: string;
	dictionary: OverviewModelDictionary;
	weekDays: SpacedReviewWeekDayItem[];
}): SpacedReviewOverviewOccurrenceItem {
	const overview = input.dictionary.spacedReview.overview;
	const reviewNumber = input.occurrence.sequenceIndex + 1;
	const intervalDays = input.occurrence.sourceIntervalDays;

	let badgeKind: OverviewOccurrenceBadgeKind;
	let badgeLabel: string;
	let primaryLine: string;

	if (input.occurrence.isOverdue) {
		badgeKind = 'overdue';
		badgeLabel = overview.overdueBadge;
		primaryLine = overview.overdueLine(reviewNumber);
	} else if (isSameDate(input.selectedDate, input.today)) {
		badgeKind = 'due';
		badgeLabel = overview.dueTodayBadge;
		primaryLine = overview.dueTodayLine(reviewNumber);
	} else {
		badgeKind = 'future';
		badgeLabel = overview.futureBadge;
		primaryLine = overview.futureLine(reviewNumber);
	}

	const secondaryLine = input.occurrence.isOverdue
		? overview.originalPlannedDate(
				formatShortDate(input.occurrence.plannedDate),
			)
		: overview.plannedDateShort(formatShortDate(input.occurrence.plannedDate));

	return {
		task: input.task,
		occurrence: input.occurrence,
		badgeKind,
		reviewNumber,
		intervalDays,
		title: input.task.title,
		badgeLabel,
		primaryLine,
		secondaryLine,
		weekStates: buildMiniWeekStates({
			selectedDate: input.selectedDate,
			today: input.today,
			actionableOccurrence: input.occurrence,
			weekDays: input.weekDays,
		}),
	};
}

function buildActiveTaskItem(input: {
	task: ReviewTask;
	actionableOccurrence?: ReviewOccurrence;
	today: string;
	overduePolicy: OverduePolicy;
	scheduleMode: ScheduleMode;
	dictionary: OverviewModelDictionary;
}): ReviewTaskOverviewItem {
	const overview = input.dictionary.spacedReview.overview;
	const totalReviews = input.task.intervalsSnapshot.length;
	const completedCount = input.task.completedSequenceIndexes.length;
	const allOccurrences = getAllOccurrences(
		input.task,
		input.today,
		input.overduePolicy,
		input.scheduleMode,
	);
	const reviewTrack = allOccurrences.map((occurrence): ReviewTrackItem => {
		let state: ReviewTrackItemState;
		let stateLabel: string;
		let reviewNumberLabel = '\u25cb';
		let dateLabel = formatShortDate(occurrence.plannedDate);
		let compactLabel = `${reviewNumberLabel} ${formatShortDate(occurrence.plannedDate)}`;
		let accessibleLabel = '';

		if (occurrence.status === 'completed') {
			state = 'completed';
			stateLabel = overview.completed;
			reviewNumberLabel = '\u2713';
			dateLabel = getActionDateLabel(
				input.task.completedDatesBySequenceIndex,
				occurrence.sequenceIndex,
			);
			compactLabel = dateLabel.length > 0 ? `${reviewNumberLabel} ${dateLabel}` : reviewNumberLabel;
			accessibleLabel =
				dateLabel.length > 0
					? `${overview.reviewTrackItem(occurrence.sequenceIndex + 1)}${INLINE_SEPARATOR}${dateLabel}${INLINE_SEPARATOR}${stateLabel}`
					: `${overview.reviewTrackItem(occurrence.sequenceIndex + 1)}${INLINE_SEPARATOR}${stateLabel}`;
		} else if (occurrence.status === 'skipped') {
			state = 'skipped';
			stateLabel = overview.skipped;
			reviewNumberLabel = '>';
			dateLabel = getActionDateLabel(
				input.task.skippedDatesBySequenceIndex,
				occurrence.sequenceIndex,
			);
			compactLabel = dateLabel.length > 0 ? `${reviewNumberLabel} ${dateLabel}` : reviewNumberLabel;
			accessibleLabel =
				dateLabel.length > 0
					? `${overview.reviewTrackItem(occurrence.sequenceIndex + 1)}${INLINE_SEPARATOR}${dateLabel}${INLINE_SEPARATOR}${stateLabel}`
					: `${overview.reviewTrackItem(occurrence.sequenceIndex + 1)}${INLINE_SEPARATOR}${stateLabel}`;
		} else if (
			input.actionableOccurrence &&
			occurrence.sequenceIndex === input.actionableOccurrence.sequenceIndex
		) {
			if (occurrence.isOverdue) {
				state = 'overdue';
				stateLabel = overview.overdueBadge;
				reviewNumberLabel = '!';
			} else {
				state = 'current';
				stateLabel = overview.current;
				reviewNumberLabel = '\u25cf';
			}
		} else if (
			input.actionableOccurrence &&
			occurrence.sequenceIndex > input.actionableOccurrence.sequenceIndex
		) {
			state = 'future';
			stateLabel = overview.future;
			reviewNumberLabel = '\u25cb';
		} else if (occurrence.isOverdue) {
			state = 'overdue';
			stateLabel = overview.overdueBadge;
			reviewNumberLabel = '!';
		} else {
			state = 'pending';
			stateLabel = overview.future;
			reviewNumberLabel = '\u25cb';
		}

		if (!accessibleLabel) {
			accessibleLabel = `${overview.reviewTrackItem(occurrence.sequenceIndex + 1)}${INLINE_SEPARATOR}${formatShortDate(occurrence.plannedDate)}${INLINE_SEPARATOR}${stateLabel}`;
		}

		if (dateLabel.length > 0) {
			compactLabel = `${reviewNumberLabel} ${dateLabel}`;
		} else {
			compactLabel = reviewNumberLabel;
		}

		return {
			sequenceIndex: occurrence.sequenceIndex,
			reviewNumber: occurrence.sequenceIndex + 1,
			reviewNumberLabel,
			dateLabel,
			state,
			compactLabel,
			accessibleLabel,
		};
	});

	return {
		task: input.task,
		title: input.task.title,
		notePreview: getNotePreview(input.task.note),
		progressCompactLabel: overview.progressCompact(completedCount, totalReviews),
		presetLabel: getPresetLabel(input.task, input.dictionary),
		reviewTrack,
	};
}

function compareIsoDateTimeDesc(left: string, right: string): number {
	return right.localeCompare(left);
}

function compareTaskOverviewItemsByCreatedAtDesc(
	left: ReviewTaskOverviewItem,
	right: ReviewTaskOverviewItem,
): number {
	return (
		compareIsoDateTimeDesc(left.task.createdAt, right.task.createdAt) ||
		compareIsoDateTimeDesc(left.task.updatedAt, right.task.updatedAt) ||
		left.title.localeCompare(right.title) ||
		left.task.id.localeCompare(right.task.id)
	);
}

function buildActiveTaskGroups(
	items: ReviewTaskOverviewItem[],
	dictionary: OverviewModelDictionary,
): ReviewTaskOverviewGroup[] {
	interface ReviewTaskOverviewSubgroupBucket {
		label: string;
		isUngrouped: boolean;
		latestItem: ReviewTaskOverviewItem;
		tasks: ReviewTaskOverviewItem[];
	}

	interface ReviewTaskOverviewGroupBucket {
		key: string;
		label: string;
		isUngrouped: boolean;
		latestItem: ReviewTaskOverviewItem;
		subgroups: Map<string, ReviewTaskOverviewSubgroupBucket>;
	}

	const ungroupedLabel = dictionary.spacedReview.overview.ungrouped;
	const groupBuckets = new Map<string, ReviewTaskOverviewGroupBucket>();

	for (const item of items) {
		const groupSegment = item.task.groupPath?.[0];
		const subgroupSegment = item.task.groupPath?.[1];
		const groupLabel = groupSegment ?? ungroupedLabel;
		const subgroupLabel = subgroupSegment ?? ungroupedLabel;
		const isGroupUngrouped = groupSegment === undefined;
		const isSubgroupUngrouped = subgroupSegment === undefined;
		const groupKey = isGroupUngrouped
			? '__ungrouped__'
			: groupLabel.toLocaleLowerCase();
		const subgroupKey = isSubgroupUngrouped
			? '__ungrouped__'
			: subgroupLabel.toLocaleLowerCase();

		let groupBucket = groupBuckets.get(groupKey);
		if (!groupBucket) {
			groupBucket = {
				key: groupKey,
				label: groupLabel,
				isUngrouped: isGroupUngrouped,
				latestItem: item,
				subgroups: new Map<string, ReviewTaskOverviewSubgroupBucket>(),
			};
			groupBuckets.set(groupKey, groupBucket);
		} else if (
			compareTaskOverviewItemsByCreatedAtDesc(item, groupBucket.latestItem) < 0
		) {
			groupBucket.latestItem = item;
		}

		let subgroupBucket = groupBucket.subgroups.get(subgroupKey);
		if (!subgroupBucket) {
			subgroupBucket = {
				label: subgroupLabel,
				isUngrouped: isSubgroupUngrouped,
				latestItem: item,
				tasks: [],
			};
			groupBucket.subgroups.set(subgroupKey, subgroupBucket);
		} else if (
			compareTaskOverviewItemsByCreatedAtDesc(
				item,
				subgroupBucket.latestItem,
			) < 0
		) {
			subgroupBucket.latestItem = item;
		}

		subgroupBucket.tasks.push(item);
	}

	const groups = [...groupBuckets.values()].map((groupBucket) => {
		const subgroups = [...groupBucket.subgroups.values()]
			.map((subgroupBucket) => ({
				label: subgroupBucket.label,
				taskCount: subgroupBucket.tasks.length,
				isUngrouped: subgroupBucket.isUngrouped,
				tasks: [...subgroupBucket.tasks].sort(
					compareTaskOverviewItemsByCreatedAtDesc,
				),
				latestItem: subgroupBucket.latestItem,
			}))
			.sort(
				(left, right) =>
					compareTaskOverviewItemsByCreatedAtDesc(
						left.latestItem,
						right.latestItem,
					) || left.label.localeCompare(right.label),
			)
			.map(({ latestItem: _latestItem, ...subgroup }) => subgroup);

		return {
			key: groupBucket.key,
			label: groupBucket.label,
			taskCount: subgroups.reduce(
				(total, subgroup) => total + subgroup.taskCount,
				0,
			),
			isUngrouped: groupBucket.isUngrouped,
			subgroups,
			latestItem: groupBucket.latestItem,
		};
	});

	return groups
		.sort((left, right) => {
			if (left.isUngrouped !== right.isUngrouped) {
				return left.isUngrouped ? 1 : -1;
			}

			return (
				compareTaskOverviewItemsByCreatedAtDesc(
					left.latestItem,
					right.latestItem,
				) || left.label.localeCompare(right.label)
			);
		})
		.map(({ latestItem: _latestItem, ...group }) => group);
}

function shouldAppearOnSelectedDate(input: {
	selectedDate: string;
	today: string;
	occurrence: ReviewOccurrence;
}): 'overdue' | 'due' | 'future' | undefined {
	if (isSameDate(input.selectedDate, input.today)) {
		if (input.occurrence.isOverdue) {
			return 'overdue';
		}
		if (isSameDate(input.occurrence.effectiveDate, input.today)) {
			return 'due';
		}
		return undefined;
	}

	if (isBeforeDate(input.selectedDate, input.today)) {
		if (
			input.occurrence.isOverdue &&
			isSameDate(input.occurrence.plannedDate, input.selectedDate)
		) {
			return 'overdue';
		}
		return undefined;
	}

	if (isSameDate(input.occurrence.plannedDate, input.selectedDate)) {
		return 'future';
	}

	return undefined;
}

function buildWeekNavigator(input: {
	activeTasks: ReviewTask[];
	today: string;
	selectedDate: string;
	weekStart: string;
	overduePolicy: OverduePolicy;
	scheduleMode: ScheduleMode;
	dictionary: OverviewModelDictionary;
}): SpacedReviewWeekNavigatorModel {
	const days: SpacedReviewWeekDayItem[] = [];

	for (let offset = 0; offset < 7; offset += 1) {
		const date = addCalendarDays(input.weekStart, offset);
		let dueCount = 0;
		let overdueCount = 0;

		for (const task of input.activeTasks) {
			const actionableOccurrence = getActionableOccurrenceForTask(
				task,
				input.today,
				input.overduePolicy,
				input.scheduleMode,
			);

			if (!actionableOccurrence) {
				continue;
			}

			const state = shouldAppearOnSelectedDate({
				selectedDate: date,
				today: input.today,
				occurrence: actionableOccurrence,
			});

			if (state === 'overdue') {
				overdueCount += 1;
			} else if (state === 'due' || state === 'future') {
				dueCount += 1;
			}
		}

		days.push({
			date,
			weekdayLabel: getWeekdayLabel(date),
			dayLabel: formatShortDate(date),
			isToday: isSameDate(date, input.today),
			isSelected: isSameDate(date, input.selectedDate),
			dueCount,
			overdueCount,
			dueCountLabel:
				dueCount > 0
					? input.dictionary.spacedReview.overview.dueCountCompact(dueCount)
					: '',
			overdueCountLabel:
				overdueCount > 0
					? input.dictionary.spacedReview.overview.overdueCountCompact(
							overdueCount,
						)
					: '',
		});
	}

	return {
		weekStart: input.weekStart,
		weekEnd: addCalendarDays(input.weekStart, 6),
		label: input.dictionary.spacedReview.overview.weekRange(
			input.weekStart,
			addCalendarDays(input.weekStart, 6),
		),
		days,
	};
}

export function buildSpacedReviewOverviewModel(input: {
	store: SpacedReviewStore;
	today: string;
	selectedDate: string;
	weekStart: string;
	overduePolicy: OverduePolicy;
	scheduleMode: ScheduleMode;
	dictionary: OverviewModelDictionary;
}): SpacedReviewOverviewModel {
	const activeTasks = input.store.tasks.filter((task) => task.status === 'active');
	const archivedTasks = input.store.tasks.filter(
		(task) => task.status === 'archived',
	);
	const actionableByTask = new Map<string, ReviewOccurrence | undefined>();
	let dueTodayCount = 0;
	let overdueCount = 0;

	for (const task of activeTasks) {
		const actionableOccurrence = getActionableOccurrenceForTask(
			task,
			input.today,
			input.overduePolicy,
			input.scheduleMode,
		);
		actionableByTask.set(task.id, actionableOccurrence);

		if (!actionableOccurrence) {
			continue;
		}

		if (actionableOccurrence.isOverdue) {
			overdueCount += 1;
		} else if (isSameDate(actionableOccurrence.effectiveDate, input.today)) {
			dueTodayCount += 1;
		}
	}

	const weekNavigator = buildWeekNavigator({
		activeTasks,
		today: input.today,
		selectedDate: input.selectedDate,
		weekStart: input.weekStart,
		overduePolicy: input.overduePolicy,
		scheduleMode: input.scheduleMode,
		dictionary: input.dictionary,
	});

	const selectedDateOverdue: SpacedReviewOverviewOccurrenceItem[] = [];
	const selectedDateDue: SpacedReviewOverviewOccurrenceItem[] = [];

	const activeTasksItems = activeTasks.map((task): ReviewTaskOverviewItem => {
		const actionableOccurrence = actionableByTask.get(task.id);

		if (actionableOccurrence) {
			const state = shouldAppearOnSelectedDate({
				selectedDate: input.selectedDate,
				today: input.today,
				occurrence: actionableOccurrence,
			});

			if (state === 'overdue') {
				selectedDateOverdue.push(
					buildOccurrenceItem({
						task,
						occurrence: actionableOccurrence,
						today: input.today,
						selectedDate: input.selectedDate,
						dictionary: input.dictionary,
						weekDays: weekNavigator.days,
					}),
				);
			} else if (state === 'due' || state === 'future') {
				selectedDateDue.push(
					buildOccurrenceItem({
						task,
						occurrence: actionableOccurrence,
						today: input.today,
						selectedDate: input.selectedDate,
						dictionary: input.dictionary,
						weekDays: weekNavigator.days,
					}),
				);
			}
		}

		return buildActiveTaskItem({
			task,
			actionableOccurrence,
			today: input.today,
			overduePolicy: input.overduePolicy,
			scheduleMode: input.scheduleMode,
			dictionary: input.dictionary,
		});
	});

	const activeTaskGroups = buildActiveTaskGroups(
		activeTasksItems,
		input.dictionary,
	);
	const archivedTaskGroups = buildActiveTaskGroups(
		archivedTasks.map((task): ReviewTaskOverviewItem => {
			const actionableOccurrence = getActionableOccurrenceForTask(
				task,
				input.today,
				input.overduePolicy,
				input.scheduleMode,
			);

			return buildActiveTaskItem({
				task,
				actionableOccurrence,
				today: input.today,
				overduePolicy: input.overduePolicy,
				scheduleMode: input.scheduleMode,
				dictionary: input.dictionary,
			});
		}),
		input.dictionary,
	);

	selectedDateOverdue.sort((left, right) =>
		compareIsoDates(left.occurrence.plannedDate, right.occurrence.plannedDate) ||
		left.title.localeCompare(right.title),
	);
	selectedDateDue.sort((left, right) =>
		compareIsoDates(left.occurrence.plannedDate, right.occurrence.plannedDate) ||
		left.title.localeCompare(right.title),
	);

	return {
		today: input.today,
		selectedDate: input.selectedDate,
		totalActiveTasks: activeTasks.length,
		totalArchivedTasks: archivedTasks.length,
		totalManagedTasks: activeTasks.length + archivedTasks.length,
		dueTodayCount,
		overdueCount,
		weekNavigator,
		selectedDateDue,
		selectedDateOverdue,
		activeTaskGroups,
		archivedTaskGroups,
	};
}
