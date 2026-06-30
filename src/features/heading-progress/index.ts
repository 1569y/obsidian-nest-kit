import type { EditorView } from '@codemirror/view';
import type {
	Editor,
	EventRef,
	MarkdownFileInfo,
	MarkdownView,
} from 'obsidian';
import { MarkdownView as ObsidianMarkdownView } from 'obsidian';
import type { FeatureModule } from '../../core/feature-module';
import { getDictionary, type NestKitDictionary } from '../../i18n';
import type NestKitPlugin from '../../main';
import type { HeadingProgressSource } from './types';
import {
	parseHeadings,
	resolveHeadingSectionProgress,
	type HeadingSectionProgress,
	type ParsedHeading,
} from './progress';

const UPDATE_DEBOUNCE_MS = 100;
const EDITOR_SCROLL_SELECTOR = '.cm-scroller';

interface HeadingProgressDictionaryExtension {
	features: {
		headingProgress: {
			name: string;
			description: string;
		};
	};
	headingProgress: {
		statusBar: {
			noHeading: string;
			noEditor: string;
			sourceViewportCenter: string;
			sourceCursorPosition: string;
			tooltipHeadingTitle: string;
			tooltipHeadingLevel: string;
			tooltipLineRange: string;
			tooltipProgressSource: string;
			tooltipPercentage: string;
		};
	};
}

interface ParsedEditorState {
	editor: Editor;
	filePath: string | null;
	lineCount: number;
	headings: ParsedHeading[];
}

export class HeadingProgressFeature implements FeatureModule {
	private enabled = false;
	private statusBarItemEl: HTMLElement | null = null;
	private labelEl: HTMLSpanElement | null = null;
	private percentageEl: HTMLSpanElement | null = null;
	private barEl: HTMLSpanElement | null = null;
	private barFillEl: HTMLSpanElement | null = null;
	private workspaceEventRefs: EventRef[] = [];
	private updateTimer: number | null = null;
	private pendingRebind = false;
	private pendingReparse = false;
	private boundEditor: Editor | null = null;
	private boundEditorRootEl: HTMLElement | null = null;
	private boundEditorScrollEl: HTMLElement | null = null;
	private parsedEditorState: ParsedEditorState | null = null;

	private readonly handleActiveLeafChange = (): void => {
		this.scheduleUpdate({
			rebind: true,
			reparse: true,
		});
	};

	private readonly handleFileOpen = (): void => {
		this.scheduleUpdate({
			rebind: true,
			reparse: true,
		});
	};

	private readonly handleLayoutChange = (): void => {
		this.scheduleUpdate({
			rebind: true,
		});
	};

	private readonly handleEditorChange = (
		editor: Editor,
		info: MarkdownView | MarkdownFileInfo,
	): void => {
		if (!this.isCurrentActiveEditor(editor, info)) {
			return;
		}

		this.scheduleUpdate({
			reparse: true,
		});
	};

	private readonly handleEditorScroll = (): void => {
		if (this.plugin.settings.headingProgressSource !== 'viewport-center') {
			return;
		}

		this.scheduleUpdate();
	};

	private readonly handleEditorPointerOrKey = (): void => {
		if (this.plugin.settings.headingProgressSource !== 'cursor-position') {
			return;
		}

		this.scheduleUpdate();
	};

	constructor(private readonly plugin: NestKitPlugin) {
		this.plugin.register(() => this.disable());
	}

	enable(): void {
		if (this.enabled) {
			return;
		}

		this.enabled = true;
		this.ensureStatusBarItem();
		this.registerWorkspaceListeners();
		this.scheduleUpdate({
			rebind: true,
			reparse: true,
		});
	}

	disable(): void {
		this.enabled = false;
		this.clearUpdateTimer();
		this.unregisterWorkspaceListeners();
		this.unbindEditorListeners();
		this.parsedEditorState = null;
		this.destroyStatusBarItem();
		this.pendingRebind = false;
		this.pendingReparse = false;
	}

	refresh(): void {
		if (!this.enabled) {
			return;
		}

		this.scheduleUpdate({
			rebind: true,
			reparse: true,
		});
	}

