import { Notice } from 'obsidian';
import { getDictionary, type NestKitDictionary } from '../../i18n';
import { CreateSpacedReviewTaskModal } from './create-task-modal';
import { syncTodayReviewsToDailyNote } from './daily-note-sync';
import { SpacedReviewOverviewModal } from './overview-modal';
import type { ReviewTask } from './types';
import type { NestKitSettings } from '../../settings';
import type NestKitPlugin from '../../main';
import type { SpacedReviewFeature } from './index';

interface SpacedReviewCommandDictionaryExtension {
	commands: {
		spacedReview: {
			createTask: {
				name: string;
			};
			openOverview: {
				name: string;
			};
			syncDailyNote: {
				name: string;
				success: string;
				failed: string;
				duplicateMarkerWarning: string;
			};
			disabledNotice: string;
			createdNotice: string;
			createFailedNotice: string;
		};
	};
	spacedReview: {
		notices: {
			enableFirst: string;
		};
	};
}

export const CREATE_SPACED_REVIEW_TASK_COMMAND_ID =
	'create-spaced-review-task';
export const OPEN_SPACED_REVIEW_OVERVIEW_COMMAND_ID =
	'open-spaced-review-overview';
export const SYNC_SPACED_REVIEW_DAILY_NOTE_COMMAND_ID =
	'sync-spaced-review-daily-note';

interface OpenCreateTaskModalOptions {
	initialTitle?: string;
	initialTargetLink?: string;
}

export function registerSpacedReviewCommands(
	plugin: NestKitPlugin,
	getSettings: () => NestKitSettings,
	getFeature: () => SpacedReviewFeature | undefined,
): void {
	const dictionary = getDictionary(
		getSettings().uiLanguage,
	) as NestKitDictionary & SpacedReviewCommandDictionaryExtension;

	plugin.addCommand({
		id: CREATE_SPACED_REVIEW_TASK_COMMAND_ID,
		name: dictionary.commands.spacedReview.createTask.name,
		callback: () => {
			void handleCreateTaskCommand(plugin, getSettings, getFeature);
		},
	});

	plugin.addCommand({
		id: OPEN_SPACED_REVIEW_OVERVIEW_COMMAND_ID,
		name: dictionary.commands.spacedReview.openOverview.name,
		callback: () => {
			void handleOpenOverviewCommand(plugin, getSettings, getFeature);
		},
	});

	plugin.addCommand({
		id: SYNC_SPACED_REVIEW_DAILY_NOTE_COMMAND_ID,
		name: dictionary.commands.spacedReview.syncDailyNote.name,
		callback: () => {
			void handleSyncDailyNoteCommand(plugin, getSettings, getFeature);
		},
	});
}

export async function openCreateSpacedReviewTaskModal(
	plugin: NestKitPlugin,
	getSettings: () => NestKitSettings,
	getFeature: () => SpacedReviewFeature | undefined,
	options?: OpenCreateTaskModalOptions,
): Promise<void> {
	const settings = getSettings();
	const dictionary = getDictionary(
		settings.uiLanguage,
	) as NestKitDictionary & SpacedReviewCommandDictionaryExtension;

	if (!settings.spacedReviewEnabled) {
		new Notice(dictionary.commands.spacedReview.disabledNotice);
		return;
	}

	const feature = getFeature();
	if (!feature?.isEnabled()) {
		new Notice(dictionary.commands.spacedReview.disabledNotice);
		return;
	}

	const modal = CreateSpacedReviewTaskModal.forCreate(
		plugin.app,
		settings,
		async (input): Promise<ReviewTask | null> => {
			try {
				const task = await feature.createTaskFromInput(input);
				new Notice(dictionary.commands.spacedReview.createdNotice);
				return task;
			} catch (error) {
				console.error('[NestKit] Failed to create spaced review task.', error);
				new Notice(dictionary.commands.spacedReview.createFailedNotice);
				return null;
			}
		},
		{
			title: options?.initialTitle,
			targetLink: options?.initialTargetLink,
		},
	);

	modal.open();
}

export async function openSpacedReviewOverview(
	plugin: NestKitPlugin,
	getSettings: () => NestKitSettings,
	getFeature: () => SpacedReviewFeature | undefined,
): Promise<void> {
	const settings = getSettings();
	const dictionary = getDictionary(
		settings.uiLanguage,
	) as NestKitDictionary & SpacedReviewCommandDictionaryExtension;

	if (!settings.spacedReviewEnabled) {
		new Notice(dictionary.spacedReview.notices.enableFirst);
		return;
	}

	const feature = getFeature();
	if (!feature?.isEnabled()) {
		new Notice(dictionary.spacedReview.notices.enableFirst);
		return;
	}

	new SpacedReviewOverviewModal(
		plugin.app,
		getSettings,
		feature,
	).open();
}

export async function syncSpacedReviewDailyNote(
	plugin: NestKitPlugin,
	getSettings: () => NestKitSettings,
	getFeature: () => SpacedReviewFeature | undefined,
): Promise<void> {
	const settings = getSettings();
	const dictionary = getDictionary(
		settings.uiLanguage,
	) as NestKitDictionary & SpacedReviewCommandDictionaryExtension;

	if (!settings.spacedReviewEnabled) {
		new Notice(dictionary.spacedReview.notices.enableFirst);
		return;
	}

	const feature = getFeature();
	if (!feature?.isEnabled()) {
		new Notice(dictionary.spacedReview.notices.enableFirst);
		return;
	}

	try {
		await syncTodayReviewsToDailyNote({
			app: plugin.app,
			settings,
			feature,
		});
	} catch (error) {
		console.error('[NestKit] Failed to sync spaced review Daily Note.', error);
		new Notice(dictionary.commands.spacedReview.syncDailyNote.failed);
	}
}

async function handleCreateTaskCommand(
	plugin: NestKitPlugin,
	getSettings: () => NestKitSettings,
	getFeature: () => SpacedReviewFeature | undefined,
): Promise<void> {
	await openCreateSpacedReviewTaskModal(plugin, getSettings, getFeature);
}

async function handleOpenOverviewCommand(
	plugin: NestKitPlugin,
	getSettings: () => NestKitSettings,
	getFeature: () => SpacedReviewFeature | undefined,
): Promise<void> {
	await openSpacedReviewOverview(plugin, getSettings, getFeature);
}

async function handleSyncDailyNoteCommand(
	plugin: NestKitPlugin,
	getSettings: () => NestKitSettings,
	getFeature: () => SpacedReviewFeature | undefined,
): Promise<void> {
	await syncSpacedReviewDailyNote(plugin, getSettings, getFeature);
}
