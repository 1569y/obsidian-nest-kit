import { Plugin } from 'obsidian';
import { FeatureManager } from './core/feature-manager';
import { FeatureRegistry } from './core/feature-registry';
import { migrateSettings } from './core/settings-migration';
import {
	registerSpacedReviewCommands,
} from './features/spaced-review/commands';
import { SpacedReviewFeature } from './features/spaced-review';
import { RightSidebarDrawerFeature } from './features/right-sidebar-drawer';
import {
	DEFAULT_SETTINGS,
	NestKitSettingTab,
	type NestKitSettings,
} from './settings';

export const WORKSPACE_PANEL_SYSTEM_FEATURE_ID = 'workspace-panel-system';
export const SPACED_REVIEW_FEATURE_ID = 'spaced-review';

export default class NestKitPlugin extends Plugin {
	settings: NestKitSettings = {
		...DEFAULT_SETTINGS,
	};
	private settingsPersistenceAllowed = true;
	private hasWarnedAboutBlockedSettingsPersistence = false;
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

		this.applyFeatureSettings();
	}

	onunload(): void {
		this.featureManager.disableAll();
	}

	async updateSetting<K extends keyof NestKitSettings>(
		key: K,
		value: NestKitSettings[K],
	): Promise<void> {
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

	private getSpacedReviewFeature():
		| SpacedReviewFeature
		| undefined {
		return this.featureManager.get<SpacedReviewFeature>(
			SPACED_REVIEW_FEATURE_ID,
		);
	}
}
