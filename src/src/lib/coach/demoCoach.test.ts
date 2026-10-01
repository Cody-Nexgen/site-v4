import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    appendTurn,
    createSession,
    deleteSession,
    listSessions,
    loadMessages,
    renameSession,
    demoTitleFor,
} from './demoCoach';
import { labelForModel, modelIdForLabel } from '../aiCoachModels';

test('demo session store: create/rename/append/delete', () => {
    const s = createSession();
    assert.ok(s.id);
    assert.equal(s.title, 'New chat');
    assert.ok(listSessions().some((x) => x.id === s.id));

    renameSession(s.id, 'Study plan for finals');
    assert.equal(listSessions().find((x) => x.id === s.id)?.title, 'Study plan for finals');

    appendTurn(s.id, 'hello', 'hi there');
    const msgs = loadMessages(s.id);
    assert.equal(msgs.length, 2);
    assert.equal(msgs[0].role, 'user');
    assert.equal(msgs[1].role, 'assistant');

    deleteSession(s.id);
    assert.ok(!listSessions().some((x) => x.id === s.id));
});

test('demo store seeds sessions on first load', () => {
    assert.ok(listSessions().length >= 1);
});

test('model label <-> id mapping', () => {
    assert.equal(modelIdForLabel('FocuzAI'), 'gemini-2.5-flash');
    assert.equal(modelIdForLabel('FocuzAI Think'), 'gemini-2.5-pro');
    assert.equal(modelIdForLabel('nonsense'), 'gemini-2.5-flash');
    assert.equal(labelForModel('gemini-2.5-pro'), 'FocuzAI Think');
    assert.equal(labelForModel('gemini-2.5-flash'), 'FocuzAI');
});

test('demo titles: curated mapping + dangling-word trim', () => {
    assert.equal(demoTitleFor('should I use Pomodoro or longer blocks'), 'Pomodoro vs longer focus blocks');
    const t = demoTitleFor('help me decide between tea or coffee');
    assert.ok(t.length > 0 && !/\s(or|and|to|for|with|of|the|a|an|in|on|vs)$/i.test(t));
    assert.equal(demoTitleFor(''), 'New chat');
});
