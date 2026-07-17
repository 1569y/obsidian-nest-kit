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
import {
	parseRewardReaderChapters,
	type RewardReaderChapterDetectionMode,
	type RewardReaderChapterParseBlockingIssue,
	REWARD_READER_IGNORED_PREFACE_WARNING,
	REWARD_READER_DUPLICATE_NUMBER_AMBIGUITY_WARNING,
	REWARD_READER_NUMERIC_COLON_GAP_WARNING,
} from './chapter-parser';
import {
	inspectRewardReaderExternalSource,
	prepareRewardReaderExternalSource,
	readRewardReaderExternalFileBytes,
	type InspectRewardReaderExternalSourceResult,
	type InspectRewardReaderExternalSourceSuccess,
	type PrepareRewardReaderExternalSourceSuccess,
	type PrepareRewardReaderExternalSourceFailure,
	type RewardReaderExternalEncodingPreference,
} from './external-source-import';
import {
	runRewardReaderImport,
	type RewardReaderImportRuntimeRequest,
	type RunRewardReaderImportFailure,
	type RunRewardReaderImportResult,
} from './import-runtime-flow';
import { isSafeRewardReaderId } from './store';

interface RewardReaderImportModalDictionaryExtension {
	modal: {
		rewardReader: {
			import: {
				title: string;
				source: {
					name: string;
					description: string;
					noSourceSelected: string;
					fromVault: string;
					changeVault: string;
					fromComputer: string;
					changeComputer: string;
					currentVault: (path: string) => string;
					currentExternal: (fileName: string) => string;
				};
				encoding: {
					name: string;
					description: string;
					auto: string;
					utf8: string;
					gb18030: string;
					utf16Le: string;
					utf16Be: string;
				};
				preview: {
					heading: string;
					fileName: string;
					detectedEncoding: string;
					chapterFormat: string;
					chapterCount: (count: number) => string;
					firstChapters: string;
					warningsHeading: string;
					ambiguityHeading: string;
					ambiguityDescription: string;
					ambiguityChapterNumber: (chapterNumber: number) => string;
					ambiguityCandidateCount: (candidateCount: number) => string;
					ambiguityBlocked: string;
					ambiguityCandidateLine: (lineNumber: number) => string;
					emptyPreview: string;
					willCreateCopy: string;
					willNotModifyOriginal: string;
					formatLabels: {
						none: string;
						markdownHeading: string;
						plainChapterHeading: string;
						numericColon: string;
					};
					warningLabels: {
						chapterNumberGaps: string;
						ignoredLeadingPreface: string;
					duplicateNumberAmbiguity: string;
					};
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
					inspectingVaultSource: string;
					importing: string;
					writingVaultCopy: string;
					readingExternalFile: string;
					decodingExternalFile: string;
					failedCanEdit: string;
					exactRetryRequired: string;
					noChaptersDetected: string;
					chapterHeadingAmbiguity: string;
				};
				buttons: {
					import: string;
					retrySameImport: string;
					cancel: string;
				};
				notices: {
					noEligibleFiles: string;
					identityGenerationFailed: string;
					externalFileReadFailed: string;
					externalSourceInvalid: string;
					externalVaultCopyFailed: string;
					externalVaultCopyCreatedButImportIncomplete: string;
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
	| 'inspecting-vault-source'
	| 'importing'
	| 'writing-vault-copy'
	| 'reading-external-file'
	| 'decoding-external-file'
	| 'failed-can-edit'
	| 'exact-retry-required'
	| 'no-chapters-detected'
	| 'chapter-heading-ambiguity';

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

interface RewardReaderExternalSourceState {
	fileName: string;
	bytes: Uint8Array | null;
	encodingPreference: RewardReaderExternalEncodingPreference;
	preview: InspectRewardReaderExternalSourceResult | null;
	readFailureMessage: string | null;
}

interface RewardReaderVaultSourcePreviewState {
	sourcePath: string;
	parseStatus: 'ok' | 'none' | 'ambiguous';
	detectionMode: RewardReaderChapterDetectionMode;
	chapterCount: number;
	chapterTitlePreview: string[];
	warnings: string[];
	blockingIssues: RewardReaderChapterParseBlockingIssue[];
	readFailureMessage: string | null;
}

type RewardReaderPreparedExternalVaultCopy =
	Omit<PrepareRewardReaderExternalSourceSuccess, 'ok'>;

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
	private externalSource: RewardReaderExternalSourceState | null = null;
	private titleValue = '';
	private titleDirty = false;
	private makePrimaryValue = true;
	private isSubmitting = false;
	private isClosed = false;
	private editableFailure: RunRewardReaderImportFailure | null = null;
	private exactRetryRequest: RewardReaderImportRuntimeRequest | null = null;
	private activeSourcePicker: RewardReaderImportSourcePickerModal | null = null;
	private activeExternalFileInput: HTMLInputElement | null = null;
	private preparedExternalVaultCopy: RewardReaderPreparedExternalVaultCopy | null =
		null;
	private externalSelectionToken = 0;
	private vaultSourcePreviewToken = 0;
	private vaultSourcePreview: RewardReaderVaultSourcePreviewState | null = null;
	private vaultSourcePreviewInFlight = false;
	private externalReadInFlight = false;
	private externalDecodeInFlight = false;
	private writingExternalVaultCopy = false;

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
		if (this.selectedSourceFile) {
			void this.refreshVaultSourcePreview(this.selectedSourceFile);
		}
		this.render();
	}

	onClose(): void {
		this.isClosed = true;
		this.externalSelectionToken += 1;
		this.vaultSourcePreviewToken += 1;
		this.selectedSourceFile = null;
		this.externalSource = null;
		this.vaultSourcePreview = null;
		this.preparedExternalVaultCopy = null;
		this.disposeExternalFileInput();
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
						? importStrings.source.changeVault
						: importStrings.source.fromVault,
				)
				.setDisabled(this.isSourceSelectionLocked())
				.onClick(() => {
					void this.handleChooseVaultSourceFile();
				});
		});
		sourceSetting.addButton((button) => {
			button
				.setButtonText(
					this.externalSource
						? importStrings.source.changeComputer
						: importStrings.source.fromComputer,
				)
				.setDisabled(this.isSourceSelectionLocked())
				.onClick(() => {
					this.handleChooseExternalSourceFile();
				});
		});

		if (this.externalSource) {
			const externalSource = this.externalSource;
			new Setting(contentEl)
				.setName(importStrings.encoding.name)
				.setDesc(importStrings.encoding.description)
				.addDropdown((dropdown) => {
					dropdown
						.addOption('auto', importStrings.encoding.auto)
						.addOption('utf-8', importStrings.encoding.utf8)
						.addOption('gb18030', importStrings.encoding.gb18030)
						.addOption('utf-16le', importStrings.encoding.utf16Le)
						.addOption('utf-16be', importStrings.encoding.utf16Be)
						.setValue(externalSource.encodingPreference)
						.setDisabled(this.isEncodingSelectionLocked())
						.onChange((value) => {
							this.handleExternalEncodingChange(
								value as RewardReaderExternalEncodingPreference,
							);
						});
				});

			this.renderExternalPreview(contentEl, importStrings);
		} else if (this.selectedSourceFile) {
			this.renderVaultPreview(contentEl, importStrings);
		}

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
				.setDisabled(this.isSubmitting)
				.onClick(() => this.close()),
		);
	}

	private renderExternalPreview(
		parent: HTMLElement,
		importStrings: RewardReaderImportModalDictionary['modal']['rewardReader']['import'],
	): void {
		const previewContainer = parent.createDiv({
			cls: 'nest-kit-reward-reader-import-preview',
		});
		previewContainer.createEl('h3', {
			text: importStrings.preview.heading,
		});

		const source = this.externalSource;
		if (!source) {
			previewContainer.createEl('p', {
				text: importStrings.preview.emptyPreview,
			});
			return;
		}

		const preview = source.preview;
		const createPreviewLine = (label: string, value: string): void => {
			previewContainer.createEl('p', {
				text: `${label}: ${value}`,
			});
		};

		createPreviewLine(importStrings.preview.fileName, source.fileName);

		if (source.readFailureMessage) {
			previewContainer.createEl('p', {
				text: source.readFailureMessage,
			});
			return;
		}

		if (!preview) {
			previewContainer.createEl('p', {
				text: importStrings.preview.emptyPreview,
			});
			return;
		}

		if (preview.detectedEncoding) {
			createPreviewLine(
				importStrings.preview.detectedEncoding,
				this.getEncodingLabel(importStrings, preview.detectedEncoding),
			);
		}

		createPreviewLine(
			importStrings.preview.chapterFormat,
			this.getPreviewDetectionModeLabel(importStrings, preview.detectionMode),
		);
		previewContainer.createEl('p', {
			text: importStrings.preview.chapterCount(preview.chapterCount),
		});

		if (preview.chapterTitlePreview.length > 0) {
			previewContainer.createEl('p', {
				text: importStrings.preview.firstChapters,
			});
			const previewList = previewContainer.createEl('ol');
			for (const title of preview.chapterTitlePreview) {
				previewList.createEl('li', { text: title });
			}
		}

		const localizedWarnings = getRewardReaderLocalizedPreviewWarnings(
			importStrings,
			preview.warnings,
		);
		if (localizedWarnings.length > 0) {
			previewContainer.createEl('p', {
				text: importStrings.preview.warningsHeading,
			});
			const warningList = previewContainer.createEl('ul');
			for (const warning of localizedWarnings) {
				warningList.createEl('li', { text: warning });
			}
		}

		this.renderBlockingIssues(
			previewContainer,
			importStrings,
			preview.blockingIssues,
		);

		previewContainer.createEl('p', {
			text: importStrings.preview.willCreateCopy,
		});
		previewContainer.createEl('p', {
			text: importStrings.preview.willNotModifyOriginal,
		});

		if (!preview.ok) {
			previewContainer.createEl('p', {
				text: this.getLocalizedPreviewFailureText(importStrings, preview),
			});
		}
	}

	private renderVaultPreview(
		parent: HTMLElement,
		importStrings: RewardReaderImportModalDictionary['modal']['rewardReader']['import'],
	): void {
		const previewContainer = parent.createDiv({
			cls: 'nest-kit-reward-reader-import-preview',
		});
		previewContainer.createEl('h3', {
			text: importStrings.preview.heading,
		});

		const sourceFile = this.selectedSourceFile;
		if (!sourceFile) {
			previewContainer.createEl('p', {
				text: importStrings.preview.emptyPreview,
			});
			return;
		}

		const preview = this.vaultSourcePreview;
		previewContainer.createEl('p', {
			text: `${importStrings.preview.fileName}: ${sourceFile.path}`,
		});

		if (this.vaultSourcePreviewInFlight && !preview) {
			previewContainer.createEl('p', {
				text: importStrings.status.inspectingVaultSource,
			});
			return;
		}

		if (!preview) {
			previewContainer.createEl('p', {
				text: importStrings.preview.emptyPreview,
			});
			return;
		}

		previewContainer.createEl('p', {
			text: `${importStrings.preview.chapterFormat}: ${this.getPreviewDetectionModeLabel(importStrings, preview.detectionMode)}`,
		});
		previewContainer.createEl('p', {
			text: importStrings.preview.chapterCount(preview.chapterCount),
		});

		if (preview.chapterTitlePreview.length > 0) {
			previewContainer.createEl('p', {
				text: importStrings.preview.firstChapters,
			});
			const previewList = previewContainer.createEl('ol');
			for (const title of preview.chapterTitlePreview) {
				previewList.createEl('li', { text: title });
			}
		}

		const localizedWarnings = getRewardReaderLocalizedPreviewWarnings(
			importStrings,
			preview.warnings,
		);
		if (localizedWarnings.length > 0) {
			previewContainer.createEl('p', {
				text: importStrings.preview.warningsHeading,
			});
			const warningList = previewContainer.createEl('ul');
			for (const warning of localizedWarnings) {
				warningList.createEl('li', { text: warning });
			}
		}

		this.renderBlockingIssues(
			previewContainer,
			importStrings,
			preview.blockingIssues,
		);

		if (preview.readFailureMessage) {
			previewContainer.createEl('p', {
				text: importStrings.status.failedCanEdit,
			});
		}
	}

	private renderBlockingIssues(
		container: HTMLElement,
		importStrings: RewardReaderImportModalDictionary['modal']['rewardReader']['import'],
		blockingIssues: readonly RewardReaderChapterParseBlockingIssue[],
	): void {
		if (blockingIssues.length === 0) {
			return;
		}

		container.createEl('p', {
			text: importStrings.preview.ambiguityHeading,
		});
		container.createEl('p', {
			text: importStrings.preview.ambiguityDescription,
		});

		for (const issue of blockingIssues) {
			container.createEl('p', {
				text: importStrings.preview.ambiguityChapterNumber(
					issue.chapterNumber,
				),
			});
			container.createEl('p', {
				text: importStrings.preview.ambiguityCandidateCount(
					issue.candidateCount,
				),
			});
			const candidateList = container.createEl('ul');
			for (const candidate of issue.candidates) {
				candidateList.createEl('li', {
					text: `${candidate.heading} (${importStrings.preview.ambiguityCandidateLine(candidate.lineIndex + 1)})`,
				});
			}
		}

		container.createEl('p', {
			text: importStrings.preview.ambiguityBlocked,
		});
	}

	private getLocalizedPreviewFailureText(
		importStrings: RewardReaderImportModalDictionary['modal']['rewardReader']['import'],
		preview: InspectRewardReaderExternalSourceResult,
	): string {
		if (preview.ok) {
			return '';
		}

		switch (preview.code) {
			case 'chapter-heading-ambiguity':
				return importStrings.status.chapterHeadingAmbiguity;
			case 'no-chapters-detected':
				return importStrings.status.noChaptersDetected;
			default:
				return importStrings.status.failedCanEdit;
		}
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
		const selectedSummary = this.selectedSourceFile
			? importStrings.source.currentVault(this.selectedSourceFile.path)
			: this.externalSource
				? importStrings.source.currentExternal(this.externalSource.fileName)
				: importStrings.source.noSourceSelected;
		return `${importStrings.source.description}\n${selectedSummary}`;
	}

	private getStatusMode(): RewardReaderImportStatusMode {
		if (this.externalReadInFlight) {
			return 'reading-external-file';
		}

		if (this.externalDecodeInFlight) {
			return 'decoding-external-file';
		}

		if (this.vaultSourcePreviewInFlight) {
			return 'inspecting-vault-source';
		}

		if (this.writingExternalVaultCopy) {
			return 'writing-vault-copy';
		}

		if (this.isSubmitting) {
			return 'importing';
		}

		if (this.exactRetryRequest) {
			return 'exact-retry-required';
		}

		if (
			this.externalSource?.preview?.warnings.some(
				(warning) =>
					warning === REWARD_READER_DUPLICATE_NUMBER_AMBIGUITY_WARNING,
			) ||
			this.vaultSourcePreview?.blockingIssues.length
		) {
			return 'chapter-heading-ambiguity';
		}

		if (this.externalSource?.preview?.ok === false) {
			return this.externalSource.preview.code === 'no-chapters-detected'
				? 'no-chapters-detected'
				: this.externalSource.preview.code === 'chapter-heading-ambiguity'
					? 'chapter-heading-ambiguity'
					: 'failed-can-edit';
		}

		if (
			this.selectedSourceFile &&
			this.vaultSourcePreview &&
			!this.vaultSourcePreview.readFailureMessage &&
			this.vaultSourcePreview.chapterCount === 0
		) {
			return 'no-chapters-detected';
		}

		if (!this.selectedSourceFile && !this.externalSource) {
			return 'waiting-for-source';
		}

		if (
			this.editableFailure ||
			this.externalSource?.readFailureMessage ||
			this.vaultSourcePreview?.readFailureMessage
		) {
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
			case 'inspecting-vault-source':
				return importStrings.status.inspectingVaultSource;
			case 'importing':
				return importStrings.status.importing;
			case 'writing-vault-copy':
				return importStrings.status.writingVaultCopy;
			case 'reading-external-file':
				return importStrings.status.readingExternalFile;
			case 'decoding-external-file':
				return importStrings.status.decodingExternalFile;
			case 'failed-can-edit':
				return importStrings.status.failedCanEdit;
			case 'exact-retry-required':
				return importStrings.status.exactRetryRequired;
			case 'no-chapters-detected':
				return importStrings.status.noChaptersDetected;
			case 'chapter-heading-ambiguity':
				return importStrings.status.chapterHeadingAmbiguity;
		}
	}

	private getSubmitButtonLabel(
		importStrings: RewardReaderImportModalDictionary['modal']['rewardReader']['import'],
	): string {
		return this.exactRetryRequest
			? importStrings.buttons.retrySameImport
			: importStrings.buttons.import;
	}

	private getPreviewDetectionModeLabel(
		importStrings: RewardReaderImportModalDictionary['modal']['rewardReader']['import'],
		detectionMode: InspectRewardReaderExternalSourceSuccess['detectionMode'],
	): string {
		switch (detectionMode) {
			case 'markdown-heading':
				return importStrings.preview.formatLabels.markdownHeading;
			case 'plain-chapter-heading':
				return importStrings.preview.formatLabels.plainChapterHeading;
			case 'numeric-colon':
				return importStrings.preview.formatLabels.numericColon;
			case 'none':
				return importStrings.preview.formatLabels.none;
		}
	}

	private getEncodingLabel(
		importStrings: RewardReaderImportModalDictionary['modal']['rewardReader']['import'],
		encoding: InspectRewardReaderExternalSourceSuccess['detectedEncoding'],
	): string {
		switch (encoding) {
			case 'utf-8':
			case 'utf-8-bom':
				return importStrings.encoding.utf8;
			case 'gb18030':
				return importStrings.encoding.gb18030;
			case 'utf-16le':
				return importStrings.encoding.utf16Le;
			case 'utf-16be':
				return importStrings.encoding.utf16Be;
			case null:
				return importStrings.encoding.auto;
		}
	}

	private isFieldLocked(): boolean {
		return this.isSubmitting || this.exactRetryRequest !== null;
	}

	private isSourceSelectionLocked(): boolean {
		return (
			this.isFieldLocked() ||
			this.externalReadInFlight ||
			this.externalDecodeInFlight ||
			this.writingExternalVaultCopy
		);
	}

	private isEncodingSelectionLocked(): boolean {
		return (
			this.isSourceSelectionLocked() ||
			this.externalSource?.bytes === null ||
			this.externalSource?.bytes === undefined
		);
	}

	private canSubmit(): boolean {
		if (this.isSubmitting) {
			return false;
		}

		if (this.exactRetryRequest) {
			return true;
		}

		if (normalizeRewardReaderImportTitle(this.titleValue).length === 0) {
			return false;
		}

		if (this.selectedSourceFile) {
			return (
				!this.vaultSourcePreviewInFlight &&
				!!this.vaultSourcePreview &&
				!this.vaultSourcePreview.readFailureMessage &&
				this.vaultSourcePreview.blockingIssues.length === 0 &&
				this.vaultSourcePreview.chapterCount > 0
			);
		}

		return this.externalSource?.preview?.ok === true;
	}

	private clearEditableFailure(): void {
		if (this.exactRetryRequest) {
			return;
		}

		this.editableFailure = null;
	}

	private setSelectedVaultSource(file: TFile): void {
		this.selectedSourceFile = file;
		this.externalSource = null;
		this.vaultSourcePreview = null;
		this.preparedExternalVaultCopy = null;
		if (!this.titleDirty) {
			this.titleValue = file.basename;
		}
		this.clearEditableFailure();
	}

	private async refreshVaultSourcePreview(file: TFile): Promise<void> {
		if (this.isClosed) {
			return;
		}

		const previewToken = ++this.vaultSourcePreviewToken;
		this.vaultSourcePreviewInFlight = true;
		this.vaultSourcePreview = null;
		this.render();

		try {
			const sourceText = await this.app.vault.read(file);
			if (
				this.isClosed ||
				previewToken !== this.vaultSourcePreviewToken ||
				this.selectedSourceFile?.path !== file.path
			) {
				return;
			}

			const parseResult = parseRewardReaderChapters(sourceText);
			this.vaultSourcePreview = {
				sourcePath: file.path,
				parseStatus: parseResult.status,
				detectionMode: parseResult.detectionMode,
				chapterCount: parseResult.chapters.length,
				chapterTitlePreview: summarizeRewardReaderImportPreviewTitles(
					parseResult.chapters.map((chapter) => chapter.title),
				),
				warnings: [...parseResult.warnings],
				blockingIssues: [...parseResult.blockingIssues],
				readFailureMessage: null,
			};
		} catch {
			if (
				this.isClosed ||
				previewToken !== this.vaultSourcePreviewToken ||
				this.selectedSourceFile?.path !== file.path
			) {
				return;
			}

			this.vaultSourcePreview = {
				sourcePath: file.path,
				parseStatus: 'none',
				detectionMode: 'none',
				chapterCount: 0,
				chapterTitlePreview: [],
				warnings: [],
				blockingIssues: [],
				readFailureMessage:
					'Reward Reader could not inspect the selected Vault source file.',
			};
		} finally {
			if (!this.isClosed && previewToken === this.vaultSourcePreviewToken) {
				this.vaultSourcePreviewInFlight = false;
				this.render();
			}
		}
	}

	private setSelectedExternalSource(
		fileName: string,
		bytes: Uint8Array | null,
		preview: InspectRewardReaderExternalSourceResult | null,
		readFailureMessage: string | null,
		encodingPreference: RewardReaderExternalEncodingPreference,
	): void {
		this.selectedSourceFile = null;
		this.vaultSourcePreview = null;
		this.vaultSourcePreviewInFlight = false;
		this.externalSource = {
			fileName,
			bytes,
			encodingPreference,
			preview,
			readFailureMessage,
		};
		this.preparedExternalVaultCopy = null;
		if (!this.titleDirty) {
			this.titleValue = getRewardReaderImportTitleFromFileName(fileName);
		}
		this.clearEditableFailure();
	}

	private async handleChooseVaultSourceFile(): Promise<void> {
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

				this.setSelectedVaultSource(file);
				void this.refreshVaultSourcePreview(file);
				this.render();
			},
			() => {
				this.activeSourcePicker = null;
			},
		);
		this.activeSourcePicker = sourcePicker;
		sourcePicker.open();
	}

	private handleChooseExternalSourceFile(): void {
		if (this.isClosed || this.isSourceSelectionLocked()) {
			return;
		}

		try {
			this.disposeExternalFileInput();

			const inputElement = createRewardReaderExternalFileInput();

			const cleanup = (): void => {
				if (this.activeExternalFileInput !== inputElement) {
					return;
				}

				inputElement.removeEventListener('change', handleChange);
				inputElement.removeEventListener('cancel', handleCancel);
				inputElement.remove();
				this.activeExternalFileInput = null;
			};

			const handleCancel = (): void => {
				cleanup();
			};

			const handleChange = (): void => {
				const selectedFile = inputElement.files?.[0] ?? null;
				cleanup();
				if (!selectedFile) {
					return;
				}

				void this.loadExternalSourceFile(selectedFile);
			};

			inputElement.addEventListener('change', handleChange);
			inputElement.addEventListener('cancel', handleCancel);
			this.activeExternalFileInput = inputElement;
			this.contentEl.appendChild(inputElement);
			inputElement.click();
		} catch {
			this.showNotice(
				this.getDictionary().modal.rewardReader.import.notices
					.externalFileReadFailed,
			);
		}
	}

	private disposeExternalFileInput(): void {
		const inputElement = this.activeExternalFileInput;
		if (!inputElement) {
			return;
		}

		inputElement.remove();
		this.activeExternalFileInput = null;
	}

	private async loadExternalSourceFile(file: File): Promise<void> {
		if (this.isClosed) {
			return;
		}

		const fallbackFileName = getRewardReaderSafeExternalFileName(file);
		const selectionToken = ++this.externalSelectionToken;
		this.externalReadInFlight = true;
		this.externalDecodeInFlight = false;
		this.setSelectedExternalSource(fallbackFileName, null, null, null, 'auto');
		this.render();

		let loadedBytes: Uint8Array | null = null;

		try {
			const readResult = await readRewardReaderExternalFileBytes(file);
			if (this.isClosed || selectionToken !== this.externalSelectionToken) {
				return;
			}

			if (!readResult.ok) {
				this.setSelectedExternalSource(
					file.name,
					null,
					null,
					this.mapExternalFileReadFailureNotice(readResult.message),
					'auto',
				);
				return;
			}

			this.externalReadInFlight = false;
			this.externalDecodeInFlight = true;
			loadedBytes = readResult.bytes;
			this.setSelectedExternalSource(
				readResult.fileName,
				readResult.bytes,
				null,
				null,
				'auto',
			);
			this.render();

			const preview = inspectRewardReaderExternalSource({
				fileName: readResult.fileName,
				bytes: readResult.bytes,
				preferredEncoding: 'auto',
			});
			if (this.isClosed || selectionToken !== this.externalSelectionToken) {
				return;
			}

			this.setSelectedExternalSource(
				readResult.fileName,
				readResult.bytes,
				preview,
				null,
				'auto',
			);
		} catch {
			if (!this.isClosed && selectionToken === this.externalSelectionToken) {
				this.setSelectedExternalSource(
					fallbackFileName,
					loadedBytes,
					createRewardReaderExternalPreviewFailure(
						fallbackFileName,
						'Reward Reader could not inspect the selected external file.',
					),
					null,
					'auto',
				);
			}
		} finally {
			if (!this.isClosed && selectionToken === this.externalSelectionToken) {
				this.externalReadInFlight = false;
				this.externalDecodeInFlight = false;
				this.render();
			}
		}
	}

	private handleExternalEncodingChange(
		value: RewardReaderExternalEncodingPreference,
	): void {
		const externalSource = this.externalSource;
		if (
			this.isClosed ||
			!externalSource ||
			!externalSource.bytes ||
			this.isEncodingSelectionLocked()
		) {
			return;
		}

		try {
			const preview = inspectRewardReaderExternalSource({
				fileName: externalSource.fileName,
				bytes: externalSource.bytes,
				preferredEncoding: value,
			});
			this.externalSource = {
				...externalSource,
				encodingPreference: value,
				preview,
				readFailureMessage: null,
			};
		} catch {
			this.externalSource = {
				...externalSource,
				encodingPreference: value,
				preview: createRewardReaderExternalPreviewFailure(
					externalSource.fileName,
					'Reward Reader could not inspect the selected external file.',
				),
				readFailureMessage: null,
			};
		}
		this.preparedExternalVaultCopy = null;
		this.clearEditableFailure();
		this.render();
	}

	private async handleSubmit(): Promise<void> {
		if (!this.canSubmit()) {
			return;
		}

		let request = this.exactRetryRequest;
		let usedExternalVaultCopy = false;
		this.isSubmitting = true;
		this.onBusyChange(true);
		this.render();

		try {
			if (!request) {
				const sourcePreparation = await this.prepareSourcePathForImport();
				if (!sourcePreparation.ok) {
					this.showNotice(sourcePreparation.notice);
					return;
				}

				usedExternalVaultCopy = sourcePreparation.usedExternalVaultCopy;
				request = this.createFreshRequestSnapshot(sourcePreparation.sourcePath);
				if (!request) {
					return;
				}
			}

			const result = await this.runImport(
				this.app.vault,
				this.app.vault.adapter,
				request,
			);
			this.handleImportResult(request, result, usedExternalVaultCopy);
		} catch {
			if (request) {
				this.handleUnexpectedRuntimeThrow(request);
			} else {
				this.showNotice(
					this.getDictionary().modal.rewardReader.import.notices
						.unexpectedRuntimeFailure,
				);
			}
		} finally {
			this.writingExternalVaultCopy = false;
			this.isSubmitting = false;
			this.onBusyChange(false);
			if (!this.isClosed) {
				this.render();
			}
		}
	}

	private async prepareSourcePathForImport(): Promise<
		| {
				ok: true;
				sourcePath: string;
				usedExternalVaultCopy: boolean;
		  }
		| {
				ok: false;
				notice: string;
		  }
	> {
		if (this.selectedSourceFile) {
			return {
				ok: true,
				sourcePath: this.selectedSourceFile.path,
				usedExternalVaultCopy: false,
			};
		}

		const externalSource = this.externalSource;
		if (!externalSource || !externalSource.preview?.ok) {
			return {
				ok: false,
				notice:
					this.getDictionary().modal.rewardReader.import.notices
						.externalSourceInvalid,
			};
		}

		if (this.preparedExternalVaultCopy) {
			return {
				ok: true,
				sourcePath: this.preparedExternalVaultCopy.sourcePath,
				usedExternalVaultCopy: false,
			};
		}

		this.writingExternalVaultCopy = true;
		this.render();
		const prepareResult = await prepareRewardReaderExternalSource(this.app.vault, {
			fileName: externalSource.fileName,
			normalizedText: externalSource.preview.normalizedText,
		});
		if (!prepareResult.ok) {
			this.writingExternalVaultCopy = false;
			return {
				ok: false,
				notice: mapRewardReaderExternalSourcePrepareFailureNotice(
					this.getDictionary().modal.rewardReader.import.notices,
					prepareResult,
				),
			};
		}

		this.writingExternalVaultCopy = false;
		this.preparedExternalVaultCopy = {
			sourcePath: prepareResult.sourcePath,
			fileName: prepareResult.fileName,
			sourceMtime: prepareResult.sourceMtime,
			sourceSize: prepareResult.sourceSize,
		};
		return {
			ok: true,
			sourcePath: prepareResult.sourcePath,
			usedExternalVaultCopy: true,
		};
	}

	private createFreshRequestSnapshot(
		sourcePath: string,
	): RewardReaderImportRuntimeRequest | null {
		const identityResult = createRewardReaderImportRequestSnapshot({
			sourcePath,
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
		usedExternalVaultCopy: boolean,
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
		if (usedExternalVaultCopy) {
			this.showNotice(
				notices.externalVaultCopyCreatedButImportIncomplete,
			);
		}
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

	private mapExternalFileReadFailureNotice(message: string): string {
		const notices = this.getDictionary().modal.rewardReader.import.notices;
		return message.length > 0 ? message : notices.externalFileReadFailed;
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

function mapRewardReaderExternalSourcePrepareFailureNotice(
	notices: RewardReaderImportModalDictionary['modal']['rewardReader']['import']['notices'],
	result: PrepareRewardReaderExternalSourceFailure,
): string {
	switch (result.code) {
		case 'invalid-external-source':
			return notices.externalSourceInvalid;
		case 'vault-folder-create-failed':
		case 'vault-path-conflict':
		case 'vault-write-failed':
		case 'vault-copy-metadata-unavailable':
			return notices.externalVaultCopyFailed;
	}
}

function normalizeRewardReaderImportTitle(value: string): string {
	return value.trim();
}

function getRewardReaderImportTitleFromFileName(fileName: string): string {
	const titleMatch = fileName.trim().match(/^(.*?)(?:\.[^.]+)?$/u);
	return titleMatch?.[1]?.trim() ?? '';
}

function getRewardReaderSafeExternalFileName(value: unknown): string {
	try {
		if (
			value instanceof File &&
			typeof value.name === 'string' &&
			value.name.trim().length > 0
		) {
			return value.name;
		}
	} catch {
		// Ignore and fall back to a stable placeholder.
	}

	return 'selected-file';
}

function createRewardReaderExternalPreviewFailure(
	fileName: string,
	message: string,
): InspectRewardReaderExternalSourceResult {
	return {
		ok: false,
		fileName,
		code: 'external-text-decode-failed',
		message,
		parseStatus: 'none',
		detectedEncoding: null,
		hadBom: false,
		detectionMode: 'none',
		chapterCount: 0,
		chapterTitlePreview: [],
		warnings: [],
		blockingIssues: [],
	};
}

function summarizeRewardReaderImportPreviewTitles(
	titles: readonly string[],
): string[] {
	return titles.slice(0, 5);
}

function getRewardReaderLocalizedPreviewWarnings(
	importStrings: RewardReaderImportModalDictionary['modal']['rewardReader']['import'],
	warnings: readonly string[],
): string[] {
	const localizedWarnings = warnings
		.map((warning) => {
			switch (warning) {
				case REWARD_READER_NUMERIC_COLON_GAP_WARNING:
					return importStrings.preview.warningLabels.chapterNumberGaps;
				case REWARD_READER_IGNORED_PREFACE_WARNING:
					return importStrings.preview.warningLabels.ignoredLeadingPreface;
				case REWARD_READER_DUPLICATE_NUMBER_AMBIGUITY_WARNING:
					return importStrings.preview.warningLabels.duplicateNumberAmbiguity;
				default:
					return null;
			}
		})
		.filter((warning): warning is string => warning !== null);

	return [...new Set(localizedWarnings)];
}

function createRewardReaderExternalFileInput(): HTMLInputElement {
	const inputElement = activeDocument.createElement('input');
	inputElement.type = 'file';
	inputElement.accept = '.txt,.md,text/plain,text/markdown';
	inputElement.multiple = false;
	inputElement.hidden = true;
	return inputElement;
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
