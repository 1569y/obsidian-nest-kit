import type { FeatureModule } from '../../core/feature-module';
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

export class RightSidebarDrawerFeature implements FeatureModule {
	private enabled = false;
	private refreshTimer: number | null = null;
	private observer: MutationObserver | null = null;
	private observedSplitEl: HTMLElement | null = null;
	private readonly pinButton = new RightSidebarPinButtonController();

	constructor(private readonly plugin: NestKitPlugin) {
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
		activeDocument.body.classList.add(DRAWER_ENABLED_BODY_CLASS);
		this.refresh();
	}

	disable(): void {
		this.enabled = false;
		this.stopObserving();
		this.clearRefreshTimer();
		this.clearWorkspaceState();
		this.pinButton.destroy();
		activeDocument.body.classList.remove(DRAWER_ENABLED_BODY_CLASS);
	}

	refresh(): void {
		if (!this.enabled) {
			return;
		}

		activeDocument.body.classList.add(DRAWER_ENABLED_BODY_CLASS);

		const workspaceEl = getWorkspaceElement();
		if (!workspaceEl) {
			this.clearWorkspaceState();
			this.pinButton.destroy();
			this.stopObserving();
			return;
		}

		const rightSplitEl = getRightSplitElement(workspaceEl);
		if (!rightSplitEl) {
			workspaceEl.classList.remove(PINNED_WORKSPACE_CLASS);
			this.pinButton.destroy();
			this.stopObserving();
			return;
		}

		this.observeRightSplit(rightSplitEl);

		const headerEl = getRightHeaderElement(rightSplitEl);
		if (!headerEl || !this.plugin.settings.rightSidebarPinButtonEnabled) {
			workspaceEl.classList.remove(PINNED_WORKSPACE_CLASS);
			this.pinButton.destroy();
			return;
		}

		this.pinButton.sync(headerEl, workspaceEl, true);
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

	private clearWorkspaceState(): void {
		const workspaceEl = getAnyWorkspaceElement();
		workspaceEl?.classList.remove(PINNED_WORKSPACE_CLASS);
	}
}
