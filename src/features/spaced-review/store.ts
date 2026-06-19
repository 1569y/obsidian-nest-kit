import { isIsoDateString } from './dates';
import { validateReviewIntervals } from './intervals';
import {
	SPACED_REVIEW_STORE_SCHEMA_VERSION,
	type CompletedOccurrenceDisplay,
	type OverduePolicy,
	type ReviewTask,
	type ReviewTaskStatus,
	type ScheduleMode,
	type SpacedReviewStore,
} from './types';

export interface SpacedReviewStorageAdapter {
	readText(path: string): Promise<string | null>;
	writeText(path: string, content: string): Promise<void>;
	ensureFolder(path: string): Promise<void>;
}

export const SPACED_REVIEW_STORE_FOLDER = '.nestkit/spaced-review';
export const SPACED_REVIEW_STORE_PATH = `${SPACED_REVIEW_STORE_FOLDER}/tasks.json`;

export interface SpacedReviewStoreNormalizationResult {
	store: SpacedReviewStore;
	didNormalize: boolean;
	shouldPersist: boolean;
	hasUnsupportedFutureVersion: boolean;
	warnings: string[];
}

interface IntegerListNormalizationResult {
	values: number[];
	didNormalize: boolean;
	warnings: string[];
}

const TASK_STATUSES: ReviewTaskStatus[] = ['active', 'paused', 'archived'];
const COMPLETED_DISPLAY_VALUES: CompletedOccurrenceDisplay[] = [
	'remove',
	'keepChecked',
];
const OVERDUE_POLICIES: OverduePolicy[] = ['carryOver', 'skip'];
const SCHEDULE_MODES: ScheduleMode[] = ['fixedTimeline', 'rollingTimeline'];

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cloneTask(task: ReviewTask): ReviewTask {
	return {
		...task,
		groupPath: task.groupPath ? [...task.groupPath] : undefined,
		intervalsSnapshot: [...task.intervalsSnapshot],
		completedSequenceIndexes: [...task.completedSequenceIndexes],
		skippedSequenceIndexes: [...task.skippedSequenceIndexes],
		completedDatesBySequenceIndex: task.completedDatesBySequenceIndex
			? { ...task.completedDatesBySequenceIndex }
			: undefined,
		skippedDatesBySequenceIndex: task.skippedDatesBySequenceIndex
			? { ...task.skippedDatesBySequenceIndex }
			: undefined,
	};
}

function normalizeOptionalTrimmedTextField(
	input: unknown,
	label: string,
	taskId: string,
): {
	value: string | undefined;
	didNormalize: boolean;
	warnings: string[];
} {
	if (input === undefined) {
		return {
			value: undefined,
			didNormalize: false,
			warnings: [],
		};
	}

	if (typeof input !== 'string') {
		return {
			value: undefined,
			didNormalize: true,
			warnings: [
				`Spaced Review task "${taskId}" has an invalid ${label}; it was removed.`,
			],
		};
	}

	const normalizedValue = input.trim();
	const didNormalize = normalizedValue !== input || normalizedValue.length === 0;

	return {
		value: normalizedValue.length > 0 ? normalizedValue : undefined,
		didNormalize,
		warnings: didNormalize
			? [
					`Spaced Review task "${taskId}" normalized ${label} to a trimmed non-empty string when present.`,
				]
			: [],
	};
}

function normalizeOptionalNoteField(
	input: unknown,
	taskId: string,
): {
	value: string | undefined;
	didNormalize: boolean;
	warnings: string[];
} {
	if (input === undefined) {
		return {
			value: undefined,
			didNormalize: false,
			warnings: [],
		};
	}

	if (typeof input !== 'string') {
		return {
			value: undefined,
			didNormalize: true,
			warnings: [
				`Spaced Review task "${taskId}" has an invalid note; it was removed.`,
			],
		};
	}

	const normalizedValue = input.replace(/\r\n?/g, '\n').trim();
	const didNormalize = normalizedValue !== input || normalizedValue.length === 0;

	return {
		value: normalizedValue.length > 0 ? normalizedValue : undefined,
		didNormalize,
		warnings: didNormalize
			? [
					`Spaced Review task "${taskId}" normalized note to trimmed text when present.`,
				]
			: [],
	};
}

