import { Notice } from 'obsidian';
import { getDictionary, type NestKitDictionary } from '../../i18n';
import { CreateSpacedReviewTaskModal } from './create-task-modal';
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
			disabledNotice: string;
			createdNotice: string;
			createFailedNotice: string;
		};
	};
}

export const CREATE_SPACED_REVIEW_TASK_COMMAND_ID =
	'create-spaced-review-task';

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
}

async function handleCreateTaskCommand(
	plugin: NestKitPlugin,
	getSettings: () => NestKitSettings,
	getFeature: () => SpacedReviewFeature | undefined,
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

	const modal = new CreateSpacedReviewTaskModal(
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
	);

	modal.open();
}
