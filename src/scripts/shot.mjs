// CDP screenshot: navigate to URL, wait, optionally eval JS, capture PNG.
// usage: node scripts/shot.mjs <out.png> <url> [waitMs] [evalExpr]
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import http from 'node:http';
import WebSocket from 'ws';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9337;
const OUT = process.argv[2];
const URL_ = process.argv[3];
const WAIT = Number(process.argv[4] || 2500);
const EVAL = process.argv[5];

const chrome = spawn(CHROME, [
    '--headless', '--disable-gpu', `--remote-debugging-port=${PORT}`,
    `--window-size=${process.argv[6] || '1440,900'}`, 'about:blank',
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
    const page = targets.find((t) => t.type === 'page' && /^https?:/.test(t.url)) ?? targets.find((t) => t.type === 'page');
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
    await send('Emulation.setDeviceMetricsOverride', { width: Number(process.env.SHOT_W || 1440), height: Number(process.env.SHOT_H || 900), deviceScaleFactor: Number(process.argv[7] || 1), mobile: false });
    await send('Page.navigate', { url: URL_ });
    await sleep(WAIT);
    if (EVAL) {
        const res = await send('Runtime.evaluate', { expression: EVAL, returnByValue: true, awaitPromise: true });
        console.log(JSON.stringify(res.result.result.value));
    }
    if (process.argv[14]) {
        const [mx, my] = process.argv[14].split(',').map(Number);
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: mx, y: my });
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: mx + 1, y: my });
        await sleep(400);
    }
    if (OUT) {
        const clip = process.argv[8]
            ? { x: Number(process.argv[8]), y: Number(process.argv[9]), width: Number(process.argv[10]), height: Number(process.argv[11]), scale: Number(process.argv[12] || 1) }
            : undefined;
        const shot = await send('Page.captureScreenshot', { format: process.argv[13] === 'webp' ? 'webp' : 'png', ...(clip ? { clip } : {}) });
        writeFileSync(OUT, Buffer.from(shot.result.data, 'base64'));
        console.log('saved', OUT);
    }
    ws.close();
} finally {
    chrome.kill();
}
process.exit(0);
