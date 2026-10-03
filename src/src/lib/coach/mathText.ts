/**
 * Coach replies render `$…$` as math. Money uses the same sign ("$5 and $10" would turn into a
 * formula), so a dollar amount gets escaped first: a `$` followed by an amount that ends there
 * (space, punctuation, end of text). Real math like `$2x$` or `$2^{10}$` is left alone, and so is
 * anything inside code.
 */
const CURRENCY = /(^|[^\\$])\$(\d[\d,]*(?:\.\d+)?(?:[kKmMbB]\b)?)(?=$|[\s.,;:!?)\]/%-])/g;

/** A line that is only `$$…$$` is a display equation, but the parser only sees one when the `$$` sit on their own lines. */
const ONE_LINE_DISPLAY = /^([ \t]*)\$\$([^\n]+?)\$\$[ \t]*$/gm;

function prepareProse(text: string, display: boolean): string {
    const lines = display ? text.replace(ONE_LINE_DISPLAY, (_m, indent: string, body: string) => `${indent}$$\n${indent}${body.trim()}\n${indent}$$`) : text;
    // Inline code spans stay as written.
    return lines
        .split(/(`+[^`]*`+)/)
        .map((part, i) => (i % 2 === 1 ? part : part.replace(CURRENCY, (_m, before: string, amount: string) => `${before}\\$${amount}`)))
        .join('');
}

/**
 * Models often wrap an equation in a code block (```latex with `$$…$$` inside, or ```math). That
 * shows raw source instead of the formula, so such a block becomes a display equation. A block of
 * real LaTeX source (a document, macros, anything not just one `$$…$$`) stays code.
 */
const MATH_FENCE = /^(?:```|~~~)[ \t]*(math|katex|latex|tex)?[ \t]*\n([\s\S]*?)\n?(?:```|~~~)[ \t]*$/;

function fencedMath(block: string): string | null {
    const match = block.match(MATH_FENCE);
    if (!match) return null;
    const lang = match[1]?.toLowerCase();
    const body = match[2]!.trim();
    const wrapped = body.match(/^\$\$([\s\S]+?)\$\$$/) ?? body.match(/^\\\[([\s\S]+?)\\\]$/);
    if (wrapped) return `$$\n${wrapped[1]!.trim()}\n$$`;
    if ((lang === 'math' || lang === 'katex') && body) return `$$\n${body}\n$$`;
    return null;
}

function outsideCode(markdown: string, display: boolean): string {
    if (!markdown.includes('$') && !/^(?:```|~~~)[ \t]*(?:math|katex|latex|tex)\b/m.test(markdown)) return markdown;
    // Fenced code blocks (``` or ~~~) stay as written, unless one only holds an equation.
    const parts = markdown.split(/(^(?:```|~~~)[^\n]*\n[\s\S]*?(?:^(?:```|~~~)[^\n]*$|(?![\s\S])))/m);
    return parts.map((part, i) => (i % 2 === 1 ? (display ? fencedMath(part) ?? part : part) : prepareProse(part, display))).join('');
}

export function escapeCurrencyForMath(markdown: string): string {
    return outsideCode(markdown, false);
}

/** Everything a coach reply needs before rendering: money escaped, one-line display equations opened up. */
export function prepareMathMarkdown(markdown: string): string {
    return outsideCode(markdown, true);
}
