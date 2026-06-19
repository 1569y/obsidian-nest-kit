import {
	AbstractInputSuggest,
	ButtonComponent,
	DropdownComponent,
	Modal,
	Notice,
	Setting,
	TFile,
	TextComponent,
} from 'obsidian';
import { getDictionary, type NestKitDictionary } from '../../i18n';
import type { NestKitSettings } from '../../settings';
import { isIsoDateString, todayIsoDate } from './dates';
import { parseReviewIntervalsInput } from './intervals';
import {
	getBuiltInReviewPresetName,
	getBuiltInReviewPresets,
	getPresetDisplayLabel,
	parseCustomReviewPresets,
	type CustomReviewPreset,
	type BuiltInPresetLabels,
	withTodayAsFirstReview,
} from './presets';
import {
	hasDuplicateReviewTaskTitle,
	type CreateReviewTaskInput,
	type UpdateReviewTaskDetailsInput,
} from './task-factory';
import { readSpacedReviewStore } from './store';
import type { ReviewTask } from './types';
import { VaultSpacedReviewStorageAdapter } from './vault-storage-adapter';

interface SpacedReviewModalDictionaryExtension {
	settings: {
		spacedReview: {
			presetOptions: {
				quickReview: string;
				standardReview: string;
				longTermMemory: string;
			};
		};
	};
	modal: {
		spacedReview: {
			createTitle: string;
			editTitle: string;
			title: {
				name: string;
				placeholder: string;
			};
			group: {
				name: string;
				placeholder: string;
				newPlaceholder: string;
			};
			subgroup: {
				name: string;
				placeholder: string;
				newPlaceholder: string;
			};
			startDate: {
				name: string;
			};
			preset: {
				name: string;
				manualCustom: string;
				customPrefix: (name: string) => string;
			};
			customIntervals: {
				name: string;
				description: string;
				placeholder: string;
			};
			note: {
				name: string;
				placeholder: string;
			};
			targetLink: {
				name: string;
				placeholder: string;
				description: string;
			};
			save: string;
			saveChanges: string;
			cancel: string;
			validation: {
				titleRequired: string;
				invalidDate: string;
				invalidIntervals: string;
				groupAlreadyHasTaskName: string;
			};
		};
	};
}

interface PresetOption {
	id: string;
	label: string;
	intervals?: number[];
	kind: 'built-in' | 'custom' | 'manual';
}

const MANUAL_CUSTOM_PRESET_ID = '__manual_custom__';

interface EditSpacedReviewTaskModalOptions {
	mode: 'edit';
	task: ReviewTask;
	onEditSubmit: (
		input: UpdateReviewTaskDetailsInput,
	) => Promise<ReviewTask | null>;
}

interface CreateSpacedReviewTaskModalInitialValues {
	title?: string;
	targetLink?: string;
}

interface CreateSpacedReviewTaskModalCreateOptions {
	mode?: 'create';
	initialValues?: CreateSpacedReviewTaskModalInitialValues;
}

type SpacedReviewTaskModalOptions =
	| EditSpacedReviewTaskModalOptions
	| CreateSpacedReviewTaskModalCreateOptions
	| undefined;

class MarkdownFilePathSuggest extends AbstractInputSuggest<TFile> {
	private readonly markdownFiles: TFile[];

	constructor(
		app: Modal['app'],
		inputEl: HTMLInputElement,
		private readonly onChoosePath: (path: string) => void,
	) {
		super(app, inputEl);
		this.markdownFiles = this.app.vault.getMarkdownFiles();
		this.limit = 5;
		this.onSelect((file) => {
			this.onChoosePath(file.path);
		});
	}

	protected getSuggestions(query: string): TFile[] {
		const limit = this.limit ?? 5;
		const [pathQuery = ''] = query.split('#', 1);
		const normalizedQuery = pathQuery.trim().toLocaleLowerCase();

		if (normalizedQuery.length === 0) {
			return this.markdownFiles.slice(0, limit);
		}

		return this.markdownFiles
			.filter((file) =>
				file.path.toLocaleLowerCase().includes(normalizedQuery),
			)
			.slice(0, limit);
	}

