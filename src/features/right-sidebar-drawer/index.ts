import type { FeatureModule } from '../../core/feature-module';
import { getDictionary } from '../../i18n';
import type NestKitPlugin from '../../main';
import { RightSidebarPinButtonController } from './pin-button';
import {
	DRAWER_ENABLED_BODY_CLASS,
	PINNED_WORKSPACE_CLASS,
	getAnyWorkspaceElement,
	getRightHeaderElement,
	getRightSplitElement,
	getWorkspaceElement,
} from './selectors';

const REFRESH_DEBOUNCE_MS = 60;
const CSS_VARIABLE_MAPPINGS = [
	['--nest-kit-sidebar-drawer-top', 'rightSidebarDrawerTopPx', 'px'],
	['--nest-kit-sidebar-bottom-gap', 'rightSidebarDrawerBottomGapPx', 'px'],
	['--nest-kit-sidebar-drawer-right', 'rightSidebarDrawerRightOffsetPx', 'px'],
	['--nest-kit-sidebar-drawer-width', 'rightSidebarDrawerWidthPx', 'px'],
	['--nest-kit-sidebar-drawer-height', 'rightSidebarDrawerHeightVh', 'vh'],
	['--nest-kit-sidebar-edge-trigger-width', 'rightSidebarEdgeTriggerWidthPx', 'px'],
	['--nest-kit-sidebar-collapse-delay', 'rightSidebarCollapseDelayMs', 'ms'],
	[
		'--nest-kit-sidebar-animation-duration',
		'rightSidebarAnimationDurationMs',
		'ms',
	],
	['--nest-kit-sidebar-control-offset', 'rightSidebarTopControlOffsetPx', 'px'],
	['--nest-kit-sidebar-pin-top', 'rightSidebarPinTopPx', 'px'],
	['--nest-kit-sidebar-pin-right', 'rightSidebarPinRightPx', 'px'],
] as const;

export class RightSidebarDrawerFeature implements FeatureModule {
	private enabled = false;
	private refreshTimer: number | null = null;
	private observer: MutationObserver | null = null;
	private observedSplitEl: HTMLElement | null = null;
	private previousRightSidebarOpen = false;
	private readonly pinButton = new RightSidebarPinButtonController((pinned) =>
		this.handlePinnedStateChange(pinned),
	);

	constructor(private readonly plugin: NestKitPlugin) {
		// Phase 1 toolbox-core transition note:
		// the feature manager now lazily creates this module on first enable and
		// keeps the instance for later reuse, so these guarded listeners are
		// registered at most once per plugin session.
		this.plugin.registerEvent(
			this.plugin.app.workspace.on('layout-change', () => {
				if (!this.enabled) {
					return;
				}

				this.scheduleRefresh();
			}),
		);

		this.plugin.app.workspace.onLayoutReady(() => {
			if (!this.enabled) {
				return;
			}

			this.refresh();
		});

		this.plugin.register(() => this.disable());
	}

	enable(): void {
		if (this.enabled) {
			this.refresh();
			return;
		}

		this.enabled = true;
		this.previousRightSidebarOpen = false;
		activeDocument.body.classList.add(DRAWER_ENABLED_BODY_CLASS);
		this.applyCssVariables();
		this.refresh();
	}

	disable(): void {
		this.enabled = false;
		this.previousRightSidebarOpen = false;
		this.stopObserving();
		this.clearRefreshTimer();
		this.clearWorkspaceState();
		this.pinButton.destroy();
		activeDocument.body.classList.remove(DRAWER_ENABLED_BODY_CLASS);
		this.clearCssVariables();
	}

	refresh(): void {
		if (!this.enabled) {
			return;
		}

		activeDocument.body.classList.add(DRAWER_ENABLED_BODY_CLASS);
		this.applyCssVariables();
		const dictionary = getDictionary(this.plugin.settings.uiLanguage);

		const workspaceEl = getWorkspaceElement();
		if (!workspaceEl) {
			this.clearWorkspaceState();
			this.pinButton.destroy();
			this.stopObserving();
			return;
		}

		const rightSplitEl = getRightSplitElement(workspaceEl);
		if (!rightSplitEl) {
			this.previousRightSidebarOpen = false;
			this.clearRuntimePinnedState(workspaceEl);
			this.pinButton.destroy();
			this.stopObserving();
			return;
		}

		this.observeRightSplit(rightSplitEl);
		if (!this.previousRightSidebarOpen) {
			this.applyPersistentPinnedStateOnOpen(workspaceEl);
		}
		this.previousRightSidebarOpen = true;

		if (!this.plugin.settings.rightSidebarPinButtonEnabled) {
			void this.plugin.clearPinnedState({
				clearRuntime: true,
			});
			this.pinButton.destroy();
			return;
		}

		const headerEl = getRightHeaderElement(rightSplitEl);
		if (!headerEl) {
			this.pinButton.destroy();
			return;
		}

		this.pinButton.sync(headerEl, workspaceEl, true, dictionary.pinButton);
	}

	private scheduleRefresh(): void {
		this.clearRefreshTimer();

		this.refreshTimer = window.setTimeout(() => {
			this.refreshTimer = null;
			this.refresh();
		}, REFRESH_DEBOUNCE_MS);
	}

	private clearRefreshTimer(): void {
		if (this.refreshTimer === null) {
			return;
		}

		window.clearTimeout(this.refreshTimer);
		this.refreshTimer = null;
	}

	private observeRightSplit(rightSplitEl: HTMLElement): void {
		if (this.observedSplitEl === rightSplitEl && this.observer) {
			return;
		}

		this.stopObserving();

		this.observedSplitEl = rightSplitEl;
		this.observer = new MutationObserver(() => {
			if (!this.enabled) {
				return;
			}

			this.scheduleRefresh();
		});

		this.observer.observe(rightSplitEl, {
			childList: true,
			subtree: true,
		});
	}

	private stopObserving(): void {
		this.observer?.disconnect();
		this.observer = null;
		this.observedSplitEl = null;
	}

	isRuntimePinned(workspaceEl = getAnyWorkspaceElement()): boolean {
		return workspaceEl?.classList.contains(PINNED_WORKSPACE_CLASS) ?? false;
	}

	clearRuntimePinnedState(workspaceEl = getAnyWorkspaceElement()): void {
		workspaceEl?.classList.remove(PINNED_WORKSPACE_CLASS);
	}

	private clearWorkspaceState(): void {
		this.previousRightSidebarOpen = false;
		this.clearRuntimePinnedState();
	}

	private applyCssVariables(): void {
		const { style } = activeDocument.body;

		for (const [propertyName, settingKey, unit] of CSS_VARIABLE_MAPPINGS) {
			style.setProperty(
				propertyName,
				`${this.plugin.settings[settingKey]}${unit}`,
			);
		}
	}

	private clearCssVariables(): void {
		const { style } = activeDocument.body;

		for (const [propertyName] of CSS_VARIABLE_MAPPINGS) {
			style.removeProperty(propertyName);
		}
	}

	private applyPersistentPinnedStateOnOpen(workspaceEl: HTMLElement): void {
		if (
			this.plugin.settings.rememberPinnedState &&
			this.plugin.settings.rightSidebarPinned
		) {
			workspaceEl.classList.add(PINNED_WORKSPACE_CLASS);
			return;
		}

		this.clearRuntimePinnedState(workspaceEl);
	}

	private async handlePinnedStateChange(pinned: boolean): Promise<void> {
		await this.plugin.syncPersistentPinnedState(pinned);
	}
}
