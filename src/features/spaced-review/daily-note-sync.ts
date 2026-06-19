import { Notice, TFile, normalizePath, type App } from 'obsidian';
import { todayIsoDate } from './dates';
import type { SpacedReviewOverviewOccurrenceItem } from './overview-model';
import type { SpacedReviewFeature } from './index';
import {
	DEFAULT_SETTINGS,
	type NestKitSettings,
} from '../../settings';
import { getDictionary, type NestKitDictionary } from '../../i18n';

const DAILY_NOTE_TITLE_SEPARATOR = ' \u2014 ';
const DAILY_NOTE_SEGMENT_SEPARATOR = ' \u00b7 ';

interface DailyNoteSyncDictionaryExtension {
	commands: {
		spacedReview: {
			syncDailyNote: {
				name: string;
				success: string;
				failed: string;
				duplicateHeadingWarning: string;
				checkedImported: string;
				duplicateHeadingCleaned: string;
				checkboxImportHint: string;
				unmatchedCheckedPreserved: string;
			};
		};
	};
	settings: {
		spacedReview: {
			name: string;
		};
	};
	spacedReview: {
		overview: {
			syncNote: string;
		};
		dailyNote: {
			noReviewsToday: string;
			plannedDate: (date: string) => string;
			reviewNumber: (reviewNumber: number) => string;
			overdue: string;
			missingFolder: string;
			notAFile: string;
			createdFile: string;
		};
	};
}

interface DailyNoteHeadingSectionMatch {
	headingLine: string;
	headingLevel: number;
	headingText: string;
	content: string;
	startIndex: number;
	endIndex: number;
	contentStartIndex: number;
	contentEndIndex: number;
}

interface DailyNoteSectionPathNode {
	level: number;
	text: string;
}

interface DailyNoteSectionPathMatch {
	node: DailyNoteSectionPathNode;
	headingLine: string;
	startIndex: number;
	endIndex: number;
	contentStartIndex: number;
	contentEndIndex: number;
}

interface DailyNoteImportResult {
	importedCount: number;
	skippedCount: number;
	checkedLineCount: number;
	hadUnmatchedCheckedLine: boolean;
}

interface UpsertDailyNoteSectionPathResult {
	content: string;
	pathFound: boolean;
	duplicateHeadingCount: number;
}

interface DailyNoteImportGuardResult extends DailyNoteImportResult {
	shouldRewrite: boolean;
}

function getDictionaryForSettings(
	settings: NestKitSettings,
): NestKitDictionary & DailyNoteSyncDictionaryExtension {
	return getDictionary(
		settings.uiLanguage,
	) as NestKitDictionary & DailyNoteSyncDictionaryExtension;
}

function escapeWikiLinkDisplayText(value: string): string {
	return value.replace(/[|[\]]/g, ' ').replace(/\s+/g, ' ').trim();
}

function escapeMarkdownLinkText(value: string): string {
	return value
		.replace(/\r?\n+/g, ' ')
		.replace(/\\/g, '\\\\')
		.replace(/\[/g, '\\[')
		.replace(/\]/g, '\\]')
		.replace(/\s+/g, ' ')
		.trim();
}

function escapeMarkdownLinkDestination(value: string): string {
	return value
		.trim()
		.replace(/\s/g, '%20')
		.replace(/\(/g, '%28')
		.replace(/\)/g, '%29');
}

function getShortDateLabel(date: string): string {
	return date.slice(5);
}

function formatDailyNoteFileName(date: string, format: string): string {
	const normalizedFormat = format.trim() || 'YYYY-MM-DD';
	const [year, month, day] = date.split('-');
	const replacements: Array<[string, string]> = [
		['YYYY', year ?? ''],
		['MM', month ?? ''],
		['DD', day ?? ''],
		['YY', (year ?? '').slice(-2)],
		['M', String(Number(month ?? '0'))],
		['D', String(Number(day ?? '0'))],
	];
	let result = normalizedFormat;
	for (const [token, value] of replacements) {
		result = result.replaceAll(token, value);
	}

	if (
		result.trim().length === 0 ||
		/[A-Za-z]/.test(result) ||
		result.includes('/') ||
		result.includes('\\')
	) {
		return date;
	}

	return result;
}

