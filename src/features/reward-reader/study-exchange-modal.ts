import { Modal, Notice, Platform, Setting, type App, type DataAdapter } from 'obsidian';
import type NestKitPlugin from '../../main';
import type { NestKitSettings } from '../../settings';
import {
	readRewardReaderStateStore,
	type ReadRewardReaderStateStoreResult,
} from './read-only-storage-adapter';
import { isSafeRewardReaderId } from './store';
import {
	DEFAULT_REWARD_READER_MINUTES_PER_CHAPTER,
	type RewardReaderStudyExchangePolicy,
} from './study-exchange-engine';
import {
	runRewardReaderStudyExchange,
	type RewardReaderStudyExchangeRuntimeRequest,
} from './study-exchange-runtime';
import {
	runRewardReaderStudyReplayRecovery,
} from './study-exchange-replay-runtime';

export const REWARD_READER_RECORD_STUDY_COMMAND_ID =
	'reward-reader-record-study';

export type RewardReaderPendingStudyExchangeState =
	| 'needs-check'
	| 'not-observed'
	| 'blocked';

export interface RewardReaderPendingStudyExchange {
	request: RewardReaderStudyExchangeRuntimeRequest;
	state: RewardReaderPendingStudyExchangeState;
}

export interface RewardReaderStudyExchangeModalHost {
	adapter: DataAdapter;
	getPendingStudyExchange(): RewardReaderPendingStudyExchange | null;
	replacePendingStudyExchange(
		sessionToken: number,
		pending: RewardReaderPendingStudyExchange | null,
	): void;
	isSessionCurrent(sessionToken: number): boolean;
}

export interface RewardReaderStudyCommandControl {
	closeActiveModal(): void;
	hasActiveModal(): boolean;
	isOperationBusy(): boolean;
}

interface RewardReaderStudyExchangeModalOptions {
	getSettings: () => NestKitSettings;
	host: RewardReaderStudyExchangeModalHost;
	sessionToken: number;
	onClose: () => void;
	onBusyChange?: (busy: boolean) => void;
	runStudyExchange?: typeof runRewardReaderStudyExchange;
	runReplayRecovery?: typeof runRewardReaderStudyReplayRecovery;
	readStateStore?: typeof readRewardReaderStateStore;
	createNotice?: (message: string) => void;
	createStudyRecordId?: () => string;
	createUnlockRecordId?: () => string;
	createOccurredAt?: () => string;
}

interface RewardReaderStudyStrings {
	commandName: string;
	duplicateModalNotice: string;
	modalTitle: string;
	loadingNovels: string;
	noImportedNovels: string;
	stateReadFailed: string;
	localStateUnavailable: string;
	novelField: string;
	studyMinutesField: string;
	studyMinutesPlaceholder: string;
	noteField: string;
	notePlaceholder: string;
	policyField: string;
	policySummary: string;
	statusField: string;
	readyToSave: string;
	saving: string;
	saveButton: string;
	closeButton: string;
	selectNovelFirst: string;
	invalidStudyMinutes: string;
	invalidNote: string;
	identityGenerationFailed: string;
	successNotice: (
		studyMinutes: number,
		unlockedChapterCount: number,
		balanceAfter: number,
	) => string;
	successNoticeWithWarnings: (
		studyMinutes: number,
		unlockedChapterCount: number,
		balanceAfter: number,
	) => string;
	pendingHeading: string;
	pendingIdentityReuse: string;
	pendingMinutesSummary: (minutes: number) => string;
	pendingNotePresent: string;
	pendingNoteMissing: string;
	checkSavedResultButton: string;
	checkAgainButton: string;
	retryExactRequestButton: string;
	checkingSavedResult: string;
	retryingExactRequest: string;
	uncertainSaveMessage: string;
	duplicateIdentityMessage: string;
	notObservedMessage: string;
	blockedMessage: string;
	localStateRecoveryMessage: string;
	pendingPreserveFailedMessage: string;
	localStateUpdateFailedMessage: string;
	savedButLocalStateNotClearedMessage: string;
	discardPendingButton: string;
	confirmDiscardButton: string;
	discardWarning: string;
	discardedNotice: string;
}

interface RewardReaderImportedNovelOption {
	id: string;
	title: string;
}

type RewardReaderStudyModalView =
	| 'loading'
	| 'load-failed'
	| 'local-state-failed'
	| 'empty'
	| 'form'
	| 'recovery';

type RewardReaderRecoveryHint =
	| 'none'
	| 'uncertain-save'
	| 'duplicate-identity'
	| 'not-observed'
	| 'blocked'
	| 'local-state-failed';

interface RewardReaderPendingReadSuccess {
	ok: true;
	pending: RewardReaderPendingStudyExchange | null;
}

interface RewardReaderPendingReadFailure {
	ok: false;
}

type RewardReaderPendingReadResult =
	| RewardReaderPendingReadSuccess
	| RewardReaderPendingReadFailure;

type RewardReaderStudyUiResultClassification =
	| {
			kind: 'persisted';
			studyMinutes: number;
			unlockedChapterCount: number;
			balanceAfter: number;
			hasWarnings: boolean;
	  }
	| {
			kind: 'write-outcome-unknown';
	  }
	| {
			kind: 'duplicate-identity';
	  }
	| {
			kind: 'definite-failure';
			message: string;
	  }
	| {
			kind: 'malformed';
	  };

type RewardReaderReplayUiResultClassification =
	| {
			kind: 'replay-confirmed';
			studyMinutes: number;
			unlockedChapterCount: number;
			balanceAfter: number;
			hasWarnings: boolean;
	  }
	| {
			kind: 'not-observed';
	  }
	| {
			kind: 'blocked';
			message: string | null;
	  }
	| {
			kind: 'malformed';
	  };

const FIXED_REWARD_READER_STUDY_POLICY: RewardReaderStudyExchangePolicy = {
	minutesPerChapter: DEFAULT_REWARD_READER_MINUTES_PER_CHAPTER,
	maxChaptersPerStudyRecord: null,
	maxChaptersPerUtcDate: null,
};

