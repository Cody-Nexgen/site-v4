import { equal } from 'node:assert/strict';
import test from 'node:test';
import {
    createListPreset,
    newBlock,
    normalizeListPreset,
} from './listTypes';

test('custom preset title survives storage round trip', () => {
    const created = createListPreset({
        title: 'Weekly review',
        description: 'Friday reset',
        accent: '#5ea2ff',
        blocks: [newBlock('heading', 'Review')],
    });
    const reloaded = normalizeListPreset(JSON.parse(JSON.stringify(created)));

    equal(created.title, 'Weekly review');
    equal(reloaded?.title, 'Weekly review');
});

test('legacy preset name migrates to the canonical title', () => {
    const reloaded = normalizeListPreset({
        id: 'preset_legacy',
        name: 'Legacy review',
        description: '',
        accent: '#5ea2ff',
        blocks: [],
        createdAt: '2026-07-14T00:00:00.000Z',
    });

    equal(reloaded?.title, 'Legacy review');
});
