// CDP mid-drag screenshot: press on the sidebar separator, drag toward rail, capture before release.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import http from 'node:http';
import WebSocket from 'ws';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9333;
const OUT = process.argv[2];
const URL_ = process.argv[3] || 'http://localhost:5173/sidebar-preview.html';

const chrome = spawn(CHROME, [
    '--headless', '--disable-gpu', `--remote-debugging-port=${PORT}`,
    '--window-size=1440,900', 'about:blank',
], { stdio: 'ignore' });

const get = (path) => new Promise((res, rej) => {
    http.get({ host: 'localhost', port: PORT, path }, (r) => {
        let d = '';
        r.on('data', (c) => (d += c));
        r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
    let targets;
    for (let i = 0; i < 30; i++) {
        try { targets = await get('/json'); break; } catch { await sleep(300); }
    }
    const page = targets.find((t) => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl, { maxPayload: 64 * 1024 * 1024 });
    await new Promise((r) => ws.on('open', r));

    let id = 0;
    const pending = new Map();
    ws.on('message', (m) => {
        const msg = JSON.parse(m);
        if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    });
    const send = (method, params = {}) => new Promise((r) => {
        const i = ++id;
        pending.set(i, r);
        ws.send(JSON.stringify({ id: i, method, params }));
    });

    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: URL_ });
    await sleep(3500);

    const drag = async (x1, x2) => {
        const ev = (type, x, extra = {}) => send('Input.dispatchMouseEvent', { type, x, y: 450, button: 'left', buttons: 1, clickCount: 1, ...extra });
        await ev('mousePressed', x1);
        for (let x = x1; x > x2; x -= 12) { await ev('mouseMoved', x); await sleep(30); }
        await ev('mouseMoved', x2);
        await sleep(400); // let rubber-band/snap animation settle mid-transition
        const shot = await send('Page.captureScreenshot', { format: 'png' });
        writeFileSync(OUT, Buffer.from(shot.result.data, 'base64'));
        await ev('mouseReleased', x2);
    };

    // separator sits at right edge of the 244px sidebar
    await drag(246, 120);
    console.log('saved', OUT);
    ws.close();
} finally {
    chrome.kill();
}
process.exit(0);
