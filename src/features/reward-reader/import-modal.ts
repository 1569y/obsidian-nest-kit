import {
	FuzzySuggestModal,
	Modal,
	Notice,
	Setting,
	TFile,
	type App,
	type TAbstractFile,
} from 'obsidian';
import { getDictionary, type NestKitDictionary } from '../../i18n';
import type { NestKitSettings } from '../../settings';
import { runRewardReaderImport } from './import-runtime-flow';
import { isSafeRewardReaderId } from './store';
import type {
	RewardReaderImportRuntimeRequest,
	RunRewardReaderImportFailure,
	RunRewardReaderImportResult,
} from './import-runtime-flow';

interface RewardReaderImportModalDictionaryExtension {
	modal: {
		rewardReader: {
			import: {
				title: string;
				source: {
					name: string;
					description: string;
					noSourceSelected: string;
					chooseFile: string;
					changeFile: string;
				};
				novelTitle: {
					name: string;
					placeholder: string;
				};
				makePrimary: {
					name: string;
					description: string;
				};
				status: {
					heading: string;
					waitingForSource: string;
					readyToImport: string;
					importing: string;
					failedCanEdit: string;
					exactRetryRequired: string;
				};
				buttons: {
					import: string;
					retrySameImport: string;
					cancel: string;
				};
				notices: {
					noEligibleFiles: string;
					identityGenerationFailed: string;
					success: (title: string, chapterCount: number) => string;
					successWithWarnings: (
						title: string,
						chapterCount: number,
						warningCount: number,
					) => string;
					invalidImportRequest: string;
					initialStateReadBlocked: string;
					persistenceStateReadBlocked: string;
					sourceInspectionBlocked: string;
					importPreparationBlocked: string;
					storeApplicationBlocked: string;
					chapterCacheReadBlocked: string;
					chapterCacheConflict: string;
					chapterCacheWriteBlocked: string;
					stateWriteBlocked: string;
					persistenceRuntimeFailed: string;
					unexpectedRuntimeFailure: string;
				};
			};
		};
	};
}

type RewardReaderImportModalDictionary = NestKitDictionary &
	RewardReaderImportModalDictionaryExtension;

type RewardReaderImportStatusMode =
	| 'waiting-for-source'
	| 'ready-to-import'
	| 'importing'
	| 'failed-can-edit'
	| 'exact-retry-required';

interface RewardReaderImportModalOptions {
	getSettings: () => NestKitSettings;
	initialSourceFile: TFile | null;
	onClose: () => void;
	onBusyChange?: (busy: boolean) => void;
	runImport?: typeof runRewardReaderImport;
	createNotice?: (message: string) => void;
	createNovelId?: () => string;
	createOperationAt?: () => string;
}

interface RewardReaderImportIdentitySuccess {
	ok: true;
	request: RewardReaderImportRuntimeRequest;
}

interface RewardReaderImportIdentityFailure {
	ok: false;
}

type RewardReaderImportIdentityResult =
	| RewardReaderImportIdentitySuccess
	| RewardReaderImportIdentityFailure;

class RewardReaderImportSourcePickerModal extends FuzzySuggestModal<TFile> {
	constructor(
		app: App,
		private readonly candidates: readonly TFile[],
		private readonly onChooseFile: (file: TFile) => void,
		private readonly onClosePicker: () => void,
	) {
		super(app);
	}

	getItems(): TFile[] {
		return [...this.candidates];
	}

	getItemText(file: TFile): string {
		return file.path;
	}

	onChooseItem(file: TFile): void {
		this.onChooseFile(file);
		this.close();
	}

	onClose(): void {
		this.onClosePicker();
	}
}

export class RewardReaderImportModal extends Modal {
	private readonly getSettings: () => NestKitSettings;
	private readonly onRequestClose: () => void;
	private readonly onBusyChange: (busy: boolean) => void;
	private readonly runImport: typeof runRewardReaderImport;
	private readonly showNotice: (message: string) => void;
	private readonly createNovelId: () => string;
	private readonly createOperationAt: () => string;

	private selectedSourceFile: TFile | null = null;
	private titleValue = '';
	private titleDirty = false;
	private makePrimaryValue = true;
	private isSubmitting = false;
	private isClosed = false;
	private editableFailure: RunRewardReaderImportFailure | null = null;
	private exactRetryRequest: RewardReaderImportRuntimeRequest | null = null;
	private activeSourcePicker: RewardReaderImportSourcePickerModal | null = null;

