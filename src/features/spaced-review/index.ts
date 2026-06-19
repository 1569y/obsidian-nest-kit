import type { Plugin } from 'obsidian';
import type { FeatureModule } from '../../core/feature-module';
import type { NestKitSettings } from '../../settings';
import { todayIsoDate } from './dates';
import { buildSpacedReviewOverviewModel } from './overview-model';
import {
	completeOccurrence,
	createOccurrence,
	skipOccurrence,
} from './schedule';
import {
	createDefaultSpacedReviewStore,
	readSpacedReviewStore,
	removeReviewTask,
	upsertReviewTask,
	writeSpacedReviewStore,
	type SpacedReviewStoreNormalizationResult,
	type SpacedReviewStorageAdapter,
} from './store';
import {
	DuplicateReviewTaskTitleError,
	createReviewTask,
	hasDuplicateReviewTaskTitle,
	normalizeReviewTaskGroupPath,
	normalizeReviewTaskNote,
	normalizeReviewTaskTargetLink,
	normalizeReviewTaskText,
	resolveReviewTaskIntervalsInput,
	type CreateReviewTaskInput,
	type UpdateReviewTaskDetailsInput,
} from './task-factory';
import { VaultSpacedReviewStorageAdapter } from './vault-storage-adapter';
import { getDictionary } from '../../i18n';
import type {
	OverduePolicy,
	ReviewOccurrence,
	ReviewTask,
	ScheduleMode,
} from './types';

function pruneSequenceIndexes(
	indexes: readonly number[],
	maxLength: number,
): number[] {
	return indexes.filter((index) => index < maxLength);
}

function pruneSequenceDateMap(
	dateMap: Record<string, string> | undefined,
	allowedIndexes: readonly number[],
): Record<string, string> | undefined {
	if (!dateMap) {
		return undefined;
	}

	const allowedIndexSet = new Set(allowedIndexes.map(String));
	const nextEntries = Object.entries(dateMap).filter(([key]) =>
		allowedIndexSet.has(key),
	);
	if (nextEntries.length === 0) {
		return undefined;
	}
	return Object.fromEntries(nextEntries);
}

export class SpacedReviewFeature implements FeatureModule {
	private enabled = false;
	private storageAdapter?: SpacedReviewStorageAdapter;
	private activeOverviewOwner: object | null = null;
	private activeOverviewRefresh:
		| (() => Promise<void>)
		| null = null;

	constructor(
		private readonly plugin: Plugin,
		private readonly getSettings: () => NestKitSettings,
	) {}

	enable(): void {
		if (this.enabled) {
			return;
		}

		this.enabled = true;
		this.storageAdapter ??= new VaultSpacedReviewStorageAdapter(this.plugin.app.vault);
	}

	disable(): void {
		this.enabled = false;
	}

	refresh(): void {
		void this.getSettings();
	}

	registerOpenOverviewRefresh(
		owner: object,
		refresh: () => Promise<void>,
	): void {
		this.activeOverviewOwner = owner;
		this.activeOverviewRefresh = refresh;
	}

	clearOpenOverviewRefresh(owner: object): void {
		if (this.activeOverviewOwner !== owner) {
			return;
		}

		this.activeOverviewOwner = null;
		this.activeOverviewRefresh = null;
	}

	async refreshOpenOverviewFromExternalChange(): Promise<boolean> {
		if (!this.activeOverviewRefresh) {
			return false;
		}

		await this.activeOverviewRefresh();
		return true;
	}

	isEnabled(): boolean {
		return this.enabled;
	}

	getStorageAdapter(): SpacedReviewStorageAdapter {
		this.storageAdapter ??= new VaultSpacedReviewStorageAdapter(this.plugin.app.vault);
		return this.storageAdapter;
	}

	async readOverviewStore(): Promise<SpacedReviewStoreNormalizationResult> {
		return readSpacedReviewStore(this.getStorageAdapter());
	}

	async readTodayOverviewItems(): Promise<{
		overdueItems: ReturnType<typeof buildSpacedReviewOverviewModel>['selectedDateOverdue'];
		dueItems: ReturnType<typeof buildSpacedReviewOverviewModel>['selectedDateDue'];
	}> {
		const today = todayIsoDate();
		const settings = this.getSettings();
		const dictionary = getDictionary(settings.uiLanguage) as unknown as Parameters<
			typeof buildSpacedReviewOverviewModel
		>[0]['dictionary'];
		const readResult = await this.readOverviewStore();
		const model = buildSpacedReviewOverviewModel({
			store: readResult.store,
			today,
			selectedDate: today,
			weekStart: today,
			overduePolicy: settings.spacedReviewOverduePolicy,
			scheduleMode: settings.spacedReviewScheduleMode,
			dictionary,
		});

		return {
			overdueItems: model.selectedDateOverdue,
			dueItems: model.selectedDateDue,
		};
	}