	renderSuggestion(file: TFile, el: HTMLElement): void {
		el.createDiv({
			cls: 'nest-kit-spaced-review-create__target-suggest-path',
			text: file.path,
		});
	}
}

export class CreateSpacedReviewTaskModal extends Modal {
	private readonly mode: 'create' | 'edit';
	private readonly editingTask?: ReviewTask;
	private readonly onEditSubmit?: (
		input: UpdateReviewTaskDetailsInput,
	) => Promise<ReviewTask | null>;
	private titleValue = '';
	private groupValue = '';
	private subgroupValue = '';
	private noteValue = '';
	private targetLinkValue = '';
	private startDateValue = todayIsoDate();
	private presetIdValue: string;
	private customIntervalsValue = '';
	private readonly presetOptions: PresetOption[];
	private groupSuggestions: string[] = [];
	private subgroupSuggestionsByGroup = new Map<string, string[]>();
	private titleInput?: TextComponent;
	private groupInput?: TextComponent;
	private subgroupInput?: TextComponent;
	private saveButton?: ButtonComponent;
	private duplicateErrorEl?: HTMLDivElement;
	private groupDropdown?: DropdownComponent;
	private subgroupDropdown?: DropdownComponent;
	private groupDropdownValue = '';
	private subgroupDropdownValue = '';
	private groupCustomValue = '';
	private subgroupCustomValue = '';
	private hasInitializedComboValues = false;
	private isSynchronizingControls = false;

	constructor(
		app: Modal['app'],
		private readonly settings: NestKitSettings,
		private readonly onCreateSubmit?: (
			input: CreateReviewTaskInput,
		) => Promise<ReviewTask | null>,
		options?: SpacedReviewTaskModalOptions,
	) {
		super(app);
		this.mode = options?.mode ?? 'create';
		this.editingTask = options?.mode === 'edit' ? options.task : undefined;
		this.onEditSubmit =
			options?.mode === 'edit' ? options.onEditSubmit : undefined;
		this.presetIdValue =
			this.editingTask?.presetId ?? settings.spacedReviewDefaultPresetId;
		this.startDateValue = this.editingTask?.startDate ?? todayIsoDate();
		this.titleValue = this.editingTask?.title ?? '';
		this.groupValue = this.editingTask?.groupPath?.[0] ?? '';
		this.subgroupValue = this.editingTask?.groupPath?.[1] ?? '';
		this.noteValue = this.editingTask?.note ?? '';
		this.targetLinkValue = this.editingTask?.targetLink ?? '';
		if (this.mode === 'create' && options?.mode !== 'edit') {
			this.titleValue = options?.initialValues?.title?.trim() ?? '';
			this.targetLinkValue = options?.initialValues?.targetLink?.trim() ?? '';
		}
		this.presetOptions = this.buildPresetOptions();
		if (!this.presetOptions.some((option) => option.id === this.presetIdValue)) {
			this.presetIdValue = settings.spacedReviewDefaultPresetId;
		}
	}

	static forEdit(
		app: Modal['app'],
		settings: NestKitSettings,
		task: ReviewTask,
		onEditSubmit: (
			input: UpdateReviewTaskDetailsInput,
		) => Promise<ReviewTask | null>,
	): CreateSpacedReviewTaskModal {
		return new CreateSpacedReviewTaskModal(app, settings, undefined, {
			mode: 'edit',
			task,
			onEditSubmit,
		});
	}

	static forCreate(
		app: Modal['app'],
		settings: NestKitSettings,
		onCreateSubmit: (
			input: CreateReviewTaskInput,
		) => Promise<ReviewTask | null>,
		initialValues?: CreateSpacedReviewTaskModalInitialValues,
	): CreateSpacedReviewTaskModal {
		return new CreateSpacedReviewTaskModal(app, settings, onCreateSubmit, {
			mode: 'create',
			initialValues,
		});
	}

	onOpen(): void {
		this.modalEl.addClass('nest-kit-spaced-review-create-modal');
		if (this.mode === 'edit') {
			this.modalEl.addClass('is-edit-mode');
		}
		void this.renderForm();
	}

