import { Modal, Notice, setIcon } from 'obsidian';
import { getDictionary, type NestKitDictionary } from '../../i18n';
import type { NestKitSettings } from '../../settings';
import { CreateSpacedReviewTaskModal } from './create-task-modal';
import {
	importCheckedReviewsForToday,
	syncReviewItemsToDailyNote,
	syncTodayReviewsToDailyNote,
} from './daily-note-sync';
import {
	addCalendarDays,
	clampDateToMonth,
	getStartDateForWeek,
	getWeekCountForYear,
	getWeekNumberForDate,
	todayIsoDate,
} from './dates';
import {
	INLINE_SEPARATOR,
	buildSpacedReviewOverviewModel,
	getOverviewWeekStart,
	type ReviewTrackItem,
	type ReviewTaskOverviewGroup,
	type ReviewTaskOverviewItem,
	type SpacedReviewOverviewOccurrenceItem,
	type SpacedReviewWeekDayItem,
} from './overview-model';
import type { SpacedReviewFeature } from './index';
import { DuplicateReviewTaskTitleError } from './task-factory';
import type { ReviewTask } from './types';

interface SpacedReviewOverviewDictionaryExtension {
	modal: {
		spacedReview: {
			validation: {
				groupAlreadyHasTaskName: string;
			};
		};
	};
	spacedReview: {
		overview: {
			title: string;
			empty: string;
			noTasksHint: string;
			refresh: string;
			help: string;
			legendTitle: string;
			legendSymbols: string;
			legendPresets: string;
			legendDueCount: string;
			legendOverdueCount: string;
			legendToday: string;
			legendSelectedDate: string;
			legendReadOnly: string;
			legendTrack: string;
			legendDateNavigation: string;
			legendTrackCompleted: string;
			legendTrackSkipped: string;
			legendTrackOverdue: string;
			legendTrackCurrent: string;
			legendTrackPending: string;
			dueTodayCount: (count: number) => string;
			overdueCount: (count: number) => string;
			activeCount: (count: number) => string;
			allTasksGroupedHint: string;
			weekRange: (start: string, end: string) => string;
			previousWeek: string;
			nextWeek: string;
			todayTab: string;
			allTasksTab: string;
			archivedTab: string;
			activeBadge: string;
			dueTodayBadge: string;
			overdueBadge: string;
			futureBadge: string;
			dateChipToday: string;
			contentSectionAriaLabel: string;
			dueCountCompact: (count: number) => string;
			overdueCountCompact: (count: number) => string;
			noDueToday: string;
			noReviewsForDate: string;
			noPendingReviews: string;
			noArchivedTasks: string;
			archivedDescription: string;
			dueTodayLine: (reviewNumber: number) => string;
			overdueLine: (reviewNumber: number) => string;
			futureLine: (reviewNumber: number) => string;
			carriedToToday: string;
			plannedDateShort: (date: string) => string;
			originalPlannedDate: (date: string) => string;
			progress: (current: number, total: number) => string;
			nextReviewCompact: (date: string) => string;
			progressCompact: (current: number, total: number) => string;
			fastReview: string;
			standardReview: string;
			longTermMemory: string;
			customPreset: string;
			customPresetWithIntervals: (intervals: string) => string;
			reviewTrackItem: (reviewNumber: number) => string;
			current: string;
			future: string;
			completed: string;
			skipped: string;
			ungrouped: string;
			note: string;
			expand: string;
			collapse: string;
			missingTargetLink: string;
			missingNote: string;
			noneNoteText: string;
			noExtraNoteToExpand: string;
			openAction: string;
			editAction: string;
			openOverviewRibbonTitle: string;
			syncDailyNoteRibbonTitle: string;
			createReviewTaskContextMenu: string;
			syncNote: string;
			syncNoteFailed: string;
			openFailed: string;
			archiveAction: string;
			restoreAction: string;
			noteAction: string;
			archiveFailed: string;
			restoreFailed: string;
			editFailed: string;
			completeAction: string;
			skipAction: string;
			completeFailed: string;
			skipFailed: string;
			futureStoreBlocked: string;
			actionUnavailable: string;
			legendActionHint: string;
		};
	};
}

type OverviewTabId = 'today' | 'allTasks' | 'archived';
type CalendarSelectorKind = 'year' | 'month' | 'week';
type ManagedTaskView = 'active' | 'archived';

export class SpacedReviewOverviewModal extends Modal {
	private static readonly NOTE_EXPAND_THRESHOLD = 40;
	private activeTab: OverviewTabId = 'today';
	private selectedDate = todayIsoDate();
	private weekStart = getOverviewWeekStart(todayIsoDate());
	private legendOpen = false;
	private readonly expandedTaskNotes = new Set<string>();
	private highlightedTaskId: string | null = null;
	private shouldScrollHighlightedCard = false;
	private legendPopoverEl: HTMLElement | null = null;
	private selectorPopoverEl: HTMLElement | null = null;
	private selectorHostEl: HTMLElement | null = null;
	private helpButtonEl: HTMLButtonElement | null = null;
	private syncNoteButtonEl: HTMLButtonElement | null = null;
	private pendingActionKey: string | null = null;
	private pendingTaskActionKey: string | null = null;
	private openSelector: CalendarSelectorKind | null = null;
	private hasSyncedDailyNoteOnOpen = false;
	private readonly handleModalClick = (event: MouseEvent): void => {
		this.scheduleNonVisibleFocusCleanup();
		if (!this.selectorPopoverEl) {
			return;
		}

		const target = event.target instanceof HTMLElement ? event.target : null;
		if (!target) {
			return;
		}

		if (
			target.closest('.nest-kit-spaced-review-overview__selector-popover') ||
			target.closest(
				'.nest-kit-spaced-review-overview__calendar-selector-button',
			)
		) {
			return;
		}

		this.clearSelectorPopover();
	};

	constructor(
		app: Modal['app'],
		private readonly getSettings: () => NestKitSettings,
		private readonly feature: SpacedReviewFeature,
	) {
		super(app);
	}

	onOpen(): void {
		this.modalEl.addClass('nest-kit-spaced-review-overview-modal');
		this.hasSyncedDailyNoteOnOpen = false;
		this.modalEl.addEventListener('click', this.handleModalClick);
		void this.renderOverview();
	}

	onClose(): void {
		this.clearLegendPopover();
		this.clearSelectorPopover();
		this.clearTitleActions();
		this.titleEl.removeClass('nest-kit-spaced-review-overview__native-title');
		this.titleEl.parentElement?.removeClass(
			'nest-kit-spaced-review-overview__native-title-row',
		);
		this.modalEl.removeEventListener('click', this.handleModalClick);
		this.modalEl.removeClass('nest-kit-spaced-review-overview-modal');
		this.contentEl.empty();
	}

	private getDictionary():
		| (NestKitDictionary & SpacedReviewOverviewDictionaryExtension) {
		return getDictionary(
			this.getSettings().uiLanguage,
		) as NestKitDictionary & SpacedReviewOverviewDictionaryExtension;
	}

