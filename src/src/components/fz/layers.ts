/**
 * Stack of open overlays (sheets, dialogs, menus, popovers) so Escape only
 * closes the topmost one. Every overlay listens on `document` in the capture
 * phase, so without this a single Escape closed a menu *and* the sheet under it.
 */
const stack: symbol[] = [];

export function pushLayer(): symbol {
    const id = Symbol('fz-layer');
    stack.push(id);
    return id;
}

export function popLayer(id: symbol) {
    const i = stack.lastIndexOf(id);
    if (i >= 0) stack.splice(i, 1);
}

export function isTopLayer(id: symbol): boolean {
    return stack[stack.length - 1] === id;
}
