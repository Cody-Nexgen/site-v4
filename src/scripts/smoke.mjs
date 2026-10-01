// CDP smoke: navigate, collect console errors, eval DOM state, screenshot.
// usage: node scripts/smoke.mjs <out.png> <url> [waitMs]
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import http from 'node:http';
import WebSocket from 'ws';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9338;
const OUT = process.argv[2];
const URL_ = process.argv[3];
const WAIT = Number(process.argv[4] || 4000);

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
    const errors = [];
    ws.on('message', (m) => {
        const msg = JSON.parse(m);
        if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
        if (msg.method === 'Runtime.consoleAPICalled' && (msg.params.type === 'error' || msg.params.type === 'warning')) {
            errors.push(msg.params.type + ': ' + msg.params.args.map((a) => a.value || a.description || '').join(' '));
        }
        if (msg.method === 'Runtime.exceptionThrown') {
            errors.push('exception: ' + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text));
        }
        if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
            errors.push('log: ' + msg.params.entry.text);
        }
    });
    const send = (method, params = {}) => new Promise((r) => {
        const i = ++id;
        pending.set(i, r);
        ws.send(JSON.stringify({ id: i, method, params }));
    });
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Log.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: URL_ });
    await sleep(WAIT);
    const res = await send('Runtime.evaluate', {
        expression: `JSON.stringify({
            url: location.href,
            shell: !!document.querySelector('.focuz-shell-v2, .focuz-dashboard-shell'),
            workspace: !!document.querySelector('.workspace-main'),
            auth: !!document.querySelector('input[type=password], input[type=email]'),
            bodyText: document.body.innerText.slice(0, 300),
        })`,
        returnByValue: true,
    });
    console.log('STATE', res.result.result.value);
    console.log('ERRORS(' + errors.length + ')');
    errors.slice(0, 15).forEach((e) => console.log(' ', e.slice(0, 300)));
    if (OUT) {
        const shot = await send('Page.captureScreenshot', { format: 'png' });
        writeFileSync(OUT, Buffer.from(shot.result.data, 'base64'));
        console.log('saved', OUT);
    }
    ws.close();
} finally {
    chrome.kill();
}
process.exit(0);
