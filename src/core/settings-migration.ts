import type { NestKitLanguage } from '../i18n';
import type {
	HeadingProgressDisplayMode,
	HeadingProgressSource,
} from '../features/heading-progress/types';
import type { RewardReaderReadingMode } from '../features/reward-reader/types';
import { DEFAULT_REVIEW_PRESET_ID } from '../features/spaced-review/presets';
import type {
	CompletedOccurrenceDisplay,
	DailyNoteSyncMode,
	OverduePolicy,
	ScheduleMode,
	TargetLinkOpenMode,
} from '../features/spaced-review/types';
import type { NestKitSettings } from '../settings';
import {
	CURRENT_SETTINGS_SCHEMA_VERSION,
	DEFAULT_SETTINGS,
	NUMERIC_SETTING_LIMITS,
} from '../settings';

export interface SettingsMigrationResult {
	settings: NestKitSettings;
	didMigrate: boolean;
	didNormalize: boolean;
	shouldPersist: boolean;
	hasUnsupportedFutureVersion: boolean;
	warnings: string[];
}

type SettingsRecord = Record<string, unknown>;
type KnownSettingsKey = keyof NestKitSettings;
type RewardReaderIntegerSettingKey =
	| 'rewardReaderMinutesPerUnit'
	| 'rewardReaderChaptersPerUnit'
	| 'rewardReaderDailyUnlockCap'
	| 'rewardReaderUnreadInventoryCap';

type SchemaVersionState =
	| {
			kind: 'missing';
	  }
	| {
			kind: 'legacy';
			value: number;
	  }
	| {
			kind: 'current';
			value: number;
	  }
	| {
			kind: 'future';
			value: number;
	  }
	| {
			kind: 'invalid';
			value: unknown;
	  };

interface NormalizationState {
	settings: NestKitSettings;
	changed: boolean;
	invalidFieldWarnings: string[];
}

const LANGUAGE_VALUES = new Set<NestKitLanguage>(['zh-CN', 'en']);
const COMPLETED_DISPLAY_VALUES = new Set<CompletedOccurrenceDisplay>([
	'remove',
	'keepChecked',
]);
const OVERDUE_POLICY_VALUES = new Set<OverduePolicy>(['carryOver', 'skip']);
const SCHEDULE_MODE_VALUES = new Set<ScheduleMode>([
	'fixedTimeline',
	'rollingTimeline',
]);
const DAILY_NOTE_SYNC_MODE_VALUES = new Set<DailyNoteSyncMode>([
	'manualOnly',
	'onOverviewOpen',
]);
const TARGET_LINK_OPEN_MODE_VALUES = new Set<TargetLinkOpenMode>([
	'current',
	'newTab',
]);
const HEADING_PROGRESS_SOURCE_VALUES = new Set<HeadingProgressSource>([
	'viewport-center',
	'cursor-position',
]);
const HEADING_PROGRESS_DISPLAY_MODE_VALUES =
	new Set<HeadingProgressDisplayMode>([
		'bar-and-percent',
		'percent-only',
		'bar-only',
	]);
const REWARD_READER_READING_MODE_VALUES = new Set<RewardReaderReadingMode>([
	'continuous',
	'single-chapter',
]);
const BUILT_IN_PRESET_IDS = new Set<string>([
	'fast-review',
	'standard-review',
	'long-term-memory',
]);
const KNOWN_SETTINGS_KEYS = new Set<KnownSettingsKey>(
	Object.keys(DEFAULT_SETTINGS) as KnownSettingsKey[],
);

function createDefaultSettings(): NestKitSettings {
	return {
		...DEFAULT_SETTINGS,
	};
}

