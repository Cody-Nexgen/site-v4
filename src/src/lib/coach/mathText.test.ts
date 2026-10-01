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
    assert.equal(prepareMathMarkdown('```tex\n$$x$$\n```'), '```tex\n$$x$$\n```');
    assert.equal(prepareMathMarkdown('Costs $5'), 'Costs \\$5');
});