	private async renderOverview(): Promise<void> {
		const dictionary = this.getDictionary();
		const { contentEl } = this;
		this.clearSelectorPopover();
		this.selectorHostEl = null;
		this.configureTitleRow(dictionary);
		contentEl.empty();
		contentEl.addClass('nest-kit-spaced-review-overview');
		const frameEl = contentEl.createDiv({
			cls: 'nest-kit-spaced-review-overview__frame',
		});

		const settings = this.getSettings();
		await this.maybeSyncDailyNoteOnOpen(settings);
		const result = await this.feature.readOverviewStore();
		const model = buildSpacedReviewOverviewModel({
			store: result.store,
			today: todayIsoDate(),
			selectedDate: this.selectedDate,
			weekStart: this.weekStart,
			overduePolicy: settings.spacedReviewOverduePolicy,
			scheduleMode: settings.spacedReviewScheduleMode,
			dictionary,
		});

		this.selectedDate = model.selectedDate;
		this.weekStart = model.weekNavigator.weekStart;
		const selectedDay = this.getSelectedWeekDay(model.weekNavigator.days);
		const headerEl = frameEl.createDiv({
			cls: 'nest-kit-spaced-review-overview__header',
		});
		const calendarPanelEl = headerEl.createDiv({
			cls: 'nest-kit-spaced-review-overview__calendar-panel',
		});
		this.selectorHostEl = calendarPanelEl;
		this.renderCalendarControls(calendarPanelEl, model, dictionary);
		this.renderDateSelector(calendarPanelEl, model.weekNavigator.days, dictionary);

		const topRowEl = headerEl.createDiv({
			cls: 'nest-kit-spaced-review-overview__top-row',
		});
		const tabsEl = topRowEl.createDiv({
			cls: 'nest-kit-spaced-review-overview__tabs',
		});
		this.createTabButton(
			tabsEl,
			'today',
			dictionary.spacedReview.overview.todayTab,
		);
		this.createTabButton(
			tabsEl,
			'allTasks',
			dictionary.spacedReview.overview.allTasksTab,
		);
		if (settings.spacedReviewShowArchivedView) {
			this.createTabButton(
				tabsEl,
				'archived',
				dictionary.spacedReview.overview.archivedTab,
			);
		} else if (this.activeTab === 'archived') {
			this.activeTab = 'allTasks';
		}

		const badgesEl = topRowEl.createDiv({
			cls: 'nest-kit-spaced-review-overview__badges',
		});
		this.createSummaryBadge(
			badgesEl,
			'nest-kit-spaced-review-overview__badge--today',
			dictionary.spacedReview.overview.dueTodayCount(model.dueTodayCount),
		);
		this.createSummaryBadge(
			badgesEl,
			'nest-kit-spaced-review-overview__badge--overdue',
			dictionary.spacedReview.overview.overdueCount(selectedDay?.overdueCount ?? 0),
		);
		this.createSummaryBadge(
			badgesEl,
			'nest-kit-spaced-review-overview__badge--active',
			dictionary.spacedReview.overview.activeCount(model.totalActiveTasks),
		);

		this.syncLegendPopover(dictionary);

		if (model.totalManagedTasks === 0) {
			const emptyEl = frameEl.createDiv({
				cls: 'nest-kit-spaced-review-overview__empty-card',
			});
			emptyEl.createEl('h3', {
				text: dictionary.spacedReview.overview.empty,
			});
			emptyEl.createEl('p', {
				text: dictionary.spacedReview.overview.noTasksHint,
			});
			this.scheduleNonVisibleFocusCleanup();
			return;
		}

		const panelEl = frameEl.createDiv({
			cls: 'nest-kit-spaced-review-overview__panel nest-kit-spaced-review-overview__content',
		});
		panelEl.ariaLabel = dictionary.spacedReview.overview.contentSectionAriaLabel;

		if (this.activeTab === 'today') {
			this.highlightedTaskId = null;
			this.renderTodayTab(
				panelEl,
				model.selectedDateOverdue,
				model.selectedDateDue,
				dictionary,
				model.selectedDate === model.today,
			);
			this.scheduleNonVisibleFocusCleanup();
			return;
		}

		if (this.activeTab === 'allTasks') {
			this.renderAllTasksTab(panelEl, model.activeTaskGroups, dictionary);
		} else {
			this.renderArchivedTab(panelEl, model.archivedTaskGroups, dictionary);
		}
		this.scheduleNonVisibleFocusCleanup();
	}

	private renderCalendarControls(
		containerEl: HTMLElement,
		model: ReturnType<typeof buildSpacedReviewOverviewModel>,
		dictionary: NestKitDictionary & SpacedReviewOverviewDictionaryExtension,
	): void {
		const controlsEl = containerEl.createDiv({
			cls: 'nest-kit-spaced-review-overview__calendar-toolbar',
		});
		const leftEl = controlsEl.createDiv({
			cls: 'nest-kit-spaced-review-overview__calendar-controls-left nest-kit-spaced-review-overview__calendar-locators',
		});
		const rightEl = controlsEl.createDiv({
			cls: 'nest-kit-spaced-review-overview__calendar-controls-right nest-kit-spaced-review-overview__week-controls',
		});

		const calendarSummary = this.getCalendarSummaryText(model.weekNavigator.days);
		this.createCalendarSelectorButton(
			leftEl,
			'year',
			calendarSummary.yearLabel,
			this.getCalendarUiText().yearSelectorLabel(calendarSummary.yearValue),
		);
		this.createCalendarSelectorButton(
			leftEl,
			'month',
			calendarSummary.monthLabel,
			this.getCalendarUiText().monthSelectorLabel(calendarSummary.monthValue),
		);
		this.createCalendarSelectorButton(
			leftEl,
			'week',
			calendarSummary.weekLabel,
			this.getCalendarUiText().weekSelectorLabel(calendarSummary.weekNumber),
		);

		const todayButton = leftEl.createEl('button', {
			cls: 'nest-kit-spaced-review-overview__calendar-today-button',
		});
		todayButton.type = 'button';
		todayButton.ariaLabel = this.getCalendarUiText().returnToToday;
		todayButton.title = this.getCalendarUiText().returnToToday;
		setIcon(todayButton, 'calendar');
		todayButton.addEventListener('click', () => {
			this.clearSelectorPopover();
			const today = todayIsoDate();
			this.weekStart = getOverviewWeekStart(today);
			this.selectedDate = today;
			this.highlightedTaskId = null;
			void this.renderOverview();
		});

		const previousButton = rightEl.createEl('button', {
			cls: 'nest-kit-spaced-review-overview__week-nav-button',
			text: '\u2039',
		});
		previousButton.type = 'button';
		previousButton.ariaLabel = dictionary.spacedReview.overview.previousWeek;
		previousButton.addEventListener('click', () => {
			this.clearSelectorPopover();
			this.weekStart = addCalendarDays(this.weekStart, -7);
			this.selectedDate = addCalendarDays(this.selectedDate, -7);
			this.highlightedTaskId = null;
			void this.renderOverview();
		});

		rightEl.createEl('div', {
			cls: 'nest-kit-spaced-review-overview__calendar-range',
			text: calendarSummary.rangeLabel,
		});

		const nextButton = rightEl.createEl('button', {
			cls: 'nest-kit-spaced-review-overview__week-nav-button',
			text: '\u203a',
		});
		nextButton.type = 'button';
		nextButton.ariaLabel = dictionary.spacedReview.overview.nextWeek;
		nextButton.addEventListener('click', () => {
			this.clearSelectorPopover();
			this.weekStart = addCalendarDays(this.weekStart, 7);
			this.selectedDate = addCalendarDays(this.selectedDate, 7);
			this.highlightedTaskId = null;
			void this.renderOverview();
		});
	}

	private createCalendarSelectorButton(
		containerEl: HTMLElement,
		selector: CalendarSelectorKind,
		text: string,
		ariaLabel: string,
	): void {
		const controlEl = containerEl.createEl('button', {
			cls: 'nest-kit-spaced-review-overview__calendar-pill nest-kit-spaced-review-overview__calendar-selector-button',
		});
		controlEl.type = 'button';
		controlEl.ariaLabel = ariaLabel;
		controlEl.title = ariaLabel;
		controlEl.ariaExpanded = this.openSelector === selector ? 'true' : 'false';
		controlEl.dataset.selector = selector;
		controlEl.createEl('span', {
			cls: 'nest-kit-spaced-review-overview__calendar-selector-label',
			text,
		});
		controlEl.createEl('span', {
			cls: 'nest-kit-spaced-review-overview__calendar-selector-caret',
			text: '\u25be',
		});
		if (this.openSelector === selector) {
			controlEl.addClass('is-open');
		}
		controlEl.addEventListener('click', (event) => {
			event.preventDefault();
			event.stopPropagation();
			this.toggleSelectorPopover(selector, controlEl);
		});
	}

	private renderDateSelector(
		containerEl: HTMLElement,
		days: SpacedReviewWeekDayItem[],
		dictionary: NestKitDictionary & SpacedReviewOverviewDictionaryExtension,
	): void {
		const selectorEl = containerEl.createDiv({
			cls: 'nest-kit-spaced-review-overview__date-selector',
		});
		const dateRowEl = selectorEl.createDiv({
			cls: 'nest-kit-spaced-review-overview__date-row',
		});

		for (const day of days) {
			const chipEl = dateRowEl.createEl('button', {
				cls: 'nest-kit-spaced-review-overview__date-chip',
			});
			chipEl.type = 'button';
			if (day.isSelected) {
				chipEl.addClass('is-active');
			}
			if (day.isToday) {
				chipEl.addClass('is-today');
			}

			chipEl.createEl('span', {
				cls: 'nest-kit-spaced-review-overview__day-chip-date',
				text: this.formatDayNumber(day.date),
			});
			chipEl.createEl('span', {
				cls: 'nest-kit-spaced-review-overview__day-chip-weekday',
				text: this.formatWeekdayNarrow(day.date),
			});
			const tooltipText = this.getWeekChipTooltipText(day, dictionary);
			chipEl.title = tooltipText;
			chipEl.ariaLabel = tooltipText;

			chipEl.addEventListener('click', () => {
				if (this.selectedDate === day.date) {
					return;
				}

				this.selectedDate = day.date;
				this.highlightedTaskId = null;
				void this.renderOverview();
			});
		}
	}

