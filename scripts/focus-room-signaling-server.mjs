/**
 * FocuzNow focus-room signaling server.
 * Run on the VPS (170.205.37.149):  node focus-room-signaling-server.mjs
 *
 * IMPORTANT: binds 0.0.0.0 so clients can reach ws://170.205.37.149:8080
 * (localhost-only binds are unreachable from the internet).
 *
 * Open firewall TCP 8080. For focuznow.com (HTTPS) you also need WSS —
 * put Caddy/nginx with TLS in front, or use cloudflared.
 */
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';

/** @type {Map<string, Map<string, import('ws').WebSocket>>} */
const rooms = new Map();

const server = createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('FocuzNow focus-room signaling OK\n');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
    let roomId = null;
    let peerId = null;

    ws.on('message', (raw) => {
        let msg;
        try {
            msg = JSON.parse(String(raw));
        } catch {
            return;
        }
        if (!msg?.type || !msg.roomId || !msg.from) return;

        roomId = String(msg.roomId);
        peerId = String(msg.from);
        if (!rooms.has(roomId)) rooms.set(roomId, new Map());
        const room = rooms.get(roomId);
        room.set(peerId, ws);

        const payload = JSON.stringify(msg);
        if (msg.to && msg.to !== '*') {
            const target = room.get(String(msg.to));
            if (target && target.readyState === 1 && target !== ws) target.send(payload);
            return;
        }

        for (const peer of room.values()) {
            if (peer !== ws && peer.readyState === 1) peer.send(payload);
        }
    });

    ws.on('close', () => {
        if (!roomId || !peerId) return;
        const room = rooms.get(roomId);
        if (!room) return;
        room.delete(peerId);
        const leave = JSON.stringify({ type: 'leave', roomId, from: peerId, peerId });
        for (const peer of room.values()) {
            if (peer.readyState === 1) peer.send(leave);
        }
        if (room.size === 0) rooms.delete(roomId);
    });
});

server.listen(PORT, HOST, () => {
    console.log(`[focuz-signaling] listening on ${HOST}:${PORT}`);
    console.log('[focuz-signaling] put Caddy in front → wss://signal.focuznow.com');
});
