import { setIcon } from 'obsidian';
import { PIN_BUTTON_CLASS, PINNED_WORKSPACE_CLASS } from './selectors';

const PIN_LABEL = '\u56fa\u5b9a\u53f3\u4fa7\u680f';
const UNPIN_LABEL = '\u53d6\u6d88\u56fa\u5b9a\u53f3\u4fa7\u680f';

export class RightSidebarPinButtonController {
	private buttonEl: HTMLButtonElement | null = null;
	private workspaceEl: HTMLElement | null = null;

	sync(
		headerEl: HTMLElement | null,
		workspaceEl: HTMLElement | null,
		visible: boolean,
	): void {
		this.workspaceEl = workspaceEl;

		if (!visible || !headerEl || !workspaceEl) {
			this.destroy();
			return;
		}

		if (!this.buttonEl || !headerEl.contains(this.buttonEl)) {
			this.destroyButtonOnly();
			this.buttonEl = this.createButton();

			const existingButton = headerEl.querySelector<HTMLElement>(
				`:scope > .${PIN_BUTTON_CLASS}`,
			);
			if (existingButton && existingButton !== this.buttonEl) {
				existingButton.remove();
			}

			headerEl.appendChild(this.buttonEl);
		}

		this.updateState();
	}

	destroy(): void {
		this.destroyButtonOnly();
		this.workspaceEl = null;
	}

	private createButton(): HTMLButtonElement {
		const button = activeDocument.createElement('button');

		button.type = 'button';
		button.className = `${PIN_BUTTON_CLASS} clickable-icon`;
		button.addEventListener('click', this.handleClick);

		return button;
	}

	private updateState(): void {
		if (!this.buttonEl || !this.workspaceEl) {
			return;
		}

		const pinned = this.workspaceEl.classList.contains(PINNED_WORKSPACE_CLASS);
		const label = pinned ? UNPIN_LABEL : PIN_LABEL;

		setIcon(this.buttonEl, 'pin');
		this.buttonEl.classList.toggle('is-active', pinned);
		this.buttonEl.setAttribute('aria-label', label);
		this.buttonEl.setAttribute('aria-pressed', String(pinned));
		this.buttonEl.setAttribute('title', label);
	}

	private destroyButtonOnly(): void {
		if (!this.buttonEl) {
			return;
		}

		this.buttonEl.removeEventListener('click', this.handleClick);
		this.buttonEl.remove();
		this.buttonEl = null;
	}

	private readonly handleClick = (event: MouseEvent): void => {
		event.preventDefault();
		event.stopPropagation();

		if (!this.workspaceEl) {
			return;
		}

		const nextPinned = !this.workspaceEl.classList.contains(
			PINNED_WORKSPACE_CLASS,
		);

		this.workspaceEl.classList.toggle(PINNED_WORKSPACE_CLASS, nextPinned);
		this.updateState();
	};
}
