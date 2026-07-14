export const enDictionary = {
	settings: {
		tabs: {
			general: 'General',
			workspacePanel: 'Workspace Panel',
			headingProgress: 'Heading Progress',
			rewardReader: 'Reward Reader',
			spacedReview: 'Spaced Review',
			about: 'About',
		},
		actions: {
			whatsNew: "What's New",
			language: 'Language',
			restoreDefaults: 'Restore defaults',
		},
		general: {
			title: 'General',
			description:
				'Manage feature overview and core feature toggles.',
		},
		workspacePanel: {
			description:
				'Adjust the Workspace Panel drawer behavior and layout.',
		},
		whatsNew: {
			title: "What's New",
			phase2: 'Added Right Sidebar Drawer.',
			phase25:
				'Added Spaced Review task creation, overview management, and Daily Note sync.',
			later:
				'Added Heading Progress Phase 1A status bar MVP. It shows progress inside the current top-level heading section, supports viewport-center and cursor-position source modes, supports bar and percent, percent only, and bar only display modes, stays disabled by default, reads only the active Markdown editor, and does not scan the vault.',
		},
		about: {
			title: 'About',
			version: 'Version',
			description: 'NestKit is a local-first Obsidian toolbox.',
			released: 'Released',
			releasedSummary:
				'Right Sidebar Drawer, Spaced Review, Heading Progress Phase 1A',
			currentBranch: 'Current release',
			currentBranchSummary:
				'Heading Progress Phase 1A status bar MVP is released in 0.4.0',
			performance:
				'This phase keeps settings fast to open and fully offline.',
		},
		notices: {
			languageComingSoon:
				'Language toggle will be added in a later settings phase.',
		},
		interfaceLanguageName: 'Interface language',
		interfaceLanguageDesc:
			'Choose the language used by the NestKit settings tab and pin button labels.',
		languageOptions: {
			'zh-CN': '\u7b80\u4f53\u4e2d\u6587',
			en: 'English',
		},
		sections: {
			rightSidebarDrawer: 'Right sidebar drawer',
			behaviour: 'Behaviour',
			positioning: 'Positioning',
			advanced: 'Advanced',
			spacedReview: 'Spaced Review',
		},
		toggles: {
			enableDrawerName: 'Enable right sidebar hover drawer',
			enableDrawerDesc:
				'Turn the hover drawer behaviour on or off for the right sidebar.',
			showPinButtonName: 'Show pin button',
			showPinButtonDesc:
				'Show or hide the pin button inside the right sidebar header.',
			rememberPinnedStateName: 'Remember pinned state',
			rememberPinnedStateDesc:
				'Restore the last pinned state after restarting Obsidian, re-enabling the plugin, or reopening the right sidebar.',
			enableRewardReaderName: 'Enable Reward Reader',
			enableRewardReaderDesc:
				'Turn the Reward Reader foundation module on or off.',
			enableSpacedReviewName: 'Enable Spaced Review',
			enableSpacedReviewDesc:
				'Turn Spaced Review core features on or off.',
		},
		rewardReader: {
			name: 'Reward Reader',
			description:
				'Configure the default-off Reward Reader foundation settings for study-to-unlock reading rules only. This phase does not yet add import, reader, status bar, or sidebar UI.',
			sections: {
				exchange: 'Exchange rules',
				limits: 'Limits',
				reading: 'Reading',
			},
			minutesPerUnit: {
				name: 'Study minutes per unit',
				description:
					'How many study minutes are required for one exchange unit.',
			},
			chaptersPerUnit: {
				name: 'Unlocked chapters per unit',
				description:
					'How many chapters one exchange unit unlocks.',
			},
			carryOverMinutes: {
				name: 'Carry over leftover minutes',
				description:
					'Keep remaining study minutes in balance instead of discarding them after conversion.',
			},
			dailyUnlockCap: {
				name: 'Daily unlock cap',
				description:
					'Maximum chapters that can be unlocked per day. Set 0 for no cap.',
			},
			unreadInventoryCap: {
				name: 'Unread inventory cap',
				description:
					'Maximum unlocked-but-unread chapters to keep available. Set 0 for no cap.',
			},
			requireStudyContent: {
				name: 'Require study content',
				description:
					'Require a non-empty study-content note when recording study in later phases.',
			},
			defaultReadingMode: {
				name: 'Default reading mode',
				description:
					'Choose which Reward Reader mode should be used by default once the reader view exists.',
				continuous: 'Continuous',
				singleChapter: 'Single chapter',
			},
		},
		spacedReview: {
			name: 'Spaced Review',
			description:
				'Configure Spaced Review defaults, Daily Note sync, and lightweight overview options.',
			dailyNote: {
				heading: 'Daily Note',
			},
			enableDailyNoteSync: {
				name: 'Enable Daily Note sync',
				description:
					'Allow Spaced Review to write today\'s review entry block into a configured Daily Note.',
			},
			dailyNoteFolder: {
				name: 'Daily note folder',
				description:
					'Folder used when building the Daily Note path. Leave empty to write notes at the vault root. Create this folder first before syncing.',
			},
			dailyNoteDateFormat: {
				name: 'Daily note date format',
				description:
					'Filename-only date format for the Daily Note path. Unsupported patterns, or formats that add folder separators, fall back to YYYY-MM-DD.',
			},
			dailyNoteSectionHeading: {
				name: 'Daily note section heading',
				description:
					'Legacy single-heading fallback for the Daily Note managed section path.',
			},
			dailyNoteSectionPath: {
				name: 'Daily Note section path',
				description:
					'Each line represents one heading level. For example:\nTask\nIELTS\nwill sync into # Task > ## IELTS.',
				placeholderTop: 'Task',
				placeholderBottom: 'IELTS',
			},
			dailyNoteCreateIfMissing: {
				name: 'Create Daily Note if missing',
				description:
					'Create the note file when it does not exist. The configured folder must already exist; missing folders are reported instead of auto-created.',
			},
			dailyNoteSyncMode: {
				name: 'Daily Note sync mode',
				description:
					'Choose whether sync runs only by command or once when the overview opens.',
				manualOnly: 'Manual only',
				onOverviewOpen: 'On overview open',
			},
			defaultPreset: {
				name: 'Default preset',
				description:
					'Choose the default built-in preset used when creating a new review task.',
			},
			includeTodayAsFirstReview: {
				name: 'Include today as the first review',
				description:
					'When enabled, preset intervals start with 0 so a review is due on the creation day.',
			},
			customPresets: {
				heading: 'Presets',
				name: 'Custom presets',
				description:
					'One custom preset per line in the format Name = days. Invalid lines are skipped.',
				placeholderTop: 'IELTS short = 0 1 3 7',
				placeholderBottom: 'Thesis long = 1 7 14 30',
				invalidLines: (lines: string): string =>
					`Skipped invalid custom preset lines: ${lines}.`,
			},
			targetLink: {
				heading: 'Target link',
				openMode: {
					name: 'Open mode',
					description:
						"Controls the Open buttons in Spaced Review views. When the dedicated Daily Note option below is enabled, generated Daily Note review links also follow this mode through Obsidian URI links; regular wiki links keep Obsidian's native behaviour.",
					current: 'Open in current pane',
					newTab: 'Open in new tab',
				},
				dailyNoteLinksUseOpenMode: {
					name: 'Daily Note review links use open mode',
					description:
						'When enabled, review links in Daily Notes are generated as Obsidian URI links and follow the target link open mode; new-tab mode uses paneType=tab. When disabled, regular wiki links are generated.',
				},
			},
			completedDisplay: {
				name: 'Completed occurrence display',
				description:
					'Control how completed occurrences should be shown in later phases.',
				remove: 'Remove after completion',
				keepChecked: 'Keep checked item',
			},
			reviewPlan: {
				name: 'Review plan',
				description:
					'Choose the default catch-up strategy used for new tasks.',
				catchUp: 'Catch-up plan',
				fixed: 'Fixed plan',
			},
			showOverdueBadge: {
				name: 'Show overdue badge',
				description:
					'Show overdue badges in the overview.',
			},
			showGroupJumpChips: {
				name: 'Show group jump chips',
				description:
					'Show top-level group jump chips in the All tasks view when multiple groups are present.',
			},
			showArchivedView: {
				name: 'Show archived view',
				description:
					'Keep the Archived tab visible in the overview.',
			},
			showOverviewRibbonButton: {
				name: 'Show overview ribbon button',
				description:
					'Show a ribbon shortcut for opening the Spaced Review overview.',
			},
			showDailyNoteSyncRibbonButton: {
				name: 'Show Daily Note sync ribbon button',
				description:
					'Show a ribbon shortcut for syncing today\'s reviews to the Daily Note.',
			},
			showEditorContextMenuItem: {
				name: 'Show add-to-spaced-review item in editor context menu',
				description:
					'Show an add-to-spaced-review entry in the Markdown editor context menu.',
			},
			presetOptions: {
				quickReview: 'Quick review',
				standardReview: 'Standard review',
				longTermMemory: 'Long-term memory',
			},
			timelineMode: {
				name: 'Default timeline mode',
				description:
					'Choose the default timeline mode used for newly created tasks.',
				fixedTimeline: 'Fixed timeline',
				rollingTimeline: 'Rolling timeline',
			},
			missedReviewPolicy: {
				name: 'Default missed review policy',
				description:
					'Choose how newly created tasks handle missed reviews.',
				carryOver: 'Carry over',
				skip: 'Skip',
			},
		},
		headingProgress: {
			heading: 'Heading Progress',
			description:
				'Disabled by default. Show progress for the current top-level heading section in the active Markdown editor only, and do not scan the whole vault.',
			sections: {
				general: 'General',
				source: 'Progress source',
				display: 'Display',
			},
			enable: {
				name: 'Enable Heading Progress',
				description:
					'Show a compact status bar progress item for the active Markdown editor.',
			},
			source: {
				name: 'Progress source',
				description:
					'Choose whether progress follows the viewport center or the active cursor line.',
				viewportCenter: 'Viewport center',
				cursorPosition: 'Cursor position',
			},
			displayMode: {
				name: 'Display mode',
				description:
					'Choose whether the status bar item shows the bar, the percentage, or both.',
				barAndPercent: 'Bar and percent',
				percentOnly: 'Percent only',
				barOnly: 'Bar only',
			},
			hideWhenNoHeading: {
				name: 'Hide when no active heading',
				description:
					'Hide the status bar item when the current cursor or viewport position is not inside a top-level heading section.',
			},
		},
		sliders: {
			edgeTriggerWidth: {
				name: 'Edge trigger width',
				description: 'Controls the hover trigger width at the right screen edge.',
			},
			collapseDelay: {
				name: 'Collapse delay',
				description: 'Controls how long the drawer waits before collapsing.',
			},
			animationDuration: {
				name: 'Animation duration',
				description: 'Controls the drawer slide animation speed.',
			},
			drawerWidth: {
				name: 'Drawer width',
				description: 'Controls the drawer card width.',
			},
			drawerHeight: {
				name: 'Drawer height',
				description:
					'Control the drawer height as a percentage of the window height. The drawer will not exceed the available area limited by the top offset and bottom gap.',
			},
			drawerTopOffset: {
				name: 'Drawer top offset',
				description:
					'Controls how far below the top chrome the drawer begins.',
			},
			drawerBottomGap: {
				name: 'Drawer bottom gap',
				description: 'Controls the empty space below the drawer card.',
			},
			drawerRightOffset: {
				name: 'Drawer right offset',
				description:
					'Controls the drawer card horizontal offset from the right edge.',
			},
			topControlOffset: {
				name: 'Top control offset',
				description:
					'Controls the leftward visual offset for the root sidebar controls. Values that are too small may cause overlap with Windows titlebar buttons.',
			},
			pinTopOffset: {
				name: 'Pin top offset',
				description: 'Controls the pin button top inset inside the drawer header.',
			},
			pinRightOffset: {
				name: 'Pin right offset',
				description:
					'Controls the pin button right inset inside the drawer header.',
			},
		},
		restoreAllDefaultsName: 'Restore all defaults',
		restoreAllDefaultsDesc:
			'Restore the NestKit language, feature toggles, pinned state, and positioning values to their initial defaults.',
		restoreAllDefaultsButton: 'Restore all defaults',
		restoreSingleSetting: 'Restore this setting to its default value',
		currentValue: (value: number, unit: string): string =>
			`Current: ${value}${unit}`,
	},
	pinButton: {
		pin: 'Pin right sidebar',
		unpin: 'Unpin right sidebar',
	},
	features: {
		headingProgress: {
			name: 'Heading Progress',
			description:
				'Status bar progress for the current top-level heading section in the active Markdown editor only.',
		},
		rewardReader: {
			name: 'Reward Reader',
			description:
				'Study-to-unlock reading feature shell with a minimal desktop import command and modal, but no reader UI yet.',
		},
		spacedReview: {
			name: 'Spaced Review',
			description:
				'Spaced review task creation and read-only overview access.',
		},
	},
	headingProgress: {
		statusBar: {
			noHeading: 'No heading',
			noEditor: 'No editor',
			sourceViewportCenter: 'Viewport center',
			sourceCursorPosition: 'Cursor position',
			tooltipHeadingTitle: 'Heading',
			tooltipHeadingLevel: 'Level',
			tooltipLineRange: 'Lines',
			tooltipProgressSource: 'Source',
			tooltipPercentage: 'Progress',
		},
	},
	commands: {
		rewardReader: {
			importNovel: {
				name: 'Reward Reader: Import novel',
			},
		},
		spacedReview: {
			createTask: {
				name: 'Create spaced review task',
			},
			openOverview: {
				name: 'Open spaced review overview',
			},
			syncDailyNote: {
				name: "Sync today's reviews to Daily Note",
				success: 'Today\'s reviews synced to Daily Note.',
				failed: 'Failed to sync today\'s reviews to Daily Note.',
				duplicateHeadingWarning:
					'Multiple Spaced Review Daily Note sections were found; only the first matching heading was updated.',
				checkedImported: 'Imported checked reviews from Daily Note.',
				duplicateHeadingCleaned:
					'Multiple Spaced Review Daily Note sections were detected; only the first matching heading is managed.',
				checkboxImportHint:
					'Daily Note checkboxes are imported during sync; they are not watched live.',
				unmatchedCheckedPreserved:
					'Could not match checked Daily Note reviews; the note was left unchanged.',
			},
			disabledNotice:
				'Enable Spaced Review in NestKit settings before creating a task.',
			createdNotice: 'Spaced review task created.',
			createFailedNotice:
				'Failed to create spaced review task. Check the console for details.',
		},
	},
		spacedReview: {
			notices: {
				enableFirst:
					'Enable Spaced Review in NestKit settings before opening the overview.',
			},
			overview: {
			title: 'Spaced review overview',
			empty: 'No review tasks yet.',
			noTasksHint: 'Use "Create spaced review task" first.',
			refresh: 'Refresh',
			help: 'Show overview legend',
				legendTitle: 'Legend',
				legendSymbols: 'Date chips',
				legendPresets: 'Presets',
				legendTrack: 'Track',
				legendDateNavigation: 'Jump by year, month, or week',
				legendTrackCompleted: 'date: completed',
				legendTrackSkipped: 'date: skipped',
				legendTrackOverdue: ': overdue',
				legendTrackCurrent: ': current',
				legendTrackPending: ': pending',
				legendDueCount: 'Blue number: reviews planned for that date',
				legendOverdueCount: 'Red number: overdue pending reviews',
				legendToday: 'Today: current date',
				legendSelectedDate:
					'Selected date: the date currently used by the Today view',
				legendReadOnly: 'Review track is read-only in this phase',
				dueTodayCount: (count: number): string => `Due today ${count}`,
				overdueCount: (count: number): string => `Overdue ${count}`,
				activeCount: (count: number): string => `Active ${count}`,
				allTasksGroupedHint: 'All tasks are grouped by group and subgroup.',
				weekRange: (start: string, end: string): string =>
					`${start} ~ ${end}`,
			previousWeek: 'Previous week',
			nextWeek: 'Next week',
			todayTab: 'Today',
			allTasksTab: 'All tasks',
			archivedTab: 'Archived',
			dueTodayBadge: 'Due today',
				overdueBadge: 'Overdue',
				futureBadge: 'Planned',
				activeBadge: 'Active',
				fastReview: 'Fast review',
				standardReview: 'Standard review',
				longTermMemory: 'Long-term memory',
				dateChipToday: 'Today',
				contentSectionAriaLabel: 'Overview content',
				dueCountCompact: (count: number): string => `${count}`,
				overdueCountCompact: (count: number): string => `${count}`,
			noDueToday: 'No reviews due today',
			noReviewsForDate: 'No reviews scheduled for this date',
			noPendingReviews: 'No pending review tasks',
			noArchivedTasks: 'No archived review tasks',
			archivedDescription:
				'Archiving hides tasks from the default list without deleting history.',
			customPreset: 'Custom preset',
				customPresetWithIntervals: (intervals: string): string =>
					`Custom: ${intervals}`,
				dueTodayLine: (count: number): string =>
					`Review #${count}`,
				overdueLine: (count: number): string =>
					`Review #${count}`,
				futureLine: (count: number): string =>
					`Review #${count}`,
				carriedToToday: 'Carried to today',
				plannedDateShort: (date: string): string => `Planned ${date}`,
				originalPlannedDate: (date: string): string => `Originally ${date}`,
				nextReviewCompact: (date: string): string => `Next ${date}`,
				progressCompact: (current: number, total: number): string =>
					`Progress ${current}/${total}`,
				progress: (current: number, total: number): string =>
					`Progress: review #${current} / ${total}`,
				reviewTrackItem: (reviewNumber: number): string =>
					`Review #${reviewNumber}`,
			current: 'Current',
			future: 'Future',
			completed: 'Completed',
			skipped: 'Skipped',
			ungrouped: 'Ungrouped',
			note: 'Note',
			expand: 'Expand',
			collapse: 'Collapse',
			missingTargetLink: 'No target link set',
			missingNote: 'No note',
			noneNoteText: 'None',
			noExtraNoteToExpand: 'No extra note to expand',
			openAction: 'Open',
			editAction: 'Edit',
			openOverviewRibbonTitle: 'Open Spaced Review overview',
			syncDailyNoteRibbonTitle: "Sync today's reviews to Daily Note",
			addToSpacedReviewContextMenu: 'Add to spaced review',
			openFailed: 'Failed to open target note.',
			archiveAction: 'Archive',
			restoreAction: 'Restore',
				noteAction: 'Note',
				syncNote: 'Sync note',
				syncNoteFailed: 'Failed to sync reviews to Daily Note.',
				archiveFailed: 'Failed to archive task.',
			restoreFailed: 'Failed to restore task.',
			editFailed: 'Failed to update task details.',
			completeAction: 'Complete',
				skipAction: 'Skip',
				completeFailed: 'Failed to complete the review.',
				skipFailed: 'Failed to skip the review.',
				futureStoreBlocked:
					'This review store was created by a newer version and cannot be modified.',
				actionUnavailable: 'This review is no longer available.',
				legendActionHint:
					'Complete advances the next review; Skip only marks the current step.',
			},
			dailyNote: {
				noReviewsToday: 'No reviews due today.',
				plannedDate: (date: string): string => `Planned ${date}`,
				reviewNumber: (reviewNumber: number): string =>
					`Review ${reviewNumber}`,
				overdue: 'Overdue',
				missingFolder:
					'Daily Note folder does not exist.',
				notAFile: 'The configured Daily Note path is not a Markdown file.',
				createdFile: 'Created today\'s Daily Note before syncing reviews.',
			},
		},
	modal: {
		rewardReader: {
			import: {
				title: 'Import Reward Reader novel',
				source: {
					name: 'Novel source file',
					description: 'Select one Vault TXT or Markdown novel file.',
					noSourceSelected: 'No source file selected.',
					chooseFile: 'Choose file',
					changeFile: 'Change file',
				},
				novelTitle: {
					name: 'Novel title',
					placeholder: 'Use a clear title for this imported novel',
				},
				makePrimary: {
					name: 'Set as primary novel',
					description:
						'Use this novel as the current primary Reward Reader target after import.',
				},
				status: {
					heading: 'Status',
					waitingForSource:
						'Choose one TXT or Markdown source file to prepare the import.',
					readyToImport:
						'Ready to import. The novel file will only be read after you select Import.',
					importing: 'Importing...',
					failedCanEdit:
						'Import failed before persistence completed. You can adjust the file or title and try again.',
					exactRetryRequired:
						'The import result could not be fully confirmed. Retry the exact same import request.',
				},
				buttons: {
					import: 'Import',
					retrySameImport: 'Retry same import',
					cancel: 'Cancel',
				},
				notices: {
					noEligibleFiles:
						'No TXT or Markdown files are available for Reward Reader import.',
					identityGenerationFailed:
						'Reward Reader could not create a safe import identity. Try again.',
					success: (title: string, chapterCount: number): string =>
						`Imported "${title}" with ${chapterCount} chapters.`,
					successWithWarnings: (
						title: string,
						chapterCount: number,
						warningCount: number,
					): string =>
						`Imported "${title}" with ${chapterCount} chapters. ${warningCount} warnings were recorded.`,
					invalidImportRequest:
						'Check the selected file and novel title, then try again.',
					initialStateReadBlocked:
						'Reward Reader data could not be read safely, so the import did not start.',
					persistenceStateReadBlocked:
						'Reward Reader data changed during import. Reconfirm and try again.',
					sourceInspectionBlocked:
						'The selected file could not be imported. Make sure it is a TXT or Markdown file with recognizable chapter headings.',
					importPreparationBlocked:
						'This novel conflicts with the existing Reward Reader import data.',
					storeApplicationBlocked:
						'Reward Reader data changed during import. Reconfirm and try again.',
					chapterCacheReadBlocked:
						'The chapter index for this novel could not be checked safely.',
					chapterCacheConflict:
						'A different chapter index already exists for this import identity, so the existing data was not overwritten.',
					chapterCacheWriteBlocked:
						'Reward Reader could not confirm whether the chapter index was fully written. Retry the same import.',
					stateWriteBlocked:
						'Reward Reader could not confirm whether the final import state was fully written. Retry the same import.',
					persistenceRuntimeFailed:
						'Reward Reader could not confirm whether this import completed. Retry the same import.',
					unexpectedRuntimeFailure:
						'Reward Reader could not confirm whether this import completed. Retry the same import.',
				},
			},
		},
		spacedReview: {
			createTitle: 'Create spaced review task',
			editTitle: 'Edit spaced review task',
			title: {
				name: 'Title',
				placeholder: 'Review chapter 3 notes',
			},
			group: {
				name: 'Group',
				placeholder: 'Select group',
				newPlaceholder: 'New group, optional',
			},
			subgroup: {
				name: 'Subgroup',
				placeholder: 'None',
				newPlaceholder: 'New subgroup, optional',
			},
			startDate: {
				name: 'Start date',
			},
			preset: {
				name: 'Preset',
				manualCustom: 'Manual custom',
				customPrefix: (name: string): string => `Custom: ${name}`,
			},
			customIntervals: {
				name: 'Custom intervals',
				description:
					'Optional. Enter cumulative day offsets separated by spaces, for example 1 3 7.',
				placeholder: '1 3 7',
			},
			reviewIntervals: 'Review intervals',
			note: {
				name: 'Note',
				placeholder: 'Add note',
			},
			targetLink: {
				name: 'Target link',
				placeholder: 'IELTS/Listening/Notes.md#Day 1',
				description:
					'Pick a Markdown file path, then append #Heading or #^block-id manually if needed.',
			},
			save: 'Save',
			saveChanges: 'Save changes',
			cancel: 'Cancel',
			deleteTask: 'Delete task',
			deleteTaskTitle: 'Delete this task?',
			deleteTaskMessage:
				'This cannot be undone. Daily Notes will update on the next sync.',
			deleteTaskConfirm: 'Delete',
			deleteTaskCancel: 'Cancel',
			taskDeleted: 'Spaced review task deleted.',
			editIntervalsWarningTitle: 'Change review intervals?',
			editIntervalsWarningMessage:
				'This task already has review history. Changing intervals will recalculate future plans and keep valid completed/skipped sequence indexes; records beyond the new interval range will be ignored.',
			editIntervalsConfirm: 'Continue',
			validation: {
				titleRequired: 'Enter a task title before saving.',
				invalidDate: 'Enter a valid start date in YYYY-MM-DD format.',
				invalidIntervals:
					'Custom intervals are invalid. Use increasing cumulative day offsets, and only place 0 at the beginning when needed.',
				groupAlreadyHasTaskName:
					'A review task with this name already exists in this group.',
				invalidCustomPresetSkipped: (lines: string): string =>
					`Skipped invalid custom preset lines in settings: ${lines}.`,
			},
		},
	},
} as const;