function normalizeGroupPath(
	input: unknown,
	taskId: string,
): {
	values: string[] | undefined;
	didNormalize: boolean;
	warnings: string[];
} {
	if (input === undefined) {
		return {
			values: undefined,
			didNormalize: false,
			warnings: [],
		};
	}

	if (!Array.isArray(input)) {
		return {
			values: undefined,
			didNormalize: true,
			warnings: [
				`Spaced Review task "${taskId}" has an invalid groupPath; it was removed.`,
			],
		};
	}

	let didNormalize = false;
	const normalizeSegment = (value: unknown): string => {
		if (typeof value !== 'string') {
			if (value !== undefined) {
				didNormalize = true;
			}
			return '';
		}

		const normalizedValue = value.trim().replace(/\s+/g, ' ');
		if (normalizedValue !== value) {
			didNormalize = true;
		}

		if (normalizedValue.length === 0) {
			didNormalize = true;
		}

		return normalizedValue;
	};

	const groupSegment = normalizeSegment(input[0]);
	const subgroupSegment = normalizeSegment(input[1]);

	if (groupSegment.length === 0 && subgroupSegment.length > 0) {
		didNormalize = true;
	}

	for (let index = 2; index < input.length; index += 1) {
		if (input[index] !== undefined) {
			didNormalize = true;
		}
	}

	const normalizedValues =
		groupSegment.length === 0
			? undefined
			: subgroupSegment.length > 0
				? [groupSegment, subgroupSegment]
				: [groupSegment];

	return {
		values: normalizedValues,
		didNormalize,
		warnings: didNormalize
			? [
					`Spaced Review task "${taskId}" normalized groupPath to at most two non-empty text levels.`,
				]
			: [],
	};
}

function normalizeActionDateMap(
	input: unknown,
	label: string,
	taskId: string,
	allowedIndexes: number[],
): {
	values: Record<string, string> | undefined;
	didNormalize: boolean;
	warnings: string[];
} {
	if (input === undefined) {
		return {
			values: undefined,
			didNormalize: false,
			warnings: [],
		};
	}

	if (!isPlainObject(input)) {
		return {
			values: undefined,
			didNormalize: true,
			warnings: [
				`Spaced Review task "${taskId}" has an invalid ${label}; it was removed.`,
			],
		};
	}

	const allowedIndexSet = new Set(allowedIndexes);
	const normalizedValues: Record<string, string> = {};
	const warnings: string[] = [];
	let didNormalize = false;

	for (const [key, value] of Object.entries(input)) {
		const sequenceIndex = Number(key);
		if (
			!Number.isInteger(sequenceIndex) ||
			sequenceIndex < 0 ||
			String(sequenceIndex) !== key ||
			!allowedIndexSet.has(sequenceIndex)
		) {
			didNormalize = true;
			continue;
		}

		if (typeof value !== 'string' || !isIsoDateString(value)) {
			didNormalize = true;
			continue;
		}

		normalizedValues[key] = value;
	}

	if (didNormalize) {
		warnings.push(
			`Spaced Review task "${taskId}" normalized ${label} to valid sequence-index date entries only.`,
		);
	}

	return {
		values:
			Object.keys(normalizedValues).length > 0 ? normalizedValues : undefined,
		didNormalize,
		warnings,
	};
}

function normalizeNonNegativeIntegerList(
	input: unknown,
	label: string,
	taskId: string,
): IntegerListNormalizationResult {
	if (input === undefined) {
		return {
			values: [],
			didNormalize: true,
			warnings: [],
		};
	}

	if (!Array.isArray(input)) {
		return {
			values: [],
			didNormalize: true,
			warnings: [
				`Spaced Review task "${taskId}" has an invalid ${label}; falling back to an empty list.`,
			],
		};
	}

	const values: number[] = [];
	const warnings: string[] = [];
	let didNormalize = false;
	let sawInvalidEntry = false;

	for (const entry of input) {
		if (typeof entry !== 'number' || !Number.isInteger(entry) || entry < 0) {
			sawInvalidEntry = true;
			continue;
		}

		values.push(entry);
	}

	if (sawInvalidEntry) {
		didNormalize = true;
		warnings.push(
			`Spaced Review task "${taskId}" has an invalid ${label}; falling back to valid non-negative indexes only.`,
		);
	}

	const deduplicatedValues = [...new Set(values)];
	if (deduplicatedValues.length !== values.length) {
		didNormalize = true;
		warnings.push(
			`Spaced Review task "${taskId}" has duplicate ${label}; duplicate indexes were removed.`,
		);
	}

	const normalizedValues = [...deduplicatedValues].sort(
		(left, right) => left - right,
	);
	const orderChanged = normalizedValues.some(
		(value, index) => value !== deduplicatedValues[index],
	);

	if (orderChanged) {
		didNormalize = true;
		warnings.push(
			`Spaced Review task "${taskId}" has unsorted ${label}; indexes were sorted in ascending order.`,
		);
	}

	return {
		values: normalizedValues,
		didNormalize,
		warnings,
	};
}