	private getWeekChipTooltipText(
		day: SpacedReviewWeekDayItem,
		dictionary: NestKitDictionary & SpacedReviewOverviewDictionaryExtension,
	): string {
		const uiText = this.getCalendarUiText();
		const todayLabel = day.isToday
			? `${INLINE_SEPARATOR}${dictionary.spacedReview.overview.dateChipToday}`
			: '';

		return `${day.dayLabel}${todayLabel}${INLINE_SEPARATOR}${uiText.dueLabel} ${day.dueCount}${INLINE_SEPARATOR}${uiText.overdueLabel} ${day.overdueCount}`;
	}

	private createSummaryBadge(
		containerEl: HTMLElement,
		modifierClass: string,
		text: string,
	): void {
		containerEl.createEl('span', {
			cls: `nest-kit-spaced-review-overview__badge ${modifierClass}`,
			text,
		});
	}

	private configureTitleRow(
		dictionary: NestKitDictionary & SpacedReviewOverviewDictionaryExtension,
	): void {
		const titleRowEl = this.titleEl.parentElement;
		if (!titleRowEl) {
			return;
		}

		this.titleEl.setText(dictionary.spacedReview.overview.title);
		this.titleEl.addClass('nest-kit-spaced-review-overview__native-title');
		titleRowEl.addClass('nest-kit-spaced-review-overview__native-title-row');
		this.clearTitleActions();

		const actionsEl = this.contentEl.ownerDocument.createElement('div');
		actionsEl.addClass('nest-kit-spaced-review-overview__native-title-actions');
		titleRowEl.appendChild(actionsEl);

		this.renderTitleActions(actionsEl, dictionary);
	}

	private clearTitleActions(): void {
		this.helpButtonEl = null;
		this.syncNoteButtonEl = null;
		const titleRowEl = this.titleEl.parentElement;
		titleRowEl
			?.querySelectorAll('.nest-kit-spaced-review-overview__native-title-actions')
			.forEach((element) => element.remove());
	}

	private renderTitleActions(
		containerEl: HTMLElement,
		dictionary: NestKitDictionary & SpacedReviewOverviewDictionaryExtension,
	): void {
		const helpButton = containerEl.createEl('button', {
			cls: 'nest-kit-spaced-review-overview__help-button',
			text: '?',
		});
		this.helpButtonEl = helpButton;
		helpButton.ariaLabel = dictionary.spacedReview.overview.help;
		helpButton.addEventListener('click', () => {
			this.clearSelectorPopover();
			this.legendOpen = !this.legendOpen;
			this.syncLegendPopover(dictionary);
		});

		if (this.getSettings().spacedReviewDailyNoteSyncEnabled) {
			const syncButton = containerEl.createEl('button', {
				cls: 'nest-kit-spaced-review-overview__refresh',
				text: dictionary.spacedReview.overview.syncNote,
			});
			this.syncNoteButtonEl = syncButton;
			syncButton.ariaLabel = dictionary.spacedReview.overview.syncNote;
			syncButton.addEventListener('click', () => {
				this.clearSelectorPopover();
				void this.syncDailyNoteFromOverview();
			});
		}

		const refreshButton = containerEl.createEl('button', {
			cls: 'nest-kit-spaced-review-overview__refresh',
			text: dictionary.spacedReview.overview.refresh,
		});
		refreshButton.ariaLabel = dictionary.spacedReview.overview.refresh;
		refreshButton.addEventListener('click', () => {
			this.clearSelectorPopover();
			void this.refreshOverviewState();
		});
	}

	private toggleSelectorPopover(
		selector: CalendarSelectorKind,
		buttonEl: HTMLButtonElement,
	): void {
		if (
			this.openSelector === selector &&
			this.selectorPopoverEl &&
			this.selectorPopoverEl.isConnected
		) {
			this.clearSelectorPopover();
			return;
		}

		this.renderSelectorPopover(selector, buttonEl);
	}

	private renderSelectorPopover(
		selector: CalendarSelectorKind,
		buttonEl: HTMLButtonElement,
	): void {
		if (!this.selectorHostEl) {
			return;
		}

		this.clearSelectorPopover();
		this.openSelector = selector;
		buttonEl.addClass('is-open');
		buttonEl.ariaExpanded = 'true';
		const popoverEl = this.selectorHostEl.createDiv({
			cls: 'nest-kit-spaced-review-overview__selector-popover',
		});
		this.selectorPopoverEl = popoverEl;
		const buttonRect = buttonEl.getBoundingClientRect();
		const hostRect = this.selectorHostEl.getBoundingClientRect();
		popoverEl.style.left = `${Math.max(0, buttonRect.left - hostRect.left)}px`;
		popoverEl.dataset.selector = selector;
		popoverEl.addEventListener('click', (event) => event.stopPropagation());

		const contentEl = popoverEl.createDiv({
			cls: 'nest-kit-spaced-review-overview__selector-popover-content',
		});
		if (selector === 'year') {
			this.renderYearSelector(contentEl);
		} else if (selector === 'month') {
			this.renderMonthSelector(contentEl);
		} else {
			this.renderWeekSelector(contentEl);
		}
	}

	private clearSelectorPopover(): void {
		this.selectorPopoverEl?.remove();
		this.selectorPopoverEl = null;
		this.selectorHostEl
			?.querySelectorAll<HTMLElement>(
				'.nest-kit-spaced-review-overview__calendar-selector-button.is-open',
			)
			.forEach((element) => {
				element.removeClass('is-open');
				element.setAttribute('aria-expanded', 'false');
			});
		this.openSelector = null;
	}

	private renderYearSelector(containerEl: HTMLElement): void {
		const { year, month, day } = this.getSelectedDateParts();
		const optionsEl = containerEl.createDiv({
			cls: 'nest-kit-spaced-review-overview__selector-grid is-year-grid',
		});

		for (let value = year - 3; value <= year + 3; value += 1) {
			this.createSelectorOptionButton(
				optionsEl,
				String(value),
				value === year,
				() => {
					this.jumpToDate(clampDateToMonth(value, month, day));
				},
			);
		}
	}

	private renderMonthSelector(containerEl: HTMLElement): void {
		const { year, month, day } = this.getSelectedDateParts();
		const optionsEl = containerEl.createDiv({
			cls: 'nest-kit-spaced-review-overview__selector-grid is-month-grid',
		});

		for (let value = 1; value <= 12; value += 1) {
			this.createSelectorOptionButton(
				optionsEl,
				this.formatMonthOnly(value),
				value === month,
				() => {
					this.jumpToDate(clampDateToMonth(year, value, day));
				},
			);
		}
	}

	private renderWeekSelector(containerEl: HTMLElement): void {
		const { year } = this.getSelectedDateParts();
		const currentWeek = getWeekNumberForDate(this.selectedDate);
		const currentWeekOffset = this.getWeekDayOffset();
		const optionsEl = containerEl.createDiv({
			cls: 'nest-kit-spaced-review-overview__selector-grid is-week-grid',
		});

		for (let value = 1; value <= getWeekCountForYear(year); value += 1) {
			this.createSelectorOptionButton(
				optionsEl,
				this.formatWeekLabel(value),
				value === currentWeek,
				() => {
					const weekStart = getStartDateForWeek(year, value);
					this.jumpToDate(this.getDateWithinYearWeek(year, weekStart, currentWeekOffset), {
						weekStart,
					});
				},
			);
		}
	}

	private createSelectorOptionButton(
		containerEl: HTMLElement,
		text: string,
		isActive: boolean,
		onSelect: () => void,
	): void {
		const buttonEl = containerEl.createEl('button', {
			cls: 'nest-kit-spaced-review-overview__selector-option',
			text,
		});
		buttonEl.type = 'button';
		buttonEl.ariaPressed = isActive ? 'true' : 'false';
		if (isActive) {
			buttonEl.addClass('is-active');
		}
		buttonEl.addEventListener('click', () => {
			this.clearSelectorPopover();
			onSelect();
		});
	}

	private jumpToDate(
		date: string,
		options?: {
			weekStart?: string;
		},
	): void {
		this.selectedDate = date;
		this.weekStart = options?.weekStart ?? getOverviewWeekStart(date);
		this.highlightedTaskId = null;
		void this.renderOverview();
	}