	async createTaskFromInput(input: CreateReviewTaskInput): Promise<ReviewTask> {
		const result = createReviewTask(input);
		const adapter = this.getStorageAdapter();
		const readResult = await readSpacedReviewStore(adapter);

		this.assertWritableStore(readResult);

		const currentStore = readResult.store ?? createDefaultSpacedReviewStore();
		if (
			hasDuplicateReviewTaskTitle(
				currentStore.tasks,
				result.title,
				result.task.groupPath,
			)
		) {
			throw new DuplicateReviewTaskTitleError();
		}

		const nextStore = upsertReviewTask(currentStore, result.task);

		await writeSpacedReviewStore(adapter, nextStore);
		return result.task;
	}

	async completeOverviewOccurrence(
		taskId: string,
		sequenceIndex: number,
	): Promise<void> {
		await this.updateOverviewOccurrence(taskId, sequenceIndex, (task, occurrence) =>
			completeOccurrence(
				task,
				occurrence,
				todayIsoDate(),
				this.getEffectiveScheduleMode(task),
			),
		);
	}

	async completeOccurrenceFromDailyNoteImport(
		taskId: string,
		sequenceIndex: number,
		plannedDate: string,
	): Promise<'completed' | 'alreadyCompleted' | 'taskMissing' | 'sequenceMismatch'> {
		const adapter = this.getStorageAdapter();
		const readResult = await readSpacedReviewStore(adapter);
		this.assertWritableStore(readResult);

		const currentStore = readResult.store ?? createDefaultSpacedReviewStore();
		const task = currentStore.tasks.find((entry) => entry.id === taskId);
		if (!task) {
			return 'taskMissing';
		}

		if (task.completedSequenceIndexes.includes(sequenceIndex)) {
			return 'alreadyCompleted';
		}

		const occurrence = this.getActionableOccurrenceForTask(task);
		if (
			!occurrence ||
			occurrence.sequenceIndex !== sequenceIndex ||
			occurrence.plannedDate !== plannedDate
		) {
			return 'sequenceMismatch';
		}

		const nextTask = completeOccurrence(
			task,
			occurrence,
			todayIsoDate(),
			this.getEffectiveScheduleMode(task),
		);
		const nextStore = upsertReviewTask(currentStore, nextTask);
		await writeSpacedReviewStore(adapter, nextStore);
		return 'completed';
	}

	async skipOverviewOccurrence(
		taskId: string,
		sequenceIndex: number,
	): Promise<void> {
		await this.updateOverviewOccurrence(taskId, sequenceIndex, (task, occurrence) =>
			skipOccurrence(task, occurrence, todayIsoDate()),
		);
	}

	async archiveOverviewTask(taskId: string): Promise<void> {
		await this.updateOverviewTask(taskId, (task) => ({
			...task,
			status: 'archived',
			updatedAt: new Date().toISOString(),
		}));
	}

	async restoreOverviewTask(taskId: string): Promise<void> {
		await this.updateOverviewTask(taskId, (task) => ({
			...task,
			status: 'active',
			updatedAt: new Date().toISOString(),
		}));
	}

	async deleteOverviewTask(taskId: string): Promise<boolean> {
		const adapter = this.getStorageAdapter();
		const readResult = await readSpacedReviewStore(adapter);
		this.assertWritableStore(readResult);

		const currentStore = readResult.store ?? createDefaultSpacedReviewStore();
		const taskExists = currentStore.tasks.some((entry) => entry.id === taskId);
		if (!taskExists) {
			return false;
		}

		const nextStore = removeReviewTask(currentStore, taskId);
		await writeSpacedReviewStore(adapter, nextStore);
		return true;
	}

