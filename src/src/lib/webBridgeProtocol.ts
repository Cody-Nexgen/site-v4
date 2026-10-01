/**
 * The only runtime messages a FocuzNow web page may send through the extension's page bridge.
 * Anything else (the vault, the account session, internal state) stays between the extension's own parts.
 */

/** Blocking, timers and stats the web dashboard drives in the extension. */
export const WEB_EXTENSION_RPC_TYPES: ReadonlySet<string> = new Set([
    'START_SESSION',
    'TIMER_START',
    'TIMER_CANCEL',
    'BLOCK_DOMAIN',
    'CATEGORY_TOGGLE',
    'ADD_BLOCK',
    'REMOVE_BLOCK',
    'REMOVE_BLOCK_SOURCE',
    'ADD_ALLOWED_SITE',
    'REMOVE_ALLOWED_SITE',
    'GET_CATEGORY_STATES',
    'UPDATE_ENGINE_SETTINGS',
    'START_NUCLEAR',
    'SCHEDULE_ADD',
    'SCHEDULE_REMOVE',
    'EXPORT_LOCAL_STATS',
]);

export function isWebBridgeType(type: unknown): boolean {
    if (typeof type !== 'string') return false;
    // No FocuzPass messages: on the site, FocuzPass is the extension's own page in a frame
    // (lib/focuzPass/embed.ts), so vault contents never pass through a web page.
    return type.startsWith('FUTURE_SELF_') || WEB_EXTENSION_RPC_TYPES.has(type);
}
