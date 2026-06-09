import { enDictionary } from './locales/en';
import { zhCnDictionary } from './locales/zh-cn';

export type NestKitLanguage = 'zh-CN' | 'en';
export interface NestKitDictionary {
	settings: {
		interfaceLanguageName: string;
		interfaceLanguageDesc: string;
		languageOptions: Record<NestKitLanguage, string>;
		sections: {
			rightSidebarDrawer: string;
			behaviour: string;
			positioning: string;
			advanced: string;
		};
		toggles: {
			enableDrawerName: string;
			enableDrawerDesc: string;
			showPinButtonName: string;
			showPinButtonDesc: string;
			rememberPinnedStateName: string;
			rememberPinnedStateDesc: string;
		};
		sliders: {
			edgeTriggerWidth: {
				name: string;
				description: string;
			};
			collapseDelay: {
				name: string;
				description: string;
			};
			animationDuration: {
				name: string;
				description: string;
			};
			drawerWidth: {
				name: string;
				description: string;
			};
			drawerHeight: {
				name: string;
				description: string;
			};
			drawerTopOffset: {
				name: string;
				description: string;
			};
			drawerBottomGap: {
				name: string;
				description: string;
			};
			drawerRightOffset: {
				name: string;
				description: string;
			};
			topControlOffset: {
				name: string;
				description: string;
			};
			pinTopOffset: {
				name: string;
				description: string;
			};
			pinRightOffset: {
				name: string;
				description: string;
			};
		};
		restoreAllDefaultsName: string;
		restoreAllDefaultsDesc: string;
		restoreAllDefaultsButton: string;
		restoreSingleSetting: string;
		currentValue: (value: number, unit: string) => string;
	};
	pinButton: {
		pin: string;
		unpin: string;
	};
}

const DICTIONARIES: Record<NestKitLanguage, NestKitDictionary> = {
	'zh-CN': zhCnDictionary,
	en: enDictionary,
};

export function getDictionary(
	language: NestKitLanguage | undefined,
): NestKitDictionary {
	return DICTIONARIES[language ?? 'zh-CN'] ?? zhCnDictionary;
}
