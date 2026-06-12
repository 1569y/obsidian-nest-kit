import type { FeatureModule } from './feature-module';
import { FeatureRegistry } from './feature-registry';

export class FeatureManager<TSettings> {
	private readonly instances = new Map<string, FeatureModule>();
	private readonly activeFeatureIds = new Set<string>();

	constructor(private readonly registry: FeatureRegistry<TSettings>) {}

	register<TFeature extends FeatureModule>(parameters: {
		id: string;
		isEnabled: (settings: TSettings) => boolean;
		create: () => TFeature;
		order?: number;
		nameKey?: string;
		descriptionKey?: string;
	}): void {
		this.registry.register(parameters);
	}

	sync(settings: TSettings): void {
		for (const registration of this.registry.getAll()) {
			const instance = this.instances.get(registration.id);
			const enabled = registration.isEnabled(settings);
			const active = this.activeFeatureIds.has(registration.id);

			if (!enabled) {
				if (instance && active) {
					instance.disable();
					this.activeFeatureIds.delete(registration.id);
				}

				continue;
			}

			if (!instance) {
				const createdInstance = registration.create();
				this.instances.set(registration.id, createdInstance);
				createdInstance.enable();
				this.activeFeatureIds.add(registration.id);
				continue;
			}

			if (!active) {
				instance.enable();
				this.activeFeatureIds.add(registration.id);
				continue;
			}

			instance.refresh?.();
		}
	}

	get<TFeature extends FeatureModule = FeatureModule>(
		id: string,
	): TFeature | undefined {
		return this.instances.get(id) as TFeature | undefined;
	}

	disableAll(): void {
		for (const [id, instance] of this.instances) {
			instance.disable();
			this.activeFeatureIds.delete(id);
		}
	}
}
