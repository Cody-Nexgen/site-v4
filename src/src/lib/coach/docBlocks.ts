/**
 * Coach documents ("artifacts"). The coach writes a document as a fenced block
 * inside its reply; the client lifts it out into a card + the Library:
 *
 *   ~~~focuz-doc
 *   title: Weekly focus plan
 *   type: plan
 *   ---
 *   # Markdown body…
 *   ~~~
 *
 * Backtick fences (```focuz-doc) are accepted too. Parsing is streaming-safe:
 * an unclosed block is returned with `complete: false`.
 */

export type DocType = 'plan' | 'routine' | 'study' | 'checklist' | 'notes' | 'report';

export const DOC_TYPES: DocType[] = ['plan', 'routine', 'study', 'checklist', 'notes', 'report'];

export const DOC_TYPE_LABEL: Record<DocType, string> = {
    plan: 'Focus plan',
    routine: 'Routine',
    study: 'Study plan',
    checklist: 'Checklist',
    notes: 'Notes',
    report: 'Report',
};

export type CoachDocDraft = {
    title: string;
    docType: DocType;
    markdown: string;
    complete: boolean;
};

export type ReplySegment = { kind: 'text'; text: string } | { kind: 'doc'; doc: CoachDocDraft };

const OPEN_RE = /^[ \t]*(~{3,}|`{3,})[ \t]*focuz-doc\b[^\n]*$/gm;

function normalizeType(raw: string | undefined): DocType {
    const t = (raw ?? '').trim().toLowerCase();
    if ((DOC_TYPES as string[]).includes(t)) return t as DocType;
    if (/study|exam|learn/.test(t)) return 'study';
    if (/routine|habit|morning|evening/.test(t)) return 'routine';
    if (/check|todo|list/.test(t)) return 'checklist';
    if (/report|review|summary|recap/.test(t)) return 'report';
    if (/note|essay|draft|outline/.test(t)) return 'notes';
    return 'plan';
}

/** Split `title:` / `type:` front-matter (up to a `---` line) from the body. */
function parseBody(raw: string): { title: string; docType: DocType; markdown: string } {
    const lines = raw.replace(/\r\n/g, '\n').split('\n');
    const meta: Record<string, string> = {};
    let i = 0;
    while (i < lines.length && i < 6) {
        const m = /^\s*(title|type)\s*:\s*(.*)$/i.exec(lines[i]);
        if (!m) break;
        meta[m[1].toLowerCase()] = m[2].trim();
        i++;
    }
    if (i < lines.length && /^\s*---\s*$/.test(lines[i])) i++;
    const markdown = lines.slice(i).join('\n').trim();
    let title = meta.title?.replace(/^["']|["']$/g, '').trim() ?? '';
    if (!title) {
        const h = /^#{1,3}\s+(.+)$/m.exec(markdown);
        title = h ? h[1].trim() : 'Untitled document';
    }
    return { title: title.slice(0, 120), docType: normalizeType(meta.type), markdown };
}

/** Split a (possibly still-streaming) reply into text and document segments. */
export function splitReply(content: string): ReplySegment[] {
    const out: ReplySegment[] = [];
    let cursor = 0;
    OPEN_RE.lastIndex = 0;
    let open: RegExpExecArray | null;
    while ((open = OPEN_RE.exec(content))) {
        const before = content.slice(cursor, open.index);
        if (before.trim()) out.push({ kind: 'text', text: before.trim() });

        const fence = open[1];
        const bodyStart = open.index + open[0].length + 1;
        const closeRe = new RegExp(`^[ \\t]*${fence[0] === '~' ? '~' : '`'}{${fence.length},}[ \\t]*$`, 'gm');
        closeRe.lastIndex = Math.min(bodyStart, content.length);
        const close = closeRe.exec(content);
        const body = content.slice(Math.min(bodyStart, content.length), close ? close.index : content.length);
        out.push({ kind: 'doc', doc: { ...parseBody(body), complete: Boolean(close) } });

        if (!close) return out;
        cursor = close.index + close[0].length;
        OPEN_RE.lastIndex = cursor;
    }
    const rest = content.slice(cursor);
    if (rest.trim()) out.push({ kind: 'text', text: rest.trim() });
    return out;
}

export function extractDocs(content: string): CoachDocDraft[] {
    return splitReply(content)
        .filter((s): s is { kind: 'doc'; doc: CoachDocDraft } => s.kind === 'doc')
        .map((s) => s.doc)
        .filter((d) => d.complete && d.markdown.length > 0);
}

/** Stable short hash (FNV-1a) — dedupes a document or image across saves. */
export function hashString(s: string): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(36);
}

export function docId(doc: Pick<CoachDocDraft, 'title' | 'markdown'>): string {
    return `doc-${hashString(`${doc.title}\n${doc.markdown}`)}`;
}

export function docFileName(title: string, ext = 'md'): string {
    const base = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);
    return `${base || 'document'}.${ext}`;
}

/** Plain-text preview lines for cards (markdown syntax stripped). */
export function previewLines(markdown: string, max = 8): string[] {
    return markdown
        .split('\n')
        .map((l) =>
            l
                .replace(/^#{1,6}\s+/, '')
                .replace(/^\s*[-*+]\s+\[( |x|X)\]\s+/, '☐ ')
                .replace(/^\s*[-*+]\s+/, '• ')
                .replace(/\*\*|__|`/g, '')
                .replace(/^\|?\s*-{3,}.*$/, '')
                .replace(/\|/g, '  ')
                .trim(),
        )
        .filter(Boolean)
        .slice(0, max);
}
