/** Keyboard shortcut for the FocuzNow command palette: Alt+K (⌥K on Mac). */

export const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/** Label for kbd hints and tooltips. */
export const PALETTE_SHORTCUT_LABEL = IS_MAC ? '⌥ K' : 'Alt K';

/** Alt/⌥+K without other modifiers. Uses `code` because ⌥K types "˚" on a Mac. */
export function isPaletteShortcut(event: KeyboardEvent): boolean {
    return event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.code === 'KeyK';
}