	private getSelectedDateParts(): {
		year: number;
		month: number;
		day: number;
	} {
		const [yearText, monthText, dayText] = this.selectedDate.split('-');
		return {
			year: Number(yearText),
			month: Number(monthText),
			day: Number(dayText),
		};
	}

	private getWeekDayOffset(): number {
		const selectedDate = this.parseIsoDate(this.selectedDate);
		const weekStart = this.parseIsoDate(this.weekStart);
		return Math.round(
			(selectedDate.getTime() - weekStart.getTime()) / 86400000,
		);
	}

	private getDateWithinYearWeek(
		year: number,
		weekStart: string,
		dayOffset: number,
	): string {
		const candidate = addCalendarDays(weekStart, dayOffset);
		const candidateYear = Number(candidate.slice(0, 4));
		if (candidateYear < year) {
			return `${year}-01-01`;
		}
		if (candidateYear > year) {
			return `${year}-12-31`;
		}
		return candidate;
	}

	private scheduleNonVisibleFocusCleanup(): void {
		window.setTimeout(() => {
			const activeElement = this.modalEl.ownerDocument.activeElement;
			if (!(activeElement instanceof HTMLButtonElement)) {
				return;
			}

			if (!this.modalEl.contains(activeElement)) {
				return;
			}

			if (activeElement.matches(':focus-visible')) {
				return;
			}

			activeElement.blur();
		}, 0);
	}

	private renderLegend(
		containerEl: HTMLElement,
		dictionary: NestKitDictionary & SpacedReviewOverviewDictionaryExtension,
	): void {
		const uiText = this.getCalendarUiText();
		containerEl.empty();
		containerEl.addClass('nest-kit-spaced-review-overview__legend-popover');
		const legendEl = containerEl.createDiv({
			cls: 'nest-kit-spaced-review-overview__legend',
		});
		legendEl.ariaLabel = dictionary.spacedReview.overview.legendTitle;

		const dateSectionEl = legendEl.createDiv({
			cls: 'nest-kit-spaced-review-overview__legend-section',
		});
		dateSectionEl.createEl('strong', {
			cls: 'nest-kit-spaced-review-overview__legend-section-title',
			text: dictionary.spacedReview.overview.legendSymbols,
		});
		const dateListEl = dateSectionEl.createDiv({
			cls: 'nest-kit-spaced-review-overview__legend-list',
		});
		this.createLegendTextRow(
			dateListEl,
			uiText.legendTodayLabel,
			uiText.legendTodayChip,
		);
		this.createLegendTextRow(
			dateListEl,
			uiText.legendSelectedLabel,
			uiText.legendSelectedChip,
		);
		this.createLegendTextRow(
			dateListEl,
			uiText.legendDateNavigationLabel,
			dictionary.spacedReview.overview.legendDateNavigation,
		);
		this.createLegendTextRow(
			dateListEl,
			uiText.legendCalendarLabel,
			uiText.legendReturnToToday,
		);
		this.createLegendTextRow(
			dateListEl,
			uiText.legendArrowLabel,
			uiText.legendWeekArrows,
		);

		const statsSectionEl = legendEl.createDiv({
			cls: 'nest-kit-spaced-review-overview__legend-section',
		});
		statsSectionEl.createEl('strong', {
			cls: 'nest-kit-spaced-review-overview__legend-section-title',
			text: uiText.statsTitle,
		});
		const statsListEl = statsSectionEl.createDiv({
			cls: 'nest-kit-spaced-review-overview__legend-list',
		});
		this.createLegendTextRow(
			statsListEl,
			uiText.legendTodayStatLabel,
			uiText.legendTodayStat,
		);
		this.createLegendTextRow(
			statsListEl,
			uiText.legendOverdueStatLabel,
			uiText.legendOverdueStat,
		);
		this.createLegendTextRow(
			statsListEl,
			uiText.legendActiveStatLabel,
			uiText.legendActiveStat,
		);
		this.createLegendTextRow(
			statsListEl,
			this.isChineseUi() ? '\u64cd\u4f5c' : 'Action',
			dictionary.spacedReview.overview.legendActionHint,
		);
		this.createLegendTextRow(
			statsListEl,
			dictionary.spacedReview.overview.allTasksTab,
			dictionary.spacedReview.overview.allTasksGroupedHint,
		);

		const trackSectionEl = legendEl.createDiv({
			cls: 'nest-kit-spaced-review-overview__legend-section',
		});
		trackSectionEl.createEl('strong', {
			cls: 'nest-kit-spaced-review-overview__legend-section-title',
			text: dictionary.spacedReview.overview.legendTrack,
		});
		const trackListEl = trackSectionEl.createDiv({
			cls: 'nest-kit-spaced-review-overview__legend-list',
		});
		this.createLegendTextRow(
			trackListEl,
			'\u2713',
			dictionary.spacedReview.overview.legendTrackCompleted,
		);
		this.createLegendTextRow(
			trackListEl,
			'>',
			dictionary.spacedReview.overview.legendTrackSkipped,
		);
		this.createLegendTextRow(
			trackListEl,
			'!',
			dictionary.spacedReview.overview.legendTrackOverdue,
		);
		this.createLegendTextRow(
			trackListEl,
			'\u25cf',
			dictionary.spacedReview.overview.legendTrackCurrent,
		);
		this.createLegendTextRow(
			trackListEl,
			'\u25cb',
			dictionary.spacedReview.overview.legendTrackPending,
		);

		const presetsSectionEl = legendEl.createDiv({
			cls: 'nest-kit-spaced-review-overview__legend-section',
		});
		presetsSectionEl.createEl('strong', {
			cls: 'nest-kit-spaced-review-overview__legend-section-title',
			text: dictionary.spacedReview.overview.legendPresets,
		});
		const presetsEl = presetsSectionEl.createDiv({
			cls: 'nest-kit-spaced-review-overview__legend-preset-list',
		});
		this.createLegendPresetRow(
			presetsEl,
			dictionary.spacedReview.overview.fastReview,
			'1 \u00b7 2 \u00b7 4 \u00b7 7 \u00b7 15',
		);
		this.createLegendPresetRow(
			presetsEl,
			dictionary.spacedReview.overview.standardReview,
			'1 \u00b7 3 \u00b7 7 \u00b7 15 \u00b7 30',
		);
		this.createLegendPresetRow(
			presetsEl,
			dictionary.spacedReview.overview.longTermMemory,
			'1 \u00b7 3 \u00b7 7 \u00b7 15 \u00b7 30 \u00b7 60 \u00b7 120',
		);
	}

	private syncLegendPopover(
		dictionary: NestKitDictionary & SpacedReviewOverviewDictionaryExtension,
	): void {
		if (!this.legendOpen || !this.helpButtonEl) {
			this.clearLegendPopover();
			return;
		}

		if (!this.legendPopoverEl) {
			this.legendPopoverEl = this.modalEl.createDiv({
				cls: 'nest-kit-spaced-review-overview__legend-overlay',
			});
		}

		this.renderLegend(this.legendPopoverEl, dictionary);
	}

	private clearLegendPopover(): void {
		this.legendPopoverEl?.remove();
		this.legendPopoverEl = null;
	}

	private createLegendTextRow(
		containerEl: HTMLElement,
		label: string,
		text: string,
	): void {
		const itemEl = containerEl.createDiv({
			cls: 'nest-kit-spaced-review-overview__legend-text-row',
		});
		itemEl.createEl('strong', {
			cls: 'nest-kit-spaced-review-overview__legend-text-label',
			text: label,
		});
		itemEl.createEl('span', {
			cls: 'nest-kit-spaced-review-overview__legend-text-body',
			text,
		});
	}

	private createLegendPresetRow(
		containerEl: HTMLElement,
		label: string,
		intervals: string,
	): void {
		const rowEl = containerEl.createDiv({
			cls: 'nest-kit-spaced-review-overview__legend-preset-row',
		});
		rowEl.createEl('span', {
			cls: 'nest-kit-spaced-review-overview__legend-preset-label',
			text: label,
		});
		rowEl.createEl('span', {
			cls: 'nest-kit-spaced-review-overview__legend-preset-intervals',
			text: intervals,
		});
	}

	private createTabButton(
		containerEl: HTMLElement,
		tabId: OverviewTabId,
		text: string,
	): void {
		const buttonEl = containerEl.createEl('button', {
			cls: 'nest-kit-spaced-review-overview__tab',
			text,
		});
		if (this.activeTab === tabId) {
			buttonEl.addClass('is-active');
		}
		buttonEl.addEventListener('click', () => {
			if (this.activeTab === tabId) {
				return;
			}

			this.activeTab = tabId;
			this.highlightedTaskId = null;
			void this.renderOverview();
		});
	}

