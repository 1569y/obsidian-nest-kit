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
} as const;
