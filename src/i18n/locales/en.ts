export const enDictionary = {
	settings: {
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
			enableSpacedReviewName: 'Enable Spaced Review',
			enableSpacedReviewDesc:
				'Turn Spaced Review core features on or off.',
		},
		spacedReview: {
			name: 'Spaced Review',
			description:
				'Create and store spaced review tasks without Daily Note integration in this phase.',
			dailyNoteFolder: {
				name: 'Daily note folder',
				description:
					'Prepare the target Daily Note folder path for later phases. This phase does not write Daily Notes.',
			},
			dailyNoteDateFormat: {
				name: 'Daily note date format',
				description:
					'Prepare the Daily Note filename date format for later phases.',
			},
			managedBlockHeading: {
				name: 'Managed block heading',
				description:
					'Prepare the managed review block heading for later phases.',
			},
			defaultPreset: {
				name: 'Default preset',
				description:
					'Choose the default built-in preset used when creating a new review task.',
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
					'Prepare whether overdue badges should be shown in later phases.',
			},
			presetOptions: {
				fastReview: 'Fast review',
				standardReview: 'Standard review',
				longTermMemory: 'Long-term memory',
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
		spacedReview: {
			name: 'Spaced Review',
			description:
				'Spaced review task creation and store access.',
		},
	},
	commands: {
		spacedReview: {
			createTask: {
				name: 'Create spaced review task',
			},
			disabledNotice:
				'Enable Spaced Review in NestKit settings before creating a task.',
			createdNotice: 'Spaced review task created.',
			createFailedNotice:
				'Failed to create spaced review task. Check the console for details.',
		},
	},
	modal: {
		spacedReview: {
			createTitle: 'Create spaced review task',
			title: {
				name: 'Title',
				placeholder: 'Review chapter 3 notes',
			},
			startDate: {
				name: 'Start date',
			},
			preset: {
				name: 'Preset',
			},
			customIntervals: {
				name: 'Custom intervals',
				description:
					'Optional. Enter cumulative day offsets separated by spaces, for example 1 3 7.',
				placeholder: '1 3 7',
			},
			save: 'Save',
			cancel: 'Cancel',
			validation: {
				titleRequired: 'Enter a task title before saving.',
				invalidDate: 'Enter a valid start date in YYYY-MM-DD format.',
				invalidIntervals:
					'Custom intervals are invalid. Use positive increasing cumulative day offsets.',
			},
		},
	},
} as const;