	onClose(): void {
		this.modalEl.classList.remove(
			'nest-kit-spaced-review-create-modal',
			'is-edit-mode',
		);
		this.contentEl.empty();
	}

	private async renderForm(): Promise<void> {
		const dictionary = this.getDictionary();
		await this.loadGroupSuggestions();
		if (!this.hasInitializedComboValues) {
			this.initializeComboValues();
			this.hasInitializedComboValues = true;
		}
		const { contentEl, titleEl } = this;
		contentEl.empty();
		contentEl.addClass('nest-kit-spaced-review-create__content');
		titleEl.setText(
			this.mode === 'edit'
				? dictionary.modal.spacedReview.editTitle
				: dictionary.modal.spacedReview.createTitle,
		);

		new Setting(contentEl)
			.setName(dictionary.modal.spacedReview.title.name)
			.addText((text) => {
				this.titleInput = text;
				text
					.setPlaceholder(dictionary.modal.spacedReview.title.placeholder)
					.setValue(this.titleValue)
					.onChange((value) => {
						this.titleValue = value;
						this.clearDuplicateError();
					});
			});

		this.renderComboSetting(
			contentEl,
			dictionary.modal.spacedReview.group.name,
			dictionary.modal.spacedReview.group.placeholder,
			dictionary.modal.spacedReview.group.newPlaceholder,
			'group',
		);

		this.renderComboSetting(
			contentEl,
			dictionary.modal.spacedReview.subgroup.name,
			dictionary.modal.spacedReview.subgroup.placeholder,
			dictionary.modal.spacedReview.subgroup.newPlaceholder,
			'subgroup',
		);

		this.duplicateErrorEl = contentEl.createDiv({
			cls: 'nest-kit-spaced-review-create__error',
		});
		this.duplicateErrorEl.setAttribute('aria-live', 'polite');

		if (this.mode === 'create') {
			new Setting(contentEl)
				.setName(dictionary.modal.spacedReview.startDate.name)
				.addText((text) =>
					text
						.setPlaceholder('2026-06-17')
						.setValue(this.startDateValue)
						.onChange((value) => {
							this.startDateValue = value;
						}),
				);

			new Setting(contentEl)
				.setName(dictionary.modal.spacedReview.preset.name)
				.addDropdown((dropdown) => {
					for (const option of this.presetOptions) {
						dropdown.addOption(option.id, option.label);
					}

					dropdown
						.setValue(this.presetIdValue)
						.onChange((value) => {
							this.presetIdValue = value;
							void this.renderForm();
						});
				});

			if (this.isManualCustomPresetSelected()) {
				new Setting(contentEl)
					.setName(dictionary.modal.spacedReview.customIntervals.name)
					.setDesc(dictionary.modal.spacedReview.customIntervals.description)
					.addText((text) =>
						text
							.setPlaceholder(
								dictionary.modal.spacedReview.customIntervals.placeholder,
							)
							.setValue(this.customIntervalsValue)
							.onChange((value) => {
								this.customIntervalsValue = value;
							}),
					);
			}
		}

		new Setting(contentEl)
			.setName(dictionary.modal.spacedReview.note.name)
			.addTextArea((text) => {
				text
					.setPlaceholder(dictionary.modal.spacedReview.note.placeholder)
					.setValue(this.noteValue)
					.onChange((value) => {
						this.noteValue = value;
					});
				text.inputEl.rows = 3;
				text.inputEl.addClass('nest-kit-spaced-review-create__note-input');
			});

		new Setting(contentEl)
			.setName(dictionary.modal.spacedReview.targetLink.name)
			.setDesc(dictionary.modal.spacedReview.targetLink.description)
			.addText((text) => {
				text
					.setPlaceholder(dictionary.modal.spacedReview.targetLink.placeholder)
					.setValue(this.targetLinkValue)
					.onChange((value) => {
						this.targetLinkValue = value;
					});
				new MarkdownFilePathSuggest(
					this.app,
					text.inputEl,
					(path) => {
						this.targetLinkValue = path;
						text.setValue(path);
						text.inputEl.focus();
						text.inputEl.setSelectionRange(path.length, path.length);
					},
				);
			});

		const actionsSetting = new Setting(contentEl);
		actionsSetting.settingEl.addClass(
			'nest-kit-spaced-review-create__actions',
		);
		actionsSetting
			.addButton((button) => {
				this.saveButton = button;
				button
					.setButtonText(
						this.mode === 'edit'
							? dictionary.modal.spacedReview.saveChanges
							: dictionary.modal.spacedReview.save,
					)
					.setCta()
					.onClick(() => {
						void this.handleSubmit();
					});
			})
			.addButton((button) =>
				button
					.setButtonText(dictionary.modal.spacedReview.cancel)
					.onClick(() => this.close()),
			);

		this.scheduleInitialFocusCleanup();
	}

