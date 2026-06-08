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
		this.settings = {
			...this.settings,
			[key]: value,
		};

		await this.saveSettings();
		this.applyFeatureSettings();
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
			rememberPinnedState: false,
		};
	}

	private async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
