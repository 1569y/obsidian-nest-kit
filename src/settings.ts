import { App, PluginSettingTab, Setting } from 'obsidian';
import type NestKitPlugin from './main';

export interface NestKitSettings {
	rightSidebarDrawerEnabled: boolean;
	rightSidebarPinButtonEnabled: boolean;
	rememberPinnedState: boolean;
}

export const DEFAULT_SETTINGS: NestKitSettings = {
	rightSidebarDrawerEnabled: false,
	rightSidebarPinButtonEnabled: true,
	rememberPinnedState: false,
};

export class NestKitSettingTab extends PluginSettingTab {
	plugin: NestKitPlugin;

	constructor(app: App, plugin: NestKitPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Enable right sidebar hover drawer')
			.setDesc(
				'Turn the hover drawer behavior on or off for the right sidebar.',
			)
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
			.setName('Show pin button')
			.setDesc(
				'Show or hide the pin button inside the right sidebar header.',
			)
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
			.setName('Remember pinned state')
			.setDesc(
				'Planned. Pinned state does not persist across restarts in version 0.1.0.',
			)
			.addToggle((toggle) =>
				toggle
					.setValue(false)
					.setDisabled(true),
			);
	}
}
