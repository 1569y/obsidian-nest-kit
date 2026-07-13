import type { DataAdapter, Vault } from 'obsidian';
import { prepareRewardReaderImport } from './import-assembly';
import {
	persistPreparedRewardReaderImport,
	type RewardReaderImportCachePersistenceStatus,
	type RewardReaderImportPersistenceErrorCode,
	type RewardReaderImportPersistenceStage,
	type RewardReaderImportStatePersistenceStatus,
} from './import-persistence-orchestrator';
import { readRewardReaderStateStore } from './read-only-storage-adapter';
import { isSafeRewardReaderId } from './store';
import type {
	RewardReaderChapterIndexCache,
	RewardReaderSourceKind,
	RewardReaderStore,
} from './types';
import { inspectRewardReaderVaultSource } from './vault-source-reader';

export interface RewardReaderImportRuntimeRequest {
	novelId: string;
	sourcePath: string;
	title: string;
	operationAt: string;
	makePrimary: boolean;
}

export type RewardReaderImportRuntimeStage =
	| 'request-validation'
	| 'initial-state-read'
	| 'source-inspection'
	| 'import-preparation'
	| 'persistence';

export type RewardReaderImportRuntimeRequestErrorCode =
	| 'invalid-request-root'
	| 'invalid-novel-id'
	| 'invalid-source-path'
	| 'invalid-title'
	| 'invalid-operation-at'
	| 'invalid-make-primary';

export type RewardReaderImportRuntimeErrorCode =
	| 'invalid-import-request'
	| 'state-read-blocked'
	| 'source-inspection-blocked'
	| 'import-preparation-blocked'
	| 'persistence-runtime-failed'
	| RewardReaderImportPersistenceErrorCode;

export interface RunRewardReaderImportSuccess {
	ok: true;
	status: 'imported';
	novelId: string;
	title: string;
	sourcePath: string;
	sourceKind: RewardReaderSourceKind;
	chapterCount: number;
	ignoredPrefixLength: number;
	store: RewardReaderStore;
	cache: RewardReaderChapterIndexCache;
	cachePersistence: 'reused' | 'written';
	statePersistence: 'written';
	warnings: string[];
}

export interface RunRewardReaderImportFailure {
	ok: false;
	code: RewardReaderImportRuntimeErrorCode;
	stage: RewardReaderImportRuntimeStage;
	causeCode: string | null;
	persistenceStage: RewardReaderImportPersistenceStage | null;
	message: string;
	cachePersistence: RewardReaderImportCachePersistenceStatus;
	statePersistence: RewardReaderImportStatePersistenceStatus;
	warnings: string[];
}

export type RunRewardReaderImportResult =
	| RunRewardReaderImportSuccess
	| RunRewardReaderImportFailure;

type RewardReaderRecord = Record<string, unknown>;

const INVALID_IMPORT_REQUEST_MESSAGE =
	'Reward Reader received an invalid import request.';
const INITIAL_STATE_READ_BLOCKED_MESSAGE =
	'Reward Reader could not establish a safe state baseline for this import.';
const SOURCE_INSPECTION_BLOCKED_MESSAGE =
	'Reward Reader could not inspect the selected novel source.';
const IMPORT_PREPARATION_BLOCKED_MESSAGE =
	'Reward Reader could not prepare the selected novel for import.';
const PERSISTENCE_RUNTIME_FAILED_MESSAGE =
	'Reward Reader could not confirm whether import persistence completed.';

