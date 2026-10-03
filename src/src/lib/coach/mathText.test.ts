import assert from 'node:assert/strict';
import test from 'node:test';
import { escapeCurrencyForMath, prepareMathMarkdown } from './mathText';

test('Dollar amounts are escaped so they stay money, not math', () => {
    assert.equal(escapeCurrencyForMath('It costs $5 and $10.'), 'It costs \\$5 and \\$10.');
    assert.equal(escapeCurrencyForMath('Budget: $1,200.50/month'), 'Budget: \\$1,200.50/month');
    assert.equal(escapeCurrencyForMath('$20'), '\\$20');
    assert.equal(escapeCurrencyForMath('Raised $3M, spent $40k'), 'Raised \\$3M, spent \\$40k');
});

test('Real math is left alone', () => {
    assert.equal(escapeCurrencyForMath('Solve $2x + 3 = 7$'), 'Solve $2x + 3 = 7$');
    assert.equal(escapeCurrencyForMath('That is $2^{10}$ bytes'), 'That is $2^{10}$ bytes');
    assert.equal(escapeCurrencyForMath('$x^2$ and $3$'), '$x^2$ and $3$');
    assert.equal(escapeCurrencyForMath('$$\\int_0^1 x\\,dx$$'), '$$\\int_0^1 x\\,dx$$');
    assert.equal(escapeCurrencyForMath('Already escaped \\$5'), 'Already escaped \\$5');
});

test('Code is left alone', () => {
    assert.equal(escapeCurrencyForMath('Run `echo $5` now, it costs $5'), 'Run `echo $5` now, it costs \\$5');
    const fenced = 'Price $5\n```bash\necho $5\n```\nthen $6';
    assert.equal(escapeCurrencyForMath(fenced), 'Price \\$5\n```bash\necho $5\n```\nthen \\$6');
    // A fence still being streamed (no closing line yet) stays untouched too.
    assert.equal(escapeCurrencyForMath('```sh\necho $5'), '```sh\necho $5');
});

test('A one-line $$…$$ becomes a display equation; code stays as is', () => {
    assert.equal(prepareMathMarkdown('Area:\n$$\\pi r^2$$\nDone'), 'Area:\n$$\n\\pi r^2\n$$\nDone');
    assert.equal(prepareMathMarkdown('Inline $$x$$ in text stays'), 'Inline $$x$$ in text stays');
    assert.equal(prepareMathMarkdown('Costs $5'), 'Costs \\$5');
});

test('An equation wrapped in a code block renders as math; real LaTeX source stays code', () => {
    const quad = 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}';
    assert.equal(prepareMathMarkdown('Here:\n\n```\n$$ ' + quad + ' $$\n```\n\nDone'), 'Here:\n\n$$\n' + quad + '\n$$\n\nDone');
    assert.equal(prepareMathMarkdown('```latex\n$$x^2$$\n```'), '$$\nx^2\n$$');
    assert.equal(prepareMathMarkdown('```tex\n\\[ e^{i\\pi} + 1 = 0 \\]\n```'), '$$\ne^{i\\pi} + 1 = 0\n$$');
    assert.equal(prepareMathMarkdown('```math\na^2 + b^2 = c^2\n```'), '$$\na^2 + b^2 = c^2\n$$');
    const doc = '```latex\n\\documentclass{article}\n\\begin{document}\n$x$\n\\end{document}\n```';
    assert.equal(prepareMathMarkdown(doc), doc);
    assert.equal(prepareMathMarkdown('```bash\necho $$x$$\n```'), '```bash\necho $$x$$\n```');
});
