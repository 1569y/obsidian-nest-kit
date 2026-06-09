import { Plugin } from 'obsidian';
import { RightSidebarDrawerFeature } from './features/right-sidebar-drawer';
import {
	DEFAULT_SETTINGS,
	NestKitSettingTab,
	type NestKitSettings,
} from './settings';

export default class NestKitPlugin extends Plugin {
	settings: NestKitSettings = DEFAULT_SETTINGS;
	private rightSidebarDrawerFeature?: RightSidebarDrawerFeature;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.rightSidebarDrawerFeature = new RightSidebarDrawerFeature(this);
		this.addSettingTab(new NestKitSettingTab(this.app, this));

		this.applyFeatureSettings();
	}

	onunload(): void {
		this.rightSidebarDrawerFeature?.disable();
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
			enabled && this.rightSidebarDrawerFeature?.isRuntimePinned()
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

		this.rightSidebarDrawerFeature?.refresh();
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
			this.rightSidebarDrawerFeature?.clearRuntimePinnedState();
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
		this.rightSidebarDrawerFeature?.clearRuntimePinnedState();
		this.applyFeatureSettings();
	}

	refreshSidebarFeature(): void {
		this.rightSidebarDrawerFeature?.refresh();
	}

	private applyFeatureSettings(): void {
		if (!this.rightSidebarDrawerFeature) {
			return;
		}

		if (this.settings.rightSidebarDrawerEnabled) {
			this.rightSidebarDrawerFeature.enable();
			return;
		}

		this.rightSidebarDrawerFeature.disable();
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
}
