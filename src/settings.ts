import { App, PluginSettingTab, Setting } from 'obsidian';
import {
	getDictionary,
	type NestKitDictionary,
	type NestKitLanguage,
} from './i18n';
import {
	DEFAULT_REVIEW_PRESET_ID,
	getBuiltInReviewPresets,
} from './features/spaced-review/presets';
import type {
	CompletedOccurrenceDisplay,
	OverduePolicy,
	ScheduleMode,
} from './features/spaced-review/types';
import type NestKitPlugin from './main';

export const CURRENT_SETTINGS_SCHEMA_VERSION = 1;

type SliderSettingKey =
	| 'rightSidebarDrawerTopPx'
	| 'rightSidebarDrawerBottomGapPx'
	| 'rightSidebarDrawerRightOffsetPx'
	| 'rightSidebarDrawerWidthPx'
	| 'rightSidebarDrawerHeightVh'
	| 'rightSidebarEdgeTriggerWidthPx'
	| 'rightSidebarCollapseDelayMs'
	| 'rightSidebarAnimationDurationMs'
	| 'rightSidebarTopControlOffsetPx'
	| 'rightSidebarPinTopPx'
	| 'rightSidebarPinRightPx';

interface NumericSettingLimit {
	min: number;
	max: number;
	step: number;
	unit: 'px' | 'ms' | '%';
}

type ReviewPlanSettingValue = 'catchUp' | 'fixed';

interface SpacedReviewSettingsDictionaryExtension {
	settings: {
		sections: {
			spacedReview: string;
		};
		toggles: {
			enableSpacedReviewName: string;
			enableSpacedReviewDesc: string;
		};
		spacedReview: {
			name: string;
			dailyNoteFolder: {
				name: string;
				description: string;
			};
			dailyNoteDateFormat: {
				name: string;
				description: string;
			};
			managedBlockHeading: {
				name: string;
				description: string;
			};
			defaultPreset: {
				name: string;
				description: string;
			};
			completedDisplay: {
				name: string;
				description: string;
				remove: string;
				keepChecked: string;
			};
			reviewPlan: {
				name: string;
				description: string;
				catchUp: string;
				fixed: string;
			};
			showOverdueBadge: {
				name: string;
				description: string;
			};
			presetOptions: {
				fastReview: string;
				standardReview: string;
				longTermMemory: string;
			};
		};
	};
}

export const NUMERIC_SETTING_LIMITS: Record<
	SliderSettingKey,
	NumericSettingLimit
> = {
	rightSidebarEdgeTriggerWidthPx: {
		min: 4,
		max: 40,
		step: 1,
		unit: 'px',
	},
	rightSidebarCollapseDelayMs: {
		min: 0,
		max: 1000,
		step: 50,
		unit: 'ms',
	},
	rightSidebarAnimationDurationMs: {
		min: 0,
		max: 1000,
		step: 10,
		unit: 'ms',
	},
	rightSidebarDrawerWidthPx: {
		min: 240,
		max: 500,
		step: 1,
		unit: 'px',
	},
	rightSidebarDrawerHeightVh: {
		min: 30,
		max: 100,
		step: 1,
		unit: '%',
	},
	rightSidebarDrawerTopPx: {
		min: 40,
		max: 120,
		step: 1,
		unit: 'px',
	},
	rightSidebarDrawerBottomGapPx: {
		min: 0,
		max: 120,
		step: 1,
		unit: 'px',
	},
	rightSidebarDrawerRightOffsetPx: {
		min: -40,
		max: 0,
		step: 1,
		unit: 'px',
	},
	rightSidebarTopControlOffsetPx: {
		min: 0,
		max: 500,
		step: 1,
		unit: 'px',
	},
	rightSidebarPinTopPx: {
		min: 0,
		max: 20,
		step: 1,
		unit: 'px',
	},
	rightSidebarPinRightPx: {
		min: 0,
		max: 20,
		step: 1,
		unit: 'px',
	},
};

