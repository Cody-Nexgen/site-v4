const FOCUZNOW_MARKER = 'FOCUZNOW_ACTION:';

/** Brace-balanced JSON object starting at `start` (must point to `{`). */
function readJsonObject(content: string, start: number): { json: string; end: number } | null {
    if (content[start] !== '{') return null;
    let depth = 0;
    let inString = false;
    let escape = false;

    for (let j = start; j < content.length; j++) {
        const c = content[j];
        if (inString) {
            if (escape) escape = false;
            else if (c === '\\') escape = true;
            else if (c === '"') inString = false;
            continue;
        }
        if (c === '"') {
            inString = true;
            continue;
        }
        if (c === '{') depth++;
        else if (c === '}') {
            depth--;
            if (depth === 0) {
                return { json: content.slice(start, j + 1), end: j + 1 };
            }
        }
    }
    return null;
}

/** Extract all FOCUZNOW_ACTION JSON objects (supports nested `data` objects). */
export function parseCoachActionsFromContent(content: string): {
    text: string;
    rawActions: Record<string, unknown>[];
} {
    const rawActions: Record<string, unknown>[] = [];
    let firstMarker = -1;
    let searchFrom = 0;

    while (searchFrom < content.length) {
        const idx = content.indexOf(FOCUZNOW_MARKER, searchFrom);
        if (idx === -1) break;
        if (firstMarker === -1) firstMarker = idx;

        let i = idx + FOCUZNOW_MARKER.length;
        while (i < content.length && /\s/.test(content[i])) i++;

        if (content[i] === '{') {
            const parsed = readJsonObject(content, i);
            if (parsed) {
                try {
                    const obj = JSON.parse(parsed.json) as Record<string, unknown>;
                    if (obj && typeof obj === 'object') rawActions.push(obj);
                } catch {
                    /* skip */
                }
                searchFrom = parsed.end;
                continue;
            }
        }

        searchFrom = idx + FOCUZNOW_MARKER.length;
    }

    const text = firstMarker === -1 ? content.trim() : content.slice(0, firstMarker).trim();
    return { text, rawActions };
}

export function stripCoachActionMarkers(text: string): string {
    const idx = text.indexOf(FOCUZNOW_MARKER);
    if (idx === -1) return text.trim();
    return text.slice(0, idx).trim();
}
