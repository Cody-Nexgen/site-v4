import assert from 'node:assert/strict';
import test from 'node:test';
import { iconCandidates, iconHost } from './siteIcons';

test('Site icons: declared icons are ranked apple-touch-icon, then SVG, then by size', () => {
    const html = `<head>
        <link rel="icon" href="/favicon-16.png" sizes="16x16">
        <link rel='icon' type='image/svg+xml' href='/icon.svg'>
        <link rel="shortcut icon" href="https://cdn.example.com/fav.ico">
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
        <link rel="stylesheet" href="/app.css">
        <link rel="icon" href="data:image/png;base64,AAAA">
        <link rel=icon href=/icon-96.png sizes=96x96>
    </head>`;
    const ranked = iconCandidates(html, 'https://www.example.com/login');
    assert.deepEqual(
        ranked.map((c) => [c.href, c.bleed]),
        [
            ['https://www.example.com/apple-touch-icon.png', true],
            ['https://www.example.com/icon.svg', false],
            ['https://cdn.example.com/fav.ico', false],
            ['https://www.example.com/icon-96.png', false],
            ['https://www.example.com/favicon-16.png', false],
        ],
    );
});

test('Site icons: only public web hosts are looked up', () => {
    assert.equal(iconHost('https://GitHub.com/login'), 'github.com');
    assert.equal(iconHost('accounts.spotify.com'), 'accounts.spotify.com');
    for (const local of ['localhost:3000', 'http://192.168.1.1', '10.0.0.8', 'router.local', 'intranet', 'file:///etc/passwd', 'chrome://settings']) {
        assert.equal(iconHost(local), null, local);
    }
});