function isPlainObject(value: unknown): value is RewardReaderRecord {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidOperationAt(value: string): boolean {
	const trimmedValue = value.trim();
	return (
		trimmedValue.length > 0 &&
		/^\d{4}-\d{2}-\d{2}T/u.test(trimmedValue) &&
		!Number.isNaN(Date.parse(trimmedValue))
	);
}

function mergeWarnings(...warningGroups: string[][]): string[] {
	const warnings: string[] = [];
	const seenWarnings = new Set<string>();

	for (const group of warningGroups) {
		for (const warning of group) {
			if (seenWarnings.has(warning)) {
				continue;
			}

			seenWarnings.add(warning);
			warnings.push(warning);
		}
	}

	return warnings;
}

function createFailure(
	code: RewardReaderImportRuntimeErrorCode,
	stage: RewardReaderImportRuntimeStage,
	causeCode: RunRewardReaderImportFailure['causeCode'],
	persistenceStage: RewardReaderImportPersistenceStage | null,
	message: string,
	cachePersistence: RewardReaderImportCachePersistenceStatus,
	statePersistence: RewardReaderImportStatePersistenceStatus,
	warnings: string[],
): RunRewardReaderImportFailure {
	return {
		ok: false,
		code,
		stage,
		causeCode,
		persistenceStage,
		message,
		cachePersistence,
		statePersistence,
		warnings,
	};
}

function createPrePersistenceFailure(
	code: RewardReaderImportRuntimeErrorCode,
	stage: Exclude<RewardReaderImportRuntimeStage, 'persistence'>,
	causeCode: RunRewardReaderImportFailure['causeCode'],
	message: string,
	warnings: string[],
): RunRewardReaderImportFailure {
	return createFailure(
		code,
		stage,
		causeCode,
		null,
		message,
		'not-checked',
		'not-attempted',
		warnings,
	);
}

function normalizeImportRuntimeRequest(
	request: unknown,
):
	| { ok: true; request: RewardReaderImportRuntimeRequest }
	| { ok: false; causeCode: RewardReaderImportRuntimeRequestErrorCode } {
	if (!isPlainObject(request)) {
		return {
			ok: false,
			causeCode: 'invalid-request-root',
		};
	}

	if (
		typeof request.novelId !== 'string' ||
		!isSafeRewardReaderId(request.novelId)
	) {
		return {
			ok: false,
			causeCode: 'invalid-novel-id',
		};
	}

	if (
		typeof request.sourcePath !== 'string' ||
		request.sourcePath.trim().length === 0 ||
		request.sourcePath.includes('\0')
	) {
		return {
			ok: false,
			causeCode: 'invalid-source-path',
		};
	}

	if (
		typeof request.title !== 'string' ||
		request.title.trim().length === 0 ||
		request.title.includes('\0') ||
		request.title.includes('\r') ||
		request.title.includes('\n')
	) {
		return {
			ok: false,
			causeCode: 'invalid-title',
		};
	}

	if (
		typeof request.operationAt !== 'string' ||
		!isValidOperationAt(request.operationAt)
	) {
		return {
			ok: false,
			causeCode: 'invalid-operation-at',
		};
	}

	if (typeof request.makePrimary !== 'boolean') {
		return {
			ok: false,
			causeCode: 'invalid-make-primary',
		};
	}

	return {
		ok: true,
		request: {
			novelId: request.novelId,
			sourcePath: request.sourcePath,
			title: request.title.trim(),
			operationAt: request.operationAt.trim(),
			makePrimary: request.makePrimary,
		},
	};
}

export async function runRewardReaderImport(
	vault: Vault,
	adapter: DataAdapter,
	request: RewardReaderImportRuntimeRequest,
): Promise<RunRewardReaderImportResult> {
	const normalizedRequest = normalizeImportRuntimeRequest(request);
	if (!normalizedRequest.ok) {
		return createPrePersistenceFailure(
			'invalid-import-request',
			'request-validation',
			normalizedRequest.causeCode,
			INVALID_IMPORT_REQUEST_MESSAGE,
			[],
		);
	}

	let stateRead: Awaited<ReturnType<typeof readRewardReaderStateStore>>;
	try {
		stateRead = await readRewardReaderStateStore(adapter);
	} catch {
		return createPrePersistenceFailure(
			'state-read-blocked',
			'initial-state-read',
			null,
			INITIAL_STATE_READ_BLOCKED_MESSAGE,
			[],
		);
	}

	if (!stateRead.ok) {
		return createPrePersistenceFailure(
			'state-read-blocked',
			'initial-state-read',
			stateRead.code,
			INITIAL_STATE_READ_BLOCKED_MESSAGE,
			mergeWarnings(stateRead.warnings),
		);
	}

	const runtimeRequest = normalizedRequest.request;
	let inspection: Awaited<ReturnType<typeof inspectRewardReaderVaultSource>>;
	try {
		inspection = await inspectRewardReaderVaultSource(vault, {
			novelId: runtimeRequest.novelId,
			sourcePath: runtimeRequest.sourcePath,
			generatedAt: runtimeRequest.operationAt,
		});
	} catch {
		return createPrePersistenceFailure(
			'source-inspection-blocked',
			'source-inspection',
			null,
			SOURCE_INSPECTION_BLOCKED_MESSAGE,
			mergeWarnings(stateRead.warnings),
		);
	}

	if (!inspection.ok) {
		return createPrePersistenceFailure(
			'source-inspection-blocked',
			'source-inspection',
			inspection.code,
			SOURCE_INSPECTION_BLOCKED_MESSAGE,
			mergeWarnings(stateRead.warnings, inspection.warnings),
		);
	}

	let prepared: ReturnType<typeof prepareRewardReaderImport>;
	try {
		prepared = prepareRewardReaderImport({
			existingStore: stateRead.store,
			inspection,
			title: runtimeRequest.title,
			preparedAt: runtimeRequest.operationAt,
			makePrimary: runtimeRequest.makePrimary,
		});
	} catch {
		return createPrePersistenceFailure(
			'import-preparation-blocked',
			'import-preparation',
			null,
			IMPORT_PREPARATION_BLOCKED_MESSAGE,
			mergeWarnings(stateRead.warnings, inspection.warnings),
		);
	}

	if (!prepared.ok) {
		return createPrePersistenceFailure(
			'import-preparation-blocked',
			'import-preparation',
			prepared.code,
			IMPORT_PREPARATION_BLOCKED_MESSAGE,
			mergeWarnings(stateRead.warnings, inspection.warnings, prepared.warnings),
		);
	}

	let persistence: Awaited<ReturnType<typeof persistPreparedRewardReaderImport>>;
	try {
		persistence = await persistPreparedRewardReaderImport(adapter, prepared);
	} catch {
		return createFailure(
			'persistence-runtime-failed',
			'persistence',
			null,
			null,
			PERSISTENCE_RUNTIME_FAILED_MESSAGE,
			'write-outcome-unknown',
			'write-outcome-unknown',
			mergeWarnings(stateRead.warnings, inspection.warnings, prepared.warnings),
		);
	}

	if (!persistence.ok) {
		return createFailure(
			persistence.code,
			'persistence',
			persistence.causeCode,
			persistence.stage,
			persistence.message,
			persistence.cachePersistence,
			persistence.statePersistence,
			mergeWarnings(
				stateRead.warnings,
				inspection.warnings,
				prepared.warnings,
				persistence.warnings,
			),
		);
	}

	return {
		ok: true,
		status: 'imported',
		novelId: prepared.payload.novel.id,
		title: prepared.payload.novel.title,
		sourcePath: prepared.payload.novel.sourcePath,
		sourceKind: prepared.payload.novel.sourceKind,
		chapterCount: inspection.chapterCount,
		ignoredPrefixLength: inspection.ignoredPrefixLength,
		store: persistence.store,
		cache: persistence.cache,
		cachePersistence: persistence.cachePersistence,
		statePersistence: persistence.statePersistence,
		warnings: mergeWarnings(
			stateRead.warnings,
			inspection.warnings,
			prepared.warnings,
			persistence.warnings,
		),
	};
}
