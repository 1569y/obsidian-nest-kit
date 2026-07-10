import { Plugin, normalizePath, TFile, type TAbstractFile } from 'obsidian';
import { FeatureManager } from './core/feature-manager';
import { FeatureRegistry } from './core/feature-registry';
import { migrateSettings } from './core/settings-migration';
import { HeadingProgressFeature } from './features/heading-progress';
import { RewardReaderFeature } from './features/reward-reader';
import {
	buildDailyNotePath,
	importCheckedReviewsForToday,
} from './features/spaced-review/daily-note-sync';
import { todayIsoDate } from './features/spaced-review/dates';
import {
	openCreateSpacedReviewTaskModal,
	openSpacedReviewOverview,
	registerSpacedReviewCommands,
	syncSpacedReviewDailyNote,
} from './features/spaced-review/commands';
import { SpacedReviewFeature } from './features/spaced-review';
import { RightSidebarDrawerFeature } from './features/right-sidebar-drawer';
import {
	DEFAULT_SETTINGS,
	NestKitSettingTab,
	type NestKitSettings,
} from './settings';
import { getDictionary, type NestKitDictionary } from './i18n';

export const WORKSPACE_PANEL_SYSTEM_FEATURE_ID = 'workspace-panel-system';
export const HEADING_PROGRESS_FEATURE_ID = 'heading-progress';
export const REWARD_READER_FEATURE_ID = 'reward-reader';
export const SPACED_REVIEW_FEATURE_ID = 'spaced-review';

export default class NestKitPlugin extends Plugin {
	private static readonly DAILY_NOTE_CHECKBOX_IMPORT_DEBOUNCE_MS = 1000;
	settings: NestKitSettings = {
		...DEFAULT_SETTINGS,
	};
	private overviewRibbonButtonEl: HTMLElement | null = null;
	private dailyNoteSyncRibbonButtonEl: HTMLElement | null = null;
	private settingsPersistenceAllowed = true;
	private hasWarnedAboutBlockedSettingsPersistence = false;
	private dailyNoteCheckboxImportTimer: number | null = null;
	private pendingDailyNoteImportPath: string | null = null;
	private dailyNoteCheckboxImportInFlight = false;
	private rerunDailyNoteCheckboxImport = false;
	private readonly featureRegistry = new FeatureRegistry<NestKitSettings>();
	private readonly featureManager = new FeatureManager<NestKitSettings>(
		this.featureRegistry,
	);

	async onload(): Promise<void> {
		await this.loadSettings();

		this.featureManager.register({
			id: WORKSPACE_PANEL_SYSTEM_FEATURE_ID,
			isEnabled: (settings) => settings.rightSidebarDrawerEnabled,
			create: () => new RightSidebarDrawerFeature(this),
			order: 100,
			nameKey: 'features.workspacePanelSystem.name',
			descriptionKey: 'features.workspacePanelSystem.description',
		});
		this.featureManager.register({
			id: HEADING_PROGRESS_FEATURE_ID,
			isEnabled: (settings) => settings.enableHeadingProgress,
			create: () => new HeadingProgressFeature(this),
			order: 150,
			nameKey: 'features.headingProgress.name',
			descriptionKey: 'features.headingProgress.description',
		});
		this.featureManager.register({
			id: REWARD_READER_FEATURE_ID,
			isEnabled: (settings) => settings.enableRewardReader,
			create: () => new RewardReaderFeature(),
			order: 175,
			nameKey: 'features.rewardReader.name',
			descriptionKey: 'features.rewardReader.description',
		});
		this.featureManager.register({
			id: SPACED_REVIEW_FEATURE_ID,
			isEnabled: (settings) => settings.spacedReviewEnabled,
			create: () => new SpacedReviewFeature(this, () => this.settings),
			order: 200,
			nameKey: 'features.spacedReview.name',
			descriptionKey: 'features.spacedReview.description',
		});

		registerSpacedReviewCommands(
			this,
			() => this.settings,
			() => this.getSpacedReviewFeature(),
		);

		this.addSettingTab(new NestKitSettingTab(this.app, this));
		this.registerSpacedReviewEditorContextMenu();
		this.registerTodayDailyNoteCheckboxImportListener();

		this.applyFeatureSettings();
	}

