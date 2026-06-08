export const DRAWER_ENABLED_BODY_CLASS = 'nest-kit-sidebar-drawer-enabled';
export const PINNED_WORKSPACE_CLASS = 'nest-kit-sidebar-pinned';
export const PIN_BUTTON_CLASS = 'nest-kit-sidebar-pin-button';

export const WORKSPACE_SELECTOR = '.workspace';
export const RIGHT_DOCK_OPEN_WORKSPACE_SELECTOR =
	'.workspace.is-right-sidedock-open';
export const RIGHT_SPLIT_SELECTOR = ':scope > .workspace-split.mod-right-split';
export const RIGHT_HEADER_SELECTOR =
	':scope > .workspace-tabs > .workspace-tab-header-container';

export function getWorkspaceElement(
	root: ParentNode = activeDocument,
): HTMLElement | null {
	return root.querySelector<HTMLElement>(RIGHT_DOCK_OPEN_WORKSPACE_SELECTOR);
}

export function getAnyWorkspaceElement(
	root: ParentNode = activeDocument,
): HTMLElement | null {
	return root.querySelector<HTMLElement>(WORKSPACE_SELECTOR);
}

export function getRightSplitElement(
	workspaceEl: ParentNode,
): HTMLElement | null {
	return workspaceEl.querySelector<HTMLElement>(RIGHT_SPLIT_SELECTOR);
}

export function getRightHeaderElement(
	rightSplitEl: ParentNode,
): HTMLElement | null {
	return rightSplitEl.querySelector<HTMLElement>(RIGHT_HEADER_SELECTOR);
}
