import { test } from 'node:test';
import assert from 'node:assert/strict';
import { docFileName, docId, extractDocs, previewLines, splitReply } from './docBlocks';

const DOC = [
    'Here is your plan.',
    '',
    '~~~focuz-doc',
    'title: Weekly focus plan',
    'type: plan',
    '---',
    '# Weekly focus plan',
    '',
    '- **Mon** deep work 9–11',
    '- [ ] Review Friday',
    '',
    '```js',
    'inner code fence survives',
    '```',
    '~~~',
    '',
    'Want me to add these to your calendar?',
].join('\n');

test('splits text / doc / text and reads front-matter', () => {
    const segs = splitReply(DOC);
    assert.equal(segs.length, 3);
    assert.deepEqual(segs[0], { kind: 'text', text: 'Here is your plan.' });
    assert.equal(segs[1].kind, 'doc');
    if (segs[1].kind !== 'doc') return;
    assert.equal(segs[1].doc.title, 'Weekly focus plan');
    assert.equal(segs[1].doc.docType, 'plan');
    assert.equal(segs[1].doc.complete, true);
    assert.match(segs[1].doc.markdown, /^# Weekly focus plan/);
    assert.match(segs[1].doc.markdown, /inner code fence survives\n```$/);
    assert.deepEqual(segs[2], { kind: 'text', text: 'Want me to add these to your calendar?' });
});

test('streaming: an unclosed block is incomplete and not extracted', () => {
    const partial = DOC.slice(0, DOC.indexOf('- [ ]'));
    const segs = splitReply(partial);
    assert.equal(segs.length, 2);
    assert.equal(segs[1].kind === 'doc' && segs[1].doc.complete, false);
    assert.equal(extractDocs(partial).length, 0);
    assert.equal(extractDocs(DOC).length, 1);
});

test('backtick fences, missing meta and fuzzy types', () => {
    const md = '```focuz-doc\ntype: Morning routine\n---\n## Wake up early\n- water\n```';
    const [seg] = splitReply(md);
    assert.equal(seg.kind, 'doc');
    if (seg.kind !== 'doc') return;
    assert.equal(seg.doc.title, 'Wake up early');
    assert.equal(seg.doc.docType, 'routine');
});

test('plain replies pass through untouched', () => {
    assert.deepEqual(splitReply('Just text\n\n- a\n- b'), [{ kind: 'text', text: 'Just text\n\n- a\n- b' }]);
    assert.deepEqual(splitReply(''), []);
});

test('helpers: stable ids, file names, previews', () => {
    const a = { title: 'Plan', markdown: 'x' };
    assert.equal(docId(a), docId({ ...a }));
    assert.notEqual(docId(a), docId({ title: 'Plan', markdown: 'y' }));
    assert.equal(docFileName('Weekly Focus Plan: v2!'), 'weekly-focus-plan-v2.md');
    assert.deepEqual(previewLines('# Title\n\n- **one**\n- [ ] two\n| a | b |\n| --- | --- |'), [
        'Title',
        '• one',
        '☐ two',
        'a    b',
    ]);
});