export interface NestKitSettings {
	schemaVersion: number;
	uiLanguage: NestKitLanguage;
	rightSidebarDrawerEnabled: boolean;
	rightSidebarPinButtonEnabled: boolean;
	rememberPinnedState: boolean;
	rightSidebarPinned: boolean;
	rightSidebarDrawerTopPx: number;
	rightSidebarDrawerBottomGapPx: number;
	rightSidebarDrawerRightOffsetPx: number;
	rightSidebarDrawerWidthPx: number;
	rightSidebarDrawerHeightVh: number;
	rightSidebarEdgeTriggerWidthPx: number;
	rightSidebarCollapseDelayMs: number;
	rightSidebarAnimationDurationMs: number;
	rightSidebarTopControlOffsetPx: number;
	rightSidebarPinTopPx: number;
	rightSidebarPinRightPx: number;
	spacedReviewEnabled: boolean;
	spacedReviewDailyNoteFolder: string;
	spacedReviewDailyNoteDateFormat: string;
	spacedReviewManagedBlockHeading: string;
	spacedReviewDefaultPresetId: string;
	spacedReviewCompletedOccurrenceDisplay: CompletedOccurrenceDisplay;
	spacedReviewOverduePolicy: OverduePolicy;
	spacedReviewScheduleMode: ScheduleMode;
	spacedReviewShowOverdueBadge: boolean;
}

export const DEFAULT_SETTINGS: NestKitSettings = {
	schemaVersion: CURRENT_SETTINGS_SCHEMA_VERSION,
	uiLanguage: 'zh-CN',
	rightSidebarDrawerEnabled: false,
	rightSidebarPinButtonEnabled: true,
	rememberPinnedState: false,
	rightSidebarPinned: false,
	rightSidebarDrawerTopPx: 89,
	rightSidebarDrawerBottomGapPx: 42,
	rightSidebarDrawerRightOffsetPx: -5,
	rightSidebarDrawerWidthPx: 340,
	rightSidebarDrawerHeightVh: 100,
	rightSidebarEdgeTriggerWidthPx: 26,
	rightSidebarCollapseDelayMs: 550,
	rightSidebarAnimationDurationMs: 210,
	rightSidebarTopControlOffsetPx: 110,
	rightSidebarPinTopPx: 6,
	rightSidebarPinRightPx: 8,
	spacedReviewEnabled: false,
	spacedReviewDailyNoteFolder: '',
	spacedReviewDailyNoteDateFormat: 'YYYY-MM-DD',
	spacedReviewManagedBlockHeading: '\u4eca\u65e5\u590d\u4e60',
	spacedReviewDefaultPresetId: DEFAULT_REVIEW_PRESET_ID,
	spacedReviewCompletedOccurrenceDisplay: 'remove',
	spacedReviewOverduePolicy: 'carryOver',
	spacedReviewScheduleMode: 'rollingTimeline',
	spacedReviewShowOverdueBadge: true,
};

interface SliderSettingConfig {
	key: SliderSettingKey;
	name: (dictionary: NestKitDictionary) => string;
	description: (dictionary: NestKitDictionary) => string;
	min: number;
	max: number;
	step: number;
	unit: 'px' | 'ms' | '%';
}

const BEHAVIOUR_SLIDERS: SliderSettingConfig[] = [
	{
		key: 'rightSidebarEdgeTriggerWidthPx',
		name: (dictionary) => dictionary.settings.sliders.edgeTriggerWidth.name,
		description: (dictionary) =>
			dictionary.settings.sliders.edgeTriggerWidth.description,
		...NUMERIC_SETTING_LIMITS.rightSidebarEdgeTriggerWidthPx,
	},
	{
		key: 'rightSidebarCollapseDelayMs',
		name: (dictionary) => dictionary.settings.sliders.collapseDelay.name,
		description: (dictionary) =>
			dictionary.settings.sliders.collapseDelay.description,
		...NUMERIC_SETTING_LIMITS.rightSidebarCollapseDelayMs,
	},
	{
		key: 'rightSidebarAnimationDurationMs',
		name: (dictionary) =>
			dictionary.settings.sliders.animationDuration.name,
		description: (dictionary) =>
			dictionary.settings.sliders.animationDuration.description,
		...NUMERIC_SETTING_LIMITS.rightSidebarAnimationDurationMs,
	},
];

