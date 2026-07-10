import type { FeatureModule } from '../../core/feature-module';

export class RewardReaderFeature implements FeatureModule {
	private enabled = false;

	enable(): void {
		this.enabled = true;
	}

	disable(): void {
		this.enabled = false;
	}

	isEnabled(): boolean {
		return this.enabled;
	}
}
