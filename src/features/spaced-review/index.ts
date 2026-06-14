import type { Plugin } from 'obsidian';
import type { FeatureModule } from '../../core/feature-module';
import type { NestKitSettings } from '../../settings';
import {
	createDefaultSpacedReviewStore,
	readSpacedReviewStore,
	upsertReviewTask,
	writeSpacedReviewStore,
	type SpacedReviewStorageAdapter,
} from './store';
import { createReviewTask, type CreateReviewTaskInput } from './task-factory';
import { VaultSpacedReviewStorageAdapter } from './vault-storage-adapter';
import type { ReviewTask } from './types';

export class SpacedReviewFeature implements FeatureModule {
	private enabled = false;
	private storageAdapter?: SpacedReviewStorageAdapter;

	constructor(
		private readonly plugin: Plugin,
		private readonly getSettings: () => NestKitSettings,
	) {}

	enable(): void {
		if (this.enabled) {
			return;
		}

		this.enabled = true;
		this.storageAdapter ??= new VaultSpacedReviewStorageAdapter(this.plugin.app.vault);
	}

	disable(): void {
		this.enabled = false;
	}

	refresh(): void {
		void this.getSettings();
	}

	isEnabled(): boolean {
		return this.enabled;
	}

	getStorageAdapter(): SpacedReviewStorageAdapter {
		this.storageAdapter ??= new VaultSpacedReviewStorageAdapter(this.plugin.app.vault);
		return this.storageAdapter;
	}

	async createTaskFromInput(input: CreateReviewTaskInput): Promise<ReviewTask> {
		const result = createReviewTask(input);
		const adapter = this.getStorageAdapter();
		const readResult = await readSpacedReviewStore(adapter);

		if (
			readResult.hasUnsupportedFutureVersion ||
			(readResult.shouldPersist === false && readResult.warnings.length > 0)
		) {
			throw new Error(
				'Spaced Review store is not safe to overwrite in the current plugin version.',
			);
		}

		const currentStore = readResult.store ?? createDefaultSpacedReviewStore();
		const nextStore = upsertReviewTask(currentStore, result.task);

		await writeSpacedReviewStore(adapter, nextStore);
		return result.task;
	}
}
