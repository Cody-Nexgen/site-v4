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
    options?: { timeoutMs?: number },
): Promise<T & {
    ok?: boolean;
    error?: string;
    code?: 'timeout' | 'port_error';
    progression?: FocusProgressionState;
}> {
    return new Promise((resolve) => {
        let settled = false;
        const timeoutMs = options?.timeoutMs ?? 10_000;
        const finish = (response: unknown) => {
            if (settled) return;
            settled = true;
            globalThis.clearTimeout(timeout);
            resolve((response ?? {}) as T & { ok?: boolean; error?: string });
        };
        const timeout = globalThis.setTimeout(() => {
            finish({
                ok: false,
                code: 'timeout',
                error: `Background request timed out after ${timeoutMs}ms. The write may still complete.`,
            });
        }, timeoutMs);

        try {
            chrome.runtime.sendMessage(message, (resp) => {
                const error = chrome.runtime.lastError;
                if (error) {
                    finish({
                        ok: false,
                        code: 'port_error',
                        error: error.message || 'The extension background connection closed.',
                    });
                    return;
                }
                finish(resp ?? {});
            });
        } catch (error) {
            finish({
                ok: false,
                code: 'port_error',
                error: error instanceof Error ? error.message : 'Could not contact the extension background.',
            });
        }
    });
}

let challengeFocusScoreTimer: ReturnType<typeof globalThis.setTimeout> | undefined;

export function scheduleChallengeFocusScore(score: number, delayMs = 400): () => void {
    if (challengeFocusScoreTimer) globalThis.clearTimeout(challengeFocusScoreTimer);
    const timer = globalThis.setTimeout(async () => {
        if (challengeFocusScoreTimer === timer) challengeFocusScoreTimer = undefined;
        const response = await sendProgressionMessage({
            type: 'SET_CHALLENGE_FOCUS_SCORE',
            focusScore: score,
        });
        if (response.ok === false) {
            console.warn('[Challenges] Focus-score update failed:', response.error ?? response);
        }
    }, delayMs);
    challengeFocusScoreTimer = timer;
    return () => {
        if (challengeFocusScoreTimer !== timer) return;
        globalThis.clearTimeout(timer);
        challengeFocusScoreTimer = undefined;
    };
}