	private renderComboSetting(
		containerEl: HTMLElement,
		name: string,
		placeholder: string,
		newPlaceholder: string,
		kind: 'group' | 'subgroup',
	): void {
		const setting = new Setting(containerEl).setName(name);
		setting.controlEl.addClass('nest-kit-spaced-review-create__combo-control');
		const comboEl = setting.controlEl.createDiv({
			cls: 'nest-kit-spaced-review-create__combo',
		});
		const dropdown = new DropdownComponent(comboEl);
		dropdown.selectEl.addClass('nest-kit-spaced-review-create__combo-select');
		const input = new TextComponent(comboEl);
		input.inputEl.addClass('nest-kit-spaced-review-create__combo-input');
		input.setPlaceholder(newPlaceholder);

		if (kind === 'group') {
			this.groupDropdown = dropdown;
			this.groupInput = input;
			input.setValue(this.groupCustomValue);
			input.onChange((value) => {
				if (this.isSynchronizingControls) {
					return;
				}
				this.groupCustomValue = value;
				this.clearDuplicateError();
				this.refreshSubgroupControl();
			});
			dropdown.onChange((value) => {
				if (this.isSynchronizingControls) {
					return;
				}
				this.groupDropdownValue = value;
				this.clearDuplicateError();
				this.refreshSubgroupControl();
			});
			this.populateGroupDropdown(placeholder, this.groupDropdownValue);
			return;
		}

		this.subgroupDropdown = dropdown;
		this.subgroupInput = input;
		input.setValue(this.subgroupCustomValue);
		input.inputEl.disabled = this.getResolvedGroupValue().trim().length === 0;
		input.onChange((value) => {
			if (this.isSynchronizingControls) {
				return;
			}
			this.subgroupCustomValue = value;
			this.clearDuplicateError();
		});
		dropdown.onChange((value) => {
			if (this.isSynchronizingControls) {
				return;
			}
			this.subgroupDropdownValue = value;
			this.clearDuplicateError();
		});
		this.populateSubgroupDropdown(placeholder, this.subgroupDropdownValue);
	}

	private async handleSubmit(): Promise<void> {
		const dictionary = this.getDictionary();
		const title = this.titleValue.trim();

		if (title.length === 0) {
			this.clearDuplicateError();
			new Notice(dictionary.modal.spacedReview.validation.titleRequired);
			return;
		}

		if (
			await this.validateDuplicateTitle(
				title,
				this.getResolvedGroupPath(),
				dictionary.modal.spacedReview.validation.groupAlreadyHasTaskName,
			)
		) {
			return;
		}

		try {
			const savedTask =
				this.mode === 'edit'
					? await this.handleEditSubmit()
					: await this.handleCreateSubmit();

			if (savedTask) {
				this.close();
			}
		} catch (error) {
			console.error(
				'[NestKit] Unexpected spaced review modal submission failure.',
				error,
			);
		}
	}