function getRewardReaderStudyStrings(
	uiLanguage: NestKitSettings['uiLanguage'],
): RewardReaderStudyStrings {
	if (uiLanguage.toLowerCase() === 'zh-cn') {
		return {
			commandName:
				'\u5956\u52b1\u9605\u8bfb\u5668\uff1a\u8bb0\u5f55\u5b66\u4e60\u65f6\u95f4',
			duplicateModalNotice:
				'\u5b66\u4e60\u8bb0\u5f55\u7a97\u53e3\u5df2\u6253\u5f00\u3002',
			modalTitle: '\u8bb0\u5f55\u5b66\u4e60\u65f6\u95f4',
			loadingNovels:
				'\u6b63\u5728\u52a0\u8f7d\u5df2\u5bfc\u5165\u7684\u5c0f\u8bf4...',
			noImportedNovels:
				'\u8fd8\u6ca1\u6709\u53ef\u7528\u7684\u5df2\u5bfc\u5165\u5c0f\u8bf4\u3002',
			stateReadFailed:
				'Reward Reader \u65e0\u6cd5\u52a0\u8f7d\u5df2\u5bfc\u5165\u5c0f\u8bf4\u5217\u8868\u3002',
			localStateUnavailable:
				'Reward Reader \u65e0\u6cd5\u8bbf\u95ee\u672c\u5730\u6062\u590d\u72b6\u6001\u3002',
			novelField: '\u5c0f\u8bf4',
			studyMinutesField: '\u5b66\u4e60\u5206\u949f\u6570',
			studyMinutesPlaceholder:
				'\u8f93\u5165\u6b63\u6574\u6570\u5206\u949f\u6570',
			noteField: '\u5907\u6ce8',
			notePlaceholder:
				'\u53ef\u9009\uff1a\u586b\u5199\u672c\u6b21\u5b66\u4e60\u5185\u5bb9',
			policyField: '\u5151\u6362\u89c4\u5219',
			policySummary:
				'30 \u5206\u949f\u5b66\u4e60\u65f6\u95f4\u89e3\u9501 1 \u7ae0\u3002',
			statusField: '\u72b6\u6001',
			readyToSave:
				'\u8868\u5355\u5df2\u5c31\u7eea\uff0c\u53ef\u4ee5\u4fdd\u5b58\u5b66\u4e60\u8bb0\u5f55\u3002',
			saving: '\u6b63\u5728\u4fdd\u5b58\u5b66\u4e60\u8bb0\u5f55...',
			saveButton: '\u4fdd\u5b58\u5b66\u4e60\u8bb0\u5f55',
			closeButton: '\u5173\u95ed',
			selectNovelFirst:
				'\u8bf7\u5148\u9009\u62e9\u4e00\u672c\u5df2\u5bfc\u5165\u7684\u5c0f\u8bf4\u3002',
			invalidStudyMinutes:
				'\u5b66\u4e60\u5206\u949f\u6570\u5fc5\u987b\u662f\u6b63\u6574\u6570\u3002',
			invalidNote:
				'\u5907\u6ce8\u4e0d\u80fd\u5305\u542b NUL \u5b57\u7b26\u3002',
			identityGenerationFailed:
				'Reward Reader \u65e0\u6cd5\u751f\u6210\u5b89\u5168\u7684\u5b66\u4e60\u8bb0\u5f55\u6807\u8bc6\u3002',
			successNotice: (studyMinutes, unlockedChapterCount, balanceAfter) =>
				`\u5b66\u4e60\u8bb0\u5f55\u5df2\u4fdd\u5b58\uff1a${studyMinutes} \u5206\u949f\uff0c\u89e3\u9501 ${unlockedChapterCount} \u7ae0\uff0c\u5269\u4f59 ${balanceAfter} \u5206\u949f\u3002`,
			successNoticeWithWarnings: (
				studyMinutes,
				unlockedChapterCount,
				balanceAfter,
			) =>
				`\u5b66\u4e60\u8bb0\u5f55\u5df2\u4fdd\u5b58\uff1a${studyMinutes} \u5206\u949f\uff0c\u89e3\u9501 ${unlockedChapterCount} \u7ae0\uff0c\u5269\u4f59 ${balanceAfter} \u5206\u949f\u3002\u5df2\u68c0\u6d4b\u5230\u5b58\u50a8\u8b66\u544a\u3002`,
			pendingHeading:
				'\u5f53\u524d\u6709\u4e00\u6761\u672a\u89e3\u51b3\u7684\u5b66\u4e60\u8bb0\u5f55\u8bf7\u6c42\u3002',
			pendingIdentityReuse:
				'\u540e\u7eed\u68c0\u67e5\u6216\u91cd\u8bd5\u4f1a\u539f\u6837\u590d\u7528\u540c\u4e00\u6761\u8bf7\u6c42\u8eab\u4efd\u3002',
			pendingMinutesSummary: (minutes) =>
				`\u5b66\u4e60\u5206\u949f\u6570\uff1a${minutes}`,
			pendingNotePresent: '\u5907\u6ce8\uff1a\u5df2\u586b\u5199',
			pendingNoteMissing: '\u5907\u6ce8\uff1a\u672a\u586b\u5199',
			checkSavedResultButton:
				'\u68c0\u67e5\u5df2\u4fdd\u5b58\u7ed3\u679c',
			checkAgainButton: '\u518d\u6b21\u68c0\u67e5',
			retryExactRequestButton:
				'\u6309\u539f\u8bf7\u6c42\u91cd\u8bd5',
			checkingSavedResult:
				'\u6b63\u5728\u68c0\u67e5\u5df2\u4fdd\u5b58\u7ed3\u679c...',
			retryingExactRequest:
				'\u6b63\u5728\u6309\u539f\u8bf7\u6c42\u91cd\u8bd5...',
			uncertainSaveMessage:
				'\u4fdd\u5b58\u7ed3\u679c\u76ee\u524d\u4e0d\u786e\u5b9a\u3002\u8bf7\u5728\u91cd\u8bd5\u524d\u5148\u68c0\u67e5\u5df2\u4fdd\u5b58\u7ed3\u679c\u3002',
			duplicateIdentityMessage:
				'\u68c0\u6d4b\u5230\u4e86\u5339\u914d\u7684\u8bb0\u5f55\u8eab\u4efd\u3002\u8bf7\u5148\u68c0\u67e5\u5df2\u4fdd\u5b58\u7ed3\u679c\u3002',
			notObservedMessage:
				'\u6700\u65b0\u72b6\u6001\u4e2d\u6ca1\u6709\u89c2\u5bdf\u5230\u5339\u914d\u8bb0\u5f55\u3002\u8fd9\u5e76\u4e0d\u80fd\u8bc1\u660e\u539f\u59cb\u5199\u5165\u5931\u8d25\u3002',
			blockedMessage:
				'\u73b0\u6709\u6301\u4e45\u5316\u8bc1\u636e\u4e0d\u5b8c\u6574\u6216\u5b58\u5728\u51b2\u7a81\u3002\u4e0d\u8981\u81ea\u52a8\u91cd\u8bd5\u3002',
			localStateRecoveryMessage:
				'Reward Reader \u65e0\u6cd5\u5b89\u5168\u66f4\u65b0\u672c\u5730\u6062\u590d\u72b6\u6001\u3002\u8bf7\u7ee7\u7eed\u68c0\u67e5\u5df2\u4fdd\u5b58\u7ed3\u679c\uff0c\u4e0d\u8981\u81ea\u52a8\u91cd\u8bd5\u3002',
			pendingPreserveFailedMessage:
				'Reward Reader \u65e0\u6cd5\u5b89\u5168\u4fdd\u5b58\u6062\u590d\u8bf7\u6c42\u3002\u672c\u6b21\u5b66\u4e60\u8bb0\u5f55\u672a\u63d0\u4ea4\u3002',
			localStateUpdateFailedMessage:
				'Reward Reader \u65e0\u6cd5\u5b89\u5168\u66f4\u65b0\u672c\u5730\u6062\u590d\u72b6\u6001\u3002',
			savedButLocalStateNotClearedMessage:
				'\u5b66\u4e60\u8bb0\u5f55\u5df2\u4fdd\u5b58\uff0c\u4f46\u672c\u5730\u6062\u590d\u72b6\u6001\u65e0\u6cd5\u6e05\u9664\u3002',
			discardPendingButton:
				'\u4e22\u5f03\u5f85\u5904\u7406\u6062\u590d\u72b6\u6001',
			confirmDiscardButton: '\u786e\u8ba4\u4e22\u5f03',
			discardWarning:
				'\u8fd9\u53ea\u4f1a\u5fd8\u8bb0\u672c\u5730\u5185\u5b58\u4e2d\u7684\u6062\u590d\u72b6\u6001\uff0c\u4e0d\u4f1a\u5220\u9664\u5df2\u4fdd\u5b58\u6570\u636e\u3002',
			discardedNotice:
				'\u5df2\u4e22\u5f03\u5f85\u5904\u7406\u6062\u590d\u72b6\u6001\u3002',
		};
	}

	return {
		commandName: 'Reward Reader: Record study time',
		duplicateModalNotice: 'The study record window is already open.',
		modalTitle: 'Record study time',
		loadingNovels: 'Loading novels...',
		noImportedNovels: 'No imported novels are available yet.',
		stateReadFailed: 'Reward Reader could not load the imported novel list.',
		localStateUnavailable:
			'Reward Reader could not access the local recovery state.',
		novelField: 'Novel',
		studyMinutesField: 'Study minutes',
		studyMinutesPlaceholder: 'Enter a positive whole number',
		noteField: 'Note',
		notePlaceholder: 'Optional study note',
		policyField: 'Exchange policy',
		policySummary: '30 study minutes unlock 1 chapter.',
		statusField: 'Status',
		readyToSave: 'The form is ready to save a study record.',
		saving: 'Saving study record...',
		saveButton: 'Save study record',
		closeButton: 'Close',
		selectNovelFirst: 'Select an imported novel first.',
		invalidStudyMinutes: 'Study minutes must be a positive whole number.',
		invalidNote: 'Note cannot contain NUL characters.',
		identityGenerationFailed:
			'Reward Reader could not create a safe study record identity.',
		successNotice: (studyMinutes, unlockedChapterCount, balanceAfter) =>
			`Study record saved. ${studyMinutes} minutes, ${unlockedChapterCount} chapter(s) unlocked, ${balanceAfter} minutes remaining.`,
		successNoticeWithWarnings: (
			studyMinutes,
			unlockedChapterCount,
			balanceAfter,
		) =>
			`Study record saved. ${studyMinutes} minutes, ${unlockedChapterCount} chapter(s) unlocked, ${balanceAfter} minutes remaining. Completed with storage warnings.`,
		pendingHeading: 'An unresolved study record request is pending.',
		pendingIdentityReuse:
			'Checks and retries will reuse the exact same request identity.',
		pendingMinutesSummary: (minutes) => `Study minutes: ${minutes}`,
		pendingNotePresent: 'Note: Present',
		pendingNoteMissing: 'Note: None',
		checkSavedResultButton: 'Check saved result',
		checkAgainButton: 'Check again',
		retryExactRequestButton: 'Retry exact request',
		checkingSavedResult: 'Checking saved result...',
		retryingExactRequest: 'Retrying exact request...',
		uncertainSaveMessage:
			'The save result is uncertain. Check the saved result before retrying.',
		duplicateIdentityMessage:
			'Matching record identity was detected. Check the saved result.',
		notObservedMessage:
			'No matching record was observed in the latest state. This does not prove the original write failed.',
		blockedMessage:
			'The stored evidence is incomplete or conflicting. Do not retry automatically.',
		localStateRecoveryMessage:
			'Reward Reader could not safely update the local recovery state. Keep checking the saved result instead of retrying automatically.',
		pendingPreserveFailedMessage:
			'Reward Reader could not safely preserve the recovery request. No study record was submitted.',
		localStateUpdateFailedMessage:
			'Reward Reader could not safely update the local recovery state.',
		savedButLocalStateNotClearedMessage:
			'The study record was saved, but the local recovery state could not be cleared.',
		discardPendingButton: 'Discard pending operation',
		confirmDiscardButton: 'Confirm discard',
		discardWarning:
			'This only forgets the local pending recovery state. It does not delete stored data.',
		discardedNotice: 'Pending recovery state discarded.',
	};
}

