import { normalizePath, type Vault } from 'obsidian';
import type { SpacedReviewStorageAdapter } from './store';

function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}

	return String(error);
}

function isMissingPathError(error: unknown): boolean {
	const message = getErrorMessage(error).toLowerCase();
	return (
		message.includes('enoent') ||
		message.includes('not found') ||
		message.includes('no such file') ||
		message.includes('does not exist')
	);
}

function isAlreadyExistsError(error: unknown): boolean {
	const message = getErrorMessage(error).toLowerCase();
	return (
		message.includes('already exists') ||
		message.includes('folder already exists') ||
		message.includes('eexist')
	);
}

export class VaultSpacedReviewStorageAdapter
	implements SpacedReviewStorageAdapter
{
	constructor(private readonly vault: Vault) {}

	async readText(path: string): Promise<string | null> {
		const normalizedPath = normalizePath(path);
		const adapter = this.vault.adapter;

		if (!(await adapter.exists(normalizedPath))) {
			return null;
		}

		try {
			return await adapter.read(normalizedPath);
		} catch (error) {
			if (isMissingPathError(error)) {
				return null;
			}

			throw error;
		}
	}

	async writeText(path: string, content: string): Promise<void> {
		const normalizedPath = normalizePath(path);
		await this.vault.adapter.write(normalizedPath, content);
	}

	async ensureFolder(path: string): Promise<void> {
		if (path.trim().length === 0) {
			return;
		}

		const normalizedPath = normalizePath(path);
		if (normalizedPath.length === 0) {
			return;
		}

		const adapter = this.vault.adapter;
		const segments = normalizedPath.split('/');
		let currentPath = '';

		for (const segment of segments) {
			currentPath = currentPath.length > 0 ? `${currentPath}/${segment}` : segment;

			const existingStat = await adapter.stat(currentPath);
			if (existingStat) {
				if (existingStat.type !== 'folder') {
					throw new Error(
						`Cannot create folder because a file exists at "${currentPath}".`,
					);
				}

				continue;
			}

			if (await adapter.exists(currentPath)) {
				continue;
			}

			try {
				await adapter.mkdir(currentPath);
			} catch (error) {
				if (isAlreadyExistsError(error) && (await adapter.exists(currentPath))) {
					continue;
				}

				throw error;
			}
		}
	}
}