function readEnumValue<T extends string>(
	value: unknown,
	allowed: readonly T[],
): T | undefined {
	return typeof value === 'string' && allowed.includes(value as T)
		? (value as T)
		: undefined;
}

function normalizeReviewTask(
	raw: unknown,
	taskIndex: number,
): {
	task?: ReviewTask;
	didNormalize: boolean;
	warnings: string[];
} {
	const warnings: string[] = [];
	let didNormalize = false;

	if (!isPlainObject(raw)) {
		return {
			didNormalize: true,
			warnings: [
				`Spaced Review task at index ${taskIndex} is invalid and was discarded.`,
			],
		};
	}

	const record = raw;
	const id = typeof record.id === 'string' && record.id.trim().length > 0
		? record.id
		: undefined;

	if (!id) {
		return {
			didNormalize: true,
			warnings: [
				`Spaced Review task at index ${taskIndex} is missing a valid id and was discarded.`,
			],
		};
	}

	const title =
		typeof record.title === 'string' && record.title.trim().length > 0
			? record.title
			: undefined;
	const createdAt =
		typeof record.createdAt === 'string' && record.createdAt.length > 0
			? record.createdAt
			: undefined;
	const updatedAt =
		typeof record.updatedAt === 'string' && record.updatedAt.length > 0
			? record.updatedAt
			: undefined;
	const startDate =
		typeof record.startDate === 'string' && isIsoDateString(record.startDate)
			? record.startDate
			: undefined;
	const presetId =
		typeof record.presetId === 'string' && record.presetId.trim().length > 0
			? record.presetId
			: undefined;
	const status = readEnumValue(record.status, TASK_STATUSES);
	const intervalValidation = validateReviewIntervals(record.intervalsSnapshot);

	if (
		!title ||
		!createdAt ||
		!updatedAt ||
		!startDate ||
		!presetId ||
		!status ||
		intervalValidation.intervals.length === 0
	) {
		const validationWarnings = [...intervalValidation.warnings];
		return {
			didNormalize: true,
			warnings: [
				`Spaced Review task "${id}" is invalid and was discarded.`,
				...validationWarnings,
			],
		};
	}

	if (intervalValidation.warnings.length > 0) {
		didNormalize = true;
		warnings.push(
			`Spaced Review task "${id}" normalized its interval snapshot.`,
			...intervalValidation.warnings,
		);
	}

	const groupPathResult = normalizeGroupPath(record.groupPath, id);
	if (groupPathResult.didNormalize) {
		didNormalize = true;
	}
	warnings.push(...groupPathResult.warnings);

	const noteResult = normalizeOptionalNoteField(record.note, id);
	if (noteResult.didNormalize) {
		didNormalize = true;
	}
	warnings.push(...noteResult.warnings);

	const targetLinkResult = normalizeOptionalTrimmedTextField(
		record.targetLink,
		'targetLink',
		id,
	);
	if (targetLinkResult.didNormalize) {
		didNormalize = true;
	}
	warnings.push(...targetLinkResult.warnings);

	const completedSequenceIndexesResult = normalizeNonNegativeIntegerList(
		record.completedSequenceIndexes,
		'completedSequenceIndexes',
		id,
	);
	const skippedSequenceIndexesResult = normalizeNonNegativeIntegerList(
		record.skippedSequenceIndexes,
		'skippedSequenceIndexes',
		id,
	);
	const allowedCompletedIndexes = completedSequenceIndexesResult.values.filter(
		(index) => index < intervalValidation.intervals.length,
	);
	const allowedSkippedIndexes = skippedSequenceIndexesResult.values.filter(
		(index) => index < intervalValidation.intervals.length,
	);

	if (
		allowedCompletedIndexes.length !== completedSequenceIndexesResult.values.length
	) {
		didNormalize = true;
		warnings.push(
			`Spaced Review task "${id}" removed out-of-range completedSequenceIndexes.`,
		);
	}

	if (allowedSkippedIndexes.length !== skippedSequenceIndexesResult.values.length) {
		didNormalize = true;
		warnings.push(
			`Spaced Review task "${id}" removed out-of-range skippedSequenceIndexes.`,
		);
	}

	if (completedSequenceIndexesResult.didNormalize) {
		didNormalize = true;
	}

	if (skippedSequenceIndexesResult.didNormalize) {
		didNormalize = true;
	}

	warnings.push(
		...completedSequenceIndexesResult.warnings,
		...skippedSequenceIndexesResult.warnings,
	);

	const overlappingSequenceIndexes = allowedSkippedIndexes.filter((index) =>
		allowedCompletedIndexes.includes(index),
	);
	const normalizedSkippedIndexes = allowedSkippedIndexes.filter(
		(index) => !allowedCompletedIndexes.includes(index),
	);

	if (overlappingSequenceIndexes.length > 0) {
		didNormalize = true;
		warnings.push(
			`Spaced Review task "${id}" had overlapping completed and skipped sequence indexes; completed indexes were kept and overlapping skipped indexes were removed.`,
		);
	}

	const completedDatesBySequenceIndexResult = normalizeActionDateMap(
		record.completedDatesBySequenceIndex,
		'completedDatesBySequenceIndex',
		id,
		allowedCompletedIndexes,
	);
	const skippedDatesBySequenceIndexResult = normalizeActionDateMap(
		record.skippedDatesBySequenceIndex,
		'skippedDatesBySequenceIndex',
		id,
		normalizedSkippedIndexes,
	);

	if (completedDatesBySequenceIndexResult.didNormalize) {
		didNormalize = true;
	}

	if (skippedDatesBySequenceIndexResult.didNormalize) {
		didNormalize = true;
	}

	warnings.push(
		...completedDatesBySequenceIndexResult.warnings,
		...skippedDatesBySequenceIndexResult.warnings,
	);

	const rollingAnchorDate =
		typeof record.rollingAnchorDate === 'string'
			? record.rollingAnchorDate
			: undefined;
	const normalizedRollingAnchorDate =
		rollingAnchorDate && isIsoDateString(rollingAnchorDate)
			? rollingAnchorDate
			: undefined;

	if (rollingAnchorDate !== undefined && normalizedRollingAnchorDate === undefined) {
		didNormalize = true;
		warnings.push(
			`Spaced Review task "${id}" has an invalid rollingAnchorDate and it was removed.`,
		);
	}

	const completedOccurrenceDisplayOverride = readEnumValue(
		record.completedOccurrenceDisplayOverride,
		COMPLETED_DISPLAY_VALUES,
	);
	if (
		record.completedOccurrenceDisplayOverride !== undefined &&
		completedOccurrenceDisplayOverride === undefined
	) {
		didNormalize = true;
		warnings.push(
			`Spaced Review task "${id}" has an invalid completedOccurrenceDisplayOverride and it was removed.`,
		);
	}

	const overduePolicyOverride = readEnumValue(
		record.overduePolicyOverride,
		OVERDUE_POLICIES,
	);
	if (
		record.overduePolicyOverride !== undefined &&
		overduePolicyOverride === undefined
	) {
		didNormalize = true;
		warnings.push(
			`Spaced Review task "${id}" has an invalid overduePolicyOverride and it was removed.`,
		);
	}

	const scheduleModeOverride = readEnumValue(
		record.scheduleModeOverride,
		SCHEDULE_MODES,
	);
	if (
		record.scheduleModeOverride !== undefined &&
		scheduleModeOverride === undefined
	) {
		didNormalize = true;
		warnings.push(
			`Spaced Review task "${id}" has an invalid scheduleModeOverride and it was removed.`,
		);
	}

	const task: ReviewTask = {
		id,
		title,
		createdAt,
		updatedAt,
		groupPath: groupPathResult.values,
		note: noteResult.value,
		targetLink: targetLinkResult.value,
		startDate,
		presetId,
		intervalsSnapshot: [...intervalValidation.intervals],
		status,
		completedSequenceIndexes: allowedCompletedIndexes,
		skippedSequenceIndexes: normalizedSkippedIndexes,
		completedDatesBySequenceIndex:
			completedDatesBySequenceIndexResult.values,
		skippedDatesBySequenceIndex: skippedDatesBySequenceIndexResult.values,
		rollingAnchorDate: normalizedRollingAnchorDate,
		completedOccurrenceDisplayOverride,
		overduePolicyOverride,
		scheduleModeOverride,
	};

	return {
		task,
		didNormalize,
		warnings,
	};
}

