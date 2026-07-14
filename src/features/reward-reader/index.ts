import type { FeatureModule } from '../../core/feature-module';
import type NestKitPlugin from '../../main';
import type { NestKitSettings } from '../../settings';
import {
	registerRewardReaderImportCommand,
	type RewardReaderImportCommandControl,
} from './import-command';

export class RewardReaderFeature implements FeatureModule {
	private enabled = false;
	private commandControl: RewardReaderImportCommandControl | null = null;

	constructor(
		private readonly plugin: NestKitPlugin,
		private readonly getSettings: () => NestKitSettings,
	) {}

	enable(): void {
		this.enabled = true;
		this.ensureCommandRegistered();
	}

	disable(): void {
		this.enabled = false;
		this.commandControl?.closeActiveModal();
	}

	isEnabled(): boolean {
		return this.enabled;
	}

	private ensureCommandRegistered(): void {
		if (this.commandControl) {
			return;
		}

		this.commandControl = registerRewardReaderImportCommand(
			this.plugin,
			this.getSettings,
			() => this.enabled,
		);
	}
}