	private async handleCreateSubmit(): Promise<ReviewTask | null> {
		const dictionary = this.getDictionary();
		if (!isIsoDateString(this.startDateValue)) {
			this.clearDuplicateError();
			new Notice(dictionary.modal.spacedReview.validation.invalidDate);
			return null;
		}

		const customIntervalsText = this.isManualCustomPresetSelected()
			? this.customIntervalsValue.trim()
			: '';
		if (customIntervalsText.length > 0) {
			const parsed = parseReviewIntervalsInput(customIntervalsText);
			if (parsed.intervals.length === 0) {
				this.clearDuplicateError();
				new Notice(dictionary.modal.spacedReview.validation.invalidIntervals);
				return null;
			}
		}

		return this.onCreateSubmit?.({
			title: this.titleValue.trim(),
			groupPath: this.getResolvedGroupPath(),
			note: this.noteValue,
			targetLink: this.targetLinkValue,
			startDate: this.startDateValue,
			presetId: this.isManualCustomPresetSelected()
				? this.settings.spacedReviewDefaultPresetId
				: this.presetIdValue,
			customIntervalsText,
			customPresetsText: this.settings.spacedReviewCustomPresets,
			includeTodayAsFirstReview:
				this.settings.spacedReviewIncludeTodayAsFirstReview,
		}) ?? null;
	}

	private async handleEditSubmit(): Promise<ReviewTask | null> {
		return this.onEditSubmit?.({
			title: this.titleValue.trim(),
			groupPath: this.getResolvedGroupPath(),
			note: this.noteValue,
			targetLink: this.targetLinkValue,
		}) ?? null;
	}

	private getPresetLabel(
		presetId: string,
		dictionary: NestKitDictionary & SpacedReviewModalDictionaryExtension,
	): string {
		return getPresetDisplayLabel({
			name: getBuiltInReviewPresetName(
				presetId,
				this.getBuiltInPresetLabels(dictionary),
			),
			intervals: withTodayAsFirstReview(
				getBuiltInReviewPresets().find((preset) => preset.id === presetId)
					?.intervals ?? [],
				this.settings.spacedReviewIncludeTodayAsFirstReview,
			),
		});
	}

	private buildPresetOptions(): PresetOption[] {
		const dictionary = this.getDictionary();
		const options: PresetOption[] = getBuiltInReviewPresets().map((preset) => ({
			id: preset.id,
			label: this.getPresetLabel(preset.id, dictionary),
			intervals: withTodayAsFirstReview(
				preset.intervals,
				this.settings.spacedReviewIncludeTodayAsFirstReview,
			),
			kind: 'built-in',
		}));
		const customPresets = parseCustomReviewPresets(
			this.settings.spacedReviewCustomPresets,
		);
		for (const preset of customPresets.presets) {
			options.push(this.toCustomPresetOption(preset, dictionary));
		}
		options.push({
			id: MANUAL_CUSTOM_PRESET_ID,
			label: dictionary.modal.spacedReview.preset.manualCustom,
			kind: 'manual',
		});
		return options;
	}

	private toCustomPresetOption(
		preset: CustomReviewPreset,
		dictionary: NestKitDictionary & SpacedReviewModalDictionaryExtension,
	): PresetOption {
		const intervals = withTodayAsFirstReview(
			preset.intervals,
			this.settings.spacedReviewIncludeTodayAsFirstReview,
		);
		return {
			id: preset.id,
			label: getPresetDisplayLabel({
				name: dictionary.modal.spacedReview.preset.customPrefix(preset.name),
				intervals,
			}),
			intervals,
			kind: 'custom',
		};
	}

	private getBuiltInPresetLabels(
		dictionary: NestKitDictionary & SpacedReviewModalDictionaryExtension,
	): BuiltInPresetLabels {
		return {
			quickReview: dictionary.settings.spacedReview.presetOptions.quickReview,
			standardReview:
				dictionary.settings.spacedReview.presetOptions.standardReview,
			longTermMemory:
				dictionary.settings.spacedReview.presetOptions.longTermMemory,
		};
	}

	private isManualCustomPresetSelected(): boolean {
		return this.presetIdValue === MANUAL_CUSTOM_PRESET_ID;
	}

