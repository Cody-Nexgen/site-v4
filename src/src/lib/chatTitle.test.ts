import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeTitle, isAcceptableTitle, fallbackTitleFromMessage } from './chatTitle';

test('sanitizeTitle strips quotes, markdown, prefix, trailing punctuation', () => {
    assert.equal(sanitizeTitle('"Savanna climate overview."'), 'Savanna climate overview');
    assert.equal(sanitizeTitle('Title: Block YouTube during study sessions'), 'Block YouTube during study sessions');
    assert.equal(sanitizeTitle('**Deep work plan**'), 'Deep work plan');
    assert.equal(sanitizeTitle('  Morning   routine  ideas! '), 'Morning routine ideas');
});

test('sanitizeTitle caps at 60 chars on a word boundary', () => {
    const long = 'This is a very long chat title that goes well beyond sixty characters total';
    const out = sanitizeTitle(long);
    assert.ok(out.length <= 60);
    assert.ok(!out.endsWith(' '));
});

test('isAcceptableTitle rejects truncated/generic titles', () => {
    assert.equal(isAcceptableTitle('F'), false);
    assert.equal(isAcceptableTitle('Val'), false);
    assert.equal(isAcceptableTitle('New Chat'), false);
    assert.equal(isAcceptableTitle('chat'), false);
    assert.equal(isAcceptableTitle('Question'), false);
    assert.equal(isAcceptableTitle('Untitled'), false);
    assert.equal(isAcceptableTitle('Savanna climate overview'), true);
    assert.equal(isAcceptableTitle('A decent enough title', 'MAX_TOKENS'), false);
});

test('fallbackTitleFromMessage strips filler and caps words', () => {
    assert.equal(
        fallbackTitleFromMessage('hey can you help me make a study plan for my bio exam friday?'),
        'Help me make a study plan',
    );
    assert.equal(fallbackTitleFromMessage(''), 'New chat');
    assert.equal(fallbackTitleFromMessage('how do i block youtube when studying'), 'Block youtube when studying');
    assert.equal(fallbackTitleFromMessage('pomodoro'), 'Chat about Pomodoro');
    assert.equal(
        fallbackTitleFromMessage('please what is the best pomodoro interval for deep work sessions'),
        'Best pomodoro interval for deep work',
    );
});
