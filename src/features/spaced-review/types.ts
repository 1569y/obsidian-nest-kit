export const SPACED_REVIEW_STORE_SCHEMA_VERSION = 1;

export type SpacedReviewStoreSchemaVersion =
	typeof SPACED_REVIEW_STORE_SCHEMA_VERSION;

export type ReviewTaskStatus = 'active' | 'paused' | 'archived';

export type ReviewOccurrenceStatus =
	| 'pending'
	| 'overdue'
	| 'completed'
	| 'skipped';

export type CompletedOccurrenceDisplay = 'remove' | 'keepChecked';

export type OverduePolicy = 'carryOver' | 'skip';

export type ScheduleMode = 'fixedTimeline' | 'rollingTimeline';

export interface ReviewTask {
	id: string;
	title: string;
	createdAt: string;
	updatedAt: string;
	startDate: string;
	presetId: string;
	intervalsSnapshot: number[];
	status: ReviewTaskStatus;
	completedSequenceIndexes: number[];
	skippedSequenceIndexes: number[];
	rollingAnchorDate?: string;
	completedOccurrenceDisplayOverride?: CompletedOccurrenceDisplay;
	overduePolicyOverride?: OverduePolicy;
	scheduleModeOverride?: ScheduleMode;
}

export interface ReviewOccurrence {
	occurrenceId: string;
	taskId: string;
	sequenceIndex: number;
	plannedDate: string;
	effectiveDate: string;
	status: ReviewOccurrenceStatus;
	sourceIntervalDays: number;
	isOverdue: boolean;
	dailyNoteDate: string;
	completedAt?: string;
	skippedAt?: string;
}

export interface ReviewPreset {
	id: string;
	labelKey: string;
	intervals: number[];
	builtIn: boolean;
	editable: boolean;
	deletable: boolean;
	schemaVersion: SpacedReviewStoreSchemaVersion;
}

export interface SpacedReviewStore {
	schemaVersion: SpacedReviewStoreSchemaVersion;
	tasks: ReviewTask[];
	updatedAt: string;
}