	private async validateDuplicateTitle(
		title: string,
		groupPath: readonly string[],
		message?: string,
	): Promise<boolean> {
		const normalizedTitle = title.trim();
		if (normalizedTitle.length === 0) {
			this.clearDuplicateError();
			return false;
		}

		const adapter = new VaultSpacedReviewStorageAdapter(this.app.vault);
		const result = await readSpacedReviewStore(adapter);
		const hasDuplicate = hasDuplicateReviewTaskTitle(
			result.store.tasks,
			normalizedTitle,
			groupPath,
			this.editingTask?.id,
		);

		if (hasDuplicate) {
			this.setDuplicateError(
				message ??
					this.getDictionary().modal.spacedReview.validation.groupAlreadyHasTaskName,
			);
			return true;
		}

		this.clearDuplicateError();
		return false;
	}

	private setDuplicateError(message: string): void {
		this.duplicateErrorEl?.setText(message);
		this.saveButton?.setDisabled(true);
	}

	private clearDuplicateError(): void {
		this.duplicateErrorEl?.empty();
		this.saveButton?.setDisabled(false);
	}

	private async loadGroupSuggestions(): Promise<void> {
		const adapter = new VaultSpacedReviewStorageAdapter(this.app.vault);
		const result = await readSpacedReviewStore(adapter);
		const groupSet = new Set<string>();
		const subgroupMap = new Map<string, Set<string>>();

		for (const task of result.store.tasks) {
			const group = this.getNormalizedSuggestionLabel(task.groupPath?.[0]);
			const subgroup = this.getNormalizedSuggestionLabel(task.groupPath?.[1]);
			if (!group) {
				continue;
			}

			groupSet.add(group);
			if (!subgroup) {
				continue;
			}

			const groupKey = this.getSuggestionKey(group);
			const subgroups = subgroupMap.get(groupKey) ?? new Set<string>();
			subgroups.add(subgroup);
			subgroupMap.set(groupKey, subgroups);
		}

		this.groupSuggestions = [...groupSet].sort((left, right) =>
			left.localeCompare(right, undefined, {
				sensitivity: 'base',
			}),
		);
		this.subgroupSuggestionsByGroup = new Map(
			[...subgroupMap.entries()].map(([key, values]) => [
				key,
				[...values].sort((left, right) =>
					left.localeCompare(right, undefined, {
						sensitivity: 'base',
					}),
				),
			]),
		);
	}

	private initializeComboValues(): void {
		if (this.mode === 'create') {
			this.groupDropdownValue = '';
			this.groupCustomValue = '';
			this.subgroupDropdownValue = '';
			this.subgroupCustomValue = '';
			return;
		}

		this.groupDropdownValue = this.findMatchingOptionValue(
			this.groupSuggestions,
			this.groupValue,
		);
		this.groupCustomValue =
			this.groupDropdownValue.length > 0 ? '' : this.groupValue;

		const subgroupOptions = this.getSubgroupSuggestionsForGroup(
			this.getResolvedGroupValue(),
		);
		this.subgroupDropdownValue = this.findMatchingOptionValue(
			subgroupOptions,
			this.subgroupValue,
		);
		this.subgroupCustomValue =
			this.subgroupDropdownValue.length > 0 ? '' : this.subgroupValue;
	}

	private populateGroupDropdown(
		placeholder: string,
		selectedValue: string,
	): void {
		if (!this.groupDropdown) {
			return;
		}

		this.runWithSynchronizedControls(() => {
			this.groupDropdown?.selectEl.replaceChildren();
			this.groupDropdown?.addOption('', placeholder);
			for (const option of this.groupSuggestions) {
				this.groupDropdown?.addOption(option, option);
			}
			this.groupDropdown?.setValue(selectedValue);
		});
	}

	private populateSubgroupDropdown(
		placeholder: string,
		selectedValue: string,
	): void {
		if (!this.subgroupDropdown) {
			return;
		}

		const options = this.getSubgroupSuggestionsForGroup(
			this.getResolvedGroupValue(),
		);
		const canEditSubgroup = this.getResolvedGroupValue().trim().length > 0;
		this.runWithSynchronizedControls(() => {
			this.subgroupDropdown?.selectEl.replaceChildren();
			this.subgroupDropdown?.addOption('', placeholder);
			for (const option of options) {
				this.subgroupDropdown?.addOption(option, option);
			}
			this.subgroupDropdown?.setValue(selectedValue);
			if (this.subgroupDropdown) {
				this.subgroupDropdown.selectEl.disabled = !canEditSubgroup;
			}
		});
	}