export function buildDailyNotePath(
	settings: NestKitSettings,
	date: string,
): string {
	const fileName = `${formatDailyNoteFileName(
		date,
		settings.spacedReviewDailyNoteDateFormat,
	)}.md`;
	const folder = settings.spacedReviewDailyNoteFolder.trim();
	return folder.length > 0
		? normalizePath(`${folder}/${fileName}`)
		: normalizePath(fileName);
}

function buildObsidianOpenUri(input: {
	vaultName: string;
	targetLink: string;
	openMode: 'current' | 'newTab';
}): string {
	const params = [
		`vault=${encodeURIComponent(input.vaultName)}`,
		`file=${encodeURIComponent(input.targetLink)}`,
	];
	if (input.openMode === 'newTab') {
		params.push('paneType=tab');
	}

	return `obsidian://open?${params.join('&')}`;
}

function buildDailyNoteDisplayTitle(input: {
	title: string;
	targetLink?: string;
	settings: NestKitSettings;
	vaultName: string;
	linkStyle?: 'wiki' | 'uri';
	openMode?: 'current' | 'newTab';
}): string {
	const { title, targetLink, settings, vaultName, linkStyle, openMode } = input;
	if (!targetLink) {
		return title;
	}

	const resolvedLinkStyle =
		linkStyle ??
		(settings.spacedReviewDailyNoteLinksUseOpenMode ? 'uri' : 'wiki');
	if (resolvedLinkStyle === 'wiki') {
		return `[[${targetLink}|${escapeWikiLinkDisplayText(title)}]]`;
	}

	const uri = buildObsidianOpenUri({
		vaultName,
		targetLink,
		openMode: openMode ?? settings.spacedReviewTargetLinkOpenMode,
	});
	return `[${escapeMarkdownLinkText(title)}](${escapeMarkdownLinkDestination(uri)})`;
}

function buildDailyNoteLine(
	item: SpacedReviewOverviewOccurrenceItem,
	dictionary: NestKitDictionary & DailyNoteSyncDictionaryExtension,
	settings: NestKitSettings,
	vaultName: string,
	options?: {
		linkStyle?: 'wiki' | 'uri';
		openMode?: 'current' | 'newTab';
	},
): string {
	const title = item.task.title.trim();
	const displayTitle = buildDailyNoteDisplayTitle({
		title,
		targetLink: item.task.targetLink,
		settings,
		vaultName,
		linkStyle: options?.linkStyle,
		openMode: options?.openMode,
	});
	const segments = [
		dictionary.spacedReview.dailyNote.reviewNumber(item.reviewNumber),
		dictionary.spacedReview.dailyNote.plannedDate(
			getShortDateLabel(item.occurrence.plannedDate),
		),
	];

	if (item.occurrence.isOverdue) {
		segments.push(dictionary.spacedReview.dailyNote.overdue);
	}

	return `- [ ] ${displayTitle}${DAILY_NOTE_TITLE_SEPARATOR}${segments.join(
		DAILY_NOTE_SEGMENT_SEPARATOR,
	)}`;
}

function buildDailyNoteLineVariants(
	item: SpacedReviewOverviewOccurrenceItem,
	dictionary: NestKitDictionary & DailyNoteSyncDictionaryExtension,
	settings: NestKitSettings,
	vaultName: string,
): string[] {
	if (!item.task.targetLink) {
		return [buildDailyNoteLine(item, dictionary, settings, vaultName)];
	}

	return [
		buildDailyNoteLine(item, dictionary, settings, vaultName),
		buildDailyNoteLine(item, dictionary, settings, vaultName, {
			linkStyle: 'wiki',
		}),
		buildDailyNoteLine(item, dictionary, settings, vaultName, {
			linkStyle: 'uri',
			openMode: 'current',
		}),
		buildDailyNoteLine(item, dictionary, settings, vaultName, {
			linkStyle: 'uri',
			openMode: 'newTab',
		}),
	].filter((value, index, values) => values.indexOf(value) === index);
}

