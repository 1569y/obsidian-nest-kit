import type { FeatureModule, FeatureRegistration } from './feature-module';

export class FeatureRegistry<TSettings> {
	private readonly registrations = new Map<
		string,
		FeatureRegistration<TSettings>
	>();

	register<TFeature extends FeatureModule>(
		registration: FeatureRegistration<TSettings, TFeature>,
	): void {
		if (this.registrations.has(registration.id)) {
			throw new Error(
				`NestKit feature registration already exists: ${registration.id}`,
			);
		}

		this.registrations.set(registration.id, registration);
	}

	get(id: string): FeatureRegistration<TSettings> | undefined {
		return this.registrations.get(id);
	}

	getAll(): FeatureRegistration<TSettings>[] {
		return [...this.registrations.values()].sort((left, right) => {
			const leftOrder = left.order ?? Number.MAX_SAFE_INTEGER;
			const rightOrder = right.order ?? Number.MAX_SAFE_INTEGER;

			if (leftOrder !== rightOrder) {
				return leftOrder - rightOrder;
			}

			return left.id.localeCompare(right.id);
		});
	}
}