	private refreshSubgroupControl(): void {
		const dictionary = this.getDictionary();
		const resolvedGroupValue = this.getResolvedGroupValue();
		const subgroupOptions = this.getSubgroupSuggestionsForGroup(resolvedGroupValue);

		if (resolvedGroupValue.trim().length === 0) {
			this.subgroupDropdownValue = '';
			this.subgroupCustomValue = '';
		} else if (this.subgroupCustomValue.trim().length === 0) {
			const matchingValue = this.findMatchingOptionValue(
				subgroupOptions,
				this.subgroupDropdownValue,
			);
			this.subgroupDropdownValue = matchingValue;
		}

		this.populateSubgroupDropdown(
			dictionary.modal.spacedReview.subgroup.placeholder,
			this.subgroupDropdownValue,
		);
		this.runWithSynchronizedControls(() => {
			this.subgroupInput?.setValue(this.subgroupCustomValue);
			if (this.subgroupInput) {
				this.subgroupInput.inputEl.disabled =
					resolvedGroupValue.trim().length === 0;
			}
		});
	}

	private getSubgroupSuggestionsForGroup(groupValue: string): string[] {
		return (
			this.subgroupSuggestionsByGroup.get(this.getSuggestionKey(groupValue)) ?? []
		);
	}

	private getResolvedGroupPath(): string[] {
		const resolvedGroupValue = this.getResolvedGroupValue();
		const resolvedSubgroupValue = this.getResolvedSubgroupValue(
			resolvedGroupValue,
		);
		return [resolvedGroupValue, resolvedSubgroupValue].filter(
			(value) => value.length > 0,
		);
	}

	private getResolvedGroupValue(): string {
		return this.resolveSuggestionValue(
			this.groupCustomValue,
			this.groupDropdownValue,
			this.groupSuggestions,
		);
	}

	private getResolvedSubgroupValue(resolvedGroupValue?: string): string {
		const groupValue = resolvedGroupValue ?? this.getResolvedGroupValue();
		if (groupValue.trim().length === 0) {
			return '';
		}

		return this.resolveSuggestionValue(
			this.subgroupCustomValue,
			this.subgroupDropdownValue,
			this.getSubgroupSuggestionsForGroup(groupValue),
		);
	}

	private resolveSuggestionValue(
		customValue: string,
		dropdownValue: string,
		options: string[],
	): string {
		const normalizedCustomValue = this.getNormalizedSuggestionLabel(customValue);
		if (normalizedCustomValue.length > 0) {
			return (
				this.findMatchingOptionValue(options, normalizedCustomValue) ||
				normalizedCustomValue
			);
		}

		return this.findMatchingOptionValue(options, dropdownValue);
	}

	private scheduleInitialFocusCleanup(): void {
		window.requestAnimationFrame(() => {
			const activeElement = this.modalEl.ownerDocument.activeElement;
			if (
				activeElement instanceof HTMLElement &&
				this.modalEl.contains(activeElement)
			) {
				activeElement.blur();
			}
		});
	}

	private runWithSynchronizedControls(callback: () => void): void {
		this.isSynchronizingControls = true;
		try {
			callback();
		} finally {
			this.isSynchronizingControls = false;
		}
	}

	private findMatchingOptionValue(options: string[], value: string): string {
		const key = this.getSuggestionKey(value);
		return (
			options.find((option) => this.getSuggestionKey(option) === key) ?? ''
		);
	}

	private getNormalizedSuggestionLabel(value: unknown): string {
		if (typeof value !== 'string') {
			return '';
		}

		return value.trim().replace(/\s+/g, ' ');
	}

	private getSuggestionKey(value: string): string {
		return this.getNormalizedSuggestionLabel(value).toLocaleLowerCase();
	}

	private getDictionary():
		| (NestKitDictionary & SpacedReviewModalDictionaryExtension) {
		return getDictionary(
			this.settings.uiLanguage,
		) as NestKitDictionary & SpacedReviewModalDictionaryExtension;
	}
}