	private renderTodayTab(
		containerEl: HTMLElement,
		overdueItems: SpacedReviewOverviewOccurrenceItem[],
		dueItems: SpacedReviewOverviewOccurrenceItem[],
		dictionary: NestKitDictionary & SpacedReviewOverviewDictionaryExtension,
		isTodaySelected: boolean,
	): void {
		if (overdueItems.length === 0 && dueItems.length === 0) {
			containerEl.createEl('p', {
				cls: 'nest-kit-spaced-review-overview__empty-state',
				text: isTodaySelected
					? dictionary.spacedReview.overview.noDueToday
					: dictionary.spacedReview.overview.noReviewsForDate,
			});
			return;
		}

		const cardsEl = containerEl.createDiv({
			cls: 'nest-kit-spaced-review-overview__today-card-grid',
		});
		for (const item of overdueItems) {
			this.renderTodayCard(cardsEl, item);
		}
		for (const item of dueItems) {
			this.renderTodayCard(cardsEl, item);
		}
	}

	private renderAllTasksTab(
		containerEl: HTMLElement,
		activeTaskGroups: ReviewTaskOverviewGroup[],
		dictionary: NestKitDictionary & SpacedReviewOverviewDictionaryExtension,
	): void {
		if (activeTaskGroups.length === 0) {
			containerEl.createEl('p', {
				cls: 'nest-kit-spaced-review-overview__empty-state',
				text: dictionary.spacedReview.overview.noPendingReviews,
			});
			return;
		}

		if (this.getSettings().spacedReviewShowGroupJumpChips && activeTaskGroups.length >= 2) {
			const chipsEl = containerEl.createDiv({
				cls: 'nest-kit-spaced-review-overview__group-chips',
			});
			for (const group of activeTaskGroups) {
				const chipEl = chipsEl.createEl('button', {
					cls: 'nest-kit-spaced-review-overview__group-chip',
				});
				chipEl.type = 'button';
				chipEl.createEl('span', {
					cls: 'nest-kit-spaced-review-overview__group-chip-label',
					text: group.label,
				});
				chipEl.createEl('span', {
					cls: 'nest-kit-spaced-review-overview__group-chip-count',
					text: String(group.taskCount),
				});
				chipEl.addEventListener('click', () => {
					const targetGroupEl = containerEl.querySelector<HTMLElement>(
						`[data-group-key="${group.key}"]`,
					);
					targetGroupEl?.scrollIntoView({
						block: 'start',
						behavior: 'smooth',
					});
				});
			}
		}

		const cardsEl = containerEl.createDiv({
			cls: 'nest-kit-spaced-review-overview__task-groups',
		});
		for (const group of activeTaskGroups) {
			const groupEl = cardsEl.createDiv({
				cls: 'nest-kit-spaced-review-overview__task-group',
			});
			groupEl.dataset.groupKey = group.key;
			const groupHeaderEl = groupEl.createDiv({
				cls: 'nest-kit-spaced-review-overview__task-group-header',
			});
			groupHeaderEl.createEl('h3', {
				cls: 'nest-kit-spaced-review-overview__task-group-title',
				text: group.label,
			});
			groupHeaderEl.createEl('span', {
				cls: 'nest-kit-spaced-review-overview__task-group-count',
				text: String(group.taskCount),
			});

			for (const subgroup of group.subgroups) {
				const subgroupEl = groupEl.createDiv({
					cls: 'nest-kit-spaced-review-overview__task-subgroup',
				});
				const shouldShowSubgroupHeader =
					!(group.isUngrouped && subgroup.isUngrouped);

				if (shouldShowSubgroupHeader) {
					const subgroupHeaderEl = subgroupEl.createDiv({
						cls: 'nest-kit-spaced-review-overview__task-subgroup-header',
					});
					subgroupHeaderEl.createEl('h4', {
						cls: 'nest-kit-spaced-review-overview__task-subgroup-title',
						text: subgroup.label,
					});
					subgroupHeaderEl.createEl('span', {
						cls: 'nest-kit-spaced-review-overview__task-subgroup-count',
						text: String(subgroup.taskCount),
					});
				}

				const subgroupCardsEl = subgroupEl.createDiv({
					cls: 'nest-kit-spaced-review-overview__cards nest-kit-spaced-review-overview__task-card-list',
				});
				for (const item of subgroup.tasks) {
					this.renderManagedTaskCard(
						subgroupCardsEl,
						item,
						dictionary,
						'active',
					);
				}
			}
		}

		if (this.highlightedTaskId && this.shouldScrollHighlightedCard) {
			this.shouldScrollHighlightedCard = false;
			const highlightedCard = cardsEl.querySelector<HTMLElement>(
				`[data-task-id="${this.highlightedTaskId}"]`,
			);
			if (highlightedCard) {
				window.setTimeout(() => {
					highlightedCard.scrollIntoView({
						block: 'center',
						behavior: 'smooth',
					});
				}, 0);
			}
		}
	}

	private renderArchivedTab(
		containerEl: HTMLElement,
		archivedTaskGroups: ReviewTaskOverviewGroup[],
		dictionary: NestKitDictionary & SpacedReviewOverviewDictionaryExtension,
	): void {
		if (!this.getSettings().spacedReviewShowArchivedView) {
			containerEl.createEl('p', {
				cls: 'nest-kit-spaced-review-overview__empty-state',
				text: dictionary.spacedReview.overview.noArchivedTasks,
			});
			return;
		}

		if (archivedTaskGroups.length === 0) {
			containerEl.createEl('p', {
				cls: 'nest-kit-spaced-review-overview__empty-state',
				text: dictionary.spacedReview.overview.noArchivedTasks,
			});
			return;
		}

		containerEl.createEl('p', {
			cls: 'nest-kit-spaced-review-overview__archived-hint',
			text: dictionary.spacedReview.overview.archivedDescription,
		});

		const cardsEl = containerEl.createDiv({
			cls: 'nest-kit-spaced-review-overview__task-groups',
		});
		for (const group of archivedTaskGroups) {
			const groupEl = cardsEl.createDiv({
				cls: 'nest-kit-spaced-review-overview__task-group',
			});
			const groupHeaderEl = groupEl.createDiv({
				cls: 'nest-kit-spaced-review-overview__task-group-header',
			});
			groupHeaderEl.createEl('h3', {
				cls: 'nest-kit-spaced-review-overview__task-group-title',
				text: group.label,
			});
			groupHeaderEl.createEl('span', {
				cls: 'nest-kit-spaced-review-overview__task-group-count',
				text: String(group.taskCount),
			});

			for (const subgroup of group.subgroups) {
				const subgroupEl = groupEl.createDiv({
					cls: 'nest-kit-spaced-review-overview__task-subgroup',
				});
				const shouldShowSubgroupHeader =
					!(group.isUngrouped && subgroup.isUngrouped);

				if (shouldShowSubgroupHeader) {
					const subgroupHeaderEl = subgroupEl.createDiv({
						cls: 'nest-kit-spaced-review-overview__task-subgroup-header',
					});
					subgroupHeaderEl.createEl('h4', {
						cls: 'nest-kit-spaced-review-overview__task-subgroup-title',
						text: subgroup.label,
					});
					subgroupHeaderEl.createEl('span', {
						cls: 'nest-kit-spaced-review-overview__task-subgroup-count',
						text: String(subgroup.taskCount),
					});
				}

				const subgroupCardsEl = subgroupEl.createDiv({
					cls: 'nest-kit-spaced-review-overview__cards nest-kit-spaced-review-overview__task-card-list',
				});
				for (const item of subgroup.tasks) {
					this.renderManagedTaskCard(
						subgroupCardsEl,
						item,
						dictionary,
						'archived',
					);
				}
			}
		}
	}