	private registerWorkspaceListeners(): void {
		if (this.workspaceEventRefs.length > 0) {
			return;
		}

		this.workspaceEventRefs.push(
			this.plugin.app.workspace.on(
				'active-leaf-change',
				this.handleActiveLeafChange,
			),
			this.plugin.app.workspace.on('file-open', this.handleFileOpen),
			this.plugin.app.workspace.on(
				'layout-change',
				this.handleLayoutChange,
			),
			this.plugin.app.workspace.on(
				'editor-change',
				this.handleEditorChange,
			),
		);
	}

	private unregisterWorkspaceListeners(): void {
		for (const ref of this.workspaceEventRefs) {
			this.plugin.app.workspace.offref(ref);
		}

		this.workspaceEventRefs = [];
	}

	private scheduleUpdate(options?: {
		rebind?: boolean;
		reparse?: boolean;
	}): void {
		if (!this.enabled) {
			return;
		}

		this.pendingRebind = this.pendingRebind || !!options?.rebind;
		this.pendingReparse = this.pendingReparse || !!options?.reparse;
		this.clearUpdateTimer();
		this.updateTimer = window.setTimeout(() => {
			this.updateTimer = null;
			this.runUpdate();
		}, UPDATE_DEBOUNCE_MS);
	}

	private runUpdate(): void {
		if (!this.enabled) {
			return;
		}

		if (this.pendingRebind) {
			this.bindToActiveEditor();
		}

		const activeView = this.getActiveMarkdownEditorView();
		if (!activeView?.editor) {
			this.renderWithoutHeading('no-editor');
			this.resetPendingFlags();
			return;
		}

		if (!this.boundEditor || this.boundEditor !== activeView.editor) {
			this.bindToActiveEditor();
		}

		if (!this.boundEditor) {
			this.renderWithoutHeading('no-editor');
			this.resetPendingFlags();
			return;
		}

		if (
			this.pendingReparse ||
			!this.parsedEditorState ||
			this.parsedEditorState.editor !== this.boundEditor ||
			this.parsedEditorState.filePath !== (activeView.file?.path ?? null)
		) {
			this.parsedEditorState = this.parseActiveEditorState(
				this.boundEditor,
				activeView.file?.path ?? null,
			);
		}

		const sectionProgress = this.resolveSectionProgress(
			this.boundEditor,
			this.parsedEditorState,
		);
		if (!sectionProgress) {
			this.renderWithoutHeading('no-heading');
			this.resetPendingFlags();
			return;
		}

		this.renderSectionProgress(sectionProgress);
		this.resetPendingFlags();
	}

	private resetPendingFlags(): void {
		this.pendingRebind = false;
		this.pendingReparse = false;
	}

	private bindToActiveEditor(): void {
		const activeView = this.getActiveMarkdownEditorView();
		const nextEditor = activeView?.editor ?? null;
		const nextRootEl = activeView?.containerEl ?? null;
		const nextScrollEl = nextRootEl?.querySelector<HTMLElement>(
			EDITOR_SCROLL_SELECTOR,
		) ?? null;

		const didEditorChange =
			this.boundEditor !== nextEditor ||
			this.boundEditorRootEl !== nextRootEl ||
			this.boundEditorScrollEl !== nextScrollEl;

		if (!didEditorChange) {
			return;
		}

		this.unbindEditorListeners();

		this.boundEditor = nextEditor;
		this.boundEditorRootEl = nextRootEl;
		this.boundEditorScrollEl = nextScrollEl;
		this.parsedEditorState = null;

		if (!nextRootEl) {
			return;
		}

		nextRootEl.addEventListener('keyup', this.handleEditorPointerOrKey, true);
		nextRootEl.addEventListener('mouseup', this.handleEditorPointerOrKey, true);
		nextRootEl.addEventListener('touchend', this.handleEditorPointerOrKey, true);
		nextScrollEl?.addEventListener('scroll', this.handleEditorScroll, {
			passive: true,
		});
	}