export function createDefaultSpacedReviewStore(): SpacedReviewStore {
	return {
		schemaVersion: SPACED_REVIEW_STORE_SCHEMA_VERSION,
		tasks: [],
		updatedAt: new Date().toISOString(),
	};
}

export function normalizeSpacedReviewStore(
	raw: unknown,
): SpacedReviewStoreNormalizationResult {
	const defaultStore = createDefaultSpacedReviewStore();
	const warnings: string[] = [];
	let didNormalize = false;
	let shouldPersist = false;
	let hasUnsupportedFutureVersion = false;

	const markNormalized = (): void => {
		didNormalize = true;
		if (!hasUnsupportedFutureVersion) {
			shouldPersist = true;
		}
	};

	if (!isPlainObject(raw)) {
		return {
			store: defaultStore,
			didNormalize: true,
			shouldPersist: true,
			hasUnsupportedFutureVersion: false,
			warnings: ['Spaced Review store is invalid; falling back to defaults.'],
		};
	}

	const record = raw;

	if (
		typeof record.schemaVersion === 'number' &&
		Number.isInteger(record.schemaVersion) &&
		record.schemaVersion > SPACED_REVIEW_STORE_SCHEMA_VERSION
	) {
		hasUnsupportedFutureVersion = true;
		didNormalize = true;
		warnings.push('Spaced Review store schemaVersion was normalized to 4.');
		warnings.push(
			`Unsupported future Spaced Review store schemaVersion ${String(record.schemaVersion)} was detected; runtime will read known fields without persisting changes.`,
		);
	} else if (record.schemaVersion !== SPACED_REVIEW_STORE_SCHEMA_VERSION) {
		markNormalized();
		warnings.push('Spaced Review store schemaVersion was normalized to 4.');
	}

	const tasks: ReviewTask[] = [];
	const rawTasks = Array.isArray(record.tasks) ? record.tasks : [];

	if (!Array.isArray(record.tasks)) {
		markNormalized();
		warnings.push('Spaced Review store tasks was normalized to an empty array.');
	}

	for (let index = 0; index < rawTasks.length; index += 1) {
		const normalizedTask = normalizeReviewTask(rawTasks[index], index);
		if (normalizedTask.didNormalize) {
			markNormalized();
		}
		warnings.push(...normalizedTask.warnings);

		if (normalizedTask.task) {
			tasks.push(normalizedTask.task);
		}
	}

	const updatedAt =
		typeof record.updatedAt === 'string' && record.updatedAt.length > 0
			? record.updatedAt
			: defaultStore.updatedAt;

	if (typeof record.updatedAt !== 'string' || record.updatedAt.length === 0) {
		markNormalized();
		warnings.push('Spaced Review store updatedAt was normalized.');
	}

	return {
		store: {
			schemaVersion: SPACED_REVIEW_STORE_SCHEMA_VERSION,
			tasks,
			updatedAt,
		},
		didNormalize,
		shouldPersist,
		hasUnsupportedFutureVersion,
		warnings,
	};
}

