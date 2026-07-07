import { useCallback, useEffect, useState } from 'react';
import {
    getLevelProgress,
    loadProgressionState,
    type FocusProgressionState,
    type LevelProgress,
} from '../lib/focusProgression';

export function useFocusProgression() {
    const [progression, setProgression] = useState<FocusProgressionState | null>(null);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        const state = await loadProgressionState();
        setProgression(state);
        setLoading(false);
        return state;
    }, []);

    useEffect(() => {
        void refresh();

        const onMessage = (msg: { type?: string; state?: FocusProgressionState }) => {
            if (msg.type === 'PROGRESSION_UPDATED' && msg.state) {
                setProgression(msg.state);
            }
        };

        chrome.runtime.onMessage.addListener(onMessage);
        return () => chrome.runtime.onMessage.removeListener(onMessage);
    }, [refresh]);

    const levelProgress: LevelProgress | null = progression
        ? getLevelProgress(progression.xp)
        : null;

    return { progression, levelProgress, loading, refresh };
}

export async function sendProgressionMessage<T = unknown>(
    message: Record<string, unknown>,
): Promise<T & { ok?: boolean; progression?: FocusProgressionState }> {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage(message, (resp) => resolve(resp ?? {}));
    });
}