	private renderManagedTaskCard(
		containerEl: HTMLElement,
		item: ReviewTaskOverviewItem,
		dictionary: NestKitDictionary & SpacedReviewOverviewDictionaryExtension,
		view: ManagedTaskView,
	): void {
		const cardEl = containerEl.createDiv({
			cls: 'nest-kit-spaced-review-overview__card nest-kit-spaced-review-overview__task-card',
		});
		cardEl.setAttribute('data-task-id', item.task.id);
		if (this.highlightedTaskId === item.task.id) {
			cardEl.addClass('is-highlighted');
		}
		const layoutEl = cardEl.createDiv({
			cls: 'nest-kit-spaced-review-overview__task-card-layout',
		});
		const bodyEl = layoutEl.createDiv({
			cls: 'nest-kit-spaced-review-overview__task-card-body',
		});
		const headerEl = bodyEl.createDiv({
			cls: 'nest-kit-spaced-review-overview__task-card-header',
		});
		headerEl.createEl('h3', {
			cls: 'nest-kit-spaced-review-overview__task-card-title',
			text: item.title,
		});

		const metaRowEl = bodyEl.createDiv({
			cls: 'nest-kit-spaced-review-overview__task-card-meta-row',
		});
		metaRowEl.createEl('p', {
			cls: 'nest-kit-spaced-review-overview__task-card-summary',
			text: `${item.presetLabel}${INLINE_SEPARATOR}${item.progressCompactLabel}`,
		});

		this.renderTaskNote(bodyEl, item, dictionary);
		this.renderReviewTrack(bodyEl, item, dictionary);
		this.renderManagedTaskActions(layoutEl, item, dictionary, view);
	}

	private renderManagedTaskActions(
		containerEl: HTMLElement,
		item: ReviewTaskOverviewItem,
		dictionary: NestKitDictionary & SpacedReviewOverviewDictionaryExtension,
		view: ManagedTaskView,
	): void {
		const actionsEl = containerEl.createDiv({
			cls: 'nest-kit-spaced-review-overview__task-management-actions',
		});
		const railEl = actionsEl.createDiv({
			cls: 'nest-kit-spaced-review-overview__task-action-rail',
		});
		const statusActionKey = this.getTaskActionKey(item.task.id, view);
		const isPending = this.pendingTaskActionKey === statusActionKey;
		const actionText =
			view === 'archived'
				? dictionary.spacedReview.overview.restoreAction
				: dictionary.spacedReview.overview.archiveAction;
		const actionError =
			view === 'archived'
				? dictionary.spacedReview.overview.restoreFailed
				: dictionary.spacedReview.overview.archiveFailed;
		const shouldEnableNoteToggle = this.shouldShowTaskNoteToggle(item.task.note);
		const isNoteExpanded = this.expandedTaskNotes.has(item.task.id);
		const noteActionText = isNoteExpanded
			? dictionary.spacedReview.overview.collapse
			: dictionary.spacedReview.overview.expand;

		this.createManagedRailAction(
			railEl,
			'nest-kit-spaced-review-overview__rail-action nest-kit-spaced-review-overview__rail-action--open',
			dictionary.spacedReview.overview.openAction,
			async () => this.openTaskTargetLink(item.task.targetLink ?? ''),
			!item.task.targetLink,
			true,
			item.task.targetLink
				? undefined
				: dictionary.spacedReview.overview.missingTargetLink,
		);

		this.createManagedRailAction(
			railEl,
			'nest-kit-spaced-review-overview__rail-action nest-kit-spaced-review-overview__rail-action--edit',
			dictionary.spacedReview.overview.editAction,
			() => {
				this.openEditTaskModal(item.task);
			},
			false,
			true,
		);

		this.createManagedRailAction(
			railEl,
			'nest-kit-spaced-review-overview__rail-action nest-kit-spaced-review-overview__rail-action--note',
			noteActionText,
			() => {
				this.toggleTaskNote(item.task.id);
			},
			!shouldEnableNoteToggle,
			true,
			this.getTaskNoteToggleTitle(item.task.note),
		);

		this.createManagedRailAction(
			railEl,
			'nest-kit-spaced-review-overview__rail-action nest-kit-spaced-review-overview__rail-action--archive',
			actionText,
			async () => {
				if (this.pendingTaskActionKey) {
					return;
				}

				await this.runTaskAction(
					statusActionKey,
					() =>
						view === 'archived'
							? this.feature.restoreOverviewTask(item.task.id)
							: this.feature.archiveOverviewTask(item.task.id),
					actionError,
				);
			},
			isPending,
			true,
		);
	}

	private createManagedRailAction(
		containerEl: HTMLElement,
		className: string,
		text: string,
		onClick: () => Promise<void> | void,
		disabled = false,
		stopPropagation = false,
		title?: string,
	): HTMLButtonElement {
		const slotEl = containerEl.createDiv({
			cls: 'nest-kit-spaced-review-overview__action-slot',
		});
		return this.createActionButton(
			slotEl,
			className,
			text,
			onClick,
			disabled,
			stopPropagation,
			title,
		);
	}

	private renderTaskNote(
		containerEl: HTMLElement,
		item: ReviewTaskOverviewItem,
		dictionary: NestKitDictionary & SpacedReviewOverviewDictionaryExtension,
	): void {
		const noteEl = containerEl.createDiv({
			cls: 'nest-kit-spaced-review-overview__task-note',
		});
		const hasNote = typeof item.task.note === 'string' && item.task.note.trim().length > 0;
		const isExpanded = this.expandedTaskNotes.has(item.task.id);
		const canExpand = this.shouldShowTaskNoteToggle(item.task.note);
		if (isExpanded) {
			noteEl.addClass('is-expanded');
		}
		if (canExpand) {
			noteEl.addClass('is-expandable');
		}
		if (!hasNote) {
			noteEl.addClass('is-empty');
		}
		const noteLineEl = noteEl.createDiv({
			cls: 'nest-kit-spaced-review-overview__task-note-line',
		});
		noteLineEl.createEl('span', {
			cls: 'nest-kit-spaced-review-overview__task-note-label',
			text: `${dictionary.spacedReview.overview.note}:`,
		});
		noteLineEl.createEl('span', {
			cls: 'nest-kit-spaced-review-overview__task-note-preview',
			text: hasNote
				? item.notePreview
				: dictionary.spacedReview.overview.noneNoteText,
		});
		if (hasNote && isExpanded) {
			noteEl.createEl('div', {
				cls: 'nest-kit-spaced-review-overview__task-note-body',
				text: item.task.note,
			});
		}
	}

	private renderTodayCard(
		containerEl: HTMLElement,
		item: SpacedReviewOverviewOccurrenceItem,
	): void {
		const cardEl = containerEl.createDiv({
			cls: 'nest-kit-spaced-review-overview__card',
		});
		const headerEl = cardEl.createDiv({
			cls: 'nest-kit-spaced-review-overview__card-header',
		});
		headerEl.createEl('h3', {
			cls: 'nest-kit-spaced-review-overview__card-title',
			text: item.title,
		});
		headerEl.createEl('span', {
			cls: `nest-kit-spaced-review-overview__card-status nest-kit-spaced-review-overview__card-status--${item.badgeKind}`,
			text: item.badgeLabel,
		});

		const occurrenceRowEl = cardEl.createDiv({
			cls: 'nest-kit-spaced-review-overview__occurrence-row',
		});
		occurrenceRowEl.createEl('p', {
			cls: 'nest-kit-spaced-review-overview__card-line nest-kit-spaced-review-overview__occurrence-meta',
			text: item.secondaryLine
				? `${item.primaryLine}${INLINE_SEPARATOR}${item.secondaryLine}`
				: item.primaryLine,
		});

		if (item.task.targetLink || this.canActOnTodayItem(item)) {
			this.renderTodayCardActions(occurrenceRowEl, item);
		}

		cardEl.addClass('is-clickable');
		cardEl.addEventListener('click', () => {
			if (this.pendingActionKey) {
				return;
			}
			this.activeTab = 'allTasks';
			this.highlightedTaskId = item.task.id;
			this.shouldScrollHighlightedCard = true;
			void this.renderOverview();
		});
	}