const POSITIONING_SLIDERS: SliderSettingConfig[] = [
	{
		key: 'rightSidebarDrawerWidthPx',
		name: (dictionary) => dictionary.settings.sliders.drawerWidth.name,
		description: (dictionary) =>
			dictionary.settings.sliders.drawerWidth.description,
		...NUMERIC_SETTING_LIMITS.rightSidebarDrawerWidthPx,
	},
	{
		key: 'rightSidebarDrawerHeightVh',
		name: (dictionary) => dictionary.settings.sliders.drawerHeight.name,
		description: (dictionary) =>
			dictionary.settings.sliders.drawerHeight.description,
		...NUMERIC_SETTING_LIMITS.rightSidebarDrawerHeightVh,
	},
	{
		key: 'rightSidebarDrawerTopPx',
		name: (dictionary) => dictionary.settings.sliders.drawerTopOffset.name,
		description: (dictionary) =>
			dictionary.settings.sliders.drawerTopOffset.description,
		...NUMERIC_SETTING_LIMITS.rightSidebarDrawerTopPx,
	},
	{
		key: 'rightSidebarDrawerBottomGapPx',
		name: (dictionary) => dictionary.settings.sliders.drawerBottomGap.name,
		description: (dictionary) =>
			dictionary.settings.sliders.drawerBottomGap.description,
		...NUMERIC_SETTING_LIMITS.rightSidebarDrawerBottomGapPx,
	},
	{
		key: 'rightSidebarDrawerRightOffsetPx',
		name: (dictionary) => dictionary.settings.sliders.drawerRightOffset.name,
		description: (dictionary) =>
			dictionary.settings.sliders.drawerRightOffset.description,
		...NUMERIC_SETTING_LIMITS.rightSidebarDrawerRightOffsetPx,
	},
];

const ADVANCED_SLIDERS: SliderSettingConfig[] = [
	{
		key: 'rightSidebarTopControlOffsetPx',
		name: (dictionary) => dictionary.settings.sliders.topControlOffset.name,
		description: (dictionary) =>
			dictionary.settings.sliders.topControlOffset.description,
		...NUMERIC_SETTING_LIMITS.rightSidebarTopControlOffsetPx,
	},
	{
		key: 'rightSidebarPinTopPx',
		name: (dictionary) => dictionary.settings.sliders.pinTopOffset.name,
		description: (dictionary) =>
			dictionary.settings.sliders.pinTopOffset.description,
		...NUMERIC_SETTING_LIMITS.rightSidebarPinTopPx,
	},
	{
		key: 'rightSidebarPinRightPx',
		name: (dictionary) => dictionary.settings.sliders.pinRightOffset.name,
		description: (dictionary) =>
			dictionary.settings.sliders.pinRightOffset.description,
		...NUMERIC_SETTING_LIMITS.rightSidebarPinRightPx,
	},
];

export class NestKitSettingTab extends PluginSettingTab {
	plugin: NestKitPlugin;

