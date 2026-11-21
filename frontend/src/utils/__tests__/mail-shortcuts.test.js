// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { resolveShortcutAction, isEditableTarget, hasOpenOverlay } from '../mail-shortcuts';

const keyEvent = (key, { target = document.body, ctrlKey = false, metaKey = false, altKey = false } = {}) => ({
    key,
    target,
    ctrlKey,
    metaKey,
    altKey,
});

describe('resolveShortcutAction', () => {
    it('maps plain keys to actions', () => {
        expect(resolveShortcutAction(keyEvent('c'))).toBe('copyAddress');
        expect(resolveShortcutAction(keyEvent('r'))).toBe('refresh');
        expect(resolveShortcutAction(keyEvent('j'))).toBe('nextMail');
        expect(resolveShortcutAction(keyEvent('k'))).toBe('prevMail');
        expect(resolveShortcutAction(keyEvent('Enter'))).toBe('openMail');
        expect(resolveShortcutAction(keyEvent('o'))).toBe('openMail');
        expect(resolveShortcutAction(keyEvent('?'))).toBe('showShortcuts');
    });

    it('ignores unknown keys', () => {
        expect(resolveShortcutAction(keyEvent('x'))).toBeNull();
        expect(resolveShortcutAction(keyEvent('1'))).toBeNull();
    });

    it('ignores every shortcut when Ctrl, Meta or Alt is held', () => {
        expect(resolveShortcutAction(keyEvent('c', { ctrlKey: true }))).toBeNull();
        expect(resolveShortcutAction(keyEvent('r', { metaKey: true }))).toBeNull();
        expect(resolveShortcutAction(keyEvent('j', { altKey: true }))).toBeNull();
        expect(resolveShortcutAction(keyEvent('Enter', { ctrlKey: true }))).toBeNull();
    });

    it('ignores shortcuts when focus is in an input, textarea or select', () => {
        const input = document.createElement('input');
        const textarea = document.createElement('textarea');
        const select = document.createElement('select');
        expect(resolveShortcutAction(keyEvent('c', { target: input }))).toBeNull();
        expect(resolveShortcutAction(keyEvent('j', { target: textarea }))).toBeNull();
        expect(resolveShortcutAction(keyEvent('r', { target: select }))).toBeNull();
    });

    it('ignores shortcuts in contenteditable elements', () => {
        const editable = document.createElement('div');
        editable.setAttribute('contenteditable', 'true');
        expect(isEditableTarget(editable)).toBe(true);
        expect(resolveShortcutAction(keyEvent('c', { target: editable }))).toBeNull();
    });

    it('still resolves Escape in inputs', () => {
        const input = document.createElement('input');
        expect(resolveShortcutAction(keyEvent('Escape', { target: input }))).toBe('close');
    });

    it('ignores non-Escape shortcuts when an overlay is open', () => {
        expect(resolveShortcutAction(keyEvent('j'), { overlayOpen: true })).toBeNull();
        expect(resolveShortcutAction(keyEvent('?'), { overlayOpen: true })).toBeNull();
        expect(resolveShortcutAction(keyEvent('Escape'), { overlayOpen: true })).toBe('close');
    });

    it('does not hijack Enter on a focused button or link', () => {
        const button = document.createElement('button');
        const link = document.createElement('a');
        expect(resolveShortcutAction(keyEvent('Enter', { target: button }))).toBeNull();
        expect(resolveShortcutAction(keyEvent('Enter', { target: link }))).toBeNull();
    });

    it('resolves / to the filter only when a filter input exists', () => {
        expect(resolveShortcutAction(keyEvent('/'), { filterInputExists: true })).toBe('focusFilter');
        expect(resolveShortcutAction(keyEvent('/'), { filterInputExists: false })).toBeNull();
    });
});

describe('hasOpenOverlay', () => {
    it('detects naive-ui modal, drawer and popover containers', () => {
        const modal = document.createElement('div');
        modal.className = 'n-modal-container';
        document.body.appendChild(modal);
        expect(hasOpenOverlay()).toBe(true);
        modal.remove();

        const drawer = document.createElement('div');
        drawer.className = 'n-drawer-container';
        document.body.appendChild(drawer);
        expect(hasOpenOverlay()).toBe(true);
        drawer.remove();

        const popover = document.createElement('div');
        popover.className = 'n-popover';
        document.body.appendChild(popover);
        expect(hasOpenOverlay()).toBe(true);
        popover.remove();

        expect(hasOpenOverlay()).toBe(false);
    });
});