	async updateOverviewTaskDetails(
		taskId: string,
		input: UpdateReviewTaskDetailsInput,
	): Promise<ReviewTask> {
		const adapter = this.getStorageAdapter();
		const readResult = await readSpacedReviewStore(adapter);
		this.assertWritableStore(readResult);

		const currentStore = readResult.store ?? createDefaultSpacedReviewStore();
		const task = currentStore.tasks.find((entry) => entry.id === taskId);

		if (!task) {
			throw new Error(`Spaced Review task not found: ${taskId}`);
		}

		const title = normalizeReviewTaskText(input.title);
		if (title.length === 0) {
			throw new Error('Task title is required.');
		}
		const resolvedIntervals = resolveReviewTaskIntervalsInput({
			presetId: input.presetId,
			customIntervalsText: input.customIntervalsText,
			customPresetsText: input.customPresetsText,
			includeTodayAsFirstReview: input.includeTodayAsFirstReview,
		});

		const groupPath = normalizeReviewTaskGroupPath(input.groupPath);
		if (
			hasDuplicateReviewTaskTitle(
				currentStore.tasks,
				title,
				groupPath,
				task.id,
			)
		) {
			throw new DuplicateReviewTaskTitleError();
		}
		const completedSequenceIndexes = pruneSequenceIndexes(
			task.completedSequenceIndexes,
			resolvedIntervals.intervalsSnapshot.length,
		);
		const skippedSequenceIndexes = pruneSequenceIndexes(
			task.skippedSequenceIndexes,
			resolvedIntervals.intervalsSnapshot.length,
		).filter((index) => !completedSequenceIndexes.includes(index));

		const nextTask: ReviewTask = {
			...task,
			title,
			groupPath,
			note: normalizeReviewTaskNote(input.note),
			targetLink: normalizeReviewTaskTargetLink(input.targetLink),
			presetId: resolvedIntervals.presetId,
			intervalsSnapshot: [...resolvedIntervals.intervalsSnapshot],
			completedSequenceIndexes,
			skippedSequenceIndexes,
			completedDatesBySequenceIndex: pruneSequenceDateMap(
				task.completedDatesBySequenceIndex,
				completedSequenceIndexes,
			),
			skippedDatesBySequenceIndex: pruneSequenceDateMap(
				task.skippedDatesBySequenceIndex,
				skippedSequenceIndexes,
			),
			updatedAt: new Date().toISOString(),
		};
		const nextStore = upsertReviewTask(currentStore, nextTask);
		await writeSpacedReviewStore(adapter, nextStore);
		return nextTask;
	}

	private async updateOverviewOccurrence(
		taskId: string,
		sequenceIndex: number,
		updateTask: (task: ReviewTask, occurrence: ReviewOccurrence) => ReviewTask,
	): Promise<void> {
		const adapter = this.getStorageAdapter();
		const readResult = await readSpacedReviewStore(adapter);
		this.assertWritableStore(readResult);

		const currentStore = readResult.store ?? createDefaultSpacedReviewStore();
		const task = currentStore.tasks.find((entry) => entry.id === taskId);

		if (!task) {
			throw new Error(`Spaced Review task not found: ${taskId}`);
		}

		const occurrence = this.getWritableOverviewOccurrence(task, sequenceIndex);
		const nextTask = updateTask(task, occurrence);
		const nextStore = upsertReviewTask(currentStore, nextTask);
		await writeSpacedReviewStore(adapter, nextStore);
	}

	private async updateOverviewTask(
		taskId: string,
		updateTask: (task: ReviewTask) => ReviewTask,
	): Promise<void> {
		const adapter = this.getStorageAdapter();
		const readResult = await readSpacedReviewStore(adapter);
		this.assertWritableStore(readResult);

		const currentStore = readResult.store ?? createDefaultSpacedReviewStore();
		const task = currentStore.tasks.find((entry) => entry.id === taskId);

		if (!task) {
			throw new Error(`Spaced Review task not found: ${taskId}`);
		}

		const nextTask = updateTask(task);
		const nextStore = upsertReviewTask(currentStore, nextTask);
		await writeSpacedReviewStore(adapter, nextStore);
	}

	private getWritableOverviewOccurrence(
		task: ReviewTask,
		sequenceIndex: number,
	): ReviewOccurrence {
		const occurrence = this.getActionableOccurrenceForTask(task);

		if (!occurrence || occurrence.sequenceIndex !== sequenceIndex) {
			throw new Error(
				`Spaced Review occurrence is no longer actionable: ${task.id}:${sequenceIndex}`,
			);
		}

		return occurrence;
	}

	private getActionableOccurrenceForTask(task: ReviewTask): ReviewOccurrence | undefined {
		const today = todayIsoDate();
		const overduePolicy = this.getEffectiveOverduePolicy(task);
		const scheduleMode = this.getEffectiveScheduleMode(task);

		for (let sequenceIndex = 0; sequenceIndex < task.intervalsSnapshot.length; sequenceIndex += 1) {
			const occurrence = createOccurrence(task, sequenceIndex, today, {
				overduePolicy,
				scheduleMode,
			});

			if (
				occurrence.status === 'completed' ||
				occurrence.status === 'skipped'
			) {
				continue;
			}

			return occurrence;
		}

		return undefined;
	}

	private getEffectiveOverduePolicy(task: ReviewTask): OverduePolicy {
		return task.overduePolicyOverride ?? this.getSettings().spacedReviewOverduePolicy;
	}

	private getEffectiveScheduleMode(task: ReviewTask): ScheduleMode {
		return task.scheduleModeOverride ?? this.getSettings().spacedReviewScheduleMode;
	}

	private assertWritableStore(
		readResult: SpacedReviewStoreNormalizationResult,
	): void {
		if (readResult.hasUnsupportedFutureVersion) {
			throw new Error(
				'This review store was created by a newer version and cannot be modified.',
			);
		}

		if (readResult.shouldPersist === false && readResult.warnings.length > 0) {
			throw new Error(
				'Spaced Review store is not safe to overwrite in the current plugin version.',
			);
		}
	}
}
