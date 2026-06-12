export interface FeatureModule {
	enable(): void;
	disable(): void;
	refresh?(): void;
}

export interface FeatureRegistration<
	TSettings,
	TFeature extends FeatureModule = FeatureModule,
> {
	id: string;
	isEnabled: (settings: TSettings) => boolean;
	create: () => TFeature;
	order?: number;
	nameKey?: string;
	descriptionKey?: string;
}
