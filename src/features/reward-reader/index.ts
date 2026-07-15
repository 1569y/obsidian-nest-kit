import type { FeatureModule } from '../../core/feature-module';
import type NestKitPlugin from '../../main';
import type { NestKitSettings } from '../../settings';
import {
	registerRewardReaderImportCommand,
	type RewardReaderImportCommandControl,
} from './import-command';
import {
	cloneRewardReaderPendingStudyExchange,
	registerRewardReaderStudyCommand,
	type RewardReaderPendingStudyExchange,
	type RewardReaderStudyCommandControl,
	type RewardReaderStudyExchangeModalHost,
} from './study-exchange-modal';

export class RewardReaderFeature implements FeatureModule {
	private enabled = false;
	private importCommandControl: RewardReaderImportCommandControl | null = null;
	private studyCommandControl: RewardReaderStudyCommandControl | null = null;
	private pendingStudyExchange: RewardReaderPendingStudyExchange | null = null;
	private studySessionToken = 0;

	constructor(
		private readonly plugin: NestKitPlugin,
		private readonly getSettings: () => NestKitSettings,
	) {}

	enable(): void {
		this.enabled = true;
		this.studySessionToken += 1;
		this.ensureCommandsRegistered();
	}

	disable(): void {
		this.enabled = false;
		this.studySessionToken += 1;
		this.pendingStudyExchange = null;
		this.importCommandControl?.closeActiveModal();
		this.studyCommandControl?.closeActiveModal();
	}

	isEnabled(): boolean {
		return this.enabled;
	}

	private ensureCommandsRegistered(): void {
		if (!this.importCommandControl) {
			this.importCommandControl = registerRewardReaderImportCommand(
				this.plugin,
				this.getSettings,
				() => this.enabled,
			);
		}

		if (this.studyCommandControl) {
			return;
		}

		const studyHost: RewardReaderStudyExchangeModalHost = {
			adapter: this.plugin.app.vault.adapter,
			getPendingStudyExchange: () =>
				cloneRewardReaderPendingStudyExchange(this.pendingStudyExchange),
			replacePendingStudyExchange: (sessionToken, pending) => {
				if (
					!this.enabled ||
					sessionToken !== this.studySessionToken
				) {
					return;
				}

				this.pendingStudyExchange =
					cloneRewardReaderPendingStudyExchange(pending);
			},
			isSessionCurrent: (sessionToken) =>
				this.enabled && sessionToken === this.studySessionToken,
		};

		this.studyCommandControl = registerRewardReaderStudyCommand(
			this.plugin,
			this.getSettings,
			() => this.enabled,
			studyHost,
			() => this.studySessionToken,
		);
	}
}
