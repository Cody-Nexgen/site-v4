import assert from 'node:assert/strict';
import test from 'node:test';
import { embedSrc, readEmbedToHost, readHostToEmbed, safeImageUrl } from './embed';

const BASE = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop/src/focuzpass-embed/index.html';

test('Frame URL: view, theme and display bits in the query; a transfer code only in the fragment', () => {
    const url = new URL(embedSrc(BASE, { view: 'receive', theme: 'dark', code: 'K7Q4MZ8TR1' }));
    assert.equal(url.searchParams.get('view'), 'receive');
    assert.equal(url.searchParams.get('theme'), 'dark');
    assert.equal(url.hash, '#K7Q4MZ8TR1');
    assert.ok(!url.search.includes('K7Q4MZ8TR1'));

    const vault = new URL(embedSrc(BASE, { view: 'vault', name: 'Sam Lee', username: 'sam', avatar: 'javascript:alert(1)' }));
    assert.equal(vault.searchParams.get('name'), 'Sam Lee');
    assert.equal(vault.searchParams.get('avatar'), null, 'only https images');
});

test('Images: https only', () => {
    assert.equal(safeImageUrl('https://cdn.test/a.png'), 'https://cdn.test/a.png');
    for (const bad of ['http://cdn.test/a.png', 'data:image/png;base64,AAAA', 'javascript:alert(1)', 'not a url', 42, null, `https://x.test/${'a'.repeat(3000)}`]) {
        assert.equal(safeImageUrl(bad), undefined, String(bad).slice(0, 30));
    }
});

test('Messages: only the known shapes get through', () => {
    assert.deepEqual(readEmbedToHost({ type: 'focuzpass-embed:exit', extra: 'dropped' }), { type: 'focuzpass-embed:exit' });
    assert.deepEqual(readEmbedToHost({ type: 'focuzpass-embed:height', height: 312.6 }), { type: 'focuzpass-embed:height', height: 313 });
    assert.deepEqual(readEmbedToHost({ type: 'focuzpass-embed:height', height: 1e9 }), { type: 'focuzpass-embed:height', height: 4000 });
    assert.equal(readEmbedToHost({ type: 'focuzpass-embed:height', height: 'tall' }), null);
    assert.equal(readEmbedToHost({ type: 'something-else' }), null);
    assert.equal(readEmbedToHost('focuzpass-embed:exit'), null);
    assert.deepEqual(readHostToEmbed({ type: 'focuzpass-embed:theme', mode: 'light' }), { type: 'focuzpass-embed:theme', mode: 'light' });
    assert.equal(readHostToEmbed({ type: 'focuzpass-embed:theme', mode: 'hotpink' }), null);
    assert.equal(readHostToEmbed(null), null);
});
