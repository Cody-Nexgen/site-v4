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

/** @type {Map<string, Map<string, { ws: import('ws').WebSocket, meta: Record<string, unknown> }>>} */
const rooms = new Map();

const server = createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('FocuzNow focus-room signaling OK\n');
});

const wss = new WebSocketServer({ server });

function send(ws, obj) {
    if (ws.readyState === 1) ws.send(JSON.stringify(obj));
}

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

        const prev = room.get(peerId);
        room.set(peerId, {
            ws,
            meta: {
                peerId,
                name: msg.name,
                avatarUrl: msg.avatarUrl ?? null,
                accountUserId: msg.accountUserId ?? null,
            },
        });

        // On join: tell the newcomer who is already here, then fan-out join to others.
        if (msg.type === 'join') {
            for (const [otherId, entry] of room.entries()) {
                if (otherId === peerId) continue;
                if (entry.ws.readyState !== 1) continue;
                // Existing peer → newcomer (so late joiners discover the room)
                send(ws, {
                    type: 'join',
                    roomId,
                    from: otherId,
                    peerId: otherId,
                    name: entry.meta.name,
                    avatarUrl: entry.meta.avatarUrl,
                    accountUserId: entry.meta.accountUserId,
                });
                // Newcomer → existing peer
                send(entry.ws, {
                    type: 'join',
                    roomId,
                    from: peerId,
                    peerId,
                    name: msg.name,
                    avatarUrl: msg.avatarUrl ?? null,
                    accountUserId: msg.accountUserId ?? null,
                });
            }
            return;
        }

        // Re-bind socket if peer reconnects with same id
        if (prev && prev.ws !== ws && prev.ws.readyState === 1) {
            try {
                prev.ws.close();
            } catch {
                /* ignore */
            }
        }

        const payload = JSON.stringify(msg);
        if (msg.to && msg.to !== '*') {
            const target = room.get(String(msg.to));
            if (target && target.ws.readyState === 1 && target.ws !== ws) target.ws.send(payload);
            return;
        }

        for (const entry of room.values()) {
            if (entry.ws !== ws && entry.ws.readyState === 1) entry.ws.send(payload);
        }
    });

    ws.on('close', () => {
        if (!roomId || !peerId) return;
        const room = rooms.get(roomId);
        if (!room) return;
        const entry = room.get(peerId);
        // Only remove if this socket still owns the slot (avoid race on reconnect).
        if (entry && entry.ws !== ws) return;
        room.delete(peerId);
        const leave = JSON.stringify({ type: 'leave', roomId, from: peerId, peerId });
        for (const peer of room.values()) {
            if (peer.ws.readyState === 1) peer.ws.send(leave);
        }
        if (room.size === 0) rooms.delete(roomId);
    });
});

server.listen(PORT, HOST, () => {
    console.log(`[focuz-signaling] listening on ${HOST}:${PORT}`);
    console.log('[focuz-signaling] put Caddy in front → wss://signal.focuznow.com');
});
