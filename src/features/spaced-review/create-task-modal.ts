import { Modal, Notice, Setting, TextComponent } from 'obsidian';
import { getDictionary, type NestKitDictionary } from '../../i18n';
import type { NestKitSettings } from '../../settings';
import { isIsoDateString, todayIsoDate } from './dates';
import { getBuiltInReviewPresets } from './presets';
import { parseReviewIntervalsInput } from './intervals';
import type { ReviewTask } from './types';
import type { CreateReviewTaskInput } from './task-factory';

interface SpacedReviewModalDictionaryExtension {
	settings: {
		spacedReview: {
			presetOptions: {
				fastReview: string;
				standardReview: string;
				longTermMemory: string;
			};
		};
	};
	modal: {
		spacedReview: {
			createTitle: string;
			title: {
				name: string;
				placeholder: string;
			};
			startDate: {
				name: string;
			};
			preset: {
				name: string;
			};
			customIntervals: {
				name: string;
				description: string;
				placeholder: string;
			};
			save: string;
			cancel: string;
			validation: {
				titleRequired: string;
				invalidDate: string;
				invalidIntervals: string;
			};
		};
	};
}

export class CreateSpacedReviewTaskModal extends Modal {
	private titleValue = '';
	private startDateValue = todayIsoDate();
	private presetIdValue: string;
	private customIntervalsValue = '';
	private titleInput?: TextComponent;
	private customIntervalsInput?: TextComponent;

	constructor(
		app: Modal['app'],
		private readonly settings: NestKitSettings,
		private readonly onSubmit: (
			input: CreateReviewTaskInput,
		) => Promise<ReviewTask | null>,
	) {
		super(app);
		this.presetIdValue = settings.spacedReviewDefaultPresetId;
	}

	onOpen(): void {
		const dictionary = getDictionary(
			this.settings.uiLanguage,
		) as NestKitDictionary & SpacedReviewModalDictionaryExtension;
		const { contentEl, titleEl } = this;
		contentEl.empty();
		titleEl.setText(dictionary.modal.spacedReview.createTitle);

		new Setting(contentEl)
			.setName(dictionary.modal.spacedReview.title.name)
			.addText((text) => {
				this.titleInput = text;
				text
					.setPlaceholder(dictionary.modal.spacedReview.title.placeholder)
					.setValue(this.titleValue)
					.onChange((value) => {
						this.titleValue = value;
					});
			});

		new Setting(contentEl)
			.setName(dictionary.modal.spacedReview.startDate.name)
			.addText((text) =>
				text
					.setPlaceholder('Example: YYYY-MM-DD')
					.setValue(this.startDateValue)
					.onChange((value) => {
						this.startDateValue = value;
					}),
			);

		new Setting(contentEl)
			.setName(dictionary.modal.spacedReview.preset.name)
			.addDropdown((dropdown) => {
				for (const preset of getBuiltInReviewPresets()) {
					dropdown.addOption(
						preset.id,
						this.getPresetLabel(preset.id, dictionary),
					);
				}

				dropdown
					.setValue(this.presetIdValue)
					.onChange((value) => {
						this.presetIdValue = value;
					});
			});

		new Setting(contentEl)
			.setName(dictionary.modal.spacedReview.customIntervals.name)
			.setDesc(dictionary.modal.spacedReview.customIntervals.description)
			.addText((text) => {
				this.customIntervalsInput = text;
				text
					.setPlaceholder(
						dictionary.modal.spacedReview.customIntervals.placeholder,
					)
					.setValue(this.customIntervalsValue)
					.onChange((value) => {
						this.customIntervalsValue = value;
					});
			});

		new Setting(contentEl)
			.addButton((button) =>
				button
					.setButtonText(dictionary.modal.spacedReview.save)
					.setCta()
					.onClick(() => {
						void this.handleSubmit();
					}),
			)
			.addButton((button) =>
				button
					.setButtonText(dictionary.modal.spacedReview.cancel)
					.onClick(() => this.close()),
			);

		this.titleInput?.inputEl.focus();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private async handleSubmit(): Promise<void> {
		const dictionary = getDictionary(
			this.settings.uiLanguage,
		) as NestKitDictionary & SpacedReviewModalDictionaryExtension;
		const title = this.titleValue.trim();

		if (title.length === 0) {
			new Notice(dictionary.modal.spacedReview.validation.titleRequired);
			return;
		}

		if (!isIsoDateString(this.startDateValue)) {
			new Notice(dictionary.modal.spacedReview.validation.invalidDate);
			return;
		}

		const customIntervalsText = this.customIntervalsValue.trim();
		if (customIntervalsText.length > 0) {
			const parsed = parseReviewIntervalsInput(customIntervalsText);
			if (parsed.intervals.length === 0) {
				new Notice(dictionary.modal.spacedReview.validation.invalidIntervals);
				return;
			}
		}

		try {
			const createdTask = await this.onSubmit({
				title,
				startDate: this.startDateValue,
				presetId: this.presetIdValue,
				customIntervalsText,
			});

			if (!createdTask) {
				return;
			}

			this.close();
		} catch (error) {
			console.error(
				'[NestKit] Unexpected spaced review modal submission failure.',
				error,
			);
		}
	}

	private getPresetLabel(
		presetId: string,
		dictionary: NestKitDictionary & SpacedReviewModalDictionaryExtension,
	): string {
		switch (presetId) {
			case 'fast-review':
				return dictionary.settings.spacedReview.presetOptions.fastReview;
			case 'standard-review':
				return dictionary.settings.spacedReview.presetOptions.standardReview;
			case 'long-term-memory':
				return dictionary.settings.spacedReview.presetOptions.longTermMemory;
			default:
				return presetId;
		}
	}
}