export function buildDailyNoteSectionContent(
	items: SpacedReviewOverviewOccurrenceItem[],
	settings: NestKitSettings,
	vaultName: string,
): string {
	const dictionary = getDictionaryForSettings(settings);
	if (items.length === 0) {
		return dictionary.spacedReview.dailyNote.noReviewsToday;
	}

	const taskLines = items
		.map((item) => buildDailyNoteLine(item, dictionary, settings, vaultName))
		.join('\n');
	return taskLines;
}

function getLineEndIndex(content: string, lineStartIndex: number): number {
	const lineEnd = content.indexOf('\n', lineStartIndex);
	return lineEnd === -1 ? content.length : lineEnd;
}

function parseHeadingEntries(content: string): DailyNoteHeadingSectionMatch[] {
	const headingPattern = /^(#{1,6})\s+(.*?)\s*#*\s*$/gm;
	const rawEntries: Array<{
		startIndex: number;
		lineEndIndex: number;
		level: number;
		text: string;
		lineText: string;
	}> = [];

	for (const match of content.matchAll(headingPattern)) {
		if (match.index === undefined) {
			continue;
		}

		const lineStartIndex = match.index;
		const lineEndIndex = getLineEndIndex(content, lineStartIndex);
		rawEntries.push({
			startIndex: lineStartIndex,
			lineEndIndex,
			level: match[1]?.length ?? 0,
			text: (match[2] ?? '').trim(),
			lineText: content.slice(lineStartIndex, lineEndIndex),
		});
	}

	return rawEntries.map((entry, index) => {
		const nextBoundary = rawEntries
			.slice(index + 1)
			.find((candidate) => candidate.level <= entry.level);
		const contentStartIndex =
			entry.lineEndIndex < content.length ? entry.lineEndIndex + 1 : content.length;
		const contentEndIndex = nextBoundary?.startIndex ?? content.length;

		return {
			headingLine: entry.lineText,
			headingLevel: entry.level,
			headingText: entry.text,
			content: content.slice(contentStartIndex, contentEndIndex),
			startIndex: entry.startIndex,
			endIndex: contentEndIndex,
			contentStartIndex,
			contentEndIndex,
		};
	});
}

function findHeadingSectionMatches(
	content: string,
	node: DailyNoteSectionPathNode,
	searchStartIndex = 0,
	searchEndIndex = content.length,
): DailyNoteHeadingSectionMatch[] {
	return parseHeadingEntries(content).filter(
		(entry) =>
			entry.startIndex >= searchStartIndex &&
			entry.startIndex < searchEndIndex &&
			entry.headingLevel === node.level &&
			entry.headingText === node.text,
	);
}

function parseDailyNoteSectionPath(
	input: string,
	fallbackHeading: string,
): DailyNoteSectionPathNode[] {
	const normalizedLines = input
		.split(/\r\n|\n|\r/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
	const fallback = fallbackHeading.trim() || DEFAULT_SETTINGS.spacedReviewDailyNoteSectionHeading;
	const lines = normalizedLines.length > 0 ? normalizedLines : [fallback];

	return lines.map((line, index) => {
		const explicitMatch = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
		if (explicitMatch) {
			return {
				level: explicitMatch[1]?.length ?? Math.min(index + 1, 6),
				text: (explicitMatch[2] ?? fallback).trim(),
			};
		}

		if (lines.length === 1) {
			return {
				level: 2,
				text: line,
			};
		}

		return {
			level: Math.min(index + 1, 6),
			text: line,
		};
	});
}

function buildHeadingLine(node: DailyNoteSectionPathNode): string {
	return `${'#'.repeat(node.level)} ${node.text}`;
}

function buildSectionPathBlock(
	path: DailyNoteSectionPathNode[],
	content: string,
): string {
	const normalizedContent = normalizeSectionReplacementContent(content);
	const headingLines = path.map(buildHeadingLine);
	return [...headingLines, normalizedContent].join('\n');
}

function getDailyNoteSectionPath(
	settings: NestKitSettings,
	dictionary: NestKitDictionary & DailyNoteSyncDictionaryExtension,
): DailyNoteSectionPathNode[] {
	const configuredPath = settings.spacedReviewDailyNoteSectionPath.trim();
	const fallbackHeading = settings.spacedReviewDailyNoteSectionHeading.trim();
	const localizedFallback = dictionary.settings.spacedReview.name.trim();
	return parseDailyNoteSectionPath(
		configuredPath,
		fallbackHeading.length > 0
			? fallbackHeading
			: localizedFallback.length > 0
				? localizedFallback
				: DEFAULT_SETTINGS.spacedReviewDailyNoteSectionHeading,
	);
}

function appendSectionPathBlock(
	existingContent: string,
	path: DailyNoteSectionPathNode[],
	content: string,
): string {
	const fullBlock = buildSectionPathBlock(path, content);
	const cleanedBase = cleanOrphanLegacyManagedBlocks(existingContent).trimEnd();
	return cleanedBase.length > 0 ? `${cleanedBase}\n\n${fullBlock}\n` : `${fullBlock}\n`;
}

function findSectionPathMatches(
	content: string,
	path: DailyNoteSectionPathNode[],
): {
	matches: Array<DailyNoteSectionPathMatch | null>;
	duplicateHeadingCount: number;
} {
	const matches: Array<DailyNoteSectionPathMatch | null> = [];
	let duplicateHeadingCount = 0;
	let searchStartIndex = 0;
	let searchEndIndex = content.length;

	for (const node of path) {
		const headingMatches = findHeadingSectionMatches(
			content,
			node,
			searchStartIndex,
			searchEndIndex,
		);
		duplicateHeadingCount += Math.max(0, headingMatches.length - 1);
		const firstMatch = headingMatches[0];
		if (!firstMatch) {
			matches.push(null);
			break;
		}

		const currentMatch: DailyNoteSectionPathMatch = {
			node,
			headingLine: firstMatch.headingLine,
			startIndex: firstMatch.startIndex,
			endIndex: firstMatch.endIndex,
			contentStartIndex: firstMatch.contentStartIndex,
			contentEndIndex: firstMatch.contentEndIndex,
		};
		matches.push(currentMatch);
		searchStartIndex = firstMatch.contentStartIndex;
		searchEndIndex = firstMatch.contentEndIndex;
	}

	return {
		matches,
		duplicateHeadingCount,
	};
}

function findSectionPathTarget(
	content: string,
	path: DailyNoteSectionPathNode[],
): {
	target: DailyNoteHeadingSectionMatch | null;
	duplicateHeadingCount: number;
} {
	let target: DailyNoteHeadingSectionMatch | null = null;
	let duplicateHeadingCount = 0;
	let searchStartIndex = 0;
	let searchEndIndex = content.length;

	for (const node of path) {
		const headingMatches = findHeadingSectionMatches(
			content,
			node,
			searchStartIndex,
			searchEndIndex,
		);
		duplicateHeadingCount += Math.max(0, headingMatches.length - 1);
		const firstMatch = headingMatches[0];
		if (!firstMatch) {
			return {
				target: null,
				duplicateHeadingCount,
			};
		}

		target = firstMatch;
		searchStartIndex = firstMatch.contentStartIndex;
		searchEndIndex = firstMatch.contentEndIndex;
	}

	return {
		target,
		duplicateHeadingCount,
	};
}

function replaceSectionPathContent(
	existingContent: string,
	path: DailyNoteSectionPathNode[],
	nextSectionContent: string,
): UpsertDailyNoteSectionPathResult {
	const resolvedPath = findSectionPathMatches(existingContent, path);
	let lastMatch: DailyNoteSectionPathMatch | null = null;
	let lastMatchIndex = -1;
	for (const [index, match] of resolvedPath.matches.entries()) {
		if (!match) {
			break;
		}

		lastMatch = match;
		lastMatchIndex = index;
	}

	if (!lastMatch) {
		return {
			content: appendSectionPathBlock(existingContent, path, nextSectionContent),
			pathFound: false,
			duplicateHeadingCount: resolvedPath.duplicateHeadingCount,
		};
	}

	const remainingNodes = path.slice(lastMatchIndex + 1);
	if (remainingNodes.length === 0) {
		return {
			content:
				existingContent.slice(0, lastMatch.contentStartIndex) +
				`${normalizeSectionReplacementContent(nextSectionContent)}\n` +
				existingContent.slice(lastMatch.contentEndIndex),
			pathFound: true,
			duplicateHeadingCount: resolvedPath.duplicateHeadingCount,
		};
	}

	const insertedBlock = buildSectionPathBlock(remainingNodes, nextSectionContent);
	const currentParentContent = existingContent
		.slice(lastMatch.contentStartIndex, lastMatch.contentEndIndex)
		.trimEnd();
	const replacementContent =
		currentParentContent.length > 0
			? `${currentParentContent}\n\n${insertedBlock}\n`
			: `${insertedBlock}\n`;
	return {
		content:
			existingContent.slice(0, lastMatch.contentStartIndex) +
			replacementContent +
			existingContent.slice(lastMatch.contentEndIndex),
		pathFound: true,
		duplicateHeadingCount: resolvedPath.duplicateHeadingCount,
	};
}

function stripLegacyManagedArtifacts(sectionContent: string): string {
	return sectionContent
		.replace(
			/^\s*<!--\s*NESTKIT_SPACED_REVIEW_START\s*-->\s*[\r\n]?/gm,
			'',
		)
		.replace(
			/^\s*<!--\s*NESTKIT_SPACED_REVIEW_END\s*-->\s*[\r\n]?/gm,
			'',
		)
		.replace(
			/^\s*%%\s*NESTKIT_SPACED_REVIEW_META[\s\S]*?^\s*NESTKIT_SPACED_REVIEW_META_END\s*%%\s*[\r\n]?/gm,
			'',
		)
		.replace(
			/\s*<!--\s*NESTKIT_SR\s+taskId="[^"]+"\s+sequenceIndex="[^"]+"\s+plannedDate="[^"]+"\s*-->\s*/g,
			'',
		);
}

function cleanOrphanLegacyManagedBlocks(content: string): string {
	return content
		.replace(
			/(?:^|\r?\n)\s*<!--\s*NESTKIT_SPACED_REVIEW_START\s*-->\r?\n[\s\S]*?\r?\n\s*<!--\s*NESTKIT_SPACED_REVIEW_END\s*-->\s*(?=\r?\n|$)/g,
			'',
		)
		.replace(/\n{3,}/g, '\n\n');
}

function normalizeSectionReplacementContent(content: string): string {
	return stripLegacyManagedArtifacts(content).trimEnd();
}

function throwDailyNoteSyncError(message: string): never {
	new Notice(message);
	throw new Error(message);
}

export async function upsertDailyNoteSection(
	app: App,
	path: string,
	sectionPath: DailyNoteSectionPathNode[],
	content: string,
	createIfMissing: boolean,
	settings: NestKitSettings,
): Promise<void> {
	const dictionary = getDictionaryForSettings(settings);
	const normalizedPath = normalizePath(path);
	const existing = app.vault.getAbstractFileByPath(normalizedPath);

	if (!existing) {
		if (!createIfMissing) {
			throwDailyNoteSyncError(dictionary.spacedReview.dailyNote.missingFolder);
		}

		const folderPath = normalizedPath.split('/').slice(0, -1).join('/');
		if (folderPath.length > 0) {
			const folder = app.vault.getAbstractFileByPath(folderPath);
			if (!folder) {
				throwDailyNoteSyncError(dictionary.spacedReview.dailyNote.missingFolder);
			}
		}

		await app.vault.create(
			normalizedPath,
			`${buildSectionPathBlock(sectionPath, content)}\n`,
		);
		new Notice(dictionary.spacedReview.dailyNote.createdFile);
		return;
	}

	if (!(existing instanceof TFile)) {
		throwDailyNoteSyncError(dictionary.spacedReview.dailyNote.notAFile);
	}

	const existingContent = await app.vault.read(existing);
	const replaced = replaceSectionPathContent(
		existingContent,
		sectionPath,
		content,
	);
	const nextContent = cleanOrphanLegacyManagedBlocks(replaced.content);

	if (replaced.duplicateHeadingCount > 0) {
		new Notice(
			dictionary.commands.spacedReview.syncDailyNote.duplicateHeadingWarning,
		);
	}

	if (nextContent !== existingContent) {
		await app.vault.modify(existing, nextContent);
	}
}

function getDailyNoteSectionContent(
	content: string,
	sectionPath: DailyNoteSectionPathNode[],
): { sectionContent: string | null; duplicateHeadingCount: number } {
	const result = findSectionPathTarget(content, sectionPath);
	return {
		sectionContent: result.target?.content ?? null,
		duplicateHeadingCount: result.duplicateHeadingCount,
	};
}

function isCheckedCheckboxLine(line: string): boolean {
	return /^\s*-\s*\[(x|X)\]\s/.test(line);
}

function isTaskCheckboxLine(line: string): boolean {
	return /^\s*-\s*\[( |x|X)\]\s/.test(line);
}

function extractManagedTaskLines(content: string): string[] {
	return content
		.split(/\r?\n/)
		.filter((line) => isTaskCheckboxLine(line));
}

function normalizeCheckboxLineForMatch(line: string): string {
	return line
		.replace(/^\s*-\s*\[(x|X| )\]\s*/, '- [ ] ')
		.replace(/\s+/g, ' ')
		.trim();
}

function findMatchingOverviewItem(
	line: string,
	lineIndex: number,
	items: SpacedReviewOverviewOccurrenceItem[],
	dictionary: NestKitDictionary & DailyNoteSyncDictionaryExtension,
	settings: NestKitSettings,
	vaultName: string,
): SpacedReviewOverviewOccurrenceItem | undefined {
	const normalizedLine = normalizeCheckboxLineForMatch(line);
	const exactMatches = items.filter(
		(item) =>
			buildDailyNoteLineVariants(item, dictionary, settings, vaultName).some(
				(expectedLine) =>
					normalizeCheckboxLineForMatch(expectedLine) === normalizedLine,
			),
	);

	if (exactMatches.length === 1) {
		return exactMatches[0];
	}

	return items[lineIndex];
}

export async function importCheckedReviewsFromDailyNote(input: {
	app: App;
	settings: NestKitSettings;
	feature: SpacedReviewFeature;
	date: string;
	silent?: boolean;
}): Promise<DailyNoteImportGuardResult> {
	const { app, settings, feature, date, silent = false } = input;
	const dictionary = getDictionaryForSettings(settings);
	const vaultName = app.vault.getName();
	const path = buildDailyNotePath(settings, date);
	const existing = app.vault.getAbstractFileByPath(normalizePath(path));

	if (!existing) {
		return {
			importedCount: 0,
			skippedCount: 0,
			checkedLineCount: 0,
			hadUnmatchedCheckedLine: false,
			shouldRewrite: true,
		};
	}

	if (!(existing instanceof TFile)) {
		throwDailyNoteSyncError(dictionary.spacedReview.dailyNote.notAFile);
	}

	const fileContent = await app.vault.read(existing);
	const sectionPath = getDailyNoteSectionPath(settings, dictionary);
	const {
		sectionContent,
		duplicateHeadingCount,
	} = getDailyNoteSectionContent(fileContent, sectionPath);
	if (duplicateHeadingCount > 0) {
		new Notice(
			dictionary.commands.spacedReview.syncDailyNote.duplicateHeadingWarning,
		);
	}
	if (sectionContent === null) {
		return {
			importedCount: 0,
			skippedCount: 0,
			checkedLineCount: 0,
			hadUnmatchedCheckedLine: false,
			shouldRewrite: true,
		};
	}

	let importedCount = 0;
	let skippedCount = 0;
	let checkedLineCount = 0;
	let hadUnmatchedCheckedLine = false;
	const taskLines = extractManagedTaskLines(
		stripLegacyManagedArtifacts(sectionContent),
	);
	const overviewItems = await feature.readTodayOverviewItems();
	const todayItems = [
		...overviewItems.overdueItems,
		...overviewItems.dueItems,
	];

	for (const [lineIndex, line] of taskLines.entries()) {
		if (!isCheckedCheckboxLine(line)) {
			continue;
		}

		checkedLineCount += 1;
		const item = findMatchingOverviewItem(
			line,
			lineIndex,
			todayItems,
			dictionary,
			settings,
			vaultName,
		);
		if (!item) {
			skippedCount += 1;
			hadUnmatchedCheckedLine = true;
			console.debug(
				`[NestKit] Skipped checked Daily Note line at index ${lineIndex} because no current Today item matched its text or position.`,
			);
			continue;
		}

		const result = await feature.completeOccurrenceFromDailyNoteImport(
			item.task.id,
			item.occurrence.sequenceIndex,
			item.occurrence.plannedDate,
		);
		if (result === 'completed') {
			importedCount += 1;
			continue;
		}

		skippedCount += 1;
		console.debug(
			`[NestKit] Skipped checked Daily Note import for ${item.task.id}:${item.occurrence.sequenceIndex} (${result}).`,
		);
	}

	if (checkedLineCount > 0 && importedCount === 0 && hadUnmatchedCheckedLine) {
		if (!silent) {
			new Notice(
				dictionary.commands.spacedReview.syncDailyNote.unmatchedCheckedPreserved,
			);
		}
		return {
			importedCount,
			skippedCount,
			checkedLineCount,
			hadUnmatchedCheckedLine,
			shouldRewrite: false,
		};
	}

	if (!silent && importedCount > 0) {
		new Notice(dictionary.commands.spacedReview.syncDailyNote.checkedImported);
	}

	return {
		importedCount,
		skippedCount,
		checkedLineCount,
		hadUnmatchedCheckedLine,
		shouldRewrite: true,
	};
}

export async function importCheckedReviewsForToday(input: {
	app: App;
	settings: NestKitSettings;
	feature: SpacedReviewFeature;
	silent?: boolean;
}): Promise<DailyNoteImportGuardResult> {
	return importCheckedReviewsFromDailyNote({
		...input,
		date: todayIsoDate(),
	});
}

export async function syncTodayReviewsToDailyNote(input: {
	app: App;
	settings: NestKitSettings;
	feature: SpacedReviewFeature;
	silent?: boolean;
}): Promise<void> {
	const today = todayIsoDate();
	const importResult = await importCheckedReviewsForToday({
		app: input.app,
		settings: input.settings,
		feature: input.feature,
		silent: input.silent,
	});
	if (!importResult.shouldRewrite) {
		return;
	}
	const overviewItems = await input.feature.readTodayOverviewItems();
	await syncReviewItemsToDailyNote({
		app: input.app,
		settings: input.settings,
		items: [...overviewItems.overdueItems, ...overviewItems.dueItems],
		date: today,
		silent: input.silent,
	});
}

export async function syncReviewItemsToDailyNote(input: {
	app: App;
	settings: NestKitSettings;
	items: SpacedReviewOverviewOccurrenceItem[];
	date: string;
	silent?: boolean;
}): Promise<void> {
	const { app, settings, items, date, silent = false } = input;
	const dictionary = getDictionaryForSettings(settings);
	const path = buildDailyNotePath(settings, date);
	const sectionContent = buildDailyNoteSectionContent(
		items,
		settings,
		app.vault.getName(),
	);
	const sectionPath = getDailyNoteSectionPath(settings, dictionary);
	await upsertDailyNoteSection(
		app,
		path,
		sectionPath,
		sectionContent,
		settings.spacedReviewDailyNoteCreateIfMissing,
		settings,
	);
	if (!silent) {
		new Notice(dictionary.commands.spacedReview.syncDailyNote.success);
	}
}