	private renderTodayCardActions(
		containerEl: HTMLElement,
		item: SpacedReviewOverviewOccurrenceItem,
	): void {
		const dictionary = this.getDictionary();
		const actionsEl = containerEl.createDiv({
			cls: 'nest-kit-spaced-review-overview__card-actions',
		});
		const actionKey = this.getOccurrenceActionKey(item);
		const isPending = this.pendingActionKey === actionKey;

		if (item.task.targetLink) {
			this.createActionButton(
				actionsEl,
				'nest-kit-spaced-review-overview__open-button nest-kit-spaced-review-overview__action-button',
				dictionary.spacedReview.overview.openAction,
				async () => this.openTaskTargetLink(item.task.targetLink ?? ''),
				false,
				true,
			);
		}

		if (!this.canActOnTodayItem(item)) {
			return;
		}

		const completeButton = actionsEl.createEl('button', {
			cls: 'nest-kit-spaced-review-overview__complete-button nest-kit-spaced-review-overview__action-button',
			text: dictionary.spacedReview.overview.completeAction,
		});
		completeButton.type = 'button';
		completeButton.disabled = isPending;
		completeButton.ariaLabel = dictionary.spacedReview.overview.completeAction;
		completeButton.addEventListener('click', (event) => {
			event.preventDefault();
			event.stopPropagation();
			if (this.pendingActionKey) {
				return;
			}
			this.blurNonKeyboardButton(completeButton);
			void this.runOccurrenceAction(
				actionKey,
				() =>
					this.feature.completeOverviewOccurrence(
						item.task.id,
						item.occurrence.sequenceIndex,
					),
				dictionary.spacedReview.overview.completeFailed,
			);
		});

		const skipButton = actionsEl.createEl('button', {
			cls: 'nest-kit-spaced-review-overview__skip-button nest-kit-spaced-review-overview__action-button',
			text: dictionary.spacedReview.overview.skipAction,
		});
		skipButton.type = 'button';
		skipButton.disabled = isPending;
		skipButton.ariaLabel = dictionary.spacedReview.overview.skipAction;
		skipButton.addEventListener('click', (event) => {
			event.preventDefault();
			event.stopPropagation();
			if (this.pendingActionKey) {
				return;
			}
			this.blurNonKeyboardButton(skipButton);
			void this.runOccurrenceAction(
				actionKey,
				() =>
					this.feature.skipOverviewOccurrence(
						item.task.id,
						item.occurrence.sequenceIndex,
					),
				dictionary.spacedReview.overview.skipFailed,
			);
		});
	}

	private renderReviewTrack(
		containerEl: HTMLElement,
		item: ReviewTaskOverviewItem,
		_dictionary: NestKitDictionary & SpacedReviewOverviewDictionaryExtension,
	): void {
		const trackEl = containerEl.createDiv({
			cls: 'nest-kit-spaced-review-overview__review-track',
		});

		for (const reviewItem of item.reviewTrack) {
			this.renderReviewTrackItem(trackEl, reviewItem);
		}
	}

	private renderReviewTrackItem(
		containerEl: HTMLElement,
		reviewItem: ReviewTrackItem,
	): void {
		const itemEl = containerEl.createDiv({
			cls: `nest-kit-spaced-review-overview__review-track-chip is-${reviewItem.state}`,
		});
		itemEl.ariaLabel = reviewItem.accessibleLabel;
		itemEl.createEl('span', {
			cls: 'nest-kit-spaced-review-overview__review-track-chip-number',
			text: reviewItem.reviewNumberLabel,
		});
		if (reviewItem.dateLabel.length > 0) {
			itemEl.createEl('span', {
				cls: 'nest-kit-spaced-review-overview__review-track-chip-date',
				text: reviewItem.dateLabel,
			});
		}
	}

	private getSelectedWeekDay(
		days: SpacedReviewWeekDayItem[],
	): SpacedReviewWeekDayItem | undefined {
		return days.find((day) => day.date === this.selectedDate);
	}

	private getCalendarSummaryText(
		days: SpacedReviewWeekDayItem[],
	): {
		yearValue: number;
		yearLabel: string;
		monthValue: number;
		monthLabel: string;
		weekNumber: number;
		weekLabel: string;
		rangeLabel: string;
	} {
		const selectedDate = this.parseIsoDate(this.selectedDate);
		const weekStart = this.parseIsoDate(days[0]?.date ?? this.selectedDate);
		const weekEnd = this.parseIsoDate(days[days.length - 1]?.date ?? this.selectedDate);
		const yearValue = selectedDate.getUTCFullYear();
		const monthValue = selectedDate.getUTCMonth() + 1;
		const weekNumber = getWeekNumberForDate(this.selectedDate);

		return {
			yearValue,
			yearLabel: this.formatYearLabel(yearValue),
			monthValue,
			monthLabel: this.formatMonthOnly(monthValue),
			weekNumber,
			weekLabel: this.formatWeekLabel(weekNumber),
			rangeLabel: `${this.formatMonthDay(weekStart)} ~ ${this.formatMonthDay(weekEnd)}`,
		};
	}

	private getIntlLocale(): string {
		return this.isChineseUi() ? 'zh-CN' : 'en-US';
	}

	private isChineseUi(): boolean {
		return this.getSettings().uiLanguage === 'zh-CN';
	}

	private getCalendarUiText(): {
		returnToToday: string;
		dueLabel: string;
		overdueLabel: string;
		statsTitle: string;
		yearSelectorLabel: (year: number) => string;
		monthSelectorLabel: (month: number) => string;
		weekSelectorLabel: (weekNumber: number) => string;
		legendTodayLabel: string;
		legendSelectedLabel: string;
		legendDateNavigationLabel: string;
		legendCalendarLabel: string;
		legendArrowLabel: string;
		legendTodayStatLabel: string;
		legendOverdueStatLabel: string;
		legendActiveStatLabel: string;
		legendTodayChip: string;
		legendSelectedChip: string;
		legendWeekArrows: string;
		legendReturnToToday: string;
		legendTodayStat: string;
		legendOverdueStat: string;
		legendActiveStat: string;
	} {
		if (this.isChineseUi()) {
			return {
				returnToToday: '\u56de\u5230\u4eca\u5929',
				dueLabel: '\u5230\u671f',
				overdueLabel: '\u903e\u671f',
				statsTitle: '\u7edf\u8ba1',
				yearSelectorLabel: (year: number) => `\u9009\u62e9\u5e74\u4efd ${year}`,
				monthSelectorLabel: (month: number) => `\u9009\u62e9 ${month} \u6708`,
				weekSelectorLabel: (weekNumber: number) =>
					`\u9009\u62e9\u7b2c ${weekNumber} \u5468`,
				legendTodayLabel: '\u6d45\u84dd',
				legendSelectedLabel: '\u6df1\u84dd',
				legendDateNavigationLabel: '\u5e74 / \u6708 / \u5468',
				legendCalendarLabel: '\u65e5\u5386',
				legendArrowLabel: '\u2039 / \u203a',
				legendTodayStatLabel: '\u4eca\u65e5',
				legendOverdueStatLabel: '\u903e\u671f',
				legendActiveStatLabel: '\u8fdb\u884c\u4e2d',
				legendTodayChip: '\u4eca\u5929',
				legendSelectedChip: '\u5f53\u524d\u9009\u4e2d\u65e5\u671f',
				legendWeekArrows: '\u4e0a\u4e00\u5468 / \u4e0b\u4e00\u5468',
				legendReturnToToday: '\u56de\u5230\u4eca\u5929\u6240\u5728\u5468',
				legendTodayStat: '\u4eca\u5929\u5230\u671f',
				legendOverdueStat: '\u9009\u4e2d\u65e5\u671f\u7684\u903e\u671f\u672a\u5b8c\u6210',
				legendActiveStat: '\u5f53\u524d\u8fdb\u884c\u4e2d\u7684\u590d\u4e60\u4efb\u52a1',
			};
		}

		return {
			returnToToday: 'Return to today',
			dueLabel: 'Due',
			overdueLabel: 'Overdue',
			statsTitle: 'Stats',
			yearSelectorLabel: (year: number) => `Select year ${year}`,
			monthSelectorLabel: (month: number) => `Select month ${month}`,
			weekSelectorLabel: (weekNumber: number) => `Select week ${weekNumber}`,
			legendTodayLabel: 'Light blue',
			legendSelectedLabel: 'Deep blue',
			legendDateNavigationLabel: 'Year / month / week',
			legendCalendarLabel: 'Calendar',
			legendArrowLabel: '\u2039 / \u203a',
			legendTodayStatLabel: 'Today',
			legendOverdueStatLabel: 'Overdue',
			legendActiveStatLabel: 'Active',
			legendTodayChip: 'today',
			legendSelectedChip: 'selected date',
			legendWeekArrows: 'previous / next week',
			legendReturnToToday: 'back to today\u2019s week',
			legendTodayStat: 'due today',
			legendOverdueStat: 'overdue for selected date',
			legendActiveStat: 'active review tasks',
		};
	}

	private formatMonthOnly(month: number): string {
		if (this.isChineseUi()) {
			return `${month}\u6708`;
		}

		return new Intl.DateTimeFormat(this.getIntlLocale(), {
			month: 'short',
			timeZone: 'UTC',
		}).format(new Date(Date.UTC(2026, month - 1, 1)));
	}

	private formatYearLabel(year: number): string {
		return this.isChineseUi() ? `${year}\u5e74` : String(year);
	}

	private formatWeekLabel(weekNumber: number): string {
		return this.isChineseUi()
			? `\u7b2c${weekNumber}\u5468`
			: `Week ${weekNumber}`;
	}