export function migrateSettings(raw: unknown): SettingsMigrationResult {
	if (raw === undefined || raw === null) {
		return {
			settings: createDefaultSettings(),
			didMigrate: false,
			didNormalize: false,
			shouldPersist: false,
			hasUnsupportedFutureVersion: false,
			warnings: [],
		};
	}

	if (!isPlainRecord(raw)) {
		return {
			settings: createDefaultSettings(),
			didMigrate: false,
			didNormalize: true,
			shouldPersist: true,
			hasUnsupportedFutureVersion: false,
			warnings: ['Raw settings data is invalid; falling back to defaults.'],
		};
	}

	const schemaVersionState = readSchemaVersion(raw.schemaVersion);

	if (schemaVersionState.kind === 'future') {
		const normalizationState = normalizeSettings(
			raw,
			schemaVersionState.value,
		);

		return {
			settings: normalizationState.settings,
			didMigrate: false,
			didNormalize: normalizationState.changed,
			shouldPersist: false,
			hasUnsupportedFutureVersion: true,
			warnings: [
				`Unsupported future settings schema version ${schemaVersionState.value}; using recognized settings fields at runtime without overwriting stored data.`,
				...normalizationState.invalidFieldWarnings,
				...readUnknownFieldWarnings(raw),
			],
		};
	}

	if (schemaVersionState.kind === 'current') {
		const normalizationState = normalizeSettings(
			raw,
			CURRENT_SETTINGS_SCHEMA_VERSION,
		);

		return {
			settings: normalizationState.settings,
			didMigrate: false,
			didNormalize: normalizationState.changed,
			shouldPersist: normalizationState.changed,
			hasUnsupportedFutureVersion: false,
			warnings: [
				...normalizationState.invalidFieldWarnings,
				...readUnknownFieldWarnings(raw),
			],
		};
	}

	if (schemaVersionState.kind === 'missing') {
		const normalizationState = normalizeSettings(
			raw,
			CURRENT_SETTINGS_SCHEMA_VERSION,
		);

		return {
			settings: normalizationState.settings,
			didMigrate: true,
			didNormalize: true,
			shouldPersist: true,
			hasUnsupportedFutureVersion: false,
			warnings: [
				'Legacy settings without schemaVersion were migrated from schema 0 to schema 1.',
				...normalizationState.invalidFieldWarnings,
				...readUnknownFieldWarnings(raw),
			],
		};
	}

	if (schemaVersionState.kind === 'legacy') {
		const normalizationState = normalizeSettings(
			raw,
			CURRENT_SETTINGS_SCHEMA_VERSION,
		);

		return {
			settings: normalizationState.settings,
			didMigrate: true,
			didNormalize: true,
			shouldPersist: true,
			hasUnsupportedFutureVersion: false,
			warnings: [
				`Legacy settings schema version ${schemaVersionState.value} was migrated to schema 1.`,
				...normalizationState.invalidFieldWarnings,
				...readUnknownFieldWarnings(raw),
			],
		};
	}

	const normalizationState = normalizeSettings(
		raw,
		CURRENT_SETTINGS_SCHEMA_VERSION,
	);

	return {
		settings: normalizationState.settings,
		didMigrate: true,
		didNormalize: true,
		shouldPersist: true,
		hasUnsupportedFutureVersion: false,
		warnings: [
			`Invalid settings schemaVersion (${String(schemaVersionState.value)}) was normalized to schema 1.`,
			...normalizationState.invalidFieldWarnings,
			...readUnknownFieldWarnings(raw),
		],
	};
}

