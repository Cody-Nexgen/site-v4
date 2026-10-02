import assert from 'node:assert/strict';
import test from 'node:test';
import { iconCandidates, iconHost, iconLook } from './siteIcons';

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

/** n pixels of one RGBA colour. */
function px(n: number, r: number, g: number, b: number, a: number): number[] {
    return Array.from({ length: n }, () => [r, g, b, a]).flat();
}

test('Site icons: see-through icons and what their visible part looks like', () => {
    // Black logo on a clear background (Apple, GitHub): transparent, dark.
    assert.deepEqual(iconLook(new Uint8Array([...px(60, 0, 0, 0, 0), ...px(40, 10, 10, 10, 255)])), { transparent: true, tone: 'dark' });
    // White logo on clear: light.
    assert.deepEqual(iconLook(new Uint8Array([...px(60, 0, 0, 0, 0), ...px(40, 250, 250, 250, 255)])), { transparent: true, tone: 'light' });
    // Coloured logo on clear: colour.
    assert.deepEqual(iconLook(new Uint8Array([...px(60, 0, 0, 0, 0), ...px(40, 230, 40, 40, 255)])), { transparent: true, tone: 'color' });
    // An app icon with its own background: not transparent.
    assert.equal(iconLook(new Uint8Array([...px(10, 0, 0, 0, 0), ...px(90, 30, 120, 220, 255)])).transparent, false);
});