function isCanonicalUtcIsoTimestamp(value: string): boolean {
	if (value.trim() !== value || value.length === 0) {
		return false;
	}

	const parsed = Date.parse(value);
	return !Number.isNaN(parsed) && new Date(parsed).toISOString() === value;
}

function parseStudyMinutesText(value: string): number | null {
	const trimmedValue = value.trim();
	if (!/^[1-9]\d*$/u.test(trimmedValue)) {
		return null;
	}

	const minutes = Number(trimmedValue);
	return Number.isSafeInteger(minutes) && minutes > 0 ? minutes : null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSafeNonNegativeInteger(value: unknown): value is number {
	return (
		typeof value === 'number' &&
		Number.isSafeInteger(value) &&
		value >= 0
	);
}

function isSafePositiveInteger(value: unknown): value is number {
	return isSafeNonNegativeInteger(value) && value > 0;
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function createStudyExchangeRequestSnapshot(
	request: RewardReaderStudyExchangeRuntimeRequest,
): RewardReaderStudyExchangeRuntimeRequest {
	return {
		novelId: request.novelId,
		studyRecordId: request.studyRecordId,
		unlockRecordId: request.unlockRecordId,
		content: request.content,
		studyMinutes: request.studyMinutes,
		occurredAt: request.occurredAt,
		policy: {
			minutesPerChapter: request.policy.minutesPerChapter,
			maxChaptersPerStudyRecord:
				request.policy.maxChaptersPerStudyRecord,
			maxChaptersPerUtcDate: request.policy.maxChaptersPerUtcDate,
		},
	};
}

function createPendingStudyExchangeSnapshot(
	request: RewardReaderStudyExchangeRuntimeRequest,
	state: RewardReaderPendingStudyExchangeState,
): RewardReaderPendingStudyExchange {
	return {
		request: createStudyExchangeRequestSnapshot(request),
		state,
	};
}

export function cloneRewardReaderPendingStudyExchange(
	pending: RewardReaderPendingStudyExchange | null,
): RewardReaderPendingStudyExchange | null {
	if (!pending) {
		return null;
	}

	return createPendingStudyExchangeSnapshot(pending.request, pending.state);
}

function resolveDefaultNovelId(
	primaryNovelId: string | null,
	novels: readonly RewardReaderImportedNovelOption[],
): string {
	if (novels.length === 0) {
		return '';
	}

	if (
		typeof primaryNovelId === 'string' &&
		novels.filter((novel) => novel.id === primaryNovelId).length === 1
	) {
		return primaryNovelId;
	}

	return novels[0]?.id ?? '';
}

function classifyStudyExchangeResult(
	result: unknown,
): RewardReaderStudyUiResultClassification {
	try {
		if (!isPlainObject(result)) {
			return {
				kind: 'malformed',
			};
		}

		const ok = result.ok;
		if (ok === true) {
			const status = result.status;
			const statePersistence = result.statePersistence;
			const studyRecord = result.studyRecord;
			const calculation = result.calculation;
			const warnings = result.warnings;

			if (
				status !== 'persisted' ||
				statePersistence !== 'write-confirmed' ||
				!isPlainObject(studyRecord) ||
				!isPlainObject(calculation) ||
				!isSafePositiveInteger(studyRecord.minutes) ||
				!isSafeNonNegativeInteger(calculation.unlockedChapterCount) ||
				!isSafeNonNegativeInteger(calculation.balanceAfter) ||
				!isStringArray(warnings)
			) {
				return {
					kind: 'malformed',
				};
			}

			return {
				kind: 'persisted',
				studyMinutes: studyRecord.minutes,
				unlockedChapterCount: calculation.unlockedChapterCount,
				balanceAfter: calculation.balanceAfter,
				hasWarnings: warnings.length > 0,
			};
		}

		if (ok !== false) {
			return {
				kind: 'malformed',
			};
		}

		const statePersistence = result.statePersistence;
		if (statePersistence === 'write-outcome-unknown') {
			return {
				kind: 'write-outcome-unknown',
			};
		}

		const code = result.code;
		if (
			code === 'duplicate-record-id' ||
			code === 'record-id-conflict'
		) {
			return {
				kind: 'duplicate-identity',
			};
		}

		const message = result.message;
		if (
			(statePersistence === 'not-attempted' ||
				statePersistence === 'write-blocked') &&
			isNonEmptyString(message)
		) {
			return {
				kind: 'definite-failure',
				message,
			};
		}

		return {
			kind: 'malformed',
		};
	} catch {
		return {
			kind: 'malformed',
		};
	}
}

function classifyReplayRecoveryResult(
	result: unknown,
): RewardReaderReplayUiResultClassification {
	try {
		if (!isPlainObject(result)) {
			return {
				kind: 'malformed',
			};
		}

		const ok = result.ok;
		if (ok === true) {
			const status = result.status;
			if (status === 'not-observed') {
				return {
					kind: 'not-observed',
				};
			}

			const studyRecord = result.studyRecord;
			const calculation = result.calculation;
			const warnings = result.warnings;
			if (
				status !== 'replay-confirmed' ||
				!isPlainObject(studyRecord) ||
				!isPlainObject(calculation) ||
				!isSafePositiveInteger(studyRecord.minutes) ||
				!isSafeNonNegativeInteger(calculation.unlockedChapterCount) ||
				!isSafeNonNegativeInteger(calculation.balanceAfter) ||
				!isStringArray(warnings)
			) {
				return {
					kind: 'malformed',
				};
			}

			return {
				kind: 'replay-confirmed',
				studyMinutes: studyRecord.minutes,
				unlockedChapterCount: calculation.unlockedChapterCount,
				balanceAfter: calculation.balanceAfter,
				hasWarnings: warnings.length > 0,
			};
		}

		if (ok !== false) {
			return {
				kind: 'malformed',
			};
		}

		const message = result.message;
		if (isNonEmptyString(message)) {
			return {
				kind: 'blocked',
				message,
			};
		}

		return {
			kind: 'malformed',
		};
	} catch {
		return {
			kind: 'malformed',
		};
	}
}

function defaultCreateRewardReaderStudyRecordId(): string {
	const cryptoApi = window.crypto;
	if (!cryptoApi || typeof cryptoApi.randomUUID !== 'function') {
		throw new Error('Reward Reader study record identity is unavailable.');
	}

	return `study-${cryptoApi.randomUUID()}`;
}

function defaultCreateRewardReaderUnlockRecordId(): string {
	const cryptoApi = window.crypto;
	if (!cryptoApi || typeof cryptoApi.randomUUID !== 'function') {
		throw new Error('Reward Reader unlock identity is unavailable.');
	}

	return `unlock-${cryptoApi.randomUUID()}`;
}

function defaultCreateRewardReaderOccurredAt(): string {
	return new Date().toISOString();
}

export function registerRewardReaderStudyCommand(
	plugin: NestKitPlugin,
	getSettings: () => NestKitSettings,
	isFeatureEnabled: () => boolean,
	host: RewardReaderStudyExchangeModalHost,
	sessionTokenFactory: () => number,
): RewardReaderStudyCommandControl {
	let activeModal: RewardReaderStudyExchangeModal | null = null;
	let operationBusy = false;

	plugin.addCommand({
		id: REWARD_READER_RECORD_STUDY_COMMAND_ID,
		name: getRewardReaderStudyStrings(getSettings().uiLanguage).commandName,
		checkCallback: (checking) => {
			if (!isRewardReaderStudyCommandAvailable(isFeatureEnabled(), operationBusy)) {
				return false;
			}

			if (checking) {
				return true;
			}

			if (activeModal) {
				new Notice(
					getRewardReaderStudyStrings(getSettings().uiLanguage)
						.duplicateModalNotice,
				);
				return true;
			}

			activeModal = new RewardReaderStudyExchangeModal(plugin.app, {
				getSettings,
				host,
				sessionToken: sessionTokenFactory(),
				onBusyChange: (busy) => {
					operationBusy = busy;
				},
				onClose: () => {
					activeModal = null;
				},
			});
			activeModal.open();
			return true;
		},
	});

	return {
		closeActiveModal(): void {
			activeModal?.close();
		},
		hasActiveModal(): boolean {
			return activeModal !== null;
		},
		isOperationBusy(): boolean {
			return operationBusy;
		},
	};
}

export function isRewardReaderStudyCommandAvailable(
	isFeatureEnabled: boolean,
	operationBusy: boolean,
): boolean {
	return isFeatureEnabled && !Platform.isMobileApp && !operationBusy;
}

export class RewardReaderStudyExchangeModal extends Modal {
	private readonly getSettings: () => NestKitSettings;
	private readonly host: RewardReaderStudyExchangeModalHost;
	private readonly sessionToken: number;
	private readonly onRequestClose: () => void;
	private readonly onBusyChange: (busy: boolean) => void;
	private readonly runStudyExchange: typeof runRewardReaderStudyExchange;
	private readonly runReplayRecovery: typeof runRewardReaderStudyReplayRecovery;
	private readonly readStateStore: typeof readRewardReaderStateStore;
	private readonly showNotice: (message: string) => void;
	private readonly createStudyRecordId: () => string;
	private readonly createUnlockRecordId: () => string;
	private readonly createOccurredAt: () => string;

	private isClosed = false;
	private view: RewardReaderStudyModalView = 'loading';
	private operationInProgress = false;
	private uiGeneration = 0;
	private novels: RewardReaderImportedNovelOption[] = [];
	private selectedNovelId = '';
	private studyMinutesValue = '';
	private noteValue = '';
	private discardRequiresConfirmation = false;
	private recoveryHint: RewardReaderRecoveryHint = 'none';

	constructor(app: App, options: RewardReaderStudyExchangeModalOptions) {
		super(app);
		this.getSettings = options.getSettings;
		this.host = options.host;
		this.sessionToken = options.sessionToken;
		this.onRequestClose = options.onClose;
		this.onBusyChange = options.onBusyChange ?? (() => undefined);
		this.runStudyExchange =
			options.runStudyExchange ?? runRewardReaderStudyExchange;
		this.runReplayRecovery =
			options.runReplayRecovery ?? runRewardReaderStudyReplayRecovery;
		this.readStateStore = options.readStateStore ?? readRewardReaderStateStore;
		this.showNotice = options.createNotice ?? ((message) => new Notice(message));
		this.createStudyRecordId =
			options.createStudyRecordId ?? defaultCreateRewardReaderStudyRecordId;
		this.createUnlockRecordId =
			options.createUnlockRecordId ?? defaultCreateRewardReaderUnlockRecordId;
		this.createOccurredAt =
			options.createOccurredAt ?? defaultCreateRewardReaderOccurredAt;
	}

	onOpen(): void {
		this.isClosed = false;
		const pendingRead = this.getPendingStudyExchangeSafely();
		if (!pendingRead.ok) {
			this.view = 'local-state-failed';
		} else if (pendingRead.pending) {
			this.view = 'recovery';
		} else {
			this.view = 'loading';
			void this.loadImportedNovels();
		}
		this.renderSafely();
	}

	onClose(): void {
		this.isClosed = true;
		this.uiGeneration += 1;
		try {
			this.contentEl.empty();
		} catch {
			// Keep UI boundary no-throw.
		}
		try {
			this.onRequestClose();
		} catch {
			// Keep UI boundary no-throw.
		}
	}

	private getStrings(): RewardReaderStudyStrings {
		return getRewardReaderStudyStrings(this.getSettings().uiLanguage);
	}

	private getPendingStudyExchangeSafely(): RewardReaderPendingReadResult {
		try {
			return {
				ok: true,
				pending: cloneRewardReaderPendingStudyExchange(
					this.host.getPendingStudyExchange(),
				),
			};
		} catch {
			return {
				ok: false,
			};
		}
	}

	private replacePendingStudyExchange(
		pending: RewardReaderPendingStudyExchange | null,
	): void {
		this.host.replacePendingStudyExchange(this.sessionToken, pending);
	}

	private isSessionCurrentSafely(): boolean {
		try {
			return this.host.isSessionCurrent(this.sessionToken);
		} catch {
			return false;
		}
	}

	private canUpdateUi(generation: number): boolean {
		return !this.isClosed && generation === this.uiGeneration;
	}

	private renderSafely(): void {
		try {
			this.render();
		} catch {
			// Keep UI boundary no-throw.
		}
	}

	private closeSafely(): void {
		try {
			this.close();
		} catch {
			// Keep UI boundary no-throw.
		}
	}

	private setViewAndRenderIfOpen(
		generation: number,
		view: RewardReaderStudyModalView,
	): void {
		if (!this.canUpdateUi(generation)) {
			return;
		}

		this.view = view;
		this.renderSafely();
	}

	private replacePendingStudyExchangeSafely(
		pending: RewardReaderPendingStudyExchange | null,
	): boolean {
		try {
			if (!this.host.isSessionCurrent(this.sessionToken)) {
				return false;
			}
			this.replacePendingStudyExchange(
				cloneRewardReaderPendingStudyExchange(pending),
			);
			return true;
		} catch {
			return false;
		}
	}

	private showNoticeSafely(message: string): void {
		try {
			this.showNotice(message);
		} catch {
			// Keep UI boundary no-throw.
		}
	}

	private render(): void {
		if (this.isClosed) {
			return;
		}

		const strings = this.getStrings();
		this.titleEl.setText(strings.modalTitle);
		this.contentEl.empty();

		switch (this.view) {
			case 'loading':
				this.renderLoading(strings);
				break;
			case 'load-failed':
				this.renderLoadFailed(strings);
				break;
			case 'local-state-failed':
				this.renderLocalStateFailed(strings);
				break;
			case 'empty':
				this.renderEmpty(strings);
				break;
			case 'form':
				this.renderForm(strings);
				break;
			case 'recovery':
				this.renderRecovery(strings);
				break;
		}
	}

	private renderLoading(strings: RewardReaderStudyStrings): void {
		new Setting(this.contentEl)
			.setName(strings.statusField)
			.setDesc(strings.loadingNovels);

		new Setting(this.contentEl).addButton((button) =>
			button.setButtonText(strings.closeButton).onClick(() => this.close()),
		);
	}

	private renderLoadFailed(strings: RewardReaderStudyStrings): void {
		new Setting(this.contentEl)
			.setName(strings.statusField)
			.setDesc(strings.stateReadFailed);

		new Setting(this.contentEl).addButton((button) =>
			button.setButtonText(strings.closeButton).onClick(() => this.close()),
		);
	}

	private renderLocalStateFailed(strings: RewardReaderStudyStrings): void {
		new Setting(this.contentEl)
			.setName(strings.statusField)
			.setDesc(strings.localStateUnavailable);

		new Setting(this.contentEl).addButton((button) =>
			button.setButtonText(strings.closeButton).onClick(() => this.close()),
		);
	}

	private renderEmpty(strings: RewardReaderStudyStrings): void {
		new Setting(this.contentEl)
			.setName(strings.statusField)
			.setDesc(strings.noImportedNovels);

		new Setting(this.contentEl).addButton((button) =>
			button.setButtonText(strings.closeButton).onClick(() => this.close()),
		);
	}

	private renderForm(strings: RewardReaderStudyStrings): void {
		new Setting(this.contentEl)
			.setName(strings.novelField)
			.addDropdown((dropdown) => {
				for (const novel of this.novels) {
					dropdown.addOption(novel.id, novel.title);
				}

				const selectedNovelId = this.isKnownNovelId(this.selectedNovelId)
					? this.selectedNovelId
					: (this.novels[0]?.id ?? '');
				this.selectedNovelId = selectedNovelId;

				dropdown
					.setValue(selectedNovelId)
					.setDisabled(this.operationInProgress)
					.onChange((value) => {
						this.selectedNovelId = value;
						this.discardRequiresConfirmation = false;
					});
			});

		new Setting(this.contentEl)
			.setName(strings.studyMinutesField)
			.addText((text) => {
				text
					.setPlaceholder(strings.studyMinutesPlaceholder)
					.setValue(this.studyMinutesValue)
					.setDisabled(this.operationInProgress)
					.onChange((value) => {
						this.studyMinutesValue = value;
						this.discardRequiresConfirmation = false;
					});
				text.inputEl.inputMode = 'numeric';
			});

		new Setting(this.contentEl)
			.setName(strings.noteField)
			.addTextArea((textArea) => {
				textArea
					.setPlaceholder(strings.notePlaceholder)
					.setValue(this.noteValue)
					.setDisabled(this.operationInProgress)
					.onChange((value) => {
						this.noteValue = value;
						this.discardRequiresConfirmation = false;
					});
			});

		new Setting(this.contentEl)
			.setName(strings.policyField)
			.setDesc(strings.policySummary);

		new Setting(this.contentEl)
			.setName(strings.statusField)
			.setDesc(this.operationInProgress ? strings.saving : strings.readyToSave);

		const actionSetting = new Setting(this.contentEl);
		actionSetting.addButton((button) =>
			button
				.setButtonText(
					this.operationInProgress ? strings.saving : strings.saveButton,
				)
				.setCta()
				.setDisabled(this.operationInProgress)
				.onClick(() => {
					void this.handleSaveStudyRecord();
				}),
		);
		actionSetting.addButton((button) =>
			button.setButtonText(strings.closeButton).onClick(() => this.close()),
		);
	}

	private renderRecovery(strings: RewardReaderStudyStrings): void {
		const pendingRead = this.getPendingStudyExchangeSafely();
		if (!pendingRead.ok) {
			this.recoveryHint = 'local-state-failed';
			this.view = 'local-state-failed';
			this.renderSafely();
			return;
		}

		const pending = pendingRead.pending;
		if (!pending) {
			this.view = 'loading';
			void this.loadImportedNovels();
			this.renderSafely();
			return;
		}

		this.contentEl.createEl('p', { text: strings.pendingHeading });
		this.contentEl.createEl('p', { text: strings.pendingIdentityReuse });
		this.contentEl.createEl('p', {
			text: strings.pendingMinutesSummary(pending.request.studyMinutes),
		});
		this.contentEl.createEl('p', {
			text:
				pending.request.content.trim().length > 0
					? strings.pendingNotePresent
					: strings.pendingNoteMissing,
		});
		this.contentEl.createEl('p', {
			text: this.getRecoveryMessage(strings, pending.state),
		});

		const actionSetting = new Setting(this.contentEl);
		if (pending.state === 'needs-check') {
			actionSetting.addButton((button) =>
				button
					.setButtonText(
						this.operationInProgress
							? strings.checkingSavedResult
							: strings.checkSavedResultButton,
					)
					.setCta()
					.setDisabled(this.operationInProgress)
					.onClick(() => {
						void this.handleCheckSavedResult();
					}),
			);
		}

		if (pending.state === 'not-observed' || pending.state === 'blocked') {
			actionSetting.addButton((button) =>
				button
					.setButtonText(
						this.operationInProgress
							? strings.checkingSavedResult
							: strings.checkAgainButton,
					)
					.setDisabled(this.operationInProgress)
					.onClick(() => {
						void this.handleCheckSavedResult();
					}),
			);
		}

		if (this.canRetryExactRequest(pending)) {
			actionSetting.addButton((button) =>
				button
					.setButtonText(
						this.operationInProgress
							? strings.retryingExactRequest
							: strings.retryExactRequestButton,
					)
					.setCta()
					.setDisabled(this.operationInProgress)
					.onClick(() => {
						void this.handleRetryExactRequest();
					}),
			);
		}

		actionSetting.addButton((button) =>
			button.setButtonText(strings.closeButton).onClick(() => this.close()),
		);
		actionSetting.addButton((button) =>
			button
				.setWarning()
				.setButtonText(
					this.discardRequiresConfirmation
						? strings.confirmDiscardButton
						: strings.discardPendingButton,
				)
				.setDisabled(this.operationInProgress)
				.onClick(() => this.handleDiscardPending()),
		);

		if (this.discardRequiresConfirmation) {
			this.contentEl.createEl('p', {
				text: strings.discardWarning,
			});
		}
	}

	private getRecoveryMessage(
		strings: RewardReaderStudyStrings,
		state: RewardReaderPendingStudyExchangeState,
	): string {
		if (this.recoveryHint === 'local-state-failed') {
			return strings.localStateRecoveryMessage;
		}

		if (this.recoveryHint === 'blocked' || state === 'blocked') {
			return strings.blockedMessage;
		}

		if (this.recoveryHint === 'duplicate-identity') {
			return strings.duplicateIdentityMessage;
		}

		if (this.recoveryHint === 'not-observed' || state === 'not-observed') {
			return strings.notObservedMessage;
		}

		return strings.uncertainSaveMessage;
	}

	private canRetryExactRequest(
		pending: RewardReaderPendingStudyExchange,
	): boolean {
		return (
			pending.state === 'not-observed' &&
			this.recoveryHint !== 'blocked' &&
			this.recoveryHint !== 'local-state-failed'
		);
	}

	private isKnownNovelId(novelId: string): boolean {
		return this.novels.some((novel) => novel.id === novelId);
	}

	private async loadImportedNovels(): Promise<void> {
		const generation = ++this.uiGeneration;
		try {
			const stateRead: ReadRewardReaderStateStoreResult =
				await this.readStateStore(this.host.adapter);
			if (!this.canUpdateUi(generation)) {
				return;
			}

			if (!stateRead.ok || !Array.isArray(stateRead.store.novels)) {
				this.setViewAndRenderIfOpen(generation, 'load-failed');
				return;
			}

			const novels: RewardReaderImportedNovelOption[] = stateRead.store.novels.map(
				(novel) => {
					if (
						typeof novel.id !== 'string' ||
						typeof novel.title !== 'string'
					) {
						throw new Error('Invalid imported novel option.');
					}

					return {
						id: novel.id,
						title: novel.title,
					};
				},
			);

			this.novels = novels;
			if (novels.length === 0) {
				this.setViewAndRenderIfOpen(generation, 'empty');
				return;
			}

			const primaryNovelId = stateRead.store.primaryNovelId;
			if (
				primaryNovelId !== null &&
				typeof primaryNovelId !== 'string'
			) {
				throw new Error('Invalid primary novel id.');
			}

			if (!this.isKnownNovelId(this.selectedNovelId)) {
				this.selectedNovelId = resolveDefaultNovelId(
					primaryNovelId,
					novels,
				);
			}

			this.setViewAndRenderIfOpen(generation, 'form');
		} catch {
			this.setViewAndRenderIfOpen(generation, 'load-failed');
		}
	}

	private beginOperation(): number | null {
		if (this.operationInProgress) {
			return null;
		}

		this.operationInProgress = true;
		this.discardRequiresConfirmation = false;
		try {
			this.onBusyChange(true);
		} catch {
			// Keep UI boundary no-throw.
		}
		const generation = ++this.uiGeneration;
		if (!this.isClosed) {
			this.renderSafely();
		}
		return generation;
	}

	private endOperation(generation: number): void {
		this.operationInProgress = false;
		try {
			this.onBusyChange(false);
		} catch {
			// Keep UI boundary no-throw.
		}
		if (this.canUpdateUi(generation)) {
			this.renderSafely();
		}
	}

	private createFreshRequestSnapshot(): RewardReaderStudyExchangeRuntimeRequest | null {
		if (!this.isKnownNovelId(this.selectedNovelId)) {
			this.showNoticeSafely(this.getStrings().selectNovelFirst);
			return null;
		}

		const studyMinutes = parseStudyMinutesText(this.studyMinutesValue);
		if (studyMinutes === null) {
			this.showNoticeSafely(this.getStrings().invalidStudyMinutes);
			return null;
		}

		if (this.noteValue.includes('\0')) {
			this.showNoticeSafely(this.getStrings().invalidNote);
			return null;
		}

		let studyRecordId: string;
		let unlockRecordId: string;
		let occurredAt: string;
		try {
			studyRecordId = this.createStudyRecordId();
			unlockRecordId = this.createUnlockRecordId();
			occurredAt = this.createOccurredAt();
		} catch {
			this.showNoticeSafely(this.getStrings().identityGenerationFailed);
			return null;
		}

		if (
			!isSafeRewardReaderId(studyRecordId) ||
			!isSafeRewardReaderId(unlockRecordId) ||
			studyRecordId === unlockRecordId ||
			!isCanonicalUtcIsoTimestamp(occurredAt)
		) {
			this.showNoticeSafely(this.getStrings().identityGenerationFailed);
			return null;
		}

		return createStudyExchangeRequestSnapshot({
			novelId: this.selectedNovelId,
			studyRecordId,
			unlockRecordId,
			content: this.noteValue,
			studyMinutes,
			occurredAt,
			policy: FIXED_REWARD_READER_STUDY_POLICY,
		});
	}

	private async handleSaveStudyRecord(): Promise<void> {
		const request = this.createFreshRequestSnapshot();
		if (!request) {
			return;
		}

		const generation = this.beginOperation();
		if (generation === null) {
			return;
		}

		try {
			this.recoveryHint = 'uncertain-save';
			const pendingSaved = this.replacePendingStudyExchangeSafely(
				createPendingStudyExchangeSnapshot(request, 'needs-check'),
			);
			if (!pendingSaved) {
				this.showNoticeSafely(
					this.getStrings().pendingPreserveFailedMessage,
				);
				this.setViewAndRenderIfOpen(generation, 'form');
				return;
			}

			const result = await this.runStudyExchange(this.host.adapter, request);
			const classification = classifyStudyExchangeResult(result);
			if (!this.isSessionCurrentSafely()) {
				return;
			}
			if (classification.kind === 'persisted') {
				const successNotice = this.buildStudyExchangeSuccessNotice(
					classification.studyMinutes,
					classification.unlockedChapterCount,
					classification.balanceAfter,
					classification.hasWarnings,
				);
				const pendingCleared = this.replacePendingStudyExchangeSafely(null);
				if (!pendingCleared) {
					this.recoveryHint = 'local-state-failed';
					this.showNoticeSafely(
						this.getStrings().savedButLocalStateNotClearedMessage,
					);
					this.setViewAndRenderIfOpen(generation, 'recovery');
					return;
				}
				this.showNoticeSafely(successNotice);
				if (this.canUpdateUi(generation)) {
					this.closeSafely();
				}
				return;
			}

			if (classification.kind === 'definite-failure') {
				const pendingCleared = this.replacePendingStudyExchangeSafely(null);
				if (!pendingCleared) {
					this.recoveryHint = 'local-state-failed';
					this.showNoticeSafely(
						this.getStrings().localStateUpdateFailedMessage,
					);
					this.setViewAndRenderIfOpen(generation, 'recovery');
					return;
				}
				this.showNoticeSafely(classification.message);
				this.setViewAndRenderIfOpen(generation, 'form');
				return;
			}

			if (classification.kind === 'duplicate-identity') {
				this.recoveryHint = 'duplicate-identity';
			}

			this.setViewAndRenderIfOpen(generation, 'recovery');
		} catch {
			if (!this.isSessionCurrentSafely()) {
				return;
			}
			this.recoveryHint = 'uncertain-save';
			this.setViewAndRenderIfOpen(generation, 'recovery');
		} finally {
			this.endOperation(generation);
		}
	}

	private async handleCheckSavedResult(): Promise<void> {
		const pendingRead = this.getPendingStudyExchangeSafely();
		if (!pendingRead.ok) {
			this.recoveryHint = 'local-state-failed';
			this.showNoticeSafely(this.getStrings().localStateUnavailable);
			return;
		}

		const pending = pendingRead.pending;
		if (!pending) {
			this.view = 'loading';
			void this.loadImportedNovels();
			this.renderSafely();
			return;
		}

		const generation = this.beginOperation();
		if (generation === null) {
			return;
		}

		try {
			const result = await this.runReplayRecovery(
				this.host.adapter,
				pending.request,
			);
			const classification = classifyReplayRecoveryResult(result);
			if (!this.isSessionCurrentSafely()) {
				return;
			}
			if (classification.kind === 'replay-confirmed') {
				const successNotice = this.buildStudyExchangeSuccessNotice(
					classification.studyMinutes,
					classification.unlockedChapterCount,
					classification.balanceAfter,
					classification.hasWarnings,
				);
				const pendingCleared = this.replacePendingStudyExchangeSafely(null);
				if (!pendingCleared) {
					this.recoveryHint = 'local-state-failed';
					this.showNoticeSafely(
						this.getStrings().savedButLocalStateNotClearedMessage,
					);
					this.setViewAndRenderIfOpen(generation, 'recovery');
					return;
				}
				this.showNoticeSafely(successNotice);
				if (this.canUpdateUi(generation)) {
					this.closeSafely();
				}
				return;
			}

			if (classification.kind === 'not-observed') {
				this.recoveryHint = 'not-observed';
				const updated = this.replacePendingStudyExchangeSafely(
					createPendingStudyExchangeSnapshot(
						pending.request,
						'not-observed',
					),
				);
				if (!updated) {
					this.recoveryHint = 'local-state-failed';
					this.showNoticeSafely(
						this.getStrings().localStateUpdateFailedMessage,
					);
					this.setViewAndRenderIfOpen(generation, 'recovery');
					return;
				}
				this.setViewAndRenderIfOpen(generation, 'recovery');
				return;
			}

			this.recoveryHint = 'blocked';
			const updated = this.replacePendingStudyExchangeSafely(
				createPendingStudyExchangeSnapshot(pending.request, 'blocked'),
			);
			if (!updated) {
				this.recoveryHint = 'local-state-failed';
				this.showNoticeSafely(
					this.getStrings().localStateUpdateFailedMessage,
				);
				this.setViewAndRenderIfOpen(generation, 'recovery');
				return;
			}
			this.setViewAndRenderIfOpen(generation, 'recovery');
		} catch {
			if (!this.isSessionCurrentSafely()) {
				return;
			}
			this.recoveryHint = 'blocked';
			const updated = this.replacePendingStudyExchangeSafely(
				createPendingStudyExchangeSnapshot(pending.request, 'blocked'),
			);
			if (!updated) {
				this.recoveryHint = 'local-state-failed';
				this.showNoticeSafely(
					this.getStrings().localStateUpdateFailedMessage,
				);
				this.setViewAndRenderIfOpen(generation, 'recovery');
				return;
			}
			this.setViewAndRenderIfOpen(generation, 'recovery');
		} finally {
			this.endOperation(generation);
		}
	}

	private async handleRetryExactRequest(): Promise<void> {
		const pendingRead = this.getPendingStudyExchangeSafely();
		if (!pendingRead.ok) {
			this.recoveryHint = 'local-state-failed';
			this.showNoticeSafely(this.getStrings().localStateUnavailable);
			return;
		}

		const pending = pendingRead.pending;
		if (!pending || pending.state !== 'not-observed') {
			return;
		}

		const request = createStudyExchangeRequestSnapshot(pending.request);
		const generation = this.beginOperation();
		if (generation === null) {
			return;
		}

		try {
			this.recoveryHint = 'uncertain-save';
			const pendingUpdated = this.replacePendingStudyExchangeSafely(
				createPendingStudyExchangeSnapshot(request, 'needs-check'),
			);
			if (!pendingUpdated) {
				this.recoveryHint = 'local-state-failed';
				this.showNoticeSafely(
					this.getStrings().localStateUpdateFailedMessage,
				);
				this.setViewAndRenderIfOpen(generation, 'recovery');
				return;
			}

			const result = await this.runStudyExchange(this.host.adapter, request);
			const classification = classifyStudyExchangeResult(result);
			if (!this.isSessionCurrentSafely()) {
				return;
			}
			if (classification.kind === 'persisted') {
				const successNotice = this.buildStudyExchangeSuccessNotice(
					classification.studyMinutes,
					classification.unlockedChapterCount,
					classification.balanceAfter,
					classification.hasWarnings,
				);
				const pendingCleared = this.replacePendingStudyExchangeSafely(null);
				if (!pendingCleared) {
					this.recoveryHint = 'local-state-failed';
					this.showNoticeSafely(
						this.getStrings().savedButLocalStateNotClearedMessage,
					);
					this.setViewAndRenderIfOpen(generation, 'recovery');
					return;
				}
				this.showNoticeSafely(successNotice);
				if (this.canUpdateUi(generation)) {
					this.closeSafely();
				}
				return;
			}

			if (classification.kind === 'definite-failure') {
				this.recoveryHint = 'blocked';
				const updated = this.replacePendingStudyExchangeSafely(
					createPendingStudyExchangeSnapshot(request, 'blocked'),
				);
				if (!updated) {
					this.recoveryHint = 'local-state-failed';
					this.showNoticeSafely(
						this.getStrings().localStateUpdateFailedMessage,
					);
					this.setViewAndRenderIfOpen(generation, 'recovery');
					return;
				}
				this.setViewAndRenderIfOpen(generation, 'recovery');
				return;
			}

			if (classification.kind === 'duplicate-identity') {
				this.recoveryHint = 'duplicate-identity';
			}

			this.setViewAndRenderIfOpen(generation, 'recovery');
		} catch {
			if (!this.isSessionCurrentSafely()) {
				return;
			}
			this.recoveryHint = 'uncertain-save';
			this.setViewAndRenderIfOpen(generation, 'recovery');
		} finally {
			this.endOperation(generation);
		}
	}

	private handleDiscardPending(): void {
		if (this.operationInProgress) {
			return;
		}

		if (!this.discardRequiresConfirmation) {
			this.discardRequiresConfirmation = true;
			this.renderSafely();
			return;
		}

		const pendingCleared = this.replacePendingStudyExchangeSafely(null);
		if (!pendingCleared) {
			this.recoveryHint = 'local-state-failed';
			this.showNoticeSafely(
				this.getStrings().localStateUpdateFailedMessage,
			);
			this.discardRequiresConfirmation = false;
			this.renderSafely();
			return;
		}

		this.showNoticeSafely(this.getStrings().discardedNotice);
		this.closeSafely();
	}

	private buildStudyExchangeSuccessNotice(
		studyMinutes: number,
		unlockedChapterCount: number,
		balanceAfter: number,
		hasWarnings: boolean,
	): string {
		const strings = this.getStrings();
		return hasWarnings
			? strings.successNoticeWithWarnings(
					studyMinutes,
					unlockedChapterCount,
					balanceAfter,
				)
			: strings.successNotice(
					studyMinutes,
					unlockedChapterCount,
					balanceAfter,
				);
	}
}
