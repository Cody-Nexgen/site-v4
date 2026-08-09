# Focus room signaling — VPS setup (always-on + WSS)

Your site is **HTTPS**, so browsers will only use **`wss://`** (not `ws://`).
Without TLS in front of Node, the website falls back to Supabase Realtime.

## One-time setup on `170.205.37.149`

### 1) DNS
In your focuznow.com DNS provider, add:

| Type | Name     | Value           |
|------|----------|-----------------|
| A    | `signal` | `170.205.37.149` |

Wait until `signal.focuznow.com` resolves to that IP.

### 2) Signaling app
```bash
sudo mkdir -p /opt/focuz-signaling
cd /opt/focuz-signaling
# copy focus-room-signaling-server.mjs here, then:
npm init -y
npm i ws
```

### 3) systemd (always running)
```bash
sudo cp focuz-signaling.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now focuz-signaling
sudo systemctl status focuz-signaling
```

Useful commands:
```bash
sudo journalctl -u focuz-signaling -f
sudo systemctl restart focuz-signaling
```

### 4) Caddy (HTTPS → WSS)
```bash
# Install Caddy if needed, then merge focus-room-caddy.Caddyfile into /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Open firewall **80** and **443** (Caddy needs them for Let's Encrypt).
You do **not** need to expose 8080 publicly when Caddy proxies locally.

### 5) Verify
```bash
curl -I https://signal.focuznow.com
# Expect 200 from the Node health check via Caddy

# From a browser console on https://focuznow.com:
# new WebSocket('wss://signal.focuznow.com')  → should open
```

The app defaults to `wss://signal.focuznow.com`. After DNS + Caddy are live, the website should almost never hit Realtime.

## Deploy server update (peer sync)

Newer `focus-room-signaling-server.mjs` tells **new joiners** about peers already in the room
(old builds only notified existing peers → late joiners could sit alone forever).

```bash
# from your machine (with SSH access to the VPS):
scp scripts/focus-room-signaling-server.mjs focuznow:/opt/focuz-signaling/focus-room-signaling-server.mjs
ssh focuznow 'systemctl restart focuz-signaling && systemctl is-active focuz-signaling'
```