function normalizeSettings(
	raw: SettingsRecord,
	schemaVersion: number,
): NormalizationState {
	const invalidFieldWarnings: string[] = [];
	let changed = false;

	const settings: NestKitSettings = {
		schemaVersion,
		uiLanguage: readLanguage(
			raw,
			'uiLanguage',
			DEFAULT_SETTINGS.uiLanguage,
			invalidFieldWarnings,
		),
		rightSidebarDrawerEnabled: readBoolean(
			raw,
			'rightSidebarDrawerEnabled',
			DEFAULT_SETTINGS.rightSidebarDrawerEnabled,
			invalidFieldWarnings,
		),
		rightSidebarPinButtonEnabled: readBoolean(
			raw,
			'rightSidebarPinButtonEnabled',
			DEFAULT_SETTINGS.rightSidebarPinButtonEnabled,
			invalidFieldWarnings,
		),
		rememberPinnedState: readBoolean(
			raw,
			'rememberPinnedState',
			DEFAULT_SETTINGS.rememberPinnedState,
			invalidFieldWarnings,
		),
		rightSidebarPinned: readBoolean(
			raw,
			'rightSidebarPinned',
			DEFAULT_SETTINGS.rightSidebarPinned,
			invalidFieldWarnings,
		),
		rightSidebarDrawerTopPx: readFiniteNumberInRange(
			raw,
			'rightSidebarDrawerTopPx',
			DEFAULT_SETTINGS.rightSidebarDrawerTopPx,
			invalidFieldWarnings,
		),
		rightSidebarDrawerBottomGapPx: readFiniteNumberInRange(
			raw,
			'rightSidebarDrawerBottomGapPx',
			DEFAULT_SETTINGS.rightSidebarDrawerBottomGapPx,
			invalidFieldWarnings,
		),
		rightSidebarDrawerRightOffsetPx: readFiniteNumberInRange(
			raw,
			'rightSidebarDrawerRightOffsetPx',
			DEFAULT_SETTINGS.rightSidebarDrawerRightOffsetPx,
			invalidFieldWarnings,
		),
		rightSidebarDrawerWidthPx: readFiniteNumberInRange(
			raw,
			'rightSidebarDrawerWidthPx',
			DEFAULT_SETTINGS.rightSidebarDrawerWidthPx,
			invalidFieldWarnings,
		),
		rightSidebarDrawerHeightVh: readFiniteNumberInRange(
			raw,
			'rightSidebarDrawerHeightVh',
			DEFAULT_SETTINGS.rightSidebarDrawerHeightVh,
			invalidFieldWarnings,
		),
		rightSidebarEdgeTriggerWidthPx: readFiniteNumberInRange(
			raw,
			'rightSidebarEdgeTriggerWidthPx',
			DEFAULT_SETTINGS.rightSidebarEdgeTriggerWidthPx,
			invalidFieldWarnings,
		),
		rightSidebarCollapseDelayMs: readFiniteNumberInRange(
			raw,
			'rightSidebarCollapseDelayMs',
			DEFAULT_SETTINGS.rightSidebarCollapseDelayMs,
			invalidFieldWarnings,
		),
		rightSidebarAnimationDurationMs: readFiniteNumberInRange(
			raw,
			'rightSidebarAnimationDurationMs',
			DEFAULT_SETTINGS.rightSidebarAnimationDurationMs,
			invalidFieldWarnings,
		),
		rightSidebarTopControlOffsetPx: readFiniteNumberInRange(
			raw,
			'rightSidebarTopControlOffsetPx',
			DEFAULT_SETTINGS.rightSidebarTopControlOffsetPx,
			invalidFieldWarnings,
		),
		rightSidebarPinTopPx: readFiniteNumberInRange(
			raw,
			'rightSidebarPinTopPx',
			DEFAULT_SETTINGS.rightSidebarPinTopPx,
			invalidFieldWarnings,
		),
		rightSidebarPinRightPx: readFiniteNumberInRange(
			raw,
			'rightSidebarPinRightPx',
			DEFAULT_SETTINGS.rightSidebarPinRightPx,
			invalidFieldWarnings,
		),
		enableHeadingProgress: readBoolean(
			raw,
			'enableHeadingProgress',
			DEFAULT_SETTINGS.enableHeadingProgress,
			invalidFieldWarnings,
		),
		headingProgressSource: readEnumSetting(
			raw,
			'headingProgressSource',
			DEFAULT_SETTINGS.headingProgressSource,
			HEADING_PROGRESS_SOURCE_VALUES,
			invalidFieldWarnings,
		),
		headingProgressDisplayMode: readEnumSetting(
			raw,
			'headingProgressDisplayMode',
			DEFAULT_SETTINGS.headingProgressDisplayMode,
			HEADING_PROGRESS_DISPLAY_MODE_VALUES,
			invalidFieldWarnings,
		),
		hideHeadingProgressWhenNoHeading: readBoolean(
			raw,
			'hideHeadingProgressWhenNoHeading',
			DEFAULT_SETTINGS.hideHeadingProgressWhenNoHeading,
			invalidFieldWarnings,
		),
		enableRewardReader: readBoolean(
			raw,
			'enableRewardReader',
			DEFAULT_SETTINGS.enableRewardReader,
			invalidFieldWarnings,
		),
		rewardReaderMinutesPerUnit: readRewardReaderIntegerInRange(
			raw,
			'rewardReaderMinutesPerUnit',
			DEFAULT_SETTINGS.rewardReaderMinutesPerUnit,
			invalidFieldWarnings,
		),
		rewardReaderChaptersPerUnit: readRewardReaderIntegerInRange(
			raw,
			'rewardReaderChaptersPerUnit',
			DEFAULT_SETTINGS.rewardReaderChaptersPerUnit,
			invalidFieldWarnings,
		),
		rewardReaderCarryOverMinutes: readBoolean(
			raw,
			'rewardReaderCarryOverMinutes',
			DEFAULT_SETTINGS.rewardReaderCarryOverMinutes,
			invalidFieldWarnings,
		),
		rewardReaderDailyUnlockCap: readRewardReaderIntegerInRange(
			raw,
			'rewardReaderDailyUnlockCap',
			DEFAULT_SETTINGS.rewardReaderDailyUnlockCap,
			invalidFieldWarnings,
		),
		rewardReaderUnreadInventoryCap: readRewardReaderIntegerInRange(
			raw,
			'rewardReaderUnreadInventoryCap',
			DEFAULT_SETTINGS.rewardReaderUnreadInventoryCap,
			invalidFieldWarnings,
		),
		rewardReaderRequireStudyContent: readBoolean(
			raw,
			'rewardReaderRequireStudyContent',
			DEFAULT_SETTINGS.rewardReaderRequireStudyContent,
			invalidFieldWarnings,
		),
		rewardReaderDefaultReadingMode: readEnumSetting(
			raw,
			'rewardReaderDefaultReadingMode',
			DEFAULT_SETTINGS.rewardReaderDefaultReadingMode,
			REWARD_READER_READING_MODE_VALUES,
			invalidFieldWarnings,
		),
		spacedReviewEnabled: readBoolean(
			raw,
			'spacedReviewEnabled',
			DEFAULT_SETTINGS.spacedReviewEnabled,
			invalidFieldWarnings,
		),
		spacedReviewDailyNoteSyncEnabled: readBoolean(
			raw,
			'spacedReviewDailyNoteSyncEnabled',
			DEFAULT_SETTINGS.spacedReviewDailyNoteSyncEnabled,
			invalidFieldWarnings,
		),
		spacedReviewDailyNoteFolder: readString(
			raw,
			'spacedReviewDailyNoteFolder',
			DEFAULT_SETTINGS.spacedReviewDailyNoteFolder,
			invalidFieldWarnings,
		),
		spacedReviewDailyNoteDateFormat: readString(
			raw,
			'spacedReviewDailyNoteDateFormat',
			DEFAULT_SETTINGS.spacedReviewDailyNoteDateFormat,
			invalidFieldWarnings,
		),
		spacedReviewDailyNoteSectionHeading: readString(
			raw,
			'spacedReviewDailyNoteSectionHeading',
			readString(
				raw,
				'spacedReviewManagedBlockHeading' as KnownSettingsKey,
				DEFAULT_SETTINGS.spacedReviewDailyNoteSectionHeading,
				[],
			),
			invalidFieldWarnings,
		),
		spacedReviewDailyNoteSectionPath: readString(
			raw,
			'spacedReviewDailyNoteSectionPath',
			readString(
				raw,
				'spacedReviewDailyNoteSectionHeading',
				readString(
					raw,
					'spacedReviewManagedBlockHeading' as KnownSettingsKey,
					DEFAULT_SETTINGS.spacedReviewDailyNoteSectionPath,
					[],
				),
				[],
			),
			invalidFieldWarnings,
		),
		spacedReviewDailyNoteCreateIfMissing: readBoolean(
			raw,
			'spacedReviewDailyNoteCreateIfMissing',
			DEFAULT_SETTINGS.spacedReviewDailyNoteCreateIfMissing,
			invalidFieldWarnings,
		),
		spacedReviewDailyNoteSyncMode: readEnumSetting(
			raw,
			'spacedReviewDailyNoteSyncMode',
			DEFAULT_SETTINGS.spacedReviewDailyNoteSyncMode,
			DAILY_NOTE_SYNC_MODE_VALUES,
			invalidFieldWarnings,
		),
		spacedReviewDefaultPresetId: readBuiltInPresetId(
			raw,
			'spacedReviewDefaultPresetId',
			DEFAULT_SETTINGS.spacedReviewDefaultPresetId,
			invalidFieldWarnings,
		),
		spacedReviewIncludeTodayAsFirstReview: readBoolean(
			raw,
			'spacedReviewIncludeTodayAsFirstReview',
			DEFAULT_SETTINGS.spacedReviewIncludeTodayAsFirstReview,
			invalidFieldWarnings,
		),
		spacedReviewCustomPresets: readString(
			raw,
			'spacedReviewCustomPresets',
			DEFAULT_SETTINGS.spacedReviewCustomPresets,
			invalidFieldWarnings,
		),
		spacedReviewTargetLinkOpenMode: readEnumSetting(
			raw,
			'spacedReviewTargetLinkOpenMode',
			DEFAULT_SETTINGS.spacedReviewTargetLinkOpenMode,
			TARGET_LINK_OPEN_MODE_VALUES,
			invalidFieldWarnings,
		),
		spacedReviewDailyNoteLinksUseOpenMode: readBoolean(
			raw,
			'spacedReviewDailyNoteLinksUseOpenMode',
			DEFAULT_SETTINGS.spacedReviewDailyNoteLinksUseOpenMode,
			invalidFieldWarnings,
		),
		spacedReviewCompletedOccurrenceDisplay: readEnumSetting(
			raw,
			'spacedReviewCompletedOccurrenceDisplay',
			DEFAULT_SETTINGS.spacedReviewCompletedOccurrenceDisplay,
			COMPLETED_DISPLAY_VALUES,
			invalidFieldWarnings,
		),
		spacedReviewOverduePolicy: readEnumSetting(
			raw,
			'spacedReviewOverduePolicy',
			DEFAULT_SETTINGS.spacedReviewOverduePolicy,
			OVERDUE_POLICY_VALUES,
			invalidFieldWarnings,
		),
		spacedReviewScheduleMode: readEnumSetting(
			raw,
			'spacedReviewScheduleMode',
			DEFAULT_SETTINGS.spacedReviewScheduleMode,
			SCHEDULE_MODE_VALUES,
			invalidFieldWarnings,
		),
		spacedReviewShowOverdueBadge: readBoolean(
			raw,
			'spacedReviewShowOverdueBadge',
			DEFAULT_SETTINGS.spacedReviewShowOverdueBadge,
			invalidFieldWarnings,
		),
		spacedReviewShowGroupJumpChips: readBoolean(
			raw,
			'spacedReviewShowGroupJumpChips',
			DEFAULT_SETTINGS.spacedReviewShowGroupJumpChips,
			invalidFieldWarnings,
		),
		spacedReviewShowArchivedView: readBoolean(
			raw,
			'spacedReviewShowArchivedView',
			DEFAULT_SETTINGS.spacedReviewShowArchivedView,
			invalidFieldWarnings,
		),
		spacedReviewShowOverviewRibbonButton: readBoolean(
			raw,
			'spacedReviewShowOverviewRibbonButton',
			DEFAULT_SETTINGS.spacedReviewShowOverviewRibbonButton,
			invalidFieldWarnings,
		),
		spacedReviewShowDailyNoteSyncRibbonButton: readBoolean(
			raw,
			'spacedReviewShowDailyNoteSyncRibbonButton',
			DEFAULT_SETTINGS.spacedReviewShowDailyNoteSyncRibbonButton,
			invalidFieldWarnings,
		),
		spacedReviewShowEditorContextMenuItem: readBoolean(
			raw,
			'spacedReviewShowEditorContextMenuItem',
			DEFAULT_SETTINGS.spacedReviewShowEditorContextMenuItem,
			invalidFieldWarnings,
		),
	};

	if (raw.schemaVersion !== schemaVersion) {
		changed = true;
	}

	for (const key of Object.keys(settings) as KnownSettingsKey[]) {
		if (!Object.is(raw[key], settings[key])) {
			changed = true;
		}
	}

	if (readUnknownFieldWarnings(raw).length > 0) {
		changed = true;
	}

	return {
		settings,
		changed,
		invalidFieldWarnings,
	};
}