export async function readSpacedReviewStore(
	adapter: SpacedReviewStorageAdapter,
): Promise<SpacedReviewStoreNormalizationResult> {
	const text = await adapter.readText(SPACED_REVIEW_STORE_PATH);

	if (text === null) {
		return {
			store: createDefaultSpacedReviewStore(),
			didNormalize: false,
			shouldPersist: false,
			hasUnsupportedFutureVersion: false,
			warnings: [],
		};
	}

	try {
		return normalizeSpacedReviewStore(JSON.parse(text) as unknown);
	} catch {
		return {
			store: createDefaultSpacedReviewStore(),
			didNormalize: true,
			shouldPersist: false,
			hasUnsupportedFutureVersion: false,
			warnings: [
				'Spaced Review store JSON is invalid; falling back to defaults.',
			],
		};
	}
}

export async function writeSpacedReviewStore(
	adapter: SpacedReviewStorageAdapter,
	store: SpacedReviewStore,
): Promise<void> {
	const normalized = normalizeSpacedReviewStore(store).store;

	await adapter.ensureFolder(SPACED_REVIEW_STORE_FOLDER);
	await adapter.writeText(
		SPACED_REVIEW_STORE_PATH,
		`${JSON.stringify(normalized, null, 2)}\n`,
	);
}

export function upsertReviewTask(
	store: SpacedReviewStore,
	task: ReviewTask,
): SpacedReviewStore {
	const nextTasks = store.tasks.map(cloneTask);
	const nextTask = cloneTask(task);
	const existingIndex = nextTasks.findIndex((entry) => entry.id === task.id);

	if (existingIndex >= 0) {
		nextTasks[existingIndex] = nextTask;
	} else {
		nextTasks.push(nextTask);
	}

	return {
		...store,
		tasks: nextTasks,
		updatedAt: task.updatedAt,
	};
}

export function removeReviewTask(
	store: SpacedReviewStore,
	taskId: string,
): SpacedReviewStore {
	return {
		...store,
		tasks: store.tasks
			.filter((task) => task.id !== taskId)
			.map(cloneTask),
		updatedAt: new Date().toISOString(),
	};
}