	onunload(): void {
		this.clearDailyNoteCheckboxImportTimer();
		this.clearSpacedReviewRibbonButtons();
		this.featureManager.disableAll();
	}

	async updateSetting<K extends keyof NestKitSettings>(
		key: K,
		value: NestKitSettings[K],
	): Promise<void> {
		const shouldRefreshHeadingProgress =
			this.settings.enableHeadingProgress &&
			(key === 'headingProgressSource' ||
				key === 'headingProgressDisplayMode' ||
				key === 'hideHeadingProgressWhenNoHeading');

		if (key === 'rightSidebarPinButtonEnabled' && value === false) {
			await this.clearPinnedState({
				clearRuntime: true,
			});
		}

		this.settings = {
			...this.settings,
			[key]: value,
		};

		await this.saveSettings();
		this.applyFeatureSettings();

		if (shouldRefreshHeadingProgress) {
			this.getHeadingProgressFeature()?.refresh();
		}
	}

	async updateRememberPinnedState(enabled: boolean): Promise<void> {
		const runtimePinned =
			enabled && this.getRightSidebarDrawerFeature()?.isRuntimePinned()
				? true
				: false;

		this.settings = {
			...this.settings,
			rememberPinnedState: enabled,
			rightSidebarPinned: runtimePinned,
		};

		await this.saveSettings();

		if (!enabled) {
			await this.clearPinnedState({
				clearRuntime: true,
			});
		}

		this.getRightSidebarDrawerFeature()?.refresh();
	}

	async syncPersistentPinnedState(runtimePinned: boolean): Promise<void> {
		const nextPinned = this.settings.rememberPinnedState ? runtimePinned : false;

		if (this.settings.rightSidebarPinned === nextPinned) {
			return;
		}

		this.settings = {
			...this.settings,
			rightSidebarPinned: nextPinned,
		};

		await this.saveSettings();
	}

	async clearPinnedState(options?: {
		clearRuntime?: boolean;
	}): Promise<void> {
		const shouldClearRuntime = options?.clearRuntime ?? false;
		const nextPinned = false;
		const settingsChanged = this.settings.rightSidebarPinned !== nextPinned;

		if (shouldClearRuntime) {
			this.getRightSidebarDrawerFeature()?.clearRuntimePinnedState();
		}

		if (!settingsChanged) {
			return;
		}

		this.settings = {
			...this.settings,
			rightSidebarPinned: nextPinned,
		};

		await this.saveSettings();
	}

	async restoreAllDefaults(): Promise<void> {
		this.settings = {
			...DEFAULT_SETTINGS,
		};

		await this.saveSettings();
		this.getRightSidebarDrawerFeature()?.clearRuntimePinnedState();
		this.applyFeatureSettings();
	}

	refreshSidebarFeature(): void {
		this.getRightSidebarDrawerFeature()?.refresh();
	}

	async updateSpacedReviewPlan(plan: 'catchUp' | 'fixed'): Promise<void> {
		this.settings = {
			...this.settings,
			spacedReviewOverduePolicy:
				plan === 'fixed' ? 'skip' : 'carryOver',
			spacedReviewScheduleMode:
				plan === 'fixed' ? 'fixedTimeline' : 'rollingTimeline',
		};

		await this.saveSettings();
		this.applyFeatureSettings();
	}

	private applyFeatureSettings(): void {
		this.featureManager.sync(this.settings);
		this.refreshSpacedReviewRibbonButtons();
	}

