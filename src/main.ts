import { Plugin } from 'obsidian';
import { FeatureManager } from './core/feature-manager';
import { FeatureRegistry } from './core/feature-registry';
import { RightSidebarDrawerFeature } from './features/right-sidebar-drawer';
import {
	DEFAULT_SETTINGS,
	NestKitSettingTab,
	type NestKitSettings,
} from './settings';

export const WORKSPACE_PANEL_SYSTEM_FEATURE_ID = 'workspace-panel-system';

export default class NestKitPlugin extends Plugin {
	settings: NestKitSettings = DEFAULT_SETTINGS;
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

	private applyFeatureSettings(): void {
		this.featureManager.sync(this.settings);
	}

	private async loadSettings(): Promise<void> {
		const persistedSettings =
			(await this.loadData()) as Partial<NestKitSettings> | null;

		this.settings = {
			...DEFAULT_SETTINGS,
			...persistedSettings,
		};
	}

	private async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private getRightSidebarDrawerFeature():
		| RightSidebarDrawerFeature
		| undefined {
		return this.featureManager.get<RightSidebarDrawerFeature>(
			WORKSPACE_PANEL_SYSTEM_FEATURE_ID,
		);
	}
}
