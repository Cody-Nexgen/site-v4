// CDP screenshot with a pre-capture action + settle wait.
// usage: node scripts/shot-action.mjs <out.png> <url> <actionExpr> [loadWaitMs] [postWaitMs] [evalExpr]
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import http from 'node:http';
import WebSocket from 'ws';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9341;
const [OUT, URL_, ACTION, LOAD = 2200, POST = 900, EVAL] = process.argv.slice(2);

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
        if (msg.method === 'Runtime.exceptionThrown') {
            console.log('PAGE-ERR:', JSON.stringify(msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text).slice(0, 500));
        }
        if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) {
            console.log('PAGE-LOG:', msg.params.type, msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 300));
        }
    });
    const send = (method, params = {}) => new Promise((r) => {
        const i = ++id;
        pending.set(i, r);
        ws.send(JSON.stringify({ id: i, method, params }));
    });
    const evalJs = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result.result.value;
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: URL_ });
    await sleep(Number(LOAD));
    if (ACTION) console.log('action:', JSON.stringify(await evalJs(ACTION)));
    await sleep(Number(POST));
    if (EVAL) console.log('state:', JSON.stringify(await evalJs(EVAL)));
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(OUT, Buffer.from(shot.result.data, 'base64'));
    console.log('saved', OUT);
    ws.close();
} finally {
    chrome.kill();
}
process.exit(0);