	constructor(app: App, options: RewardReaderImportModalOptions) {
		super(app);
		this.getSettings = options.getSettings;
		this.onRequestClose = options.onClose;
		this.onBusyChange = options.onBusyChange ?? (() => undefined);
		this.runImport = options.runImport ?? runRewardReaderImport;
		this.showNotice = options.createNotice ?? ((message) => new Notice(message));
		this.createNovelId =
			options.createNovelId ?? defaultCreateRewardReaderImportNovelId;
		this.createOperationAt =
			options.createOperationAt ?? defaultCreateRewardReaderImportOperationAt;
		this.applyInitialSourceFile(options.initialSourceFile);
	}

	onOpen(): void {
		this.isClosed = false;
		this.render();
	}

	onClose(): void {
		this.isClosed = true;
		const activeSourcePicker = this.activeSourcePicker;
		this.activeSourcePicker = null;
		activeSourcePicker?.close();
		this.contentEl.empty();
		this.onRequestClose();
	}

	private render(): void {
		if (this.isClosed) {
			return;
		}

		const dictionary = this.getDictionary();
		const importStrings = dictionary.modal.rewardReader.import;
		const { contentEl, titleEl } = this;
		contentEl.empty();
		titleEl.setText(importStrings.title);

		const sourceSetting = new Setting(contentEl)
			.setName(importStrings.source.name)
			.setDesc(this.getSourceDescription(importStrings));
		sourceSetting.addButton((button) => {
			button
				.setButtonText(
					this.selectedSourceFile
						? importStrings.source.changeFile
						: importStrings.source.chooseFile,
				)
				.setDisabled(this.isSourceSelectionLocked())
				.onClick(() => {
					void this.handleChooseSourceFile();
				});
		});

		new Setting(contentEl)
			.setName(importStrings.novelTitle.name)
			.setDesc(importStrings.novelTitle.placeholder)
			.addText((text) => {
				text
					.setPlaceholder(importStrings.novelTitle.placeholder)
					.setValue(this.titleValue)
					.setDisabled(this.isFieldLocked())
					.onChange((value) => {
						this.titleValue = value;
						this.titleDirty = true;
						this.clearEditableFailure();
					});
			});

		new Setting(contentEl)
			.setName(importStrings.makePrimary.name)
			.setDesc(importStrings.makePrimary.description)
			.addToggle((toggle) =>
				toggle
					.setValue(this.makePrimaryValue)
					.setDisabled(this.isFieldLocked())
					.onChange((value) => {
						this.makePrimaryValue = value;
						this.clearEditableFailure();
					}),
			);

		new Setting(contentEl)
			.setName(importStrings.status.heading)
			.setDesc(this.getStatusText(importStrings));

		const actionSetting = new Setting(contentEl);
		actionSetting.addButton((button) => {
			button
				.setButtonText(this.getSubmitButtonLabel(importStrings))
				.setCta()
				.setDisabled(!this.canSubmit())
				.onClick(() => {
					void this.handleSubmit();
				});
		});
		actionSetting.addButton((button) =>
			button
				.setButtonText(importStrings.buttons.cancel)
				.onClick(() => this.close()),
		);
	}

	private applyInitialSourceFile(file: TFile | null): void {
		if (!isRewardReaderImportSourceFile(file)) {
			return;
		}

		this.selectedSourceFile = file;
		if (!this.titleDirty) {
			this.titleValue = file.basename;
		}
	}

	private getDictionary(): RewardReaderImportModalDictionary {
		return getDictionary(
			this.getSettings().uiLanguage,
		) as RewardReaderImportModalDictionary;
	}

	private getSourceDescription(
		importStrings: RewardReaderImportModalDictionary['modal']['rewardReader']['import'],
	): string {
		return `${importStrings.source.description}\n${
			this.selectedSourceFile?.path ?? importStrings.source.noSourceSelected
		}`;
	}

	private getStatusMode(): RewardReaderImportStatusMode {
		if (this.isSubmitting) {
			return 'importing';
		}

		if (this.exactRetryRequest) {
			return 'exact-retry-required';
		}

		if (!this.selectedSourceFile) {
			return 'waiting-for-source';
		}

		if (this.editableFailure) {
			return 'failed-can-edit';
		}

		return 'ready-to-import';
	}

