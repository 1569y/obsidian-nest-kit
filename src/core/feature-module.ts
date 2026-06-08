export interface FeatureModule {
	enable(): void;
	disable(): void;
	refresh?(): void;
}