	private formatWeekdayNarrow(date: string): string {
		return new Intl.DateTimeFormat(this.getIntlLocale(), {
			weekday: this.isChineseUi() ? 'narrow' : 'short',
		}).format(this.parseIsoDate(date));
	}

	private formatDayNumber(date: string): string {
		return String(this.parseIsoDate(date).getUTCDate());
	}

	private formatMonthDay(date: Date): string {
		return new Intl.DateTimeFormat(this.getIntlLocale(), {
			month: this.isChineseUi() ? 'numeric' : 'short',
			day: 'numeric',
		}).format(date);
	}

	private parseIsoDate(date: string): Date {
		const [yearText, monthText, dayText] = date.split('-');
		return new Date(
			Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText)),
		);
	}

	private canActOnTodayItem(item: SpacedReviewOverviewOccurrenceItem): boolean {
		return item.occurrence.isOverdue || item.occurrence.effectiveDate === todayIsoDate();
	}

	private getOccurrenceActionKey(item: SpacedReviewOverviewOccurrenceItem): string {
		return `${item.task.id}:${item.occurrence.sequenceIndex}`;
	}

	private getTaskActionKey(taskId: string, view: ManagedTaskView): string {
		return `${view}:${taskId}`;
	}

	private async runOccurrenceAction(
		actionKey: string,
		action: () => Promise<void>,
		fallbackMessage: string,
	): Promise<void> {
		this.pendingActionKey = actionKey;
		try {
			await this.renderOverview();
			await action();
		} catch (error) {
			console.error(error);
			new Notice(this.getActionErrorMessage(error, fallbackMessage));
		} finally {
			this.pendingActionKey = null;
			await this.renderOverview();
		}
	}

	private async runTaskAction(
		actionKey: string,
		action: () => Promise<void>,
		fallbackMessage: string,
	): Promise<void> {
		this.pendingTaskActionKey = actionKey;
		try {
			await this.renderOverview();
			await action();
		} catch (error) {
			console.error(error);
			new Notice(this.getActionErrorMessage(error, fallbackMessage));
		} finally {
			this.pendingTaskActionKey = null;
			await this.renderOverview();
		}
	}

	private async syncDailyNoteFromOverview(): Promise<void> {
		try {
			await syncTodayReviewsToDailyNote({
				app: this.app,
				settings: this.getSettings(),
				feature: this.feature,
			});
			await this.renderOverview();
		} catch (error) {
			console.error(error);
			new Notice(this.getDictionary().spacedReview.overview.syncNoteFailed);
		}
	}

	private async refreshOverviewState(): Promise<void> {
		try {
			const settings = this.getSettings();
			if (settings.spacedReviewDailyNoteSyncEnabled) {
				await importCheckedReviewsForToday({
					app: this.app,
					settings,
					feature: this.feature,
					silent: true,
				});
			}
		} catch (error) {
			console.error(error);
		} finally {
			await this.renderOverview();
		}
	}

	private async maybeSyncDailyNoteOnOpen(
		settings: NestKitSettings,
	): Promise<void> {
		if (this.hasSyncedDailyNoteOnOpen) {
			return;
		}

		this.hasSyncedDailyNoteOnOpen = true;
		try {
			if (!settings.spacedReviewDailyNoteSyncEnabled) {
				return;
			}

			const importResult = await importCheckedReviewsForToday({
				app: this.app,
				settings,
				feature: this.feature,
				silent: true,
			});
			if (
				settings.spacedReviewDailyNoteSyncMode !== 'onOverviewOpen' ||
				!importResult.shouldRewrite
			) {
				return;
			}

			const overviewItems = await this.feature.readTodayOverviewItems();
			await syncReviewItemsToDailyNote({
				app: this.app,
				settings,
				items: [...overviewItems.overdueItems, ...overviewItems.dueItems],
				date: todayIsoDate(),
				silent: true,
			});
		} catch (error) {
			console.error(error);
		}
	}

	private createActionButton(
		containerEl: HTMLElement,
		className: string,
		text: string,
		onClick: () => Promise<void> | void,
		disabled = false,
		stopPropagation = false,
		title?: string,
	): HTMLButtonElement {
		const buttonEl = containerEl.createEl('button', {
			cls: className,
			text,
		});
		buttonEl.type = 'button';
		buttonEl.disabled = disabled;
		buttonEl.ariaLabel = text;
		if (title) {
			buttonEl.title = title;
		}
		if (disabled) {
			buttonEl.addClass('is-disabled');
		}
		if (disabled) {
			buttonEl.tabIndex = -1;
		}
		buttonEl.addEventListener('click', (event) => {
			event.preventDefault();
			if (stopPropagation) {
				event.stopPropagation();
			}
			if (buttonEl.disabled) {
				return;
			}
			this.blurNonKeyboardButton(buttonEl);
			void onClick();
		});
		return buttonEl;
	}

	private toggleTaskNote(taskId: string): void {
		if (this.expandedTaskNotes.has(taskId)) {
			this.expandedTaskNotes.delete(taskId);
		} else {
			this.expandedTaskNotes.add(taskId);
		}
		void this.renderOverview();
	}

	private shouldShowTaskNoteToggle(note: string | undefined): boolean {
		if (typeof note !== 'string') {
			return false;
		}

		return (
			note.includes('\n') ||
			note.replace(/\s+/g, ' ').trim().length >
				SpacedReviewOverviewModal.NOTE_EXPAND_THRESHOLD
		);
	}

	private getTaskNoteToggleTitle(note: string | undefined): string | undefined {
		const dictionary = this.getDictionary();
		if (typeof note !== 'string' || note.trim().length === 0) {
			return dictionary.spacedReview.overview.missingNote;
		}

		if (!this.shouldShowTaskNoteToggle(note)) {
			return dictionary.spacedReview.overview.noExtraNoteToExpand;
		}

		return undefined;
	}

	private blurNonKeyboardButton(buttonEl: HTMLButtonElement): void {
		if (buttonEl.matches(':focus-visible')) {
			return;
		}

		window.setTimeout(() => {
			if (
				this.modalEl.contains(buttonEl) &&
				this.modalEl.ownerDocument.activeElement === buttonEl &&
				!buttonEl.matches(':focus-visible')
			) {
				buttonEl.blur();
			}
		}, 0);
	}

	private openEditTaskModal(task: ReviewTask): void {
		const modal = CreateSpacedReviewTaskModal.forEdit(
			this.app,
			this.getSettings(),
			task,
			async (input): Promise<ReviewTask | null> => {
				try {
					const updatedTask = await this.feature.updateOverviewTaskDetails(
						task.id,
						input,
					);
					await this.renderOverview();
					return updatedTask;
				} catch (error) {
					console.error(error);
					if (error instanceof DuplicateReviewTaskTitleError) {
						new Notice(
							this.getDictionary().modal.spacedReview.validation.groupAlreadyHasTaskName,
						);
					} else {
						new Notice(this.getDictionary().spacedReview.overview.editFailed);
					}
					return null;
				}
			},
			async (): Promise<boolean> => {
				try {
					const deleted = await this.feature.deleteOverviewTask(task.id);
					if (!deleted) {
						new Notice(this.getDictionary().spacedReview.overview.editFailed);
						await this.renderOverview();
						return true;
					}
					this.expandedTaskNotes.delete(task.id);
					if (this.highlightedTaskId === task.id) {
						this.highlightedTaskId = null;
					}
					await this.renderOverview();
					return true;
				} catch (error) {
					console.error(error);
					new Notice(this.getDictionary().spacedReview.overview.editFailed);
					await this.renderOverview();
					return false;
				}
			},
		);
		modal.open();
	}

	private async openTaskTargetLink(targetLink: string): Promise<void> {
		try {
			await this.app.workspace.openLinkText(
				targetLink,
				this.getActiveSourcePath(),
				this.getSettings().spacedReviewTargetLinkOpenMode === 'newTab'
					? true
					: false,
			);
		} catch (error) {
			console.error(error);
			new Notice(this.getDictionary().spacedReview.overview.openFailed);
		}
	}

	private getActiveSourcePath(): string {
		return this.app.workspace.getActiveFile()?.path ?? '';
	}

	private getActionErrorMessage(error: unknown, fallbackMessage: string): string {
		const dictionary = this.getDictionary();
		const message =
			error instanceof Error ? error.message : typeof error === 'string' ? error : '';

		if (message.includes('newer version')) {
			return dictionary.spacedReview.overview.futureStoreBlocked;
		}

		if (message.includes('not found') || message.includes('no longer actionable')) {
			return dictionary.spacedReview.overview.actionUnavailable;
		}

		return fallbackMessage;
	}
}