	private getStatusText(
		importStrings: RewardReaderImportModalDictionary['modal']['rewardReader']['import'],
	): string {
		switch (this.getStatusMode()) {
			case 'waiting-for-source':
				return importStrings.status.waitingForSource;
			case 'ready-to-import':
				return importStrings.status.readyToImport;
			case 'importing':
				return importStrings.status.importing;
			case 'failed-can-edit':
				return importStrings.status.failedCanEdit;
			case 'exact-retry-required':
				return importStrings.status.exactRetryRequired;
		}
	}

	private getSubmitButtonLabel(
		importStrings: RewardReaderImportModalDictionary['modal']['rewardReader']['import'],
	): string {
		return this.exactRetryRequest
			? importStrings.buttons.retrySameImport
			: importStrings.buttons.import;
	}

	private isFieldLocked(): boolean {
		return this.isSubmitting || this.exactRetryRequest !== null;
	}

	private isSourceSelectionLocked(): boolean {
		return this.isFieldLocked();
	}

	private canSubmit(): boolean {
		if (this.isSubmitting) {
			return false;
		}

		if (this.exactRetryRequest) {
			return true;
		}

		return (
			this.selectedSourceFile !== null &&
			normalizeRewardReaderImportTitle(this.titleValue).length > 0
		);
	}

	private clearEditableFailure(): void {
		if (this.exactRetryRequest) {
			return;
		}

		this.editableFailure = null;
	}

	private async handleChooseSourceFile(): Promise<void> {
		if (this.isClosed || this.isSourceSelectionLocked()) {
			return;
		}

		if (this.activeSourcePicker) {
			return;
		}

		const candidates = getRewardReaderImportSourceCandidates(
			this.app.vault.getFiles(),
		);
		if (candidates.length === 0) {
			this.showNotice(
				this.getDictionary().modal.rewardReader.import.notices.noEligibleFiles,
			);
			return;
		}

		const sourcePicker = new RewardReaderImportSourcePickerModal(
			this.app,
			candidates,
			(file) => {
				if (this.isClosed) {
					return;
				}

				this.selectedSourceFile = file;
				if (!this.titleDirty) {
					this.titleValue = file.basename;
				}
				this.clearEditableFailure();
				this.render();
			},
			() => {
				this.activeSourcePicker = null;
			},
		);
		this.activeSourcePicker = sourcePicker;
		sourcePicker.open();
	}

	private async handleSubmit(): Promise<void> {
		if (!this.canSubmit()) {
			return;
		}

		const request = this.exactRetryRequest ?? this.createFreshRequestSnapshot();
		if (!request) {
			return;
		}

		this.isSubmitting = true;
		this.onBusyChange(true);
		this.render();

		try {
			const result = await this.runImport(
				this.app.vault,
				this.app.vault.adapter,
				request,
			);
			this.handleImportResult(request, result);
		} catch {
			this.handleUnexpectedRuntimeThrow(request);
		} finally {
			this.isSubmitting = false;
			this.onBusyChange(false);
			if (!this.isClosed) {
				this.render();
			}
		}
	}

	private createFreshRequestSnapshot(): RewardReaderImportRuntimeRequest | null {
		const sourceFile = this.selectedSourceFile;
		if (!sourceFile) {
			return null;
		}

		const identityResult = createRewardReaderImportRequestSnapshot({
			sourcePath: sourceFile.path,
			title: this.titleValue,
			makePrimary: this.makePrimaryValue,
			createNovelId: this.createNovelId,
			createOperationAt: this.createOperationAt,
		});
		if (!identityResult.ok) {
			this.showNotice(
				this.getDictionary().modal.rewardReader.import.notices
					.identityGenerationFailed,
			);
			return null;
		}

		return identityResult.request;
	}

	private handleImportResult(
		request: RewardReaderImportRuntimeRequest,
		result: RunRewardReaderImportResult,
	): void {
		const notices = this.getDictionary().modal.rewardReader.import.notices;

		if (result.ok) {
			const successMessage =
				result.warnings.length > 0
					? notices.successWithWarnings(
							result.title,
							result.chapterCount,
							result.warnings.length,
						)
					: notices.success(result.title, result.chapterCount);
			this.showNotice(successMessage);
			this.editableFailure = null;
			this.exactRetryRequest = null;
			if (!this.isClosed) {
				this.close();
			}
			return;
		}

		this.showNotice(mapRewardReaderImportFailureNotice(notices, result));
		this.editableFailure = result;

		if (this.exactRetryRequest || shouldPreserveExactRetry(result)) {
			this.exactRetryRequest = request;
			return;
		}

		this.exactRetryRequest = null;
	}