	constructor(app: App, plugin: NestKitPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		const dictionary = getDictionary(
			this.plugin.settings.uiLanguage,
		) as NestKitDictionary & SpacedReviewSettingsDictionaryExtension;

		containerEl.empty();

		new Setting(containerEl)
			.setName(dictionary.settings.interfaceLanguageName)
			.setDesc(dictionary.settings.interfaceLanguageDesc)
			.addDropdown((dropdown) =>
				dropdown
					.addOption(
						'zh-CN',
						dictionary.settings.languageOptions['zh-CN'],
					)
					.addOption('en', dictionary.settings.languageOptions.en)
					.setValue(this.plugin.settings.uiLanguage)
					.onChange(async (value) => {
						await this.plugin.updateSetting(
							'uiLanguage',
							value as NestKitLanguage,
						);
						this.plugin.refreshSidebarFeature();
						this.display();
					}),
			);

		new Setting(containerEl)
			.setName(dictionary.settings.sections.rightSidebarDrawer)
			.setHeading();

		new Setting(containerEl)
			.setName(dictionary.settings.toggles.enableDrawerName)
			.setDesc(dictionary.settings.toggles.enableDrawerDesc)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.rightSidebarDrawerEnabled)
					.onChange(async (value) => {
						await this.plugin.updateSetting(
							'rightSidebarDrawerEnabled',
							value,
						);
					}),
			);

		new Setting(containerEl)
			.setName(dictionary.settings.toggles.showPinButtonName)
			.setDesc(dictionary.settings.toggles.showPinButtonDesc)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.rightSidebarPinButtonEnabled)
					.onChange(async (value) => {
						await this.plugin.updateSetting(
							'rightSidebarPinButtonEnabled',
							value,
						);
					}),
			);

		new Setting(containerEl)
			.setName(dictionary.settings.toggles.rememberPinnedStateName)
			.setDesc(dictionary.settings.toggles.rememberPinnedStateDesc)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.rememberPinnedState)
					.onChange(async (value) => {
						await this.plugin.updateRememberPinnedState(value);
						this.display();
					}),
			);

		new Setting(containerEl)
			.setName(dictionary.settings.sections.behaviour)
			.setHeading();
		this.addSliderGroup(containerEl, BEHAVIOUR_SLIDERS, dictionary);

		new Setting(containerEl)
			.setName(dictionary.settings.sections.positioning)
			.setHeading();
		this.addSliderGroup(containerEl, POSITIONING_SLIDERS, dictionary);

		new Setting(containerEl)
			.setName(dictionary.settings.sections.advanced)
			.setHeading();
		this.addSliderGroup(containerEl, ADVANCED_SLIDERS, dictionary);

		new Setting(containerEl)
			.setName(dictionary.settings.sections.spacedReview)
			.setHeading();

		new Setting(containerEl)
			.setName(dictionary.settings.toggles.enableSpacedReviewName)
			.setDesc(dictionary.settings.toggles.enableSpacedReviewDesc)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.spacedReviewEnabled)
					.onChange(async (value) => {
						await this.plugin.updateSetting('spacedReviewEnabled', value);
					}),
			);

		new Setting(containerEl)
			.setName(dictionary.settings.spacedReview.dailyNoteFolder.name)
			.setDesc(dictionary.settings.spacedReview.dailyNoteFolder.description)
			.addText((text) =>
				text
					.setPlaceholder('Daily')
					.setValue(this.plugin.settings.spacedReviewDailyNoteFolder)
					.onChange(async (value) => {
						await this.plugin.updateSetting(
							'spacedReviewDailyNoteFolder',
							value,
						);
					}),
			);

		new Setting(containerEl)
			.setName(dictionary.settings.spacedReview.dailyNoteDateFormat.name)
			.setDesc(
				dictionary.settings.spacedReview.dailyNoteDateFormat.description,
			)
			.addText((text) =>
				text
					.setPlaceholder('Example: YYYY-MM-DD')
					.setValue(this.plugin.settings.spacedReviewDailyNoteDateFormat)
					.onChange(async (value) => {
						await this.plugin.updateSetting(
							'spacedReviewDailyNoteDateFormat',
							value,
						);
					}),
			);

		new Setting(containerEl)
			.setName(dictionary.settings.spacedReview.managedBlockHeading.name)
			.setDesc(
				dictionary.settings.spacedReview.managedBlockHeading.description,
			)
			.addText((text) =>
				text
					.setPlaceholder(dictionary.settings.spacedReview.name)
					.setValue(this.plugin.settings.spacedReviewManagedBlockHeading)
					.onChange(async (value) => {
						await this.plugin.updateSetting(
							'spacedReviewManagedBlockHeading',
							value,
						);
					}),
			);

		new Setting(containerEl)
			.setName(dictionary.settings.spacedReview.defaultPreset.name)
			.setDesc(dictionary.settings.spacedReview.defaultPreset.description)
			.addDropdown((dropdown) => {
				for (const preset of getBuiltInReviewPresets()) {
					dropdown.addOption(
						preset.id,
						this.getPresetLabel(preset.id, dictionary),
					);
				}

				dropdown
					.setValue(this.plugin.settings.spacedReviewDefaultPresetId)
					.onChange(async (value) => {
						await this.plugin.updateSetting(
							'spacedReviewDefaultPresetId',
							value,
						);
					});
			});

		new Setting(containerEl)
			.setName(dictionary.settings.spacedReview.completedDisplay.name)
			.setDesc(dictionary.settings.spacedReview.completedDisplay.description)
			.addDropdown((dropdown) =>
				dropdown
					.addOption(
						'remove',
						dictionary.settings.spacedReview.completedDisplay.remove,
					)
					.addOption(
						'keepChecked',
						dictionary.settings.spacedReview.completedDisplay.keepChecked,
					)
					.setValue(
						this.plugin.settings.spacedReviewCompletedOccurrenceDisplay,
					)
					.onChange(async (value) => {
						await this.plugin.updateSetting(
							'spacedReviewCompletedOccurrenceDisplay',
							value as CompletedOccurrenceDisplay,
						);
					}),
			);

		new Setting(containerEl)
			.setName(dictionary.settings.spacedReview.reviewPlan.name)
			.setDesc(dictionary.settings.spacedReview.reviewPlan.description)
			.addDropdown((dropdown) =>
				dropdown
					.addOption(
						'catchUp',
						dictionary.settings.spacedReview.reviewPlan.catchUp,
					)
					.addOption(
						'fixed',
						dictionary.settings.spacedReview.reviewPlan.fixed,
					)
					.setValue(this.getReviewPlanValue())
					.onChange(async (value) => {
						await this.plugin.updateSpacedReviewPlan(
							value as ReviewPlanSettingValue,
						);
					}),
			);

		new Setting(containerEl)
			.setName(dictionary.settings.spacedReview.showOverdueBadge.name)
			.setDesc(dictionary.settings.spacedReview.showOverdueBadge.description)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.spacedReviewShowOverdueBadge)
					.onChange(async (value) => {
						await this.plugin.updateSetting(
							'spacedReviewShowOverdueBadge',
							value,
						);
					}),
			);

		new Setting(containerEl)
			.setName(dictionary.settings.restoreAllDefaultsName)
			.setDesc(dictionary.settings.restoreAllDefaultsDesc)
			.addButton((button) =>
				button
					.setIcon('rotate-ccw')
					.setWarning()
					.setButtonText(dictionary.settings.restoreAllDefaultsButton)
					.onClick(async () => {
						await this.plugin.restoreAllDefaults();
						this.display();
					}),
			);
	}

	private addSliderGroup(
		containerEl: HTMLElement,
		configs: SliderSettingConfig[],
		dictionary: NestKitDictionary,
	): void {
		for (const config of configs) {
			this.addSliderSetting(containerEl, config, dictionary);
		}
	}

	private addSliderSetting(
		containerEl: HTMLElement,
		config: SliderSettingConfig,
		dictionary: NestKitDictionary,
	): void {
		const setting = new Setting(containerEl)
			.setName(config.name(dictionary))
			.setDesc(this.formatSliderDescription(config, dictionary));

		setting.addSlider((slider) =>
			slider
				.setLimits(config.min, config.max, config.step)
				.setValue(this.plugin.settings[config.key])
				.setDynamicTooltip()
				.onChange(async (value) => {
					setting.setDesc(
						this.formatSliderDescription(config, dictionary, value),
					);
					await this.plugin.updateSetting(config.key, value);
				}),
		);

		setting.addExtraButton((button) =>
			button
				.setIcon('rotate-ccw')
				.setTooltip(dictionary.settings.restoreSingleSetting)
				.onClick(async () => {
					await this.plugin.updateSetting(
						config.key,
						DEFAULT_SETTINGS[config.key],
					);
					this.display();
				}),
		);
	}

	private formatSliderDescription(
		config: SliderSettingConfig,
		dictionary: NestKitDictionary,
		value = this.plugin.settings[config.key],
	): string {
		return `${config.description(dictionary)} ${dictionary.settings.currentValue(
			value,
			config.unit,
		)}.`;
	}

	private getReviewPlanValue(): ReviewPlanSettingValue {
		return this.plugin.settings.spacedReviewOverduePolicy === 'skip' &&
			this.plugin.settings.spacedReviewScheduleMode === 'fixedTimeline'
			? 'fixed'
			: 'catchUp';
	}

	private getPresetLabel(
		presetId: string,
		dictionary: NestKitDictionary & SpacedReviewSettingsDictionaryExtension,
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
