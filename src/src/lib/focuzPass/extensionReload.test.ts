import assert from 'node:assert/strict';
import test from 'node:test';
import { extensionContextGone, isContextInvalidatedError } from './extensionReload';

const g = globalThis as unknown as { location?: { protocol: string }; chrome?: { runtime?: { id?: string } } };

function withPage(protocol: string, runtime: { id?: string } | undefined, run: () => void) {
    const saved = { location: g.location, chrome: g.chrome };
    g.location = { protocol };
    g.chrome = { runtime };
    try {
        run();
    } finally {
        g.location = saved.location;
        g.chrome = saved.chrome;
    }
}

test('Orphaned extension page: the runtime id is gone', () => {
    withPage('chrome-extension:', {}, () => assert.equal(extensionContextGone(), true));
    withPage('chrome-extension:', undefined, () => assert.equal(extensionContextGone(), true));
    withPage('chrome-extension:', { id: 'abcdefghijklmnop' }, () => assert.equal(extensionContextGone(), false));
});

test('The website never counts as orphaned, though its chrome shim has no runtime id', () => {
    withPage('https:', { id: undefined }, () => assert.equal(extensionContextGone(), false));
    withPage('http:', {}, () => assert.equal(extensionContextGone(), false));
});

test('Recognises the browser\'s "context invalidated" error', () => {
    assert.equal(isContextInvalidatedError(new Error('Extension context invalidated.')), true);
    assert.equal(isContextInvalidatedError('Extension context invalidated.'), true);
    assert.equal(isContextInvalidatedError(new Error('The vault could not be unlocked')), false);
    assert.equal(isContextInvalidatedError(undefined), false);
});
