export const REWARD_READER_STORE_SCHEMA_VERSION = 1;
export const REWARD_READER_CHAPTER_INDEX_CACHE_SCHEMA_VERSION = 1;

export type RewardReaderStoreSchemaVersion =
	typeof REWARD_READER_STORE_SCHEMA_VERSION;
export type RewardReaderChapterIndexCacheSchemaVersion =
	typeof REWARD_READER_CHAPTER_INDEX_CACHE_SCHEMA_VERSION;

export type RewardReaderReadingMode =
	| 'continuous'
	| 'single-chapter';

export type RewardReaderSourceKind =
	| 'vault-txt'
	| 'vault-markdown';

export interface RewardReaderNovel {
	id: string;
	title: string;
	sourcePath: string;
	sourceKind: RewardReaderSourceKind;
	sourceMtime: number;
	sourceSize: number;
	createdAt: string;
	updatedAt: string;
}

export interface RewardReaderChapterIndexEntry {
	chapterIndex: number;
	title: string;
	startOffset: number;
	endOffset: number;
}

export interface RewardReaderNovelProgress {
	novelId: string;
	unlockedThroughChapterIndex: number | null;
	readThroughChapterIndex: number | null;
	currentChapterIndex: number | null;
	currentChapterScrollOffset: number;
	studyMinuteBalance: number;
	totalStudyMinutes: number;
	todayUnlockDate: string | null;
	todayUnlockedChapters: number;
	updatedAt: string;
}

export interface RewardReaderStudyRecord {
	id: string;
	novelId: string;
	content: string;
	minutes: number;
	createdAt: string;
	balanceBefore: number;
	balanceAfter: number;
	unlockedChapterCount: number;
}

export interface RewardReaderUnlockRecord {
	id: string;
	novelId: string;
	studyRecordId: string;
	unlockedChapterIndexes: number[];
	createdAt: string;
}

export type RewardReaderReadingAction =
	| 'opened'
	| 'marked-read';

export interface RewardReaderReadingRecord {
	id: string;
	novelId: string;
	chapterIndex: number;
	action: RewardReaderReadingAction;
	createdAt: string;
}

export interface RewardReaderStore {
	schemaVersion: RewardReaderStoreSchemaVersion;
	primaryNovelId: string | null;
	novels: RewardReaderNovel[];
	progressByNovelId: Record<string, RewardReaderNovelProgress>;
	studyRecords: RewardReaderStudyRecord[];
	unlockRecords: RewardReaderUnlockRecord[];
	readingRecords: RewardReaderReadingRecord[];
}

export interface RewardReaderChapterIndexCache {
	schemaVersion: RewardReaderChapterIndexCacheSchemaVersion;
	novelId: string;
	sourcePath: string;
	sourceMtime: number;
	sourceSize: number;
	sourceTextLength: number;
	generatedAt: string;
	chapters: RewardReaderChapterIndexEntry[];
}