	private registerTodayDailyNoteCheckboxImportListener(): void {
		this.registerEvent(
			this.app.vault.on('modify', (file) => {
				if (!this.shouldTrackTodayDailyNoteModify(file)) {
					return;
				}

				this.pendingDailyNoteImportPath = file.path;
				this.clearDailyNoteCheckboxImportTimer();
				this.dailyNoteCheckboxImportTimer = window.setTimeout(() => {
					this.dailyNoteCheckboxImportTimer = null;
					const pendingPath = this.pendingDailyNoteImportPath;
					if (!pendingPath) {
						return;
					}

					void this.runDailyNoteCheckboxImport(pendingPath);
				}, NestKitPlugin.DAILY_NOTE_CHECKBOX_IMPORT_DEBOUNCE_MS);
			}),
		);
	}

	private async loadSettings(): Promise<void> {
		const migration = migrateSettings(await this.loadData());

		this.settingsPersistenceAllowed =
			!migration.hasUnsupportedFutureVersion;
		this.hasWarnedAboutBlockedSettingsPersistence = false;
		this.settings = migration.settings;

		for (const warning of migration.warnings) {
			console.warn(`[NestKit] ${warning}`);
		}

		if (migration.shouldPersist) {
			await this.saveSettings();
		}
	}

	private async saveSettings(): Promise<void> {
		if (!this.settingsPersistenceAllowed) {
			if (!this.hasWarnedAboutBlockedSettingsPersistence) {
				console.warn(
					'[NestKit] Settings persistence is disabled because the stored settings schema is newer than this plugin version.',
				);
				this.hasWarnedAboutBlockedSettingsPersistence = true;
			}

			return;
		}

		await this.saveData(this.settings);
	}

	private getRightSidebarDrawerFeature():
		| RightSidebarDrawerFeature
		| undefined {
		return this.featureManager.get<RightSidebarDrawerFeature>(
			WORKSPACE_PANEL_SYSTEM_FEATURE_ID,
		);
	}

	private getHeadingProgressFeature():
		| HeadingProgressFeature
		| undefined {
		return this.featureManager.get<HeadingProgressFeature>(
			HEADING_PROGRESS_FEATURE_ID,
		);
	}

	private getSpacedReviewFeature():
		| SpacedReviewFeature
		| undefined {
		return this.featureManager.get<SpacedReviewFeature>(
			SPACED_REVIEW_FEATURE_ID,
		);
	}

	private registerSpacedReviewEditorContextMenu(): void {
		this.registerEvent(
			this.app.workspace.on('editor-menu', (menu, editor, info) => {
				if (
					!this.settings.spacedReviewEnabled ||
					!this.settings.spacedReviewShowEditorContextMenuItem
				) {
					return;
				}

				const feature = this.getSpacedReviewFeature();
				if (!feature?.isEnabled()) {
					return;
				}

				const file = info.file;
				if (!this.isMarkdownFile(file)) {
					return;
				}

				const dictionary = this.getCurrentDictionary();
				menu.addItem((item) => {
					item
						.setTitle(
							dictionary.spacedReview.overview.addToSpacedReviewContextMenu,
						)
						.setIcon('plus-square')
						.onClick(() => {
							const selectedText = editor.getSelection().trim();
							const initialTitle =
								selectedText.length > 0 ? selectedText : file.basename;
							void openCreateSpacedReviewTaskModal(
								this,
								() => this.settings,
								() => this.getSpacedReviewFeature(),
								{
									initialTitle,
									initialTargetLink: file.path,
								},
							);
						});
				});
			}),
		);
	}

