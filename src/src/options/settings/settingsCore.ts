import { createContext } from 'react';
import { useAuthStore, type EngineState } from '../../lib/store';

/** Current settings search query (lower-cased, trimmed). Empty = show everything. */
export const SettingsSearchContext = createContext('');

/** Every word of the query must appear somewhere in the row's text. */
export function matchesQuery(query: string, parts: (string | undefined)[]): boolean {
    if (!query) return true;
    const hay = parts.filter(Boolean).join(' ').toLowerCase();
    return query.split(/\s+/).every((word) => hay.includes(word));
}

/**
 * Patch engine settings: optimistic in the store, then confirmed with the
 * engine's reply (the extension, or the web shim that forwards to it).
 */
export function patchEngine(settings: Partial<EngineState>): Promise<boolean> {
    useAuthStore.setState((s) => ({ engineState: { ...s.engineState, ...settings } }));
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'UPDATE_ENGINE_SETTINGS', settings }, (resp) => {
            const remote = resp?.state as EngineState | undefined;
            if (remote && typeof remote === 'object') {
                useAuthStore.setState({ engineState: { ...remote, ...settings } });
            }
            resolve(resp?.ok !== false && !chrome.runtime.lastError);
        });
    });
}

export type SettingsSectionId = 'account' | 'plan' | 'appearance' | 'versions' | 'blocking' | 'browsing' | 'youtube' | 'data';

export const SETTINGS_SECTION_IDS: SettingsSectionId[] = ['account', 'plan', 'appearance', 'versions', 'blocking', 'browsing', 'youtube', 'data'];