function isPlainRecord(value: unknown): value is SettingsRecord {
	if (typeof value !== 'object' || value === null) {
		return false;
	}

	const prototype: unknown = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function readBoolean(
	raw: SettingsRecord,
	key: KnownSettingsKey,
	defaultValue: boolean,
	warnings: string[],
): boolean {
	const value = raw[key];

	if (value === undefined) {
		return defaultValue;
	}

	if (typeof value === 'boolean') {
		return value;
	}

	warnings.push(
		`Settings field "${key}" must be a boolean; falling back to default.`,
	);
	return defaultValue;
}

function readFiniteNumberInRange(
	raw: SettingsRecord,
	key: keyof typeof NUMERIC_SETTING_LIMITS,
	defaultValue: number,
	warnings: string[],
): number {
	const value = raw[key];

	if (value === undefined) {
		return defaultValue;
	}

	if (typeof value !== 'number' || !Number.isFinite(value)) {
		warnings.push(
			`Settings field "${key}" must be a finite number; falling back to default.`,
		);
		return defaultValue;
	}

	const limit = NUMERIC_SETTING_LIMITS[key];
	if (value < limit.min || value > limit.max) {
		warnings.push(
			`Settings field "${key}" is outside the supported range ${limit.min}..${limit.max}; falling back to default.`,
		);
		return defaultValue;
	}

	return value;
}

function readRewardReaderIntegerInRange(
	raw: SettingsRecord,
	key: RewardReaderIntegerSettingKey,
	defaultValue: number,
	warnings: string[],
): number {
	const value = raw[key];

	if (value === undefined) {
		return defaultValue;
	}

	if (typeof value !== 'number' || !Number.isFinite(value)) {
		warnings.push(
			`Settings field "${key}" must be a finite number; falling back to default.`,
		);
		return defaultValue;
	}

	if (!Number.isInteger(value)) {
		warnings.push(
			`Settings field "${key}" must be an integer; falling back to default.`,
		);
		return defaultValue;
	}

	const limit = NUMERIC_SETTING_LIMITS[key];
	if (value < limit.min || value > limit.max) {
		warnings.push(
			`Settings field "${key}" is outside the supported range ${limit.min}..${limit.max}; falling back to default.`,
		);
		return defaultValue;
	}

	return value;
}

function readLanguage(
	raw: SettingsRecord,
	key: KnownSettingsKey,
	defaultValue: NestKitLanguage,
	warnings: string[],
): NestKitLanguage {
	const value = raw[key];

	if (value === undefined) {
		return defaultValue;
	}

	if (typeof value === 'string' && LANGUAGE_VALUES.has(value as NestKitLanguage)) {
		return value as NestKitLanguage;
	}

	warnings.push(
		`Settings field "${key}" is not a supported language; falling back to default.`,
	);
	return defaultValue;
}

function readString(
	raw: SettingsRecord,
	key: KnownSettingsKey,
	defaultValue: string,
	warnings: string[],
): string {
	const value = raw[key];

	if (value === undefined) {
		return defaultValue;
	}

	if (typeof value === 'string') {
		return value;
	}

	warnings.push(
		`Settings field "${key}" must be a string; falling back to default.`,
	);
	return defaultValue;
}

function readBuiltInPresetId(
	raw: SettingsRecord,
	key: KnownSettingsKey,
	defaultValue: string,
	warnings: string[],
): string {
	const value = raw[key];

	if (value === undefined) {
		return defaultValue;
	}

	if (typeof value === 'string' && BUILT_IN_PRESET_IDS.has(value)) {
		return value;
	}

	warnings.push(
		`Settings field "${key}" must be a supported built-in preset id; falling back to default.`,
	);
	return DEFAULT_REVIEW_PRESET_ID;
}

function readEnumSetting<T extends string>(
	raw: SettingsRecord,
	key: KnownSettingsKey,
	defaultValue: T,
	allowedValues: ReadonlySet<T>,
	warnings: string[],
): T {
	const value = raw[key];

	if (value === undefined) {
		return defaultValue;
	}

	if (typeof value === 'string' && allowedValues.has(value as T)) {
		return value as T;
	}

	warnings.push(
		`Settings field "${key}" must use a supported value; falling back to default.`,
	);
	return defaultValue;
}

function readSchemaVersion(value: unknown): SchemaVersionState {
	if (value === undefined) {
		return {
			kind: 'missing',
		};
	}

	if (
		typeof value !== 'number' ||
		!Number.isFinite(value) ||
		!Number.isInteger(value) ||
		value < 0
	) {
		return {
			kind: 'invalid',
			value,
		};
	}

	if (value > CURRENT_SETTINGS_SCHEMA_VERSION) {
		return {
			kind: 'future',
			value,
		};
	}

	if (value === CURRENT_SETTINGS_SCHEMA_VERSION) {
		return {
			kind: 'current',
			value,
		};
	}

	return {
		kind: 'legacy',
		value,
	};
}

function readUnknownFieldWarnings(raw: SettingsRecord): string[] {
	const unknownKeys = Object.keys(raw).filter(
		(key) => !KNOWN_SETTINGS_KEYS.has(key as KnownSettingsKey),
	);

	if (unknownKeys.length === 0) {
		return [];
	}

	return [
		`Ignored unknown settings fields: ${unknownKeys.sort().join(', ')}.`,
	];
}