	private unbindEditorListeners(): void {
		this.boundEditorRootEl?.removeEventListener(
			'keyup',
			this.handleEditorPointerOrKey,
			true,
		);
		this.boundEditorRootEl?.removeEventListener(
			'mouseup',
			this.handleEditorPointerOrKey,
			true,
		);
		this.boundEditorRootEl?.removeEventListener(
			'touchend',
			this.handleEditorPointerOrKey,
			true,
		);
		this.boundEditorScrollEl?.removeEventListener(
			'scroll',
			this.handleEditorScroll,
		);
		this.boundEditor = null;
		this.boundEditorRootEl = null;
		this.boundEditorScrollEl = null;
	}

	private resolveSectionProgress(
		editor: Editor,
		parsedEditorState: ParsedEditorState,
	): HeadingSectionProgress | null {
		const currentLine = this.resolveCurrentLine(editor);
		return resolveHeadingSectionProgress({
			headings: parsedEditorState.headings,
			lineCount: parsedEditorState.lineCount,
			currentLine,
		});
	}

	private resolveCurrentLine(editor: Editor): number {
		if (this.plugin.settings.headingProgressSource === 'cursor-position') {
			return editor.getCursor('head').line;
		}

		return this.resolveViewportCenterLine(editor);
	}

	private resolveViewportCenterLine(editor: Editor): number {
		const editorView = this.getEditorView(editor);
		const lineCount = editor.lineCount();
		if (!editorView) {
			return editor.getCursor('head').line;
		}

		const scrollInfo = editor.getScrollInfo();
		const viewportCenterY =
			scrollInfo.top + editorView.scrollDOM.clientHeight / 2;
		const lineBlock = editorView.lineBlockAtHeight(viewportCenterY);
		const line = editor.offsetToPos(lineBlock.from).line;
		return clamp(line, 0, Math.max(lineCount - 1, 0));
	}

	private parseActiveEditorState(
		editor: Editor,
		filePath: string | null,
	): ParsedEditorState {
		return {
			editor,
			filePath,
			lineCount: editor.lineCount(),
			headings: parseHeadings(editor),
		};
	}

	private renderSectionProgress(sectionProgress: HeadingSectionProgress): void {
		this.ensureStatusBarItem();
		if (
			!this.statusBarItemEl ||
			!this.labelEl ||
			!this.percentageEl ||
			!this.barEl ||
			!this.barFillEl
		) {
			return;
		}

		this.statusBarItemEl.toggleClass('is-hidden', false);
		this.statusBarItemEl.toggleClass(
			'is-percent-hidden',
			this.plugin.settings.headingProgressDisplayMode === 'bar-only',
		);
		this.statusBarItemEl.toggleClass(
			'is-bar-hidden',
			this.plugin.settings.headingProgressDisplayMode === 'percent-only',
		);

		this.labelEl.setText(`H${sectionProgress.topLevelHeadingLevel}`);
		this.percentageEl.setText(
			`${Math.round(sectionProgress.percentage)}%`,
		);
		this.barFillEl.setCssProps({
			width: `${sectionProgress.percentage}%`,
		});

		const dictionary = this.getDictionary();
		const headingTitle =
			sectionProgress.heading.title.trim() || '(untitled heading)';
		const tooltipLines = [
			`${dictionary.headingProgress.statusBar.tooltipHeadingTitle}: ${headingTitle}`,
			`${dictionary.headingProgress.statusBar.tooltipHeadingLevel}: H${sectionProgress.heading.level}`,
			`${dictionary.headingProgress.statusBar.tooltipLineRange}: ${sectionProgress.startLine + 1}-${sectionProgress.endLineExclusive}`,
			`${dictionary.headingProgress.statusBar.tooltipProgressSource}: ${this.getSourceLabel(this.plugin.settings.headingProgressSource)}`,
			`${dictionary.headingProgress.statusBar.tooltipPercentage}: ${formatExactPercentage(sectionProgress.percentage)}`,
		];
		this.statusBarItemEl.setAttribute('title', tooltipLines.join('\n'));
		this.statusBarItemEl.setAttribute(
			'aria-label',
			tooltipLines.join('. '),
		);
	}