	private refreshSpacedReviewRibbonButtons(): void {
		this.clearSpacedReviewRibbonButtons();
		if (!this.settings.spacedReviewEnabled) {
			return;
		}

		const feature = this.getSpacedReviewFeature();
		if (!feature?.isEnabled()) {
			return;
		}

		const dictionary = this.getCurrentDictionary();
		if (this.settings.spacedReviewShowOverviewRibbonButton) {
			this.overviewRibbonButtonEl = this.addRibbonIcon(
				'calendar-check',
				dictionary.spacedReview.overview.openOverviewRibbonTitle,
				() => {
					void openSpacedReviewOverview(
						this,
						() => this.settings,
						() => this.getSpacedReviewFeature(),
					);
				},
			);
		}

		if (this.settings.spacedReviewShowDailyNoteSyncRibbonButton) {
			this.dailyNoteSyncRibbonButtonEl = this.addRibbonIcon(
				'refresh-cw',
				dictionary.spacedReview.overview.syncDailyNoteRibbonTitle,
				() => {
					void syncSpacedReviewDailyNote(
						this,
						() => this.settings,
						() => this.getSpacedReviewFeature(),
					);
				},
			);
		}
	}

	private clearSpacedReviewRibbonButtons(): void {
		this.overviewRibbonButtonEl?.remove();
		this.dailyNoteSyncRibbonButtonEl?.remove();
		this.overviewRibbonButtonEl = null;
		this.dailyNoteSyncRibbonButtonEl = null;
	}

	private shouldTrackTodayDailyNoteModify(
		file: TAbstractFile | null | undefined,
	): file is TFile {
		if (!(file instanceof TFile) || !this.isMarkdownFile(file)) {
			return false;
		}

		if (
			!this.settings.spacedReviewEnabled ||
			!this.settings.spacedReviewDailyNoteSyncEnabled
		) {
			return false;
		}

		const feature = this.getSpacedReviewFeature();
		if (!feature?.isEnabled()) {
			return false;
		}

		const expectedPath = normalizePath(
			buildDailyNotePath(this.settings, todayIsoDate()),
		);
		return file.path === expectedPath;
	}

	private clearDailyNoteCheckboxImportTimer(): void {
		if (this.dailyNoteCheckboxImportTimer !== null) {
			window.clearTimeout(this.dailyNoteCheckboxImportTimer);
			this.dailyNoteCheckboxImportTimer = null;
		}
	}

	private async runDailyNoteCheckboxImport(path: string): Promise<void> {
		if (this.dailyNoteCheckboxImportInFlight) {
			this.rerunDailyNoteCheckboxImport = true;
			return;
		}

		const feature = this.getSpacedReviewFeature();
		if (!feature?.isEnabled()) {
			return;
		}

		const expectedPath = normalizePath(
			buildDailyNotePath(this.settings, todayIsoDate()),
		);
		if (path !== expectedPath) {
			return;
		}

		this.dailyNoteCheckboxImportInFlight = true;
		try {
			await importCheckedReviewsForToday({
				app: this.app,
				settings: this.settings,
				feature,
				silent: true,
			});
			await feature.refreshOpenOverviewFromExternalChange();
		} catch (error) {
			console.warn(
				'[NestKit] Failed to auto-import checked Daily Note review items.',
				error,
			);
		} finally {
			this.dailyNoteCheckboxImportInFlight = false;
			if (this.rerunDailyNoteCheckboxImport) {
				this.rerunDailyNoteCheckboxImport = false;
				const pendingPath = this.pendingDailyNoteImportPath;
				if (pendingPath) {
					void this.runDailyNoteCheckboxImport(pendingPath);
				}
			}
		}
	}

	private getCurrentDictionary(): NestKitDictionary & {
		spacedReview: {
			overview: {
				openOverviewRibbonTitle: string;
				syncDailyNoteRibbonTitle: string;
				addToSpacedReviewContextMenu: string;
			};
		};
	} {
		return getDictionary(this.settings.uiLanguage) as NestKitDictionary & {
			spacedReview: {
				overview: {
					openOverviewRibbonTitle: string;
					syncDailyNoteRibbonTitle: string;
					addToSpacedReviewContextMenu: string;
				};
			};
		};
	}

	private isMarkdownFile(file: TFile | null | undefined): file is TFile {
		return !!file && file.extension === 'md';
	}
}
