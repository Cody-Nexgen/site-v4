// CDP helper: report document scroll dims vs viewport for a URL.
import { spawn } from 'node:child_process';
import http from 'node:http';
import WebSocket from 'ws';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9334;
const URL_ = process.argv[2] || 'http://localhost:5173/sidebar-preview.html';

const chrome = spawn(CHROME, ['--headless', '--disable-gpu', `--remote-debugging-port=${PORT}`, '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
const get = (p) => new Promise((res, rej) => http.get({ host: 'localhost', port: PORT, path: p }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => res(JSON.parse(d))); }).on('error', rej));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
    let targets;
    for (let i = 0; i < 30; i++) { try { targets = await get('/json'); break; } catch { await sleep(300); } }
    const page = targets.find((t) => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((r) => ws.on('open', r));
    let id = 0; const pending = new Map();
    ws.on('message', (m) => { const msg = JSON.parse(m); if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); } });
    const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: URL_ });
    await sleep(2500);
    const res = await send('Runtime.evaluate', {
        expression: `JSON.stringify({sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, iw: innerWidth, ih: innerHeight, ox: [...document.querySelectorAll('*')].filter(e => e.scrollWidth > e.clientWidth + 1 || e.getBoundingClientRect().right > innerWidth + 1 || e.getBoundingClientRect().bottom > innerHeight + 1).slice(0,8).map(e => e.tagName + '.' + e.className.toString().slice(0,60) + ' r=' + Math.round(e.getBoundingClientRect().right) + ' b=' + Math.round(e.getBoundingClientRect().bottom))})`,
        returnByValue: true,
    });
    console.log(res.result.result.value);
    ws.close();
} finally { chrome.kill(); }
process.exit(0);