	private renderWithoutHeading(reason: 'no-heading' | 'no-editor'): void {
		this.ensureStatusBarItem();
		if (!this.statusBarItemEl || !this.labelEl || !this.percentageEl) {
			return;
		}

		if (
			reason === 'no-editor' ||
			(reason === 'no-heading' &&
				this.plugin.settings.hideHeadingProgressWhenNoHeading)
		) {
			this.statusBarItemEl.toggleClass('is-hidden', true);
			this.statusBarItemEl.removeAttribute('title');
			this.statusBarItemEl.removeAttribute('aria-label');
			return;
		}

		const dictionary = this.getDictionary();
		const fallbackText = dictionary.headingProgress.statusBar.noHeading;
		this.statusBarItemEl.toggleClass('is-hidden', false);
		this.statusBarItemEl.addClass('is-bar-hidden');
		this.statusBarItemEl.removeClass('is-percent-hidden');
		this.labelEl.setText(fallbackText);
		this.percentageEl.setText('');
		this.barFillEl?.setCssProps({
			width: '0%',
		});
		this.statusBarItemEl.setAttribute('title', fallbackText);
		this.statusBarItemEl.setAttribute('aria-label', fallbackText);
	}

	private ensureStatusBarItem(): void {
		if (this.statusBarItemEl) {
			return;
		}

		const itemEl = this.plugin.addStatusBarItem();
		itemEl.addClass('nest-kit-heading-progress-status');

		const labelEl = itemEl.createEl('span', {
			cls: 'nest-kit-heading-progress-status__label',
		});
		const percentageEl = itemEl.createEl('span', {
			cls: 'nest-kit-heading-progress-status__percentage',
		});
		const barEl = itemEl.createEl('span', {
			cls: 'nest-kit-heading-progress-status__bar',
		});
		const barFillEl = barEl.createEl('span', {
			cls: 'nest-kit-heading-progress-status__bar-fill',
		});

		this.statusBarItemEl = itemEl;
		this.labelEl = labelEl;
		this.percentageEl = percentageEl;
		this.barEl = barEl;
		this.barFillEl = barFillEl;
	}

	private destroyStatusBarItem(): void {
		this.statusBarItemEl?.remove();
		this.statusBarItemEl = null;
		this.labelEl = null;
		this.percentageEl = null;
		this.barEl = null;
		this.barFillEl = null;
	}

	private clearUpdateTimer(): void {
		if (this.updateTimer === null) {
			return;
		}

		window.clearTimeout(this.updateTimer);
		this.updateTimer = null;
	}

	private getActiveMarkdownEditorView(): MarkdownView | null {
		const view =
			this.plugin.app.workspace.getActiveViewOfType(
				ObsidianMarkdownView,
			);
		if (!view || view.getMode() !== 'source' || !view.editor) {
			return null;
		}

		return view;
	}

	private isCurrentActiveEditor(
		editor: Editor,
		info: MarkdownView | MarkdownFileInfo,
	): boolean {
		const activeView = this.getActiveMarkdownEditorView();
		if (!activeView || activeView.editor !== editor) {
			return false;
		}

		if (info instanceof ObsidianMarkdownView) {
			return activeView === info;
		}

		const activeFilePath = activeView.file?.path ?? null;
		const infoFilePath = info.file?.path ?? null;
		return !!activeFilePath && activeFilePath === infoFilePath;
	}

	private getEditorView(editor: Editor): EditorView | null {
		const editorWithView = editor as Editor & {
			cm?: EditorView;
		};
		return editorWithView.cm ?? null;
	}

	private getDictionary(): NestKitDictionary & HeadingProgressDictionaryExtension {
		return getDictionary(
			this.plugin.settings.uiLanguage,
		) as NestKitDictionary & HeadingProgressDictionaryExtension;
	}

	private getSourceLabel(source: HeadingProgressSource): string {
		const dictionary = this.getDictionary();
		return source === 'viewport-center'
			? dictionary.headingProgress.statusBar.sourceViewportCenter
			: dictionary.headingProgress.statusBar.sourceCursorPosition;
	}
}

function formatExactPercentage(value: number): string {
	const rounded = Math.round(value * 10) / 10;
	return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}