	private handleUnexpectedRuntimeThrow(
		request: RewardReaderImportRuntimeRequest,
	): void {
		this.showNotice(
			this.getDictionary().modal.rewardReader.import.notices
				.unexpectedRuntimeFailure,
		);
		this.editableFailure = null;
		this.exactRetryRequest = request;
	}
}

export function isRewardReaderImportSourceFile(
	file: TAbstractFile | null | undefined,
): file is TFile {
	return (
		file instanceof TFile &&
		(file.extension.toLocaleLowerCase() === 'txt' ||
			file.extension.toLocaleLowerCase() === 'md')
	);
}

export function getRewardReaderImportSourceCandidates(
	files: readonly TFile[],
): TFile[] {
	return files
		.filter((file) => isRewardReaderImportSourceFile(file))
		.slice()
		.sort((left, right) =>
			left.path.localeCompare(right.path, undefined, {
				sensitivity: 'base',
			}),
		);
}

export function shouldPreserveExactRetry(
	result: RunRewardReaderImportFailure,
): boolean {
	return (
		result.code === 'persistence-runtime-failed' ||
		result.cachePersistence !== 'not-checked' ||
		result.statePersistence !== 'not-attempted'
	);
}

export function createRewardReaderImportRequestSnapshot(input: {
	sourcePath: string;
	title: string;
	makePrimary: boolean;
	createNovelId: () => string;
	createOperationAt: () => string;
}): RewardReaderImportIdentityResult {
	let novelId: string;
	try {
		novelId = input.createNovelId();
	} catch {
		return { ok: false };
	}

	if (!isSafeRewardReaderId(novelId)) {
		return { ok: false };
	}

	let operationAt: string;
	try {
		operationAt = input.createOperationAt();
	} catch {
		return { ok: false };
	}

	if (!isValidRewardReaderImportOperationAt(operationAt)) {
		return { ok: false };
	}

	return {
		ok: true,
		request: Object.freeze({
			novelId,
			sourcePath: input.sourcePath,
			title: normalizeRewardReaderImportTitle(input.title),
			operationAt,
			makePrimary: input.makePrimary,
		}),
	};
}

export function mapRewardReaderImportFailureNotice(
	notices: RewardReaderImportModalDictionary['modal']['rewardReader']['import']['notices'],
	result: RunRewardReaderImportFailure,
): string {
	switch (result.code) {
		case 'invalid-import-request':
			return notices.invalidImportRequest;
		case 'state-read-blocked':
			return result.stage === 'initial-state-read'
				? notices.initialStateReadBlocked
				: notices.persistenceStateReadBlocked;
		case 'source-inspection-blocked':
			return notices.sourceInspectionBlocked;
		case 'import-preparation-blocked':
			return notices.importPreparationBlocked;
		case 'store-application-blocked':
			return notices.storeApplicationBlocked;
		case 'chapter-cache-read-blocked':
			return notices.chapterCacheReadBlocked;
		case 'chapter-cache-conflict':
			return notices.chapterCacheConflict;
		case 'chapter-cache-write-blocked':
			return notices.chapterCacheWriteBlocked;
		case 'state-write-blocked':
			return notices.stateWriteBlocked;
		case 'persistence-runtime-failed':
			return notices.persistenceRuntimeFailed;
		default:
			return notices.unexpectedRuntimeFailure;
	}
}

function normalizeRewardReaderImportTitle(value: string): string {
	return value.trim();
}

function defaultCreateRewardReaderImportNovelId(): string {
	const cryptoApi = window.crypto;
	if (!cryptoApi || typeof cryptoApi.randomUUID !== 'function') {
		throw new Error('Reward Reader import identity is unavailable.');
	}

	return `novel-${cryptoApi.randomUUID()}`;
}

function defaultCreateRewardReaderImportOperationAt(): string {
	return new Date().toISOString();
}

function isValidRewardReaderImportOperationAt(value: string): boolean {
	const normalizedValue = value.trim();
	return (
		normalizedValue.length > 0 &&
		/^\d{4}-\d{2}-\d{2}T/u.test(normalizedValue) &&
		!Number.isNaN(Date.parse(normalizedValue))
	);
}
