export type EngineMessageResponse = {
    ok?: boolean;
    state?: Record<string, unknown>;
    error?: string;
    success?: boolean;
};

/** Reliable chrome.runtime.sendMessage with callback + lastError handling. */
export function sendEngineMessage(
    message: Record<string, unknown>,
): Promise<EngineMessageResponse> {
    return new Promise((resolve) => {
        try {
            chrome.runtime.sendMessage(message, (response) => {
                const err = chrome.runtime.lastError;
                if (err) {
                    resolve({ ok: false, error: err.message });
                    return;
                }
                resolve((response as EngineMessageResponse) ?? { ok: false });
            });
        } catch (e) {
            resolve({
                ok: false,
                error: e instanceof Error ? e.message : 'Extension messaging failed',
            });
        }
    });
}
