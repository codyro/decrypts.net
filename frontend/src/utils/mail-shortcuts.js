/**
 * Keyboard shortcut handling for the mailbox page. The keydown handler stays
 * thin; all decisions are pure functions here so they can be unit-tested.
 */

export const isEditableTarget = (target) => {
    if (!target) return false;
    // jsdom (and some embedded browsers) do not compute isContentEditable;
    // the attribute check covers them.
    if (target.isContentEditable || target.getAttribute?.('contenteditable') === 'true') return true;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
};

// A button or link with focus activates natively on Enter — do not also
// trigger "open mail" on top of that.
export const isInteractiveTarget = (target) => {
    if (!target) return false;
    const tag = target.tagName;
    return tag === 'BUTTON' || tag === 'A';
};

/** True when a Naive UI modal, drawer or popover is currently open. */
export const hasOpenOverlay = (doc = document) =>
    !!doc.querySelector('.n-modal-container, .n-drawer-container, .n-popover, .n-popselect, .n-dropdown');

/**
 * Map a keydown event to a shortcut action, or null when it must be ignored.
 *
 * Rules: Ctrl/Meta/Alt held -> ignore; focus in input/textarea/select/
 * contenteditable -> ignore (except Escape); a modal/drawer/popover open ->
 * ignore (except Escape, which the owning component handles first — the
 * returned 'close' action only fires when no overlay is open).
 */
export const resolveShortcutAction = (event, { overlayOpen = false, filterInputExists = false } = {}) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return null;
    const key = event.key;
    if (key === 'Escape') return 'close';
    if (isEditableTarget(event.target)) return null;
    if (overlayOpen) return null;
    switch (key) {
        case 'c':
            return 'copyAddress';
        case 'r':
            return 'refresh';
        case 'j':
            return 'nextMail';
        case 'k':
            return 'prevMail';
        case 'o':
            return 'openMail';
        case 'Enter':
            return isInteractiveTarget(event.target) ? null : 'openMail';
        case '/':
            return filterInputExists ? 'focusFilter' : null;
        case '?':
            return 'showShortcuts';
        default:
            return null;
    }
};
