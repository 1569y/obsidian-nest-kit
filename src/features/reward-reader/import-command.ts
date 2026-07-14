import { Platform, type TFile } from 'obsidian';
import { getDictionary, type NestKitDictionary } from '../../i18n';
import type NestKitPlugin from '../../main';
import type { NestKitSettings } from '../../settings';
import {
	RewardReaderImportModal,
	isRewardReaderImportSourceFile,
} from './import-modal';

interface RewardReaderImportCommandDictionaryExtension {
	commands: {
		rewardReader: {
			importNovel: {
				name: string;
			};
		};
	};
}

export const REWARD_READER_IMPORT_NOVEL_COMMAND_ID =
	'reward-reader-import-novel';

export interface RewardReaderImportCommandControl {
	closeActiveModal(): void;
	hasActiveModal(): boolean;
	isImportBusy(): boolean;
}

export function registerRewardReaderImportCommand(
	plugin: NestKitPlugin,
	getSettings: () => NestKitSettings,
	isFeatureEnabled: () => boolean,
): RewardReaderImportCommandControl {
	let activeModal: RewardReaderImportModal | null = null;
	let importBusy = false;

	const dictionary = getDictionary(
		getSettings().uiLanguage,
	) as NestKitDictionary & RewardReaderImportCommandDictionaryExtension;

	plugin.addCommand({
		id: REWARD_READER_IMPORT_NOVEL_COMMAND_ID,
		name: dictionary.commands.rewardReader.importNovel.name,
		checkCallback: (checking) => {
			if (!isRewardReaderImportCommandAvailable(isFeatureEnabled(), importBusy)) {
				return false;
			}

			if (checking) {
				return true;
			}

			if (activeModal) {
				return true;
			}

			const activeFile = plugin.app.workspace.getActiveFile();
			const initialSourceFile = isRewardReaderImportSourceFile(activeFile)
				? activeFile
				: null;

			activeModal = new RewardReaderImportModal(plugin.app, {
				getSettings,
				initialSourceFile,
				onBusyChange: (busy) => {
					importBusy = busy;
				},
				onClose: () => {
					activeModal = null;
				},
			});
			activeModal.open();
			return true;
		},
	});

	return {
		closeActiveModal(): void {
			activeModal?.close();
		},
		hasActiveModal(): boolean {
			return activeModal !== null;
		},
		isImportBusy(): boolean {
			return importBusy;
		},
	};
}

export function isRewardReaderImportCommandAvailable(
	isFeatureEnabled: boolean,
	importBusy: boolean,
): boolean {
	return isFeatureEnabled && !Platform.isMobileApp && !importBusy;
}

export function resolveRewardReaderInitialImportSourceFile(
	file: TFile | null,
): TFile | null {
	return isRewardReaderImportSourceFile(file) ? file : null;
}
